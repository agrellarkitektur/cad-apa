import { followJoins, isArc, movePatch, putWallEnds } from './commands';
import type { Element, Id } from './model';
import type { DocStore } from './store';
import { canTrim, isOpenLine, pathOf, trimPath } from './trimEdit';
import { openingSpans } from './wallEdit';

/**
 * Modifiera-verktyg del 2 (0.8.14): flytta flera objekt olika långt i ett
 * steg (Justera och Fördela), skala, hämta och överför inställningar, och
 * förläng eller trimma flera mot en gräns. Allt i en transaktion, som ångras
 * i ett steg.
 */

type P = [number, number];
type Seg = { a: readonly [number, number]; b: readonly [number, number] };

const round = (q: readonly number[]): P => [Math.round(q[0]), Math.round(q[1])];

// ---------- Flytta var för sig (Justera och Fördela) ----------

/**
 * Flytta varje objekt med sin egen förflyttning. Anslutna väggar följer med
 * som vid Flytta. Låsta objekt och dörrar och fönster vars vägg flyttas
 * hoppas över. Svarar med hur många som flyttades.
 */
export function moveEach(store: DocStore, moves: ReadonlyMap<Id, readonly [number, number]>, label: string): number {
  let n = 0;
  const before = store.doc;
  const set = new Set(moves.keys());
  store.transact(label, (tx) => {
    for (const [id, d] of moves) {
      const el = tx.doc.elements[id];
      if (!el || (el.host && set.has(el.host)) || Math.hypot(d[0], d[1]) < 0.5) continue;
      const patch = movePatch(tx.doc, el, [d[0], d[1]]);
      if (!patch) continue;
      tx.putElement({ ...el, params: { ...el.params, ...patch } });
      followJoins(tx, before, new Set([id]), [d[0], d[1]], set);
      n++;
    }
  });
  return n;
}

// ---------- Skala ----------

/** Typer som går att skala: 2D, möbler, underlag, texter och fria mått. Väggar och tak har mått som bestäms på annat sätt. */
export function canScale(el: Element | undefined): boolean {
  if (!el || el.locked) return false;
  if (el.type === 'Dimension') return Array.isArray(el.params.points) && Array.isArray((el.params.points as unknown[])[0]);
  return el.type === 'Shape2D' || el.type === 'Furniture' || el.type === 'Underlay' || el.type === 'Text';
}

/** De nya parametrarna för ett element som skalas med `f` kring `base`. */
export function scaledParams(el: Element, base: readonly [number, number], f: number): Record<string, unknown> | null {
  if (!canScale(el)) return null;
  const p = el.params as Record<string, any>;
  const map = (q: readonly number[]): P => round([base[0] + (q[0] - base[0]) * f, base[1] + (q[1] - base[1]) * f]);
  switch (el.type) {
    case 'Shape2D':
      // Pilhöjderna skalas med (0.8.24); ändarnas storlek är på papperet.
      return { points: (p.points as P[]).map(map), ...(Array.isArray(p.bulges) ? { bulges: (p.bulges as number[]).map((b) => Math.round(b * f * 10) / 10) } : {}) };
    case 'Dimension':
      return { points: (p.points as P[]).map(map), offset: Math.round((p.offset ?? 0) * f) };
    case 'Furniture':
      return { origin: map(p.origin), width: Math.max(1, Math.round(p.width * f)), depth: Math.max(1, Math.round(p.depth * f)) };
    case 'Underlay':
      return { pos: map(p.pos), scale: p.scale * f };
    case 'Text':
      // Texthöjden är på papperet och ändras inte; bara läget.
      return { pos: map(p.pos) };
    default:
      return null;
  }
}

/** Skala det som går att skala bland `ids`. Svarar med hur många som skalades. */
export function scaleElements(store: DocStore, ids: readonly Id[], base: readonly [number, number], f: number): number {
  if (!(f > 0) || Math.abs(f - 1) < 1e-9) return 0;
  let n = 0;
  store.transact(`Skala ${String(Math.round(f * 1000) / 1000).replace('.', ',')}×`, (tx) => {
    for (const id of ids) {
      const el = tx.doc.elements[id];
      const patch = el && scaledParams(el, base, f);
      if (!patch) continue;
      tx.putElement({ ...el, params: { ...el.params, ...patch } });
      n++;
    }
  });
  return n;
}

// ---------- Hämta och överför ----------

/**
 * Parametrar som är form eller läge och därför inte följer med pipetten:
 * punkter, ändar, läge, vridning, storlek, fil och text. Allt annat (typ,
 * tjocklek, höjd, liv, penna, linjetyp, färg, mönster …) följer med.
 */
