import { updateParams } from '../../core/commands';
import { insertNode, moveNode, offsetEdge, orientation, setOutline } from '../../core/roofEdit';
import { bendShapeEdge, edgeIsArc, edgeRun, editedShape, insertShapeNode, moveShapeNode, offsetShapeEdge, offsetShapeEdges, previewShape, roundShapeCorner, shapeNodes, shapePatch, type ShapeLike } from '../../elements/shapeEdit';
import { bulgeForRadius, bulgeThrough } from '../../geometry/arc';
import { dist } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import { lengthLabel } from '../tools/overlay';
import { svgLine } from './draw';
import type { OpId } from './ops';
import type { ModifyState } from './state';

/**
 * Punkter och kanter i Modifiera (0.8.15, ur tool.ts): lägg till, flytta och
 * förskjut på 2D-element, bjälklagens håltagningar (0.9.4) och takets kontur.
 */
export const OUTLINE_OPS = new Set<OpId>(['shapeInsert', 'shapeMove', 'shapeOffset', 'shapeBend', 'shapeFillet', 'shapeChamfer', 'holeMove', 'holeRotate', 'holeMirror', 'roofInsert', 'roofMove', 'roofOffset']);

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

/** Takets (bjälklagets, markobjektets) kontur efter förskjutningen, eller null. Med fler kanter (0.10.17) som 2D-formens. */
function roofOffsetPreview(s: ModifyState, out: number): [number, number][] | null {
  const o = roofOutline(s);
  if (!o) return null;
  if (s.edges === 1) return offsetEdge(o, s.ctx.index!, -orientation(o) * out);
  const shape: ShapeLike = { type: 'Shape2D', params: { shape: 'polyline', points: o, closed: true } };
  const r = offsetShapeEdges(shape, edgeRun(shape, s.ctx.index!, s.edges), -orientation(o) * out);
  return (r?.points as [number, number][] | undefined) ?? null;
}

/** 2D-formens kanter förskjutna d mm åt vänster om den klickade: en kant som förut, eller flera (0.10.17). */
function shapeOffsetPatch(s: ModifyState, el: ShapeLike, d: number): Record<string, unknown> | null {
  const i = s.ctx.index!;
  if (s.edges === 1 && !edgeIsArc(el, i)) return offsetShapeEdge(el, i, d);
  return offsetShapeEdges(el, edgeRun(el, i, s.edges), d);
}

/** 2D-elementet eller håltagningen som ändras, om det är en. */
function shapeOf(s: ModifyState) {
  return editedShape(s.host.store.doc, s.ctx.shapeId, s.ctx.hole);
}

/**
 * Formens ändring som en ändring av elementet (2D-elementet eller
 * bjälklaget), om det inte är låst. Svarar false om det är låst.
 */
function applyShape(s: ModifyState, patch: Record<string, unknown>, label: string): boolean {
  const id = s.ctx.shapeId!;
  const el = s.host.store.doc.elements[id];
  if (!el) return false;
  if (el.locked) {
    s.host.hint('Låst. Lås upp i egenskaperna för att ändra.', 3000);
    return false;
  }
  updateParams(s.host.store, [id], shapePatch(s.host.store.doc, id, s.ctx.hole, patch), label);
  return true;
}

/** Avrunda eller fasa (0.9.4) med det skrivna värdet, annars det som står i fältet. */
function cornerPatch(s: ModifyState, typed: number | null): Record<string, unknown> | null {
  const el = shapeOf(s);
  const r = Math.abs(typed ?? s.value);
  return el ? roundShapeCorner(el, s.ctx.index!, r, s.op === 'shapeFillet' ? 'fillet' : 'chamfer') : null;
}

/** Håltagningen flyttad från baspunkten till `at` (0.9.4). */
function movedHole(s: ModifyState, base: Vec2, at: Vec2): Record<string, unknown> | null {
  const el = shapeOf(s);
  if (!el) return null;
  const d: Vec2 = [Math.round(at[0] - base[0]), Math.round(at[1] - base[1])];
  return { points: shapeNodes(el).map((q) => [q[0] + d[0], q[1] + d[1]]) };
}

/** Vinkeln för Vrid hålet: den skrivna, eller från riktningen man vrider från till markören (grader). */
function holeAngle(s: ModifyState, base: Vec2, at: Vec2 | null, typed: number | null): number | null {
  if (typed !== null) return typed;
  if (!at || !s.ref) return null;
  const a = (v: Vec2) => (Math.atan2(v[1] - base[1], v[0] - base[0]) * 180) / Math.PI;
  return Math.round((a(at) - a(s.ref)) * 10) / 10;
}

/** Håltagningen vriden kring baspunkten (0.10.17). */
function rotatedHole(s: ModifyState, base: Vec2, deg: number): Record<string, unknown> | null {
  const el = shapeOf(s);
  if (!el || !deg) return null;
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const sn = Math.sin(r);
  return { points: shapeNodes(el).map((q) => [Math.round(base[0] + (q[0] - base[0]) * c - (q[1] - base[1]) * sn), Math.round(base[1] + (q[0] - base[0]) * sn + (q[1] - base[1]) * c)]) };
}

