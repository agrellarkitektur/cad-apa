import { moveElements, moveWallEnd, updateParams } from '../../core/commands';
import { multiplyElements } from '../../core/wallEdit';
import type { Element } from '../../core/model';
import { add, angleDeg, dist, dot, norm, scale, sub } from '../../geometry/vec';
import type { WallParams } from '../../elements/wall';
import { isShape, moveShapeNode, previewShape, shapeNodes } from '../../elements/shapeEdit';
import { dragRoofGrip, roofGripsInView, type RoofDrag, type RoofGrip } from '../../elements/roofGrips';
import { underlayCorners, type UnderlayParams } from '../../elements/underlay';
import { dragUnderlayGrip, hasImageGrips, underlayGrips, type UnderlayGrip } from '../../elements/underlayEdit';
import { resolveParams } from '../../elements/registry';
import { pickableById, type Pickable } from '../../repr/plan';
import type { Primitive, Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import { pickAllAt, pickAt, pickInRect } from '../../view2d/pick';
import { labelOf } from '../labels';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import { pxToMm, type ToolHost } from './host';
import { flushSnap, roundMm, snap, type SnapResult } from './snap';
import { lengthLabel, snapMarker } from './overlay';

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });

const GRIP_PX = 14;

interface Grip {
  /** Väggen eller sektions- eller fasadlinjen vars ände dras. */
  wallId: string;
  kind: 'wall' | 'marker';
  end: 'start' | 'end';
  from: Vec2;
  /** Andra markerade väggar vars ände ligger i samma punkt; de följer med. */
  companions: { id: string; end: 'start' | 'end'; fixed: Vec2 }[];
  snap: SnapResult | null;
}

interface Move {
  ids: string[];
  /** Det man tryckte på. */
  hit: string;
  base: Vec2;
  target: SnapResult | null;
  /** Kanterna som det flyttade ligger an mot. */
  flush?: [Vec2, Vec2][] | null;
}

/**
 * Markera: klicka på ett objekt, Shift- eller Ctrl-klicka för att lägga till,
 * dra en ruta för flera (på pekskärm lägger varje tryck till). Markerade väggar får grepp i ändarna som kan dras,
 * och det som är markerat kan flyttas genom att dra i det. På pekskärm
 * panorerar ett finger i tomma delar av planen och ett tryck markerar.
 */
export class SelectTool implements ViewTool {
  cursor = 'default';
  private host: ToolHost;
  private box: { a: Vec2; b: Vec2 } | null = null;
  private grip: Grip | null = null;
  private move: Move | null = null;
  /** Ctrl hålls ned medan något dras: det blir en kopia. */
  private copying = false;
  /** Elementet under muspekaren. */
  hoverId: string | null = null;
  /**
   * Allt under muspekaren i den ordning ett klick väljer, och vilket av dem
   * Tab har gått till (0.8.4). Klicket markerar det som Tab valt.
   */
  private stack: { ids: string[]; index: number } | null = null;
  /** Förra klicket, för att känna igen dubbelklick. */
  private lastClick: { id: string | null; t: number; at: Vec2 } | null = null;
  /** Nästa klick hoppas över, t.ex. efter ett långt tryck som öppnat en meny. */
  private skipClick = false;
  /** Ett grepp i takets nock eller takfot som dras i en fasad eller sektion (0.8). */
  private roof: { grip: RoofGrip; drag: RoofDrag | null; snap: SnapResult | null } | null = null;
  /** En punkt i ett 2D-element som dras (0.8 del 2). */
  private node: { id: string; index: number; from: Vec2; snap: SnapResult | null } | null = null;
  /** Ett grepp i en markerad bild eller PDF-sida som dras (0.8.16). */
  private ulGrip: { id: string; grip: UnderlayGrip; from: Vec2; snap: SnapResult | null; free: boolean } | null = null;

  suppressNextClick(): void {
    this.skipClick = true;
  }

  constructor(host: ToolHost) {
    this.host = host;
  }

