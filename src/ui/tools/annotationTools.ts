import { addElements } from '../../core/commands';
import type { Element } from '../../core/model';
import { dimensionPrims, pointAt, type DimensionParams, type DimPoint } from '../../elements/annotation';
import { refsAt } from '../../elements/features';
import { resolveParams } from '../../elements/registry';
import { wallFrame, type WallParams } from '../../elements/wall';
import { dist } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import { renderPrimitives } from '../../view2d/renderPrimitives';
import { pxToMm, type ToolHost } from './host';
import { snapMarker } from './overlay';
import { roundMm, snap, type SnapResult } from './snap';

/**
 * Måttverktyget: klicka på punkterna som ska måttsättas (de snäpper mot
 * väggar, hörn och möbler). Avsluta punkterna med dubbelklick, Enter eller
 * Klar, och klicka sedan där måttlinjen ska ligga. Riktningen blir vågrät
 * eller lodrät beroende på var man placerar linjen, eller längs punkterna.
 */
export class DimensionTool implements ViewTool {
  cursor = 'crosshair';
  private host: ToolHost;
  private points: DimPoint[] = [];
  private placing = false;
  private current: SnapResult | null = null;
  private lastUp = { t: 0, at: [0, 0] as Vec2 };
  onChange?: () => void;

  constructor(host: ToolHost) {
    this.host = host;
  }

  get count(): number {
    return this.points.length;
  }

  get isPlacing(): boolean {
    return this.placing;
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

  up(p: ViewPointer): void {
    this.track(p);
    const now = performance.now();
    const double = now - this.lastUp.t < 350 && dist(p.screen, this.lastUp.at) < 8;
    this.lastUp = { t: now, at: p.screen };
    if (this.placing) {
      this.commit();
      return;
    }
    if (double && this.points.length >= 2) {
      // Andra klicket i dubbelklicket lade redan till samma punkt.
      this.donePoints();
      return;
    }
    if (this.current) {
      // Klick inne i en vägg (inte på en punkt): båda liven måttsätts.
      const k = this.current.kind;
      const pointSnap = k === 'endpoint' || k === 'intersection' || k === 'start';
      const wall = pointSnap ? null : this.wallBodyAt(p.model, 2);
      const pts = wall ?? [this.pointWithRefs(this.current.point)];
      for (const q of pts) if (!this.points.some((o) => dist(pointAt(o), pointAt(q)) < 1)) this.points.push(q);
      this.onChange?.();
    }
  }

  cancel(): void {}

  /** Element som måttet kan knytas till: det som finns i tillståndet man ritar i. */
  private candidates(): Element[] {
    // I fasader och sektioner knyts måtten inte till planens väggar.
    if (this.host.space?.()) return [];
    const state = this.host.activeState();
    return Object.values(this.host.store.doc.elements).filter(
      (e) => e.storey === this.host.storey() && e.states.includes(state) && ['Wall', 'Door', 'Window', 'Furniture'].includes(e.type),
    );
  }

  /** En punkt, knuten till de linjer i modellen som går genom den. */
  private pointWithRefs(pt: Vec2): DimPoint {
    const at = roundMm(pt);
    const refs = refsAt(this.host.store.doc, this.candidates(), pt, 1);
    return refs.length ? { at, refs } : at;
  }

  /** Om punkten ligger inne i en vägg: punkter på båda liven, knutna till dem. */
  private wallBodyAt(pt: Vec2, tol: number): DimPoint[] | null {
    const doc = this.host.store.doc;
    for (const el of this.candidates()) {
      if (el.type !== 'Wall') continue;
      const f = wallFrame(resolveParams<WallParams>(doc, el));
      const [s, o] = f.project(pt);
      if (s <= 0 || s >= f.length || Math.abs(o) > f.half - Math.min(tol, f.half / 3)) continue;
      // Bågväggarnas liv är inga raka linjer att knyta mått till.
      if (f.arc) return [roundMm(f.at(s, f.half)), roundMm(f.at(s, -f.half))];
      const near: DimPoint = { at: roundMm(f.at(s, f.half)), refs: [{ id: el.id, kind: 'l' }] };
      const far: DimPoint = { at: roundMm(f.at(s, -f.half)), refs: [{ id: el.id, kind: 'r' }] };
      const last = this.points.at(-1);
      if (last && dist(pointAt(last), pointAt(far)) < dist(pointAt(last), pointAt(near))) return [far, near];
      return [near, far];
    }
    return null;
  }

  /** Punkterna är klara: nu placeras måttlinjen. */
  donePoints(): void {
    if (this.points.length >= 2) {
      this.placing = true;
      this.onChange?.();
      this.host.view.requestRender();
    } else this.reset();
  }

  reset(): void {
    this.points = [];
    this.placing = false;
    this.onChange?.();
    this.host.view.requestRender();
  }

  private track(p: ViewPointer): void {
    const last = this.points.at(-1);
    this.current = this.placing
      ? { point: p.model, kind: 'free', label: '' }
      : snap({ cursor: p.model, from: last ? pointAt(last) : undefined, segments: this.host.snapSegments(), tol: pxToMm(this.host, p.pointerType === 'touch' ? 18 : 10), ortho: p.shift });
  }

  /** Måttet som det skulle bli med markören där den är. */
  private preview(): DimensionParams | null {
    const pts: [number, number][] = this.points.map(pointAt);
    if (!this.placing && this.current && pts.length >= 1) pts.push(roundMm(this.current.point));
    if (pts.length < 2) return null;
    const a = pts[0];
    const b = pts[pts.length - 1];
    const aligned = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    let angle = aligned;
    const na = ((aligned % 180) + 180) % 180;
    if (na < 3 || na > 177) angle = 0;
    else if (Math.abs(na - 90) < 3) angle = 90;
    const c = this.placing && this.current ? this.current.point : null;
    if (c && angle !== 0 && angle !== 90) {
      // Placeras linjen ovanför eller under punkterna blir måttet vågrätt, vid sidan lodrätt.
      const xs = pts.map((q) => q[0]);
      const ys = pts.map((q) => q[1]);
      if (c[1] > Math.max(...ys) || c[1] < Math.min(...ys)) angle = 0;
      else if (c[0] > Math.max(...xs) || c[0] < Math.min(...xs)) angle = 90;
    }
    const r = (angle * Math.PI) / 180;
    const n: Vec2 = [-Math.sin(r), Math.cos(r)];
    const offset = c ? (c[0] - a[0]) * n[0] + (c[1] - a[1]) * n[1] : 600;
    return { points: pts, angle: Math.round(angle * 100) / 100, offset: Math.round(offset) };
  }

  private commit(): void {
    const preview = this.preview();
    // Spara punkterna med sina kopplingar till modellen.
    const d = preview ? { ...preview, points: this.points } : null;
    if (d && d.points.length >= 2) {
      const space = this.host.space?.();
      addElements(this.host.store, [{ type: 'Dimension', storey: this.host.storey(), ...(space ? { space } : {}), tags: [], params: { ...d }, props: {} }], this.host.activeState(), 'Måttsätt');
    }
    this.reset();
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    const d = this.preview();
    if (d) out.push(`<g class="dim-preview">${renderPrimitives(dimensionPrims(d, this.host.view.drawingScale), cam, { drawingScale: this.host.view.drawingScale })}</g>`);
    for (const q of this.points) {
      const s = cam.toScreen(pointAt(q));
      out.push(`<circle cx="${s[0]}" cy="${s[1]}" r="3.5" class="chain-pt"/>`);
    }
    if (this.current && !this.placing) out.push(snapMarker(cam, this.current));
    return out.join('');
  }
}

/** Textverktyget: skriv texten i verktygsraden och klicka där den ska stå. */
export class TextTool implements ViewTool {
  cursor = 'text';
  private host: ToolHost;
  private at: Vec2 | null = null;
  text = 'TEXT';
  height = 2.5;
  /** Fet stil, bara för text på ett blad (0.8.7). */
  bold = false;

