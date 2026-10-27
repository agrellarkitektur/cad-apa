import type { StyleSheet } from './graphics';
import { newId } from './ids';
import type { Asset, Definition, Element, Id, ShowIn, State, Value } from './model';
import { isViewportId, removeViewportsTx } from './sheets';
import { statesForNewElement } from './states';
import type { DocStore, TxBuilder } from './store';

/**
 * Kommandon är de ändringar som gränssnittet och verktygen får göra. Varje
 * kommando blir en transaktion med ett namn som syns vid ångra. Flytta och
 * vända står i `moveCommands.ts` och exporteras också härifrån.
 */

export { flipWalls, followJoins, followPoint, geometryOf, isArc, moveElements, movePatch, moveWallEnd, placement, putWallEnds, reversedWall } from './moveCommands';

type NewElement = Omit<Element, 'id' | 'states'> & { id?: Id; states?: Id[] };

export function addElement(store: DocStore, el: NewElement, activeState: Id): Element {
  const [full] = addElements(store, [el], activeState, `Lägg till ${el.name ?? el.type}`);
  return full;
}

/** Lägg till flera element i ett steg, t.ex. en kedja väggar. */
export function addElements(store: DocStore, els: NewElement[], activeState: Id, label: string): Element[] {
  const states = statesForNewElement(store.doc, activeState);
  const full = els.map((el) => ({ ...el, id: el.id ?? newId('el'), states: el.states ?? states }) as Element);
  store.transact(label, (tx) => full.forEach((e) => tx.putElement(e)));
  return full;
}

/** Det `deleteElements` gjorde: hur många som togs bort och hur många som var låsta. */
export interface DeleteResult {
  removed: number;
  /** Låsta objekt (eller objekt med något låst i sig) som inte togs bort (0.10.12). */
  locked: Id[];
}

/** Ta bort element helt ur modellen, tillsammans med det som sitter i dem. */
export function deleteElements(store: DocStore, ids: Id[]): DeleteResult {
  // Låst betyder låst (0.10.12): låsta objekt tas aldrig bort, inte heller
  // platsens träd och grannhus; man låser upp först. En vägg med en låst dörr
  // i sig står också kvar. Marken tas bort med platsen.
  const doc = store.doc;
  const hostsLocked = new Set<Id>();
  for (const el of Object.values(doc.elements)) {
    if (!el.locked) continue;
    for (let h = el.host; h && !hostsLocked.has(h); h = doc.elements[h]?.host) hostsLocked.add(h);
  }
  const locked: Id[] = [];
  const open = ids.filter((id) => {
    const el = doc.elements[id];
    if (el && (el.locked || hostsLocked.has(id))) {
      locked.push(id);
      return false;
    }
    return true;
  });
  if (!open.length) return { removed: 0, locked };
  const viewports = open.filter((id) => !store.doc.elements[id] && isViewportId(store.doc, id));
  const label = viewports.length === open.length ? (open.length === 1 ? 'Ta bort vyn från bladet' : 'Ta bort vyerna från bladet') : open.length === 1 ? 'Ta bort objekt' : `Ta bort ${open.length} objekt`;
  store.transact(label, (tx) => {
    // Vyer på ett blad (0.8.9) tas bort från bladet; vyerna finns kvar i projektet.
    removeViewportsTx(tx, new Set(viewports));
    const files = new Set<Id>();
    for (const id of withHosted(tx, open)) {
      const el = tx.doc.elements[id];
      // En taklutning som tas bort döljs, så att den automatiska inte kommer tillbaka.
      if (el?.type === 'RoofSlope') tx.putElement({ ...el, params: { ...el.params, hidden: true } });
      else {
        if (typeof el?.params.asset === 'string') files.add(el.params.asset);
        tx.removeElement(id);
      }
    }
    // Ett underlags fil tas bort med den sista placeringen av den (0.8 del 2); ångra tar tillbaka båda.
    pruneAssets(tx, files);
  });
  return { removed: open.length, locked };
}

/** Ta bort filer som inget element längre använder (bland `candidates`). */
export function pruneAssets(tx: TxBuilder, candidates: Iterable<Id>): void {
  const used = new Set<unknown>(Object.values(tx.doc.elements).map((e) => e.params.asset));
  for (const a of candidates) if (!used.has(a)) tx.removeAsset(a);
}

