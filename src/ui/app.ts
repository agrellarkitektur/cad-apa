import type { Brand } from '../brand';
import { createProposal, deleteElements, moveElements, moveWallEnd, renameElement, setInState, updateParams } from '../core/commands';
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
import { buildSection } from '../repr/section';
import { markerFrame, markerName, modelBounds } from '../elements/markers';
import { MarkerTool, RoofTool } from './tools/markerTools';
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
import { askConfirm, askText } from './ask';
import { ContextMenu, onLongPress, type MenuItem } from './contextMenu';
import { pickAt } from '../view2d/pick';
import { releasedHint } from './tools/selectTool';
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
import { applyUiColors, loadUiSettings, mmPerCssPx, PANE_WIDTH, parseScale, saveUiSettings, type PaneMode } from './uiSettings';
import { clampWidth, setupPaneResize } from './paneResize';
import { InlineTextEditor } from './textEditor';
import { Camera } from '../view2d/camera';
import { applyTheme, createThemeSwitcher, currentTheme, onThemeChange, THEMES, type ThemeId } from './theme';
import type { ToolHost } from './tools/host';
import { SelectTool } from './tools/selectTool';
import { isSnapEnabled, setSnapEnabled, type SnapSegment } from './tools/snap';
import { DimensionTool, TextTool } from './tools/annotationTools';
import { OpeningTool } from './tools/openingTool';
import { RoomTool } from './tools/roomTool';
import { WallTool } from './tools/wallTool';

type ToolId = 'pan' | 'select' | 'wall' | 'door' | 'window' | 'roof' | 'room' | 'dimension' | 'text' | 'section' | 'elevation';

/** Verktyg som ritar i planen och därför byter till planvyn. */
const PLAN_TOOLS: ToolId[] = ['wall', 'door', 'window', 'roof', 'room', 'dimension', 'text', 'section', 'elevation'];
type ViewMode = '2d' | '3d' | 'split';

interface ToolDef {
  id: string;
  label: string;
  icon: IconName;
  key?: string;
  /** Versionen där verktyget byggs (se docs/PLAN.md). Saknas för verktyg som redan fungerar. */
  comesIn?: string;
  group: 'navigera' | 'rita' | 'annotera';
}

const TOOLS: ToolDef[] = [
  { id: 'select', label: 'Markera', icon: 'select', key: 'V', group: 'navigera' },
  { id: 'pan', label: 'Panorera', icon: 'pan', key: 'H', group: 'navigera' },
  { id: 'wall', label: 'Vägg', icon: 'wall', key: 'W', group: 'rita' },
  { id: 'door', label: 'Dörr', icon: 'door', key: 'D', group: 'rita' },
  { id: 'window', label: 'Fönster', icon: 'window', key: 'O', group: 'rita' },
  { id: 'roof', label: 'Tak', icon: 'roof', group: 'rita' },
  { id: 'furniture', label: 'Möbel', icon: 'furniture', comesIn: '0.11', group: 'rita' },
  { id: 'room', label: 'Rum', icon: 'room', key: 'R', group: 'annotera' },
  { id: 'dimension', label: 'Mått', icon: 'dimension', key: 'M', group: 'annotera' },
  { id: 'text', label: 'Text', icon: 'text', key: 'T', group: 'annotera' },
  { id: 'section', label: 'Sektion', icon: 'section', group: 'annotera' },
  { id: 'elevation', label: 'Fasad', icon: 'elevation', group: 'annotera' },
];

