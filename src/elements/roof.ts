import { difference, intersection, type Rings } from '../geometry/boolean';
import { left } from '../geometry/vec';
import type { Primitive, Vec2 } from '../repr/primitives';
import { zOn, type Edges3D, type Plane, type Shape3D } from '../repr/solids';
import type { ElementType } from './registry';

/**
 * Tak (format 4). Ett enkelt tak över en kontur: sadeltak med nock mitt
 * emellan takfötterna, eller pulpettak som stiger åt ett håll. Det räcker
 * för att pröva fasader och sektioner; riktiga tak med valmning, kupor och
 * skikt kommer med våningsplanen.
 *
 * Höjderna räknas från våningens golv. `eave` är takets undersida vid
 * takfoten, alltså vid konturen; nocken hamnar där lutningen tar den.
 */
export interface RoofParams {
  /** Takets kontur i plan, med utsprång (takfot och gavlar), mm. */
  outline: [number, number][];
  kind: 'gable' | 'shed';
  /** Taklutning i grader. */
  slope: number;
  /** Undersidans höjd vid takfoten, mm över golvet. */
  eave: number;
  /** Takets tjocklek vinkelrätt mot takytan, mm. */
  thickness: number;
  /**
   * Nockens riktning i grader (moturs från x-axeln). För pulpettak
   * takfotens riktning; taket stiger åt vänster sett i den riktningen.
   */
  ridge: number;
}

/** Ett takfall: dess yta i plan, undersidan och ovansidan. */
export interface RoofPlane {
  rings: Rings;
  under: Plane;
  top: Plane;
}

const BIG = 1e6;

/** Taket i takfall, med plan för under- och ovansida. */
export function roofPlanes(p: RoofParams): RoofPlane[] {
  const pts = p.outline;
  if (pts.length < 3) return [];
  const r = (p.ridge * Math.PI) / 180;
  const a: Vec2 = [Math.cos(r), Math.sin(r)];
  const n = left(a);
  const ws = pts.map((q) => q[0] * n[0] + q[1] * n[1]);
  const wMin = Math.min(...ws);
  const wMax = Math.max(...ws);
  const k = Math.tan((Math.max(0, Math.min(80, p.slope)) * Math.PI) / 180);
  const tv = p.thickness / Math.cos(Math.atan(k));
  const outline: Rings = [pts.map((q) => [q[0], q[1]] as Vec2)];
  const plane = (sign: 1 | -1, c: number): Plane => [sign * k * n[0], sign * k * n[1], c];
  const lift = (pl: Plane, d: number): Plane => [pl[0], pl[1], pl[2] + d];

  if (p.kind === 'shed') {
    const under = plane(1, p.eave - k * wMin);
    return [{ rings: outline, under, top: lift(under, tv) }];
  }
  const wMid = (wMin + wMax) / 2;
  const half = (from: number, to: number): Rings => {
    const at = (s: number, w: number): Vec2 => [a[0] * s + n[0] * w, a[1] * s + n[1] * w];
    return [[at(-BIG, from), at(BIG, from), at(BIG, to), at(-BIG, to)]];
  };
  const out: RoofPlane[] = [];
  // Vänster takfall (större w) sluttar ned mot wMax, höger mot wMin.
  const leftUnder = plane(-1, p.eave + k * wMax);
  const rightUnder = plane(1, p.eave - k * wMin);
  for (const rings of intersection(outline, [half(wMid, BIG)])) out.push({ rings, under: leftUnder, top: lift(leftUnder, tv) });
  for (const rings of intersection(outline, [half(-BIG, wMid)])) out.push({ rings, under: rightUnder, top: lift(rightUnder, tv) });
  return out;
}

/** Nocklinjen i plan för sadeltak: där mittlinjen skär konturen. */
export function ridgeLine(p: RoofParams): [Vec2, Vec2] | null {
  if (p.kind !== 'gable' || p.outline.length < 3) return null;
  const r = (p.ridge * Math.PI) / 180;
  const a: Vec2 = [Math.cos(r), Math.sin(r)];
  const n = left(a);
  const ws = p.outline.map((q) => q[0] * n[0] + q[1] * n[1]);
  const wMid = (Math.min(...ws) + Math.max(...ws)) / 2;
  const ss = p.outline.map((q) => q[0] * a[0] + q[1] * a[1]);
  // Skär linjen w = wMid med konturens kanter.
  const hits: number[] = [];
  for (let i = 0; i < p.outline.length; i++) {
    const j = (i + 1) % p.outline.length;
    const w1 = ws[i] - wMid;
    const w2 = ws[j] - wMid;
    if (w1 === w2 || w1 * w2 > 0) continue;
    const t = w1 / (w1 - w2);
    hits.push(ss[i] + (ss[j] - ss[i]) * t);
  }
  if (hits.length < 2) return null;
  const s0 = Math.min(...hits);
  const s1 = Math.max(...hits);
  const at = (s: number): Vec2 => [a[0] * s + n[0] * wMid, a[1] * s + n[1] * wMid];
  return [at(s0), at(s1)];
}

