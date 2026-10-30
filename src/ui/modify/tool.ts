import { defaultSheet } from '../../core/viewCategories';
import { updateParams } from '../../core/commands';
import { moveVertically } from '../../core/levels';
import { fuseLines } from '../../core/joinLines';
import type { Id } from '../../core/model';
import { mergeAtCorner, reshapeWall } from '../../core/wallEdit';
import { bendShapeEdge, editedShape, holesOf, removeShapeNode, shapePatch } from '../../elements/shapeEdit';
import { resolveParams } from '../../elements/registry';
import type { RoofParams } from '../../elements/roof';
import { wallProfile, type GroundParams } from '../../elements/ground';
import { clearRampLevel, setRampEase, setRampLevel } from './rampOps';
import { crestAtS } from '../../elements/groundWall';
import { fromRh, toRh } from '../../core/site';
import { along } from '../../elements/groundLines';
import { createContext } from '../../repr/context';
import { gateSpanAt, railingsOnStair, stairEdgesAt } from '../../elements/railing';
import { addGate, addRailingsOnStair } from '../railingFields';
import { withOwnCut, type EdgeCut } from '../../elements/roofBody';
import { dist } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import { pxToMm, type ToolHost } from '../tools/host';
import { snapMarker } from '../tools/overlay';
import type { PointTaker } from '../pointInput';
import { roundMm, snap, type SnapResult, type SnapSegment } from '../tools/snap';
import { CUT_OPS, clickCut, firstOfJoin, overlayCut } from './cutOps';
import { clickRoofTrim, roofAt } from './roofOps';
import { OPS, type ModifyContext, type OpId } from './ops';
import { OUTLINE_OPS, commitOutline, overlayOutline } from './outlineOps';
import type { ModifyState } from './state';
import { BASE_OPS, commitTransform, overlayTransform } from './transformOps';
import { WALL_OPS, commitWall, currentLength, fixedEnd, overlayWall } from './wallOps';


