import type { StyleSheet } from '../core/graphics';
import { difference, union, type Rings } from '../geometry/boolean';
import { clipPlane, type V3 } from '../geometry/hiddenLine';
import { fillPrims, materialSurfaceFill } from '../elements/fill2d';
import type { Primitive, Vec2 } from './primitives';
import type { Solid } from './solids';

/**
 * Ytornas fyllning i fasader (0.10.28.2): ett bjälklag eller tak vars
 * material har en yta (`Material.surface`) fylls där det syns. Formens
 * trianglar delas i plana ytor; varje yta är dess bild minus det som ligger
 * framför den. En triangel framför klipps mot ytans plan, så att bara den
 * del som verkligen ligger närmare betraktaren skymmer (exakt för plana
 * ytor, som de dolda linjerna). Ytor som vetter bort skyms av formens egen
 * framsida. Allt i vyns koordinater (x längs linjen, y höjd, d djup).
 */

/** Hur långt framför en yta något måste ligga för att skymma den (mm). */
const DEPTH_EPS = 1.5;
/** Mindre bilder än så här (mm²) hoppas över: ytor som syns från kanten. */
const MIN_AREA = 1;

interface Tri {
  pts: [V3, V3, V3];
  box: [number, number, number, number];
}

function trisOf(flat: readonly number[]): Tri[] {
  const out: Tri[] = [];
  for (let i = 0; i + 8 < flat.length; i += 9) {
    const pts: [V3, V3, V3] = [
      [flat[i], flat[i + 1], flat[i + 2]],
      [flat[i + 3], flat[i + 4], flat[i + 5]],
      [flat[i + 6], flat[i + 7], flat[i + 8]],
    ];
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    out.push({ pts, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
  }
  return out;
}

const area2 = (a: V3 | Vec2, b: V3 | Vec2, c: V3 | Vec2) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

/** Triangelns plan som d = px·x + py·y + p0, eller null när den syns från kanten. */
function planeOf(t: Tri): [number, number, number] | null {
  const [a, b, c] = t.pts;
  const den = area2(a, b, c);
  if (Math.abs(den) < 2 * MIN_AREA) return null;
  const px = ((b[2] - a[2]) * (c[1] - a[1]) - (c[2] - a[2]) * (b[1] - a[1])) / den;
  const py = ((c[2] - a[2]) * (b[0] - a[0]) - (b[2] - a[2]) * (c[0] - a[0])) / den;
  return [px, py, a[2] - px * a[0] - py * a[1]];
}

/** Punkterna avrundade till 0,1 mm: polygonklippningen klarar inte nästan sammanfallande kanter. */
const snap = (q: V3 | Vec2): Vec2 => [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10];

const overlaps = (a: Tri['box'], b: Tri['box']) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/** Ringen moturs (unionen och differensen bryr sig inte, men ytan ska vara positiv). */
function ccw(r: Vec2[]): Vec2[] {
  let s = 0;
  for (let i = 0; i < r.length; i++) s += area2([0, 0], r[i], r[(i + 1) % r.length]);
  return s < 0 ? r.slice().reverse() : r;
}

/**
 * De synliga delarna av formens ytor, i vyns koordinater. `tris` är formens
 * trianglar och `occluders` alla formers (också dess egna), platta listor
 * med nio tal per triangel.
 */
export function visibleFaces(tris: readonly number[], occluders: readonly (readonly number[])[]): Rings[] {
  const own = trisOf(tris);
  const all = occluders.flatMap((o) => trisOf(o));
  // Ytorna: trianglarna grupperade efter plan.
  const groups = new Map<string, { plane: [number, number, number]; tris: Tri[] }>();
  for (const t of own) {
    const pl = planeOf(t);
    if (!pl) continue;
    const k = `${pl[0].toFixed(4)}|${pl[1].toFixed(4)}|${Math.round(pl[2])}`;
    const g = groups.get(k) ?? { plane: pl, tris: [] };
    g.tris.push(t);
    groups.set(k, g);
  }
  const out: Rings[] = [];
  for (const g of groups.values()) {
    const [px, py, p0] = g.plane;
    const face = safeUnion(g.tris.map((t): Rings => [ccw(t.pts.map(snap))]));
    if (!face.length) continue;
    const box: Tri['box'] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const t of g.tris) {
      box[0] = Math.min(box[0], t.box[0]);
      box[1] = Math.min(box[1], t.box[1]);
      box[2] = Math.max(box[2], t.box[2]);
      box[3] = Math.max(box[3], t.box[3]);
    }
    // Det som ligger framför ytans plan, i bilden.
    const front: Rings[] = [];
    for (const t of all) {
      if (!overlaps(box, t.box)) continue;
      const poly = clipPlane(t.pts.slice(), (q) => px * q[0] + py * q[1] + p0 - q[2] - DEPTH_EPS);
      if (poly.length < 3) continue;
      const ring = poly.map(snap);
      let a = 0;
      for (let i = 1; i + 1 < ring.length; i++) a += area2(ring[0], ring[i], ring[i + 1]);
      if (Math.abs(a) < 2 * MIN_AREA) continue;
      front.push([ccw(ring)]);
    }
    for (const poly of face) out.push(...without(poly, front));
  }
  return out.filter((p) => p[0]?.length >= 3);
}

/** Unionen, eller en i taget när klippningen inte går ihop. */
function safeUnion(polys: Rings[]): Rings[] {
  if (polys.length < 2) return polys;
  try {
    return union(polys);
  } catch {
    let acc: Rings[] = [polys[0]];
    for (const p of polys.slice(1)) {
      try {
        acc = union([...acc, p]);
      } catch {
        acc.push(p);
      }
    }
    return acc;
  }
}

/**
 * Ytan utan det som ligger framför. Går klippningen inte ihop dras bitarna
 * av en i taget, och en bit som inte går hoppas över (ytan blir då lite
 * för stor där, men fasaden ritas).
 */
function without(poly: Rings, cutters: Rings[]): Rings[] {
  if (!cutters.length) return [poly];
  try {
    return difference(poly, cutters);
  } catch {
    let acc: Rings[] = [poly];
    for (const c of cutters) {
      const next: Rings[] = [];
      for (const a of acc) {
        try {
          next.push(...difference(a, [c]));
        } catch {
          next.push(a);
        }
      }
      acc = next;
    }
    return acc;
  }
}

/**
 * Ytornas fyllning för formerna `faces` (de vars material har en yta),
 * under linjerna och utan att gå att klicka på.
 */
export function surfacePrims(faces: readonly { s: Solid; tris: number[] }[], occluders: readonly (readonly number[])[], style: StyleSheet, scale: number, objectType: (id: string) => string | undefined): Primitive[] {
  const out: Primitive[] = [];
  for (const { s, tris } of faces) {
    const fill = materialSurfaceFill(style.materials?.find((m) => m.id === s.matId));
    if (!fill) continue;
    const origin = { objectId: s.id, objectType: objectType(s.id), part: 'yta' };
    const at: Vec2 = [tris[0] ?? 0, tris[1] ?? 0];
    for (const rings of visibleFaces(tris, occluders)) out.push(...fillPrims(rings, fill, origin, true, style, scale, undefined, at).map((q) => ({ ...q, origin, noPick: true })));
  }
  return out;
}
