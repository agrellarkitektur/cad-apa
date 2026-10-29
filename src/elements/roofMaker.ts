import { difference, intersection, union, type Rings } from '../geometry/boolean';
import { signedArea } from '../geometry/chains';
import { dist } from '../geometry/vec';
import type { Vec2 } from '../repr/primitives';
import type { Plane } from '../repr/solids';
import { halfPlaneBelow, outlineRing, roofPlanes, type RoofParams } from './roof';

/**
 * Takfall som skapas eller ändras på en gång (0.10): snabbvalen över en
 * rektangel (pulpet, sadel och valm) och Kapa mot tak.
 */

export type QuickKind = 'shed' | 'gable' | 'hip';

export interface QuickOptions {
  kind: QuickKind;
  slope: number;
  /** Höjden vid ytterlivet (referenslinjen), mm över golvet. */
  height: number;
  heightAt?: 'under' | 'top';
  thickness: number;
  /** Takfotssprånget, mm utanför ytterlivet. */
  eave: number;
  /** Gavelsprånget, mm utanför ytterlivet (sadel- och pulpettak). */
  gable: number;
}

type P = [number, number];

const round = (q: readonly number[]): P => [Math.round(q[0]), Math.round(q[1])];

/** En ring utan dubbla punkter och utan att den första upprepas sist. */
function clean(ring: readonly (readonly number[])[]): P[] {
  const out: P[] = [];
  for (const q of ring) {
    const r = round(q);
    const last = out[out.length - 1];
    if (!last || dist(last, r) >= 2) out.push(r);
  }
  while (out.length > 1 && dist(out[0], out[out.length - 1]) < 2) out.pop();
  // Korta bitar från avrundningen tas bort.
  for (let i = out.length - 1; i > 0 && out.length > 3; i--) if (dist(out[i], out[i - 1]) < 2) out.splice(i, 1);
  // Punkter mitt på en rak kant behövs inte.
  return out.filter((q, i) => {
    const a = out[(i - 1 + out.length) % out.length];
    const b = out[(i + 1) % out.length];
    const cr = (q[0] - a[0]) * (b[1] - a[1]) - (q[1] - a[1]) * (b[0] - a[0]);
    return Math.abs(cr) > 0.5 * Math.max(1, dist(a, b));
  });
}

/** Moturs. */
function ccw(ring: P[]): P[] {
  return signedArea(ring) < 0 ? [...ring].reverse() : ring;
}

/**
 * Takfallen över rektangeln mellan a och b (husets ytterliv). Nocken går
 * längs den längre sidan; pulpettaket har takfoten på den långsida som
 * hörnet `a` ligger på. Referenslinjerna ligger i ytterlivet vid takfötterna.
 */
export function quickRoofs(a: Vec2, b: Vec2, o: QuickOptions): RoofParams[] {
  const x0 = Math.min(a[0], b[0]);
  const x1 = Math.max(a[0], b[0]);
  const y0 = Math.min(a[1], b[1]);
  const y1 = Math.max(a[1], b[1]);
  if (x1 - x0 < 500 || y1 - y0 < 500) return [];
  const along = x1 - x0 >= y1 - y0;
  // Räkna som om nocken går längs x och vrid tillbaka efteråt.
  const to = (q: readonly number[]): P => (along ? round(q) : round([q[1], q[0]]));
  const [u0, u1, v0, v1] = along ? [x0, x1, y0, y1] : [y0, y1, x0, x1];
  // Utan vridning byter speglingen x ↔ y konturens och referenslinjens riktning.
  const flip = !along;
  const base = { slope: o.slope, height: o.height, thickness: o.thickness, ...(o.heightAt === 'top' ? { heightAt: 'top' as const } : {}) };
  const make = (outline: P[], ref: [P, P]): RoofParams => {
    const out = outline.map(to);
    const r: [P, P] = flip ? [to(ref[1]), to(ref[0])] : [to(ref[0]), to(ref[1])];
    return { outline: ccw(out), ref: r, ...base };
  };
  const e = o.eave;
  const g = o.kind === 'hip' ? o.eave : o.gable;
  const outer: P[] = [
    [u0 - g, v0 - e],
    [u1 + g, v0 - e],
    [u1 + g, v1 + e],
    [u0 - g, v1 + e],
  ];
  const south: [P, P] = [[u0, v0], [u1, v0]];
  const north: [P, P] = [[u1, v1], [u0, v1]];
  if (o.kind === 'shed') {
    const low = (along ? a[1] : a[0]) <= (v0 + v1) / 2 ? south : north;
    return [make(outer, low)];
  }
  const vm = (v0 + v1) / 2;
  if (o.kind === 'gable') {
    return [
      make([[u0 - g, v0 - e], [u1 + g, v0 - e], [u1 + g, vm], [u0 - g, vm]], south),
      make([[u1 + g, v1 + e], [u0 - g, v1 + e], [u0 - g, vm], [u1 + g, vm]], north),
    ];
  }
  // Valmat tak: fyra takfall, vart och ett där det ligger lägst.
  const refs: [P, P][] = [south, [[u1, v0], [u1, v1]], north, [[u0, v1], [u0, v0]]];
  const draft = refs.map((ref) => make(outer, ref));
  return draft.flatMap((rp, i) => {
    const mine = roofPlanes(rp)[0];
    let region: Rings[] = [[outlineRing(rp)]];
    draft.forEach((other, j) => {
      if (j === i || !region.length) return;
      const pl = roofPlanes(other)[0];
      const diff: Plane = [mine.top[0] - pl.top[0], mine.top[1] - pl.top[1], mine.top[2] - pl.top[2]];
      const below = halfPlaneBelow(diff, 0);
      region = below ? region.flatMap((r) => intersection(r, [below])) : [];
    });
    const ring = region.sort((p, q) => area(q[0]) - area(p[0]))[0]?.[0];
    if (!ring) return [];
    const outline = ccw(clean(ring));
    return outline.length >= 3 ? [{ ...rp, outline }] : [];
  });
}

