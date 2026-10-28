import type { GroundShape } from '../core/ground';
import type { GroundDefaults } from '../core/site';
import type { Vec2 } from '../repr/primitives';
import { along, centerShift, flatLine, flatPoints, hasArcs, lineLength, offsetArcLine, PATH_WIDTH, reversedBulges, tidyBulges, type ArcLine, type RefSide } from './groundLines';

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
 * Ren geometri; ritningen ligger i `groundPlan.ts`.
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

/** Referenslinjens punkter med höjd, i ordning längs linjen (sträckan längs bågarna). */
export function rampLevels(p: RampParams): RampLevel[] {
  const ref = (p.line ?? []) as P[];
  const h0 = p.height ?? 0;
  const h1 = p.endHeight ?? h0;
  const out: RampLevel[] = [];
  const flat = flatLine(ref, p.bulges);
  const cum = cumulative(flat.points);
  for (let i = 0; i < ref.length; i++) {
    const own = p.levels?.[i];
    const h = i === 0 ? h0 : i === ref.length - 1 ? h1 : typeof own === 'number' ? own : null;
    if (h !== null) out.push({ i, s: cum[flat.at[i]] ?? 0, at: [ref[i][0], ref[i][1]], h });
  }
  return out;
}

/** Sträckan fram till varje punkt. */
function cumulative(pts: readonly Vec2[]): number[] {
  const out = [0];
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return out;
}

/** Förvald vertikal radie för de mjuka övergångarna, mm (när projektet inte har något förval). */
export const EASE_RADIUS = 20000;

/** Övergångens radie i punkt i (mm), eller 0 när den är skarp. */
export function easeRadiusAt(p: RampParams, i: number, def?: Pick<GroundDefaults, 'easeRadius'>): number {
  const base = Math.max(100, p.easeRadius ?? def?.easeRadius ?? EASE_RADIUS);
  const own = p.eases?.[i];
  if (own) return own.ease ? Math.max(100, own.radius ?? base) : 0;
  return p.ease ? base : 0;
}

/**
 * Sträckorna mellan punkterna med höjd. Med `p` räknas de mjuka övergångarna
 * i ändarna in (den raka delens lutning); utan är lutningen rakt mellan
 * punkterna.
 */
export function rampRuns(levels: readonly RampLevel[], p?: RampParams, def?: Pick<GroundDefaults, 'easeRadius'>): RampRun[] {
  const out: RampRun[] = [];
  const last = levels.length - 1;
  for (let k = 1; k < levels.length; k++) {
    const a = levels[k - 1];
    const b = levels[k];
    const S = Math.max(1e-9, b.s - a.s);
    const dh = b.h - a.h;
    // Kurvan i början bara i rampens första punkt, i slutet bara i den sista.
    let ra = p && k - 1 === 0 ? easeRadiusAt(p, a.i, def) : 0;
    let rb = p && k === last ? easeRadiusAt(p, b.i, def) : 0;
    let grade = dh / S;
    const sum = ra + rb;
    if (sum > 0 && Math.abs(dh) >= 1) {
      // Två tangerande parabler (radien R) med en rak del emellan: h = g·S − g²·R/2.
      // Ryms de inte (S² < 2·R·|dh|) kortas radierna så att de precis gör det.
      const disc = S * S - 2 * sum * Math.abs(dh);
      if (disc < 0) {
        const f = (S * S) / (2 * sum * Math.abs(dh)) * 0.999;
        ra *= f;
        rb *= f;
      }
      const r = ra + rb;
      const g = (S - Math.sqrt(Math.max(0, S * S - 2 * r * Math.abs(dh)))) / r;
      grade = dh < 0 ? -g : g;
    }
    const la = ra * Math.abs(grade);
    const lb = rb * Math.abs(grade);
    out.push({ a, b, ratio: Math.abs(grade) < 1e-9 ? Infinity : 1 / Math.abs(grade), grade, la, lb });
  }
  return out;
}

/** Höjden längs referenslinjen, rakt mellan punkterna med höjd (utan övergångar). */
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

