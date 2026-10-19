import type { Vec2 } from '../repr/primitives';
import { cross, dist, dot, left, norm, sub } from './vec';

/**
 * Cirkelbågar mellan två punkter, angivna med pilhöjd (bulge): avståndet
 * från kordans mitt till bågens topp, i mm. Positiv pilhöjd buktar åt
 * vänster sett från start mot slut, negativ åt höger, 0 är rakt. Pilhöjden
 * kan vara större än halva kordan; bågen är då större än en halvcirkel.
 */
export interface Arc {
  center: Vec2;
  radius: number;
  /** 1 om bågen buktar åt vänster (går medurs runt centrum), -1 om åt höger. */
  sigma: 1 | -1;
  /** Vinkeln från centrum till startpunkten, radianer. */
  theta0: number;
  /** Bågens vinkel, alltid positiv, radianer. */
  sweep: number;
}

/** Under så här liten pilhöjd räknas en båge som rak (mm). */
export const STRAIGHT = 0.5;

export function arcFromBulge(start: Vec2, end: Vec2, bulge: number): Arc | null {
  const L = dist(start, end);
  if (Math.abs(bulge) < STRAIGHT || L < 1) return null;
  const u = norm(sub(end, start));
  const n = left(u);
  const h = L / 2;
  const s = bulge;
  const R = (h * h + s * s) / (2 * Math.abs(s));
  const sigma: 1 | -1 = s > 0 ? 1 : -1;
  const mid: Vec2 = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const k = s - sigma * R;
  const center: Vec2 = [mid[0] + n[0] * k, mid[1] + n[1] * k];
  const theta0 = Math.atan2(start[1] - center[1], start[0] - center[0]);
  const sweep = 4 * Math.atan(Math.abs(s) / h);
  return { center, radius: R, sigma, theta0, sweep };
}

/** Pilhöjden för bågen från start till slut som går genom punkten p. */
export function bulgeThrough(start: Vec2, end: Vec2, p: Vec2): number {
  const L = dist(start, end);
  if (L < 1) return 0;
  const u = norm(sub(end, start));
  const n = left(u);
  const mid: Vec2 = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const x = dot(sub(p, mid), u);
  const y = dot(sub(p, mid), n);
  if (Math.abs(y) < 1e-6) return 0;
  const h = L / 2;
  const yc = (x * x + y * y - h * h) / (2 * y);
  const R = Math.hypot(h, yc);
  return y > 0 ? yc + R : yc - R;
}

/** Pilhöjden för bågen från start till slut som börjar i riktningen t. */
export function bulgeTangent(start: Vec2, end: Vec2, t: Vec2): number {
  const c = sub(end, start);
  const L = Math.hypot(c[0], c[1]);
  if (L < 1) return 0;
  const phi = Math.atan2(cross(c, t), dot(c, t));
  // Nästan en hel cirkel blir orimligt stor; begränsa.
  const lim = Math.PI * 0.97;
  const p = Math.max(-lim, Math.min(lim, phi));
  return (L / 2) * Math.tan(p / 2);
}

/** Pilhöjden för en båge med radien r mellan två punkter (den mindre bågen). */
export function bulgeForRadius(start: Vec2, end: Vec2, r: number, side: 1 | -1): number {
  const h = dist(start, end) / 2;
  if (r <= h) return side * h;
  return side * (r - Math.sqrt(r * r - h * h));
}

/** Radien för en båge med en viss pilhöjd. */
export function radiusOf(start: Vec2, end: Vec2, bulge: number): number {
  const h = dist(start, end) / 2;
  return (h * h + bulge * bulge) / (2 * Math.abs(bulge) || 1);
}

/** Antal raka bitar en båge delas i för att ritas och räknas (högst 4° per bit). */
export function arcSegments(sweep: number, radius: number): number {
  const byAngle = Math.ceil(sweep / ((4 * Math.PI) / 180));
  // Mycket små bågar behöver inte så många bitar: högst 0,3 mm fel.
  const byError = Math.ceil(sweep / (2 * Math.acos(Math.max(-1, 1 - 0.3 / Math.max(radius, 1)))));
  return Math.max(2, Math.min(byAngle, Math.max(4, byError)));
}
