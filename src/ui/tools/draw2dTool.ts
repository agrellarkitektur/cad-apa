import { addElements, updateParams } from '../../core/commands';
import type { Element, Id } from '../../core/model';
import { hasBackground, isClosed, segmentCount, shapePrims, type FillPattern, type LineType, type Shape2DParams, type ShapeKind } from '../../elements/drawing2d';
import { bulgeThrough, STRAIGHT } from '../../geometry/arc';
import { add, dist, dot, fromAngleDeg, scale, sub } from '../../geometry/vec';
import type { Primitive, Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import { renderPrimitives } from '../../view2d/renderPrimitives';
import { pxToMm, type ToolHost } from './host';
import { resolveParams } from '../../elements/registry';
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
  /** Den egna fyllningstypen (0.8.36), när `fill` är `type`. */
  fillType?: string;
  /** Skrafferingens bakgrund (0.8.29); utelämnad = ingen. */
  fillBackground?: string;
}

/** Hur många punkter formen behöver; null = så många man vill (avslutas med dubbelklick, Enter eller Klar). */
const NEEDED: Record<ShapeKind, number | null> = { rect: 2, circle: 2, arc: 3, polyline: null, spline: null };

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
  /**
   * Formen som ritas vidare (0.8.28): en markerad öppen linje eller spline som
   * man klickat på en ände av. Dess punkter ligger först i `points`, med den
   * klickade änden sist; `bulges` är dess bågar i samma riktning.
   */
  private base: { id: Id; n: number; bulges: number[]; reversed: boolean } | null = null;
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
    // Klick på änden av en öppen form ritar den vidare (0.8.28; också omarkerad sedan 0.10.17); Ctrl börjar en ny.
    if (this.open && !this.points.length && !p.mod && this.continueAt(this.current.point, pxToMm(this.host, p.pointerType === 'touch' ? 18 : 10))) return;
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

  /** Formen som ritas vidare, om någon. */
  get continuing(): Id | null {
    return this.base?.id ?? null;
  }

  /**
   * De öppna 2D-formerna (linjer och splines, också med bågar) som går att
   * rita vidare: synliga i vyn, olåsta och möjliga att ändra här. Sedan
   * 0.10.17 också de som inte är markerade; de markerade kommer först, så att
   * de vinner när två ändar ligger i samma punkt.
   */
  continuable(): Element[] {
    const host = this.host;
    const doc = host.store.doc;
    const ro = !!host.readOnly?.();
    const sel = new Set(host.selection.list());
    const out: Element[] = [];
    for (const pk of host.plan().pickables) {
      const el = doc.elements[pk.id];
      if (el?.type !== 'Shape2D' || el.locked || (ro && !host.canEdit?.(el.id))) continue;
      const q = resolveParams<Shape2DParams>(doc, el);
      if ((q.shape === 'polyline' || q.shape === 'spline') && q.points.length >= 2 && !isClosed(q)) out.push(el);
    }
    return out.sort((a, b) => Number(sel.has(b.id)) - Number(sel.has(a.id)));
  }

  /**
   * Börja rita vidare från änden närmast `pt` av en markerad öppen form, om
   * någon ände ligger inom `tol`. Svarar true om det blev så.
   */
  continueAt(pt: Vec2, tol: number): boolean {
    let best: { el: Element; atStart: boolean; d: number } | null = null;
    const sel = new Set(this.host.selection.list());
    for (const el of this.continuable()) {
      // En markerad form går före en omarkerad som har en ände lika nära.
      if (best && sel.has(best.el.id) && !sel.has(el.id)) break;
      const pts = resolveParams<Shape2DParams>(this.host.store.doc, el).points as Vec2[];
      for (const atStart of [false, true]) {
        const d = dist(pt, atStart ? pts[0] : pts[pts.length - 1]);
        if (d <= tol && (!best || d < best.d)) best = { el, atStart, d };
      }
    }
    if (!best) return false;
    const q = resolveParams<Shape2DParams>(this.host.store.doc, best.el);
    const n = q.points.length;
    const bulges = Array.from({ length: n - 1 }, (_, i) => q.bulges?.[i] ?? 0);
    // Från början: punkterna vänds, och bågarna byter tecken när riktningen vänds.
    this.points = (best.atStart ? [...q.points].reverse() : [...q.points]) as Vec2[];
    this.base = { id: best.el.id, n, bulges: best.atStart ? bulges.reverse().map((b) => (b ? -b : 0)) : bulges, reversed: best.atStart };
    this.lockAngle = null;
    this.onChange?.();
    this.host.view.requestRender();
    return true;
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
    // En skriven punkt på änden av en markerad öppen form ritar den vidare (0.8.28).
    if (this.open && !this.points.length && this.continueAt(pt, 1)) return;
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
    // Formens egna punkter tas inte bort; utan nya punkter slutar fortsättningen.
    if (this.base && this.points.length <= this.base.n) {
      this.reset();
      return;
    }
    this.points.pop();
    this.lockAngle = null;
    this.onChange?.();
    this.host.view.requestRender();
  }

  reset(): void {
    this.points = [];
    this.base = null;
    this.lockAngle = null;
    this.onChange?.();
    this.host.view.requestRender();
  }

  /** Byt form; punkterna börjar om. */
  setKind(kind: ShapeKind): void {
    this.options.kind = kind in NEEDED ? kind : 'polyline';
    this.reset();
  }

  /** Avsluta formen med de punkter som finns. */
  finish(closed: boolean): void {
    if (this.base) this.extend(this.base, this.points, closed);
    else if (this.points.length >= 2) this.create(this.points, closed);
    this.reset();
  }

  /**
   * Formen med de nya punkterna (0.8.28). De nya kanterna är raka; en form
   * som ritats vidare från början har sina punkter vända, och då byter
   * ändformerna plats så att de sitter kvar där de satt.
   */
  private extend(base: NonNullable<Draw2DTool['base']>, pts: Vec2[], closed: boolean): void {
    // Utan nya punkter går formen bara att sluta (ett klick på ena änden och sedan den andra, 0.10.17).
    if (pts.length < base.n || (pts.length === base.n && !closed)) return;
    const el = this.host.store.doc.elements[base.id];
    if (!el) return;
    const q = resolveParams<Shape2DParams>(this.host.store.doc, el);
    const at = (v: Vec2): [number, number] => [Math.round(v[0]), Math.round(v[1])];
    const bulges = [...base.bulges, ...Array.from({ length: segmentCount(pts.length, closed) - base.bulges.length }, () => 0)];
    const patch: Record<string, unknown> = {
      points: pts.map(at),
      bulges: q.shape === 'spline' || !bulges.some((b) => b) ? undefined : bulges,
      closed: closed || undefined,
    };
    if (base.reversed) Object.assign(patch, { startCap: q.endCap, endCap: q.startCap });
    updateParams(this.host.store, [base.id], patch, closed ? 'Fortsätt och slut linjen' : 'Fortsätt linjen');
    this.host.selection.set([base.id]);
  }

  /** Parametrarna för formen genom punkterna. */
  private params(pts: Vec2[], closed: boolean): Record<string, unknown> {
    const o = this.options;
    const fill = o.fill ? { fill: o.fill, ...(o.fill === 'type' && o.fillType ? { fillType: o.fillType } : {}), ...(hasBackground(o.fill) && o.fillBackground ? { fillBackground: o.fillBackground } : {}) } : {};
    return { ...chainFrom(o.kind, pts, closed), weight: o.weight, linetype: o.linetype, ...fill };
  }

  /** En linje genom färdiga punkter (smartspöt, 0.10.22), med verktygets penna och fyllning. */
  createPolyline(pts: Vec2[], closed: boolean): void {
    const o = this.options;
    const fill = o.fill ? { fill: o.fill, ...(o.fill === 'type' && o.fillType ? { fillType: o.fillType } : {}), ...(hasBackground(o.fill) && o.fillBackground ? { fillBackground: o.fillBackground } : {}) } : {};
    const at = (v: Vec2): [number, number] => [Math.round(v[0]), Math.round(v[1])];
    const params = { ...chainFrom('polyline', pts.map(at), closed), weight: o.weight, linetype: o.linetype, ...fill };
    const space = this.host.space?.();
    const [el] = addElements(this.host.store, [{ type: 'Shape2D', storey: this.host.storey(), ...(space ? { space } : {}), tags: [], params, props: {} }], this.host.activeState(), '2D-form med smartspöt');
    this.host.selection.set([el.id]);
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
    const el = this.base && this.host.store.doc.elements[this.base.id];
    if (el && this.base) {
      // Som formen blir: dess penna och fyllning, de gamla bågarna och raka nya kanter.
      const own = resolveParams<Shape2DParams>(this.host.store.doc, el);
      const bulges = own.shape === 'spline' ? undefined : [...this.base.bulges, ...pts.slice(this.base.n).map(() => 0)];
      const caps = this.base.reversed ? { startCap: own.endCap, endCap: own.startCap } : {};
      return shapePrims({ ...own, ...caps, points: pts as [number, number][], bulges, closed: false, weight: own.weight || 0.13 }, undefined, false, this.host.view.drawingScale, this.host.store.doc.graphics);
    }
    const p = { fillAngle: 45, fillSpacing: 2, ...this.params(pts, false) } as unknown as Shape2DParams;
    return shapePrims({ ...p, weight: p.weight || 0.13 }, undefined, false, this.host.view.drawingScale, this.host.store.doc.graphics);
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
        return n === 0 ? `Klicka där linjen börjar${this.continueHint()}.` : 'Klicka nästa punkt, eller dubbelklicka för att sluta.';
      default:
        return n === 0 ? `Klicka första punkten${this.continueHint()}.` : 'Klicka nästa punkt, eller dubbelklicka för att sluta.';
    }
  }

  /** Tipset om att rita vidare (0.8.28). */
  private continueHint(): string {
    return ', eller på änden av en linje för att rita vidare (Ctrl+klick börjar en ny)';
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

/**
 * Kedjan (eller splinen) som ett sätt att rita ger (0.8.24): rektangeln är
 * en sluten kedja med fyra hörn, bågen en kedja med ett böjt segment och
 * cirkeln en sluten kedja med två halvcirklar. Bågen ritas start, slut och
 * en punkt på bågen; cirkeln centrum och en punkt på cirkeln.
 */
export function chainFrom(kind: ShapeKind, pts: readonly Vec2[], closed: boolean): Pick<Shape2DParams, 'shape' | 'points' | 'bulges' | 'closed'> {
  const at = (q: Vec2): [number, number] => [Math.round(q[0]), Math.round(q[1])];
  switch (kind) {
    case 'rect':
      return { shape: 'polyline', points: rectCorners(pts[0], pts[1]).map(at), closed: true };
    case 'arc': {
      if (pts.length < 3) return { shape: 'polyline', points: pts.map(at) };
      const [a, b] = [at(pts[0]), at(pts[1])];
      const bulge = Math.round(bulgeThrough(a, b, pts[2]) * 10) / 10;
      return { shape: 'polyline', points: [a, b], ...(Math.abs(bulge) >= STRAIGHT ? { bulges: [bulge] } : {}) };
    }
    case 'circle': {
      const c = at(pts[0]);
      const q = at(pts[1]);
      const r = Math.round(dist(c, q) * 10) / 10;
      return { shape: 'polyline', points: [q, at([2 * c[0] - q[0], 2 * c[1] - q[1]])], bulges: [r, r], closed: true };
    }
    default:
      return { shape: kind, points: pts.map(at), ...(closed ? { closed: true } : {}) };
  }
}

/** Rektangelns fyra hörn från två motsatta. */
export function rectCorners(a: Vec2, b: Vec2): Vec2[] {
  return [a, [b[0], a[1]], b, [a[0], b[1]]];
}