const PLACEMENT = new Set([
  'start', 'end', 'bulge', 'bulges', 'points', 'closed', 'shape', 'origin', 'rotation', 'pos', 'size', 'asset', 'page', 'kind', 'layersOff',
  'text', 'at', 'hinge', 'swing', 'outline', 'seed', 'labelAt', 'ridge', 'offset', 'auto', 'side', 'label', 'roof', 'face', 'toward', 'stamp', 'scale', 'facing',
]);

/** Vridning är läge (skrafferingens vinkel heter `fillAngle` och följer med). Möblernas mått är form. */
function isPlacement(type: string, key: string): boolean {
  if (key === 'angle') return true;
  if (type === 'Furniture' && (key === 'width' || key === 'depth')) return true;
  return PLACEMENT.has(key);
}

/**
 * Ge det markerade samma inställningar som `sourceId`: typen och alla
 * parametrar som inte är form eller läge. Bara objekt av samma slag ändras.
 * Svarar med hur många som ändrades och hur många som var av ett annat slag.
 */
export function transferSettings(store: DocStore, sourceId: Id, ids: readonly Id[]): { done: number; other: number; locked: number } {
  const src = store.doc.elements[sourceId];
  const out = { done: 0, other: 0, locked: 0 };
  if (!src) return out;
  const own = (el: Element) => Object.keys(el.params).filter((k) => !isPlacement(el.type, k));
  const take = own(src);
  store.transact('Hämta och överför', (tx) => {
    for (const id of ids) {
      if (id === sourceId) continue;
      const el = tx.doc.elements[id];
      if (!el) continue;
      if (el.type !== src.type) {
        out.other++;
        continue;
      }
      if (el.locked) {
        out.locked++;
        continue;
      }
      const params: Record<string, unknown> = { ...el.params };
      // Det som källan inte har (t.ex. ingen egen färg) tas bort, så att förvalet gäller.
      for (const k of own(el)) delete params[k];
      for (const k of take) params[k] = structuredClone(src.params[k]);
      const next: Element = { ...el, params: params as Element['params'] };
      if (src.definition) next.definition = src.definition;
      else delete next.definition;
      // Den egna pennan (0.8.31) följer också med.
      if (src.pen) next.pen = structuredClone(src.pen);
      else delete next.pen;
      tx.putElement(next);
      out.done++;
    }
  });
  return out;
}

// ---------- Förläng och trimma flera mot en gräns ----------

/** Punkterna i en vägg eller öppen 2D-linje, i ordning. */
/**
 * Var strålen från `from` genom `to` (förbi `to`) först når gränsen, som
 * gånger sträckan from–to (större än 1). Når den inte fram till någon bit av
 * gränsen används den närmaste bitens förlängning.
 */
function rayHit(from: P, to: P, segs: readonly Seg[]): number | null {
  const r = [to[0] - from[0], to[1] - from[1]];
  let best: number | null = null;
  let line: number | null = null;
  for (const s of segs) {
    const d = [s.b[0] - s.a[0], s.b[1] - s.a[1]];
    const den = r[0] * d[1] - r[1] * d[0];
    if (Math.abs(den) < 1e-9) continue;
    const qa = [s.a[0] - from[0], s.a[1] - from[1]];
    const k = (qa[0] * d[1] - qa[1] * d[0]) / den;
    const u = (qa[0] * r[1] - qa[1] * r[0]) / den;
    if (k <= 1 + 1e-6) continue;
    if (u >= -1e-6 && u <= 1 + 1e-6) best = best === null ? k : Math.min(best, k);
    else line = line === null ? k : Math.min(line, k);
  }
  return best ?? line;
}

export interface BoundaryResult {
  done: number;
  /** Objekt som inte nådde fram, inte korsade gränsen eller var låsta. */
  skipped: number;
  /** Dörrar och fönster som skulle hamna utanför sin vägg. */
  blocked: Id[];
}

/**
 * Förläng till: varje markerad vägg eller öppen 2D-linje förlängs i den ände
 * som ligger närmast gränsen, rakt fram tills den når den. Gränsen räknas
 * inte själv.
 */