  down(p: ViewPointer): 'capture' | 'pan' | 'ignore' {
    // I fasader och sektioner går modellen bara att markera; det som är
    // ritat i dem (mått, text, 2D, taklutningar) går att flytta (0.8).
    const ro = !!this.host.readOnly?.();
    const rg = ro ? this.roofGripAt(p.model, p.pointerType === 'touch') : null;
    if (rg) {
      this.roof = { grip: rg, drag: null, snap: null };
      return 'capture';
    }
    const ug = this.underlayGripAt(p.model, p.pointerType === 'touch');
    if (ug) {
      this.ulGrip = { ...ug, snap: null, free: false };
      return 'capture';
    }
    const nd = this.nodeAt(p.model, p.pointerType === 'touch');
    if (nd) {
      this.node = { ...nd, snap: null };
      return 'capture';
    }
    const g = ro ? null : this.gripAt(p.model);
    if (g) {
      this.grip = { ...g, companions: this.companionsAt(g.wallId, g.from), snap: null };
      return 'capture';
    }
    // Trycker man på något som redan är markerat flyttas markeringen.
    const hit = this.pick(p);
    const movable = hit && (!ro || this.host.canEdit?.(hit));
    // Med Ctrl (Cmd på Mac) blir det en kopia som dras.
    if (hit && movable && this.host.selection.has(hit) && !p.shift) {
      // Trycker man nära ett hörn på det markerade blir hörnet baspunkt, så
      // att det kan läggas exakt mot ett annat hörn.
      const base = snap({ cursor: p.model, segments: this.host.snapSegments(), tol: pxToMm(this.host, p.pointerType === 'touch' ? 20 : 10) });
      this.move = { ids: this.host.selection.list(), hit, base: base.kind === 'free' ? p.model : base.point, target: null };
      return 'capture';
    }
    if (p.pointerType === 'touch') return 'pan';
    this.box = { a: p.model, b: p.model };
    return 'capture';
  }

  drag(p: ViewPointer): void {
    this.copying = p.mod;
    const tol = pxToMm(this.host, p.pointerType === 'touch' ? 18 : 12);
    if (this.ulGrip) {
      const u = this.ulGrip;
      u.free = p.shift;
      u.snap = snap({ cursor: p.model, segments: this.host.snapSegments(), tol, exclude: new Set([u.id]) });
      return;
    }
    if (this.node) {
      const n = this.node;
      const el = this.host.store.doc.elements[n.id];
      const pts = el ? shapeNodes(el) : [];
      // Vinkellås (Shift) från grannpunkten.
      const from = pts[n.index - 1] ?? pts[n.index + 1];
      n.snap = snap({ cursor: p.model, from, segments: this.host.snapSegments(), tol, ortho: p.shift, exclude: new Set([n.id]) });
      return;
    }
    if (this.roof) {
      const r = this.roof;
      const space = this.host.space?.();
      if (!space) return;
      // Snäpp mot linjerna i vyn (t.ex. väggens överkant), inte mot taket självt.
      const s = snap({ cursor: p.model, segments: this.host.snapSegments(), tol, exclude: new Set([r.grip.roof]) });
      const exact = s.kind !== 'free' && s.kind !== 'angle';
      r.snap = exact ? s : null;
      let to: Vec2 = exact ? s.point : p.model;
      // Nocken går bara upp och ned.
      if (r.grip.kind === 'ridge') to = [r.grip.at[0], to[1]];
      r.drag = dragRoofGrip(this.host.store.doc, space, r.grip, roundMm(to), { free: p.alt, keepRidge: p.shift });
      return;
    }
    if (this.grip) {
      const exclude = new Set([this.grip.wallId, ...this.grip.companions.map((c) => c.id)]);
      // Snäpp mot allt utom väggarna som ändras, med vinkellås från den fasta änden.
      this.grip.snap = snap({ cursor: p.model, from: this.fixedEnd(), segments: this.host.snapSegments(), tol, ortho: p.shift, exclude });
      // Förlänga eller korta i väggens egen riktning, även om den är sned.
      const fixed = this.fixedEnd();
      const r = this.grip.snap;
      if (fixed && (r.kind === 'free' || r.kind === 'angle' || r.kind === 'on-wall')) {
        const dir = norm(sub(this.grip.from, fixed));
        const along = add(fixed, scale(dir, dot(sub(p.model, fixed), dir)));
        if (dist(along, p.model) <= pxToMm(this.host, 12)) {
          this.grip.snap = { point: along, kind: 'angle', label: 'I linje', guide: [fixed, add(fixed, scale(dir, dist(fixed, along) * 2 + 2000))] };
        }
      }
      return;
    }
    if (this.move) {
      const m = this.move;
      const segments = this.host.snapSegments();
      const exclude = new Set(m.ids);
      const r = snap({ cursor: p.model, from: m.base, segments, tol, ortho: p.shift, exclude });
      m.flush = null;
      // En exakt punkt (hörn, mittpunkt, skärning) vinner. Annars läggs det
      // som flyttas kant i kant med väggar och möbler när det kommer nära.
      const exact = r.kind === 'endpoint' || r.kind === 'midpoint' || r.kind === 'center' || r.kind === 'quadrant' || r.kind === 'intersection' || r.kind === 'perpendicular';
      if (exact || p.shift) {
        m.target = r;
        return;
      }
      const outlines = this.outlinesOf(m.ids);
      const others = segments.filter((s) => !exclude.has(s.id));
      const d = sub(p.model, m.base);
      const f = outlines.length ? flushSnap(outlines, others, d, tol) : null;
      if (f) {
        m.target = { point: add(m.base, f.d), kind: 'on-wall', label: 'Kant i kant' };
        m.flush = f.guides;
      } else {
        m.target = { point: p.model, kind: 'free', label: '' };
      }
      return;
    }
    if (this.box) this.box.b = p.model;
  }

