import { difference, union, type Rings } from '../geometry/boolean';
import { pointInRings } from '../geometry/vec';
import type { Primitive, Vec2 } from '../repr/primitives';
import { lastResults } from '../repr/reuse';
import type { Shape3D } from '../repr/solids';
import { resolveParams, type ElementType, type PlanContext } from './registry';
import { bareWallShapes, bareWallUnion, wallFrame, type WallParams } from './wall';
import type { Element, Id, ProjectDoc } from '../core/model';

/**
 * Bjälklag (0.9.1, format 15). Golvet i en våning: ovansidan ligger i
 * våningens golvnivå och tjockleken går nedåt. Plattan på mark är bjälklaget
 * i plan 1. Tjockleken hör till typen (littera BJ01 …).
 *
 * Konturen ritas, eller tas ur väggarna (`fromWalls`): husets ytterkontur
 * utan ytterväggarna, så att bjälklaget slutar vid ytterväggarnas insida och
 * väggarna går obrutna golv till golv i sektionen. Innerväggarna står på
 * bjälklaget. Konturen räknas om vid varje ritning, som rummens, och följer
 * alltså väggarna när de flyttas. Håltagningar dras ifrån och ritas med
 * kryss i planen.
 */
export interface SlabParams {
  /** Tjockleken nedåt från golvnivån, mm (typens). */
  thickness: number;
  /** Den ritade konturen, mm. Tom när konturen tas ur väggarna. */
  outline: [number, number][];
  /** Konturen följer ytterväggarnas insida. */
  fromWalls?: boolean;
  /** Håltagningar, var och en en kontur i mm. */
  holes?: [number, number][][];
}

/** Ytterväggarna: en vägg vars ena sida ligger inne i huset och den andra ute. */
function isExterior(p: WallParams, outlines: Rings): boolean {
  const f = wallFrame(p);
  const probe = f.half + 60;
  for (const t of [0.5, 0.3, 0.7, 0.15, 0.85]) {
    const inside = (o: number) => outlines.some((ring) => pointInRings(f.at(f.length * t, o), [ring]));
    if (inside(probe) !== inside(-probe)) return true;
  }
  return false;
}

/**
 * Ytan innanför ytterväggarna på en våning: husets ytterkontur minus
 * ytterväggarnas massa. Samma väggar ger samma svar.
 */
export function insideWalls(walls: { id: string; p: WallParams }[]): Rings[] {
  return savedInside(walls.flatMap((w) => [w.id, w.p]), () => {
    if (!walls.length) return [];
    const outlines = bareWallUnion(walls).map((poly) => poly[0]);
    const shapes = bareWallShapes(walls);
    const exterior = walls.filter((w) => isExterior(w.p, outlines)).flatMap((w) => shapes.get(w.id) ?? []);
    // Fristående väggar och sådant utan inne och ute ger inget bjälklag.
    return outlines.flatMap((ring) => difference([ring], exterior)).filter((r) => r.length && r[0].length >= 3);
  });
}
const savedInside = lastResults<Rings[]>();

/** Bjälklagets ytor i vyn: konturen (ritad eller ur väggarna) utan håltagningarna. */
export function slabRings(ctx: PlanContext, el: Element<any>): Rings[] {
  const p = ctx.params<SlabParams>(el);
  const base = slabBase(ctx, p);
  const holes = (p.holes ?? []).filter((h) => h.length >= 3).map((h): Rings => [h.map((q): Vec2 => [q[0], q[1]])]);
  if (!holes.length) return base;
  return base.flatMap((poly) => difference(poly, holes));
}

/** Konturen utan håltagningarna: den ritade, eller ytan innanför ytterväggarna. */
export function slabBase(ctx: PlanContext, p: SlabParams): Rings[] {
  if (p.fromWalls) return ctx.memo('slab-inside-walls', () => insideWalls(ctx.visible('Wall').map((w) => ({ id: w.id, p: ctx.params<WallParams>(w) }))));
  return p.outline.length >= 3 ? [[p.outline.map((q): Vec2 => [q[0], q[1]])]] : [];
}

