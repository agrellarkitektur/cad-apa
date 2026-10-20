import { deleteElements, moveElements } from '../../core/commands';
import { removeViewport, sheetOfViewport } from '../../core/sheets';
import { releasedHint } from '../tools/selectTool';
import { isNarrow } from '../sheet';
import type { AppContext } from './context';

/** Kortkommandona. */
export function installKeyboard(app: AppContext) {
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

    switch (e.key) {
      case 'Tab':
        // Tab växlar mellan objekt som ligger på varandra under markören (0.8.4).
        if (app.ui.tool === 'select' && !app.ui.layout && !app.modifyPalette.open && app.selectTool.cycle(e.shiftKey)) e.preventDefault();
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
        if (app.modifyPalette.open) app.modifyPalette.close();
        else if (app.ui.tool !== 'select') app.cancelCommand();
        else app.selection.clear();
        app.palette.hide();
        app.closeMenu();
        break;
      case 'Enter':
        if (app.ui.tool === 'measure') app.measureTool.reset();
        if (app.ui.tool === 'wall') app.wallTool.finish();
        if (app.ui.tool === 'dimension') app.dimensionTool.donePoints();
        if (app.ui.tool === 'draw2d') app.draw2dTool.finish(false);
        break;
      case 'Delete':
      case 'Backspace':
        // En vy på ett ritningsblad (0.8 del 3) tas bort från bladet.
        if (app.ui.layout && app.panel.treeItem?.kind === 'viewport') {
          const vp = app.panel.treeItem.id;
          const sheet = sheetOfViewport(app.store.doc, vp);
          if (sheet) {
            removeViewport(app.store, sheet.id, vp);
            app.panel.showTreeItem({ kind: 'sheet', id: sheet.id });
          }
          break;
        }
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
