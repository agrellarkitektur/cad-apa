import { moveElements, moveWallEnd, rotateElements, updateParams } from '../../core/commands';
import type { Id } from '../../core/model';
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
} from '../../core/wallEdit';
import { insertShapeNode, moveShapeNode, offsetShapeEdge, previewShape, removeShapeNode, shapeNodes } from '../../elements/shapeEdit';
import { insertNode, moveNode, offsetEdge, orientation, removeNode, setOutline } from '../../core/roofEdit';
import { arcFromBulge, bulgeForRadius, bulgeTangent, bulgeThrough } from '../../geometry/arc';
import { angleDeg, dist, left, sub } from '../../geometry/vec';
import type { Pickable } from '../../repr/plan';
import type { Primitive, Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import { pickAt } from '../../view2d/pick';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import { labelOf } from '../labels';
import { pxToMm, type ToolHost } from '../tools/host';
import { lengthLabel, snapMarker } from '../tools/overlay';
import { roundMm, snap, type SnapResult } from '../tools/snap';
import type { ModifyContext, OpId } from './ops';

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
