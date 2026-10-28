import { difference, intersection, type Rings } from '../geometry/boolean';
import type { Vec2 } from './primitives';
import { zOn, type Plane, type Shear, type Solid } from './solids';

/**
 * Formens snitt med det lodräta planet genom linjen, i vyns koordinater
 * (x längs linjen, y = höjd). Formen är en lodrät extrudering, så snittet
 * är för varje bit av linjen inne i formen en fyrhörning mellan under- och
 * ovansidan, minus de urtag (öppningar) som linjen går igenom. Linjen går
 * från O i riktningen r och ser åt v; bara `0 ≤ u ≤ uMax` tas med.
 */
export function cutSolid(s: Solid, O: Vec2, r: Vec2, v: Vec2, uMax = Infinity): Rings[] {
  if (s.shear && (s.shear[0] || s.shear[1])) return cutSheared(s, s.shear, O, r, v, uMax);
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

const BIG = 1e7;

/** Det i (u, z)-planet som uppfyller α·u + β·z + γ ≥ 0, som en stor fyrhörning. */
function halfPlane(alpha: number, beta: number, gamma: number): Rings {
  const g = Math.hypot(alpha, beta);
  const nx = alpha / g;
  const ny = beta / g;
  // En punkt på linjen, och sidan där uttrycket är positivt.
  const px = (-gamma / g) * nx;
  const py = (-gamma / g) * ny;
  const tx = -ny;
  const ty = nx;
  return [
    [
      [px - tx * BIG, py - ty * BIG],
      [px + tx * BIG, py + ty * BIG],
      [px + tx * BIG + nx * BIG, py + ty * BIG + ny * BIG],
      [px - tx * BIG + nx * BIG, py - ty * BIG + ny * BIG],
    ],
  ];
}

/**
 * Snittet av en lutande kropp (0.10.21). Punkten (u, z) i snittplanet
 * ligger i kroppen när den oförskjutna punkten Q = O + r·u − shear·(z − z0)
 * ligger i konturen: Q är en affin avbildning av (u, z), så snittet är
 * konturen avbildad baklänges, klippt mellan under- och ovansidan (som blir
 * halvplan i u och z, också när de är sneda plan). Lutar kroppen längs
 * linjen är avbildningen platt; då förskjuts intervallen längs linjen med
 * höjden i stället.
 */
function cutSheared(s: Solid, shear: Shear, O: Vec2, r: Vec2, v: Vec2, uMax: number): Rings[] {
  const z0 = s.z0;
  const uTop = Number.isFinite(uMax) ? uMax : BIG;
  const det = shear[0] * r[1] - shear[1] * r[0];
  // Ovansidan z ≤ zOn(top, Q) och undersidan z ≥ zOn(bottom, Q), linjärt i (u, z).
  const planeClip = (pl: Plane, above: boolean): Rings => {
    const k = pl[0] * shear[0] + pl[1] * shear[1];
    const cu = pl[0] * r[0] + pl[1] * r[1];
    const c0 = pl[0] * O[0] + pl[1] * O[1] + pl[2] + k * z0;
    // z(1 + k) ≤ c0 + cu·u  ⇔  cu·u − (1 + k)·z + c0 ≥ 0
    return above ? halfPlane(cu, -(1 + k), c0) : halfPlane(-cu, 1 + k, -c0);
  };
  const zClip = (rings: Rings, lo: number, hi: number, top?: Plane, bottom?: Plane): Rings[] => {
    let out: Rings[] = intersection(rings, [[[[0, lo], [uTop, lo], [uTop, hi], [0, hi]]]]);
    if (top) out = out.flatMap((q) => intersection(q, [planeClip(top, true)]));
    if (bottom) out = out.flatMap((q) => intersection(q, [planeClip(bottom, false)]));
    return out;
  };
  let toUZ: (rings: readonly (readonly Vec2[])[]) => Rings;
  if (Math.abs(det) > 1e-9) {
    // (u, z) ur Q: lös r·u − shear·(z − z0) = Q − O.
    toUZ = (rings) =>
      rings.map((ring) =>
        ring.map((p): Vec2 => {
          const dx = p[0] - O[0];
          const dy = p[1] - O[1];
          const u = (-shear[1] * dx + shear[0] * dy) / det;
          const dz = (-r[1] * dx + r[0] * dy) / det;
          return [u, z0 + dz];
        }),
      );
  } else {
    // Lutningen ligger längs linjen: intervallen vid z0 förskjuts k per mm höjd.
    const k = shear[0] * r[0] + shear[1] * r[1];
    const H = BIG;
    toUZ = (rings) => intervalsOnLine(rings, O, r, v).map(([a, b]) => [[a - k * H, z0 - H], [b - k * H, z0 - H], [b + k * H, z0 + H], [a + k * H, z0 + H]] as Vec2[]);
  }
  const body = zClip(toUZ(s.rings), s.z0, s.z1, s.top, s.bottom);
  if (!body.length) return [];
  const holes = (s.cuts ?? []).flatMap((c) => zClip(toUZ(c.rings), c.z0, c.z1));
  return holes.length ? body.flatMap((q) => difference(q, holes)) : body;
}