/** Lägg till ett underlag (0.8 del 2): filen och elementet i ett steg. */
export function addWithAsset(store: DocStore, asset: Asset | null, el: NewElement, activeState: Id, label: string): Element {
  const states = statesForNewElement(store.doc, activeState);
  const full = { ...el, id: el.id ?? newId('ul'), states: el.states ?? states } as Element;
  store.transact(label, (tx) => {
    if (asset && !tx.doc.assets[asset.id]) tx.putAsset(asset);
    tx.putElement(full);
  });
  return full;
}

/** Lås eller lås upp objekt (format 5). */
export function setLocked(store: DocStore, ids: Id[], locked: boolean): void {
  store.transact(locked ? 'Lås' : 'Lås upp', (tx) => {
    for (const id of ids) {
      const el = tx.doc.elements[id];
      if (!el || !!el.locked === locked) continue;
      const next = { ...el };
      if (locked) next.locked = true;
      else delete next.locked;
      tx.putElement(next);
    }
  });
}

/** Stäng av eller slå på varningen för sneda vinklar för enstaka element (0.8.4). */
export function setSkewOk(store: DocStore, ids: Id[], ok: boolean): void {
  store.transact(ok ? 'Ignorera sned vinkel' : 'Varna för sned vinkel', (tx) => {
    for (const id of ids) {
      const el = tx.doc.elements[id];
      if (!el || !!el.skewOk === ok) continue;
      const next = { ...el };
      if (ok) next.skewOk = true;
      else delete next.skewOk;
      tx.putElement(next);
    }
  });
}

/**
 * Ange om element finns i ett tillstånd. Kryssas en dörr i följer dess vägg
 * med; kryssas en vägg ur följer dörrarna och fönstren i den med.
 */
export function setInState(store: DocStore, ids: Id[], stateId: Id, present: boolean): void {
  const state = store.doc.states.find((s) => s.id === stateId);
  if (!state || ids.length === 0) return;
  const what = ids.length === 1 ? 'objekt' : `${ids.length} objekt`;
  store.transact(`${present ? 'Lägg till' : 'Ta bort'} ${what} i ${state.name}`, (tx) => {
    const all = present ? [...new Set(ids.flatMap((id) => withHosts(tx, id)))] : withHosted(tx, ids);
    const order = tx.doc.states.map((s) => s.id);
    for (const i of all) {
      const cur = tx.doc.elements[i];
      if (!cur || cur.states.includes(stateId) === present) continue;
      const states = present ? [...cur.states, stateId] : cur.states.filter((s) => s !== stateId);
      tx.putElement({ ...cur, states: order.filter((s) => states.includes(s)) });
    }
  });
}

/** Samma som `setInState` för ett enda element. */
export function setElementInState(store: DocStore, id: Id, stateId: Id, present: boolean): void {
  setInState(store, [id], stateId, present);
}

export function updateParams(store: DocStore, ids: Id[], patch: Record<string, unknown>, label = 'Ändra mått'): void {
  store.transact(label, (tx) => {
    for (const id of ids) {
      const el = tx.doc.elements[id];
      if (el) tx.putElement({ ...el, params: { ...el.params, ...patch } });
    }
  });
}

/** Var 2D-element, text och mått syns (format 5). Null = i alla vyer av ytan de är ritade på. */
export function setShowIn(store: DocStore, ids: Id[], show: ShowIn | null): void {
  store.transact('Ändra Visas i', (tx) => {
    for (const id of ids) {
      const el = tx.doc.elements[id];
      if (!el) continue;
      const next = { ...el };
      if (show) next.show = show;
      else delete next.show;
      tx.putElement(next);
    }
  });
}

/** Lägg till en vy-tagg i projektet (format 5), om den inte redan finns. */
export function addViewTag(store: DocStore, tag: string): string | null {
  const t = tag.trim();
  if (!t) return null;
  if (!store.doc.viewTags.includes(t)) store.transact(`Ny vy-tagg ${t}`, (tx) => tx.setField('viewTags', [...tx.doc.viewTags, t]));
  return t;
}

/** Byt namn eller eget id på ett element. */
export function renameElement(store: DocStore, id: Id, name: string): void {
  const el = store.doc.elements[id];
  if (!el) return;
  store.transact('Byt id', (tx) => tx.putElement({ ...el, name: name.trim() || undefined }));
}

// ---------- Typer (definitioner med littera) ----------

