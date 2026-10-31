import type { ElementType } from './registry';
import { openingMarks, openingRings, openingZoneInPlan, planWallParams, wallFrame, type WallParams } from './wall';
import { deriveOpening, type OpeningObjParams } from './openingSpec';
import { openingModel3dFor } from './openingPlan';
import { objectPen } from '../repr/objectPens';
import { litteraTag, showLittera } from './littera';
import { uncutOpening } from './opening';

/**
 * Vägghålet (0.11.8, format 28): ventgaller, nisch, genomföring och rent
 * hål i samma motor som fönstren, med egen littera (V01 …). Formatet och
 * ritningen finns nu; verktyget och de förvalda typerna kommer i 0.11.8.2.
 */
export type WallHoleParams = OpeningObjParams & { sill: number };

export const wallHoleType: ElementType<WallHoleParams> = {
  type: 'WallHole',
  planReads: ['Wall'],
  label: 'Vägghål',
  labelPlural: 'Vägghål',
  litteraPrefix: 'V',
  drawOrder: 21,
  compares: true,
  hosted: true,
  defaults: () => ({ at: 1000, hinge: 'start', inset: null }) as unknown as WallHoleParams,
  derive: deriveOpening('hole'),
  pickShape(el, ctx) {
    const host = el.host ? ctx.doc.elements[el.host] : undefined;
    return host ? openingRings(wallFrame(planWallParams(ctx, host)), ctx.params<WallHoleParams>(el)) : [];
  },
  model3d: (el, ctx) => openingModel3dFor(el, ctx, 'hole'),
  plan(el, ctx) {
    const host = el.host ? ctx.doc.elements[el.host] : undefined;
    if (!host) return [];
    const p = ctx.params<WallHoleParams>(el);
    const zone = openingZoneInPlan(ctx, ctx.params<WallParams>(host), p);
    if (zone !== 'cut') return uncutOpening(ctx, el, host, p, zone, false);
    const f = wallFrame(planWallParams(ctx, host)).local(p.at);
    const pen = objectPen(ctx.style, 'wallCut');
    const s1 = p.at - p.holeW / 2;
    const s2 = p.at + p.holeW / 2;
    const origin = { objectId: el.id, objectType: 'WallHole', part: 'hål' };
    return [
      ...openingMarks(el, host, p, ctx, { infillWhenRemoved: false }),
      { kind: 'line', a: f.at(s1, -f.half), b: f.at(s1, f.half), pen, origin },
      { kind: 'line', a: f.at(s2, -f.half), b: f.at(s2, f.half), pen, origin },
      ...(showLittera(ctx, 'WallHole') ? litteraTag(ctx, el, f, p.at, 1) : []),
    ];
  },
};