/** Rampens höjdprofil: punkterna med höjd, sträckorna och höjden längs referenslinjen. */
export interface RampProfile {
  levels: RampLevel[];
  runs: RampRun[];
  /** Den vertikala kurvans längd i varje punkt med höjd mellan ändarna (0 = skarp), efter punktens plats i `levels`. */
  curves: number[];
  hAt(s: number): number;
}

/**
 * Profilen (0.10.19): rakt mellan punkterna med höjd, med en parabel
 * (vertikal radie) i de punkter som har en mjuk övergång. I ändarna börjar
 * och slutar rampen då plant och den raka delen riktas om; i en punkt
 * däremellan ersätter kurvan brytningen, lika långt åt båda håll, och kortas
 * om den inte ryms på de raka delarna intill.
 */
export function rampProfile(p: RampParams, def?: Pick<GroundDefaults, 'easeRadius'>): RampProfile {
  const levels = rampLevels(p);
  const runs = rampRuns(levels, p, def);
  const curves = levels.map((l, k) => {
    if (k === 0 || k === levels.length - 1) return 0;
    const r = easeRadiusAt(p, l.i, def);
    if (!r) return 0;
    const g1 = runs[k - 1].grade;
    const g2 = runs[k].grade;
    const straight = (run: RampRun) => run.b.s - run.a.s - run.la - run.lb;
    return Math.max(0, Math.min(r * Math.abs(g2 - g1), straight(runs[k - 1]), straight(runs[k])));
  });
  const hAt = (s: number): number => {
    if (!levels.length) return 0;
    if (s <= levels[0].s) return levels[0].h;
    for (let k = 1; k < levels.length; k++) {
      const run = runs[k - 1];
      const { a, b } = run;
      if (s > b.s) continue;
      const S = b.s - a.s;
      if (S <= 1e-9) return b.h;
      const x = s - a.s;
      const g = run.grade;
      // Kurvan i a eller b när punkten ligger mellan ändarna.
      const ca = curves[k - 1];
      if (ca > 0 && x < ca / 2) return a.h + bend(runs[k - 2].grade, g, ca, x);
      const cb = curves[k];
      if (cb > 0 && S - x < cb / 2) return b.h + bend(g, runs[k].grade, cb, x - S);
      if (run.la > 0 && x < run.la) return a.h + (g * x * x) / (2 * run.la);
      if (run.lb > 0 && S - x < run.lb) return b.h - (g * (S - x) * (S - x)) / (2 * run.lb);
      return a.h + (g * run.la) / 2 + g * (x - run.la);
    }
    return levels[levels.length - 1].h;
  };
  return { levels, runs, curves, hAt };
}

/** Höjden över brytpunkten på en parabel som byter lutning från g1 till g2 över längden L, x räknat från punkten (−L/2 … L/2). */
function bend(g1: number, g2: number, L: number, x: number): number {
  const u = x + L / 2;
  return g1 * x + ((g2 - g1) * u * u) / (2 * L);
}

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
 * Punkternas höjder (och övergångar) när referenslinjens punkter ändrats:
 * med lika många punkter följer de punkternas nummer (en punkt som flyttats
 * behåller sin höjd); annars punkterna som ligger kvar där de låg, och en
 * punkt som försvunnit (ett avrundat hörn) ger sin höjd till den nya
 * punkten närmast.
 */
export function remapLevels(before: readonly P[], after: readonly P[], levels: (number | null)[] | undefined): (number | null)[] | undefined {
  if (!levels?.some((v) => typeof v === 'number')) return undefined;
  return tidyLevels(remapPerPoint(before, after, levels, (v) => typeof v === 'number'));
}

/** Som `remapLevels`, för övergångarna i punkterna; ändarna följer också med. */
export function remapEases(before: readonly P[], after: readonly P[], eases: (EasePoint | null)[] | undefined): (EasePoint | null)[] | undefined {
  if (!eases?.some(Boolean)) return undefined;
  return tidyEases(remapPerPoint(before, after, eases, Boolean, true));
}

