import type { ElementType } from './registry';
import { openingRings, planWallParams, wallFrame } from './wall';
import { deriveOpening, type OpeningObjParams } from './openingSpec';
import { openingModel3dFor, openingPlanFor } from './openingPlan';

/**
 * Fönstrets parametrar (0.11.8): typen ger lufterna och karmen, objektet
 * mått, höjdläge (bröstning eller överkant karm) och hängning. Bröstningen
 * (`sill`, hålets underkant) räknas från våningens golv, eller från väggens
 * fot med `sillFromWall` (0.10.14).
 */
export type WindowParams = OpeningObjParams & { sill: number };

export const windowType: ElementType<WindowParams> = {
  type: 'Window',
  planReads: ['Wall'],
  label: 'Fönster',
  labelPlural: 'Fönster',
  litteraPrefix: 'F',
  drawOrder: 21,
  compares: true,
  hosted: true,
  defaults: () => ({ at: 1000, hinge: 'start', inset: null }) as unknown as WindowParams,
  derive: deriveOpening('window'),
  pickShape(el, ctx) {
    const host = el.host ? ctx.doc.elements[el.host] : undefined;
    return host ? openingRings(wallFrame(planWallParams(ctx, host)), ctx.params<WindowParams>(el)) : [];
  },
  model3d: (el, ctx) => openingModel3dFor(el, ctx, 'window'),
  plan: (el, ctx) => openingPlanFor(el, ctx, 'window'),
};
