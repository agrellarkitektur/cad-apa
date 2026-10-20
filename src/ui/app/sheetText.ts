import type { Id } from '../../core/model';
import { addSheetText, sheetOfItem, updateSheetText } from '../../core/sheets';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import type { InlineTextEditor } from '../textEditor';
import type { AppContext } from './context';

/**
 * Text på ett ritningsblad (0.8.7): textverktyget på bladet och att
 * redigera en text direkt där den står. Texten skrivs i verktygsraden som i
 * vyerna, med höjden i mm på papperet, och läggs där man klickar.
 */
export function installSheetText(app: AppContext, textEditor: InlineTextEditor, pick: (item: { kind: 'sheetText'; id: Id }) => void) {
  /** Textverktyget på ett blad. */
  class SheetTextTool implements ViewTool {
    cursor = 'text';
    private at: Vec2 | null = null;

    down(): 'capture' {
      return 'capture';
    }

    hover(p: ViewPointer | null): void {
      this.at = p?.model ?? null;
      app.view.requestRender();
    }

    drag(p: ViewPointer): void {
      this.at = p.model;
      app.view.requestRender();
    }

    up(p: ViewPointer, moved: boolean): void {
      if (moved && p.pointerType === 'touch') return;
      this.place(p.model);
    }

    tap(p: ViewPointer): void {
      this.place(p.model);
    }

    private place(at: Vec2): void {
      const sheetId = app.ui.layout;
      const t = app.textTool;
      if (!sheetId) return;
      if (!t.text.trim()) {
        app.hint('Skriv texten i fältet först.');
        return;
      }
      const id = addSheetText(app.store, sheetId, { at: [at[0], at[1]], text: t.text, height: t.height, bold: t.bold });
      if (id) pick({ kind: 'sheetText', id });
    }

    overlay(cam: Camera): string {
      if (!this.at) return '';
      const t = app.textTool;
      const s = cam.toScreen(this.at);
      const px = t.height * cam.scale;
      const first = t.text.split('\n')[0].replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
      return `<text x="${s[0]}" y="${s[1]}" font-size="${Math.max(6, px)}"${t.bold ? ' font-weight="bold"' : ''} class="text-preview">${first}</text>`;
    }
  }

  /** Redigera en text på bladet där den står (dubbelklick eller Redigera i smartmenyn). */
  function edit(id: Id): boolean {
    const sheet = sheetOfItem(app.store.doc, id);
    const item = sheet?.items.find((i) => i.id === id);
    if (!item || item.kind !== 'text') return false;
    app.smartMenu.hide();
    textEditor.open(
      {
        at: item.at,
        angle: 0,
        height: item.height,
        drawingScale: 1,
        value: item.text,
        multiline: true,
        bold: item.bold,
        label: 'Text på bladet',
        commit: (v) => updateSheetText(app.store, id, { text: v }, 'Ändra texten på bladet'),
      },
      app.view.camera,
    );
    return true;
  }

  return { tool: new SheetTextTool(), edit };
}
