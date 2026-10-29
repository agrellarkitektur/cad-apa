import { addElements } from '../../core/commands';
import type { RoofParams } from '../../elements/roof';
import { quickRoofs, type QuickKind } from '../../elements/roofMaker';
import { ccw, hasBulges } from '../../geometry/arcFit';
import { dist, left, norm, sub } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import type { PointTaker } from '../pointInput';
import { pxToMm, type ToolHost } from './host';
import { snapMarker } from './overlay';
import { ChainInput } from './chainInput';
import { shapePoints } from '../../elements/drawing2d';
import { roundMm, snap, type SnapResult } from './snap';

/** Vad verktyget ritar: ett takfall för hand, eller ett snabbval över en rektangel. */
export type RoofMode = 'face' | QuickKind;

export interface RoofToolOptions {
  mode: RoofMode;
  slope: number;
  /** Höjden vid referenslinjen, mm över golvet. */
  height: number;
  heightAt: 'under' | 'top';
  thickness: number;
  /** Takfots- och gavelsprång för snabbvalen, mm. */
  eave: number;
  gable: number;
}

/**
 * Tak (0.10). *Takfall*: klicka konturens hörn (avsluta med ett klick på
 * första hörnet, dubbelklick eller Enter), sedan referenslinjens start och
 * slut och sist en punkt på den sida där taket stiger. Snabbvalen *Pulpet*,
 * *Sadel* och *Valm* dras upp med två hörn i husets ytterliv; takfallen får
 * takfots- och gavelsprånget utanför.
 */
export class RoofTool implements ViewTool, PointTaker {
  cursor = 'crosshair';
  private host: ToolHost;
  /** Snabbvalens första hörn. */
  private points: Vec2[] = [];
  /** Takfallets kontur medan den klickas, med bågar (0.10.17). */
  readonly chain = new ChainInput();
  private contour: { points: [number, number][]; bulges?: number[] } | null = null;
  private refA: Vec2 | null = null;
  private refB: Vec2 | null = null;
  private current: SnapResult | null = null;
  private lastUp = { t: 0, at: [0, 0] as Vec2 };
  options: RoofToolOptions = { mode: 'gable', slope: 27, height: 2700, heightAt: 'under', thickness: 300, eave: 500, gable: 300 };
  lockAngle: number | null = null;
  onCreated?: (ids: string[]) => void;
  onChange?: () => void;

  constructor(host: ToolHost) {
    this.host = host;
  }

  get started(): boolean {
    return this.points.length > 0 || this.chain.count > 0 || !!this.contour;
  }

  /** Steget: kontur, referenslinjens start, slut eller sidan. */
  get step(): 'contour' | 'refStart' | 'refEnd' | 'side' {
    if (!this.contour) return 'contour';
    if (!this.refA) return 'refStart';
    if (!this.refB) return 'refEnd';
    return 'side';
  }

  /** Konturen kan slutas (Avsluta i smartshell). */
  get canClose(): boolean {
    return this.options.mode === 'face' && !this.contour && this.chain.canClose;
  }

  /** Nästa kant i konturen blir en båge (0.10.17). */
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

  private from(): Vec2 | undefined {
    if (this.step === 'refEnd') return this.refA ?? undefined;
    if (this.step === 'contour') return this.chain.last();
    return undefined;
  }

  private track(p: ViewPointer): void {
    const from = this.from();
    if (from && this.lockAngle !== null) {
      const r = (this.lockAngle * Math.PI) / 180;
      const d: Vec2 = [Math.cos(r), Math.sin(r)];
      const len = Math.max(0, (p.model[0] - from[0]) * d[0] + (p.model[1] - from[1]) * d[1]);
      this.current = { point: [from[0] + d[0] * len, from[1] + d[1] * len], kind: 'angle', label: `${this.lockAngle}°` };
      return;
    }
    this.current = snap({ cursor: p.model, from, segments: this.host.snapSegments(), tol: pxToMm(this.host, p.pointerType === 'touch' ? 18 : 10), ortho: p.shift });
  }

