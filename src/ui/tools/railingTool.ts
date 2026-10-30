import { addRailings } from '../../core/railings';
import { defaultSheet } from '../../core/viewCategories';
import { isSite, type Id } from '../../core/model';
import { tidyBulges } from '../../elements/groundLines';
import { stairEdgesAt, type StairEdgeHit } from '../../elements/railing';
import { wallProfile } from '../../elements/wallProfile';
import { chainThrough, nearestEdge, sideOf, simplify, type Chain } from '../../geometry/chains';
import { closestOnSegment, dist } from '../../geometry/vec';
import { createContext } from '../../repr/context';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import type { PointTaker } from '../pointInput';
import { ChainInput } from './chainInput';
import { pxToMm, type ToolHost } from './host';
import { snapMarker } from './overlay';
import { nearSegments, roundMm, snap, type SnapResult } from './snap';

export type RailingMode = 'edge' | 'drawn';

/** En annan kant än trappans (0.11.3): hålets, bjälklagets, rampens, stödmurens, väggens eller en linje. */
interface EdgeChain {
  id: Id;
  side: Chain;
  whole: Chain;
}

/**
 * Räcket (0.11.1). Två sätt: *Längs kant* (förval) lägger räcket längs den
 * trappkant man klickar på, kopplat till trappan; *Ritat* klickar
 * referenslinjen punkt för punkt, med bågar (Båge, G), och tar höjden (Z)
 * ur det man snäpper till: på en trappkant stegnoslinjen, annars golvet.
 * Smartspöt och trappans smartmeny (*Räcke längs kanten*) gör samma sak.
 */
export class RailingTool implements ViewTool, PointTaker {
  cursor = 'crosshair';
  private host: ToolHost;
  readonly chain = new ChainInput();
  private lastUp = { t: 0, at: [0, 0] as Vec2 };
  private current: SnapResult | null = null;
  private edge: StairEdgeHit | null = null;
  private other: EdgeChain | null = null;
  private shift = false;
  /** Höjden i varje klickad punkt (nyckel: punkten i hela mm). */
  private zs = new Map<string, number>();
  options: { mode: RailingMode; place: 'inside' | 'on' | 'outside'; def?: Id } = { mode: 'edge', place: 'inside' };
  lockAngle: number | null = null;
  onCreated?: (ids: Id[]) => void;
  onChange?: () => void;

  constructor(host: ToolHost) {
    this.host = host;
  }

  get started(): boolean {
    return this.chain.count > 0;
  }

  get arc(): boolean {
    return this.chain.arc;
  }

  setArc(on: boolean): void {
    this.chain.arc = on;
    this.onChange?.();
    this.host.view.requestRender();
  }

  setMode(mode: RailingMode): void {
    this.options.mode = mode;
    if (mode === 'edge') this.reset();
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
    else {
      this.edge = null;
      this.other = null;
    }
  }

  /** Kanten närmast (inte trappans): kedjan genom den och sidan mellan två hörn. Räckena själva räknas inte. */
  private otherAt(at: Vec2, tol: number): EdgeChain | null {
    const doc = this.host.store.doc;
    const all = this.host.snapSegments().filter((q) => !q.ref && !q.point && doc.elements[q.id]?.type !== 'Railing' && doc.elements[q.id]?.type !== 'Stair');
    let best: { i: number; d: number } | null = null;
    for (const q of nearSegments(all, at, tol)) {
      const d = dist(closestOnSegment(at, q.a, q.b).point, at);
      if (d <= tol && (!best || d < best.d)) best = { i: all.indexOf(q), d };
    }
    if (!best) return null;
    const hit = all[best.i];
    const own = all.filter((q) => q.id === hit.id);
    const whole = simplify(chainThrough(own, own.indexOf(hit)));
    const side = whole.points.length > 2 || whole.closed ? sideOf(whole, nearestEdge(whole, at)) : whole;
    return { id: hit.id, side, whole };
  }

  private edgesAt(at: Vec2, tol: number): StairEdgeHit[] {
    const state = this.host.activeState();
    return stairEdgesAt(this.host.store.doc, this.host.storey(), (el) => el.states.includes(state), at, tol);
  }

