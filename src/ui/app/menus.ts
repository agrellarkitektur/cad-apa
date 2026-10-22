import { onPaper as paperSpace } from '../../core/model';
import { setInState } from '../../core/commands';
import { actionOf } from '../../core/states';
import { typeOf } from '../../elements/registry';
import { onLongPress, type MenuItem } from '../contextMenu';
import { pickAt } from '../../view2d/pick';
import { isNarrow } from '../sheet';
import { isSnapEnabled } from '../tools/snap';
import type { AppContext } from './context';

/** Högerklick och långt tryck: menyn för det markerade eller för planen, i plan, 3D och projektträdet. */
export function installMenus(app: AppContext) {
  const viewBtn = app.$<HTMLElement>('.view-btn');
  const viewBtnLongPressed = onLongPress(viewBtn, (x, y) => app.openHistoryMenu(x, y), 450, true);
  viewBtn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    app.openHistoryMenu(e.clientX, e.clientY);
  });
  app.navigator.el.addEventListener('contextmenu', (e) => {
    const urow = (e.target as HTMLElement).closest<HTMLElement>('[data-underlay-pick]');
    if (urow) {
      e.preventDefault();
      app.openUnderlayMenu(urow.dataset.underlayPick!, e.clientX, e.clientY);
      return;
    }
    const mrow = (e.target as HTMLElement).closest<HTMLElement>('[data-marker-pick]');
    if (mrow) {
      e.preventDefault();
      app.openMarkerMenu(mrow.dataset.markerPick!, e.clientX, e.clientY);
      return;
    }
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-view-apply]');
    if (!row) return;
    e.preventDefault();
    app.openViewMenu(row.dataset.viewApply!, e.clientX, e.clientY);
  });
  const viewRowLongPress = onLongPress(app.navigator.el, (x, y, target) => {
    const urow = (target as HTMLElement | null)?.closest<HTMLElement>('[data-underlay-pick]');
    if (urow) {
      app.openUnderlayMenu(urow.dataset.underlayPick!, x, y);
      return;
    }
    const mrow = (target as HTMLElement | null)?.closest<HTMLElement>('[data-marker-pick]');
    if (mrow) {
      app.openMarkerMenu(mrow.dataset.markerPick!, x, y);
      return;
    }
    const row = (target as HTMLElement | null)?.closest<HTMLElement>('[data-view-apply]');
    if (row) app.openViewMenu(row.dataset.viewApply!, x, y);
  });
  // Ett långt tryck på en vy ska inte också öppna vyn.
  app.navigator.el.addEventListener(
    'click',
    (e) => {
      if (viewRowLongPress()) e.stopPropagation();
    },
    true,
  );

  /** Menyn för det som är markerat, eller för planen om inget är markerat. */
  function openObjectMenu(x: number, y: number): void {
    const els = app.selection.list().map((id) => app.store.doc.elements[id]).filter(Boolean);
    if (!els.length) {
      app.ctxMenu.open(
        x,
        y,
        [
          { label: 'Zooma till allt', hint: 'F', run: () => (app.ui.mode !== '3d' ? app.view.zoomToFit() : app.view3d?.frameAll()) },
          { label: 'Klistra in', hint: 'Ctrl+V', run: () => void app.pasteFromMenu() },
          { label: 'Lägg in underlag…', run: () => app.chooseUnderlayFiles() },
          { kind: 'sep' },
          { label: 'Rita vägg', hint: 'W', run: () => app.setTool('wall') },
          { label: 'Sätt in dörr', hint: 'D', run: () => app.setTool('door') },
          { label: 'Sätt in fönster', hint: 'O', run: () => app.setTool('window') },
          { label: 'Rum', hint: 'R', run: () => app.setTool('room') },
          { label: 'Mått', hint: 'M', run: () => app.setTool('dimension') },
          { label: 'Text', hint: 'T', run: () => app.setTool('text') },
          { kind: 'sep' },
          { label: 'Visa…', run: () => app.$<HTMLElement>('.show-btn').click() },
          { label: 'Snäppning', checked: isSnapEnabled(), run: () => app.$<HTMLElement>('[data-action="snap"]').click() },
          { label: 'Rutnät', hint: 'G', checked: app.uiSettings.grid, run: () => app.toggleGrid() },
        ],
        'Planen',
      );
      return;
    }
    const first = els[0];
    const sameType = els.every((e) => e.type === first.type);
    const quick = app.panel.quickMarkup(false);
    const items: MenuItem[] = [];
    if (quick) items.push({ kind: 'html', html: `<div class="quick-bar ctx-quick">${quick}</div>`, onClick: (e) => app.panel.handleClick(e) });
    items.push(
      { kind: 'sep' },
      {
        label: 'Alla inställningar här',
        hint: 'Mer',
        // På telefonen finns ingen smartmeny; där fälls bladet upp i stället.
        run: () => (isNarrow() ? (app.setPanel(true, 'full'), app.panel.showTab('selection')) : app.smartMenu.show(x, y, true)),
      },
      { label: 'Visa i egenskaper', hint: 'P', run: () => (app.setPanel(true, 'full'), app.panel.showTab('selection')) },
      { label: 'Zooma till', run: () => app.zoomToSelection() },
      { label: 'Kopiera', hint: 'Ctrl+C', run: () => void app.copySelection(null) },
      { label: 'Klistra in', hint: 'Ctrl+V', run: () => void app.pasteFromMenu() },
    );
    if (els.length === 1 && first.definition) {
      const def = app.store.doc.definitions[first.definition];
      items.push({
        label: `Markera alla ${def?.name ?? 'av typen'}`,
        run: () => app.selection.set(Object.values(app.store.doc.elements).filter((e) => e.definition === first.definition && e.storey === app.ui.storey).map((e) => e.id)),
      });
    }
    if (sameType) {
      const t = first.type;
      const label = { Wall: 'väggar', Door: 'dörrar', Window: 'fönster', Furniture: 'möbler', Space: 'rum', Dimension: 'mått', Text: 'texter' }[t] ?? 'av samma sort';
      items.push({ label: `Markera alla ${label}`, run: () => selectAllOfType(t) });
    }
    if (els.length === 1 && first.type === 'Underlay') {
      // Underlag (0.8 del 2).
      items.push(
        { kind: 'sep' },
        { label: 'Kalibrera skalan…', run: () => app.startUnderlayTool(first.id, 'calibrate') },
        { label: 'Rikta…', run: () => app.startUnderlayTool(first.id, 'align') },
      );
    }
    // Underlag, fasader och annat som hör till ritningen finns i alla tillstånd, liksom det som är ritat på ett blad eller mallblad (0.8.9).
    const doc = app.store.doc;
    const onPaper = (e: (typeof els)[number]) => doc.sheets.some((s) => s.id === e.space) || doc.worksheets.some((w) => w.id === e.space && paperSpace(w));
    if (els.every((e) => typeOf(e.type)?.global || onPaper(e))) {
      app.ctxMenu.open(x, y, items, 'Det markerade');
      return;
    }
    items.push({ kind: 'sep' }, { kind: 'header', label: 'Finns i' });
    for (const s of app.store.doc.states) {
      const all = els.every((e) => e.states.includes(s.id));
      items.push({ label: s.name, checked: all, run: () => setInState(app.store, els.map((e) => e.id), s.id, !all) });
    }
    app.ctxMenu.open(x, y, items, 'Det markerade');
  }

  function selectAllOfType(type: string): void {
    const vs = app.viewStates();
    app.selection.set(
      Object.values(app.store.doc.elements)
        .filter((e) => e.type === type && e.storey === app.ui.storey && actionOf(e, vs) !== 'absent')
        .map((e) => e.id),
    );
  }

  /** Högerklick i planen: markera det man pekar på och öppna menyn. */
  function planContext(clientX: number, clientY: number): void {
    const r = app.pane2d.getBoundingClientRect();
    const p = app.view.camera.toModel([clientX - r.left, clientY - r.top]);
    const id = pickAt(app.plan.pickables, p, 6 / app.view.camera.scale, app.view.drawingScale);
    if (id && !app.selection.has(id)) app.selection.set([id]);
    if (!id && app.ui.tool === 'select') app.selection.clear();
    app.smartMenu.hide();
    openObjectMenu(clientX, clientY);
  }
  app.pane2d.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    planContext(e.clientX, e.clientY);
  });
  // Långt tryck på telefonen. Trycket ska då inte också markera.
  onLongPress(app.pane2d, (x, y) => {
    app.selectTool.suppressNextClick();
    planContext(x, y);
  });

  // 3D: högerklick utan drag öppnar menyn; högerdrag panorerar som förut.
  let rightDown: { x: number; y: number } | null = null;
  app.pane3d.addEventListener('pointerdown', (e) => {
    if (e.button === 2) rightDown = { x: e.clientX, y: e.clientY };
  }, { capture: true });
  app.pane3d.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const d = rightDown;
    rightDown = null;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
    const id = app.view3d?.idAt(e.clientX, e.clientY) ?? null;
    if (id && !app.selection.has(id)) app.selection.set([id]);
    openObjectMenu(e.clientX, e.clientY);
  });
  return { viewBtnLongPressed };
}
