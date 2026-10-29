import type { Element } from '../core/model';
import { arcFromBulge, type Arc } from '../geometry/arc';
import { boxesTouch, boxOf, difference, intersection, type Box, type Rings } from '../geometry/boolean';
import { dist, distToSegment, left, norm, sub } from '../geometry/vec';
import type { Pen, Primitive, Vec2 } from '../repr/primitives';
import { zOn, type Edges3D, type Plane, type Shape3D } from '../repr/solids';
import { segmentCount, shapePoints } from './drawing2d';
import { bodyEdges, roofBody, type EdgeCut, type EdgeCutOverride } from './roofBody';
import { buildingFootprint } from './footprint';
import { roofPlanPrims, roofShownOn } from './roofPlan';
import type { ElementType, PlanContext } from './registry';
import type { FillParams } from './fill2d';
import { buildingMaterialOf, materialSolid } from './buildingMaterial';

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
export interface TopPiece {
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

/**
 * Alla takfall som kan kapa väggarna på våningen i sammanhanget: också de
 * på andra våningar (0.10), flyttade till den här våningens höjder.
 */
export function roofPlanesAround(ctx: PlanContext): RoofPlane[] {
  const here = ctx.storey ? ctx.doc.storeys.find((s) => s.id === ctx.storey) : undefined;
  const own = (els: { el: Element; dz: number }[]) =>
    els.flatMap(({ el, dz }) =>
      roofBodyOf(ctx, ctx.params<RoofParams>(el)).map((rp): RoofPlane => (el.storey !== ctx.storey ? { rings: rp.rings, under: liftPlane(rp.under, dz), top: liftPlane(rp.top, dz), foreign: true } : rp)),
    );
  if (!here) return own(ctx.visible('Roof').filter((r) => ctx.actionOf(r) !== 'demolished').map((el) => ({ el, dz: 0 })));
  if (ctx.view.hide?.includes('Roof')) return [];
  const elevation = new Map(ctx.doc.storeys.map((s) => [s.id, s.elevation]));
  const list: { el: Element; dz: number }[] = [];
  for (const el of Object.values(ctx.doc.elements)) {
    if (el.type !== 'Roof' || el.space || !elevation.has(el.storey)) continue;
    const a = ctx.actionOf(el);
    if (a === 'absent' || a === 'demolished') continue;
    list.push({ el, dz: elevation.get(el.storey)! - here.elevation });
  }
  return own(list);
}

const liftPlane = (pl: Plane, dz: number): Plane => [pl[0], pl[1], pl[2] + dz];

/** Takets kropp i sammanhanget (0.10.2): med språnget utanför husets kontur. */
export const roofBodyOf = (ctx: PlanContext, p: RoofParams) => roofBody(p, () => buildingFootprint(ctx));

/**
 * Hörn där två takfall möts i en skarv som inte syns: där ett annat takfall
 * på våningen har samma hörn och samma höjd, och de två konturernas fria
 * kanter fortsätter i samma riktning (som gaveln på ett sadeltak vid nocken).
 */
function seams(ctx: PlanContext): Map<string, Vec2[][]> {
  return ctx.memo('roof-seams', () => {
    const roofs = ctx.visible('Roof').map((el) => {
      const p = ctx.params<RoofParams>(el);
      const f = roofFrame(p);
      return { id: el.id, pts: p.outline as Vec2[], top: f.top };
    });
    const out = new Map<string, Vec2[][]>();
    const near = (a: Vec2, b: Vec2) => Math.abs(a[0] - b[0]) < 1 && Math.abs(a[1] - b[1]) < 1;
    for (const r of roofs) {
      const n = r.pts.length;
      const list: Vec2[][] = [];
      r.pts.forEach((v, i) => {
        const prev = r.pts[(i - 1 + n) % n];
        const next = r.pts[(i + 1) % n];
        for (const o of roofs) {
          if (o === r) continue;
          const j = o.pts.findIndex((q) => near(q, v));
          if (j < 0 || Math.abs(o.top(o.pts[j]) - r.top(v)) > 1) continue;
          const m = o.pts.length;
          const oPrev = o.pts[(j - 1 + m) % m];
          const oNext = o.pts[(j + 1) % m];
          // Den gemensamma kanten och de två fria.
          let free: Vec2 | null = null;
          let oFree: Vec2 | null = null;
          if (near(next, oPrev)) [free, oFree] = [prev, oNext];
          else if (near(prev, oNext)) [free, oFree] = [next, oPrev];
          if (!free || !oFree) continue;
          const a = norm(sub(free, v));
          const b = norm(sub(oFree, v));
          // Raka motsatta riktningar: kanterna ligger på en linje.
          if (a[0] * b[0] + a[1] * b[1] < -0.9999) list.push([v]);
        }
      });
      out.set(r.id, list);
    }
    return out;
  });
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

/** Konturens kanter i plan: raka som linjer, bågar som polylinjer. */
export function outlinePrims(p: Pick<RoofParams, 'outline' | 'bulges'>, pen: Pen, origin: Primitive['origin']): Primitive[] {
  const pts = p.outline as Vec2[];
  const out: Primitive[] = [];
  for (let i = 0; i < segmentCount(pts.length, true); i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const bulge = p.bulges?.[i] ?? 0;
    if (!arcFromBulge(a, b, bulge)) out.push({ kind: 'line', a, b, pen, origin });
    else out.push({ kind: 'polyline', points: shapePoints({ shape: 'polyline', points: [[a[0], a[1]], [b[0], b[1]]], bulges: [bulge] }).points, closed: false, pen, origin });
  }
  return out;
}

export const roofType: ElementType<RoofParams> = {
  type: 'Roof',
  // Husets kontur genom taket och språnget läser väggarna (0.10.2).
  planReads: ['Wall'],
  label: 'Tak',
  labelPlural: 'Tak',
  drawOrder: 70,
  compares: true,
  defaults: () => ({ outline: [], ref: [[0, 0], [1000, 0]], height: 2700, slope: 27, thickness: 300 }),

  // Ovanför snittet punktstreckat, under heldraget, och snittytan där planet skär (0.10.2).
  plan: (el, ctx) => roofPlanPrims(el, ctx),
  alsoOnStorey: roofShownOn,

  model3d(el, ctx) {
    const p = ctx.params<RoofParams>(el);
    const out: Shape3D[] = [];
    const body = roofBodyOf(ctx, p);
    if (!body.length) return out;
    // Materialets kulör (0.10.28.2).
    const mat = materialSolid(buildingMaterialOf(p, ctx.style));
    for (const pc of body) {
      const [z0] = planeRange(pc.under, pc.rings);
      const [, z1] = planeRange(pc.top, pc.rings);
      out.push({ id: el.id, rings: pc.rings, z0, z1, bottom: pc.under, top: pc.top, material: 'roof', noEdges: true, ...mat });
    }
    // Egna kantlinjer: konturen på ovansidan, undersidan med språnget och
    // takfotens snitt, och de lodräta hörnen, utom skarvar mot ett annat
    // takfall som inte syns (0.10).
    const f = roofFrame(p);
    const edges: Edges3D = { kind: 'edges', id: el.id, segments: [], part: 'roof' };
    for (const [a, b] of outlineEdges(p)) edges.segments.push([a[0], a[1], f.top(a), b[0], b[1], f.top(b)]);
    const hidden = seams(ctx).get(el.id) ?? [];
    const corners = (p.outline as Vec2[]).filter((v) => !hidden.some(([q]) => Math.abs(q[0] - v[0]) < 1 && Math.abs(q[1] - v[1]) < 1));
    edges.segments.push(...bodyEdges(body, corners, f.top));
    out.push(edges);
    return out;
  },
};
