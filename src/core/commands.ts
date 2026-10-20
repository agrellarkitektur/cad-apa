import type { StyleSheet } from './graphics';
import { wallFrame, type WallGeometry } from '../geometry/wallFrame';
import { newId } from './ids';
import type { Asset, Definition, Element, Id, ProjectDoc, ShowIn, State, Value } from './model';
import { isViewportId, moveViewportsTx, removeViewportsTx } from './sheets';
import { statesForNewElement } from './states';
import type { DocStore, TxBuilder } from './store';

/**
 * Kommandon är de ändringar som gränssnittet och verktygen får göra. Varje
 * kommando blir en transaktion med ett namn som syns vid ångra.
 */

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

/** Ta bort element helt ur modellen, tillsammans med det som sitter i dem. */
export function deleteElements(store: DocStore, ids: Id[]): void {
  // Låsta objekt tas inte bort (format 5).
  const open = ids.filter((id) => !store.doc.elements[id]?.locked);
  if (!open.length) return;
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

// ---------- Väggar ----------

/**
 * Flytta element. Varje elementtyp avgör själv vad en förflyttning betyder
 * (väggar flyttar båda ändarna, dörrar glider längs sin vägg). Det som sitter
 * i en vägg som också flyttas följer med väggen och flyttas inte en gång till.
 *
 * Väggar som är anslutna till en flyttad vägg följer med (0.6.3): deras ände
 * glider längs deras egen riktning till den flyttade väggens nya läge, så att
 * hörn och T-anslutningar håller och vinklarna står kvar. `keepJoins: false`
 * lossar i stället. Svarar med hur många anslutningar som fick släppa.
 */
export function moveElements(
  store: DocStore,
  ids: Id[],
  d: [number, number],
  label = 'Flytta',
  opts: { keepJoins?: boolean } = {},
): { released: number } {
  const result = { released: 0 };
  if (Math.hypot(d[0], d[1]) < 0.01) return result;
  const set = new Set(ids);
  const before = store.doc;
  store.transact(label, (tx) => {
    for (const id of ids) {
      const el = tx.doc.elements[id];
      if (!el || (el.host && set.has(el.host))) continue;
      const patch = movePatch(tx.doc, el, d);
      if (patch) tx.putElement({ ...el, params: { ...el.params, ...patch } });
    }
    // Vyer på ett blad följer med det ritade på bladet (0.8.9).
    moveViewportsTx(tx, set, d);
    if (opts.keepJoins !== false) result.released = followJoins(tx, before, set, d);
  });
  return result;
}

type P2 = [number, number];
type WallEnds = { start: P2; end: P2 };

function wallThickness(doc: ProjectDoc, el: Element): number {
  const own = Number((el.params as Record<string, unknown>).thickness);
  const def = el.definition ? Number(doc.definitions[el.definition]?.params.thickness) : NaN;
  return Number.isFinite(def) && def > 0 ? def : Number.isFinite(own) && own > 0 ? own : 120;
}

/**
 * Var ska en ansluten väggs ände hamna när väggen den sitter mot flyttas med
 * `d`? Änden glider längs sin egen vägg tills den når samma läge mot den
 * flyttade väggen som förut. Null om den inte kan följa med (parallella
 * väggar som flyttas i sidled, eller om väggen skulle krympa bort).
 */
export function followPoint(e: P2, other: P2, moved: WallEnds, d: P2): P2 | null {
  const len = Math.hypot(e[0] - other[0], e[1] - other[1]);
  if (len < 1) return null;
  const u: P2 = [(e[0] - other[0]) / len, (e[1] - other[1]) / len];
  const ml = Math.hypot(moved.end[0] - moved.start[0], moved.end[1] - moved.start[1]) || 1;
  const m: P2 = [(moved.end[0] - moved.start[0]) / ml, (moved.end[1] - moved.start[1]) / ml];
  const cross = u[0] * m[1] - u[1] * m[0];
  let next: P2;
  if (Math.abs(cross) < Math.sin((2 * Math.PI) / 180)) {
    // Väggar i rak förlängning: följer bara med om flytten går längs dem.
    const along = d[0] * u[0] + d[1] * u[1];
    const side = Math.abs(d[0] * u[1] - d[1] * u[0]);
    if (side > 0.5) return null;
    next = [e[0] + u[0] * along, e[1] + u[1] * along];
  } else {
    // Skärningen mellan väggens egen linje och den flyttade väggens linje
    // genom ändens förflyttade läge.
    const q: P2 = [e[0] + d[0] - other[0], e[1] + d[1] - other[1]];
    const t = (q[0] * m[1] - q[1] * m[0]) / cross;
    next = [other[0] + u[0] * t, other[1] + u[1] * t];
  }
  const newLen = (next[0] - other[0]) * u[0] + (next[1] - other[1]) * u[1];
  if (newLen < 10) return null;
  return [Math.round(next[0]), Math.round(next[1])];
}

/** Ändarna på väggar som sitter mot de flyttade väggarna följer med. */
function followJoins(tx: TxBuilder, before: ProjectDoc, moved: Set<Id>, d: P2): number {
  const movedWalls = [...moved]
    .map((id) => before.elements[id])
    .filter((el): el is Element => !!el && el.type === 'Wall');
  if (!movedWalls.length) return 0;
  let released = 0;
  for (const w of Object.values(before.elements)) {
    if (w.type !== 'Wall' || moved.has(w.id)) continue;
    // Bågväggar följer inte med: deras ände kan inte glida längs en rak linje.
    if (isArc(w)) continue;
    const p = w.params as unknown as WallEnds;
    const next: WallEnds = { start: p.start, end: p.end };
    let changed = false;
    for (const end of ['start', 'end'] as const) {
      const e = p[end];
      const other = end === 'start' ? p.end : p.start;
      for (const mw of movedWalls) {
        if (mw.storey !== w.storey || isArc(mw)) continue;
        const mp = mw.params as unknown as WallEnds;
        const ml = Math.hypot(mp.end[0] - mp.start[0], mp.end[1] - mp.start[1]);
        if (ml < 1) continue;
        const corner = Math.hypot(e[0] - mp.start[0], e[1] - mp.start[1]) <= 1 || Math.hypot(e[0] - mp.end[0], e[1] - mp.end[1]) <= 1;
        const t = ((e[0] - mp.start[0]) * (mp.end[0] - mp.start[0]) + (e[1] - mp.start[1]) * (mp.end[1] - mp.start[1])) / ml;
        const off = Math.abs(((e[0] - mp.start[0]) * (mp.end[1] - mp.start[1]) - (e[1] - mp.start[1]) * (mp.end[0] - mp.start[0])) / ml);
        const tee = t > 1 && t < ml - 1 && off <= wallThickness(before, mw) + 1;
        if (!corner && !tee) continue;
        const to = followPoint(e, other, mp, d);
        if (to) {
          next[end] = to;
          changed = true;
        } else released++;
        break;
      }
    }
    if (changed) {
      const cur = tx.doc.elements[w.id];
      if (cur) putWallEnds(tx, cur, next.start, next.end);
    }
  }
  return released;
}

/**
 * Ge en vägg nya ändpunkter. Dörrar och fönster står still i världen när
 * väggen förlängs eller kortas: deras läge mäts från startpunkten, så det
 * räknas om när startpunkten flyttas.
 */
export function putWallEnds(tx: TxBuilder, el: Element, ns: P2, ne: P2, patch: Record<string, unknown> = {}): void {
  const before = geometryOf(tx.doc, el);
  const next = { ...el, params: { ...el.params, start: ns, end: ne, ...patch } };
  tx.putElement(next);
  const startMoved = ns[0] !== before.start[0] || ns[1] !== before.start[1];
  if (!startMoved && !isArc(el) && !isArc(next)) return;
  const f0 = wallFrame(before);
  const f1 = wallFrame(geometryOf(tx.doc, next));
  if (f0.length < 1 || f1.length < 1) return;
  for (const h of Object.values(tx.doc.elements)) {
    if (h.host !== el.id || typeof h.params.at !== 'number') continue;
    const at = h.params.at as number;
    const nat = Math.round(f1.project(f0.at(at, 0))[0]);
    if (nat !== at) tx.putElement({ ...h, params: { ...h.params, at: nat } });
  }
}

/** Väggens läge med typens tjocklek. */
export function geometryOf(doc: ProjectDoc, el: Element): WallGeometry {
  const p = el.params as Record<string, any>;
  return {
    start: p.start,
    end: p.end,
    thickness: wallThickness(doc, el),
    justification: p.justification ?? 'center',
    bulge: typeof p.bulge === 'number' ? p.bulge : 0,
  };
}

/** Om väggen är en båge. */
export function isArc(el: Element): boolean {
  const b = (el.params as Record<string, unknown>).bulge;
  return typeof b === 'number' && Math.abs(b) >= 0.5;
}

/**
 * Var en fasad eller sektion som placeras automatiskt ligger just nu. Sätts
 * av elementlagret (`markerFrame`), eftersom kärnan inte vet hur det räknas.
 */
export const placement: { auto: ((doc: ProjectDoc, el: Element) => { start: [number, number]; end: [number, number] }) | null } = { auto: null };

/** Parametrarna efter en förflyttning: väggar, möbler och rum flyttas, öppningar glider längs väggen. */
export function movePatch(doc: ProjectDoc, el: Element, d: [number, number]): Record<string, unknown> | null {
  const p = el.params as Record<string, any>;
  const add = (q: [number, number]): [number, number] => [Math.round(q[0] + d[0]), Math.round(q[1] + d[1])];
  // Låsta objekt flyttas inte (format 5).
  if (el.locked) return null;
  // En fasad eller sektion som följer byggnaden placeras för hand när den
  // flyttas: där den låg, plus förflyttningen.
  if (p.auto === true) {
    const f = placement.auto?.(doc, el);
    return f ? { auto: false, start: add(f.start), end: add(f.end), side: 1 } : null;
  }
  if (p.start && p.end) return { start: add(p.start), end: add(p.end) };
  if (p.origin) return { origin: add(p.origin) };
  if (Array.isArray(p.outline)) return p.seed ? { outline: p.outline.map(add), seed: add(p.seed) } : { outline: p.outline.map(add) };
  if (Array.isArray(p.points)) {
    // Ett mått knutet till modellen flyttar bara måttlinjen; ett fritt mått flyttas helt.
    if (!Array.isArray(p.points[0]) && typeof p.angle === 'number') {
      const r = (p.angle * Math.PI) / 180;
      return { offset: Math.round((p.offset ?? 0) + (-Math.sin(r) * d[0] + Math.cos(r) * d[1])) };
    }
    return { points: p.points.map((q: any) => (Array.isArray(q) ? add(q as [number, number]) : { ...q, at: add(q.at) })) };
  }
  if (p.pos) return { pos: add(p.pos) };
  if (el.host && typeof p.at === 'number') {
    const hostEl = doc.elements[el.host];
    if (!hostEl) return null;
    const f = wallFrame(geometryOf(doc, hostEl));
    const q = f.at(p.at, 0);
    return { at: Math.round(f.project([q[0] + d[0], q[1] + d[1]])[0]) };
  }
  return null;
}

/**
 * Flytta en väggände. Som förval flyttas bara den väggen. Med
 * `connected` följer andra väggar vars ändar ligger i samma punkt med.
 */
export function moveWallEnd(
  store: DocStore,
  wallId: Id,
  end: 'start' | 'end',
  to: [number, number],
  opts: { connected?: boolean | Id[]; tolerance?: number; label?: string } = {},
): void {
  const wall = store.doc.elements[wallId];
  if (!wall) return;
  const tolerance = opts.tolerance ?? 1;
  const from = (wall.params as { start: [number, number]; end: [number, number] })[end];
  store.transact(opts.label ?? 'Flytta väggände', (tx) => {
    for (const el of Object.values(tx.doc.elements)) {
      if (el.type !== 'Wall' || el.storey !== wall.storey) continue;
      // Andra väggar följer med bara om det begärs: alla, eller de som räknas upp.
      const follows = opts.connected === true || (Array.isArray(opts.connected) && opts.connected.includes(el.id));
      if (el.id !== wallId && !follows) continue;
      const p = el.params as { start: [number, number]; end: [number, number] };
      const patch: Record<string, unknown> = {};
      if (el.id === wallId || Math.hypot(p.start[0] - from[0], p.start[1] - from[1]) <= tolerance) {
        if (el.id !== wallId || end === 'start') patch.start = to;
      }
      if (el.id === wallId || Math.hypot(p.end[0] - from[0], p.end[1] - from[1]) <= tolerance) {
        if (el.id !== wallId || end === 'end') patch.end = to;
      }
      if (!Object.keys(patch).length) continue;
      putWallEnds(tx, el, (patch.start as P2 | undefined) ?? p.start, (patch.end as P2 | undefined) ?? p.end);
    }
  });
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

// ---------- Vända väggar ----------

/**
 * En vägg med omvänd ritriktning. Med `keepBody` ligger väggkroppen kvar och
 * insidan byter sida (Vänd väggen). Utan ligger referenslinjen kvar i samma
 * liv och kroppen hamnar på andra sidan linjen – det används när en vägg
 * ritats åt fel håll. Dörrar och fönster står kvar på samma ställe.
 */
export function reversedWall(doc: ProjectDoc, wall: Element, keepBody: boolean): Element[] {
  const p = wall.params as { start: [number, number]; end: [number, number]; justification?: string };
  const j = p.justification ?? 'center';
  const swapped = j === 'left' ? 'right' : j === 'right' ? 'left' : j;
  const bulge = (wall.params as { bulge?: number }).bulge;
  const reversed: Element = {
    ...wall,
    params: { ...wall.params, start: p.end, end: p.start, justification: keepBody ? swapped : j, ...(bulge ? { bulge: -bulge } : {}) },
  };
  const out: Element[] = [reversed];
  const f0 = wallFrame(geometryOf(doc, wall));
  const f1 = wallFrame(geometryOf(doc, reversed));
  for (const h of Object.values(doc.elements)) {
    if (h.host !== wall.id) continue;
    const hp = h.params as { at?: number; hinge?: string; swing?: number };
    const patch: Record<string, unknown> = {};
    if (typeof hp.at === 'number') patch.at = Math.round(f1.project(f0.at(hp.at, 0))[0]);
    if (hp.hinge) patch.hinge = hp.hinge === 'start' ? 'end' : 'start';
    // Slaget följer rummet: vänster och höger byter plats när riktningen vänds.
    if (typeof hp.swing === 'number') patch.swing = -hp.swing;
    out.push({ ...h, params: { ...h.params, ...patch } });
  }
  return out;
}

/** Vänd väggar: insidan byter sida, väggen ligger kvar. */
export function flipWalls(store: DocStore, ids: Id[]): void {
  store.transact(ids.length === 1 ? 'Vänd väggen' : 'Vänd väggarna', (tx) => {
    for (const id of ids) {
      const el = tx.doc.elements[id];
      if (el?.type === 'Wall') for (const e of reversedWall(tx.doc, el, true)) tx.putElement(e);
    }
  });
}

// ---------- Kopiera, vrida och spegla ----------

type Pt = [number, number];

/** En avbildning av planen: vridning kring en punkt, eller spegling i en lodrät linje. */
export interface PlanTransform {
  map(p: Pt): Pt;
  /** Ny vinkel (grader) för något som pekar åt `deg`. */
  angle(deg: number): number;
  mirror: boolean;
}

function rotation(center: Pt, deg: number): PlanTransform {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return {
    map: ([x, y]) => [Math.round(center[0] + (x - center[0]) * c - (y - center[1]) * s), Math.round(center[1] + (x - center[0]) * s + (y - center[1]) * c)],
    angle: (a) => (((a + deg) % 360) + 360) % 360,
    mirror: false,
  };
}

function mirrorX(center: Pt): PlanTransform {
  return {
    map: ([x, y]) => [Math.round(2 * center[0] - x), y],
    angle: (a) => (((180 - a) % 360) + 360) % 360,
    mirror: true,
  };
}

/** Elementets nya parametrar efter avbildningen, och följdändringar i det som sitter i det. */
export function transformed(doc: ProjectDoc, el: Element, t: PlanTransform, moving: Set<Id>): Element[] {
  const p = el.params as Record<string, any>;
  const out: Element[] = [];
  if (p.start && p.end) {
    let start = t.map(p.start);
    let end = t.map(p.end);
    if (t.mirror) {
      // Speglingen vänder sidorna; byt riktning så att insidan blir kvar inne.
      // Pilhöjden behåller sitt tecken: speglingen och bytet tar ut varandra.
      [start, end] = [end, start];
      const len = wallFrame(geometryOf(doc, el)).length;
      for (const h of Object.values(doc.elements)) {
        if (h.host !== el.id || moving.has(h.id) === false) continue;
        const hp = h.params as Record<string, any>;
        const patch: Record<string, unknown> = {};
        if (typeof hp.at === 'number') patch.at = Math.round(len - hp.at);
        if (hp.hinge) patch.hinge = hp.hinge === 'start' ? 'end' : 'start';
        out.push({ ...h, params: { ...h.params, ...patch } });
      }
    }
    out.unshift({ ...el, params: { ...el.params, start, end } });
    return out;
  }
  if (p.origin && typeof p.width === 'number') {
    const r = ((p.rotation ?? 0) * Math.PI) / 180;
    if (t.mirror) {
      // Det hörn som efter speglingen blir möbelns nedre vänstra.
      const far: Pt = [p.origin[0] + p.width * Math.cos(r), p.origin[1] + p.width * Math.sin(r)];
      return [{ ...el, params: { ...el.params, origin: t.map(far), rotation: (((t.angle(p.rotation ?? 0) + 180) % 360) + 360) % 360 } }];
    }
    return [{ ...el, params: { ...el.params, origin: t.map(p.origin), rotation: t.angle(p.rotation ?? 0) } }];
  }
  if (Array.isArray(p.outline)) {
    // Tak har en nockriktning som vrids med.
    const ridge = typeof p.ridge === 'number' ? { ridge: t.angle(p.ridge) } : {};
    return [{ ...el, params: { ...el.params, outline: p.outline.map(t.map), ...(p.seed ? { seed: t.map(p.seed) } : {}), ...ridge } }];
  }
  if (Array.isArray(p.points)) {
    const points = p.points.map((q: any) => (Array.isArray(q) ? t.map(q as Pt) : { ...q, at: t.map(q.at) }));
    return [{ ...el, params: { ...el.params, points, angle: t.angle(p.angle ?? 0), offset: t.mirror ? -(p.offset ?? 0) : p.offset } }];
  }
  if (p.pos) {
    return [{ ...el, params: { ...el.params, pos: t.map(p.pos), angle: t.mirror ? p.angle : t.angle(p.angle ?? 0) } }];
  }
  return [];
}

function applyTransform(store: DocStore, ids: Id[], t: PlanTransform, label: string): void {
  const moving = new Set(ids);
  // Dörrar och fönster följer sina väggar.
  for (const e of Object.values(store.doc.elements)) if (e.host && moving.has(e.host)) moving.add(e.id);
  store.transact(label, (tx) => {
    for (const id of ids) {
      const el = tx.doc.elements[id];
      if (!el || el.host) continue;
      for (const e of transformed(tx.doc, el, t, moving)) tx.putElement(e);
    }
  });
}

/** Vrid det markerade 90° moturs kring en punkt. */
export function rotateElements(store: DocStore, ids: Id[], center: Pt, deg = 90): void {
  applyTransform(store, ids, rotation(center, deg), `Vrid ${deg}°`);
}

/** Spegla det markerade i en lodrät linje genom en punkt. */
export function mirrorElements(store: DocStore, ids: Id[], center: Pt): void {
  applyTransform(store, ids, mirrorX(center), 'Spegla');
}

/**
 * Kopiera element på samma plats. Dörrar och fönster följer med om deras
 * vägg kopieras. Kopiorna finns i samma tillstånd som originalen och får nya
 * id; numren tas bort så att de numreras om.
 */
export function copyElements(store: DocStore, ids: Id[]): Id[] {
  const doc = store.doc;
  const map = new Map<Id, Id>();
  const pick = new Set(ids.filter((id) => doc.elements[id] && !doc.elements[id].host));
  for (const e of Object.values(doc.elements)) if (e.host && pick.has(e.host)) pick.add(e.id);
  for (const id of pick) map.set(id, newId(doc.elements[id].type.slice(0, 2).toLowerCase()));
  store.transact(pick.size === 1 ? 'Kopiera' : `Kopiera ${pick.size} objekt`, (tx) => {
    for (const id of pick) {
      const el = doc.elements[id];
      const params = { ...el.params } as Record<string, unknown>;
      delete params.number;
      tx.putElement({ ...structuredClone(el), id: map.get(id)!, host: el.host ? map.get(el.host) : undefined, params: structuredClone(params) });
    }
  });
  return ids.map((id) => map.get(id)).filter((x): x is Id => !!x);
}
