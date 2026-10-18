import type { Brand } from '../brand';
import { createProposal, deleteElements, moveElements, moveWallEnd } from '../core/commands';
import { resolveParams } from '../elements/registry';
import { snap } from './tools/snap';
import { ENGINE } from '../core/engine';
import { newId } from '../core/ids';
import type { Id, ProjectDoc, ViewDef } from '../core/model';
import { PRESETS, type StyleSheet } from '../core/graphics';
import { actionOf, existingState } from '../core/states';
import { DocStore } from '../core/store';
import type { WallParams } from '../elements/wall';
import type { WallFace } from '../elements/wallSides';
import { buildModel3d } from '../repr/model3d';
import { buildPlan, type PlanResult } from '../repr/plan';
import type { Edit3DHost, Handle3D, View3D } from '../view3d/view3d';
import type { Vec2 } from '../repr/primitives';
import { sampleProject } from '../sample/sampleProject';
import { startAutosave, type SaveStatus } from '../storage/autosave';
import { parse } from '../storage/format';
import { loadLocal } from '../storage/localStore';
import { openProjectFile, saveProjectFile, saveTextFile } from '../storage/projectFile';
import type { Camera } from '../view2d/camera';
import { minorStepFor } from '../view2d/grid';
import { PlanView, type ViewTool } from '../view2d/planView';
import { renderHighlight } from './highlight';
import { icons, type IconName } from './icons';
import { escapeHtml } from './labels';
import { MeasureBox } from './measureBox';
import { NewProjectDialog } from './newProjectDialog';
import { PropertiesPanel } from './propertiesPanel';
import { Selection } from './selection';
import { isNarrow, setupSheetDrag } from './sheet';
import { PetPalette } from './petPalette';
import { SettingsDialog } from './settingsDialog';
import { StyleDialog } from './styleDialog';
import { TempDims } from './tempDims';
import { Navigator, type NavTab } from './navigator';
import { applyUiColors, loadUiSettings, saveUiSettings } from './uiSettings';
import { applyTheme, createThemeSwitcher, currentTheme, onThemeChange, THEMES, type ThemeId } from './theme';
import type { ToolHost } from './tools/host';
import { SelectTool } from './tools/selectTool';
import { isSnapEnabled, setSnapEnabled, type SnapSegment } from './tools/snap';
import { DimensionTool, TextTool } from './tools/annotationTools';
import { OpeningTool } from './tools/openingTool';
import { RoomTool } from './tools/roomTool';
import { WallTool } from './tools/wallTool';

type ToolId = 'pan' | 'select' | 'wall' | 'door' | 'window' | 'room' | 'dimension' | 'text';

/** Verktyg som ritar i planen och därför byter till planvyn. */
const PLAN_TOOLS: ToolId[] = ['wall', 'door', 'window', 'room', 'dimension', 'text'];
type ViewMode = '2d' | '3d' | 'split';

interface ToolDef {
  id: string;
  label: string;
  icon: IconName;
  key?: string;
  /** Milstolpen där verktyget byggs. Saknas för verktyg som redan fungerar. */
  milestone?: number;
  group: 'navigera' | 'rita' | 'notera';
}

const TOOLS: ToolDef[] = [
  { id: 'select', label: 'Markera', icon: 'select', key: 'V', group: 'navigera' },
  { id: 'pan', label: 'Panorera', icon: 'pan', key: 'H', group: 'navigera' },
  { id: 'wall', label: 'Vägg', icon: 'wall', key: 'W', group: 'rita' },
  { id: 'door', label: 'Dörr', icon: 'door', key: 'D', group: 'rita' },
  { id: 'window', label: 'Fönster', icon: 'window', key: 'O', group: 'rita' },
  { id: 'furniture', label: 'Möbel', icon: 'furniture', milestone: 7, group: 'rita' },
  { id: 'room', label: 'Rum', icon: 'room', key: 'R', group: 'notera' },
  { id: 'dimension', label: 'Mått', icon: 'dimension', key: 'M', group: 'notera' },
  { id: 'text', label: 'Text', icon: 'text', key: 'T', group: 'notera' },
];

const GROUP_LABEL: Record<ToolDef['group'], string> = { navigera: 'Visa', rita: 'Rita', notera: 'Notera' };

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
const tf = new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit' });

