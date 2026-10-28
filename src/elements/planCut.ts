import { cutZone, type CutZone } from '../repr/planCutPens';
import type { Storey } from '../core/model';
import type { PlanContext } from './registry';

/** Snitthöjden över golvet när våningen inte har någon egen. */
export const DEFAULT_CUT_HEIGHT = 1100;

/** Våningens snitthöjd; Platsen (0.10.25) har ingen, allt ses ovanifrån. */
export const cutHeightOf = (s: Pick<Storey, 'cutHeight' | 'site'>): number => (s.site ? Infinity : (s.cutHeight ?? DEFAULT_CUT_HEIGHT));

/**
 * Planens snitthöjd över golvet på våningen som ritas (0.10.16), eller
 * undefined när ytan inte är en plan (då räknas allt som snittat, som förut).
 */
export function planCutHeight(ctx: Pick<PlanContext, 'doc' | 'storey'>): number | undefined {
  if (!ctx.storey) return undefined;
  const s = ctx.doc.storeys.find((x) => x.id === ctx.storey);
  return s ? cutHeightOf(s) : undefined;
}

/** Var höjderna `z0`–`z1` (från våningens golv) ligger mot planens snitt; utan snitt `cut`. */
export function zoneInPlan(ctx: Pick<PlanContext, 'doc' | 'storey'>, z0: number, z1: number): CutZone {
  const h = planCutHeight(ctx);
  return h === undefined ? 'cut' : cutZone(z0, z1, h);
}
