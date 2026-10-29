import type { Vec2 } from '../repr/primitives';
import { bulgeThrough, STRAIGHT } from './arc';
import { signedArea, type Chain } from './chains';
import { cross, dist, dot, sub } from './vec';

/**
 * Bågar ur kedjor (0.10.23): en kedja av korta raka bitar som ligger på en
 * cirkel blir en båge med pilhöjd, som 2D-formens, markobjektens och
 * väggarnas. Smartspöt följer det som ritats, och bågar ritas som korta
 * raka bitar; här hittas de igen.
 */
export interface ArcChain {
  points: Vec2[];
  /** Pilhöjden per kant (0 = rak), en per kant: n − 1 för en öppen kedja, n för en sluten. */
  bulges: number[];
  closed: boolean;
}

/** Bitarna i en båge viker högst så här mycket var (bågar ritas med 4° per bit, små med färre bitar). */
const MAX_TURN = (25 * Math.PI) / 180;
/** En båge har minst så här många bitar; två bitar kan lika gärna vara ett hörn. */
const MIN_EDGES = 3;
/** Bitarna i en båge är ungefär lika långa (högst så här många gånger längre än den kortaste). */
const MAX_RATIO = 3;

const turnAt = (a: Vec2, b: Vec2, c: Vec2): number => {
  const u = sub(b, a);
  const v = sub(c, b);
  return Math.atan2(cross(u, v), dot(u, v));
};

/** Cirkeln genom tre punkter, eller null om de ligger på en linje. */
function circle(a: Vec2, b: Vec2, c: Vec2): { c: Vec2; r: number } | null {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = a[0] * a[0] + a[1] * a[1];
  const b2 = b[0] * b[0] + b[1] * b[1];
  const c2 = c[0] * c[0] + c[1] * c[1];
  const x = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
  const y = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
  return { c: [x, y], r: Math.hypot(a[0] - x, a[1] - y) };
}

/** Om punkterna i..j ligger på samma cirkel; svarar med pilhöjden från i till j, annars null. */
function arcOver(pts: readonly Vec2[], i: number, j: number, tol: number): number | null {
  const m = (i + j) >> 1;
  const k = circle(pts[i], pts[m], pts[j]);
  if (!k) return null;
  const t = tol + k.r * 1e-4;
  for (let q = i; q <= j; q++) if (Math.abs(dist(pts[q], k.c) - k.r) > t) return null;
  const b = bulgeThrough(pts[i], pts[j], pts[m]);
  return Math.abs(b) >= STRAIGHT ? b : null;
}

/** Om bitarna i..j (punkterna) kan vara en båge: små vridningar åt samma håll och ungefär lika långa bitar. */
function smooth(pts: readonly Vec2[], i: number, j: number): boolean {
  let sign = 0;
  let lo = Infinity;
  let hi = 0;
  for (let q = i; q < j; q++) {
    const l = dist(pts[q], pts[q + 1]);
    lo = Math.min(lo, l);
    hi = Math.max(hi, l);
    if (q > i) {
      const t = turnAt(pts[q - 1], pts[q], pts[q + 1]);
      if (Math.abs(t) > MAX_TURN || Math.abs(t) < 1e-6) return false;
      const s = Math.sign(t);
      if (sign && s !== sign) return false;
      sign = s;
    }
  }
  return lo > 0 && hi <= lo * MAX_RATIO;
}

/** Bågarna i en öppen följd av punkter: de längsta bågarna först, från början. */
function fitOpen(pts: readonly Vec2[], tol: number): { points: Vec2[]; bulges: number[] } {
  const points: Vec2[] = [pts[0]];
  const bulges: number[] = [];
  let i = 0;
  while (i < pts.length - 1) {
    let best = -1;
    let bulge = 0;
    for (let j = i + MIN_EDGES; j < pts.length; j++) {
      if (!smooth(pts, i, j)) break;
      const b = arcOver(pts, i, j, tol);
      if (b === null) break;
      best = j;
      bulge = b;
    }
    if (best < 0) {
      points.push(pts[i + 1]);
      bulges.push(0);
      i++;
    } else {
      points.push(pts[best]);
      bulges.push(Math.round(bulge * 10) / 10);
      i = best;
    }
  }
  return { points, bulges };
}

/**
 * Kedjan med bågarna hittade: följder av minst tre korta bitar som viker
 * lika åt samma håll och ligger på en cirkel (inom `tol` mm) blir en kant
 * med pilhöjd. En sluten kedja utan hörn som ligger på en cirkel blir två
 * halvcirklar.
 */
export function fitArcs(c: Chain, tol = 1): ArcChain {
  const pts = c.points;
  const n = pts.length;
  if (n < MIN_EDGES + 1) return { points: [...pts], bulges: new Array(Math.max(0, c.closed ? n : n - 1)).fill(0), closed: c.closed };
  if (!c.closed) return { ...fitOpen(pts, tol), closed: false };
  // Sluten: börja i ett hörn, så att ingen båge delas där kedjan börjar.
  let start = -1;
  for (let i = 0; i < n && start < 0; i++) if (Math.abs(turnAt(pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n])) > MAX_TURN) start = i;
  if (start < 0) {
    // Inga hörn: en hel cirkel, eller en jämn kurva som inte är en cirkel.
    const half = n >> 1;
    const k = circle(pts[0], pts[Math.floor(n / 3)], pts[Math.floor((2 * n) / 3)]);
    if (k && pts.every((q) => Math.abs(dist(q, k.c) - k.r) <= tol + k.r * 1e-4)) {
      const b1 = bulgeThrough(pts[0], pts[half], pts[half >> 1]);
      const b2 = bulgeThrough(pts[half], pts[0], pts[(half + n) >> 1]);
      return { points: [pts[0], pts[half]], bulges: [Math.round(b1 * 10) / 10, Math.round(b2 * 10) / 10], closed: true };
    }
    // Avrundade hörn utan skarpa: börja i den längsta kanten, som är rak.
    let longest = 0;
    for (let i = 1; i < n; i++) if (dist(pts[i], pts[(i + 1) % n]) > dist(pts[longest], pts[(longest + 1) % n])) longest = i;
    start = longest;
  }
  const ring = [...pts.slice(start), ...pts.slice(0, start), pts[start]];
  const r = fitOpen(ring, tol);
  r.points.pop();
  return { points: r.points, bulges: r.bulges, closed: true };
}

/** Om kedjan fick någon båge. */
export const hasBulges = (b: readonly number[]): boolean => b.some((x) => Math.abs(x) >= STRAIGHT);

/** Kedjan baklänges: punkterna i omvänd ordning och bågarna åt andra hållet (en sluten kedja behåller sin första punkt). */
export function reversedChain(c: ArcChain): ArcChain {
  if (!c.closed) return { points: [...c.points].reverse(), bulges: [...c.bulges].reverse().map((b) => (b ? -b : 0)), closed: false };
  const n = c.points.length;
  // Kant k i den vända går från punkt n − k till n − k − 1: den gamla kanten n − k − 1 baklänges.
  return { points: c.points.map((_, k) => c.points[(n - k) % n]), bulges: c.bulges.map((_, k) => c.bulges[(2 * n - k - 1) % n] ? -c.bulges[(2 * n - k - 1) % n] : 0), closed: true };
}

/** Kedjan moturs: vänd om ringen (kedjans punkter utan bågar) går medurs. */
export const ccw = (ring: readonly Vec2[], chain: ArcChain): ArcChain => (signedArea(ring) < 0 ? reversedChain(chain) : chain);
