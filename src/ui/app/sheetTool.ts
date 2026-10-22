import type { Id } from '../../core/model';
import { moveOnSheet, setViewportCrop } from '../../core/sheets';
import { paperToModel, type PlacedView, type SheetDrawing } from '../../repr/sheet';
import type { Bounds, Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import type { AppContext } from './context';
import { GRIPS, gripAt, gripCursor, resized, snapEdge, snapMove, type Grip } from './sheetGeometry';

/** Det verktyget behöver av bladet som visas (se installSheets). */
export interface SheetToolHost {
  drawing(): SheetDrawing | null;
  viewOf(id: Id): PlacedView | undefined;
  /** Den vy på bladet som är markerad ensam, annars null. */
  pickedViewport(): Id | null;
  /** Det översta på bladet under en punkt. */
  hitAt(p: ViewPointer): Id | null;
  /** Ytorna en dragen vy eller ram fäster mot: de andra vyerna och det ritade. */
  targets(id: Id): Bounds[];
  openView(ref: Id): void;
}

/**
 * Markera på ett blad (0.8.9): som Markera i planen, med det som hör till
 * vyerna. En vy som dras ensam fäster mot de andra sakernas kanter och
 * mittlinjer och mot ritningsramen; den markerade vyn har grepp i ramen.
 * Dubbelklick på en vy öppnar den. Flera markerade (en ruta, Shift) flyttas
 * och tas bort tillsammans av markeringsverktyget.
 */
export class SheetTool implements ViewTool {
  cursor = 'default';
  private dragging: { vp: Id; start: Vec2; frame: Bounds; d: Vec2; guides: [Vec2, Vec2][]; others: Bounds[] } | null = null;
  /** Ett grepp i vyns ram som dras (0.8.7). */
  private cropping: { vp: Id; start: Vec2; frame: Bounds; grip: Grip; now: Bounds; guides: [Vec2, Vec2][]; others: Bounds[] } | null = null;
  /** Markeringsverktyget sköter det som pågår. */
  private delegated = false;
  private lastUp = { id: '' as Id | null, t: 0 };

  private readonly app: AppContext;
  private readonly host: SheetToolHost;

  constructor(app: AppContext, host: SheetToolHost) {
    this.app = app;
    this.host = host;
  }

  /** Ritningsramen på bladet som visas. */
  private paper(): Bounds | null {
    return this.host.drawing()?.frame ?? null;
  }

  /** Hur nära en kant fäster, 8 px på skärmen i mm. */
  private tolerance(): number {
    return 8 / this.app.view.camera.scale;
  }

  /** Ett grepp i den valda vyns ram under en punkt på skärmen (0.8.7). */
  private gripHit(p: ViewPointer): { vp: Id; frame: Bounds; grip: Grip } | null {
    const id = this.host.pickedViewport();
    const v = id ? this.host.viewOf(id) : undefined;
    if (!v || v.missing || !p.screen) return null;
    const cam = this.app.view.camera;
    for (const g of GRIPS) {
      const s = cam.toScreen(gripAt(v.frame, g));
      if (Math.abs(s[0] - p.screen[0]) <= 7 && Math.abs(s[1] - p.screen[1]) <= 7) return { vp: v.id, frame: v.frame, grip: g };
    }
    return null;
  }

  private get select() {
    return this.app.selectTool;
  }

  down(p: ViewPointer): 'capture' | 'pan' | 'ignore' {
    this.delegated = false;
    const g = this.gripHit(p);
    if (g) {
      this.cropping = { vp: g.vp, start: p.model, frame: g.frame, grip: g.grip, now: g.frame, guides: [], others: this.host.targets(g.vp) };
      return 'capture';
    }
    const hit = this.host.hitAt(p);
    const v = hit ? this.host.viewOf(hit) : undefined;
    // En vy ensam: egen flytt med fästning. Ingår den i en större markering flyttas allt tillsammans.
    if (v && !p.shift && !p.mod && !(this.app.selection.has(v.id) && this.app.selection.size > 1)) {
      if (this.host.pickedViewport() !== v.id) this.app.selection.set([v.id]);
      this.dragging = { vp: v.id, start: p.model, frame: v.frame, d: [0, 0], guides: [], others: this.host.targets(v.id) };
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
        const r = snapEdge(raw[key], axis, c.others, this.paper(), this.tolerance());
        raw[key] = r.at;
        if (r.guide) guides.push(r.guide);
      };
      if (c.grip.x < 0) edge('minX', 0);
      if (c.grip.x > 0) edge('maxX', 0);
      if (c.grip.y < 0) edge('minY', 1);
      if (c.grip.y > 0) edge('maxY', 1);
      c.now = resized(raw, { x: 0, y: 0 }, [0, 0]);
      c.guides = guides;
      this.app.view.requestRender();
      return;
    }
    const g = this.dragging;
    if (g) {
      const r = snapMove(g.frame, [p.model[0] - g.start[0], p.model[1] - g.start[1]], p.shift, g.others, this.paper(), this.tolerance());
      g.d = r.d;
      g.guides = r.guides;
      this.app.view.requestRender();
      return;
    }
    if (this.delegated) this.select.drag(p);
  }

  up(p: ViewPointer, moved: boolean): void {
    const sheetId = this.app.ui.layout;
    const c = this.cropping;
    this.cropping = null;
    if (c) {
      const vp = this.host.viewOf(c.vp);
      const same = (['minX', 'minY', 'maxX', 'maxY'] as const).every((k) => Math.abs(c.now[k] - c.frame[k]) < 0.05);
      if (moved && sheetId && vp && !same) setViewportCrop(this.app.store, sheetId, c.vp, paperToModel(c.now, vp.at, vp.scale));
      this.app.smartMenu.refresh(true);
      this.app.view.requestRender();
      return;
    }
    const g = this.dragging;
    this.dragging = null;
    if (g) {
      if (moved && Math.hypot(g.d[0], g.d[1]) > 0.05) moveOnSheet(this.app.store, [g.vp], g.d);
      else if (!moved) {
        // Dubbelklick på en vy: öppna den.
        const now = performance.now();
        if (this.lastUp.id === g.vp && now - this.lastUp.t < 400) {
          const vp = this.app.store.doc.sheets.find((s) => s.id === sheetId)?.viewports.find((v) => v.id === g.vp);
          this.app.smartMenu.hide();
          this.lastUp = { id: null, t: 0 };
          if (vp) this.host.openView(vp.view);
          return;
        }
        this.lastUp = { id: g.vp, t: now };
      }
      this.app.view.requestRender();
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
    this.app.view.requestRender();
  }

  hover(p: ViewPointer | null): void {
    const grip = p ? (this.gripHit(p)?.grip ?? null) : null;
    this.select.hover(grip ? null : p);
    const h = this.select.hoverId;
    this.cursor = grip ? gripCursor(grip) : h && this.host.viewOf(h) ? 'move' : this.select.cursor;
    this.app.view.svg.style.cursor = this.cursor;
    this.app.view.requestRender();
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
    const id = this.host.pickedViewport();
    const v = id && !this.app.modifier.busy ? this.host.viewOf(id) : undefined;
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
