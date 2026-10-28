import { addElement, updateParams } from '../../core/commands';
import type { Id } from '../../core/model';
import { resolveParams } from '../../elements/registry';
import { slabAt, type SlabHole, type SlabParams } from '../../elements/slab';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import type { PointTaker } from '../pointInput';
import { pxToMm, type ToolHost } from './host';
import { snapMarker } from './overlay';
import { roundMm, snap, type SnapResult } from './snap';
import { ChainInput } from './chainInput';
import { dist } from '../../geometry/vec';
import { shapePoints } from '../../elements/drawing2d';

/** Vad verktyget ritar: ett bjälklag eller en håltagning i ett. */
export type SlabMode = 'slab' | 'hole';
/** Hur konturen ritas (0.10.17): rektangel, polygon (håltagningen med bågar) eller cirkel (bara håltagningen). */
export type SlabShape = 'rect' | 'polygon' | 'circle';

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
  options: { definition: Id | null; mode: SlabMode; shape: SlabShape };
  /** Polygonen medan den klickas (0.10.17). */
  readonly chain = new ChainInput();
  lockAngle: number | null = null;
  onCreated?: (id: string) => void;
  onChange?: () => void;

  constructor(host: ToolHost, definition: Id | null) {
    this.host = host;
    this.options = { definition, mode: 'slab', shape: 'rect' };
  }

  get started(): boolean {
    return !!this.a || this.chain.count > 0;
  }

  /** Formen som gäller: cirkeln bara för håltagningar. */
  get shape(): SlabShape {
    return this.options.shape === 'circle' && this.options.mode !== 'hole' ? 'rect' : this.options.shape;
  }

  /** Nästa kant i polygonen blir en båge (bara i håltagningar; bjälklagets kontur har inga bågar). */
  get arc(): boolean {
    return this.chain.arc;
  }

  setArc(on: boolean): void {
    this.chain.arc = on && this.options.mode === 'hole';
    this.onChange?.();
    this.host.view.requestRender();
  }

  /** Polygonen kan slutas (Klar, Enter). */
  get canClose(): boolean {
    return this.shape === 'polygon' && this.chain.canClose;
  }

  /** Sluta polygonen med en rak sista kant. */
  closePolygon(): void {
    if (this.canClose && this.chain.close()) this.finishPolygon();
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
    const from = this.shape === 'polygon' ? this.chain.last() : (this.a ?? undefined);
    this.current = snap({ cursor: p.model, from, segments: this.host.snapSegments(), tol: pxToMm(this.host, p.pointerType === 'touch' ? 18 : 10), ortho: p.shift });
  }

  private lastUp = { t: 0, at: [0, 0] as Vec2 };

  up(p: ViewPointer): void {
    this.track(p);
    const now = performance.now();
    const double = now - this.lastUp.t < 350 && dist(p.screen, this.lastUp.at) < 8;
    this.lastUp = { t: now, at: p.screen };
    if (double && this.canClose) {
      this.closePolygon();
      return;
    }
    this.click(roundMm(this.current?.point ?? p.model));
  }

  /** Första klicket: för en håltagning bjälklaget den görs i. Svarar false om det inte finns något. */
  private pickTarget(pt: Vec2): boolean {
    if (this.options.mode !== 'hole') return true;
    const doc = this.host.store.doc;
    this.target = slabAt(doc, this.host.storey(), this.host.activeState(), pt);
    if (!this.target) {
      this.host.hint(this.shape === 'circle' ? 'Klicka cirkelns centrum inne i ett bjälklag på den här våningen.' : 'Klicka ett hörn inne i ett bjälklag på den här våningen.');
      return false;
    }
    return true;
  }

  private click(pt: Vec2): void {
    if (this.shape === 'polygon') {
      if (!this.chain.count && !this.pickTarget(pt)) return;
      const r = this.chain.click(pt, pxToMm(this.host, 10));
      if (r === 'closed') this.finishPolygon();
      else this.onChange?.();
      return;
    }
    if (this.shape === 'circle') {
      if (!this.a) {
        if (!this.pickTarget(pt)) return;
        this.a = pt;
        this.onChange?.();
        return;
      }
      const points = circlePoints(this.a, pt);
      const r = Math.round((dist(points[0], points[1]) / 2) * 10) / 10;
      if (r < 25) {
        this.host.hint('Cirkeln måste vara minst 50 mm i diameter.');
        return;
      }
      if (this.target) this.addHole(this.target, { points, bulges: [r, r] });
      this.reset();
      return;
    }
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
    if (this.options.mode === 'hole' && this.target) this.addHole(this.target, { points: rect(this.a, pt) });
    else this.create(rect(this.a, pt));
    this.reset();
  }

  /** Polygonen är sluten: ett bjälklag eller en håltagning med den. */
  private finishPolygon(): void {
    const c = this.chain.result();
    if (this.options.mode === 'hole') {
      if (this.target) this.addHole(this.target, c);
    } else this.create(c.points);
    this.reset();
  }

  lastPoint(): Vec2 | undefined {
    return this.shape === 'polygon' ? this.chain.last() : (this.a ?? undefined);
  }

  cursorPoint(): Vec2 | undefined {
    return this.current?.point;
  }

  takePoint(p: Vec2): void {
    this.click(roundMm(p));
    this.host.view.requestRender();
  }

  hintText(): string {
    const hole = this.options.mode === 'hole';
    if (this.shape === 'circle') return this.a ? 'Klicka en punkt på cirkeln.' : 'Klicka cirkelns centrum, inne i bjälklaget.';
    if (this.shape === 'polygon') {
      if (this.chain.waiting) return 'Klicka en punkt på bågen.';
      if (!this.chain.count) return hole ? 'Klicka första hörnet av håltagningen, inne i bjälklaget.' : 'Klicka första hörnet av bjälklaget.';
      return `Klicka nästa hörn${this.chain.arc ? ' (bågens slut)' : ''}. Klicka på första hörnet, dubbelklicka eller tryck Enter när konturen är klar.`;
    }
    if (hole) return this.a ? 'Klicka det motsatta hörnet av håltagningen.' : 'Klicka ett hörn av håltagningen, inne i bjälklaget.';
    return this.a ? 'Klicka det motsatta hörnet.' : 'Klicka ett hörn av bjälklaget, eller välj Ur väggarna.';
  }

  /** Ta bort det senaste klicket. */
  undoPoint(): void {
    if (this.shape === 'polygon' && this.chain.count) {
      this.chain.undo();
      if (!this.chain.count) this.target = null;
      this.onChange?.();
      this.host.view.requestRender();
    } else this.reset();
  }

  cancel(): void {}

  reset(): void {
    this.a = null;
    this.chain.reset();
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

  /** En håltagning i bjälklaget `id` (också smartspöt, 0.10.23). */
  addHole(id: Id, hole: SlabHole): void {
    const el = this.host.store.doc.elements[id];
    if (!el) return;
    const holes = resolveParams<SlabParams>(this.host.store.doc, el).holes ?? [];
    updateParams(this.host.store, [id], { holes: [...holes, hole] }, 'Håltagning');
    this.host.selection.set([id]);
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    const cur = this.current?.point;
    const path = (pts: Vec2[], closed: boolean) => `M${pts.map((q) => cam.toScreen(q).join(' ')).join('L')}${closed ? 'Z' : ''}`;
    if (this.shape === 'polygon') {
      const pts = this.chain.preview(cur);
      if (pts.length >= 2) out.push(`<path d="${path(pts, false)}" class="rubber"/>`);
    } else if (this.shape === 'circle') {
      if (this.a && cur && dist(this.a, cur) > 1) {
        const ring = shapePoints({ shape: 'polyline', points: circlePoints(this.a, cur), bulges: [dist(this.a, cur), dist(this.a, cur)], closed: true }).points;
        out.push(`<path d="${path(ring, true)}" class="rubber"/>`);
        out.push(`<path d="${path([this.a, cur], false)}" class="rubber"/>`);
      }
    } else if (this.a && this.current) {
      const pts = rect(this.a, this.current.point).map((q) => cam.toScreen(q));
      out.push(`<path d="M${pts.map((q) => q.join(' ')).join('L')}Z" class="rubber"/>`);
      if (this.options.mode === 'hole') out.push(`<path d="M${pts[0].join(' ')}L${pts[2].join(' ')}M${pts[1].join(' ')}L${pts[3].join(' ')}" class="rubber"/>`);
    }
    if (this.current) out.push(snapMarker(cam, this.current));
    return out.join('');
  }
}

/** Cirkeln genom punkten q kring centrum c: q och den motsatta punkten (två halvcirklar), som 2D-formens cirkel. */
function circlePoints(c: Vec2, q: Vec2): [number, number][] {
  const r = (v: number) => Math.round(v);
  return [
    [r(q[0]), r(q[1])],
    [r(2 * c[0] - q[0]), r(2 * c[1] - q[1])],
  ];
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
