import { offsetEdge } from '../core/roofEdit';
import { dist, distToSegment, left, norm, sub } from '../geometry/vec';
import type { Vec2 } from '../repr/primitives';
import { catmullRom, shapePoints, type Line2DParams, type Shape2D } from './drawing2d';

/**
 * Punkter och kanter i 2D-element (0.8 del 2): greppen som kan dras och det
 * Modifiera gör med dem. Gäller 2D-linjer (alla former) och fyllningar.
 *
 * - Linje, polylinje och spline: varje punkt. Bågen: start, punkten på
 *   bågen och slut.
 * - Rektangel: hörnen. Det motstående hörnet står still och rektangeln
 *   förblir rät.
 * - Cirkel: centrum (flyttar hela cirkeln) och en punkt för radien.
 * - Fyllning: ytans hörn.
 */

type P = [number, number];

/** Det som behövs av ett element: typen och parametrarna. */
export interface ShapeLike {
  type: string;
  params: Record<string, unknown>;
}

const shapeOf = (s: ShapeLike): Shape2D | 'fill' => (s.type === 'Fill2D' ? 'fill' : ((s.params.shape as Shape2D) ?? 'line'));
const pointsOf = (s: ShapeLike): P[] => ((s.params.points as P[] | undefined) ?? []).map((q) => [q[0], q[1]]);

/** Om elementet har punkter som går att dra. */
export function isShape(s: ShapeLike | undefined): s is ShapeLike {
  return !!s && (s.type === 'Line2D' || s.type === 'Fill2D');
}

/** Punkterna som får grepp. */
export function shapeNodes(s: ShapeLike): Vec2[] {
  return pointsOf(s);
}

/** Om formen är sluten (kanten från sista punkten tillbaka till den första finns). */
function closedOf(s: ShapeLike): boolean {
  const sh = shapeOf(s);
  return sh === 'fill' || sh === 'rect' || ((sh === 'polyline' || sh === 'spline') && !!s.params.closed);
}

/** Parametrarna efter att punkt i flyttats till `to`. */
export function moveShapeNode(s: ShapeLike, i: number, to: Vec2): Record<string, unknown> {
  const pts = pointsOf(s);
  const t: P = [Math.round(to[0]), Math.round(to[1])];
  const sh = shapeOf(s);
  if (sh === 'circle' && i === 0 && pts.length >= 2) {
    // Centrum flyttar hela cirkeln.
    const d = sub(t, pts[0]);
    return { points: [t, [Math.round(pts[1][0] + d[0]), Math.round(pts[1][1] + d[1])]] };
  }
  if (sh === 'rect' && pts.length === 4) {
    const rect = rectWithCorner(pts, i, t);
    if (rect) return { points: rect };
  }
  return { points: pts.map((q, k) => (k === i ? t : q)) };
}

/**
 * Rektangeln med hörn i flyttat till `to` och det motstående hörnet kvar.
 * Sidorna behåller sina riktningar, så att den förblir rät (även snedställd).
 */
export function rectWithCorner(pts: readonly P[], i: number, to: Vec2): P[] | null {
  const o = pts[(i + 2) % 4];
  const u = norm(sub(pts[1], pts[0]));
  const v = norm(sub(pts[3], pts[0]));
  const rel = (q: Vec2): Vec2 => [(q[0] - o[0]) * u[0] + (q[1] - o[1]) * u[1], (q[0] - o[0]) * v[0] + (q[1] - o[1]) * v[1]];
  const [X, Y] = rel(pts[i]);
  if (Math.abs(X) < 1 || Math.abs(Y) < 1) return null;
  const [nx, ny] = rel(to);
  return pts.map((q, k): P => {
    const [x, y] = rel(q);
    // Hörnet ligger i hörnets eller i det motstående hörnets x- och y-led.
    const a = Math.abs(x) > Math.abs(X) / 2 ? nx : 0;
    const b = Math.abs(y) > Math.abs(Y) / 2 ? ny : 0;
    if (k === (i + 2) % 4) return [o[0], o[1]];
    return [Math.round(o[0] + u[0] * a + v[0] * b), Math.round(o[1] + u[1] * a + v[1] * b)];
  });
}