  up(p: ViewPointer, moved: boolean): void {
    if (this.ulGrip) {
      const u = this.ulGrip;
      this.ulGrip = null;
      const el = this.host.store.doc.elements[u.id];
      if (!el || !moved || !u.snap) return;
      if (el.locked) {
        this.host.hint('Låst. Lås upp i egenskaperna för att ändra.', 3000);
        return;
      }
      const next = dragUnderlayGrip(resolveParams<UnderlayParams>(this.host.store.doc, el), u.grip, u.snap.point, u.free);
      if (next) updateParams(this.host.store, [u.id], next, u.grip.kind === 'side' ? 'Sträck bilden' : u.free ? 'Sträck bilden' : 'Skala bilden');
      return;
    }
    if (this.node) {
      const n = this.node;
      this.node = null;
      const el = this.host.store.doc.elements[n.id];
      if (!el) return;
      if (!moved || !n.snap) {
        // Klick på en punkt: Modifiera med det som går att göra med den.
        this.host.modify?.(p, n.id);
        return;
      }
      if (el.locked) {
        this.host.hint('Låst. Lås upp i egenskaperna för att ändra.', 3000);
        return;
      }
      updateParams(this.host.store, [n.id], moveShapeNode(el, n.index, roundMm(n.snap.point)), 'Flytta punkt');
      return;
    }
    if (this.roof) {
      const r = this.roof;
      this.roof = null;
      if (!moved || !r.drag) return;
      if (this.host.store.doc.elements[r.grip.roof]?.locked) {
        this.host.hint('Taket är låst. Lås upp i egenskaperna för att ändra det.', 3000);
        return;
      }
      const { outline, eave, slope } = r.drag.params;
      updateParams(this.host.store, [r.grip.roof], { outline, eave, slope }, r.grip.kind === 'ridge' ? 'Dra i nocken' : 'Dra i takfoten');
      return;
    }
    if (this.grip) {
      const g = this.grip;
      const fixed = this.fixedEnd();
      this.grip = null;
      if (moved && g.snap && fixed) {
        const ids = g.companions.map((c) => c.id);
        if (g.kind === 'marker') {
          const pt = roundMm(g.snap.point);
          updateParams(this.host.store, [g.wallId], { [g.end]: [pt[0], pt[1]] }, 'Dra linjens ände');
        } else {
          moveWallEnd(this.host.store, g.wallId, g.end, roundMm(g.snap.point), { label: 'Dra väggände', connected: ids });
          this.host.wallEndMoved?.(g.wallId, g.end, dist(fixed, g.from), ids);
        }
      } else if (!moved && g.kind === 'wall') {
        // Klick på en ände: Modifiera med Sträck, och för hörn Avrunda och Fasa.
        this.host.modify?.(p, null);
      }
      return;
    }
    if (this.move) {
      const m = this.move;
      this.move = null;
      if (moved && m.target) {
        const d = sub(roundMm(m.target.point), roundMm(m.base));
        if (p.mod) {
          const ids = multiplyElements(this.host.store, m.ids, [d[0], d[1]], 1, 'Kopiera');
          this.host.selection.set(ids);
          return;
        }
        const ids = this.host.readOnly?.() ? m.ids.filter((id) => this.host.canEdit?.(id)) : m.ids;
        const doc = this.host.store.doc;
        if (ids.length && ids.every((id) => doc.elements[id]?.locked)) {
          this.host.hint('Låst. Lås upp i egenskaperna för att flytta.', 3000);
          return;
        }
        // Alt lossar väggen från sina anslutningar; annars följer de med.
        const r = moveElements(this.host.store, ids, [d[0], d[1]], 'Flytta', { keepJoins: !p.alt });
        if (r.released) this.host.hint(releasedHint(r.released), 4000);
        this.host.elementsMoved?.(ids, d, m.target.point);
      } else {
        // Klick på det markerade: Modifiera i smartmenyn, utom vid dubbelklick.
        const now = performance.now();
        const last = this.lastClick;
        const double = last && last.id === m.hit && now - last.t < 450 && dist(p.screen, last.at) < (p.pointerType === 'touch' ? 24 : 8);
        if (!double && !p.shift && !p.mod && this.host.modify?.(p, m.hit)) {
          this.lastClick = { id: m.hit, t: now, at: p.screen };
          return;
        }
        this.click(p);
      }
      return;
    }
    const box = this.box;
    this.box = null;
    if (box && moved) {
      const r = {
        minX: Math.min(box.a[0], box.b[0]),
        maxX: Math.max(box.a[0], box.b[0]),
        minY: Math.min(box.a[1], box.b[1]),
        maxY: Math.max(box.a[1], box.b[1]),
      };
      // Dra åt höger: bara det som ligger helt innanför. Åt vänster: allt som berörs.
      const ids = pickInRect(this.host.plan().pickables, r, box.b[0] >= box.a[0] ? 'window' : 'crossing');
      if (p.shift || p.mod) this.host.selection.add(ids);
      else this.host.selection.set(ids);
      return;
    }
    this.click(p);
  }

