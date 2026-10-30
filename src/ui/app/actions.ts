import type { Brand } from '../../brand';
import { createProposal } from '../../core/commands';
import { existingState } from '../../core/states';
import { addSiteView } from '../../core/siteViews';
import { createFolder, createWorksheet } from '../../core/treeCommands';
import type { FeedbackDialog } from '../feedbackDialog';
import type { NavTab } from '../navigator';
import { isNarrow } from '../sheet';
import { applyTheme, type ThemeId } from '../theme';
import { onPaper } from '../../core/model';
import { isSnapEnabled, setSnapEnabled } from '../tools/snap';
import { saveUiSettings } from '../uiSettings';
import type { AppContext } from './context';
import type { installFiles } from './files';
import { nextProposalName } from './helpers';
import type { installMenus } from './menus';
import type { installPanes } from './panes';
import type { installPlot } from './plot';
import type { installSheets } from './sheets';
import { LINE_WEIGHT_LABEL, LINE_WEIGHT_STEPS, type ViewMode } from './shell';
import type { installShowMenu } from './showMenu';
import type { installViews } from './views';
import { installTreeClicks } from './treeClicks';
import { arrangeSelection } from './drawOrderUi';
import { resetOwnPen, resetTypePen } from '../ownPenFields';
import type { OrderMove } from '../../core/drawOrder';

/** De delar av appen som knapparna når utöver `app`. */
export interface ActionParts {
  brand: Brand;
  feedbackDialog: FeedbackDialog;
  about: { open(): void };
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
  const tree = installTreeClicks(app, { sheets, showMenu });
  const pickTreeItem = tree.pickTreeItem;

  function closeMenu(): void {
    menu.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleGrid(): void {
    uiSettings.grid = !uiSettings.grid;
    saveUiSettings(uiSettings);
    app.settingsDialog.update(uiSettings);
    app.view.showGrid = uiSettings.grid;
    syncStatus();
  }

  /** Statusradens knappar (0.8.11): Rutnät, Snäpp och Linjer visar sitt läge. */
  function syncStatus(): void {
    const paper = !!(app.ui.layout || app.store.doc.worksheets.some((w) => w.id === app.ui.worksheet && onPaper(w)));
    const grid = app.$<HTMLButtonElement>('[data-action="grid"]');
    grid.setAttribute('aria-pressed', String(uiSettings.grid && !paper));
    grid.disabled = paper;
    grid.title = paper ? 'Inget rutnät på papper' : 'Rutnätet av eller på (G)';
    const on = isSnapEnabled();
    app.$<HTMLElement>('[data-action="snap"]').setAttribute('aria-pressed', String(on));
    app.out('snap').textContent = on ? 'På' : 'Av';
    app.out('line-weights').textContent = LINE_WEIGHT_LABEL[uiSettings.lineWeights];
    app.view.lineWeights = uiSettings.lineWeights;
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
      showMenu.toggleShowItem(showItem);
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
      // En del (Visa-menyn, 0.8.37) eller alla tre (vyraden).
      const level = detailBtn.dataset.detail as 'sketch' | 'normal' | 'detail';
      const part = detailBtn.dataset.detailPart;
      if (part === 'label') ui.labelDetail = level;
      else if (part === 'model') ui.modelDetail = level;
      else if (part === 'plan') ui.detail = level;
      else ui.detail = ui.labelDetail = ui.modelDetail = level;
      views.syncDetailSwitch();
      app.renderAll();
      return;
    }
    // Projektträdet: vyer, våningar, fasader och sektioner, blad, underlag och mappar.
    if (tree.click(target, e as MouseEvent)) return;
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
        parts.about.open();
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
        // Vid vytypen och kategorin där man är (0.10.32).
        app.styleDialog.open({ type: app.place.viewType(), category: app.place.currentCategory().id });
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
      case 'site':
        closeMenu();
        void app.site.showDialog();
        break;
      case 'site-view': {
        // En ny vy av Platsen efter förinställningen (0.10.25), öppnad.
        const category = target.closest<HTMLElement>('[data-category]')?.dataset.category;
        if (!category) break;
        closeMenu();
        views.applyView(addSiteView(store, category));
        break;
      }
      case 'delete-storey': {
        const id = target.closest<HTMLElement>('[data-id]')?.dataset.id;
        if (id) void app.storeys.remove(id);
        break;
      }
      case 'new-storey-above':
      case 'new-storey-below': {
        // Ny våning (0.9), med inställningarna i egenskaperna.
        const id = app.storeys.create(action === 'new-storey-above' ? 'above' : 'below');
        if (id) pickTreeItem({ kind: 'storey', id });
        break;
      }
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
      case 'new-stamp':
        sheets.newStamp();
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
      case 'wand':
        app.wand.toggle();
        break;
      case 'snap': {
        const on = !isSnapEnabled();
        setSnapEnabled(on);
        syncStatus();
        app.hint(on ? 'Snäppning på' : 'Snäppning av');
        break;
      }
      case 'line-weights': {
        const steps = LINE_WEIGHT_STEPS;
        uiSettings.lineWeights = steps[(steps.indexOf(uiSettings.lineWeights) + 1) % steps.length];
        saveUiSettings(uiSettings);
        syncStatus();
        app.hint(
          uiSettings.lineWeights === 'true'
            ? 'Linjerna som på papperet: tunnare när du zoomar ut.'
            : uiSettings.lineWeights === 'thin'
              ? 'Alla linjer tunna.'
              : 'Linjerna med pennornas tjocklek, lika vid all zoom.',
        );
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
      case 'filter-select':
        closeMenu();
        app.filterSelect.open();
        break;
      case 'continue-line':
        // Rita vidare (0.8.28): 2D-verktyget med linjen kvar markerad; klicka på en ände.
        if (!['polyline', 'spline'].includes(app.draw2dTool.options.kind)) app.draw2dTool.setKind('polyline');
        app.setTool('draw2d', true);
        app.smartMenu.hide();
        app.hint('Klicka på den ände av linjen där den ska fortsätta.', 4000);
        break;
      case 'own-pen-reset':
        // Egen penna (0.8.31) tillbaka till stilbokens.
        resetOwnPen(app.store, app.selection.list());
        break;
      case 'type-pen-reset': {
        // Typens penna (0.8.33) tillbaka till stilbokens.
        const def = target.closest<HTMLElement>('[data-def]')?.dataset.def;
        if (def) resetTypePen(app.store, def);
        break;
      }
      case 'draw-order': {
        // Ritordning (0.8.25), knapparna i egenskaperna och smartmenyn.
        const move = target.closest<HTMLElement>('[data-action]')?.dataset.order as OrderMove | undefined;
        if (move) arrangeSelection(app, move);
        break;
      }
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

  syncStatus();
  return { closeMenu, pickTreeItem, syncStatus, toggleGrid };
}