function remapPerPoint<T>(before: readonly P[], after: readonly P[], values: readonly (T | null)[], has: (v: T | null | undefined) => boolean, ends = false): (T | null)[] {
  const out: (T | null)[] = after.map(() => null);
  const inner = (i: number, n: number) => ends || (i > 0 && i < n - 1);
  if (before.length === after.length) {
    for (let i = 0; i < after.length; i++) if (inner(i, after.length)) out[i] = has(values[i]) ? values[i]! : null;
    return out;
  }
  const taken = new Set<number>();
  for (let i = 0; i < before.length; i++) {
    const v = values[i];
    if (!has(v) || !inner(i, before.length)) continue;
    const k = after.findIndex((q, j) => inner(j, after.length) && !taken.has(j) && Math.hypot(q[0] - before[i][0], q[1] - before[i][1]) < 1);
    if (k >= 0) {
      out[k] = v!;
      taken.add(k);
    }
  }
  // Punkter som försvann (ett avrundat eller fasat hörn): höjden till den
  // nya punkten närmast, om den inte redan har en. En borttagen punkt ger
  // inget till grannarna, som fanns förut.
  const existed = (q: P) => before.some((b) => Math.hypot(q[0] - b[0], q[1] - b[1]) < 1);
  for (let i = 0; i < before.length; i++) {
    const v = values[i];
    if (!has(v) || !inner(i, before.length)) continue;
    if (after.some((q, j) => inner(j, after.length) && Math.hypot(q[0] - before[i][0], q[1] - before[i][1]) < 1)) continue;
    let best = -1;
    let bd = Infinity;
    after.forEach((q, j) => {
      if (!inner(j, after.length) || taken.has(j) || has(out[j]) || existed(q)) return;
      const d = Math.hypot(q[0] - before[i][0], q[1] - before[i][1]);
      if (d < bd) {
        bd = d;
        best = j;
      }
    });
    if (best >= 0) {
      out[best] = v!;
      taken.add(best);
    }
  }
  return out;
}

/** Höjderna som parameter: utan tomma platser sist, utelämnade när ingen punkt har en. */
export function tidyLevels(levels: (number | null)[]): (number | null)[] | undefined {
  const out = [...levels];
  while (out.length && typeof out[out.length - 1] !== 'number') out.pop();
  return out.some((v) => typeof v === 'number') ? out : undefined;
}

/** Övergångarna som parameter: utan tomma platser sist, utelämnade när ingen punkt har en egen. */
export function tidyEases(eases: (EasePoint | null | undefined)[]): (EasePoint | null)[] | undefined {
  const out = eases.map((e) => e ?? null);
  while (out.length && !out[out.length - 1]) out.pop();
  return out.some(Boolean) ? out : undefined;
}

/**
 * Rampen förlängd (0.10.18) med nya punkter i början eller slutet. Den
 * gamla änden behåller sin höjd som en punkt med höjd, och den nya änden
 * får höjden som rampens sista (eller första) sträcka ger, så att lutningen
 * fortsätter (avrundad till 10 mm). Ritade sidor förlängs lika långt från referenslinjen som de
 * låg vid den gamla änden. Bågarna sitter kvar på sina kanter, och de nya
 * kanterna kan ha bågar (`addedBulges`, en per ny punkt, 0.10.19).
 */
