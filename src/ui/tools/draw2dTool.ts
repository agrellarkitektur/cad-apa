import { addElements } from '../../core/commands';
import { fillPrims, shapePoints, type FillPattern, type LineType, type Shape2D } from '../../elements/drawing2d';
import { dist } from '../../geometry/vec';
import type { Primitive, Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import { renderPrimitives } from '../../view2d/renderPrimitives';
import { pxToMm, type ToolHost } from './host';
import { snapMarker } from './overlay';
import { roundMm, snap, type SnapResult } from './snap';

/** Det 2D-verktyget ritar: en form, eller en fyllning. */
export type Draw2DKind = Shape2D | 'fill';

export interface Draw2DOptions {
  kind: Draw2DKind;
  weight: number;
  linetype: LineType;
  pattern: FillPattern;
}

/** Hur många punkter formen behöver; null = så många man vill (avslutas med dubbelklick, Enter eller Klar). */
const NEEDED: Record<Draw2DKind, number | null> = { line: 2, rect: 2, circle: 2, arc: 3, polyline: null, spline: null, fill: null };

/**
 * 2D-verktyget (0.8): linje, polylinje, rektangel, båge, cirkel, spline och
 * fyllning. Punkterna snäpper som allt annat. Rektangeln ritas med två
 * motsatta hörn, bågen med start, slut och en punkt på bågen, cirkeln med
 * centrum och en punkt på cirkeln. Polylinjer, splines och fyllningar
 * avslutas med dubbelklick, Enter eller Klar; ett klick på första punkten
 * sluter formen.
 */
export class Draw2DTool implements ViewTool {
  cursor = 'crosshair';
  private host: ToolHost;
  private points: Vec2[] = [];
  private current: SnapResult | null = null;
  private lastUp = { t: 0, at: [0, 0] as Vec2 };
  options: Draw2DOptions = { kind: 'line', weight: 0.25, linetype: 'solid', pattern: 'hatch' };
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
    // Klick på första punkten sluter en polylinje, spline eller fyllning.
    if (this.open && this.points.length >= 3 && dist(pt, this.points[0]) <= pxToMm(this.host, 10)) {
      this.finish(true);
      return;
    }
    if (this.points.length && dist(pt, this.points[this.points.length - 1]) < 1) return;
    this.points.push(pt);
    const need = NEEDED[this.options.kind];
    if (need !== null && this.points.length >= need) this.finish(false);
    else this.onChange?.();
  }

  cancel(): void {}

  reset(): void {
    this.points = [];
    this.onChange?.();
    this.host.view.requestRender();
  }

  /** Byt form; punkterna börjar om. */
  setKind(kind: Draw2DKind): void {
    this.options.kind = kind;
    this.reset();
  }

  /** Avsluta formen med de punkter som finns. */
  finish(closed: boolean): void {
    const kind = this.options.kind;
    const pts = this.points;
    const min = kind === 'fill' ? 3 : 2;
    if (pts.length >= min) this.create(pts, closed || kind === 'fill');
    this.reset();
  }

  private create(pts: Vec2[], closed: boolean): void {
    const o = this.options;
    const space = this.host.space?.();
    const at = (q: Vec2): [number, number] => [q[0], q[1]];
    let params: Record<string, unknown>;
    let type = 'Line2D';
    if (o.kind === 'fill') {
      type = 'Fill2D';
      params = { points: pts.map(at), pattern: o.pattern, outline: true, angle: 45, spacing: 2 };
    } else {
      let points = pts.map(at);
      if (o.kind === 'rect') points = rectCorners(pts[0], pts[1]).map(at);
      // Bågen ritas start, slut, punkt på bågen; den sparas start, punkt, slut.
      if (o.kind === 'arc') points = [at(pts[0]), at(pts[2]), at(pts[1])];
      params = { shape: o.kind, points, ...(closed && (o.kind === 'polyline' || o.kind === 'spline') ? { closed: true } : {}), weight: o.weight, linetype: o.linetype };
    }
    const [el] = addElements(
      this.host.store,
      [{ type, storey: this.host.storey(), ...(space ? { space } : {}), tags: [], params, props: {} }],
      this.host.activeState(),
      type === 'Fill2D' ? 'Rita fyllning' : 'Rita 2D',
    );
    this.host.selection.set([el.id]);
  }

  private track(p: ViewPointer): void {
    const last = this.points.at(-1);
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

  /** Formen som den skulle bli med markören där den är. */
  private preview(): Primitive[] {
    const pts = [...this.points];
    if (this.current) pts.push(this.current.point);
    if (pts.length < 2) return [];
    const o = this.options;
    if (o.kind === 'fill') return pts.length >= 3 ? fillPrims({ points: pts as [number, number][], pattern: o.pattern, outline: true, angle: 45, spacing: 2 }) : [{ kind: 'polyline', points: pts, closed: false, pen: { weight: 0.18 } }];
    let points = pts as [number, number][];
    if (o.kind === 'rect') points = rectCorners(pts[0], pts[1]) as [number, number][];
    if (o.kind === 'arc') points = (pts.length >= 3 ? [pts[0], pts[2], pts[1]] : pts) as [number, number][];
    const sp = shapePoints({ shape: o.kind, points, closed: false });
    return [{ kind: 'polyline', points: sp.points, closed: sp.closed, pen: { weight: o.weight } }];
  }

  hintText(): string {
    const n = this.points.length;
    switch (this.options.kind) {
      case 'line':
        return n === 0 ? 'Klicka där linjen börjar.' : 'Klicka där linjen slutar.';
      case 'rect':
        return n === 0 ? 'Klicka ett hörn.' : 'Klicka det motsatta hörnet.';
      case 'circle':
        return n === 0 ? 'Klicka i centrum.' : 'Klicka en punkt på cirkeln.';
      case 'arc':
        return n === 0 ? 'Klicka där bågen börjar.' : n === 1 ? 'Klicka där bågen slutar.' : 'Klicka en punkt på bågen.';
      default:
        return n === 0 ? 'Klicka första punkten.' : 'Klicka nästa punkt. Dubbelklicka, tryck Klar eller klicka på första punkten för att sluta.';
    }
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    const prev = this.preview();
    if (prev.length) out.push(`<g class="dim-preview">${renderPrimitives(prev, cam, { drawingScale: 100 })}</g>`);
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
