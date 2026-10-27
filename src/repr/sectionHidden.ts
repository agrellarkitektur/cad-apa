import type { ProjectDoc } from '../core/model';
import { difference, union, type Rings } from '../geometry/boolean';
import { distToSegment } from '../geometry/vec';
import type { Vec2 } from './primitives';
import { zOn, type Shape3D, type Solid } from './solids';

/**
 * Dolda linjer i fasader (0.10.10): bjälklagen och ytterväggarnas insida
 * streckade genom fasaden. Här finns ytterväggarnas insida som lodräta
 * kanter i 3D och sammanslagningen av linjer som ligger på varandra.
 */

/** Visa-nycklarna (tänds med plus i vyns `hide`). */
export const HIDDEN_SLABS = 'hiddenSlabs';
export const HIDDEN_WALLS = 'hiddenWalls';
/** Bjälklag bakom snittet streckade i sektioner (0.10.12): på från början, släcks med nyckeln utan plus. */
export const HIDDEN_SLABS_SECTION = 'hiddenSlabsSection';

type Seg3 = [x1: number, y1: number, z1: number, x2: number, y2: number, z2: number];

const isWall = (s: Shape3D): s is Solid => s.kind !== 'edges' && (s.material === 'wall' || s.material === 'wall-new');

function distToRing(q: Vec2, ring: readonly Vec2[]): number {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) best = Math.min(best, distToSegment(q, ring[i], ring[(i + 1) % ring.length]));
  return best;
}

/**
 * Ytterväggarnas insida: en lodrät kant i varje hörn av det som ligger
 * innanför ytterväggarna, per våning. Ytterväggarna är de som når husets
 * utsida; innerväggarna räknas inte, så att kanterna följer ytterväggarnas
 * insida också där en innervägg möter den.
 */
export function innerFaceEdges(doc: ProjectDoc, shapes: readonly { s: Shape3D; demolished: boolean }[]): { id: string; seg: Seg3 }[] {
  const byStorey = new Map<string, Solid[]>();
  for (const { s, demolished } of shapes) {
    if (demolished || !isWall(s)) continue;
    const storey = doc.elements[s.id]?.storey ?? '';
    const list = byStorey.get(storey) ?? [];
    list.push(s);
    byStorey.set(storey, list);
  }
  const out: { id: string; seg: Seg3 }[] = [];
  const turn = Math.sin((5 * Math.PI) / 180);
  for (const walls of byStorey.values()) {
    for (const poly of union(walls.map((w) => w.rings as Rings))) {
      const outer = poly[0];
      const ext = walls.filter((w) => w.rings[0].some((q) => distToRing(q, outer) < 1));
      if (!ext.length) continue;
      const inside = difference([outer], union(ext.map((w) => w.rings as Rings)));
      for (const piece of inside) {
        const ring = piece[0];
        const n = ring.length;
        for (let i = 0; i < n; i++) {
          const a = ring[(i - 1 + n) % n];
          const q = ring[i];
          const b = ring[(i + 1) % n];
          const d1: Vec2 = [q[0] - a[0], q[1] - a[1]];
          const d2: Vec2 = [b[0] - q[0], b[1] - q[1]];
          const l1 = Math.hypot(d1[0], d1[1]);
          const l2 = Math.hypot(d2[0], d2[1]);
          // Bara riktiga hörn, och inte där insidan når utsidan (en lucka mellan väggarna).
          if (l1 < 1 || l2 < 1 || Math.abs(d1[0] * d2[1] - d1[1] * d2[0]) < turn * l1 * l2) continue;
          if (distToRing(q, outer) < 1) continue;
          let z0 = Infinity;
          let z1 = -Infinity;
          let id = '';
          for (const w of ext) {
            if (!w.rings[0].some((p, k, r) => distToSegment(q, p, r[(k + 1) % r.length]) < 2)) continue;
            z0 = Math.min(z0, w.bottom ? zOn(w.bottom, q[0], q[1]) : w.z0);
            z1 = Math.max(z1, w.top ? zOn(w.top, q[0], q[1]) : w.z1);
            id ||= w.id;
          }
          if (z1 - z0 > 1) out.push({ id, seg: [q[0], q[1], z0, q[0], q[1], z1] });
        }
      }
    }
  }
  return out;
}

/**
 * Linjer som ligger på varandra slås ihop till en (bjälklagets fram- och
 * bakkant syns på samma ställe), så att streckningen inte ritas två gånger
 * förskjuten och ser heldragen ut.
 */
export function mergeCollinear<K>(lines: readonly { a: readonly [number, number]; b: readonly [number, number]; key: K }[], groupOf: (key: K) => string = () => ''): { a: Vec2; b: Vec2; key: K }[] {
  const groups = new Map<string, { d: Vec2; o: Vec2; key: K; iv: [number, number][] }>();
  for (const l of lines) {
    let dx = l.b[0] - l.a[0];
    let dy = l.b[1] - l.a[1];
    const len = Math.hypot(dx, dy);
    if (len < 0.5) continue;
    dx /= len;
    dy /= len;
    // Samma riktning åt ett håll.
    if (dx < -1e-9 || (Math.abs(dx) <= 1e-9 && dy < 0)) {
      dx = -dx;
      dy = -dy;
    }
    const off = l.a[0] * -dy + l.a[1] * dx;
    const k = `${groupOf(l.key)}|${Math.round((Math.atan2(dy, dx) * 1800) / Math.PI)}|${Math.round(off)}`;
    let g = groups.get(k);
    if (!g) groups.set(k, (g = { d: [dx, dy], o: [-dy * off, dx * off], key: l.key, iv: [] }));
    const t0 = (l.a[0] - g.o[0]) * g.d[0] + (l.a[1] - g.o[1]) * g.d[1];
    const t1 = (l.b[0] - g.o[0]) * g.d[0] + (l.b[1] - g.o[1]) * g.d[1];
    g.iv.push([Math.min(t0, t1), Math.max(t0, t1)]);
  }
  const out: { a: Vec2; b: Vec2; key: K }[] = [];
  for (const g of groups.values()) {
    g.iv.sort((p, q) => p[0] - q[0]);
    let cur: [number, number] | null = null;
    const flush = () => {
      if (cur && cur[1] - cur[0] > 0.5) out.push({ a: [g.o[0] + g.d[0] * cur[0], g.o[1] + g.d[1] * cur[0]], b: [g.o[0] + g.d[0] * cur[1], g.o[1] + g.d[1] * cur[1]], key: g.key });
    };
    for (const iv of g.iv) {
      if (cur && iv[0] <= cur[1] + 1) cur[1] = Math.max(cur[1], iv[1]);
      else {
        flush();
        cur = [iv[0], iv[1]];
      }
    }
    flush();
  }
  return out;
}