/** Val som utförs direkt, utan att klicka i ritningen. */
export function runInstant(host: ToolHost, op: OpId, ctx: ModifyContext): void {
  const doc = host.store.doc;
  if (op === 'shapeRemove') {
    const el = editedShape(doc, ctx.shapeId, ctx.hole);
    const patch = el && removeShapeNode(el, ctx.index!);
    if (el && patch) updateParams(host.store, [ctx.shapeId!], shapePatch(doc, ctx.shapeId!, ctx.hole, patch), 'Ta bort punkt');
    else host.hint(ctx.hole !== undefined && doc.elements[ctx.shapeId!]?.type === 'Slab' ? 'Hålet måste ha minst tre hörn.' : 'Formen har för få punkter för att ta bort en.');
    return;
  }
  if (op === 'shapeStraighten') {
    const el = editedShape(doc, ctx.shapeId, ctx.hole);
    const patch = el && bendShapeEdge(el, ctx.index!, 0);
    if (el && patch) updateParams(host.store, [ctx.shapeId!], shapePatch(doc, ctx.shapeId!, ctx.hole, patch), 'Räta ut');
    return;
  }
  // Foga ihop linjer (0.10.17).
  if (op === 'shapeFuse') {
    const kept = fuseLines(host.store, ctx.ids);
    if (kept) host.selection.set(kept);
    else host.hint('Linjerna har ingen gemensam ändpunkt (linjer och splines fogas var för sig; två ramper dockas när ändarna ligger inom rampens bredd).', 4000);
    return;
  }
  // Räcket längs trappans kant (0.11.1): sidan närmast klicket, eller båda.
  if (op === 'stairRailing' || op === 'stairRailings') {
    const st = doc.elements[ctx.shapeId ?? ctx.ids[0]];
    if (st?.type !== 'Stair') return;
    const on = railingsOnStair(doc, st.id);
    let sides: ('left' | 'right')[];
    if (op === 'stairRailings') sides = (['left', 'right'] as const).filter((s) => !on[s].length);
    else {
      const near = stairEdgesAt(doc, st.storey, (e) => e.id === st.id, ctx.at, Infinity)[0];
      sides = near ? [near.side] : ['left'];
    }
    if (!sides.length) {
      host.hint('Trappan har redan räcken på båda sidor.');
      return;
    }
    const ids = addRailingsOnStair(host.store, st.id, sides);
    if (ids.length) host.selection.set(ids);
    return;
  }
  // Grinden (0.11.3): facket där man klickade.
  if (op === 'railGate') {
    const el = doc.elements[ctx.shapeId ?? ctx.ids[0]];
    if (el?.type !== 'Railing') return;
    const span = gateSpanAt(doc, el, ctx.at);
    if (!span) return;
    if (addGate(host.store, el.id, span) >= 0) host.hint('Facket är en grind. Bredd, typ, hängning och öppning ställs in under Grindar i egenskaperna.', 4000);
    return;
  }
  // Trappans vilplan och svängar (0.11).
  if (op === 'stairLanding' || op === 'stairSteps' || op === 'stairTurnLanding' || op === 'stairWinders') {
    const el = ctx.shapeId ? doc.elements[ctx.shapeId] : undefined;
    if (!el || ctx.index === undefined) return;
    const key = op === 'stairLanding' || op === 'stairSteps' ? 'landings' : 'turnLandings';
    const on = op === 'stairLanding' || op === 'stairTurnLanding';
    const set = new Set((el.params[key] as number[] | undefined) ?? []);
    if (on) set.add(ctx.index);
    else set.delete(ctx.index);
    const list = [...set].sort((a, b) => a - b);
    host.store.transact(OPS[op].label, (tx) => {
      const cur = tx.doc.elements[el.id];
      if (!cur) return;
      const params: Record<string, unknown> = { ...cur.params };
      if (list.length) params[key] = list;
      else delete params[key];
      tx.putElement({ ...cur, params });
    });
    return;
  }
  // Rampens punkt utan egen höjd (0.10.18).
  if (op === 'pathLevelClear') {
    clearRampLevel(host, ctx);
    return;
  }
  // Övergången i punkten (0.10.19).
  if (op === 'pathEaseSharp' || op === 'pathEaseClear') {
    setRampEase(host, ctx, op === 'pathEaseSharp' ? 'sharp' : 'clear');
    return;
  }
  // Håltagningen ur bjälklaget (0.9.4).
  if (op === 'holeRemove') {
    const slab = ctx.shapeId ? doc.elements[ctx.shapeId] : undefined;
    const holes = holesOf(slab);
    if (slab && ctx.hole !== undefined && holes[ctx.hole]) updateParams(host.store, [slab.id], { holes: holes.filter((_, k) => k !== ctx.hole) }, 'Ta bort håltagning');
    return;
  }
  // Takfotens snitt för en kant (0.10.2).
  if (op === 'roofCutPerp' || op === 'roofCutPlumb' || op === 'roofCutAuto') {
    setEdgeCut(host, ctx, op === 'roofCutPerp' ? 'perp' : op === 'roofCutPlumb' ? 'plumb' : undefined);
    return;
  }
  const el = ctx.wallId ? doc.elements[ctx.wallId] : undefined;
  if (!el) return;
  const p = el.params as { start: [number, number]; end: [number, number] };
  if (op === 'straighten') reshapeWall(host.store, el.id, p.start, p.end, 0, 'Räta ut');
  if (op === 'merge' && ctx.end && !mergeAtCorner(host.store, el.id, ctx.end)) host.hint('Hörnet har inte precis två väggar.');
}

/**
 * Krönets höjd där man klickade på stödmuren (avrundad till 5 mm), som
 * förslag i värdefältet (0.10.13): i meter i RH 2000 när projektet har en
 * plats, annars i mm från ±0. Null om det inte går att lägga en punkt där.
 */
