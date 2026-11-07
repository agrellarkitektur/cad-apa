import { bundledFontBytes, fontOf, fromBase64, isBundledFont } from '../../formats/fonts';
import type { AppContext } from './context';

/**
 * Ritningens typsnitt på skärmen (0.12): samma fil som bäddas in i PDF:en,
 * inlagd som `FontFace` när projektets typsnitt byts. osifont ligger redan i
 * CSS:en (`tema.css`).
 */
export function installDrawingFontFace(app: AppContext): void {
  let shown = 'osifont';
  let loading = '';
  const root = document.documentElement;

  async function apply(): Promise<void> {
    const doc = app.store.doc;
    const info = fontOf(doc);
    const key = info.id === 'osifont' ? 'osifont' : `${info.id}:${doc.assets[info.id]?.data.length ?? 0}`;
    if (key === shown || key === loading) return;
    if (info.id === 'osifont') {
      root.style.removeProperty('--font-drawing');
      shown = key;
      return;
    }
    loading = key;
    try {
      const bytes = isBundledFont(info.id) ? await bundledFontBytes(info.id) : fromBase64(doc.assets[info.id].data);
      const family = `cadapa-${key.replace(/[^a-z0-9]/gi, '')}`;
      const face = new FontFace(family, bytes as Uint8Array<ArrayBuffer>);
      await face.load();
      document.fonts.add(face);
      if (loading !== key) return;
      root.style.setProperty('--font-drawing', `'${family}', 'osifont', sans-serif`);
      shown = key;
      app.view.requestRender();
    } catch (err) {
      console.warn('Typsnittet kunde inte läggas in', err);
    } finally {
      if (loading === key) loading = '';
    }
  }

  app.store.subscribe(() => void apply());
  void apply();
}
