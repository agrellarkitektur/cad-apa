import { add, angleDeg, closestOnSegment, dist, dot, fromAngleDeg, intersectLines, lerp, norm, scale, sub } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import { BoxIndex } from '../../geometry/boxIndex';

/**
 * Något att snäppa mot: en sträcka (väggens referenslinje, ett liv, en
 * linje), eller en punkt (`a` = `b`) med `point` satt (0.8.16).
 */
export interface SnapSegment {
  id: string;
  a: Vec2;
  b: Vec2;
  /**
   * En bit av en båge eller cirkel (0.8.16): man snäpper på den och mot dess
   * skärningar, men bitarnas ändar och mittpunkter är inga punkter att
   * snäppa till, och de ger inga spårlinjer.
   */
  curve?: boolean;
  /** En punkt att snäppa till: bågens ändar och mitt, centrum, kvadrantpunkter. */
  point?: 'endpoint' | 'midpoint' | 'center' | 'quadrant' | 'division';
  /** Texten när man ligger på sträckan; annars "På vägg". */
  on?: string;
  /** Väggens referenslinje (0.10.22): snäpps mot, men smartspöt följer bara livet. */
  ref?: boolean;
  /**
   * Bara för smartspöt (0.10.22.1): höjdkurvorna i planen följs av spöet
   * (en stödmur längs en höjdkurva) men snäpps inte mot, så att planen
   * inte blir klistrig.
   */
  wandOnly?: boolean;
}

export type SnapKind = 'division' | 'endpoint' | 'midpoint' | 'center' | 'quadrant' | 'start' | 'perpendicular' | 'intersection' | 'on-wall' | 'parallel' | 'track' | 'angle' | 'free';

export interface SnapResult {
  point: Vec2;
  kind: SnapKind;
  /** Kort text som visas vid markören. */
  label: string;
  /** Hjälplinje som visar vinkeln eller väggen man snäpper mot. */
  guide?: [Vec2, Vec2];
  /** Fler hjälplinjer, t.ex. två spårlinjer som korsas. */
  guides?: [Vec2, Vec2][];
}

export interface SnapInput {
  cursor: Vec2;
  /** Föregående punkt i kedjan, om man ritar en linje. */
  from?: Vec2;
  /** Kedjans första punkt, för att kunna sluta en slinga. */
  chainStart?: Vec2;
  segments: SnapSegment[];
  /** Tolerans i mm (räknas om från pixlar av anroparen). */
  tol: number;
  /**
   * Shift (0.10.29): lås vinkeln man står i när Shift trycks, från `from`,
   * tills Shift släpps eller kedjan får en ny punkt.
   */
  ortho?: boolean;
  /** Väggar som inte ska snäppas till, t.ex. den man flyttar. */
  exclude?: Set<string>;
}

/** Vinklar som drar till sig linjen när man ritar fritt, i grader. */
const ANGLE_STEP = 15;
const ANGLE_PULL_DEG = 3;

/**
 * Hitta den bästa snäpp-punkten nära markören. Ordningen följer vad en ritare
 * oftast menar: ändpunkter först, sedan mittpunkter, vinkelräta lägen och
 * skärningar, därefter linjen själv och sist vinkellås.
 */
let snapEnabled = true;

/** Slå av snäppning tillfälligt (knappen Snäpp eller S). Vinkellås med Shift fungerar ändå. */
export function setSnapEnabled(on: boolean): void {
  snapEnabled = on;
}

export function isSnapEnabled(): boolean {
  return snapEnabled;
}