  tap(p: ViewPointer): void {
    this.click(p);
  }

  /**
   * Tab (Shift+Tab bakåt) går till nästa objekt under markören, när flera
   * ligger på varandra (0.8.4). Svarar false när det inte finns något att
   * växla mellan, så att Tab gör det vanliga.
   */
  cycle(back = false): boolean {
    const st = this.stack;
    if (!st || st.ids.length < 2 || this.box || this.move || this.grip || this.ulGrip) return false;
    const n = st.ids.length;
    st.index = (st.index + (back ? n - 1 : 1)) % n;
    this.hoverId = st.ids[st.index];
    const doc = this.host.store.doc;
    const el = doc.elements[this.hoverId];
    this.host.hint(`${st.index + 1} av ${n}: ${el ? labelOf(doc, el) : 'objekt'}. Klicka för att markera, Tab för nästa.`, 3000);
    this.host.view.requestRender();
    return true;
  }

  /** Det ett klick i punkten träffar: det Tab valt om det ligger där, annars det översta. */
  private pick(p: ViewPointer): string | null {
    const tol = pxToMm(this.host, p.pointerType === 'touch' ? 14 : 6);
    const st = this.stack;
    if (st && st.index > 0) {
      const chosen = st.ids[st.index];
      if (pickAllAt(this.host.plan().pickables, p.model, tol, this.host.view.drawingScale).includes(chosen)) return chosen;
    }
    return pickAt(this.host.plan().pickables, p.model, tol, this.host.view.drawingScale);
  }

