import { fitArcs, hasBulges } from '../../geometry/arcFit';
import { houseAt, ringsAt } from './rings';
import { ccw } from './slabFrom';
import { mm } from './trace';
import type { WandAction, WandHit } from './wand';

/** Det som inte ger en markyta: väggarna (huset tar dem), markytorna själva och beteckningarna. */
const NOT_FROM = new Set(['Wall', 'Label', 'Dimension']);

/**
 * Markyta (0.10.23): i huset en markyta runt huset (som *Runt huset*, med
 * avståndet runt om); i en 2D-form, ett bjälklag eller ett annat objekt en
 * markyta med dess kontur; mellan linjer (fastighetsgränsen, grannhusens
 * väggar, vägen) den minsta slutna ytan, som markyta inom
 * fastighetsgränsen. Höjden föreslås ur marken i ytans mitt. Bågarna följer
 * med (0.10.24). Ramp och väg längs en sida finns i `groundAlong`.
 */
export const groundArea: WandAction = {
  id: 'ground-area',
  tools: ['ground'],
  find(ctx) {
    const { app } = ctx;
    const tool = app.groundTool;
    if (tool.options.mode !== 'area') return [];
    const doc = app.store.doc;
    const out: WandHit[] = [];
    const house = houseAt(ctx);
    if (house)
      out.push({
        label: 'Markyta runt huset',
        what: 'Huset',
        preview: { lines: [{ points: house, closed: true }] },
        apply: () => tool.aroundHouse(),
      });
    for (const r of ringsAt(ctx, { regions: false, skip: (id) => !!id && NOT_FROM.has(doc.elements[id]?.type ?? '') }))
      out.push({
        label: r.kind === 'face' ? 'Markyta i den slutna ytan' : 'Markyta ur konturen',
        what: r.what ?? (r.kind === 'face' ? 'Linjerna' : undefined),
        preview: { lines: [{ points: r.points, closed: true }] },
        apply: () => {
          // Moturs, som markytans kontur ritas.
          const a = ccw(r.points, fitArcs({ points: r.points, closed: true }));
          tool.createArea(a.points.map(mm), hasBulges(a.bulges) ? a.bulges : undefined);
        },
      });
    return out;
  },
};