export async function mountApp(root: HTMLElement, brand: Brand): Promise<void> {
  document.title = brand.badge ? `${brand.name} · ${brand.badge}` : brand.name;

  // Senaste autosparade projektet, annars exemplet.
  const saved = await loadLocal();
  let initial: ProjectDoc = sampleProject();
  let migrated = false;
  if (saved) {
    try {
      migrated = !saved.text.includes('"formatVersion": 2');
      initial = parse(saved.text);
    } catch {
      /* Trasigt autospar: börja med exemplet. */
    }
  }
  const store = new DocStore(initial);
  const selection = new Selection();
  // Deklareras tidigt: hint() kan anropas redan medan appen startar.
  let hintTimer = 0;

  /** Vad som visas just nu. Hör till vyn, inte till projektet. */
  const ui = {
    storey: initial.storeys[0].id,
    state: defaultState(initial),
    compare: true,
    panelOpen: window.innerWidth > 960,
    /** Navigatorn: utfälld på datorn, stängd på telefonen. */
    navOpen: window.innerWidth > 960,
    /** På mobilen: bladet nere med bara snabbraden, eller uppdraget. */
    sheet: 'peek' as 'peek' | 'full',
    tool: 'select' as ToolId,
    mode: '2d' as ViewMode,
    detail: 'normal' as 'sketch' | 'normal' | 'detail',
    /** Det som döljs i vyn (elementtyper och "littera"), och om rivet visas. */
    hide: [] as string[],
    hideDemolished: false,
    /** Vyn man utgick från, och vyns stilmall och spårade vy. */
    activeView: null as Id | null,
    styleName: null as string | null,
    trace: null as Id | null,
  };

  root.innerHTML = `
    <div class="app${ui.panelOpen ? ' panel-open' : ''}${ui.navOpen ? ' nav-open' : ''}">
      <header class="topbar">
        <button class="icon-btn nav-btn" data-action="toggle-nav" title="Navigator: underlag, modell, vyer och ritningar (N)" aria-label="Navigator" aria-pressed="${ui.navOpen}">${icons.navigator}</button>
        <div class="brand">
          <svg viewBox="0 0 24 24" aria-hidden="true">${brand.logoSvg}</svg>
          <span>${brand.name}</span>
          ${brand.badge ? `<span class="badge">${brand.badge}</span>` : ''}
        </div>
        <div class="project"><strong data-out="project"></strong><span data-out="storey"></span></div>
        <div class="spacer"></div>
        <div class="view-controls">
          <button class="icon-btn" data-action="undo" aria-label="Ångra" disabled>${icons.undo}</button>
          <button class="icon-btn" data-action="redo" aria-label="Gör om" disabled>${icons.redo}</button>
          <span class="sep hide-narrow"></span>
          <button class="icon-btn hide-narrow" data-action="zoom-out" title="Zooma ut (−)" aria-label="Zooma ut">${icons.zoomOut}</button>
          <button class="icon-btn hide-narrow" data-action="zoom-in" title="Zooma in (+)" aria-label="Zooma in">${icons.zoomIn}</button>
          <button class="icon-btn" data-action="fit" title="Zooma till allt (F)" aria-label="Zooma till allt">${icons.fit}</button>
          <button class="icon-btn" data-action="toggle-panel" title="Egenskaper (P)" aria-label="Visa egenskaper" aria-pressed="${ui.panelOpen}">${icons.properties}</button>
          <div class="segmented view-modes" role="group" aria-label="Vy">
            <button data-mode="2d" aria-pressed="true" title="Plan (2)">2D</button>
            <button data-mode="3d" aria-pressed="false" title="3D (3)">3D</button>
            <button data-mode="split" aria-pressed="false" class="hide-narrow" title="Plan och 3D sida vid sida (4)">Båda</button>
          </div>
          <div class="menu-wrap">
            <button class="icon-btn" data-action="menu" aria-label="Arkiv" aria-haspopup="menu" aria-expanded="false">${icons.more}</button>
            <div class="menu" role="menu" hidden>
              <button role="menuitem" data-action="new-project">Nytt projekt…</button>
              <button role="menuitem" data-action="save-file">Spara som fil…</button>
              <button role="menuitem" data-action="open-file">Öppna fil…</button>
              <hr>
              <button role="menuitem" data-action="new-proposal">Nytt förslag</button>
              <button role="menuitem" data-action="show-types">Typer och littera</button>
              <button role="menuitem" data-action="style">Stilmall…</button>
              <button role="menuitem" data-action="settings">Gränssnitt…</button>
              <hr>
              <div class="menu-label">Tema</div>
              ${THEMES.map((t) => `<button role="menuitemradio" data-theme-id="${t.id}" aria-checked="false">${t.name}</button>`).join('')}
              <hr>
              <button role="menuitem" data-action="reset-sample">Börja om med exemplet</button>
            </div>
          </div>
        </div>
      </header>
      <nav class="tools" aria-label="Verktyg"></nav>
      <main class="canvas">
        <div class="viewbar">
          <div class="chips" role="tablist" aria-label="Tillstånd att visa"></div>
          <label class="compare"><input type="checkbox" id="compare-toggle" checked><span data-out="compare-label"></span></label>
          <div class="segmented detail-switch" role="group" aria-label="Detaljnivå">
            <button data-detail="sketch" aria-pressed="false" title="Tidig skiss: öppningar utan karmar">Skiss</button>
            <button data-detail="normal" aria-pressed="true" title="Karmar, glasningslinjer och indrag (bygglov)">Normal</button>
            <button data-detail="detail" aria-pressed="false" title="Dörrblad, falsar och fönsterbågar (bygghandling)">Detalj</button>
          </div>
          <div class="show-wrap">
            <button class="compare show-btn" data-action="show-menu" aria-haspopup="true" aria-expanded="false">Visa ▾</button>
            <div class="show-menu" hidden></div>
          </div>
          <button class="compare view-btn" data-action="open-views" title="Vyer i navigatorn"><span data-out="view-name">Vy</span></button>
        </div>
        <div class="cmd-bar" hidden><button class="btn cmd-cancel" data-action="cancel-command">✕ Avbryt</button></div>
        <div class="tool-options" data-out="tool-options"></div>
        <div class="hint" role="status" hidden></div>
      </main>
      <footer class="status">
        <span class="cursor-pos"><span class="label">X</span><span class="value coord" data-out="x">—</span></span>
        <span class="cursor-pos"><span class="label">Y</span><span class="value coord" data-out="y">—</span></span>
        <span><span class="label">Skärm</span><span class="value" data-out="scale">—</span></span>
        <span class="hide-narrow"><span class="label">Rutnät</span><span class="value" data-out="grid">—</span></span>
        <button class="status-btn" data-action="snap" aria-pressed="true" title="Snäppning av eller på (S)">Snäpp</button>
        <span data-out="save" class="save-status"></span>
        <span class="engine hide-narrow">${ENGINE.name} ${ENGINE.version} · steg ${ENGINE.milestone} av ${ENGINE.milestones}</span>
      </footer>
    </div>`;

  const $ = <T extends Element>(sel: string) => root.querySelector(sel) as T;
  const out = (name: string) => $<HTMLElement>(`[data-out="${name}"]`);
  const appEl = $<HTMLElement>('.app');
  const canvas = $<HTMLElement>('.canvas');
  const hintEl = $<HTMLElement>('.hint');
  const chips = $<HTMLElement>('.chips');
  const compareToggle = $<HTMLInputElement>('#compare-toggle');
  const compareLabel = $<HTMLElement>('.compare');
  const toolOptions = out('tool-options');
  const menu = $<HTMLElement>('.menu');
  $<HTMLElement>('.project').insertAdjacentElement('afterend', createThemeSwitcher());
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
    b.title = t.milestone ? `${t.label} – kommer i steg ${t.milestone}` : `${t.label}${t.key ? ` (${t.key})` : ''}`;
    if (t.milestone) {
      b.setAttribute('aria-disabled', 'true');
      b.addEventListener('click', () => hint(`${t.label} byggs i steg ${t.milestone}.`));
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

  const view = new PlanView(pane2d, {
    onCursor: (p: Vec2 | null) => {
      out('x').textContent = p ? nf.format(p[0]) : '—';
      out('y').textContent = p ? nf.format(p[1]) : '—';
    },
    onViewChange: (cam: Camera) => {
      if (ui.mode !== '3d') measureBox.update((p) => cam.toScreen(p));
      out('scale').textContent = `≈ 1:${formatScale(cam.screenScaleDenominator())}`;
      const step = minorStepFor(cam.scale);
      out('grid').textContent = step >= 1000 ? `${nf.format(step / 1000)} m` : `${nf.format(step)} mm`;
    },
  });

  let plan: PlanResult = { prims: [], pickables: [] };

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
      (c.trace ?? null) !== (v.trace ?? null)
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
    out('view-name').textContent = v ? `${v.name}${viewModified(v) ? ' *' : ''}` : 'Vyer';
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
    snapSegments: (): SnapSegment[] => {
      const vs = viewStates();
      const doc = store.doc;
      // Väggarnas referenslinjer först, sedan väggarnas liv och möblernas kanter.
      const refs = Object.values(doc.elements)
        .filter((e) => e.type === 'Wall' && e.storey === ui.storey && actionOf(e, vs) !== 'absent')
        .map((e) => {
          const p = e.params as unknown as WallParams;
          return { id: e.id, a: p.start, b: p.end };
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
  const tools: Record<ToolId, ViewTool> = {
    select: selectTool,
    wall: wallTool,
    pan: panTool,
    door: doorTool,
    window: windowTool,
    room: roomTool,
    dimension: dimensionTool,
    text: textTool,
  };

  function setTool(id: ToolId): void {
    measureBox.close();
    if (PLAN_TOOLS.includes(id) && ui.mode === '3d') void setMode('2d');
    if (ui.tool === 'wall' && id !== 'wall') wallTool.finish();
    if (ui.tool === 'dimension' && id !== 'dimension') dimensionTool.reset();
    palette.hide();
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

  /** Avbryt: först det pågående kommandot, sedan verktyget. */
  function cancelCommand(): void {
    if (ui.tool === 'wall' && wallTool.drawing) wallTool.finish();
    else if (ui.tool === 'dimension' && dimensionTool.count > 0) dimensionTool.reset();
    else setTool('select');
    view.requestRender();
  }

  function renderToolOptions(): void {
    if (ui.tool === 'wall') {
      const doc = store.doc;
      if (wallTool.options.definition && !doc.definitions[wallTool.options.definition]) wallTool.options.definition = defaultWallType(doc);
      const defs = Object.values(doc.definitions)
        .filter((d) => d.elementType === 'Wall')
        .sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }));
      const opts = defs
        .map((d) => `<option value="${d.id}"${d.id === wallTool.options.definition ? ' selected' : ''}>${escapeHtml(d.name)} · ${nf.format(Number(d.params.thickness))}</option>`)
        .join('');
      const face = wallTool.options.face;
      toolOptions.innerHTML = `
        <label class="opt"><span>Typ</span><select id="wall-def" aria-label="Väggtyp">${opts}</select></label>
        <div class="opt"><span>Referens</span><div class="segmented" role="group" aria-label="Referenslinje">
          <button data-just="outside" aria-pressed="${face === 'outside'}" title="Linjen i väggens utsida">Ute</button>
          <button data-just="center" aria-pressed="${face === 'center'}" title="Linjen mitt i väggen">Mitt</button>
          <button data-just="inside" aria-pressed="${face === 'inside'}" title="Linjen i väggens insida">Inne</button>
        </div></div>
        <label class="opt"><span>Längd</span><span class="input-unit"><input id="wall-length" type="number" inputmode="numeric" placeholder="Längd" ${wallTool.drawing ? '' : 'disabled'}><i>mm</i></span></label>
        <label class="opt"><span>Vinkel</span><span class="input-unit"><input id="wall-angle" type="number" inputmode="decimal" placeholder="Vinkel" value="${wallTool.lockAngle ?? ''}" ${wallTool.drawing ? '' : 'disabled'}><i>°</i></span></label>
        <button class="btn btn-primary" data-action="wall-done" ${wallTool.drawing ? '' : 'disabled'}>Klar</button>
        <span class="opt-hint">${wallTool.drawing ? 'Klicka nästa punkt, eller skriv en längd och tryck Enter.' : 'Klicka eller tryck där väggen ska börja.'}</span>`;
      toolOptions.hidden = false;
    } else if (ui.tool === 'door' || ui.tool === 'window') {
      const t = ui.tool === 'door' ? doorTool : windowTool;
      const type = ui.tool === 'door' ? 'Door' : 'Window';
      const defs = Object.values(store.doc.definitions)
        .filter((d) => d.elementType === type)
        .sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }));
      if (t.options.definition && !store.doc.definitions[t.options.definition]) t.options.definition = defs[0]?.id ?? null;
      const opts = defs
        .map((d) => `<option value="${d.id}"${d.id === t.options.definition ? ' selected' : ''}>${escapeHtml(d.name)} · ${nf.format(Number(d.params.width))}×${nf.format(Number(d.params.height))}</option>`)
        .join('');
      toolOptions.innerHTML = `
        <label class="opt"><span>Typ</span><select id="opening-def" aria-label="Typ">${opts}</select></label>
        <span class="opt-hint">${ui.tool === 'door' ? 'Peka på en vägg och klicka. Sidan du pekar på blir öppningssidan, gångjärnen hamnar närmast markören.' : 'Peka på en vägg och klicka där fönstret ska sitta.'}</span>`;
      toolOptions.hidden = false;
    } else if (ui.tool === 'room') {
      toolOptions.innerHTML = `
        <label class="opt"><span>Namn</span><input id="room-name" value="${escapeHtml(roomTool.name)}" aria-label="Rumsnamn" style="width:140px"></label>
        <span class="opt-hint">Klicka i ett utrymme som väggarna omsluter. Rummet följer väggarna och numreras automatiskt.</span>`;
      toolOptions.hidden = false;
    } else if (ui.tool === 'dimension') {
      const n = dimensionTool.count;
      toolOptions.innerHTML = `
        <button class="btn btn-primary" data-action="dim-done" ${n >= 2 && !dimensionTool.isPlacing ? '' : 'disabled'}>Klar med punkterna</button>
        <span class="opt-hint">${dimensionTool.isPlacing ? 'Klicka där måttlinjen ska ligga.' : n === 0 ? 'Klicka på första punkten som ska måttsättas.' : 'Klicka nästa punkt. Dubbelklicka eller tryck Klar när kedjan är färdig.'}</span>`;
      toolOptions.hidden = false;
    } else if (ui.tool === 'text') {
      toolOptions.innerHTML = `
        <label class="opt"><span>Text</span><input id="text-value" value="${escapeHtml(textTool.text)}" aria-label="Text" style="width:180px"></label>
        <span class="opt-hint">Klicka där texten ska stå.</span>`;
      toolOptions.hidden = false;
    } else {
      toolOptions.innerHTML = '';
      toolOptions.hidden = true;
    }
    appEl.dataset.tool = ui.tool;
    // Avbryt ligger ovanför verktygsraden när ett ritverktyg är aktivt.
    const bar = $<HTMLElement>('.cmd-bar');
    bar.hidden = ui.tool === 'select' || ui.tool === 'pan';
    requestAnimationFrame(() => {
      bar.style.bottom = `${(toolOptions.hidden ? 0 : toolOptions.offsetHeight + 8) + 14}px`;
    });
  }

  toolOptions.addEventListener('change', (e) => {
    const t = e.target as HTMLSelectElement;
    if (t.id === 'wall-def') wallTool.options.definition = t.value;
    if (t.id === 'opening-def') (ui.tool === 'door' ? doorTool : windowTool).options.definition = t.value;
  });
  toolOptions.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === 'room-name') roomTool.name = t.value || 'Rum';
    if (t.id === 'text-value') textTool.text = t.value;
    if (t.id === 'wall-angle') {
      const v = parseFloat(t.value.replace(',', '.'));
      wallTool.lockAngle = Number.isFinite(v) ? v : null;
      view.requestRender();
    }
  });
  toolOptions.addEventListener('keydown', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === 'wall-angle' && e.key === 'Enter') {
      e.preventDefault();
      ($<HTMLInputElement>('#wall-length') as HTMLInputElement | null)?.focus();
      return;
    }
    if (t.id === 'wall-length' && e.key === 'Enter') {
      e.preventDefault();
      if (t.value === '') wallTool.finish();
      else if (!wallTool.placeLength(Number(t.value))) hint('Peka först åt det håll väggen ska gå.');
      t.value = '';
      view.requestRender();
    }
    if (e.key === 'Escape') {
      wallTool.finish();
      t.blur();
    }
  });
  toolOptions.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!b) return;
    if (b.dataset.just) {
      wallTool.options.face = b.dataset.just as WallFace;
      renderToolOptions();
    }
    if (b.dataset.action === 'wall-done') wallTool.finish();
    if (b.dataset.action === 'dim-done') dimensionTool.donePoints();
  });

  // ---------- Panel och dialog ----------
  const panel = new PropertiesPanel(store, selection, viewStates);
  setupSheetDrag(panel.el, {
    narrow: isNarrow,
    state: () => ui.sheet,
    set: (open, sheet) => setPanel(open, sheet),
  });
  panel.el.querySelector('.panel-close')!.innerHTML = icons.close;
  panel.el.querySelector('.pane-min')!.innerHTML = icons.chevron;

  // Navigatorn och egenskaperna delar högerspalten på datorn.
  const navigator = new Navigator({
    doc: () => store.doc,
    storey: () => ui.storey,
    activeView: () => ui.activeView,
    viewModified: (v) => viewModified(v),
    describeView,
  });
  const dock = document.createElement('div');
  dock.className = 'dock';
  dock.append(navigator.el, panel.el);
  appEl.appendChild(dock);
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

  // Gränssnittet: rutnät, färger och snabbknappar. Hör till användaren, inte projektet.
  const uiSettings = loadUiSettings();
  applyUiColors(uiSettings);
  view.showGrid = uiSettings.grid;
  panel.quickFor = (type) => uiSettings.quick[type] ?? [];
  panel.onCopied = (ids, center) => {
    measureBox.showMove(ids, [0, 0], center);
    positionMeasureBox();
    hint('Kopian ligger ovanpå originalet. Dra den dit den ska, eller skriv avstånd och vinkel.', 4000);
  };
  const settingsDialog = new SettingsDialog(uiSettings, (s) => {
    Object.assign(uiSettings, s);
    view.showGrid = s.grid;
    renderAll();
    view.requestRender();
    view3d?.refreshColors();
    panel.render();
  });
  root.appendChild(settingsDialog.el);

  // Snabbmenyn vid markören, på dator.
  const palette = new PetPalette(canvas, panel);
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
      if (!down || palette.el.contains(e.target as Node)) return;
      const click = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5;
      if (!click || e.pointerType !== 'mouse' || !uiSettings.petPalette || isNarrow() || ui.tool !== 'select') return;
      // Efter att verktyget eller 3D-vyn hunnit ändra markeringen.
      setTimeout(() => {
        if (selection.size > 0) palette.show(e.clientX, e.clientY);
      }, 0);
    },
    { capture: true },
  );

  const newProjectDialog = new NewProjectDialog((doc) => {
    ui.state = defaultState(doc);
    store.load(doc);
    hint(`${doc.project.name} är skapat. Rita väggar med W eller verktyget Vägg.`, 4000);
  });
  root.appendChild(newProjectDialog.el);

  // Tillfälliga mått när en vägg är markerad.
  const tempDims = new TempDims(canvas, store);
  tempDims.requestRender = () => view.requestRender();
  view.setHighlighter(
    (cam) =>
      renderHighlight(cam, store.doc, plan.pickables, new Set(selection.list()), ui.tool === 'select' ? selectTool.hoverId : null) +
      tempDims.render(cam, selection.list(), viewStates(), ui.tool === 'select' && ui.mode !== '3d'),
  );

  // ---------- Rendering ----------
  function renderAll(): void {
    const doc = store.doc;
    if (!doc.states.some((s) => s.id === ui.state)) ui.state = defaultState(doc);
    if (!doc.storeys.some((s) => s.id === ui.storey)) ui.storey = doc.storeys[0].id;
    const vs = viewStates();

    out('project').textContent = doc.project.name;
    out('storey').textContent = doc.storeys.find((s) => s.id === ui.storey)?.name ?? '';

    chips.innerHTML =
      doc.states
        .map((s) => `<button role="tab" class="chip" data-state="${s.id}" aria-selected="${s.id === ui.state}">${escapeHtml(s.name)}</button>`)
        .join('') + `<button class="chip chip-add" data-action="new-proposal" aria-label="Nytt förslag" title="Nytt förslag">${icons.plus}</button>`;

    const ex = existingState(doc);
    compareLabel.hidden = !ex || ex.id === ui.state;
    if (ex) out('compare-label').textContent = `Jämför med ${ex.name}`;
    compareToggle.checked = ui.compare;

    plan = buildPlan(doc, ui.storey, vs, styleFor(ui.styleName));
    // Spårad vy: en annan vy tonad under, t.ex. möbleringen under en undertaksplan.
    const traced = ui.trace ? doc.views.find((v) => v.id === ui.trace) : undefined;
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
      moveElements(store, ids, [d[0], d[1]]);
      host.elementsMoved?.(ids, d, anchor);
    },
  };

  function update3d(): void {
    if (!view3d || ui.mode === '2d') return;
    view3d.setSolids(buildModel3d(store.doc, ui.storey, viewStates()));
    view3d.setSelection(selection.list());
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
      ui.trace = null;
      ui.styleName = null;
      selection.clear();
      view.zoomToFit();
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

  startAutosave(store, (s: SaveStatus) => {
    const el = out('save');
    el.dataset.kind = s.kind;
    el.textContent = s.kind === 'saved' ? `Sparat ${tf.format(s.at)}` : s.kind === 'pending' ? 'Sparar…' : 'Sparas inte i den här webbläsaren';
  });
  if (saved) out('save').textContent = `Sparat ${tf.format(new Date(saved.savedAt))}`;

  // För felsökning i webbläsarens konsol.
  (window as unknown as { bacchus: unknown }).bacchus = { store, view, selection, ui, get view3d() { return view3d; } };

  appEl.dataset.mode = ui.mode;
  appEl.dataset.sheet = ui.sheet;
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
    ui.panelOpen = open;
    ui.sheet = sheet;
    appEl.dataset.sheet = sheet;
    appEl.classList.toggle('panel-open', open);
    $<HTMLElement>('.topbar [data-action="toggle-panel"]').setAttribute('aria-pressed', String(open));
  }

  function setNav(open: boolean): void {
    ui.navOpen = open;
    appEl.classList.toggle('nav-open', open);
    $<HTMLElement>('.topbar [data-action="toggle-nav"]').setAttribute('aria-pressed', String(open));
    if (open) navigator.render();
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
    const storeyPick = target.closest<HTMLElement>('[data-storey-pick]');
    if (storeyPick) {
      ui.storey = storeyPick.dataset.storeyPick!;
      if (isNarrow()) setNav(false);
      renderAll();
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
    const viewEdit = target.closest<HTMLElement>('[data-view-rename], [data-view-delete]');
    if (viewEdit) {
      const id = viewEdit.dataset.viewRename ?? viewEdit.dataset.viewDelete!;
      const v = store.doc.views.find((x) => x.id === id);
      closeShowMenu();
      if (!v) return;
      if (viewEdit.dataset.viewRename) {
        const name = window.prompt('Nytt namn på vyn', v.name)?.trim();
        if (name) store.transact(`Byt namn på vyn till ${name}`, (tx) => tx.setViews(tx.doc.views.map((x) => (x.id === id ? { ...x, name } : x))));
      } else if (window.confirm(`Ta bort vyn ${v.name}?`)) {
        if (ui.activeView === id) ui.activeView = null;
        store.transact(`Ta bort vyn ${v.name}`, (tx) => tx.setViews(tx.doc.views.filter((x) => x.id !== id)));
      }
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
      case 'fit':
        if (ui.mode !== '3d') view.zoomToFit();
        if (ui.mode !== '2d') view3d?.frameAll();
        break;
      case 'grid':
        toggleGrid();
        break;
      case 'toggle-panel':
        // På mobilen: nere → uppe → nere (om något är markerat) eller stängd.
        if (isNarrow() && ui.panelOpen) {
          if (ui.sheet === 'peek') setPanel(true, 'full');
          else if (selection.size > 0) setPanel(true, 'peek');
          else setPanel(false);
        } else setPanel(!ui.panelOpen, 'full');
        break;
      case 'menu':
        menu.hidden = !menu.hidden;
        menuBtn.setAttribute('aria-expanded', String(!menu.hidden));
        break;
      case 'show-types':
        closeMenu();
        setPanel(true, 'full');
        panel.showTab('types');
        break;
      case 'style':
        closeMenu();
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
            `<label class="field"><span>Stilmall i vyn</span><select data-show-style><option value="">Projektets (${escapeHtml(store.doc.graphics.name)})</option>${PRESETS.map((p) => `<option value="${escapeHtml(p.name)}"${ui.styleName === p.name ? ' selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}</select></label>` +
            `<label class="field"><span>Spåra en annan vy under</span><select data-show-trace><option value="">Ingen</option>${store.doc.views
              .filter((v) => v.id !== ui.activeView)
              .map((v) => `<option value="${v.id}"${ui.trace === v.id ? ' selected' : ''}>${escapeHtml(v.name)}</option>`)
              .join('')}</select></label>`;
          m.hidden = false;
          $<HTMLElement>('.show-btn').setAttribute('aria-expanded', 'true');
        }
        break;
      }
      case 'toggle-nav':
        setNav(!ui.navOpen);
        break;
      case 'open-views':
        navigator.showTab('vyer');
        setNav(true);
        break;
      case 'view-save-new': {
        closeShowMenu();
        const st = store.doc.states.find((x) => x.id === ui.state)?.name ?? '';
        const storeyName = store.doc.storeys.find((x) => x.id === ui.storey)?.name ?? '';
        const name = window.prompt('Namn på vyn', `${storeyName} – ${st}`)?.trim();
        if (!name) break;
        const v = currentViewDef(newId('vy'), name);
        store.transact(`Ny vy: ${name}`, (tx) => tx.setViews([...tx.doc.views, v]));
        ui.activeView = v.id;
        renderViewButton();
        break;
      }
      case 'view-update': {
        closeShowMenu();
        const v = store.doc.views.find((x) => x.id === ui.activeView);
        if (v) store.transact(`Spara vyn ${v.name}`, (tx) => tx.setViews(tx.doc.views.map((x) => (x.id === v.id ? currentViewDef(v.id, v.name) : x))));
        break;
      }
      case 'cancel-command':
        cancelCommand();
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
      case 'save-file': {
        closeMenu();
        if (import.meta.env.MODE === 'artifact') {
          hint('Förhandsvisningen kan inte spara filer. Det fungerar i versionen på webbhotellet.', 4000);
          break;
        }
        const r = await saveProjectFile(store.doc, brand.fileExtension);
        if (r === 'saved') hint('Projektet sparades.');
        if (r === 'downloaded') hint('Projektfilen laddades ner.');
        break;
      }
      case 'open-file': {
        closeMenu();
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
        break;
      }
      case 'reset-sample': {
        closeMenu();
        const doc = sampleProject();
        ui.state = defaultState(doc);
        store.load(doc);
        hint('Exemplet är återställt.');
        break;
      }
    }
  });

  // Stilmall och spårning i Visa-menyn.
  root.addEventListener('change', (e) => {
    const t = e.target as HTMLSelectElement;
    if (t.matches('[data-show-style]')) {
      ui.styleName = t.value || null;
      renderAll();
    } else if (t.matches('[data-show-trace]')) {
      ui.trace = t.value || null;
      renderAll();
    }
  });

  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    const typing = (t instanceof HTMLInputElement && t.type !== 'checkbox') || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z' && !typing) {
      e.preventDefault();
      if (e.shiftKey) store.redo();
      else store.undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y' && !typing) {
      e.preventDefault();
      store.redo();
      return;
    }
    if (typing || mod || e.altKey) return;
    if (newProjectDialog.isOpen) return;
    if (styleDialog.isOpen) {
      if (e.key === 'Escape') styleDialog.close();
      return;
    }
    if (settingsDialog.isOpen) {
      if (e.key === 'Escape') settingsDialog.close();
      return;
    }

    // Siffror medan man ritar väggar går till längdfältet.
    if (ui.tool === 'wall' && wallTool.drawing && /^[0-9]$/.test(e.key)) {
      const input = $<HTMLInputElement>('#wall-length');
      if (input) {
        input.focus();
        input.value = e.key;
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        if (ui.navOpen && isNarrow()) {
          setNav(false);
          break;
        }
        if (ui.tool !== 'select') cancelCommand();
        else selection.clear();
        palette.hide();
        closeMenu();
        break;
      case 'Enter':
        if (ui.tool === 'wall') wallTool.finish();
        if (ui.tool === 'dimension') dimensionTool.donePoints();
        break;
      case 'Delete':
      case 'Backspace':
        if (selection.size) {
          deleteElements(store, selection.list());
          selection.clear();
        }
        break;
      case '2':
        void setMode('2d');
        break;
      case '3':
        void setMode('3d');
        break;
      case '4':
        void setMode('split');
        break;
      case 'v':
      case 'V':
        setTool('select');
        break;
      case 'h':
      case 'H':
        setTool('pan');
        break;
      case 'w':
      case 'W':
        setTool('wall');
        break;
      case 'd':
      case 'D':
        setTool('door');
        break;
      case 'o':
      case 'O':
        setTool('window');
        break;
      case 'r':
      case 'R':
        setTool('room');
        break;
      case 'm':
      case 'M':
        setTool('dimension');
        break;
      case 't':
      case 'T':
        setTool('text');
        break;
      case 'f':
      case 'F':
      case 'Home':
        view.zoomToFit();
        break;
      case 'g':
      case 'G':
        toggleGrid();
        break;
      case 's':
      case 'S':
        $<HTMLElement>('[data-action="snap"]').click();
        break;
      case 'p':
      case 'P':
        setPanel(!ui.panelOpen);
        break;
      case 'n':
      case 'N':
        setNav(!ui.navOpen);
        break;
      case '+':
      case '=':
        view.zoomBy(1.4);
        break;
      case '-':
        view.zoomBy(1 / 1.4);
        break;
      default:
        return;
    }
    e.preventDefault();
  });

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