export function snap(input: SnapInput): SnapResult {
  if (!input.ortho) held = null;
  if (!snapEnabled) {
    const lock = input.ortho && input.from && dist(input.from, input.cursor) > 1 ? heldDirection(input) : null;
    if (lock && input.from) {
      const { dir, label } = along(lock, input.from, input.cursor);
      return { point: add(input.from, scale(dir, Math.max(0, dot(sub(input.cursor, input.from), dir)))), kind: 'angle', label };
    }
    return { point: input.cursor, kind: 'free', label: '' };
  }
  const { cursor, from, tol } = input;
  // Allt nedan ligger inom spårlinjernas räckvidd från markören, så bara
  // sträckorna där prövas (0.8.3). De kommer i samma ordning som i listan.
  const segs = nearSegments(input.segments, cursor, tol * TRACK_REACH).filter((s) => !s.wandOnly && !input.exclude?.has(s.id));

  // 1. Punkter.
  const points: { p: Vec2; kind: SnapKind; label: string }[] = [];
  if (input.chainStart) points.push({ p: input.chainStart, kind: 'start', label: 'Startpunkt' });
  for (const s of segs) {
    if (s.point) points.push({ p: s.a, kind: s.point, label: POINT_LABEL[s.point] });
    else if (!s.curve) {
      points.push({ p: s.a, kind: 'endpoint', label: 'Ändpunkt' }, { p: s.b, kind: 'endpoint', label: 'Ändpunkt' });
      points.push({ p: lerp(s.a, s.b, 0.5), kind: 'midpoint', label: 'Mittpunkt' });
    }
  }
  // Bara sträckor härifrån; punkterna är prövade.
  const lines = segs.filter((s) => !s.point);
  // Parallellt och vinkelrätt (0.8.16): den raka linje man senast kände på
  // med muspekaren kommer man ihåg, som i SketchUp.
  const touched = nearestStraight(cursor, lines, tol);
  if (touched) inferred = touched;
  let bestPoint: { p: Vec2; kind: SnapKind; label: string; d: number } | null = null;
  for (const c of points) {
    const d = dist(c.p, cursor);
    if (d <= tol && (!bestPoint || d < bestPoint.d - 1e-6 || (Math.abs(d - bestPoint.d) < 1e-6 && rank(c.kind) < rank(bestPoint.kind)))) {
      bestPoint = { ...c, d };
    }
  }
  if (bestPoint) return { point: bestPoint.p, kind: bestPoint.kind, label: bestPoint.label };

  // Där två linjer korsar varandra nära markören (0.8.16).
  const cross = crossingNear(cursor, lines, tol);
  if (cross) return { point: cross, kind: 'intersection', label: 'Skärning' };

  // 2. Vinkelrätt mot en vägg från föregående punkt.
  if (from) {
    for (const s of lines) {
      const foot = closestOnSegment(from, s.a, s.b);
      if (foot.t > 0 && foot.t < 1 && dist(foot.point, cursor) <= tol && dist(foot.point, from) > 1) {
        return { point: foot.point, kind: 'perpendicular', label: 'Vinkelrätt', guide: [s.a, s.b] };
      }
    }
  }

  // Spårlinjer: förlängningar av väggar och linjer i x- och y-led genom hörn nära markören.
  const tracks = trackLines(cursor, lines, tol, from);
  const near = tracks.map((t) => ({ t, foot: add(t.p, scale(t.dir, dot(sub(cursor, t.p), t.dir))) })).filter((x) => dist(x.foot, cursor) <= tol);

  // 3. Vinkellås från föregående punkt, och var låset skär en vägg.
  let angled: Vec2 | null = null;
  let angleLabel = '';
  let edgeGuide: [Vec2, Vec2] | null = null;
  if (from && dist(from, cursor) > 1) {
    const raw = angleDeg(sub(cursor, from));
    const target = Math.round(raw / ANGLE_STEP) * ANGLE_STEP;
    const lockDir = input.ortho ? heldDirection(input) : null;
    const lock = lockDir ? along(lockDir, from, cursor) : null;
    const edge = input.ortho ? null : edgeLock(raw);
    if (lock || edge || (!input.ortho && Math.abs(raw - target) <= ANGLE_PULL_DEG)) {
      const dir = lock ? lock.dir : edge ? edge.dir : fromAngleDeg(target);
      const len = dot(sub(cursor, from), dir);
      angled = add(from, scale(dir, Math.max(0, len)));
      angleLabel = lock ? lock.label : edge ? edge.label : `${((target % 360) + 360) % 360}°`;
      edgeGuide = edge ? [inferred!.a, inferred!.b] : null;
      for (const s of lines) {
        const hit = intersectLines(from, dir, s.a, sub(s.b, s.a));
        if (!hit) continue;
        const onSeg = closestOnSegment(hit, s.a, s.b);
        if (dist(onSeg.point, hit) < 0.5 && dist(hit, cursor) <= tol && dot(sub(hit, from), dir) > 0) {
          return { point: hit, kind: 'intersection', label: `Skärning ${angleLabel}`, guide: [from, hit], ...(edgeGuide ? { guides: [edgeGuide] } : {}) };
        }
      }
      // Där vinkellåset möter en spårlinje: rakt ut till samma liv som ett hörn.
      for (const t of tracks) {
        const hit = intersectLines(from, dir, t.p, t.dir);
        if (hit && dist(hit, cursor) <= tol && dot(sub(hit, from), dir) > 0) {
          return { point: hit, kind: 'track', label: `${angleLabel}, ${t.label}`, guide: [from, hit], guides: [[t.p, hit], ...(edgeGuide ? [edgeGuide] : [])] };
        }
      }
    }
  }

  // Två spårlinjer som korsas nära markören.
  if (!input.ortho && near.length >= 2) {
    let best: { p: Vec2; a: TrackLine; b: TrackLine; d: number } | null = null;
    for (let i = 0; i < near.length; i++) {
      for (let j = i + 1; j < near.length; j++) {
        const a = near[i].t;
        const b = near[j].t;
        if (Math.abs(a.dir[0] * b.dir[1] - a.dir[1] * b.dir[0]) < 0.1) continue;
        const hit = intersectLines(a.p, a.dir, b.p, b.dir);
        if (!hit) continue;
        const d = dist(hit, cursor);
        if (d <= tol * 1.4 && (!best || d < best.d)) best = { p: hit, a, b, d };
      }
    }
    if (best) return { point: best.p, kind: 'track', label: 'I linje', guides: [[best.a.p, best.p], [best.b.p, best.p]] };
  }

  // 4. På en vägg.
  let bestOn: { p: Vec2; s: SnapSegment; d: number } | null = null;
  for (const s of lines) {
    const c = closestOnSegment(cursor, s.a, s.b).point;
    const d = dist(c, cursor);
    if (d <= tol && (!bestOn || d < bestOn.d)) bestOn = { p: c, s, d };
  }
  if (bestOn && !angled) return { point: bestOn.p, kind: 'on-wall', label: bestOn.s.on ?? 'På vägg', guide: [bestOn.s.a, bestOn.s.b] };
  // En spårlinje.
  if (!angled && !input.ortho && near.length) {
    const n = near.reduce((a, b) => (dist(a.foot, cursor) <= dist(b.foot, cursor) ? a : b));
    return { point: n.foot, kind: 'track', label: n.t.label, guides: [[n.t.p, n.foot]] };
  }

  if (angled && from) {
    const far = add(from, scale(norm(sub(angled, from)), Math.max(dist(from, angled) * 3, tol * 40)));
    if (edgeGuide) return { point: angled, kind: 'parallel', label: angleLabel, guide: [from, far], guides: [edgeGuide] };
    return { point: angled, kind: 'angle', label: angleLabel, guide: [from, far] };
  }
  if (bestOn) return { point: bestOn.p, kind: 'on-wall', label: bestOn.s.on ?? 'På vägg', guide: [bestOn.s.a, bestOn.s.b] };
  return { point: cursor, kind: 'free', label: '' };
}

