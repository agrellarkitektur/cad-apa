import { boxesTouch, boxOf, difference, intersection, type Box, type Rings } from '../geometry/boolean';
import { signedArea } from '../geometry/chains';
import { dist, left, norm, pointInRings, sub } from '../geometry/vec';
import type { Vec2 } from '../repr/primitives';
import { zOn, type Plane } from '../repr/solids';
import { arcFromBulge } from '../geometry/arc';
import { segmentCount, shapePoints } from './drawing2d';
import { halfPlaneBelow, outlineRing, roofFrame, roofPlanes, type RoofParams } from './roof';

/**
 * Takets kropp (0.10.2): takfallets plana bitar med språngets tjocklek och
 * takfotens snitt. Ovansidan är takets egen; undersidan är takets där det
 * ligger över huset, språngets utanför ytterväggarnas utsida (`footprint`),
 * och i en remsa längs en kant som snittas snett ett plan genom ovansidans
 * kant (`EdgeCut`). Väggarna kapas, och 3D, fasader och sektioner ritas,
 * efter samma bitar.
 */

/** Hur en kant snittas: vinkelrätt mot takytan, lodrätt eller med en vinkel mot det vågräta (grader). */
export type EdgeCut = 'perp' | 'plumb' | number;

/** En kants eget snitt, känt igen på kantens två hörn (åt vilket håll som helst). */
export interface EdgeCutOverride {
  a: [number, number];
  b: [number, number];
  cut: EdgeCut;
}

/** En bit av kroppen. `kind` skiljer takets, språngets och snittens bitar åt, för kantlinjerna. */
export interface BodyPiece {
  rings: Rings;
  under: Plane;
  top: Plane;
  kind: string;
}

const near = (a: readonly number[], b: readonly number[]) => Math.abs(a[0] - b[0]) < 1 && Math.abs(a[1] - b[1]) < 1;

/** Kantens eget snitt, om det har något. */
export function ownCut(p: Pick<RoofParams, 'outline' | 'edgeCuts'>, i: number): EdgeCut | undefined {
  const a = p.outline[i];
  const b = p.outline[(i + 1) % p.outline.length];
  if (!a || !b) return undefined;
  return p.edgeCuts?.find((o) => (near(o.a, a) && near(o.b, b)) || (near(o.a, b) && near(o.b, a)))?.cut;
}

/** Kantens snitt efter att det eget satts eller tagits bort (`cut` utelämnat). */
export function withOwnCut(p: Pick<RoofParams, 'outline' | 'edgeCuts'>, i: number, cut?: EdgeCut): EdgeCutOverride[] | undefined {
  const a = p.outline[i];
  const b = p.outline[(i + 1) % p.outline.length];
  const rest = (p.edgeCuts ?? []).filter((o) => !((near(o.a, a) && near(o.b, b)) || (near(o.a, b) && near(o.b, a))));
  const next = cut === undefined ? rest : [...rest, { a: [a[0], a[1]] as [number, number], b: [b[0], b[1]] as [number, number], cut }];
  return next.length ? next : undefined;
}

/** Konturens orientering: 1 när den går moturs (insidan till vänster), annars -1. */
function sideOf(ring: readonly Vec2[]): 1 | -1 {
  return signedArea(ring) >= 0 ? 1 : -1;
}

/** En bit av konturen: två punkter, kanten den hör till och normalen in mot taket. */
interface EdgeBit {
  a: Vec2;
  b: Vec2;
  edge: number;
  inward: Vec2;
}

/** Konturens kanter som raka bitar (bågar i korta bitar), med normalen inåt. */
function edgeBits(p: RoofParams): EdgeBit[] {
  const pts = p.outline as Vec2[];
  const s = sideOf(outlineRing(p));
  const out: EdgeBit[] = [];
  for (let i = 0; i < segmentCount(pts.length, true); i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const bulge = p.bulges?.[i] ?? 0;
    const chain = arcFromBulge(a, b, bulge) ? shapePoints({ shape: 'polyline', points: [[a[0], a[1]], [b[0], b[1]]], bulges: [bulge] }).points : [a, b];
    for (let k = 0; k + 1 < chain.length; k++) {
      const x = chain[k];
      const y = chain[k + 1];
      if (dist(x, y) < 1) continue;
      const l = left(norm(sub(y, x)));
      out.push({ a: x, b: y, edge: i, inward: [l[0] * s, l[1] * s] });
    }
  }
  return out;
}

/**
 * Om kanten är takfot: den vetter nedåt i lutningen, så att taket stiger in
 * från den. Nock, grat och gavel vetter uppåt eller åt sidan.
 */
export function isEave(p: RoofParams, bit: { a: Vec2; b: Vec2; inward: Vec2 }): boolean {
  const f = roofFrame(p);
  const m: Vec2 = [(bit.a[0] + bit.b[0]) / 2, (bit.a[1] + bit.b[1]) / 2];
  const gx = f.under([m[0] + 1, m[1]]) - f.under(m);
  const gy = f.under([m[0], m[1] + 1]) - f.under(m);
  const g = Math.hypot(gx, gy);
  if (g < 1e-6) return false;
  return (gx * bit.inward[0] + gy * bit.inward[1]) / g > 0.5;
}

