import type { Shape3D } from '../repr/solids';
import type { Vec2 } from '../repr/primitives';
import { groundGeometry, storeyElevation, wallCrest, type GroundParams } from './groundGeometry';
import { groundPlan } from './groundPlan';
import type { ElementType } from './registry';

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
  LINE_KINDS,
  m3,
  showsProposal,
  wallCrest,
  type Finished,
  type GroundGeometry,
  type GroundKind,
  type GroundParams,
} from './groundGeometry';

export const groundType: ElementType<GroundParams> = {
  type: 'Ground',
  label: 'Markobjekt',
  labelPlural: 'Markobjekt',
  drawOrder: 4.5,
  compares: true,
  planReads: ['Wall', 'Slab'],
  pickSoft: true,
  defaults: () => ({ kind: 'area', outline: [] }),
  model3d(el, ctx): Shape3D[] {
    // Stödmuren som kropp (0.10.5), från foten till krönet. Den övriga marken är markmodellen.
    const p = ctx.params<GroundParams>(el);
    if (p.kind !== 'wall') return [];
    const g = groundGeometry(ctx, el);
    const c = wallCrest(ctx, el);
    if (!g || !c || c.top <= c.bottom) return [];
    const base = storeyElevation(ctx, el.storey);
    return [{ id: el.id, rings: g.rings[0], z0: c.bottom - base, z1: c.top - base, material: 'wall' }];
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
