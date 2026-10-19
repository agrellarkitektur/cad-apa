import type { Brand } from '../brand';
import { createProposal, moveElements, moveWallEnd, renameElement, updateParams } from '../core/commands';
import { resolveParams } from '../elements/registry';
import { snap } from './tools/snap';
import { ENGINE } from '../core/engine';
import type { Id, ProjectDoc, ViewDef } from '../core/model';
import { PRESETS, type StyleSheet } from '../core/graphics';
import { actionOf, existingState } from '../core/states';
import { DocStore } from '../core/store';
import type { WallParams } from '../elements/wall';
import { buildModel3d } from '../repr/model3d';
import { buildPlan, type PlanResult } from '../repr/plan';
import { buildSection } from '../repr/section';
import { markerFrame, markerName, modelBounds } from '../elements/markers';
import { AlignTool, MarkerTool, RoofTool } from './tools/markerTools';
import { MeasureTool, ZoomBoxTool } from './tools/measureTool';
import { skewText, skewWarnings } from '../elements/angleCheck';
import { modifyContextAt, ModifyPalette, type ModifyHost } from './modify';
import { refFrame } from '../core/wallEdit';
import type { Edit3DHost, Handle3D, View3D } from '../view3d/view3d';
import type { Primitive, Vec2 } from '../repr/primitives';
import { sampleProject } from '../sample/sampleProject';
import { startAutosave, type SaveStatus } from '../storage/autosave';
import { parse } from '../storage/format';
import { keepUnreadable, loadLocal, mayOverwrite, recordFormatVersion } from '../storage/localStore';
import { FORMAT_VERSION } from '../core/model';
import { forgetProjectFile, openProjectFile, saveProject, saveProjectFile, saveTextFile } from '../storage/projectFile';
import { ContextMenu } from './contextMenu';
import { releasedHint } from './tools/selectTool';
import { minorStepFor } from '../view2d/grid';
import { PlanView, type ViewTool } from '../view2d/planView';
import { renderHighlight } from './highlight';
import { icons } from './icons';
import { escapeHtml } from './labels';
import { MeasureBox } from './measureBox';
import { NewProjectDialog } from './newProjectDialog';
import { FeedbackDialog } from './feedbackDialog';
import { PropertiesPanel } from './propertiesPanel';
import { Selection } from './selection';
import { isNarrow, setupSheetDrag } from './sheet';
import { PetPalette } from './petPalette';
import { SettingsDialog } from './settingsDialog';
import { StyleDialog } from './styleDialog';
import { TempDims } from './tempDims';
import { Navigator, type NavTab } from './navigator';
import { applyUiColors, loadUiSettings, mmPerCssPx, PANE_WIDTH, saveUiSettings, type PaneMode } from './uiSettings';
import { clampWidth, setupPaneResize } from './paneResize';
import { InlineTextEditor } from './textEditor';
import { Camera } from '../view2d/camera';
import { applyTheme, createThemeSwitcher, currentTheme, onThemeChange, type ThemeId } from './theme';
import type { ToolHost } from './tools/host';
import { SelectTool } from './tools/selectTool';
import { isSnapEnabled, setSnapEnabled, type SnapSegment } from './tools/snap';
import { DimensionTool, TextTool } from './tools/annotationTools';
import { OpeningTool } from './tools/openingTool';
import { RoomTool } from './tools/roomTool';
import { WallTool } from './tools/wallTool';
import type { AppContext } from './app/context';
import { installClipboard } from './app/clipboard';
import { defaultState, defaultWallType, describeView, firstDefinition, formatScale, nextProposalName, nf, tf } from './app/helpers';
import { installKeyboard } from './app/keyboard';
import { installMenus } from './app/menus';
import { createUiState, GROUP_LABEL, PLAN_TOOLS, shellMarkup, TOOLS, type ToolId, type ViewMode } from './app/shell';
import { installShowMenu } from './app/showMenu';
import { installToolOptions } from './app/toolOptions';
import { installViews } from './app/views';



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
    view.requestRender();
    // Vänta tills de nya färgerna gäller innan 3D-vyn läser dem.
    requestAnimationFrame(() => view3d?.refreshColors());
  });
  const menuBtn = $<HTMLButtonElement>('[data-action="menu"]');

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
  const pane3d = document.createElement('div');
  pane3d.className = 'pane-3d';
  canvas.prepend(pane2d, pane3d);

  // Gränssnittet: rutnät, färger, snabbknappar, panelbredder och skärmstorlek.
  // Hör till användaren, inte projektet.
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

  // Text som redigeras direkt i ritningen (dubbelklick).
  textEditor = new InlineTextEditor(pane2d);

  /** Starta redigering av en text eller ett rumsnamn där man dubbelklickade. */
  function editTextAt(id: Id, at: Vec2): boolean {
    const el = store.doc.elements[id];
    // Dubbelklick på en fasad- eller sektionslinje öppnar vyn.
    if (el && (el.type === 'Section' || el.type === 'Elevation') && !ui.marker) {
      goTo({ kind: 'marker', id });
      return true;
    }
    if (!el || !textEditor || ui.marker) return false;
    const DRAWING_SCALE = 100;
    if (el.type === 'Text') {
      const p = resolveParams<{ pos: Vec2; text: string; height: number; angle: number }>(store.doc, el);
      palette.hide();
      textEditor.open(
        {
          at: p.pos,
          angle: ((p.angle ?? 0) * Math.PI) / 180,
          height: p.height,
          drawingScale: DRAWING_SCALE,
          value: String(p.text),
          multiline: true,
          label: 'Text',
          commit: (v) => {
            if (v.trim() === '') hint('En tom text tas bort med Delete.');
            else updateParams(store, [id], { text: v }, 'Ändra text');
          },
        },
        view.camera,
      );
      return true;
    }
    if (el.type === 'Space') {
      // Bara när man pekar på rumsetiketten, inte var som helst i rummet.
      const texts = (plan.pickables.find((pk) => pk.id === id)?.prims ?? []).filter(
        (q): q is Extract<Primitive, { kind: 'text' }> => q.kind === 'text',
      );
      const tol = 4 / view.camera.scale;
      const hit = texts.some((t) => {
        const w = t.text.length * t.height * 0.62 * DRAWING_SCALE;
        const h = t.height * DRAWING_SCALE;
        const x0 = t.align === 'middle' ? t.at[0] - w / 2 : t.at[0];
        return at[0] >= x0 - tol && at[0] <= x0 + w + tol && at[1] >= t.at[1] - h * 0.3 - tol && at[1] <= t.at[1] + h + tol;
      });
      const nameRow = texts[0];
      if (!hit || !nameRow) return false;
      const w = nameRow.text.length * nameRow.height * 0.62 * DRAWING_SCALE;
      palette.hide();
      textEditor.open(
        {
          at: [nameRow.align === 'middle' ? nameRow.at[0] - w / 2 : nameRow.at[0], nameRow.at[1]],
          angle: 0,
          height: nameRow.height,
          drawingScale: DRAWING_SCALE,
          value: el.name ?? 'Rum',
          multiline: false,
          bold: true,
          label: 'Rumsnamn',
          commit: (v) => renameElement(store, id, v.trim() || 'Rum'),
        },
        view.camera,
      );
      return true;
    }
    return false;
  }

  /** Stilmallen för vyn: en förinställd mall med projektets texter, eller projektets egen. */
  function styleFor(name: string | null): StyleSheet {
    const g = store.doc.graphics;
    const preset = name ? PRESETS.find((p) => p.name === name) : undefined;
    return preset ? { ...preset, labels: g.labels } : g;
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
    };
  }

  /** Vyns inställningar som de är just nu. */
  function currentViewDef(id: Id, name: string): ViewDef {
    return {
      id,
      name,
      storey: ui.storey,
      state: ui.state,
      compare: ui.compare,
      detail: ui.detail,
      hide: [...ui.hide],
      hideDemolished: ui.hideDemolished,
      ...(ui.styleName ? { style: ui.styleName } : {}),
      trace: ui.trace,
      ...(ui.marker ? { marker: ui.marker } : {}),
    };
  }

  function viewModified(v: ViewDef): boolean {
    const c = currentViewDef(v.id, v.name);
    return (
      c.storey !== v.storey ||
      c.state !== v.state ||
      c.compare !== v.compare ||
      c.detail !== v.detail ||
      c.hideDemolished !== v.hideDemolished ||
      [...c.hide].sort().join() !== [...v.hide].sort().join() ||
      (c.style ?? null) !== (v.style ?? null) ||
      (c.trace ?? null) !== (v.trace ?? null) ||
      (c.marker ?? null) !== (v.marker ?? null)
    );
  }

  function applyView(v: ViewDef): void {
    ui.activeView = v.id;
    ui.storey = v.storey;
    ui.state = v.state;
    ui.compare = v.compare;
    ui.detail = v.detail;
    ui.hide = [...v.hide];
    ui.hideDemolished = v.hideDemolished;
    ui.styleName = v.style ?? null;
    ui.trace = v.trace ?? null;
    ui.marker = v.marker && store.doc.elements[v.marker] ? v.marker : null;
    visit({ kind: 'view', id: v.id });
    syncDetailSwitch();
    renderAll();
  }

  function syncDetailSwitch(): void {
    document
      .querySelectorAll<HTMLElement>('.detail-switch [data-detail]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.detail === ui.detail)));
  }

  function renderViewButton(): void {
    const v = ui.activeView ? store.doc.views.find((x) => x.id === ui.activeView) : undefined;
    const modified = !!v && viewModified(v);
    const storeyName = store.doc.storeys.find((s) => s.id === ui.storey)?.name ?? '';
    const markerEl = ui.marker ? store.doc.elements[ui.marker] : undefined;
    out('view-name').textContent = v ? `${v.name}${modified ? ' *' : ''}` : markerEl ? markerName(store.doc, markerEl) : `${storeyName} · modell`;
    // Ändringar i vyinställningarna är tillfälliga tills de sparas i vyn.
    const save = $<HTMLButtonElement>('.vb-save');
    save.hidden = !!v && !modified;
    save.textContent = v ? 'Spara i vyn' : 'Spara som vy…';
    $<HTMLElement>('.viewbar').classList.toggle('modified', modified);
  }

  function viewStates() {
    const doc = store.doc;
    const ex = existingState(doc);
    const compareTo = ui.compare && ex && ex.id !== ui.state ? ex.id : undefined;
    return { state: ui.state, compareTo, detail: ui.detail, hide: ui.hide, hideDemolished: ui.hideDemolished, autoDims: uiSettings.autoDims };
  }

  // ---------- Verktyg ----------
  const host: ToolHost = {
    store,
    selection,
    view,
    plan: () => plan,
    readOnly: () => !!ui.marker,
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
    editText: (id, at) => editTextAt(id, at),
    modify: (p, hitId) => {
      if (ui.marker || ui.tool !== 'select') return false;
      const r = view.svg.getBoundingClientRect();
      const ctx = modifyContextAt(host, p, r.left + p.screen[0], r.top + p.screen[1], hitId);
      if (!ctx) return false;
      palette.hide();
      modifyPalette.show(ctx);
      return true;
    },
    snapSegments: (): SnapSegment[] => {
      const vs = viewStates();
      const doc = store.doc;
      // Väggarnas referenslinjer först, sedan väggarnas liv och möblernas kanter.
      const refs = Object.values(doc.elements)
        .filter((e) => e.type === 'Wall' && e.storey === ui.storey && actionOf(e, vs) !== 'absent')
        .flatMap((e) => {
          const p = e.params as unknown as WallParams;
          if (!p.bulge) return [{ id: e.id, a: p.start, b: p.end }];
          // Bågväggar: bågen som korta raka bitar.
          const f = refFrame(doc, e);
          const pts = f.trace(0, f.length, 0);
          return pts.slice(1).map((q, i) => ({ id: e.id, a: pts[i], b: q }));
        });
      const edges: SnapSegment[] = [];
      for (const pk of plan.pickables) {
        const type = doc.elements[pk.id]?.type;
        if (type !== 'Wall' && type !== 'Furniture') continue;
        for (const rings of pk.regions)
          for (const ring of rings) for (let i = 0; i < ring.length; i++) edges.push({ id: pk.id, a: ring[i], b: ring[(i + 1) % ring.length] });
      }
      return [...refs, ...edges];
    },
  };

  const selectTool = new SelectTool(host);
  const wallTool = new WallTool(host, { definition: defaultWallType(store.doc), face: 'center', height: 2700 });
  wallTool.onChange = () => renderToolOptions();
  const panTool: ViewTool = { cursor: 'grab', down: () => 'pan', tap: (p) => selectTool.tap(p) };
  const doorTool = new OpeningTool(host, 'Door', { definition: firstDefinition(store.doc, 'Door') });
  const windowTool = new OpeningTool(host, 'Window', { definition: firstDefinition(store.doc, 'Window') });
  const roomTool = new RoomTool(host);
  const dimensionTool = new DimensionTool(host);
  dimensionTool.onChange = () => renderToolOptions();
  const textTool = new TextTool(host);
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
    updateMeasureOptions();
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
  roofTool.onChange = () => renderToolOptions();
  sectionTool.onChange = () => renderToolOptions();
  elevationTool.onChange = () => renderToolOptions();
  const tools: Record<ToolId, ViewTool> = {
    select: selectTool,
    wall: wallTool,
    pan: panTool,
    door: doorTool,
    window: windowTool,
    room: roomTool,
    dimension: dimensionTool,
    text: textTool,
    roof: roofTool,
    section: sectionTool,
    elevation: elevationTool,
    measure: measureTool,
  };

  function setTool(id: ToolId): void {
    measureBox.close();
    // Mått och text i fasader och sektioner kommer med vy-elementen i 0.8.
    if (ui.marker && (id === 'dimension' || id === 'text')) {
      hint(`${id === 'dimension' ? 'Mått' : 'Text'} i fasader och sektioner kommer i 0.8. Gå till planen för att ${id === 'dimension' ? 'måttsätta' : 'skriva'} där.`, 4500);
      return;
    }
    // Ritverktygen ritar i planen: från en fasad eller sektion går man tillbaka dit.
    if (PLAN_TOOLS.includes(id) && ui.marker) goTo({ kind: 'storey', id: ui.storey });
    if (PLAN_TOOLS.includes(id) && ui.mode === '3d') void setMode('2d');
    if (ui.tool === 'wall' && id !== 'wall') wallTool.finish();
    if (ui.tool === 'dimension' && id !== 'dimension') dimensionTool.reset();
    if (ui.tool === 'roof' && id !== 'roof') roofTool.reset();
    if (ui.tool === 'section' && id !== 'section') sectionTool.reset();
    if (ui.tool === 'elevation' && id !== 'elevation') elevationTool.reset();
    palette.hide();
    modifyPalette.close();
    ui.tool = id;
    view.setTool(tools[id]);
    toolsEl.querySelectorAll<HTMLElement>('[data-tool]').forEach((b) => {
      if (!b.hasAttribute('aria-disabled')) b.setAttribute('aria-pressed', String(b.dataset.tool === id));
    });
    if (PLAN_TOOLS.includes(id) && id !== 'room' && id !== 'text') {
      selection.clear();
      if (window.innerWidth <= 960) setPanel(false);
    }
    renderToolOptions();
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
    if (modifyPalette.open) modifyPalette.close();
    else if (ui.tool === 'wall' && wallTool.drawing) wallTool.finish();
    else if (ui.tool === 'dimension' && dimensionTool.count > 0) dimensionTool.reset();
    else if (ui.tool === 'roof' && roofTool.started) roofTool.reset();
    else if (ui.tool === 'section' && sectionTool.step > 0) sectionTool.reset();
    else if (ui.tool === 'elevation' && elevationTool.step > 0) elevationTool.reset();
    else if (ui.tool === 'measure' && measureTool.measurement().points > 0) measureTool.reset();
    else setTool('select');
    view.requestRender();
  }


  // ---------- Panel och dialog ----------
  const panel = new PropertiesPanel(store, selection, viewStates);
  panel.onOpenMarker = (id) => goTo({ kind: 'marker', id });
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
    if (ui.marker) goTo({ kind: 'storey', id: ui.storey });
    if (ui.tool !== 'select') setTool('select');
    alignTool.target = id;
    aligning = true;
    view.setTool(alignTool);
    hint(`Klicka på en vägg eller linje. ${store.doc.elements[id]?.type === 'Section' ? 'Sektionen blir vinkelrät mot den' : 'Fasaden blir parallell med den'}; håll Shift för det omvända.`, 5000);
  };
  setupSheetDrag(panel.el, {
    narrow: isNarrow,
    state: () => ui.sheet,
    set: (open, sheet) => setPanel(open, sheet),
  });
  panel.el.querySelector('.panel-close')!.innerHTML = icons.close;

  // Navigatorn och egenskaperna delar högerspalten på datorn.
  const navigator = new Navigator({
    doc: () => store.doc,
    storey: () => ui.storey,
    activeView: () => ui.activeView,
    marker: () => ui.marker,
    trace: () => ui.trace,
    viewModified: (v) => viewModified(v),
    describeView,
  });
  const dock = document.createElement('div');
  dock.className = 'dock';
  // Minimerade paneler blir stående band vid högerkanten.
  const band = (action: string, label: string, icon: string, title: string) => {
    const b = document.createElement('button');
    b.className = 'pane-band';
    b.dataset.action = action;
    b.title = title;
    b.setAttribute('aria-label', `Visa ${label.toLowerCase()}`);
    b.innerHTML = `${icon}<span>${label}</span>`;
    return b;
  };
  dock.append(
    band('open-nav', 'Projektträd', icons.navigator, 'Projektträd (N)'),
    navigator.el,
    band('open-panel-band', 'Egenskaper', icons.properties, 'Egenskaper (P)'),
    panel.el,
  );
  appEl.appendChild(dock);
  panel.el.querySelector('.pane-min')!.innerHTML = icons.minimize;
  panel.el.querySelector('.pane-x')!.innerHTML = icons.close;

  // På datorn ligger projektträdet och egenskaperna bredvid varandra. Strecket i
  // vänsterkanten ändrar bredden; ett klick på det fäller ihop panelen.
  /** Ritytan ska alltid få minst så här mycket plats (px). */
  const MIN_CANVAS = 360;
  const maxPaneWidth = (other: number) =>
    Math.min(PANE_WIDTH.max, window.innerWidth - (toolsEl.offsetWidth || 0) - MIN_CANVAS - other);
  function applyPaneWidths(): void {
    appEl.style.setProperty('--nav-w', `${uiSettings.navWidth}px`);
    appEl.style.setProperty('--prop-w', `${uiSettings.panelWidth}px`);
  }
  applyPaneWidths();
  setupPaneResize(navigator.el, {
    label: 'Projektträdet',
    width: () => navigator.el.offsetWidth || uiSettings.navWidth,
    setWidth: (w) => {
      uiSettings.navWidth = w;
      applyPaneWidths();
    },
    commit: () => saveUiSettings(uiSettings),
    collapse: () => setPaneMode('nav', 'min'),
    min: PANE_WIDTH.min,
    max: () => maxPaneWidth(ui.panelOpen ? panel.el.offsetWidth : 0),
  });
  setupPaneResize(panel.el, {
    label: 'Egenskaperna',
    width: () => panel.el.offsetWidth || uiSettings.panelWidth,
    setWidth: (w) => {
      uiSettings.panelWidth = w;
      applyPaneWidths();
    },
    commit: () => saveUiSettings(uiSettings),
    collapse: () => setPaneMode('panel', 'min'),
    min: PANE_WIDTH.min,
    max: () => maxPaneWidth(ui.navOpen ? navigator.el.offsetWidth : 0),
  });
  // Blir fönstret smalare krymper panelerna så att ritytan får plats.
  window.addEventListener('resize', () => {
    if (isNarrow()) return;
    const nav = clampWidth(uiSettings.navWidth, PANE_WIDTH.min, maxPaneWidth(ui.panelOpen ? uiSettings.panelWidth : 0));
    const prop = clampWidth(uiSettings.panelWidth, PANE_WIDTH.min, maxPaneWidth(ui.navOpen ? nav : 0));
    appEl.style.setProperty('--nav-w', `${nav}px`);
    appEl.style.setProperty('--prop-w', `${prop}px`);
  });
  if (ui.navOpen) navigator.render();

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
    applyPaneWidths();
    view.zoomBy(1); // skriv om skärmskalan med den nya skärmstorleken
    view.showGrid = s.grid;
    renderAll();
    view.requestRender();
    view3d?.refreshColors();
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
      if (!click || e.pointerType !== 'mouse' || e.button !== 0 || !uiSettings.petPalette || isNarrow() || ui.tool !== 'select') return;
      // Efter att verktyget eller 3D-vyn hunnit ändra markeringen.
      setTimeout(() => {
        if (selection.size > 0 && !textEditor?.isOpen && !modifyPalette.open) palette.show(e.clientX, e.clientY);
      }, 0);
    },
    { capture: true },
  );

  const newProjectDialog = new NewProjectDialog((doc) => {
    forgetProjectFile();
    ui.state = defaultState(doc);
    store.load(doc);
    hint(`${doc.project.name} är skapat. Rita väggar med W eller verktyget Vägg.`, 4000);
  });
  root.appendChild(newProjectDialog.el);
  const feedbackDialog = new FeedbackDialog(brand.name, brand.feedbackFallback ?? '');
  root.appendChild(feedbackDialog.el);

  // Tillfälliga mått när en vägg är markerad.
  const tempDims = new TempDims(canvas, store);
  tempDims.requestRender = () => view.requestRender();
  tempDims.onReleased = (n) => hint(releasedHint(n), 4000);
  view.setHighlighter(
    (cam) =>
      renderHighlight(cam, store.doc, plan.pickables, new Set(selection.list()), ui.tool === 'select' ? selectTool.hoverId : null, !ui.marker) +
      tempDims.render(cam, selection.list(), viewStates(), ui.tool === 'select' && ui.mode !== '3d' && !ui.marker && !modifyPalette.running) +
      skewMarks(cam),
  );

  /** Utropstecken vid det som ligger nästan men inte exakt rakt (bara i planen, inte på papper). */
  function skewMarks(cam: Camera): string {
    if (ui.marker) return '';
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
    const markerEl = ui.marker ? doc.elements[ui.marker] : undefined;
    out('storey').textContent = markerEl ? markerName(doc, markerEl) : (doc.storeys.find((s) => s.id === ui.storey)?.name ?? '');
    appEl.dataset.place = markerEl ? 'section' : 'plan';

    chips.innerHTML =
      doc.states
        .map((s) => `<button role="tab" class="chip" data-state="${s.id}" aria-selected="${s.id === ui.state}">${escapeHtml(s.name)}</button>`)
        .join('') + `<button class="chip chip-add" data-action="new-proposal" aria-label="Nytt förslag" title="Nytt förslag">${icons.plus}</button>`;

    const ex = existingState(doc);
    compareLabel.hidden = !ex || ex.id === ui.state;
    if (ex) out('compare-label').textContent = `Jämför med ${ex.name}`;
    compareToggle.checked = ui.compare;

    // Fasad eller sektion: räknas fram ur modellen i stället för planen.
    const section = markerEl ? buildSection(doc, markerEl.id, vs, styleFor(ui.styleName)) : null;
    plan = section ? { prims: section.prims, pickables: section.pickables } : buildPlan(doc, ui.storey, vs, styleFor(ui.styleName));
    // Kalkerad vy: en annan vy tonad under, t.ex. möbleringen under en undertaksplan.
    const traced = ui.trace && !section ? doc.views.find((v) => v.id === ui.trace) : undefined;
    view.setUnderlay(traced ? buildPlan(doc, traced.storey, viewStatesOf(traced), styleFor(traced.style ?? null)).prims : []);
    renderViewButton();
    if (ui.navOpen) navigator.render();
    positionMeasureBox();
    selection.prune((id) => !!doc.elements[id]);
    view.setPrimitives(plan.prims);
    update3d();
    panel.render();
    palette.refresh();
    if (ui.tool === 'wall') renderToolOptions();

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
    if (ui.mode === '3d') void setMode('2d');
    view.zoomToBounds({ minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) });
  }

  /** Måttrutan sitter vid sin punkt i planen, eller i 3D när bara 3D visas. */
  function positionMeasureBox(): void {
    if (!measureBox.open) return;
    if (ui.mode === '3d' && view3d) {
      const v = view3d;
      measureBox.update((p) => v.project(p));
    } else {
      measureBox.update((p) => view.camera.toScreen(p));
    }
  }

  // ---------- 3D ----------
  // Three.js laddas först när 3D-vyn öppnas, så att planen startar snabbt.
  let view3d: View3D | null = null;
  let loading3d: Promise<void> | null = null;

  /** Andra markerade väggar som har en ände i punkten; de följer med när änden dras. */
  function companionWalls(wallId: Id, at: Vec2): Id[] {
    return selection.list().filter((id) => {
      const el = store.doc.elements[id];
      if (id === wallId || el?.type !== 'Wall') return false;
      const p = el.params as unknown as WallParams;
      return Math.hypot(p.start[0] - at[0], p.start[1] - at[1]) <= 1 || Math.hypot(p.end[0] - at[0], p.end[1] - at[1]) <= 1;
    });
  }

  // Redigering i 3D: samma kommandon och snäppregler som i planen.
  const edit3d: Edit3DHost = {
    isSelected: (id) => selection.has(id),
    selectedIds: () => selection.list(),
    handles: () => {
      if (ui.tool !== 'select') return [];
      const out: Handle3D[] = [];
      const seen: Vec2[] = [];
      for (const id of selection.list()) {
        const el = store.doc.elements[id];
        if (el?.type !== 'Wall' || el.storey !== ui.storey) continue;
        const p = resolveParams<WallParams>(store.doc, el);
        for (const end of ['start', 'end'] as const) {
          const pt = p[end];
          if (seen.some((s) => Math.hypot(s[0] - pt[0], s[1] - pt[1]) <= 1)) continue;
          seen.push(pt);
          out.push({ wallId: id, end, point: pt, z: p.height, fixed: end === 'start' ? p.end : p.start });
        }
      }
      return out;
    },
    refLines: () => {
      if (ui.tool !== 'select') return [];
      return selection
        .list()
        .map((id) => store.doc.elements[id])
        .filter((el) => el?.type === 'Wall' && el.storey === ui.storey)
        .map((el) => {
          const p = resolveParams<WallParams>(store.doc, el);
          return { a: p.start, b: p.end, z: p.height };
        });
    },
    snap: (cursor, from, exclude, tol, ortho) => {
      const r = snap({ cursor, from, segments: host.snapSegments(), tol, ortho, exclude: new Set(exclude) });
      return { point: r.point, label: r.label };
    },
    commitWallEnd: (wallId, end, to) => {
      const el = store.doc.elements[wallId];
      if (!el) return;
      const p = el.params as unknown as WallParams;
      const companions = companionWalls(wallId, p[end]);
      const fixed = end === 'start' ? p.end : p.start;
      const original = Math.hypot(p.end[0] - p.start[0], p.end[1] - p.start[1]);
      if (Math.hypot(to[0] - fixed[0], to[1] - fixed[1]) < 1) return;
      moveWallEnd(store, wallId, end, [to[0], to[1]], { label: 'Dra väggände', connected: companions });
      host.wallEndMoved?.(wallId, end, original, companions);
    },
    commitMove: (ids, d, anchor) => {
      if (Math.hypot(d[0], d[1]) < 1) return;
      const r = moveElements(store, ids, [d[0], d[1]]);
      if (r.released) hint(releasedHint(r.released), 4000);
      host.elementsMoved?.(ids, d, anchor);
    },
  };

  function update3d(): void {
    if (!view3d || ui.mode === '2d') return;
    view3d.setSolids(buildModel3d(store.doc, ui.storey, viewStates()));
    view3d.setSelection(selection.list());
    // Med en sektion öppen klipps modellen längs den.
    const m = ui.marker ? store.doc.elements[ui.marker] : undefined;
    if (m?.type === 'Section') {
      const f = markerFrame(store.doc, m);
      view3d.setClip({ start: f.start, right: f.right, view: f.view, length: Math.hypot(f.end[0] - f.start[0], f.end[1] - f.start[1]), depth: f.depth });
    } else view3d.setClip(null);
  }

  async function setMode(mode: ViewMode): Promise<void> {
    ui.mode = mode;
    appEl.dataset.mode = mode;
    $<HTMLElement>('.view-modes')
      .querySelectorAll<HTMLElement>('[data-mode]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    if (mode === '3d' && ui.tool === 'wall') setTool('select');
    // Rutorna har fått nya storlekar: visa hela planen och modellen igen.
    setTimeout(() => {
      if (mode !== '3d') view.zoomToFit();
    }, 60);
    if (mode !== '2d' && !view3d) {
      loading3d ??= import('../view3d/view3d').then(({ View3D }) => {
        view3d = new View3D(pane3d);
        view3d.editor = edit3d;
        view3d.onCameraChange = () => {
          if (ui.mode === '3d') positionMeasureBox();
        };
        view3d.onPick = (id, additive) => {
          if (!id) selection.clear();
          else if (additive) selection.toggle(id);
          else selection.set([id]);
        };
      });
      try {
        await loading3d;
      } catch {
        hint('3D-vyn kunde inte startas i den här webbläsaren.', 4000);
        return;
      }
    }
    update3d();
    if (mode !== '2d') setTimeout(() => view3d?.frameAll(), 60);
  }

  store.subscribe((_doc, ev) => {
    renderAll();
    if (ev.cause === 'undo' && ev.transaction) hint(`Ångrade: ${ev.transaction.label}`);
    if (ev.cause === 'redo' && ev.transaction) hint(`Gjorde om: ${ev.transaction.label}`);
    if (ev.cause === 'load') {
      ui.activeView = null;
      ui.marker = null;
      ui.trace = null;
      ui.styleName = null;
      viewHistory.splice(0, viewHistory.length, { kind: 'storey', id: ui.storey });
      selection.clear();
      view.zoomToFit();
      renderViewButton();
    }
  });

  selection.subscribe(() => {
    const t = measureBox.open ? selection.list() : [];
    if (measureBox.open && t.length !== 1) measureBox.close();
    panel.showTab('selection');
    if (selection.size === 0) palette.hide();
    else palette.refresh();
    // På mobilen kommer bladet upp nedfällt när något markeras, så att planen
    // syns och man kan fortsätta markera. Det försvinner när inget är markerat.
    if (isNarrow()) {
      if (selection.size > 0 && !ui.panelOpen) setPanel(true, 'peek');
      else if (selection.size === 0 && ui.panelOpen && panel.currentTab === 'selection') setPanel(false, 'peek');
    }
    view.requestRender();
    view3d?.setSelection(selection.list());
  });

  let blockedHintShown = false;
  const showSaveStatus = (s: SaveStatus) => {
    const el = out('save');
    el.dataset.kind = s.kind;
    el.textContent =
      s.kind === 'saved'
        ? `Sparat ${tf.format(s.at)}`
        : s.kind === 'pending'
          ? 'Sparar…'
          : s.kind === 'blocked'
            ? 'Autospar låst'
            : 'Sparas inte i den här webbläsaren';
    el.title = s.kind === 'blocked' ? 'Det autosparade projektet är från en nyare version och skrivs inte över. Spara som fil för att behålla det du gör här.' : '';
    if (s.kind === 'blocked' && !blockedHintShown) {
      blockedHintShown = true;
      hint('En nyare version av programmet har autosparat ett projekt här. Det skrivs inte över; spara som fil för att behålla det du gör nu.', 7000);
    }
  };
  startAutosave(store, showSaveStatus, { blocked: autosaveBlocked });
  if (autosaveBlocked) showSaveStatus({ kind: 'blocked' });
  else if (saved) out('save').textContent = `Sparat ${tf.format(new Date(saved.savedAt))}`;

  // ---------- Appens delar (src/ui/app/) ----------
  // Varje del får appen som ett objekt med getters, så att den alltid ser det
  // som gäller just nu. Se src/ui/app/context.ts.
  const ctxMenu = new ContextMenu();
  const app: AppContext = {
    get root() {
      return root;
    },
    get $() {
      return $;
    },
    get out() {
      return out;
    },
    get appEl() {
      return appEl;
    },
    get menu() {
      return menu;
    },
    get toolOptions() {
      return toolOptions;
    },
    get pane2d() {
      return pane2d;
    },
    get pane3d() {
      return pane3d;
    },
    get store() {
      return store;
    },
    get selection() {
      return selection;
    },
    get ui() {
      return ui;
    },
    get uiSettings() {
      return uiSettings;
    },
    get view() {
      return view;
    },
    get plan() {
      return plan;
    },
    get view3d() {
      return view3d;
    },
    get selectTool() {
      return selectTool;
    },
    get wallTool() {
      return wallTool;
    },
    get doorTool() {
      return doorTool;
    },
    get windowTool() {
      return windowTool;
    },
    get roomTool() {
      return roomTool;
    },
    get dimensionTool() {
      return dimensionTool;
    },
    get textTool() {
      return textTool;
    },
    get measureTool() {
      return measureTool;
    },
    get roofTool() {
      return roofTool;
    },
    get sectionTool() {
      return sectionTool;
    },
    get elevationTool() {
      return elevationTool;
    },
    get aligning() {
      return aligning;
    },
    get zoomingBox() {
      return zoomingBox;
    },
    get panel() {
      return panel;
    },
    get palette() {
      return palette;
    },
    get modifyPalette() {
      return modifyPalette;
    },
    get navigator() {
      return navigator;
    },
    get measureBox() {
      return measureBox;
    },
    get newProjectDialog() {
      return newProjectDialog;
    },
    get settingsDialog() {
      return settingsDialog;
    },
    get styleDialog() {
      return styleDialog;
    },
    get ctxMenu() {
      return ctxMenu;
    },
    get hint() {
      return hint;
    },
    get renderAll() {
      return renderAll;
    },
    get viewStates() {
      return viewStates;
    },
    get setTool() {
      return setTool;
    },
    get setMode() {
      return setMode;
    },
    get setPanel() {
      return setPanel;
    },
    get setNav() {
      return setNav;
    },
    get togglePanel() {
      return togglePanel;
    },
    get toggleNav() {
      return toggleNav;
    },
    get toggleGrid() {
      return toggleGrid;
    },
    get closeMenu() {
      return closeMenu;
    },
    get closeShowMenu() {
      return closeShowMenu;
    },
    get cancelCommand() {
      return cancelCommand;
    },
    get endAlign() {
      return endAlign;
    },
    get startZoomBox() {
      return startZoomBox;
    },
    get endZoomBox() {
      return endZoomBox;
    },
    get previousZoom() {
      return previousZoom;
    },
    get zoomToSelection() {
      return zoomToSelection;
    },
    get roofOverHouse() {
      return roofOverHouse;
    },
    get screenMm() {
      return screenMm;
    },
    get saveNow() {
      return saveNow;
    },
    get openFile() {
      return openFile;
    },
    get applyView() {
      return applyView;
    },
    get currentViewDef() {
      return currentViewDef;
    },
    get viewModified() {
      return viewModified;
    },
    get goTo() {
      return goTo;
    },
    get openHistoryMenu() {
      return openHistoryMenu;
    },
    get openMarkerMenu() {
      return openMarkerMenu;
    },
    get openViewMenu() {
      return openViewMenu;
    },
    get copySelection() {
      return copySelection;
    },
    get pasteFromMenu() {
      return pasteFromMenu;
    },
  };
  const { renderToolOptions, updateMeasureOptions } = installToolOptions(app);
  const { goTo, openHistoryMenu, openMarkerMenu, openViewMenu, saveViewAsNew, updateActiveView, viewHistory, visit } = installViews(app);
  const { applyTraceLook, closeScalePop, openScalePop, refreshShowMenu, scalePop, traceLookMarkup } = installShowMenu(app);
  const { viewBtnLongPressed } = installMenus(app);
  installKeyboard(app);
  const { copySelection, pasteFromMenu } = installClipboard(app);

  // För felsökning i webbläsarens konsol.
  (window as unknown as { bacchus: unknown }).bacchus = { store, view, selection, ui, modifyPalette, get view3d() { return view3d; } };

  appEl.dataset.mode = ui.mode;
  appEl.dataset.sheet = ui.sheet;
  applyPaneClasses();
  applyTraceLook();
  window.addEventListener('resize', () => applyPaneClasses());
  renderAll();
  setTool('select');
  view.zoomToFit();
  if (migrated) hint('Projektet har uppdaterats till den nya versionen. Exemplet finns under Börja om med exemplet.', 5000);

  // ---------- Händelser ----------
  chips.addEventListener('click', (e) => {
    const chip = (e.target as Element).closest<HTMLElement>('[data-state]');
    if (chip) {
      ui.state = chip.dataset.state!;
      renderAll();
    }
  });

  compareToggle.addEventListener('change', () => {
    ui.compare = compareToggle.checked;
    renderAll();
  });

  const toggleGrid = () => {
    uiSettings.grid = !uiSettings.grid;
    saveUiSettings(uiSettings);
    settingsDialog.update(uiSettings);
    view.showGrid = uiSettings.grid;
  };

  function setPanel(open: boolean, sheet: 'peek' | 'full' = ui.sheet): void {
    ui.sheet = sheet;
    appEl.dataset.sheet = sheet;
    if (isNarrow()) {
      ui.panelOpen = open;
      appEl.classList.toggle('panel-open', open);
      syncPaneButtons();
    } else setPaneMode('panel', open ? 'open' : 'closed');
  }

  function setNav(open: boolean): void {
    if (isNarrow()) {
      ui.navOpen = open;
      appEl.classList.toggle('nav-open', open);
      syncPaneButtons();
      if (open) navigator.render();
    } else setPaneMode('nav', open ? 'open' : 'closed');
  }

  /**
   * Projektträdet och egenskaperna på datorn: öppna, minimerade till ett
   * stående band vid högerkanten, eller stängda. Läget sparas i webbläsaren.
   */
  function setPaneMode(which: 'nav' | 'panel', mode: PaneMode): void {
    if (which === 'nav') {
      uiSettings.navMode = mode;
      ui.navOpen = mode === 'open';
      if (ui.navOpen) navigator.render();
    } else {
      uiSettings.panelMode = mode;
      ui.panelOpen = mode === 'open';
    }
    saveUiSettings(uiSettings);
    applyPaneClasses();
  }

  function applyPaneClasses(): void {
    const narrow = isNarrow();
    appEl.classList.toggle('nav-open', ui.navOpen);
    appEl.classList.toggle('panel-open', ui.panelOpen);
    appEl.classList.toggle('nav-min', !narrow && uiSettings.navMode === 'min');
    appEl.classList.toggle('panel-min', !narrow && uiSettings.panelMode === 'min');
    syncPaneButtons();
  }

  function syncPaneButtons(): void {
    const narrow = isNarrow();
    const state = (open: boolean, mode: PaneMode) => (open ? 'true' : !narrow && mode === 'min' ? 'mixed' : 'false');
    $<HTMLElement>('.topbar [data-action="toggle-panel"]').setAttribute('aria-pressed', state(ui.panelOpen, uiSettings.panelMode));
    $<HTMLElement>('.topbar [data-action="toggle-nav"]').setAttribute('aria-pressed', state(ui.navOpen, uiSettings.navMode));
  }

  const closeShowMenu = () => {
    document.querySelectorAll<HTMLElement>('.show-menu').forEach((m) => (m.hidden = true));
    $<HTMLElement>('.show-btn').setAttribute('aria-expanded', 'false');
  };

  const closeMenu = () => {
    menu.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
  };

  root.addEventListener('click', async (e) => {
    const target = e.target as Element;
    if (!target.closest('.menu-wrap')) closeMenu();
    const modeBtn = target.closest<HTMLElement>('.view-modes [data-mode]');
    if (modeBtn) {
      void setMode(modeBtn.dataset.mode as ViewMode);
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
      else ui.hide = showItem.checked ? ui.hide.filter((h) => h !== key) : [...ui.hide, key];
      renderAll();
      return;
    }
    if (!target.closest('.show-wrap')) closeShowMenu();
    const traceAbove = target.closest<HTMLElement>('[data-trace-above]');
    if (traceAbove) {
      uiSettings.trace.above = traceAbove.dataset.traceAbove === '1';
      saveUiSettings(uiSettings);
      applyTraceLook();
      refreshShowMenu();
      return;
    }
    const styleSel = target.closest<HTMLSelectElement>('[data-show-style], [data-show-trace]');
    if (styleSel) return;
    const detailBtn = target.closest<HTMLElement>('[data-detail]');
    if (detailBtn) {
      ui.detail = detailBtn.dataset.detail as 'sketch' | 'normal' | 'detail';
      syncDetailSwitch();
      renderAll();
      return;
    }
    const navTab = target.closest<HTMLElement>('[data-nav-tab]');
    if (navTab) {
      navigator.showTab(navTab.dataset.navTab as NavTab);
      if (!ui.navOpen) setNav(true);
      return;
    }
    // En flik i en hopfälld egenskapspanel fäller ut den.
    if (target.closest('.panel [data-tab]') && !ui.panelOpen && !isNarrow()) {
      setPanel(true, 'full');
      return;
    }
    const markerPick = target.closest<HTMLElement>('[data-marker-pick]');
    if (markerPick) {
      if (isNarrow()) setNav(false);
      goTo({ kind: 'marker', id: markerPick.dataset.markerPick! });
      return;
    }
    const markerMore = target.closest<HTMLElement>('[data-marker-menu]');
    if (markerMore) {
      const r = markerMore.getBoundingClientRect();
      openMarkerMenu(markerMore.dataset.markerMenu!, r.left, r.bottom + 4);
      return;
    }
    const storeyPick = target.closest<HTMLElement>('[data-storey-pick]');
    if (storeyPick) {
      if (isNarrow()) setNav(false);
      goTo({ kind: 'storey', id: storeyPick.dataset.storeyPick! });
      return;
    }
    const viewPick = target.closest<HTMLElement>('[data-view-apply]');
    if (viewPick) {
      const v = store.doc.views.find((x) => x.id === viewPick.dataset.viewApply);
      closeShowMenu();
      if (isNarrow()) setNav(false);
      if (v) applyView(v);
      return;
    }
    const viewMore = target.closest<HTMLElement>('[data-view-menu]');
    if (viewMore) {
      const r = viewMore.getBoundingClientRect();
      openViewMenu(viewMore.dataset.viewMenu!, r.left, r.bottom + 4);
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
        startZoomBox();
        break;
      case 'zoom-prev':
        previousZoom();
        break;
      case 'fit':
        if (ui.mode !== '3d') view.zoomToFit();
        if (ui.mode !== '2d') view3d?.frameAll();
        break;
      case 'grid':
        toggleGrid();
        break;
      case 'toggle-panel':
        togglePanel();
        break;
      case 'open-panel-band':
        setPaneMode('panel', 'open');
        break;
      case 'min-panel':
        setPaneMode('panel', 'min');
        break;
      case 'close-panel':
        setPanel(false);
        break;
      case 'open-nav':
        setPaneMode('nav', 'open');
        break;
      case 'min-nav':
        setPaneMode('nav', 'min');
        break;
      case 'close-nav':
        setNav(false);
        break;
      case 'menu':
        menu.hidden = !menu.hidden;
        menuBtn.setAttribute('aria-expanded', String(!menu.hidden));
        break;
      case 'feedback':
        closeMenu();
        feedbackDialog.open();
        break;
      case 'about':
        closeMenu();
        hint(`${brand.name} · ${ENGINE.name} ${ENGINE.version}. Öppen källkod (GPL). Vad som är nytt står i README på GitHub.`, 5000);
        break;
      case 'views':
        // Klick: tillbaka till förra vyn. Håll in eller högerklicka: de senaste.
        if (viewBtnLongPressed()) break;
        if (viewHistory.length > 1) goTo(viewHistory[1]);
        else {
          navigator.showTab('vyer');
          setNav(true);
        }
        break;
      case 'view-save':
        if (ui.activeView) void updateActiveView();
        else void saveViewAsNew();
        break;
      case 'show-types':
        closeMenu();
        setPanel(true, 'full');
        panel.showTab('types');
        break;
      case 'style':
        closeMenu();
        closeShowMenu();
        styleDialog.open();
        break;
      case 'show-menu': {
        const m = $<HTMLElement>('.show-menu');
        if (!m.hidden) closeShowMenu();
        else {
          const item = (key: string, label: string, on: boolean) =>
            `<label class="check"><input type="checkbox" data-show="${key}"${on ? ' checked' : ''}> ${label}</label>`;
          m.innerHTML =
            `<div class="segmented detail-switch in-menu" role="group" aria-label="Detaljnivå">${(['sketch', 'normal', 'detail'] as const)
              .map((d) => `<button data-detail="${d}" aria-pressed="${ui.detail === d}">${{ sketch: 'Skiss', normal: 'Normal', detail: 'Detalj' }[d]}</button>`)
              .join('')}</div>` +
            item('demolished', 'Det som rivs', !ui.hideDemolished) +
            item('littera', 'Littera', !ui.hide.includes('littera')) +
            item('Space', 'Rum', !ui.hide.includes('Space')) +
            item('Furniture', 'Möbler och inredning', !ui.hide.includes('Furniture')) +
            item('Dimension', 'Mått', !ui.hide.includes('Dimension')) +
            item('Text', 'Text', !ui.hide.includes('Text')) +
            item('Roof', 'Tak', !ui.hide.includes('Roof')) +
            item('swing', 'Öppningssätt (dörrar)', !ui.hide.includes('swing')) +
            item('roofSlope', 'Taklutning i fasad och sektion', !ui.hide.includes('roofSlope')) +
            '<div class="menu-label">Markörer i planen</div>' +
            item('Elevation', 'Fasader', !ui.hide.includes('Elevation')) +
            item('Section', 'Sektioner', !ui.hide.includes('Section')) +
            item('North', 'Norrpil', !ui.hide.includes('North')) +
            `<label class="field"><span>Stilmall i vyn</span><select data-show-style><option value="">Projektets (${escapeHtml(store.doc.graphics.name)})</option>${PRESETS.map((p) => `<option value="${escapeHtml(p.name)}"${ui.styleName === p.name ? ' selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}</select></label>` +
            `<label class="field"><span>Kalkera en annan vy</span><select data-show-trace><option value="">Ingen</option>${store.doc.views
              .filter((v) => v.id !== ui.activeView)
              .map((v) => `<option value="${v.id}"${ui.trace === v.id ? ' selected' : ''}>${escapeHtml(v.name)}</option>`)
              .join('')}</select></label>` +
            traceLookMarkup() +
            `<button class="btn show-style-link" data-action="style">Stilmall och ritningsgrafik…</button>`;
          m.hidden = false;
          $<HTMLElement>('.show-btn').setAttribute('aria-expanded', 'true');
        }
        break;
      }
      case 'toggle-nav':
        toggleNav();
        break;
      case 'view-save-new':
        void saveViewAsNew();
        break;
      case 'view-update':
        void updateActiveView();
        break;
      case 'cancel-command':
        cancelCommand();
        break;
      case 'scale-pop':
        if (scalePop.hidden) openScalePop();
        else closeScalePop();
        break;
      case 'scale-settings':
        closeScalePop();
        settingsDialog.open();
        break;
      case 'snap': {
        const on = !isSnapEnabled();
        setSnapEnabled(on);
        $<HTMLElement>('[data-action="snap"]').setAttribute('aria-pressed', String(on));
        hint(on ? 'Snäppning på' : 'Snäppning av');
        break;
      }
      case 'open-panel':
        palette.hide();
        setPanel(true, 'full');
        panel.showTab('selection');
        break;
      case 'save':
      case 'save-as': {
        closeMenu();
        await saveNow(action === 'save-as');
        break;
      }
      case 'settings':
        closeMenu();
        settingsDialog.open();
        break;
      case 'zoom-selection':
        zoomToSelection();
        break;
      case 'new-project':
        closeMenu();
        newProjectDialog.open();
        break;
      case 'new-proposal': {
        closeMenu();
        const doc = store.doc;
        const current = doc.states.find((s) => s.id === ui.state);
        const copyFrom = current?.kind === 'proposal' ? current.id : undefined;
        const s = createProposal(store, nextProposalName(doc), copyFrom);
        ui.state = s.id;
        renderAll();
        hint(`${s.name} skapades som kopia av ${copyFrom ? current!.name : (existingState(doc)?.name ?? 'inget')}.`);
        break;
      }
      case 'open-file':
        closeMenu();
        await openFile();
        break;
      case 'reset-sample': {
        closeMenu();
        const doc = sampleProject();
        forgetProjectFile();
        ui.state = defaultState(doc);
        store.load(doc);
        hint('Exemplet är återställt.');
        break;
      }
    }
  });

  // ---------- Paneler ----------

  function togglePanel(): void {
    if (isNarrow()) {
      // På mobilen: nere → uppe → nere (om något är markerat) eller stängd.
      if (ui.panelOpen) {
        if (ui.sheet === 'peek') setPanel(true, 'full');
        else if (selection.size > 0) setPanel(true, 'peek');
        else setPanel(false);
      } else setPanel(true, 'full');
      return;
    }
    // På datorn: öppen → stängd; minimerad eller stängd → öppen.
    setPaneMode('panel', uiSettings.panelMode === 'open' ? 'closed' : 'open');
  }

  function toggleNav(): void {
    if (isNarrow()) setNav(!ui.navOpen);
    else setPaneMode('nav', uiSettings.navMode === 'open' ? 'closed' : 'open');
  }

  // ---------- Spara och öppna ----------

  async function saveNow(as: boolean): Promise<void> {
    if (import.meta.env.MODE === 'artifact') {
      hint('Förhandsvisningen kan inte spara filer. Det fungerar i versionen på webbhotellet.', 4000);
      return;
    }
    const r = as ? await saveProjectFile(store.doc, brand.fileExtension) : await saveProject(store.doc, brand.fileExtension);
    if (r === 'saved') hint('Projektet sparades.');
    if (r === 'downloaded') hint('Projektfilen laddades ner.');
  }

  async function openFile(): Promise<void> {
    try {
      const doc = await openProjectFile(brand.fileExtension);
      if (doc) {
        ui.state = defaultState(doc);
        store.load(doc);
        hint(`Öppnade ${doc.project.name}.`);
      }
    } catch (err) {
      hint((err as Error).message, 5000);
    }
  }






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
