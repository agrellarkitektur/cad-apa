import type { StyleSheet } from '../core/graphics';
import type { Id, ProjectDoc } from '../core/model';
import type { Action, ViewStates } from '../core/states';
import { typeOf, type ElementType, type PlanContext, type PlanItem } from '../elements/registry';
import { createContext } from './context';
import type { Edges3D, Plane, Shape3D } from './solids';

/** En 3D-form flyttad `dz` i höjd: höjderna, urtagen och de sneda planen (0.9). */
export function liftShape(s: Shape3D, dz: number): Shape3D {
  if (!dz) return s;
  if (s.kind === 'edges') return { ...s, segments: s.segments.map(([a, b, c, d, e, f]) => [a, b, c + dz, d, e, f + dz] as Edges3D['segments'][number]) };
  const lift = (pl: Plane): Plane => [pl[0], pl[1], pl[2] + dz];
  return {
    ...s,
    z0: s.z0 + dz,
    z1: s.z1 + dz,
    ...(s.top ? { top: lift(s.top) } : {}),
    ...(s.bottom ? { bottom: lift(s.bottom) } : {}),
    ...(s.cuts ? { cuts: s.cuts.map((c) => ({ ...c, z0: c.z0 + dz, z1: c.z1 + dz })) } : {}),
  };
}

/**
 * 3D-formerna för flera våningar (0.9), var och en lyft till sin golvnivå.
 * Varje våning byggs för sig, så att väggar på olika våningar inte skarvas
 * ihop. Det som rivs byggs för sig, så att det inte påverkar skarvarna i det
 * som står kvar. Utan `only` tas alla våningar med.
 */
export function modelShapes(
  doc: ProjectDoc,
  view: ViewStates,
  style: StyleSheet,
  include: (t: ElementType, action: Action) => boolean,
  only?: Id,
): { shapes: { s: Shape3D; demolished: boolean }[]; storeys: { ctx: PlanContext; elevation: number }[] } {
  const shapes: { s: Shape3D; demolished: boolean }[] = [];
  const storeys: { ctx: PlanContext; elevation: number }[] = [];
  for (const storey of doc.storeys) {
    if (only && storey.id !== only) continue;
    const { ctx, visible } = createContext(doc, storey.id, { ...view, place: undefined, viewId: undefined }, style, include);
    storeys.push({ ctx, elevation: storey.elevation });
    const groups = new Map<string, PlanItem[]>();
    for (const item of visible) {
      const key = `${item.el.type}|${item.action === 'demolished' ? 'd' : 'k'}`;
      const list = groups.get(key);
      if (list) list.push(item);
      else groups.set(key, [item]);
    }
    for (const [key, items] of groups) {
      const t = typeOf(items[0].el.type)!;
      const made = t.model3dBatch ? t.model3dBatch(items, ctx) : items.flatMap(({ el }) => t.model3d!(el, ctx));
      for (const s of made) shapes.push({ s: liftShape(s, storey.elevation), demolished: key.endsWith('|d') });
    }
  }
  return { shapes, storeys };
}
