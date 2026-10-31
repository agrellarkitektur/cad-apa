import { addElements } from '../../core/commands';
import { isSite } from '../../core/model';
import { tidyBulges } from '../../elements/groundLines';
import { bandBetween as bandBetweenPreview, SPIRAL, stairGeometry, STAIR_WIDTH, stairOutline, type StairParams, type StairRefSide } from '../../elements/stairGeometry';
import { storeyAbove } from '../../elements/stair';
import { dist } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import type { PointTaker } from '../pointInput';
import { ChainInput } from './chainInput';
import { pxToMm, type ToolHost } from './host';
import { snapMarker } from './overlay';
import { roundMm, snap, type SnapResult } from './snap';

/**
 * Trappan (0.11): rita referenslinjen punkt för punkt, med bågar (Båge, G)
 * som rampens. Formen är linjen: en rak trappa är två punkter, en L-trappa
 * tre. Dubbelklick, Enter eller Klar avslutar. Under ritandet syns trappan
 * med sina steg, räknade ur stigningen till våningen ovanför.
 *
 * Spiraltrappan (0.11.5) ritas numeriskt: inner- och ytterdiameter, grader
 * och varvriktning i verktygsraden, sedan två klick, mitten och riktningen
 * där trappan börjar.
 */
export interface SpiralOptions {
  inner: number;
  outer: number;
  sweep: number;
  dir: 'ccw' | 'cw';
}

export class StairTool implements ViewTool, PointTaker {
  cursor = 'crosshair';
  private host: ToolHost;
  readonly chain = new ChainInput();
  private lastUp = { t: 0, at: [0, 0] as Vec2 };
  private current: SnapResult | null = null;
  /** Bredden och var referenslinjen ligger. */
  options: { width: number; refSide: StairRefSide; form: 'line' | 'spiral'; spiral: SpiralOptions } = {
    width: STAIR_WIDTH,
    refSide: 'center',
    form: 'line',
    spiral: { ...SPIRAL, dir: 'ccw' },
  };
  /** Spiraltrappans mitt, när den är klickad. */
  private centre: Vec2 | null = null;
  lockAngle: number | null = null;
  onCreated?: (id: string) => void;
  onChange?: () => void;

  constructor(host: ToolHost) {
    this.host = host;
  }

  get started(): boolean {
    return this.chain.count > 0 || !!this.centre;
  }

  /** Byt mellan linje och spiral. */
  setForm(form: 'line' | 'spiral'): void {
    this.reset();
    this.options.form = form;
    this.onChange?.();
    this.host.view.requestRender();
  }

  get arc(): boolean {
    return this.chain.arc;
  }

  setArc(on: boolean): void {
    this.chain.arc = on;
    this.onChange?.();
    this.host.view.requestRender();
  }

  down(): 'capture' {
    return 'capture';
  }

  drag(p: ViewPointer): void {
    this.track(p);
  }

  hover(p: ViewPointer | null): void {
    if (p) this.track(p);
  }

  private track(p: ViewPointer): void {
    this.current = snap({ cursor: p.model, segments: this.host.snapSegments(), tol: pxToMm(this.host, p.pointerType === 'touch' ? 18 : 10) });
  }

  up(p: ViewPointer): void {
    this.track(p);
    const now = performance.now();
    const double = now - this.lastUp.t < 350 && dist(p.screen, this.lastUp.at) < 8;
    this.lastUp = { t: now, at: p.screen };
    if (this.options.form === 'line' && double && this.chain.count >= 2 && !this.chain.waiting) {
      this.finish();
      return;
    }
    this.click(roundMm(this.current?.point ?? p.model));
  }

  private click(pt: Vec2): void {
    if (isSite(this.host.storey())) {
      this.host.hint('Trappor ritas på en våning. Öppna en våning i projektträdet.');
      return;
    }
    if (this.options.form === 'spiral') {
      if (!this.centre) this.centre = pt;
      else if (dist(pt, this.centre) > 1) {
        const c = this.centre;
        this.centre = null;
        this.createSpiral(c, pt);
      }
      this.onChange?.();
      return;
    }
    this.chain.click(pt, -1);
    this.onChange?.();
  }

  /** Spiraltrappans parametrar med mitten och en punkt i startriktningen. */
  private spiralParams(c: Vec2, at: Vec2): Record<string, unknown> {
    const o = this.options.spiral;
    const r = Math.max(1, (o.inner + o.outer) / 4);
    const d = Math.hypot(at[0] - c[0], at[1] - c[1]) || 1;
    const start: [number, number] = [Math.round(c[0] + ((at[0] - c[0]) / d) * r), Math.round(c[1] + ((at[1] - c[1]) / d) * r)];
    return {
      line: [[Math.round(c[0]), Math.round(c[1])], start],
      width: Math.round((o.outer - o.inner) / 2),
      spiral: { inner: o.inner, outer: o.outer, sweep: o.sweep, ...(o.dir === 'cw' ? { dir: 'cw' } : {}) },
    };
  }

  /** En spiraltrappa runt mitten `c`, som börjar i riktningen mot `at`. */
  createSpiral(c: Vec2, at: Vec2): boolean {
    if (isSite(this.host.storey())) return false;
    const params = this.spiralParams(c, at);
    const [el] = addElements(this.host.store, [{ type: 'Stair', storey: this.host.storey(), tags: [], params, props: {} }], this.host.activeState(), 'Lägg till spiraltrappa');
    this.onCreated?.(el.id);
    return true;
  }

