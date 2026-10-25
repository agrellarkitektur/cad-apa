import { updateParams } from '../../core/commands';
import type { Id } from '../../core/model';
import { removeNode, setOutline } from '../../core/roofEdit';
import { mergeAtCorner, reshapeWall } from '../../core/wallEdit';
import { bendShapeEdge, removeShapeNode } from '../../elements/shapeEdit';
import { dist } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import { pxToMm, type ToolHost } from '../tools/host';
import { snapMarker } from '../tools/overlay';
import type { PointTaker } from '../pointInput';
import { roundMm, snap, type SnapResult, type SnapSegment } from '../tools/snap';
import { CUT_OPS, clickCut, firstOfJoin, overlayCut } from './cutOps';
import type { ModifyContext, OpId } from './ops';
import { OUTLINE_OPS, commitOutline, overlayOutline } from './outlineOps';
import type { ModifyState } from './state';
import { BASE_OPS, commitTransform, overlayTransform } from './transformOps';
import { WALL_OPS, commitWall, currentLength, fixedEnd, overlayWall } from './wallOps';


/** Val som utförs direkt, utan att klicka i ritningen. */
export function runInstant(host: ToolHost, op: OpId, ctx: ModifyContext): void {
  const doc = host.store.doc;
  if (op === 'shapeRemove') {
    const el = ctx.shapeId ? doc.elements[ctx.shapeId] : undefined;
    const patch = el && removeShapeNode(el, ctx.index!);
    if (el && patch) updateParams(host.store, [el.id], patch, 'Ta bort punkt');
    else host.hint('Formen har för få punkter för att ta bort en.');
    return;
  }
  if (op === 'shapeStraighten') {
    const el = ctx.shapeId ? doc.elements[ctx.shapeId] : undefined;
    const patch = el && bendShapeEdge(el, ctx.index!, 0);
    if (el && patch) updateParams(host.store, [el.id], patch, 'Räta ut');
    return;
  }
  if (op === 'roofRemove') {
    const roof = ctx.roofId ? doc.elements[ctx.roofId] : undefined;
    const next = roof && removeNode(roof.params.outline as [number, number][], ctx.index!);
    if (next) setOutline(host.store, roof.id, next, 'Ta bort punkt');
    else host.hint('Konturen måste ha minst tre hörn.');
    return;
  }
  const el = ctx.wallId ? doc.elements[ctx.wallId] : undefined;
  if (!el) return;
  const p = el.params as { start: [number, number]; end: [number, number] };
  if (op === 'straighten') reshapeWall(host.store, el.id, p.start, p.end, 0, 'Räta ut');
  if (op === 'merge' && ctx.end && !mergeAtCorner(host.store, el.id, ctx.end)) host.hint('Hörnet har inte precis två väggar.');
}

/** Val som inte visar snäppmarkören. */
const NO_MARKER = new Set<OpId>(['fillet', 'chamfer', 'filletAll', 'chamferAll', 'trim', 'join']);

/**
 * Verktyget som kör ett val: förhandsvisar med markören och utför vid
 * klick eller när ett värde skrivs in. Själva valen ligger i grupper
 * (0.8.15): väggarnas form i wallOps.ts, punkter och kanter på 2D och tak i
 * outlineOps.ts, Trimma, Dela, Hörnskarv och Förläng i cutOps.ts, och
 * Flytta, Vrid, Spegla och I rad i transformOps.ts. Verktyget håller läget
 * (`ModifyState`) och baspunkten.
 */
export class ModifyTool implements ViewTool, ModifyState, PointTaker {
  cursor = 'crosshair';
  readonly host: ToolHost;
  readonly op: OpId;
  readonly ctx: ModifyContext;
  value: number;
  private done: () => void;
  private cursorAt: SnapResult | null = null;
  ref: Vec2 | null = null;
  /**
   * Flytta, Vrid, Spegla och I rad: baspunkten (0.8.13). Ett klick på det
   * markerade blir baspunkt bara om det snäpper till en ände, ett liv eller
   * en referenslinje; annars ber verktyget om en punkt först.
   */
  private base: Vec2 | null;
  first: { id: Id; at: Vec2 } | null = null;
  hoverAt: Vec2 | null = null;
  private changed: () => void;

  constructor(host: ToolHost, op: OpId, ctx: ModifyContext, value: number, done: () => void, changed: () => void = () => {}) {
    this.host = host;
    this.op = op;
    this.ctx = ctx;
    this.value = value;
    this.done = done;
    this.changed = changed;
    this.base = BASE_OPS.has(op) && ctx.kind === 'body' ? (ctx.clicked ? this.snapBase(ctx.at) : null) : ctx.at;
    if (op === 'join') this.first = firstOfJoin(this);
  }

  /** Tipset just nu, när verktyget väntar på något annat än det vanliga. */
  prompt(): string | null {
    if (BASE_OPS.has(this.op) && !this.base) return 'Klicka baspunkten: en ände, ett hörn, ett väggliv eller en referenslinje.';
    if (this.op === 'join' && !this.first) return 'Klicka på den första väggen eller linjen, på den del som ska vara kvar.';
    return null;
  }

