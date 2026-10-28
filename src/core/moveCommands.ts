import { BoxIndex } from '../geometry/boxIndex';
import { wallFrame, type WallGeometry } from '../geometry/wallFrame';
import { hostedIn, wallEndsIn } from './elementIndex';
import type { Element, Id, ProjectDoc } from './model';
import { moveViewportsTx } from './sheets';
import type { DocStore, TxBuilder } from './store';

/**
 * Flytta och vända (granskningen efter 0.10.12, förut i `commands.ts`, som
 * exporterar allt härifrån): element flyttas efter sin typ, anslutna väggar
 * följer med, väggändar dras och väggar vänds.
 */

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
export function followJoins(tx: TxBuilder, before: ProjectDoc, moved: Set<Id>, d: P2, skip: ReadonlySet<Id> = moved): number {
  const movedWalls = [...moved]
    .map((id) => before.elements[id])
    .filter((el): el is Element => !!el && el.type === 'Wall');
  if (!movedWalls.length) return 0;
  // Bara väggar med en ände nära en flyttad vägg kan följa med (0.8.15): de
  // flyttade väggarnas rektanglar, utökade med tjockleken, läggs i ett
  // rutnät, och väggändarna inom dem hämtas ur registret. Rutnätet ger de
  // flyttade väggarna i samma ordning som förut, så att den första som
  // passar fortfarande gäller.
  const near = new BoxIndex(2000);
  const candidates = new Set<Id>();
  movedWalls.forEach((mw, i) => {
    if (isArc(mw)) return;
    const mp = mw.params as unknown as WallEnds;
    if (Math.hypot(mp.end[0] - mp.start[0], mp.end[1] - mp.start[1]) < 1) return;
    const r = wallThickness(before, mw) + 1;
    const box: [number, number, number, number] = [
      Math.min(mp.start[0], mp.end[0]) - r,
      Math.min(mp.start[1], mp.end[1]) - r,
      Math.max(mp.start[0], mp.end[0]) + r,
      Math.max(mp.start[1], mp.end[1]) + r,
    ];
    near.add(i, box);
    for (const c of wallEndsIn(before, mw.storey, box)) candidates.add(c.id);
  });
  let released = 0;
  for (const id of candidates) {
    const w = before.elements[id];
    if (!w || w.type !== 'Wall' || moved.has(w.id) || skip.has(w.id)) continue;
    // Bågväggar följer inte med: deras ände kan inte glida längs en rak linje.
    if (isArc(w)) continue;
    const p = w.params as unknown as WallEnds;
    // Utgå från läget nu, så att flera anrop i samma transaktion (Justera, 0.8.14) inte skriver över varandra.
    const now = (tx.doc.elements[w.id]?.params ?? p) as unknown as WallEnds;
    const next: WallEnds = { start: now.start, end: now.end };
    let changed = false;
    for (const end of ['start', 'end'] as const) {
      const e = p[end];
      const other = end === 'start' ? p.end : p.start;
      for (const i of near.at(e)) {
        const mw = movedWalls[i];
        if (mw.storey !== w.storey) continue;
        const mp = mw.params as unknown as WallEnds;
        const ml = Math.hypot(mp.end[0] - mp.start[0], mp.end[1] - mp.start[1]);
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
  for (const h of hostedIn(tx.doc, el.id)) {
    if (typeof h.params.at !== 'number') continue;
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
  // Ett rum flyttar också sin punkt och sin flyttade rumsstämpel (0.8.17).
  if (Array.isArray(p.outline))
    return {
      outline: p.outline.map(add),
      ...(p.seed ? { seed: add(p.seed) } : {}),
      ...(p.labelAt ? { labelAt: add(p.labelAt) } : {}),
      // Bjälklagets håltagningar (0.9.1).
      ...(Array.isArray(p.holes) ? { holes: p.holes.map((h: { points: [number, number][] }) => ({ ...h, points: h.points.map(add) })) } : {}),
      // Takfallets referenslinje (0.10).
      ...(Array.isArray(p.ref) ? { ref: p.ref.map(add) } : {}),
      // Markobjektens linje och höjdpunkten (0.10.5; följde inte med före 0.10.7).
      ...(Array.isArray(p.line) ? { line: p.line.map(add) } : {}),
      // Rampens ritade sidor (0.10.18).
      ...(Array.isArray(p.left) ? { left: p.left.map(add) } : {}),
      ...(Array.isArray(p.right) ? { right: p.right.map(add) } : {}),
      // Kanternas egna snitt (0.10.2).
      ...(Array.isArray(p.edgeCuts) ? { edgeCuts: p.edgeCuts.map((c: { a: [number, number]; b: [number, number] }) => ({ ...c, a: add(c.a), b: add(c.b) })) } : {}),
    };
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
  const { bulge, lean } = wall.params as { bulge?: number; lean?: number };
  // Vänster sida byter plats: pilhöjden och lutningen (0.10.21) byter tecken.
  const reversed: Element = {
    ...wall,
    params: { ...wall.params, start: p.end, end: p.start, justification: keepBody ? swapped : j, ...(bulge ? { bulge: -bulge } : {}), ...(lean ? { lean: -lean } : {}) },
  };
  const out: Element[] = [reversed];
  const f0 = wallFrame(geometryOf(doc, wall));
  const f1 = wallFrame(geometryOf(doc, reversed));
  for (const h of hostedIn(doc, wall.id)) {
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
