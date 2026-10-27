import type { Element, Id } from '../../core/model';
import { hiddenObjectKey, hiddenObjects, HIDDEN_OBJECT } from '../../core/visibility';
import { typeOf } from '../../elements/registry';
import type { MenuItem } from '../contextMenu';
import type { AppContext } from './context';
import { isShown, setShown, SHOW_GROUPS } from './showKeys';

/**
 * Dölja objekt i vyn (0.10.15): högerklick döljer det markerade, eller alla
 * objekt av samma typ. Det dolda står i vyns `hide` (objekten som `obj:` och
 * id, typerna som under Visa), så det sparas med vyn som det andra under
 * Visa. Visa-menyn visar hur många objekt som är dolda och tar fram dem igen.
 */

/** Objekttyperna som har en egen kryssruta under Visa, och därför kan döljas alla på en gång. */
const shownTypes = (): string[] => SHOW_GROUPS.flatMap((g) => g.items.map(([k]) => k)).filter((k) => !!typeOf(k));

/** Dölj objekten i vyn och ta bort dem ur markeringen. */
export function hideObjects(app: AppContext, ids: readonly Id[]): void {
  if (!ids.length) return;
  const keys = ids.map(hiddenObjectKey).filter((k) => !app.ui.hide.includes(k));
  app.ui.hide = [...app.ui.hide, ...keys];
  app.selection.set(app.selection.list().filter((id) => !ids.includes(id)));
  app.renderAll();
  app.hint(`${ids.length === 1 ? 'Dolt' : `${ids.length} objekt dolda`} i vyn. Visa dolda objekt finns under Visa och i högerklicksmenyn.`, 4000);
}

/** Dölj alla objekt av en typ i vyn, som kryssrutan under Visa. */
export function hideType(app: AppContext, type: string): void {
  setShown(app.ui, type, false);
  const els = app.store.doc.elements;
  app.selection.set(app.selection.list().filter((id) => els[id]?.type !== type && (!els[id]?.host || els[els[id].host!]?.type !== type)));
  app.renderAll();
  app.hint(`${typeOf(type)?.labelPlural ?? type} dolda i vyn. Kryssa i dem under Visa för att visa dem igen.`, 4000);
}

/** Ta fram de enskilt dolda objekten igen. */
export function showHiddenObjects(app: AppContext): void {
  app.ui.hide = app.ui.hide.filter((h) => !h.startsWith(HIDDEN_OBJECT));
  app.renderAll();
}

/** Hur många enskilt dolda objekt vyn har som fortfarande finns i projektet. */
export function hiddenCount(app: AppContext): number {
  return hiddenObjects(app.ui.hide).filter((id) => app.store.doc.elements[id]).length;
}

/** Högerklicksmenyns rader för det markerade. */
export function hideMenuItems(app: AppContext, els: readonly Element[]): MenuItem[] {
  if (!els.length) return [];
  const items: MenuItem[] = [{ label: els.length === 1 ? 'Dölj i vyn' : `Dölj de ${els.length} i vyn`, run: () => hideObjects(app, els.map((e) => e.id)) }];
  const type = els[0].type;
  if (els.every((e) => e.type === type) && shownTypes().includes(type) && isShown(app.ui, type)) {
    items.push({ label: `Dölj alla ${(typeOf(type)?.labelPlural ?? type).toLocaleLowerCase('sv-SE')} i vyn`, run: () => hideType(app, type) });
  }
  return items;
}

/** Planens högerklicksmeny utan markering: ta fram de dolda objekten, om det finns några. */
export function unhideMenuItems(app: AppContext): MenuItem[] {
  const n = hiddenCount(app);
  return n ? [{ label: `Visa dolda objekt (${n})`, run: () => showHiddenObjects(app) }] : [];
}
