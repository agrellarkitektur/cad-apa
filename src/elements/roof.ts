// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import type { Element } from '../core/model';
import { norm, sub } from '../geometry/vec';
import type { Vec2 } from '../repr/primitives';
import { type Edges3D, type Plane, type Shape3D } from '../repr/solids';
import { bodyEdges, roofBody } from './roofBody';
import { buildingFootprint } from './footprint';
import { roofPlanPrims, roofShownOn } from './roofPlan';
import type { ElementType, PlanContext } from './registry';
import { buildingMaterialOf, materialSolid } from './buildingMaterial';
import { type RoofParams, type RoofPlane, roofFrame, planeRange, outlineEdges } from './roofGeometry';
export { type RoofParams, type RoofPlane, outlineRing, refArc, roofFrame, roofPlanes, roofRange, trimToRoofs, halfPlaneBelow, planeRange, outlineEdges } from './roofGeometry';

/**
 * Alla takfall som kan kapa väggarna på våningen i sammanhanget: också de
 * på andra våningar (0.10), flyttade till den här våningens höjder.
 */
export function roofPlanesAround(ctx: PlanContext): RoofPlane[] {
  const here = ctx.storey ? ctx.doc.storeys.find((s) => s.id === ctx.storey) : undefined;
  const own = (els: { el: Element; dz: number }[]) =>
    els.flatMap(({ el, dz }) =>
      roofBodyOf(ctx, ctx.params<RoofParams>(el)).map((rp): RoofPlane => (el.storey !== ctx.storey ? { rings: rp.rings, under: liftPlane(rp.under, dz), top: liftPlane(rp.top, dz), foreign: true } : rp)),
    );
  if (!here) return own(ctx.visible('Roof').filter((r) => ctx.actionOf(r) !== 'demolished').map((el) => ({ el, dz: 0 })));
  if (ctx.view.hide?.includes('Roof')) return [];
  const elevation = new Map(ctx.doc.storeys.map((s) => [s.id, s.elevation]));
  const list: { el: Element; dz: number }[] = [];
  for (const el of Object.values(ctx.doc.elements)) {
    if (el.type !== 'Roof' || el.space || !elevation.has(el.storey)) continue;
    const a = ctx.actionOf(el);
    if (a === 'absent' || a === 'demolished') continue;
    list.push({ el, dz: elevation.get(el.storey)! - here.elevation });
  }
  return own(list);
}

/** Taket som objekttyp; geometrin (planen, höjderna, kanterna) ligger i `roofGeometry.ts`. */
const liftPlane = (pl: Plane, dz: number): Plane => [pl[0], pl[1], pl[2] + dz];

/** Takets kropp i sammanhanget (0.10.2): med språnget utanför husets kontur. */
export const roofBodyOf = (ctx: PlanContext, p: RoofParams) => roofBody(p, () => buildingFootprint(ctx));

/**
 * Hörn där två takfall möts i en skarv som inte syns: där ett annat takfall
 * på våningen har samma hörn och samma höjd, och de två konturernas fria
 * kanter fortsätter i samma riktning (som gaveln på ett sadeltak vid nocken).
 */
function seams(ctx: PlanContext): Map<string, Vec2[][]> {
  return ctx.memo('roof-seams', () => {
    const roofs = ctx.visible('Roof').map((el) => {
      const p = ctx.params<RoofParams>(el);
      const f = roofFrame(p);
      return { id: el.id, pts: p.outline as Vec2[], top: f.top };
    });
    const out = new Map<string, Vec2[][]>();
    const near = (a: Vec2, b: Vec2) => Math.abs(a[0] - b[0]) < 1 && Math.abs(a[1] - b[1]) < 1;
    for (const r of roofs) {
      const n = r.pts.length;
      const list: Vec2[][] = [];
      r.pts.forEach((v, i) => {
        const prev = r.pts[(i - 1 + n) % n];
        const next = r.pts[(i + 1) % n];
        for (const o of roofs) {
          if (o === r) continue;
          const j = o.pts.findIndex((q) => near(q, v));
          if (j < 0 || Math.abs(o.top(o.pts[j]) - r.top(v)) > 1) continue;
          const m = o.pts.length;
          const oPrev = o.pts[(j - 1 + m) % m];
          const oNext = o.pts[(j + 1) % m];
          // Den gemensamma kanten och de två fria.
          let free: Vec2 | null = null;
          let oFree: Vec2 | null = null;
          if (near(next, oPrev)) [free, oFree] = [prev, oNext];
          else if (near(prev, oNext)) [free, oFree] = [next, oPrev];
          if (!free || !oFree) continue;
          const a = norm(sub(free, v));
          const b = norm(sub(oFree, v));
          // Raka motsatta riktningar: kanterna ligger på en linje.
          if (a[0] * b[0] + a[1] * b[1] < -0.9999) list.push([v]);
        }
      });
      out.set(r.id, list);
    }
    return out;
  });
}

export const roofType: ElementType<RoofParams> = {
  type: 'Roof',
  // Husets kontur genom taket och språnget läser väggarna (0.10.2).
  planReads: ['Wall'],
  label: 'Tak',
  labelPlural: 'Tak',
  drawOrder: 70,
  compares: true,
  defaults: () => ({ outline: [], ref: [[0, 0], [1000, 0]], height: 2700, slope: 27, thickness: 300 }),

  // Ovanför snittet punktstreckat, under heldraget, och snittytan där planet skär (0.10.2).
  plan: (el, ctx) => roofPlanPrims(el, ctx),
  alsoOnStorey: roofShownOn,

  model3d(el, ctx) {
    const p = ctx.params<RoofParams>(el);
    const out: Shape3D[] = [];
    const body = roofBodyOf(ctx, p);
    if (!body.length) return out;
    // Materialets kulör (0.10.28.2).
    const mat = materialSolid(buildingMaterialOf(p, ctx.style));
    for (const pc of body) {
      const [z0] = planeRange(pc.under, pc.rings);
      const [, z1] = planeRange(pc.top, pc.rings);
      out.push({ id: el.id, rings: pc.rings, z0, z1, bottom: pc.under, top: pc.top, material: 'roof', noEdges: true, ...mat });
    }
    // Egna kantlinjer: konturen på ovansidan, undersidan med språnget och
    // takfotens snitt, och de lodräta hörnen, utom skarvar mot ett annat
    // takfall som inte syns (0.10).
    const f = roofFrame(p);
    const edges: Edges3D = { kind: 'edges', id: el.id, segments: [], part: 'roof' };
    for (const [a, b] of outlineEdges(p)) edges.segments.push([a[0], a[1], f.top(a), b[0], b[1], f.top(b)]);
    const hidden = seams(ctx).get(el.id) ?? [];
    const corners = (p.outline as Vec2[]).filter((v) => !hidden.some(([q]) => Math.abs(q[0] - v[0]) < 1 && Math.abs(q[1] - v[1]) < 1));
    edges.segments.push(...bodyEdges(body, corners, f.top));
    out.push(edges);
    return out;
  },
};
