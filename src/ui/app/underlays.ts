import { addWithAsset, deleteElements, renameElement, setLocked } from '../../core/commands';
import { newId } from '../../core/ids';
import type { Asset, Id } from '../../core/model';
import { parseDxf } from '../../formats/dxf';
import { assetText, type UnderlayParams } from '../../elements/underlay';
import { askConfirm, askText } from '../ask';
import { isNarrow } from '../sheet';
import { UnderlayTool } from '../tools/underlayTools';
import type { AppContext } from './context';
import type { PdfImage } from '../../formats/pdf';

/**
 * Underlag i appen (0.8 del 2): lägga in filer (knappen i projektträdet
 * eller dra och släpp på ritytan), visa bilderna och PDF-sidorna, och
 * kalibrera och rikta.
 *
 * Bilderna ges till ritningen som blob-adresser, så att det som ritas om vid
 * varje panorering bara är en kort adress och inte hela filen.
 */

/** Skalan som ett nytt underlag får innan det kalibreras: 1:100 på papper. */
const PDF_MM_PER_PT = (25.4 / 72) * 100;
/** En inskannad eller fotograferad ritning antas vara 150 dpi i 1:100. */
const IMAGE_MM_PER_PX = (25.4 / 150) * 100;

export const UNDERLAY_ACCEPT = '.pdf,.dxf,.png,.jpg,.jpeg,.webp,.gif,application/pdf,image/*';

export function base64Of(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function bytesOf(data: string): Uint8Array {
  const bin = atob(data);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function kindOf(file: { name: string; type: string }): UnderlayParams['kind'] | null {
  const n = file.name.toLowerCase();
  if (n.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (n.endsWith('.dxf')) return 'dxf';
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/.test(n)) return 'image';
  return null;
}

/** Bildens storlek i bildpunkter. */
function imageSize(url: string): Promise<[number, number]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
    img.onerror = () => reject(new Error('Bilden kunde inte läsas.'));
    img.src = url;
  });
}

