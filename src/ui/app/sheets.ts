import { newId } from '../../core/ids';
import type { Id, Sheet } from '../../core/model';
import { addViewport, createSheet, FRAME_MARGIN, paperSize, removeViewport, setLogo, today, updateViewport } from '../../core/sheets';
import { buildSheet, cachedViewPrims, contentBounds, VIEWPORT_PAD, viewSource, type SheetDrawing } from '../../repr/sheet';
import { TITLE_BLOCK_HEIGHT, TITLE_BLOCK_WIDTH } from '../../repr/titleBlock';
import type { Bounds, Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import { isNarrow } from '../sheet';
import type { SheetFormHost } from '../sheetForms';
import type { AppContext } from './context';
import { base64Of } from './underlays';

/**
 * Ritningsbladen i appen (0.8 del 3): bladet som visas, verktyget som
 * markerar och flyttar vyerna på det, att lägga en vy på ett blad och
 * formulären i egenskapspanelen.
 *
 * På ett blad är koordinaterna mm på papperet och ritningsskalan 1:1, så
 * att texter och linjer får sin storlek på papper.
 */
export function installSheets(app: AppContext) {
  let last: { doc: unknown; sheet: Sheet; autoDims: boolean; drawing: SheetDrawing } | null = null;

  /** Bladet som visas, ritat. Sparas tills projektet eller bladet ändras. */
  function drawing(): SheetDrawing | null {
    const sheet = app.ui.layout ? app.store.doc.sheets.find((s) => s.id === app.ui.layout) : undefined;
    if (!sheet) return null;
    const doc = app.store.doc;
    const autoDims = app.uiSettings.autoDims;
    if (last && last.doc === doc && last.sheet === sheet && last.autoDims === autoDims) return last.drawing;
    const d = buildSheet(doc, sheet, { autoDims, today: today() });
    last = { doc, sheet, autoDims, drawing: d };
    return d;
  }

  /** Vyn på bladet som är vald i egenskapspanelen. */
  const picked = (): Id | null => (app.panel.treeItem?.kind === 'viewport' ? app.panel.treeItem.id : null);

  function pick(item: { kind: 'sheet' | 'viewport'; id: Id } | null): void {
    app.selection.clear();
    app.panel.showTreeItem(item);
    if (item && !isNarrow() && !app.ui.panelOpen) app.setPanel(true);
    if (app.ui.navOpen) app.navigator.render();
    app.view.requestRender();
  }

  /** Den översta vyn på bladet under en punkt. */
  function hit(p: Vec2): Id | null {
    const d = drawing();
    if (!d) return null;
    for (let i = d.views.length - 1; i >= 0; i--) {
      const f = d.views[i].frame;
      if (p[0] >= f.minX && p[0] <= f.maxX && p[1] >= f.minY - 8 && p[1] <= f.maxY) return d.views[i].id;
    }
    return null;
  }

  /** Öppna det en vy på bladet visar. */
  function openView(ref: Id): void {
    const v = app.store.doc.views.find((x) => x.id === ref);
    if (v) {
      app.applyView(v);
      return;
    }
    const place = ref.startsWith('modell:') ? ref.slice('modell:'.length) : ref;
    const doc = app.store.doc;
    if (doc.storeys.some((s) => s.id === place)) app.goTo({ kind: 'storey', id: place });
    else if (doc.elements[place]) app.goTo({ kind: 'marker', id: place });
    else if (doc.worksheets.some((w) => w.id === place)) app.goTo({ kind: 'worksheet', id: place });
    else app.hint('Vyn finns inte längre.');
  }

  /** Flytta och markera vyerna på bladet. Dubbelklick öppnar vyn. */
  class SheetTool implements ViewTool {
    cursor = 'default';
    private dragging: { id: Id; start: Vec2; at0: Vec2; frame: Bounds; d: Vec2; guides: [Vec2, Vec2][] } | null = null;
    private hovered: Id | null = null;
    private lastUp = { id: '' as Id | null, t: 0 };

    down(p: ViewPointer): 'capture' | 'pan' | 'ignore' {
      const id = hit(p.model);
      if (!id) return 'pan';
      const sheet = app.store.doc.sheets.find((s) => s.id === app.ui.layout);
      const vp = sheet?.viewports.find((v) => v.id === id);
      const placed = drawing()?.views.find((v) => v.id === id);
      if (!vp || !placed) return 'pan';
      if (picked() !== id) pick({ kind: 'viewport', id });
      this.dragging = { id, start: p.model, at0: vp.at, frame: placed.frame, d: [0, 0], guides: [] };
      return 'capture';
    }

    drag(p: ViewPointer): void {
      const g = this.dragging;
      if (!g) return;
      let d: Vec2 = [p.model[0] - g.start[0], p.model[1] - g.start[1]];
      // Shift: bara vågrätt eller lodrätt.
      if (p.shift) d = Math.abs(d[0]) > Math.abs(d[1]) ? [d[0], 0] : [0, d[1]];
      // Fäst mot de andra vyernas kanter och mittlinjer.
      const tol = 8 / app.view.camera.scale;
      const others = (drawing()?.views ?? []).filter((v) => v.id !== g.id).map((v) => v.frame);
      const f = g.frame;
      const xs = (b: Bounds) => [b.minX, (b.minX + b.maxX) / 2, b.maxX];
      const ys = (b: Bounds) => [b.minY, (b.minY + b.maxY) / 2, b.maxY];
      const best = (mine: number[], theirs: number[]) => {
        let r: { off: number; at: number } | null = null;
        for (const m of mine) for (const t of theirs) if (Math.abs(t - m) < tol && (!r || Math.abs(t - m) < Math.abs(r.off))) r = { off: t - m, at: t };
        return r;
      };
      const moved: Bounds = { minX: f.minX + d[0], maxX: f.maxX + d[0], minY: f.minY + d[1], maxY: f.maxY + d[1] };
      const guides: [Vec2, Vec2][] = [];
      if (!p.shift || d[0] !== 0) {
        const sx = best(xs(moved), others.flatMap(xs));
        if (sx) {
          d = [d[0] + sx.off, d[1]];
          guides.push([
            [sx.at, -1e4],
            [sx.at, 1e4],
          ]);
        }
      }
      if (!p.shift || d[1] !== 0) {
        const sy = best(ys(moved), others.flatMap(ys));
        if (sy) {
          d = [d[0], d[1] + sy.off];
          guides.push([
            [-1e4, sy.at],
            [1e4, sy.at],
          ]);
        }
      }
      g.d = d;
      g.guides = guides;
      app.view.requestRender();
    }

    up(_p: ViewPointer, moved: boolean): void {
      const g = this.dragging;
      this.dragging = null;
      if (!g) return;
      const sheetId = app.ui.layout;
      if (moved && sheetId && Math.hypot(g.d[0], g.d[1]) > 0.05) {
        const r = (x: number) => Math.round(x * 10) / 10;
        updateViewport(app.store, sheetId, g.id, { at: [r(g.at0[0] + g.d[0]), r(g.at0[1] + g.d[1])] }, 'Flytta vyn på bladet');
      } else if (!moved) {
        // Dubbelklick: öppna vyn.
        const now = performance.now();
        if (this.lastUp.id === g.id && now - this.lastUp.t < 400) {
          const vp = app.store.doc.sheets.find((s) => s.id === sheetId)?.viewports.find((v) => v.id === g.id);
          if (vp) openView(vp.view);
          this.lastUp = { id: null, t: 0 };
          return;
        }
        this.lastUp = { id: g.id, t: now };
      }
      app.view.requestRender();
    }

    tap(): void {
      // Ett klick bredvid vyerna visar bladets inställningar.
      if (app.ui.layout) pick({ kind: 'sheet', id: app.ui.layout });
    }

    cancel(): void {
      this.dragging = null;
      app.view.requestRender();
    }

    hover(p: ViewPointer | null): void {
      const h = p ? hit(p.model) : null;
      if (h !== this.hovered) {
        this.hovered = h;
        this.cursor = h ? 'move' : 'default';
        app.view.svg.style.cursor = this.cursor;
        app.view.requestRender();
      }
    }

    overlay(cam: Camera): string {
      const d = drawing();
      if (!d) return '';
      const rect = (b: Bounds, cls: string) => {
        const a = cam.toScreen([b.minX, b.maxY]);
        const c = cam.toScreen([b.maxX, b.minY]);
        return `<rect class="${cls}" x="${a[0].toFixed(1)}" y="${a[1].toFixed(1)}" width="${(c[0] - a[0]).toFixed(1)}" height="${(c[1] - a[1]).toFixed(1)}"/>`;
      };
      const out: string[] = [];
      const sel = picked();
      for (const v of d.views) {
        if (v.id === this.dragging?.id) continue;
        if (v.id === sel) out.push(rect(v.frame, 'vp-frame picked'));
        else if (v.id === this.hovered) out.push(rect(v.frame, 'vp-frame hover'));
      }
      const g = this.dragging;
      if (g) {
        out.push(rect({ minX: g.frame.minX + g.d[0], maxX: g.frame.maxX + g.d[0], minY: g.frame.minY + g.d[1], maxY: g.frame.maxY + g.d[1] }, 'vp-frame moving'));
        for (const [a, b] of g.guides) {
          const s = cam.toScreen(a);
          const e = cam.toScreen(b);
          out.push(`<line class="vp-guide" x1="${s[0].toFixed(1)}" y1="${s[1].toFixed(1)}" x2="${e[0].toFixed(1)}" y2="${e[1].toFixed(1)}"/>`);
        }
      }
      return out.join('');
    }
  }

  const tool = new SheetTool();

  /**
   * Var en ny vy får plats på bladet: uppifrån till vänster, utan att lägga
   * sig på de andra vyerna eller ritningshuvudet. Svarar med mitten.
   */
  function freeSpot(sheet: Sheet, size: [number, number]): Vec2 {
    const [W, H] = paperSize(sheet);
    const area: Bounds = { minX: FRAME_MARGIN.left + 6, minY: FRAME_MARGIN.bottom + 6, maxX: W - FRAME_MARGIN.right - 6, maxY: H - FRAME_MARGIN.top - 6 };
    const taken: Bounds[] = (drawing()?.views ?? []).map((v) => ({ ...v.frame, minY: v.frame.minY - 12 }));
    taken.push({ minX: W - FRAME_MARGIN.right - TITLE_BLOCK_WIDTH, minY: FRAME_MARGIN.bottom, maxX: W, maxY: FRAME_MARGIN.bottom + TITLE_BLOCK_HEIGHT });
    const [w, h] = [size[0], size[1] + 12];
    const gap = 6;
    const free = (b: Bounds) => taken.every((t) => b.maxX + gap <= t.minX || b.minX >= t.maxX + gap || b.maxY + gap <= t.minY || b.minY >= t.maxY + gap);
    for (let y = area.maxY; y - h >= area.minY; y -= 5)
      for (let x = area.minX; x + w <= area.maxX; x += 5) {
        const b = { minX: x, maxX: x + w, minY: y - h, maxY: y };
        if (free(b)) return [x + w / 2, y - h / 2 + 6];
      }
    return [(area.minX + area.maxX) / 2, (area.minY + area.maxY) / 2];
  }

  /** Lägg en vy på ett blad. */
  function place(sheetId: Id, view: Id, scale: number): void {
    const doc = app.store.doc;
    const sheet = doc.sheets.find((s) => s.id === sheetId);
    const src = viewSource(doc, view);
    if (!sheet || !src) return;
    const b = contentBounds(cachedViewPrims(doc, src.def, { scale, autoDims: app.uiSettings.autoDims }));
    const size: [number, number] = b ? [(b.maxX - b.minX) / scale + 2 * VIEWPORT_PAD, (b.maxY - b.minY) / scale + 2 * VIEWPORT_PAD] : [40, 30];
    if (app.ui.layout !== sheetId) app.goTo({ kind: 'sheet', id: sheetId });
    const c = freeSpot(sheet, size);
    const mid: Vec2 = b ? [(b.minX + b.maxX) / 2 / scale, (b.minY + b.maxY) / 2 / scale] : [0, 0];
    const id = addViewport(app.store, sheetId, { view, scale, at: [Math.round(c[0] - mid[0]), Math.round(c[1] - mid[1])] });
    const [W, H] = paperSize(sheet);
    if (size[0] > W - 40 || size[1] > H - 30) app.hint(`Vyn är större än bladet i 1:${scale}. Välj en mindre skala eller ett större format.`, 5000);
    if (id) pick({ kind: 'viewport', id });
  }

  /** Ett nytt blad. Står man i en vy läggs den på bladet direkt. */
  function newSheet(): void {
    const id = createSheet(app.store, { name: 'Nytt blad' });
    app.goTo({ kind: 'sheet', id });
    pick({ kind: 'sheet', id });
    if (isNarrow()) {
      app.setNav(false);
      app.setPanel(true, 'full');
    }
    requestAnimationFrame(() => app.panel.el.querySelector<HTMLInputElement>('.sheet-form input[name="name"]')?.select());
    app.hint('Ett tomt blad. Lägg vyer på det i egenskaperna.', 4000);
  }

  /** Välj en bild som logga i ritningshuvudet. */
  function chooseLogo(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/svg+xml';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const url = URL.createObjectURL(file);
      try {
        const ratio = await new Promise<number>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img.naturalWidth / Math.max(1, img.naturalHeight));
          img.onerror = () => reject(new Error('Bilden kunde inte läsas.'));
          img.src = url;
        });
        setLogo(app.store, { id: newId('logga'), name: file.name, mime: file.type || 'image/png', data: base64Of(bytes), ratio: ratio || 3 });
        app.hint('Loggan syns i ritningshuvudet på alla blad.');
      } catch (err) {
        app.hint((err as Error).message, 4000);
      } finally {
        URL.revokeObjectURL(url);
      }
    });
    input.click();
  }

  const host: SheetFormHost = {
    pick,
    place,
    openView,
    chooseLogo,
    saved: () => {
      app.hint('Sparat.');
      // Formuläret ritas om med det sparade, så att Spara blir grå igen.
      app.panel.el.querySelector('.panel-body')!.innerHTML = '';
      app.panel.render();
      if (app.ui.navOpen) app.navigator.render();
    },
    closed: () => {
      app.panel.showTreeItem(null);
      if (app.ui.navOpen) app.navigator.render();
    },
    rerender: () => {
      app.panel.el.querySelector('.panel-body')!.innerHTML = '';
      app.panel.render();
    },
  };
  app.panel.sheetHost = host;

  // Högerklick på ett blad: en vy på bladet, eller bladet självt.
  app.pane2d.addEventListener(
    'contextmenu',
    (e) => {
      const sheet = app.ui.layout ? app.store.doc.sheets.find((s) => s.id === app.ui.layout) : undefined;
      if (!sheet) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const r = app.pane2d.getBoundingClientRect();
      const id = hit(app.view.camera.toModel([e.clientX - r.left, e.clientY - r.top]));
      const vp = id ? sheet.viewports.find((v) => v.id === id) : undefined;
      if (vp) {
        pick({ kind: 'viewport', id: vp.id });
        const name = vp.title || viewSource(app.store.doc, vp.view)?.name || 'Vy';
        app.ctxMenu.open(
          e.clientX,
          e.clientY,
          [
            { kind: 'header', label: name, sub: `1:${vp.scale} på ${sheet.number}` },
            { label: 'Öppna vyn', run: () => openView(vp.view) },
            { label: 'Inställningar', run: () => pick({ kind: 'viewport', id: vp.id }) },
            { kind: 'sep' },
            { label: 'Ta bort från bladet', danger: true, run: () => (removeViewport(app.store, sheet.id, vp.id), pick({ kind: 'sheet', id: sheet.id })) },
          ],
          name,
        );
      } else {
        pick({ kind: 'sheet', id: sheet.id });
        app.ctxMenu.open(
          e.clientX,
          e.clientY,
          [
            { kind: 'header', label: `${sheet.number} ${sheet.name}`, sub: 'Ritningsblad' },
            { label: 'Bladets inställningar och vyer', run: () => pick({ kind: 'sheet', id: sheet.id }) },
            { label: 'Plot/export…', run: () => app.root.querySelector<HTMLElement>('.nav-plot [data-action="plot"], .main-menu [data-action="plot"]')?.click() },
          ],
          sheet.number,
        );
      }
    },
    { capture: true },
  );

  return { drawing, tool, pick, picked, place, newSheet, openView };
}