export function createDefinition(
  store: DocStore,
  elementType: string,
  name: string,
  params: Record<string, Value>,
  assignTo: Id[] = [],
): Definition {
  const def: Definition = { id: newId('t'), origin: 'component', name, elementType, params, props: {} };
  store.transact(`Ny typ ${name}`, (tx) => {
    tx.putDefinition(def);
    for (const id of assignTo) assign(tx, id, def.id);
  });
  return def;
}

/** Ändra en typ. Alla element av typen ändras med den. */
export function updateDefinition(store: DocStore, id: Id, patch: { name?: string; description?: string; params?: Record<string, Value> }): void {
  const def = store.doc.definitions[id];
  if (!def) return;
  const next: Definition = {
    ...def,
    name: patch.name?.trim() || def.name,
    description: patch.description ?? def.description,
    params: { ...def.params, ...patch.params },
  };
  store.transact(`Ändra typ ${next.name}`, (tx) => tx.putDefinition(next));
}

/** Ge element en typ. Elementens egna värden för typparametrarna tas bort. */
export function setDefinition(store: DocStore, ids: Id[], defId: Id): void {
  const def = store.doc.definitions[defId];
  if (!def) return;
  store.transact(`Sätt typ ${def.name}`, (tx) => ids.forEach((id) => assign(tx, id, defId)));
}

/** Ta bort en typ som inte används. */
export function deleteDefinition(store: DocStore, id: Id): boolean {
  const used = Object.values(store.doc.elements).some((e) => e.definition === id);
  if (used) return false;
  store.transact('Ta bort typ', (tx) => tx.removeDefinition(id));
  return true;
}

function assign(tx: TxBuilder, id: Id, defId: Id): void {
  const el = tx.doc.elements[id];
  const def = tx.doc.definitions[defId];
  if (!el || !def || def.elementType !== el.type) return;
  const params = { ...el.params } as Record<string, unknown>;
  for (const k of Object.keys(def.params)) delete params[k];
  tx.putElement({ ...el, definition: defId, params });
}

// ---------- Tillstånd ----------

/**
 * Skapa ett nytt förslag. Med `copyFrom` får det samma innehåll som ett
 * befintligt tillstånd; annars samma innehåll som Befintligt, om det finns.
 */
export function createProposal(store: DocStore, name: string, copyFrom?: Id): State {
  const state: State = { id: newId('st'), name, kind: 'proposal' };
  const source = copyFrom ?? store.doc.states.find((s) => s.kind === 'existing')?.id;
  store.transact(`Nytt förslag: ${name}`, (tx) => {
    tx.setStates([...tx.doc.states, state]);
    if (!source) return;
    for (const el of Object.values(tx.doc.elements)) {
      if (el.states.includes(source)) tx.putElement({ ...el, states: [...el.states, state.id] });
    }
  });
  return state;
}

/** Ta bort ett tillstånd. Element som bara fanns där tas bort helt. */
export function deleteState(store: DocStore, id: Id): void {
  const state = store.doc.states.find((s) => s.id === id);
  if (!state || store.doc.states.length <= 1) return;
  store.transact(`Ta bort ${state.name}`, (tx) => {
    for (const el of Object.values(tx.doc.elements)) {
      if (!el.states.includes(id)) continue;
      const rest = el.states.filter((s) => s !== id);
      if (rest.length === 0) tx.removeElement(el.id);
      else tx.putElement({ ...el, states: rest });
    }
    tx.setStates(tx.doc.states.filter((s) => s.id !== id));
  });
}

// ---------- Stilmall ----------

export function setGraphics(store: DocStore, style: StyleSheet, label = `Stilmall: ${style.name}`): void {
  store.transact(label, (tx) => tx.setGraphics(style));
}

// ---------- Hjälpfunktioner ----------

/** Elementet och dess värdar, i flera led. */
function withHosts(tx: TxBuilder, id: Id): Id[] {
  const result: Id[] = [];
  let cur: Element | undefined = tx.doc.elements[id];
  while (cur && !result.includes(cur.id)) {
    result.push(cur.id);
    cur = cur.host ? tx.doc.elements[cur.host] : undefined;
  }
  return result;
}

/** Id:n plus allt som sitter i dem, i flera led. */
function withHosted(tx: TxBuilder, ids: Id[]): Id[] {
  const result = new Set(ids);
  let added = true;
  while (added) {
    added = false;
    for (const el of Object.values(tx.doc.elements)) {
      if (el.host && result.has(el.host) && !result.has(el.id)) {
        result.add(el.id);
        added = true;
      }
    }
  }
  return [...result];
}
