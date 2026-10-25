import { effectivePen } from '../repr/ownPen';
import { ownedOutlines } from '../repr/outlineOwners';
import type { Element } from '../core/model';
import { difference, union } from '../geometry/boolean';
import { wallFrame } from '../geometry/wallFrame';
import type { Primitive, Vec2 } from '../repr/primitives';
import { litteraTag, showLittera } from './littera';
import type { ElementType, PlanContext } from './registry';
import { holeWidth, openingRings, wallShapesFor, type OpeningParams, type WallParams } from './wallBodies';
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
  openingRings,
  sagittaOver,
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
  const f = wallFrame(ctx.params<WallParams>(host));
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
  const f = wallFrame(ctx.params<WallParams>(el));
  const room = ctx.scale * 8;
  if (f.length < room * 1.5) return [];
  const openings = ctx.openingsIn(el.id).map((o) => ctx.params<OpeningParams>(o));
  const free = (s: number) => openings.every((o) => Math.abs(o.at - s) > o.width / 2 + room / 2);
  const s = [0.5, 0.35, 0.65, 0.2, 0.8].map((t) => t * f.length).find(free);
  if (s === undefined) return [];
  return litteraTag(ctx, el, f.local(s), s, INSIDE, { leader: true });
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
    const pieces = items.flatMap(({ el }) => shapes.get(el.id) ?? []);
    // Väggar med samma åtgärd flyter ihop till en yta, så att skarvarna blir rena.
    let regions = union(pieces);
    // Där en ny eller riven vägg går in i en befintlig hör ytan till den befintliga.
    const action = items[0]?.action;
    if (action === 'new' || action === 'demolished') {
      const existing = ctx.memo('walls-existing', () =>
        union(
          ctx
            .visible('Wall')
            .filter((w) => ctx.actionOf(w) === 'existing')
            .flatMap((w) => shapes.get(w.id) ?? []),
        ),
      );
      if (existing.length) regions = regions.flatMap((r) => difference(r, existing));
    }
    // Väggar med egen penna (0.8.31): ytan är en, men konturen delas efter
    // vilken vägg kanten kommer ifrån, så att den egna pennan hamnar på rätt kanter.
    const owned = new Set(items.filter(({ el }) => effectivePen(ctx.doc, el)).map(({ el }) => el.id));
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
      const own = items.flatMap(({ el }) => (shapes.get(el.id) ?? []).map((r) => ({ id: el.id, rings: r })));
      for (const o of ownedOutlines(regions, own, owned))
        out.push({ kind: 'polyline', points: o.points, closed: o.closed, pen: { weight: 0.35 }, asOutline: true, origin: { ...(o.id ? { objectId: o.id } : {}), objectType: 'Wall', part: 'kontur' } });
    }
    if (showLittera(ctx, 'Wall') && action !== 'demolished') {
      for (const { el } of items) out.push(...wallTag(ctx, el));
    }
    return out;
  },

  pickShape(el, ctx) {
    return wallShapesFor(ctx).get(el.id) ?? [];
  },

  model3dBatch: wallModel3d,
};
