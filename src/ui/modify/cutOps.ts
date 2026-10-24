import type { Id } from '../../core/model';
import { canJoin, canTrim, joinLines, joinWalls, linePoints, pathOf, splitLine, splitWallAt, trimLine, trimPath, trimWall, wallCutters } from '../../core/trimEdit';
import { extendTo } from '../../core/wallEdit';
import { dist, sub } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import { pickAt } from '../../view2d/pick';
import { pxToMm } from '../tools/host';
import type { SnapSegment } from '../tools/snap';
import { svgLine } from './draw';
import type { OpId } from './ops';
import { nearestOf, reportEdit, type ModifyState } from './state';

/**
 * Trimma, Dela, Hörnskarv och Förläng i Modifiera (0.8.15, ur tool.ts): val
 * som utförs med ett klick på det som ska ändras.
 */
export const CUT_OPS = new Set<OpId>(['trim', 'split', 'join', 'extend']);

/** Vad ett klick ledde till: klart, eller vänta kvar (med den första väggen i Hörnskarv). */
export type CutClick = { done: true } | { done: false; first?: { id: Id; at: Vec2 } };

/** Det markerade element närmast punkten som `ok` gäller, inom toleransen (väggar: plus halva tjockleken). */
function nearestSelected(s: ModifyState, at: Vec2, ok: Parameters<typeof nearestOf>[3], px = 10): Id | null {
  return nearestOf(s.host, s.ctx.ids, at, ok, pxToMm(s.host, px));
}

/** Linjerna en 2D-linje trimmas mot: allt som går att snäppa till, utom linjen själv. */
function cutters(s: ModifyState, id: Id): SnapSegment[] {
  return s.host.snapSegments().filter((q) => q.id !== id);
}

/** Hörnskarv: den första är den man klickade på, eller den enda som går att skarva. */
export function firstOfJoin(s: ModifyState): { id: Id; at: Vec2 } | null {
  const ctx = s.ctx;
  if (ctx.kind !== 'body' || ctx.clicked) {
    const hit = nearestSelected(s, ctx.at, canJoin, 14);
    if (hit) return { id: hit, at: ctx.at };
  }
  const doc = s.host.store.doc;
  const can = ctx.ids.filter((id) => canJoin(doc.elements[id]));
  if (can.length !== 1) return null;
  const pts = pathOf(doc.elements[can[0]]);
  return { id: can[0], at: [(pts[0][0] + pts[pts.length - 1][0]) / 2, (pts[0][1] + pts[pts.length - 1][1]) / 2] };
}

/** Hörnskarv: den andra väggen eller linjen, av samma slag som den första. */
function joinTarget(s: ModifyState, at: Vec2): Id | null {
  const doc = s.host.store.doc;
  const first = s.first!;
  const kind = doc.elements[first.id]?.type;
  const ids = s.host.plan().pickables.map((pk) => pk.id).filter((id) => id !== first.id && doc.elements[id]?.type === kind);
  return nearestOf(s.host, ids, at, canJoin, pxToMm(s.host, 10));
}

/** Ett klick: `model` är punkten under markören, `at` den snäppta. */
export function clickCut(s: ModifyState, model: Vec2, at: Vec2): CutClick {
  const host = s.host;
  const stay: CutClick = { done: false };
  if (s.op === 'trim' || s.op === 'split') {
    const target = nearestSelected(s, model, canTrim);
    if (!target) {
      host.hint(s.op === 'trim' ? 'Klicka på biten som ska bort, på det markerade.' : 'Klicka på det markerade, där det ska delas.');
      return stay;
    }
    const el = host.store.doc.elements[target];
    const r =
      s.op === 'trim'
        ? el.type === 'Wall'
          ? trimWall(host.store, target, model)
          : trimLine(host.store, target, cutters(s, target), model)
        : el.type === 'Wall'
          ? splitWallAt(host.store, target, at)
          : splitLine(host.store, target, at);
    return reportEdit(host, r) ? { done: true } : stay;
  }
  if (s.op === 'join') {
    if (!s.first) {
      const hit = nearestSelected(s, model, canJoin);
      if (!hit) {
        host.hint('Klicka på en markerad vägg eller linje.');
        return stay;
      }
      return { done: false, first: { id: hit, at: model } };
    }
    const target = joinTarget(s, model);
    if (!target) {
      host.hint('Klicka på en annan vägg eller rak linje.');
      return stay;
    }
    const isWall = host.store.doc.elements[s.first.id]?.type === 'Wall';
    const r = (isWall ? joinWalls : joinLines)(host.store, s.first.id, s.first.at, target, model);
    return reportEdit(host, r) ? { done: true } : stay;
  }
  // Förläng: väggen förlängs till en annan vägg man klickar på.
  const target = pickAt(host.plan().pickables, model, pxToMm(host, 8), host.view.drawingScale);
  if (!target || target === s.ctx.wallId || host.store.doc.elements[target]?.type !== 'Wall') {
    host.hint('Klicka på en vägg.');
    return stay;
  }
  if (!extendTo(host.store, s.ctx.wallId!, s.ctx.end!, target)) host.hint('Väggen når inte fram dit.');
  return { done: true };
}

/** Skärningen mellan två oändliga linjer. */
function meetOf(a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2 | null {
  const r = sub(b, a);
  const q = sub(d, c);
  const den = r[0] * q[1] - r[1] * q[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * q[1] - (c[1] - a[1]) * q[0]) / den;
  return [a[0] + r[0] * t, a[1] + r[1] * t];
}

/** Den ände av linjen som ligger längst från x (den som blir kvar i förhandsvisningen). */
function nearer(pts: Vec2[], x: Vec2): Vec2 {
  const a = pts[0];
  const b = pts[pts.length - 1];
  return dist(a, x) > dist(b, x) ? a : b;
}

/** Förhandsvisningen: biten som trimmas bort, var det delas, eller hörnet som skarvas. */
export function overlayCut(s: ModifyState, cam: Camera, at: Vec2 | null, out: string[]): void {
  const hover = s.hoverAt;
  if (!hover) return;
  const doc = s.host.store.doc;
  const line = (pts: readonly Vec2[], cls?: string) => svgLine(cam, pts, cls);
  if (s.op === 'trim') {
    const id = nearestSelected(s, hover, canTrim);
    const target = id ? doc.elements[id] : undefined;
    if (target) {
      const r = target.type === 'Wall' ? trimPath(pathOf(target), wallCutters(doc, target), hover) : trimPath(linePoints(target), cutters(s, target.id), hover);
      if (r) out.push(line(r.cut, 'trim-cut'));
    }
  } else if (s.op === 'split' && at && nearestSelected(s, hover, canTrim)) {
    const [x, y] = cam.toScreen(at);
    out.push(`<path d="M${x - 6} ${y - 6}L${x + 6} ${y + 6}M${x - 6} ${y + 6}L${x + 6} ${y - 6}" class="trim-cut"/>`);
  } else if (s.op === 'join' && s.first) {
    const a = pathOf(doc.elements[s.first.id]);
    const bId = joinTarget(s, hover);
    if (bId) {
      const b = pathOf(doc.elements[bId]);
      const x = meetOf(a[0], a[a.length - 1], b[0], b[b.length - 1]);
      if (x) out.push(line([a[0], a[a.length - 1]], 'snap-guide'), line([b[0], b[b.length - 1]], 'snap-guide'), line([nearer(a, x), x, nearer(b, x)]));
    }
  }
}
