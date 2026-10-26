import type { Barrier, GroundShape } from '../core/ground';
import type { GroundDefaults } from '../core/site';
import type { Vec2 } from '../repr/primitives';

/**
 * Markobjekt längs en linje (0.10.5): ramp, gångväg och infart (en mittlinje
 * med bredd), brytlinje och höjdpunkt (låser marken och tonar den runt
 * omkring), och stödmuren (en linje som slänterna inte går över). Ren
 * geometri; ritningen ligger i `ground.ts`.
 */

/** Vägens sort: ramp, gångväg eller infart. */
export type PathKind = 'ramp' | 'walk' | 'drive';

/** Förvald bredd per sort, mm: rampens fria bredd (rekommenderad 1 500), en gångväg och en infart. */
export const PATH_WIDTH: Record<PathKind, number> = { ramp: 1500, walk: 1200, drive: 3000 };

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

/** En remsa med bredden `w` kring linjen, med räta ändar och gering i hörnen. Moturs. */
export function stripRing(pts: readonly P[], w: number): Vec2[] {
  const h = w / 2;
  const n = pts.length;
  const normal = (i: number): Vec2 => {
    const a = pts[i];
    const b = pts[i + 1];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  };
  const left: Vec2[] = [];
  const right: Vec2[] = [];
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
    left.push([pts[i][0] + m[0] * h * k, pts[i][1] + m[1] * h * k]);
    right.push([pts[i][0] - m[0] * h * k, pts[i][1] - m[1] * h * k]);
  }
  return [...right, ...left.reverse()];
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
 * Vägens form: en yta med bredden kring mittlinjen, med höjden längs linjen
 * och tvärfallet (1:N, positivt faller åt höger, negativt åt vänster).
 * Sidorna och ändarna möter marken med slänt (`slope`) eller mur (null).
 */
export function pathShape(id: string, pts: readonly P[], w: number, h0: number, h1: number, cross: number, slope: number | null): { shape: GroundShape; ring: Vec2[] } {
  const ring = stripRing(pts, w);
  const total = lineLength(pts);
  const hs = heightAlong(h0, h1, total);
  const tilt = cross ? 1 / cross : 0;
  const hAt = (x: number, y: number) => {
    const a = along(pts, x, y);
    return hs(a.s) + Math.max(-w / 2, Math.min(w / 2, a.lat)) * tilt;
  };
  const side = (Math.abs(tilt) * w) / 2;
  const shape: GroundShape = {
    id,
    cut: true,
    fill: true,
    slope,
    box: boxOf(ring, 0),
    hMin: Math.min(h0, h1) - side,
    hMax: Math.max(h0, h1) + side,
    probe(x, y) {
      const e = nearestOnRing(ring, x, y);
      if (e.inside) return { inside: true, d: 0, h: hAt(x, y) };
      return { inside: false, d: e.d, h: hAt(e.at[0], e.at[1]), at: e.at };
    },
  };
  return { shape, ring };
}

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

/** Avståndet till en rings kant och om punkten ligger inuti. */
function nearestOnRing(ring: readonly Vec2[], x: number, y: number): { inside: boolean; d: number; at: Vec2 } {
  let inside = false;
  let best = Infinity;
  let at: Vec2 = [x, y];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    const dx = xi - xj;
    const dy = yi - yj;
    const l2 = dx * dx + dy * dy;
    const f = l2 > 0 ? Math.max(0, Math.min(1, ((x - xj) * dx + (y - yj) * dy) / l2)) : 0;
    const px = xj + dx * f;
    const py = yj + dy * f;
    const d = Math.hypot(x - px, y - py);
    if (d < best) {
      best = d;
      at = [px, py];
    }
  }
  return { inside, d: best, at };
}

/** Rampens eller gångvägens lutning som 1:N (Infinity när den är plan). */
export function pathRatio(pts: readonly P[], h0: number, h1: number): number {
  const rise = Math.abs(h1 - h0);
  return rise < 1 ? Infinity : lineLength(pts) / rise;
}

/** Varningarna för en ramp eller gångväg: för brant, eller för hög utan vilplan. */
export function pathWarnings(kind: PathKind, pts: readonly P[], h0: number, h1: number, def: GroundDefaults): string[] {
  if (kind === 'drive') return [];
  const out: string[] = [];
  const n = pathRatio(pts, h0, h1);
  const max = kind === 'ramp' ? def.rampMax : def.walkMax;
  if (n < max - 1e-6) out.push(`Brantare än 1:${max.toLocaleString('sv-SE')}`);
  if (kind === 'ramp' && Math.abs(h1 - h0) > def.landingRise + 0.5) out.push(`Höjdskillnaden är mer än ${(def.landingRise / 1000).toLocaleString('sv-SE')} m: dela rampen med ett vilplan`);
  return out;
}