  cancel(): void {
    this.stack = null;
    this.roof = null;
    this.node = null;
    this.ulGrip = null;
    this.box = null;
    this.grip = null;
    this.move = null;
  }

  hover(p: ViewPointer | null): void {
    const ids = p ? pickAllAt(this.host.plan().pickables, p.model, pxToMm(this.host, 6), this.host.view.drawingScale) : [];
    // Det Tab valt ligger kvar så länge markören är kvar över det.
    const chosen = this.stack && this.stack.index > 0 ? this.stack.ids[this.stack.index] : null;
    const keep = chosen ? ids.indexOf(chosen) : -1;
    this.stack = ids.length ? { ids, index: Math.max(0, keep) } : null;
    this.hoverId = this.stack ? this.stack.ids[this.stack.index] : null;
    if (p && this.nodeAt(p.model, p.pointerType === 'touch')) {
      this.host.view.svg.style.cursor = this.cursor = 'crosshair';
      return;
    }
    if (this.host.readOnly?.() && p && this.roofGripAt(p.model, p.pointerType === 'touch')) {
      this.host.view.svg.style.cursor = this.cursor = 'ns-resize';
      return;
    }
    if (this.host.readOnly?.() && !(this.hoverId && this.host.canEdit?.(this.hoverId))) {
      this.host.view.svg.style.cursor = this.cursor = 'default';
      return;
    }
    this.cursor = p && (this.gripAt(p.model) || this.underlayGripAt(p.model, false)) ? 'crosshair' : this.hoverId && this.host.selection.has(this.hoverId) ? 'move' : 'default';
    this.host.view.svg.style.cursor = this.cursor;
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    // Greppen för markerade tak i en fasad eller sektion, och taket medan det dras.
    for (const g of this.roofGrips()) {
      const s = cam.toScreen(g.at);
      out.push(g.kind === 'ridge' ? `<path d="M${s[0]} ${s[1] - 7}L${s[0] + 7} ${s[1]}L${s[0]} ${s[1] + 7}L${s[0] - 7} ${s[1]}Z" class="grip"/>` : `<rect x="${s[0] - 5}" y="${s[1] - 5}" width="10" height="10" class="grip"/>`);
    }
    for (const g of this.underlayGripsShown()) {
      const q = cam.toScreen(g.at);
      out.push(g.kind === 'corner' ? `<rect x="${q[0] - 5}" y="${q[1] - 5}" width="10" height="10" class="grip"/>` : `<rect x="${q[0] - 4}" y="${q[1] - 4}" width="8" height="8" class="grip side-grip"/>`);
    }
    if (this.ulGrip?.snap) {
      const u = this.ulGrip;
      const sn = this.ulGrip.snap;
      const el = this.host.store.doc.elements[u.id];
      const p = el ? resolveParams<UnderlayParams>(this.host.store.doc, el) : null;
      const next = p && dragUnderlayGrip(p, u.grip, sn.point, u.free);
      if (p && next) {
        const c = underlayCorners({ ...p, ...next }).map((q) => cam.toScreen(q));
        out.push(`<path d="M${c.map((q) => q.join(' ')).join('L')}Z" class="ghost"/>`);
        out.push(lengthLabel(cam, sn.point, sn.point, `${nf.format(Math.round(next.size[0] * next.scale))} × ${nf.format(Math.round(next.size[1] * next.scale))} mm`));
      }
      out.push(snapMarker(cam, sn));
    }
    if (this.node?.snap) {
      const n = this.node;
      const sn = this.node.snap;
      const el = this.host.store.doc.elements[n.id];
      if (el) {
        const shp = previewShape(el, moveShapeNode(el, n.index, sn.point));
        out.push(`<path d="${shp.points.map((q, i) => `${i ? 'L' : 'M'}${cam.toScreen(q).join(' ')}`).join('')}${shp.closed ? 'Z' : ''}" class="ghost"/>`);
        out.push(snapMarker(cam, sn));
        const d = sub(sn.point, n.from);
        out.push(lengthLabel(cam, n.from, sn.point, `${nf.format(Math.round(Math.hypot(d[0], d[1])))} mm  ${fmtAngle(angleDeg(d))}`));
      }
    }
    if (this.roof?.drag) {
      const d = this.roof.drag;
      const path = d.outline.map((ring) => ring.map((q, i) => `${i ? 'L' : 'M'}${cam.toScreen(q).join(' ')}`).join('') + 'Z').join('');
      out.push(`<path d="${path}" class="ghost"/>`);
      const at = this.roof.grip.at;
      const lo = d.outline.flat();
      const target: Vec2 = this.roof.grip.kind === 'ridge' ? [at[0], Math.max(...lo.map((q) => q[1]))] : [at[0], at[1]];
      if (this.roof.snap) out.push(snapMarker(cam, this.roof.snap));
      out.push(lengthLabel(cam, at, [target[0] + 1, target[1]], d.text));
    }
    if (this.box) {
      const a = cam.toScreen(this.box.a);
      const b = cam.toScreen(this.box.b);
      const crossing = this.box.b[0] < this.box.a[0];
      out.push(
        `<rect x="${Math.min(a[0], b[0])}" y="${Math.min(a[1], b[1])}" width="${Math.abs(b[0] - a[0])}" height="${Math.abs(b[1] - a[1])}" class="sel-box${crossing ? ' crossing' : ''}"/>`,
      );
    }
    const fixed = this.fixedEnd();
    if (this.grip?.snap && fixed) {
      const pt = this.grip.snap.point;
      const b = cam.toScreen(pt);
      for (const f of [fixed, ...this.grip.companions.map((c) => c.fixed)]) {
        const a = cam.toScreen(f);
        out.push(`<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" class="rubber"/>`);
      }
      out.push(snapMarker(cam, this.grip.snap));
      // Ny längd, hur mycket den ändras och vinkeln.
      const before = dist(fixed, this.grip.from);
      const after = dist(fixed, pt);
      const delta = Math.round(after - before);
      out.push(
        lengthLabel(cam, fixed, pt, `${nf.format(Math.round(after))} mm  ${delta >= 0 ? '+' : '−'}${nf.format(Math.abs(delta))}  ${fmtAngle(angleDeg(sub(pt, fixed)))}`),
      );
    }
    if (this.move?.target) {
      const d = sub(this.move.target.point, this.move.base);
      // Spöke av det som flyttas.
      const byId = pickableById(this.host.plan().pickables);
      for (const id of this.move.ids) {
        const item = byId.get(id);
        if (item) out.push(ghost(cam, item, d));
      }
      const a = cam.toScreen(this.move.base);
      const b = cam.toScreen(this.move.target.point);
      out.push(`<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" class="rubber"/>`);
      for (const [a, b] of this.move.flush ?? []) {
        const sa = cam.toScreen(a);
        const sb = cam.toScreen(b);
        out.push(`<path d="M${sa[0]} ${sa[1]}L${sb[0]} ${sb[1]}" class="snap-guide flush"/>`);
      }
      out.push(snapMarker(cam, this.move.target));
      out.push(lengthLabel(cam, this.move.base, this.move.target.point, `${this.copying ? 'Kopia  ' : ''}${nf.format(Math.round(Math.hypot(d[0], d[1])))} mm  ${fmtAngle(angleDeg(d))}`));
    }
    return out.join('');
  }

