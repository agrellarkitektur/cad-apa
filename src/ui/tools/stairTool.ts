import { addElements } from '../../core/commands';
import { isSite } from '../../core/model';
import { tidyBulges } from '../../elements/groundLines';
import { stairGeometry, STAIR_WIDTH, stairOutline, type StairParams, type StairRefSide } from '../../elements/stairGeometry';
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
 */
export class StairTool implements ViewTool, PointTaker {
  cursor = 'crosshair';
  private host: ToolHost;
  readonly chain = new ChainInput();
  private lastUp = { t: 0, at: [0, 0] as Vec2 };
  private current: SnapResult | null = null;
  /** Bredden och var referenslinjen ligger. */
  options: { width: number; refSide: StairRefSide } = { width: STAIR_WIDTH, refSide: 'center' };
  lockAngle: number | null = null;
  onCreated?: (id: string) => void;
  onChange?: () => void;

  constructor(host: ToolHost) {
    this.host = host;
  }

  get started(): boolean {
    return this.chain.count > 0;
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
    if (double && this.chain.count >= 2 && !this.chain.waiting) {
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
    this.chain.click(pt, -1);
    this.onChange?.();
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
    this.chain.undo();
    this.onChange?.();
    this.host.view.requestRender();
  }

  lastPoint(): Vec2 | undefined {
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
    if (this.chain.waiting) return 'Klicka en punkt på bågen.';
    if (this.chain.arc && this.chain.count) return 'Klicka var bågen slutar.';
    if (!this.chain.count) return 'Klicka trappans början. Referenslinjen går i gångriktningen, uppåt; en sväng blir kilsteg.';
    const above = storeyAbove(this.host.store.doc, this.host.storey());
    return `Klicka nästa punkt. Dubbelklick, Enter eller Klar avslutar. Stigningen går ${above ? `till ${above.name}` : 'våningshöjden'}.`;
  }

  cancel(): void {}

  reset(): void {
    this.chain.reset();
    this.lockAngle = null;
    this.onChange?.();
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    if (this.chain.count) {
      const raw = this.chain.preview(this.current?.point);
      const pts = raw.map((q) => cam.toScreen(q));
      if (pts.length >= 2) out.push(`<path d="M${pts.map((q) => q.join(' ')).join('L')}" class="rubber"/>`);
      // Trappan med stegen, som den blir.
      if (raw.length >= 2) {
        const p: StairParams = { line: raw.map((q) => [q[0], q[1]]), width: this.options.width, refSide: this.options.refSide, rise: this.rise() };
        const g = stairGeometry(p);
        if (g) {
          const ring = stairOutline(g).map((q) => cam.toScreen(q));
          out.push(`<path d="M${ring.map((q) => q.join(' ')).join('L')}Z" class="rubber"/>`);
          for (const u of g.risers) {
            const r = g.ribAt(u);
            const a = cam.toScreen(r.L);
            const b = cam.toScreen(r.R);
            out.push(`<path d="M${a.join(' ')}L${b.join(' ')}" class="rubber"/>`);
          }
        }
      }
    }
    if (this.current) out.push(snapMarker(cam, this.current));
    return out.join('');
  }
}
