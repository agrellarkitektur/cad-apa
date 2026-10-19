import type { Brand } from '../../brand';
import { ENGINE } from '../../core/engine';
import type { Id, ProjectDoc } from '../../core/model';
import { icons, type IconName } from '../icons';
import { THEMES } from '../theme';
import type { UiSettings } from '../uiSettings';
import { defaultState } from './helpers';

export type ToolId = 'pan' | 'select' | 'measure' | 'wall' | 'door' | 'window' | 'roof' | 'room' | 'dimension' | 'text' | 'draw2d' | 'section' | 'elevation';

/** Verktyg som ritar i planen och därför byter till planvyn. */
export const PLAN_TOOLS: ToolId[] = ['wall', 'door', 'window', 'roof', 'room', 'dimension', 'text', 'draw2d', 'section', 'elevation'];
/** Verktyg som också ritar i fasader och sektioner (0.8). */
export const SPACE_TOOLS: ToolId[] = ['dimension', 'text', 'draw2d'];
export type ViewMode = '2d' | '3d' | 'split';

export interface ToolDef {
  id: string;
  label: string;
  icon: IconName;
  key?: string;
  /** Versionen där verktyget byggs (se docs/PLAN.md). Saknas för verktyg som redan fungerar. */
  comesIn?: string;
  group: 'navigera' | 'rita' | 'annotera';
}

export const TOOLS: ToolDef[] = [
  { id: 'select', label: 'Markera', icon: 'select', key: 'V', group: 'navigera' },
  { id: 'pan', label: 'Panorera', icon: 'pan', key: 'H', group: 'navigera' },
  { id: 'measure', label: 'Måttband', icon: 'measure', key: 'L', group: 'navigera' },
  { id: 'wall', label: 'Vägg', icon: 'wall', key: 'W', group: 'rita' },
  { id: 'door', label: 'Dörr', icon: 'door', key: 'D', group: 'rita' },
  { id: 'window', label: 'Fönster', icon: 'window', key: 'O', group: 'rita' },
  { id: 'roof', label: 'Tak', icon: 'roof', group: 'rita' },
  { id: 'furniture', label: 'Möbel', icon: 'furniture', comesIn: '0.12', group: 'rita' },
  { id: 'room', label: 'Rum', icon: 'room', key: 'R', group: 'annotera' },
  { id: 'dimension', label: 'Mått', icon: 'dimension', key: 'M', group: 'annotera' },
  { id: 'text', label: 'Text', icon: 'text', key: 'T', group: 'annotera' },
  { id: 'draw2d', label: '2D', icon: 'draw2d', key: 'I', group: 'annotera' },
  { id: 'section', label: 'Sektion', icon: 'section', group: 'annotera' },
  { id: 'elevation', label: 'Fasad', icon: 'elevation', group: 'annotera' },
];

export const GROUP_LABEL: Record<ToolDef['group'], string> = { navigera: 'Visa', rita: 'Rita', annotera: 'Annotera' };

/** Vad som visas just nu. Hör till vyn, inte till projektet. */
export function createUiState(initial: ProjectDoc, uiSettings: UiSettings, desktop: boolean) {
  return {
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
    /** Ett arbetsblad som visas i stället för planen (0.8 del 2). */
    worksheet: null as Id | null,
    /** Visa 2D-element som inte syns i vyn, tonade (0.8). */
    showHidden: false,
    /** Ett ritningsblad som visas i stället för planen (0.8 del 3). */
    layout: null as Id | null,
    /** Annoteringsskalan (0.8 del 3): texter, mått och symboler ritas för den här skalan. */
    scale: 100,
  };
}

export type UiState = ReturnType<typeof createUiState>;

/** Appens stomme: topraden, verktygsraden, ritytan och statusraden. */
export function shellMarkup(brand: Brand): string {
  return `
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
            <button role="menuitem" data-action="plot">${icons.plot}<span>Plot/export…</span></button>
            <button role="menuitem" data-action="add-underlay">${icons.openFile}<span>Lägg in underlag…</span></button>
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
            <button role="menuitem" data-action="feedback">${icons.text}<span>Skicka synpunkter…</span></button>
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
        <button class="icon-btn pane-btn" data-action="toggle-nav" title="Projektträd: underlag, modell, vyer och ritningar (N)" aria-label="Projektträd" aria-pressed="false">${icons.navigator}</button>
        <button class="icon-btn pane-btn" data-action="toggle-panel" title="Egenskaper (P)" aria-label="Egenskaper" aria-pressed="false">${icons.properties}</button>
        <div class="theme-slot"></div>
        ${brand.badge ? `<button class="badge beta-btn" data-action="feedback" title="Skicka synpunkter på ${brand.name}"><b>${brand.badge}</b><small>Skicka synpunkter</small></button>` : ''}
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
        <div class="segmented view-modes" role="group" aria-label="Vy">
          <button data-mode="2d" aria-pressed="true" title="Plan (2)">2D</button>
          <button data-mode="3d" aria-pressed="false" title="3D (3)">3D</button>
          <button data-mode="split" aria-pressed="false" class="hide-narrow" title="Plan och 3D sida vid sida (4)">Båda</button>
        </div>
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
          <button class="status-icon hide-narrow" data-action="zoom-box" title="Zooma till område (Z)" aria-label="Zooma till område">${icons.zoomBox}</button>
          <button class="status-icon hide-narrow" data-action="zoom-prev" title="Förra zoomen (Shift+Z)" aria-label="Förra zoomen">${icons.zoomPrev}</button>
          <button class="status-icon" data-action="fit" title="Zooma till allt (F)" aria-label="Zooma till allt">${icons.fit}</button>
        </span>
        <span class="hide-narrow"><span class="label">Rutnät</span><span class="value" data-out="grid">—</span></span>
        <button class="status-btn" data-action="snap" aria-pressed="true" title="Snäppning av eller på (S)">Snäpp</button>
        <span data-out="save" class="save-status"></span>
        <span class="engine hide-narrow">${ENGINE.name} ${ENGINE.version}</span>
      </footer>
    </div>`;
}
