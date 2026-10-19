import { deleteElements, renameElement, updateParams } from '../../core/commands';
import { newId } from '../../core/ids';
import type { Id } from '../../core/model';
import { markerFrame, markerName } from '../../elements/markers';
import type { Vec2 } from '../../repr/primitives';
import { askConfirm, askText } from '../ask';
import { type MenuItem } from '../contextMenu';
import type { AppContext } from './context';
import { describeView } from './helpers';

/** Ett ställe man varit på: en sparad vy, ett våningsplan i modellen, eller en fasad eller sektion. */
export type Place = { kind: 'view'; id: Id } | { kind: 'storey'; id: Id } | { kind: 'marker'; id: Id };

/** Vyhistorik, Gå till (vy, våningsplan, fasad eller sektion), sparade vyer och menyerna för vyer och markörer. */
export function installViews(app: AppContext) {
  /** Senaste först. Det första är där man är nu. */
  const viewHistory: Place[] = [{ kind: 'storey', id: app.ui.storey }];
  const samePlace = (a: Place, b: Place) => a.kind === b.kind && a.id === b.id;

  function visit(p: Place): void {
    const i = viewHistory.findIndex((q) => samePlace(q, p));
    if (i >= 0) viewHistory.splice(i, 1);
    viewHistory.unshift(p);
    viewHistory.length = Math.min(viewHistory.length, 6);
  }

  function placeLabel(p: Place): { name: string; sub: string } | null {
    if (p.kind === 'view') {
      const v = app.store.doc.views.find((x) => x.id === p.id);
      return v ? { name: v.name, sub: `Vy · ${describeView(v)}` } : null;
    }
    if (p.kind === 'marker') {
      const el = app.store.doc.elements[p.id];
      return el ? { name: markerName(app.store.doc, el), sub: el.type === 'Section' ? 'Sektion' : 'Fasad' } : null;
    }
    const s = app.store.doc.storeys.find((x) => x.id === p.id);
    return s ? { name: s.name, sub: 'Modell' } : null;
  }

  function goTo(p: Place): void {
    if (p.kind === 'view') {
      const v = app.store.doc.views.find((x) => x.id === p.id);
      if (v) app.applyView(v);
    } else if (p.kind === 'marker') {
      const el = app.store.doc.elements[p.id];
      if (!el) return;
      const was = app.ui.marker;
      app.ui.marker = p.id;
      app.ui.storey = el.storey;
      app.ui.activeView = null;
      if (app.ui.tool !== 'select' && app.ui.tool !== 'pan') app.setTool('select');
      app.measureBox.close();
      app.palette.hide();
      app.selection.clear();
      visit(p);
      if (app.ui.mode === '3d') void app.setMode('2d');
      app.renderAll();
      if (was !== p.id) app.view.zoomToFit();
    } else if (app.store.doc.storeys.some((s) => s.id === p.id)) {
      const was = app.ui.marker;
      app.ui.storey = p.id;
      app.ui.marker = null;
      app.ui.activeView = null;
      visit(p);
      app.renderAll();
      if (was) {
        app.selection.clear();
        app.view.zoomToFit();
      }
    }
  }

  /** Högerklick eller ⋯ på en fasad eller sektion. */
  function openMarkerMenu(id: Id, x: number, y: number): void {
    const el = app.store.doc.elements[id];
    if (!el) return;
    const p = el.params as { auto?: boolean; side?: number };
    const name = markerName(app.store.doc, el);
    app.ctxMenu.open(
      x,
      y,
      [
        { kind: 'header', label: name, sub: el.type === 'Section' ? 'Sektion' : 'Fasad' },
        { label: 'Visa', disabled: app.ui.marker === id, run: () => goTo({ kind: 'marker', id }) },
        {
          label: 'Visa linjen i planen',
          run: () => {
            goTo({ kind: 'storey', id: el.storey });
            app.selection.set([id]);
          },
        },
        { label: 'Byt namn…', run: () => void renameMarker(id) },
        {
          label: 'Placeras automatiskt',
          checked: !!p.auto,
          sub: el.type === 'Section' ? 'Genom mitten av huset' : 'Utanför huset, följer det',
          run: () => setMarkerAuto(id, !p.auto),
        },
        { label: 'Vänd blickriktningen', disabled: !!p.auto, run: () => updateParams(app.store, [id], { side: -(p.side ?? 1) }, 'Vänd blickriktningen') },
        { kind: 'sep' },
        { label: 'Ta bort…', danger: true, run: () => void deleteMarker(id) },
      ],
      name,
    );
  }

  async function renameMarker(id: Id): Promise<void> {
    const el = app.store.doc.elements[id];
    if (!el) return;
    const name = await askText('Byt namn', markerName(app.store.doc, el));
    if (name === null) return;
    renameElement(app.store, id, name);
  }

  /** Slå på eller av automatisk placering. Av: linjen stannar där den är nu. */
  function setMarkerAuto(id: Id, auto: boolean): void {
    const el = app.store.doc.elements[id];
    if (!el) return;
    if (auto) {
      updateParams(app.store, [id], { auto: true }, 'Placera automatiskt');
      return;
    }
    const f = markerFrame(app.store.doc, el);
    const r2 = (q: Vec2): [number, number] => [Math.round(q[0]), Math.round(q[1])];
    updateParams(app.store, [id], { auto: false, start: r2(f.start), end: r2(f.end), side: 1 }, 'Placera själv');
  }

  async function deleteMarker(id: Id): Promise<void> {
    const el = app.store.doc.elements[id];
    if (!el) return;
    const name = markerName(app.store.doc, el);
    if (!(await askConfirm(`Ta bort ${name}?`, 'Linjen tas bort ur planen och vyn ur projektträdet. Det går att ångra.'))) return;
    if (app.ui.marker === id) goTo({ kind: 'storey', id: el.storey });
    deleteElements(app.store, [id]);
  }

  /** De senaste vyerna, vid vyknappen. */
  function openHistoryMenu(x: number, y: number): void {
    const items: MenuItem[] = [{ kind: 'header', label: 'Senaste vyerna' }];
    viewHistory
      .map((p) => ({ p, l: placeLabel(p) }))
      .filter((r) => r.l)
      .slice(0, 5)
      .forEach(({ p, l }, i) =>
        items.push({ label: l!.name, sub: l!.sub, hint: i === 0 ? 'nu' : i === 1 ? 'klick' : undefined, disabled: i === 0, run: () => goTo(p) }),
      );
    items.push({ kind: 'sep' }, { label: 'Alla vyer i projektträdet', run: () => (app.navigator.showTab('vyer'), app.setNav(true)) });
    if (!app.ui.activeView) items.push({ label: 'Spara det som visas som vy…', run: () => void saveViewAsNew() });
    app.ctxMenu.open(x, y, items, 'Senaste vyerna');
  }

  /** Högerklick eller ⋯ på en vy i projektträdet. */
  function openViewMenu(id: Id, x: number, y: number): void {
    const v = app.store.doc.views.find((q) => q.id === id);
    if (!v) return;
    const traced = app.ui.trace === id;
    app.ctxMenu.open(
      x,
      y,
      [
        { kind: 'header', label: v.name, sub: describeView(v) },
        { label: 'Visa vyn', run: () => app.applyView(v), disabled: app.ui.activeView === id && !app.viewModified(v) },
        { label: traced ? 'Sluta kalkera vyn' : 'Kalkera den här vyn', checked: traced, disabled: app.ui.activeView === id, run: () => setTrace(traced ? null : id) },
        ...(app.ui.activeView === id ? [{ label: 'Spara nuvarande inställningar i vyn', disabled: !app.viewModified(v), run: () => void updateActiveView() }] : []),
        { label: 'Byt namn…', run: () => void renameView(id) },
        { label: 'Duplicera', run: () => duplicateView(id) },
        { kind: 'sep' },
        { label: 'Ta bort…', danger: true, run: () => void deleteView(id) },
      ],
      v.name,
    );
  }

  async function saveViewAsNew(): Promise<void> {
    app.closeShowMenu();
    const st = app.store.doc.states.find((x) => x.id === app.ui.state)?.name ?? '';
    // Namnet på det som visas: fasaden eller sektionen om en är öppen, annars våningen.
    const m = app.ui.marker ? app.store.doc.elements[app.ui.marker] : undefined;
    const shown = m ? markerName(app.store.doc, m) : (app.store.doc.storeys.find((x) => x.id === app.ui.storey)?.name ?? '');
    const name = await askText('Spara som vy', st ? `${shown} – ${st}` : shown);
    if (!name) return;
    const v = app.currentViewDef(newId('vy'), name);
    app.store.transact(`Ny vy: ${name}`, (tx) => tx.setViews([...tx.doc.views, v]));
    app.ui.activeView = v.id;
    visit({ kind: 'view', id: v.id });
    app.renderAll();
  }

  async function updateActiveView(): Promise<void> {
    app.closeShowMenu();
    const v = app.store.doc.views.find((x) => x.id === app.ui.activeView);
    if (v) app.store.transact(`Spara vyn ${v.name}`, (tx) => tx.setViews(tx.doc.views.map((x) => (x.id === v.id ? app.currentViewDef(v.id, v.name) : x))));
  }

  async function renameView(id: Id): Promise<void> {
    const v = app.store.doc.views.find((x) => x.id === id);
    if (!v) return;
    const name = await askText('Byt namn på vyn', v.name);
    if (name && name !== v.name) app.store.transact(`Byt namn på vyn till ${name}`, (tx) => tx.setViews(tx.doc.views.map((x) => (x.id === id ? { ...x, name } : x))));
  }

  function duplicateView(id: Id): void {
    const v = app.store.doc.views.find((x) => x.id === id);
    if (!v) return;
    const copy = { ...structuredClone(v), id: newId('vy'), name: `${v.name} (kopia)` };
    app.store.transact(`Duplicera vyn ${v.name}`, (tx) => tx.setViews([...tx.doc.views, copy]));
  }

  async function deleteView(id: Id): Promise<void> {
    const v = app.store.doc.views.find((x) => x.id === id);
    if (!v || !(await askConfirm('Ta bort vyn?', `${v.name} tas bort. Det går att ångra.`))) return;
    if (app.ui.activeView === id) app.ui.activeView = null;
    if (app.ui.trace === id) app.ui.trace = null;
    app.store.transact(`Ta bort vyn ${v.name}`, (tx) => tx.setViews(tx.doc.views.filter((x) => x.id !== id)));
  }

  function setTrace(id: Id | null): void {
    app.ui.trace = id;
    app.renderAll();
    if (id) app.hint('Vyn kalkeras. Utseendet ställs in under Visa.');
  }
  return { goTo, openHistoryMenu, openMarkerMenu, openViewMenu, saveViewAsNew, updateActiveView, viewHistory, visit };
}
