import { moveElements, moveWallEnd, rotateElements, updateParams } from '../core/commands';
import type { Id } from '../core/model';
import {
  continuingTangent,
  cornerCut,
  cornerPartner,
  openingsInCorner,
  extendTo,
  mergeAtCorner,
  mirrorAbout,
  multiplyElements,
  offsetGeometry,
  offsetWalls,
  refFrame,
  reshapeWall,
  roundCorner,
  splitWall,
  tangentArc,
} from '../core/wallEdit';
import { insertShapeNode, isShape, moveShapeNode, offsetShapeEdge, previewShape, removeShapeNode, shapeCan, shapeEdgeAt, shapeNodes } from '../elements/shapeEdit';
import { insertNode, moveNode, offsetEdge, orientation, removeNode, setOutline } from '../core/roofEdit';
import { arcFromBulge, bulgeForRadius, bulgeTangent, bulgeThrough } from '../geometry/arc';
import { angleDeg, dist, left, sub } from '../geometry/vec';
import type { Pickable } from '../repr/plan';
import type { Primitive, Vec2 } from '../repr/primitives';
import type { Camera } from '../view2d/camera';
import { pickAt } from '../view2d/pick';
import type { ViewPointer, ViewTool } from '../view2d/planView';
import { icons, type IconName } from './icons';
import { escapeHtml, labelOf } from './labels';
import { pxToMm, type ToolHost } from './tools/host';
import { lengthLabel, snapMarker } from './tools/overlay';
import { roundMm, snap, type SnapResult } from './tools/snap';

/**
 * Modifiera (0.7): paletten som visas när man klickar på något som redan är
 * markerat. Vad som erbjuds beror på var man klickar:
 *
 * - på referenslinjen: lägg till punkt, böj, båge med tangent, förskjut …
 * - på en ände: sträck, förläng till
 * - på ett hörn mellan två väggar: avrunda, fasa, ta bort punkt
 * - någon annanstans på objektet: flytta, vrid, spegla, kopiera i rad
 *
 * Drar man direkt flyttas det som förut. Efter ett val följer förhandsvisningen
 * markören; ett klick utför, eller så skriver man ett värde och trycker Enter.
 */

export type ModifyKind = 'edge' | 'body' | 'point' | 'corner';

export interface ModifyContext {
  kind: ModifyKind;
  /** Det markerade. */
  ids: Id[];
  /** Väggen man klickade på, för kant, ände och hörn. */
  wallId?: Id;
  /** Taket man klickade på, med konturens hörn eller kant (0.7.1). */
  roofId?: Id;
  /** 2D-elementet man klickade på, med punktens eller kantens nummer (0.8 del 2). */
  shapeId?: Id;
  index?: number;
  end?: 'start' | 'end';
  /** Punkten man klickade (på referenslinjen för kanter), mm. */
  at: Vec2;
  /** Var i fönstret paletten visas. */
  clientX: number;
  clientY: number;
}

export type OpId =
  | 'wallOn'
  | 'insert'
  | 'curve'
  | 'tangent'
  | 'straighten'
  | 'offset'
  | 'parallel'
  | 'offsetAll'
  | 'stretch'
  | 'extend'
  | 'fillet'
  | 'chamfer'
  | 'merge'
  | 'move'
  | 'rotate'
  | 'mirror'
  | 'multiply'
  | 'roofInsert'
  | 'roofMove'
  | 'roofRemove'
  | 'roofOffset'
  | 'shapeInsert'
  | 'shapeMove'
  | 'shapeRemove'
  | 'shapeOffset';

interface OpDef {
  label: string;
  /** Kort text under ikonen. Hela namnet och förklaringen visas vid hovring. */
  short: string;
  icon: IconName;
  /** Ett värde som kan skrivas in, med enhet och förval. */
  value?: { label: string; unit: 'mm' | '°' | 'st'; initial: number };
  /** Utförs direkt när man väljer det, utan att klicka i ritningen. */
  instant?: boolean;
  hint: string;
}

