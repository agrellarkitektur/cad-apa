import type { PenDef, StyleSheet } from '../core/graphics';
import { defaultedPen } from './markerPens';
import type { Pen } from './primitives';

/**
 * Snittet i planen (0.10.16): det som ligger helt under planens snitthöjd
 * ritas som vy, det som ligger helt över (och sticker ut utanför det
 * snittade) streckprickat. Pennorna ställs in per objekttyp i stilmallen
 * (`pens`, samma tabell som markörerna); ett objekt eller en typ kan ha en
 * egen penna för det som ligger över (`OwnPen.above`).
 */
export type CutZone = 'cut' | 'above' | 'below';

export const PLAN_CUT_PENS = [
  { key: 'aboveWall', label: 'Väggar över snittet', hint: 'Väggar vars fot ligger över snitthöjden', weight: 0.18, linetype: 'dashdot' },
  { key: 'belowWall', label: 'Väggar under snittet', hint: 'Låga väggar, sedda uppifrån', weight: 0.18 },
  { key: 'aboveOpening', label: 'Dörrar och fönster över snittet', hint: 'Höga fönster; väggen går obruten förbi', weight: 0.13, linetype: 'dashdot' },
  { key: 'belowOpening', label: 'Dörrar och fönster under snittet', hint: 'Låga fönster, t.ex. källarfönster', weight: 0.13 },
  { key: 'aboveSlab', label: 'Bjälklag över snittet', hint: 'T.ex. ett entresolplan', weight: 0.13, linetype: 'dashdot' },
  { key: 'belowSlab', label: 'Bjälklag under snittet', hint: 'Kanterna och håltagningarna', weight: 0.13 },
  { key: 'aboveFurniture', label: 'Möbler över snittet', hint: 'T.ex. överskåp och hyllor', weight: 0.13, linetype: 'dashdot' },
  { key: 'aboveRoof', label: 'Tak över snittet', hint: 'Takets kontur ovanför planen', weight: 0.18, linetype: 'dashdot' },
  { key: 'belowRoof', label: 'Tak under snittet', hint: 'Takets kontur sedd uppifrån', weight: 0.18 },
  { key: 'aboveGround', label: 'Stödmurar över snittet', hint: 'Murens delar ovanför snitthöjden', weight: 0.18, linetype: 'dashdot' },
  { key: 'belowGround', label: 'Stödmurar under snittet', hint: 'Murens delar under snitthöjden', weight: 0.25 },
] as const;

export type PlanCutPenKey = (typeof PLAN_CUT_PENS)[number]['key'];

/** Typerna som har pennor för snittet, som de heter i nycklarna. */
export type CutPenType = 'Wall' | 'Opening' | 'Slab' | 'Furniture' | 'Roof' | 'Ground';

/** Delen för det som ligger över snittet: den får den egna pennans del `above`. */
export const ABOVE_PART = 'över';

/** Förvalet för en penna för snittet. */
export function defaultPlanCutPen(key: string): PenDef | undefined {
  const d = PLAN_CUT_PENS.find((m) => m.key === key);
  if (!d) return undefined;
  return 'linetype' in d ? { weight: d.weight, linetype: d.linetype } : { weight: d.weight };
}

/**
 * Pennan för det som ligger över eller under snittet för en typ, ur
 * stilmallen eller förvalet. Förvalets linjetyp gäller tills stilmallen
 * har en egen (också heldragen, `solid`).
 */
export function planCutPen(style: StyleSheet | undefined, type: CutPenType, zone: 'above' | 'below'): Pen {
  const key = `${zone}${type}`;
  return defaultedPen(style, key, defaultPlanCutPen(key) ?? { weight: 0.18 });
}

/**
 * Var ett objekt med höjderna `z0`–`z1` ligger mot snitthöjden `h` (alla
 * från samma golv). Ett objekt som bara rör snittet räknas som snittat.
 */
export function cutZone(z0: number, z1: number, h: number): CutZone {
  if (z0 > h + 0.5) return 'above';
  if (z1 < h - 0.5) return 'below';
  return 'cut';
}
