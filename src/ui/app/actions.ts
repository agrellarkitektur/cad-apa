import type { Brand } from '../../brand';
import { createProposal } from '../../core/commands';
import { ENGINE } from '../../core/engine';
import { existingState } from '../../core/states';
import { createFolder, createWorksheet } from '../../core/treeCommands';
import type { FeedbackDialog } from '../feedbackDialog';
import type { NavTab } from '../navigator';
import { isNarrow } from '../sheet';
import { applyTheme, type ThemeId } from '../theme';
import type { Id } from '../../core/model';
import { isSnapEnabled, setSnapEnabled } from '../tools/snap';
import type { TreeItem } from '../treeItemPanel';
import { saveUiSettings } from '../uiSettings';
import type { AppContext } from './context';
import type { installFiles } from './files';
import { nextProposalName } from './helpers';
import type { installMenus } from './menus';
import type { installPanes } from './panes';
import type { installPlot } from './plot';
import type { installSheets } from './sheets';
import type { ViewMode } from './shell';
import type { installShowMenu } from './showMenu';
import type { installViews } from './views';

/** De delar av appen som knapparna når utöver `app`. */
export interface ActionParts {
  brand: Brand;
  feedbackDialog: FeedbackDialog;
  files: ReturnType<typeof installFiles>;
  menus: ReturnType<typeof installMenus>;
  panes: ReturnType<typeof installPanes>;
  plot: ReturnType<typeof installPlot>;
  sheets: ReturnType<typeof installSheets>;
  showMenu: ReturnType<typeof installShowMenu>;
  views: ReturnType<typeof installViews>;
}

/**
 * Knapparna: ett klick var som helst i appen letar upp närmaste
 * `data-action` (eller ett val i projektträdet, Visa-menyn och huvudmenyn)
 * och gör det. Dessutom tillståndsflikarna och Jämför med.
 */