/** Ett förslag visas först om det finns, annars det första tillståndet. */
/** Kort beskrivning av en vy i vylistan. */
function describeView(v: ViewDef): string {
  const detail = { sketch: 'Skiss', normal: 'Normal', detail: 'Detalj' }[v.detail];
  return [detail, v.compare ? 'jämför' : '', v.hideDemolished ? 'utan rivet' : '', v.style ?? ''].filter(Boolean).join(' · ');
}

function defaultState(doc: ProjectDoc): Id {
  return (doc.states.find((s) => s.kind === 'proposal') ?? doc.states[0]).id;
}

/** Förvald väggtyp i verktyget: en innervägg om det finns, annars den första typen. */
/** Första typen (i littera-ordning) för en elementtyp. */
function firstDefinition(doc: ProjectDoc, type: string): Id | null {
  const defs = Object.values(doc.definitions)
    .filter((d) => d.elementType === type)
    .sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }));
  return defs[0]?.id ?? null;
}

function defaultWallType(doc: ProjectDoc): Id | null {
  const defs = Object.values(doc.definitions).filter((d) => d.elementType === 'Wall');
  return (defs.find((d) => d.name.startsWith('IV')) ?? defs[0])?.id ?? null;
}

function nextProposalName(doc: ProjectDoc): string {
  const used = new Set(doc.states.map((s) => s.name));
  for (let i = 0; i < 26; i++) {
    const name = `Förslag ${String.fromCharCode(65 + i)}`;
    if (!used.has(name)) return name;
  }
  return `Förslag ${doc.states.length + 1}`;
}

/** Avrunda skalan till två värdesiffror: 1:87, 1:120, 1:4 300. */
function formatScale(n: number): string {
  if (n < 1) return (Math.round(n * 10) / 10).toLocaleString('sv-SE');
  const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1));
  return nf.format(Math.round(n / p) * p);
}
