import { newId } from './ids';
import type { Definition, Element, Id } from './model';
import { defaultGroundRailingTypes, defaultRailingTypes, newPart, RAILING_GROUPS, type RailingTypeModel } from './railingTypes';
import { isSite } from './model';
import type { DocStore, TxBuilder } from './store';

/**
 * Kommandona för räcken (0.11.1): lägga räcken (och de förvalda typerna
 * första gången), och ändra en räckestyp.
 */

/**
 * De förvalda räckestyperna, om projektet saknar dem (äldre projekt och nya
 * utan räcken): RÄ01–RÄ03, och på Platsen (0.11.3) staketen, spaljén och
 * grinden när ingen typ har *Mark*.
 */
function ensureRailingTypes(tx: TxBuilder, ground = false): void {
  const defs = Object.values(tx.doc.definitions).filter((d) => d.elementType === 'Railing');
  if (!defs.length) for (const d of defaultRailingTypes()) if (!tx.doc.definitions[d.id]) tx.putDefinition(d);
  if (ground && !defs.some((d) => d.railing?.ground)) for (const d of defaultGroundRailingTypes()) if (!tx.doc.definitions[d.id]) tx.putDefinition(d);
}

/** Alla förvalda typer som saknas (knappen i räckestypeditorn). */
export function addDefaultRailingTypes(tx: TxBuilder): number {
  let n = 0;
  for (const d of [...defaultRailingTypes(), ...defaultGroundRailingTypes()])
    if (!tx.doc.definitions[d.id]) {
      tx.putDefinition(d);
      n++;
    }
  return n;
}

/**
 * Den typ ett nytt räcke får: den senast använda, annars RÄ01 (på Platsen
 * ST01 eller den första med *Mark*), annars den första. Grindtyperna
 * väljs inte för ett räcke.
 */
export function defaultRailingDef(doc: DocStore['doc'], wanted?: Id, ground = false): Id {
  const ok = (id: Id | undefined) => !!id && doc.definitions[id]?.elementType === 'Railing';
  if (ok(wanted)) return wanted!;
  const all = Object.values(doc.definitions).filter((d) => d.elementType === 'Railing' && d.railing?.group !== 'Grindar');
  if (ground) {
    if (ok('t-st01')) return 't-st01';
    const g = all.find((d) => d.railing?.ground);
    if (g) return g.id;
  }
  if (ok('t-ra01')) return 't-ra01';
  return all[0]?.id ?? 't-ra01';
}

/** Räckestyperna i den ordning de visas i verktyget: på Platsen de med *Mark* först, på en våning de med *Byggnad*; grindtyperna sist. */
export function railingTypesFor(doc: DocStore['doc'], ground: boolean): Definition[] {
  const rank = (d: Definition) => (d.railing?.group === 'Grindar' ? 2 : (ground ? d.railing?.ground : d.railing?.building) ? 0 : 1);
  return Object.values(doc.definitions)
    .filter((d) => d.elementType === 'Railing')
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'sv', { numeric: true }));
}

export type NewRailing = Omit<Element, 'id' | 'type' | 'states' | 'tags' | 'props'> & { states?: Id[] };

/** Lägg räcken, med de förvalda typerna om de saknas. */
export function addRailings(store: DocStore, list: NewRailing[], states: Id[], label: string): Element[] {
  const made: Element[] = list.map((r) => ({ id: newId('el'), type: 'Railing', tags: [], props: {}, ...r, states: r.states ?? states }));
  const ground = made.some((e) => isSite(e.storey));
  store.transact(label, (tx) => {
    ensureRailingTypes(tx, ground);
    for (const e of made) tx.putElement({ ...e, definition: defaultRailingDef(tx.doc, e.definition, isSite(e.storey)) });
  });
  return made.map((e) => store.doc.elements[e.id]).filter(Boolean);
}

