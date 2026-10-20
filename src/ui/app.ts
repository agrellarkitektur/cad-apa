import type { Brand } from '../brand';
import { addElements } from '../core/commands';
import { resolveParams } from '../elements/registry';
import { modelViewId, type Id, type ProjectDoc, type ViewDef } from '../core/model';
import { PRESETS, type StyleSheet } from '../core/graphics';
import { existingState } from '../core/states';
import { DocStore } from '../core/store';
import type { WallParams } from '../elements/wall';
import { buildPlan, type PlanResult } from '../repr/plan';
import type { SectionResult } from '../repr/section';
import { createSectionQueue, spawnSectionWorker } from './app/sectionQueue';
import { markerName, modelBounds } from '../elements/markers';
import { AlignTool, MarkerTool, RoofTool } from './tools/markerTools';
import { MeasureTool, ZoomBoxTool } from './tools/measureTool';
import { skewText, skewWarnings } from '../elements/angleCheck';
import { modifyContextAt, ModifyPalette, type ModifyHost } from './modify';
import type { Vec2 } from '../repr/primitives';
import { sampleProject } from '../sample/sampleProject';
import { parse } from '../storage/format';
import { keepUnreadable, loadLocal, mayOverwrite, recordFormatVersion } from '../storage/localStore';
import { FORMAT_VERSION } from '../core/model';
import { saveTextFile } from '../storage/projectFile';
import { ContextMenu } from './contextMenu';
import { releasedHint } from './tools/selectTool';
import { minorStepFor } from '../view2d/grid';
import { PlanView, type ViewTool } from '../view2d/planView';
import { renderHighlight } from './highlight';
import { icons } from './icons';
import { escapeHtml } from './labels';
import { MeasureBox } from './measureBox';
import { FeedbackDialog } from './feedbackDialog';
import { PropertiesPanel } from './propertiesPanel';
import { Selection } from './selection';
import { isNarrow } from './sheet';
import { PetPalette } from './petPalette';
import { SettingsDialog } from './settingsDialog';
import { StyleDialog } from './styleDialog';
import { TempDims } from './tempDims';
import { Navigator } from './navigator';
import { applyUiColors, loadUiSettings, mmPerCssPx } from './uiSettings';
import { InlineTextEditor } from './textEditor';
import { Camera } from '../view2d/camera';
import { createThemeSwitcher, currentTheme, onThemeChange } from './theme';
import type { ToolHost } from './tools/host';
import { SelectTool } from './tools/selectTool';
import { DimensionTool, TextTool } from './tools/annotationTools';
import { Draw2DTool } from './tools/draw2dTool';
import { OpeningTool } from './tools/openingTool';
import { RoomTool } from './tools/roomTool';
import { WallTool } from './tools/wallTool';
import { lazyContext, type AppContext } from './app/context';
import { installActions } from './app/actions';
import { installClipboard } from './app/clipboard';
import { installFiles } from './app/files';
import { defaultState, defaultWallType, describeView, firstDefinition, formatScale, nf } from './app/helpers';
import { installKeyboard } from './app/keyboard';
import { installMenus } from './app/menus';
import { installPane3d } from './app/pane3d';
import { installPanes } from './app/panes';
import { createUiState, GROUP_LABEL, PLAN_TOOLS, shellMarkup, SPACE_TOOLS, TOOLS, type ToolId } from './app/shell';
import { installShowMenu } from './app/showMenu';
import { snapSegments } from './app/snapping';
import { installTextEdit } from './app/textEdit';
import { installToolOptions } from './app/toolOptions';
import { installViews } from './app/views';
import { installUnderlays } from './app/underlays';
import { installSheets } from './app/sheets';
import { installPlot } from './app/plot';

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

  // ---------- Verktygsraden ----------
  const toolsEl = $<HTMLElement>('.tools');
  let lastGroup = '';
  for (const t of TOOLS) {
    if (t.group !== lastGroup) {
      const label = document.createElement('div');
      label.className = 'tool-group-label';
      label.textContent = GROUP_LABEL[t.group];
      toolsEl.appendChild(label);
      lastGroup = t.group;
    }
    const b = document.createElement('button');
    b.className = 'tool';
    b.dataset.tool = t.id;
    b.innerHTML = `${icons[t.icon]}<span>${t.label}</span>`;
    b.title = t.comesIn ? `${t.label} – kommer i ${t.comesIn}` : `${t.label}${t.key ? ` (${t.key})` : ''}`;
    if (t.comesIn) {
      b.setAttribute('aria-disabled', 'true');
      b.addEventListener('click', () => hint(`${t.label} kommer i ${t.comesIn}, med smartobjekten.`));
    } else {
      b.addEventListener('click', () => setTool(t.id as ToolId));
    }
    toolsEl.appendChild(b);
  }

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

  const view = new PlanView(pane2d, {
    onCursor: (p: Vec2 | null) => {
      out('x').textContent = p ? nf.format(p[0]) : '—';
      out('y').textContent = p ? nf.format(p[1]) : '—';
    },
    onViewChange: (cam: Camera) => {
      if (ui.mode !== '3d') measureBox.update((p) => cam.toScreen(p));
      out('scale').textContent = `${uiSettings.screenInches ? '' : '≈ '}1:${formatScale(cam.screenScaleDenominator(screenMm()))}`;
      textEditor?.position(cam);
      const step = minorStepFor(cam.scale);
      out('grid').textContent = step >= 1000 ? `${nf.format(step / 1000)} m` : `${nf.format(step)} mm`;
    },
  });

  let plan: PlanResult = { prims: [], pickables: [] };
  /** Den öppna fasaden eller sektionen, senast den räknades. */
  let lastSection: SectionResult | null = null;
  const sectionQueue = createSectionQueue(() => renderAll(), { spawn: typeof Worker === 'undefined' ? undefined : spawnSectionWorker });

  /**
   * En automatisk taklutning som markeras blir ett eget objekt (0.8), så att
   * den går att flytta och ge en egen stil.
   */
  function materializeSlopes(): void {
    const ids = selection.list().filter((id) => id.startsWith('slope:'));
    if (!ids.length || !ui.marker || !lastSection) return;
    const marker = store.doc.elements[ui.marker];
    if (!marker) return;
    const made = addElements(
      store,
      ids
        .filter((id) => lastSection!.slopes[id])
        .map((id) => ({ type: 'RoofSlope', storey: marker.storey, space: marker.id, states: [], tags: [], params: { ...lastSection!.slopes[id] }, props: {} })),
      ui.state,
      'Taklutningen blir ett eget objekt',
    );
    selection.set([...selection.list().filter((id) => !id.startsWith('slope:')), ...made.map((e) => e.id)]);
  }

  // Text som redigeras direkt i ritningen (dubbelklick).
  textEditor = new InlineTextEditor(pane2d);

  // ---------- Vyn som visas ----------

  /** Stilmallen för vyn: en förinställd mall med projektets texter, eller projektets egen. */
  // Samma förinställda stilmall ger samma objekt, så att planens cache träffar (0.8.3).
  const presetStyles = new Map<string, { labels: StyleSheet['labels']; sheet: StyleSheet }>();
  function styleFor(name: string | null): StyleSheet {
    const g = store.doc.graphics;
    const preset = name ? PRESETS.find((p) => p.name === name) : undefined;
    if (!preset) return g;
    const hit = presetStyles.get(preset.name);
    if (hit && hit.labels === g.labels) return hit.sheet;
    const sheet = { ...preset, labels: g.labels };
    presetStyles.set(preset.name, { labels: g.labels, sheet });
    return sheet;
  }

  function viewStatesOf(v: ViewDef) {
    const ex = existingState(store.doc);
    return {
      state: v.state,
      compareTo: v.compare && ex && ex.id !== v.state ? ex.id : undefined,
      detail: v.detail,
      hide: v.hide,
      hideDemolished: v.hideDemolished,
      autoDims: uiSettings.autoDims,
      viewId: v.id,
      viewTags: v.tags ?? [],
      scale: v.scale ?? 100,
    };
  }

  function viewStates() {
    const doc = store.doc;
    const ex = existingState(doc);
    const compareTo = ui.compare && ex && ex.id !== ui.state ? ex.id : undefined;
    // Vilken vy det är, för 2D-element med Visas i (0.8).
    const v = ui.activeView ? doc.views.find((x) => x.id === ui.activeView) : undefined;
    const viewId = v ? v.id : modelViewId(ui.marker ?? ui.worksheet ?? ui.storey);
    return {
      state: ui.state,
      compareTo,
      detail: ui.detail,
      hide: ui.hide,
      hideDemolished: ui.hideDemolished,
      autoDims: uiSettings.autoDims,
      viewId,
      viewTags: v?.tags ?? [],
      showHidden: ui.showHidden,
      scale: ui.scale,
    };
  }

  // ---------- Verktyg ----------
  const host: ToolHost = {
    store,
    selection,
    view,
    plan: () => plan,
    readOnly: () => !!ui.marker || !!ui.layout,
    canEdit: (id) => !!ui.marker && (store.doc.elements[id]?.space === ui.marker || id.startsWith('slope:')),
    space: () => ui.marker ?? ui.worksheet ?? undefined,
    activeState: () => ui.state,
    storey: () => ui.storey,
    hint,
    wallEndMoved: (wallId, end, original, companions) => {
      measureBox.showWallEnd(wallId, end, original, companions);
      positionMeasureBox();
    },
    elementsMoved: (ids, applied, anchor) => {
      measureBox.showMove(ids, applied, anchor);
      positionMeasureBox();
    },
    editText: (id, at) => textEdit.editTextAt(id, at),
    modify: (p, hitId) => {
      if (ui.tool !== 'select') return false;
      // I fasader och sektioner bara för det som är ritat där (0.8 del 2).
      if (ui.marker && !selection.list().every((id) => host.canEdit?.(id))) return false;
      const r = view.svg.getBoundingClientRect();
      const ctx = modifyContextAt(host, p, r.left + p.screen[0], r.top + p.screen[1], hitId);
      if (!ctx) return false;
      palette.hide();
      modifyPalette.show(ctx);
      return true;
    },
    // I fasader, sektioner och på arbetsblad snäpper man mot linjerna i ritningen.
    snapSegments: () => snapSegments(app),
  };

  const selectTool = new SelectTool(host);
  const wallTool = new WallTool(host, { definition: defaultWallType(store.doc), face: 'center', height: 2700 });
  wallTool.onChange = () => toolOpts.renderToolOptions();
  const panTool: ViewTool = { cursor: 'grab', down: () => 'pan', tap: (p) => selectTool.tap(p) };
  const doorTool = new OpeningTool(host, 'Door', { definition: firstDefinition(store.doc, 'Door') });
  const windowTool = new OpeningTool(host, 'Window', { definition: firstDefinition(store.doc, 'Window') });
  const roomTool = new RoomTool(host);
  const dimensionTool = new DimensionTool(host);
  dimensionTool.onChange = () => toolOpts.renderToolOptions();
  const textTool = new TextTool(host);
  const draw2dTool = new Draw2DTool(host);
  draw2dTool.onChange = () => toolOpts.renderToolOptions();
  const measureTool = new MeasureTool(host);
  // Zooma till område: ett tillfälligt verktyg, sedan tillbaka.
  const zoomBoxTool = new ZoomBoxTool(host);
  let zoomingBox = false;
  const endZoomBox = (): void => {
    zoomingBox = false;
    view.setTool(tools[ui.tool]);
    view.requestRender();
  };
  zoomBoxTool.onDone = endZoomBox;
  function startZoomBox(): void {
    if (ui.mode === '3d') return;
    zoomingBox = true;
    view.setTool(zoomBoxTool);
    hint('Dra upp en ruta att zooma till, eller klicka för att zooma in. Shift+Z: förra zoomen.', 3500);
  }
  function previousZoom(): void {
    if (!view.previousZoom()) hint('Ingen tidigare zoom.');
  }
  measureTool.onChange = () => {
    toolOpts.updateMeasureOptions();
    view.requestRender();
  };
  const roofTool = new RoofTool(host);
  const sectionTool = new MarkerTool(host, 'Section');
  const elevationTool = new MarkerTool(host, 'Elevation');
  const created = (id: Id) => {
    setTool('select');
    selection.set([id]);
    const el = store.doc.elements[id];
    if (el && (el.type === 'Section' || el.type === 'Elevation')) {
      hint(`${markerName(store.doc, el)} finns nu i projektträdet under Modell. Dubbelklicka på linjen för att öppna den.`, 5000);
    }
  };
  roofTool.onCreated = created;
  sectionTool.onCreated = created;
  elevationTool.onCreated = created;
  roofTool.onChange = () => toolOpts.renderToolOptions();
  sectionTool.onChange = () => toolOpts.renderToolOptions();
  elevationTool.onChange = () => toolOpts.renderToolOptions();
  const tools: Record<ToolId, ViewTool> = {
    select: selectTool,
    wall: wallTool,
    pan: panTool,
    door: doorTool,
    window: windowTool,
    room: roomTool,
    dimension: dimensionTool,
    text: textTool,
    draw2d: draw2dTool,
    roof: roofTool,
    section: sectionTool,
    elevation: elevationTool,
    measure: measureTool,
  };

  function setTool(id: ToolId): void {
    measureBox.close();
    // Ritverktygen ritar i planen: från en fasad eller sektion går man tillbaka dit.
    // Mått, text och 2D ritas i fasaden eller sektionen (0.8).
    if (PLAN_TOOLS.includes(id) && !SPACE_TOOLS.includes(id) && (ui.marker || ui.worksheet)) views.goTo({ kind: 'storey', id: ui.storey });
    // På ett ritningsblad går bara att markera och panorera. Text, mått och 2D
    // stannar på bladet med ett tips (0.8.2); övriga ritverktyg går till planen.
    if (ui.layout && SPACE_TOOLS.includes(id)) {
      hint('Text, mått och linjer direkt på ett blad kommer efter pilotprojektet. Rita dem i vyn, så syns de på bladet.', 4500);
      return;
    }
    if (ui.layout && id !== 'select' && id !== 'pan') views.goTo({ kind: 'storey', id: ui.storey });
    if (PLAN_TOOLS.includes(id) && ui.mode === '3d') void pane3d.setMode('2d');
    if (ui.tool === 'wall' && id !== 'wall') wallTool.finish();
    if (ui.tool === 'dimension' && id !== 'dimension') dimensionTool.reset();
    if (ui.tool === 'draw2d' && id !== 'draw2d') draw2dTool.finish(false);
    if (ui.tool === 'roof' && id !== 'roof') roofTool.reset();
    if (ui.tool === 'section' && id !== 'section') sectionTool.reset();
    if (ui.tool === 'elevation' && id !== 'elevation') elevationTool.reset();
    palette.hide();
    modifyPalette.close();
    ui.tool = id;
    view.setTool(ui.layout ? sheets.tool : tools[id]);
    toolsEl.querySelectorAll<HTMLElement>('[data-tool]').forEach((b) => {
      if (!b.hasAttribute('aria-disabled')) b.setAttribute('aria-pressed', String(b.dataset.tool === id));
    });
    if (PLAN_TOOLS.includes(id) && id !== 'room' && id !== 'text') {
      selection.clear();
      if (window.innerWidth <= 960) panes.setPanel(false);
    }
    toolOpts.renderToolOptions();
  }

  /**
   * Ett tak över alla väggar på våningen, med 500 mm utsprång och takfoten
   * så att undersidan möter de högsta väggarnas överkant vid ytterlivet.
   */
  function roofOverHouse(): void {
    const b = modelBounds(store.doc, ui.storey);
    if (!b) {
      hint('Rita väggar först, så läggs taket över dem.');
      return;
    }
    const over = 500;
    const walls = Object.values(store.doc.elements).filter((e) => e.type === 'Wall' && e.storey === ui.storey);
    const top = Math.max(...walls.map((w) => resolveParams<WallParams>(store.doc, w).height));
    const k = Math.tan((roofTool.options.slope * Math.PI) / 180);
    roofTool.options.eave = Math.round(top - k * over);
    roofTool.create([
      [Math.round(b.minX - over), Math.round(b.minY - over)],
      [Math.round(b.maxX + over), Math.round(b.minY - over)],
      [Math.round(b.maxX + over), Math.round(b.maxY + over)],
      [Math.round(b.minX - over), Math.round(b.maxY + over)],
    ]);
  }

  /** Avbryt: först det pågående kommandot, sedan verktyget. */
  function cancelCommand(): void {
    if (underlays.busy()) {
      underlays.cancel();
      setTool('select');
    } else if (modifyPalette.open) modifyPalette.close();
    else if (ui.tool === 'wall' && wallTool.drawing) wallTool.finish();
    else if (ui.tool === 'dimension' && dimensionTool.count > 0) dimensionTool.reset();
    else if (ui.tool === 'draw2d' && draw2dTool.count > 0) draw2dTool.reset();
    else if (ui.tool === 'roof' && roofTool.started) roofTool.reset();
    else if (ui.tool === 'section' && sectionTool.step > 0) sectionTool.reset();
    else if (ui.tool === 'elevation' && elevationTool.step > 0) elevationTool.reset();
    else if (ui.tool === 'measure' && measureTool.measurement().points > 0) measureTool.reset();
    else setTool('select');
    view.requestRender();
  }

  // ---------- Panel och dialog ----------
  const panel = new PropertiesPanel(store, selection, viewStates);
  panel.onOpenMarker = (id) => views.goTo({ kind: 'marker', id });
  panel.onUnderlayTool = (id, mode) => underlays.startUnderlayTool(id, mode);
  panel.angleWarn = () => uiSettings.angleWarn;
  // Rikta efter objekt: ett klick i planen, sedan tillbaka till verktyget.
  const alignTool = new AlignTool(host);
  let aligning = false;
  const endAlign = (): void => {
    aligning = false;
    alignTool.target = null;
    view.setTool(tools[ui.tool]);
    view.requestRender();
  };
  alignTool.onDone = (ok) => {
    endAlign();
    if (!ok) hint('Ingen vägg eller linje där. Tryck på Rikta efter objekt och försök igen.');
  };
  panel.onAlignMarker = (id) => {
    if (ui.marker) views.goTo({ kind: 'storey', id: ui.storey });
    if (ui.tool !== 'select') setTool('select');
    alignTool.target = id;
    aligning = true;
    view.setTool(alignTool);
    hint(`Klicka på en vägg eller linje. ${store.doc.elements[id]?.type === 'Section' ? 'Sektionen' : 'Fasaden'} blir parallell med den; håll Shift för vinkelrät.`, 5000);
  };

  const navigator = new Navigator({
    doc: () => store.doc,
    storey: () => ui.storey,
    activeView: () => ui.activeView,
    marker: () => ui.marker,
    worksheet: () => ui.worksheet,
    selected: () => new Set(selection.list()),
    trace: () => ui.trace,
    viewModified: (v) => views.viewModified(v),
    describeView,
    treeItem: () => panel.treeItem?.id ?? null,
    layout: () => ui.layout,
  });
  // Det man sparar för något i trädet: en öppen vy läses in igen (0.8).
  panel.onTreeSaved = (item) => {
    if (item.kind === 'view' && ui.activeView === item.id) {
      const v = store.doc.views.find((x) => x.id === item.id);
      if (v) views.applyView(v);
    }
    hint('Sparat.');
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
      const r = await saveTextFile(JSON.stringify(style, null, 1), style.name, 'json', 'Stilmall');
      if (r !== 'cancelled') hint('Stilmallen sparades.');
    },
    (msg) => hint(msg, 4000),
  );
  root.appendChild(styleDialog.el);

  view.showGrid = uiSettings.grid;
  panel.quickFor = (type) => uiSettings.quick[type] ?? [];
  panel.onCopied = (ids, center) => {
    measureBox.showMove(ids, [0, 0], center);
    positionMeasureBox();
    hint('Kopian ligger ovanpå originalet. Dra den dit den ska, eller skriv avstånd och vinkel.', 4000);
  };
  const settingsDialog = new SettingsDialog(uiSettings, (s) => {
    Object.assign(uiSettings, s);
    panes.applyPaneWidths();
    view.zoomBy(1); // skriv om skärmskalan med den nya skärmstorleken
    view.showGrid = s.grid;
    renderAll();
    view.requestRender();
    pane3d.view3d?.refreshColors();
    panel.render();
  });
  root.appendChild(settingsDialog.el);

  // Snabbmenyn vid markören, på dator.
  const palette = new PetPalette(canvas, panel);
  // Modifiera: klick på det markerade (0.7).
  const modifyHost: ModifyHost = {
    ...host,
    startModify: (tool) => view.setTool(tool),
    endModify: () => {
      if (ui.tool === 'select') view.setTool(selectTool);
      view.requestRender();
    },
  };
  const modifyPalette = new ModifyPalette(canvas, modifyHost);
  selection.subscribe(() => {
    if (modifyPalette.open) modifyPalette.close();
    // En markerad automatisk taklutning blir ett eget objekt.
    if (selection.list().some((id) => id.startsWith('slope:'))) queueMicrotask(materializeSlopes);
  });
  let pointerAt: { x: number; y: number; t: string } | null = null;
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      pointerAt = { x: e.clientX, y: e.clientY, t: e.pointerType };
      if (!palette.el.contains(e.target as Node)) palette.hide();
    },
    { capture: true },
  );
  canvas.addEventListener(
    'pointerup',
    (e) => {
      const down = pointerAt;
      pointerAt = null;
      if (!down || palette.el.contains(e.target as Node) || modifyPalette.el.contains(e.target as Node)) return;
      const click = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5;
      if (!click || e.pointerType !== 'mouse' || e.button !== 0 || !uiSettings.petPalette || isNarrow() || ui.tool !== 'select' || underlays.busy()) return;
      // Efter att verktyget eller 3D-vyn hunnit ändra markeringen.
      setTimeout(() => {
        if (selection.size > 0 && !textEditor?.isOpen && !modifyPalette.open) palette.show(e.clientX, e.clientY);
      }, 0);
    },
    { capture: true },
  );

  const feedbackDialog = new FeedbackDialog(brand.name, brand.feedbackFallback ?? '');
  root.appendChild(feedbackDialog.el);

  // Tillfälliga mått när en vägg är markerad.
  const tempDims = new TempDims(canvas, store);
  tempDims.requestRender = () => view.requestRender();
  tempDims.onReleased = (n) => hint(releasedHint(n), 4000);
  view.setHighlighter(
    (cam) =>
      renderHighlight(cam, store.doc, plan.pickables, new Set(selection.list()), ui.tool === 'select' ? selectTool.hoverId : null, !ui.marker && !ui.worksheet) +
      tempDims.render(cam, selection.list(), viewStates(), ui.tool === 'select' && ui.mode !== '3d' && !ui.marker && !ui.worksheet && !ui.layout && !modifyPalette.running) +
      skewMarks(cam),
  );

  /** Utropstecken vid det som ligger nästan men inte exakt rakt (bara i planen, inte på papper). */
  function skewMarks(cam: Camera): string {
    if (ui.marker || ui.worksheet || ui.layout) return '';
    return skewWarnings(store.doc, ui.storey, ui.state, uiSettings.angleWarn)
      .map((w) => {
        const [x, y] = cam.toScreen(w.at);
        return `<g class="skew-mark" transform="translate(${x.toFixed(1)} ${(y - 14).toFixed(1)})"><title>${escapeHtml(skewText(w))}</title><path d="M0 -8L8 6H-8Z"/><text y="4.5" text-anchor="middle">!</text></g>`;
      })
      .join('');
  }

  // ---------- Rendering ----------
  function renderAll(): void {
    const doc = store.doc;
    if (!doc.states.some((s) => s.id === ui.state)) ui.state = defaultState(doc);
    if (!doc.storeys.some((s) => s.id === ui.storey)) ui.storey = doc.storeys[0].id;
    const vs = viewStates();

    out('project').textContent = doc.project.name;
    if (ui.marker && !doc.elements[ui.marker]) ui.marker = null;
    if (ui.worksheet && !doc.worksheets.some((w) => w.id === ui.worksheet)) ui.worksheet = null;
    if (ui.layout && !doc.sheets.some((s) => s.id === ui.layout)) ui.layout = null;
    const markerEl = ui.marker ? doc.elements[ui.marker] : undefined;
    const sheet = ui.worksheet ? doc.worksheets.find((w) => w.id === ui.worksheet) : undefined;
    const layout = ui.layout ? doc.sheets.find((s) => s.id === ui.layout) : undefined;
    out('storey').textContent = markerEl ? markerName(doc, markerEl) : sheet ? sheet.name : layout ? `${layout.number} ${layout.name}` : (doc.storeys.find((s) => s.id === ui.storey)?.name ?? '');
    appEl.dataset.place = markerEl ? 'section' : sheet ? 'worksheet' : layout ? 'sheet' : 'plan';
    // Ett ritningsblad ritas i mm på papperet, 1:1; annars i vyns annoteringsskala (0.8 del 3).
    view.drawingScale = layout ? 1 : ui.scale;
    view.showGrid = layout ? false : uiSettings.grid;
    view.showScaleBar = !layout;
    if (layout && !zoomingBox && !aligning && view.currentTool !== sheets.tool) view.setTool(sheets.tool);
    else if (!layout && view.currentTool === sheets.tool) view.setTool(tools[ui.tool]);

    chips.innerHTML =
      doc.states
        .map((s) => `<button role="tab" class="chip" data-state="${s.id}" aria-selected="${s.id === ui.state}">${escapeHtml(s.name)}</button>`)
        .join('') + `<button class="chip chip-add" data-action="new-proposal" aria-label="Nytt förslag" title="Nytt förslag">${icons.plus}</button>`;

    const ex = existingState(doc);
    compareLabel.hidden = !ex || ex.id === ui.state;
    if (ex) out('compare-label').textContent = `Jämför med ${ex.name}`;
    compareToggle.checked = ui.compare;

    // Fasad eller sektion: räknas fram ur modellen i stället för planen. Det
    // som är ritat i den (mått, text, 2D, taklutningar) läggs ovanpå (0.8).
    // Stora fasader och sektioner räknas i en bakgrundstråd (0.8.2): medan
    // den räknar visas den förra versionen, och renderAll körs igen när den är klar.
    const section = markerEl ? sectionQueue.get(doc, markerEl.id, vs, styleFor(ui.styleName), ui.styleName ?? '') : null;
    lastSection = section;
    computing.hidden = !(markerEl && sectionQueue.pending);
    const paper = layout ? sheets.drawing() : null;
    if (paper) {
      plan = { prims: paper.prims, pickables: [] };
    } else if (markerEl) {
      const drawn = buildPlan(doc, markerEl.storey, { ...vs, place: markerEl.id }, styleFor(ui.styleName));
      // Underlagen ligger under fasaden eller sektionen; det andra som ritats i den ovanpå.
      // Första gången en stor vy räknas finns ingen fasad än, bara det ritade.
      const under = drawn.prims.filter((q) => q.origin?.objectType === 'Underlay');
      const over = drawn.prims.filter((q) => q.origin?.objectType !== 'Underlay');
      plan = { prims: [...under, ...(section?.prims ?? []), ...over], pickables: [...(section?.pickables ?? []), ...drawn.pickables] };
    } else if (sheet) {
      // Ett arbetsblad (0.8 del 2): bara det som är ritat på det.
      plan = buildPlan(doc, ui.storey, { ...vs, place: sheet.id }, styleFor(ui.styleName));
    } else plan = buildPlan(doc, ui.storey, vs, styleFor(ui.styleName));
    // Kalkerad vy: en annan vy tonad under, t.ex. möbleringen under en undertaksplan.
    const traced = ui.trace && !section && !sheet && !layout ? doc.views.find((v) => v.id === ui.trace) : undefined;
    view.setUnderlay(traced ? buildPlan(doc, traced.storey, viewStatesOf(traced), styleFor(traced.style ?? null)).prims : []);
    views.renderViewButton();
    if (ui.navOpen) navigator.render();
    positionMeasureBox();
    selection.prune((id) => !!doc.elements[id]);
    view.setPrimitives(plan.prims);
    pane3d.update3d();
    panel.render();
    palette.refresh();
    if (ui.tool === 'wall') toolOpts.renderToolOptions();

    const undo = $<HTMLButtonElement>('[data-action="undo"]');
    const redo = $<HTMLButtonElement>('[data-action="redo"]');
    undo.disabled = !store.canUndo;
    redo.disabled = !store.canRedo;
    undo.title = store.undoLabel ? `Ångra: ${store.undoLabel} (Ctrl+Z)` : 'Ångra';
    redo.title = store.redoLabel ? `Gör om: ${store.redoLabel} (Ctrl+Shift+Z)` : 'Gör om';
  }

  /** Zooma planen till det markerade. */
  function zoomToSelection(): void {
    const ids = new Set(selection.list());
    const pts = plan.pickables.filter((p) => ids.has(p.id)).flatMap((p) => p.regions.flat(2) as Vec2[]);
    if (!pts.length) return;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    if (ui.mode === '3d') void pane3d.setMode('2d');
    view.zoomToBounds({ minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) });
  }

  /** Måttrutan sitter vid sin punkt i planen, eller i 3D när bara 3D visas. */
  function positionMeasureBox(): void {
    if (!measureBox.open) return;
    const v = pane3d.view3d;
    if (ui.mode === '3d' && v) measureBox.update((p) => v.project(p));
    else measureBox.update((p) => view.camera.toScreen(p));
  }

  store.subscribe((_doc, ev) => {
    renderAll();
    if (ev.cause === 'undo' && ev.transaction) hint(`Ångrade: ${ev.transaction.label}`);
    if (ev.cause === 'redo' && ev.transaction) hint(`Gjorde om: ${ev.transaction.label}`);
    if (ev.cause === 'load') {
      ui.activeView = null;
      ui.marker = null;
      ui.worksheet = null;
      ui.layout = null;
      ui.trace = null;
      ui.styleName = null;
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
    if (selection.size === 0) palette.hide();
    else palette.refresh();
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
    plan: () => plan,
    section: () => lastSection,
    view3d: () => pane3d.view3d,
    host: () => host,
    selectTool: () => selectTool,
    wallTool: () => wallTool,
    doorTool: () => doorTool,
    windowTool: () => windowTool,
    roomTool: () => roomTool,
    dimensionTool: () => dimensionTool,
    textTool: () => textTool,
    draw2dTool: () => draw2dTool,
    measureTool: () => measureTool,
    roofTool: () => roofTool,
    sectionTool: () => sectionTool,
    elevationTool: () => elevationTool,
    aligning: () => aligning,
    zoomingBox: () => zoomingBox,
    panel: () => panel,
    palette: () => palette,
    modifyPalette: () => modifyPalette,
    navigator: () => navigator,
    measureBox: () => measureBox,
    newProjectDialog: () => files.newProjectDialog,
    settingsDialog: () => settingsDialog,
    styleDialog: () => styleDialog,
    ctxMenu: () => ctxMenu,
    hint: () => hint,
    renderAll: () => renderAll,
    viewStates: () => viewStates,
    setTool: () => setTool,
    setMode: () => pane3d.setMode,
    setPanel: () => panes.setPanel,
    setNav: () => panes.setNav,
    togglePanel: () => panes.togglePanel,
    toggleNav: () => panes.toggleNav,
    toggleGrid: () => actions.toggleGrid,
    closeMenu: () => actions.closeMenu,
    closeShowMenu: () => showMenu.closeShowMenu,
    cancelCommand: () => cancelCommand,
    endAlign: () => endAlign,
    startZoomBox: () => startZoomBox,
    endZoomBox: () => endZoomBox,
    previousZoom: () => previousZoom,
    zoomToSelection: () => zoomToSelection,
    positionMeasureBox: () => positionMeasureBox,
    roofOverHouse: () => roofOverHouse,
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
  });
  const panes = installPanes(app);
  const pane3d = installPane3d(app);
  const textEdit = installTextEdit(app, textEditor!);
  const files = installFiles(app, brand, { saved, autosaveBlocked });
  const toolOpts = installToolOptions(app);
  const views = installViews(app);
  const showMenu = installShowMenu(app);
  const menus = installMenus(app);
  installKeyboard(app);
  const clipboard = installClipboard(app);
  const underlays = installUnderlays(app);
  const sheets = installSheets(app);
  const plot = installPlot(app, underlays.exportImage);
  const actions = installActions(app, { brand, feedbackDialog, files, menus, panes, plot, sheets, showMenu, views });

  // För felsökning i webbläsarens konsol.
  (window as unknown as { bacchus: unknown }).bacchus = { store, view, selection, ui, modifyPalette, setTool, goTo: views.goTo, setMode: pane3d.setMode, get sheets() { return sheets; }, sections: sectionQueue, get plot() { return plot; }, get plan() { return plan; }, get view3d() { return pane3d.view3d; } };

  appEl.dataset.mode = ui.mode;
  appEl.dataset.sheet = ui.sheet;
  panes.applyPaneClasses();
  showMenu.applyTraceLook();
  window.addEventListener('resize', () => panes.applyPaneClasses());
  renderAll();
  setTool('select');
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
