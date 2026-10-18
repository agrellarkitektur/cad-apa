import { moveElements, moveWallEnd } from '../../core/commands';
import { add, angleDeg, dist, dot, norm, scale, sub } from '../../geometry/vec';
import type { WallParams } from '../../elements/wall';
import type { Pickable } from '../../repr/plan';
import type { Primitive, Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import { pickAt, pickInRect } from '../../view2d/pick';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import { pxToMm, type ToolHost } from './host';
import { flushSnap, roundMm, snap, type SnapResult } from './snap';
import { lengthLabel, snapMarker } from './overlay';

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });

const GRIP_PX = 14;

interface Grip {
  wallId: string;
  end: 'start' | 'end';
  from: Vec2;
  /** Andra markerade väggar vars ände ligger i samma punkt; de följer med. */
  companions: { id: string; end: 'start' | 'end'; fixed: Vec2 }[];
  snap: SnapResult | null;
}

interface Move {
  ids: string[];
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
  /** Elementet under muspekaren. */
  hoverId: string | null = null;
  /** Förra klicket, för att känna igen dubbelklick. */
  private lastClick: { id: string | null; t: number; at: Vec2 } | null = null;
  /** Nästa klick hoppas över, t.ex. efter ett långt tryck som öppnat en meny. */
  private skipClick = false;

  suppressNextClick(): void {
    this.skipClick = true;
  }

  constructor(host: ToolHost) {
    this.host = host;
  }

  down(p: ViewPointer): 'capture' | 'pan' | 'ignore' {
    const g = this.gripAt(p.model);
    if (g) {
      this.grip = { ...g, companions: this.companionsAt(g.wallId, g.from), snap: null };
      return 'capture';
    }
    // Trycker man på något som redan är markerat flyttas markeringen.
    const hit = pickAt(this.host.plan().pickables, p.model, pxToMm(this.host, p.pointerType === 'touch' ? 14 : 6));
    if (hit && this.host.selection.has(hit) && !p.shift && !p.mod) {
      // Trycker man nära ett hörn på det markerade blir hörnet baspunkt, så
      // att det kan läggas exakt mot ett annat hörn.
      const base = snap({ cursor: p.model, segments: this.host.snapSegments(), tol: pxToMm(this.host, p.pointerType === 'touch' ? 20 : 10) });
      this.move = { ids: this.host.selection.list(), base: base.kind === 'free' ? p.model : base.point, target: null };
      return 'capture';
    }
    if (p.pointerType === 'touch') return 'pan';
    this.box = { a: p.model, b: p.model };
    return 'capture';
  }

  drag(p: ViewPointer): void {
    const tol = pxToMm(this.host, p.pointerType === 'touch' ? 18 : 12);
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
      const exact = r.kind === 'endpoint' || r.kind === 'midpoint' || r.kind === 'intersection' || r.kind === 'perpendicular';
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
    if (this.grip) {
      const g = this.grip;
      const fixed = this.fixedEnd();
      this.grip = null;
      if (moved && g.snap && fixed) {
        const ids = g.companions.map((c) => c.id);
        moveWallEnd(this.host.store, g.wallId, g.end, roundMm(g.snap.point), { label: 'Dra väggände', connected: ids });
        this.host.wallEndMoved?.(g.wallId, g.end, dist(fixed, g.from), ids);
      }
      return;
    }
    if (this.move) {
      const m = this.move;
      this.move = null;
      if (moved && m.target) {
        const d = sub(roundMm(m.target.point), roundMm(m.base));
        // Alt lossar väggen från sina anslutningar; annars följer de med.
        const r = moveElements(this.host.store, m.ids, [d[0], d[1]], 'Flytta', { keepJoins: !p.alt });
        if (r.released) this.host.hint(releasedHint(r.released), 4000);
        this.host.elementsMoved?.(m.ids, d, m.target.point);
      } else {
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

  cancel(): void {
    this.box = null;
    this.grip = null;
    this.move = null;
  }

  hover(p: ViewPointer | null): void {
    this.hoverId = p ? pickAt(this.host.plan().pickables, p.model, pxToMm(this.host, 6)) : null;
    this.cursor = p && this.gripAt(p.model) ? 'crosshair' : this.hoverId && this.host.selection.has(this.hoverId) ? 'move' : 'default';
    this.host.view.svg.style.cursor = this.cursor;
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
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
      const byId = new Map(this.host.plan().pickables.map((p) => [p.id, p]));
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
      out.push(lengthLabel(cam, this.move.base, this.move.target.point, `${nf.format(Math.round(Math.hypot(d[0], d[1])))} mm  ${fmtAngle(angleDeg(d))}`));
    }
    return out.join('');
  }

  private click(p: ViewPointer): void {
    if (this.skipClick) {
      this.skipClick = false;
      return;
    }
    const id = pickAt(this.host.plan().pickables, p.model, pxToMm(this.host, p.pointerType === 'touch' ? 14 : 6));
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

  /** Grepp i ändarna på markerade väggar. */
  private gripAt(pt: Vec2): { wallId: string; end: 'start' | 'end'; from: Vec2 } | null {
    const tol = pxToMm(this.host, GRIP_PX);
    const doc = this.host.store.doc;
    let best: { wallId: string; end: 'start' | 'end'; from: Vec2; d: number } | null = null;
    for (const id of this.host.selection.list()) {
      const el = doc.elements[id];
      if (el?.type !== 'Wall') continue;
      const p = el.params as unknown as WallParams;
      for (const end of ['start', 'end'] as const) {
        const d = dist(p[end], pt);
        if (d <= tol && (!best || d < best.d)) best = { wallId: id, end, from: p[end], d };
      }
    }
    return best;
  }

  /** Andra markerade väggar som har en ände i samma punkt. */
  private companionsAt(wallId: string, at: Vec2): Grip['companions'] {
    const doc = this.host.store.doc;
    const out: Grip['companions'] = [];
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
