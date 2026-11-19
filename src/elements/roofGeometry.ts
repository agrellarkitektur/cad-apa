// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import { arcFromBulge, type Arc } from '../geometry/arc';
import { boxesTouch, boxOf, difference, intersection, type Box, type Rings } from '../geometry/boolean';
import { dist, distToSegment, left, norm, sub } from '../geometry/vec';
import type { Vec2 } from '../repr/primitives';
import { zOn, type Plane } from '../repr/solids';
import { segmentCount, shapePoints } from './drawing2d';
import type { FillParams } from './fill2d';
import type { EdgeCut, EdgeCutOverride } from './roofBody';


/**
 * Tak (0.10, format 17): ett takfall. Konturen är takets utbredning i plan,
 * med raka kanter och bågar som en sluten 2D-form. Referenslinjen ger
 * höjden och lutningen: taket ligger på `height` vid linjen och stiger åt
 * vänster sett från linjens start mot dess slut, vinkelrätt mot den.
 * Linjen kan ligga var som helst, också mitt i takfallet; på andra sidan
 * fortsätter taket nedåt. En referenslinje med pilhöjd är en båge, och
 * taket lutar då vinkelrätt mot bågen över hela dess längd: en kon.
 *
 * Komplexa tak byggs av flera takfall (sadeltak av två, valmat tak av
 * fyra), som kapas mot varandra med Kapa mot tak i Modifiera.
 *
 * Höjderna räknas från våningens golv. `height` gäller takets undersida vid
 * referenslinjen, eller med `heightAt: 'top'` ovansidan.
 */
export interface RoofParams extends Partial<FillParams> {
  /** Konturen i plan, mm. */
  outline: [number, number][];
  /** Pilhöjd för kant i (från punkt i till i + 1), som 2D-formens. */
  bulges?: number[];
  /** Referenslinjen: start och slut. Taket stiger åt vänster. */
  ref: [[number, number], [number, number]];
  /** Referenslinjens pilhöjd: en båge ger en kon. */
  refBulge?: number;
  /** Höjden vid referenslinjen, mm över golvet. */
  height: number;
  /** Om höjden gäller undersidan (förval) eller ovansidan. */
  heightAt?: 'under' | 'top';
  /** Taklutning i grader. */
  slope: number;
  /** Takets tjocklek vinkelrätt mot takytan, mm. */
  thickness: number;
  /**
   * Språngets tjocklek (0.10.2): delen utanför ytterväggarnas utsida, med
   * samma ovansida. Utelämnad = takets.
   */
  overhangThickness?: number;
  /** Takfotens snitt (0.10.2), för kanter som vetter nedåt i lutningen. Utelämnat = vinkelrätt mot takytan. */
  eaveCut?: EdgeCut;
  /** Kanternas egna snitt (0.10.2), kända igen på kantens hörn. */
  edgeCuts?: EdgeCutOverride[];
  /**
   * Takkupa (0.12.4): inom konturen gäller det här taket i stället för taken
   * under det när rumshöjden räknas för areorna (SS 21054 5.14). Taket under
   * kapas inte i planen och 3D.
   */
  dormer?: true;
}

/** En del av takfallet med plan för under- och ovansida (en kon delas i plana bitar). */
export interface RoofPlane {
  rings: Rings;
  under: Plane;
  top: Plane;
  /** Taket ligger på en annan våning än väggen: det kapar men drar inte upp (Upp till taket gäller den egna våningen). */
  foreign?: true;
}

const BIG = 1e6;
/** Bitar som en kon delas i, för ett helt varv. */
const CONE_SECTORS = 64;

const tanOf = (deg: number) => Math.tan((Math.max(0, Math.min(80, deg)) * Math.PI) / 180);

/** Konturen som punkter, med bågarna som korta raka bitar. */
export function outlineRing(p: Pick<RoofParams, 'outline' | 'bulges'>): Vec2[] {
  return shapePoints({ shape: 'polyline', points: p.outline, bulges: p.bulges, closed: true }).points;
}

/** Referenslinjens båge, eller null för en rak linje. */
export function refArc(p: Pick<RoofParams, 'ref' | 'refBulge'>): Arc | null {
  return p.ref ? arcFromBulge(p.ref[0], p.ref[1], p.refBulge ?? 0) : null;
}

/**
 * Takytans form: avståndet `w(q)` från referenslinjen åt det håll taket
 * stiger (negativt på andra sidan), och undersidans höjd där.
 */
