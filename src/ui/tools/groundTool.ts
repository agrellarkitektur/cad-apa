import { addElements, updateParams } from '../../core/commands';
import { isSite, SITE_STOREY, storeysUpFrom, type Element, type Id } from '../../core/model';
import { groundAt, terrainOf } from '../../core/site';
import type { GroundParams } from '../../elements/ground';
import { extendRamp } from '../../elements/rampEdits';
import { hasArcs, tidyBulges } from '../../elements/groundLines';
import { areaOutline } from '../../elements/groundGeometry';
import { ChainInput } from './chainInput';
import { resolveParams } from '../../elements/registry';
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
export type GroundMode = 'area' | 'slab' | 'path' | 'point' | 'breakline' | 'wall' | 'level' | 'drain';

/** Sätten som ritas som en linje, avslutad med dubbelklick, Enter eller Klar. */
const LINE_MODES: readonly GroundMode[] = ['path', 'breakline', 'wall', 'drain'];
export const isLineMode = (m: GroundMode): boolean => LINE_MODES.includes(m);

/**
 * Mark (0.10.4): dra upp en markyta med två klick eller rita den som en
 * polygon med bågar (0.10.24), lägg en markyta runt huset, eller klicka i
 * ett bjälklag för en urgrävning under det. Konturen ändras sedan i
 * Modifiera, som bjälklagets. Höjden föreslås ur den befintliga marken i
 * konturens mitt, avrundad till 50 mm.
 *
 * Markobjekten hör till förslaget: ritas de i Befintligt läggs de i alla
 * förslag i stället.
 */
export class GroundTool implements ViewTool, PointTaker {
  cursor = 'crosshair';
  private host: ToolHost;
  private a: Vec2 | null = null;
  /** Linjens punkter (ramp, brytlinje, stödmur …), med bågar (0.10.19) som takets kontur; markytans polygon (0.10.24). */
  readonly chain = new ChainInput();
  private lastUp = { t: 0, at: [0, 0] as Vec2 };
  private current: SnapResult | null = null;
  /** Sättet, och hur markytan ritas (0.10.24): rektangel med två klick eller polygon hörn för hörn. */
  options: { mode: GroundMode; shape: 'rect' | 'polygon' } = { mode: 'area', shape: 'rect' };
  /**
   * Rampen som förlängs (0.10.18): ett klick på änden av en ramp ritar
   * vidare på den, som 2D-formens linje. `pts` börjar då i änden.
   */
  private base: { id: Id; atStart: boolean } | null = null;
  lockAngle: number | null = null;
  onCreated?: (id: string) => void;
  onChange?: () => void;

  constructor(host: ToolHost) {
    this.host = host;
  }

  get started(): boolean {
    return !!this.a || this.chain.count > 0;
  }

  /** Linjens punkter hittills. */
  private get pts(): Vec2[] {
    return this.chain.points;
  }

  /** Markytan ritas som en polygon (0.10.24). */
  get polygon(): boolean {
    return this.options.mode === 'area' && this.options.shape === 'polygon';
  }

  /** Polygonen kan slutas (Klar, Enter). */
  get canClose(): boolean {
    return this.polygon && this.chain.canClose;
  }

