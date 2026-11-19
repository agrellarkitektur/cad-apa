// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import { buildingStoreys, type Element, type Id, type ProjectDoc } from '../core/model';
import { difference, intersection, union, type Rings } from '../geometry/boolean';
import { signedArea } from '../geometry/chains';
import { grownSquare, minus, solid } from './areaGeom';
import { measurable } from './areaHeight';
import { pointInRings } from '../geometry/vec';
import type { Vec2 } from '../repr/primitives';
import { typeOf, resolveParams, type PlanContext } from './registry';
import { outlineRing, planeRange, roofPlanes, type RoofParams } from './roofGeometry';
import { holeAt, roomHoles } from './rooms';
import { holeRing, type SlabParams } from './slab';
import { stairParams, geometryOfStair } from './stair';
import { stairOutline } from './stairGeometry';
import { bareWallShapes, bareWallUnion, wallFrame, type WallParams } from './wall';
import type { Shape2DParams } from './drawing2d';


/** Arean i m² ur polygoner med hål (mm). */
export function ringsArea(polys: readonly Rings[]): number {
  let a = 0;
  for (const poly of polys) poly.forEach((r, i) => (a += (i ? -1 : 1) * Math.abs(signedArea(r))));
  return Math.max(0, a) / 1e6;
}

/**
 * Våningens väggar, hål och konturer för areorna (Granskning efter 0.12, ur
 * `areaCalc.ts`): BTA- och BYA-konturerna och det som areaberäkningen
 * räknar bort.
 */

// ---------------------------------------------------------------------------
// Väggarna och rummen på våningen

export interface WallInfo {
  el: Element;
  p: WallParams;
  body: Rings[];
}

/** Väggarna som finns i vyns tillstånd (inte det som rivs), med sina ytor utan öppningar. */
export function wallsOf(ctx: PlanContext): WallInfo[] {
  return ctx.memo('area-walls', () => {
    const els = ctx.visible('Wall').filter((el) => existsNow(ctx, el));
    const list = els.map((el) => ({ id: el.id, p: ctx.params<WallParams>(el) }));
    const shapes = bareWallShapes(list);
    return els.map((el, i) => ({ el, p: list[i].p, body: shapes.get(el.id) ?? [] }));
  });
}

export const existsNow = (ctx: PlanContext, el: Element) => {
  const a = ctx.actionOf(el);
  return a !== 'absent' && a !== 'demolished';
};

/** Rummen (hålen i väggmassan) för väggarna som finns. */
export function holesOf(ctx: PlanContext): Vec2[][] {
  return ctx.memo('area-holes', () =>
    roomHoles(
      wallsOf(ctx).map((w) => ({ id: w.el.id, p: w.p })),
      ctx.roomBounds().map((el) => ({ id: el.id, p: ctx.params<Shape2DParams>(el) })),
    ),
  );
}

/** Väggmassan sammanslagen, och pelarna som profiler (lodräta). */
export function massOf(ctx: PlanContext): Rings[] {
  return ctx.memo('area-mass', () => {
    const walls = wallsOf(ctx);
    const mass = bareWallUnion(walls.map((w) => ({ id: w.el.id, p: w.p })));
    const pillars = pillarsOf(ctx);
    return pillars.length ? union([...mass, ...pillars]) : mass;
  });
}

/** Pelarna (lodräta profiler, 0.11.6) som ytor i planen. */
export function pillarsOf(ctx: PlanContext): Rings[] {
  return ctx.memo('area-pillars', () => {
    const t = typeOf('Profile');
    if (!t?.plan) return [];
    const out: Rings[] = [];
    for (const el of ctx.visible('Profile')) {
      if ((el.params as { path?: string }).path !== 'plumb' || !existsNow(ctx, el)) continue;
      const rings = t
        .plan(el, ctx)
        .filter((q) => q.kind === 'region')
        .flatMap((q) => (q.kind === 'region' ? [q.rings.map((r) => r.map((v): Vec2 => [v[0], v[1]]))] : []));
      out.push(...(rings.length > 1 ? union(rings) : rings));
    }
    return out;
  });
}

export const sampleAt = [0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9];

/** På vilka sidor av väggen (vänster, höger) en punkt ligger i något av hålen. */
export function sidesIn(w: WallInfo, holes: readonly Vec2[][]): [boolean, boolean] {
  const f = wallFrame(w.p);
  const probe = f.half + 15;
  let l = false;
  let r = false;
  for (const t of sampleAt) {
    const s = f.length * t;
    if (!l && holes.some((h) => pointInRings(f.at(s, probe), [h]))) l = true;
    if (!r && holes.some((h) => pointInRings(f.at(s, -probe), [h]))) r = true;
    if (l && r) break;
  }
  return [l, r];
}

