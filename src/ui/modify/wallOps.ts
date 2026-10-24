import { moveElements, moveWallEnd } from '../../core/commands';
import {
  continuingTangent,
  cornerCut,
  cornerPartner,
  cornersAmong,
  multiplyElements,
  offsetGeometry,
  offsetWalls,
  openingsInCorner,
  refFrame,
  reshapeWall,
  roundCorner,
  roundCorners,
  splitWall,
  tangentArc,
} from '../../core/wallEdit';
import type { Id } from '../../core/model';
import { bulgeForRadius, bulgeTangent, bulgeThrough } from '../../geometry/arc';
import { dist } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import { labelOf } from '../labels';
import type { ToolHost } from '../tools/host';
import { lengthLabel } from '../tools/overlay';
import { roundMm } from '../tools/snap';
import { arcPoints, ghostOf, svgLine } from './draw';
import type { OpId } from './ops';
import { wallOf, type ModifyState } from './state';

/**
 * Väggarnas form i Modifiera (0.8.15, ur tool.ts): lägg till punkt, böj,
 * båge med tangent, förskjut, parallell kopia, förskjut alla kanter, sträck,
 * och avrunda och fasa ett eller alla hörn.
 */
export const WALL_OPS = new Set<OpId>(['insert', 'curve', 'tangent', 'offset', 'parallel', 'offsetAll', 'stretch', 'fillet', 'chamfer', 'filletAll', 'chamferAll']);

type Ends = { start: [number, number]; end: [number, number] };

/** Sträck: den ände som ligger still. */
export function fixedEnd(s: ModifyState): Vec2 | undefined {
  const el = wallOf(s);
  if (!el || !s.ctx.end) return undefined;
  const p = el.params as { start: Vec2; end: Vec2 };
  return s.ctx.end === 'start' ? p.end : p.start;
}

/** Väggens längd nu (för Sträck). */
export function currentLength(s: ModifyState): number {
  const el = wallOf(s);
  if (!el) return 0;
  const p = el.params as { start: Vec2; end: Vec2 };
  return dist(p.start, p.end);
}

/** Avståndet vinkelrätt från väggen, positivt åt vänster om referenslinjen. */
function side(s: ModifyState, at: Vec2): { n: Vec2; d: number } {
  const f = refFrame(s.host.store.doc, wallOf(s)!);
  const [t, o] = f.project(at);
  const n = f.normal(Math.max(0, Math.min(f.length, t)));
  return { n: [n[0], n[1]], d: o };
}

/** Utåt för Förskjut alla: bort från de markerade väggarnas mitt. */
function outward(s: ModifyState): Vec2 {
  const doc = s.host.store.doc;
  const walls = s.ctx.ids.map((id) => doc.elements[id]).filter((e) => e?.type === 'Wall');
  const mids = walls.map((w) => {
    const q = w.params as { start: Vec2; end: Vec2 };
    return [(q.start[0] + q.end[0]) / 2, (q.start[1] + q.end[1]) / 2];
  });
  const c = [mids.reduce((a, m) => a + m[0], 0) / mids.length, mids.reduce((a, m) => a + m[1], 0) / mids.length];
  const q = wallOf(s)!.params as { start: Vec2; end: Vec2 };
  const u = [q.end[0] - q.start[0], q.end[1] - q.start[1]];
  const l = Math.hypot(u[0], u[1]) || 1;
  let n: Vec2 = [-u[1] / l, u[0] / l];
  const m = [(q.start[0] + q.end[0]) / 2, (q.start[1] + q.end[1]) / 2];
  if ((m[0] - c[0]) * n[0] + (m[1] - c[1]) * n[1] < 0) n = [-n[0], -n[1]];
  return n;
}

