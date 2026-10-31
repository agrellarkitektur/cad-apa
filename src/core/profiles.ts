import { newId } from './ids';
import type { Definition, Element, Id } from './model';
import { canUseAs, defaultProfileTypes, isEndProfile, profileObjectPrefix, PROFILE_GROUPS, type ProfileTypeModel } from './profileTypes';
import type { DocStore, TxBuilder } from './store';

/**
 * Kommandona för profiler (0.11.6): lägga profilobjekt (och de förvalda
 * typerna första gången), ändra en profiltyp, och typlistans grupper som
 * räckestypernas.
 */

/** De förvalda profiltyperna, om projektet saknar profiltyper. */
function ensureProfileTypes(tx: TxBuilder): void {
  if (Object.values(tx.doc.definitions).some((d) => d.elementType === 'Profile')) return;
  for (const d of defaultProfileTypes()) if (!tx.doc.definitions[d.id]) tx.putDefinition(d);
}

/** Alla förvalda typer som saknas (knappen i profileditorn). */
export function addDefaultProfileTypes(tx: TxBuilder): number {
  let n = 0;
  for (const d of defaultProfileTypes())
    if (!tx.doc.definitions[d.id]) {
      tx.putDefinition(d);
      n++;
    }
  return n;
}

/** Den typ ett nytt profilobjekt får: den valda, annars PR01, annars den första (inte ändprofilerna). */
export function defaultProfileDef(doc: DocStore['doc'], wanted?: Id): Id {
  const ok = (id: Id | undefined) => !!id && doc.definitions[id]?.elementType === 'Profile' && !isEndProfile(doc.definitions[id].profile);
  if (ok(wanted)) return wanted!;
  if (ok('t-pr01')) return 't-pr01';
  return Object.values(doc.definitions).find((d) => d.elementType === 'Profile' && d.profile?.group !== 'Ändprofiler')?.id ?? 't-pr01';
}

/** Profiltyperna i den ordning de visas i verktyget: gruppernas ordning, sedan litteran; bara de som får vara fria profilobjekt (inte ändprofilerna, 0.11.7). */
export function profileTypesFor(doc: DocStore['doc']): Definition[] {
  const groups = profileGroups(doc);
  return Object.values(doc.definitions)
    .filter((d) => d.elementType === 'Profile' && canUseAs(d.profile, 'free'))
    .sort((a, b) => groups.indexOf(a.profile!.group) - groups.indexOf(b.profile!.group) || a.name.localeCompare(b.name, 'sv', { numeric: true }));
}

export type NewProfile = Omit<Element, 'id' | 'type' | 'states' | 'tags' | 'props'> & { states?: Id[] };

/** Nästa lediga littera för ett profilobjekt med bokstäverna (P01, B01, L01 …). */
export function nextProfileLittera(doc: DocStore['doc'], prefix: string, taken: Set<string> = new Set()): string {
  const used = new Set([...taken, ...Object.values(doc.elements).flatMap((e) => (e.type === 'Profile' && e.name ? [e.name] : []))]);
  for (let n = 1; ; n++) {
    const name = `${prefix}${String(n).padStart(2, '0')}`;
    if (!used.has(name)) return name;
  }
}

/** Lägg profilobjekt, med de förvalda typerna om de saknas, och var sin littera efter typens grupp. */
export function addProfiles(store: DocStore, list: NewProfile[], states: Id[], label: string): Element[] {
  const made: Element[] = list.map((r) => ({ id: newId('el'), type: 'Profile', tags: [], props: {}, ...r, states: r.states ?? states }));
  store.transact(label, (tx) => {
    ensureProfileTypes(tx);
    const taken = new Set<string>();
    for (const e of made) {
      const definition = defaultProfileDef(tx.doc, e.definition);
      const group = tx.doc.definitions[definition]?.profile?.group ?? '';
      const name = e.name ?? nextProfileLittera(tx.doc, profileObjectPrefix(group, e.params.path === 'plumb'), taken);
      taken.add(name);
      tx.putElement({ ...e, definition, name });
    }
  });
  return made.map((e) => store.doc.elements[e.id]).filter(Boolean);
}

/** Ändra profiltypen i en definition; alla objekt av typen ändras med den. */
export function updateProfileType(store: DocStore, defId: Id, label: string, fn: (m: ProfileTypeModel) => ProfileTypeModel | null): boolean {
  const def = store.doc.definitions[defId];
  if (!def?.profile) return false;
  const next = fn(structuredClone(def.profile));
  if (!next) return false;
  store.transact(label, (tx) => tx.putDefinition({ ...def, profile: next }));
  return true;
}

/** Typlistans grupper i ordning: stilbokens lista (eller förvalen) och sist de grupper som en typ har men som saknas. */
export function profileGroups(doc: DocStore['doc']): string[] {
  const out = [...(doc.graphics.profileGroups ?? PROFILE_GROUPS)];
  for (const d of Object.values(doc.definitions)) if (d.profile && !out.includes(d.profile.group)) out.push(d.profile.group);
  return out;
}

/** Profiltyperna i en grupp, i litteras ordning. */
export function profileTypesIn(doc: DocStore['doc'], group: string): Definition[] {
  return Object.values(doc.definitions)
    .filter((d) => d.elementType === 'Profile' && d.profile?.group === group)
    .sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }));
}

/** Hur många objekt som har typen. */
export const profileTypeUses = (doc: DocStore['doc'], defId: Id): number => Object.values(doc.elements).filter((e) => e.definition === defId).length;

