import { difference, union, type Rings } from '../geometry/boolean';
import { pointInRings } from '../geometry/vec';
import type { Primitive, Vec2 } from '../repr/primitives';
import { lastResults } from '../repr/reuse';
import { levelOf, type Shape3D } from '../repr/solids';
import { ABOVE_PART, planCutPen } from '../repr/planCutPens';
import { zoneInPlan } from './planCut';
import { resolveParams, type ElementType, type PlanContext } from './registry';
import { bareWallShapes, bareWallUnion, wallFrame, type WallParams } from './wall';
import type { Element, Id, ProjectDoc } from '../core/model';
import { segmentArc, segmentCount, shapePoints } from './drawing2d';

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
 * kryss i planen. En håltagning är en sluten form av punkter och bågar,
 * som en 2D-form (format 16), och ändras i Modifiera som en.
 */

/** En håltagning (format 16): punkterna, och pilhöjden för de kanter som är bågar. */
export interface SlabHole {
  points: [number, number][];
  /** Pilhöjd per kant, mm (kant i går från punkt i till i + 1, den sista tillbaka till den första); utelämnad = raka. */
  bulges?: number[];
}
export interface SlabParams {
  /** Tjockleken nedåt från golvnivån, mm (typens). */
  thickness: number;
  /** Den ritade konturen, mm. Tom när konturen tas ur väggarna. */
  outline: [number, number][];
  /** Konturen följer ytterväggarnas insida. */
  fromWalls?: boolean;
  /** Håltagningarna. */
  holes?: SlabHole[];
  /** Ovansidans nivå mot våningens golv, mm (0.10.13). Utelämnad = 0. */
  level?: number;
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

/** Håltagningens kontur, med bågarna som korta raka bitar. */
export function holeRing(h: SlabHole): Vec2[] {
  return shapePoints({ shape: 'polyline', points: h.points, bulges: h.bulges, closed: true }).points;
}

/** Om håltagningen har några bågar. */
const hasArcs = (h: SlabHole) => !!h.bulges?.some((b) => Math.abs(b) >= 0.5);

/** Bjälklagets ytor i vyn: konturen (ritad eller ur väggarna) utan håltagningarna. */
export function slabRings(ctx: PlanContext, el: Element<any>): Rings[] {
  const p = ctx.params<SlabParams>(el);
  const base = slabBase(ctx, p);
  const holes = (p.holes ?? []).filter((h) => h.points.length >= 3).map((h): Rings => [holeRing(h)]);
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

/**
 * Krysset i en håltagning: diagonalerna mellan motstående hörn. Med bågar
 * (0.9.4) den omslutande rektangelns diagonaler, de bitar som ligger i hålet.
 */
export function holeCross(hole: SlabHole): [Vec2, Vec2][] {
  if (hasArcs(hole)) return boxCross(holeRing(hole));
  const h = hole.points;
  const n = h.length;
  if (n < 3) return [];
  if (n === 4) return [[h[0], h[2]], [h[1], h[3]]];
  // Andra former: från varje hörn till det som ligger längst bort, de två längsta.
  const pairs: { a: Vec2; b: Vec2; d: number }[] = [];
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) if (!(i === 0 && j === n - 1)) pairs.push({ a: h[i], b: h[j], d: Math.hypot(h[j][0] - h[i][0], h[j][1] - h[i][1]) });
  pairs.sort((x, y) => y.d - x.d);
  return pairs.slice(0, 2).map((q): [Vec2, Vec2] => [q.a, q.b]);
}

/** Diagonalerna i rektangeln runt konturen, klippta till konturen. */
function boxCross(ring: readonly Vec2[]): [Vec2, Vec2][] {
  const xs = ring.map((q) => q[0]);
  const ys = ring.map((q) => q[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return [
    ...clipToRing([x0, y0], [x1, y1], ring),
    ...clipToRing([x1, y0], [x0, y1], ring),
  ];
}

/** Bitarna av sträckan a–b som ligger inne i konturen. */
function clipToRing(a: Vec2, b: Vec2, ring: readonly Vec2[]): [Vec2, Vec2][] {
  const d: Vec2 = [b[0] - a[0], b[1] - a[1]];
  const ts = [0, 1];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    const e: Vec2 = [q[0] - p[0], q[1] - p[1]];
    const den = d[0] * e[1] - d[1] * e[0];
    if (Math.abs(den) < 1e-9) continue;
    const t = ((p[0] - a[0]) * e[1] - (p[1] - a[1]) * e[0]) / den;
    const u = ((p[0] - a[0]) * d[1] - (p[1] - a[1]) * d[0]) / den;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
  }
  ts.sort((x, y) => x - y);
  const at = (t: number): Vec2 => [a[0] + d[0] * t, a[1] + d[1] * t];
  const out: [Vec2, Vec2][] = [];
  for (let i = 0; i + 1 < ts.length; i++) {
    if (ts[i + 1] - ts[i] < 1e-6 || !pointInRings(at((ts[i] + ts[i + 1]) / 2), [ring])) continue;
    const last = out[out.length - 1];
    // Bitar som möts blir en.
    if (last && Math.abs(last[1][0] - at(ts[i])[0]) < 1e-6 && Math.abs(last[1][1] - at(ts[i])[1]) < 1e-6) last[1] = at(ts[i + 1]);
    else out.push([at(ts[i]), at(ts[i + 1])]);
  }
  return out;
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
  // Ytan går att klicka i om användaren valt det (0.9.4); mjuk, så att
  // linjer, väggar och rumsstämplar går före och ytan före rummen.
  pickSoft: true,
  pickShape(el, ctx) {
    return ctx.view.slabArea ? slabRings(ctx, el).map((rings) => rings.map((r) => r.map((q): Vec2 => [q[0], q[1]]))) : [];
  },

  plan(el, ctx) {
    const p = ctx.params<SlabParams>(el);
    const origin = { objectId: el.id, objectType: 'Slab' };
    const out: Primitive[] = [];
    // Snittet i planen (0.10.16): ett bjälklag som går genom snitthöjden är
    // en snittyta, ett över snittet ritas streckprickat. Annars ligger det
    // under snittet: tunna linjer, under väggarna.
    const lv = levelOf(p);
    const zone = zoneInPlan(ctx, lv - Math.max(1, p.thickness), lv);
    if (zone === 'cut') {
      for (const rings of slabRings(ctx, el)) out.push({ kind: 'region', role: 'cut', rings, fill: { kind: 'solid', color: 'ink' }, outline: { weight: 0.35 }, origin: { ...origin, part: 'snitt' } });
      return out;
    }
    // Som linjer, inte en sluten form, så att ett klick i ett rum inte träffar bjälklaget.
    const pen = planCutPen(ctx.style, 'Slab', zone);
    const above = zone === 'above';
    const edges = (ring: readonly Vec2[], part: string, under: boolean) => {
      for (let i = 0; i < ring.length; i++) out.push({ kind: 'line', a: ring[i], b: ring[(i + 1) % ring.length], pen, ...(under ? { under: true } : {}), origin: { ...origin, part } });
    };
    for (const poly of slabBase(ctx, p)) for (const ring of poly) edges(ring, above ? ABOVE_PART : 'kontur', !above);
    // Håltagningarna, med kryss under snittet. Raka kanter är linjer, bågar korta raka bitar (0.9.4).
    for (const h of p.holes ?? []) {
      if (h.points.length < 3) continue;
      const part = { ...origin, part: above ? ABOVE_PART : 'hål' };
      for (let i = 0; i < segmentCount(h.points.length, true); i++) {
        const a = h.points[i];
        const b = h.points[(i + 1) % h.points.length];
        if (!segmentArc(h, i)) out.push({ kind: 'line', a, b, pen, origin: part });
        else out.push({ kind: 'polyline', points: shapePoints({ shape: 'polyline', points: [a, b], bulges: [h.bulges![i]] }).points, closed: false, pen, origin: part });
      }
      if (!above) for (const [a, b] of holeCross(h)) out.push({ kind: 'line', a, b, pen, origin: part });
    }
    return out;
  },

  model3d(el, ctx) {
    const p = ctx.params<SlabParams>(el);
    const t = Math.max(1, p.thickness);
    // Ovansidan på bjälklagets nivå mot våningen (0.10.13).
    const lv = levelOf(p);
    return slabRings(ctx, el).map((rings): Shape3D => ({ id: el.id, rings, z0: lv - t, z1: lv, material: 'slab' }));
  },
};
