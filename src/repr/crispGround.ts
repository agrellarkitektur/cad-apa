import earcut from 'earcut';
import { withHeights, type Step } from '../core/ground';
import { groundAt, type Terrain } from '../core/site';
import { difference, intersection, type Rings } from '../geometry/boolean';
import { groundGeometry, groundObjects, type Finished, type GroundParams } from '../elements/groundGeometry';
import type { PlanContext } from '../elements/registry';
import type { Vec2 } from './primitives';

/**
 * Skarpa kanter på den färdiga marken (0.10.26). Den färdiga marken är ett
 * rutnät (en eller ett par meter mellan noderna), så en ramps eller markytas
 * kant hamnar mellan noderna och blir vågig: trianglarna över kanten tonar
 * från rampens höjd till markens. Här skärs nätet längs objektens konturer:
 * innanför har marken objektets höjd ända ut till kanten, och utanför en
 * stödmurskant ligger marken som den var utan objektet, med en lodrät yta
 * emellan. Utanför en slänt börjar slänten vid kanten, så där möts de.
 *
 * Gäller 3D-vyn, marken under markobjektens linjer i 3D och marklinjen i
 * sektionerna; planens höjdkurvor räknas som förut på rutnätet.
 */

export interface Crisp {
  id: string;
  /** Konturen, och för varje kant (från punkt i till nästa) om den är en stödmur. */
  ring: Vec2[];
  wall: boolean[];
  box: [number, number, number, number];
  /** Objektets höjd i en punkt på ytan eller kanten, mm från ±0. */
  top(x: number, y: number): number;
  /** Marken utan objektet, mm från ±0: den som ligger utanför en stödmurskant. */
  below(x: number, y: number): number | null;
}

/** Marken utan objektet: den färdiga med objektets ändringar tillbakalagda, en gång per steg. */
const belowOf = new WeakMap<Step, Terrain>();

/** Markytorna och ramperna som ändrar marken i vyn, i ritordning. */
export function crispShapes(ctx: PlanContext, f: Finished): Crisp[] {
  return ctx.memo('crisp-ground', () => {
    const out: Crisp[] = [];
    for (const el of groundObjects(ctx)) {
      const p = ctx.params<GroundParams>(el);
      if (p.around || p.slab || (p.kind !== 'path' && p.kind !== 'area')) continue;
      const g = groundGeometry(ctx, el);
      const sh = g?.shape;
      if (!g || !sh || sh.blend || g.rings.length !== 1 || g.rings[0].length !== 1) continue;
      const step = f.steps.find((s) => s.shape === sh);
      if (!step || !step.idx.length) continue;
      const ring = g.rings[0][0];
      if (ring.length < 3) continue;
      const wall = g.edgeWall ?? ring.map(() => p.edge === 'wall');
      const cell = f.terrain.grid.s * 1000;
      let tb: Terrain | undefined;
      const under = (): Terrain => {
        let t = belowOf.get(step) ?? tb;
        if (!t) {
          const z = f.z.slice();
          for (let m = 0; m < step.idx.length; m++) z[step.idx[m]] = step.old[m];
          t = withHeights(f.terrain, z, f);
          belowOf.set(step, t);
        }
        return (tb = t);
      };
      out.push({
        id: el.id,
        ring,
        wall,
        box: sh.box as [number, number, number, number],
        top: (x, y) => sh.probe(x, y, cell).h,
        below: (x, y) => groundAt(under(), x, y),
      });
    }
    return out;
  });
}

/** Närmaste kant i ringen: om punkten ligger inuti, avståndet och kantens nummer. */
export function nearestRingEdge(ring: readonly Vec2[], x: number, y: number): { inside: boolean; d: number; edge: number } {
  let inside = false;
  let best = Infinity;
  let edge = 0;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    const dx = xi - xj;
    const dy = yi - yj;
    const l2 = dx * dx + dy * dy;
    const f = l2 > 0 ? Math.max(0, Math.min(1, ((x - xj) * dx + (y - yj) * dy) / l2)) : 0;
    const d = Math.hypot(x - (xj + dx * f), y - (yj + dy * f));
    if (d < best) {
      best = d;
      edge = j;
    }
  }
  return { inside, d: best, edge };
}

