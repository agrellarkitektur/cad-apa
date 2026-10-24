import { updateParams } from '../../core/commands';
import { insertNode, moveNode, offsetEdge, orientation, setOutline } from '../../core/roofEdit';
import { insertShapeNode, moveShapeNode, offsetShapeEdge, previewShape, shapeNodes } from '../../elements/shapeEdit';
import { dist } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import { lengthLabel } from '../tools/overlay';
import { svgLine } from './draw';
import type { OpId } from './ops';
import type { ModifyState } from './state';

/**
 * Punkter och kanter i Modifiera (0.8.15, ur tool.ts): lägg till, flytta och
 * förskjut på 2D-element och på takets kontur.
 */
export const OUTLINE_OPS = new Set<OpId>(['shapeInsert', 'shapeMove', 'shapeOffset', 'roofInsert', 'roofMove', 'roofOffset']);

/** Takets kontur. */
function roofOutline(s: ModifyState): [number, number][] | null {
  const el = s.ctx.roofId ? s.host.store.doc.elements[s.ctx.roofId] : undefined;
  return (el?.params.outline as [number, number][] | undefined) ?? null;
}

/** Avståndet utåt från takets kant till en punkt (negativt inåt). */
function roofOut(s: ModifyState, at: Vec2): number {
  const o = roofOutline(s)!;
  const i = s.ctx.index!;
  const a = o[i];
  const b = o[(i + 1) % o.length];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const n: Vec2 = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  return -orientation(o) * ((at[0] - a[0]) * n[0] + (at[1] - a[1]) * n[1]);
}

/** Takets kontur efter förskjutningen, eller null. */
function roofOffsetPreview(s: ModifyState, out: number): [number, number][] | null {
  const o = roofOutline(s);
  if (!o) return null;
  return offsetEdge(o, s.ctx.index!, -orientation(o) * out);
}

/** 2D-elementet som ändras, om det är ett. */
function shapeOf(s: ModifyState) {
  return s.ctx.shapeId ? s.host.store.doc.elements[s.ctx.shapeId] : undefined;
}

/** Avståndet till vänster om kanten (sett längs den) till en punkt. */
function shapeSide(s: ModifyState, at: Vec2): number {
  const el = shapeOf(s);
  if (!el) return 0;
  const pts = shapeNodes(el);
  const a = pts[s.ctx.index!];
  const b = pts[(s.ctx.index! + 1) % pts.length];
  const l = dist(a, b) || 1;
  const n: Vec2 = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  return (at[0] - a[0]) * n[0] + (at[1] - a[1]) * n[1];
}

/** Utför valet; svarar true när verktyget är klart, false när det väntar kvar. */
export function commitOutline(s: ModifyState, base: Vec2, at: Vec2 | null, typed: number | null): boolean {
  const store = s.host.store;
  const ctx = s.ctx;
  switch (s.op) {
    case 'shapeInsert':
    case 'shapeMove': {
      const el = shapeOf(s);
      const to = at ?? base;
      if (!el) return true;
      if (el.locked) {
        s.host.hint('Låst. Lås upp i egenskaperna för att ändra.', 3000);
        return true;
      }
      const patch = s.op === 'shapeInsert' ? insertShapeNode(el, ctx.index!, to) : dist(to, base) >= 1 ? moveShapeNode(el, ctx.index!, to) : null;
      if (patch) updateParams(store, [el.id], patch, s.op === 'shapeInsert' ? 'Lägg till punkt' : 'Flytta punkt');
      return true;
    }
    case 'shapeOffset': {
      const el = shapeOf(s);
      if (!el) return true;
      const sd = at ? shapeSide(s, at) : 1;
      const d = typed !== null ? Math.abs(typed) * (sd >= 0 ? 1 : -1) : Math.round(sd);
      if (Math.abs(d) < 1) return false;
      const patch = offsetShapeEdge(el, ctx.index!, d);
      if (!patch) {
        s.host.hint('Kanten kan inte förskjutas så långt.');
        return false;
      }
      updateParams(store, [el.id], patch, 'Förskjut kant');
      return true;
    }
    case 'roofInsert':
    case 'roofMove': {
      const o = roofOutline(s);
      const to = at ?? base;
      if (!o || !ctx.roofId) return true;
      if (s.op === 'roofInsert') setOutline(store, ctx.roofId, insertNode(o, ctx.index!, to), 'Lägg till punkt');
      else if (dist(to, base) >= 1) setOutline(store, ctx.roofId, moveNode(o, ctx.index!, to), 'Flytta punkt');
      return true;
    }
    case 'roofOffset': {
      const d = typed !== null ? typed : at ? Math.round(roofOut(s, at)) : 0;
      if (Math.abs(d) < 1 || !ctx.roofId) return false;
      const next = roofOffsetPreview(s, d);
      if (!next) {
        s.host.hint('Kanten kan inte förskjutas så långt.');
        return false;
      }
      setOutline(store, ctx.roofId, next, 'Förskjut kant');
      return true;
    }
    default:
      return true;
  }
}

/** Förhandsvisningen med markören vid `at`. */
export function overlayOutline(s: ModifyState, cam: Camera, base: Vec2, at: Vec2 | null, out: string[]): void {
  const roof = roofOutline(s);
  const shp = shapeOf(s);
  const line = (pts: readonly Vec2[]) => svgLine(cam, pts);
  const shapeGhost = (patch: Record<string, unknown> | null) => {
    if (!shp || !patch) return;
    const pv = previewShape(shp, patch);
    out.push(line(pv.closed ? [...pv.points, pv.points[0]] : pv.points));
  };
  switch (s.op) {
    case 'shapeInsert':
      if (shp && at) shapeGhost(insertShapeNode(shp, s.ctx.index!, at));
      break;
    case 'shapeMove':
      if (shp && at) shapeGhost(moveShapeNode(shp, s.ctx.index!, at));
      break;
    case 'shapeOffset':
      if (shp && at) {
        const d = Math.round(shapeSide(s, at));
        shapeGhost(offsetShapeEdge(shp, s.ctx.index!, d));
        out.push(lengthLabel(cam, base, at, `${Math.abs(d).toLocaleString('sv-SE')} mm`));
      }
      break;
    case 'roofInsert':
      if (roof && at) out.push(line([roof[s.ctx.index!], at, roof[(s.ctx.index! + 1) % roof.length]]));
      break;
    case 'roofMove':
      if (roof && at) {
        const i = s.ctx.index!;
        out.push(line([roof[(i - 1 + roof.length) % roof.length], at, roof[(i + 1) % roof.length]]));
      }
      break;
    case 'roofOffset':
      if (roof && at) {
        const d = Math.round(roofOut(s, at));
        const next = roofOffsetPreview(s, d);
        if (next) out.push(line([...next, next[0]]));
        out.push(lengthLabel(cam, base, at, `${d.toLocaleString('sv-SE')} mm`));
      }
      break;
    default:
      break;
  }
}