export function roofFrame(p: RoofParams) {
  const k = tanOf(p.slope);
  const tv = p.thickness / Math.cos(Math.atan(k));
  const under0 = p.heightAt === 'top' ? p.height - tv : p.height;
  const arc = refArc(p);
  let w: (q: Vec2) => number;
  if (arc) {
    // Buktar bågen åt vänster ligger centrum till höger: taket stiger utåt.
    const s = arc.sigma;
    w = (q) => s * (dist(q, arc.center) - arc.radius);
  } else {
    const a = p.ref?.[0] ?? [0, 0];
    const b = p.ref?.[1] ?? [1, 0];
    const n = left(norm(sub(b as Vec2, a as Vec2)));
    w = (q) => (q[0] - a[0]) * n[0] + (q[1] - a[1]) * n[1];
  }
  return {
    k,
    tv,
    arc,
    w,
    under: (q: Vec2) => under0 + k * w(q),
    top: (q: Vec2) => under0 + tv + k * w(q),
  };
}

const cache = new WeakMap<object, RoofPlane[]>();

/** Takfallet i plana bitar: en bit för en rak referenslinje, bitar runt centrum för en kon. */
export function roofPlanes(p: RoofParams): RoofPlane[] {
  const hit = cache.get(p);
  if (hit) return hit;
  const out = buildPlanes(p);
  cache.set(p, out);
  return out;
}

function buildPlanes(p: RoofParams): RoofPlane[] {
  const ring = outlineRing(p);
  if (ring.length < 3 || !p.ref) return [];
  const f = roofFrame(p);
  const lift = (pl: Plane): Plane => [pl[0], pl[1], pl[2] + f.tv];
  const z0 = f.under([0, 0]);
  if (!f.arc) {
    const ex = f.under([1, 0]) - z0;
    const ey = f.under([0, 1]) - z0;
    const under: Plane = [ex, ey, z0];
    return [{ rings: [ring], under, top: lift(under) }];
  }
  // Konen i bitar: varje bit är planet genom spetsen och konens linjer vid
  // bitens två kanter, så att bitarna möts utan glipor.
  const { center: c, sigma: s } = f.arc;
  const d = (2 * Math.PI) / CONE_SECTORS;
  const kk = f.k / Math.cos(d / 2);
  const far = 2 * Math.max(...ring.map((q) => dist(q, c))) + 1000;
  const zc = f.under(c);
  const out: RoofPlane[] = [];
  for (let j = 0; j < CONE_SECTORS; j++) {
    const t0 = j * d;
    const t1 = t0 + d;
    const tm = t0 + d / 2;
    const wedge: Rings = [[c, [c[0] + far * Math.cos(t0), c[1] + far * Math.sin(t0)], [c[0] + far * Math.cos(t1), c[1] + far * Math.sin(t1)]]];
    const parts = intersection([ring], [wedge]);
    if (!parts.length) continue;
    // z = zc + s·kk·(m·(q − c)), där m pekar mot bitens mitt.
    const mx = Math.cos(tm) * s * kk;
    const my = Math.sin(tm) * s * kk;
    const under: Plane = [mx, my, zc - mx * c[0] - my * c[1]];
    for (const rings of parts) out.push({ rings, under, top: lift(under) });
  }
  return out;
}

/** Takets lägsta och högsta punkt på undersidan och ovansidan, mm över golvet. */
export function roofRange(p: RoofParams): { underMin: number; topMax: number } {
  const f = roofFrame(p);
  const ring = outlineRing(p);
  if (!ring.length) return { underMin: p.height, topMax: p.height };
  let lo = Infinity;
  let hi = -Infinity;
  for (const q of ring) {
    lo = Math.min(lo, f.under(q));
    hi = Math.max(hi, f.top(q));
  }
  // En kons spets kan ligga inne i konturen eller på den.
  const apex = f.arc && (pointIn(f.arc.center, ring) || ring.some((q, i) => distToSegment(f.arc!.center, q, ring[(i + 1) % ring.length]) < 1));
  if (apex && f.arc!.sigma < 0) hi = Math.max(hi, f.top(f.arc!.center));
  if (apex && f.arc!.sigma > 0) lo = Math.min(lo, f.under(f.arc!.center));
  return { underMin: lo, topMax: hi };
}