const OPS: Record<OpId, OpDef> = {
  wallOn: { label: 'Ny vägg härifrån', short: 'Ny vägg', icon: 'wall', hint: 'Klicka punkt för punkt, eller skriv en längd och tryck Enter. Samma typ och höjd som väggen. Esc avslutar.' },
  insert: { label: 'Lägg till punkt', short: 'Ny punkt', icon: 'insertNode', hint: 'Klicka där den nya punkten ska ligga. Väggen delas i två.' },
  curve: { label: 'Böj', short: 'Böj', icon: 'curveEdge', value: { label: 'Radie', unit: 'mm', initial: 3000 }, hint: 'Klicka en punkt som bågen ska gå igenom, eller skriv radien.' },
  tangent: { label: 'Båge med tangent', short: 'Tangent', icon: 'tangentArc', hint: 'Bågen fortsätter i grannväggens riktning. Klicka var änden ska hamna.' },
  straighten: { label: 'Räta ut', short: 'Räta ut', icon: 'straighten', instant: true, hint: 'Bågen blir rak igen.' },
  offset: { label: 'Förskjut', short: 'Förskjut', icon: 'offset', value: { label: 'Avstånd', unit: 'mm', initial: 100 }, hint: 'Väggen flyttas vinkelrätt; anslutna väggar följer med.' },
  parallel: { label: 'Parallell kopia', short: 'Parallell', icon: 'parallelCopy', value: { label: 'Avstånd', unit: 'mm', initial: 1000 }, hint: 'En kopia på avståndet, åt det håll du pekar.' },
  offsetAll: { label: 'Förskjut alla kanter', short: 'Alla kanter', icon: 'offsetAll', value: { label: 'Avstånd', unit: 'mm', initial: 100 }, hint: 'De markerade väggarna flyttas ut (eller in med minus); hörnen räknas om.' },
  stretch: { label: 'Sträck', short: 'Sträck', icon: 'stretch', value: { label: 'Längd', unit: 'mm', initial: 0 }, hint: 'Klicka var änden ska hamna, eller skriv en ny längd.' },
  extend: { label: 'Förläng till', short: 'Förläng', icon: 'extend', hint: 'Klicka på väggen som änden ska gå fram till.' },
  fillet: { label: 'Avrunda hörn', short: 'Avrunda', icon: 'fillet', value: { label: 'Radie', unit: 'mm', initial: 1000 }, hint: 'Skriv radien och tryck Enter, eller klicka för att använda den.' },
  chamfer: { label: 'Fasa hörn', short: 'Fasa', icon: 'chamfer', value: { label: 'Avstånd', unit: 'mm', initial: 600 }, hint: 'Skriv avståndet från hörnet och tryck Enter, eller klicka.' },
  merge: { label: 'Ta bort punkt', short: 'Ta bort', icon: 'merge', instant: true, hint: 'Två väggar som möts i hörnet blir en.' },
  move: { label: 'Flytta', short: 'Flytta', icon: 'move', hint: 'Klicka var det ska hamna. (Det går också att dra direkt.)' },
  rotate: { label: 'Vrid', short: 'Vrid', icon: 'rotate', value: { label: 'Vinkel', unit: '°', initial: 90 }, hint: 'Klicka en riktning att vrida från och sedan dit, eller skriv vinkeln.' },
  mirror: { label: 'Spegla', short: 'Spegla', icon: 'mirror', hint: 'Speglingslinjen går genom punkten du klickade; klicka linjens riktning.' },
  multiply: { label: 'Kopiera i rad', short: 'I rad', icon: 'multiply', value: { label: 'Antal', unit: 'st', initial: 3 }, hint: 'Klicka avståndet mellan kopiorna.' },
  roofInsert: { label: 'Lägg till punkt', short: 'Ny punkt', icon: 'insertNode', hint: 'Klicka där den nya punkten i takets kontur ska ligga.' },
  roofMove: { label: 'Flytta punkt', short: 'Flytta', icon: 'move', hint: 'Klicka var hörnet ska hamna.' },
  roofRemove: { label: 'Ta bort punkt', short: 'Ta bort', icon: 'merge', instant: true, hint: 'Hörnet tas bort; grannarna binds ihop med en rak kant.' },
  roofOffset: { label: 'Förskjut kant', short: 'Förskjut', icon: 'offset', value: { label: 'Avstånd', unit: 'mm', initial: 300 }, hint: 'Kanten flyttas vinkelrätt, utåt med plus; grannkanterna följer med.' },
  shapeInsert: { label: 'Lägg till punkt', short: 'Ny punkt', icon: 'insertNode', hint: 'Klicka där den nya punkten ska ligga.' },
  shapeMove: { label: 'Flytta punkt', short: 'Flytta', icon: 'move', hint: 'Klicka var punkten ska hamna. (Det går också att dra i den.)' },
  shapeRemove: { label: 'Ta bort punkt', short: 'Ta bort', icon: 'merge', instant: true, hint: 'Punkten tas bort; grannarna binds ihop.' },
  shapeOffset: { label: 'Förskjut kant', short: 'Förskjut', icon: 'offset', value: { label: 'Avstånd', unit: 'mm', initial: 100 }, hint: 'Kanten flyttas vinkelrätt dit du klickar, eller skriv avståndet; grannkanterna följer med.' },
};

const COMMON: OpId[] = ['move', 'rotate', 'mirror', 'multiply'];

/** Valen för ett klick, i den ordning de visas, med ett streck före de allmänna. */
export function opsFor(host: ToolHost & Partial<Pick<ModifyHost, 'startWallFrom'>>, ctx: ModifyContext): OpId[][] {
  const doc = host.store.doc;
  const wall = ctx.wallId ? doc.elements[ctx.wallId] : undefined;
  const walls = ctx.ids.filter((id) => doc.elements[id]?.type === 'Wall');
  if (ctx.shapeId) {
    const el = doc.elements[ctx.shapeId];
    const can = el ? shapeCan(el) : { insert: false, remove: false, offset: false };
    const own: OpId[] =
      ctx.kind === 'edge'
        ? [...(can.insert ? (['shapeInsert'] as OpId[]) : []), ...(can.offset ? (['shapeOffset'] as OpId[]) : [])]
        : ['shapeMove', ...(can.remove ? (['shapeRemove'] as OpId[]) : [])];
    return own.length ? [own, COMMON] : [COMMON];
  }
  if (ctx.roofId) {
    if (ctx.kind === 'edge') return [['roofInsert', 'roofOffset'], COMMON];
    if (ctx.kind === 'point') return [['roofMove', 'roofRemove'], COMMON];
  }
  switch (ctx.kind) {
    case 'edge': {
      const arc = wall && Math.abs(Number(wall.params.bulge ?? 0)) >= 0.5;
      const own: OpId[] = ['insert', 'curve', 'tangent'];
      if (arc) own.push('straighten');
      own.push('offset', 'parallel');
      if (walls.length >= 2) own.push('offsetAll');
      return [own, COMMON];
    }
    case 'point':
      return [[...(wall && host.startWallFrom ? (['wallOn'] as OpId[]) : []), 'stretch', 'extend'], COMMON];
    case 'corner':
      return [[...(wall && host.startWallFrom ? (['wallOn'] as OpId[]) : []), 'stretch', 'fillet', 'chamfer', 'merge', ...(walls.length >= 2 ? (['offsetAll'] as OpId[]) : [])], COMMON];
    default:
      return [COMMON];
  }
}

/** Det som paletten och verktyget behöver från appen. */
export interface ModifyHost extends ToolHost {
  /** Starta verktyget för ett val (det ersätter Markera tills det är klart). */
  startModify(tool: ModifyTool): void;
  /** Valet är klart eller avbrutet: tillbaka till Markera. */
  endModify(): void;
  /**
   * Ny vägg härifrån (0.8.4): väggverktyget börjar i väggens ände, med samma
   * typ. Svarar false om det inte går.
   */
  startWallFrom?(ctx: ModifyContext): boolean;
  /** Avbryt väggen som började i änden, när ett annat val görs eller paletten stängs. */
  stopWall?(): void;
}