/** Rummen som punkterna ligger i, utan dubbletter. */
export function holesAt(ctx: PlanContext, seeds: readonly [number, number][]): Vec2[][] {
  const holes = holesOf(ctx);
  const out: Vec2[][] = [];
  for (const s of seeds) {
    const h = holeAt(holes, s);
    if (h && !out.includes(h)) out.push(h);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Hål i bjälklaget

/**
 * Andra hål i våningens bjälklag än trappans (5.17.3, 8.3.1): de räknas inte.
 * Ett ritat hål över en trappa räknas med när det är högst 30 % större än
 * trappan i hålet (5.15.2); annars räknas bara trappan.
 */
export function otherFloorOpenings(ctx: PlanContext): Rings[] {
  return ctx.memo('area-floor-openings', () => {
    const doc = ctx.doc;
    const storey = ctx.storey ?? ctx.visible()[0]?.storey;
    if (!storey) return [];
    const stairs = stairsBelow(doc, storey, ctx);
    const out: Rings[] = [];
    for (const el of ctx.visible('Slab')) {
      if (!existsNow(ctx, el)) continue;
      for (const h of ctx.params<SlabParams>(el).holes ?? []) {
        const ring = holeRing(h);
        if (ring.length < 3) continue;
        const hole: Rings = [ring];
        const holeA = ringsArea([hole]);
        const inHole = stairs.flatMap((s) => intersection(hole, [s]));
        const stairA = ringsArea(inHole);
        if (stairA > 0 && holeA <= stairA * 1.3 + 1e-6) continue;
        out.push(...(inHole.length ? difference(hole, inHole) : [hole]));
      }
    }
    return out;
  });
}

/** Trapporna på våningen under, som går upp i den här, som ytor. */
export function stairsBelow(doc: ProjectDoc, storey: Id, ctx: PlanContext): Rings[] {
  const list = buildingStoreys(doc).sort((a, b) => a.elevation - b.elevation);
  const i = list.findIndex((s) => s.id === storey);
  if (i <= 0) return [];
  const below = list[i - 1].id;
  const out: Rings[] = [];
  for (const st of Object.values(doc.elements)) {
    if (st.type !== 'Stair' || st.storey !== below || st.space) continue;
    if (!st.states.includes(ctx.view.state)) continue;
    const g = geometryOfStair(stairParams(doc, st));
    const ring = g ? stairOutline(g) : [];
    if (ring.length >= 3) out.push([ring.map((q): Vec2 => [q[0], q[1]])]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// BTA och BYA

/** Husets ytterkontur på våningen: väggarnas yttre ringar (ytterväggarnas utsida). */
export function outerContour(ctx: PlanContext): Rings[] {
  return ctx.memo('area-contour', () => {
    const mass = bareWallUnion(wallsOf(ctx).map((w) => ({ id: w.el.id, p: w.p })));
    const outer = mass.map((poly): Rings => [poly[0]]).filter((p) => Math.abs(signedArea(p[0])) > 1e4);
    return outer.length > 1 ? union(outer) : outer;
  });
}

/**
 * BTA på våningen (8.4): ytterkonturen utan andra hål i bjälklaget än
 * trappans, och bara det mätvärda under snedtaken.
 */
export function btaRegion(ctx: PlanContext): Rings[] {
  return ctx.memo('area-bta', () => solid(measurable(ctx, minus(outerContour(ctx), otherFloorOpenings(ctx)))));
}

/** Våningen BYA räknas på: den lägsta med golvet högst 0,6 m under ±0, annars den lägsta. */
export function groundStorey(doc: Pick<ProjectDoc, 'storeys'>): Id | undefined {
  const list = buildingStoreys(doc).sort((a, b) => a.elevation - b.elevation);
  return (list.find((s) => s.elevation >= -600) ?? list[0])?.id;
}

/**
 * BYA (6): markplanets kontur och de mätvärda taksprången (6.4.2), räknade
 * mot ±0. Taken på alla våningar i vyns tillstånd.
 */
export function byaRegion(ctx: PlanContext): Rings[] {
  return ctx.memo('area-bya', () => {
    const doc = ctx.doc;
    const foot = outerContour(ctx);
    if (!foot.length) return [];
    // Djupet vinkelrätt mot fasaden: utvidgat med raka hörn, så att hörnet av ett språng på 0,50 m inte räknas som djupare.
    const near = grownSquare(foot, 500);
    const far = grownSquare(foot, 1500);
    const extra: Rings[] = [];
    for (const el of Object.values(doc.elements)) {
      if (el.type !== 'Roof' || el.space || !el.states.includes(ctx.view.state)) continue;
      const st = doc.storeys.find((s) => s.id === el.storey);
      if (!st || st.site) continue;
      const p = resolveParams<RoofParams>(doc, el);
      if (outlineRing(p).length < 3) continue;
      for (const pl of roofPlanes(p)) {
        for (const part of minus([pl.rings], foot)) {
          if (ringsArea([part]) < 0.01) continue;
          const low = planeRange(pl.under, part)[0] + st.elevation;
          const deep = ringsArea(minus([part], near)) > 0.001;
          const wide = ringsArea(minus([part], far)) > 0.001;
          if ((low < 3000 && deep) || (low >= 3000 && low <= 5000 && wide)) extra.push(part);
        }
      }
    }
    return extra.length ? union([...foot, ...extra]) : foot;
  });
}
