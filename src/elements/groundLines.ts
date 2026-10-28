import type { Barrier, GroundShape } from '../core/ground';
import { arcFromBulge, arcSegments, STRAIGHT } from '../geometry/arc';
import type { Vec2 } from '../repr/primitives';

/**
 * Markobjekt längs en linje (0.10.5): ramp/väg (en referenslinje med
 * bredd; en sort sedan 0.10.7), brytlinje och höjdpunkt (låser marken och
 * tonar den runt omkring), och stödmuren (en linje som slänterna inte går
 * över). Ren geometri; ritningen ligger i `groundPlan.ts`.
 *
 * Linjerna kan ha bågar (0.10.19): pilhöjder per kant som 2D-formens
 * (`bulges`). All räkning mot marken görs på linjen med bågarna som korta
 * raka bitar (`flatLine`); bara ritningen av punkterna och Modifiera ser
 * bågarna som bågar.
 */

type P2 = readonly [number, number];

/** En linje med bågar: punkterna och pilhöjden per kant (utelämnade är raka). */
export interface ArcLine {
  points: [number, number][];
  bulges?: number[];
}

/** Om någon kant är en båge. */
export function hasArcs(bulges: readonly number[] | undefined): boolean {
  return !!bulges?.some((b) => Math.abs(b) >= STRAIGHT);
}

/** Pilhöjderna som parameter: utelämnade när alla kanter är raka, utan raka kanter sist. */
export function tidyBulges(bulges: readonly number[] | undefined, n: number): number[] | undefined {
  const out = Array.from({ length: Math.max(0, n - 1) }, (_, i) => {
    const v = Number(bulges?.[i]) || 0;
    return Math.abs(v) < STRAIGHT ? 0 : Math.round(v * 10) / 10;
  });
  while (out.length && out[out.length - 1] === 0) out.pop();
  return out.length ? out : undefined;
}

/** Pilhöjderna för linjen baklänges: åt andra hållet och i omvänd ordning. */
export function reversedBulges(bulges: readonly number[] | undefined, n: number): number[] | undefined {
  if (!hasArcs(bulges)) return undefined;
  const full = Array.from({ length: Math.max(0, n - 1) }, (_, i) => Number(bulges?.[i]) || 0);
  return tidyBulges(full.reverse().map((b) => -b), n);
}

/**
 * Linjen med bågarna som korta raka bitar, och var varje ritad punkt hamnar
 * i den (`at[i]` är punkt i:s plats i `points`). Utan bågar är det samma
 * punkter.
 */
export function flatLine(line: readonly P2[], bulges?: readonly number[]): { points: Vec2[]; at: number[] } {
  const n = line.length;
  if (!hasArcs(bulges) || n < 2) return { points: line.map((q): Vec2 => [q[0], q[1]]), at: line.map((_, i) => i) };
  const points: Vec2[] = [];
  const at: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    at.push(points.length);
    const a: Vec2 = [line[i][0], line[i][1]];
    const b: Vec2 = [line[i + 1][0], line[i + 1][1]];
    const arc = arcFromBulge(a, b, Number(bulges![i]) || 0);
    if (!arc) {
      points.push(a);
      continue;
    }
    const m = arcSegments(arc.sweep, arc.radius);
    for (let k = 0; k < m; k++) {
      const t = arc.theta0 - (arc.sigma * arc.sweep * k) / m;
      points.push([arc.center[0] + arc.radius * Math.cos(t), arc.center[1] + arc.radius * Math.sin(t)]);
    }
  }
  at.push(points.length);
  points.push([line[n - 1][0], line[n - 1][1]]);
  return { points, at };
}

/** Linjens punkter med bågarna som raka bitar (bara punkterna). */
export const flatPoints = (line: readonly P2[] | undefined, bulges?: readonly number[]): Vec2[] => (line?.length ? flatLine(line, bulges).points : []);

/** Tangenten i början (`atEnd` false) eller slutet av kant i: kordan vriden med halva bågens vinkel. */
function edgeTangent(line: readonly P2[], bulges: readonly number[] | undefined, i: number, atEnd: boolean): Vec2 {
  const a = line[i];
  const c = line[i + 1];
  const l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
  const u: Vec2 = [(c[0] - a[0]) / l, (c[1] - a[1]) / l];
  const b = Number(bulges?.[i]) || 0;
  const phi = Math.abs(b) >= STRAIGHT ? 2 * Math.atan(b / (l / 2)) : 0;
  const r = atEnd ? -phi : phi;
  return [u[0] * Math.cos(r) - u[1] * Math.sin(r), u[0] * Math.sin(r) + u[1] * Math.cos(r)];
}

/**
 * Linjen med bågar förskjuten `d` mm åt vänster (0.10.19), som `offsetLine`
 * men med tangenterna i hörnen, så att en båge förblir en båge (koncentrisk,
 * pilhöjden följer kordan). Utan bågar är det samma som `offsetLine`.
 */
export function offsetArcLine(line: readonly P2[], bulges: readonly number[] | undefined, d: number): ArcLine {
  const n = line.length;
  if (!hasArcs(bulges)) return { points: offsetLine(line, d).map((q): [number, number] => [q[0], q[1]]) };
  const points: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    let m: Vec2;
    let k = 1;
    const nIn = i > 0 ? leftOf(edgeTangent(line, bulges, i - 1, true)) : null;
    const nOut = i < n - 1 ? leftOf(edgeTangent(line, bulges, i, false)) : null;
    if (!nIn) m = nOut!;
    else if (!nOut) m = nIn;
    else {
      const sx = nIn[0] + nOut[0];
      const sy = nIn[1] + nOut[1];
      const l = Math.hypot(sx, sy);
      m = l < 1e-6 ? nIn : [sx / l, sy / l];
      k = Math.min(4, 1 / Math.max(0.25, m[0] * nIn[0] + m[1] * nIn[1]));
    }
    points.push([line[i][0] + m[0] * d * k, line[i][1] + m[1] * d * k]);
  }
  const out = Array.from({ length: n - 1 }, (_, i) => {
    const b = Number(bulges?.[i]) || 0;
    if (Math.abs(b) < STRAIGHT) return 0;
    const before = Math.hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]);
    const after = Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
    return before > 1 ? (b * after) / before : 0;
  });
  return { points, bulges: tidyBulges(out, n) };
}