/** Paletten som visas vid klicket. */
export class ModifyPalette {
  readonly el: HTMLElement;
  private container: HTMLElement;
  private host: ModifyHost;
  private ctx: ModifyContext | null = null;
  private active: OpId | null = null;
  private tool: ModifyTool | null = null;
  /** Senaste värdet per val, så att man slipper skriva samma radie igen. */
  private remembered = new Map<OpId, number>();

  constructor(container: HTMLElement, host: ModifyHost) {
    this.container = container;
    this.host = host;
    this.el = document.createElement('div');
    this.el.className = 'pet-palette modify-palette';
    this.el.hidden = true;
    this.el.setAttribute('role', 'toolbar');
    this.el.setAttribute('aria-label', 'Modifiera');
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-op]');
      if (b) this.choose(b.dataset.op as OpId);
      if ((e.target as HTMLElement).closest('[data-action="modify-close"]')) this.close();
    });
    this.el.addEventListener('keydown', (e) => {
      const input = e.target as HTMLInputElement;
      if (!input.matches('input')) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = Number(input.value);
        if (Number.isFinite(v) && this.active && this.tool) {
          this.remembered.set(this.active, v);
          this.tool.applyValue(v);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    });
    this.el.addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value);
      if (Number.isFinite(v) && this.tool) this.tool.setValue(v);
    });
    container.appendChild(this.el);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  get running(): boolean {
    return !!this.tool;
  }

  /** Visa paletten vid klicket, med ett val som börjar direkt (t.ex. Ny vägg vid en ände, 0.8.4). */
  show(ctx: ModifyContext, start?: OpId): void {
    this.ctx = ctx;
    this.active = null;
    this.tool = null;
    if (start && opsFor(this.host, ctx).flat().includes(start)) this.choose(start);
    else this.render();
  }

  /** Stäng paletten och avbryt det som pågår. */
  close(): void {
    const was = !!this.tool;
    const wall = this.active === 'wallOn';
    this.ctx = null;
    this.active = null;
    this.tool = null;
    this.el.hidden = true;
    if (was) this.host.endModify();
    if (wall) this.host.stopWall?.();
  }

  /** Göm paletten men låt väggen som började i änden fortsätta (när första väggen är ritad). */
  release(): void {
    this.ctx = null;
    this.active = null;
    this.tool = null;
    this.el.hidden = true;
  }

  /** Ny vägg härifrån pågår. */
  get drawingWall(): boolean {
    return this.active === 'wallOn';
  }

  private choose(op: OpId): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.active === 'wallOn' && op !== 'wallOn') {
      // Ett annat val: väggen som började i änden avbryts först.
      this.active = null;
      this.host.stopWall?.();
    }
    if (op === 'wallOn') {
      if (this.tool) this.host.endModify();
      this.tool = null;
      this.active = this.host.startWallFrom?.(ctx) ? 'wallOn' : null;
      this.render();
      return;
    }
    const def = OPS[op];
    if (def.instant) {
      runInstant(this.host, op, ctx);
      this.close();
      return;
    }
    this.active = op;
    this.tool = new ModifyTool(this.host, op, ctx, this.remembered.get(op) ?? def.value?.initial ?? 0, () => this.close());
    this.host.startModify(this.tool);
    this.render();
    const input = this.el.querySelector<HTMLInputElement>('input');
    if (input && !matchMedia('(pointer: coarse)').matches) {
      input.focus();
      input.select();
    }
  }

  private render(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const groups = opsFor(this.host, ctx);
    const btn = (op: OpId) =>
      `<button type="button" class="qb-btn mp-op" data-op="${op}" aria-pressed="${this.active === op}" title="${escapeHtml(`${OPS[op].label}. ${OPS[op].hint}`)}" aria-label="${escapeHtml(OPS[op].label)}">${icons[OPS[op].icon]}<span>${OPS[op].short}</span></button>`;
    const def = this.active ? OPS[this.active] : null;
    const value = def?.value
      ? `<label class="mp-value"><span>${def.value.label}</span><input type="text" data-expr ${def.value.unit === '°' ? 'data-unit="deg"' : def.value.unit === 'st' ? 'data-unit=""' : ''} inputmode="decimal" autocomplete="off" value="${this.remembered.get(this.active!) ?? (this.active === 'stretch' ? Math.round(this.tool?.currentLength() ?? 0) : def.value.initial)}"><i>${def.value.unit === 'st' ? 'st' : def.value.unit}</i></label>`
      : '';
    const where = ctx.shapeId ? (ctx.kind === 'edge' ? 'Kanten' : 'Punkten') : ctx.roofId ? (ctx.kind === 'edge' ? 'Kanten' : 'Hörnet') : { edge: 'Referenslinjen', point: 'Änden', corner: 'Hörnet', body: 'Det markerade' }[ctx.kind];
    const what = ctx.shapeId ? labelOf(this.host.store.doc, this.host.store.doc.elements[ctx.shapeId]) : ctx.roofId ? labelOf(this.host.store.doc, this.host.store.doc.elements[ctx.roofId]) : ctx.wallId ? labelOf(this.host.store.doc, this.host.store.doc.elements[ctx.wallId]) : ctx.ids.length === 1 ? labelOf(this.host.store.doc, this.host.store.doc.elements[ctx.ids[0]]) : `${ctx.ids.length} objekt`;
    this.el.innerHTML = `<div class="mp-row quick-bar"><div class="qb-title"><b>Modifiera</b><small>${escapeHtml(where)} · ${escapeHtml(what)}</small></div><div class="qb-actions">${groups
      .map((g) => g.map(btn).join(''))
      .join('<span class="mp-sep"></span>')}<button type="button" class="qb-btn mp-close" data-action="modify-close" aria-label="Stäng" title="Stäng (Esc)">${icons.close}</button></div></div>${
      def ? `<div class="mp-detail"><b>${def.label}</b>${value}<span class="mp-hint">${def.hint}</span></div>` : ''
    }`;
    this.el.hidden = false;
    this.place();
  }

  private place(): void {
    if (!this.ctx) return;
    const r = this.container.getBoundingClientRect();
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    let x = this.ctx.clientX - r.left + 16;
    let y = this.ctx.clientY - r.top + 20;
    if (x + w > r.width - 8) x = this.ctx.clientX - r.left - w - 16;
    if (y + h > r.height - 8) y = this.ctx.clientY - r.top - h - 20;
    this.el.style.left = `${Math.round(Math.max(8, Math.min(x, r.width - w - 8)))}px`;
    this.el.style.top = `${Math.round(Math.max(8, Math.min(y, r.height - h - 8)))}px`;
  }
}

