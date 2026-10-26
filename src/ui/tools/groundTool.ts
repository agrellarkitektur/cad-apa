import { addElements } from '../../core/commands';
import type { Element, Id } from '../../core/model';
import { groundAt, terrainOf } from '../../core/site';
import type { GroundParams } from '../../elements/ground';
import { dist } from '../../geometry/vec';
import { slabAt } from '../../elements/slab';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import type { PointTaker } from '../pointInput';
import { pxToMm, type ToolHost } from './host';
import { snapMarker } from './overlay';
import { roundMm, snap, type SnapResult } from './snap';

/**
 * Vad verktyget lägger: en markyta eller en urgrävning under ett bjälklag
 * (klick i bjälklaget); längs en linje (0.10.5) en ramp/väg, brytlinje
 * eller stödmur; eller en höjdpunkt. Platå och urgrävning är sedan 0.10.7
 * samma markyta, och ramp, gångväg och infart samma väg.
 */
export type GroundMode = 'area' | 'slab' | 'path' | 'point' | 'breakline' | 'wall';

/** Sätten som ritas som en linje, avslutad med dubbelklick, Enter eller Klar. */
const LINE_MODES: readonly GroundMode[] = ['path', 'breakline', 'wall'];
export const isLineMode = (m: GroundMode): boolean => LINE_MODES.includes(m);

/**
 * Mark (0.10.4): dra upp en markyta med två klick, lägg en markyta runt
 * huset, eller klicka i ett bjälklag för en urgrävning under det. Konturen
 * ändras sedan i Modifiera, som bjälklagets. Höjden föreslås ur den
 * befintliga marken i rektangelns mitt, avrundad till 50 mm.
 *
 * Markobjekten hör till förslaget: ritas de i Befintligt läggs de i alla
 * förslag i stället.
 */
export class GroundTool implements ViewTool, PointTaker {
  cursor = 'crosshair';
  private host: ToolHost;
  private a: Vec2 | null = null;
  /** Linjens punkter (ramp, brytlinje, stödmur …). */
  private pts: Vec2[] = [];
  private lastUp = { t: 0, at: [0, 0] as Vec2 };
  private current: SnapResult | null = null;
  options: { mode: GroundMode } = { mode: 'area' };
  lockAngle: number | null = null;
  onCreated?: (id: string) => void;
  onChange?: () => void;

  constructor(host: ToolHost) {
    this.host = host;
  }

  get started(): boolean {
    return !!this.a || this.pts.length > 0;
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
    // Dubbelklick avslutar linjen (andra klicket lade redan samma punkt).
    if (double && isLineMode(this.options.mode) && this.pts.length >= 2) {
      this.finish();
      return;
    }
    this.click(roundMm(this.current?.point ?? p.model));
  }

  /** Om projektet har en markmodell; annars ett tips. */
  private hasTerrain(): boolean {
    if (terrainOf(this.host.store.doc)) return true;
    this.host.hint('Markobjekt behöver en markmodell. Lägg in platsen ur Höjdkurvor (Platsen i menyn).', 5000);
    return false;
  }

  private click(pt: Vec2): void {
    if (!this.hasTerrain()) return;
    if (this.options.mode === 'slab') {
      this.underSlab(pt);
      return;
    }
    if (this.options.mode === 'point') {
      const h = this.groundHeight(pt);
      this.create({ kind: 'point', outline: [], line: [[pt[0], pt[1]]], height: Math.round(h / 10) * 10 });
      return;
    }
    if (isLineMode(this.options.mode)) {
      const last = this.pts[this.pts.length - 1];
      if (!last || dist(last, pt) >= 1) this.pts.push(pt);
      this.onChange?.();
      return;
    }
    if (!this.a) {
      this.a = pt;
      this.onChange?.();
      return;
    }
    if (Math.abs(pt[0] - this.a[0]) < 500 || Math.abs(pt[1] - this.a[1]) < 500) {
      this.host.hint('Markytan måste vara minst 500 mm åt båda hållen.');
      return;
    }
    const outline = rect(this.a, pt);
    const c: Vec2 = [(this.a[0] + pt[0]) / 2, (this.a[1] + pt[1]) / 2];
    const t = terrainOf(this.host.store.doc);
    const g = (t && groundAt(t, c[0], c[1])) ?? 0;
    this.create({ kind: 'area', outline, height: Math.round(g / 50) * 50 });
    this.reset();
  }

  /** Den befintliga markens höjd (mm från ±0) i en punkt, eller 0. */
  private groundHeight(pt: Vec2): number {
    const t = terrainOf(this.host.store.doc);
    return (t && groundAt(t, pt[0], pt[1])) ?? 0;
  }