const GROUP_LABEL: Record<ToolDef['group'], string> = { navigera: 'Visa', rita: 'Rita', annotera: 'Annotera' };

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
const tf = new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit' });

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
  const ui = {
    storey: initial.storeys[0].id,
    state: defaultState(initial),
    compare: true,
    panelOpen: desktop && uiSettings.panelMode === 'open',
    /** Projektträdet: som det lämnades på datorn, stängt på telefonen. */
    navOpen: desktop && uiSettings.navMode === 'open',
    /** På mobilen: bladet nere med bara snabbraden, eller uppdraget. */
    sheet: 'peek' as 'peek' | 'full',
    tool: 'select' as ToolId,
    mode: '2d' as ViewMode,
    detail: 'normal' as 'sketch' | 'normal' | 'detail',
    /** Det som döljs i vyn (elementtyper och "littera"), och om rivet visas. */
    hide: [] as string[],
    hideDemolished: false,
    /** Vyn man utgick från, och vyns stilmall och kalkerade vy. */
    activeView: null as Id | null,
    styleName: null as string | null,
    trace: null as Id | null,
    /** En fasad eller sektion som visas i stället för planen (0.7). */
    marker: null as Id | null,
  };

  root.innerHTML = `
    <div class="app">
      <header class="topbar">
        <div class="menu-wrap main-menu-wrap">
          <button class="brand-btn" data-action="menu" aria-haspopup="menu" aria-expanded="false" title="Meny: spara, öppna, inställningar">
            <svg class="brand-logo" viewBox="0 0 24 24" aria-hidden="true">${brand.logoSvg}</svg>
            <span class="brand-name">${brand.name}</span>
            <span class="brand-chev" aria-hidden="true">${icons.expand}</span>
          </button>
          <div class="menu main-menu" role="menu" hidden>
            <button role="menuitem" data-action="new-project">${icons.newFile}<span>Nytt projekt…</span><kbd>Ctrl+Alt+N</kbd></button>
            <button role="menuitem" data-action="open-file">${icons.openFile}<span>Öppna fil…</span><kbd>Ctrl+O</kbd></button>
            <button role="menuitem" data-action="save">${icons.save}<span>Spara</span><kbd>Ctrl+S</kbd></button>
            <button role="menuitem" data-action="save-as">${icons.save}<span>Spara som…</span><kbd>Ctrl+Shift+S</kbd></button>
            <hr>
            <button role="menuitem" aria-disabled="true" title="Kommer i 0.8">${icons.newFile}<span>Skriv ut och exportera PDF</span><small>0.8</small></button>
            <button role="menuitem" aria-disabled="true" title="Kommer i 0.8">${icons.openFile}<span>Importera underlag</span><small>0.8</small></button>
            <hr>
            <button role="menuitem" data-action="new-proposal">${icons.states}<span>Nytt förslag</span></button>
            <button role="menuitem" data-action="show-types">${icons.wall}<span>Typer och littera</span></button>
            <button role="menuitem" data-action="style">${icons.dimension}<span>Stilmall…</span></button>
            <button role="menuitem" data-action="settings">${icons.properties}<span>Gränssnitt…</span></button>
            <div class="narrow-only menu-themes">
              <hr>
              <div class="menu-label">Tema</div>
              ${THEMES.map((t) => `<button role="menuitemradio" data-theme-id="${t.id}" aria-checked="false"><span>${t.name}</span></button>`).join('')}
            </div>
            <hr>
            <button role="menuitem" data-action="reset-sample">${icons.restore}<span>Börja om med exemplet</span></button>
            <button role="menuitem" data-action="about">${icons.select}<span>Om ${brand.name}</span><small>${ENGINE.name} ${ENGINE.version}</small></button>
          </div>
        </div>
        <span class="sep hide-narrow"></span>
        <div class="file-btns hide-narrow">
          <button class="icon-btn" data-action="new-project" title="Nytt projekt (Ctrl+Alt+N)" aria-label="Nytt projekt">${icons.newFile}</button>
          <button class="icon-btn" data-action="open-file" title="Öppna fil (Ctrl+O)" aria-label="Öppna fil">${icons.openFile}</button>
          <button class="icon-btn" data-action="save" title="Spara (Ctrl+S)" aria-label="Spara">${icons.save}</button>
        </div>
        <span class="sep hide-narrow"></span>
        <button class="icon-btn" data-action="undo" aria-label="Ångra" disabled>${icons.undo}</button>
        <button class="icon-btn" data-action="redo" aria-label="Gör om" disabled>${icons.redo}</button>
        <span class="sep hide-narrow"></span>
        <div class="project"><strong data-out="project"></strong><span data-out="storey"></span></div>
        <div class="spacer"></div>
        <div class="segmented view-modes" role="group" aria-label="Vy">
          <button data-mode="2d" aria-pressed="true" title="Plan (2)">2D</button>
          <button data-mode="3d" aria-pressed="false" title="3D (3)">3D</button>
          <button data-mode="split" aria-pressed="false" class="hide-narrow" title="Plan och 3D sida vid sida (4)">Båda</button>
        </div>
        <span class="sep hide-narrow"></span>
        <button class="icon-btn pane-btn" data-action="toggle-nav" title="Projektträd: underlag, modell, vyer och ritningar (N)" aria-label="Projektträd" aria-pressed="false">${icons.navigator}</button>
        <button class="icon-btn pane-btn" data-action="toggle-panel" title="Egenskaper (P)" aria-label="Egenskaper" aria-pressed="false">${icons.properties}</button>
        <div class="theme-slot"></div>
        ${brand.badge ? `<span class="badge">${brand.badge}</span>` : ''}
      </header>
      <nav class="tools" aria-label="Verktyg"></nav>
      <main class="canvas">
        <section class="viewbar" aria-label="Tillfälliga vyinställningar">
          <div class="vb-head"><span title="Ändringar här gäller tills du byter vy. Spara dem i vyn för att behålla dem.">Tillfälliga vyinställningar</span><button class="vb-save" data-action="view-save" hidden>Spara i vyn</button></div>
          <div class="vb-row">
            <button class="vb-ctl view-btn" data-action="views" title="Klick: förra vyn. Håll in eller högerklicka: de senaste vyerna" aria-haspopup="menu"><span class="vb-lbl">Vy</span><span data-out="view-name">Vyer</span></button>
            <div class="vb-ctl chips" role="tablist" aria-label="Tillstånd att visa"></div>
            <label class="vb-ctl compare" id="compare-wrap"><input type="checkbox" id="compare-toggle" checked><span data-out="compare-label"></span></label>
            <div class="vb-ctl segmented detail-switch" role="group" aria-label="Detaljnivå">
              <button data-detail="sketch" aria-pressed="false" title="Tidig skiss: öppningar utan karmar">Skiss</button>
              <button data-detail="normal" aria-pressed="true" title="Karmar, glasningslinjer och indrag (bygglov)">Normal</button>
              <button data-detail="detail" aria-pressed="false" title="Dörrblad, falsar och fönsterbågar (bygghandling)">Detalj</button>
            </div>
            <div class="show-wrap">
              <button class="vb-ctl show-btn" data-action="show-menu" aria-haspopup="true" aria-expanded="false">Visa ▾</button>
              <div class="show-menu" hidden></div>
            </div>
          </div>
        </section>
        <div class="cmd-bar" hidden><button class="btn cmd-cancel" data-action="cancel-command">✕ Avbryt</button></div>
        <div class="tool-options" data-out="tool-options"></div>
        <div class="hint" role="status" hidden></div>
      </main>
      <footer class="status">
        <span class="cursor-pos"><span class="label">X</span><span class="value coord" data-out="x">—</span></span>
        <span class="cursor-pos"><span class="label">Y</span><span class="value coord" data-out="y">—</span></span>
        <span class="scale-wrap"><button class="status-btn scale-btn" data-action="scale-pop" title="Skärmskala: klicka för att ange skala" aria-haspopup="dialog" aria-expanded="false"><span class="label">Skärm</span><span class="value" data-out="scale">—</span></button>
          <form class="scale-pop" hidden>
            <label><span>Skala 1:</span><input name="scale" type="text" inputmode="numeric" enterkeyhint="done" autocomplete="off" list="scale-list" aria-label="Skala, nämnaren"></label>
            <datalist id="scale-list"><option value="20"><option value="50"><option value="100"><option value="200"><option value="400"><option value="500"><option value="1000"></datalist>
            <button class="btn btn-primary" type="submit" aria-label="Använd">✓</button>
            <p class="scale-note" data-out="scale-note"></p>
          </form></span>
        <span class="zoom-btns">
          <button class="status-icon hide-narrow" data-action="zoom-out" title="Zooma ut (−)" aria-label="Zooma ut">${icons.zoomOut}</button>
          <button class="status-icon hide-narrow" data-action="zoom-in" title="Zooma in (+)" aria-label="Zooma in">${icons.zoomIn}</button>
          <button class="status-icon" data-action="fit" title="Zooma till allt (F)" aria-label="Zooma till allt">${icons.fit}</button>
        </span>
        <span class="hide-narrow"><span class="label">Rutnät</span><span class="value" data-out="grid">—</span></span>
        <button class="status-btn" data-action="snap" aria-pressed="true" title="Snäppning av eller på (S)">Snäpp</button>
        <span data-out="save" class="save-status"></span>
        <span class="engine hide-narrow">${ENGINE.name} ${ENGINE.version}</span>
      </footer>
    </div>`;

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
      b.addEventListener('click', () => hint(`${t.label} kommer i ${t.comesIn}, med familjerna.`));
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
  };

  function setTool(id: ToolId): void {
    measureBox.close();
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
        <label class="opt"><span>Längd</span><span class="input-unit"><input id="wall-length" type="text" data-expr inputmode="decimal" autocomplete="off" placeholder="Längd" ${wallTool.drawing ? '' : 'disabled'}><i>mm</i></span></label>
        <label class="opt"><span>Vinkel</span><span class="input-unit"><input id="wall-angle" type="text" data-expr data-unit="deg" inputmode="decimal" autocomplete="off" placeholder="Vinkel" value="${wallTool.lockAngle ?? ''}" ${wallTool.drawing ? '' : 'disabled'}><i>°</i></span></label>
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
    } else if (ui.tool === 'roof') {
      const o = roofTool.options;
      toolOptions.innerHTML = `
        <div class="opt"><span>Typ</span><div class="segmented" role="group" aria-label="Taktyp">
          <button data-roof-kind="gable" aria-pressed="${o.kind === 'gable'}">Sadeltak</button>
          <button data-roof-kind="shed" aria-pressed="${o.kind === 'shed'}">Pulpettak</button>
        </div></div>
        <label class="opt"><span>Lutning</span><span class="input-unit"><input id="roof-slope" type="text" data-expr data-unit="deg" inputmode="decimal" autocomplete="off" value="${o.slope}"><i>°</i></span></label>
        <label class="opt"><span>Takfot</span><span class="input-unit"><input id="roof-eave" type="text" data-expr inputmode="decimal" autocomplete="off" value="${o.eave}" title="Takets undersida vid takfoten, över golvet"><i>mm</i></span></label>
        <button class="btn" data-action="roof-house" title="Ett tak över alla väggar med 500 mm utsprång, som möter väggarnas överkant">Över hela huset</button>
        <span class="opt-hint">${roofTool.started ? 'Klicka det motsatta hörnet.' : 'Klicka ett hörn av taket, med utsprånget.'}</span>`;
      toolOptions.hidden = false;
    } else if (ui.tool === 'section' || ui.tool === 'elevation') {
      const t = ui.tool === 'section' ? sectionTool : elevationTool;
      const what = ui.tool === 'section' ? 'sektionslinjen' : 'fasadlinjen';
      toolOptions.innerHTML = `<span class="opt-hint">${
        t.step === 0 ? `Klicka där ${what} börjar.` : t.step === 1 ? `Klicka där ${what} slutar.` : 'Klicka på den sida som ska synas.'
      }</span>`;
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
    const num = Number(t.value);
    if (t.id === 'roof-slope' && Number.isFinite(num)) roofTool.options.slope = Math.max(0, Math.min(75, num));
    if (t.id === 'roof-eave' && Number.isFinite(num)) roofTool.options.eave = Math.round(num);
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
    if (b.dataset.roofKind) {
      roofTool.options.kind = b.dataset.roofKind as 'gable' | 'shed';
      renderToolOptions();
    }
    if (b.dataset.action === 'roof-house') roofOverHouse();
    if (b.dataset.action === 'dim-done') dimensionTool.donePoints();
  });

  // ---------- Panel och dialog ----------
  const panel = new PropertiesPanel(store, selection, viewStates);
  panel.onOpenMarker = (id) => goTo({ kind: 'marker', id });
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

  // Tillfälliga mått när en vägg är markerad.
  const tempDims = new TempDims(canvas, store);
  tempDims.requestRender = () => view.requestRender();
  tempDims.onReleased = (n) => hint(releasedHint(n), 4000);
  view.setHighlighter(
    (cam) =>
      renderHighlight(cam, store.doc, plan.pickables, new Set(selection.list()), ui.tool === 'select' ? selectTool.hoverId : null, !ui.marker) +
      tempDims.render(cam, selection.list(), viewStates(), ui.tool === 'select' && ui.mode !== '3d' && !ui.marker && !modifyPalette.running),
  );

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
            `<label class="field"><span>Kalkera en annan vy</span><select data-show-trace><option value="">Ingen</option>${store.doc.views
              .filter((v) => v.id !== ui.activeView)
              .map((v) => `<option value="${v.id}"${ui.trace === v.id ? ' selected' : ''}>${escapeHtml(v.name)}</option>`)
              .join('')}</select></label>` +
            traceLookMarkup();
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

  // ---------- Vyer: historik, högerklick och kalkering ----------

  /** Ett ställe man varit på: en sparad vy eller ett våningsplan i modellen. */
  type Place = { kind: 'view'; id: Id } | { kind: 'storey'; id: Id } | { kind: 'marker'; id: Id };
  /** Senaste först. Det första är där man är nu. */
  const viewHistory: Place[] = [{ kind: 'storey', id: ui.storey }];
  const samePlace = (a: Place, b: Place) => a.kind === b.kind && a.id === b.id;

  function visit(p: Place): void {
    const i = viewHistory.findIndex((q) => samePlace(q, p));
    if (i >= 0) viewHistory.splice(i, 1);
    viewHistory.unshift(p);
    viewHistory.length = Math.min(viewHistory.length, 6);
  }

  function placeLabel(p: Place): { name: string; sub: string } | null {
    if (p.kind === 'view') {
      const v = store.doc.views.find((x) => x.id === p.id);
      return v ? { name: v.name, sub: `Vy · ${describeView(v)}` } : null;
    }
    if (p.kind === 'marker') {
      const el = store.doc.elements[p.id];
      return el ? { name: markerName(store.doc, el), sub: el.type === 'Section' ? 'Sektion' : 'Fasad' } : null;
    }
    const s = store.doc.storeys.find((x) => x.id === p.id);
    return s ? { name: s.name, sub: 'Modell' } : null;
  }

  function goTo(p: Place): void {
    if (p.kind === 'view') {
      const v = store.doc.views.find((x) => x.id === p.id);
      if (v) applyView(v);
    } else if (p.kind === 'marker') {
      const el = store.doc.elements[p.id];
      if (!el) return;
      const was = ui.marker;
      ui.marker = p.id;
      ui.storey = el.storey;
      ui.activeView = null;
      if (ui.tool !== 'select' && ui.tool !== 'pan') setTool('select');
      measureBox.close();
      palette.hide();
      selection.clear();
      visit(p);
      if (ui.mode === '3d') void setMode('2d');
      renderAll();
      if (was !== p.id) view.zoomToFit();
    } else if (store.doc.storeys.some((s) => s.id === p.id)) {
      const was = ui.marker;
      ui.storey = p.id;
      ui.marker = null;
      ui.activeView = null;
      visit(p);
      renderAll();
      if (was) {
        selection.clear();
        view.zoomToFit();
      }
    }
  }

  /** Högerklick eller ⋯ på en fasad eller sektion. */
  function openMarkerMenu(id: Id, x: number, y: number): void {
    const el = store.doc.elements[id];
    if (!el) return;
    const p = el.params as { auto?: boolean; side?: number };
    const name = markerName(store.doc, el);
    ctxMenu.open(
      x,
      y,
      [
        { kind: 'header', label: name, sub: el.type === 'Section' ? 'Sektion' : 'Fasad' },
        { label: 'Visa', disabled: ui.marker === id, run: () => goTo({ kind: 'marker', id }) },
        {
          label: 'Visa linjen i planen',
          run: () => {
            goTo({ kind: 'storey', id: el.storey });
            selection.set([id]);
          },
        },
        { label: 'Byt namn…', run: () => void renameMarker(id) },
        {
          label: 'Placeras automatiskt',
          checked: !!p.auto,
          sub: el.type === 'Section' ? 'Genom mitten av huset' : 'Utanför huset, följer det',
          run: () => setMarkerAuto(id, !p.auto),
        },
        { label: 'Vänd blickriktningen', disabled: !!p.auto, run: () => updateParams(store, [id], { side: -(p.side ?? 1) }, 'Vänd blickriktningen') },
        { kind: 'sep' },
        { label: 'Ta bort…', danger: true, run: () => void deleteMarker(id) },
      ],
      name,
    );
  }

  async function renameMarker(id: Id): Promise<void> {
    const el = store.doc.elements[id];
    if (!el) return;
    const name = await askText('Byt namn', markerName(store.doc, el));
    if (name === null) return;
    renameElement(store, id, name);
  }

  /** Slå på eller av automatisk placering. Av: linjen stannar där den är nu. */
  function setMarkerAuto(id: Id, auto: boolean): void {
    const el = store.doc.elements[id];
    if (!el) return;
    if (auto) {
      updateParams(store, [id], { auto: true }, 'Placera automatiskt');
      return;
    }
    const f = markerFrame(store.doc, el);
    const r2 = (q: Vec2): [number, number] => [Math.round(q[0]), Math.round(q[1])];
    updateParams(store, [id], { auto: false, start: r2(f.start), end: r2(f.end), side: 1 }, 'Placera själv');
  }

  async function deleteMarker(id: Id): Promise<void> {
    const el = store.doc.elements[id];
    if (!el) return;
    const name = markerName(store.doc, el);
    if (!(await askConfirm(`Ta bort ${name}?`, 'Linjen tas bort ur planen och vyn ur projektträdet. Det går att ångra.'))) return;
    if (ui.marker === id) goTo({ kind: 'storey', id: el.storey });
    deleteElements(store, [id]);
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
    items.push({ kind: 'sep' }, { label: 'Alla vyer i projektträdet', run: () => (navigator.showTab('vyer'), setNav(true)) });
    if (!ui.activeView) items.push({ label: 'Spara det som visas som vy…', run: () => void saveViewAsNew() });
    ctxMenu.open(x, y, items, 'Senaste vyerna');
  }

  /** Högerklick eller ⋯ på en vy i projektträdet. */
  function openViewMenu(id: Id, x: number, y: number): void {
    const v = store.doc.views.find((q) => q.id === id);
    if (!v) return;
    const traced = ui.trace === id;
    ctxMenu.open(
      x,
      y,
      [
        { kind: 'header', label: v.name, sub: describeView(v) },
        { label: 'Visa vyn', run: () => applyView(v), disabled: ui.activeView === id && !viewModified(v) },
        { label: traced ? 'Sluta kalkera vyn' : 'Kalkera den här vyn', checked: traced, disabled: ui.activeView === id, run: () => setTrace(traced ? null : id) },
        ...(ui.activeView === id ? [{ label: 'Spara nuvarande inställningar i vyn', disabled: !viewModified(v), run: () => void updateActiveView() }] : []),
        { label: 'Byt namn…', run: () => void renameView(id) },
        { label: 'Duplicera', run: () => duplicateView(id) },
        { kind: 'sep' },
        { label: 'Ta bort…', danger: true, run: () => void deleteView(id) },
      ],
      v.name,
    );
  }

  async function saveViewAsNew(): Promise<void> {
    closeShowMenu();
    const st = store.doc.states.find((x) => x.id === ui.state)?.name ?? '';
    const storeyName = store.doc.storeys.find((x) => x.id === ui.storey)?.name ?? '';
    const name = await askText('Spara som vy', `${storeyName} – ${st}`);
    if (!name) return;
    const v = currentViewDef(newId('vy'), name);
    store.transact(`Ny vy: ${name}`, (tx) => tx.setViews([...tx.doc.views, v]));
    ui.activeView = v.id;
    visit({ kind: 'view', id: v.id });
    renderAll();
  }

  async function updateActiveView(): Promise<void> {
    closeShowMenu();
    const v = store.doc.views.find((x) => x.id === ui.activeView);
    if (v) store.transact(`Spara vyn ${v.name}`, (tx) => tx.setViews(tx.doc.views.map((x) => (x.id === v.id ? currentViewDef(v.id, v.name) : x))));
  }

  async function renameView(id: Id): Promise<void> {
    const v = store.doc.views.find((x) => x.id === id);
    if (!v) return;
    const name = await askText('Byt namn på vyn', v.name);
    if (name && name !== v.name) store.transact(`Byt namn på vyn till ${name}`, (tx) => tx.setViews(tx.doc.views.map((x) => (x.id === id ? { ...x, name } : x))));
  }

  function duplicateView(id: Id): void {
    const v = store.doc.views.find((x) => x.id === id);
    if (!v) return;
    const copy = { ...structuredClone(v), id: newId('vy'), name: `${v.name} (kopia)` };
    store.transact(`Duplicera vyn ${v.name}`, (tx) => tx.setViews([...tx.doc.views, copy]));
  }

  async function deleteView(id: Id): Promise<void> {
    const v = store.doc.views.find((x) => x.id === id);
    if (!v || !(await askConfirm('Ta bort vyn?', `${v.name} tas bort. Det går att ångra.`))) return;
    if (ui.activeView === id) ui.activeView = null;
    if (ui.trace === id) ui.trace = null;
    store.transact(`Ta bort vyn ${v.name}`, (tx) => tx.setViews(tx.doc.views.filter((x) => x.id !== id)));
  }

  function setTrace(id: Id | null): void {
    ui.trace = id;
    renderAll();
    if (id) hint('Vyn kalkeras. Utseendet ställs in under Visa.');
  }

  /** Hur den kalkerade vyn ritas, under Visa. Gäller för användaren, i alla projekt. */
  function traceLookMarkup(): string {
    if (!ui.trace) return '';
    const t = uiSettings.trace;
    return `<div class="trace-look">
      <div class="segmented wide" role="group" aria-label="Kalkeringens läge">
        <button data-trace-above="0" aria-pressed="${!t.above}">Under</button>
        <button data-trace-above="1" aria-pressed="${t.above}">Över</button>
      </div>
      <label class="check"><input type="checkbox" data-trace-own${t.color ? '' : ' checked'}> Ritningens färger</label>
      <label class="field inline"><span>Färg</span><input type="color" data-trace-color value="${t.color ?? '#c2372c'}"${t.color ? '' : ' disabled'}></label>
      <label class="field"><span>Opacitet <b data-out="trace-opacity">${Math.round(t.opacity * 100)} %</b></span><input type="range" min="5" max="100" step="5" data-trace-opacity value="${Math.round(t.opacity * 100)}"></label>
    </div>`;
  }

  function applyTraceLook(): void {
    view.setUnderlayLook(uiSettings.trace);
  }

  // ---------- Skärmskalan ----------
  // Klick på skalan i statusraden: skriv in en skala, t.ex. 100 eller 1:50.
  const scalePop = $<HTMLFormElement>('.scale-pop');
  const scaleBtn = $<HTMLButtonElement>('.scale-btn');
  function openScalePop(): void {
    const input = scalePop.elements.namedItem('scale') as HTMLInputElement;
    input.value = formatScale(view.camera.screenScaleDenominator(screenMm())).replace(/\s/g, '');
    out('scale-note').innerHTML = uiSettings.screenInches
      ? `Räknat på en skärm på ${nf.format(uiSettings.screenInches)}″ och 100 % zoom i webbläsaren. <button type="button" class="link" data-action="scale-settings">Ändra</button>`
      : 'Ungefärlig: räknat på en vanlig skärm. <button type="button" class="link" data-action="scale-settings">Ange skärmens storlek</button> under Gränssnitt för exakt skala.';
    scalePop.hidden = false;
    scaleBtn.setAttribute('aria-expanded', 'true');
    input.focus();
    input.select();
  }
  function closeScalePop(): void {
    scalePop.hidden = true;
    scaleBtn.setAttribute('aria-expanded', 'false');
  }
  scalePop.addEventListener('submit', (e) => {
    e.preventDefault();
    const n = parseScale((scalePop.elements.namedItem('scale') as HTMLInputElement).value);
    if (!n) {
      hint('Skriv skalans nämnare, t.ex. 100 eller 1:50.');
      return;
    }
    if (ui.mode === '3d') void setMode('2d');
    view.zoomBy(Camera.scaleFor(n, screenMm()) / view.camera.scale);
    closeScalePop();
  });
  scalePop.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') closeScalePop();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!scalePop.hidden && !(e.target as Element).closest('.scale-wrap')) closeScalePop();
  });

  // Stilmall och kalkering i Visa-menyn.
  root.addEventListener('change', (e) => {
    const t = e.target as HTMLSelectElement;
    if (t.matches('[data-show-style]')) {
      ui.styleName = t.value || null;
      renderAll();
    } else if (t.matches('[data-show-trace]')) {
      ui.trace = t.value || null;
      renderAll();
      refreshShowMenu();
    } else if (t.matches('[data-trace-own]')) {
      uiSettings.trace.color = (t as unknown as HTMLInputElement).checked ? null : $<HTMLInputElement>('[data-trace-color]').value;
      saveUiSettings(uiSettings);
      applyTraceLook();
      refreshShowMenu();
    }
  });
  // Kalkeringens färg och opacitet ändras medan man drar.
  root.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.matches('[data-trace-color]')) uiSettings.trace.color = t.value;
    else if (t.matches('[data-trace-opacity]')) {
      uiSettings.trace.opacity = Number(t.value) / 100;
      out('trace-opacity').textContent = `${t.value} %`;
    } else return;
    saveUiSettings(uiSettings);
    applyTraceLook();
  });

  /** Rita om Visa-menyn om den är öppen, t.ex. när kalkeringen slås på. */
  function refreshShowMenu(): void {
    const m = $<HTMLElement>('.show-menu');
    if (m.hidden) return;
    closeShowMenu();
    $<HTMLElement>('.show-btn').click();
  }

  // ---------- Högerklick och långt tryck ----------
  const ctxMenu = new ContextMenu();
  const viewBtn = $<HTMLElement>('.view-btn');
  const viewBtnLongPressed = onLongPress(viewBtn, (x, y) => openHistoryMenu(x, y), 450, true);
  viewBtn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openHistoryMenu(e.clientX, e.clientY);
  });
  navigator.el.addEventListener('contextmenu', (e) => {
    const mrow = (e.target as HTMLElement).closest<HTMLElement>('[data-marker-pick]');
    if (mrow) {
      e.preventDefault();
      openMarkerMenu(mrow.dataset.markerPick!, e.clientX, e.clientY);
      return;
    }
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-view-apply]');
    if (!row) return;
    e.preventDefault();
    openViewMenu(row.dataset.viewApply!, e.clientX, e.clientY);
  });
  const viewRowLongPress = onLongPress(navigator.el, (x, y, target) => {
    const mrow = (target as HTMLElement | null)?.closest<HTMLElement>('[data-marker-pick]');
    if (mrow) {
      openMarkerMenu(mrow.dataset.markerPick!, x, y);
      return;
    }
    const row = (target as HTMLElement | null)?.closest<HTMLElement>('[data-view-apply]');
    if (row) openViewMenu(row.dataset.viewApply!, x, y);
  });
  // Ett långt tryck på en vy ska inte också öppna vyn.
  navigator.el.addEventListener(
    'click',
    (e) => {
      if (viewRowLongPress()) e.stopPropagation();
    },
    true,
  );

  /** Menyn för det som är markerat, eller för planen om inget är markerat. */
  function openObjectMenu(x: number, y: number): void {
    const els = selection.list().map((id) => store.doc.elements[id]).filter(Boolean);
    if (!els.length) {
      ctxMenu.open(
        x,
        y,
        [
          { label: 'Zooma till allt', hint: 'F', run: () => (ui.mode !== '3d' ? view.zoomToFit() : view3d?.frameAll()) },
          { kind: 'sep' },
          { label: 'Rita vägg', hint: 'W', run: () => setTool('wall') },
          { label: 'Sätt in dörr', hint: 'D', run: () => setTool('door') },
          { label: 'Sätt in fönster', hint: 'O', run: () => setTool('window') },
          { label: 'Rum', hint: 'R', run: () => setTool('room') },
          { label: 'Mått', hint: 'M', run: () => setTool('dimension') },
          { label: 'Text', hint: 'T', run: () => setTool('text') },
          { kind: 'sep' },
          { label: 'Visa…', run: () => $<HTMLElement>('.show-btn').click() },
          { label: 'Snäppning', checked: isSnapEnabled(), run: () => $<HTMLElement>('[data-action="snap"]').click() },
          { label: 'Rutnät', hint: 'G', checked: uiSettings.grid, run: () => toggleGrid() },
        ],
        'Planen',
      );
      return;
    }
    const first = els[0];
    const sameType = els.every((e) => e.type === first.type);
    const quick = panel.quickMarkup(false);
    const items: MenuItem[] = [];
    if (quick) items.push({ kind: 'html', html: `<div class="quick-bar ctx-quick">${quick}</div>`, onClick: (e) => panel.handleClick(e) });
    items.push(
      { kind: 'sep' },
      {
        label: 'Alla inställningar här',
        hint: 'Mer',
        // På telefonen finns ingen snabbmeny; där fälls bladet upp i stället.
        run: () => (isNarrow() ? (setPanel(true, 'full'), panel.showTab('selection')) : palette.show(x, y, true)),
      },
      { label: 'Visa i egenskaper', hint: 'P', run: () => (setPanel(true, 'full'), panel.showTab('selection')) },
      { label: 'Zooma till', run: () => zoomToSelection() },
    );
    if (els.length === 1 && first.definition) {
      const def = store.doc.definitions[first.definition];
      items.push({
        label: `Markera alla ${def?.name ?? 'av typen'}`,
        run: () => selection.set(Object.values(store.doc.elements).filter((e) => e.definition === first.definition && e.storey === ui.storey).map((e) => e.id)),
      });
    }
    if (sameType) {
      const t = first.type;
      const label = { Wall: 'väggar', Door: 'dörrar', Window: 'fönster', Furniture: 'möbler', Space: 'rum', Dimension: 'mått', Text: 'texter' }[t] ?? 'av samma sort';
      items.push({ label: `Markera alla ${label}`, run: () => selectAllOfType(t) });
    }
    items.push({ kind: 'sep' }, { kind: 'header', label: 'Finns i' });
    for (const s of store.doc.states) {
      const all = els.every((e) => e.states.includes(s.id));
      items.push({ label: s.name, checked: all, run: () => setInState(store, els.map((e) => e.id), s.id, !all) });
    }
    ctxMenu.open(x, y, items, 'Det markerade');
  }

  function selectAllOfType(type: string): void {
    const vs = viewStates();
    selection.set(
      Object.values(store.doc.elements)
        .filter((e) => e.type === type && e.storey === ui.storey && actionOf(e, vs) !== 'absent')
        .map((e) => e.id),
    );
  }

  /** Högerklick i planen: markera det man pekar på och öppna menyn. */
  function planContext(clientX: number, clientY: number): void {
    const r = pane2d.getBoundingClientRect();
    const p = view.camera.toModel([clientX - r.left, clientY - r.top]);
    const id = pickAt(plan.pickables, p, 6 / view.camera.scale);
    if (id && !selection.has(id)) selection.set([id]);
    if (!id && ui.tool === 'select') selection.clear();
    palette.hide();
    openObjectMenu(clientX, clientY);
  }
  pane2d.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    planContext(e.clientX, e.clientY);
  });
  // Långt tryck på telefonen. Trycket ska då inte också markera.
  onLongPress(pane2d, (x, y) => {
    selectTool.suppressNextClick();
    planContext(x, y);
  });

  // 3D: högerklick utan drag öppnar menyn; högerdrag panorerar som förut.
  let rightDown: { x: number; y: number } | null = null;
  pane3d.addEventListener('pointerdown', (e) => {
    if (e.button === 2) rightDown = { x: e.clientX, y: e.clientY };
  }, { capture: true });
  pane3d.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const d = rightDown;
    rightDown = null;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
    const id = view3d?.idAt(e.clientX, e.clientY) ?? null;
    if (id && !selection.has(id)) selection.set([id]);
    openObjectMenu(e.clientX, e.clientY);
  });

  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    const typing = (t instanceof HTMLInputElement && t.type !== 'checkbox') || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement;
    const mod = e.metaKey || e.ctrlKey;
    // Spara, öppna och nytt projekt fungerar även när man skriver i ett fält.
    if (mod && !e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void saveNow(e.shiftKey);
      return;
    }
    if (mod && !e.altKey && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      void openFile();
      return;
    }
    if (mod && e.altKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      newProjectDialog.open();
      return;
    }
    if (ctxMenu.isOpen) return;
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
        if (modifyPalette.open) modifyPalette.close();
        else if (ui.tool !== 'select') cancelCommand();
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
        togglePanel();
        break;
      case 'n':
      case 'N':
        toggleNav();
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