/**
 * Markens höjd i en punkt med de skarpa kanterna (mm från ±0): på ett
 * objekts yta och kant objektets höjd, nära utanför en stödmurskant marken
 * utan objektet, annars rutnätets. `t` är den färdiga marken.
 */
export function crispHeight(crisps: readonly Crisp[], t: Terrain): (p: Vec2) => number | null {
  const reach = 2 * t.grid.s * 1000;
  return (p) => {
    // Det som ritas sist ligger överst.
    for (let k = crisps.length - 1; k >= 0; k--) {
      const c = crisps[k];
      if (p[0] < c.box[0] - reach || p[0] > c.box[2] + reach || p[1] < c.box[1] - reach || p[1] > c.box[3] + reach) continue;
      const e = nearestRingEdge(c.ring, p[0], p[1]);
      if (e.inside || e.d < 0.5) return c.top(p[0], p[1]);
      if (c.wall[e.edge] && e.d < reach) return c.below(p[0], p[1]);
    }
    return groundAt(t, p[0], p[1]);
  };
}

/** Kanterna i en ring sorterade i rutor om `B` mm, för att se vilka trianglar en kontur går genom. */
const B = 2000;
function buckets(ring: readonly Vec2[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const i0 = Math.floor(Math.min(a[0], b[0]) / B);
    const i1 = Math.floor(Math.max(a[0], b[0]) / B);
    const j0 = Math.floor(Math.min(a[1], b[1]) / B);
    const j1 = Math.floor(Math.max(a[1], b[1]) / B);
    for (let ii = i0; ii <= i1; ii++)
      for (let jj = j0; jj <= j1; jj++) {
        const key = `${ii},${jj}`;
        const list = out.get(key);
        if (list) list.push(i);
        else out.set(key, [i]);
      }
  }
  return out;
}

/** Om någon av ringens kanter går genom rektangeln `box` (med en millimeters marginal). */
function touches(ring: readonly Vec2[], cells: Map<string, number[]>, box: readonly number[]): boolean {
  const x0 = box[0] - 1;
  const y0 = box[1] - 1;
  const x1 = box[2] + 1;
  const y1 = box[3] + 1;
  for (let i = Math.floor(x0 / B); i <= Math.floor(x1 / B); i++)
    for (let j = Math.floor(y0 / B); j <= Math.floor(y1 / B); j++)
      for (const e of cells.get(`${i},${j}`) ?? []) {
        const a = ring[e];
        const b = ring[(e + 1) % ring.length];
        if (Math.max(a[0], b[0]) < x0 || Math.min(a[0], b[0]) > x1 || Math.max(a[1], b[1]) < y0 || Math.min(a[1], b[1]) > y1) continue;
        // Rektangelns hörn på samma sida om kantens linje: kanten går förbi.
        const s = [x0, x1].flatMap((x) => [y0, y1].map((y) => Math.sign((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]))));
        if (s.every((v) => v > 0) || s.every((v) => v < 0)) continue;
        return true;
      }
  return false;
}

interface Vert {
  x: number;
  y: number;
  z: number;
  /** Nodens nummer i nätet, för hörnen som kommer från rutnätet. */
  i?: number;
}

/** En bit av en triangel: ytterkonturen och eventuella hål. Konvex när den bara delats längs linjer. */
interface Piece {
  rings: Vert[][];
  convex: boolean;
}

/** Lodytans bitar längs en stödmurskant, mm. */
const SKIRT_STEP = 500;

/**
 * Marknätet med de skarpa kanterna: trianglarna som en kontur går genom
 * delas längs konturens kanter (efter kanternas linjer, så att bitarna är
 * konvexa och var och en ligger helt innanför eller utanför), hörnen på
 * konturen får objektets höjd (eller, utanför en stödmurskant, markens utan
 * objektet), och längs stödmurskanterna läggs en lodrät yta från objektets
 * höjd till marken. Övriga trianglar lämnas.
 */
