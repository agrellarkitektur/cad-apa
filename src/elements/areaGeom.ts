import { difference, intersection, union, type Rings } from '../geometry/boolean';
import { offsetRing, signedArea } from '../geometry/chains';
import { bufferRings } from '../geometry/offset';

/**
 * Ytoperationerna som areorna (0.12.3–0.12.4) delar: `areaCalc.ts`,
 * snedtaket i `areaHeight.ts` och 6-meterszonen i `areaGround.ts`.
 */

/**
 * En yta klippt till flera polygoner: delarna i var och en (`intersection`
 * med flera ytor ger det som ligger i alla, inte i någon).
 */
export const clipTo = (s: Rings, polys: readonly Rings[]): Rings[] => polys.flatMap((p) => intersection(s, [p]));

/** Ytorna klippta till en sammanslagen yta. */
export const clipAll = (polys: readonly Rings[], to: readonly Rings[]): Rings[] => (to.length ? polys.flatMap((p) => clipTo(p, to)) : []);

export const minus = (polys: readonly Rings[], cut: readonly Rings[]): Rings[] => (cut.length ? polys.flatMap((p) => difference(p, cut as Rings[])) : [...polys]);

/** Ytor utvidgade `d` mm med raka (gerade) hörn, och rundade där geringen inte räcker. */
export function grownSquare(polys: readonly Rings[], d: number): Rings[] {
  if (!polys.length) return [];
  const miter = polys.map((p): Rings => {
    const ring = signedArea(p[0]) > 0 ? [...p[0]].reverse() : p[0];
    return [offsetRing(ring, d)];
  });
  return union([...bufferRings(polys, d, 16), ...miter]);
}

/** Bort med smulor: delar under en kvadratcentimeter. */
export const solid = (polys: readonly Rings[]): Rings[] => polys.filter((poly) => poly.length && poly[0].length >= 3 && Math.abs(signedArea(poly[0])) > 100);