  /** Stigningen till våningen ovanför, eller våningshöjden. */
  private rise(): number {
    const doc = this.host.store.doc;
    const s = doc.storeys.find((x) => x.id === this.host.storey());
    return s?.height ?? 2700;
  }

  /** Avsluta linjen: en trappa med den. */
  finish(): void {
    if (this.chain.waiting) this.chain.undo();
    const { points: line, bulges: raw } = this.chain.result();
    const bulges = tidyBulges(raw, line.length);
    this.chain.reset();
    this.onChange?.();
    if (line.length < 2) return;
    this.createLine(line, bulges);
  }

  /** En trappa längs en färdig linje (också smartspöt). */
  createLine(line: Vec2[], bulges?: number[]): boolean {
    const pts = line.map((q) => [Math.round(q[0]), Math.round(q[1])] as [number, number]);
    if (pts.length < 2 || isSite(this.host.storey())) return false;
    const params: Record<string, unknown> = { line: pts, width: this.options.width, ...(bulges ? { bulges } : {}), ...(this.options.refSide !== 'center' ? { refSide: this.options.refSide } : {}) };
    const [el] = addElements(this.host.store, [{ type: 'Stair', storey: this.host.storey(), tags: [], params, props: {} }], this.host.activeState(), 'Lägg till trappa');
    this.onCreated?.(el.id);
    return true;
  }

  undoPoint(): void {
    if (this.centre) this.centre = null;
    else this.chain.undo();
    this.onChange?.();
    this.host.view.requestRender();
  }

  lastPoint(): Vec2 | undefined {
    if (this.options.form === 'spiral') return this.centre ?? undefined;
    return this.chain.last();
  }

  cursorPoint(): Vec2 | undefined {
    return this.current?.point;
  }

  takePoint(p: Vec2): void {
    this.click(roundMm(p));
    this.host.view.requestRender();
  }

  hintText(): string {
    if (this.options.form === 'spiral') {
      const o = this.options.spiral;
      const turn = o.dir === 'cw' ? 'medurs' : 'moturs';
      return this.centre ? `Klicka i riktningen där trappan börjar. Den går ${o.sweep}° ${turn} uppåt.` : 'Klicka spiraltrappans mitt.';
    }
    if (this.chain.waiting) return 'Klicka en punkt på bågen.';
    if (this.chain.arc && this.chain.count) return 'Klicka var bågen slutar.';
    if (!this.chain.count) return 'Klicka trappans början. Referenslinjen går i gångriktningen, uppåt; en sväng blir kilsteg.';
    const above = storeyAbove(this.host.store.doc, this.host.storey());
    return `Klicka nästa punkt. Dubbelklick, Enter eller Klar avslutar. Stigningen går ${above ? `till ${above.name}` : 'våningshöjden'}.`;
  }

  cancel(): void {}

  reset(): void {
    this.chain.reset();
    this.centre = null;
    this.lockAngle = null;
    this.onChange?.();
  }

  /** Trappan som den blir, med stegen. */
  private previewStair(cam: Camera, p: StairParams): string[] {
    const out: string[] = [];
    const g = stairGeometry(p);
    if (!g) return out;
    const n = g.turn ? Math.max(1, Math.ceil((g.length / g.turn) * 2)) : 1;
    for (let i = 0; i < n; i++) {
      const ring = (n === 1 ? stairOutline(g) : bandBetweenPreview(g, (g.length * i) / n, (g.length * (i + 1)) / n)).map((q) => cam.toScreen(q));
      out.push(`<path d="M${ring.map((q) => q.join(' ')).join('L')}Z" class="rubber"/>`);
    }
    for (const u of g.risers) {
      const r = g.ribAt(u);
      const a = cam.toScreen(r.L);
      const b = cam.toScreen(r.R);
      out.push(`<path d="M${a.join(' ')}L${b.join(' ')}" class="rubber"/>`);
    }
    return out;
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    if (this.options.form === 'spiral') {
      const c = this.centre;
      const at = this.current?.point;
      if (c && at && dist(c, at) > 1) out.push(...this.previewStair(cam, { ...(this.spiralParams(c, at) as unknown as StairParams), rise: this.rise() }));
      if (c) {
        const q = cam.toScreen(c);
        out.push(`<path d="M${q[0] - 6} ${q[1]}L${q[0] + 6} ${q[1]}M${q[0]} ${q[1] - 6}L${q[0]} ${q[1] + 6}" class="rubber"/>`);
      }
      if (this.current) out.push(snapMarker(cam, this.current));
      return out.join('');
    }
    if (this.chain.count) {
      const raw = this.chain.preview(this.current?.point);
      const pts = raw.map((q) => cam.toScreen(q));
      if (pts.length >= 2) out.push(`<path d="M${pts.map((q) => q.join(' ')).join('L')}" class="rubber"/>`);
      // Trappan med stegen, som den blir.
      if (raw.length >= 2) {
        const p: StairParams = { line: raw.map((q) => [q[0], q[1]]), width: this.options.width, refSide: this.options.refSide, rise: this.rise() };
        out.push(...this.previewStair(cam, p));
      }
    }
    if (this.current) out.push(snapMarker(cam, this.current));
    return out.join('');
  }
}