  /** Klicket som baspunkt, om det snäpper till något i ritningen. */
  private snapBase(at: Vec2): Vec2 | null {
    const r = snap({ cursor: at, segments: this.baseSegments(), tol: pxToMm(this.host, 10) });
    return r.kind === 'free' || r.kind === 'angle' || r.kind === 'track' ? null : roundMm(r.point);
  }

  /** Det baspunkten snäpper mot: ritningen och det markerades egna konturer (t.ex. en bilds hörn). */
  private baseSegments(): SnapSegment[] {
    const own: SnapSegment[] = [];
    const ids = new Set(this.ctx.ids);
    for (const pk of this.host.plan().pickables) {
      if (!ids.has(pk.id)) continue;
      for (const rings of pk.regions) for (const ring of rings) for (let i = 0; i < ring.length; i++) own.push({ id: pk.id, a: ring[i], b: ring[(i + 1) % ring.length] });
    }
    return own.length ? [...this.host.snapSegments(), ...own] : this.host.snapSegments();
  }

  setValue(v: number): void {
    this.value = v;
    this.host.view.requestRender();
  }

  /** Väggens längd nu (för Sträck). */
  currentLength(): number {
    return currentLength(this);
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
    const tol = pxToMm(this.host, p.pointerType === 'touch' ? 18 : 10);
    const picking = BASE_OPS.has(this.op) && !this.base;
    const exclude = new Set((this.op === 'move' || this.op === 'multiply' || this.op === 'stretch') && !picking ? this.ctx.ids : []);
    const from = this.op === 'stretch' ? fixedEnd(this) : BASE_OPS.has(this.op) ? (this.base ?? undefined) : this.ctx.at;
    this.cursorAt = snap({ cursor: p.model, from, segments: picking ? this.baseSegments() : this.host.snapSegments(), tol, ortho: p.shift && !picking, exclude });
  }

  up(p: ViewPointer): void {
    this.track(p);
    this.click(roundMm(this.cursorAt?.point ?? p.model), p.model);
  }

  /** Om verktyget tar emot skrivna punkter: inte de som klickar på ett objekt (Trimma, Hörnskarv …). */
  get takesPoints(): boolean {
    return !CUT_OPS.has(this.op) && this.op !== 'extend';
  }

  // Skrivna punkter i smartshell (0.8.21): Flytta @1200,0 räknas från baspunkten.
  lockAngle: number | null = null;

  lastPoint(): Vec2 | undefined {
    if (this.op === 'rotate' && this.ref) return this.base ?? undefined;
    return (BASE_OPS.has(this.op) ? this.base : this.op === 'stretch' ? fixedEnd(this) : this.ctx.at) ?? undefined;
  }

  cursorPoint(): Vec2 | undefined {
    return this.cursorAt?.point ?? this.hoverAt ?? undefined;
  }

  takePoint(pt: Vec2): void {
    const at = roundMm(pt);
    this.cursorAt = { point: at, kind: 'free', label: '' };
    this.click(at, at);
    this.host.view.requestRender();
  }

  hintText(): string {
    return this.prompt() ?? '';
  }

  /** Välj baspunkten igen (Baspunkt i smartshell). */
  repickBase(): void {
    if (!BASE_OPS.has(this.op)) return;
    this.base = null;
    this.ref = null;
    this.changed();
    this.host.view.requestRender();
  }

  get hasBase(): boolean {
    return !!this.base;
  }

  private click(at: Vec2, model: Vec2): void {
    if (BASE_OPS.has(this.op) && !this.base) {
      this.base = at;
      this.changed();
      return;
    }
    if (this.op === 'rotate' && !this.ref) {
      if (dist(at, this.base!) < 1) return;
      this.ref = at;
      return;
    }
    if (CUT_OPS.has(this.op)) {
      const r = clickCut(this, model, at);
      if (r.done) this.done();
      else if (r.first) {
        this.first = r.first;
        this.changed();
      }
      return;
    }
    this.commit(at, null);
  }

  /** Ett inskrivet värde: utför med det. */
  applyValue(v: number): void {
    this.value = v;
    this.commit(this.cursorAt?.point ?? null, v);
  }

  private commit(at: Vec2 | null, typed: number | null): void {
    const base = BASE_OPS.has(this.op) ? this.base : this.ctx.at;
    if (!base) return;
    const finished = BASE_OPS.has(this.op)
      ? commitTransform(this, base, at, typed)
      : WALL_OPS.has(this.op)
        ? commitWall(this, base, at, typed)
        : OUTLINE_OPS.has(this.op)
          ? commitOutline(this, base, at, typed)
          : true;
    if (finished) this.done();
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    const at = this.cursorAt?.point ?? null;
    const base = BASE_OPS.has(this.op) ? this.base : this.ctx.at;
    if (!base) {
      if (this.cursorAt) out.push(snapMarker(cam, this.cursorAt));
      return out.join('');
    }
    if (BASE_OPS.has(this.op)) overlayTransform(this, cam, base, at, out);
    else if (WALL_OPS.has(this.op)) overlayWall(this, cam, base, at, out);
    else if (OUTLINE_OPS.has(this.op)) overlayOutline(this, cam, base, at, out);
    else if (CUT_OPS.has(this.op)) overlayCut(this, cam, at, out);
    if (this.cursorAt && !NO_MARKER.has(this.op)) out.push(snapMarker(cam, this.cursorAt));
    return out.join('');
  }
}
