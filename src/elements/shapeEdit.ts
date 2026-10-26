import type { Id, ProjectDoc } from '../core/model';
import { offsetEdge } from '../core/roofEdit';
import { arcFromBulge, bulgeTangent, STRAIGHT } from '../geometry/arc';
import { dist, dot, left, norm, sub } from '../geometry/vec';
import type { Vec2 } from '../repr/primitives';
import { catmullRom, isClosed, segmentArc, segmentCount, shapePoints, type Shape2DParams, type ShapePath } from './drawing2d';
import type { SlabHole } from './slab';

/**
 * Punkter och kanter i 2D-former (0.8 del 2, 0.8.19, 0.8.24): greppen som
 * kan dras och det Modifiera gör med dem. Formen är en kedja av raka
 * segment och bågar (eller en spline); varje punkt har ett grepp, och en
 * kant kan böjas eller rätas ut. Hur formen ritades spelar ingen roll.
 */

type P = [number, number];

/** Det som behövs av ett element: typen och parametrarna. */
export interface ShapeLike {
  type: string;
  params: Record<string, unknown>;
}

const pathOf = (s: ShapeLike): ShapePath => (s.params.shape === 'spline' ? 'spline' : 'polyline');
const pointsOf = (s: ShapeLike): P[] => ((s.params.points as P[] | undefined) ?? []).map((q) => [q[0], q[1]]);
const paramsOf = (s: ShapeLike) => s.params as unknown as Shape2DParams;

/** Pilhöjderna, en per punkt (den sista är det slutande segmentet). */
function fullBulges(s: ShapeLike): number[] {
  const n = pointsOf(s).length;
  const b = (s.params.bulges as number[] | undefined) ?? [];
  return Array.from({ length: n }, (_, i) => Number(b[i]) || 0);
}

/** Pilhöjderna som parameter: utelämnad när alla segment är raka, utan raka segment sist. */
function bulgesParam(b: number[]): { bulges: number[] | undefined } {
  const r = b.map((v) => (Math.abs(v) < STRAIGHT ? 0 : Math.round(v * 10) / 10));
  // Raka segment sist behöver inte stå med.
  while (r.length && r[r.length - 1] === 0) r.pop();
  return { bulges: r.length ? r : undefined };
}

/** Om elementet har punkter som går att dra. */
export function isShape(s: ShapeLike | undefined): s is ShapeLike {
  return s?.type === 'Shape2D';
}

/** En håltagning som en sluten 2D-form (0.9.4), så att samma grepp och val gäller. */
export function holeShape(h: SlabHole): ShapeLike {
  return { type: 'Shape2D', params: { shape: 'polyline', points: h.points, ...(h.bulges ? { bulges: h.bulges } : {}), closed: true } };
}

/** Takfallets kontur (0.10) som en sluten 2D-form, så att samma grepp och val gäller. */
export function roofShape(el: ShapeLike): ShapeLike {
  const bulges = el.params.bulges as number[] | undefined;
  return { type: 'Shape2D', params: { shape: 'polyline', points: el.params.outline, ...(bulges ? { bulges } : {}), closed: true } };
}

/** Formen som Modifiera och greppen ändrar för ett element: 2D-formen själv, eller takfallets kontur. */
export function shapeOf(el: ShapeLike | undefined): ShapeLike | undefined {
  if (!el) return undefined;
  if (el.type === 'Shape2D') return el;
  // Markobjekt längs en linje (0.10.5): linjen som en öppen 2D-form, utan bågar.
  if (el.type === 'Ground' && Array.isArray(el.params.line) && (el.params.line as unknown[]).length >= 2) return { type: 'Shape2D', params: { shape: 'polyline', points: el.params.line, closed: false } };
  return el.type === 'Roof' && Array.isArray(el.params.outline) ? roofShape(el) : undefined;
}

/** Bjälklagets håltagningar. */
export function holesOf(el: ShapeLike | undefined): SlabHole[] {
  return el?.type === 'Slab' ? ((el.params.holes as SlabHole[] | undefined) ?? []) : [];
}

/**
 * Formen som Modifiera ändrar: 2D-elementet `id`, eller med `hole`
 * håltagning nummer `hole` i bjälklaget `id` (0.9.4).
 */
export function editedShape(doc: ProjectDoc, id: Id | undefined, hole?: number): ShapeLike | undefined {
  const el = id ? doc.elements[id] : undefined;
  if (hole === undefined) return shapeOf(el);
  const h = holesOf(el)[hole];
  return h ? holeShape(h) : undefined;
}

