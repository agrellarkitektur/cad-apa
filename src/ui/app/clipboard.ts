import { onPaper } from '../../core/model';
import { eraseSelection } from './erase';
import { copyPayload, originalsHere, parsePayload, pasteClip, type ClipPayload } from '../../core/clipboard';
import type { AppContext } from './context';

/** Det som går att ha på ett arbetsblad (0.8 del 2). */
export const DRAWING_TYPES = new Set(['Shape2D', 'Text', 'Dimension', 'Underlay']);

/** Kopiera, klipp ut och klistra in (0.7.1), även mellan projekt. */
export function installClipboard(app: AppContext) {
  // ---------- Kopiera och klistra in (0.7.1) ----------
  /** Det senast kopierade, om datorns urklipp inte går att läsa. */
  let clip: ClipPayload | null = null;
  const isTyping = (t: EventTarget | null) =>
    (t instanceof HTMLInputElement && t.type !== 'checkbox') || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable);

  function copySelection(data: DataTransfer | null): boolean {
    if (app.ui.marker || !app.selection.size) return false;
    // På ett arbetsblad (0.8 del 2) går 2D, text, mått och underlag att kopiera.
    const payload = copyPayload(app.store.doc, app.selection.list(), app.ui.storey);
    if (!payload) return false;
    clip = payload;
    const text = JSON.stringify(payload);
    if (data) data.setData('text/plain', text);
    else void window.navigator.clipboard?.writeText(text).catch(() => {});
    const n = payload.elements.filter((e) => !e.host).length;
    app.hint(n === 1 ? 'Kopierat. Klistra in med Ctrl+V, även i ett annat projekt.' : `${n} objekt kopierade. Klistra in med Ctrl+V, även i ett annat projekt.`);
    return true;
  }

  function pasteClipboard(payload: ClipPayload | null): void {
    if (!payload) {
      app.hint('Inget att klistra in.');
      return;
    }
    if (app.ui.marker) app.goTo({ kind: 'storey', id: app.ui.storey });
    // På ett arbetsblad och ett ritningsblad (0.8.9) går bara det som är ritning att klistra in, inte väggar och dörrar.
    const ws = app.ui.worksheet ?? app.ui.layout ?? undefined;
    const usable = ws ? { ...payload, elements: payload.elements.filter((e) => DRAWING_TYPES.has(e.type)) } : payload;
    // Ligger originalen kvar på samma ställe hamnar kopian en bit bort (på papper 10 mm, annars 1 m).
    const paper = !!app.ui.layout || app.store.doc.worksheets.some((w) => w.id === ws && onPaper(w));
    const step = paper ? 10 : 1000;
    const offset: [number, number] = originalsHere(app.store.doc, usable, app.ui.state, app.ui.storey) ? [step, -step] : [0, 0];
    const ids = pasteClip(app.store, usable, app.ui.state, app.ui.storey, offset, ws);
    if (!ids.length) {
      app.hint('Inget att klistra in här.');
      return;
    }
    if (app.ui.tool !== 'select') app.setTool('select');
    app.selection.set(ids);
    app.hint(offset[0] ? 'Inklistrat bredvid originalet. Dra för att flytta.' : 'Inklistrat på samma ställe som det kopierades från.');
  }

  document.addEventListener('copy', (e) => {
    if (isTyping(e.target) || app.ctxMenu.isOpen) return;
    if (copySelection(e.clipboardData)) e.preventDefault();
  });
  document.addEventListener('cut', (e) => {
    if (isTyping(e.target) || app.ctxMenu.isOpen) return;
    if (copySelection(e.clipboardData)) {
      e.preventDefault();
      eraseSelection(app);
    }
  });
  document.addEventListener('paste', (e) => {
    if (isTyping(e.target)) return;
    const text = e.clipboardData?.getData('text/plain') ?? '';
    const payload = parsePayload(text) ?? clip;
    if (!payload && text) return;
    e.preventDefault();
    pasteClipboard(payload);
  });

  async function pasteFromMenu(): Promise<void> {
    let payload: ClipPayload | null = null;
    try {
      payload = parsePayload((await window.navigator.clipboard?.readText()) ?? '');
    } catch {
      // Webbläsaren lät oss inte läsa urklippet; använd det vi själva kopierade.
    }
    pasteClipboard(payload ?? clip);
  }
  return { copySelection, pasteFromMenu };
}