const POINT_LABEL: Record<NonNullable<SnapSegment['point']>, string> = { endpoint: 'Ändpunkt', midpoint: 'Mittpunkt', center: 'Centrum', quadrant: 'Kvadrant', division: 'Segmentpunkt' };

/** Den raka linje man senast kände på med muspekaren (0.8.16), för parallellt och vinkelrätt. */
let inferred: { a: Vec2; b: Vec2; u: Vec2 } | null = null;

/** Glöm linjen man kände på, t.ex. när ett nytt verktyg väljs. */
export function forgetInferred(): void {
  inferred = null;
  held = null;
}

/**
 * Shift-låset (0.10.29): riktningen från `from` när Shift trycktes. Den tas
 * ur det man står i då: ett vinkellås (15°-steg, parallellt eller
 * vinkelrätt mot en linje) eller en punkt man snäpper till ger exakt den
 * riktningen; fritt avrundas vinkeln till hela grader.
 */
let held: { from: Vec2; dir: Vec2; named?: string } | null = null;

function heldDirection(input: SnapInput): { dir: Vec2; named?: string } | null {
  const from = input.from;
  if (!from) return null;
  if (held && dist(held.from, from) < 1e-6) return held;
  const free = snapEnabled ? snap({ ...input, ortho: false }) : { point: input.cursor, kind: 'free' as SnapKind, label: '' };
  const v = sub(free.point, from);
  if (Math.hypot(v[0], v[1]) < 1) return null;
  const dir = free.kind === 'free' || free.kind === 'on-wall' ? fromAngleDeg(Math.round(angleDeg(v))) : norm(v);
  held = { from, dir, ...(free.kind === 'parallel' ? { named: free.label } : {}) };
  return held;
}