/**
 * Kanten närmast punkten (kant i går från punkt i till i + 1), om den är
 * närmare än `tol`. För splines räknas avståndet till kurvan.
 */
export function shapeEdgeAt(s: ShapeLike, at: Vec2, tol: number): { index: number; at: Vec2 } | null {
  const sh = shapeOf(s);
  const pts = pointsOf(s);
  if (sh === 'circle' || sh === 'arc' || pts.length < 2) return null;
  const closed = closedOf(s);
  let best: { index: number; at: Vec2; d: number } | null = null;
  if (sh === 'spline' && pts.length >= 3) {
    const curve = catmullRom(pts as Vec2[], closed);
    const steps = 12;
    for (let k = 0; k + 1 < curve.length + (closed ? 1 : 0); k++) {
      const a = curve[k];
      const b = curve[(k + 1) % curve.length];
      const d = distToSegment(at, a, b);
      if (d <= tol && (!best || d < best.d)) best = { index: Math.min(pts.length - (closed ? 1 : 2), Math.floor(k / steps)), at: [Math.round(at[0]), Math.round(at[1])], d };
    }
    return best && { index: best.index, at: best.at };
  }
  const n = closed ? pts.length : pts.length - 1;
  for (let k = 0; k < n; k++) {
    const a = pts[k];
    const b = pts[(k + 1) % pts.length];
    const d = distToSegment(at, a, b);
    if (d > tol || (best && d >= best.d)) continue;
    const e = sub(b, a);
    const l2 = e[0] * e[0] + e[1] * e[1] || 1;
    const t = Math.max(0, Math.min(1, ((at[0] - a[0]) * e[0] + (at[1] - a[1]) * e[1]) / l2));
    best = { index: k, at: [Math.round(a[0] + e[0] * t), Math.round(a[1] + e[1] * t)], d };
  }
  return best && { index: best.index, at: best.at };
}

/** Vad som går att göra med en punkt eller kant i formen. */
export function shapeCan(s: ShapeLike): { insert: boolean; remove: boolean; offset: boolean } {
  const sh = shapeOf(s);
  const n = pointsOf(s).length;
  const closed = closedOf(s);
  return {
    insert: sh !== 'circle' && sh !== 'arc',
    remove: (sh === 'polyline' || sh === 'spline' || sh === 'fill' || sh === 'rect') && n > (closed ? 3 : 2),
    offset: sh === 'line' || sh === 'polyline' || sh === 'rect' || sh === 'fill',
  };
}

/** En ny punkt på kant i. En linje blir en polylinje och en rektangel en sluten polylinje. */
export function insertShapeNode(s: ShapeLike, edge: number, at: Vec2): Record<string, unknown> | null {
  if (!shapeCan(s).insert) return null;
  const pts = pointsOf(s);
  pts.splice(edge + 1, 0, [Math.round(at[0]), Math.round(at[1])]);
  const sh = shapeOf(s);
  if (sh === 'line') return { shape: 'polyline', points: pts, closed: false };
  if (sh === 'rect') return { shape: 'polyline', points: pts, closed: true };
  return { points: pts };
}

/** Punkt i borttagen; null om formen då blir för liten. En rektangel blir en sluten polylinje. */
export function removeShapeNode(s: ShapeLike, i: number): Record<string, unknown> | null {
  if (!shapeCan(s).remove) return null;
  const pts = pointsOf(s).filter((_, k) => k !== i);
  return shapeOf(s) === 'rect' ? { shape: 'polyline', points: pts, closed: true } : { points: pts };
}

/**
 * Kant i förskjuten d mm åt vänster sett längs kanten. I slutna former
 * följer grannkanterna med (som för takets kontur); i öppna flyttas en
 * ände rakt ut. Null om det inte går.
 */
export function offsetShapeEdge(s: ShapeLike, i: number, d: number): Record<string, unknown> | null {
  if (!shapeCan(s).offset) return null;
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
  const p = { ...s.params, ...patch } as unknown as Line2DParams;
  if (s.type === 'Fill2D') return { points: p.points as Vec2[], closed: true };
  return shapePoints(p);
}