function area(ring: readonly Vec2[] | undefined): number {
  return ring ? Math.abs(signedArea(ring)) : 0;
}

/**
 * Kapa takfallet `a` där dess ovansida möter takfallet `b` (Kapa mot tak,
 * 0.10). Ytorna förlängs så långt som behövs, så att skärningen gäller hela
 * konturen. Kvar blir den del som innehåller `keep`, eller den största. `dz`
 * flyttar `b` i höjd (ett tak på en annan våning). Null om de inte möts
 * inom konturen.
 */
export function trimRoof(a: RoofParams, b: RoofParams, keep: Vec2 | null, dz = 0): Pick<RoofParams, 'outline' | 'bulges'> | null {
  const ring = outlineRing(a);
  if (ring.length < 3) return null;
  const whole = area(ring);
  // B:s yta över ett område som täcker A med god marginal.
  const xs = ring.map((q) => q[0]);
  const ys = ring.map((q) => q[1]);
  const m = 10 * Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1000);
  const big: P[] = [
    [Math.min(...xs) - m, Math.min(...ys) - m],
    [Math.max(...xs) + m, Math.min(...ys) - m],
    [Math.max(...xs) + m, Math.max(...ys) + m],
    [Math.min(...xs) - m, Math.max(...ys) + m],
  ];
  const bp = roofPlanes({ ...b, outline: big, bulges: undefined });
  const lower: Rings[] = [];
  for (const pa of roofPlanes(a)) {
    for (const pb of bp) {
      const diff: Plane = [pa.top[0] - pb.top[0], pa.top[1] - pb.top[1], pa.top[2] - pb.top[2] - dz];
      const below = halfPlaneBelow(diff, 0);
      if (!below) continue;
      for (const piece of intersection(pa.rings, [pb.rings])) lower.push(...intersection(piece, [below]));
    }
  }
  const low = lower.length ? union(lower) : [];
  const high = difference([ring], low);
  const lowArea = low.reduce((s, r) => s + area(r[0]), 0);
  if (lowArea < 1e4 || whole - lowArea < 1e4) return null;
  const inside = (r: Rings, q: Vec2) => pointInRing(q, r[0]);
  let pieces: Rings[];
  if (keep && low.some((r) => inside(r, keep))) pieces = low;
  else if (keep && high.some((r) => inside(r, keep))) pieces = high;
  else pieces = lowArea >= whole / 2 ? low : high;
  const chosen = (keep && pieces.find((r) => inside(r, keep))) || [...pieces].sort((p, q) => area(q[0]) - area(p[0]))[0];
  if (!chosen) return null;
  const outline = ccw(clean(chosen[0]));
  return outline.length >= 3 ? { outline, bulges: undefined } : null;
}

function pointInRing(q: Vec2, ring: readonly (readonly number[])[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a[1] > q[1] !== b[1] > q[1] && q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