/** Ändra räckestypen i en definition; alla räcken av typen ändras med den. */
export function updateRailingType(store: DocStore, defId: Id, label: string, fn: (m: RailingTypeModel) => RailingTypeModel | null): boolean {
  const def = store.doc.definitions[defId];
  if (!def?.railing) return false;
  const next = fn(structuredClone(def.railing));
  if (!next) return false;
  store.transact(label, (tx) => tx.putDefinition({ ...def, railing: next }));
  return true;
}

// ---------- Räckestypeditorn (0.11.2) ----------

/**
 * Typlistans grupper i ordning: stilbokens lista (eller förvalen) och sist
 * de grupper som en typ har men som saknas i listan.
 */
export function railingGroups(doc: DocStore['doc']): string[] {
  const out = [...(doc.graphics.railingGroups ?? RAILING_GROUPS)];
  for (const d of Object.values(doc.definitions)) if (d.railing && !out.includes(d.railing.group)) out.push(d.railing.group);
  return out;
}

/** Räckestyperna i en grupp, i litteras ordning. */
export function railingTypesIn(doc: DocStore['doc'], group: string): Definition[] {
  return Object.values(doc.definitions)
    .filter((d) => d.elementType === 'Railing' && d.railing?.group === group)
    .sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }));
}

/** Hur många räcken som har typen. */
export const railingTypeUses = (doc: DocStore['doc'], defId: Id): number => Object.values(doc.elements).filter((e) => e.definition === defId).length;

/** Litterans bokstäver för en ny typ i gruppen: RÄ, ST för staket och stängsel, SP för spaljéer, G för grindar. */
export function railingPrefix(group: string): string {
  if (group === 'Staket' || group === 'Stängsel') return 'ST';
  if (group === 'Spaljéer') return 'SP';
  if (group === 'Grindar') return 'G';
  return 'RÄ';
}

/** En ny typ i gruppen, med delar som passar den. */
export function newRailingModel(group: string): RailingTypeModel {
  const ground = group === 'Staket' || group === 'Stängsel' || group === 'Spaljéer' || group === 'Grindar';
  const base = { group, ...(ground ? { ground: true } : { building: true }), ...(group === 'Räcken' ? { childSafe: true } : {}) };
  if (group === 'Ledstänger') {
    const m: RailingTypeModel = { ...base, params: [{ name: 'Ledstångshöjd', value: 900, perRailing: true }, { name: 'Förlängning', value: 300, perRailing: true }], parts: [] };
    m.parts.push({ id: 'ledstang', kind: 'along', name: 'Ledstång', profile: { shape: 'round', w: 40 }, z: 'Ledstångshöjd', offset: 60, extend: 'Förlängning', finish: 'wall', pen: 'railGrab' });
    m.parts.push({ ...newPart(m, 'point'), name: 'Konsol', profile: { shape: 'round', w: 14 }, from: 'Ledstångshöjd - 90', to: 'Ledstångshöjd - 40', offset: 60, spacing: 1000, corners: false });
    return m;
  }
  const height = ground ? 'Höjd' : 'Skyddshöjd';
  const m: RailingTypeModel = { ...base, params: [{ name: height, value: group === 'Spaljéer' ? 1800 : ground ? 1000 : 900, perRailing: true }], parts: [] };
  m.parts.push({ ...newPart(m, 'point'), to: ground ? height : `${height} - 40`, spacing: ground ? 2000 : 1200 });
  m.parts.push({ id: 'handledare', kind: 'along', name: ground ? 'Överliggare' : 'Handledare', profile: { shape: 'rect', w: 50, h: 40 }, z: height, pen: 'railHandrail' });
  if (group === 'Spaljéer') m.parts.push({ ...newPart(m, 'surface'), name: 'Spaljérutnät', thickness: 20, from: 100, to: height });
  else m.parts.push({ ...newPart(m, 'repeat'), to: `${height} - 40` });
  return m;
}