export function extendAllTo(store: DocStore, ids: readonly Id[], boundaryId: Id, segs: readonly Seg[]): BoundaryResult {
  const res: BoundaryResult = { done: 0, skipped: 0, blocked: [] };
  store.transact('Förläng till', (tx) => {
    for (const id of ids) {
      const el = tx.doc.elements[id];
      if (!el || id === boundaryId) continue;
      if (!canTrim(el) || el.locked) {
        res.skipped++;
        continue;
      }
      const pts = pathOf(el);
      const n = pts.length;
      const atEnd = rayHit(pts[n - 2], pts[n - 1], segs);
      const atStart = rayHit(pts[1], pts[0], segs);
      const lenEnd = atEnd === null ? Infinity : (atEnd - 1) * Math.hypot(pts[n - 1][0] - pts[n - 2][0], pts[n - 1][1] - pts[n - 2][1]);
      const lenStart = atStart === null ? Infinity : (atStart - 1) * Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
      if (!Number.isFinite(lenEnd) && !Number.isFinite(lenStart)) {
        res.skipped++;
        continue;
      }
      const next = pts.slice();
      if (lenEnd <= lenStart) {
        const a = pts[n - 2];
        const b = pts[n - 1];
        next[n - 1] = round([a[0] + (b[0] - a[0]) * atEnd!, a[1] + (b[1] - a[1]) * atEnd!]);
      } else {
        const a = pts[1];
        const b = pts[0];
        next[0] = round([a[0] + (b[0] - a[0]) * atStart!, a[1] + (b[1] - a[1]) * atStart!]);
      }
      if (el.type === 'Wall') putWallEnds(tx, el, next[0], next[1]);
      else tx.putElement({ ...el, params: { ...el.params, points: next } });
      res.done++;
    }
  });
  return res;
}

/** Vilken sida av gränsens närmaste bit en punkt ligger på (+1 eller −1). */
function sideOf(segs: readonly Seg[], q: readonly number[]): number {
  let best = { d: Infinity, s: 0 };
  for (const s of segs) {
    const u = [s.b[0] - s.a[0], s.b[1] - s.a[1]];
    const l2 = u[0] * u[0] + u[1] * u[1] || 1;
    const t = Math.max(0, Math.min(1, ((q[0] - s.a[0]) * u[0] + (q[1] - s.a[1]) * u[1]) / l2));
    const c = [s.a[0] + u[0] * t, s.a[1] + u[1] * t];
    const d = Math.hypot(q[0] - c[0], q[1] - c[1]);
    if (d < best.d) best = { d, s: Math.sign(u[0] * (q[1] - s.a[1]) - u[1] * (q[0] - s.a[0])) || 1 };
  }
  return best.s;
}

/**
 * Trimma mot en gräns: på varje markerad vägg eller öppen 2D-linje som
 * korsar gränsen tas biten på den sida man klickade bort, från gränsen ut
 * till änden. Objekt vars båda ändar ligger på den sidan hoppas över.
 */
export function trimAllAt(store: DocStore, ids: readonly Id[], boundaryId: Id, segs: readonly Seg[], side: readonly number[]): BoundaryResult {
  const res: BoundaryResult = { done: 0, skipped: 0, blocked: [] };
  const cut = sideOf(segs, side);
  const doc = store.doc;
  const plan: { id: Id; pts: P[]; lo: number; hi: number }[] = [];
  for (const id of ids) {
    const el = doc.elements[id];
    if (!el || id === boundaryId) continue;
    if (!canTrim(el) || el.locked || (el.type === 'Wall' && isArc(el)) || (el.type !== 'Wall' && !isOpenLine(el))) {
      res.skipped++;
      continue;
    }
    const pts = pathOf(el);
    const s0 = sideOf(segs, pts[0]) === cut;
    const s1 = sideOf(segs, pts[pts.length - 1]) === cut;
    if (s0 === s1) {
      res.skipped++;
      continue;
    }
    const r = trimPath(pts, segs, s1 ? pts[pts.length - 1] : pts[0]);
    if (!r || r.pieces.length !== 1) {
      res.skipped++;
      continue;
    }
    if (el.type === 'Wall') {
      const blocked = openingSpans(doc, id).filter((o) => o.to > r.lo && o.from < r.hi).map((o) => o.id);
      if (blocked.length) {
        res.blocked.push(...blocked);
        continue;
      }
    }
    plan.push({ id, pts: r.pieces[0], lo: r.lo, hi: r.hi });
  }
  if (!plan.length) return res;
  store.transact('Trimma mot gräns', (tx) => {
    for (const { id, pts } of plan) {
      const el = tx.doc.elements[id];
      if (el.type === 'Wall') putWallEnds(tx, el, round(pts[0]), round(pts[pts.length - 1]));
      else tx.putElement({ ...el, params: { ...el.params, shape: 'polyline', points: pts.map(round) } });
      res.done++;
    }
  });
  return res;
}
