import { slabAt } from '../../elements/slab';
import { fitArcs, hasBulges } from '../../geometry/arcFit';
import { signedArea, simplify } from '../../geometry/chains';
import type { Vec2 } from '../../repr/primitives';
import { ringsAt } from './rings';
import { mm } from './trace';
import type { WandAction, WandHit } from './wand';

/** Det som inte ger ett bjälklag: väggarna (rummet tar dem) och bjälklagen själva. */
const NOT_FROM = new Set(['Wall', 'Slab', 'Label', 'Dimension']);

/**
 * Bjälklag (0.10.23): ett klick i ett rum ger ett bjälklag innanför
 * väggarna; i ett tak, en 2D-form eller en annan sluten yta ett bjälklag
 * med dess kontur. Sist ett bjälklag innanför ytterväggarna (som *Ur
 * väggarna*). Med *Håltagning* blir ytan i stället ett hål i bjälklaget
 * man pekar i, med bågarna kvar.
 */
export const slabFrom: WandAction = {
  id: 'slab-from',
  tools: ['slab'],
  find(ctx) {
    const { app } = ctx;
    const tool = app.slabTool;
    const doc = app.store.doc;
    const skip = (id: string | undefined) => !!id && NOT_FROM.has(doc.elements[id]?.type ?? '');
    const out: WandHit[] = [];
    if (tool.options.mode === 'hole') {
      const target = slabAt(doc, app.host.storey(), app.host.activeState(), ctx.at);
      if (!target) return [];
      for (const r of ringsAt(ctx, { regions: false, skip: (id) => id === target || skip(id) }))
        out.push({
          label: r.kind === 'face' ? 'Håltagning i den slutna ytan' : 'Håltagning ur konturen',
          what: r.what,
          preview: { lines: [{ points: r.points, closed: true }] },
          apply: () => {
            const a = fitArcs({ points: r.points, closed: true });
            tool.addHole(target, { points: a.points.map(mm), ...(hasBulges(a.bulges) ? { bulges: a.bulges } : {}) });
          },
        });
      return out;
    }
    const slab = (label: string, points: Vec2[], what?: string): WandHit => ({
      label,
      what,
      preview: { lines: [{ points, closed: true }] },
      // Bjälklagets kontur har inga bågar: de följs som korta raka bitar.
      apply: () => tool.create(ccw(points).map(mm)),
    });
    const room = app.roomTool.holeAt(ctx.at);
    const roomPts = room ? simplify({ points: room, closed: true }).points : null;
    const roomArea = roomPts ? Math.abs(signedArea(roomPts)) : -1;
    if (roomPts) out.push(slab('Bjälklag innanför väggarna', roomPts, 'Rummet'));
    for (const r of ringsAt(ctx, { regions: false, skip }))
      // Ytan mellan linjerna i ett rum är rummet igen.
      if (Math.abs(r.area - roomArea) > 1e-3 * Math.max(r.area, 1)) out.push(slab(r.kind === 'face' ? 'Bjälklag i den slutna ytan' : 'Bjälklag ur konturen', r.points, r.what));
    if (room)
      out.push({
        label: 'Bjälklag innanför ytterväggarna',
        what: 'Huset',
        preview: {},
        apply: () => tool.create(),
      });
    return out;
  },
};

/** Moturs, som bjälklagens konturer ritas. */
const ccw = (pts: Vec2[]): Vec2[] => (signedArea(pts) < 0 ? [...pts].reverse() : pts);
