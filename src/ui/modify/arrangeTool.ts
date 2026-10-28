import { canScale, extendAllTo, moveEach, scaledParams, scaleElements, transferSettings, trimAllAt, type BoundaryResult } from '../../core/arrange';
import { isArc } from '../../core/commands';
import type { Element, Id } from '../../core/model';
import { refFrame } from '../../core/wallEdit';
import { shapePoints, type Shape2DParams } from '../../elements/drawing2d';
import { dist, distToSegment, sub } from '../../geometry/vec';
import { pickableById, type Pickable } from '../../repr/plan';
import { imageCorners, type Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import { pickAt } from '../../view2d/pick';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import { labelOf } from '../labels';
import { pxToMm, type ToolHost } from '../tools/host';
import { lengthLabel, snapMarker } from '../tools/overlay';
import { nearSegments, roundMm, snap, type SnapResult, type SnapSegment } from '../tools/snap';
import type { ModifyContext, OpId } from './ops';
import { ghostPath, svgLine } from './draw';

/**
 * Modifiera-verktyg del 2 (0.8.14): Justera och Fördela, Hämta och överför
 * (pipetten), Skala, och Förläng och Trimma för flera mot en gräns. Samma
 * gränssnitt mot Modifier som ModifyTool i tool.ts.
 */

export type AlignKind = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom' | 'distH' | 'distV';

export const ALIGN_BUTTONS: { kind: AlignKind; label: string }[] = [
  { kind: 'left', label: 'Vänsterkanter' },
  { kind: 'hcenter', label: 'Mitt (lodrätt)' },
  { kind: 'right', label: 'Högerkanter' },
  { kind: 'top', label: 'Överkanter' },
  { kind: 'vcenter', label: 'Mitt (vågrätt)' },
  { kind: 'bottom', label: 'Underkanter' },
  { kind: 'distH', label: 'Fördela vågrätt' },
  { kind: 'distV', label: 'Fördela lodrätt' },
];

type Seg = { a: Vec2; b: Vec2 };

/** Alla punkter i ett elements ritade form, för att räkna dess yttre kanter. */
export function outlinePoints(item: Pickable): Vec2[] {
  const out: Vec2[] = [];
  // Punkterna läggs till en och en: ett stort DXF-underlag kan ha fler än
  // en spridning (`push(...)`) tål (0.8.15).
  const all = (pts: readonly Vec2[]) => {
    for (const q of pts) out.push(q);
  };
  for (const rings of item.regions) for (const r of rings) all(r);
  // Litterans ruta räcker (0.10.20.2): ledarna ska inte räknas när litteror riktas.
  if (item.prims[0]?.origin?.objectType === 'Label' && out.length) return out;
  for (const q of item.prims) {
    if (q.kind === 'line') out.push(q.a, q.b);
    else if (q.kind === 'polyline') all(q.points);
    else if (q.kind === 'region') for (const r of q.rings) all(r);
    else if (q.kind === 'text') out.push(q.at);
    else if (q.kind === 'image') out.push(...imageCorners(q));
    else if (q.kind === 'arc') {
      const sweep = q.end >= q.start ? q.end - q.start : q.end - q.start + 2 * Math.PI;
      for (let i = 0; i <= 8; i++) {
        const t = q.start + (sweep * i) / 8;
        out.push([q.center[0] + q.radius * Math.cos(t), q.center[1] + q.radius * Math.sin(t)]);
      }
    }
  }
  return out;
}

/** Minsta och största värdet, utan spridning i Math.min (som har ett tak för antalet). */
function range(values: Iterable<number>): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

interface Box {
  id: Id;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Flyttningarna för att justera eller fördela objekten. Justera lägger dem
 * mot markeringens yttersta kant eller mitt; Fördela behåller de yttersta och
 * ger lika avstånd mellan de andra (minst tre behövs).
 */
export function alignMoves(boxes: readonly Box[], kind: AlignKind): Map<Id, [number, number]> {
  const out = new Map<Id, [number, number]>();
  if (boxes.length < 2) return out;
  const X0 = Math.min(...boxes.map((b) => b.x0));
  const X1 = Math.max(...boxes.map((b) => b.x1));
  const Y0 = Math.min(...boxes.map((b) => b.y0));
  const Y1 = Math.max(...boxes.map((b) => b.y1));
  const put = (b: Box, dx: number, dy: number) => out.set(b.id, [Math.round(dx), Math.round(dy)]);
  if (kind === 'distH' || kind === 'distV') {
    if (boxes.length < 3) return out;
    const h = kind === 'distH';
    const lo = (b: Box) => (h ? b.x0 : b.y0);
    const hi = (b: Box) => (h ? b.x1 : b.y1);
    const sorted = [...boxes].sort((a, b) => lo(a) + hi(a) - (lo(b) + hi(b)));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const sizes = sorted.reduce((s, b) => s + hi(b) - lo(b), 0);
    const gap = (hi(last) - lo(first) - sizes) / (sorted.length - 1);
    let at = hi(first) + gap;
    for (const b of sorted.slice(1, -1)) {
      const d = at - lo(b);
      put(b, h ? d : 0, h ? 0 : d);
      at += hi(b) - lo(b) + gap;
    }
    return out;
  }
  for (const b of boxes) {
    if (kind === 'left') put(b, X0 - b.x0, 0);
    if (kind === 'right') put(b, X1 - b.x1, 0);
    if (kind === 'hcenter') put(b, (X0 + X1) / 2 - (b.x0 + b.x1) / 2, 0);
    if (kind === 'bottom') put(b, 0, Y0 - b.y0);
    if (kind === 'top') put(b, 0, Y1 - b.y1);
    if (kind === 'vcenter') put(b, 0, (Y0 + Y1) / 2 - (b.y0 + b.y1) / 2);
  }
  return out;
}

/**
 * Flyttningarna för att lägga objekten mot en linje: varje objekt flyttas
 * vinkelrätt mot linjen tills dess närmaste kant ligger på den. Ett objekt
 * som linjen går igenom läggs med den kant som ligger på samma sida som dess
 * mitt mot linjen.
 */
export function alignToLineMoves(items: readonly { id: Id; pts: readonly Vec2[] }[], a: Vec2, b: Vec2): Map<Id, [number, number]> {
  const out = new Map<Id, [number, number]>();
  const l = dist(a, b);
  if (l < 1) return out;
  const n: Vec2 = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  for (const it of items) {
    if (!it.pts.length) continue;
    const [lo, hi] = range(it.pts.map((q) => (q[0] - a[0]) * n[0] + (q[1] - a[1]) * n[1]));
    const d = lo >= 0 ? -lo : hi <= 0 ? -hi : lo + hi >= 0 ? -lo : -hi;
    out.set(it.id, [Math.round(n[0] * d) || 0, Math.round(n[1] * d) || 0]);
  }
  return out;
}

/** Ops som utgår från en baspunkt, som Flytta och Vrid. */
const NEEDS_BASE = new Set<OpId>(['scale']);

export class ArrangeTool implements ViewTool {
  cursor = 'crosshair';
  private host: ToolHost;
  private op: OpId;
  private ctx: ModifyContext;
  private value: number;
  private done: () => void;
  private changed: () => void;
  private cursorAt: SnapResult | null = null;
  private hoverAt: Vec2 | null = null;
  /** Skala: baspunkten och punkten som visar nuvarande längd. */
  private base: Vec2 | null = null;
  private ref: Vec2 | null = null;
  /** Trimma mot gräns: gränsen, när den klickats. */
  private boundary: { id: Id; segs: Seg[] } | null = null;

  constructor(host: ToolHost, op: OpId, ctx: ModifyContext, value: number, done: () => void, changed: () => void = () => {}) {
    this.host = host;
    this.op = op;
    this.ctx = ctx;
    this.value = value;
    this.done = done;
    this.changed = changed;
    if (op === 'pick') this.cursor = 'copy';
  }

  static handles(op: OpId): boolean {
    return op === 'align' || op === 'pick' || op === 'scale' || op === 'extendAll' || op === 'trimAll';
  }

  prompt(): string | null {
    if (this.op === 'scale') {
      if (!this.base) return 'Klicka baspunkten, som ligger still.';
      if (!this.ref) return 'Skriv faktorn och tryck Enter, eller klicka en punkt som visar nuvarande längd.';
      return 'Klicka dit punkten ska hamna.';
    }
    if (this.op === 'trimAll' && this.boundary) return 'Klicka på den sida av gränsen som ska bort.';
    return null;
  }

  currentLength(): number {
    return 0;
  }

  setValue(v: number): void {
    this.value = v;
    this.host.view.requestRender();
  }

  applyValue(v: number): void {
    this.value = v;
    if (this.op !== 'scale') return;
    if (!this.base) {
      this.host.hint('Klicka baspunkten först.');
      return;
    }
    this.scaleBy(v);
  }

  down(): 'capture' {
    return 'capture';
  }

  drag(p: ViewPointer): void {
    this.track(p);
  }

  hover(p: ViewPointer | null): void {
    this.hoverAt = p ? p.model : null;
    if (p) this.track(p);
  }

  cancel(): void {}

  private track(p: ViewPointer): void {
    if (!NEEDS_BASE.has(this.op)) {
      this.cursorAt = null;
      return;
    }
    const tol = pxToMm(this.host, p.pointerType === 'touch' ? 18 : 10);
    this.cursorAt = snap({ cursor: p.model, from: this.base ?? undefined, segments: this.host.snapSegments(), tol, ortho: p.shift && !!this.base });
  }

  /** Det markerade som kan flyttas, med sin ritade form. */
  private movable(): { id: Id; pts: Vec2[] }[] {
    const doc = this.host.store.doc;
    const ids = new Set(this.ctx.ids);
    const byId = pickableById(this.host.plan().pickables);
    const out: { id: Id; pts: Vec2[] }[] = [];
    for (const id of this.ctx.ids) {
      const el = doc.elements[id];
      const pk = byId.get(id);
      if (!el || !pk || el.locked || (el.host && ids.has(el.host))) continue;
      const pts = outlinePoints(pk);
      if (pts.length) out.push({ id, pts });
    }
    return out;
  }

  /** Justera eller fördela med en knapp i smartmenyn. */
  alignBy(kind: AlignKind): void {
    const items = this.movable();
    const boxes = items.map((it) => {
      const [x0, x1] = range(it.pts.map((q) => q[0]));
      const [y0, y1] = range(it.pts.map((q) => q[1]));
      return { id: it.id, x0, x1, y0, y1 };
    });
    const need = kind === 'distH' || kind === 'distV' ? 3 : 2;
    if (boxes.length < need) {
      this.host.hint(need === 3 ? 'Fördela behöver minst tre objekt som kan flyttas.' : 'Justera behöver minst två objekt som kan flyttas; annars klicka en linje.', 3500);
      return;
    }
    const label = kind.startsWith('dist') ? 'Fördela' : 'Justera';
    if (!moveEach(this.host.store, alignMoves(boxes, kind), label)) this.host.hint('Allt ligger redan så.');
    this.done();
  }

  /**
   * Gränsen eller linjen vid en punkt: en väggs referenslinje, en 2D-linjes
   * form eller annars den närmaste linjen som går att snäppa till.
   */
  private boundaryAt(at: Vec2, own = false): { id: Id; segs: Seg[] } | null {
    const doc = this.host.store.doc;
    const tol = pxToMm(this.host, 9);
    const skip = own ? new Set<Id>() : new Set(this.ctx.ids);
    const all = this.host.plan().pickables;
    const hit = pickAt(own ? all : all.filter((pk) => !skip.has(pk.id)), at, tol, this.host.view.drawingScale);
    const el = hit ? doc.elements[hit] : undefined;
    const segs = el ? segmentsOf(this.host, el) : null;
    if (el && segs?.length) return { id: el.id, segs };
    let best: { d: number; s: SnapSegment } | null = null;
    for (const s of nearSegments(this.host.snapSegments(), at, tol)) {
      if (skip.has(s.id)) continue;
      const d = distToSegment(at, s.a, s.b);
      if (d <= tol && (!best || d < best.d)) best = { d, s };
    }
    return best ? { id: best.s.id, segs: [{ a: best.s.a, b: best.s.b }] } : null;
  }

  /**
   * Linjen att justera mot: den närmaste linjen som går att snäppa till (för
   * en vägg är det livet närmast klicket, inte referenslinjen), annars
   * gränsen vid klicket.
   */
  private alignLineAt(at: Vec2): Seg | null {
    const tol = pxToMm(this.host, 9);
    const skip = new Set(this.ctx.ids);
    let best: { d: number; s: SnapSegment } | null = null;
    for (const s of nearSegments(this.host.snapSegments(), at, tol)) {
      if (skip.has(s.id) || dist(s.a, s.b) < 1) continue;
      const d = distToSegment(at, s.a, s.b);
      if (d <= tol && (!best || d < best.d)) best = { d, s };
    }
    if (best && this.host.store.doc.elements[best.s.id]?.type === 'Wall') return this.wallFaceToward(best.s);
    if (best) return best.s;
    const b = this.boundaryAt(at);
    return b ? nearestSeg(b.segs, at) : null;
  }

  /**
   * En vägg man klickar på: det liv som vetter mot det som ska justeras (det
   * med kortast avstånd till dess mitt), så att objekten läggs mot väggen och
   * inte in i den.
   */
  private wallFaceToward(hit: Seg & { id: Id }): Seg {
    const pts = this.movable().flatMap((it) => it.pts);
    if (!pts.length) return hit;
    const c: Vec2 = [pts.reduce((a, q) => a + q[0], 0) / pts.length, pts.reduce((a, q) => a + q[1], 0) / pts.length];
    const u = sub(hit.b, hit.a);
    const lu = Math.hypot(u[0], u[1]) || 1;
    const lineDist = (s: Seg) => {
      const v = sub(s.b, s.a);
      const lv = Math.hypot(v[0], v[1]) || 1;
      return Math.abs(((c[0] - s.a[0]) * v[1] - (c[1] - s.a[1]) * v[0]) / lv);
    };
    let best: Seg = hit;
    let bd = lineDist(hit);
    for (const s of this.host.snapSegments()) {
      if (s.id !== hit.id) continue;
      const v = sub(s.b, s.a);
      const lv = Math.hypot(v[0], v[1]);
      if (lv < 1 || Math.abs((u[0] * v[1] - u[1] * v[0]) / (lu * lv)) > 0.01) continue;
      const d = lineDist(s);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  up(p: ViewPointer): void {
    this.track(p);
    const store = this.host.store;
    switch (this.op) {
      case 'align': {
        const s = this.alignLineAt(p.model);
        if (!s) {
          this.host.hint('Klicka på en linje, ett väggliv eller en kant att justera mot.');
          return;
        }
        if (!moveEach(store, alignToLineMoves(this.movable(), s.a, s.b), 'Justera mot linje')) this.host.hint('Allt ligger redan mot linjen.');
        this.done();
        return;
      }
      case 'pick': {
        const src = pickAt(this.host.plan().pickables, p.model, pxToMm(this.host, 8), this.host.view.drawingScale);
        const el = src ? store.doc.elements[src] : undefined;
        if (!el) {
          this.host.hint('Klicka på objektet att hämta inställningarna från.');
          return;
        }
        if (!this.ctx.ids.some((id) => id !== el.id && store.doc.elements[id]?.type === el.type)) {
          this.host.hint(`Det markerade har ingen ${labelOf(store.doc, el).replace(/\s\d+$/, '').toLowerCase()} att ge inställningarna till.`, 3500);
          return;
        }
        const r = transferSettings(store, el.id, this.ctx.ids);
        const notes = [r.other ? `${r.other} av ett annat slag ändrades inte` : '', r.locked ? `${r.locked} ${r.locked > 1 ? 'är låsta' : 'är låst'}` : ''].filter(Boolean);
        this.host.hint(`${r.done} fick inställningarna från ${labelOf(store.doc, el)}${notes.length ? `; ${notes.join(', ')}` : ''}.`, 4000);
        this.done();
        return;
      }
      case 'scale': {
        const at = roundMm(this.cursorAt?.point ?? p.model);
        if (!this.base) {
          this.base = at;
          this.changed();
          return;
        }
        if (!this.ref) {
          if (dist(at, this.base) < 1) return;
          this.ref = at;
          this.changed();
          return;
        }
        const f = this.factorAt(at);
        if (f) this.scaleBy(f);
        return;
      }
      case 'extendAll': {
        const b = this.boundaryAt(p.model);
        if (!b) {
          this.host.hint('Klicka på väggen eller linjen som ska vara gräns.');
          return;
        }
        this.report(extendAllTo(store, this.ctx.ids, b.id, b.segs), 'förlängdes', 'nådde inte fram');
        this.done();
        return;
      }
      case 'trimAll': {
        if (!this.boundary) {
          this.boundary = this.boundaryAt(p.model, true);
          if (!this.boundary) this.host.hint('Klicka på väggen eller linjen som ska vara gräns.');
          this.changed();
          return;
        }
        this.report(trimAllAt(store, this.ctx.ids, this.boundary.id, this.boundary.segs, p.model), 'trimmades', 'korsade inte gränsen');
        this.done();
        return;
      }
      default:
        return;
    }
  }

  private report(r: BoundaryResult, did: string, missed: string): void {
    const doc = this.host.store.doc;
    const parts = [`${r.done} ${did}`];
    if (r.skipped) parts.push(`${r.skipped} ${missed}`);
    if (r.blocked.length) parts.push(`${r.blocked.map((id) => labelOf(doc, doc.elements[id])).join(', ')} låg i biten som skulle bort`);
    this.host.hint(`${parts.join('; ')}.`, r.skipped || r.blocked.length || !r.done ? 5000 : 2500);
  }

  /** Faktorn när referenspunkten flyttas till `at`. */
  private factorAt(at: Vec2): number | null {
    if (!this.base || !this.ref) return null;
    const l0 = dist(this.base, this.ref);
    const l1 = dist(this.base, at);
    return l0 >= 1 && l1 >= 1 ? l1 / l0 : null;
  }

  private scaleBy(f: number): void {
    if (!(f > 0)) {
      this.host.hint('Faktorn måste vara större än noll.');
      return;
    }
    const doc = this.host.store.doc;
    const skipped = this.ctx.ids.filter((id) => !canScale(doc.elements[id]) && !doc.elements[id]?.host).length;
    const n = scaleElements(this.host.store, this.ctx.ids, roundMm(this.base!), f);
    if (skipped) this.host.hint(`${n} skalades; ${skipped} går inte att skala (väggar, tak, rum och låsta).`, 4500);
    this.done();
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    const doc = this.host.store.doc;
    const line = (pts: readonly Vec2[], cls?: string) => svgLine(cam, pts, cls);
    const at = this.cursorAt?.point ?? null;
    switch (this.op) {
      case 'align':
      case 'extendAll':
      case 'trimAll': {
        if (this.op === 'trimAll' && this.boundary) {
          for (const s of this.boundary.segs) out.push(line([s.a, s.b], 'trim-cut'));
          break;
        }
        if (this.op === 'align') {
          const s = this.hoverAt ? this.alignLineAt(this.hoverAt) : null;
          if (s) {
            const l = dist(s.a, s.b) || 1;
            const u: Vec2 = [(s.b[0] - s.a[0]) / l, (s.b[1] - s.a[1]) / l];
            out.push(line([[s.a[0] - u[0] * 20000, s.a[1] - u[1] * 20000], [s.b[0] + u[0] * 20000, s.b[1] + u[1] * 20000]], 'snap-guide'));
            const byId = pickableById(this.host.plan().pickables);
            for (const [id, d] of alignToLineMoves(this.movable(), s.a, s.b)) {
              const pk = byId.get(id);
              if (pk) out.push(ghostPath(cam, pk, (q) => [q[0] + d[0], q[1] + d[1]]));
            }
          }
          break;
        }
        const b = this.hoverAt ? this.boundaryAt(this.hoverAt, this.op === 'trimAll') : null;
        if (b) for (const s of b.segs) out.push(line([s.a, s.b], 'snap-guide'));
        break;
      }
      case 'scale': {
        if (!this.base) break;
        const f = at && this.ref ? this.factorAt(at) : !this.ref ? this.value : null;
        if (at) out.push(line([this.base, at]));
        if (this.ref) out.push(line([this.base, this.ref], 'snap-guide'));
        if (f && f > 0) {
          const base = this.base;
          const byId = pickableById(this.host.plan().pickables);
          for (const id of this.ctx.ids) {
            const pk = byId.get(id);
            if (pk && canScale(doc.elements[id]) && scaledParams(doc.elements[id], base, f)) out.push(ghostPath(cam, pk, (q) => [base[0] + (q[0] - base[0]) * f, base[1] + (q[1] - base[1]) * f]));
          }
          if (at && this.ref) out.push(lengthLabel(cam, base, at, `${(Math.round(f * 1000) / 1000).toLocaleString('sv-SE')}×`));
        }
        break;
      }
      default:
        break;
    }
    if (this.cursorAt && NEEDS_BASE.has(this.op)) out.push(snapMarker(cam, this.cursorAt));
    return out.join('');
  }
}

/** Gränsens bitar för en vägg (referenslinjen) eller en 2D-linje (formen). */
function segmentsOf(host: ToolHost, el: Element): Seg[] | null {
  const doc = host.store.doc;
  if (el.type === 'Wall') {
    const q = el.params as { start: Vec2; end: Vec2 };
    if (!isArc(el)) return [{ a: q.start, b: q.end }];
    const f = refFrame(doc, el);
    const pts = f.trace(0, f.length, 0) as Vec2[];
    return pts.slice(1).map((b, i) => ({ a: pts[i], b }));
  }
  if (el.type === 'Shape2D') {
    const sp = shapePoints(el.params as unknown as Shape2DParams);
    const pts = sp.closed ? [...sp.points, sp.points[0]] : sp.points;
    return pts.slice(1).map((b, i) => ({ a: pts[i], b }));
  }
  return null;
}

function nearestSeg(segs: readonly Seg[], q: Vec2): Seg {
  let best = segs[0];
  let bd = Infinity;
  for (const s of segs) {
    const d = distToSegment(q, s.a, s.b);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}
