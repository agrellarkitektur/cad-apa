import { copyPayload, pasteClip } from './clipboard';
import { pruneAssets } from './commands';
import { newId } from './ids';
import { buildingStoreys, isSite, storeysUpFrom, withSiteLast, type Element, type Id, type ProjectDoc, type Storey } from './model';
import type { DocStore } from './store';
import { typeOf } from '../elements/registry';

/**
 * Våningsplanen (0.9): skapa, ändra och ta bort våningar, och flytta eller
 * kopiera objekt mellan dem. Objektens koordinater gäller per våning, så en
 * våning som flyttas i höjd tar med sig allt på den.
 */

/** Våningen närmast över (`1`) eller under (`-1`), om det finns någon. */
export function neighbourStorey(doc: Pick<ProjectDoc, 'storeys'>, id: Id, dir: 1 | -1): Storey | undefined {
  const up = storeysUpFrom(doc);
  const i = up.findIndex((s) => s.id === id);
  return i < 0 ? undefined : up[i + dir];
}

/** Kalkera våningen under eller över (0.9), som värde för vyns `trace` i stället för en vy. */
export const TRACE_BELOW = 'våning:under';
export const TRACE_ABOVE = 'våning:över';
/** Kalkera Platsen (0.10.25): marken under en våningsplan. */
export const TRACE_SITE = 'våning:platsen';
/** Kalkera en viss våning (0.10.30), från högerklick i projektträdet: `våning:id:` och våningens id. */
export const TRACE_STOREY = 'våning:id:';

/** Våningen som kalkeras, om `trace` är våningen under eller över eller Platsen. */
export function tracedStorey(doc: Pick<ProjectDoc, 'storeys'>, storey: Id, trace: Id | null | undefined): Storey | undefined {
  if (trace === TRACE_BELOW) return neighbourStorey(doc, storey, -1);
  if (trace === TRACE_ABOVE) return neighbourStorey(doc, storey, 1);
  if (trace === TRACE_SITE && !isSite(storey)) return doc.storeys.find((s) => s.site);
  if (trace?.startsWith(TRACE_STOREY)) {
    const id = trace.slice(TRACE_STOREY.length);
    return id === storey ? undefined : doc.storeys.find((s) => s.id === id);
  }
  return undefined;
}


/** Ett namn för en ny våning: Plan 2, Plan 3 … uppåt, Källarplan nedåt. */
function newStoreyName(doc: Pick<ProjectDoc, 'storeys'>, where: 'above' | 'below'): string {
  const names = new Set(doc.storeys.map((s) => s.name));
  if (where === 'above') {
    const nums = doc.storeys.map((s) => /^Plan (\d+)$/.exec(s.name)).filter(Boolean).map((m) => Number(m![1]));
    let n = nums.length ? Math.max(...nums) + 1 : buildingStoreys(doc).length + 1;
    while (names.has(`Plan ${n}`)) n++;
    return `Plan ${n}`;
  }
  if (!names.has('Källarplan')) return 'Källarplan';
  let n = 2;
  while (names.has(`Källarplan ${n}`)) n++;
  return `Källarplan ${n}`;
}

/**
 * En ny våning ovanför eller under en annan, med samma våningshöjd. Golvnivån
 * räknas från grannen; våningarna som redan ligger ovanför (eller under)
 * flyttas lika mycket, så att ingen hamnar på samma nivå. Svarar med id.
 */
export function addStorey(store: DocStore, from: Id, where: 'above' | 'below'): Id | null {
  const s = store.doc.storeys.find((x) => x.id === from);
  if (!s || s.site) return null;
  const id = newId('pl');
  const name = newStoreyName(store.doc, where);
  const height = s.height;
  const elevation = where === 'above' ? s.elevation + s.height : s.elevation - height;
  store.transact(`Ny våning ${name}`, (tx) => {
    // Platsen står kvar vid ±0 och sist i listan (0.10.25).
    const moved = tx.doc.storeys.map((x) =>
      x.site ? x : where === 'above' && x.elevation > s.elevation ? { ...x, elevation: x.elevation + height } : where === 'below' && x.elevation < s.elevation ? { ...x, elevation: x.elevation - height } : x,
    );
    tx.setStoreys(withSiteLast([...moved, { id, name, elevation, height }]));
  });
  return id;
}

/**
 * Ändra en vånings namn, golvnivå och höjd. Ändras våningshöjden flyttas
 * våningarna ovanför lika mycket, så att golv möter golv som förut.
 */
