import { typeOf } from '../../elements/registry';
import type { Vec2 } from '../../repr/primitives';
import { pickAt } from '../../view2d/pick';
import type { WandAction } from './wand';

/** Så långt snett upp till höger texten hamnar, mm på papperet. */
const OUT = 8;

/**
 * Littera (0.10.23): ett klick på ett objekt ger en littera som pekar på
 * punkten man klickade, fast i objektet, med verktygets text (förval
 * *{typ}*, som fylls i ur objektet), sort och vridning. Texten hamnar snett
 * upp till höger och flyttas sedan med sitt grepp. Shift samlar flera
 * objekt, som får var sin littera.
 */
export const labelOn: WandAction = {
  id: 'label-on',
  tools: ['label'],
  find(ctx) {
    const { app } = ctx;
    if (app.labelTool.addTo) return [];
    const id = pickAt(app.plan.pickables, ctx.at, ctx.tol, app.view.drawingScale);
    const el = id ? app.store.doc.elements[id] : undefined;
    if (!id || !el || el.type === 'Label' || el.type === 'Dimension') return [];
    const k = OUT * app.view.drawingScale;
    const at: Vec2 = [ctx.at[0], ctx.at[1]];
    const pos: Vec2 = [at[0] + k, at[1] + k];
    return [
      {
        label: 'Littera på objektet',
        what: typeOf(el.type)?.label,
        preview: { ids: [id], lines: [{ points: [at, pos], closed: false }] },
        apply: () => {
          app.labelTool.createFor(at, pos);
        },
      },
    ];
  },
};