const leftOf = (t: Vec2): Vec2 => [-t[1], t[0]];

/** Förvald bredd för en ramp eller väg, mm (en ramps rekommenderade fria bredd). */
export const PATH_WIDTH = 1500;

/** Var referenslinjen ligger på vägen (0.10.7): i mitten eller på vänster eller höger kant, sett i linjens riktning. */
export type RefSide = 'center' | 'left' | 'right';

/**
 * Var vägens mitt ligger från referenslinjen, mm åt vänster (negativt åt
 * höger). Förskjutningen flyttar referenslinjen utåt från mitten när den
 * ligger på en kant (negativt mot mitten), och åt vänster när den ligger i
 * mitten.
 */
export function centerShift(side: RefSide | undefined, offset: number | undefined, width: number): number {
  const o = offset ?? 0;
  if (side === 'left') return -(width / 2 + o);
  if (side === 'right') return width / 2 + o;
  return -o;
}

type P = readonly [number, number];

/** Var en punkt ligger mot en polylinje: avståndet, punkten närmast, sträckan längs linjen dit och avståndet åt vänster (negativt åt höger). */
export interface Along {
  d: number;
  at: Vec2;
  s: number;
  lat: number;
}

/** Linjens längd, mm. */
export function lineLength(pts: readonly P[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}

export function along(pts: readonly P[], x: number, y: number): Along {
  let best: Along = { d: Infinity, at: [pts[0][0], pts[0][1]], s: 0, lat: 0 };
  let s0 = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy);
    if (l < 1e-9) continue;
    const f = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (l * l)));
    const px = a[0] + dx * f;
    const py = a[1] + dy * f;
    const d = Math.hypot(x - px, y - py);
    if (d < best.d - 1e-9) best = { d, at: [px, py], s: s0 + l * f, lat: (dx * (y - a[1]) - dy * (x - a[0])) / l };
    s0 += l;
  }
  return best;
}

/** En remsa med bredden `w` kring linjen, med räta ändar och gering i hörnen. Moturs: höger sida framåt, vänster bakåt. */
export function stripRing(pts: readonly P[], w: number): Vec2[] {
  return [...offsetLine(pts, -w / 2), ...offsetLine(pts, w / 2).reverse()];
}

/** Linjen förskjuten `d` mm åt vänster (negativt åt höger), med gering i hörnen (högst fyra gånger, som ett spetsigt hörn). */
export function offsetLine(pts: readonly P[], d: number): Vec2[] {
  const n = pts.length;
  const normal = (i: number): Vec2 => {
    const a = pts[i];
    const b = pts[i + 1];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  };
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    let m: Vec2;
    let k = 1;
    if (i === 0) m = normal(0);
    else if (i === n - 1) m = normal(n - 2);
    else {
      const a = normal(i - 1);
      const b = normal(i);
      const sx = a[0] + b[0];
      const sy = a[1] + b[1];
      const l = Math.hypot(sx, sy);
      m = l < 1e-6 ? a : [sx / l, sy / l];
      // Geringen blir längre i hörnen, högst fyra gånger (som ett spetsigt hörn).
      k = Math.min(4, 1 / Math.max(0.25, m[0] * a[0] + m[1] * a[1]));
    }
    out.push([pts[i][0] + m[0] * d * k, pts[i][1] + m[1] * d * k]);
  }
  return out;
}

/** Murens segment som stoppar slänterna. */
export function barriersOf(pts: readonly P[]): Barrier[] {
  const out: Barrier[] = [];
  for (let i = 1; i < pts.length; i++) out.push([pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]]);
  return out;
}

function boxOf(pts: readonly P[], pad: number): [number, number, number, number] {
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
}

/** Höjden längs linjen: från `h0` i början till `h1` i slutet, rakt efter sträckan. */
const heightAlong = (h0: number, h1: number, total: number) => (s: number) => (total > 0 ? h0 + ((h1 - h0) * s) / total : h0);

/**
 * En brytlinje (höjd i början och slutet) eller en höjdpunkt (en punkt):
 * marken låses där och tonas mot den inom `blend`.
 */
export function lockShape(id: string, pts: readonly P[], h0: number, h1: number, blend: number): GroundShape {
  const total = lineLength(pts);
  const hs = heightAlong(h0, h1, total);
  const one = pts.length < 2;
  return {
    id,
    cut: true,
    fill: true,
    slope: null,
    blend,
    box: boxOf(pts, 0),
    hMin: Math.min(h0, h1),
    hMax: Math.max(h0, h1),
    probe(x, y, cell) {
      if (one) {
        const d = Math.hypot(x - pts[0][0], y - pts[0][1]);
        return d < cell / 2 ? { inside: true, d: 0, h: h0 } : { inside: false, d, h: h0, at: pts[0] };
      }
      const a = along(pts, x, y);
      const h = hs(a.s);
      return a.d < cell / 2 ? { inside: true, d: 0, h } : { inside: false, d: a.d, h, at: a.at };
    },
  };
}
