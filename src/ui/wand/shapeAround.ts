import { fitArcs } from '../../geometry/arcFit';
import { ringsAt } from './rings';
import type { WandAction, WandHit } from './wand';

/**
 * 2D (0.10.22): en sluten 2D-form runt det man klickar i, med verktygets
 * penna och fyllning: en snittyta i en sektion eller fasad, ett objekts
 * kontur i planen, eller den minsta slutna ytan som linjerna stänger in
 * (som skrafferingens gräns i AutoCAD). Tab växlar mellan dem, den minsta
 * först. Bågar i konturen blir bågar i formen (0.10.23).
 */
export const shapeAround: WandAction = {
  id: 'shape-around',
  tools: ['draw2d'],
  find(ctx) {
    const section = !!(ctx.app.ui.marker || ctx.app.ui.worksheet);
    return ringsAt(ctx).map(
      (r): WandHit => ({
        label: r.kind === 'face' ? 'Runt den slutna ytan' : r.kind === 'outline' ? 'Runt konturen' : section ? 'Runt snittytan' : 'Runt ytan',
        what: r.what,
        preview: { lines: [{ points: r.points, closed: true }] },
        apply: () => {
          const a = fitArcs({ points: r.points, closed: true });
          ctx.app.draw2dTool.createPolyline(a.points, true, a.bulges);
        },
      }),
    );
  },
};
