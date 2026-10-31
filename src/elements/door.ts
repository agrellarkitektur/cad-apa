import type { ElementType } from './registry';
import { openingRings, planWallParams, wallFrame } from './wall';
import { deriveOpening, type OpeningObjParams } from './openingSpec';
import { openingModel3dFor, openingPlanFor } from './openingPlan';

/** Dörrens parametrar (0.11.8): typen ger bladen och karmen, objektet mått, slagsida och hängning. */
export type DoorParams = OpeningObjParams;

export const doorType: ElementType<DoorParams> = {
  type: 'Door',
  planReads: ['Wall', 'Door', 'Space'],
  label: 'Dörr',
  labelPlural: 'Dörrar',
  litteraPrefix: 'D',
  drawOrder: 20,
  compares: true,
  hosted: true,
  defaults: () => ({ at: 1000, swing: 1, hinge: 'start', inset: null }) as unknown as DoorParams,
  derive: deriveOpening('door'),
  pickShape(el, ctx) {
    const host = el.host ? ctx.doc.elements[el.host] : undefined;
    return host ? openingRings(wallFrame(planWallParams(ctx, host)), ctx.params<DoorParams>(el)) : [];
  },
  model3d: (el, ctx) => openingModel3dFor(el, ctx, 'door'),
  plan: (el, ctx) => openingPlanFor(el, ctx, 'door'),
};
