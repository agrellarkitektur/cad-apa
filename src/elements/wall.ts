import { effectivePen } from '../repr/ownPen';
import { ownedOutlines } from '../repr/outlineOwners';
import type { Element } from '../core/model';
import { difference, union, type Rings } from '../geometry/boolean';
import { ABOVE_PART, planCutPen, type CutZone } from '../repr/planCutPens';
import { wallFrame } from '../geometry/wallFrame';
import type { Primitive, Vec2 } from '../repr/primitives';
import { litteraTag, showLittera } from './littera';
import type { ElementType, PlanContext, PlanItem } from './registry';
import { holeWidth, openingRings, openingSpan, planWallParams, shiftedParams, wallShapesFor, wallShear, wallZone, type OpeningParams, type WallParams } from './wallBodies';
import { planCutHeight } from './planCut';
import { levelOf } from '../repr/solids';
import { wallModel3d } from './wall3d';
import { INSIDE } from './wallSides';

// Väggarnas kroppar ligger i wallBodies.ts och 3D i wall3d.ts (0.10.1); det
// som andra delar använder finns också här.
export { wallFrame, type WallFrame } from '../geometry/wallFrame';
export {
  bareWallShapes,
  bareWallUnion,
  bareWalls,
  computeWallShapes,
  FRAME_LESS,
  HOLE_EXTRA,
  holeWidth,
  JOIN_TOLERANCE,
  leanedShape,
  MAX_LEAN,
  openingRings,
  openingSpan,
  openingZoneInPlan,
  planWallParams,
  sagittaOver,
  shiftedParams,
  wallShear,
  wallZone,
  wallShapesFor,
  wallsWithOpenings,
  type OpeningParams,
  type WallParams,
  type WallShapeCache,
} from './wallBodies';

/**
 * Markeringar för öppningar i befintliga väggar, enligt svensk praxis:
 * - en dörr som tas bort lämnar ett igensatt hål med nytt väggmaterial,
 * - en ny öppning får en skrafferad zon på var sida i den befintliga väggen.
 * Ritas av dörr- och fönsterreglerna, ovanpå väggen.
 */
export function openingMarks(
  el: Element<any>,
  host: Element<any>,
  p: OpeningParams,
  ctx: PlanContext,
  opts: { infillWhenRemoved: boolean },
): Primitive[] {
  const action = ctx.actionOf(el);
  if (ctx.actionOf(host) !== 'existing') return [];
  const f = wallFrame(planWallParams(ctx, host));
  const s1 = p.at - holeWidth(p) / 2;
  const s2 = p.at + holeWidth(p) / 2;
  const rect = (a: number, b: number): Vec2[] => [...f.trace(a, b, -f.half), ...f.trace(b, a, f.half)];
  const origin = { objectId: el.id, objectType: el.type, part: 'markering' };

  if (action === 'demolished' && opts.infillWhenRemoved) {
    return [{ kind: 'region', role: 'cut', rings: openingRings(f, p)[0], fill: { kind: 'none' }, outline: null, styleAs: 'new', origin }];
  }
  const mark = ctx.style.openingMark;
  if (action === 'new' && mark > 0) {
    const a1 = Math.max(0, s1 - mark);
    const b2 = Math.min(f.length, s2 + mark);
    const out: Primitive[] = [];
    if (s1 - a1 > 1) out.push({ kind: 'region', role: 'cut', rings: [rect(a1, s1)], fill: { kind: 'none' }, outline: null, styleAs: 'new', noOutline: true, origin });
    if (b2 - s2 > 1) out.push({ kind: 'region', role: 'cut', rings: [rect(s2, b2)], fill: { kind: 'none' }, outline: null, styleAs: 'new', noOutline: true, origin });
    // Ingen tvärgående kontur: skrafferingen går rakt över i den befintliga väggen.
    return out;
  }
  return [];
}

/**
 * Väggtypens littera längs väggen, på insidan av ytterväggar. Läget väljs
 * där ingen öppning är i vägen.
 */
function wallTag(ctx: PlanContext, el: Element): Primitive[] {
  const f = wallFrame(planWallParams(ctx, el));
  const room = ctx.scale * 8;
  if (f.length < room * 1.5) return [];
  const openings = ctx.openingsIn(el.id).map((o) => ctx.params<OpeningParams>(o));
  const free = (s: number) => openings.every((o) => Math.abs(o.at - s) > o.width / 2 + room / 2);
  const s = [0.5, 0.35, 0.65, 0.2, 0.8].map((t) => t * f.length).find(free);
  if (s === undefined) return [];
  return litteraTag(ctx, el, f.local(s), s, INSIDE, { leader: true });
}