export function installUnderlays(app: AppContext) {
  /** Blob-adresser per fil och sida, eller att de håller på att tas fram. */
  const urls = new Map<string, { data: string; url: string | null; failed?: boolean }>();

  function imageHref(src: { asset: string; page?: number }): string | null {
    const a = app.store.doc.assets[src.asset];
    if (!a) return null;
    const key = `${src.asset}:${src.page ?? 0}`;
    const hit = urls.get(key);
    if (hit && hit.data === a.data) return hit.url;
    if (hit?.url) URL.revokeObjectURL(hit.url);
    if (a.mime === 'application/pdf') {
      const entry: { data: string; url: string | null; failed?: boolean } = { data: a.data, url: null };
      urls.set(key, entry);
      const maxPx = isNarrow() || matchMedia('(pointer: coarse)').matches ? 2560 : 4096;
      void import('../pdf')
        .then(({ renderPdfPage }) => renderPdfPage(bytesOf(a.data), src.page ?? 1, maxPx))
        .then((blob) => {
          entry.url = URL.createObjectURL(blob);
          app.view.redraw();
        })
        .catch((err: unknown) => {
          console.warn('PDF-underlag', err);
          entry.failed = true;
          app.hint(`${a.name}: sidan kunde inte visas.`, 4000);
        });
      return null;
    }
    const url = URL.createObjectURL(new Blob([bytesOf(a.data) as Uint8Array<ArrayBuffer>], { type: a.mime }));
    urls.set(key, { data: a.data, url });
    return url;
  }
  app.view.imageHref = imageHref;

  /**
   * En bild som JPEG för PDF-exporten (0.8 del 3): ett foto, en PDF-sida
   * eller loggan, med vit bakgrund under det genomskinliga och i gråskala om
   * underlaget är grått. Längsta sidan högst 4096 bildpunkter.
   */
  async function exportImage(src: { asset: string; page?: number }, gray: boolean): Promise<PdfImage | null> {
    const a = app.store.doc.assets[src.asset];
    if (!a) return null;
    try {
      const blob =
        a.mime === 'application/pdf'
          ? await import('../pdf').then(({ renderPdfPage }) => renderPdfPage(bytesOf(a.data), src.page ?? 1, 4096))
          : new Blob([bytesOf(a.data) as Uint8Array<ArrayBuffer>], { type: a.mime });
      const url = URL.createObjectURL(blob);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('Bilden kunde inte läsas.'));
        i.src = url;
      }).finally(() => setTimeout(() => URL.revokeObjectURL(url), 1000));
      const k = Math.min(1, 4096 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      const w = Math.max(1, Math.round((img.naturalWidth || 300) * k));
      const h = Math.max(1, Math.round((img.naturalHeight || 150) * k));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      if (gray) ctx.filter = 'grayscale(1)';
      ctx.drawImage(img, 0, 0, w, h);
      const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
      if (!jpeg) return null;
      return { width: w, height: h, jpeg: new Uint8Array(await jpeg.arrayBuffer()) };
    } catch (err) {
      console.warn('Bild till PDF', err);
      return null;
    }
  }

  /** Ytan som visas: fasaden, sektionen eller arbetsbladet, annars våningens plan. */
  const space = (): Id | undefined => app.ui.marker ?? app.ui.worksheet ?? undefined;

  /** Mitten av det som syns på ritytan, mm. */
  function viewCenter(): [number, number] {
    const cam = app.view.camera;
    const c = cam.toModel([cam.width / 2, cam.height / 2]);
    return [Math.round(c[0]), Math.round(c[1])];
  }

  async function importFile(file: File): Promise<void> {
    const kind = kindOf(file);
    if (!kind) {
      app.hint(`${file.name}: bara PDF, DXF och bilder (PNG, JPG) går att lägga in som underlag.`, 5000);
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = kind === 'pdf' ? 'application/pdf' : kind === 'dxf' ? 'application/dxf' : file.type || 'image/png';
    const asset: Asset = { id: newId('fil'), name: file.name, mime, data: base64Of(bytes) };
    let size: [number, number];
    let scale: number;
    let page: number | undefined;
    let ref: [number, number] | undefined;
    let note = '';
    try {
      if (kind === 'pdf') {
        const { pdfInfo } = await import('../pdf');
        const info = await pdfInfo(bytes);
        page = 1;
        if (info.pages > 1) {
          const a = await askText(`${file.name} har ${info.pages} sidor. Vilken sida?`, '1', 'Lägg in');
          if (a === null) return;
          page = Math.max(1, Math.min(info.pages, Math.round(Number(a.replace(',', '.'))) || 1));
        }
        size = await info.size(page);
        scale = PDF_MM_PER_PT;
      } else if (kind === 'dxf') {
        const d = parseDxf(assetText(asset));
        if (!d.bounds) {
          app.hint(`${file.name}: hittade inga linjer i modellrymden.`, 5000);
          return;
        }
        size = [Math.max(1, d.bounds.maxX - d.bounds.minX), Math.max(1, d.bounds.maxY - d.bounds.minY)];
        ref = [d.bounds.minX, d.bounds.minY];
        scale = d.mmPerUnit;
        if (!d.unitsKnown) note = ' Filen anger ingen enhet; den läses som mm.';
      } else {
        const url = URL.createObjectURL(file);
        try {
          size = await imageSize(url);
        } finally {
          URL.revokeObjectURL(url);
        }
        scale = IMAGE_MM_PER_PX;
      }
    } catch (err) {
      app.hint(`${file.name}: ${(err as Error).message || 'filen kunde inte läsas.'}`, 5000);
      return;
    }
    const c = viewCenter();
    const params: UnderlayParams = {
      asset: asset.id,
      kind,
      ...(page ? { page } : {}),
      pos: [Math.round(c[0] - (size[0] * scale) / 2), Math.round(c[1] - (size[1] * scale) / 2)],
      angle: 0,
      scale,
      size,
      ...(ref ? { ref } : {}),
      opacity: kind === 'dxf' ? 70 : 55,
    };
    const name = page && kind === 'pdf' ? `${file.name.replace(/\.pdf$/i, '')}, sida ${page}` : file.name.replace(/\.[^.]+$/, '');
    const sp = space();
    const el = addWithAsset(
      app.store,
      asset,
      { type: 'Underlay', name, storey: app.ui.storey, ...(sp ? { space: sp } : {}), tags: [], props: {}, params: params as unknown as Record<string, unknown> },
      app.ui.state,
      `Lägg in ${name}`,
    );
    app.setTool('select');
    // På telefonen täcker projektträdet ritytan: stäng det så att underlaget syns.
    if (isNarrow()) app.setNav(false);
    app.selection.set([el.id]);
    app.hint(
      kind === 'dxf' && !note
        ? `${name} är inlagt i sin egen skala. Snäpp mot linjerna när du ritar.`
        : `${name} är inlagt.${note} Kalibrera skalan i egenskaperna: klicka två punkter och skriv avståndet.`,
      6000,
    );
  }

  async function importFiles(files: Iterable<File>): Promise<void> {
    for (const f of files) await importFile(f);
  }

  /** Välj filer att lägga in. */
  function chooseFiles(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = UNDERLAY_ACCEPT;
    input.multiple = true;
    input.addEventListener('change', () => {
      if (input.files?.length) void importFiles([...input.files]);
    });
    input.click();
  }

  // Dra och släpp filer på ritytan.
  const pane = app.pane2d;
  pane.addEventListener('dragover', (e) => {
    if (![...(e.dataTransfer?.types ?? [])].includes('Files')) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    pane.classList.add('drop-target');
  });
  pane.addEventListener('dragleave', () => pane.classList.remove('drop-target'));
  pane.addEventListener('drop', (e) => {
    pane.classList.remove('drop-target');
    const files = [...(e.dataTransfer?.files ?? [])];
    if (!files.length) return;
    e.preventDefault();
    void importFiles(files);
  });

  /** Kalibrering eller riktning som pågår. */
  let active: UnderlayTool | null = null;

  /** Kalibrera eller rikta ett underlag: ett tillfälligt verktyg, sedan tillbaka till Markera. */
  function startUnderlayTool(id: Id, mode: 'calibrate' | 'align'): void {
    if (app.ui.mode === '3d') void app.setMode('2d');
    app.setTool('select');
    const tool = new UnderlayTool(app.host, id, mode);
    active = tool;
    tool.onDone = () => {
      active = null;
      app.view.setTool(app.selectTool);
      app.selection.set([id]);
      app.view.requestRender();
    };
    app.view.setTool(tool);
    app.hint(mode === 'calibrate' ? 'Kalibrera: klicka två punkter på underlaget med känt avstånd. Esc avbryter.' : 'Rikta: klicka två punkter längs en linje som ska bli rak. Esc avbryter.', 6000);
  }

  /** Gå dit underlaget ligger, markera det och zooma till det. */
  function showUnderlay(id: Id): void {
    const el = app.store.doc.elements[id];
    if (!el) return;
    const here = (app.ui.marker ?? app.ui.worksheet ?? app.ui.storey) === (el.space ?? el.storey);
    if (!here) {
      if (el.space && app.store.doc.elements[el.space]) app.goTo({ kind: 'marker', id: el.space });
      else if (el.space && app.store.doc.worksheets.some((w) => w.id === el.space)) app.goTo({ kind: 'worksheet', id: el.space });
      else app.goTo({ kind: 'storey', id: el.storey });
    }
    if (app.ui.mode === '3d') void app.setMode('2d');
    app.selection.set([id]);
    requestAnimationFrame(() => app.zoomToSelection());
  }

  /** Högerklick eller ⋯ på ett underlag i projektträdet. */
  function openUnderlayMenu(id: Id, x: number, y: number): void {
    const el = app.store.doc.elements[id];
    if (!el) return;
    const name = el.name ?? 'Underlag';
    app.ctxMenu.open(
      x,
      y,
      [
        { kind: 'header', label: name, sub: 'Underlag' },
        { label: 'Visa', run: () => showUnderlay(id) },
        { label: 'Kalibrera skalan…', disabled: !!el.locked, run: () => (showUnderlay(id), startUnderlayTool(id, 'calibrate')) },
        { label: 'Rikta…', disabled: !!el.locked, run: () => (showUnderlay(id), startUnderlayTool(id, 'align')) },
        { label: 'Lås', checked: !!el.locked, run: () => setLocked(app.store, [id], !el.locked) },
        {
          label: 'Byt namn…',
          run: async () => {
            const n = await askText('Byt namn på underlaget', name);
            if (n !== null) renameElement(app.store, id, n);
          },
        },
        { kind: 'sep' },
        {
          label: 'Ta bort…',
          danger: true,
          disabled: !!el.locked,
          run: async () => {
            if (await askConfirm('Ta bort underlaget?', `${name} tas bort. Det går att ångra.`)) deleteElements(app.store, [id]);
          },
        },
      ],
      name,
    );
  }

  /** Om kalibrering eller riktning pågår (då visas ingen smartmeny vid klick). */
  const busy = () => !!active;
  /** Avbryt det som pågår (Esc). */
  const cancel = () => {
    active = null;
  };

  return { importFiles, chooseFiles, startUnderlayTool, imageHref, exportImage, showUnderlay, openUnderlayMenu, busy, cancel };
}
