import type { Id } from '../core/model';
import { union, type Rings } from '../geometry/boolean';
import { lastResults } from '../repr/reuse';
import type { PlanContext } from './registry';
import { bareWallUnion, type WallParams } from './wall';

/**
 * Husets kontur (0.10.2): ytterväggarnas utsida på alla våningar, sammanslagen,
 * utan rummen och gårdarna innanför. Det som rivs räknas inte. Språnget är
 * takets del utanför konturen, och konturen kan ritas streckad genom taket.
 */
export function buildingFootprint(ctx: PlanContext): Rings[] {
  return ctx.memo('building-footprint', () => {
    const byStorey = new Map<Id, { id: string; p: WallParams }[]>();
    for (const el of Object.values(ctx.doc.elements)) {
      if (el.type !== 'Wall' || el.space) continue;
      const a = ctx.actionOf(el);
      if (a === 'absent' || a === 'demolished') continue;
      const list = byStorey.get(el.storey) ?? [];
      list.push({ id: el.id, p: ctx.params<WallParams>(el) });
      byStorey.set(el.storey, list);
    }
    const outer = [...byStorey.values()].flatMap((walls) => bareWallUnion(walls).map((poly): Rings => [poly[0]]));
    // Samma kontur till värdet ger samma svar (0.10.6), så att det som följer
    // huset (markobjekten, språnget) inte räknas om när en innervägg, en
    // väggs höjd eller penna ändras.
    const key = outer.map((r) => r[0].join(' ')).join('|');
    return saved([key], () => (outer.length > 1 ? union(outer).map((poly): Rings => [poly[0]]) : outer));
  });
}
const saved = lastResults<Rings[]>();