/**
 * Väggarna som inte går genom snittet (0.10.16), som konturer: under
 * snittet med vyns penna, över snittet streckprickade och bara där de
 * ligger utanför de snittade väggarna. Varje vägg för sig, så att en egen
 * penna hamnar rätt.
 */
function uncutWalls(ctx: PlanContext, items: readonly PlanItem[], shapes: Map<string, Rings[]>, zoneOf: (el: Element) => CutZone): Primitive[] {
  const out: Primitive[] = [];
  const zoned = items.filter(({ el }) => zoneOf(el) !== 'cut');
  if (!zoned.length) return out;
  const cut = cutWallUnion(ctx, shapes, zoneOf);
  for (const zone of ['below', 'above'] as const) {
    const these = zoned.filter(({ el }) => zoneOf(el) === zone);
    if (!these.length) continue;
    const pen = planCutPen(ctx.style, 'Wall', zone);
    // Väggarna i samma läge flyter ihop, så att skarvarna mellan dem inte ritas.
    const merged = union(these.flatMap(({ el }) => shapes.get(el.id) ?? []));
    const visible = cut.length ? merged.flatMap((r) => difference(r, cut)) : merged;
    const own = these.flatMap(({ el }) => (shapes.get(el.id) ?? []).map((r) => ({ id: el.id, rings: r })));
    const ids = new Set(these.map(({ el }) => el.id));
    // Kanter längs de snittade väggarna (utan ägare) ritas redan av snittets kontur.
    for (const o of ownedOutlines(visible, own, ids))
      if (o.id) out.push({ kind: 'polyline', points: o.points, closed: o.closed, pen, origin: { objectId: o.id, objectType: 'Wall', part: zone === 'above' ? ABOVE_PART : 'vy' } });
  }
  return out;
}

/** De snittade väggarnas ytor sammanslagna, utan det som döljs i vyn. */
function cutWallUnion(ctx: PlanContext, shapes: Map<string, Rings[]>, zoneOf: (el: Element) => CutZone): Rings[] {
  return ctx.memo('walls-cut', () => union(ctx.visible('Wall').filter((w) => zoneOf(w) === 'cut' && !ctx.hiddenByView(w)).flatMap((w) => shapes.get(w.id) ?? [])));
}

/**
 * Lutande väggar genom snittet (0.10.21): snittytan ligger där snittet
 * skär väggen; foten ritas som vy och toppen streckprickad, där de sticker
 * ut utanför det snittade. Väggens egen rektangel, utan skarvar och hål.
 */
function leaningOutlines(ctx: PlanContext, items: readonly PlanItem[], shapes: Map<string, Rings[]>, zoneOf: (el: Element) => CutZone): Primitive[] {
  const out: Primitive[] = [];
  const leaning = items.filter(({ el }) => zoneOf(el) === 'cut' && wallShear(ctx.params<WallParams>(el)));
  if (!leaning.length) return out;
  const cut = cutWallUnion(ctx, shapes, zoneOf);
  const rectOf = (p: WallParams, dz: number): Rings => {
    const f = wallFrame(shiftedParams(p, dz));
    return [[f.at(0, -f.half), f.at(f.length, -f.half), f.at(f.length, f.half), f.at(0, f.half)]];
  };
  for (const { el } of leaning) {
    const p = ctx.params<WallParams>(el);
    const base = levelOf(p);
    const cutAt = Math.max(0, Math.min(p.height, (planCutHeight(ctx) ?? 0) - base));
    // Snittytan utan hål, så att konturen inte går in i dörrhålet vid snittet.
    const hide = union([...cut, rectOf(p, cutAt)]);
    const openings = ctx.openingsIn(el.id).map((o) => ({ span: openingSpan(p, ctx.params(o)), rings: openingRings(wallFrame(p), ctx.params<OpeningParams>(o), 1)[0] as unknown as Rings }));
    for (const [dz, zone] of [
      [0, 'below'],
      [p.height, 'above'],
    ] as const) {
      // Hålen som når foten (dörrar) eller toppen bryter konturen där.
      const holes = openings.filter(({ span }) => (dz === 0 ? span[0] <= base + 1 : span[1] >= base + p.height - 1)).map(({ rings }) => shiftRings(rings, dz, p));
      const pen = planCutPen(ctx.style, 'Wall', zone);
      for (const rings of difference(rectOf(p, dz), [...hide, ...holes]))
        for (const ring of rings) out.push({ kind: 'polyline', points: ring, closed: true, pen, origin: { objectId: el.id, objectType: 'Wall', part: zone === 'above' ? ABOVE_PART : 'vy' } });
    }
  }
  return out;
}