export function crestSuggestion(host: ToolHost, ctx: ModifyContext): { value: number; unit: 'mm' | 'm'; h: number } | null {
  const doc = host.store.doc;
  const el = ctx.shapeId ? doc.elements[ctx.shapeId] : undefined;
  if (el?.type !== 'Ground' || el.params.kind !== 'wall') return null;
  const { ctx: pc } = createContext(doc, el.storey, { state: host.activeState() }, defaultSheet(doc.graphics), () => true);
  const prof = wallProfile(pc, el);
  if (!prof) return null;
  const a = along(prof.center, ctx.at[0], ctx.at[1]);
  if (a.s < 100 || a.s > prof.stations[prof.stations.length - 1].s - 100) return null;
  const h = Math.round(crestAtS(prof, a.s) / 5) * 5;
  return doc.site ? { value: Math.round(toRh(doc.site, h) * 1000) / 1000, unit: 'm', h } : { value: h, unit: 'mm', h };
}

/**
 * En höjdpunkt på stödmuren där man klickade, med höjden som skrevs (0.10.13;
 * i meter RH 2000 när projektet har en plats) eller krönets höjd där.
 */
export function addCrestPoint(host: ToolHost, ctx: ModifyContext, typed?: number | null): void {
  const doc = host.store.doc;
  const el = ctx.shapeId ? doc.elements[ctx.shapeId] : undefined;
  if (el?.type !== 'Ground' || el.params.kind !== 'wall') return;
  if (el.locked) {
    host.hint('Låst. Lås upp i egenskaperna för att ändra.', 3000);
    return;
  }
  const sug = crestSuggestion(host, ctx);
  if (!sug) {
    host.hint(wallProfile(createContext(doc, el.storey, { state: host.activeState() }, defaultSheet(doc.graphics), () => true).ctx, el) ? 'Ändarnas höjd ändras i egenskaperna (ÖK i början och slutet).' : 'Krönet följer marken; lägg in en markmodell under Platsen först.');
    return;
  }
  const h = typed === null || typed === undefined || !Number.isFinite(typed) ? sug.h : doc.site ? Math.round(fromRh(doc.site, typed)) : Math.round(typed);
  const p = resolveParams<GroundParams>(doc, el);
  const at: [number, number] = [Math.round(ctx.at[0]), Math.round(ctx.at[1])];
  updateParams(host.store, [el.id], { crest: [...(p.crest ?? []), { at, h }] }, 'Höjdpunkt på krönet');
}

/** Ge kanten man klickat på ett eget snitt, eller ta bort det (`cut` utelämnat). */
export function setEdgeCut(host: ToolHost, ctx: ModifyContext, cut?: EdgeCut): void {
  const el = ctx.shapeId ? host.store.doc.elements[ctx.shapeId] : undefined;
  if (el?.type !== 'Roof' || ctx.index === undefined) return;
  if (el.locked) {
    host.hint('Låst. Lås upp i egenskaperna för att ändra.', 3000);
    return;
  }
  const p = resolveParams<RoofParams>(host.store.doc, el);
  updateParams(host.store, [el.id], { edgeCuts: withOwnCut(p, ctx.index, cut) }, cut === undefined ? 'Snitt som förvalt' : 'Kantens snitt');
}

