import type { StairParams } from './stairGeometry';

/**
 * Spiraltrappan (0.11.5): måtten, förvalen och referenslinjen som en båge.
 * Delat ur stairGeometry.ts i granskningen efter 0.11.8.
 */

/** Den fria höjden under spiraltrappans nästa varv som varningen räknar med (0.11.7.2). */
export const SPIRAL_HEADROOM = 2000;
/** Spiraltrappans förval (0.11.5): diametrarna och graderna. */
export const SPIRAL = { inner: 200, outer: 1800, sweep: 360 };

/** Spiraltrappans mått, rimliga: ytterdiametern minst 600, innerdiametern mindre, graderna 30–1 080. */
export function spiralDims(s: NonNullable<StairParams['spiral']>): { inner: number; outer: number; sweep: number; ccw: boolean } {
  const outer = Math.max(600, Number(s.outer) || SPIRAL.outer);
  const inner = Math.max(0, Math.min(outer - 300, Number(s.inner) || 0));
  const sweep = Math.max(30, Math.min(1080, Math.abs(Number(s.sweep) || SPIRAL.sweep)));
  return { inner, outer, sweep, ccw: s.dir !== 'cw' };
}

/**
 * Spiraltrappans referenslinje (0.11.5): en båge med radien mitt emellan
 * inner- och ytterradien, i bitar om högst 90°, från riktningen mot
 * `line[1]` och `sweep` grader i varvriktningen. Bredden blir skillnaden
 * mellan radierna och referenslinjen ligger i mitten. Andra trappor
 * svarar med sig själva.
 */
export function spiralLine(p: StairParams): StairParams {
  const line = p.line ?? [];
  if (!p.spiral || line.length < 2) return p;
  const d = spiralDims(p.spiral);
  const c = line[0];
  const a0 = Math.atan2(line[1][1] - c[1], line[1][0] - c[0]) || 0;
  const r = (d.inner + d.outer) / 4;
  const m = Math.max(1, Math.ceil(d.sweep / 90 - 1e-9));
  const step = ((d.sweep / m) * Math.PI) / 180;
  const s = d.ccw ? 1 : -1;
  const pts: [number, number][] = [];
  for (let k = 0; k <= m; k++) pts.push([c[0] + r * Math.cos(a0 + s * k * step), c[1] + r * Math.sin(a0 + s * k * step)]);
  // Pilhöjden är positiv när bågen buktar åt vänster om kordan, alltså medurs.
  const bulge = -s * r * (1 - Math.cos(step / 2));
  return { ...p, line: pts, bulges: pts.slice(1).map(() => bulge), width: (d.outer - d.inner) / 2, refSide: 'center', landings: undefined, turnLandings: undefined };
}
