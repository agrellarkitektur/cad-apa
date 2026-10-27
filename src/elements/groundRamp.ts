import type { GroundShape } from '../core/ground';
import type { GroundDefaults } from '../core/site';
import type { Vec2 } from '../repr/primitives';
import { along, centerShift, lineLength, offsetLine, PATH_WIDTH, type RefSide } from './groundLines';

/**
 * Rampens referenslinje (0.10.18). Referenslinjen styr lutningen: höjden
 * räknas längs den, mellan punkterna som har en höjd (ändarna alltid, och
 * de punkter däremellan som fått en). Sidorna styr utbredningen i planen:
 * de följer referenslinjen med bredden (som före 0.10.18) tills någon av dem
 * ritats om, och lever sedan sitt eget liv, så att bredden kan variera längs
 * rampen. Varje sida möter marken med slänt eller stödmur för sig; ändarna
 * med kanternas inställning.
 *
 * Ren geometri; ritningen ligger i `groundPlan.ts`.
 */

type P = readonly [number, number];

/** Det som behövs av markobjektets parametrar. */
export interface RampParams {
  line?: [number, number][];
  height?: number;
  endHeight?: number;
  /** Höjden i referenslinjens punkter mellan ändarna, en per punkt (null = ingen; ändarna gäller `height` och `endHeight`). */
  levels?: (number | null)[];
  width?: number;
  refSide?: RefSide;
  refOffset?: number;
  /** Sidorna som ritats om (vänster och höger sett i linjens riktning); utelämnade följer referenslinjen. */
  left?: [number, number][];
  right?: [number, number][];
  /** Ändarnas kant, och sidornas när de inte har en egen. */
  edge?: 'slope' | 'wall';
  leftEdge?: 'slope' | 'wall';
  rightEdge?: 'slope' | 'wall';
  crossFall?: number;
}

/** En punkt på referenslinjen med höjd: index, sträckan längs linjen och höjden (mm från ±0). */
export interface RampLevel {
  i: number;
  s: number;
  at: Vec2;
  h: number;
}

/** En sträcka mellan två punkter med höjd, och dess lutning 1:N (Infinity när den är plan). */
export interface RampRun {
  a: RampLevel;
  b: RampLevel;
  ratio: number;
}

/** Hur en sida möter marken. */
export function sideEdge(p: RampParams, side: 'left' | 'right'): 'slope' | 'wall' {
  return (side === 'left' ? p.leftEdge : p.rightEdge) ?? p.edge ?? 'slope';
}

/** Referenslinjens punkter med höjd, i ordning längs linjen. */
export function rampLevels(p: RampParams): RampLevel[] {
  const ref = (p.line ?? []) as P[];
  const h0 = p.height ?? 0;
  const h1 = p.endHeight ?? h0;
  const out: RampLevel[] = [];
  let s = 0;
  for (let i = 0; i < ref.length; i++) {
    if (i > 0) s += Math.hypot(ref[i][0] - ref[i - 1][0], ref[i][1] - ref[i - 1][1]);
    const own = p.levels?.[i];
    const h = i === 0 ? h0 : i === ref.length - 1 ? h1 : typeof own === 'number' ? own : null;
    if (h !== null) out.push({ i, s, at: [ref[i][0], ref[i][1]], h });
  }
  return out;
}

/** Sträckorna mellan punkterna med höjd. */
export function rampRuns(levels: readonly RampLevel[]): RampRun[] {
  const out: RampRun[] = [];
  for (let k = 1; k < levels.length; k++) {
    const a = levels[k - 1];
    const b = levels[k];
    const rise = Math.abs(b.h - a.h);
    out.push({ a, b, ratio: rise < 1 ? Infinity : (b.s - a.s) / rise });
  }
  return out;
}

/** Höjden längs referenslinjen, rakt mellan punkterna med höjd. */
export function heightAtS(levels: readonly RampLevel[], s: number): number {
  if (!levels.length) return 0;
  if (s <= levels[0].s) return levels[0].h;
  for (let k = 1; k < levels.length; k++) {
    const a = levels[k - 1];
    const b = levels[k];
    if (s <= b.s) return b.s - a.s > 1e-9 ? a.h + ((b.h - a.h) * (s - a.s)) / (b.s - a.s) : b.h;
  }
  return levels[levels.length - 1].h;
}

/** Sidorna som de följer referenslinjen med bredden, mitten där `refSide` och `refOffset` säger. */
export function derivedSides(ref: readonly P[], p: RampParams): { left: Vec2[]; right: Vec2[] } {
  const w = Math.max(100, p.width ?? PATH_WIDTH);
  const c = centerShift(p.refSide, p.refOffset, w);
  return { left: offsetLine(ref, c + w / 2), right: offsetLine(ref, c - w / 2) };
}

