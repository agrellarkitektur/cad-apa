import type { Shape3D } from '../repr/solids';
import type { Vec2 } from '../repr/primitives';
import { groundGeometry, storeyElevation, type GroundParams } from './groundGeometry';
import { wallCrest, wallProfile } from './wallProfile';
import { wallSolids } from './groundWall';
import { groundPlan } from './groundPlan';
import type { ElementType } from './registry';
import { materialOf, type FillParams } from './fill2d';

/**
 * Markobjekt (0.10.4–0.10.5): platåer, urgrävningar, vägar, höjdpunkter,
 * brytlinjer och stödmurar som gör den färdiga marken ur den befintliga
 * (`core/ground.ts`). De är fristående objekt och hör till förslaget; den
 * befintliga marken ändras aldrig.
 *
 * Delat i 0.10.6: parametrarna, formerna och den färdiga marken ligger i
 * `groundGeometry.ts`, ritningen i planen i `groundPlan.ts`; det som andra
 * delar använder finns också här.
 */
export {
  finishedTerrain,
  groundGeometry,
  groundLabel,
  groundObjects,
  isLineKind,
  isMarkKind,
  LINE_KINDS,
  m3,
  showsProposal,
  type Finished,
  type GroundGeometry,
  type GroundKind,
  type GroundParams,
} from './groundGeometry';
export { wallCrest, wallProfile };

export const groundType: ElementType<GroundParams> = {
  type: 'Ground',
  onSite: true,
  label: 'Markobjekt',
  labelPlural: 'Markobjekt',
  drawOrder: 4.5,
  compares: true,
  // Släntmarkeringarna (0.10.8) följer den färdiga marken, som alla markobjekt gör.
  planReads: ['Wall', 'Slab', 'Ground'],
  pickSoft: true,
  defaults: () => ({ kind: 'area', outline: [] }),
  model3d(el, ctx): Shape3D[] {
    // Stödmuren som kropp (0.10.5), från foten till krönet, i bitar med lutande krön (0.10.9). Den övriga marken är markmodellen.
    const p = ctx.params<GroundParams>(el);
    if (p.kind !== 'wall') return [];
    const prof = wallProfile(ctx, el);
    if (!prof) return [];
    // Materialets kulör (0.10.28).
    const m = materialOf(p as Partial<FillParams>, ctx.style);
    const solids = wallSolids(el.id, prof, storeyElevation(ctx, el.storey));
    // Och texturen (0.10.31).
    const look = { ...(m?.color3d ? { color: m.color3d } : {}), ...(m?.texture ? { texture: m.texture } : {}) };
    return Object.keys(look).length ? solids.map((s) => (s.kind === 'edges' ? s : { ...s, ...look })) : solids;
  },
  pickShape(el, ctx) {
    const g = groundGeometry(ctx, el);
    if (!g) return [];
    return g.rings.map((poly) => [...poly.map((r) => r.map((q): Vec2 => [q[0], q[1]])), ...g.holes]);
  },
  plan(el, ctx) {
    const g = groundGeometry(ctx, el);
    return g ? groundPlan(ctx, el, g) : [];
  },
};