/** Låset åt det håll markören ligger (bakåt längs linjen vänder riktningen), med vinkeln som text. */
function along(lock: { dir: Vec2; named?: string }, from: Vec2, cursor: Vec2): { dir: Vec2; label: string } {
  const dir = dot(sub(cursor, from), lock.dir) < 0 ? scale(lock.dir, -1) : lock.dir;
  if (lock.named) return { dir, label: lock.named };
  const deg = Math.round(((((angleDeg(dir) % 360) + 360) % 360) * 10)) / 10;
  return { dir, label: `${(deg % 360).toLocaleString('sv-SE')}°` };
}

/** Den raka linje som ligger närmast markören inom `tol`, om någon. */
function nearestStraight(cursor: Vec2, lines: readonly SnapSegment[], tol: number): { a: Vec2; b: Vec2; u: Vec2 } | null {
  let best: { s: SnapSegment; d: number } | null = null;
  for (const s of lines) {
    if (s.curve) continue;
    const l = dist(s.a, s.b);
    if (l < 1) continue;
    const d = dist(closestOnSegment(cursor, s.a, s.b).point, cursor);
    if (d <= tol && (!best || d < best.d)) best = { s, d };
  }
  if (!best) return null;
  const { a, b } = best.s;
  return { a, b, u: scale(sub(b, a), 1 / dist(a, b)) };
}

/**
 * Parallellt med eller vinkelrätt mot linjen man känt på, om riktningen från
 * `from` ligger nära. Linjer i 15°-steg tar vinkellåset hand om.
 */
function edgeLock(raw: number): { dir: Vec2; label: string } | null {
  if (!inferred) return null;
  const base = angleDeg(inferred.u);
  // Linjer i 15°-steg klarar vinkellåset själv.
  if (Math.abs(base / ANGLE_STEP - Math.round(base / ANGLE_STEP)) * ANGLE_STEP < 0.01) return null;
  let best: { a: number; label: string; d: number } | null = null;
  for (const [k, label] of [[0, 'Parallellt'], [90, 'Vinkelrätt'], [180, 'Parallellt'], [270, 'Vinkelrätt']] as const) {
    const a = base + k;
    const d = Math.abs(((raw - a + 540) % 360) - 180);
    if (d <= ANGLE_PULL_DEG && (!best || d < best.d)) best = { a, label, d };
  }
  if (!best) return null;
  return { dir: fromAngleDeg(best.a), label: best.label === 'Parallellt' ? 'Parallellt med linjen' : 'Vinkelrätt mot linjen' };
}