export function installActions(app: AppContext, parts: ActionParts) {
  const { root, ui, uiSettings } = app;
  const { files, panes, sheets, showMenu, views } = parts;
  const menu = app.menu;
  const menuBtn = app.$<HTMLButtonElement>('[data-action="menu"]');

  function closeMenu(): void {
    menu.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleGrid(): void {
    uiSettings.grid = !uiSettings.grid;
    saveUiSettings(uiSettings);
    app.settingsDialog.update(uiSettings);
    app.view.showGrid = uiSettings.grid;
  }

  /** Visa inställningarna för det man valt i trädet i egenskapspanelen. */
  function pickTreeItem(item: TreeItem): void {
    app.selection.clear();
    app.panel.showTreeItem(item);
    if (ui.navOpen) app.navigator.render();
  }

  /**
   * Bladen som är markerade i trädet efter ett Ctrl-klick (lägg till eller
   * ta bort) eller Shift-klick (alla blad mellan det första markerade och
   * det klickade, i nummerordning). Det första är bladet som visas, om det
   * är med.
   */
  function pickSheets(id: Id, range: boolean): { kind: 'sheet'; id: Id; also: Id[] } | null {
    const t = app.panel.treeItem;
    const now = t?.kind === 'sheet' ? [t.id, ...(t.also ?? [])] : ui.layout ? [ui.layout] : [];
    let ids: Id[];
    if (range && now.length) {
      const order = [...app.store.doc.sheets].sort((a, b) => a.number.localeCompare(b.number, 'sv', { numeric: true })).map((s) => s.id);
      const [i, j] = [order.indexOf(now[0]), order.indexOf(id)].sort((a, b) => a - b);
      ids = i < 0 ? [id] : [now[0], ...order.slice(i, j + 1).filter((x) => x !== now[0])];
    } else ids = now.includes(id) ? now.filter((x) => x !== id) : [...now, id];
    if (!ids.length) return null;
    if (ui.layout && ids.includes(ui.layout)) ids = [ui.layout, ...ids.filter((x) => x !== ui.layout)];
    return { kind: 'sheet', id: ids[0], also: ids.slice(1) };
  }

  // Tillstånden i flikarna ovanför ritytan, och Jämför med.
  app.$<HTMLElement>('.chips').addEventListener('click', (e) => {
    const chip = (e.target as Element).closest<HTMLElement>('[data-state]');
    if (chip) {
      ui.state = chip.dataset.state!;
      app.renderAll();
    }
  });
  const compareToggle = app.$<HTMLInputElement>('#compare-toggle');
  compareToggle.addEventListener('change', () => {
    ui.compare = compareToggle.checked;
    app.renderAll();
  });

  // Dubbelklick i projektträdet när bara 3D visas (0.8.4): klicket går till
  // våningen eller vyn, dubbelklicket visar den i 2D. Trädet ritas om vid
  // klicket, så webbläsaren ser inget dubbelklick; det räknas här. Fasader,
  // sektioner, arbetsblad och blad går över till 2D redan vid klick.
  let lastPick = { key: '', t: 0 };
  function treeDoubleClick(key: string): void {
    const now = performance.now();
    const double = lastPick.key === key && now - lastPick.t < 450;
    lastPick = double ? { key: '', t: 0 } : { key, t: now };
    if (double && ui.mode === '3d') void app.setMode('2d');
  }

  root.addEventListener('click', async (e) => {
    const target = e.target as Element;
    const { store, view, navigator, panel } = app;
    if (!target.closest('.menu-wrap')) closeMenu();
    const modeBtn = target.closest<HTMLElement>('.view-modes [data-mode]');
    if (modeBtn) {
      void app.setMode(modeBtn.dataset.mode as ViewMode);
      return;
    }
    const themePick = target.closest<HTMLElement>('.menu [data-theme-id]');
    if (themePick) {
      applyTheme(themePick.dataset.themeId as ThemeId);
      closeMenu();
      return;
    }
    const showItem = target.closest<HTMLInputElement>('.show-menu input');
    if (showItem) {
      const key = showItem.dataset.show!;
      if (key === 'demolished') ui.hideDemolished = !showItem.checked;
      // Visa dolda 2D-element (0.8) är en tillfällig hjälp, inte en del av vyn.
      else if (key === 'showHidden') ui.showHidden = showItem.checked;
      else ui.hide = showItem.checked ? ui.hide.filter((h) => h !== key) : [...ui.hide, key];
      app.renderAll();
      return;
    }
    if (!target.closest('.show-wrap')) showMenu.closeShowMenu();
    const traceAbove = target.closest<HTMLElement>('[data-trace-above]');
    if (traceAbove) {
      uiSettings.trace.above = traceAbove.dataset.traceAbove === '1';
      saveUiSettings(uiSettings);
      showMenu.applyTraceLook();
      showMenu.refreshShowMenu();
      return;
    }
    const styleSel = target.closest<HTMLSelectElement>('[data-show-style], [data-show-trace]');
    if (styleSel) return;
    const detailBtn = target.closest<HTMLElement>('[data-detail]');
    if (detailBtn) {
      ui.detail = detailBtn.dataset.detail as 'sketch' | 'normal' | 'detail';
      views.syncDetailSwitch();
      app.renderAll();
      return;
    }
    const navTab = target.closest<HTMLElement>('[data-nav-tab]');
    if (navTab) {
      navigator.showTab(navTab.dataset.navTab as NavTab);
      if (!ui.navOpen) app.setNav(true);
      return;
    }
    // En flik i en hopfälld egenskapspanel fäller ut den.
    if (target.closest('.panel [data-tab]') && !ui.panelOpen && !isNarrow()) {
      app.setPanel(true, 'full');
      return;
    }
    const markerPick = target.closest<HTMLElement>('[data-marker-pick]');
    if (markerPick) {
      if (isNarrow()) app.setNav(false);
      app.goTo({ kind: 'marker', id: markerPick.dataset.markerPick! });
      pickTreeItem({ kind: 'marker', id: markerPick.dataset.markerPick! });
      return;
    }
    const folderToggle = target.closest<HTMLElement>('[data-folder-toggle]');
    if (folderToggle) {
      navigator.toggleFolder(folderToggle.dataset.folderToggle!);
      return;
    }
    const folderPick = target.closest<HTMLElement>('[data-folder-pick]');
    if (folderPick) {
      pickTreeItem({ kind: 'folder', id: folderPick.dataset.folderPick! });
      // På telefonen täcker trädet allt: stäng det och visa mappens inställningar.
      if (isNarrow()) {
        app.setNav(false);
        app.setPanel(true, 'full');
      } else if (!ui.panelOpen) app.setPanel(true);
      return;
    }
    const underlayPick = target.closest<HTMLElement>('[data-underlay-pick]');
    if (underlayPick) {
      treeDoubleClick(`underlay:${underlayPick.dataset.underlayPick}`);
      if (isNarrow()) app.setNav(false);
      app.showUnderlay(underlayPick.dataset.underlayPick!);
      return;
    }
    const underlayMore = target.closest<HTMLElement>('[data-underlay-menu]');
    if (underlayMore) {
      const r = underlayMore.getBoundingClientRect();
      app.openUnderlayMenu(underlayMore.dataset.underlayMenu!, r.left, r.bottom + 4);
      return;
    }
    const sheetPick = target.closest<HTMLElement>('[data-sheet-pick]');
    if (sheetPick) {
      const me = e as MouseEvent;
      // Ctrl- eller Shift-klick (0.8.10): flera blad, för att fylla i fälten tillsammans.
      if ((me.ctrlKey || me.metaKey || me.shiftKey) && !isNarrow()) {
        sheets.pick(pickSheets(sheetPick.dataset.sheetPick!, me.shiftKey));
        return;
      }
      // Ett ritningsblad (0.8 del 3): visa det och dess inställningar.
      if (isNarrow()) app.setNav(false);
      app.goTo({ kind: 'sheet', id: sheetPick.dataset.sheetPick! });
      sheets.pick({ kind: 'sheet', id: sheetPick.dataset.sheetPick! });
      return;
    }
    const worksheetPick = target.closest<HTMLElement>('[data-worksheet-pick]');
    if (worksheetPick) {
      if (isNarrow()) app.setNav(false);
      app.goTo({ kind: 'worksheet', id: worksheetPick.dataset.worksheetPick! });
      pickTreeItem({ kind: 'worksheet', id: worksheetPick.dataset.worksheetPick! });
      return;
    }
    const markerMore = target.closest<HTMLElement>('[data-marker-menu]');
    if (markerMore) {
      const r = markerMore.getBoundingClientRect();
      app.openMarkerMenu(markerMore.dataset.markerMenu!, r.left, r.bottom + 4);
      return;
    }
    const storeyPick = target.closest<HTMLElement>('[data-storey-pick]');
    if (storeyPick) {
      treeDoubleClick(`storey:${storeyPick.dataset.storeyPick}`);
      if (isNarrow()) app.setNav(false);
      app.goTo({ kind: 'storey', id: storeyPick.dataset.storeyPick! });
      pickTreeItem({ kind: 'storey', id: storeyPick.dataset.storeyPick! });
      return;
    }
    const viewPick = target.closest<HTMLElement>('[data-view-apply]');
    if (viewPick) {
      treeDoubleClick(`view:${viewPick.dataset.viewApply}`);
      const v = store.doc.views.find((x) => x.id === viewPick.dataset.viewApply);
      showMenu.closeShowMenu();
      if (isNarrow()) app.setNav(false);
      if (v) {
        app.applyView(v);
        pickTreeItem({ kind: 'view', id: v.id });
      }
      return;
    }
    const viewMore = target.closest<HTMLElement>('[data-view-menu]');
    if (viewMore) {
      const r = viewMore.getBoundingClientRect();
      app.openViewMenu(viewMore.dataset.viewMenu!, r.left, r.bottom + 4);
      return;
    }
    const action = target.closest('[data-action]')?.getAttribute('data-action');
    switch (action) {
      case 'undo':
        store.undo();
        break;
      case 'redo':
        store.redo();
        break;
      case 'zoom-in':
        view.zoomBy(1.4);
        break;
      case 'zoom-out':
        view.zoomBy(1 / 1.4);
        break;
      case 'zoom-box':
        app.startZoomBox();
        break;
      case 'zoom-prev':
        app.previousZoom();
        break;
      case 'fit':
        if (ui.mode !== '3d') view.zoomToFit();
        if (ui.mode !== '2d') app.view3d?.frameAll();
        break;
      case 'grid':
        toggleGrid();
        break;
      case 'toggle-panel':
        panes.togglePanel();
        break;
      case 'open-panel-band':
        panes.setPaneMode('panel', 'open');
        break;
      case 'min-panel':
        panes.setPaneMode('panel', 'min');
        break;
      case 'close-panel':
        app.setPanel(false);
        break;
      case 'open-nav':
        panes.setPaneMode('nav', 'open');
        break;
      case 'min-nav':
        panes.setPaneMode('nav', 'min');
        break;
      case 'close-nav':
        app.setNav(false);
        break;
      case 'menu':
        menu.hidden = !menu.hidden;
        menuBtn.setAttribute('aria-expanded', String(!menu.hidden));
        break;
      case 'feedback':
        closeMenu();
        parts.feedbackDialog.open();
        break;
      case 'about':
        closeMenu();
        app.hint(`${parts.brand.name} · ${ENGINE.name} ${ENGINE.version}. Öppen källkod (GPL). Vad som är nytt står i README på GitHub.`, 5000);
        break;
      case 'views':
        // Klick: tillbaka till förra vyn. Håll in eller högerklicka: de senaste.
        if (parts.menus.viewBtnLongPressed()) break;
        if (views.viewHistory.length > 1) app.goTo(views.viewHistory[1]);
        else {
          navigator.showTab('vyer');
          app.setNav(true);
        }
        break;
      case 'view-save':
        if (ui.activeView) void views.updateActiveView();
        else void views.saveViewAsNew();
        break;
      case 'show-types':
        closeMenu();
        app.setPanel(true, 'full');
        panel.showTab('types');
        break;
      case 'style':
        closeMenu();
        showMenu.closeShowMenu();
        app.styleDialog.open();
        break;
      case 'show-menu':
        showMenu.toggleShowMenu();
        break;
      case 'toggle-nav':
        panes.toggleNav();
        break;
      case 'new-folder': {
        const tab = (target.closest<HTMLElement>('[data-tab]')?.dataset.tab ?? navigator.tab) as NavTab;
        const id = createFolder(store, tab, 'Ny mapp');
        pickTreeItem({ kind: 'folder', id });
        if (isNarrow()) {
          app.setNav(false);
          app.setPanel(true, 'full');
        } else if (!ui.panelOpen) app.setPanel(true);
        requestAnimationFrame(() => panel.el.querySelector<HTMLInputElement>('.tree-form input[name="name"]')?.select());
        break;
      }
      case 'view-save-new':
        void views.saveViewAsNew();
        break;
      case 'add-underlay':
        closeMenu();
        app.chooseUnderlayFiles();
        break;
      case 'new-worksheet': {
        const n = store.doc.worksheets.length + 1;
        const id = createWorksheet(store, `Arbetsblad ${n}`);
        if (isNarrow()) app.setNav(false);
        app.goTo({ kind: 'worksheet', id });
        pickTreeItem({ kind: 'worksheet', id });
        if (!isNarrow() && !ui.panelOpen) app.setPanel(true);
        app.hint('Ett tomt arbetsblad. Rita med 2D, Text och Mått, eller lägg in ett underlag.', 4000);
        break;
      }
      case 'view-update':
        void views.updateActiveView();
        break;
      case 'new-master':
        sheets.newMaster();
        break;
      case 'new-sheet':
        sheets.newSheet();
        break;
      case 'plot':
        closeMenu();
        parts.plot.open();
        break;
      case 'cancel-command':
        app.cancelCommand();
        break;
      case 'scale-pop':
        if (showMenu.scalePop.hidden) showMenu.openScalePop();
        else showMenu.closeScalePop();
        break;
      case 'scale-settings':
        showMenu.closeScalePop();
        app.settingsDialog.open();
        break;
      case 'snap': {
        const on = !isSnapEnabled();
        setSnapEnabled(on);
        app.$<HTMLElement>('[data-action="snap"]').setAttribute('aria-pressed', String(on));
        app.hint(on ? 'Snäppning på' : 'Snäppning av');
        break;
      }
      case 'open-panel':
        app.smartMenu.hide();
        app.setPanel(true, 'full');
        panel.showTab('selection');
        break;
      case 'save':
      case 'save-as': {
        closeMenu();
        await files.saveNow(action === 'save-as');
        break;
      }
      case 'settings':
        closeMenu();
        app.settingsDialog.open();
        break;
      case 'zoom-selection':
        app.zoomToSelection();
        break;
      case 'new-project':
        closeMenu();
        files.newProjectDialog.open();
        break;
      case 'new-proposal': {
        closeMenu();
        const doc = store.doc;
        const current = doc.states.find((s) => s.id === ui.state);
        const copyFrom = current?.kind === 'proposal' ? current.id : undefined;
        const s = createProposal(store, nextProposalName(doc), copyFrom);
        ui.state = s.id;
        app.renderAll();
        app.hint(`${s.name} skapades som kopia av ${copyFrom ? current!.name : (existingState(doc)?.name ?? 'inget')}.`);
        break;
      }
      case 'open-file':
        closeMenu();
        await files.openFile();
        break;
      case 'reset-sample':
        closeMenu();
        files.resetSample();
        break;
    }
  });

  return { closeMenu, pickTreeItem, toggleGrid };
}