/** Rampens sidor: de ritade, eller de som följer referenslinjen. */
export function rampSides(p: RampParams): { left: Vec2[]; right: Vec2[] } {
  const ref = (p.line ?? []) as P[];
  const own = (q?: [number, number][]) => (q && q.length >= 2 ? q.map((v): Vec2 => [v[0], v[1]]) : null);
  const l = own(p.left);
  const r = own(p.right);
  if (l && r) return { left: l, right: r };
  const d = ref.length >= 2 ? derivedSides(ref, p) : { left: [], right: [] };
  return { left: l ?? d.left, right: r ?? d.right };
}

/**
 * Rampens kontur och dess kanter: höger sida framåt, slutets tvärlinje,
 * vänster sida bakåt och början; `wall` för varje kant i ringen (kant i går
 * från punkt i till nästa) om den är en stödmur.
 */
export function rampRing(p: RampParams, sides = rampSides(p)): { ring: Vec2[]; wall: boolean[] } {
  const { left, right } = sides;
  const ring = [...right, ...[...left].reverse()];
  const lw = sideEdge(p, 'left') === 'wall';
  const rw = sideEdge(p, 'right') === 'wall';
  const ew = (p.edge ?? 'slope') === 'wall';
  const wall = ring.map((_, i) => (i < right.length - 1 ? rw : i === right.length - 1 ? ew : i < ring.length - 1 ? lw : ew));
  return { ring, wall };
}

/**
 * Rampens form för den färdiga marken: höjden längs referenslinjen, med
 * tvärfallet (1:N, positivt faller åt höger) kring referenslinjen. Utanför
 * en sida som är stödmur är marken orörd.
 */
export function rampShape(id: string, p: RampParams, slope: number, sides = rampSides(p)): { shape: GroundShape; ring: Vec2[]; wall: boolean[] } {
  const ref = (p.line ?? []) as P[];
  const levels = rampLevels(p);
  const { ring, wall } = rampRing(p, sides);
  const tilt = p.crossFall ? 1 / p.crossFall : 0;
  const hAt = (x: number, y: number) => {
    const a = along(ref, x, y);
    return heightAtS(levels, a.s) + a.lat * tilt;
  };
  let reach = 0;
  for (const q of ring) reach = Math.max(reach, along(ref, q[0], q[1]).d);
  const side = Math.abs(tilt) * reach;
  const hs = levels.map((l) => l.h);
  const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const q of ring) {
    box[0] = Math.min(box[0], q[0]);
    box[1] = Math.min(box[1], q[1]);
    box[2] = Math.max(box[2], q[0]);
    box[3] = Math.max(box[3], q[1]);
  }
  const allWall = wall.every(Boolean);
  const shape: GroundShape = {
    id,
    cut: true,
    fill: true,
    slope: allWall ? null : slope,
    box,
    hMin: Math.min(...hs) - side,
    hMax: Math.max(...hs) + side,
    probe(x, y) {
      const e = nearestRingEdge(ring, x, y);
      if (e.inside) return { inside: true, d: 0, h: hAt(x, y) };
      return { inside: false, d: e.d, h: hAt(e.at[0], e.at[1]), at: e.at, ...(wall[e.edge] ? { wall: true } : {}) };
    },
  };
  return { shape, ring, wall };
}

/** Avståndet till ringens närmaste kant, punkten där och kantens nummer, och om punkten ligger inuti. */
function nearestRingEdge(ring: readonly Vec2[], x: number, y: number): { inside: boolean; d: number; at: Vec2; edge: number } {
  let inside = false;
  let best = Infinity;
  let at: Vec2 = [x, y];
  let edge = 0;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
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
      // Kanten från j till i är kant j.
      edge = j;
    }
  }
  return { inside, d: best, at, edge };
}

/**
 * Varningarna för en ramp eller väg (0.10.7, per sträcka sedan 0.10.18):
 * en sträcka brantare än gränsen (`max`, 1:N), eller brantare än en
 * gångväg (förval 1:20) och högre än ett vilplan tillåter. En plan sträcka
 * mellan två punkter med höjd är ett vilplan.
 */
export function rampWarnings(levels: readonly RampLevel[], max: number, def: GroundDefaults): string[] {
  const out = new Set<string>();
  for (const r of rampRuns(levels)) {
    if (r.ratio < max - 1e-6) out.add(`Brantare än 1:${max.toLocaleString('sv-SE')}`);
    if (r.ratio < def.walkMax - 1e-6 && Math.abs(r.b.h - r.a.h) > def.landingRise + 0.5)
      out.add(`Höjdskillnaden är mer än ${(def.landingRise / 1000).toLocaleString('sv-SE')} m: lägg ett vilplan (en plan sträcka mellan två punkter med höjd)`);
  }
  return [...out];
}

/** Den brantaste sträckan som 1:N (Infinity när rampen är plan). */
export function steepest(levels: readonly RampLevel[]): number {
  return Math.min(Infinity, ...rampRuns(levels).map((r) => r.ratio));
}

/**
 * Punkternas höjder när referenslinjens punkter ändrats: med lika många
 * punkter följer höjderna punkternas nummer (en punkt som flyttats behåller
 * sin höjd); annars punkterna som ligger kvar där de låg.
 */