function runInstant(host: ToolHost, op: OpId, ctx: ModifyContext): void {
  const doc = host.store.doc;
  if (op === 'shapeRemove') {
    const el = ctx.shapeId ? doc.elements[ctx.shapeId] : undefined;
    const patch = el && removeShapeNode(el, ctx.index!);
    if (el && patch) updateParams(host.store, [el.id], patch, 'Ta bort punkt');
    else host.hint('Formen har för få punkter för att ta bort en.');
    return;
  }
  if (op === 'roofRemove') {
    const roof = ctx.roofId ? doc.elements[ctx.roofId] : undefined;
    const next = roof && removeNode(roof.params.outline as [number, number][], ctx.index!);
    if (next) setOutline(host.store, roof.id, next, 'Ta bort punkt');
    else host.hint('Taket måste ha minst tre hörn.');
    return;
  }
  const el = ctx.wallId ? doc.elements[ctx.wallId] : undefined;
  if (!el) return;
  const p = el.params as { start: [number, number]; end: [number, number] };
  if (op === 'straighten') reshapeWall(host.store, el.id, p.start, p.end, 0, 'Räta ut');
  if (op === 'merge' && ctx.end && !mergeAtCorner(host.store, el.id, ctx.end)) host.hint('Hörnet har inte precis två väggar.');
}

/**
 * Verktyget som kör ett val: förhandsvisar med markören och utför vid
 * klick eller när ett värde skrivs in.
 */
export class ModifyTool implements ViewTool {
  cursor = 'crosshair';
  private host: ToolHost;
  private op: OpId;
  private ctx: ModifyContext;
  private value: number;
  private done: () => void;
  private cursorAt: SnapResult | null = null;
  /** Vrid: riktningen man vrider från, när den klickats. */
  private ref: Vec2 | null = null;

  constructor(host: ToolHost, op: OpId, ctx: ModifyContext, value: number, done: () => void) {
    this.host = host;
    this.op = op;
    this.ctx = ctx;
    this.value = value;
    this.done = done;
  }

  setValue(v: number): void {
    this.value = v;
    this.host.view.requestRender();
  }

  /** Takets kontur och det som ändras i den. */
  private roofOutline(): [number, number][] | null {
    const el = this.ctx.roofId ? this.host.store.doc.elements[this.ctx.roofId] : undefined;
    return (el?.params.outline as [number, number][] | undefined) ?? null;
  }

