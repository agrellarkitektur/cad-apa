import { eraseSelection } from './app/erase';
import { setWeightSource } from './weightPick';
import { generalOf } from '../core/general';
import type { Brand } from '../brand';
import type { ProjectDoc } from '../core/model';
import { DocStore } from '../core/store';
import { Modifier } from './modify/controller';
import { modifyContextAt, type ModifyHost } from './modify/ops';
import type { Vec2 } from '../repr/primitives';
import { sampleProject } from '../sample/sampleProject';
import { parse } from '../storage/format';
import { keepUnreadable, loadLocal, mayOverwrite, recordFormatVersion } from '../storage/localStore';
import { FORMAT_VERSION } from '../core/model';
import { saveTextFile } from '../storage/projectFile';
import { ContextMenu } from './contextMenu';
import { releasedHint } from './tools/selectTool';
import { minorStepFor } from '../view2d/grid';
import { PlanView } from '../view2d/planView';
import { renderHighlight } from './highlight';
import { MeasureBox } from './measureBox';
import { FeedbackDialog } from './feedbackDialog';
import { installAboutDialog } from './app/aboutDialog';
import { PropertiesPanel } from './propertiesPanel';
import { Selection } from './selection';
import { isNarrow } from './sheet';
import { SmartMenu, type ScreenBox } from './smartMenu';
import { SettingsDialog } from './settingsDialog';
import { StyleDialog } from './styleDialog';
import { TempDims } from './tempDims';
import { Navigator } from './navigator';
import { applyUiColors, loadUiSettings, mmPerCssPx } from './uiSettings';
import { InlineTextEditor } from './textEditor';
import { Camera } from '../view2d/camera';
import { createThemeSwitcher, currentTheme, onThemeChange } from './theme';
import type { ToolHost } from './tools/host';
import { lazyContext, type AppContext } from './app/context';
import { installActions } from './app/actions';
import { installClipboard } from './app/clipboard';
import { installFiles } from './app/files';
import { describeView, formatScale, nf } from './app/helpers';
import { installKeyboard } from './app/keyboard';
import { installMenus } from './app/menus';
import { installPane3d } from './app/pane3d';
import { installPanes } from './app/panes';
import { createUiState, shellMarkup } from './app/shell';
import { installShowMenu } from './app/showMenu';
import { snapSegments } from './app/snapping';
import type { SnapSegment } from './tools/snap';
import { installTextEdit } from './app/textEdit';
import { installToolOptions } from './app/toolOptions';
import { installModifyRail } from './app/modifyRail';
import { bodyContext as bodyContextAt, screenBox, selectionBounds } from './app/selectionPlace';
import { installViews } from './app/views';
import { installUnderlays } from './app/underlays';
import { installFilterSelect } from './app/filterSelect';
import { installStoreys } from './app/storeys';
import { installSite } from './app/site';
import { installSegmentPoints } from './app/segmentPoints';
import { installTreeDrag } from './app/treeDrag';
import { installSheets } from './app/sheets';
import { installPlot } from './app/plot';
import { installRender } from './app/render';
import { installTools } from './app/tools';
import { installWand } from './app/wand';
import { installCommandLine, type CommandLine } from './app/commandLine';

/**
 * Bygger appen: planvyn, verktygen, panelerna och det som binder ihop dem
 * (vad som visas, `renderAll`, markeringen). Resten ligger i `src/ui/app/`,
 * en fil per del (se docs/UTVECKLING.md).
 */
