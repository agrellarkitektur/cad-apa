import { deleteElements } from '../../core/commands';
import { copyPayload, originalsHere, parsePayload, pasteClip, type ClipPayload } from '../../core/clipboard';
import type { AppContext } from './context';

/** Kopiera, klipp ut och klistra in (0.7.1), även mellan projekt. */
export function installClipboard(app: AppContext) {
  // ---------- Kopiera och klistra in (0.7.1) ----------
  /** Det senast kopierade, om datorns urklipp inte går att läsa. */
  let clip: ClipPayload | null = null;
  const isTyping = (t: EventTarget | null) =>
    (t instanceof HTMLInputElement && t.type !== 'checkbox') || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable);

  function copySelection(data: DataTransfer | null): boolean {
    if (app.ui.marker || !app.selection.size) return false;
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
    // Ligger originalen kvar på samma ställe hamnar kopian en bit bort.
    const offset: [number, number] = originalsHere(app.store.doc, payload, app.ui.state, app.ui.storey) ? [1000, -1000] : [0, 0];
    const ids = pasteClip(app.store, payload, app.ui.state, app.ui.storey, offset);
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
      deleteElements(app.store, app.selection.list());
      app.selection.clear();
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