  private track(p: ViewPointer): void {
    const tol = pxToMm(this.host, p.pointerType === 'touch' ? 18 : 10);
    if (this.options.mode === 'edge') {
      this.shift = p.shift;
      this.edge = isSite(this.host.storey()) ? null : (this.edgesAt(p.model, Math.max(tol, 150))[0] ?? null);
      this.other = this.edge ? null : this.otherAt(p.model, tol);
      this.current = null;
      return;
    }
    this.current = snap({ cursor: p.model, segments: this.host.snapSegments(), tol });
  }

  up(p: ViewPointer): void {
    this.track(p);
    if (this.options.mode === 'edge') {
      if (this.other) {
        const c = this.shift ? this.other.whole : this.other.side;
        const line = c.closed ? [...c.points, c.points[0]] : c.points;
        this.createLine(line, undefined, line.map(() => 0), this.other.id);
        return;
      }
      if (!this.edge) {
        this.host.hint('Klicka på en kant: en trappa, ett hål, ett bjälklag, en vägg, en ramp eller en stödmur. Eller välj Ritat för att rita räcket fritt.');
        return;
      }
      this.createAlong(this.edge.stair.id, [this.edge.side]);
      return;
    }
    const now = performance.now();
    const double = now - this.lastUp.t < 350 && dist(p.screen, this.lastUp.at) < 8;
    this.lastUp = { t: now, at: p.screen };
    if (double && this.chain.count >= 2 && !this.chain.waiting) {
      this.finish();
      return;
    }
    this.click(roundMm(this.current?.point ?? p.model));
  }

  private click(pt: Vec2): void {
    // Höjden ur trappkanten man snäpper till, annars golvet (på Platsen höjden över marken, 0).
    const hit = isSite(this.host.storey()) ? undefined : this.edgesAt(pt, 5)[0];
    this.zs.set(key(pt), hit ? Math.round(hit.z) : 0);
    this.chain.click(pt, -1);
    this.onChange?.();
  }

  /** Räcken längs trappans kanter. */
  createAlong(stairId: Id, sides: ('left' | 'right')[]): Id[] {
    const st = this.host.store.doc.elements[stairId];
    if (st?.type !== 'Stair') return [];
    const params = (side: 'left' | 'right') => ({ host: { side }, ...(this.options.place !== 'inside' ? { place: this.options.place } : {}) });
    const made = addRailings(
      this.host.store,
      sides.map((side) => ({ storey: st.storey, host: st.id, ...(this.options.def ? { definition: this.options.def } : {}), params: params(side) })),
      st.states,
      sides.length > 1 ? 'Räcken på båda sidor' : 'Räcke längs kanten',
    );
    this.onCreated?.(made.map((e) => e.id));
    return made.map((e) => e.id);
  }

  /** Avsluta linjen: ett ritat räcke. */
  finish(): void {
    if (this.chain.waiting) this.chain.undo();
    const { points: line, bulges: raw } = this.chain.result();
    const bulges = tidyBulges(raw, line.length);
    this.chain.reset();
    this.onChange?.();
    if (line.length < 2) return;
    this.createLine(line, bulges);
  }

  /**
   * Typen för ett nytt räcke: den valda, om den passar där (på Platsen en
   * typ med *Mark*, på en våning en med *Byggnad*), annars förvalet där.
   */
  defFor(storey: Id): Id | undefined {
    const m = this.options.def ? this.host.store.doc.definitions[this.options.def]?.railing : undefined;
    if (!m) return undefined;
    const site = isSite(storey);
    return (site ? m.ground : m.building || !m.ground) ? this.options.def : undefined;
  }

  /**
   * Stödmurens krön (0.11.3): längs en stödmur på Platsen får räcket fast
   * höjd ur krönet i varje punkt, i stället för höjden över marken.
   */
  private crest(from: Id | undefined, pts: Vec2[]): number[] | null {
    const doc = this.host.store.doc;
    const el = from ? doc.elements[from] : undefined;
    if (el?.type !== 'Ground' || el.params.kind !== 'wall' || !isSite(this.host.storey())) return null;
    const { ctx } = createContext(doc, this.host.storey(), { state: this.host.activeState() }, defaultSheet(doc.graphics), () => true);
    const prof = wallProfile(ctx, el);
    if (!prof?.stations.length) return null;
    return pts.map((q) => {
      let best = prof.stations[0];
      for (const st of prof.stations) if (dist(st.at, q) < dist(best.at, q)) best = st;
      return Math.round(best.top);
    });
  }

