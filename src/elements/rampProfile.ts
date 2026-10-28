import type { GroundDefaults } from '../core/site';
import type { Vec2 } from '../repr/primitives';
import { flatLine } from './groundLines';
import type { RampLevel, RampParams, RampRun } from './groundRamp';

type P = readonly [number, number];

/**
 * Rampens höjdprofil (0.10.18–0.10.19, för sig sedan 0.10.21.1): punkterna
 * med höjd längs referenslinjen, sträckorna mellan dem, de mjuka
 * övergångarnas radier och höjden vid en sträcka. Ren geometri; rampens
 * form i planen ligger i `groundRamp.ts`.
 */

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