  constructor(host: ToolHost) {
    this.host = host;
  }

  down(): 'capture' {
    return 'capture';
  }

  hover(p: ViewPointer | null): void {
    this.at = p?.model ?? null;
  }

  drag(p: ViewPointer): void {
    this.at = p.model;
  }

  up(p: ViewPointer, moved: boolean): void {
    if (moved && p.pointerType === 'touch') return;
    this.place(p.model);
  }

  tap(p: ViewPointer): void {
    this.place(p.model);
  }

  private place(at: Vec2): void {
    if (!this.text.trim()) {
      this.host.hint('Skriv texten i fältet först.');
      return;
    }
    const [el] = addElements(
      this.host.store,
      [{ type: 'Text', storey: this.host.storey(), ...(this.host.space?.() ? { space: this.host.space!() } : {}), tags: [], params: { pos: roundMm(at), text: this.text, height: this.height, angle: 0 }, props: {} }],
      this.host.activeState(),
      'Skriv text',
    );
    this.host.selection.set([el.id]);
  }

  overlay(cam: Camera): string {
    if (!this.at) return '';
    const s = cam.toScreen(this.at);
    const px = this.height * this.host.view.drawingScale * cam.scale;
    return `<text x="${s[0]}" y="${s[1]}" font-size="${Math.max(6, px)}" class="text-preview">${escape(this.text.split('\n')[0])}</text>`;
  }
}

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
