import type { Primitive, Vec2 } from '../repr/primitives';
import type { ElementType } from './registry';
import { modelBounds } from './markers';

/**
 * Beräkningsgrundande fasad (0.10.8b, format 20): en linje som ritas längs
 * fasadlivet i planen. Byggnadshöjden mäts mot den fasad i husets kontur som
 * linjen ligger på (`buildingHeight`). Det finns högst en i projektet: en ny
 * ersätter den gamla. Den hör till ritningen, inte till ett tillstånd.
 */
export interface BasisFacadeParams {
  start: [number, number];
  end: [number, number];
}

export const basisFacadeType: ElementType<BasisFacadeParams> = {
  type: 'BasisFacade',
  label: 'Beräkningsgrundande fasad',
  labelPlural: 'Beräkningsgrundande fasader',
  drawOrder: 63,
  compares: false,
  global: true,
  everyStorey: true,
  // Texten läggs utanför huset, så planen läser väggar och tak.
  planReads: ['Wall', 'Roof', 'Slab'],
  defaults: () => ({ start: [0, 0], end: [5000, 0] }),
  plan(el, ctx) {
    const p = ctx.params<BasisFacadeParams>(el);
    const k = ctx.scale;
    const origin = { objectId: el.id, objectType: 'BasisFacade' };
    const a = p.start;
    const b = p.end;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const u: Vec2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    // Texten läses från vänster eller nedifrån, på den sida av linjen som vetter bort från huset.
    let angle = Math.atan2(u[1], u[0]);
    if (angle > Math.PI / 2 + 1e-9 || angle <= -Math.PI / 2 + 1e-9) angle += angle > 0 ? -Math.PI : Math.PI;
    let n: Vec2 = [-Math.sin(angle), Math.cos(angle)];
    const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const box = modelBounds(ctx.doc);
    const inward = box ? ((box.minX + box.maxX) / 2 - mid[0]) * n[0] + ((box.minY + box.maxY) / 2 - mid[1]) * n[1] > 0 : false;
    const h = 2.5;
    // Texten står på sin baslinje: utåt åt vänster räcker en liten luft, utåt åt höger behövs texthöjden.
    if (inward) n = [-n[0], -n[1]];
    const gap = (inward ? 1.2 + h : 1.2) * k;
    const m: Vec2 = [mid[0] + n[0] * gap, mid[1] + n[1] * gap];
    return [
      { kind: 'line', a, b, pen: { weight: 0.5, dash: [8, 1.5, 1.5, 1.5] }, origin },
      { kind: 'text', at: m, text: 'Beräkningsgrundande fasad', height: h, align: 'middle', angle, pen: { weight: 0.18 }, origin },
    ] as Primitive[];
  },
};
