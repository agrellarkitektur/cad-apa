import type { Barrier, GroundShape } from '../core/ground';
import type { Vec2 } from '../repr/primitives';

/**
 * Markobjekt längs en linje (0.10.5): ramp/väg (en referenslinje med
 * bredd; en sort sedan 0.10.7), brytlinje och höjdpunkt (låser marken och
 * tonar den runt omkring), och stödmuren (en linje som slänterna inte går
 * över). Ren geometri; ritningen ligger i `groundPlan.ts`.
 */

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