/** Snittet för en bit av konturen: kantens eget, annars takfotens för takfot och lodrätt för resten. */
function cutFor(p: RoofParams, bit: EdgeBit): EdgeCut {
  return ownCut(p, bit.edge) ?? (isEave(p, bit) ? (p.eaveCut ?? 'perp') : 'plumb');
}

/**
 * Snittets plan genom ovansidans kant a–b, eller null för lodrätt (också när
 * snittet inte går in under ovansidan, som vinkelrätt vid en nock).
 */
export function cutPlane(top: Plane, a: Vec2, b: Vec2, inward: Vec2, cut: EdgeCut): Plane | null {
  if (cut === 'plumb') return null;
  const za = zOn(top, a[0], a[1]);
  let pl: Plane;
  if (cut === 'perp') {
    // Planet genom kanten och takytans normal.
    const u = [b[0] - a[0], b[1] - a[1], zOn(top, b[0], b[1]) - za];
    const v = [-top[0], -top[1], 1];
    const mx = u[1] * v[2] - u[2] * v[1];
    const my = u[2] * v[0] - u[0] * v[2];
    const mz = u[0] * v[1] - u[1] * v[0];
    if (Math.abs(mz) < 1e-9 * Math.hypot(mx, my, mz)) return null;
    pl = [-mx / mz, -my / mz, za + (mx * a[0] + my * a[1]) / mz];
  } else {
    const beta = Math.max(1, Math.min(90, cut));
    if (beta >= 89.95) return null;
    // Lutar som ovansidan längs kanten och går ned med vinkeln in mot taket.
    const e = norm(sub(b, a));
    const along = top[0] * e[0] + top[1] * e[1];
    const t = Math.tan((beta * Math.PI) / 180);
    const gx = along * e[0] - t * inward[0];
    const gy = along * e[1] - t * inward[1];
    pl = [gx, gy, za - gx * a[0] - gy * a[1]];
  }
  // Snittet måste gå ned under ovansidan in mot taket.
  const down = (top[0] - pl[0]) * inward[0] + (top[1] - pl[1]) * inward[1];
  return down > 1e-6 ? pl : null;
}

const cache = new WeakMap<object, { fp: Rings[] | null; body: BodyPiece[] }>();

/**
 * Kroppens bitar. `footprint` är husets kontur (ytterväggarnas utsida) och
 * behövs bara när språnget har en egen tjocklek.
 */
export function roofBody(p: RoofParams, footprint: () => Rings[]): BodyPiece[] {
  const own = p.overhangThickness !== undefined && p.overhangThickness !== p.thickness && p.overhangThickness >= 0;
  const fp = own ? footprint() : null;
  const hit = cache.get(p);
  if (hit && hit.fp === fp) return hit.body;
  const body = buildBody(p, fp);
  cache.set(p, { fp, body });
  return body;
}

function buildBody(p: RoofParams, fp: Rings[] | null): BodyPiece[] {
  let pieces: BodyPiece[] = roofPlanes(p).map((rp) => ({ rings: rp.rings, under: rp.under, top: rp.top, kind: 'in' }));
  if (!pieces.length) return pieces;
  if (fp && fp.length) {
    const f = roofFrame(p);
    const tv = p.overhangThickness! / Math.cos(Math.atan(f.k));
    pieces = pieces.flatMap((pc) => {
      const under: Plane = [pc.top[0], pc.top[1], pc.top[2] - tv];
      return [
        ...intersection(pc.rings, fp).map((rings) => ({ ...pc, rings })),
        ...difference(pc.rings, fp).map((rings) => ({ rings, under, top: pc.top, kind: 'out' })),
      ];
    });
  }
  // Takfotens snitt: en remsa längs kanten, med snittets plan som undersida.
  const bits = edgeBits(p);
  for (const bit of bits) {
    const cut = cutFor(p, bit);
    if (cut === 'plumb') continue;
    const next: BodyPiece[] = [];
    for (const pc of pieces) {
      if (pc.kind.startsWith('cut')) {
        next.push(pc);
        continue;
      }
      // Går en boolesk operation inte att räkna (nästan sammanfallande punkter) blir kanten lodrät.
      let parts: BodyPiece[];
      try {
        const strips = stripOf(pc, bit, cut);
        parts = strips.length
          ? [...strips.map((s) => ({ rings: s.rings, under: s.under, top: pc.top, kind: `cut${bit.edge}` })), ...difference(pc.rings, strips.map((s) => s.rings)).map((rings) => ({ ...pc, rings }))]
          : [pc];
      } catch {
        parts = [pc];
      }
      next.push(...parts);
    }
    pieces = next;
  }
  return pieces.filter((pc) => pc.rings.length && pc.rings[0].length >= 3 && Math.abs(signedArea(pc.rings[0])) > 1);
}

