import type { Vec2 } from './primitives';

/**
 * Streckmönstret längs en linje (0.8.30), gemensamt för skärmen och PDF:en.
 *
 * Linjen delas i *sträckor* vid skarpa hörn (mer än `CORNER` grader). Inom
 * en sträcka löper mönstret obrutet genom brytpunkterna, så att en båge,
 * en cirkel eller en spline (som ritas som många korta bitar) blir jämnt
 * streckad. Mönstret töjs lite på varje sträcka så att den börjar och
 * slutar med ett helt streck, som förut för varje rak sträcka: då möts
 * strecken i hörnen och de två sidorna av en riven vägg blir lika. En sluten
 * linje utan skarpa hörn får ett helt antal perioder, så att skarven inte syns.
 *
 * En bit av en linje (det som blir kvar när en täckande fyllning kapar den,
 * `coverLines`) ritas med samma mönster som den hela linjen: biten har
 * linjen den kommer ifrån och var den börjar längs den (`DashFrom`), och
 * strecken hamnar där de hade varit utan kapningen.
 *
 * Allt räknas i ritningens enheter (bildpunkter på skärmen, mm i PDF:en);
 * mönstret ska alltså redan vara räknat om till dem.
 */

/** Gränsen för ett skarpt hörn, grader. */
export const CORNER = 35;

/** Linjen en bit kommer ifrån, i modellen (0.8.30). */
export interface DashFrom {
  points: readonly Vec2[];
  closed: boolean;
  /** Var biten börjar längs linjen, mm i modellen. */
  at: number;
}

/** En sträcka att rita: punkterna och mönstret (null = heldragen). */
export interface DashPiece {
  points: Vec2[];
  dash: number[] | null;
  offset: number;
}

interface Run {
  /** Var sträckan börjar längs linjen och hur lång den är. */
  s0: number;
  len: number;
  dash: number[] | null;
}

/**
 * Sträckorna för linjen `pts` (i ritningens enheter) med mönstret `base`.
 * `at` och `total` gör det möjligt att rita en bit av linjen.
 */
function runsOf(pts: readonly Vec2[], closed: boolean, base: readonly number[]): { runs: Run[]; total: number; cum: number[] } {
  const ring = closed && pts.length > 2 ? [...pts, pts[0]] : [...pts];
  const n = ring.length - 1;
  const cum = [0];
  for (let i = 0; i < n; i++) cum.push(cum[i] + Math.hypot(ring[i + 1][0] - ring[i][0], ring[i + 1][1] - ring[i][1]));
  const total = cum[n];
  // Ett udda antal värden upprepas två gånger; gör det jämnt.
  const pattern = base.length % 2 ? [...base, ...base] : [...base];
  const period = pattern.reduce((a, b) => a + b, 0);
  const first = pattern[0];
  // Riktningen för varje sträcka, och var hörnen är skarpa.
  const dir = (i: number): Vec2 | null => {
    const l = cum[i + 1] - cum[i];
    return l > 1e-9 ? [(ring[i + 1][0] - ring[i][0]) / l, (ring[i + 1][1] - ring[i][1]) / l] : null;
  };
  const cos = Math.cos((CORNER * Math.PI) / 180);
  const sharp = (v: number): boolean => {
    // Hörnet i punkt v, mellan sträckan före och efter (nollånga hoppas över).
    let a: Vec2 | null = null;
    for (let k = 1; k <= n && !a; k++) {
      const i = v - k;
      if (i < 0 && !closed) return true;
      a = dir((i + n) % n);
    }
    let b: Vec2 | null = null;
    for (let k = 0; k < n && !b; k++) {
      const i = v + k;
      if (i >= n && !closed) return true;
      b = dir(i % n);
    }
    return !a || !b || a[0] * b[0] + a[1] * b[1] < cos;
  };
  const starts: number[] = [];
  for (let v = 0; v < n; v++) if ((v === 0 && !closed) || ((v > 0 || closed) && sharp(v))) starts.push(v);
  const stretch = (len: number, loop: boolean): number[] | null => {
    if (period <= 0) return null;
    if (loop) {
      const m = Math.round(len / period);
      if (m >= 1) return pattern.map((x) => (x * len) / (m * period));
    } else {
      const m = Math.round((len - first) / period);
      if (m >= 1) return pattern.map((x) => (x * len) / (m * period + first));
    }
    // För kort för ett mönster: ett streck i varje ände och ett mellanrum.
    return len > first * 1.6 ? [len * 0.38, len * 0.24, len * 0.38, total + len] : null;
  };
  if (!starts.length) {
    // Sluten utan skarpa hörn: en sträcka runt om.
    return { runs: [{ s0: 0, len: total, dash: stretch(total, true) }], total, cum };
  }
  const runs = starts.map((v, i): Run => {
    const s0 = cum[v];
    const next = i + 1 < starts.length ? cum[starts[i + 1]] : closed ? cum[starts[0]] + total : total;
    const len = next - s0;
    return { s0, len, dash: stretch(len, false) };
  });
  return { runs, total, cum };
}

/**
 * Sträckorna att rita för linjen `pts` med mönstret `pattern`, båda i
 * ritningens enheter. Med `from` är `pts` en bit av en längre linje (redan
 * räknad om till ritningens enheter, `from.points`), och `at` hur långt in
 * längs den biten börjar, också i ritningens enheter.
 */
export function dashPieces(pts: readonly Vec2[], closed: boolean, pattern: readonly number[], from?: { points: readonly Vec2[]; closed: boolean; at: number }): DashPiece[] {
  const whole = from ?? { points: pts, closed, at: 0 };
  const { runs, total } = runsOf(whole.points, whole.closed, pattern);
  const ring = closed && pts.length > 2 ? [...pts, pts[0]] : [...pts];
  const wrap = (u: number) => (whole.closed && total > 0 ? ((u % total) + total) % total : u);
  const runAt = (u: number): Run => {
    for (const r of runs) {
      const d = whole.closed ? wrap(u - r.s0) : u - r.s0;
      if (d >= 0 && d < r.len) return r;
    }
    return runs[runs.length - 1];
  };
  const out: DashPiece[] = [];
  let cur: { run: Run; piece: DashPiece } | null = null;
  let u = whole.at;
  for (let i = 0; i + 1 < ring.length; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 1e-9) continue;
    const run: Run = runAt(u + l / 2);
    if (cur && cur.run === run) cur.piece.points.push(b);
    else {
      const offset: number = whole.closed ? wrap(u - run.s0) : u - run.s0;
      cur = { run, piece: { points: [a, b], dash: run.dash, offset: run.dash ? offset : 0 } };
      out.push(cur.piece);
    }
    u += l;
  }
  return out;
}

/** Längden längs linjen, för att räkna om `DashFrom.at` till ritningens enheter. */
export function pathLength(pts: readonly Vec2[], closed: boolean): number {
  let s = 0;
  for (let i = 0; i + 1 < pts.length; i++) s += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  if (closed && pts.length > 2) s += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
  return s;
}