  up(p: ViewPointer): void {
    this.track(p);
    const now = performance.now();
    const double = now - this.lastUp.t < 350 && dist(p.screen, this.lastUp.at) < 8;
    this.lastUp = { t: now, at: p.screen };
    if (double && this.canClose) {
      this.closeContour();
      return;
    }
    this.click(roundMm(this.current?.point ?? p.model));
  }

  private click(pt: Vec2): void {
    this.lockAngle = null;
    if (this.options.mode !== 'face') {
      if (!this.points.length) {
        this.points = [pt];
        this.onChange?.();
        return;
      }
      const a = this.points[0];
      if (Math.abs(pt[0] - a[0]) < 500 || Math.abs(pt[1] - a[1]) < 500) {
        this.host.hint('Huset måste vara minst 500 mm åt båda hållen.');
        return;
      }
      this.createQuick(a, pt);
      this.reset();
      return;
    }
    switch (this.step) {
      case 'contour': {
        const r = this.chain.click(pt, pxToMm(this.host, 10));
        if (r === 'closed') {
          this.takeContour();
          return;
        }
        if (r === 'none') return;
        break;
      }
      case 'refStart':
        this.refA = pt;
        break;
      case 'refEnd':
        if (dist(pt, this.refA!) < 100) {
          this.host.hint('Referenslinjen måste vara minst 100 mm lång.');
          return;
        }
        this.refB = pt;
        break;
      case 'side': {
        const a = this.refA!;
        const b = this.refB!;
        const n = left(norm(sub(b, a)));
        const rises = (pt[0] - a[0]) * n[0] + (pt[1] - a[1]) * n[1] >= 0;
        this.createFace(this.contour!, rises ? [a, b] : [b, a]);
        this.reset();
        return;
      }
    }
    this.onChange?.();
  }

  /** Konturen är klar (Enter, Klar): den sista kanten rak; nu referenslinjen. */
  closeContour(): void {
    if (!this.canClose || !this.chain.close()) return;
    this.takeContour();
  }

  private takeContour(): void {
    this.contour = this.chain.result();
    this.chain.reset();
    this.lockAngle = null;
    this.onChange?.();
    this.host.view.requestRender();
  }

  private base(): Pick<RoofParams, 'slope' | 'height' | 'thickness' | 'heightAt'> {
    const o = this.options;
    return { slope: o.slope, height: o.height, thickness: o.thickness, ...(o.heightAt === 'top' ? { heightAt: 'top' } : {}) };
  }

  private add(list: RoofParams[]): void {
    if (!list.length) return;
    const els = addElements(
      this.host.store,
      list.map((params) => ({ type: 'Roof', storey: this.host.storey(), tags: [], params: params as unknown as Record<string, unknown>, props: {} })),
      this.host.activeState(),
      list.length > 1 ? 'Lägg till tak' : 'Lägg till takfall',
    );
    this.onCreated?.(els.map((e) => e.id));
  }

  /**
   * Ett takfall med konturen och referenslinjen. Konturen läggs moturs; bågarna
   * (0.10.17) vänds med den.
   */
  createFace(contour: Vec2[] | { points: [number, number][]; bulges?: number[] }, ref: [Vec2, Vec2]): void {
    const c = Array.isArray(contour) ? { points: contour.map((q): [number, number] => [q[0], q[1]]) } : contour;
    const ring = shapePoints({ shape: 'polyline', points: c.points, bulges: c.bulges, closed: true }).points;
    const a = ccw(ring, { points: c.points, bulges: c.bulges ?? c.points.map(() => 0), closed: true });
    const outline = a.points.map((q): [number, number] => [q[0], q[1]]);
    this.add([{ outline, ...(hasBulges(a.bulges) ? { bulges: a.bulges } : {}), ref: [[ref[0][0], ref[0][1]], [ref[1][0], ref[1][1]]], ...this.base() }]);
  }

