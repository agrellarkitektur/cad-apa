import type { Vec2 } from '../repr/primitives';

/** Små, rena vektorfunktioner i 2D. Alla mått i mm. */

export const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
export const scale = (a: Vec2, k: number): Vec2 => [a[0] * k, a[1] * k];
export const dot = (a: Vec2, b: Vec2): number => a[0] * b[0] + a[1] * b[1];
export const cross = (a: Vec2, b: Vec2): number => a[0] * b[1] - a[1] * b[0];
export const len = (a: Vec2): number => Math.hypot(a[0], a[1]);
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const norm = (a: Vec2): Vec2 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
/** Vänsternormal: vrid 90° moturs. */
export const left = (a: Vec2): Vec2 => [-a[1], a[0]];
export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const near = (a: Vec2, b: Vec2, tol = 1): boolean => dist(a, b) <= tol;

/** Närmaste punkt på sträckan ab, och parametern t (0–1) längs den. */
export function closestOnSegment(p: Vec2, a: Vec2, b: Vec2): { point: Vec2; t: number } {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return { point: add(a, scale(ab, t)), t };
}

export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  return dist(p, closestOnSegment(p, a, b).point);
}

/** Skärningspunkt mellan två oändliga linjer (punkt + riktning). Null om de är parallella. */
export function intersectLines(p: Vec2, r: Vec2, q: Vec2, s: Vec2): Vec2 | null {
  const d = cross(r, s);
  if (Math.abs(d) < 1e-9) return null;
  const t = cross(sub(q, p), s) / d;
  return add(p, scale(r, t));
}

/** Punkt i polygon med jämn–udda-regeln, så att hål fungerar. */
export function pointInRings(p: Vec2, rings: readonly (readonly Vec2[])[]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Vinkel i grader för en riktning, 0–360. */
export function angleDeg(v: Vec2): number {
  const a = (Math.atan2(v[1], v[0]) * 180) / Math.PI;
  return (a + 360) % 360;
}

export function fromAngleDeg(deg: number): Vec2 {
  const r = (deg * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r)];
}