export function crispMesh(mesh: { positions: Float32Array; indices: Uint32Array }, crisps: readonly Crisp[]): { positions: Float32Array; indices: Uint32Array } {
  if (!crisps.length) return mesh;
  const P = mesh.positions;
  const I = mesh.indices;
  const cells = crisps.map((c) => buckets(c.ring));
  const extra: number[] = [];
  const out: number[] = [];
  const keyed = new Map<string, number>();
  let next = P.length / 3;
  const vertex = (v: Vert): number => {
    if (v.i !== undefined) return v.i;
    const key = `${Math.round(v.x * 10)},${Math.round(v.y * 10)},${Math.round(v.z)}`;
    let n = keyed.get(key);
    if (n === undefined) {
      n = next++;
      keyed.set(key, n);
      extra.push(v.x, v.y, v.z);
    }
    return n;
  };
  // Alla objekts rektangel: trianglarna utanför den lämnas utan vidare (de flesta i en stor markmodell).
  const all = [Infinity, Infinity, -Infinity, -Infinity];
  for (const c of crisps) {
    all[0] = Math.min(all[0], c.box[0]);
    all[1] = Math.min(all[1], c.box[1]);
    all[2] = Math.max(all[2], c.box[2]);
    all[3] = Math.max(all[3], c.box[3]);
  }
  for (let t = 0; t < I.length; t += 3) {
    const i0 = I[t] * 3;
    const i1 = I[t + 1] * 3;
    const i2 = I[t + 2] * 3;
    const box = [Math.min(P[i0], P[i1], P[i2]), Math.min(P[i0 + 1], P[i1 + 1], P[i2 + 1]), Math.max(P[i0], P[i1], P[i2]), Math.max(P[i0 + 1], P[i1 + 1], P[i2 + 1])];
    if (box[0] > all[2] || box[2] < all[0] || box[1] > all[3] || box[3] < all[1]) {
      out.push(I[t], I[t + 1], I[t + 2]);
      continue;
    }
    const tri: Vert[] = [I[t], I[t + 1], I[t + 2]].map((i) => ({ x: P[i * 3], y: P[i * 3 + 1], z: P[i * 3 + 2], i }));
    const hits: number[] = [];
    for (let k = 0; k < crisps.length; k++) {
      const c = crisps[k];
      if (box[0] <= c.box[2] && box[2] >= c.box[0] && box[1] <= c.box[3] && box[3] >= c.box[1] && touches(c.ring, cells[k], box)) hits.push(k);
    }
    if (!hits.length) {
      out.push(I[t], I[t + 1], I[t + 2]);
      continue;
    }
    // Planet genom triangeln, för en punkt som varken är ett hörn eller ligger på konturen (bör inte hända).
    const plane = planeOf(tri);
    let pieces: Piece[] = [{ rings: [tri], convex: true }];
    for (const k of hits) {
      const c = crisps[k];
      const n = c.ring.length;
      // Konturens kanter genom triangeln, ur rutorna runt den.
      const near = new Set<number>();
      for (let i = Math.floor(box[0] / B); i <= Math.floor(box[2] / B); i++) for (let j = Math.floor(box[1] / B); j <= Math.floor(box[3] / B); j++) for (const e of cells[k].get(`${i},${j}`) ?? []) near.add(e);
      const segs = [...near].sort((x, y) => x - y).filter((e) => segmentMeetsTriangle(c.ring[e], c.ring[(e + 1) % n], tri));
      if (!segs.length) continue;
      const zOf = (q: Vec2, inside: boolean): number => {
        const e = nearestRingEdge(c.ring, q[0], q[1]);
        if (e.d > 1) return plane(q[0], q[1]);
        return inside || !c.wall[e.edge] ? c.top(q[0], q[1]) : (c.below(q[0], q[1]) ?? plane(q[0], q[1]));
      };
      // Det vanliga: kanterna går tvärs över triangeln (inget av konturens hörn i den). Då delar
      // kanternas linjer bitarna, och bitarna är konvexa. Annars skärs bitarna mot konturen.
      const across = pieces.every((pc) => pc.convex) && segs.every((e) => !strictlyInside(c.ring[e], tri) && !strictlyInside(c.ring[(e + 1) % n], tri));
      if (across) {
        let convex = pieces.map((pc) => pc.rings[0]);
        for (const e of segs) convex = convex.flatMap((pc) => splitConvex(pc, c.ring[e], c.ring[(e + 1) % n]));
        pieces = convex.map((pc) => {
          const inside = nearestRingEdge(c.ring, ...centroid(pc)).inside;
          return { rings: [pc.map((v) => (Number.isNaN(v.z) ? { ...v, z: zOf([v.x, v.y], inside) } : v))], convex: true };
        });
        continue;
      }
      const cut: Piece[] = [];
      for (const pc of pieces) {
        const xy: Rings = pc.rings.map((r) => r.map((v): Vec2 => [v.x, v.y]));
        const known = pc.rings.flat();
        for (const [polys, inside] of [
          [intersection(xy, [[c.ring]]), true],
          [difference(xy, [[c.ring]]), false],
        ] as const) {
          for (const poly of polys) {
            const rings = poly.map((r) =>
              r.map((q): Vert => known.find((v) => Math.abs(v.x - q[0]) < 0.5 && Math.abs(v.y - q[1]) < 0.5) ?? { x: q[0], y: q[1], z: zOf(q, inside) }),
            );
            cut.push({ rings, convex: false });
          }
        }
      }
      pieces = cut;
    }
    for (const pc of pieces) {
      const verts = pc.rings.flat();
      let tris: number[];
      if (pc.convex) {
        tris = [];
        for (let m = 1; m < verts.length - 1; m++) tris.push(0, m, m + 1);
      } else {
        const flat: number[] = [];
        const holes: number[] = [];
        for (const r of pc.rings) {
          if (flat.length) holes.push(flat.length / 2);
          for (const v of r) flat.push(v.x, v.y);
        }
        tris = earcut(flat, holes);
      }
      for (let m = 0; m < tris.length; m += 3) {
        const [a, b, d] = [verts[tris[m]], verts[tris[m + 1]], verts[tris[m + 2]]];
        const area = (b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x);
        if (Math.abs(area) < 1) continue;
        // Moturs sett ovanifrån, som resten av nätet.
        if (area > 0) out.push(vertex(a), vertex(b), vertex(d));
        else out.push(vertex(a), vertex(d), vertex(b));
      }
    }
  }
  // Lodytorna längs stödmurskanterna, åt båda hållen (schakt och fyll), med egna hörn så att ljuset bryts vid kanten.
  for (const c of crisps) {
    const n = c.ring.length;
    for (let i = 0; i < n; i++) {
      if (!c.wall[i]) continue;
      const a = c.ring[i];
      const b = c.ring[(i + 1) % n];
      const parts = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / SKIRT_STEP));
      let prev: [number, number, number, number] | null = null;
      for (let k = 0; k <= parts; k++) {
        const x = a[0] + ((b[0] - a[0]) * k) / parts;
        const y = a[1] + ((b[1] - a[1]) * k) / parts;
        const lo = c.below(x, y);
        const cur: [number, number, number, number] | null = lo === null ? null : [x, y, c.top(x, y), lo];
        if (prev && cur && (Math.abs(prev[2] - prev[3]) > 5 || Math.abs(cur[2] - cur[3]) > 5)) {
          const n0 = next;
          extra.push(prev[0], prev[1], prev[2], cur[0], cur[1], cur[2], cur[0], cur[1], cur[3], prev[0], prev[1], prev[3]);
          extra.push(prev[0], prev[1], prev[2], cur[0], cur[1], cur[2], cur[0], cur[1], cur[3], prev[0], prev[1], prev[3]);
          next += 8;
          out.push(n0, n0 + 1, n0 + 2, n0, n0 + 2, n0 + 3);
          out.push(n0 + 4, n0 + 6, n0 + 5, n0 + 4, n0 + 7, n0 + 6);
        }
        prev = cur;
      }
    }
  }
  const positions = new Float32Array(P.length + extra.length);
  positions.set(P);
  positions.set(extra, P.length);
  return { positions, indices: Uint32Array.from(out) };
}

