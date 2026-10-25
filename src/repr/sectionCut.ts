import { difference, type Rings } from '../geometry/boolean';
import type { Vec2 } from './primitives';
import { zOn, type Solid } from './solids';

/**
 * Formens snitt med det lodräta planet genom linjen, i vyns koordinater
 * (x längs linjen, y = höjd). Formen är en lodrät extrudering, så snittet
 * är för varje bit av linjen inne i formen en fyrhörning mellan under- och
 * ovansidan, minus de urtag (öppningar) som linjen går igenom. Linjen går
 * från O i riktningen r och ser åt v; bara `0 ≤ u ≤ uMax` tas med.
 */
export function cutSolid(s: Solid, O: Vec2, r: Vec2, v: Vec2, uMax = Infinity): Rings[] {
  const inside = intervalsOnLine(s.rings, O, r, v)
    .map(([a, b]): [number, number] => [Math.max(0, a), Math.min(uMax, b)])
    .filter(([a, b]) => b > a);
  if (!inside.length) return [];
  const at = (u: number): Vec2 => [O[0] + r[0] * u, O[1] + r[1] * u];
  const zb = (u: number) => (s.bottom ? zOn(s.bottom, ...at(u)) : s.z0);
  const zt = (u: number) => (s.top ? zOn(s.top, ...at(u)) : s.z1);
  const out: Rings[] = [];
  for (const [u0, u1] of inside) {
    if (u1 - u0 < 0.5) continue;
    const quad: Rings = [
      [
        [u0, zb(u0)],
        [u1, zb(u1)],
        [u1, zt(u1)],
        [u0, zt(u0)],
      ],
    ];
    const holes: Rings[] = [];
    for (const c of s.cuts ?? []) {
      for (const [c0, c1] of intervalsOnLine(c.rings, O, r, v)) {
        const a = Math.max(c0, u0);
        const b = Math.min(c1, u1);
        if (b - a < 0.5) continue;
        holes.push([
          [
            [a, c.z0],
            [b, c.z0],
            [b, c.z1],
            [a, c.z1],
          ],
        ]);
      }
    }
    out.push(...(holes.length ? difference(quad, holes) : [quad]));
  }
  return out;
}

/** Var linjen O + r·u går inne i formen (jämn–udda), som intervall i u. */
function intervalsOnLine(rings: readonly (readonly Vec2[])[], O: Vec2, r: Vec2, v: Vec2): [number, number][] {
  const us: number[] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      const q = ring[(i + 1) % ring.length];
      const dp = (p[0] - O[0]) * v[0] + (p[1] - O[1]) * v[1];
      const dq = (q[0] - O[0]) * v[0] + (q[1] - O[1]) * v[1];
      if (dp > 0 === dq > 0) continue;
      const t = dp / (dp - dq);
      const up = (p[0] - O[0]) * r[0] + (p[1] - O[1]) * r[1];
      const uq = (q[0] - O[0]) * r[0] + (q[1] - O[1]) * r[1];
      us.push(up + (uq - up) * t);
    }
  }
  us.sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < us.length; i += 2) out.push([us[i], us[i + 1]]);
  return out;
}
