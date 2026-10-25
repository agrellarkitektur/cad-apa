import { addElement, updateParams } from '../../core/commands';
import type { Id } from '../../core/model';
import { resolveParams } from '../../elements/registry';
import { slabAt, type SlabParams } from '../../elements/slab';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import type { PointTaker } from '../pointInput';
import { pxToMm, type ToolHost } from './host';
import { snapMarker } from './overlay';
import { roundMm, snap, type SnapResult } from './snap';

/** Vad verktyget ritar: ett bjälklag eller en håltagning i ett. */
export type SlabMode = 'slab' | 'hole';

/**
 * Bjälklag (0.9.1): dra upp en rektangel med två klick, eller lägg ett
 * bjälklag innanför ytterväggarna (*Ur väggarna*). Med *Håltagning* blir
 * rektangeln ett hål i bjälklaget där första hörnet klickas. Konturen ändras
 * sedan i Modifiera, som takets.
 */
export class SlabTool implements ViewTool, PointTaker {
  cursor = 'crosshair';
  private host: ToolHost;
  private a: Vec2 | null = null;
  /** Bjälklaget som håltagningen görs i, valt med första hörnet. */
  private target: Id | null = null;
  private current: SnapResult | null = null;
  options: { definition: Id | null; mode: SlabMode };
  lockAngle: number | null = null;
  onCreated?: (id: string) => void;
  onChange?: () => void;

  constructor(host: ToolHost, definition: Id | null) {
    this.host = host;
    this.options = { definition, mode: 'slab' };
  }

  get started(): boolean {
    return !!this.a;
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
    this.click(roundMm(this.current?.point ?? p.model));
  }

  private click(pt: Vec2): void {
    if (!this.a) {
      if (this.options.mode === 'hole') {
        const doc = this.host.store.doc;
        this.target = slabAt(doc, this.host.storey(), this.host.activeState(), pt);
        if (!this.target) {
          this.host.hint('Klicka ett hörn inne i ett bjälklag på den här våningen.');
          return;
        }
      }
      this.a = pt;
      this.onChange?.();
      return;
    }
    const min = this.options.mode === 'hole' ? 50 : 300;
    if (Math.abs(pt[0] - this.a[0]) < min || Math.abs(pt[1] - this.a[1]) < min) {
      this.host.hint(`${this.options.mode === 'hole' ? 'Håltagningen' : 'Bjälklaget'} måste vara minst ${min} mm åt båda hållen.`);
      return;
    }
    if (this.options.mode === 'hole' && this.target) this.addHole(this.target, rect(this.a, pt));
    else this.create(rect(this.a, pt));
    this.reset();
  }

  lastPoint(): Vec2 | undefined {
    return this.a ?? undefined;
  }

  cursorPoint(): Vec2 | undefined {
    return this.current?.point;
  }

  takePoint(p: Vec2): void {
    this.click(roundMm(p));
    this.host.view.requestRender();
  }

  hintText(): string {
    if (this.options.mode === 'hole') return this.a ? 'Klicka det motsatta hörnet av håltagningen.' : 'Klicka ett hörn av håltagningen, inne i bjälklaget.';
    return this.a ? 'Klicka det motsatta hörnet.' : 'Klicka ett hörn av bjälklaget, eller välj Ur väggarna.';
  }

  cancel(): void {}

  reset(): void {
    this.a = null;
    this.target = null;
    this.lockAngle = null;
    this.onChange?.();
  }

  /** Ett nytt bjälklag med en ritad kontur, eller innanför ytterväggarna (`outline` utelämnad). */
  create(outline?: [number, number][]): void {
    const params: SlabParams = outline ? { thickness: 300, outline } : { thickness: 300, outline: [], fromWalls: true };
    const { thickness: _t, ...own } = params;
    const def = this.options.definition && this.host.store.doc.definitions[this.options.definition] ? this.options.definition : undefined;
    const el = addElement(
      this.host.store,
      { type: 'Slab', storey: this.host.storey(), tags: [], params: (def ? own : params) as unknown as Record<string, unknown>, props: {}, ...(def ? { definition: def } : {}) },
      this.host.activeState(),
    );
    this.onCreated?.(el.id);
  }

  private addHole(id: Id, points: [number, number][]): void {
    const el = this.host.store.doc.elements[id];
    if (!el) return;
    const holes = resolveParams<SlabParams>(this.host.store.doc, el).holes ?? [];
    updateParams(this.host.store, [id], { holes: [...holes, { points }] }, 'Håltagning');
    this.host.selection.set([id]);
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    if (this.a && this.current) {
      const pts = rect(this.a, this.current.point).map((q) => cam.toScreen(q));
      out.push(`<path d="M${pts.map((q) => q.join(' ')).join('L')}Z" class="rubber"/>`);
      if (this.options.mode === 'hole') out.push(`<path d="M${pts[0].join(' ')}L${pts[2].join(' ')}M${pts[1].join(' ')}L${pts[3].join(' ')}" class="rubber"/>`);
    }
    if (this.current) out.push(snapMarker(cam, this.current));
    return out.join('');
  }
}

function rect(a: Vec2, b: Vec2): [number, number][] {
  const x0 = Math.min(a[0], b[0]);
  const x1 = Math.max(a[0], b[0]);
  const y0 = Math.min(a[1], b[1]);
  const y1 = Math.max(a[1], b[1]);
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}
