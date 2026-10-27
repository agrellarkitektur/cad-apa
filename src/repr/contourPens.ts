import type { PenDef, StyleSheet } from '../core/graphics';
import { defaultedPen } from './markerPens';
import type { Pen } from './primitives';

/**
 * Höjdkurvornas pennor (granskningen efter 0.10.18): tjocklek, färg och
 * linjetyp i stilmallen (`pens`, samma tabell som markörerna), för hela
 * projektet. Förvalen är de som gällt sedan 0.10.8: hela meter 0,25,
 * kurvorna däremellan 0,13 och den befintliga marken där markobjekten
 * ändrat den grå och streckad, 0,18 på hela meter. Höjden som skrivs ut
 * på hela meter har kurvans färg.
 */
export const CONTOUR_PENS = [
  { key: 'contour', label: 'Höjdkurvor, hela meter', hint: 'Med höjden utskriven', weight: 0.25 },
  { key: 'contourMinor', label: 'Höjdkurvor däremellan', hint: 'T.ex. var halvmeter, efter platsens avstånd', weight: 0.13 },
  { key: 'contourOld', label: 'Befintlig mark som ändrats', hint: 'Den gamla marken där markobjekten ändrat den; kurvorna mellan hela meter högst 0,13', weight: 0.18, color: 'muted', linetype: 'dashed' },
] as const;

export type ContourPenKey = (typeof CONTOUR_PENS)[number]['key'];

/** Förvalet för en höjdkurvas penna, eller undefined om nyckeln inte är en. */
export function defaultContourPen(key: string): PenDef | undefined {
  const d = CONTOUR_PENS.find((m) => m.key === key);
  if (!d) return undefined;
  return { weight: d.weight, ...('color' in d ? { color: d.color } : {}), ...('linetype' in d ? { linetype: d.linetype } : {}) };
}

/** Pennan för en sorts höjdkurva, ur stilmallen eller förvalet. */
export function contourPen(style: StyleSheet | undefined, key: ContourPenKey): Pen {
  return defaultedPen(style, key, defaultContourPen(key)!);
}
