import { railingsOnStair, stairEdgesAt } from '../../elements/railing';
import { fitArcs, hasBulges } from '../../geometry/arcFit';
import type { Vec2 } from '../../repr/primitives';
import { sameChain, traceAt } from './trace';
import type { WandAction, WandHit } from './wand';

/**
 * Räcket (0.11.1): längs trappans kant man pekar på (kopplat till trappan),
 * räcken på båda sidor efter Tab, och annars ett ritat räcke längs en vägg,
 * en 2D-linje eller en kurva. Kanterna på hål, bjälklag, ramper och
 * stödmurar kommer med staketen i 0.11.3.
 */
export const railingAlong: WandAction = {
  id: 'railing-along',
  tools: ['railing'],
  find(ctx) {
    const { app } = ctx;
    const doc = app.store.doc;
    const state = app.host.activeState();
    const out: WandHit[] = [];
    const edge = stairEdgesAt(doc, app.host.storey(), (el) => el.states.includes(state), ctx.at, Math.max(ctx.tol, 150))[0];
    if (edge) {
      out.push({ label: `Räcke längs trappans ${edge.side === 'left' ? 'vänstra' : 'högra'} kant`, what: 'Trappa', preview: { lines: [{ points: edge.pts, closed: false }] }, apply: () => void app.railingTool.createAlong(edge.stair.id, [edge.side]) });
      const on = railingsOnStair(doc, edge.stair.id);
      const missing = (['left', 'right'] as const).filter((s) => !on[s].length);
      if (missing.length === 2) {
        const both = stairEdgesAt(doc, app.host.storey(), (el) => el.id === edge.stair.id, ctx.at, Infinity);
        out.push({ label: 'Räcken på båda sidor', what: 'Trappa', preview: { lines: both.map((b) => ({ points: b.pts, closed: false })) }, apply: () => void app.railingTool.createAlong(edge.stair.id, missing) });
      }
      return out;
    }
    const t = traceAt(ctx);
    if (!t) return [];
    const make = (label: string, c: typeof t.whole): WandHit => ({
      label,
      what: t.what,
      preview: { lines: [c] },
      apply: () => {
        const a = fitArcs(c);
        const line: Vec2[] = a.closed ? [...a.points, a.points[0]] : a.points;
        app.railingTool.createLine(line, hasBulges(a.bulges) ? a.bulges : undefined, line.map(() => 0));
      },
    });
    out.push(make(`Räcke längs ${t.side.points.length > 2 ? 'sidan' : 'kanten'}`, t.side));
    if (!sameChain(t.side, t.whole)) out.push(make('Räcke längs hela linjen', t.whole));
    return out;
  },
};