/** Där två linjer nära markören korsar varandra, inom `tol`. Bitar av samma båge räknas inte. */
function crossingNear(cursor: Vec2, lines: readonly SnapSegment[], tol: number): Vec2 | null {
  const near = lines.filter((s) => dist(s.a, s.b) >= 1e-6 && dist(closestOnSegment(cursor, s.a, s.b).point, cursor) <= tol);
  let best: { p: Vec2; d: number } | null = null;
  for (let i = 0; i < near.length; i++)
    for (let j = i + 1; j < near.length; j++) {
      const s = near[i];
      const t = near[j];
      if (s.curve && t.curve && s.id === t.id) continue;
      const u = sub(s.b, s.a);
      const v = sub(t.b, t.a);
      // Nästan parallella linjer ger ingen säker skärning.
      if (Math.abs(u[0] * v[1] - u[1] * v[0]) < 1e-3 * Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1])) continue;
      const hit = intersectLines(s.a, u, t.a, v);
      if (!hit) continue;
      if (dist(closestOnSegment(hit, s.a, s.b).point, hit) > 0.01 || dist(closestOnSegment(hit, t.a, t.b).point, hit) > 0.01) continue;
      // Där två linjer möts i en ände är det en ändpunkt, som redan prövats.
      if ((dist(hit, s.a) < 0.01 || dist(hit, s.b) < 0.01) && (dist(hit, t.a) < 0.01 || dist(hit, t.b) < 0.01)) continue;
      const d = dist(hit, cursor);
      if (d <= tol && (!best || d < best.d)) best = { p: hit, d };
    }
  return best?.p ?? null;
}

/** Färre sträckor än så prövas alla, utan rutnät. Ändras bara i testerna. */
export const snapIndex = { from: 200 };
const segmentIndexes = new WeakMap<readonly SnapSegment[], BoxIndex>();

/** Sträckorna som kan ligga inom `r` från punkten, i listans ordning. */
export function nearSegments(segments: readonly SnapSegment[], p: Vec2, r: number): readonly SnapSegment[] {
  if (segments.length < snapIndex.from) return segments;
  let index = segmentIndexes.get(segments);
  if (!index) {
    index = new BoxIndex(2000);
    for (const [i, s] of segments.entries()) index.add(i, [Math.min(s.a[0], s.b[0]), Math.min(s.a[1], s.b[1]), Math.max(s.a[0], s.b[0]), Math.max(s.a[1], s.b[1])]);
    segmentIndexes.set(segments, index);
  }
  return index.near([p[0] - r, p[1] - r, p[0] + r, p[1] + r]).map((i) => segments[i]);
}

interface TrackLine {
  p: Vec2;
  dir: Vec2;
  label: string;
}

/** Hur långt från markören hörn och ändar ger spårlinjer, i toleranser. */
const TRACK_REACH = 30;

/**
 * Spårlinjer nära markören: väggars och linjers förlängningar bortom
 * ändarna, och linjer i x- och y-led genom ändpunkter. De hjälper till att
 * lägga något i liv med något annat utan hjälplinjer.
 */
