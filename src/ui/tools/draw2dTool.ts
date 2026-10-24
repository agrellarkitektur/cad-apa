import { addElements } from '../../core/commands';
import { shapePrims, type FillPattern, type LineType, type Shape2DParams, type ShapeKind } from '../../elements/drawing2d';
import { add, dist, dot, fromAngleDeg, scale, sub } from '../../geometry/vec';
import type { Primitive, Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import { renderPrimitives } from '../../view2d/renderPrimitives';
import { pxToMm, type ToolHost } from './host';
import { snapMarker } from './overlay';
import { roundMm, snap, type SnapResult } from './snap';
import type { PointTaker } from '../pointInput';

export interface Draw2DOptions {
  /** Hur formen ritas. */
  kind: ShapeKind;
  /** Pennans bredd; 0 = ingen linje. */
  weight: number;
  linetype: LineType;
  /** Fyllningen; utelämnad = ingen. */
  fill?: FillPattern;
}

/** Hur många punkter formen behöver; null = så många man vill (avslutas med dubbelklick, Enter eller Klar). */
const NEEDED: Record<ShapeKind, number | null> = { line: 2, rect: 2, circle: 2, arc: 3, polyline: null, spline: null };

/**
 * 2D-verktyget (0.8, 0.8.19): ritar en 2D-form som linje, rektangel, båge,
 * cirkel eller spline, med penna och fyllning. Linjen är en polylinje med
 * så många punkter man vill (0.8.22; enkellinjen finns inte längre). Punkterna
 * snäpper som allt annat. Rektangeln ritas med två motsatta hörn, bågen med
 * start, slut och en punkt på bågen, cirkeln med centrum och en punkt på
 * cirkeln. Linjer och splines avslutas med dubbelklick, Enter eller Klar;
 * ett klick på första punkten sluter formen.
 */
export class Draw2DTool implements ViewTool, PointTaker {
  cursor = 'crosshair';
  private host: ToolHost;
  private points: Vec2[] = [];
  private current: SnapResult | null = null;
  private lastUp = { t: 0, at: [0, 0] as Vec2 };
  options: Draw2DOptions = { kind: 'polyline', weight: 0.25, linetype: 'solid' };
  /** Riktningen låst med <45 i smartshell (0.8.20), till nästa punkt. */
  lockAngle: number | null = null;
  onChange?: () => void;

  constructor(host: ToolHost) {
    this.host = host;
  }

  get count(): number {
    return this.points.length;
  }

  /** Om formen tar emot fler punkter tills man säger att den är klar. */
  get open(): boolean {
    return NEEDED[this.options.kind] === null;
  }

  down(): 'capture' {
    return 'capture';
  }

  hover(p: ViewPointer | null): void {
    if (p) this.track(p);
  }

  drag(p: ViewPointer): void {
    this.track(p);
  }

  up(p: ViewPointer): void {
    this.track(p);
    const now = performance.now();
    const double = now - this.lastUp.t < 350 && dist(p.screen, this.lastUp.at) < 8;
    this.lastUp = { t: now, at: p.screen };
    if (!this.current) return;
    const pt = roundMm(this.current.point);
    if (this.open && double) {
      // Andra klicket i dubbelklicket lade redan till samma punkt.
      this.finish(false);
      return;
    }
    // Klick på första punkten sluter en polylinje eller spline.
    if (this.open && this.points.length >= 3 && dist(pt, this.points[0]) <= pxToMm(this.host, 10)) {
      this.finish(true);
      return;
    }
    this.addPoint(pt);
  }

  private addPoint(pt: Vec2): void {
    if (this.points.length && dist(pt, this.points[this.points.length - 1]) < 1) return;
    this.lockAngle = null;
    this.points.push(pt);
    const need = NEEDED[this.options.kind];
    if (need !== null && this.points.length >= need) this.finish(false);
    else this.onChange?.();
  }

  // Skrivna punkter i smartshell (0.8.20).
  lastPoint(): Vec2 | undefined {
    return this.points.at(-1);
  }

  cursorPoint(): Vec2 | undefined {
    return this.current?.point;
  }

  takePoint(p: Vec2): void {
    const pt = roundMm(p);
    if (this.open && this.points.length >= 3 && dist(pt, this.points[0]) < 1) this.finish(true);
    else this.addPoint(pt);
    this.host.view.requestRender();
  }

  cancel(): void {}

  /** Formen kan slutas mot första punkten (Stäng i smartshell, 0.8.21). */
  get canClose(): boolean {
    return this.open && this.points.length >= 3;
  }

  /** Ta bort den senaste punkten (Ångra i smartshell, 0.8.21). */
  undoPoint(): void {
    this.points.pop();
    this.lockAngle = null;
    this.onChange?.();
    this.host.view.requestRender();
  }

  reset(): void {
    this.points = [];
    this.lockAngle = null;
    this.onChange?.();
    this.host.view.requestRender();
  }

  /** Byt form; punkterna börjar om. Enkellinjen är polylinjen sedan 0.8.22. */
  setKind(kind: ShapeKind): void {
    this.options.kind = kind === 'line' ? 'polyline' : kind;
    this.reset();
  }

  /** Avsluta formen med de punkter som finns. */
  finish(closed: boolean): void {
    if (this.points.length >= 2) this.create(this.points, closed);
    this.reset();
  }

  /** Parametrarna för formen genom punkterna. */
  private params(pts: Vec2[], closed: boolean): Record<string, unknown> {
    const o = this.options;
    const at = (q: Vec2): [number, number] => [q[0], q[1]];
    let points = pts.map(at);
    if (o.kind === 'rect') points = rectCorners(pts[0], pts[1]).map(at);
    // Bågen ritas start, slut, punkt på bågen; den sparas start, punkt, slut.
    if (o.kind === 'arc') points = (pts.length >= 3 ? [pts[0], pts[2], pts[1]] : pts).map(at);
    const fill = o.fill && o.kind !== 'line' ? { fill: o.fill } : {};
    return { shape: o.kind, points, ...(closed && (o.kind === 'polyline' || o.kind === 'spline') ? { closed: true } : {}), weight: o.weight, linetype: o.linetype, ...fill };
  }

  private create(pts: Vec2[], closed: boolean): void {
    const space = this.host.space?.();
    const [el] = addElements(
      this.host.store,
      [{ type: 'Shape2D', storey: this.host.storey(), ...(space ? { space } : {}), tags: [], params: this.params(pts, closed), props: {} }],
      this.host.activeState(),
      'Rita 2D',
    );
    this.host.selection.set([el.id]);
  }

  private track(p: ViewPointer): void {
    const last = this.points.at(-1);
    if (last && this.lockAngle !== null) {
      // Låst vinkel: punkten följer markören men bara längs vinkelns linje (som väggen).
      const dir = fromAngleDeg(this.lockAngle);
      const len = Math.max(0, dot(sub(p.model, last), dir));
      this.current = { point: add(last, scale(dir, len)), kind: 'angle', label: `${this.lockAngle.toLocaleString('sv-SE')}°`, guide: [last, add(last, scale(dir, len * 3 + 2000))] };
      this.host.view.requestRender();
      return;
    }
    this.current = snap({
      cursor: p.model,
      from: last,
      segments: this.host.snapSegments(),
      tol: pxToMm(this.host, p.pointerType === 'touch' ? 18 : 10),
      ortho: p.shift,
      ...(this.points.length >= 2 ? { chainStart: this.points[0] } : {}),
    });
    this.host.view.requestRender();
  }

  /** Formen som den skulle bli med markören där den är. En linje utan tjocklek visas tunn. */
  private preview(): Primitive[] {
    const pts = [...this.points];
    if (this.current) pts.push(this.current.point);
    if (pts.length < 2) return [];
    const p = { fillAngle: 45, fillSpacing: 2, ...this.params(pts, false) } as unknown as Shape2DParams;
    return shapePrims({ ...p, weight: p.weight || 0.13 });
  }

  hintText(): string {
    const n = this.points.length;
    switch (this.options.kind) {
      case 'rect':
        return n === 0 ? 'Klicka ett hörn.' : 'Klicka det motsatta hörnet.';
      case 'circle':
        return n === 0 ? 'Klicka i centrum.' : 'Klicka en punkt på cirkeln.';
      case 'arc':
        return n === 0 ? 'Klicka där bågen börjar.' : n === 1 ? 'Klicka där bågen slutar.' : 'Klicka en punkt på bågen.';
      case 'polyline':
        return n === 0 ? 'Klicka där linjen börjar.' : 'Klicka nästa punkt, eller dubbelklicka för att sluta.';
      default:
        return n === 0 ? 'Klicka första punkten.' : 'Klicka nästa punkt, eller dubbelklicka för att sluta.';
    }
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    const prev = this.preview();
    if (prev.length) out.push(`<g class="dim-preview">${renderPrimitives(prev, cam, { drawingScale: this.host.view.drawingScale })}</g>`);
    for (const q of this.points) {
      const s = cam.toScreen(q);
      out.push(`<circle cx="${s[0]}" cy="${s[1]}" r="3.5" class="chain-pt"/>`);
    }
    if (this.current) out.push(snapMarker(cam, this.current));
    return out.join('');
  }
}

/** Rektangelns fyra hörn från två motsatta. */
export function rectCorners(a: Vec2, b: Vec2): Vec2[] {
  return [a, [b[0], a[1]], b, [a[0], b[1]]];
}
