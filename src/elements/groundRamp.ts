import type { GroundShape } from '../core/ground';
import type { GroundDefaults } from '../core/site';
import type { Vec2 } from '../repr/primitives';
import { along, centerShift, flatPoints, hasArcs, offsetArcLine, PATH_WIDTH, tidyBulges, type ArcLine, type RefSide } from './groundLines';
import { rampProfile, rampRuns } from './rampProfile';

/**
 * Rampens referenslinje (0.10.18). Referenslinjen styr lutningen: höjden
 * räknas längs den, mellan punkterna som har en höjd (ändarna alltid, och
 * de punkter däremellan som fått en). Sidorna styr utbredningen i planen:
 * de följer referenslinjen med bredden (som före 0.10.18) tills någon av dem
 * ritats om, och lever sedan sitt eget liv, så att bredden kan variera längs
 * rampen. Varje sida möter marken med slänt eller stödmur för sig; ändarna
 * med kanternas inställning.
 *
 * Bågar (0.10.19): referenslinjen och sidorna kan ha bågar (`bulges`,
 * `leftBulges`, `rightBulges`). Sträckan längs referenslinjen räknas längs
 * bågen; sidorna följer den koncentriskt.
 *
 * Mjuka övergångar (0.10.19): i stället för en skarp brytning i höjd
 * (betong- eller stenrampens vilplan) kan rampen få en vertikal kurva med
 * en radie i början, i slutet och i punkterna med höjd (gångvägens
 * utjämnade övergång), för hela rampen eller för varje punkt för sig.
 *
 * Ren geometri; ritningen ligger i `groundPlan.ts`. Höjdprofilen ligger i
 * `rampProfile.ts` och ändringarna i referenslinjen (förlängning, baklänges,
 * dockning, omräknade höjder) i `rampEdits.ts` (0.10.21.1).
 */

type P = readonly [number, number];

/** Övergången i en punkt med höjd: mjuk (med radie, mm) eller skarp. */
export interface EasePoint {
  ease: boolean;
  radius?: number;
}

/** Det som behövs av markobjektets parametrar. */
export interface RampParams {
  line?: [number, number][];
  /** Referenslinjens bågar (0.10.19): pilhöjd per kant, som 2D-formens. */
  bulges?: number[];
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
  leftBulges?: number[];
  rightBulges?: number[];
  /** Ändarnas kant, och sidornas när de inte har en egen. */
  edge?: 'slope' | 'wall';
  leftEdge?: 'slope' | 'wall';
  rightEdge?: 'slope' | 'wall';
  crossFall?: number;
  /** Mjuka övergångar i höjd (0.10.19) i början, slutet och punkterna med höjd; utelämnad = skarpa. */
  ease?: boolean;
  /** Övergångarnas vertikala radie, mm; utelämnad = projektets förval. */
  easeRadius?: number;
  /** Övergången i enskilda punkter (en per punkt i `line`, null = som rampen). */
  eases?: (EasePoint | null)[];
}

/** En punkt på referenslinjen med höjd: index, sträckan längs linjen och höjden (mm från ±0). */
export interface RampLevel {
  i: number;
  s: number;
  at: Vec2;
  h: number;
}

/**
 * En sträcka mellan två punkter med höjd och dess lutning 1:N (Infinity när
 * den är plan). Med mjuka övergångar i ändarna (`la`, `lb`: kurvornas längd
 * från a och in mot b) är det den raka delens lutning, som är brantare än
 * höjdskillnaden över hela sträckan ger.
 */
export interface RampRun {
  a: RampLevel;
  b: RampLevel;
  ratio: number;
  /** Lutningen som tal (stigning per längd), med tecken. */
  grade: number;
  la: number;
  lb: number;
}

/** Hur en sida möter marken. */
export function sideEdge(p: RampParams, side: 'left' | 'right'): 'slope' | 'wall' {
  return (side === 'left' ? p.leftEdge : p.rightEdge) ?? p.edge ?? 'slope';
}

/** Referenslinjen med bågarna som raka bitar. */
export const refPoints = (p: RampParams): Vec2[] => flatPoints(p.line, p.bulges);

