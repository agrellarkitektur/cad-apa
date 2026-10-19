import polygonClipping, { type MultiPolygon, type Polygon, type Ring } from 'polygon-clipping';
import type { Vec2 } from '../repr/primitives';

/**
 * Booleska operationer på polygoner (union och differens), via biblioteket
 * polygon-clipping. Resultatet är en lista polygoner där varje polygon är
 * en lista ringar: först ytterkonturen, sedan eventuella hål.
 */
export type Rings = Vec2[][];

export function union(polys: Rings[]): Rings[] {
  const valid = polys.filter((p) => p.length && p[0].length >= 3);
  if (valid.length === 0) return [];
  if (valid.length === 1) return [valid[0]];
  const [first, ...rest] = valid.map(toPoly);
  return fromMulti(polygonClipping.union(first, ...rest));
}

/** Omskrivande rektangel för en polygon: [minX, minY, maxX, maxY]. */
export type Box = [number, number, number, number];

export function boxOf(poly: Rings): Box {
  const b: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const ring of poly) {
    for (const [x, y] of ring) {
      if (x < b[0]) b[0] = x;
      if (y < b[1]) b[1] = y;
      if (x > b[2]) b[2] = x;
      if (y > b[3]) b[3] = y;
    }
  }
  return b;
}

/** Om två rektanglar överlappar eller ligger närmare än `tol` (mm). */
export function boxesTouch(a: Box, b: Box, tol = 1): boolean {
  return a[0] <= b[2] + tol && b[0] <= a[2] + tol && a[1] <= b[3] + tol && b[1] <= a[3] + tol;
}

export function difference(subject: Rings, cutters: Rings[]): Rings[] {
  const valid = cutters.filter((p) => p.length && p[0].length >= 3);
  if (valid.length === 0) return [subject];
  return fromMulti(polygonClipping.difference(toPoly(subject), ...valid.map(toPoly)));
}

export function intersection(subject: Rings, clips: Rings[]): Rings[] {
  const valid = clips.filter((p) => p.length && p[0].length >= 3);
  if (valid.length === 0) return [];
  return fromMulti(polygonClipping.intersection(toPoly(subject), ...valid.map(toPoly)));
}

function toPoly(rings: Rings): Polygon {
  return rings.map((r) => r.map((p) => [p[0], p[1]] as [number, number]) as Ring);
}

function fromMulti(m: MultiPolygon): Rings[] {
  // polygon-clipping upprepar första punkten sist i varje ring; den tas bort.
  return m.map((poly) => poly.map((ring) => ring.slice(0, -1).map((p) => [p[0], p[1]] as Vec2)));
}
