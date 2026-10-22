import type { Bounds, Vec2 } from '../../repr/primitives';

/**
 * Geometrin för att flytta vyer och dra i deras ram på ett blad (0.8.7,
 * 0.8.9): greppen, fästning mot andra kanter och var en ny vy får plats. Allt
 * i mm på papperet, utan något från appen, så att det går att pröva för sig.
 */

/** Ett grepp i en vys ram: vilka kanter det flyttar (0.8.7). */
export type Grip = { x: -1 | 0 | 1; y: -1 | 0 | 1 };
export const GRIPS: Grip[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
];
export const gripCursor = (g: Grip) => (g.x === 0 ? 'ns-resize' : g.y === 0 ? 'ew-resize' : g.x === g.y ? 'nesw-resize' : 'nwse-resize');
export const gripAt = (b: Bounds, g: Grip): Vec2 => [g.x < 0 ? b.minX : g.x > 0 ? b.maxX : (b.minX + b.maxX) / 2, g.y < 0 ? b.minY : g.y > 0 ? b.maxY : (b.minY + b.maxY) / 2];

/** Ramen med greppets kanter flyttade, aldrig mindre än 5 mm. */
export function resized(b: Bounds, g: Grip, d: Vec2): Bounds {
  const r = { ...b };
  const min = 5;
  if (g.x < 0) r.minX = Math.min(b.minX + d[0], b.maxX - min);
  if (g.x > 0) r.maxX = Math.max(b.maxX + d[0], b.minX + min);
  if (g.y < 0) r.minY = Math.min(b.minY + d[1], b.maxY - min);
  if (g.y > 0) r.maxY = Math.max(b.maxY + d[1], b.minY + min);
  return r;
}

const vertical = (x: number): [Vec2, Vec2] => [
  [x, -1e4],
  [x, 1e4],
];
const horizontal = (y: number): [Vec2, Vec2] => [
  [-1e4, y],
  [1e4, y],
];

/**
 * Fäst en flyttad yta `f` mot de andra ytornas kanter och mittlinjer och mot
 * ritningsramen, inom `tol` mm. Shift låser till den största riktningen.
 * Svarar med förflyttningen och stödlinjerna.
 */
export function snapMove(f: Bounds, d: Vec2, shift: boolean, others: readonly Bounds[], paper: Bounds | null, tol: number): { d: Vec2; guides: [Vec2, Vec2][] } {
  if (shift) d = Math.abs(d[0]) > Math.abs(d[1]) ? [d[0], 0] : [0, d[1]];
  const xs = (b: Bounds) => [b.minX, (b.minX + b.maxX) / 2, b.maxX];
  const ys = (b: Bounds) => [b.minY, (b.minY + b.maxY) / 2, b.maxY];
  const fx = paper ? [paper.minX, paper.maxX] : [];
  const fy = paper ? [paper.minY, paper.maxY] : [];
  const best = (mine: number[], theirs: number[]) => {
    let r: { off: number; at: number } | null = null;
    for (const m of mine) for (const t of theirs) if (Math.abs(t - m) < tol && (!r || Math.abs(t - m) < Math.abs(r.off))) r = { off: t - m, at: t };
    return r;
  };
  const moved: Bounds = { minX: f.minX + d[0], maxX: f.maxX + d[0], minY: f.minY + d[1], maxY: f.maxY + d[1] };
  const guides: [Vec2, Vec2][] = [];
  if (!shift || d[0] !== 0) {
    const sx = best(xs(moved), [...others.flatMap(xs), ...fx]);
    if (sx) {
      d = [d[0] + sx.off, d[1]];
      guides.push(vertical(sx.at));
    }
  }
  if (!shift || d[1] !== 0) {
    const sy = best(ys(moved), [...others.flatMap(ys), ...fy]);
    if (sy) {
      d = [d[0], d[1] + sy.off];
      guides.push(horizontal(sy.at));
    }
  }
  return { d, guides };
}

/** Fäst en dragen kant (x om `axis` är 0, annars y) mot de andra ytornas kanter och ritningsramen. */
export function snapEdge(value: number, axis: 0 | 1, others: readonly Bounds[], paper: Bounds | null, tol: number): { at: number; guide: [Vec2, Vec2] | null } {
  if (!paper) return { at: value, guide: null };
  const lines = axis === 0 ? [paper.minX, paper.maxX, ...others.flatMap((b) => [b.minX, b.maxX])] : [paper.minY, paper.maxY, ...others.flatMap((b) => [b.minY, b.maxY])];
  let best: number | null = null;
  for (const l of lines) if (Math.abs(l - value) < tol && (best === null || Math.abs(l - value) < Math.abs(best - value))) best = l;
  if (best === null) return { at: value, guide: null };
  return { at: best, guide: axis === 0 ? vertical(best) : horizontal(best) };
}

/**
 * Var en ny yta av storleken `size` får plats inom `area`: uppifrån till
 * vänster i steg om 5 mm, minst 6 mm från det som redan ligger där. Svarar
 * med ytans mitt, eller null om den inte får plats någonstans.
 */
export function freeSpot(area: Bounds, taken: readonly Bounds[], size: [number, number]): Vec2 | null {
  const [w, h] = size;
  const gap = 6;
  const free = (b: Bounds) => taken.every((t) => b.maxX + gap <= t.minX || b.minX >= t.maxX + gap || b.maxY + gap <= t.minY || b.minY >= t.maxY + gap);
  for (let y = area.maxY; y - h >= area.minY; y -= 5)
    for (let x = area.minX; x + w <= area.maxX; x += 5) {
      const b = { minX: x, maxX: x + w, minY: y - h, maxY: y };
      if (free(b)) return [x + w / 2, y - h / 2];
    }
  return null;
}
