import type { CommandDef } from '../commandRegistry';
import type { AppContext } from './context';
import { arrangeSelection } from './drawOrderUi';

/**
 * Kommandona som gör något direkt (`action` i registret): ångra, zooma,
 * spara, byta vyläge … (0.8.20; ur commandLine.ts i 0.8.23). Ta bort utan
 * markering väntar på en markering, som i AutoCAD.
 */
export function runAction(app: AppContext, c: CommandDef, line: { waitForSelection: (c: CommandDef) => void; erase: () => void; openAll: () => void }): void {
  switch (c.action) {
    case 'erase':
      if (!app.selection.size) line.waitForSelection(c);
      else line.erase();
      break;
    case 'undo':
      app.store.undo();
      break;
    case 'redo':
      app.store.redo();
      break;
    case 'zoom-fit':
      app.view.zoomToFit();
      break;
    case 'zoom-box':
      app.startZoomBox();
      break;
    case 'zoom-prev':
      app.previousZoom();
      break;
    case 'grid':
      app.toggleGrid();
      break;
    case 'snap':
      app.$<HTMLElement>('[data-action="snap"]').click();
      break;
    case 'save':
      void app.saveNow(false);
      break;
    case 'save-as':
      void app.saveNow(true);
      break;
    case 'open':
      void app.openFile();
      break;
    case 'plot':
      app.$<HTMLElement>('.menu [data-action="plot"]').click();
      break;
    case 'mode-2d':
      void app.setMode('2d');
      break;
    case 'mode-3d':
      void app.setMode('3d');
      break;
    case 'mode-split':
      void app.setMode('split');
      break;
    case 'help':
      line.openAll();
      break;
    case 'order-back':
      arrangeSelection(app, 'back');
      break;
    case 'order-backward':
      arrangeSelection(app, 'backward');
      break;
    case 'order-forward':
      arrangeSelection(app, 'forward');
      break;
    case 'order-front':
      arrangeSelection(app, 'front');
      break;
  }
}
