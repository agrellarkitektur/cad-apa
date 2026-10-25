import type { Id } from '../../core/model';
import { addStorey, deleteStorey, neighbourStorey, storeyContents, storeysUp, toStorey } from '../../core/storeys';
import { typeOf } from '../../elements/registry';
import { askConfirm } from '../ask';
import type { MenuItem } from '../contextMenu';
import type { AppContext } from './context';

/**
 * Våningarna i gränssnittet (0.9): ny våning ovanför eller under, byta
 * våning (Page Up och Page Down), ta bort, och flytta eller kopiera det
 * markerade till en annan våning.
 */
export function installStoreys(app: AppContext) {
  const doc = () => app.store.doc;
  const nameOf = (id: Id) => doc().storeys.find((s) => s.id === id)?.name ?? '';

  /** Gå till en våning: planen, eller samma läge i 3D. */
  function open(id: Id): void {
    app.goTo({ kind: 'storey', id });
    if (app.ui.navOpen) app.navigator.render();
  }

  function create(where: 'above' | 'below', from = app.ui.storey): Id | null {
    const id = addStorey(app.store, from, where);
    if (!id) return null;
    open(id);
    app.hint(`${nameOf(id)} på ${fmt(doc().storeys.find((s) => s.id === id)!.elevation)}. Våningen under visas tonad med Visa → Kalkera.`, 5000);
    return id;
  }

  /** Våningen ovanför (1) eller under (-1) den som visas. */
  function step(dir: 1 | -1): boolean {
    const next = neighbourStorey(doc(), app.ui.storey, dir);
    if (!next) {
      app.hint(dir > 0 ? 'Det finns ingen våning ovanför.' : 'Det finns ingen våning under.');
      return false;
    }
    open(next.id);
    app.hint(next.name, 1500);
    return true;
  }

  async function remove(id: Id): Promise<boolean> {
    const s = doc().storeys.find((x) => x.id === id);
    if (!s) return false;
    if (doc().storeys.length < 2) {
      app.hint('Den sista våningen går inte att ta bort.');
      return false;
    }
    const { elements, views } = storeyContents(doc(), id);
    const n = elements.filter((e) => !e.host).length;
    const what = [n ? `${n} objekt` : '', views.length ? `${views.length} ${views.length === 1 ? 'vy' : 'vyer'}` : ''].filter(Boolean).join(' och ');
    const ok = await askConfirm(`Ta bort ${s.name}?`, `${s.name}${what ? ` med ${what}` : ''} tas bort. Fasader och sektioner finns kvar. Det går att ångra.`);
    if (!ok) return false;
    const other = (neighbourStorey(doc(), id, -1) ?? neighbourStorey(doc(), id, 1))!.id;
    if (!deleteStorey(app.store, id)) return false;
    if (app.ui.storey === id) open(other);
    return true;
  }

  /** Flytta eller kopiera det markerade till en våning. */
  function moveTo(target: Id, copy: boolean): void {
    const ids = toStorey(app.store, app.selection.list(), target, copy, app.ui.state);
    if (!ids.length) {
      app.hint('Inget av det markerade kan flyttas till en annan våning.');
      return;
    }
    open(target);
    app.selection.set(ids);
    app.hint(`${ids.length === 1 ? 'Ett objekt' : `${ids.length} objekt`} ${copy ? 'kopierat' : 'flyttat'} till ${nameOf(target)}.`, 3000);
  }

  /** Menyn för det markerade: Flytta och Kopiera till varje annan våning. */
  function menuItems(): MenuItem[] {
    const els = app.selection.list().map((id) => doc().elements[id]).filter(Boolean);
    const others = storeysUp(doc())
      .reverse()
      .filter((s) => s.id !== app.ui.storey);
    if (!others.length || !els.some((e) => !e.space && !typeOf(e.type)?.everyStorey)) return [];
    return [
      { kind: 'sep' },
      { kind: 'header', label: 'Till våning' },
      ...others.flatMap((s): MenuItem[] => [
        { label: `Flytta till ${s.name}`, run: () => moveTo(s.id, false) },
        { label: `Kopiera till ${s.name}`, run: () => moveTo(s.id, true) },
      ]),
    ];
  }

  /** Smartshell: välj våningen att flytta eller kopiera till i en meny mitt på ritytan. */
  function chooseTarget(copy: boolean): void {
    const others = storeysUp(doc())
      .reverse()
      .filter((s) => s.id !== app.ui.storey);
    if (!others.length) {
      app.hint('Det finns ingen annan våning. Skapa en med Ny våning ovanför eller under.');
      return;
    }
    const r = app.pane2d.getBoundingClientRect();
    app.ctxMenu.open(
      r.left + r.width / 2,
      r.top + r.height / 3,
      others.map((s) => ({ label: s.name, run: () => moveTo(s.id, copy) })),
      copy ? 'Kopiera till våning' : 'Flytta till våning',
    );
  }

  return { create, step, remove, moveTo, menuItems, chooseTarget, open };
}

const nfLevel = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
/** Nivån i meter med tecken, som i projektträdet: +2,700. */
function fmt(mm: number): string {
  return `${mm > 0 ? '+' : mm < 0 ? '−' : '±'}${nfLevel.format(Math.abs(mm) / 1000)}`;
}