/** Riktningen bågen ska fortsätta i, och vilken ände som ligger still. */
function tangentSetup(s: ModifyState): { fixed: 'start' | 'end'; t: Vec2 } | null {
  const doc = s.host.store.doc;
  const el = wallOf(s);
  if (!el) return null;
  const p = el.params as { start: Vec2; end: Vec2 };
  const ends = (['start', 'end'] as const).map((end) => ({ end, partner: cornerPartner(doc, el.id, end), d: dist(p[end], s.ctx.at) }));
  // Helst den ände som sitter mot en annan vägg; annars den som ligger längst bort.
  const pick = ends.filter((e) => e.partner).sort((a, b) => b.d - a.d)[0] ?? ends.sort((a, b) => b.d - a.d)[0];
  if (pick.partner) return { fixed: pick.end, t: continuingTangent(doc, pick.partner.id, pick.partner.end) };
  const f = refFrame(doc, el);
  const t = f.tangent(pick.end === 'start' ? 0 : f.length);
  return { fixed: pick.end, t: pick.end === 'start' ? [t[0], t[1]] : [-t[0], -t[1]] };
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

/**
 * Utför valet vid ett klick (`at`) eller ett inskrivet värde (`typed`).
 * Svarar true när verktyget är klart, false när det väntar kvar.
 */
export function commitWall(s: ModifyState, base: Vec2, at: Vec2 | null, typed: number | null): boolean {
  const store = s.host.store;
  const doc = store.doc;
  const ctx = s.ctx;
  const el = wallOf(s);
  const p = el?.params as Ends | undefined;
  switch (s.op) {
    case 'filletAll':
    case 'chamferAll': {
      const v = Math.abs(typed ?? s.value);
      const kind = s.op === 'filletAll' ? 'fillet' : 'chamfer';
      const r = roundCorners(store, ctx.ids, v, kind);
      if (!r.done) {
        s.host.hint(kind === 'fillet' ? 'Inget av hörnen går att avrunda med den radien.' : 'Inget av hörnen går att fasa så mycket.', 3500);
        return false;
      }
      if (r.skipped) s.host.hint(`${r.done} hörn ${kind === 'fillet' ? 'avrundades' : 'fasades'}; ${r.skipped} gick inte (för korta väggar, bågar eller dörrar och fönster i vägen).`, 5000);
      return true;
    }
    case 'insert':
      if (el) splitWall(store, el.id, base, at && dist(at, base) > 5 ? at : undefined);
      return true;
    case 'curve': {
      if (!el || !p) return true;
      let bulge: number;
      if (typed !== null) {
        const sign = at ? (side(s, at).d >= 0 ? 1 : -1) : Number(el.params.bulge ?? 1) >= 0 ? 1 : -1;
        bulge = bulgeForRadius(p.start, p.end, Math.abs(typed), sign);
      } else if (at) bulge = bulgeThrough(p.start, p.end, at);
      else return false;
      reshapeWall(store, el.id, p.start, p.end, bulge);
      return true;
    }
    case 'tangent': {
      const t = tangentSetup(s);
      if (!el || !t || !at) return false;
      tangentArc(store, el.id, t.fixed, t.t, at);
      return true;
    }
    case 'offset':
    case 'parallel': {
      if (!el) return true;
      const sd = at ? side(s, at) : { ...side(s, base), d: 1 };
      const d = typed !== null ? Math.abs(typed) * (sd.d >= 0 ? 1 : -1) : Math.round(sd.d);
      const v: [number, number] = [Math.round(sd.n[0] * d), Math.round(sd.n[1] * d)];
      if (Math.abs(d) < 1) return false;
      if (s.op === 'offset') moveElements(store, [el.id], v, 'Förskjut');
      else multiplyElements(store, [el.id], v, 1, 'Parallell kopia');
      return true;
    }
    case 'offsetAll': {
      if (!el) return true;
      const n = outward(s);
      const d = typed !== null ? typed : at ? Math.round((at[0] - base[0]) * n[0] + (at[1] - base[1]) * n[1]) : 0;
      if (Math.abs(d) < 1) return false;
      offsetWalls(store, ctx.ids, d);
      return true;
    }
    case 'stretch': {
      if (!el || !p || !ctx.end) return true;
      const fixed = fixedEnd(s)!;
      let to: Vec2 | null = at;
      if (typed !== null) {
        const cur = p[ctx.end];
        const l = dist(fixed, cur) || 1;
        to = [fixed[0] + ((cur[0] - fixed[0]) / l) * typed, fixed[1] + ((cur[1] - fixed[1]) / l) * typed];
      }
      if (!to || dist(to, fixed) < 10) return false;
      const companions = ctx.ids.filter((id) => {
        const w = doc.elements[id];
        if (id === el.id || w?.type !== 'Wall') return false;
        const q = w.params as { start: Vec2; end: Vec2 };
        return dist(q.start, p[ctx.end!]) <= 1 || dist(q.end, p[ctx.end!]) <= 1;
      });
      moveWallEnd(store, el.id, ctx.end, roundMm(to), { label: 'Sträck', connected: companions });
      return true;
    }
    case 'fillet':
    case 'chamfer': {
      if (!el || !ctx.end) return true;
      const v = typed ?? s.value;
      const cut = cornerCut(doc, el.id, ctx.end, Math.abs(v), s.op);
      const blocked = cut ? [...openingsInCorner(doc, el.id, ctx.end, cut.t), ...openingsInCorner(doc, cut.partner.id, cut.partner.end, cut.t)] : [];
      if (blocked.length) {
        const names = blocked.map((id) => labelOf(doc, doc.elements[id])).join(', ');
        s.host.hint(`${names} skulle hamna utanför väggen. Flytta ${blocked.length > 1 ? 'dem' : 'den'} först, eller välj ${s.op === 'fillet' ? 'en mindre radie' : 'ett mindre avstånd'}.`, 5000);
        return false;
      }
      if (!roundCorner(store, el.id, ctx.end, Math.abs(v), s.op)) {
        s.host.hint(s.op === 'fillet' ? 'Det går inte att avrunda hörnet med den radien.' : 'Det går inte att fasa hörnet så mycket.');
        return false;
      }
      return true;
    }
    default:
      return true;
  }
}

/** Förhandsvisningen med markören vid `at`. */
export function overlayWall(s: ModifyState, cam: Camera, base: Vec2, at: Vec2 | null, out: string[]): void {
  const doc = s.host.store.doc;
  const el = wallOf(s);
  const p = el?.params as { start: Vec2; end: Vec2; bulge?: number } | undefined;
  const line = (pts: readonly Vec2[], cls?: string) => svgLine(cam, pts, cls);
  switch (s.op) {
    case 'insert':
      if (p && at) out.push(line([p.start, at, p.end]));
      break;
    case 'curve':
      if (p && at) out.push(line(arcPoints(p.start, p.end, bulgeThrough(p.start, p.end, at))));
      break;
    case 'tangent': {
      const t = tangentSetup(s);
      if (p && t && at) {
        const A = p[t.fixed];
        out.push(line(arcPoints(A, at, bulgeTangent(A, at, t.t))));
      }
      break;
    }
    case 'offset':
    case 'parallel':
      if (p && at) {
        const sd = side(s, at);
        const v: Vec2 = [sd.n[0] * sd.d, sd.n[1] * sd.d];
        out.push(ghostOf(s.host, [el!.id], (q) => [q[0] + v[0], q[1] + v[1]], cam));
        out.push(lengthLabel(cam, base, [base[0] + v[0], base[1] + v[1]], `${Math.round(Math.abs(sd.d)).toLocaleString('sv-SE')} mm`));
      }
      break;
    case 'offsetAll':
      if (el && at) {
        const n = outward(s);
        const d = Math.round((at[0] - base[0]) * n[0] + (at[1] - base[1]) * n[1]);
        for (const g of offsetGeometry(doc, s.ctx.ids, d).values()) out.push(line([g.start, g.end]));
        out.push(lengthLabel(cam, base, [base[0] + n[0] * d, base[1] + n[1] * d], `${d.toLocaleString('sv-SE')} mm`));
      }
      break;
    case 'stretch': {
      const fixed = fixedEnd(s);
      if (fixed && at) {
        out.push(line([fixed, at]));
        out.push(lengthLabel(cam, fixed, at, `${Math.round(dist(fixed, at)).toLocaleString('sv-SE')} mm`));
      }
      break;
    }
    case 'filletAll':
    case 'chamferAll': {
      const kind = s.op === 'filletAll' ? 'fillet' : 'chamfer';
      for (const c of cornersAmong(doc, s.ctx.ids)) {
        const pv = previewCorner(s.host, c.wallId, c.end, Math.abs(s.value), kind);
        if (pv) out.push(line(kind === 'fillet' ? arcPoints(pv.a, pv.b, pv.bulge) : [pv.a, pv.b]));
      }
      break;
    }
    case 'fillet':
    case 'chamfer':
      if (el && s.ctx.end) {
        const pv = previewCorner(s.host, el.id, s.ctx.end, Math.abs(s.value), s.op);
        if (pv) out.push(line(s.op === 'fillet' ? arcPoints(pv.a, pv.b, pv.bulge) : [pv.a, pv.b]));
      }
      break;
    default:
      break;
  }
}
