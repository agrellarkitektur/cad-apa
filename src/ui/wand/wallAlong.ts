import { fitArcs } from '../../geometry/arcFit';
import { mm, sameChain, traceAt } from './trace';
import type { WandAction, WandHit } from './wand';

/**
 * Vägg (0.10.22): väggar runt en kontur eller längs en kant av det man pekar
 * på: bjälklag, markobjekt, rum, 2D-former, underlag, fastighetsgränser,
 * kalkeringen … Väggarna läggs med verktygets typ, höjd och referenslinje;
 * runt en kontur med *Ute* hamnar väggarna innanför den, med *Inne* utanför.
 * Tab växlar mellan hela konturen och kanten (sidan mellan två hörn).
 * Bågar i det man följer blir bågväggar (0.10.23).
 */
export const wallAlong: WandAction = {
  id: 'wall-along',
  tools: ['wall'],
  find(ctx) {
    // Väggarnas egna liv följs inte: det blir väggar i väggarna.
    const t = traceAt(ctx, (s) => ctx.app.store.doc.elements[s.id]?.type !== 'Wall');
    if (!t) return [];
    const tool = ctx.app.wallTool;
    const make = (label: string, c: typeof t.whole): WandHit => ({
      label,
      what: t.what,
      preview: { lines: [c] },
      apply: () => {
        const a = fitArcs(c);
        const ids = tool.createAlong(a.points.map(mm), a.closed, a.bulges);
        if (ids.length) ctx.app.hint(`${ids.length} ${ids.length === 1 ? 'vägg' : 'väggar'} lagda längs ${t.what.toLowerCase()}. Ändra typen och höjden i egenskaperna.`, 4000);
      },
    });
    const out: WandHit[] = [];
    out.push(make(t.whole.closed ? 'Väggar runt konturen' : 'Väggar längs linjen', t.whole));
    if (!sameChain(t.side, t.whole)) out.push(make(t.side.points.length > 2 ? 'Väggar längs sidan' : 'Vägg längs kanten', t.side));
    return out;
  },
};
