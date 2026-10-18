import { add, angleDeg, closestOnSegment, dist, dot, fromAngleDeg, intersectLines, lerp, norm, scale, sub } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';

/** En vägg som går att snäppa till: dess referenslinje. */
export interface SnapSegment {
  id: string;
  a: Vec2;
  b: Vec2;
}

export type SnapKind = 'endpoint' | 'midpoint' | 'start' | 'perpendicular' | 'intersection' | 'on-wall' | 'angle' | 'free';

export interface SnapResult {
  point: Vec2;
  kind: SnapKind;
  /** Kort text som visas vid markören. */
  label: string;
  /** Hjälplinje som visar vinkeln eller väggen man snäpper mot. */
  guide?: [Vec2, Vec2];
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
  /** Lås vinkeln till 45° steg (Shift). */
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
  if (!snapEnabled) {
    if (input.ortho && input.from && dist(input.from, input.cursor) > 1) {
      const raw = angleDeg(sub(input.cursor, input.from));
      const dir = fromAngleDeg(Math.round(raw / 45) * 45);
      return { point: add(input.from, scale(dir, Math.max(0, dot(sub(input.cursor, input.from), dir)))), kind: 'angle', label: '' };
    }
    return { point: input.cursor, kind: 'free', label: '' };
  }
  const { cursor, from, tol } = input;
  const segs = input.segments.filter((s) => !input.exclude?.has(s.id));

  // 1. Punkter.
  const points: { p: Vec2; kind: SnapKind; label: string }[] = [];
  if (input.chainStart) points.push({ p: input.chainStart, kind: 'start', label: 'Startpunkt' });
  for (const s of segs) {
    points.push({ p: s.a, kind: 'endpoint', label: 'Ändpunkt' }, { p: s.b, kind: 'endpoint', label: 'Ändpunkt' });
    points.push({ p: lerp(s.a, s.b, 0.5), kind: 'midpoint', label: 'Mittpunkt' });
  }
  let bestPoint: { p: Vec2; kind: SnapKind; label: string; d: number } | null = null;
  for (const c of points) {
    const d = dist(c.p, cursor);
    if (d <= tol && (!bestPoint || d < bestPoint.d - 1e-6 || (Math.abs(d - bestPoint.d) < 1e-6 && rank(c.kind) < rank(bestPoint.kind)))) {
      bestPoint = { ...c, d };
    }
  }
  if (bestPoint) return { point: bestPoint.p, kind: bestPoint.kind, label: bestPoint.label };

  // 2. Vinkelrätt mot en vägg från föregående punkt.
  if (from) {
    for (const s of segs) {
      const foot = closestOnSegment(from, s.a, s.b);
      if (foot.t > 0 && foot.t < 1 && dist(foot.point, cursor) <= tol && dist(foot.point, from) > 1) {
        return { point: foot.point, kind: 'perpendicular', label: 'Vinkelrätt', guide: [s.a, s.b] };
      }
    }
  }

  // 3. Vinkellås från föregående punkt, och var låset skär en vägg.
  let angled: Vec2 | null = null;
  let angleLabel = '';
  if (from && dist(from, cursor) > 1) {
    const raw = angleDeg(sub(cursor, from));
    const step = input.ortho ? 45 : ANGLE_STEP;
    const target = Math.round(raw / step) * step;
    if (input.ortho || Math.abs(raw - target) <= ANGLE_PULL_DEG) {
      const dir = fromAngleDeg(target);
      const len = dot(sub(cursor, from), dir);
      angled = add(from, scale(dir, Math.max(0, len)));
      angleLabel = `${((target % 360) + 360) % 360}°`;
      for (const s of segs) {
        const hit = intersectLines(from, dir, s.a, sub(s.b, s.a));
        if (!hit) continue;
        const onSeg = closestOnSegment(hit, s.a, s.b);
        if (dist(onSeg.point, hit) < 0.5 && dist(hit, cursor) <= tol && dot(sub(hit, from), dir) > 0) {
          return { point: hit, kind: 'intersection', label: `Skärning ${angleLabel}`, guide: [from, hit] };
        }
      }
    }
  }

  // 4. På en vägg.
  let bestOn: { p: Vec2; s: SnapSegment; d: number } | null = null;
  for (const s of segs) {
    const c = closestOnSegment(cursor, s.a, s.b).point;
    const d = dist(c, cursor);
    if (d <= tol && (!bestOn || d < bestOn.d)) bestOn = { p: c, s, d };
  }
  if (bestOn && !angled) return { point: bestOn.p, kind: 'on-wall', label: 'På vägg', guide: [bestOn.s.a, bestOn.s.b] };

  if (angled && from) {
    const far = add(from, scale(norm(sub(angled, from)), Math.max(dist(from, angled) * 3, tol * 40)));
    return { point: angled, kind: 'angle', label: angleLabel, guide: [from, far] };
  }
  if (bestOn) return { point: bestOn.p, kind: 'on-wall', label: 'På vägg', guide: [bestOn.s.a, bestOn.s.b] };
  return { point: cursor, kind: 'free', label: '' };
}

function rank(k: SnapKind): number {
  return k === 'start' ? 0 : k === 'endpoint' ? 1 : 2;
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
