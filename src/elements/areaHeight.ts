import { buildingStoreys, type Element } from '../core/model';
import { intersection, union, type Rings } from '../geometry/boolean';
import { bufferRings } from '../geometry/offset';
import { clipAll, grownSquare, minus } from './areaGeom';
import type { PlanContext } from './registry';
import { halfPlaneBelow, planeRange, roofBodyOf, type RoofParams, type RoofPlane } from './roof';

/**
 * Rumshöjden under taken (0.12.4), för areorna enligt SS 21054:2020.
 *
 * - **Snedtaket** (5.1.3, 5.13, 8.4): rumshöjden mäts mot det lägsta
 *   takfallets undersida. Det mätvärda är där den är minst 1,90 m, och 0,60 m
 *   ut från den linjen (ett tänkt lodrätt plan). En del som är smalare än
 *   0,60 m räknas inte (figur 8c). BTA klipps likadant och slutar vid
 *   ytterväggens utsida när 0,60 m når längre (figur 24d).
 * - **Takkupan** (5.14): ett tak med krysset *Takkupa* gäller i stället för
 *   taken under det, inom kupans kontur.
 * - **H och L** (18.5): delen med rumshöjden minst 2,10 m och den lägre.
 *
 * Bjälklaget ovanför och fasta undertak räknas inte (svar J, 10 november):
 * bara taken. Hanbjälkar behöver inte hanteras.
 */

/** Lägsta rumshöjden för ett mätvärt utrymme, mm (5.1.3). */
export const MIN_HEIGHT = 1900;
/** Det mätvärda når så långt ut från 1,90-linjen, och så brett måste det vara, mm (5.1.3, 5.13). */
export const BEYOND = 600;
/** Gränsen mellan H och L, mm (18.5). */
export const HIGH_HEIGHT = 2100;

/** Takfallen ovanför våningens golv, i våningens höjder, med kupornas kontur borträknad ur taken under dem. */
function ceilings(ctx: PlanContext): RoofPlane[] {
  return ctx.memo('area-ceilings', () => {
    const here = ctx.storey ? ctx.doc.storeys.find((s) => s.id === ctx.storey) : undefined;
    if (!here || here.site) return [];
    const elevation = new Map(buildingStoreys(ctx.doc).map((s) => [s.id, s.elevation]));
    const planes: { pl: RoofPlane; dormer: boolean }[] = [];
    for (const el of Object.values(ctx.doc.elements) as Element[]) {
      if (el.type !== 'Roof' || el.space || !elevation.has(el.storey)) continue;
      const a = ctx.actionOf(el);
      if (a === 'absent' || a === 'demolished') continue;
      const p = ctx.params<RoofParams>(el);
      const dz = elevation.get(el.storey)! - here.elevation;
      for (const rp of roofBodyOf(ctx, p)) {
        const under: RoofPlane['under'] = [rp.under[0], rp.under[1], rp.under[2] + dz];
        // Ett tak helt under golvet (t.ex. ett lägre tak på en tillbyggnad bredvid) är inget tak över våningen.
        if (planeRange(under, rp.rings)[1] <= 0) continue;
        planes.push({ pl: { rings: rp.rings, under, top: rp.top }, dormer: !!p.dormer });
      }
    }
    const kupor = planes.filter((x) => x.dormer).map((x) => x.pl.rings);
    const dormers = kupor.length > 1 ? union(kupor) : kupor;
    return planes.flatMap(({ pl, dormer }) => (dormer || !dormers.length ? [pl] : minus([pl.rings], dormers).map((rings) => ({ ...pl, rings }))));
  });
}

/** Där rumshöjden under taken är lägre än `h` mm. */
export function lowRegion(ctx: PlanContext, h: number): Rings[] {
  return ctx.memo(`area-low:${h}`, () => {
    const parts: Rings[] = [];
    for (const pl of ceilings(ctx)) {
      const below = halfPlaneBelow(pl.under, h);
      if (below) parts.push(...intersection(pl.rings, [below]));
    }
    return parts.length > 1 ? union(parts) : parts;
  });
}

/**
 * Det mätvärda av en yta under taken (5.1.3, 5.13, 8.4): där rumshöjden är
 * minst 1,90 m, smalare delar än 0,60 m borträknade, och 0,60 m ut från
 * linjen med raka hörn (planen möts).
 */
export function measurable(ctx: PlanContext, region: readonly Rings[]): Rings[] {
  const low = lowRegion(ctx, MIN_HEIGHT);
  if (!low.length || !region.length) return [...region];
  // Bredden: det som är kvar när låga delen vuxit 0,30 m är minst 0,60 m brett, och växer tillbaka 0,30 m.
  const core = minus(region, bufferRings(low, BEYOND / 2, 16));
  return clipAll(region, grownSquare(core, BEYOND / 2 + BEYOND));
}

/** Ytan delad i den med rumshöjden minst 2,10 m (H) och den lägre (L), 18.5. */
export function splitByHeight(ctx: PlanContext, region: readonly Rings[]): { high: Rings[]; low: Rings[] } {
  const low = lowRegion(ctx, HIGH_HEIGHT);
  if (!low.length) return { high: [...region], low: [] };
  return { high: minus(region, low), low: clipAll(region, low) };
}
