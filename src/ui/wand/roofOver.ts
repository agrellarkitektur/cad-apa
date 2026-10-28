import { fitArcs, hasBulges } from '../../geometry/arcFit';
import { offsetRing } from '../../geometry/chains';
import { closestOnSegment, dist } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import { houseAt, ringsAt } from './rings';
import { mm } from './trace';
import type { WandAction, WandHit } from './wand';

const QUICK: Record<string, string> = { shed: 'Pulpettak', gable: 'Sadeltak', hip: 'Valmtak' };

/**
 * Tak (0.10.23): ett tak över väggarna (husets kontur) eller bjälklaget man
 * pekar i. *Takfall* ger ett takfall över hela konturen med takfoten
 * utanför den (verktygets takfotssprång): referenslinjen i takfoten vid den
 * kant som ligger närmast markören, och taket stiger inåt. *Pulpet*, *Sadel*
 * och *Valm* lägger snabbvalet över konturens omslutande rektangel, med
 * pulpettakets takfot på den sida som ligger närmast.
 */
export const roofOver: WandAction = {
  id: 'roof-over',
  tools: ['roof'],
  find(ctx) {
    const { app } = ctx;
    const tool = app.roofTool;
    const o = tool.options;
    const rings: { points: Vec2[]; what: string }[] = [];
    const house = houseAt(ctx);
    if (house) rings.push({ points: house, what: 'Väggarna' });
    for (const r of ringsAt(ctx, { regions: false, face: false, skip: (id) => app.store.doc.elements[id ?? '']?.type !== 'Slab' })) rings.push({ points: r.points, what: 'Bjälklaget' });
    const out: WandHit[] = [];
    for (const r of rings) {
      if (o.mode === 'face') {
        const i = nearestEdge(r.points, ctx.at);
        // Medurs är vänster utåt: takfoten utanför konturen.
        const contour = offsetRing(r.points, o.eave);
        const n = contour.length;
        const ref: [Vec2, Vec2] = [contour[(i + 1) % n], contour[i]];
        out.push({
          label: `Takfall över ${r.what.toLowerCase()}`,
          what: 'Takfoten närmast',
          preview: { lines: [{ points: contour, closed: true }, { points: [...ref], closed: false }] },
          apply: () => {
            const a = fitArcs({ points: contour, closed: true });
            tool.createFace({ points: a.points.map(mm), ...(hasBulges(a.bulges) ? { bulges: a.bulges } : {}) }, [mm(ref[0]), mm(ref[1])]);
          },
        });
        continue;
      }
      const xs = r.points.map((q) => q[0]);
      const ys = r.points.map((q) => q[1]);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      if (x1 - x0 < 500 || y1 - y0 < 500) continue;
      // Hörnet närmast markören: pulpettakets takfot ligger på dess långsida.
      const a: Vec2 = [ctx.at[0] - x0 < x1 - ctx.at[0] ? x0 : x1, ctx.at[1] - y0 < y1 - ctx.at[1] ? y0 : y1];
      const b: Vec2 = [a[0] === x0 ? x1 : x0, a[1] === y0 ? y1 : y0];
      const e = o.eave;
      out.push({
        label: `${QUICK[o.mode] ?? 'Tak'} över ${r.what.toLowerCase()}`,
        what: 'Omslutande rektangel',
        preview: { lines: [{ points: [[x0 - e, y0 - e], [x1 + e, y0 - e], [x1 + e, y1 + e], [x0 - e, y1 + e]], closed: true }] },
        apply: () => tool.createQuick(mm(a), mm(b)),
      });
    }
    return out;
  },
};

/** Kanten i en sluten kontur närmast punkten: index till dess första hörn. */
function nearestEdge(pts: readonly Vec2[], p: Vec2): number {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const d = dist(closestOnSegment(p, pts[i], pts[(i + 1) % pts.length]).point, p);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}