export function extendRamp(p: RampParams, atStart: boolean, added: readonly P[], addedBulges?: readonly number[]): Partial<RampParams> {
  const ref = ((p.line ?? []) as P[]).map((q): [number, number] => [q[0], q[1]]);
  if (ref.length < 2 || !added.length) return {};
  const pts = added.map((q): [number, number] => [Math.round(q[0]), Math.round(q[1])]);
  const tail = atStart ? [ref[0], ...pts] : [ref[ref.length - 1], ...pts];
  const tailBulges = Array.from({ length: pts.length }, (_, i) => Number(addedBulges?.[i]) || 0);
  const levels = rampLevels(p);
  // Höjden fortsätter med lutningen i rampens sista sträcka (första, från början).
  const run = atStart ? levels.slice(0, 2) : levels.slice(-2);
  const grade = run.length === 2 && run[1].s - run[0].s > 1 ? (run[1].h - run[0].h) / (run[1].s - run[0].s) : 0;
  const more = lineLength(flatPoints(tail, tailBulges));
  const oldEnd = atStart ? (p.height ?? 0) : (p.endHeight ?? p.height ?? 0);
  // Från början räknas lutningen bakåt, så höjden ändras åt andra hållet.
  const newH = Math.round((atStart ? oldEnd - grade * more : oldEnd + grade * more) / 10) * 10;
  const line = atStart ? [...[...pts].reverse(), ...ref] : [...ref, ...pts];
  const old = [...(p.levels ?? [])];
  while (old.length < ref.length) old.push(null);
  const lv = atStart ? [...pts.map(() => null), ...old] : [...old.slice(0, ref.length), ...pts.map(() => null)];
  const oldIdx = atStart ? pts.length : ref.length - 1;
  lv[oldIdx] = oldEnd;
  const oldEases = [...(p.eases ?? [])];
  while (oldEases.length < ref.length) oldEases.push(null);
  const es = atStart ? [...pts.map(() => null), ...oldEases] : [...oldEases.slice(0, ref.length), ...pts.map(() => null)];
  const patch: Partial<RampParams> = atStart ? { line, height: newH, levels: tidyLevels(lv) } : { line, endHeight: newH, levels: tidyLevels(lv) };
  if (p.eases) patch.eases = tidyEases(es);
  const bulges = joinedBulges(p.bulges, ref.length, tailBulges, atStart);
  if (bulges || p.bulges) patch.bulges = bulges;
  const flatRef = refPoints(p);
  for (const side of ['left', 'right'] as const) {
    const own = p[side];
    if (!own || own.length < 2) continue;
    const end = atStart ? own[0] : own[own.length - 1];
    // Sett längs den nya biten, som går bakåt från början.
    const lat = along(flatRef, end[0], end[1]).lat * (atStart ? -1 : 1);
    const off = offsetArcLine(tail, tailBulges, lat);
    const ext = off.points.slice(1).map((q): [number, number] => [Math.round(q[0]), Math.round(q[1])]);
    patch[side] = atStart ? [...ext.reverse(), ...own] : [...own, ...ext];
    const key = side === 'left' ? 'leftBulges' : 'rightBulges';
    const sb = joinedBulges(p[key], own.length, Array.from({ length: ext.length }, (_, i) => Number(off.bulges?.[i]) || 0), atStart);
    if (sb || p[key]) patch[key] = sb;
  }
  return patch;
}

/** Pilhöjderna för linjen med en bit (`tailBulges`, kanterna från den gamla änden utåt) lagd till i början eller slutet. */
function joinedBulges(bulges: readonly number[] | undefined, n: number, tailBulges: readonly number[], atStart: boolean): number[] | undefined {
  const full = Array.from({ length: n - 1 }, (_, i) => Number(bulges?.[i]) || 0);
  // I början ligger den nya biten baklänges: kanterna i omvänd ordning och åt andra hållet.
  const tail = atStart ? [...tailBulges].reverse().map((b) => -b) : [...tailBulges];
  const all = atStart ? [...tail, ...full] : [...full, ...tail];
  return tidyBulges(all, all.length + 1);
}

/**
 * Rampen baklänges (0.10.19): referenslinjen och sidorna vänds, början och
 * slutet byter plats, vänster och höger byter sida och tvärfallet vänder.
 */
export function reversedRamp(p: RampParams): RampParams {
  const ref = (p.line ?? []) as [number, number][];
  const n = ref.length;
  const h0 = p.height ?? 0;
  const h1 = p.endHeight ?? h0;
  const lv = Array.from({ length: n }, (_, i) => p.levels?.[i] ?? null).reverse();
  const es = Array.from({ length: n }, (_, i) => p.eases?.[i] ?? null).reverse();
  const out: RampParams = {
    ...p,
    line: [...ref].reverse(),
    bulges: reversedBulges(p.bulges, n),
    height: h1,
    endHeight: h0,
    levels: tidyLevels(lv),
    eases: tidyEases(es),
    left: p.right ? [...p.right].reverse() : undefined,
    right: p.left ? [...p.left].reverse() : undefined,
    leftBulges: p.right ? reversedBulges(p.rightBulges, p.right.length) : undefined,
    rightBulges: p.left ? reversedBulges(p.leftBulges, p.left.length) : undefined,
    leftEdge: p.rightEdge,
    rightEdge: p.leftEdge,
    crossFall: typeof p.crossFall === 'number' ? -p.crossFall : undefined,
    refSide: p.refSide === 'left' ? 'right' : p.refSide === 'right' ? 'left' : p.refSide,
    refOffset: (p.refSide ?? 'center') === 'center' && typeof p.refOffset === 'number' ? -p.refOffset : p.refOffset,
  };
  for (const k of Object.keys(out) as (keyof RampParams)[]) if (out[k] === undefined) delete out[k];
  return out;
}

