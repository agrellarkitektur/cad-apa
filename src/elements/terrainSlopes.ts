import { withHeights } from '../core/ground';
import { contours, groundAt, heightAtZone, localToZone, type Terrain } from '../core/site';
import type { Primitive, Vec2 } from '../repr/primitives';

/**
 * Branta slänter i den befintliga marken (0.10.20): där marken lutar
 * brantare än ett gränsvärde (1:N, förval 1:3 under Platsen) ritas
 * släntstreck som för markobjekten, från krönet ned mot foten, långa och
 * korta om vartannat. Tänds per vy under Visa.
 *
 * Gränsen mellan brant och flack mark räknas som en höjdkurva i lutningens
 * fält (marching squares på nivån där lutningen är gränsvärdet). Längs den
 * gränsen börjar ett streck där marken faller in i det branta (krönet) och
 * går nedför tills lutningen blir flackare igen.
 */

/** Strecken ligger som markobjektens (`markSpacing` under Platsen, 0.10.21.1), mm på papperet. */
const DEFAULT_SPACING = 5;
/** Hur långt ett streck högst går, mm. */
const MARK_REACH = 20_000;

/** Lutningen (m/m) i varje nod, central differens; NaN där höjd saknas. */
export function slopeField(t: Pick<Terrain, 'grid' | 'z'>): Float32Array {
  const { W, H, s } = t.grid;
  const z = t.z;
  const out = new Float32Array(W * H);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const n = j * W + i;
      const h = z[n];
      if (h !== h) {
        out[n] = NaN;
        continue;
      }
      const l = i > 0 && z[n - 1] === z[n - 1] ? z[n - 1] : h;
      const r = i < W - 1 && z[n + 1] === z[n + 1] ? z[n + 1] : h;
      const u = j > 0 && z[n - W] === z[n - W] ? z[n - W] : h;
      const d = j < H - 1 && z[n + W] === z[n + W] ? z[n + W] : h;
      const dx = (r - l) / (s * ((i > 0 ? 1 : 0) + (i < W - 1 ? 1 : 0) || 1));
      const dy = (u - d) / (s * ((j > 0 ? 1 : 0) + (j < H - 1 ? 1 : 0) || 1));
      out[n] = Math.hypot(dx, dy);
    }
  }
  return out;
}

export interface SteepMark {
  /** Strecket från krönet till foten, längs fallinjen, mm i modellen. */
  pts: Vec2[];
  length: number;
}

const saved = new WeakMap<Float32Array, { key: string; out: SteepMark[] }>();

/**
 * Strecken för de branta slänterna, hela längden från krönet till foten;
 * räknas en gång per markmodell, gränsvärde och skala. `ratio` är N i 1:N.
 */
export function steepMarks(t: Terrain, ratio: number, scale: number, markSpacing = DEFAULT_SPACING): SteepMark[] {
  const { grid, site } = t;
  const key = `${grid.x0}|${grid.y1}|${grid.s}|${grid.W}|${grid.H}|${site.origin}|${site.rotation}|${ratio}|${scale}|${markSpacing}`;
  const hit = saved.get(t.z);
  if (hit && hit.key === key) return hit.out;
  const out = computeMarks(t, ratio, scale, markSpacing);
  saved.set(t.z, { key, out });
  return out;
}

function computeMarks(t: Terrain, ratio: number, scale: number, markSpacing: number): SteepMark[] {
  const limit = 1 / Math.max(0.1, ratio);
  const field = slopeField(t);
  // Gränsen som en kurva på nivån 0 i (lutning − gräns): ett enda steg, större än allt, så att bara nivån 0 räknas.
  const diff = new Float32Array(field.length);
  for (let i = 0; i < field.length; i++) diff[i] = field[i] - limit;
  const bounds = contours(withHeights(t, diff), 1e6);
  if (!bounds.length) return [];
  const { grid, site } = t;
  const slopeAt = (x: number, y: number): number | null => {
    const [X, Y] = localToZone(site, x, y);
    return heightAtZone({ grid, z: field }, X, Y);
  };
  const cell = grid.s * 1000;
  const probe = cell / 2;
  const step = Math.max(100, cell / 3);
  const spacing = markSpacing * scale;
  const out: SteepMark[] = [];
  const downhill = (x: number, y: number): Vec2 | null => {
    const l = groundAt(t, x - probe, y);
    const r = groundAt(t, x + probe, y);
    const d = groundAt(t, x, y - probe);
    const u = groundAt(t, x, y + probe);
    if (l === null || r === null || d === null || u === null) return null;
    const gx = (r - l) / (2 * probe);
    const gy = (u - d) / (2 * probe);
    const g = Math.hypot(gx, gy);
    return g > 1e-9 ? [-gx / g, -gy / g] : null;
  };
  for (const c of bounds) {
    const pts = c.pts;
    const n = pts.length;
    const segs = c.closed ? n : n - 1;
    let carry = spacing / 2;
    for (let k = 0; k < segs; k++) {
      const p = pts[k];
      const q = pts[(k + 1) % n];
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      let s = carry;
      while (s < len) {
        const x = p[0] + ((q[0] - p[0]) * s) / len;
        const y = p[1] + ((q[1] - p[1]) * s) / len;
        s += spacing;
        const dir = downhill(x, y);
        if (!dir) continue;
        // Krönet: nedför går in i det branta.
        const inside = slopeAt(x + dir[0] * step, y + dir[1] * step);
        if (inside === null || inside < limit) continue;
        // Strecket följer fallinjen nedför tills marken blir flackare.
        const pts: Vec2[] = [[x, y]];
        let cur: Vec2 = [x, y];
        let d = 0;
        while (d < MARK_REACH) {
          const dn = downhill(cur[0], cur[1]);
          if (!dn) break;
          const next: Vec2 = [cur[0] + dn[0] * step, cur[1] + dn[1] * step];
          const sl = slopeAt(next[0], next[1]);
          if (sl === null || sl < limit) break;
          pts.push(next);
          cur = next;
          d += step;
        }
        if (pts.length >= 2) out.push({ pts, length: d });
      }
      carry = s - len;
    }
  }
  return out;
}

/**
 * Strecken som primitiver: långa och korta om vartannat, från krönet.
 * `skip` tar bort streck som börjar där markobjekten ändrat marken.
 */
export function steepSlopePrims(t: Terrain, ratio: number, scale: number, origin: Primitive['origin'], skip?: (x: number, y: number) => boolean, markSpacing = DEFAULT_SPACING): Primitive[] {
  const pen = { weight: 0.13, color: 'muted' as const };
  const minLen = 0.8 * scale;
  const out: Primitive[] = [];
  let k = 0;
  for (const m of steepMarks(t, ratio, scale, markSpacing)) {
    const a = m.pts[0];
    if (skip?.(a[0], a[1])) continue;
    k++;
    if (m.length < minLen) continue;
    const want = m.length * (k % 2 === 1 ? 1 : 0.4);
    // Så många bitar som ryms i längden, och sista biten kortad.
    const pts: Vec2[] = [a];
    let d = 0;
    for (let i = 1; i < m.pts.length; i++) {
      const p = m.pts[i - 1];
      const q = m.pts[i];
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d + l >= want) {
        const f = l > 0 ? (want - d) / l : 0;
        pts.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]);
        break;
      }
      pts.push(q);
      d += l;
    }
    if (pts.length >= 2) out.push({ kind: 'polyline', points: pts, closed: false, pen, origin, noPick: true });
  }
  return out;
}