export function storeyPatch(doc: Pick<ProjectDoc, 'storeys'>, id: Id, patch: Partial<Omit<Storey, 'id'>>): Storey[] {
  const s = doc.storeys.find((x) => x.id === id);
  if (!s) return doc.storeys;
  // Platsen ändras inte: den heter Platsen, ligger vid ±0 och flyttas inte med husets våningar (0.10.25).
  if (s.site) return doc.storeys;
  const dh = patch.height !== undefined ? patch.height - s.height : 0;
  return doc.storeys.map((x) => (x.id === id ? { ...x, ...patch } : dh && !x.site && x.elevation > s.elevation ? { ...x, elevation: x.elevation + dh } : x));
}

/** Det som tas bort med en våning: objekten på dess plan och vyerna av planen. */
export function storeyContents(doc: ProjectDoc, id: Id): { elements: Element[]; views: Id[] } {
  return {
    elements: Object.values(doc.elements).filter((e) => e.storey === id && !e.space && !typeOf(e.type)?.everyStorey),
    views: doc.views.filter((v) => v.storey === id && !v.marker && !v.worksheet).map((v) => v.id),
  };
}

/**
 * Ta bort en våning med allt som är ritat på den och vyerna av den. Det som
 * hör till projektet (fasader, sektioner, norrpilen) och det som är ritat i
 * fasader, sektioner och på blad flyttas till grannvåningen. Den sista
 * våningen och Platsen går inte att ta bort.
 */
export function deleteStorey(store: DocStore, id: Id): boolean {
  const doc = store.doc;
  const s = doc.storeys.find((x) => x.id === id);
  if (!s || s.site || buildingStoreys(doc).length < 2) return false;
  const other = (neighbourStorey(doc, id, -1) ?? neighbourStorey(doc, id, 1))!.id;
  const { elements, views } = storeyContents(doc, id);
  const gone = new Set<Id>([...views, `modell:${id}`]);
  store.transact(`Ta bort ${s.name}`, (tx) => {
    const files = new Set<Id>();
    for (const el of elements) {
      if (typeof el.params.asset === 'string') files.add(el.params.asset);
      tx.removeElement(el.id);
    }
    pruneAssets(tx, files);
    for (const el of Object.values(tx.doc.elements)) if (el.storey === id) tx.putElement({ ...el, storey: other });
    tx.setViews(tx.doc.views.filter((v) => !gone.has(v.id)).map((v) => (v.storey === id ? { ...v, storey: other } : v)));
    if (tx.doc.sheets.some((sh) => sh.viewports.some((vp) => gone.has(vp.view))))
      tx.setField('sheets', tx.doc.sheets.map((sh) => ({ ...sh, viewports: sh.viewports.filter((vp) => !gone.has(vp.view)) })));
    if (tx.doc.tree[id]) {
      const { [id]: _, ...tree } = tx.doc.tree;
      tx.setField('tree', tree);
    }
    tx.setStoreys(tx.doc.storeys.filter((x) => x.id !== id));
  });
  return true;
}

/**
 * Det som kan flyttas mellan våningar: modellen och planens ritning, inte det
 * som hör till projektet eller ritats i en fasad eller på ett blad. Marken
 * och platsens objekt (`onSite`) stannar på Platsen (0.10.25).
 */
function movable(doc: ProjectDoc, ids: readonly Id[], target: Id): Element[] {
  const stays = (id: Id) => !isSite(target) && !!typeOf(doc.elements[id].type)?.onSite;
  const pick = new Set(ids.filter((id) => doc.elements[id] && !doc.elements[id].space && !typeOf(doc.elements[id].type)?.everyStorey && !stays(id)));
  for (const id of [...pick]) if (doc.elements[id].host && !pick.has(doc.elements[id].host!)) pick.delete(id);
  // Dörrar och fönster följer sin vägg.
  for (const e of Object.values(doc.elements)) if (e.host && pick.has(e.host)) pick.add(e.id);
  return [...pick].map((id) => doc.elements[id]);
}

/**
 * Flytta eller kopiera det markerade till en annan våning, på samma ställe i
 * plan och i samma tillstånd. Dörrar och fönster följer sin vägg; markerade öppningar utan sin vägg
 * stannar. Svarar med de nya (eller flyttade) objektens id, utan öppningarna.
 */
export function toStorey(store: DocStore, ids: readonly Id[], target: Id, copy: boolean, state: Id): Id[] {
  const doc = store.doc;
  const t = doc.storeys.find((s) => s.id === target);
  if (!t) return [];
  const els = movable(doc, ids, target).filter((e) => e.storey !== target);
  if (!els.length) return [];
  if (copy) {
    const clip = copyPayload(doc, els.map((e) => e.id), els[0].storey);
    return clip ? pasteClip(store, clip, state, target, [0, 0], undefined, true) : [];
  }
  store.transact(`Flytta till ${t.name}`, (tx) => {
    for (const el of els) tx.putElement({ ...el, storey: target });
  });
  return els.filter((e) => !e.host).map((e) => e.id);
}