/**
 * Två ramper dockade (0.10.19): `a`:s slut möter `b`:s början, och `b`
 * fortsätter från `a`:s sista punkt (som får sin höjd som en punkt med höjd;
 * `b`:s första punkt faller bort). Sidorna: ritade om någon av dem är det
 * eller om bredderna skiljer, annars följer de referenslinjen som förut.
 * Inställningarna (kanterna, tvärfallet, övergångarna) är `a`:s.
 */
export function fusedRamp(a: RampParams, b: RampParams): RampParams {
  const ra = (a.line ?? []) as [number, number][];
  const rb = (b.line ?? []) as [number, number][];
  const na = ra.length;
  const line = [...ra, ...rb.slice(1)];
  const n = line.length;
  const ba = Array.from({ length: na - 1 }, (_, i) => Number(a.bulges?.[i]) || 0);
  const bb = Array.from({ length: rb.length - 1 }, (_, i) => Number(b.bulges?.[i]) || 0);
  const lv: (number | null)[] = Array.from({ length: n }, () => null);
  for (let i = 1; i < na - 1; i++) lv[i] = a.levels?.[i] ?? null;
  lv[na - 1] = a.endHeight ?? a.height ?? 0;
  for (let i = 1; i < rb.length - 1; i++) lv[na - 1 + i] = b.levels?.[i] ?? null;
  const es: (EasePoint | null)[] = Array.from({ length: n }, () => null);
  for (let i = 0; i < na; i++) es[i] = a.eases?.[i] ?? null;
  for (let i = 1; i < rb.length; i++) es[na - 1 + i] = b.eases?.[i] ?? null;
  const sameWidth = (a.width ?? PATH_WIDTH) === (b.width ?? PATH_WIDTH) && (a.refSide ?? 'center') === (b.refSide ?? 'center') && (a.refOffset ?? 0) === (b.refOffset ?? 0);
  const drawn = !!(a.left || a.right || b.left || b.right) || !sameWidth;
  const out: RampParams = {
    ...a,
    line,
    bulges: tidyBulges([...ba, ...bb], n),
    endHeight: b.endHeight ?? b.height ?? 0,
    levels: tidyLevels(lv),
    eases: tidyEases(es),
  };
  if (drawn) {
    const sa = rampSideLines(a);
    const sb = rampSideLines(b);
    for (const side of ['left', 'right'] as const) {
      const pa = sa[side].points;
      const pb = sb[side].points;
      // Ligger sidornas ändar i samma punkt behövs den bara en gång.
      const skip = pa.length && pb.length && Math.hypot(pa[pa.length - 1][0] - pb[0][0], pa[pa.length - 1][1] - pb[0][1]) < 1 ? 1 : 0;
      const pts = [...pa, ...pb.slice(skip)].map((q): [number, number] => [Math.round(q[0]), Math.round(q[1])]);
      const fa = Array.from({ length: pa.length - 1 }, (_, i) => Number(sa[side].bulges?.[i]) || 0);
      const fb = Array.from({ length: pb.length - 1 }, (_, i) => Number(sb[side].bulges?.[i]) || 0);
      out[side] = pts;
      const key = side === 'left' ? 'leftBulges' : 'rightBulges';
      out[key] = tidyBulges([...fa, ...(skip ? [] : [0]), ...fb], pts.length);
    }
  }
  for (const k of Object.keys(out) as (keyof RampParams)[]) if (out[k] === undefined) delete out[k];
  return out;
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