/** Bitens tyngdpunkt (hörnens medelvärde, räcker för att se vilken sida en konvex bit ligger på). */
function centroid(pc: readonly Vert[]): [number, number] {
  let x = 0;
  let y = 0;
  for (const v of pc) {
    x += v.x / pc.length;
    y += v.y / pc.length;
  }
  return [x, y];
}

/** Om punkten ligger inne i triangeln, mer än en halv millimeter från kanterna. */
function strictlyInside(p: Vec2, t: readonly Vert[]): boolean {
  let pos = 0;
  let neg = 0;
  for (let i = 0; i < 3; i++) {
    const a = t[i];
    const b = t[(i + 1) % 3];
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const d = ((b.x - a.x) * (p[1] - a.y) - (b.y - a.y) * (p[0] - a.x)) / l;
    if (d > 0.5) pos++;
    else if (d < -0.5) neg++;
  }
  return pos === 3 || neg === 3;
}

/** Om sträckan a–b når triangeln: en ände inuti, eller den korsar en av kanterna. */
function segmentMeetsTriangle(a: Vec2, b: Vec2, t: readonly Vert[]): boolean {
  const side = (p: Vec2, q: { x: number; y: number }, r: { x: number; y: number }) => (r.x - q.x) * (p[1] - q.y) - (r.y - q.y) * (p[0] - q.x);
  const inside = (p: Vec2) => {
    const s0 = side(p, t[0], t[1]);
    const s1 = side(p, t[1], t[2]);
    const s2 = side(p, t[2], t[0]);
    return (s0 >= 0 && s1 >= 0 && s2 >= 0) || (s0 <= 0 && s1 <= 0 && s2 <= 0);
  };
  if (inside(a) || inside(b)) return true;
  for (let i = 0; i < 3; i++) {
    const q = t[i];
    const r = t[(i + 1) % 3];
    const d1 = side(a, q, r);
    const d2 = side(b, q, r);
    if ((d1 > 0 && d2 > 0) || (d1 < 0 && d2 < 0)) continue;
    const d3 = (b[0] - a[0]) * (q.y - a[1]) - (b[1] - a[1]) * (q.x - a[0]);
    const d4 = (b[0] - a[0]) * (r.y - a[1]) - (b[1] - a[1]) * (r.x - a[0]);
    if ((d3 > 0 && d4 > 0) || (d3 < 0 && d4 < 0)) continue;
    return true;
  }
  return false;
}