function pointIn(q: Vec2, ring: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a[1] > q[1] !== b[1] > q[1] && q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** En del av en vägg med sin ovansida: en höjd eller ett plan. */
interface TopPiece {
  rings: Rings;
  /** Sned ovansida, eller utelämnad för väggens egen höjd. */
  top?: Plane;
}

/** Ett takfall som en vägg kan kapas av: delen där taket ligger ovanför väggens fot. */
interface Claim {
  rp: RoofPlane;
  region: Rings[];
  box: Box;
}

const claims = new WeakMap<readonly RoofPlane[], Claim[]>();

/** Taken ordnade nerifrån, med delen av varje som ligger ovanför höjden 0 (väggens fot). */
function claimsOf(roofs: readonly RoofPlane[]): Claim[] {
  const hit = claims.get(roofs);
  if (hit) return hit;
  const out: Claim[] = [];
  const sorted = [...roofs].sort((a, b) => planeRange(a.under, a.rings)[0] - planeRange(b.under, b.rings)[0]);
  for (const rp of sorted) {
    const [lo, hi] = planeRange(rp.under, rp.rings);
    if (hi <= 0) continue;
    const above = lo > 0 ? null : halfPlaneBelow([-rp.under[0], -rp.under[1], -rp.under[2]], 0);
    const region = above ? intersection(rp.rings, [above]) : [rp.rings];
    if (region.length) out.push({ rp, region, box: boxOf(rp.rings) });
  }
  claims.set(roofs, out);
  return out;
}

/**
 * Dela en vägg efter taken ovanför. Under ett takfall kapas väggen av takets
 * undersida där den går upp i taket; med `toRoof` går den hela vägen upp
 * till taket även där den annars hade slutat lägre, under tak på samma
 * våning. Tak som ligger under väggens fot (på en våning under, 0.10)
 * påverkar den inte. Höjderna är väggens våning.
 */
export function trimToRoofs(piece: Rings, height: number, toRoof: boolean, roofs: readonly RoofPlane[]): TopPiece[] {
  if (!roofs.length) return [{ rings: piece }];
  let rest: Rings[] = [piece];
  const out: TopPiece[] = [];
  for (const { rp, region, box } of claimsOf(roofs)) {
    const next: Rings[] = [];
    for (const r of rest) {
      if (!boxesTouch(boxOf(r), box)) {
        next.push(r);
        continue;
      }
      for (const q of intersection(r, region)) {
        if (toRoof && !rp.foreign) {
          out.push({ rings: q, top: rp.under });
          continue;
        }
        // Där taket är lägre än väggen kapas den; annars står den kvar.
        const below = halfPlaneBelow(rp.under, height);
        if (!below) {
          out.push({ rings: q });
          continue;
        }
        for (const lo of intersection(q, [below])) out.push({ rings: lo, top: rp.under });
        for (const hi of difference(q, [below])) out.push({ rings: hi });
      }
      next.push(...difference(r, region));
    }
    rest = next;
  }
  for (const r of rest) out.push({ rings: r });
  return out.filter((t) => t.rings.length && t.rings[0].length >= 3);
}

/** Området i plan där planet ligger lägre än höjden h, som en stor polygon. Null om det inte finns något sådant. */
export function halfPlaneBelow(pl: Plane, h: number): Rings | null {
  const g = Math.hypot(pl[0], pl[1]);
  if (g < 1e-9) return pl[2] < h ? [[[-BIG, -BIG], [BIG, -BIG], [BIG, BIG], [-BIG, BIG]]] : null;
  const gx = pl[0] / g;
  const gy = pl[1] / g;
  // Linjen där planet når h: g·p = (h − c)/|g|. Under den ligger planet lägre.
  const d = (h - pl[2]) / g;
  const p0: Vec2 = [gx * d, gy * d];
  const t: Vec2 = [-gy, gx];
  return [
    [
      [p0[0] + t[0] * BIG, p0[1] + t[1] * BIG],
      [p0[0] - t[0] * BIG, p0[1] - t[1] * BIG],
      [p0[0] - t[0] * BIG - gx * BIG, p0[1] - t[1] * BIG - gy * BIG],
      [p0[0] + t[0] * BIG - gx * BIG, p0[1] + t[1] * BIG - gy * BIG],
    ],
  ];
}

/** Högsta och lägsta värdet av ett plan över en form. */
export function planeRange(pl: Plane, rings: Rings): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const ring of rings)
    for (const q of ring) {
      const z = zOn(pl, q[0], q[1]);
      lo = Math.min(lo, z);
      hi = Math.max(hi, z);
    }
  return [lo, hi];
}



/** Kanterna längs konturen, med bågar som korta bitar (och raka kanter på en kon delade). */
export function outlineEdges(p: RoofParams): [Vec2, Vec2, number][] {
  const pts = p.outline as Vec2[];
  const out: [Vec2, Vec2, number][] = [];
  const cone = !!refArc(p);
  for (let i = 0; i < segmentCount(pts.length, true); i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const bulge = p.bulges?.[i] ?? 0;
    const chain = arcFromBulge(a, b, bulge) ? shapePoints({ shape: 'polyline', points: [[a[0], a[1]], [b[0], b[1]]], bulges: [bulge] }).points : [a, b];
    for (let k = 0; k + 1 < chain.length; k++) {
      const x = chain[k];
      const y = chain[k + 1];
      // På en kon är höjden längs en rak kant inte rak: dela den.
      const parts = cone ? Math.max(1, Math.ceil(dist(x, y) / 300)) : 1;
      for (let s = 0; s < parts; s++) {
        const t0 = s / parts;
        const t1 = (s + 1) / parts;
        out.push([
          [x[0] + (y[0] - x[0]) * t0, x[1] + (y[1] - x[1]) * t0],
          [x[0] + (y[0] - x[0]) * t1, x[1] + (y[1] - x[1]) * t1],
          i,
        ]);
      }
    }
  }
  return out;
}
