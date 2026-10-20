import { deleteElements } from '../../core/commands';
import type { Id, Sheet } from '../../core/model';
import { addViewport, createMaster, createSheet, FRAME_MARGIN, mastersOf, moveOnSheet, paperSize, setViewportCrop, today } from '../../core/sheets';
import { buildSheet, cachedViewPrims, contentBounds, paperToModel, VIEWPORT_PAD, viewSource, type PlacedView, type SheetDrawing } from '../../repr/sheet';
import { boundsOf, type Bounds, type Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import { pickAt } from '../../view2d/pick';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import { isNarrow } from '../sheet';
import type { SheetFormHost } from '../sheetForms';
import type { SmartMenuCustom } from '../smartMenu';
import { pxToMm } from '../tools/host';
import type { AppContext } from './context';
import { screenBox } from './selectionPlace';

/** Ett grepp i en vys ram: vilka kanter det flyttar (0.8.7). */
type Grip = { x: -1 | 0 | 1; y: -1 | 0 | 1 };
const GRIPS: Grip[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
];
const gripCursor = (g: Grip) => (g.x === 0 ? 'ns-resize' : g.y === 0 ? 'ew-resize' : g.x === g.y ? 'nesw-resize' : 'nwse-resize');
const gripAt = (b: Bounds, g: Grip): Vec2 => [g.x < 0 ? b.minX : g.x > 0 ? b.maxX : (b.minX + b.maxX) / 2, g.y < 0 ? b.minY : g.y > 0 ? b.maxY : (b.minY + b.maxY) / 2];
/** Ramen med greppets kanter flyttade, aldrig mindre än 5 mm. */
function resized(b: Bounds, g: Grip, d: Vec2): Bounds {
  const r = { ...b };
  const min = 5;
  if (g.x < 0) r.minX = Math.min(b.minX + d[0], b.maxX - min);
  if (g.x > 0) r.maxX = Math.max(b.maxX + d[0], b.minX + min);
  if (g.y < 0) r.minY = Math.min(b.minY + d[1], b.maxY - min);
  if (g.y > 0) r.maxY = Math.max(b.maxY + d[1], b.minY + min);
  return r;
}

/**
 * Ritningsbladen i appen (0.8 del 3): bladet som visas, verktyget som
 * markerar och flyttar på det, att lägga en vy på ett blad, nya blad och
 * mallblad (0.8.8) och formulären i egenskapspanelen.
 *
 * Sedan 0.8.9 är bladet en yta som ett mallblad: linjer, ytor, text och
 * bilder ritas på det med de vanliga verktygen (elementen har `space` satt
 * till bladets id). Vyerna på bladet markeras som de: deras id ligger i
 * `selection`, så att vyer och ritade objekt markeras, flyttas och tas bort
 * tillsammans (`moveElements` och `deleteElements` känner igen vyerna).
 *
 * På ett blad är koordinaterna mm på papperet och ritningsskalan 1:1, så
 * att texter och linjer får sin storlek på papper.
 */
export function installSheets(app: AppContext) {
  let last: { doc: unknown; sheet: Sheet; autoDims: boolean; day: string; drawing: SheetDrawing } | null = null;

  /** Bladet som visas, ritat. Sparas tills projektet eller bladet ändras. */
  function drawing(): SheetDrawing | null {
    const sheet = app.ui.layout ? app.store.doc.sheets.find((s) => s.id === app.ui.layout) : undefined;
    if (!sheet) return null;
    const doc = app.store.doc;
    const autoDims = app.uiSettings.autoDims;
    const day = today();
    if (last && last.doc === doc && last.sheet === sheet && last.autoDims === autoDims && last.day === day) return last.drawing;
    const d = buildSheet(doc, sheet, { autoDims, today: day });
    last = { doc, sheet, autoDims, day, drawing: d };
    return d;
  }

  const viewOf = (id: Id): PlacedView | undefined => drawing()?.views.find((v) => v.id === id);

  /** Den vy på bladet som är markerad ensam, annars null. */
  function pickedViewport(): Id | null {
    if (!app.ui.layout || app.selection.size !== 1) return null;
    const id = app.selection.list()[0];
    return viewOf(id) ? id : null;
  }

  /** Visa bladet i egenskapspanelen, eller markera en vy på det. */
  function pick(item: { kind: 'sheet' | 'viewport'; id: Id; also?: readonly Id[] } | null): void {
    if (item?.kind === 'viewport') {
      app.panel.showTreeItem(null);
      app.selection.set([item.id]);
    } else {
      app.selection.clear();
      app.panel.showTreeItem(item);
    }
    if (item && !isNarrow() && !app.ui.panelOpen) app.setPanel(true);
    if (app.ui.navOpen) app.navigator.render();
    if (app.smartMenu.custom && item?.kind !== 'viewport') app.smartMenu.hide();
    app.view.requestRender();
  }

  // Inget markerat på ett blad: panelen visar bladet. En ensam markerad vy visar vyns formulär.
  app.selection.subscribe(() => {
    if (!app.ui.layout) return;
    if (app.selection.size === 0 && app.panel.treeItem?.id !== app.ui.layout) app.panel.showTreeItem({ kind: 'sheet', id: app.ui.layout });
  });
  app.panel.selectionItem = () => {
    const id = pickedViewport();
    return id ? { kind: 'viewport', id } : null;
  };

  /** Det översta på bladet under en punkt: det ritade ligger över vyerna. */
  function hitAt(p: ViewPointer): Id | null {
    const d = drawing();
    if (!d) return null;
    return pickAt(d.pickables, p.model, pxToMm(app.host, p.pointerType === 'touch' ? 14 : 6), 1);
  }

  /** Ytorna på bladet som en flyttad vy fäster mot: de andra vyerna och det ritade. */
  function framesBut(id: Id): Bounds[] {
    const d = drawing();
    if (!d) return [];
    const sel = new Set(app.selection.list());
    const out: Bounds[] = d.views.filter((v) => v.id !== id).map((v) => v.frame);
    for (const pk of d.pickables) {
      if (pk.id === id || sel.has(pk.id) || viewOf(pk.id)) continue;
      const b = boundsOf(pk.prims);
      if (b) out.push(b);
    }
    return out;
  }

  /**
   * Fäst en flyttad yta mot de andra sakernas kanter och mittlinjer och mot
   * ritningsramen. Svarar med förflyttningen och stödlinjerna.
   */
  function snapMove(id: Id, f: Bounds, d: Vec2, shift: boolean): { d: Vec2; guides: [Vec2, Vec2][] } {
    if (shift) d = Math.abs(d[0]) > Math.abs(d[1]) ? [d[0], 0] : [0, d[1]];
    const dr = drawing();
    const tol = 8 / app.view.camera.scale;
    const others = framesBut(id);
    const xs = (b: Bounds) => [b.minX, (b.minX + b.maxX) / 2, b.maxX];
    const ys = (b: Bounds) => [b.minY, (b.minY + b.maxY) / 2, b.maxY];
    const fx = dr ? [dr.frame.minX, dr.frame.maxX] : [];
    const fy = dr ? [dr.frame.minY, dr.frame.maxY] : [];
    const best = (mine: number[], theirs: number[]) => {
      let r: { off: number; at: number } | null = null;
      for (const m of mine) for (const t of theirs) if (Math.abs(t - m) < tol && (!r || Math.abs(t - m) < Math.abs(r.off))) r = { off: t - m, at: t };
      return r;
    };
    const moved: Bounds = { minX: f.minX + d[0], maxX: f.maxX + d[0], minY: f.minY + d[1], maxY: f.maxY + d[1] };
    const guides: [Vec2, Vec2][] = [];
    if (!shift || d[0] !== 0) {
      const sx = best(xs(moved), [...others.flatMap(xs), ...fx]);
      if (sx) {
        d = [d[0] + sx.off, d[1]];
        guides.push([
          [sx.at, -1e4],
          [sx.at, 1e4],
        ]);
      }
    }
    if (!shift || d[1] !== 0) {
      const sy = best(ys(moved), [...others.flatMap(ys), ...fy]);
      if (sy) {
        d = [d[0], d[1] + sy.off];
        guides.push([
          [-1e4, sy.at],
          [1e4, sy.at],
        ]);
      }
    }
    return { d, guides };
  }

  /** Ett grepp i den valda vyns ram under en punkt på skärmen (0.8.7). */
  function gripHit(p: ViewPointer): { vp: Id; frame: Bounds; grip: Grip } | null {
    const id = pickedViewport();
    const v = id ? viewOf(id) : undefined;
    if (!v || v.missing || !p.screen) return null;
    const cam = app.view.camera;
    for (const g of GRIPS) {
      const s = cam.toScreen(gripAt(v.frame, g));
      if (Math.abs(s[0] - p.screen[0]) <= 7 && Math.abs(s[1] - p.screen[1]) <= 7) return { vp: v.id, frame: v.frame, grip: g };
    }
    return null;
  }

  /** Fäst en dragen kant i vyns ram mot de andra sakernas kanter och ritningsramen. */
  function snapEdge(id: Id, value: number, axis: 0 | 1): { at: number; guide: [Vec2, Vec2] | null } {
    const dr = drawing();
    if (!dr) return { at: value, guide: null };
    const tol = 8 / app.view.camera.scale;
    const others = framesBut(id);
    const lines = axis === 0 ? [dr.frame.minX, dr.frame.maxX, ...others.flatMap((b) => [b.minX, b.maxX])] : [dr.frame.minY, dr.frame.maxY, ...others.flatMap((b) => [b.minY, b.maxY])];
    let best: number | null = null;
    for (const l of lines) if (Math.abs(l - value) < tol && (best === null || Math.abs(l - value) < Math.abs(best - value))) best = l;
    if (best === null) return { at: value, guide: null };
    return { at: best, guide: axis === 0 ? [[best, -1e4], [best, 1e4]] : [[-1e4, best], [1e4, best]] };
  }

  /** Återställ vyns ram till innehållet. */
  function resetCrop(vpId: Id): void {
    if (app.ui.layout) setViewportCrop(app.store, app.ui.layout, vpId, null);
    app.smartMenu.refresh(true);
  }

  /**
   * Smartmenyn för en ensam markerad vy på bladet. Flytta går genom
   * Modifiera som för andra objekt.
   */
  function menuFor(vpId: Id): SmartMenuCustom | null {
    const sheet = app.store.doc.sheets.find((s) => s.id === app.ui.layout);
    const vp = sheet?.viewports.find((v) => v.id === vpId);
    if (!sheet || !vp) return null;
    const alive = () => pickedViewport() === vpId;
    const anchor = () => {
      const f = viewOf(vpId)?.frame;
      return f ? screenBox(app.view, app.pane2d, { ...f, minY: f.minY - 8 }) : null;
    };
    return {
      title: vp.title || viewSource(app.store.doc, vp.view)?.name || 'Vy',
      sub: `1:${vp.scale} på ${sheet.number}`,
      buttons: [
        { id: 'move', label: 'Flytta', icon: 'move', pressed: app.modifier.active === 'move' },
        { id: 'open', label: 'Öppna vyn', icon: 'navigator' },
        // Kort i menyn; formuläret säger "Återställ ramen till innehållet" (0.8.9).
        ...(vp.crop ? [{ id: 'reset-crop', label: 'Återställ ram', icon: 'fit' as const }] : []),
        { id: 'props', label: 'Egenskaper', icon: 'properties' },
        { id: 'remove', label: 'Ta bort', icon: 'trash', danger: true },
      ],
      anchor,
      alive,
      run: (id) => menuAction(vpId, id),
    };
  }

  function menuAction(vpId: Id, id: string): void {
    switch (id) {
      case 'move':
        app.modifier.chooseRail('move');
        break;
      case 'props':
        if (!app.ui.panelOpen) app.setPanel(true);
        break;
      case 'reset-crop':
        resetCrop(vpId);
        break;
      case 'open': {
        const vp = app.store.doc.sheets.find((s) => s.id === app.ui.layout)?.viewports.find((v) => v.id === vpId);
        if (vp) openView(vp.view);
        break;
      }
      case 'remove':
        app.smartMenu.hide();
        app.selection.clear();
        deleteElements(app.store, [vpId]);
        break;
    }
  }

  // Smartmenyn för en ensam vy kommer härifrån; för det ritade och för flera markerade som vanligt.
  app.smartMenu.customFor = () => {
    const id = pickedViewport();
    return id && !app.modifier.busy ? menuFor(id) : null;
  };

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

  /**
   * Markera på ett blad (0.8.9): som Markera i planen, med det som hör till
   * vyerna. En vy som dras ensam fäster mot de andra sakernas kanter och
   * mittlinjer och mot ritningsramen; den markerade vyn har grepp i ramen.
   * Dubbelklick på en vy öppnar den. Flera markerade (en ruta, Shift) flyttas
   * och tas bort tillsammans av markeringsverktyget.
   */
  class SheetTool implements ViewTool {
    cursor = 'default';
    private dragging: { vp: Id; start: Vec2; frame: Bounds; d: Vec2; guides: [Vec2, Vec2][] } | null = null;
    /** Ett grepp i vyns ram som dras (0.8.7). */
    private cropping: { vp: Id; start: Vec2; frame: Bounds; grip: Grip; now: Bounds; guides: [Vec2, Vec2][] } | null = null;
    /** Markeringsverktyget sköter det som pågår. */
    private delegated = false;
    private lastUp = { id: '' as Id | null, t: 0 };

    private get select() {
      return app.selectTool;
    }

    down(p: ViewPointer): 'capture' | 'pan' | 'ignore' {
      this.delegated = false;
      const g = gripHit(p);
      if (g) {
        this.cropping = { vp: g.vp, start: p.model, frame: g.frame, grip: g.grip, now: g.frame, guides: [] };
        return 'capture';
      }
      const hit = hitAt(p);
      const v = hit ? viewOf(hit) : undefined;
      // En vy ensam: egen flytt med fästning. Ingår den i en större markering flyttas allt tillsammans.
      if (v && !p.shift && !p.mod && !(app.selection.has(v.id) && app.selection.size > 1)) {
        if (pickedViewport() !== v.id) app.selection.set([v.id]);
        this.dragging = { vp: v.id, start: p.model, frame: v.frame, d: [0, 0], guides: [] };
        return 'capture';
      }
      this.delegated = true;
      return this.select.down(p);
    }

    drag(p: ViewPointer): void {
      const c = this.cropping;
      if (c) {
        const d: Vec2 = [p.model[0] - c.start[0], p.model[1] - c.start[1]];
        const raw = resized(c.frame, c.grip, d);
        const guides: [Vec2, Vec2][] = [];
        const edge = (key: keyof Bounds, axis: 0 | 1) => {
          const r = snapEdge(c.vp, raw[key], axis);
          raw[key] = r.at;
          if (r.guide) guides.push(r.guide);
        };
        if (c.grip.x < 0) edge('minX', 0);
        if (c.grip.x > 0) edge('maxX', 0);
        if (c.grip.y < 0) edge('minY', 1);
        if (c.grip.y > 0) edge('maxY', 1);
        c.now = resized(raw, { x: 0, y: 0 }, [0, 0]);
        c.guides = guides;
        app.view.requestRender();
        return;
      }
      const g = this.dragging;
      if (g) {
        const r = snapMove(g.vp, g.frame, [p.model[0] - g.start[0], p.model[1] - g.start[1]], p.shift);
        g.d = r.d;
        g.guides = r.guides;
        app.view.requestRender();
        return;
      }
      if (this.delegated) this.select.drag(p);
    }

    up(p: ViewPointer, moved: boolean): void {
      const sheetId = app.ui.layout;
      const c = this.cropping;
      this.cropping = null;
      if (c) {
        const vp = viewOf(c.vp);
        const same = (['minX', 'minY', 'maxX', 'maxY'] as const).every((k) => Math.abs(c.now[k] - c.frame[k]) < 0.05);
        if (moved && sheetId && vp && !same) setViewportCrop(app.store, sheetId, c.vp, paperToModel(c.now, vp.at, vp.scale));
        app.smartMenu.refresh(true);
        app.view.requestRender();
        return;
      }
      const g = this.dragging;
      this.dragging = null;
      if (g) {
        if (moved && Math.hypot(g.d[0], g.d[1]) > 0.05) moveOnSheet(app.store, [g.vp], g.d);
        else if (!moved) {
          // Dubbelklick på en vy: öppna den.
          const now = performance.now();
          if (this.lastUp.id === g.vp && now - this.lastUp.t < 400) {
            const vp = app.store.doc.sheets.find((s) => s.id === sheetId)?.viewports.find((v) => v.id === g.vp);
            app.smartMenu.hide();
            this.lastUp = { id: null, t: 0 };
            if (vp) openView(vp.view);
            return;
          }
          this.lastUp = { id: g.vp, t: now };
        }
        app.view.requestRender();
        return;
      }
      if (this.delegated) this.select.up(p, moved);
      this.delegated = false;
    }

    tap(p: ViewPointer): void {
      this.select.tap(p);
    }

    cycle(back = false): boolean {
      return this.select.cycle(back);
    }

    cancel(): void {
      this.dragging = null;
      this.cropping = null;
      this.select.cancel();
      app.view.requestRender();
    }

    hover(p: ViewPointer | null): void {
      const grip = p ? (gripHit(p)?.grip ?? null) : null;
      this.select.hover(grip ? null : p);
      const h = this.select.hoverId;
      this.cursor = grip ? gripCursor(grip) : h && viewOf(h) ? 'move' : this.select.cursor;
      app.view.svg.style.cursor = this.cursor;
      app.view.requestRender();
    }

    overlay(cam: Camera): string {
      const rect = (b: Bounds, cls: string) => {
        const a = cam.toScreen([b.minX, b.maxY]);
        const c = cam.toScreen([b.maxX, b.minY]);
        return `<rect class="${cls}" x="${a[0].toFixed(1)}" y="${a[1].toFixed(1)}" width="${(c[0] - a[0]).toFixed(1)}" height="${(c[1] - a[1]).toFixed(1)}"/>`;
      };
      const line = ([a, e]: [Vec2, Vec2]) => {
        const s1 = cam.toScreen(a);
        const s2 = cam.toScreen(e);
        return `<line class="vp-guide" x1="${s1[0].toFixed(1)}" y1="${s1[1].toFixed(1)}" x2="${s2[0].toFixed(1)}" y2="${s2[1].toFixed(1)}"/>`;
      };
      const out: string[] = [this.select.overlay(cam)];
      const g = this.dragging && Math.hypot(this.dragging.d[0], this.dragging.d[1]) > 0 ? this.dragging : null;
      if (g) {
        const f = g.frame;
        out.push(rect({ minX: f.minX + g.d[0], maxX: f.maxX + g.d[0], minY: f.minY + g.d[1], maxY: f.maxY + g.d[1] }, 'vp-frame moving'));
        out.push(...g.guides.map(line));
        return out.join('');
      }
      // Greppen i den markerade vyns ram (0.8.7).
      const id = pickedViewport();
      const v = id && !app.modifier.busy ? viewOf(id) : undefined;
      if (v && !v.missing) {
        const c = this.cropping;
        const b = c ? c.now : v.frame;
        if (c) out.push(rect(b, 'vp-frame moving'));
        for (const gr of GRIPS) {
          const s = cam.toScreen(gripAt(b, gr));
          out.push(`<rect class="vp-grip" x="${(s[0] - 4).toFixed(1)}" y="${(s[1] - 4).toFixed(1)}" width="8" height="8"/>`);
        }
        out.push(...(c?.guides ?? []).map(line));
      }
      return out.join('');
    }
  }

  const tool = new SheetTool();

  /**
   * Var en ny vy får plats på bladet: uppifrån till vänster, utan att lägga
   * sig på de andra vyerna eller det som är ritat. Svarar med mitten.
   */
  function freeSpot(sheet: Sheet, size: [number, number]): Vec2 {
    const [W, H] = paperSize(sheet);
    const area: Bounds = { minX: FRAME_MARGIN.left + 6, minY: FRAME_MARGIN.bottom + 6, maxX: W - FRAME_MARGIN.right - 6, maxY: H - FRAME_MARGIN.top - 6 };
    const taken: Bounds[] = (drawing()?.views ?? []).map((v) => ({ ...v.frame, minY: v.frame.minY - 12 }));
    for (const pk of drawing()?.pickables ?? []) {
      const b = viewOf(pk.id) ? null : boundsOf(pk.prims);
      if (b) taken.push(b);
    }
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

  /** Ett nytt blad med projektets förvalda mallblad (0.8.8). */
  function newSheet(): void {
    const id = createSheet(app.store, { name: 'Nytt blad' });
    app.goTo({ kind: 'sheet', id });
    pick({ kind: 'sheet', id });
    if (isNarrow()) {
      app.setNav(false);
      app.setPanel(true, 'full');
    }
    requestAnimationFrame(() => app.panel.el.querySelector<HTMLInputElement>('.sheet-form input[name="name"]')?.select());
    const master = app.store.doc.sheets.find((s) => s.id === id)?.master;
    app.hint(master ? 'Ett nytt blad med projektets mallblad. Lägg vyer på det i egenskaperna.' : 'Ett blankt blad. Välj mallblad och lägg vyer på det i egenskaperna.', 4000);
  }

  /** Ett nytt mallblad (0.8.8), A3 liggande, öppnat för att rita på. */
  function newMaster(): void {
    const n = mastersOf(app.store.doc).length + 1;
    const id = createMaster(app.store, { name: `Mallblad ${n}` });
    app.goTo({ kind: 'worksheet', id });
    pick(null);
    app.panel.showTreeItem({ kind: 'worksheet', id });
    if (!isNarrow() && !app.ui.panelOpen) app.setPanel(true);
    if (app.ui.navOpen) app.navigator.render();
    app.hint('Ett tomt mallblad. Rita ram, huvud och texter med smarttext i mm på papperet; blad som använder mallen visar dem.', 5000);
  }

  const host: SheetFormHost = {
    pick,
    place,
    openView,
    openMaster: (id) => app.goTo({ kind: 'worksheet', id }),
    startText: () => {
      app.setTool('text');
      requestAnimationFrame(() => app.toolOptions.querySelector<HTMLInputElement>('#text-value')?.select());
    },
    startDraw: () => app.setTool('draw2d'),
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

  // Högerklick på ett blad: smartmenyn för en vy, den vanliga menyn för det ritade, annars bladets meny.
  app.pane2d.addEventListener(
    'contextmenu',
    (e) => {
      const sheet = app.ui.layout ? app.store.doc.sheets.find((s) => s.id === app.ui.layout) : undefined;
      if (!sheet) return;
      const r = app.view.svg.getBoundingClientRect();
      const screen: Vec2 = [e.clientX - r.left, e.clientY - r.top];
      const hit = hitAt({ model: app.view.camera.toModel(screen), screen, pointerType: 'mouse', shift: false, mod: false, alt: false } as ViewPointer);
      if (hit && !viewOf(hit)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (hit) {
        app.selection.set([hit]);
        const m = menuFor(hit);
        if (m) app.smartMenu.showCustom(m, e.clientX, e.clientY);
        return;
      }
      app.smartMenu.hide();
      pick({ kind: 'sheet', id: sheet.id });
      app.ctxMenu.open(
        e.clientX,
        e.clientY,
        [
          { kind: 'header', label: `${sheet.number} ${sheet.name}`, sub: 'Ritningsblad' },
          { label: 'Bladets inställningar och vyer', run: () => pick({ kind: 'sheet', id: sheet.id }) },
          ...(sheet.master ? [{ label: 'Öppna mallbladet', run: () => app.goTo({ kind: 'worksheet', id: sheet.master! }) }] : []),
          { label: 'Skriv text på bladet', hint: 'T', run: () => host.startText() },
          { label: 'Rita linjer och ytor på bladet', run: () => host.startDraw() },
          { label: 'Plot/export…', run: () => app.root.querySelector<HTMLElement>('.nav-plot [data-action="plot"], .main-menu [data-action="plot"]')?.click() },
        ],
        sheet.number,
      );
    },
    { capture: true },
  );

  return {
    drawing,
    tool,
    resetCrop,
    pick,
    pickedViewport,
    place,
    newSheet,
    newMaster,
    openView,
  };
}
