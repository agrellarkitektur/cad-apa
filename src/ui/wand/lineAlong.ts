import { fitArcs } from '../../geometry/arcFit';
import type { Chain } from '../../geometry/chains';
import { sameChain, traceAt } from './trace';
import type { WandAction, WandHit } from './wand';

/**
 * 2D-linje (0.10.23): en linje längs kanten man pekar på, med verktygets
 * penna: sidan mellan två hörn först, Tab för hela kedjan (runt en sluten
 * kontur blir den sluten). Bågar i det man följer blir bågar i linjen.
 * Står markören i en yta, och inte på en kant, finns formen runt ytan i
 * `shapeAround`.
 */
export const lineAlong: WandAction = {
  id: 'line-along',
  tools: ['draw2d'],
  find(ctx) {
    const t = traceAt(ctx);
    if (!t) return [];
    const make = (label: string, c: Chain): WandHit => ({
      label,
      what: t.what,
      preview: { lines: [c] },
      apply: () => {
        const a = fitArcs(c);
        ctx.app.draw2dTool.createPolyline(a.points, a.closed, a.bulges);
      },
    });
    const out: WandHit[] = [make(t.side.closed ? 'Linje runt konturen' : t.side.points.length > 2 ? 'Linje längs sidan' : 'Linje längs kanten', t.side)];
    if (!sameChain(t.side, t.whole)) out.push(make(t.whole.closed ? 'Linje runt konturen' : 'Linje längs hela linjen', t.whole));
    return out;
  },
};