/** Ringar flyttade dit väggen står på höjden dz över foten. */
function shiftRings(rings: Rings, dz: number, p: WallParams): Rings {
  const sh = wallShear(p);
  if (!sh) return rings;
  return rings.map((r) => r.map((q): Vec2 => [q[0] + sh[0] * dz, q[1] + sh[1] * dz]));
}

export const wallType: ElementType<WallParams> = {
  type: 'Wall',
  planReads: ['Wall', 'hosted'],
  label: 'Vägg',
  labelPlural: 'Väggar',
  litteraPrefix: 'IV',
  drawOrder: 10,
  compares: true,
  typeParams: ['thickness'],
  defaults: () => ({ start: [0, 0], end: [3000, 0], thickness: 120, height: 2700, justification: 'center' }),
  // Utan egen höjd följer väggen våningshöjden (0.9).
  storeyParams: (s) => ({ height: s.height }),

  planBatch(items, ctx) {
    const shapes = wallShapesFor(ctx);
    // Snittet i planen (0.10.16): väggar som går genom snitthöjden ritas
    // snittade, låga väggar som vy och väggar vars fot ligger över snittet
    // streckprickade där de sticker ut utanför det snittade.
    const zoneOf = (el: Element) => wallZone(ctx, ctx.params<WallParams>(el));
    const cutItems = items.filter(({ el }) => zoneOf(el) === 'cut');
    const pieces = cutItems.flatMap(({ el }) => shapes.get(el.id) ?? []);
    // Väggar med samma åtgärd flyter ihop till en yta, så att skarvarna blir rena.
    let regions = union(pieces);
    // Där en ny eller riven vägg går in i en befintlig hör ytan till den befintliga.
    const action = items[0]?.action;
    if (action === 'new' || action === 'demolished') {
      const existing = ctx.memo('walls-existing', () =>
        union(
          ctx
            .visible('Wall')
            .filter((w) => ctx.actionOf(w) === 'existing' && zoneOf(w) === 'cut')
            .flatMap((w) => shapes.get(w.id) ?? []),
        ),
      );
      if (existing.length) regions = regions.flatMap((r) => difference(r, existing));
    }
    // Väggar med egen penna (0.8.31): ytan är en, men konturen delas efter
    // vilken vägg kanten kommer ifrån, så att den egna pennan hamnar på rätt kanter.
    const owned = new Set(cutItems.filter(({ el }) => effectivePen(ctx.doc, el)).map(({ el }) => el.id));
    const out = regions.map(
      (rings): Primitive => ({
        kind: 'region',
        role: 'cut',
        rings,
        fill: { kind: 'solid', color: 'ink' },
        outline: { weight: 0.35 },
        ...(owned.size ? { noOutline: true } : {}),
        origin: { objectType: 'Wall', part: 'snitt' },
      }),
    );
    if (owned.size) {
      const own = cutItems.flatMap(({ el }) => (shapes.get(el.id) ?? []).map((r) => ({ id: el.id, rings: r })));
      for (const o of ownedOutlines(regions, own, owned))
        out.push({ kind: 'polyline', points: o.points, closed: o.closed, pen: { weight: 0.35 }, asOutline: true, origin: { ...(o.id ? { objectId: o.id } : {}), objectType: 'Wall', part: 'kontur' } });
    }
    out.push(...uncutWalls(ctx, items, shapes, zoneOf), ...leaningOutlines(ctx, items, shapes, zoneOf));
    if (showLittera(ctx, 'Wall') && action !== 'demolished') {
      for (const { el } of cutItems) out.push(...wallTag(ctx, el));
    }
    return out;
  },

  pickShape(el, ctx) {
    return wallShapesFor(ctx).get(el.id) ?? [];
  },

  model3dBatch: wallModel3d,
};