/**
 * Bjälklaget på våningen som punkten ligger i, i ett tillstånd (för
 * håltagningen). Räknat ur dokumentet, utan en ritad vy. Det minsta vinner.
 */
export function slabAt(doc: ProjectDoc, storey: Id, state: Id, pt: Vec2): Id | null {
  const here = Object.values(doc.elements).filter((e) => e.storey === storey && !e.space && e.states.includes(state));
  const walls = here.filter((e) => e.type === 'Wall').map((e) => ({ id: e.id, p: resolveParams<WallParams>(doc, e) }));
  let best: { id: Id; area: number } | null = null;
  for (const el of here) {
    if (el.type !== 'Slab') continue;
    const p = resolveParams<SlabParams>(doc, el);
    const base = p.fromWalls ? insideWalls(walls) : p.outline.length >= 3 ? [[p.outline as Vec2[]]] : [];
    for (const poly of base) {
      if (!pointInRings(pt, poly)) continue;
      const area = Math.abs(ringArea(poly[0]));
      if (!best || area < best.area) best = { id: el.id, area };
    }
  }
  return best?.id ?? null;
}

export function ringArea(r: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i];
    const q = r[(i + 1) % r.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** Ytorna för alla bjälklag på våningen, sammanslagna (för rummens golvskiva). */
export function slabsOn(ctx: PlanContext): Rings[] {
  return ctx.memo('slabs', () => {
    const all = ctx
      .visible('Slab')
      .filter((el) => ctx.actionOf(el) !== 'demolished')
      .flatMap((el) => slabRings(ctx, el));
    return all.length > 1 ? union(all) : all;
  });
}

/** Krysset i en håltagning: diagonalerna mellan motstående hörn. */
export function holeCross(h: readonly Vec2[]): [Vec2, Vec2][] {
  const n = h.length;
  if (n < 3) return [];
  if (n === 4) return [[h[0], h[2]], [h[1], h[3]]];
  // Andra former: från varje hörn till det som ligger längst bort, de två längsta.
  const pairs: { a: Vec2; b: Vec2; d: number }[] = [];
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) if (!(i === 0 && j === n - 1)) pairs.push({ a: h[i], b: h[j], d: Math.hypot(h[j][0] - h[i][0], h[j][1] - h[i][1]) });
  pairs.sort((x, y) => y.d - x.d);
  return pairs.slice(0, 2).map((q): [Vec2, Vec2] => [q.a, q.b]);
}

export const slabType: ElementType<SlabParams> = {
  type: 'Slab',
  planReads: ['Wall'],
  label: 'Bjälklag',
  labelPlural: 'Bjälklag',
  litteraPrefix: 'BJ',
  drawOrder: 5,
  compares: true,
  typeParams: ['thickness'],
  defaults: () => ({ thickness: 300, outline: [] }),

  plan(el, ctx) {
    const p = ctx.params<SlabParams>(el);
    const origin = { objectId: el.id, objectType: 'Slab' };
    const out: Primitive[] = [];
    // Bjälklaget ligger under snittet: tunna linjer, under väggarna. Som
    // linjer, inte en sluten form, så att ett klick i ett rum inte träffar bjälklaget.
    const pen = { weight: 0.13 };
    const edges = (ring: readonly Vec2[], part: string, under: boolean) => {
      for (let i = 0; i < ring.length; i++) out.push({ kind: 'line', a: ring[i], b: ring[(i + 1) % ring.length], pen, ...(under ? { under: true } : {}), origin: { ...origin, part } });
    };
    for (const poly of slabBase(ctx, p)) for (const ring of poly) edges(ring, 'kontur', true);
    // Håltagningarna med kryss.
    for (const h of p.holes ?? []) {
      if (h.length < 3) continue;
      edges(h, 'hål', false);
      for (const [a, b] of holeCross(h)) out.push({ kind: 'line', a, b, pen, origin: { ...origin, part: 'hål' } });
    }
    return out;
  },

  model3d(el, ctx) {
    const p = ctx.params<SlabParams>(el);
    const t = Math.max(1, p.thickness);
    return slabRings(ctx, el).map((rings): Shape3D => ({ id: el.id, rings, z0: -t, z1: 0, material: 'slab' }));
  },
};
