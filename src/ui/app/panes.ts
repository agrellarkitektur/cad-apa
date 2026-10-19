import { icons } from '../icons';
import { clampWidth, setupPaneResize } from '../paneResize';
import { isNarrow, setupSheetDrag } from '../sheet';
import { PANE_WIDTH, saveUiSettings, type PaneMode } from '../uiSettings';
import type { AppContext } from './context';

/** Ritytan ska alltid få minst så här mycket plats (px). */
const MIN_CANVAS = 360;

/**
 * Projektträdet och egenskaperna: dockan vid högerkanten, panelernas bredd,
 * och om de är öppna, minimerade till stående band eller stängda. På
 * telefonen är egenskaperna ett blad nederst och trädet täcker allt.
 */
export function installPanes(app: AppContext) {
  // De här byts aldrig ut, så de kan hämtas en gång.
  const { appEl, panel, navigator, uiSettings, ui } = app;

  setupSheetDrag(panel.el, {
    narrow: isNarrow,
    state: () => ui.sheet,
    set: (open, sheet) => setPanel(open, sheet),
  });
  panel.el.querySelector('.panel-close')!.innerHTML = icons.close;

  // Navigatorn och egenskaperna delar högerspalten på datorn.
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
  const toolsEl = app.$<HTMLElement>('.tools');
  const maxPaneWidth = (other: number) => Math.min(PANE_WIDTH.max, window.innerWidth - (toolsEl.offsetWidth || 0) - MIN_CANVAS - other);
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
    app.$<HTMLElement>('.topbar [data-action="toggle-panel"]').setAttribute('aria-pressed', state(ui.panelOpen, uiSettings.panelMode));
    app.$<HTMLElement>('.topbar [data-action="toggle-nav"]').setAttribute('aria-pressed', state(ui.navOpen, uiSettings.navMode));
  }

  function togglePanel(): void {
    if (isNarrow()) {
      // På mobilen: nere → uppe → nere (om något är markerat) eller stängd.
      if (ui.panelOpen) {
        if (ui.sheet === 'peek') setPanel(true, 'full');
        else if (app.selection.size > 0) setPanel(true, 'peek');
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

  return { applyPaneClasses, applyPaneWidths, setNav, setPanel, setPaneMode, toggleNav, togglePanel };
}