/**
 * En konvex bit delad av linjen genom a och b, i en eller två bitar. De nya
 * punkterna får höjden NaN (sätts efter vilken sida biten ligger på).
 */
function splitConvex(pc: Vert[], a: Vec2, b: Vec2): Vert[][] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  // Avståndet till linjen, mm, med en tiondels millimeter som noll.
  const sd = pc.map((v) => {
    const d = (dx * (v.y - a[1]) - dy * (v.x - a[0])) / l;
    return Math.abs(d) < 0.1 ? 0 : d;
  });
  if (sd.every((d) => d >= 0) || sd.every((d) => d <= 0)) return [pc];
  const left: Vert[] = [];
  const right: Vert[] = [];
  for (let i = 0; i < pc.length; i++) {
    const v = pc[i];
    const w = pc[(i + 1) % pc.length];
    const di = sd[i];
    const dj = sd[(i + 1) % pc.length];
    if (di >= 0) left.push(v);
    if (di <= 0) right.push(v);
    if ((di > 0 && dj < 0) || (di < 0 && dj > 0)) {
      const f = di / (di - dj);
      const q: Vert = { x: v.x + (w.x - v.x) * f, y: v.y + (w.y - v.y) * f, z: NaN };
      left.push(q);
      right.push({ ...q });
    }
  }
  return [left, right].filter((p) => p.length >= 3);
}

/** Planet genom en triangels tre hörn, som en funktion av läget. */
function planeOf(t: readonly Vert[]): (x: number, y: number) => number {
  const [a, b, c] = t;
  const d = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
  if (Math.abs(d) < 1e-9) return () => a.z;
  const fx = ((b.z - a.z) * (c.y - a.y) - (c.z - a.z) * (b.y - a.y)) / d;
  const fy = ((c.z - a.z) * (b.x - a.x) - (b.z - a.z) * (c.x - a.x)) / d;
  return (x, y) => a.z + fx * (x - a.x) + fy * (y - a.y);
}
