import { moveElements, moveWallEnd, updateParams } from '../../core/commands';
import { multiplyElements } from '../../core/wallEdit';
import { add, angleDeg, dist, dot, norm, scale, sub } from '../../geometry/vec';
import type { WallParams } from '../../elements/wall';
import { editedShape, moveShapeNode, previewShape, shapeNodes, shapePatch } from '../../elements/shapeEdit';
import { dragRoofGrip, type RoofDrag, type RoofGrip } from '../../elements/roofGrips';
import { underlayCorners, type UnderlayParams } from '../../elements/underlay';
import { dragUnderlayGrip, type UnderlayGrip } from '../../elements/underlayEdit';
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
import { companionsAt, endGripAt, isRoomLabel, roofGripAt, roofGripsShown, roomLabelAt, shapeNodeAt, underlayGripAt, underlayGripsShown, type Companions, type EndGrip } from './selectGrips';

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });

interface Grip extends EndGrip {
  /** Andra markerade väggar vars ände ligger i samma punkt; de följer med. */
  companions: Companions;
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
  /** Det är rumsstämpeln i ett markerat rum som dras, inte rummet (0.8.17). */
  label?: Vec2;
}

/**
 * Markera: klicka på ett objekt, Shift- eller Ctrl-klicka för att lägga till,
 * dra en ruta för flera (på pekskärm lägger varje tryck till). Markerade väggar får grepp i ändarna som kan dras,
 * och det som är markerat kan flyttas genom att dra i det. På pekskärm
 * panorerar ett finger i tomma delar av planen och ett tryck markerar.
 * Greppen under markören hittas i selectGrips.ts (0.8.23).
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
  private node: { id: string; hole?: number; index: number; from: Vec2; snap: SnapResult | null } | null = null;
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
    const rg = ro ? roofGripAt(this.host, p.model, p.pointerType === 'touch') : null;
    if (rg) {
      this.roof = { grip: rg, drag: null, snap: null };
      return 'capture';
    }
    const ug = this.underlayGripAt(p.model, p.pointerType === 'touch');
    if (ug) {
      this.ulGrip = { ...ug, snap: null, free: false };
      return 'capture';
    }
    const nd = shapeNodeAt(this.host, p.model, p.pointerType === 'touch');
    if (nd) {
      this.node = { ...nd, snap: null };
      return 'capture';
    }
    const g = ro ? null : endGripAt(this.host, p.model);
    if (g) {
      this.grip = { ...g, companions: companionsAt(this.host, g.wallId, g.from), snap: null };
      return 'capture';
    }
    // Trycker man på något som redan är markerat flyttas markeringen.
    const hit = this.pick(p);
    const movable = hit && (!ro || this.host.canEdit?.(hit));
    // Med Ctrl (Cmd på Mac) blir det en kopia som dras.
    if (hit && movable && this.host.selection.has(hit) && !p.shift) {
      // Rumsstämpeln i ett markerat rum dras för sig (0.8.17).
      const label = !p.mod ? roomLabelAt(this.host, hit, p) : null;
      if (label) {
        this.move = { ids: [hit], hit, base: p.model, target: null, label };
        return 'capture';
      }
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
      const el = editedShape(this.host.store.doc, n.id, n.hole);
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
      // Greppen går bara upp och ned.
      to = [r.grip.at[0], to[1]];
      r.drag = dragRoofGrip(this.host.store.doc, space, r.grip, roundMm(to), { free: p.alt });
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
    if (this.move?.label) {
      this.move.target = { point: p.model, kind: 'free', label: '' };
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
      const shape = editedShape(this.host.store.doc, n.id, n.hole);
      if (shape) updateParams(this.host.store, [n.id], shapePatch(this.host.store.doc, n.id, n.hole, moveShapeNode(shape, n.index, roundMm(n.snap.point))), 'Flytta punkt');
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
      updateParams(this.host.store, [r.grip.roof], r.drag.patch, r.grip.kind === 'slope' ? 'Ändra lutningen' : 'Ändra höjden');
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
        } else if (g.kind === 'roofRef') {
          // Referenslinjens ände (0.10); en båge behåller sin vinkel.
          const pt = roundMm(g.snap.point);
          const el = this.host.store.doc.elements[g.wallId];
          const ref = [...(el.params.ref as [number, number][])];
          const old = dist(ref[0], ref[1]);
          ref[g.end === 'start' ? 0 : 1] = [pt[0], pt[1]];
          const bulge = Number(el.params.refBulge ?? 0);
          const now = dist(ref[0], ref[1]);
          if (now >= 100) updateParams(this.host.store, [g.wallId], { ref, ...(bulge && old ? { refBulge: Math.round(((bulge * now) / old) * 10) / 10 } : {}) }, 'Flytta referenslinjen');
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
      if (moved && m.target && m.label) {
        if (this.host.store.doc.elements[m.hit]?.locked) {
          this.host.hint('Låst. Lås upp i egenskaperna för att flytta.', 3000);
          return;
        }
        const to = roundMm(add(m.label, sub(m.target.point, m.base)));
        updateParams(this.host.store, [m.hit], { labelAt: [to[0], to[1]] }, 'Flytta rumsstämpeln');
        return;
      }
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
    if (p && shapeNodeAt(this.host, p.model, p.pointerType === 'touch')) {
      this.host.view.svg.style.cursor = this.cursor = 'crosshair';
      return;
    }
    if (this.host.readOnly?.() && p && roofGripAt(this.host, p.model, p.pointerType === 'touch')) {
      this.host.view.svg.style.cursor = this.cursor = 'ns-resize';
      return;
    }
    if (this.host.readOnly?.() && !(this.hoverId && this.host.canEdit?.(this.hoverId))) {
      this.host.view.svg.style.cursor = this.cursor = 'default';
      return;
    }
    this.cursor = p && (endGripAt(this.host, p.model) || this.underlayGripAt(p.model, false)) ? 'crosshair' : this.hoverId && this.host.selection.has(this.hoverId) ? 'move' : 'default';
    this.host.view.svg.style.cursor = this.cursor;
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    // Greppen för markerade tak i en fasad eller sektion, och taket medan det dras.
    for (const g of roofGripsShown(this.host)) {
      const s = cam.toScreen(g.at);
      out.push(g.kind === 'slope' ? `<path d="M${s[0]} ${s[1] - 7}L${s[0] + 7} ${s[1]}L${s[0]} ${s[1] + 7}L${s[0] - 7} ${s[1]}Z" class="grip"/>` : `<rect x="${s[0] - 5}" y="${s[1] - 5}" width="10" height="10" class="grip"/>`);
    }
    for (const g of this.ulGrip?.snap ? [] : underlayGripsShown(this.host)) {
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
      const el = editedShape(this.host.store.doc, n.id, n.hole);
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
      if (this.roof.snap) out.push(snapMarker(cam, this.roof.snap));
      out.push(lengthLabel(cam, at, [at[0] + 1, at[1]], d.text));
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
        if (item && this.move.label) out.push(ghost(cam, { ...item, regions: [], prims: item.prims.filter(isRoomLabel) }, d));
        else if (item) out.push(ghost(cam, item, d));
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

  /** Greppet i en markerad bild under punkten; inget medan ett grepp dras. */
  private underlayGripAt(pt: Vec2, touch: boolean): { id: string; grip: UnderlayGrip; from: Vec2 } | null {
    return this.ulGrip?.snap ? null : underlayGripAt(this.host, pt, touch);
  }

  /** Den ände av väggen som ligger still medan den andra dras. */
  private fixedEnd(): Vec2 | undefined {
    if (!this.grip) return undefined;
    const el = this.host.store.doc.elements[this.grip.wallId];
    if (!el) return undefined;
    if (this.grip.kind === 'roofRef') {
      const ref = el.params.ref as [Vec2, Vec2];
      return this.grip.end === 'start' ? ref[1] : ref[0];
    }
    const p = el.params as unknown as WallParams;
    return this.grip.end === 'start' ? p.end : p.start;
  }
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