/**
 * Elementets parametrar efter en ändring av formen (punkter och
 * pilhöjder): 2D-elementets egna, eller bjälklagets håltagningar med den
 * ändrade på sin plats.
 */
export function shapePatch(doc: ProjectDoc, id: Id, hole: number | undefined, patch: Record<string, unknown>): Record<string, unknown> {
  if (hole === undefined && doc.elements[id]?.type === 'Roof') {
    // Takfallets kontur (0.10): punkterna och bågarna.
    return { ...('points' in patch ? { outline: patch.points } : {}), ...('bulges' in patch ? { bulges: patch.bulges } : {}) };
  }
  if (hole === undefined && doc.elements[id]?.type === 'Ground') return 'points' in patch ? { line: patch.points } : {};
  if (hole === undefined) return patch;
  const holes = [...holesOf(doc.elements[id])];
  const h = holes[hole];
  if (!h) return {};
  const points = (patch.points as [number, number][] | undefined) ?? h.points;
  const bulges = 'bulges' in patch ? (patch.bulges as number[] | undefined) : h.bulges;
  holes[hole] = { points, ...(bulges ? { bulges } : {}) };
  return { holes };
}

/** Punkterna som får grepp. */
export function shapeNodes(s: ShapeLike): Vec2[] {
  return pointsOf(s);
}

/** Om formen är sluten (kanten från sista punkten tillbaka till den första finns). */
function closedOf(s: ShapeLike): boolean {
  return isClosed(paramsOf(s));
}

/** Om kant i är en båge. */
export function edgeIsArc(s: ShapeLike, i: number): boolean {
  return pathOf(s) === 'polyline' && Math.abs(fullBulges(s)[i] ?? 0) >= STRAIGHT;
}

/**
 * Parametrarna efter att punkt i flyttats till `to`. Bågarna på var sida
 * behåller sin vinkel: pilhöjden ändras med kordan, så att en cirkel
 * förblir en cirkel och en båge samma slags båge.
 */
export function moveShapeNode(s: ShapeLike, i: number, to: Vec2): Record<string, unknown> {
  const pts = pointsOf(s);
  const t: P = [Math.round(to[0]), Math.round(to[1])];
  const next = pts.map((q, k) => (k === i ? t : q));
  if (pathOf(s) === 'spline' || !s.params.bulges) return { points: next };
  const n = pts.length;
  const b = fullBulges(s);
  for (const k of new Set([(i - 1 + n) % n, i])) {
    if (!b[k]) continue;
    const before = dist(pts[k], pts[(k + 1) % n]);
    const after = dist(next[k], next[(k + 1) % n]);
    b[k] = before > 1 ? (b[k] * after) / before : 0;
  }
  return { points: next, ...bulgesParam(b) };
}

/** Punkterna längs kant i, med båda ändarna. */
function edgePoints(s: ShapeLike, i: number): Vec2[] {
  const pts = pointsOf(s);
  const a = pts[i];
  const b = pts[(i + 1) % pts.length];
  const arc = pathOf(s) === 'polyline' ? segmentArc(paramsOf(s), i) : null;
  if (!arc) return [a, b];
  return shapePoints({ shape: 'polyline', points: [a, b], bulges: [fullBulges(s)[i]] }).points;
}

/** Närmaste punkten på sträckan a–b. */
function nearestOn(at: Vec2, a: Vec2, b: Vec2): { q: Vec2; d: number } {
  const e = sub(b, a);
  const l2 = e[0] * e[0] + e[1] * e[1] || 1;
  const t = Math.max(0, Math.min(1, ((at[0] - a[0]) * e[0] + (at[1] - a[1]) * e[1]) / l2));
  const q: Vec2 = [a[0] + e[0] * t, a[1] + e[1] * t];
  return { q, d: dist(at, q) };
}

/**
 * Kanten närmast punkten (kant i går från punkt i till i + 1), om den är
 * närmare än `tol`, med punkten på kanten. För splines räknas avståndet
 * till kurvan, för bågar till bågen.
 */