  /** Ett ritat räcke längs en färdig linje (också smartspöt), med höjderna ur de klickade punkterna. `from` är objektet linjen följer. */
  createLine(line: Vec2[], bulges?: number[], z?: number[], from?: Id): boolean {
    const pts = line.map((q) => [Math.round(q[0]), Math.round(q[1])] as [number, number]);
    if (pts.length < 2) return false;
    const crest = this.crest(from, pts);
    const zs = crest ?? z ?? pts.map((q) => this.zs.get(key(q)) ?? 0);
    this.zs.clear();
    const storey = this.host.storey();
    const def = this.defFor(storey);
    const params: Record<string, unknown> = { line: pts, ...(bulges ? { bulges } : {}), ...(zs.some((v) => v) ? { z: zs } : {}), ...(crest ? { heightFrom: 'fixed' } : {}), ...(this.options.place !== 'on' && this.options.place !== 'inside' ? { place: this.options.place } : {}) };
    const made = addRailings(this.host.store, [{ storey, ...(def ? { definition: def } : {}), params }], [this.host.activeState()], 'Lägg till räcke');
    this.onCreated?.(made.map((e) => e.id));
    return true;
  }

  undoPoint(): void {
    this.chain.undo();
    this.onChange?.();
    this.host.view.requestRender();
  }

  lastPoint(): Vec2 | undefined {
    return this.chain.last();
  }

  cursorPoint(): Vec2 | undefined {
    return this.current?.point;
  }

  takePoint(p: Vec2): void {
    if (this.options.mode === 'edge') this.setMode('drawn');
    this.click(roundMm(p));
    this.host.view.requestRender();
  }

  hintText(): string {
    if (this.options.mode === 'edge')
      return isSite(this.host.storey())
        ? 'Klicka på en kant: rampens, markytans, stödmurens, en linje. Shift+klick tar hela konturen. Höjden mäts från den färdiga marken (stödmurens krön: fast höjd).'
        : 'Klicka på en kant: trappans (räcket följer trappan), ett håls, ett bjälklags, en väggs eller en linje. Shift+klick tar hela konturen.';
    if (this.chain.waiting) return 'Klicka en punkt på bågen.';
    if (this.chain.arc && this.chain.count) return 'Klicka var bågen slutar.';
    if (!this.chain.count) return isSite(this.host.storey()) ? 'Klicka staketets början. Höjden mäts från den färdiga marken.' : 'Klicka räckets början. En punkt på en trappkant får stegnoslinjens höjd, annars golvets.';
    return 'Klicka nästa punkt. Dubbelklick, Enter eller Klar avslutar.';
  }

  cancel(): void {}

  reset(): void {
    this.chain.reset();
    this.zs.clear();
    this.lockAngle = null;
    this.onChange?.();
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    const path = (pts: Vec2[]) => `M${pts.map((q) => cam.toScreen(q).join(' ')).join('L')}`;
    if (this.options.mode === 'edge' && this.edge) out.push(`<path d="${path(this.edge.pts)}" class="rubber" style="stroke-width:3"/>`);
    if (this.options.mode === 'edge' && this.other) {
      const c = this.shift ? this.other.whole : this.other.side;
      out.push(`<path d="${path(c.closed ? [...c.points, c.points[0]] : c.points)}" class="rubber" style="stroke-width:3"/>`);
    }
    if (this.chain.count) {
      const raw = this.chain.preview(this.current?.point);
      if (raw.length >= 2) out.push(`<path d="${path(raw)}" class="rubber"/>`);
    }
    if (this.current) out.push(snapMarker(cam, this.current));
    return out.join('');
  }
}

const key = (q: Vec2) => `${Math.round(q[0])},${Math.round(q[1])}`;