/** Sidorna som de följer referenslinjen med bredden, mitten där `refSide` och `refOffset` säger (med bågarna som raka bitar). */
export function derivedSides(ref: readonly P[], p: RampParams): { left: Vec2[]; right: Vec2[] } {
  const l = derivedSideLines(ref, p);
  return { left: flatPoints(l.left.points, l.left.bulges), right: flatPoints(l.right.points, l.right.bulges) };
}

/** Sidorna som linjer med bågar när de följer referenslinjen: koncentriska med dess bågar. */
function derivedSideLines(ref: readonly P[], p: RampParams): { left: ArcLine; right: ArcLine } {
  const w = Math.max(100, p.width ?? PATH_WIDTH);
  const c = centerShift(p.refSide, p.refOffset, w);
  return { left: offsetArcLine(ref, p.bulges, c + w / 2), right: offsetArcLine(ref, p.bulges, c - w / 2) };
}

/** Rampens sidor som linjer med bågar (0.10.19): de ritade, eller de som följer referenslinjen. Det Modifiera och greppen ser. */
export function rampSideLines(p: RampParams): { left: ArcLine; right: ArcLine } {
  const ref = (p.line ?? []) as P[];
  const own = (q?: [number, number][], b?: number[]): ArcLine | null => (q && q.length >= 2 ? { points: q.map((v): [number, number] => [v[0], v[1]]), ...(hasArcs(b) ? { bulges: tidyBulges(b, q.length) } : {}) } : null);
  const l = own(p.left, p.leftBulges);
  const r = own(p.right, p.rightBulges);
  if (l && r) return { left: l, right: r };
  const d = ref.length >= 2 ? derivedSideLines(ref, p) : { left: { points: [] }, right: { points: [] } };
  return { left: l ?? d.left, right: r ?? d.right };
}

/** Rampens sidor som punkter, med bågarna som raka bitar: de ritade, eller de som följer referenslinjen. */
export function rampSides(p: RampParams): { left: Vec2[]; right: Vec2[] } {
  const l = rampSideLines(p);
  return { left: flatPoints(l.left.points, l.left.bulges), right: flatPoints(l.right.points, l.right.bulges) };
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
 * Rampens form för den färdiga marken: höjden längs referenslinjen (med de
 * mjuka övergångarna), med tvärfallet (1:N, positivt faller åt höger) kring
 * referenslinjen. Utanför en sida som är stödmur är marken orörd.
 */
export function rampShape(id: string, p: RampParams, slope: number, sides = rampSides(p), def?: Pick<GroundDefaults, 'easeRadius'>): { shape: GroundShape; ring: Vec2[]; wall: boolean[] } {
  const ref = refPoints(p);
  const prof = rampProfile(p, def);
  const { ring, wall } = rampRing(p, sides);
  const tilt = p.crossFall ? 1 / p.crossFall : 0;
  const hAt = (x: number, y: number) => {
    const a = along(ref, x, y);
    return prof.hAt(a.s) + a.lat * tilt;
  };
  let reach = 0;
  for (const q of ring) reach = Math.max(reach, along(ref, q[0], q[1]).d);
  const side = Math.abs(tilt) * reach;
  const hs = prof.levels.map((l) => l.h);
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
 * mellan två punkter med höjd är ett vilplan. Med `p` räknas de mjuka
 * övergångarna in.
 */
export function rampWarnings(levels: readonly RampLevel[], max: number, def: GroundDefaults, p?: RampParams): string[] {
  const out = new Set<string>();
  for (const r of rampRuns(levels, p, def)) {
    if (r.ratio < max - 1e-6) out.add(`Brantare än 1:${max.toLocaleString('sv-SE')}`);
    if (r.ratio < def.walkMax - 1e-6 && Math.abs(r.b.h - r.a.h) > def.landingRise + 0.5)
      out.add(`Höjdskillnaden är mer än ${(def.landingRise / 1000).toLocaleString('sv-SE')} m: lägg ett vilplan (en plan sträcka mellan två punkter med höjd)`);
  }
  return [...out];
}

/** Den brantaste sträckan som 1:N (Infinity när rampen är plan). */
export function steepest(runs: readonly RampRun[]): number {
  return Math.min(Infinity, ...runs.map((r) => r.ratio));
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