  /** Nästa kant blir en båge (0.10.19). */
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
    // Dubbelklick avslutar linjen (andra klicket lade redan samma punkt), eller sluter polygonen.
    if (double && ((isLineMode(this.options.mode) && this.pts.length >= 2 && !this.chain.waiting) || this.canClose)) {
      this.finish();
      return;
    }
    const pt = roundMm(this.current?.point ?? p.model);
    // Klick på änden av en ramp förlänger den (0.10.18); Ctrl börjar en ny.
    if (this.options.mode === 'path' && !this.pts.length && !p.mod && this.continueAt(pt, pxToMm(this.host, p.pointerType === 'touch' ? 18 : 10))) return;
    this.click(pt);
  }

  /** Rampen som förlängs, om någon. */
  get continuing(): Id | null {
    return this.base?.id ?? null;
  }

  /**
   * Börja förlänga rampen vars ände ligger närmast `pt`, inom `tol`:
   * synliga, olåsta ramper, de markerade först. Svarar true om det blev så.
   */
  continueAt(pt: Vec2, tol: number): boolean {
    const host = this.host;
    const doc = host.store.doc;
    const sel = new Set(host.selection.list());
    let best: { id: Id; atStart: boolean; d: number; sel: boolean } | null = null;
    for (const pk of host.plan().pickables) {
      const el = doc.elements[pk.id];
      if (el?.type !== 'Ground' || el.locked || el.params.kind !== 'path') continue;
      const line = (el.params.line ?? []) as Vec2[];
      if (line.length < 2) continue;
      for (const atStart of [true, false]) {
        const d = dist(pt, atStart ? line[0] : line[line.length - 1]);
        const s = sel.has(el.id);
        if (d <= tol && (!best || (s && !best.sel) || (s === best.sel && d < best.d))) best = { id: el.id, atStart, d, sel: s };
      }
    }
    return !!best && this.continueFrom(best.id, best.atStart);
  }

  /** Förläng rampen `id` från början eller slutet (också från Modifiera). */
  continueFrom(id: Id, atStart: boolean): boolean {
    const el = this.host.store.doc.elements[id];
    const line = (el?.params.line ?? []) as Vec2[];
    if (!el || el.locked || line.length < 2) return false;
    this.options.mode = 'path';
    this.a = null;
    this.base = { id, atStart };
    const end = atStart ? line[0] : line[line.length - 1];
    this.chain.reset();
    this.chain.points.push([end[0], end[1]]);
    this.onChange?.();
    this.host.view.requestRender();
    return true;
  }

  /** Om projektet har en markmodell; annars ett tips. */
  private hasTerrain(): boolean {
    if (terrainOf(this.host.store.doc)) return true;
    this.host.hint('Markobjekt behöver en markmodell. Lägg in platsen ur Höjdkurvor (högerklicka på Platsen i projektträdet, Inställningar).', 5000);
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
    // Markhöjden (0.10.20): höjderna läses ur marken när den ritas.
    if (this.options.mode === 'level') {
      this.create({ kind: 'level', outline: [], line: [[pt[0], pt[1]]] });
      return;
    }
    if (isLineMode(this.options.mode)) {
      // Linjen sluts aldrig: ett klick på första punkten är bara en punkt till.
      this.chain.click(pt, -1);
      this.onChange?.();
      return;
    }
    if (this.polygon) {
      // Ett klick på första hörnet sluter konturen (0.10.24), som bjälklagets.
      if (this.chain.click(pt, pxToMm(this.host, 10)) === 'closed') this.finishArea();
      else this.onChange?.();
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
    this.createArea(rect(this.a, pt));
    this.reset();
  }

  /** Polygonen är sluten: en markyta med den, med bågarna (0.10.24). */
  private finishArea(): void {
    const c = this.chain.result();
    this.reset();
    this.createArea(c.points, c.bulges);
  }

  /**
   * En markyta med konturen (också smartspöt, 0.10.23), med bågar (0.10.24).
   * Höjden föreslås ur den befintliga marken i konturens mitt, avrundad till 50 mm.
   */
  createArea(outline: [number, number][], bulges?: number[]): boolean {
    const arcs = hasArcs(bulges) ? { bulges: tidyBulges(bulges, outline.length + 1) } : {};
    const ring = areaOutline({ outline, ...arcs });
    if (!this.hasTerrain() || ring.length < 3) return false;
    let x = 0;
    let y = 0;
    for (const q of ring) {
      x += q[0] / ring.length;
      y += q[1] / ring.length;
    }
    const g = this.groundHeight([x, y]);
    this.create({ kind: 'area', outline, ...arcs, height: Math.round(g / 50) * 50 });
    return true;
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
    // En båge som väntar på sin mittpunkt blir inte av.
    if (this.chain.waiting) this.chain.undo();
    // Markytans polygon sluts med en rak sista kant (0.10.24).
    if (this.polygon) {
      if (this.canClose && this.chain.close()) this.finishArea();
      return;
    }
    const { points: line, bulges: raw } = this.chain.result();
    const bulges = tidyBulges(raw, line.length);
    const mode = this.options.mode;
    const base = this.base;
    this.chain.reset();
    this.base = null;
    this.onChange?.();
    if (base) {
      this.extend(base, line.slice(1), bulges);
      return;
    }
    if (line.length < 2 || !isLineMode(mode)) return;
    const arcs = bulges ? { bulges } : {};
    if (mode === 'wall' || mode === 'drain') {
      this.create({ kind: mode, outline: [], line, ...arcs });
      return;
    }
    const h0 = Math.round(this.groundHeight(line[0]) / 10) * 10;
    const h1 = Math.round(this.groundHeight(line[line.length - 1]) / 10) * 10;
    if (mode === 'breakline') this.create({ kind: 'breakline', outline: [], line, height: h0, endHeight: h1, ...arcs });
    else this.create({ kind: 'path', outline: [], line, height: h0, endHeight: h1, ...arcs });
  }

  /**
   * Ett linjeobjekt längs en färdig linje (smartspöt, 0.10.22): det sätt
   * verktyget står i, eller `mode`, med samma höjder som när linjen ritas.
   */
  createLine(line: Vec2[], extra: Partial<GroundParams> = {}, mode: GroundMode = this.options.mode): boolean {
    if (!this.hasTerrain() || line.length < 2 || !isLineMode(mode)) return false;
    const pts = line.map((q) => [Math.round(q[0]), Math.round(q[1])] as [number, number]);
    if (mode === 'wall' || mode === 'drain') this.create({ kind: mode, outline: [], line: pts, ...extra });
    else {
      const h0 = Math.round(this.groundHeight(pts[0]) / 10) * 10;
      const h1 = Math.round(this.groundHeight(pts[pts.length - 1]) / 10) * 10;
      this.create({ kind: mode === 'breakline' ? 'breakline' : 'path', outline: [], line: pts, height: h0, endHeight: h1, ...extra });
    }
    return true;
  }

  /** Rampen med de nya punkterna (0.10.18); lutningen fortsätter, och den gamla änden behåller sin höjd. Med bågar (0.10.19). */
  private extend(base: { id: Id; atStart: boolean }, added: Vec2[], bulges?: number[]): void {
    const el = this.host.store.doc.elements[base.id];
    if (!el || !added.length) return;
    const patch = extendRamp(resolveParams<GroundParams>(this.host.store.doc, el), base.atStart, added, bulges);
    updateParams(this.host.store, [base.id], patch as Record<string, unknown>, 'Förläng rampen');
    this.host.selection.set([base.id]);
  }

  /** Ta bort det senaste klicket på linjen, eller börja om. */
  undoPoint(): void {
    if (this.chain.count) this.chain.undo();
    else this.reset();
    this.onChange?.();
    this.host.view.requestRender();
  }

  /** En urgrävning under bjälklaget där man klickade. Finns den redan markeras den. */
  private underSlab(pt: Vec2): void {
    const doc = this.host.store.doc;
    // På Platsen (0.10.25): bjälklaget på den lägsta våningen som har ett där.
    const storeys = isSite(this.host.storey()) ? storeysUpFrom(doc).map((s) => s.id) : [this.host.storey()];
    let slab: Id | null = null;
    for (const s of storeys) if (!slab) slab = slabAt(doc, s, this.host.activeState(), pt);
    if (!slab) {
      this.host.hint(isSite(this.host.storey()) ? 'Klicka inne i ett bjälklag under huset.' : 'Klicka inne i ett bjälklag på den här våningen.');
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
    const doc = this.host.store.doc;
    const states = this.states();
    if (!states.length) {
      this.host.hint('Projektet har inget förslag att lägga markobjektet i.');
      return;
    }
    // Markobjekten hör till Platsen (0.10.25).
    const storey = doc.storeys.some((s) => s.site) ? SITE_STOREY : this.host.storey();
    const [el] = addElements(this.host.store, [{ type: 'Ground', storey, tags: [], params: params as unknown as Record<string, unknown>, props: {}, states }], this.host.activeState(), 'Lägg till markobjekt');
    if (states[0] !== this.host.activeState()) this.host.hint('Markobjekt hör till förslaget och är lagt i förslagen; den färdiga marken syns där.', 5000);
    this.onCreated?.(el.id);
  }

  lastPoint(): Vec2 | undefined {
    return this.a ?? this.chain.last();
  }

  cursorPoint(): Vec2 | undefined {
    return this.current?.point;
  }

  takePoint(p: Vec2): void {
    const pt = roundMm(p);
    if (this.options.mode === 'path' && !this.pts.length && this.continueAt(pt, 1)) return;
    this.click(pt);
    this.host.view.requestRender();
  }

  hintText(): string {
    const m = this.options.mode;
    if (m === 'slab') return 'Klicka i ett bjälklag: urgrävningen följer det, med arbetsutrymme runt om.';
    if (m === 'point') return 'Klicka där höjdpunkten ska ligga; höjden tas ur marken och ändras i egenskaperna.';
    if (m === 'level') return 'Klicka där markhöjden ska stå; den befintliga och den nya höjden läses ur marken.';
    if (isLineMode(m)) {
      const what = { path: 'vägens referenslinje (mitten från början)', breakline: 'brytlinjen', wall: 'stödmurens linje', drain: 'låglinjen, från det högsta mot det lägsta' }[m as 'path'];
      if (this.chain.waiting) return 'Klicka en punkt på bågen.';
      if (this.chain.arc && this.pts.length) return 'Klicka var bågen slutar.';
      if (this.base) return 'Klicka nästa punkt av förlängningen. Dubbelklick, Enter eller Klar avslutar; lutningen fortsätter.';
      return this.pts.length ? 'Klicka nästa punkt. Dubbelklick, Enter eller Klar avslutar. Med Båge blir nästa kant en båge.' : `Klicka första punkten av ${what}${m === 'path' ? ', eller änden av en ramp för att förlänga den' : ''}.`;
    }
    if (this.polygon) {
      if (this.chain.waiting) return 'Klicka en punkt på bågen.';
      if (!this.chain.count) return 'Klicka första hörnet av markytan, eller välj Runt huset.';
      return `Klicka nästa hörn${this.chain.arc ? ' (bågens slut)' : ''}. Klicka på första hörnet, dubbelklicka eller tryck Enter när konturen är klar.`;
    }
    return this.a ? 'Klicka det motsatta hörnet.' : 'Klicka ett hörn av markytan, eller välj Runt huset.';
  }

  cancel(): void {}

  reset(): void {
    this.a = null;
    this.chain.reset();
    this.base = null;
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
      const pts = this.chain.preview(this.current?.point).map((q) => cam.toScreen(q));
      if (pts.length >= 2) out.push(`<path d="M${pts.map((q) => q.join(' ')).join('L')}" class="rubber"/>`);
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
