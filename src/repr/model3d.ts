import type { Id, ProjectDoc } from '../core/model';
import type { ViewStates } from '../core/states';
import { typeOf, type PlanItem } from '../elements/registry';
import { createContext } from './context';
import type { Edges3D, Shape3D } from './solids';

/**
 * Bygger 3D-modellen för ett våningsplan i ett tillstånd. Det som rivs syns
 * inte i 3D; det som är nytt kan färgas om vyn jämför med ett annat tillstånd.
 */
export function buildModel3d(doc: ProjectDoc, storey: Id, view: ViewStates): Shape3D[] {
  const { ctx, visible } = createContext(
    doc,
    storey,
    view,
    doc.graphics,
    (t, action) => !!(t.model3d || t.model3dBatch) && action !== 'demolished',
  );
  const byType = new Map<string, PlanItem[]>();
  for (const item of visible) {
    const list = byType.get(item.el.type) ?? [];
    list.push(item);
    byType.set(item.el.type, list);
  }
  const elevation = doc.storeys.find((s) => s.id === storey)?.elevation ?? 0;
  const out: Shape3D[] = [];
  for (const [type, items] of byType) {
    const t = typeOf(type)!;
    const solids = t.model3dBatch ? t.model3dBatch(items, ctx) : items.flatMap(({ el }) => t.model3d!(el, ctx));
    for (const s of solids) {
      if (!elevation) out.push(s);
      else if (s.kind === 'edges') out.push({ ...s, segments: s.segments.map(([a, b, c, d, e, f]) => [a, b, c + elevation, d, e, f + elevation] as Edges3D['segments'][number]) });
      else out.push({ ...s, z0: s.z0 + elevation, z1: s.z1 + elevation });
    }
  }
  return out;
}
