import { buildingStoreys, groundStorey, isSite, SITE_CATEGORIES, storeysUpFrom, type Id, type Storey } from '../../core/model';
import { addStorey, deleteStorey, neighbourStorey, storeyContents, toStorey, TRACE_SITE, TRACE_STOREY } from '../../core/storeys';
import { typeOf } from '../../elements/registry';
import { askConfirm, askText } from '../ask';
import { addSiteView } from '../../core/siteViews';
import { saveStorey } from '../../core/treeCommands';
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
    // Från Platsen (0.10.25): ovanför den översta våningen eller under den nedersta.
    if (isSite(from)) {
      const up = storeysUpFrom(doc());
      from = (where === 'above' ? up[up.length - 1] : up[0]).id;
    }
    const id = addStorey(app.store, from, where);
    if (!id) return null;
    open(id);
    app.hint(`${nameOf(id)} på ${fmt(doc().storeys.find((s) => s.id === id)!.elevation)}. Våningen under visas tonad med Visa → Kalkera.`, 5000);
    return id;
  }

  /** Våningen ovanför (1) eller under (-1) den som visas. */
  function step(dir: 1 | -1): boolean {
    // Från Platsen till våningen närmast ±0 (0.10.25).
    const next = isSite(app.ui.storey) ? groundStorey(doc()) : neighbourStorey(doc(), app.ui.storey, dir);
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
    if (s.site) {
      app.hint('Platsen går inte att ta bort.');
      return false;
    }
    if (buildingStoreys(doc()).length < 2) {
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

  /** Våningarna att flytta eller kopiera till, uppifrån, och Platsen sist (0.10.25). */
  const targets = (): Storey[] => [...storeysUpFrom(doc()).reverse(), ...doc().storeys.filter((s) => s.site)].filter((s) => s.id !== app.ui.storey);

  /** Menyn för det markerade: Flytta och Kopiera till varje annan våning. */
  function menuItems(): MenuItem[] {
    const els = app.selection.list().map((id) => doc().elements[id]).filter(Boolean);
    const others = targets();
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
    const others = targets();
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

  async function rename(id: Id): Promise<void> {
    const name = (await askText('Byt namn', nameOf(id)))?.trim();
    if (name) saveStorey(app.store, id, { name });
  }

  /**
   * Högerklick eller ⋯ på en våning i projektträdet (0.10.11): visa den,
   * dess inställningar, byt namn, ny våning ovanför eller under just den,
   * och ta bort.
   */
  function openMenu(id: Id, x: number, y: number): void {
    const s = doc().storeys.find((v) => v.id === id);
    if (!s) return;
    if (s.site) return openSiteMenu(s, x, y);
    app.ctxMenu.open(
      x,
      y,
      [
        { kind: 'header', label: s.name, sub: `Våning ${fmt(s.elevation)}` },
        { label: 'Visa', disabled: app.ui.storey === id && !app.ui.marker && !app.ui.layout, run: () => open(id) },
        { label: 'Inställningar', run: () => {
          app.selection.clear();
          app.panel.showTreeItem({ kind: 'storey', id });
          if (app.ui.navOpen) app.navigator.render();
        } },
        { label: 'Byt namn…', run: () => void rename(id) },
        traceItem(id, TRACE_STOREY + id, s.name),
        { label: 'Ny vy…', sub: 'Med det som visas nu', run: () => void app.views.newViewOf({ storey: id }) },
        { kind: 'sep' },
        { label: 'Ny våning ovanför', run: () => void create('above', id) },
        { label: 'Ny våning under', run: () => void create('below', id) },
        { kind: 'sep' },
        { label: 'Ta bort…', danger: true, disabled: buildingStoreys(doc()).length < 2, run: () => void remove(id) },
      ],
      s.name,
    );
  }

  /**
   * Kalkera våningen i vyn som visas (0.10.30), utan att någon vy av den
   * behöver finnas. Inte våningen som visas, och inte i fasader, sektioner
   * och blad, där inget kalkeras.
   */
  function traceItem(id: Id, key: string, name: string): MenuItem {
    const on = app.ui.trace === key;
    const here = app.ui.storey === id || !!app.ui.marker || !!app.ui.layout || !!app.ui.worksheet;
    return {
      label: on ? `Sluta kalkera ${name}` : `Kalkera ${name}`,
      checked: on,
      disabled: here && !on,
      ...(here && !on ? { sub: app.ui.storey === id ? 'Visas redan' : 'Bara i en våningsplan' } : {}),
      run: () => app.views.setTrace(on ? null : key),
    };
  }

  /**
   * Platsens meny (0.10.25): visa, inställningarna (dialogen Platsen, som
   * tidigare låg i huvudmenyn), egenskaperna och en ny vy efter någon av
   * förinställningarna.
   */
  function openSiteMenu(s: Storey, x: number, y: number): void {
    app.ctxMenu.open(
      x,
      y,
      [
        { kind: 'header', label: s.name, sub: doc().site ? 'Situationsplan, markplanering och illustrationsplan' : 'Ingen plats ur Höjdkurvor' },
        { label: 'Visa', disabled: app.ui.storey === s.id && !app.ui.marker && !app.ui.layout && !app.ui.worksheet, run: () => open(s.id) },
        { label: 'Inställningar…', run: () => void app.site.showDialog() },
        { label: 'Egenskaper', run: () => {
          app.selection.clear();
          app.panel.showTreeItem({ kind: 'storey', id: s.id });
          if (app.ui.navOpen) app.navigator.render();
        } },
        traceItem(s.id, TRACE_SITE, s.name),
        { kind: 'sep' },
        { kind: 'header', label: 'Ny vy' },
        ...SITE_CATEGORIES.map((c): MenuItem => ({ label: c.name, run: () => app.views.applyView(addSiteView(app.store, c.id)) })),
      ],
      s.name,
    );
  }

  return { create, step, remove, moveTo, menuItems, chooseTarget, open, openMenu };
}

const nfLevel = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
/** Nivån i meter med tecken, som i projektträdet: +2,700. */
function fmt(mm: number): string {
  return `${mm > 0 ? '+' : mm < 0 ? '−' : '±'}${nfLevel.format(Math.abs(mm) / 1000)}`;
}