export function shapeEdgeAt(s: ShapeLike, at: Vec2, tol: number): { index: number; at: Vec2 } | null {
  const pts = pointsOf(s);
  if (pts.length < 2) return null;
  const closed = closedOf(s);
  let best: { index: number; at: Vec2; d: number } | null = null;
  if (pathOf(s) === 'spline' && pts.length >= 3) {
    const curve = catmullRom(pts as Vec2[], closed);
    const steps = 12;
    for (let k = 0; k + 1 < curve.length + (closed ? 1 : 0); k++) {
      const { d } = nearestOn(at, curve[k], curve[(k + 1) % curve.length]);
      if (d <= tol && (!best || d < best.d)) best = { index: Math.min(pts.length - (closed ? 1 : 2), Math.floor(k / steps)), at: [Math.round(at[0]), Math.round(at[1])], d };
    }
    return best && { index: best.index, at: best.at };
  }
  const n = segmentCount(pts.length, closed);
  for (let k = 0; k < n; k++) {
    const e = edgePoints(s, k);
    for (let j = 0; j + 1 < e.length; j++) {
      const { q, d } = nearestOn(at, e[j], e[j + 1]);
      if (d <= tol && (!best || d < best.d)) best = { index: k, at: [Math.round(q[0]), Math.round(q[1])], d };
    }
  }
  return best && { index: best.index, at: best.at };
}

/** Vad som går att göra med en punkt eller kant i formen. */
export function shapeCan(s: ShapeLike): { insert: boolean; remove: boolean; offset: boolean; bend: boolean } {
  const n = pointsOf(s).length;
  const chain = pathOf(s) === 'polyline';
  return {
    insert: n >= 2,
    remove: n > (closedOf(s) ? 3 : 2),
    offset: chain,
    bend: chain,
  };
}

/** En ny punkt på kant i. På en båge hamnar punkten på bågen, som delas i två. */
export function insertShapeNode(s: ShapeLike, edge: number, at: Vec2): Record<string, unknown> | null {
  if (!shapeCan(s).insert) return null;
  const pts = pointsOf(s);
  const n = pts.length;
  const b = fullBulges(s);
  const arc = edgeIsArc(s, edge) ? arcFromBulge(pts[edge], pts[(edge + 1) % n], b[edge]) : null;
  let q: P = [Math.round(at[0]), Math.round(at[1])];
  let parts: [number, number] = [0, 0];
  if (arc) {
    // Vinkeln från start längs bågen, inom bågen.
    const ang = Math.atan2(at[1] - arc.center[1], at[0] - arc.center[0]);
    let s1 = (arc.sigma * (arc.theta0 - ang)) % (2 * Math.PI);
    if (s1 < 0) s1 += 2 * Math.PI;
    s1 = Math.max(arc.sweep * 0.05, Math.min(arc.sweep * 0.95, s1));
    const th = arc.theta0 - arc.sigma * s1;
    q = [Math.round(arc.center[0] + arc.radius * Math.cos(th)), Math.round(arc.center[1] + arc.radius * Math.sin(th))];
    const bulgeOf = (sweep: number, a: Vec2, c: Vec2) => arc.sigma * (dist(a, c) / 2) * Math.tan(sweep / 4);
    parts = [bulgeOf(s1, pts[edge], q), bulgeOf(arc.sweep - s1, q, pts[(edge + 1) % n])];
  }
  pts.splice(edge + 1, 0, q);
  b.splice(edge, 1, parts[0], parts[1]);
  return { points: pts, ...(pathOf(s) === 'polyline' ? bulgesParam(b) : {}) };
}

/** Punkt i borttagen; null om formen då blir för liten. Segmentet som binder ihop grannarna är rakt. */
export function removeShapeNode(s: ShapeLike, i: number): Record<string, unknown> | null {
  if (!shapeCan(s).remove) return null;
  const pts = pointsOf(s).filter((_, k) => k !== i);
  const b = fullBulges(s);
  b[(i - 1 + b.length) % b.length] = 0;
  b.splice(i, 1);
  return { points: pts, ...(pathOf(s) === 'polyline' ? bulgesParam(b) : {}) };
}

/** Om hörn i ligger mellan två raka kanter, så att det går att avrunda eller fasa (0.9.4). */
export function canRoundCorner(s: ShapeLike, i: number): boolean {
  if (pathOf(s) !== 'polyline') return false;
  const n = pointsOf(s).length;
  if (closedOf(s) ? n < 3 : i <= 0 || i >= n - 1) return false;
  const b = fullBulges(s);
  return Math.abs(b[(i - 1 + n) % n]) < STRAIGHT && Math.abs(b[i]) < STRAIGHT;
}