  /** Avståndet utåt från takets kant till en punkt (negativt inåt). */
  private roofOut(at: Vec2): number {
    const o = this.roofOutline()!;
    const i = this.ctx.index!;
    const a = o[i];
    const b = o[(i + 1) % o.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const n: Vec2 = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
    return -orientation(o) * ((at[0] - a[0]) * n[0] + (at[1] - a[1]) * n[1]);
  }

  /** Konturen efter förskjutningen, eller null. */
  private roofOffsetPreview(out: number): [number, number][] | null {
    const o = this.roofOutline();
    if (!o) return null;
    return offsetEdge(o, this.ctx.index!, -orientation(o) * out);
  }

  /** 2D-elementet som ändras, om det är ett. */
  private shape() {
    return this.ctx.shapeId ? this.host.store.doc.elements[this.ctx.shapeId] : undefined;
  }

  /** Avståndet till vänster om kanten (sett längs den) till en punkt. */
  private shapeSide(at: Vec2): number {
    const el = this.shape();
    if (!el) return 0;
    const pts = shapeNodes(el);
    const a = pts[this.ctx.index!];
    const b = pts[(this.ctx.index! + 1) % pts.length];
    const l = dist(a, b) || 1;
    const n: Vec2 = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
    return (at[0] - a[0]) * n[0] + (at[1] - a[1]) * n[1];
  }

  /** Väggens längd nu (för Sträck). */
  currentLength(): number {
    const el = this.wall();
    if (!el) return 0;
    const p = el.params as { start: Vec2; end: Vec2 };
    return dist(p.start, p.end);
  }

  private wall() {
    return this.ctx.wallId ? this.host.store.doc.elements[this.ctx.wallId] : undefined;
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

  cancel(): void {}

  private track(p: ViewPointer): void {
    const tol = pxToMm(this.host, p.pointerType === 'touch' ? 18 : 10);
    const exclude = new Set(this.op === 'move' || this.op === 'multiply' || this.op === 'stretch' ? this.ctx.ids : []);
    const from = this.op === 'stretch' ? this.fixedEnd() : this.ctx.at;
    this.cursorAt = snap({ cursor: p.model, from, segments: this.host.snapSegments(), tol, ortho: p.shift, exclude });
  }

  private fixedEnd(): Vec2 | undefined {
    const el = this.wall();
    if (!el || !this.ctx.end) return undefined;
    const p = el.params as { start: Vec2; end: Vec2 };
    return this.ctx.end === 'start' ? p.end : p.start;
  }

  up(p: ViewPointer): void {
    this.track(p);
    const at = roundMm(this.cursorAt?.point ?? p.model);
    if (this.op === 'rotate' && !this.ref) {
      if (dist(at, this.ctx.at) < 1) return;
      this.ref = at;
      return;
    }
    if (this.op === 'extend') {
      const target = pickAt(this.host.plan().pickables, p.model, pxToMm(this.host, 8), this.host.view.drawingScale);
      if (!target || target === this.ctx.wallId || this.host.store.doc.elements[target]?.type !== 'Wall') {
        this.host.hint('Klicka på en vägg.');
        return;
      }
      if (!extendTo(this.host.store, this.ctx.wallId!, this.ctx.end!, target)) this.host.hint('Väggen når inte fram dit.');
      this.done();
      return;
    }
    this.commit(at, null);
  }

  /** Ett inskrivet värde: utför med det. */
  applyValue(v: number): void {
    this.value = v;
    this.commit(this.cursorAt?.point ?? null, v);
  }

  /** Avståndet vinkelrätt från väggen, positivt åt vänster om referenslinjen. */
  private side(at: Vec2): { n: Vec2; d: number } {
    const doc = this.host.store.doc;
    const f = refFrame(doc, this.wall()!);
    const [s, o] = f.project(at);
    const n = f.normal(Math.max(0, Math.min(f.length, s)));
    return { n: [n[0], n[1]], d: o };
  }

  /** Utåt för Förskjut alla: bort från de markerade väggarnas mitt. */
  private outward(): Vec2 {
    const doc = this.host.store.doc;
    const walls = this.ctx.ids.map((id) => doc.elements[id]).filter((e) => e?.type === 'Wall');
    const mids = walls.map((w) => {
      const q = w.params as { start: Vec2; end: Vec2 };
      return [(q.start[0] + q.end[0]) / 2, (q.start[1] + q.end[1]) / 2];
    });
    const c = [mids.reduce((s, m) => s + m[0], 0) / mids.length, mids.reduce((s, m) => s + m[1], 0) / mids.length];
    const el = this.wall()!;
    const q = el.params as { start: Vec2; end: Vec2 };
    const u = [q.end[0] - q.start[0], q.end[1] - q.start[1]];
    const l = Math.hypot(u[0], u[1]) || 1;
    let n: Vec2 = [-u[1] / l, u[0] / l];
    const m = [(q.start[0] + q.end[0]) / 2, (q.start[1] + q.end[1]) / 2];
    if ((m[0] - c[0]) * n[0] + (m[1] - c[1]) * n[1] < 0) n = [-n[0], -n[1]];
    return n;
  }

  /** Riktningen bågen ska fortsätta i, och vilken ände som ligger still. */
  private tangentSetup(): { fixed: 'start' | 'end'; t: Vec2 } | null {
    const doc = this.host.store.doc;
    const el = this.wall();
    if (!el) return null;
    const p = el.params as { start: Vec2; end: Vec2 };
    const ends = (['start', 'end'] as const).map((end) => ({ end, partner: cornerPartner(doc, el.id, end), d: dist(p[end], this.ctx.at) }));
    // Helst den ände som sitter mot en annan vägg; annars den som ligger längst bort.
    const pick = ends.filter((e) => e.partner).sort((a, b) => b.d - a.d)[0] ?? ends.sort((a, b) => b.d - a.d)[0];
    if (pick.partner) return { fixed: pick.end, t: continuingTangent(doc, pick.partner.id, pick.partner.end) };
    const f = refFrame(doc, el);
    const t = f.tangent(pick.end === 'start' ? 0 : f.length);
    return { fixed: pick.end, t: pick.end === 'start' ? [t[0], t[1]] : [-t[0], -t[1]] };
  }

  private commit(at: Vec2 | null, typed: number | null): void {
    const store = this.host.store;
    const doc = store.doc;
    const ctx = this.ctx;
    const el = this.wall();
    const p = el?.params as { start: [number, number]; end: [number, number] } | undefined;
    const base = ctx.at;
    switch (this.op) {
      case 'shapeInsert':
      case 'shapeMove': {
        const s = this.shape();
        const to = at ?? base;
        if (!s) break;
        if (s.locked) {
          this.host.hint('Låst. Lås upp i egenskaperna för att ändra.', 3000);
          break;
        }
        const patch = this.op === 'shapeInsert' ? insertShapeNode(s, ctx.index!, to) : dist(to, base) >= 1 ? moveShapeNode(s, ctx.index!, to) : null;
        if (patch) updateParams(store, [s.id], patch, this.op === 'shapeInsert' ? 'Lägg till punkt' : 'Flytta punkt');
        break;
      }
      case 'shapeOffset': {
        const s = this.shape();
        if (!s) break;
        const side = at ? this.shapeSide(at) : 1;
        const d = typed !== null ? Math.abs(typed) * (side >= 0 ? 1 : -1) : Math.round(side);
        if (Math.abs(d) < 1) return;
        const patch = offsetShapeEdge(s, ctx.index!, d);
        if (!patch) {
          this.host.hint('Kanten kan inte förskjutas så långt.');
          return;
        }
        updateParams(store, [s.id], patch, 'Förskjut kant');
        break;
      }
      case 'roofInsert':
      case 'roofMove': {
        const o = this.roofOutline();
        const to = at ?? base;
        if (!o || !ctx.roofId) break;
        if (this.op === 'roofInsert') setOutline(store, ctx.roofId, insertNode(o, ctx.index!, to), 'Lägg till punkt');
        else if (dist(to, base) >= 1) setOutline(store, ctx.roofId, moveNode(o, ctx.index!, to), 'Flytta punkt');
        break;
      }
      case 'roofOffset': {
        const d = typed !== null ? typed : at ? Math.round(this.roofOut(at)) : 0;
        if (Math.abs(d) < 1 || !ctx.roofId) return;
        const next = this.roofOffsetPreview(d);
        if (!next) {
          this.host.hint('Kanten kan inte förskjutas så långt.');
          return;
        }
        setOutline(store, ctx.roofId, next, 'Förskjut kant');
        break;
      }
      case 'insert':
        if (el) splitWall(store, el.id, base, at && dist(at, base) > 5 ? at : undefined);
        break;
      case 'curve': {
        if (!el || !p) break;
        let bulge: number;
        if (typed !== null) {
          const side = at ? (this.side(at).d >= 0 ? 1 : -1) : Number(el.params.bulge ?? 1) >= 0 ? 1 : -1;
          bulge = bulgeForRadius(p.start, p.end, Math.abs(typed), side);
        } else if (at) bulge = bulgeThrough(p.start, p.end, at);
        else return;
        reshapeWall(store, el.id, p.start, p.end, bulge);
        break;
      }
      case 'tangent': {
        const t = this.tangentSetup();
        if (!el || !t || !at) return;
        tangentArc(store, el.id, t.fixed, t.t, at);
        break;
      }
      case 'offset':
      case 'parallel': {
        if (!el) break;
        const s = at ? this.side(at) : { ...this.side(base), d: 1 };
        const d = typed !== null ? Math.abs(typed) * (s.d >= 0 ? 1 : -1) : Math.round(s.d);
        const v: [number, number] = [Math.round(s.n[0] * d), Math.round(s.n[1] * d)];
        if (Math.abs(d) < 1) return;
        if (this.op === 'offset') moveElements(store, [el.id], v, 'Förskjut');
        else multiplyElements(store, [el.id], v, 1, 'Parallell kopia');
        break;
      }
      case 'offsetAll': {
        if (!el) break;
        const n = this.outward();
        const d = typed !== null ? typed : at ? Math.round((at[0] - base[0]) * n[0] + (at[1] - base[1]) * n[1]) : 0;
        if (Math.abs(d) < 1) return;
        offsetWalls(store, ctx.ids, d);
        break;
      }
      case 'stretch': {
        if (!el || !p || !ctx.end) break;
        const fixed = this.fixedEnd()!;
        let to: Vec2 | null = at;
        if (typed !== null) {
          const cur = p[ctx.end];
          const l = dist(fixed, cur) || 1;
          to = [fixed[0] + ((cur[0] - fixed[0]) / l) * typed, fixed[1] + ((cur[1] - fixed[1]) / l) * typed];
        }
        if (!to || dist(to, fixed) < 10) return;
        const companions = ctx.ids.filter((id) => {
          const w = doc.elements[id];
          if (id === el.id || w?.type !== 'Wall') return false;
          const q = w.params as { start: Vec2; end: Vec2 };
          return dist(q.start, p[ctx.end!]) <= 1 || dist(q.end, p[ctx.end!]) <= 1;
        });
        moveWallEnd(store, el.id, ctx.end, roundMm(to), { label: 'Sträck', connected: companions });
        break;
      }
      case 'fillet':
      case 'chamfer': {
        if (!el || !ctx.end) break;
        const v = typed ?? this.value;
        const cut = cornerCut(doc, el.id, ctx.end, Math.abs(v), this.op);
        const blocked = cut ? [...openingsInCorner(doc, el.id, ctx.end, cut.t), ...openingsInCorner(doc, cut.partner.id, cut.partner.end, cut.t)] : [];
        if (blocked.length) {
          const names = blocked.map((id) => labelOf(doc, doc.elements[id])).join(', ');
          this.host.hint(`${names} skulle hamna utanför väggen. Flytta ${blocked.length > 1 ? 'dem' : 'den'} först, eller välj ${this.op === 'fillet' ? 'en mindre radie' : 'ett mindre avstånd'}.`, 5000);
          return;
        }
        if (!roundCorner(store, el.id, ctx.end, Math.abs(v), this.op)) {
          this.host.hint(this.op === 'fillet' ? 'Det går inte att avrunda hörnet med den radien.' : 'Det går inte att fasa hörnet så mycket.');
          return;
        }
        break;
      }
      case 'move': {
        if (!at) return;
        const d = sub(at, base);
        if (Math.hypot(d[0], d[1]) < 1) return;
        moveElements(store, ctx.ids, [Math.round(d[0]), Math.round(d[1])]);
        break;
      }
      case 'rotate': {
        let deg: number;
        if (typed !== null) deg = typed;
        else if (at && this.ref) deg = Math.round((angleDeg(sub(at, base)) - angleDeg(sub(this.ref, base))) * 10) / 10;
        else return;
        rotateElements(store, ctx.ids, [Math.round(base[0]), Math.round(base[1])], deg);
        break;
      }
      case 'mirror':
        if (!at || dist(at, base) < 1) return;
        mirrorAbout(store, ctx.ids, base, at);
        break;
      case 'multiply': {
        if (!at) return;
        const d = sub(at, base);
        if (Math.hypot(d[0], d[1]) < 1) return;
        multiplyElements(store, ctx.ids, [Math.round(d[0]), Math.round(d[1])], typed ?? this.value);
        break;
      }
      default:
        break;
    }
    this.done();
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    const at = this.cursorAt?.point ?? null;
    const doc = this.host.store.doc;
    const el = this.wall();
    const p = el?.params as { start: Vec2; end: Vec2; bulge?: number } | undefined;
    const line = (pts: readonly Vec2[], cls = 'rubber') => `<path d="${pts.map((q, i) => `${i ? 'L' : 'M'}${cam.toScreen(q).join(' ')}`).join('')}" class="${cls}"/>`;
    const arcPts = (a: Vec2, b: Vec2, bulge: number): Vec2[] => {
      const arc = arcFromBulge(a, b, bulge);
      if (!arc) return [a, b];
      const pts: Vec2[] = [];
      for (let i = 0; i <= 48; i++) {
        const t = arc.theta0 - arc.sigma * arc.sweep * (i / 48);
        pts.push([arc.center[0] + arc.radius * Math.cos(t), arc.center[1] + arc.radius * Math.sin(t)]);
      }
      return pts;
    };
    const base = this.ctx.at;
    const roof = this.roofOutline();
    const shp = this.shape();
    const shapeGhost = (patch: Record<string, unknown> | null) => {
      if (!shp || !patch) return;
      const pv = previewShape(shp, patch);
      out.push(line(pv.closed ? [...pv.points, pv.points[0]] : pv.points));
    };
    switch (this.op) {
      case 'shapeInsert':
        if (shp && at) shapeGhost(insertShapeNode(shp, this.ctx.index!, at));
        break;
      case 'shapeMove':
        if (shp && at) shapeGhost(moveShapeNode(shp, this.ctx.index!, at));
        break;
      case 'shapeOffset':
        if (shp && at) {
          const d = Math.round(this.shapeSide(at));
          shapeGhost(offsetShapeEdge(shp, this.ctx.index!, d));
          out.push(lengthLabel(cam, base, at, `${Math.abs(d).toLocaleString('sv-SE')} mm`));
        }
        break;
      case 'roofInsert':
        if (roof && at) out.push(line([roof[this.ctx.index!], at, roof[(this.ctx.index! + 1) % roof.length]]));
        break;
      case 'roofMove':
        if (roof && at) {
          const i = this.ctx.index!;
          out.push(line([roof[(i - 1 + roof.length) % roof.length], at, roof[(i + 1) % roof.length]]));
        }
        break;
      case 'roofOffset':
        if (roof && at) {
          const d = Math.round(this.roofOut(at));
          const next = this.roofOffsetPreview(d);
          if (next) out.push(line([...next, next[0]]));
          out.push(lengthLabel(cam, base, at, `${d.toLocaleString('sv-SE')} mm`));
        }
        break;
      case 'insert':
        if (p && at) out.push(line([p.start, at, p.end]));
        break;
      case 'curve':
        if (p && at) out.push(line(arcPts(p.start, p.end, bulgeThrough(p.start, p.end, at))));
        break;
      case 'tangent': {
        const t = this.tangentSetup();
        if (p && t && at) {
          const A = p[t.fixed];
          out.push(line(arcPts(A, at, bulgeTangent(A, at, t.t))));
        }
        break;
      }
      case 'offset':
      case 'parallel':
        if (p && at) {
          const s = this.side(at);
          const v: Vec2 = [s.n[0] * s.d, s.n[1] * s.d];
          out.push(this.ghostOf([el!.id], (q) => [q[0] + v[0], q[1] + v[1]], cam));
          out.push(lengthLabel(cam, base, [base[0] + v[0], base[1] + v[1]], `${Math.round(Math.abs(s.d)).toLocaleString('sv-SE')} mm`));
        }
        break;
      case 'offsetAll':
        if (el && at) {
          const n = this.outward();
          const d = Math.round((at[0] - base[0]) * n[0] + (at[1] - base[1]) * n[1]);
          for (const g of offsetGeometry(doc, this.ctx.ids, d).values()) out.push(line([g.start, g.end]));
          out.push(lengthLabel(cam, base, [base[0] + n[0] * d, base[1] + n[1] * d], `${d.toLocaleString('sv-SE')} mm`));
        }
        break;
      case 'stretch': {
        const fixed = this.fixedEnd();
        if (fixed && at) {
          out.push(line([fixed, at]));
          out.push(lengthLabel(cam, fixed, at, `${Math.round(dist(fixed, at)).toLocaleString('sv-SE')} mm`));
        }
        break;
      }
      case 'fillet':
      case 'chamfer':
        if (el && this.ctx.end) {
          const pv = previewCorner(this.host, el.id, this.ctx.end, Math.abs(this.value), this.op);
          if (pv) out.push(line(this.op === 'fillet' ? arcPts(pv.a, pv.b, pv.bulge) : [pv.a, pv.b]));
        }
        break;
      case 'move':
      case 'multiply':
        if (at) {
          const d = sub(at, base);
          const n = this.op === 'multiply' ? Math.max(1, Math.min(50, Math.round(this.value))) : 1;
          for (let k = 1; k <= n; k++) out.push(this.ghostOf(this.ctx.ids, (q) => [q[0] + d[0] * k, q[1] + d[1] * k], cam));
          out.push(line([base, at]));
        }
        break;
      case 'rotate':
        if (at) {
          out.push(line([base, at]));
          if (this.ref) {
            out.push(line([base, this.ref], 'snap-guide'));
            const deg = angleDeg(sub(at, base)) - angleDeg(sub(this.ref, base));
            const r = (deg * Math.PI) / 180;
            const c = Math.cos(r);
            const s = Math.sin(r);
            out.push(this.ghostOf(this.ctx.ids, (q) => [base[0] + (q[0] - base[0]) * c - (q[1] - base[1]) * s, base[1] + (q[0] - base[0]) * s + (q[1] - base[1]) * c], cam));
            out.push(lengthLabel(cam, base, at, `${(Math.round(((deg % 360) + 360) % 360 * 10) / 10).toLocaleString('sv-SE')}°`));
          }
        }
        break;
      case 'mirror':
        if (at && dist(at, base) > 1) {
          const len = dist(at, base);
          const u: Vec2 = [(at[0] - base[0]) / len, (at[1] - base[1]) / len];
          const n = left(u);
          out.push(line([[base[0] - u[0] * 20000, base[1] - u[1] * 20000], [base[0] + u[0] * 20000, base[1] + u[1] * 20000]], 'snap-guide'));
          out.push(
            this.ghostOf(
              this.ctx.ids,
              (q) => {
                const o = (q[0] - base[0]) * n[0] + (q[1] - base[1]) * n[1];
                return [q[0] - 2 * o * n[0], q[1] - 2 * o * n[1]];
              },
              cam,
            ),
          );
        }
        break;
      default:
        break;
    }
    if (this.cursorAt && this.op !== 'fillet' && this.op !== 'chamfer') out.push(snapMarker(cam, this.cursorAt));
    return out.join('');
  }

  private ghostOf(ids: readonly Id[], map: (q: Vec2) => Vec2, cam: Camera): string {
    const byId = new Map(this.host.plan().pickables.map((p) => [p.id, p]));
    return ids
      .map((id) => byId.get(id))
      .filter((x): x is Pickable => !!x)
      .map((item) => ghostPath(cam, item, map))
      .join('');
  }
}

/** Förhandsvisning av avrundning eller fasning: den nya väggens ändar och pilhöjd. */
function previewCorner(host: ToolHost, wallId: Id, end: 'start' | 'end', size: number, kind: 'fillet' | 'chamfer'): { a: Vec2; b: Vec2; bulge: number } | null {
  const doc = host.store.doc;
  const partner = cornerPartner(doc, wallId, end);
  const w1 = doc.elements[wallId];
  if (!partner || !w1 || size <= 0) return null;
  const w2 = doc.elements[partner.id];
  const dir = (w: typeof w1, e: 'start' | 'end'): Vec2 => {
    const f = refFrame(doc, w);
    const t = f.tangent(e === 'start' ? 0 : f.length);
    return e === 'start' ? [t[0], t[1]] : [-t[0], -t[1]];
  };
  const C = (w1.params as { start: Vec2; end: Vec2 })[end];
  const d1 = dir(w1, end);
  const d2 = dir(w2, partner.end);
  const theta = Math.acos(Math.max(-1, Math.min(1, d1[0] * d2[0] + d1[1] * d2[1])));
  if (theta < 0.02 || theta > Math.PI - 0.02) return null;
  const t = kind === 'fillet' ? size / Math.tan(theta / 2) : size;
  const a: Vec2 = [C[0] + d1[0] * t, C[1] + d1[1] * t];
  const b: Vec2 = [C[0] + d2[0] * t, C[1] + d2[1] * t];
  return { a, b, bulge: kind === 'fillet' ? bulgeTangent(a, b, [-d1[0], -d1[1]]) : 0 };
}

/** Konturen av ett element avbildad med `map`, som förhandsvisning. */
export function ghostPath(cam: Camera, item: Pickable, map: (q: Vec2) => Vec2): string {
  const sh = (q: Vec2) => cam.toScreen(map(q));
  const path = (pts: readonly Vec2[], closed: boolean) => pts.map((q, i) => `${i ? 'L' : 'M'}${sh(q).join(' ')}`).join('') + (closed ? 'Z' : '');
  const parts: string[] = [];
  for (const rings of item.regions) parts.push(rings.map((r) => path(r, true)).join(''));
  for (const q of item.prims as Primitive[]) {
    if (q.kind === 'line') parts.push(path([q.a, q.b], false));
    else if (q.kind === 'polyline') parts.push(path(q.points, q.closed));
    else if (q.kind === 'region') parts.push(q.rings.map((r) => path(r, true)).join(''));
  }
  return `<path d="${parts.join('')}" class="ghost"/>`;
}

/**
 * Vad ett klick på det markerade träffade: en ände, ett hörn, referenslinjen
 * eller något annat. Null om det inte är något som paletten gäller.
 */
export function modifyContextAt(host: ToolHost, p: ViewPointer, clientX: number, clientY: number, hitId: Id | null): ModifyContext | null {
  const doc = host.store.doc;
  const ids = host.selection.list();
  if (!ids.length) return null;
  const tol = pxToMm(host, p.pointerType === 'touch' ? 16 : 9);
  // Ändar på markerade väggar.
  for (const id of ids) {
    const el = doc.elements[id];
    if (el?.type !== 'Wall') continue;
    const q = el.params as { start: Vec2; end: Vec2 };
    for (const end of ['start', 'end'] as const) {
      if (dist(q[end], p.model) <= tol) {
        const kind: ModifyKind = cornerPartner(doc, id, end) ? 'corner' : 'point';
        return { kind, ids, wallId: id, end, at: q[end], clientX, clientY };
      }
    }
  }
  // Punkter och kanter i markerade 2D-element (0.8 del 2).
  const shown = new Set(host.plan().pickables.map((pk) => pk.id));
  for (const id of ids) {
    const el = doc.elements[id];
    if (!isShape(el) || !shown.has(id)) continue;
    const pts = shapeNodes(el);
    for (let i = 0; i < pts.length; i++) if (dist(pts[i], p.model) <= tol) return { kind: 'point', ids, shapeId: id, index: i, at: pts[i], clientX, clientY };
  }
  for (const id of ids) {
    const el = doc.elements[id];
    if (!isShape(el) || !shown.has(id)) continue;
    const e = shapeEdgeAt(el, p.model, tol);
    if (e) return { kind: 'edge', ids, shapeId: id, index: e.index, at: e.at, clientX, clientY };
  }
  // Hörn och kanter i markerade taks kontur.
  for (const id of ids) {
    const el = doc.elements[id];
    if (el?.type !== 'Roof') continue;
    const o = el.params.outline as Vec2[];
    for (let i = 0; i < o.length; i++) if (dist(o[i], p.model) <= tol) return { kind: 'point', ids, roofId: id, index: i, at: o[i], clientX, clientY };
    for (let i = 0; i < o.length; i++) {
      const a = o[i];
      const b = o[(i + 1) % o.length];
      const u = sub(b, a);
      const l2 = u[0] * u[0] + u[1] * u[1];
      const t = l2 ? ((p.model[0] - a[0]) * u[0] + (p.model[1] - a[1]) * u[1]) / l2 : -1;
      if (t <= 0 || t >= 1) continue;
      const q: Vec2 = [a[0] + u[0] * t, a[1] + u[1] * t];
      if (dist(q, p.model) <= tol) return { kind: 'edge', ids, roofId: id, index: i, at: roundMm(q), clientX, clientY };
    }
  }
  if (!hitId || !host.selection.has(hitId)) return null;
  const el = doc.elements[hitId];
  if (el?.type === 'Wall') {
    const f = refFrame(doc, el);
    const [s, o] = f.project(p.model);
    if (Math.abs(o) <= tol && s >= 0 && s <= f.length) {
      const at = f.at(s, 0);
      return { kind: 'edge', ids, wallId: hitId, at: [at[0], at[1]], clientX, clientY };
    }
  }
  return { kind: 'body', ids, wallId: el?.type === 'Wall' ? hitId : undefined, at: roundMm(p.model), clientX, clientY };
}