export async function mountApp(root: HTMLElement, brand: Brand): Promise<void> {
  document.title = brand.badge ? `${brand.name} · ${brand.badge}` : brand.name;

  // Senaste autosparade projektet, annars exemplet.
  const saved = await loadLocal();
  let initial: ProjectDoc = sampleProject();
  let migrated = false;
  /** Autosparet är från en nyare version: det får inte skrivas över. */
  let autosaveBlocked = false;
  if (saved) {
    const savedFormat = recordFormatVersion(saved);
    try {
      initial = parse(saved.text);
      migrated = savedFormat !== null && savedFormat < FORMAT_VERSION;
    } catch {
      if (!mayOverwrite(saved, FORMAT_VERSION)) autosaveBlocked = true;
      // Trasigt autospar: lägg det åt sidan och börja med exemplet.
      else await keepUnreadable(saved);
    }
  }
  const store = new DocStore(initial);
  const selection = new Selection();
  // Deklareras tidigt: hint() kan anropas redan medan appen startar.
  let hintTimer = 0;

  // Gränssnittet: rutnät, färger, snabbknappar, panelbredder och skärmstorlek.
  // Hör till användaren, inte projektet.
  const uiSettings = loadUiSettings();
  applyUiColors(uiSettings);
  const desktop = window.innerWidth > 960;

  /** Vad som visas just nu. Hör till vyn, inte till projektet. */
  const ui = createUiState(initial, uiSettings, desktop);

  root.innerHTML = shellMarkup(brand);

  const $ = <T extends Element>(sel: string) => root.querySelector(sel) as T;
  const out = (name: string) => $<HTMLElement>(`[data-out="${name}"]`);
  const appEl = $<HTMLElement>('.app');
  const canvas = $<HTMLElement>('.canvas');
  const hintEl = $<HTMLElement>('.hint');
  const chips = $<HTMLElement>('.chips');
  const compareToggle = $<HTMLInputElement>('#compare-toggle');
  const compareLabel = $<HTMLElement>('#compare-wrap');
  const toolOptions = out('tool-options');
  const menu = $<HTMLElement>('.menu');
  $<HTMLElement>('.theme-slot').replaceWith(createThemeSwitcher());
  const syncThemeMenu = () =>
    menu.querySelectorAll<HTMLElement>('[data-theme-id]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themeId === currentTheme())));
  syncThemeMenu();
  onThemeChange(() => {
    syncThemeMenu();
    view.redraw();
    // Vänta tills de nya färgerna gäller innan 3D-vyn läser dem.
    requestAnimationFrame(() => pane3d.view3d?.refreshColors());
  });

  // Rutan för längd och ändring när en väggände dragits.
  const measureBox = new MeasureBox(store);
  canvas.appendChild(measureBox.el);

  // ---------- Planvy ----------
  // Ritytan har en ruta för planen och en för 3D; läget avgör vilka som syns.
  const pane2d = document.createElement('div');
  pane2d.className = 'pane-2d';
  const pane3dEl = document.createElement('div');
  pane3dEl.className = 'pane-3d';
  // Visas medan en fasad eller sektion räknas i bakgrundstråden (0.8.2).
  const computing = document.createElement('div');
  computing.className = 'computing';
  computing.setAttribute('role', 'status');
  computing.textContent = 'Räknar…';
  computing.hidden = true;
  pane2d.append(computing);
  canvas.prepend(pane2d, pane3dEl);

  /** Hur stor en CSS-pixel är på skärmen, mm. */
  const screenMm = () => mmPerCssPx(uiSettings.screenInches);
  /** Skapas efter planvyn, men vyn kan rapportera zoom redan när den startar. */
  let textEditor: InlineTextEditor | undefined;
  /** Lägger smartmenyn igen när planen panoreras eller zoomas (sätts när menyn finns). */
  let repositionMenu = (): void => {};

  const view = new PlanView(pane2d, {
    onCursor: (p: Vec2 | null) => {
      out('x').textContent = p ? nf.format(p[0]) : '—';
      out('y').textContent = p ? nf.format(p[1]) : '—';
    },
    onViewChange: (cam: Camera) => {
      if (ui.mode !== '3d') measureBox.update((p) => cam.toScreen(p));
      out('scale').textContent = `${uiSettings.screenInches ? '' : '≈ '}1:${formatScale(cam.screenScaleDenominator(screenMm()))}`;
      textEditor?.position(cam);
      repositionMenu();
      const step = minorStepFor(cam.scale);
      out('grid').textContent = step >= 1000 ? `${nf.format(step / 1000)} m` : `${nf.format(step)} mm`;
    },
  });

  // Text som redigeras direkt i ritningen (dubbelklick).
  textEditor = new InlineTextEditor(pane2d);

  // ---------- Verktyg ----------
  // Segmentpunkterna (0.8.18) läggs först; samma listor ger samma lista, så
  // att snäppningens rutnät (som hör till listan) behålls mellan musrörelserna.
  let joined: { base: unknown; pts: unknown; out: SnapSegment[] } | null = null;
  const withSegmentPoints = (base: SnapSegment[]): SnapSegment[] => {
    const pts = app.segmentPoints.points;
    if (!pts.length) return base;
    if (joined?.base !== base || joined.pts !== pts) joined = { base, pts, out: [...app.segmentPoints.segments(), ...base] };
    return joined.out;
  };
  const host: ToolHost = {
    store,
    selection,
    view,
    plan: () => render.plan,
    readOnly: () => !!ui.marker,
    canEdit: (id) => !!ui.marker && (store.doc.elements[id]?.space === ui.marker || id.startsWith('slope:')),
    space: () => ui.marker ?? ui.worksheet ?? ui.layout ?? undefined,
    activeState: () => ui.state,
    storey: () => ui.storey,
    hint,
    wallEndMoved: (wallId, end, original, companions) => {
      measureBox.showWallEnd(wallId, end, original, companions);
      render.positionMeasureBox();
    },
    elementsMoved: (ids, applied, anchor) => {
      measureBox.showMove(ids, applied, anchor);
      render.positionMeasureBox();
    },
    editText: (id, at) => textEdit.editTextAt(id, at),
    modify: (p, hitId) => {
      if (ui.tool !== 'select') return false;
      // I fasader och sektioner bara för det som är ritat där (0.8 del 2).
      if (ui.marker && !selection.list().every((id) => host.canEdit?.(id))) return false;
      const r = view.svg.getBoundingClientRect();
      const ctx = modifyContextAt(host, p, r.left + p.screen[0], r.top + p.screen[1], hitId);
      if (!ctx) return false;
      // Klick på en väggs ände börjar en ny vägg därifrån (0.8.4); smartmenyn
      // visar de andra valen, så att man kan byta utan att avbryta först.
      const wallEnd = !!ctx.wallId && !!ctx.end && (ctx.kind === 'point' || ctx.kind === 'corner') && !store.doc.elements[ctx.wallId]?.locked;
      modifier.setPart(ctx, wallEnd ? 'wallOn' : undefined);
      if (menuWanted()) smartMenu.show(ctx.clientX, ctx.clientY);
      return true;
    },
    // I fasader, sektioner och på arbetsblad snäpper man mot linjerna i ritningen.
    snapSegments: () => withSegmentPoints(snapSegments(app)),
  };

  // ---------- Panel och dialog ----------
  const panel = new PropertiesPanel(store, selection, () => render.viewStates());
  panel.onOpenMarker = (id) => views.goTo({ kind: 'marker', id });
  panel.onUnderlayTool = (id, mode) => underlays.startUnderlayTool(id, mode);
  panel.onUnderlayProportions = (id) => void underlays.resetProportions(id);
  panel.angleWarn = () => uiSettings.angleWarn;
  panel.onErase = (ids) => eraseSelection(app, ids);
  const navigator = new Navigator({
    doc: () => store.doc,
    storey: () => ui.storey,
    activeView: () => ui.activeView,
    marker: () => ui.marker,
    worksheet: () => ui.worksheet,
    selected: () => new Set(selection.list()),
    traced: (id) => ui.underlays.some((u) => u.source === id),
    viewModified: (v) => views.viewModified(v),
    describeView: (v) => describeView(store.doc, v),
    treeItem: () => panel.treeItem?.id ?? null,
    treeItems: () => new Set(panel.treeItem ? [panel.treeItem.id, ...(panel.treeItem.also ?? [])] : []),
    layout: () => ui.layout,
  });
  // Det man sparar för något i trädet: en öppen vy läses in igen (0.8).
  panel.onTreeSaved = (item) => {
    if (item.kind === 'view' && ui.activeView === item.id) {
      const v = store.doc.views.find((x) => x.id === item.id);
      if (v) views.applyView(v);
    }
    hint('Sparat.');
    // Formuläret ritas om med det sparade, så att rubriken stämmer och Spara blir grå igen.
    panel.el.querySelector('.panel-body')!.innerHTML = '';
    panel.render();
    if (ui.navOpen) navigator.render();
  };
  panel.onTreeClosed = () => {
    if (ui.navOpen) navigator.render();
  };

  const styleDialog = new StyleDialog(
    store,
    async (style) => {
      if (import.meta.env.MODE === 'artifact') {
        hint('Förhandsvisningen kan inte spara filer. Det fungerar i versionen på webbhotellet.', 4000);
        return;
      }
      const r = await saveTextFile(JSON.stringify(style, null, 1), style.name, 'json', 'Stilbok');
      if (r !== 'cancelled') hint('Stilboken sparades.');
    },
    (msg) => hint(msg, 4000),
  );
  root.appendChild(styleDialog.el);
  // Tjocklekarna i listorna (0.10.39) är stilbokens.
  setWeightSource(() => generalOf(store.doc.graphics).weights);

  view.showGrid = uiSettings.grid;
  panel.quickFor = (type) => uiSettings.quick[type] ?? [];
  panel.onCopied = (ids, center) => {
    measureBox.showMove(ids, [0, 0], center);
    render.positionMeasureBox();
    hint('Kopian ligger ovanpå originalet. Dra den dit den ska, eller skriv avstånd och vinkel.', 4000);
  };
  const settingsDialog = new SettingsDialog(uiSettings, (s) => {
    Object.assign(uiSettings, s);
    panes.applyPaneWidths();
    view.zoomBy(1); // skriv om skärmskalan med den nya skärmstorleken
    view.showGrid = s.grid;
    if (!s.smartMenu) smartMenu.hide();
    modifyRail.render();
    commandLine?.refresh();
    toolOpts.renderToolOptions();
    render.renderAll();
    view.requestRender();
    pane3d.view3d?.refreshColors();
    panel.render();
  });
  root.appendChild(settingsDialog.el);

  // Modifiera (0.7) och smartmenyn (0.8.5): klick på det markerade.
  const modifyHost: ModifyHost = {
    ...host,
    startModify: (tool) => view.setTool(tool),
    // Ny vägg härifrån (0.8.4): väggverktyget med den klickade väggens typ,
    // höjd och liv, som börjar i änden. Verktygets egna val kommer tillbaka efteråt.
    startWallFrom: (ctx) => tools.startWallFrom(ctx),
    stopWall: () => tools.endWallFrom(),
    startRampFrom: (ctx) => tools.startRampFrom(ctx),
    endModify: () => {
      if (ui.tool === 'select') view.setTool(tools.toolFor('select'));
      view.requestRender();
    },
  };
  const modifier = new Modifier(modifyHost);
  // Smartmenyn intill det markerade, på dator.
  const smartMenu = new SmartMenu(canvas, panel, modifier, () => selectionBox());
  repositionMenu = () => smartMenu.reposition();
  smartMenu.planShown = () => ui.mode !== '3d';
  const menuWanted = () => uiSettings.smartMenu && !isNarrow();
  // Ett verktyg från Modifiera-raden med det som markerats i projektträdet:
  // smartmenyn kommer fram, så att värdet och tipset syns.
  modifier.subscribe(() => {
    const c = modifier.ctx;
    if (c && modifier.busy && !modifier.drawingWall && !smartMenu.visible && menuWanted() && ui.tool === 'select') smartMenu.show(c.clientX, c.clientY);
  });
  /** Det markerade på skärmen; null när bara 3D visas eller det inte syns. */
  function selectionBox(): ScreenBox | null {
    const b = ui.mode === '3d' ? null : selectionBounds(render.plan, selection.list());
    return b ? screenBox(view, canvas, b) : null;
  }
  /** Det markerade som helhet; markerat med ett klick utgår valen från klicket. */
  const bodyContext = () => bodyContextAt(view, render.plan, store.doc.elements, selection.list(), press && !press.drag && ui.mode !== '3d' ? press : null);
  selection.subscribe(() => {
    modifier.setSelection(bodyContext());
    // En markerad automatisk taklutning blir ett eget objekt.
    if (selection.list().some((id) => id.startsWith('slope:'))) queueMicrotask(render.materializeSlopes);
  });
  let pointerAt: { x: number; y: number; t: string; sel: string } | null = null;
  /** Trycket som pågår, för var valen i smartmenyn utgår från (se bodyContext). */
  let press: { x: number; y: number; drag: boolean } | null = null;
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      pointerAt = { x: e.clientX, y: e.clientY, t: e.pointerType, sel: selection.list().join() };
      press = smartMenu.el.contains(e.target as Node) ? null : { x: e.clientX, y: e.clientY, drag: false };
    },
    { capture: true },
  );
  canvas.addEventListener(
    'pointerup',
    (e) => {
      const down = pointerAt;
      pointerAt = null;
      if (press) {
        press.drag = Math.hypot(e.clientX - press.x, e.clientY - press.y) >= 5;
        setTimeout(() => (press = null), 0);
      }
      if (!down || smartMenu.el.contains(e.target as Node)) return;
      const click = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5;
      if (e.pointerType !== 'mouse' || e.button !== 0 || !menuWanted() || ui.tool !== 'select' || underlays.busy()) return;
      // Efter att verktyget eller 3D-vyn hunnit ändra markeringen. Smartmenyn
      // kommer vid ett klick och när något markerats med en ruta, men inte
      // när det markerade dragits.
      setTimeout(() => {
        if (!click && selection.list().join() === down.sel) return;
        if (selection.size > 0 && !textEditor?.isOpen) smartMenu.show(e.clientX, e.clientY);
      }, 0);
    },
    { capture: true },
  );

  const feedbackDialog = new FeedbackDialog(brand.name, brand.feedbackFallback ?? '');
  root.appendChild(feedbackDialog.el);
  const about = installAboutDialog(root, brand);

  // Tillfälliga mått när en vägg är markerad.
  const tempDims = new TempDims(canvas, store);
  tempDims.requestRender = () => view.requestRender();
  tempDims.onReleased = (n) => hint(releasedHint(n), 4000);
  view.setHighlighter(
    (cam) =>
      renderHighlight(cam, store.doc, render.plan.pickables, new Set(selection.list()), ui.tool === 'select' ? tools.selectTool.hoverId : null, !ui.marker && !ui.worksheet && !ui.layout) +
      tempDims.render(cam, selection.list(), render.viewStates(), ui.tool === 'select' && ui.mode !== '3d' && !ui.marker && !ui.worksheet && !ui.layout && !modifier.running) +
      render.skewMarks(cam),
  );

  store.subscribe((_doc, ev) => {
    render.renderAll();
    if (ev.cause === 'undo' && ev.transaction) hint(`Ångrade: ${ev.transaction.label}`);
    if (ev.cause === 'redo' && ev.transaction) hint(`Gjorde om: ${ev.transaction.label}`);
    if (ev.cause === 'load') {
      ui.activeView = null;
      ui.marker = null;
      ui.worksheet = null;
      ui.layout = null;
      ui.underlays = [];
      ui.category = null;
      ui.viewType = null;
      ui.scale = 100;
      views.viewHistory.splice(0, views.viewHistory.length, { kind: 'storey', id: ui.storey });
      selection.clear();
      view.zoomToFit();
      views.renderViewButton();
    }
  });

  selection.subscribe(() => {
    // Underlagen i projektträdet visar vilket som är markerat.
    if (ui.navOpen && navigator.tab === 'underlag') navigator.render();
    const t = measureBox.open ? selection.list() : [];
    if (measureBox.open && t.length !== 1) measureBox.close();
    // Markeras något i ritningen visas dess egenskaper i stället för det valda i trädet.
    if (selection.size && panel.treeItem) {
      panel.treeItem = null;
      if (ui.navOpen) navigator.render();
    }
    panel.showTab('selection');
    if (selection.size === 0) smartMenu.hide();
    else smartMenu.refresh(true);
    // På mobilen kommer bladet upp nedfällt när något markeras, så att planen
    // syns och man kan fortsätta markera. Det försvinner när inget är markerat.
    if (isNarrow()) {
      if (selection.size > 0 && !ui.panelOpen) panes.setPanel(true, 'peek');
      else if (selection.size === 0 && ui.panelOpen && panel.currentTab === 'selection') panes.setPanel(false, 'peek');
    }
    view.requestRender();
    pane3d.view3d?.setSelection(selection.list());
  });

  // ---------- Appens delar (src/ui/app/) ----------
  // Varje del får appen som ett objekt där varje fält läses när det används,
  // så att den alltid ser det som gäller just nu. Se src/ui/app/context.ts.
  const ctxMenu = new ContextMenu();
  let commandLine: CommandLine | undefined;
  const app: AppContext = lazyContext<AppContext>({
    root: () => root,
    $: () => $,
    out: () => out,
    appEl: () => appEl,
    menu: () => menu,
    toolOptions: () => toolOptions,
    pane2d: () => pane2d,
    pane3d: () => pane3dEl,
    store: () => store,
    selection: () => selection,
    ui: () => ui,
    uiSettings: () => uiSettings,
    view: () => view,
    plan: () => render.plan,
    section: () => render.section,
    view3d: () => pane3d.view3d,
    host: () => host,
    selectTool: () => tools.selectTool,
    wallTool: () => tools.wallTool,
    doorTool: () => tools.doorTool,
    windowTool: () => tools.windowTool,
    roomTool: () => tools.roomTool,
    dimensionTool: () => tools.dimensionTool,
    textTool: () => tools.textTool,
    labelTool: () => tools.labelTool,
    draw2dTool: () => tools.draw2dTool,
    measureTool: () => tools.measureTool,
    roofTool: () => tools.roofTool,
    slabTool: () => tools.slabTool,
    groundTool: () => tools.groundTool,
    stairTool: () => tools.stairTool,
    sectionTool: () => tools.sectionTool,
    elevationTool: () => tools.elevationTool,
    aligning: () => tools.aligning,
    zoomingBox: () => tools.zoomingBox,
    panel: () => panel,
    smartMenu: () => smartMenu,
    modifier: () => modifier,
    navigator: () => navigator,
    measureBox: () => measureBox,
    newProjectDialog: () => files.newProjectDialog,
    settingsDialog: () => settingsDialog,
    styleDialog: () => styleDialog,
    ctxMenu: () => ctxMenu,
    hint: () => hint,
    place: () => render,
    renderAll: () => render.renderAll,
    viewStates: () => render.viewStates,
    setTool: () => tools.setTool,
    setMode: () => pane3d.setMode,
    toolFor: () => tools.toolFor,
    update3d: () => pane3d.update3d,
    setPanel: () => panes.setPanel,
    setNav: () => panes.setNav,
    togglePanel: () => panes.togglePanel,
    toggleNav: () => panes.toggleNav,
    toggleGrid: () => actions.toggleGrid,
    syncStatus: () => actions.syncStatus,
    closeMenu: () => actions.closeMenu,
    closeShowMenu: () => showMenu.closeShowMenu,
    cancelCommand: () => tools.cancelCommand,
    endAlign: () => tools.endAlign,
    startZoomBox: () => tools.startZoomBox,
    endZoomBox: () => tools.endZoomBox,
    previousZoom: () => tools.previousZoom,
    zoomToSelection: () => render.zoomToSelection,
    positionMeasureBox: () => render.positionMeasureBox,
    roofOverHouse: () => tools.roofOverHouse,
    slabFromWalls: () => tools.slabFromWalls,
    screenMm: () => screenMm,
    saveNow: () => files.saveNow,
    openFile: () => files.openFile,
    applyView: () => views.applyView,
    currentViewDef: () => views.currentViewDef,
    viewModified: () => views.viewModified,
    goTo: () => views.goTo,
    openHistoryMenu: () => views.openHistoryMenu,
    openMarkerMenu: () => views.openMarkerMenu,
    openViewMenu: () => views.openViewMenu,
    copySelection: () => clipboard.copySelection,
    chooseUnderlayFiles: () => underlays.chooseFiles,
    startUnderlayTool: () => underlays.startUnderlayTool,
    openUnderlayMenu: () => underlays.openUnderlayMenu,
    showUnderlay: () => underlays.showUnderlay,
    pasteFromMenu: () => clipboard.pasteFromMenu,
    sheets: () => sheets,
    toolOpts: () => toolOpts,
    underlays: () => underlays,
    filterSelect: () => filterSelect,
    storeys: () => storeys,
    site: () => site,
    segmentPoints: () => segmentPoints,
    views: () => views,
    wand: () => wand,
    commandLine: () => commandLine,
  });
  const segmentPoints = installSegmentPoints(app);
  const render = installRender(app, { chips, compareToggle, compareLabel, computing });
  const wand = installWand(app);
  const tools = installTools(app, host);
  const panes = installPanes(app);
  const pane3d = installPane3d(app);
  const textEdit = installTextEdit(app, textEditor!);
  const files = installFiles(app, brand, { saved, autosaveBlocked });
  const toolOpts = installToolOptions(app);
  const modifyRail = installModifyRail(app);
  const views = installViews(app);
  const showMenu = installShowMenu(app);
  const menus = installMenus(app);
  commandLine = installCommandLine(app, modifyRail.press);
  installKeyboard(app, modifyRail.press);
  const clipboard = installClipboard(app);
  const underlays = installUnderlays(app);
  const filterSelect = installFilterSelect(app);
  const storeys = installStoreys(app);
  const site = installSite(app);
  installTreeDrag(app);
  const sheets = installSheets(app);
  const plot = installPlot(app, underlays.exportImage);
  const actions = installActions(app, { brand, feedbackDialog, about, files, menus, panes, plot, sheets, showMenu, views });

  // För felsökning i webbläsarens konsol.
  (window as unknown as { bacchus: unknown }).bacchus = { store, view, selection, ui, modifier, smartMenu, setTool: tools.setTool, wand, goTo: views.goTo, setMode: pane3d.setMode, site, get sheets() { return sheets; }, filterSelect, sections: render.sectionQueue, get plot() { return plot; }, get plan() { return render.plan; }, get view3d() { return pane3d.view3d; } };

  appEl.dataset.mode = ui.mode;
  appEl.dataset.sheet = ui.sheet;
  panes.applyPaneClasses();
  window.addEventListener('resize', () => panes.applyPaneClasses());
  render.renderAll();
  tools.setTool('select');
  view.zoomToFit();
  if (migrated) hint('Projektet har uppdaterats till den nya versionen. Exemplet finns under Börja om med exemplet.', 5000);

  function hint(text: string, ms = 2400): void {
    hintEl.textContent = text;
    hintEl.hidden = false;
    hintEl.classList.remove('fading');
    clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => {
      hintEl.classList.add('fading');
      hintTimer = window.setTimeout(() => (hintEl.hidden = true), 250);
    }, ms);
  }
}