/**
 * Hörn i avrundat med radien r (en båge som tangerar båda kanterna) eller
 * fasat r mm från hörnet längs båda kanterna (0.9.4). Null om det inte
 * ryms på kanterna.
 */
export function roundShapeCorner(s: ShapeLike, i: number, r: number, kind: 'fillet' | 'chamfer'): Record<string, unknown> | null {
  if (!canRoundCorner(s, i) || !(r > 0)) return null;
  const pts = pointsOf(s);
  const n = pts.length;
  const at = pts[i];
  const prev = pts[(i - 1 + n) % n];
  const next = pts[(i + 1) % n];
  const l1 = dist(at, prev);
  const l2 = dist(at, next);
  if (l1 < 1 || l2 < 1) return null;
  const u1 = norm(sub(prev, at));
  const u2 = norm(sub(next, at));
  const phi = Math.acos(Math.max(-1, Math.min(1, dot(u1, u2))));
  // Raka (eller vända) hörn går inte att runda.
  if (phi < 1e-3 || Math.PI - phi < 1e-3) return null;
  const t = kind === 'fillet' ? r / Math.tan(phi / 2) : r;
  if (t > l1 - 1 || t > l2 - 1) return null;
  const a: P = [Math.round(at[0] + u1[0] * t), Math.round(at[1] + u1[1] * t)];
  const b: P = [Math.round(at[0] + u2[0] * t), Math.round(at[1] + u2[1] * t)];
  const bulge = kind === 'fillet' ? bulgeTangent(a, b, [-u1[0], -u1[1]]) : 0;
  pts.splice(i, 1, a, b);
  const bs = fullBulges(s);
  bs.splice(i, 1, bulge, 0);
  return { points: pts, ...bulgesParam(bs) };
}

/** Kant i böjd till pilhöjden `bulge` (0 = rak), 0.8.24. */
export function bendShapeEdge(s: ShapeLike, i: number, bulge: number): Record<string, unknown> | null {
  if (!shapeCan(s).bend) return null;
  const b = fullBulges(s);
  if (i < 0 || i >= b.length) return null;
  b[i] = bulge;
  return bulgesParam(b);
}

/**
 * Kant i förskjuten d mm åt vänster sett längs kanten. I slutna former
 * följer grannkanterna med (som för takets kontur); i öppna flyttas en
 * ände rakt ut. Null om det inte går.
 */
export function offsetShapeEdge(s: ShapeLike, i: number, d: number): Record<string, unknown> | null {
  if (!shapeCan(s).offset || edgeIsArc(s, i)) return null;
  const pts = pointsOf(s);
  const n = pts.length;
  if (closedOf(s)) {
    if (n < 3) return null;
    const next = offsetEdge(pts, i, d);
    return next ? { points: next } : null;
  }
  const a = pts[i];
  const b = pts[i + 1];
  if (!a || !b || dist(a, b) < 1) return null;
  const nrm = left(norm(sub(b, a)));
  const a2: Vec2 = [a[0] + nrm[0] * d, a[1] + nrm[1] * d];
  const b2: Vec2 = [b[0] + nrm[0] * d, b[1] + nrm[1] * d];
  // En grannkant förlängs eller kortas till den nya linjen; utan granne flyttas änden rakt ut.
  const meet = (p: Vec2, q: Vec2, fallback: Vec2): Vec2 => {
    const e = sub(b2, a2);
    const r = sub(q, p);
    const den = e[0] * r[1] - e[1] * r[0];
    if (Math.abs(den) < 1e-9) return fallback;
    const t = ((p[0] - a2[0]) * r[1] - (p[1] - a2[1]) * r[0]) / den;
    return [a2[0] + e[0] * t, a2[1] + e[1] * t];
  };
  const na = i > 0 ? meet(pts[i - 1], a, a2) : a2;
  const nb = i + 2 < n ? meet(b, pts[i + 2], b2) : b2;
  const out = pts.map((q) => [q[0], q[1]] as P);
  out[i] = [Math.round(na[0]), Math.round(na[1])];
  out[i + 1] = [Math.round(nb[0]), Math.round(nb[1])];
  return { points: out };
}

/** Formen som punkter, för förhandsvisningen av en ändring. */
export function previewShape(s: ShapeLike, patch: Record<string, unknown>): { points: Vec2[]; closed: boolean } {
  return shapePoints({ ...s.params, ...patch } as unknown as Shape2DParams);
}