  private click(p: ViewPointer): void {
    if (this.skipClick) {
      this.skipClick = false;
      return;
    }
    const id = this.pick(p);
    const sel = this.host.selection;
    // Dubbelklick (eller dubbeltryck) på en text redigerar den i ritningen.
    const now = performance.now();
    const last = this.lastClick;
    this.lastClick = { id, t: now, at: p.screen };
    if (id && last && last.id === id && now - last.t < 450 && dist(p.screen, last.at) < (p.pointerType === 'touch' ? 24 : 8)) {
      this.lastClick = null;
      if (this.host.editText?.(id, p.model)) {
        sel.set([id]);
        return;
      }
    }
    // På pekskärm lägger ett tryck till eller tar bort ur markeringen, och ett
    // tryck i tomma delar av planen avmarkerar allt.
    if (p.shift || p.mod || p.pointerType === 'touch') {
      if (id) sel.toggle(id);
      else if (p.pointerType === 'touch') sel.clear();
      return;
    }
    if (id) sel.set([id]);
    else sel.clear();
  }

  /** Konturerna av det som flyttas (inte dörrar och fönster, som glider i sin vägg). */
  private outlinesOf(ids: string[]): Vec2[][] {
    const doc = this.host.store.doc;
    const set = new Set(ids.filter((id) => !doc.elements[id]?.host));
    return this.host
      .plan()
      .pickables.filter((p) => set.has(p.id))
      .flatMap((p) => p.regions.map((rings) => rings[0]).filter(Boolean));
  }