/** Remsan av en bit där snittet längs kanten ligger över bitens undersida. */
function stripOf(pc: BodyPiece, bit: EdgeBit, cut: EdgeCut): { rings: Rings; under: Plane }[] {
  const pl = cutPlane(pc.top, bit.a, bit.b, bit.inward, cut);
  if (!pl) return [];
  // Hur tjockt snittet tar vid kanten, och hur fort det tar slut inåt.
  const d: Plane = [pl[0] - pc.under[0], pl[1] - pc.under[1], pl[2] - pc.under[2]];
  const fall = -(d[0] * bit.inward[0] + d[1] * bit.inward[1]);
  if (fall <= 1e-6) return [];
  const reach = Math.max(zOn(d, bit.a[0], bit.a[1]), zOn(d, bit.b[0], bit.b[1])) / fall;
  if (reach <= 0.5) return [];
  const w = reach + 1;
  const quad: Rings = [[bit.a, bit.b, [bit.b[0] + bit.inward[0] * w, bit.b[1] + bit.inward[1] * w], [bit.a[0] + bit.inward[0] * w, bit.a[1] + bit.inward[1] * w]]];
  if (!boxesTouch(boxOf(pc.rings), boxOf(quad))) return [];
  const above = halfPlaneBelow([-d[0], -d[1], -d[2]], 0);
  if (!above) return [];
  return intersection(pc.rings, [quad])
    .flatMap((r) => intersection(r, [above]))
    .filter((r) => r.length && r[0].length >= 3 && Math.abs(signedArea(r[0])) > 1)
    .map((rings) => ({ rings, under: pl }));
}

type Seg = [number, number, number, number, number, number];

/**
 * Kroppens kantlinjer på undersidan och de lodräta i konturen: undersidans
 * kontur, stegen vid språnget och snittens innerkant. Skarvar mellan bitar
 * av samma slag (konens bitar) syns inte. `corners` är konturens hörn som
 * får en lodrät linje upp till ovansidan; `top` är ovansidans höjd.
 */
export function bodyEdges(pieces: readonly BodyPiece[], corners: readonly Vec2[], top: (q: Vec2) => number): Seg[] {
  const out: Seg[] = [];
  const boxes: Box[] = pieces.map((pc) => boxOf(pc.rings));
  const owner = (q: Vec2, skip: number): number => {
    for (let i = 0; i < pieces.length; i++) {
      if (i === skip) continue;
      const b = boxes[i];
      if (q[0] < b[0] - 1 || q[0] > b[2] + 1 || q[1] < b[1] - 1 || q[1] > b[3] + 1) continue;
      if (pointInRings(q, pieces[i].rings)) return i;
    }
    return -1;
  };
  // Undersidans höjder i konturens punkter, för de lodräta linjerna.
  const verts = new Map<string, { q: Vec2; zs: number[] }>();
  const note = (q: Vec2, z: number) => {
    const key = `${Math.round(q[0])},${Math.round(q[1])}`;
    const v = verts.get(key);
    if (v) v.zs.push(z);
    else verts.set(key, { q, zs: [z] });
  };
  pieces.forEach((pc, i) => {
    for (const ring of pc.rings)
      for (let k = 0; k < ring.length; k++) {
        const a = ring[k];
        const b = ring[(k + 1) % ring.length];
        const len = dist(a, b);
        if (len < 0.5) continue;
        const m: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const l = left(norm(sub(b, a)));
        const probe = (s: number): Vec2 => [m[0] + l[0] * 0.5 * s, m[1] + l[1] * 0.5 * s];
        const outside = pointInRings(probe(1), pc.rings) ? probe(-1) : probe(1);
        const j = owner(outside, i);
        const za = zOn(pc.under, a[0], a[1]);
        const zb = zOn(pc.under, b[0], b[1]);
        if (j < 0) {
          note(a, za);
          note(b, zb);
          // Längs en snittad kant ligger undersidan i ovansidans kant.
          if (Math.abs(za - zOn(pc.top, a[0], a[1])) < 0.5 && Math.abs(zb - zOn(pc.top, b[0], b[1])) < 0.5) continue;
          out.push([a[0], a[1], za, b[0], b[1], zb]);
          continue;
        }
        const o = pieces[j];
        const same = Math.abs(za - zOn(o.under, a[0], a[1])) < 0.5 && Math.abs(zb - zOn(o.under, b[0], b[1])) < 0.5;
        // Ett steg ritas från båda sidorna; ett veck en gång, och inte mellan bitar av samma slag.
        if (!same || (o.kind !== pc.kind && i < j)) out.push([a[0], a[1], za, b[0], b[1], zb]);
      }
  });
  const isCorner = (q: Vec2) => corners.some((c) => Math.abs(c[0] - q[0]) < 1 && Math.abs(c[1] - q[1]) < 1);
  for (const { q, zs } of verts.values()) {
    const lo = Math.min(...zs);
    const hi = isCorner(q) ? top(q) : Math.max(...zs);
    if (hi - lo > 0.5) out.push([q[0], q[1], lo, q[0], q[1], hi]);
  }
  return out;
}
