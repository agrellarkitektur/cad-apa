import { renameElement, updateParams } from '../../core/commands';
import type { Id } from '../../core/model';
import type { TextParams } from '../../elements/annotation';
import { resolveParams } from '../../elements/registry';
import { layoutText, textPoint } from '../../elements/textLayout';
import type { Primitive, Vec2 } from '../../repr/primitives';
import type { InlineTextEditor } from '../textEditor';
import type { AppContext } from './context';

/**
 * Dubbelklick i ritningen: redigera en text eller ett rumsnamn där man
 * klickade, eller öppna en fasad eller sektion från dess linje i planen.
 */
export function installTextEdit(app: AppContext, textEditor: InlineTextEditor) {
  /** Starta redigering av en text eller ett rumsnamn där man dubbelklickade. */
  function editTextAt(id: Id, at: Vec2): boolean {
    const { store, ui, view } = app;
    const el = store.doc.elements[id];
    // Dubbelklick på en fasad- eller sektionsmarkör öppnar vyn.
    if (el && (el.type === 'Section' || el.type === 'Elevation') && !ui.marker) {
      app.goTo({ kind: 'marker', id });
      return true;
    }
    const sp = ui.marker ?? ui.worksheet ?? ui.layout;
    if (!el || (sp && el.space !== sp)) return false;
    const DRAWING_SCALE = view.drawingScale;
    if (el.type === 'Text') {
      const p = resolveParams<TextParams>(store.doc, el);
      // Redigeringen börjar på första raden, också i en textruta med förankring (0.8.9).
      const lay = layoutText(p);
      app.smartMenu.hide();
      textEditor.open(
        {
          at: textPoint(p.pos, ((p.angle ?? 0) * Math.PI) / 180, DRAWING_SCALE, 0, lay.baselines[0]),
          angle: ((p.angle ?? 0) * Math.PI) / 180,
          height: p.height,
          drawingScale: DRAWING_SCALE,
          value: String(p.text),
          multiline: true,
          label: 'Text',
          commit: (v) => {
            if (v.trim() === '') app.hint('En tom text tas bort med Delete.');
            else updateParams(store, [id], { text: v }, 'Ändra text');
          },
        },
        view.camera,
      );
      return true;
    }
    if (el.type === 'Space') {
      // Bara när man pekar på rumsetiketten, inte var som helst i rummet.
      const texts = (app.plan.pickables.find((pk) => pk.id === id)?.prims ?? []).filter(
        (q): q is Extract<Primitive, { kind: 'text' }> => q.kind === 'text',
      );
      const tol = 4 / view.camera.scale;
      const hit = texts.some((t) => {
        const w = t.text.length * t.height * 0.62 * DRAWING_SCALE;
        const h = t.height * DRAWING_SCALE;
        const x0 = t.align === 'middle' ? t.at[0] - w / 2 : t.at[0];
        return at[0] >= x0 - tol && at[0] <= x0 + w + tol && at[1] >= t.at[1] - h * 0.3 - tol && at[1] <= t.at[1] + h + tol;
      });
      const nameRow = texts[0];
      if (!hit || !nameRow) return false;
      const w = nameRow.text.length * nameRow.height * 0.62 * DRAWING_SCALE;
      app.smartMenu.hide();
      textEditor.open(
        {
          at: [nameRow.align === 'middle' ? nameRow.at[0] - w / 2 : nameRow.at[0], nameRow.at[1]],
          angle: 0,
          height: nameRow.height,
          drawingScale: DRAWING_SCALE,
          value: el.name ?? 'Rum',
          multiline: false,
          bold: true,
          label: 'Rumsnamn',
          commit: (v) => renameElement(store, id, v.trim() || 'Rum'),
        },
        view.camera,
      );
      return true;
    }
    return false;
  }

  return { editTextAt };
}