function trackLines(cursor: Vec2, segs: readonly SnapSegment[], tol: number, from?: Vec2): TrackLine[] {
  const reach = tol * TRACK_REACH;
  const out: TrackLine[] = [];
  const seen = new Set<string>();
  for (const s of segs) {
    if (s.curve) continue;
    const l = dist(s.a, s.b);
    if (l < 1) continue;
    const u = scale(sub(s.b, s.a), 1 / l);
    // Förlängningen bortom den ände markören är närmast.
    const t = dot(sub(cursor, s.a), u);
    if (t < 0 || t > l) {
      const end = t < 0 ? s.a : s.b;
      if (dist(end, cursor) <= reach) out.push({ p: end, dir: u, label: 'Förlängning' });
    }
    for (const q of [s.a, s.b]) {
      if (from && dist(q, from) < 1) continue;
      if (dist(q, cursor) > reach / 2) continue;
      const key = `${Math.round(q[0])},${Math.round(q[1])}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ p: q, dir: [1, 0], label: 'I liv' }, { p: q, dir: [0, 1], label: 'I liv' });
    }
  }
  return out;
}

function rank(k: SnapKind): number {
  return k === 'start' ? 0 : k === 'endpoint' ? 1 : k === 'center' ? 3 : 2;
}

/** Avrunda till hela mm, som ritningar anges i. */
export function roundMm(p: Vec2): [number, number] {
  return [Math.round(p[0]) || 0, Math.round(p[1]) || 0];
}

/**
 * "Kant i kant" när man drar runt något utan att träffa en exakt punkt: om en
 * kant på det som flyttas ligger nästan parallellt och nära en vägg eller en
 * annan möbel, justeras flytten så att de ligger an mot varandra. Görs i två
 * riktningar, så att ett hörn kan läggas in i ett hörn.
 */
export function flushSnap(outlines: readonly (readonly Vec2[])[], segments: SnapSegment[], d: Vec2, tol: number): { d: Vec2; guides: [Vec2, Vec2][] } | null {
  if (!snapEnabled) return null;
  const PARALLEL = Math.sin((3 * Math.PI) / 180);
  const edges: [Vec2, Vec2][] = [];
  for (const ring of outlines) for (let i = 0; i < ring.length; i++) edges.push([ring[i], ring[(i + 1) % ring.length]]);
  // Bara sträckor nära det som flyttas kan ligga an mot det (0.8.3). Den
  // andra justeringen flyttar högst `tol` till, därav marginalen.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [p] of edges) {
    x0 = Math.min(x0, p[0] + d[0]);
    y0 = Math.min(y0, p[1] + d[1]);
    x1 = Math.max(x1, p[0] + d[0]);
    y1 = Math.max(y1, p[1] + d[1]);
  }
  const m = tol * 2 + 1;
  if (segments.length >= snapIndex.from) segments = segments.filter((s) => Math.max(s.a[0], s.b[0]) >= x0 - m && Math.min(s.a[0], s.b[0]) <= x1 + m && Math.max(s.a[1], s.b[1]) >= y0 - m && Math.min(s.a[1], s.b[1]) <= y1 + m);

  const best = (moved: Vec2, avoid?: Vec2): { c: Vec2; n: Vec2; seg: SnapSegment } | null => {
    let found: { c: Vec2; n: Vec2; seg: SnapSegment; dist: number } | null = null;
    for (const s of segments) {
      const sl = dist(s.a, s.b);
      if (sl < 1) continue;
      const u = scale(sub(s.b, s.a), 1 / sl);
      const n: Vec2 = [-u[1], u[0]];
      if (avoid && Math.abs(dot(n, avoid)) > 0.5) continue;
      for (const [p0, q0] of edges) {
        const p = add(p0, moved);
        const q = add(q0, moved);
        const el = dist(p, q);
        if (el < 1) continue;
        const v = scale(sub(q, p), 1 / el);
        if (Math.abs(v[0] * u[1] - v[1] * u[0]) > PARALLEL) continue;
        // Avstånd mellan linjerna, och att kanterna överlappar på längden.
        const off = dot(sub(p, s.a), n);
        if (Math.abs(off) > tol) continue;
        const tp = dot(sub(p, s.a), u);
        const tq = dot(sub(q, s.a), u);
        // Kanterna måste ligga mot varandra en bit, inte bara mötas i ett hörn.
        const overlap = Math.min(Math.max(tp, tq), sl) - Math.max(Math.min(tp, tq), 0);
        if (overlap < Math.min(50, el / 2, sl / 2)) continue;
        if (!found || Math.abs(off) < found.dist) found = { c: scale(n, -off), n, seg: s, dist: Math.abs(off) };
      }
    }
    return found;
  };

  const first = best(d);
  if (!first) return null;
  let out = add(d, first.c);
  const guides: [Vec2, Vec2][] = [[first.seg.a, first.seg.b]];
  const second = best(out, first.n);
  if (second) {
    out = add(out, second.c);
    guides.push([second.seg.a, second.seg.b]);
  }
  return { d: out, guides };
}
