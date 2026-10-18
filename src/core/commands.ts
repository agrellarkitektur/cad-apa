import type { StyleSheet } from './graphics';
import { newId } from './ids';
import type { Definition, Element, Id, ProjectDoc, State, Value } from './model';
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
  store.transact(ids.length === 1 ? 'Ta bort objekt' : `Ta bort ${ids.length} objekt`, (tx) => {
    for (const id of withHosted(tx, ids)) tx.removeElement(id);
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
 */
export function moveElements(store: DocStore, ids: Id[], d: [number, number], label = 'Flytta'): void {
  if (Math.hypot(d[0], d[1]) < 0.01) return;
  const set = new Set(ids);
  store.transact(label, (tx) => {
    for (const id of ids) {
      const el = tx.doc.elements[id];
      if (!el || (el.host && set.has(el.host))) continue;
      const patch = movePatch(tx.doc, el, d);
      if (patch) tx.putElement({ ...el, params: { ...el.params, ...patch } });
    }
  });
}

/** Parametrarna efter en förflyttning: väggar, möbler och rum flyttas, öppningar glider längs väggen. */
function movePatch(doc: ProjectDoc, el: Element, d: [number, number]): Record<string, unknown> | null {
  const p = el.params as Record<string, any>;
  const add = (q: [number, number]): [number, number] => [Math.round(q[0] + d[0]), Math.round(q[1] + d[1])];
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
    const host = doc.elements[el.host]?.params as { start: [number, number]; end: [number, number] } | undefined;
    if (!host) return null;
    const ux = host.end[0] - host.start[0];
    const uy = host.end[1] - host.start[1];
    const len = Math.hypot(ux, uy) || 1;
    return { at: Math.round(p.at + (d[0] * ux + d[1] * uy) / len) };
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
      tx.putElement({ ...el, params: { ...el.params, ...patch } });
      // Dörrar och fönster står still i världen när väggen förlängs eller
      // kortas: deras läge mäts från startpunkten, så det räknas om.
      const ns = (patch.start as [number, number] | undefined) ?? p.start;
      const ne = (patch.end as [number, number] | undefined) ?? p.end;
      const len0 = Math.hypot(p.end[0] - p.start[0], p.end[1] - p.start[1]);
      const len1 = Math.hypot(ne[0] - ns[0], ne[1] - ns[1]);
      // Flyttas bara slutänden behåller öppningarna sitt mått från starten.
      if (!patch.start || len0 < 1 || len1 < 1) continue;
      const d0 = [(p.end[0] - p.start[0]) / len0, (p.end[1] - p.start[1]) / len0];
      const d1 = [(ne[0] - ns[0]) / len1, (ne[1] - ns[1]) / len1];
      for (const h of Object.values(tx.doc.elements)) {
        if (h.host !== el.id || typeof h.params.at !== 'number') continue;
        const at = h.params.at as number;
        const world = [p.start[0] + d0[0] * at, p.start[1] + d0[1] * at];
        const nat = Math.round((world[0] - ns[0]) * d1[0] + (world[1] - ns[1]) * d1[1]);
        if (nat !== at) tx.putElement({ ...h, params: { ...h.params, at: nat } });
      }
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

export function renameState(store: DocStore, id: Id, name: string): void {
  store.transact(`Byt namn till ${name}`, (tx) => {
    tx.setStates(tx.doc.states.map((s) => (s.id === id ? { ...s, name } : s)));
  });
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
  const out: Element[] = [{ ...wall, params: { ...wall.params, start: p.end, end: p.start, justification: keepBody ? swapped : j } }];
  const len = Math.hypot(p.end[0] - p.start[0], p.end[1] - p.start[1]);
  for (const h of Object.values(doc.elements)) {
    if (h.host !== wall.id) continue;
    const hp = h.params as { at?: number; hinge?: string; swing?: number };
    const patch: Record<string, unknown> = {};
    if (typeof hp.at === 'number') patch.at = Math.round(len - hp.at);
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
interface PlanTransform {
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
function transformed(doc: ProjectDoc, el: Element, t: PlanTransform, moving: Set<Id>): Element[] {
  const p = el.params as Record<string, any>;
  const out: Element[] = [];
  if (p.start && p.end) {
    let start = t.map(p.start);
    let end = t.map(p.end);
    if (t.mirror) {
      // Speglingen vänder sidorna; byt riktning så att insidan blir kvar inne.
      [start, end] = [end, start];
      const len = Math.hypot(p.end[0] - p.start[0], p.end[1] - p.start[1]);
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
    return [{ ...el, params: { ...el.params, outline: p.outline.map(t.map), ...(p.seed ? { seed: t.map(p.seed) } : {}) } }];
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
