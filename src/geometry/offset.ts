import type { Vec2 } from '../repr/primitives';
import { union, type Rings } from './boolean';

/**
 * Ytor utvidgade med ett avstånd (0.10.4): platån runt huset och
 * urgrävningen under bjälklaget. Ytan, en rektangel längs varje kant och en
 * cirkel (16 hörn) i varje hörn, sammanslagna. Hörnen blir därför rundade,
 * som när man går ett jämnt avstånd runt huset.
 */
export function bufferRings(polys: readonly Rings[], d: number, segments = 16): Rings[] {
  const valid = polys.filter((p) => p.length && p[0].length >= 3);
  if (!(d > 0)) return valid.map((p) => p.map((r) => r.map((q): Vec2 => [q[0], q[1]])));
  const parts: Rings[] = valid.map((p) => [p[0].map((q): Vec2 => [q[0], q[1]])]);
  for (const poly of valid) {
    for (const ring of poly) {
      const n = ring.length;
      for (let i = 0; i < n; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % n];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (l > 1e-6) {
          const nx = (-(b[1] - a[1]) / l) * d;
          const ny = ((b[0] - a[0]) / l) * d;
          parts.push([
            [
              [a[0] - nx, a[1] - ny],
              [b[0] - nx, b[1] - ny],
              [b[0] + nx, b[1] + ny],
              [a[0] + nx, a[1] + ny],
            ],
          ]);
        }
        parts.push([Array.from({ length: segments }, (_, k): Vec2 => [a[0] + d * Math.cos((k / segments) * 2 * Math.PI), a[1] + d * Math.sin((k / segments) * 2 * Math.PI)])]);
      }
    }
  }
  // Hela mm, så att hörn som ska sammanfalla gör det exakt (polygon-clipping
  // klarar inte punkter som skiljer sig på avrundningen).
  for (const grid of [1, 5, 20]) {
    try {
      return union(parts.map((poly) => poly.map((r) => r.map((q): Vec2 => [Math.round(q[0] / grid) * grid, Math.round(q[1] / grid) * grid]))));
    } catch {
      // Gick det inte: grövre avrundning.
    }
  }
  return valid.map((p) => [p[0].map((q): Vec2 => [q[0], q[1]])]);
}
