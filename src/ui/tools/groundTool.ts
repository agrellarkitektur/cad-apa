import { addElements } from '../../core/commands';
import type { Element, Id } from '../../core/model';
import { groundAt, terrainOf } from '../../core/site';
import type { GroundKind, GroundParams } from '../../elements/ground';
import { slabAt } from '../../elements/slab';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import type { PointTaker } from '../pointInput';
import { pxToMm, type ToolHost } from './host';
import { snapMarker } from './overlay';
import { roundMm, snap, type SnapResult } from './snap';

/** Vad verktyget lägger: en platå, en urgrävning eller en urgrävning under ett bjälklag (klick i bjälklaget). */
export type GroundMode = GroundKind | 'slab';

/**
 * Mark (0.10.4): dra upp en platå eller en urgrävning med två klick, lägg en
 * platå runt huset, eller klicka i ett bjälklag för en urgrävning under det.
 * Konturen ändras sedan i Modifiera, som bjälklagets. Höjden föreslås ur
 * den befintliga marken i rektangelns mitt (en urgrävning en meter under),
 * avrundad till 50 mm.
 *
 * Markobjekten hör till förslaget: ritas de i Befintligt läggs de i alla
 * förslag i stället.
 */
export class GroundTool implements ViewTool, PointTaker {
  cursor = 'crosshair';
  private host: ToolHost;
  private a: Vec2 | null = null;
  private current: SnapResult | null = null;
  options: { mode: GroundMode } = { mode: 'plateau' };
  lockAngle: number | null = null;
  onCreated?: (id: string) => void;
  onChange?: () => void;

  constructor(host: ToolHost) {
    this.host = host;
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
    if (!this.a) {
      this.a = pt;
      this.onChange?.();
      return;
    }
    if (Math.abs(pt[0] - this.a[0]) < 500 || Math.abs(pt[1] - this.a[1]) < 500) {
      this.host.hint(`${this.options.mode === 'excavation' ? 'Urgrävningen' : 'Platån'} måste vara minst 500 mm åt båda hållen.`);
      return;
    }
    const outline = rect(this.a, pt);
    const c: Vec2 = [(this.a[0] + pt[0]) / 2, (this.a[1] + pt[1]) / 2];
    const t = terrainOf(this.host.store.doc);
    const g = (t && groundAt(t, c[0], c[1])) ?? 0;
    const kind = this.options.mode;
    const height = Math.round((kind === 'excavation' ? g - 1000 : g) / 50) * 50;
    this.create({ kind, outline, height });
    this.reset();
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
    this.create({ kind: 'excavation', outline: [], slab });
  }

  /** En platå runt huset. Finns den redan i tillståndet markeras den. */
  aroundHouse(): void {
    if (!this.hasTerrain()) return;
    const doc = this.host.store.doc;
    if (!Object.values(doc.elements).some((e) => e.type === 'Wall' && !e.space)) {
      this.host.hint('Rita huset först, så följer platån dess kontur.');
      return;
    }
    const old = this.existing((e) => !!e.params.around);
    if (old) {
      this.host.selection.set([old.id]);
      this.host.hint('Huset har redan en platå runt sig. Den är markerad.');
      return;
    }
    this.create({ kind: 'plateau', outline: [], around: true });
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
    if (this.options.mode === 'slab') return 'Klicka i ett bjälklag: urgrävningen följer det, med arbetsutrymme runt om.';
    const what = this.options.mode === 'excavation' ? 'urgrävningens botten' : 'platån';
    return this.a ? 'Klicka det motsatta hörnet.' : `Klicka ett hörn av ${what}, eller välj Runt huset.`;
  }

  cancel(): void {}

  reset(): void {
    this.a = null;
    this.lockAngle = null;
    this.onChange?.();
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    if (this.a && this.current) {
      const pts = rect(this.a, this.current.point).map((q) => cam.toScreen(q));
      out.push(`<path d="M${pts.map((q) => q.join(' ')).join('L')}Z" class="rubber"/>`);
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
