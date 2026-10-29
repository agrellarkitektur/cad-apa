import type { ProjectDoc } from '../core/model';
import type { ViewStates } from '../core/states';
import { createContext } from './context';
import { groundGeometry, groundObjects, type GroundParams } from '../elements/groundGeometry';
import { slopeArea } from '../elements/groundSlopes';
import { materialOf, type FillParams } from '../elements/fill2d';
import type { Vec2 } from './primitives';

/**
 * Markens kulörer i 3D (0.10.28): varje triangel i marknätet får kulören
 * från materialet hos markytan, rampen eller slänten den ligger i (den
 * senaste i ritordningen när flera överlappar), annars markens egen.
 * Trianglarna sorteras per kulör, så att 3D-vyn ritar en grupp per kulör.
 * Nätet är skuret längs markytornas och rampernas kanter (0.10.26), så
 * kulörerna följer kanterna där; slänternas yttre kant följer trianglarna.
 */

export interface ColorGroup {
  start: number;
  count: number;
  /** #rrggbb, eller null för markens egen kulör. */
  color: string | null;
}

interface Shape {
  rings: Vec2[][];
  box: [number, number, number, number];
  color: string;
}

/** Ytorna med en kulör i 3D, i ritordning: slänterna under sitt objekt. */
export function colorShapes(doc: ProjectDoc, view: ViewStates): Shape[] {
  const storey = doc.storeys[0]?.id;
  if (!storey || !doc.site || !doc.graphics.materials?.length) return [];
  const { ctx } = createContext(doc, storey, view, doc.graphics, () => true);
  const out: Shape[] = [];
  const push = (rings: Vec2[][], color: string | undefined) => {
    if (!color || !rings.length) return;
    const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const r of rings)
      for (const q of r) {
        box[0] = Math.min(box[0], q[0]);
        box[1] = Math.min(box[1], q[1]);
        box[2] = Math.max(box[2], q[0]);
        box[3] = Math.max(box[3], q[1]);
      }
    out.push({ rings, box, color });
  };
  for (const el of groundObjects(ctx)) {
    const p = ctx.params<GroundParams>(el);
    if (p.kind !== 'area' && p.kind !== 'path') continue;
    const own = materialOf(p as Partial<FillParams>, doc.graphics)?.color3d;
    const slope = materialOf((p.slopeFill ?? {}) as Partial<FillParams>, doc.graphics)?.color3d;
    if (!own && !slope) continue;
    const g = groundGeometry(ctx, el);
    if (!g) continue;
    if (slope) for (const rings of slopeArea(ctx, g)) push(rings as Vec2[][], slope);
    if (own) for (const poly of g.rings) push([...poly, ...g.holes] as Vec2[][], own);
  }
  return out;
}

/** Punkten i ytan (jämnt–udda över alla ringar, så att hålen räknas). */
function inside(rings: readonly Vec2[][], x: number, y: number): boolean {
  let on = false;
  for (const r of rings)
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i];
      const b = r[j];
      if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) on = !on;
    }
  return on;
}

/**
 * Nätet med trianglarna sorterade per kulör och grupperna, eller null när
 * ingen triangel har en egen kulör.
 */
export function colorGroups(mesh: { positions: Float32Array; indices: Uint32Array }, shapes: readonly Shape[]): { indices: Uint32Array; groups: ColorGroup[] } | null {
  if (!shapes.length) return null;
  const P = mesh.positions;
  const I = mesh.indices;
  const all = [Infinity, Infinity, -Infinity, -Infinity];
  for (const s of shapes) {
    all[0] = Math.min(all[0], s.box[0]);
    all[1] = Math.min(all[1], s.box[1]);
    all[2] = Math.max(all[2], s.box[2]);
    all[3] = Math.max(all[3], s.box[3]);
  }
  const colors = [...new Set(shapes.map((s) => s.color))];
  const which = new Int32Array(I.length / 3).fill(-1);
  let any = false;
  for (let t = 0; t < which.length; t++) {
    const a = I[t * 3] * 3;
    const b = I[t * 3 + 1] * 3;
    const c = I[t * 3 + 2] * 3;
    const x = (P[a] + P[b] + P[c]) / 3;
    const y = (P[a + 1] + P[b + 1] + P[c + 1]) / 3;
    if (x < all[0] || x > all[2] || y < all[1] || y > all[3]) continue;
    // Den senaste i ritordningen som täcker triangelns mitt.
    for (let k = shapes.length - 1; k >= 0; k--) {
      const s = shapes[k];
      if (x < s.box[0] || x > s.box[2] || y < s.box[1] || y > s.box[3] || !inside(s.rings, x, y)) continue;
      which[t] = colors.indexOf(s.color);
      any = true;
      break;
    }
  }
  if (!any) return null;
  const indices = new Uint32Array(I.length);
  const groups: ColorGroup[] = [];
  let n = 0;
  for (let c = -1; c < colors.length; c++) {
    const start = n;
    for (let t = 0; t < which.length; t++) {
      if (which[t] !== c) continue;
      indices[n++] = I[t * 3];
      indices[n++] = I[t * 3 + 1];
      indices[n++] = I[t * 3 + 2];
    }
    if (n > start) groups.push({ start, count: n - start, color: c < 0 ? null : colors[c] });
  }
  return { indices, groups };
}
