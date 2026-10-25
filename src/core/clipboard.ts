import { movePatch } from './commands';
import { newId } from './ids';
import { FORMAT_VERSION, type Asset, type Definition, type Element, type Id, type ProjectDoc } from './model';
import type { DocStore } from './store';

/**
 * Kopiera och klistra in (0.7.1), även mellan projekt. Det som kopieras tas
 * med tillsammans med typerna det använder, så att det går att klistra in i
 * ett projekt som inte har dem. Texten läggs också på datorns urklipp, så att
 * det fungerar mellan flikar och fönster.
 */
export interface ClipPayload {
  kind: 'bacchus-clip';
  /** Filformatet det kopierades i; äldre urklipp går att klistra in. */
  format: number;
  /** Projektet det kopierades från, för att veta om originalen finns här. */
  project: string;
  storey: Id;
  elements: Element[];
  definitions: Definition[];
  /** Underlagens filer (0.8 del 2), så att de följer med till ett annat projekt. */
  assets?: Asset[];
}

/** Elementtyper som bara finns en gång i ett projekt. */
const SINGLE = new Set(['North']);

export function copyPayload(doc: ProjectDoc, ids: readonly Id[], storey: Id): ClipPayload | null {
  const pick = new Set(ids.filter((id) => doc.elements[id] && !doc.elements[id].host));
  // Dörrar och fönster följer med sin vägg; markerade öppningar utan sin vägg tas inte med.
  for (const e of Object.values(doc.elements)) if (e.host && pick.has(e.host)) pick.add(e.id);
  if (!pick.size) return null;
  const elements = [...pick].map((id) => structuredClone(doc.elements[id]));
  const defIds = new Set(elements.map((e) => e.definition).filter((d): d is Id => !!d));
  const definitions = [...defIds].map((id) => doc.definitions[id]).filter(Boolean).map((d) => structuredClone(d));
  const assetIds = new Set(elements.map((e) => e.params.asset).filter((a): a is Id => typeof a === 'string' && !!doc.assets[a]));
  const assets = [...assetIds].map((id) => structuredClone(doc.assets[id]));
  return { kind: 'bacchus-clip', format: FORMAT_VERSION, project: doc.project.name, storey, elements, definitions, ...(assets.length ? { assets } : {}) };
}

export function parsePayload(text: string): ClipPayload | null {
  try {
    const v = JSON.parse(text) as Partial<ClipPayload>;
    if (v?.kind !== 'bacchus-clip' || !Array.isArray(v.elements) || !Array.isArray(v.definitions)) return null;
    if (typeof v.format !== 'number' || v.format > FORMAT_VERSION) return null;
    return v as ClipPayload;
  } catch {
    return null;
  }
}

/** Om originalen ligger kvar på samma ställe i det man klistrar in i. */
export function originalsHere(doc: ProjectDoc, clip: ClipPayload, state: Id, storey: Id): boolean {
  if (clip.project !== (doc.project.name) || clip.storey !== storey) return false;
  return clip.elements.some((e) => doc.elements[e.id]?.states.includes(state));
}

/**
 * Klistra in i ett tillstånd och en våning, förskjutet `offset`. Med
 * `keepStates` (kopiera till en annan våning, 0.9) finns kopiorna i samma
 * tillstånd som originalen. Typer som
 * finns med samma littera återanvänds; andra läggs till (med nytt namn om
 * namnet är upptaget av en annan sorts typ). Måttpunkter som hänger på
 * något som inte följer med blir fria punkter.
 */
export function pasteClip(store: DocStore, clip: ClipPayload, state: Id, storey: Id, offset: readonly [number, number], space?: Id, keepStates = false): Id[] {
  const doc = store.doc;
  const elements = clip.elements.filter((e) => !(SINGLE.has(e.type) && Object.values(doc.elements).some((x) => x.type === e.type)));
  if (!elements.length) return [];
  // Typer: samma littera och elementtyp återanvänds.
  const defMap = new Map<Id, Id>();
  const newDefs: Definition[] = [];
  for (const d of clip.definitions) {
    const same = Object.values(doc.definitions).find((x) => x.elementType === d.elementType && x.name === d.name);
    if (same) {
      defMap.set(d.id, same.id);
      continue;
    }
    const id = doc.definitions[d.id] ? newId('def') : d.id;
    defMap.set(d.id, id);
    newDefs.push({ ...structuredClone(d), id });
  }
  const idMap = new Map<Id, Id>();
  for (const e of elements) idMap.set(e.id, newId(e.type.slice(0, 2).toLowerCase()));
  const made: Id[] = [];
  store.transact(elements.length === 1 ? 'Klistra in' : `Klistra in ${elements.length} objekt`, (tx) => {
    for (const d of newDefs) tx.putDefinition(d);
    // Underlagens filer som inte finns här än (0.8 del 2).
    for (const a of clip.assets ?? []) if (!tx.doc.assets[a.id]) tx.putAsset(structuredClone(a));
    for (const e of elements) {
      const params = remapRefs(structuredClone(e.params) as Record<string, unknown>, idMap);
      delete params.number;
      const copy: Element = {
        ...structuredClone(e),
        id: idMap.get(e.id)!,
        storey,
        states: keepStates || e.type === 'Section' || e.type === 'Elevation' || e.type === 'North' ? e.states : [state],
        host: e.host ? idMap.get(e.host) : undefined,
        definition: e.definition ? defMap.get(e.definition) : undefined,
        params,
      };
      if (!copy.host) delete copy.host;
      if (!copy.definition) delete copy.definition;
      // Det klistras in på ytan som visas: ett arbetsblad (0.8 del 2) eller planen.
      if (space) copy.space = space;
      else delete copy.space;
      // Dörrar och fönster följer sin vägg; allt annat flyttas.
      const patch = copy.host || (!offset[0] && !offset[1]) ? null : movePatch(tx.doc, copy, [offset[0], offset[1]]);
      tx.putElement(patch ? { ...copy, params: { ...copy.params, ...patch } } : copy);
      if (!e.host) made.push(copy.id);
    }
  });
  return made;
}

/** Byt id:n i måttpunkternas referenser; referenser till sådant som inte följer med släpps. */
function remapRefs(params: Record<string, unknown>, idMap: Map<Id, Id>): Record<string, unknown> {
  if (!Array.isArray(params.points)) return params;
  params.points = (params.points as unknown[]).map((q) => {
    if (Array.isArray(q) || !q || typeof q !== 'object') return q;
    const p = q as { at: [number, number]; refs?: { id: Id; kind: string }[] };
    const refs = (p.refs ?? []).filter((r) => idMap.has(r.id)).map((r) => ({ ...r, id: idMap.get(r.id)! }));
    return refs.length ? { at: p.at, refs } : p.at;
  });
  return params;
}
