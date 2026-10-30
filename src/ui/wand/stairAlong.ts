import { fitArcs, hasBulges } from '../../geometry/arcFit';
import type { Vec2 } from '../../repr/primitives';
import { sameChain, traceAt } from './trace';
import type { WandAction, WandHit } from './wand';

/**
 * Trappan (0.11): en trappa längs det man pekar på, med linjen som
 * referenslinje: en vägg, en 2D-linje, en båge eller en kurva. Sidan (mellan
 * två hörn) kommer först, hela linjen efter Tab. Ritad i trappverktyget är
 * förvalet; smartspöt är ett alternativ.
 */
export const stairAlong: WandAction = {
  id: 'stair-along',
  tools: ['stair'],
  find(ctx) {
    const t = traceAt(ctx);
    if (!t) return [];
    const make = (label: string, c: typeof t.whole): WandHit => ({
      label,
      what: t.what,
      preview: { lines: [c] },
      apply: () => {
        const a = fitArcs(c);
        const line: Vec2[] = a.closed ? [...a.points, a.points[0]] : a.points;
        ctx.app.stairTool.createLine(line, hasBulges(a.bulges) ? a.bulges : undefined);
      },
    });
    const out: WandHit[] = [make(`Trappa längs ${t.side.points.length > 2 ? 'sidan' : 'kanten'}`, t.side)];
    if (!sameChain(t.side, t.whole) && !t.whole.closed) out.push(make('Trappa längs hela linjen', t.whole));
    return out;
  },
};