/** Lägg till en räckestyp och svara med dess id. */
export function addRailingType(store: DocStore, name: string, model: RailingTypeModel, description?: string): Id {
  const id = newId('t');
  store.transact(`Ny typ ${name}`, (tx) => tx.putDefinition({ id, origin: 'component', name, elementType: 'Railing', params: {}, props: {}, railing: model, ...(description ? { description } : {}) }));
  return id;
}

/** Ta bort en typ som inga räcken har. */
export function removeRailingType(store: DocStore, defId: Id): boolean {
  const def = store.doc.definitions[defId];
  if (!def?.railing || railingTypeUses(store.doc, defId)) return false;
  store.transact(`Ta bort typ ${def.name}`, (tx) => tx.removeDefinition(defId));
  return true;
}

/** Byt gruppernas lista i stilboken; typerna i en omdöpt grupp följer med. */
function putGroups(store: DocStore, label: string, groups: string[], rename?: [string, string]): void {
  store.transact(label, (tx) => {
    tx.setGraphics({ ...tx.doc.graphics, railingGroups: groups });
    if (!rename) return;
    for (const d of Object.values(tx.doc.definitions)) if (d.railing?.group === rename[0]) tx.putDefinition({ ...d, railing: { ...d.railing, group: rename[1] } });
  });
}

/** En ny tom grupp sist i listan; false om namnet finns. */
export function addRailingGroup(store: DocStore, name: string): boolean {
  const groups = railingGroups(store.doc);
  const n = name.trim();
  if (!n || groups.includes(n)) return false;
  putGroups(store, `Ny grupp ${n}`, [...groups, n]);
  return true;
}

/** Döp om en grupp; typerna i den följer med. False om namnet finns. */
export function renameRailingGroup(store: DocStore, from: string, to: string): boolean {
  const groups = railingGroups(store.doc);
  const n = to.trim();
  if (!n || n === from || groups.includes(n) || !groups.includes(from)) return false;
  putGroups(store, `Byt namn på grupp: ${n}`, groups.map((g) => (g === from ? n : g)), [from, n]);
  return true;
}

/** Flytta en grupp ett steg upp (−1) eller ned (1). */
export function moveRailingGroup(store: DocStore, group: string, step: -1 | 1): boolean {
  const groups = railingGroups(store.doc);
  const i = groups.indexOf(group);
  const j = i + step;
  if (i < 0 || j < 0 || j >= groups.length) return false;
  [groups[i], groups[j]] = [groups[j], groups[i]];
  putGroups(store, `Flytta grupp ${group}`, groups);
  return true;
}

/** Ta bort en tom grupp. */
export function removeRailingGroup(store: DocStore, group: string): boolean {
  if (railingTypesIn(store.doc, group).length) return false;
  const groups = railingGroups(store.doc);
  if (!groups.includes(group)) return false;
  putGroups(store, `Ta bort grupp ${group}`, groups.filter((g) => g !== group));
  return true;
}

/** Flytta en typ till en annan grupp (dra i typlistan). */
export function setRailingTypeGroup(store: DocStore, defId: Id, group: string): boolean {
  const def = store.doc.definitions[defId];
  if (!def?.railing || def.railing.group === group || !railingGroups(store.doc).includes(group)) return false;
  return updateRailingType(store, defId, `${def.name} till ${group}`, (m) => ({ ...m, group }));
}

/** Flytta en del ett steg upp eller ned i typens lista (ordningen i 3D och planen). */
export function moveRailingPart(store: DocStore, defId: Id, partId: string, step: -1 | 1): boolean {
  return updateRailingType(store, defId, 'Flytta del', (m) => {
    const i = m.parts.findIndex((p) => p.id === partId);
    const j = i + step;
    if (i < 0 || j < 0 || j >= m.parts.length) return null;
    [m.parts[i], m.parts[j]] = [m.parts[j], m.parts[i]];
    return m;
  });
}