/** Håltagningen speglad i linjen genom baspunkten och `at` (0.10.17); bågarna byter sida. */
function mirroredHole(s: ModifyState, base: Vec2, at: Vec2): Record<string, unknown> | null {
  const el = shapeOf(s);
  const len = dist(base, at);
  if (!el || len < 1) return null;
  const n: Vec2 = [-(at[1] - base[1]) / len, (at[0] - base[0]) / len];
  const points = shapeNodes(el).map((q) => {
    const o = (q[0] - base[0]) * n[0] + (q[1] - base[1]) * n[1];
    return [Math.round(q[0] - 2 * o * n[0]), Math.round(q[1] - 2 * o * n[1])];
  });
  const bulges = el.params.bulges as number[] | undefined;
  return { points, ...(bulges ? { bulges: bulges.map((b) => (b ? -b : 0)) } : {}) };
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

/** Böj (0.8.24): pilhöjden genom punkten, eller för radien på den sida markören är (annars den sida bågen redan buktar åt). */
function bendPatch(s: ModifyState, at: Vec2 | null, typed: number | null): Record<string, unknown> | null {
  const el = shapeOf(s);
  if (!el) return null;
  const pts = shapeNodes(el);
  const i = s.ctx.index!;
  const a = pts[i];
  const b = pts[(i + 1) % pts.length];
  let bulge: number;
  if (typed !== null) {
    const now = Number(((el.params.bulges as number[] | undefined) ?? [])[i] ?? 0);
    const side = at ? (shapeSide(s, at) >= 0 ? 1 : -1) : now >= 0 ? 1 : -1;
    bulge = bulgeForRadius(a, b, Math.abs(typed), side);
  } else if (at) bulge = bulgeThrough(a, b, at);
  else return null;
  return bendShapeEdge(el, i, bulge);
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
      const patch = s.op === 'shapeInsert' ? insertShapeNode(el, ctx.index!, to) : dist(to, base) >= 1 ? moveShapeNode(el, ctx.index!, to) : null;
      if (patch) applyShape(s, patch, s.op === 'shapeInsert' ? 'Lägg till punkt' : 'Flytta punkt');
      return true;
    }
    case 'shapeFillet':
    case 'shapeChamfer': {
      if (!shapeOf(s)) return true;
      const patch = cornerPatch(s, typed);
      if (!patch) {
        s.host.hint(s.op === 'shapeFillet' ? 'Radien ryms inte på kanterna.' : 'Avståndet ryms inte på kanterna.');
        return false;
      }
      applyShape(s, patch, s.op === 'shapeFillet' ? 'Avrunda hörn' : 'Fasa hörn');
      return true;
    }
    case 'holeMove': {
      if (!at || dist(at, base) < 1) return false;
      const patch = movedHole(s, base, at);
      if (patch) applyShape(s, patch, 'Flytta hålet');
      return true;
    }
    case 'holeRotate': {
      const deg = holeAngle(s, base, at, typed);
      if (deg === null) return false;
      const patch = rotatedHole(s, base, deg);
      if (patch) applyShape(s, patch, 'Vrid hålet');
      return true;
    }
    case 'holeMirror': {
      if (!at || dist(at, base) < 1) return false;
      const patch = mirroredHole(s, base, at);
      if (patch) applyShape(s, patch, 'Spegla hålet');
      return true;
    }
    case 'shapeOffset': {
      const el = shapeOf(s);
      if (!el) return true;
      const sd = at ? shapeSide(s, at) : 1;
      const d = typed !== null ? Math.abs(typed) * (sd >= 0 ? 1 : -1) : Math.round(sd);
      if (Math.abs(d) < 1) return false;
      const patch = shapeOffsetPatch(s, el, d);
      if (!patch) {
        s.host.hint(s.edges === 1 ? 'Kanten kan inte förskjutas så långt.' : 'Kanterna kan inte förskjutas så långt.');
        return false;
      }
      applyShape(s, patch, s.edges === 1 ? 'Förskjut kant' : 'Förskjut kanter');
      return true;
    }
    case 'shapeBend': {
      const el = shapeOf(s);
      if (!el) return true;
      if (typed !== null && !(Math.abs(typed) > 0)) return false;
      const patch = bendPatch(s, at, typed);
      if (!patch) return false;
      applyShape(s, patch, 'Böj');
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
      setOutline(store, ctx.roofId, next, s.edges === 1 ? 'Förskjut kant' : 'Förskjut kanter');
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
        shapeGhost(shapeOffsetPatch(s, shp, d));
        out.push(lengthLabel(cam, base, at, `${Math.abs(d).toLocaleString('sv-SE')} mm`));
      }
      break;
    case 'shapeBend':
      if (shp && at) shapeGhost(bendPatch(s, at, null));
      break;
    case 'shapeFillet':
    case 'shapeChamfer':
      shapeGhost(cornerPatch(s, null));
      break;
    case 'holeMove':
      if (shp && at) {
        shapeGhost(movedHole(s, base, at));
        out.push(lengthLabel(cam, base, at, `${Math.round(dist(base, at)).toLocaleString('sv-SE')} mm`));
      }
      break;
    case 'holeRotate':
      if (shp && at) {
        out.push(line([base, at]));
        if (s.ref) {
          out.push(svgLine(cam, [base, s.ref], 'snap-guide'));
          const deg = holeAngle(s, base, at, null) ?? 0;
          shapeGhost(rotatedHole(s, base, deg));
          out.push(lengthLabel(cam, base, at, `${(Math.round((((deg % 360) + 360) % 360) * 10) / 10).toLocaleString('sv-SE')}°`));
        }
      }
      break;
    case 'holeMirror':
      if (shp && at && dist(at, base) > 1) {
        const len = dist(at, base);
        const u: Vec2 = [(at[0] - base[0]) / len, (at[1] - base[1]) / len];
        out.push(svgLine(cam, [[base[0] - u[0] * 20000, base[1] - u[1] * 20000], [base[0] + u[0] * 20000, base[1] + u[1] * 20000]], 'snap-guide'));
        shapeGhost(mirroredHole(s, base, at));
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
