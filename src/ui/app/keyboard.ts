import { deleteElements, moveElements } from '../../core/commands';
import { releasedHint } from '../tools/selectTool';
import { isNarrow } from '../sheet';
import type { AppContext } from './context';
import { RAIL_ITEMS, type RailId } from '../modify/ops';

/** Kortkommandona. */
export function installKeyboard(app: AppContext, pressRail: (id: RailId) => void) {
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    const typing = (t instanceof HTMLInputElement && t.type !== 'checkbox') || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement;
    const mod = e.metaKey || e.ctrlKey;
    // Spara, öppna och nytt projekt fungerar även när man skriver i ett fält.
    if (mod && !e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void app.saveNow(e.shiftKey);
      return;
    }
    if (mod && !e.altKey && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      void app.openFile();
      return;
    }
    if (mod && e.altKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      app.newProjectDialog.open();
      return;
    }
    if (app.ctxMenu.isOpen) return;
    // Smartshell (0.8.20): i vägg-, 2D- och måttverktyget går siffror och
    // @ # < till raden som en punkt. @ skrivs med AltGr, därför före Ctrl/Alt.
    const shell = app.commandLine;
    if (
      !typing &&
      shell?.shown &&
      shell.taker() &&
      /^[0-9@#<.]$/.test(e.key) &&
      !(e.metaKey || (e.ctrlKey && !e.altKey)) &&
      !app.newProjectDialog.isOpen &&
      !app.styleDialog.isOpen &&
      !app.settingsDialog.isOpen
    ) {
      e.preventDefault();
      shell.open(e.key);
      return;
    }
    if (mod && e.key.toLowerCase() === 'z' && !typing) {
      e.preventDefault();
      if (e.shiftKey) app.store.redo();
      else app.store.undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y' && !typing) {
      e.preventDefault();
      app.store.redo();
      return;
    }
    if (typing || mod || e.altKey) return;
    // Piltangenterna på en skarv eller panelkant flyttar den, inte det markerade.
    if (t.getAttribute?.('role') === 'separator') return;
    if (app.newProjectDialog.isOpen) return;
    if (app.styleDialog.isOpen) {
      if (e.key === 'Escape') app.styleDialog.close();
      return;
    }
    if (app.settingsDialog.isOpen) {
      if (e.key === 'Escape') app.settingsDialog.close();
      return;
    }

    // Siffror medan man ritar väggar går till längdfältet.
    if (app.ui.tool === 'wall' && app.wallTool.drawing && /^[0-9]$/.test(e.key)) {
      const input = app.$<HTMLInputElement>('#wall-length');
      if (input) {
        input.focus();
        input.value = e.key;
        e.preventDefault();
      }
      return;
    }

    // Modifiera: siffror går till värdefältet, som för väggens längd (0.8.5).
    if (app.modifier.running && /^[0-9]$/.test(e.key)) {
      const input = app.root.querySelector<HTMLInputElement>('input[data-modify-value]');
      if (input) {
        input.focus();
        input.value = e.key;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        e.preventDefault();
      }
      return;
    }

    // Måttbandet: ett tal delar mätningen i segment (0.8.18).
    if (app.ui.tool === 'measure' && !app.measureTool.moving && /^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const input = app.toolOptions.querySelector<HTMLInputElement>('#measure-divide');
      if (input) {
        input.focus();
        input.value = e.key;
        e.preventDefault();
        return;
      }
    }

    // Modifiera-verktygen: Shift + bokstav (0.8.13). Shift+Z (förra zoomen)
    // och Shift + piltangenterna (knuffa) är inte med.
    if (e.shiftKey && /^Key[A-Z]$/.test(e.code)) {
      const rail = RAIL_ITEMS.find((r) => `Key${r.key}` === e.code);
      if (rail) {
        e.preventDefault();
        pressRail(rail.id);
        return;
      }
    }

    function enterInTool(): void {
      if (app.ui.tool === 'measure') app.measureTool.reset();
      if (app.ui.tool === 'wall') app.wallTool.finish();
      if (app.ui.tool === 'dimension') app.dimensionTool.donePoints();
      if (app.ui.tool === 'draw2d') app.draw2dTool.finish(false);
    }

    switch (e.key) {
      case 'Tab':
        // Tab växlar mellan objekt som ligger på varandra under markören (0.8.4).
        if (app.ui.tool === 'select' && !app.ui.layout && !app.modifier.busy && app.selectTool.cycle(e.shiftKey)) e.preventDefault();
        // Måttbandet: Tab går till objektet vid sista punkten, för att flytta det.
        if (app.ui.tool === 'measure') {
          e.preventDefault();
          const msg = app.measureTool.beginMove(e.shiftKey);
          if (msg) app.hint(msg, 3500);
        }
        break;
      case 'Escape':
        if (app.aligning) {
          app.endAlign();
          break;
        }
        if (app.zoomingBox) {
          app.endZoomBox();
          break;
        }
        if (app.ui.navOpen && isNarrow()) {
          app.setNav(false);
          break;
        }
        if (app.modifier.busy) app.modifier.cancel();
        else if (app.ui.tool !== 'select') app.cancelCommand();
        else app.selection.clear();
        app.closeMenu();
        break;
      case 'Enter':
        // Enter utan att något kommando är igång öppnar smartshell (0.8.20).
        if (shell && !shell.busy() && shell.open()) break;
        enterInTool();
        break;
      case ' ':
        // Mellanslag kör senaste kommandot igen; i ett kommando som pågår är det Enter (0.8.20).
        if (!shell) return;
        if (shell.busy()) enterInTool();
        else if (!shell.repeat()) app.hint('Inget kommando att köra igen än.');
        break;
      case 'Delete':
      case 'Backspace':
        if (app.selection.size) {
          deleteElements(app.store, app.selection.list());
          app.selection.clear();
        }
        break;
      case '2':
        void app.setMode('2d');
        break;
      case '3':
        void app.setMode('3d');
        break;
      case '4':
        void app.setMode('split');
        break;
      case 'v':
      case 'V':
        app.setTool('select');
        break;
      case 'h':
      case 'H':
        app.setTool('pan');
        break;
      case 'w':
      case 'W':
        app.setTool('wall');
        break;
      case 'd':
      case 'D':
        app.setTool('door');
        break;
      case 'o':
      case 'O':
        app.setTool('window');
        break;
      case 'r':
      case 'R':
        app.setTool('room');
        break;
      case 'm':
      case 'M':
        app.setTool('dimension');
        break;
      case 'l':
      case 'L':
        app.setTool('measure');
        break;
      case 't':
      case 'T':
        app.setTool('text');
        break;
      case 'i':
      case 'I':
        app.setTool('draw2d');
        break;
      case 'f':
      case 'F':
      case 'Home':
        app.view.zoomToFit();
        break;
      case 'g':
      case 'G':
        app.toggleGrid();
        break;
      case 's':
      case 'S':
        app.$<HTMLElement>('[data-action="snap"]').click();
        break;
      case 'p':
      case 'P':
        app.togglePanel();
        break;
      case 'n':
      case 'N':
        app.toggleNav();
        break;
      case '+':
      case '=':
        app.view.zoomBy(1.4);
        break;
      case 'z':
      case 'Z':
        if (e.shiftKey) app.previousZoom();
        else app.startZoomBox();
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        // Knuffa det markerade; med Shift ett större steg.
        if (!app.selection.size || app.ui.marker || app.ui.mode === '3d') return;
        const step = e.shiftKey ? app.uiSettings.nudgeLarge : app.uiSettings.nudge;
        const d: [number, number] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key] as [number, number];
        const r = moveElements(app.store, app.selection.list(), d, 'Knuffa');
        if (r.released) app.hint(releasedHint(r.released), 4000);
        break;
      }
      case '-':
        app.view.zoomBy(1 / 1.4);
        break;
      default:
        return;
    }
    e.preventDefault();
  });
}