/** Val som inte visar snäppmarkören. */
const NO_MARKER = new Set<OpId>(['roofCutAngle', 'fillet', 'chamfer', 'filletAll', 'chamferAll', 'shapeFillet', 'shapeChamfer', 'trim', 'join', 'roofTrim', 'moveZ', 'crestPoint', 'pathLevel', 'pathEase']);

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
  /** Förskjut (0.10.17): antalet kanter, 0 = alla. Sätts av Modifier. */
  edges = 1;
  /** Förskjut (0.10.29): det som skrivits vid objektet, eller null. */
  typing: string | null = null;
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

  /** Det skrivna värdet vid objektet som tal (komma eller punkt), eller null. */
  get typed(): number | null {
    if (!this.typing) return null;
    const v = Number(this.typing.replace(',', '.'));
    return Number.isFinite(v) && this.typing !== '-' ? v : null;
  }

  /**
   * En tangent medan ett val med värdet vid objektet pågår (0.10.29):
   * siffror, komma och minus skrivs, Backsteg tar bort, Esc tömmer. Svarar
   * true om tangenten togs om hand. Enter sköter `Modifier`.
   */
  typeKey(key: string): boolean {
    const t = this.typing ?? '';
    if (/^[0-9]$/.test(key) || ((key === ',' || key === '.') && !/[.,]/.test(t)) || (key === '-' && !t)) this.typing = t + key;
    else if (key === 'Backspace' && this.typing !== null) this.typing = t.length > 1 ? t.slice(0, -1) : null;
    else if (key === 'Escape' && this.typing !== null) this.typing = null;
    else return false;
    this.host.view.requestRender();
    return true;
  }

  /** Hur många kanter Förskjut flyttar (0.10.17); 0 = alla. */
  setEdges(n: number): void {
    this.edges = n;
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
    return !CUT_OPS.has(this.op) && this.op !== 'extend' && this.op !== 'roofTrim';
  }

  // Skrivna punkter i smartshell (0.8.21): Flytta @1200,0 räknas från baspunkten.
  lockAngle: number | null = null;

  lastPoint(): Vec2 | undefined {
    if ((this.op === 'rotate' || this.op === 'holeRotate') && this.ref) return (this.op === 'rotate' ? this.base : this.ctx.at) ?? undefined;
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
    if ((this.op === 'rotate' || this.op === 'holeRotate') && !this.ref) {
      if (dist(at, this.op === 'rotate' ? this.base! : this.ctx.at) < 1) return;
      this.ref = at;
      return;
    }
    if (this.op === 'roofTrim') {
      if (clickRoofTrim(this, model)) this.done();
      return;
    }
    if (this.op === 'roofCutAngle') {
      this.commitCutAngle(this.value);
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

  private commitCutAngle(v: number): void {
    if (!(v >= 5 && v <= 90)) {
      this.host.hint('Vinkeln mot det vågräta ska vara mellan 5° och 90°.');
      return;
    }
    setEdgeCut(this.host, this.ctx, Math.round(v * 10) / 10);
    this.done();
  }

  /** Ett inskrivet värde: utför med det. */
  applyValue(v: number): void {
    this.value = v;
    if (this.op === 'roofCutAngle') {
      this.commitCutAngle(v);
      return;
    }
    this.commit(this.cursorAt?.point ?? null, v);
  }

  /** Flytta i höjd (0.10.13): det inskrivna värdet, eller värdet i rutan vid ett klick. */
  private commitMoveZ(typed: number | null): boolean {
    const n = moveVertically(this.host.store, this.ctx.ids, typed ?? this.value);
    if (!n) this.host.hint('Inget att flytta i höjd (låst, eller 0 mm).', 3000);
    return true;
  }

  private commit(at: Vec2 | null, typed: number | null): void {
    // Ett klick medan ett värde står skrivet vid objektet: värdet åt det håll man klickar (0.10.29).
    if (typed === null && OPS[this.op].atObject) typed = this.typed;
    const base = BASE_OPS.has(this.op) ? this.base : this.ctx.at;
    if (!base) return;
    const finished = BASE_OPS.has(this.op)
      ? commitTransform(this, base, at, typed)
      : WALL_OPS.has(this.op)
        ? commitWall(this, base, at, typed)
        : OUTLINE_OPS.has(this.op)
          ? commitOutline(this, base, at, typed)
          : this.op === 'moveZ'
            ? this.commitMoveZ(typed)
            : this.op === 'crestPoint'
              ? (addCrestPoint(this.host, this.ctx, typed ?? this.value), true)
              : this.op === 'pathLevel'
                ? (setRampLevel(this.host, this.ctx, typed ?? this.value), true)
                : this.op === 'pathEase'
                  ? (setRampEase(this.host, this.ctx, 'soft', typed ?? this.value), true)
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
    else if (this.op === 'roofTrim' && this.hoverAt) {
      // Takfallet som det kapas mot, under markören.
      const target = roofAt(this, this.hoverAt);
      const ring = target && (target.params.outline as Vec2[]);
      if (ring) out.push(`<path d="M${ring.map((q) => cam.toScreen(q).join(' ')).join('L')}Z" class="ghost"/>`);
    }
    if (this.cursorAt && !NO_MARKER.has(this.op)) out.push(snapMarker(cam, this.cursorAt));
    return out.join('');
  }
}