  /** Grepp i ändarna på markerade väggar och på sektions- och fasadlinjer som placerats för hand. */
  private gripAt(pt: Vec2): { wallId: string; kind: 'wall' | 'marker'; end: 'start' | 'end'; from: Vec2 } | null {
    const tol = pxToMm(this.host, GRIP_PX);
    const doc = this.host.store.doc;
    let best: { wallId: string; kind: 'wall' | 'marker'; end: 'start' | 'end'; from: Vec2; d: number } | null = null;
    for (const id of this.host.selection.list()) {
      const el = doc.elements[id];
      const kind = el?.type === 'Wall' ? 'wall' : isManualMarker(el) ? 'marker' : null;
      if (!kind) continue;
      const p = el.params as unknown as WallParams;
      for (const end of ['start', 'end'] as const) {
        const d = dist(p[end], pt);
        if (d <= tol && (!best || d < best.d)) best = { wallId: id, kind, end, from: p[end], d };
      }
    }
    return best;
  }

  /** Greppen i en ensam markerad bild eller PDF-sida som går att ändra (0.8.16). */
  private underlayGripsShown(): ReturnType<typeof underlayGrips> {
    if (this.ulGrip?.snap) return [];
    const ids = this.host.selection.list();
    if (ids.length !== 1) return [];
    const doc = this.host.store.doc;
    const el = doc.elements[ids[0]];
    if (el?.type !== 'Underlay' || el.locked) return [];
    if (this.host.readOnly?.() && !this.host.canEdit?.(el.id)) return [];
    if (!this.host.plan().pickables.some((pk) => pk.id === el.id)) return [];
    const p = resolveParams<UnderlayParams>(doc, el);
    return hasImageGrips(p) ? underlayGrips(p) : [];
  }

  private underlayGripAt(pt: Vec2, touch: boolean): { id: string; grip: UnderlayGrip; from: Vec2 } | null {
    const tol = pxToMm(this.host, touch ? 18 : GRIP_PX);
    const id = this.host.selection.list()[0];
    let best: { id: string; grip: UnderlayGrip; from: Vec2; d: number } | null = null;
    for (const g of this.underlayGripsShown()) {
      // Hörnen före sidorna när de ligger nära varandra (en liten bild).
      const d = dist(g.at, pt) + (g.kind === 'side' ? tol / 4 : 0);
      if (d <= tol && (!best || d < best.d)) best = { id, grip: { kind: g.kind, index: g.index }, from: g.at, d };
    }
    return best;
  }

  /** Punkten i ett markerat 2D-element som ligger närmast, om något går att ändra här. */
  private nodeAt(pt: Vec2, touch: boolean): { id: string; index: number; from: Vec2 } | null {
    const tol = pxToMm(this.host, touch ? 18 : 10);
    const doc = this.host.store.doc;
    const ro = !!this.host.readOnly?.();
    const shown = new Set(this.host.plan().pickables.map((pk) => pk.id));
    let best: { id: string; index: number; from: Vec2; d: number } | null = null;
    for (const id of this.host.selection.list()) {
      const el = doc.elements[id];
      if (!isShape(el) || !shown.has(id) || (ro && !this.host.canEdit?.(id))) continue;
      shapeNodes(el).forEach((q, index) => {
        const d = dist(q, pt);
        if (d <= tol && (!best || d < best.d)) best = { id, index, from: q, d };
      });
    }
    return best;
  }

