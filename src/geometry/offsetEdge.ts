import type { Vec2 } from '../repr/primitives';
import { signedArea } from './chains';

type P = Vec2;

/**
 * Förskjut en kant i en sluten polygon (0.7.1). Konturerna (takfall,
 * bjälklag, markyta) ändras sedan 0.10.24 helt som 2D-former
 * (`src/elements/shapeEdit.ts`); det här är den raka kantens förskjutning
 * som `offsetShapeEdge` använder (flyttad hit ur `core/roofEdit.ts` i
 * granskningen efter 0.10.25). Kant i går från hörn i till hörn i + 1.
 */

/**
 * Kant i förskjuten d mm åt vänster sett längs kanten (utåt för en kontur
 * som går moturs). Grannkanterna förlängs eller kortas så att hörnen följer
 * med längs dem. Null om kanten skulle vända sig eller grannarna är
 * parallella med den.
 */
export function offsetEdge(outline: readonly P[], i: number, d: number): P[] | null {
  const n = outline.length;
  const a = outline[i];
  const b = outline[(i + 1) % n];
  const prev = outline[(i - 1 + n) % n];
  const next = outline[(i + 2) % n];
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const len = Math.hypot(ux, uy);
  if (len < 1) return null;
  const nx = -uy / len;
  const ny = ux / len;
  const a2: P = [a[0] + nx * d, a[1] + ny * d];
  // Skär den förskjutna kanten med grannkanternas linjer.
  const hit = (p: P, q: P): P | null => {
    const rx = q[0] - p[0];
    const ry = q[1] - p[1];
    const den = ux * ry - uy * rx;
    if (Math.abs(den) < 1e-9 * len * Math.hypot(rx, ry)) return null;
    const t = ((p[0] - a2[0]) * ry - (p[1] - a2[1]) * rx) / den;
    return [a2[0] + ux * t, a2[1] + uy * t];
  };
  const na = hit(prev, a);
  const nb = hit(b, next);
  if (!na || !nb) return null;
  // Kanten får inte vända riktning.
  if ((nb[0] - na[0]) * ux + (nb[1] - na[1]) * uy <= 1) return null;
  const out = outline.map((q) => [q[0], q[1]] as P);
  out[i] = [Math.round(na[0]), Math.round(na[1])];
  out[(i + 1) % n] = [Math.round(nb[0]), Math.round(nb[1])];
  // Konturen får inte klappa ihop eller vända sig ut och in.
  if (signedArea(out) * signedArea(outline) <= 0 || Math.abs(signedArea(out)) < 1e4) return null;
  return out;
}