  /**
   * Avsluta linjen: en väg med höjderna ur marken i ändarna, en brytlinje
   * likadant, en stödmur med krönet efter marken.
   */
  finish(): void {
    const pts = this.pts;
    const mode = this.options.mode;
    this.pts = [];
    this.onChange?.();
    if (pts.length < 2 || !isLineMode(mode)) return;
    const line = pts.map((q): [number, number] => [q[0], q[1]]);
    if (mode === 'wall') {
      this.create({ kind: 'wall', outline: [], line });
      return;
    }
    const h0 = Math.round(this.groundHeight(pts[0]) / 10) * 10;
    const h1 = Math.round(this.groundHeight(pts[pts.length - 1]) / 10) * 10;
    if (mode === 'breakline') this.create({ kind: 'breakline', outline: [], line, height: h0, endHeight: h1 });
    else this.create({ kind: 'path', outline: [], line, height: h0, endHeight: h1 });
  }

  /** En urgrävning under bjälklaget där man klickade. Finns den redan markeras den. */
  private underSlab(pt: Vec2): void {
    const doc = this.host.store.doc;
    const slab = slabAt(doc, this.host.storey(), this.host.activeState(), pt);
    if (!slab) {
      this.host.hint('Klicka inne i ett bjälklag på den här våningen.');
      return;
    }
    const old = this.existing((e) => e.params.slab === slab);
    if (old) {
      this.host.selection.set([old.id]);
      this.host.hint('Bjälklaget har redan en urgrävning. Den är markerad.');
      return;
    }
    this.create({ kind: 'area', outline: [], slab });
  }

  /** En markyta runt huset. Finns den redan i tillståndet markeras den. */
  aroundHouse(): void {
    if (!this.hasTerrain()) return;
    const doc = this.host.store.doc;
    if (!Object.values(doc.elements).some((e) => e.type === 'Wall' && !e.space)) {
      this.host.hint('Rita huset först, så följer markytan dess kontur.');
      return;
    }
    const old = this.existing((e) => !!e.params.around);
    if (old) {
      this.host.selection.set([old.id]);
      this.host.hint('Huset har redan en markyta runt sig. Den är markerad.');
      return;
    }
    this.create({ kind: 'area', outline: [], around: true });
  }

  private existing(test: (e: Element) => boolean): Element | undefined {
    const states = this.states();
    return Object.values(this.host.store.doc.elements).find((e) => e.type === 'Ground' && !e.space && e.states.some((s) => states.includes(s)) && test(e));
  }

  /** Tillstånden ett nytt markobjekt får: det som visas, eller alla förslag när Befintligt visas. */
  private states(): Id[] {
    const doc = this.host.store.doc;
    const active = this.host.activeState();
    if (doc.states.find((s) => s.id === active)?.kind !== 'existing') return [active];
    return doc.states.filter((s) => s.kind !== 'existing').map((s) => s.id);
  }

  private create(params: GroundParams): void {
    const states = this.states();
    if (!states.length) {
      this.host.hint('Projektet har inget förslag att lägga markobjektet i.');
      return;
    }
    const [el] = addElements(this.host.store, [{ type: 'Ground', storey: this.host.storey(), tags: [], params: params as unknown as Record<string, unknown>, props: {}, states }], this.host.activeState(), 'Lägg till markobjekt');
    if (states[0] !== this.host.activeState()) this.host.hint('Markobjekt hör till förslaget och är lagt i förslagen; den färdiga marken syns där.', 5000);
    this.onCreated?.(el.id);
  }

  lastPoint(): Vec2 | undefined {
    return this.a ?? this.pts[this.pts.length - 1];
  }

  cursorPoint(): Vec2 | undefined {
    return this.current?.point;
  }

  takePoint(p: Vec2): void {
    this.click(roundMm(p));
    this.host.view.requestRender();
  }

  hintText(): string {
    const m = this.options.mode;
    if (m === 'slab') return 'Klicka i ett bjälklag: urgrävningen följer det, med arbetsutrymme runt om.';
    if (m === 'point') return 'Klicka där höjdpunkten ska ligga; höjden tas ur marken och ändras i egenskaperna.';
    if (isLineMode(m)) {
      const what = { path: 'vägens referenslinje (mitten från början)', breakline: 'brytlinjen', wall: 'stödmurens linje' }[m as 'path'];
      return this.pts.length ? 'Klicka nästa punkt. Dubbelklick, Enter eller Klar avslutar.' : `Klicka första punkten av ${what}.`;
    }
    return this.a ? 'Klicka det motsatta hörnet.' : 'Klicka ett hörn av markytan, eller välj Runt huset.';
  }

  cancel(): void {}

  reset(): void {
    this.a = null;
    this.pts = [];
    this.lockAngle = null;
    this.onChange?.();
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    if (this.a && this.current) {
      const pts = rect(this.a, this.current.point).map((q) => cam.toScreen(q));
      out.push(`<path d="M${pts.map((q) => q.join(' ')).join('L')}Z" class="rubber"/>`);
    }
    if (this.pts.length) {
      const pts = [...this.pts, ...(this.current ? [this.current.point] : [])].map((q) => cam.toScreen(q));
      out.push(`<path d="M${pts.map((q) => q.join(' ')).join('L')}" class="rubber"/>`);
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