/**
 * Var en profiltyp används (0.11.7): profilobjekt med typen, avslut med den
 * som ändprofil, profiltyper med den som förvald ändprofil, räckestyper med
 * den som del och trappor med den som vangstycke. `ids` är objekten.
 */
export function profileTypeUsage(doc: DocStore['doc'], defId: Id): { objects: number; ends: number; types: number; railings: number; stairs: number; total: number; ids: Id[] } {
  const out = { objects: 0, ends: 0, types: 0, railings: 0, stairs: 0, total: 0, ids: [] as Id[] };
  const railTypes = new Set<Id>();
  for (const d of Object.values(doc.definitions)) {
    if (d.profile?.endProfile === defId) out.types++;
    if (d.railing?.parts.some((q) => q.profile?.shape === 'profile' && q.profile.type === defId)) {
      out.railings++;
      railTypes.add(d.id);
    }
  }
  for (const e of Object.values(doc.elements)) {
    const p = e.params as { start?: { profile?: Id }; end?: { profile?: Id }; built?: { stringer?: { profile?: Id } } };
    if (e.definition === defId) {
      out.objects++;
      out.ids.push(e.id);
    } else if (e.type === 'Profile' && (p.start?.profile === defId || p.end?.profile === defId)) {
      out.ends++;
      out.ids.push(e.id);
    } else if (e.type === 'Stair' && p.built?.stringer?.profile === defId) {
      out.stairs++;
      out.ids.push(e.id);
    } else if (e.type === 'Railing' && e.definition && railTypes.has(e.definition)) out.ids.push(e.id);
  }
  out.total = out.objects + out.ends + out.types + out.railings + out.stairs;
  return out;
}

/** Lägg till en förvald profiltyp (PR06 …) om den saknas, i en transaktion. */
export function ensureDefaultProfileType(tx: TxBuilder, id: Id): void {
  if (tx.doc.definitions[id]) return;
  const d = defaultProfileTypes().find((x) => x.id === id);
  if (d) tx.putDefinition(d);
}

/** Lägg till en profiltyp och svara med dess id. */
export function addProfileType(store: DocStore, name: string, model: ProfileTypeModel, description?: string): Id {
  const id = newId('t');
  store.transact(`Ny typ ${name}`, (tx) => tx.putDefinition({ id, origin: 'component', name, elementType: 'Profile', params: {}, props: {}, profile: model, ...(description ? { description } : {}) }));
  return id;
}

/** Ta bort en typ som inga objekt har. */
export function removeProfileType(store: DocStore, defId: Id): boolean {
  const def = store.doc.definitions[defId];
  if (!def?.profile || profileTypeUsage(store.doc, defId).total) return false;
  store.transact(`Ta bort typ ${def.name}`, (tx) => tx.removeDefinition(defId));
  return true;
}

/** Byt gruppernas lista i stilboken; typerna i en omdöpt grupp följer med. */
function putGroups(store: DocStore, label: string, groups: string[], rename?: [string, string]): void {
  store.transact(label, (tx) => {
    tx.setGraphics({ ...tx.doc.graphics, profileGroups: groups });
    if (!rename) return;
    for (const d of Object.values(tx.doc.definitions)) if (d.profile?.group === rename[0]) tx.putDefinition({ ...d, profile: { ...d.profile, group: rename[1] } });
  });
}

/** En ny tom grupp sist i listan; false om namnet finns. */
export function addProfileGroup(store: DocStore, name: string): boolean {
  const groups = profileGroups(store.doc);
  const n = name.trim();
  if (!n || groups.includes(n)) return false;
  putGroups(store, `Ny grupp ${n}`, [...groups, n]);
  return true;
}

/** Döp om en grupp; typerna i den följer med. False om namnet finns. */
export function renameProfileGroup(store: DocStore, from: string, to: string): boolean {
  const groups = profileGroups(store.doc);
  const n = to.trim();
  if (!n || n === from || groups.includes(n) || !groups.includes(from)) return false;
  putGroups(store, `Byt namn på grupp: ${n}`, groups.map((g) => (g === from ? n : g)), [from, n]);
  return true;
}

/** Flytta en grupp ett steg upp (−1) eller ned (1). */
export function moveProfileGroup(store: DocStore, group: string, step: -1 | 1): boolean {
  const groups = profileGroups(store.doc);
  const i = groups.indexOf(group);
  const j = i + step;
  if (i < 0 || j < 0 || j >= groups.length) return false;
  [groups[i], groups[j]] = [groups[j], groups[i]];
  putGroups(store, `Flytta grupp ${group}`, groups);
  return true;
}

/** Ta bort en tom grupp. */
export function removeProfileGroup(store: DocStore, group: string): boolean {
  if (profileTypesIn(store.doc, group).length) return false;
  const groups = profileGroups(store.doc);
  if (!groups.includes(group)) return false;
  putGroups(store, `Ta bort grupp ${group}`, groups.filter((g) => g !== group));
  return true;
}

/** Flytta en typ till en annan grupp (dra i typlistan). */
export function setProfileTypeGroup(store: DocStore, defId: Id, group: string): boolean {
  const def = store.doc.definitions[defId];
  if (!def?.profile || def.profile.group === group || !profileGroups(store.doc).includes(group)) return false;
  return updateProfileType(store, defId, `${def.name} till ${group}`, (m) => ({ ...m, group }));
}
