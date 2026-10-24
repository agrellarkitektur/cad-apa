import { arrange, canOrder, ORDER_LABELS, type OrderBox, type OrderMove } from '../../core/drawOrder';
import type { Element, Id, ProjectDoc } from '../../core/model';
import { resolveParams } from '../../elements/registry';
import type { Shape2DParams } from '../../elements/drawing2d';
import type { MenuItem } from '../contextMenu';
import type { AppContext } from './context';
import { selectionBounds } from './selectionPlace';

/**
 * Ritordningen i gränssnittet (0.8.25): knapparna i egenskaperna och
 * smartmenyn, raderna i objektmenyn och kommandona i smartshell. Det
 * markerade flyttas med `arrange` i core/drawOrder.ts; Bak och Fram går
 * förbi närmaste objekt det överlappar i vyn som visas.
 */

export const ORDER_MOVES: OrderMove[] = ['back', 'backward', 'forward', 'front'];

const DONE: Record<OrderMove, string> = {
  back: 'Lagt längst bak',
  backward: 'Flyttat ett steg bak',
  forward: 'Flyttat ett steg fram',
  front: 'Lagt främst',
};

/** Flytta det markerade i ritordningen, med en rad i tipsrutan. */
export function arrangeSelection(app: AppContext, move: OrderMove): void {
  const ids = app.selection.list();
  const doc = app.store.doc;
  const els = ids.map((id) => doc.elements[id]).filter(Boolean);
  if (!els.length) return app.hint('Markera det som ska flyttas i ritordningen först.', 3000);
  if (!canOrder(els)) return app.hint('Ritordningen gäller 2D-former, rum, möbler, mått, texter och underlag.', 3500);
  const boxOf = (id: Id): OrderBox | null => {
    const b = selectionBounds(app.plan, [id]);
    return b ? [b.minX, b.minY, b.maxX, b.maxY] : null;
  };
  const n = arrange(app.store, ids, move, boxOf);
  app.hint(n ? DONE[move] : move === 'back' || move === 'backward' ? 'Ligger redan längst bak bland det som överlappar.' : 'Ligger redan främst bland det som överlappar.', 2500);
}

/** Raderna i objektmenyn, eller inga om det markerade inte har en ritordning. */
export function orderMenuItems(app: AppContext, els: readonly Element[]): MenuItem[] {
  if (!canOrder(els)) return [];
  return [{ kind: 'header', label: 'Ritordning' }, ...ORDER_MOVES.map((m): MenuItem => ({ label: ORDER_LABELS[m], run: () => arrangeSelection(app, m) }))];
}

/**
 * Avsnittet i egenskaperna: fyra knappar, och för 2D-former i planen om
 * fyllningen och linjen ligger bakom eller framför väggarna.
 */
export function orderSection(doc: ProjectDoc, els: readonly Element[]): string {
  if (!canOrder(els)) return '';
  const buttons = ORDER_MOVES.map((m) => `<button class="btn" data-action="draw-order" data-order="${m}">${ORDER_LABELS[m]}</button>`).join('');
  const parts = [`<div class="row order-row">${buttons}</div>`];
  // Bakom eller framför väggarna: bara i planen, där det finns väggar.
  const shapes = els.every((e) => e.type === 'Shape2D' && !e.space) ? els.map((e) => resolveParams<Shape2DParams>(doc, e)) : [];
  if (shapes.length) {
    const pick = (key: string, label: string, front: boolean | null, show: boolean) => {
      if (!show) return '';
      const opt = (v: string, l: string, on: boolean) => `<option value="${v}"${on ? ' selected' : ''}>${l}</option>`;
      return `<label class="field"><span>${label}</span><select data-key="d2:${key}">${front === null ? '<option selected disabled>Olika</option>' : ''}${opt('behind', 'Bakom väggarna', front === false)}${opt('front', 'Framför väggarna', front === true)}</select></label>`;
    };
    const same = (f: (p: Shape2DParams) => boolean) => (shapes.every((p) => f(p) === f(shapes[0])) ? f(shapes[0]) : null);
    const fields =
      pick('fillLayer', 'Fyllningen', same((p) => !!p.fillFront), shapes.some((p) => !!p.fill)) +
      pick('lineLayer', 'Linjen', same((p) => !p.lineBehind), shapes.some((p) => p.weight > 0));
    if (fields) parts.push(`<div class="fields">${fields}</div>`);
  }
  return `<section><h3>Ritordning</h3>${parts.join('')}<p class="note">Gäller bland ${sortWord(els)} på samma ${els[0].space ? 'yta' : 'våning'}. Bak och Fram flyttar förbi närmaste som överlappar.</p></section>`;
}

function sortWord(els: readonly Element[]): string {
  const words: Record<string, string> = { Shape2D: '2D-formerna', Text: 'texterna', Underlay: 'underlagen', Furniture: 'möblerna', Dimension: 'måtten', Space: 'rummen' };
  const types = new Set(els.map((e) => e.type));
  return types.size === 1 ? words[els[0].type] : 'objekt av samma sort';
}