/** En del av en vägg med sin ovansida: en höjd eller ett plan. */
export interface TopPiece {
  rings: Rings;
  /** Sned ovansida, eller utelämnad för väggens egen höjd. */
  top?: Plane;
}

/**
 * Dela en vägg efter taken ovanför. Under ett takfall kapas väggen av takets
 * undersida där den går upp i taket; med `toRoof` går den hela vägen upp
 * till taket även där den annars hade slutat lägre.
 */
export function trimToRoofs(piece: Rings, height: number, toRoof: boolean, roofs: readonly RoofPlane[]): TopPiece[] {
  if (!roofs.length) return [{ rings: piece }];
  let rest: Rings[] = [piece];
  const out: TopPiece[] = [];
  for (const rp of roofs) {
    const next: Rings[] = [];
    for (const r of rest) {
      for (const q of intersection(r, [rp.rings])) {
        if (toRoof) {
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
      next.push(...difference(r, [rp.rings]));
    }
    rest = next;
  }
  for (const r of rest) out.push({ rings: r });
  return out.filter((t) => t.rings.length && t.rings[0].length >= 3);
}

/** Området i plan där planet ligger lägre än höjden h, som en stor polygon. Null om planet är vågrätt. */
function halfPlaneBelow(pl: Plane, h: number): Rings | null {
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

export const roofType: ElementType<RoofParams> = {
  type: 'Roof',
  planReads: [],
  label: 'Tak',
  labelPlural: 'Tak',
  drawOrder: 70,
  compares: true,
  defaults: () => ({ outline: [], kind: 'gable', slope: 27, eave: 2700, thickness: 300, ridge: 0 }),

  plan(el, ctx) {
    const p = ctx.params<RoofParams>(el);
    const origin = { objectId: el.id, objectType: 'Roof' };
    // Taket ligger ovanför snittet: streckat, som överliggande.
    const pen = { weight: 0.18, dash: [3, 1.5] as const };
    const out: Primitive[] = [];
    const pts = p.outline;
    for (let i = 0; i < pts.length; i++) out.push({ kind: 'line', a: pts[i], b: pts[(i + 1) % pts.length], pen, origin });
    const ridge = ridgeLine(p);
    if (ridge) out.push({ kind: 'line', a: ridge[0], b: ridge[1], pen, origin: { ...origin, part: 'nock' } });
    return out;
  },

  model3d(el, ctx) {
    const p = ctx.params<RoofParams>(el);
    const out: Shape3D[] = [];
    // Egna kantlinjer: takfallen möts i nocken utan synlig skarv i gaveln.
    const edges: Edges3D = { kind: 'edges', id: el.id, segments: [], part: 'roof' };
    const corner = (q: Vec2) => p.outline.some((o) => Math.abs(o[0] - q[0]) < 0.6 && Math.abs(o[1] - q[1]) < 0.6);
    for (const rp of roofPlanes(p)) {
      const [z0] = planeRange(rp.under, rp.rings);
      const [, z1] = planeRange(rp.top, rp.rings);
      out.push({ id: el.id, rings: rp.rings, z0, z1, bottom: rp.under, top: rp.top, material: 'roof', noEdges: true });
      for (const ring of rp.rings) {
        ring.forEach((a, i) => {
          const b = ring[(i + 1) % ring.length];
          for (const pl of [rp.under, rp.top]) edges.segments.push([a[0], a[1], zOn(pl, a[0], a[1]), b[0], b[1], zOn(pl, b[0], b[1])]);
          if (corner(a)) edges.segments.push([a[0], a[1], zOn(rp.under, a[0], a[1]), a[0], a[1], zOn(rp.top, a[0], a[1])]);
        });
      }
    }
    out.push(edges);
    return out;
  },
};
