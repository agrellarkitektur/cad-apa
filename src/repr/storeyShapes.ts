import type { StyleSheet } from '../core/graphics';
import type { Id, ProjectDoc } from '../core/model';
import type { Action, ViewStates } from '../core/states';
import { typeOf, type ElementType, type PlanContext, type PlanItem } from '../elements/registry';
import { pointInRings } from '../geometry/vec';
import { createContext } from './context';
import { lastResults } from './reuse';
import type { Edges3D, Plane, Shape3D, Solid } from './solids';

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

/** Vilka objekt som byggs, efter typ och åtgärd. */
export type Included = (t: ElementType, action: Action) => boolean;

/** Allt som har en 3D-form, också det som rivs (fasader och sektioner). */
export const WITH_DEMOLISHED: Included = (t) => !!(t.model3d || t.model3dBatch);
/** Allt som har en 3D-form utom det som rivs (3D-vyn). */
export const WITHOUT_DEMOLISHED: Included = (t, action) => !!(t.model3d || t.model3dBatch) && action !== 'demolished';

export interface StoreyShapes {
  shapes: { s: Shape3D; demolished: boolean }[];
  storeys: { ctx: PlanContext; elevation: number }[];
}

/**
 * 3D-formerna för flera våningar (0.9), var och en lyft till sin golvnivå.
 * Varje våning byggs för sig, så att väggar på olika våningar inte skarvas
 * ihop. Det som rivs byggs för sig, så att det inte påverkar skarvarna i det
 * som står kvar. Utan `only` tas alla våningar med.
 *
 * Samma projekt, vy och stilmall ger samma former (0.9.3), så att fyra
 * fasader på ett blad inte bygger modellen fyra gånger. Formerna ändras
 * inte av den som får dem.
 */
export function modelShapes(doc: ProjectDoc, view: ViewStates, style: StyleSheet, include: Included, only?: Id): StoreyShapes {
  // Ytan och vyn gäller 2D-elementen, inte formerna.
  const v: ViewStates = { ...view, place: undefined, viewId: undefined };
  return saved([doc, style, include, only, JSON.stringify(v)], () => build(doc, v, style, include, only));
}
const saved = lastResults<StoreyShapes>();

function build(doc: ProjectDoc, view: ViewStates, style: StyleSheet, include: Included, only?: Id): StoreyShapes {
  const shapes: StoreyShapes['shapes'] = [];
  const storeys: StoreyShapes['storeys'] = [];
  // Bjälklagen kapar väggarna under dem (0.9.2). Med bara en våning byggs
  // bjälklagen på våningarna ovanför ändå, för sig, så att väggarna ser
  // likadana ut; där behövs bara väggarna (för bjälklag ur väggarna) och bjälklagen.
  const slabs: Solid[] = [];
  const here = only ? doc.storeys.find((s) => s.id === only) : undefined;
  for (const storey of doc.storeys) {
    const shown = !only || storey.id === only;
    if (!shown && !(here && storey.elevation > here.elevation)) continue;
    const { ctx, visible } = createContext(doc, storey.id, view, style, shown ? include : (t, action) => (t.type === 'Wall' || t.type === 'Slab') && include(t, action));
    if (shown) storeys.push({ ctx, elevation: storey.elevation });
    const groups = new Map<string, PlanItem[]>();
    for (const item of visible) {
      if (!shown && item.el.type !== 'Slab') continue;
      const key = `${item.el.type}|${item.action === 'demolished' ? 'd' : 'k'}`;
      const list = groups.get(key);
      if (list) list.push(item);
      else groups.set(key, [item]);
    }
    for (const [key, items] of groups) {
      const t = typeOf(items[0].el.type)!;
      const demolished = key.endsWith('|d');
      const made = t.model3dBatch ? t.model3dBatch(items, ctx) : items.flatMap(({ el }) => t.model3d!(el, ctx));
      for (const s of made) {
        const lifted = liftShape(s, storey.elevation);
        if (shown) shapes.push({ s: lifted, demolished });
        if (!demolished && lifted.kind !== 'edges' && lifted.material === 'slab') slabs.push(lifted);
      }
    }
  }
  trimUnderSlabs(shapes, slabs);
  return { shapes, storeys };
}

/**
 * Väggar som står under ett bjälklag slutar vid dess undersida (0.9.2):
 * innerväggarna på våningen under går inte upp i bjälklaget ovanför.
 * Ytterväggarna ligger utanför bjälklaget (det slutar vid deras insida) och
 * går obrutna golv till golv. En vägg räknas som under bjälklaget när
 * mitten av dess kontur ligger i bjälklaget (inte i en håltagning) och
 * bjälklagets undersida ligger mellan väggens under- och ovansida. Väggar
 * med sned ovansida (under ett tak) lämnas som de är.
 */
export function trimUnderSlabs(shapes: { s: Shape3D }[], slabs: readonly Solid[]): void {
  if (!slabs.length) return;
  const boxes = slabs.map((s) => box(s.rings[0] ?? []));
  const tops = new Map<string, number>();
  // En vägg i flera bitar där bara några kapas: kantlinjerna lämnas.
  const mixed = new Set<string>();
  for (const x of shapes) {
    const s = x.s;
    if (s.kind === 'edges' || s.top || (s.material !== 'wall' && s.material !== 'wall-new')) continue;
    const ring = s.rings[0];
    if (!ring?.length) continue;
    const mid: [number, number] = [ring.reduce((a, q) => a + q[0], 0) / ring.length, ring.reduce((a, q) => a + q[1], 0) / ring.length];
    let top = s.z1;
    slabs.forEach((slab, i) => {
      const b = boxes[i];
      if (slab.z0 <= s.z0 + 1 || slab.z0 >= top - 1) return;
      if (mid[0] < b[0] || mid[0] > b[2] || mid[1] < b[1] || mid[1] > b[3]) return;
      if (pointInRings(mid, slab.rings)) top = slab.z0;
    });
    if (top === s.z1) {
      mixed.add(s.id);
      continue;
    }
    x.s = { ...s, z1: top, ...(s.cuts ? { cuts: s.cuts.map((c) => ({ ...c, z1: Math.min(c.z1, top) })).filter((c) => c.z1 > c.z0) } : {}) };
    tops.set(s.id, Math.max(tops.get(s.id) ?? -Infinity, top));
  }
  // Väggarnas egna kantlinjer följer med.
  for (const x of shapes) {
    const s = x.s;
    if (s.kind !== 'edges') continue;
    const top = tops.get(s.id);
    if (top === undefined || mixed.has(s.id)) continue;
    x.s = { ...s, segments: s.segments.map(([a, b, c, d, e, f]) => [a, b, Math.min(c, top), d, e, Math.min(f, top)] as Edges3D['segments'][number]).filter((q) => q[2] !== q[5] || Math.hypot(q[0] - q[3], q[1] - q[4]) > 0) };
  }
}

function box(ring: readonly (readonly number[])[]): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const q of ring) {
    x0 = Math.min(x0, q[0]);
    y0 = Math.min(y0, q[1]);
    x1 = Math.max(x1, q[0]);
    y1 = Math.max(y1, q[1]);
  }
  return [x0, y0, x1, y1];
}