  /** Greppen i nock och takfot för de markerade taken, i fasaden eller sektionen som är öppen. */
  private roofGrips(): RoofGrip[] {
    const space = this.host.readOnly?.() ? this.host.space?.() : undefined;
    if (!space) return [];
    const doc = this.host.store.doc;
    if (doc.elements[space]?.type !== 'Section' && doc.elements[space]?.type !== 'Elevation') return [];
    const roofs = this.host.selection.list().filter((id) => doc.elements[id]?.type === 'Roof');
    return roofs.length ? roofGripsInView(doc, space, roofs) : [];
  }

  private roofGripAt(pt: Vec2, touch: boolean): RoofGrip | null {
    const tol = pxToMm(this.host, touch ? 20 : GRIP_PX);
    let best: { g: RoofGrip; d: number } | null = null;
    for (const g of this.roofGrips()) {
      const d = dist(g.at, pt);
      if (d <= tol && (!best || d < best.d)) best = { g, d };
    }
    return best?.g ?? null;
  }

  /** Andra markerade väggar som har en ände i samma punkt. */
  private companionsAt(wallId: string, at: Vec2): Grip['companions'] {
    const doc = this.host.store.doc;
    const out: Grip['companions'] = [];
    if (doc.elements[wallId]?.type !== 'Wall') return out;
    for (const id of this.host.selection.list()) {
      if (id === wallId) continue;
      const el = doc.elements[id];
      if (el?.type !== 'Wall') continue;
      const p = el.params as unknown as WallParams;
      if (dist(p.start, at) <= 1) out.push({ id, end: 'start', fixed: p.end });
      else if (dist(p.end, at) <= 1) out.push({ id, end: 'end', fixed: p.start });
    }
    return out;
  }

  /** Den ände av väggen som ligger still medan den andra dras. */
  private fixedEnd(): Vec2 | undefined {
    if (!this.grip) return undefined;
    const el = this.host.store.doc.elements[this.grip.wallId];
    if (!el) return undefined;
    const p = el.params as unknown as WallParams;
    return this.grip.end === 'start' ? p.end : p.start;
  }
}

/** En sektions- eller fasadlinje som placerats för hand och har grepp i ändarna. */
export function isManualMarker(el: Element | undefined): el is Element {
  return !!el && (el.type === 'Section' || el.type === 'Elevation') && !el.params.auto && !el.locked;
}

export function releasedHint(n: number): string {
  return n === 1
    ? 'En anslutning släppte: väggen i rak förlängning kan inte följa med i sidled, eller skulle bli för kort.'
    : `${n} anslutningar släppte: väggar i rak förlängning kan inte följa med i sidled, eller skulle bli för korta.`;
}

function fmtAngle(a: number): string {
  const r = Math.round(a * 10) / 10;
  return `${(r === 360 ? 0 : r).toLocaleString('sv-SE')}°`;
}

/** Konturen av ett element förskjuten med d, som förhandsvisning av en flytt. */
function ghost(cam: Camera, item: Pickable, d: Vec2): string {
  const sh = (p: Vec2) => cam.toScreen([p[0] + d[0], p[1] + d[1]]);
  const path = (pts: readonly Vec2[], closed: boolean) => pts.map((p, i) => `${i ? 'L' : 'M'}${sh(p).join(' ')}`).join('') + (closed ? 'Z' : '');
  const parts: string[] = [];
  for (const rings of item.regions) parts.push(rings.map((r) => path(r, true)).join(''));
  for (const p of item.prims as Primitive[]) {
    if (p.kind === 'line') parts.push(path([p.a, p.b], false));
    else if (p.kind === 'polyline') parts.push(path(p.points, p.closed));
    else if (p.kind === 'region') parts.push(p.rings.map((r) => path(r, true)).join(''));
  }
  return `<path d="${parts.join('')}" class="ghost"/>`;
}