export function remapLevels(before: readonly P[], after: readonly P[], levels: (number | null)[] | undefined): (number | null)[] | undefined {
  if (!levels?.some((v) => typeof v === 'number')) return undefined;
  const out: (number | null)[] = after.map(() => null);
  if (before.length === after.length) {
    for (let i = 1; i < after.length - 1; i++) out[i] = typeof levels[i] === 'number' ? levels[i] : null;
  } else {
    for (let i = 1; i < before.length - 1; i++) {
      const v = levels[i];
      if (typeof v !== 'number') continue;
      const k = after.findIndex((q, j) => j > 0 && j < after.length - 1 && Math.hypot(q[0] - before[i][0], q[1] - before[i][1]) < 1);
      if (k >= 0) out[k] = v;
    }
  }
  return tidyLevels(out);
}

/** Höjderna som parameter: utan tomma platser sist, utelämnade när ingen punkt har en. */
export function tidyLevels(levels: (number | null)[]): (number | null)[] | undefined {
  const out = [...levels];
  while (out.length && typeof out[out.length - 1] !== 'number') out.pop();
  return out.some((v) => typeof v === 'number') ? out : undefined;
}

/**
 * Rampen förlängd (0.10.18) med nya punkter i början eller slutet. Den
 * gamla änden behåller sin höjd som en punkt med höjd, och den nya änden
 * får höjden som rampens sista (eller första) sträcka ger, så att lutningen
 * fortsätter (avrundad till 10 mm). Ritade sidor förlängs lika långt från referenslinjen som de
 * låg vid den gamla änden.
 */
export function extendRamp(p: RampParams, atStart: boolean, added: readonly P[]): Partial<RampParams> {
  const ref = ((p.line ?? []) as P[]).map((q): [number, number] => [q[0], q[1]]);
  if (ref.length < 2 || !added.length) return {};
  const pts = added.map((q): [number, number] => [Math.round(q[0]), Math.round(q[1])]);
  const levels = rampLevels(p);
  // Höjden fortsätter med lutningen i rampens sista sträcka (första, från början).
  const run = atStart ? levels.slice(0, 2) : levels.slice(-2);
  const grade = run.length === 2 && run[1].s - run[0].s > 1 ? (run[1].h - run[0].h) / (run[1].s - run[0].s) : 0;
  const tail = atStart ? [ref[0], ...pts] : [ref[ref.length - 1], ...pts];
  const more = lineLength(tail);
  const oldEnd = atStart ? (p.height ?? 0) : (p.endHeight ?? p.height ?? 0);
  // Från början räknas lutningen bakåt, så höjden ändras åt andra hållet.
  const newH = Math.round((atStart ? oldEnd - grade * more : oldEnd + grade * more) / 10) * 10;
  const line = atStart ? [...[...pts].reverse(), ...ref] : [...ref, ...pts];
  const old = [...(p.levels ?? [])];
  while (old.length < ref.length) old.push(null);
  const lv = atStart ? [...pts.map(() => null), ...old] : [...old.slice(0, ref.length), ...pts.map(() => null)];
  const oldIdx = atStart ? pts.length : ref.length - 1;
  lv[oldIdx] = oldEnd;
  const patch: Partial<RampParams> = atStart ? { line, height: newH, levels: tidyLevels(lv) } : { line, endHeight: newH, levels: tidyLevels(lv) };
  for (const side of ['left', 'right'] as const) {
    const own = p[side];
    if (!own || own.length < 2) continue;
    const end = atStart ? own[0] : own[own.length - 1];
    // Sett längs den nya biten, som går bakåt från början.
    const lat = along(ref, end[0], end[1]).lat * (atStart ? -1 : 1);
    const ext = offsetLine(tail, lat).slice(1).map((q): [number, number] => [Math.round(q[0]), Math.round(q[1])]);
    patch[side] = atStart ? [...ext.reverse(), ...own] : [...own, ...ext];
  }
  return patch;
}

/**
 * Mitt på rampen vid sträckan `s` längs referenslinjen: halvvägs mellan
 * sidornas punkter närmast referenslinjens punkt där. Där pilen och
 * lutningen skrivs, också när referenslinjen ligger på en kant.
 */
export function middleAt(ref: readonly P[], sides: { left: readonly P[]; right: readonly P[] }, s: number): Vec2 {
  let rest = s;
  let q: Vec2 = [ref[ref.length - 1][0], ref[ref.length - 1][1]];
  for (let i = 1; i < ref.length; i++) {
    const l = Math.hypot(ref[i][0] - ref[i - 1][0], ref[i][1] - ref[i - 1][1]);
    if (l >= rest && l > 0) {
      q = [ref[i - 1][0] + ((ref[i][0] - ref[i - 1][0]) * rest) / l, ref[i - 1][1] + ((ref[i][1] - ref[i - 1][1]) * rest) / l];
      break;
    }
    rest -= l;
  }
  const a = along(sides.left, q[0], q[1]).at;
  const b = along(sides.right, q[0], q[1]).at;
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