  /** Snabbvalet över rektangeln mellan a och b (husets ytterliv). */
  createQuick(a: Vec2, b: Vec2): void {
    const o = this.options;
    if (o.mode === 'face') return;
    this.add(quickRoofs(a, b, { kind: o.mode, slope: o.slope, height: o.height, heightAt: o.heightAt, thickness: o.thickness, eave: o.eave, gable: o.gable }));
  }

  // Skrivna punkter i smartshell (0.8.21).
  lastPoint(): Vec2 | undefined {
    return this.from() ?? (this.options.mode !== 'face' ? this.points[0] : undefined);
  }

  cursorPoint(): Vec2 | undefined {
    return this.current?.point;
  }

  takePoint(p: Vec2): void {
    this.click(roundMm(p));
    this.host.view.requestRender();
  }

  /** Ta bort det senaste klicket (Ångra i smartshell). */
  undoPoint(): void {
    if (this.refB) this.refB = null;
    else if (this.refA) this.refA = null;
    else if (this.contour) {
      // Konturen öppnas igen; den slutande kanten tas bort.
      this.chain.load(this.contour.points, this.contour.bulges);
      this.contour = null;
    } else if (this.options.mode === 'face') this.chain.undo();
    else this.points.pop();
    this.lockAngle = null;
    this.onChange?.();
    this.host.view.requestRender();
  }

  hintText(): string {
    if (this.options.mode !== 'face') return this.points.length ? 'Klicka det motsatta hörnet av huset.' : 'Klicka ett hörn av huset i ytterlivet; takfallen får sprången utanför.';
    switch (this.step) {
      case 'contour':
        if (this.chain.waiting) return 'Klicka en punkt på bågen.';
        if (this.chain.arc) return this.chain.count ? 'Klicka var bågen slutar (på första hörnet för att sluta konturen med en båge).' : 'Klicka konturens första hörn.';
        return this.chain.count >= 3 ? 'Klicka nästa hörn. Klicka på första hörnet, dubbelklicka eller tryck Enter när konturen är klar.' : 'Klicka konturens hörn, med språnget. Med Båge blir nästa kant en båge.';
      case 'refStart':
        return 'Klicka referenslinjens start, där höjden gäller (t.ex. ytterlivet vid takfoten).';
      case 'refEnd':
        return 'Klicka referenslinjens slut.';
      default:
        return 'Klicka på den sida av referenslinjen där taket stiger.';
    }
  }

  cancel(): void {}

  reset(): void {
    this.points = [];
    this.chain.reset();
    this.contour = null;
    this.refA = null;
    this.refB = null;
    this.lockAngle = null;
    this.onChange?.();
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    const cur = this.current?.point;
    const path = (pts: Vec2[], closed: boolean) => `M${pts.map((q) => cam.toScreen(q).join(' ')).join('L')}${closed ? 'Z' : ''}`;
    if (this.options.mode !== 'face') {
      if (this.points.length && cur) {
        const a = this.points[0];
        out.push(`<path d="${path([a, [cur[0], a[1]], cur, [a[0], cur[1]]], true)}" class="rubber"/>`);
      }
    } else {
      const contour = this.contour ? shapePoints({ shape: 'polyline', points: this.contour.points, bulges: this.contour.bulges, closed: true }).points : this.chain.preview(cur);
      if (contour.length >= 2) out.push(`<path d="${path(contour, !!this.contour)}" class="rubber"/>`);
      const a = this.refA;
      const b = this.refB ?? (a && cur ? cur : null);
      if (a && b) {
        out.push(`<path d="${path([a, b], false)}" class="rubber"/>`);
        // Pilen mot den sida där taket stiger.
        const n = left(norm(sub(b, a)));
        const side = this.refB && cur ? Math.sign((cur[0] - a[0]) * n[0] + (cur[1] - a[1]) * n[1]) || 1 : 1;
        const m: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const len = pxToMm(this.host, 40);
        const tip: Vec2 = [m[0] + n[0] * side * len, m[1] + n[1] * side * len];
        if (this.refB) out.push(`<path d="${path([m, tip], false)}" class="rubber"/>`);
      }
    }
    if (this.current) out.push(snapMarker(cam, this.current));
    return out.join('');
  }
}
