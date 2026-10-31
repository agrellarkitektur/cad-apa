import { isSite, type Element, type Id, type ProjectDoc } from '../core/model';
import { groundAt, terrainOf } from '../core/site';
import { crispHeight, crispShapes } from '../repr/crispGround';
import { finishedTerrain, showsProposal } from './groundGeometry';
import { defaultRailingTypes, railingModel, railNum, railValues, type RailingTypeModel, type RailPart } from '../core/railingTypes';
import { closestOnSegment, dist, norm, sub } from '../geometry/vec';
import type { Vec2 } from '../repr/primitives';
import { levelOf, type Material3D, type Plane, type Shape3D, type Solid } from '../repr/solids';
import { buildingMaterialOf, materialSolid } from './buildingMaterial';
import { stripRing } from './groundLines';
import { postStations, railingBody, withExtension, type PanelPiece, type RailingBody } from './railingBody';
import { dedupe, freePath, hostedPath, pathZ, type GroundFn, type RailGate, type RailingParams, type RailPath } from './railingGeometry';
import { postRing, railingPlan } from './railingPlan';
import { resolveParams, type ElementType, type PlanContext } from './registry';
import { geometryOfStair, stairParams, storeyAbove } from './stair';

/**
 * Räcket (0.11.1): ett eget objekt för räcken, ledstänger, staket, stängsel
 * och spaljéer, med typ och littera (RÄ01 …). Referenslinjen är ritad fritt
 * eller hänger på en trappas kant (elementets `host` är trappan), och följer
 * då trappan. Typen (`Definition.railing`) är en lista med delar och
 * parametrar; räcket kan ha egna värden för de parametrar typen tillåter.
 * Geometrin ligger i `railingGeometry.ts` och `railingBody.ts`, planen i
 * `railingPlan.ts` och varningarna i `railingWarnings.ts`.
 */

export type { RailingParams } from './railingGeometry';

/** Den förvalda typen när räcket saknar en (RÄ01). */
const FALLBACK: RailingTypeModel = defaultRailingTypes()[0].railing!;

/** Räckestypen för ett räcke. */
export function railingTypeOf(doc: ProjectDoc, el: Element<any>): RailingTypeModel {
  return railingModel(el.definition ? doc.definitions[el.definition] : undefined) ?? FALLBACK;
}

/** Typens parametrar med räckets egna värden. */
export function railingValues(doc: ProjectDoc, el: Element<any>): Map<string, number> {
  return railValues(railingTypeOf(doc, el), (el.params as RailingParams).values);
}

/** Trappan ett räcke hänger på, om den finns. */
export const railingStair = (doc: ProjectDoc, el: Element<any>): Element | undefined => {
  const h = el.host ? doc.elements[el.host] : undefined;
  return h?.type === 'Stair' && (el.params as RailingParams).host ? h : undefined;
};

const savedPath = new WeakMap<object, { key: unknown[]; path: RailPath | null }>();

/**
 * Den färdiga markens höjd för räcken på Platsen (0.11.3): marken efter
 * markobjekten i förslaget som ritas, med de skarpa kanterna (som
 * stödmurarna), annars den befintliga marken. Null utan markmodell.
 */
export function railingGround(ctx: PlanContext): GroundFn | null {
  return ctx.memo('railing-ground', () => {
    const f = showsProposal(ctx) ? finishedTerrain(ctx) : null;
    if (f) {
      const h = crispHeight(crispShapes(ctx, f), f.terrain);
      return (q: Vec2) => h(q);
    }
    const t = terrainOf(ctx.doc);
    return t ? (q: Vec2) => groundAt(t, q[0], q[1]) : null;
  });
}

/**
 * Räckets linje i 3D, med höjderna mot räckets våning: längs trappans kant
 * (från trappans fot plus fotens nivå) eller den ritade linjen. På Platsen
 * (0.11.3) följer linjen marken (`ground`) när höjden är från marken.
 */
export function railingPath(doc: ProjectDoc, el: Element<any>, ground?: GroundFn | null): RailPath | null {
  const p = resolveParams<RailingParams>(doc, el);
  const stair = railingStair(doc, el);
  const sp = stair ? stairParams(doc, stair) : undefined;
  const g = isSite(el.storey) ? (ground ?? null) : null;
  const key = [p, sp, g];
  const hit = savedPath.get(el);
  if (hit && hit.key.length === key.length && hit.key.every((k, i) => k === key[i])) return hit.path;
  let path: RailPath | null = null;
  if (stair && sp && p.host) {
    const g = geometryOfStair(sp);
    const raw = g ? hostedPath(g, p, p.host) : null;
    const lv = levelOf(sp);
    path = raw && lv ? { ...raw, z: raw.z.map((z) => z + lv) } : raw;
  } else if (!p.host) path = freePath(p, g);
  savedPath.set(el, { key, path });
  return path;
}

/** Grindtypens modell och värden (G01 …), eller null när grinden följer staketet. */
function gateModelOf(doc: ProjectDoc, g: RailGate): { model: RailingTypeModel; vals: Map<string, number> } | null {
  const m = g.type ? railingModel(doc.definitions[g.type]) : undefined;
  return m ? { model: m, vals: railValues(m) } : null;
}

/** Räcket med typens delar längs linjen. */
export function railingBodyOf(doc: ProjectDoc, el: Element<any>, ground?: GroundFn | null): { path: RailPath; body: RailingBody } | null {
  const path = railingPath(doc, el, ground);
  if (!path) return null;
  const gates = (el.params as RailingParams).gates;
  return { path, body: railingBody(path, railingTypeOf(doc, el), railingValues(doc, el), gates?.length ? { gates, gateModel: (g) => gateModelOf(doc, g) } : {}) };
}

/** Grindens littera: grindtypens, annars den egna. */
export function gateLittera(doc: ProjectDoc, g: RailGate): string {
  return (g.type && !g.own ? doc.definitions[g.type]?.name : undefined) ?? g.littera ?? '';
}

/** Räckena som hänger på en trappa, och vilka sidor de täcker. */
export function railingsOnStair(doc: ProjectDoc, stairId: Id): { left: Element[]; right: Element[] } {
  const out = { left: [] as Element[], right: [] as Element[] };
  for (const e of Object.values(doc.elements)) {
    if (e.type !== 'Railing' || e.host !== stairId) continue;
    const side = (e.params as RailingParams).host?.side;
    if (side) out[side].push(e);
  }
  return out;
}

// ---------- 3D ----------

/** Ett plan genom en sned bit: höjden z0 i a, z1 i b. */
function planeAlong(a: Vec2, b: Vec2, z0: number, z1: number): Plane | undefined {
  const l = dist(a, b);
  if (l < 1e-6 || Math.abs(z1 - z0) < 0.01) return undefined;
  const d: Vec2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  const k = (z1 - z0) / l;
  return [k * d[0], k * d[1], z0 - k * (a[0] * d[0] + a[1] * d[1])];
}

/** En rektangel längs a–b med bredden w, förlängd e i ändarna. */
function stripAlong(a: Vec2, b: Vec2, w: number, e = 0): Vec2[] {
  const d = norm(sub(b, a));
  const n: Vec2 = [-d[1] * (w / 2), d[0] * (w / 2)];
  const A: Vec2 = [a[0] - d[0] * e, a[1] - d[1] * e];
  const B: Vec2 = [b[0] + d[0] * e, b[1] + d[1] * e];
  return [
    [A[0] - n[0], A[1] - n[1]],
    [B[0] - n[0], B[1] - n[1]],
    [B[0] + n[0], B[1] + n[1]],
    [A[0] + n[0], A[1] + n[1]],
  ];
}

/** En sned kropp mellan a och b: undersidan och ovansidan räta plan genom höjderna i ändarna. */
function slantSolid(id: string, ring: Vec2[], a: Vec2, b: Vec2, bottom: [number, number], top: [number, number], mat: Partial<Solid>, material: Material3D): Solid {
  const tp = planeAlong(a, b, top[0], top[1]);
  const bp = planeAlong(a, b, bottom[0], bottom[1]);
  return {
    id,
    rings: [ring],
    z0: Math.min(...ring.map((q) => (bp ? bp[0] * q[0] + bp[1] * q[1] + bp[2] : bottom[0]))),
    z1: Math.max(...ring.map((q) => (tp ? tp[0] * q[0] + tp[1] * q[1] + tp[2] : top[0]))),
    ...(tp ? { top: tp } : {}),
    ...(bp ? { bottom: bp } : {}),
    material,
    ...mat,
  };
}

/** Räckets delar i 3D: liggarna som sneda kroppar per bit, stolpar och spjälor lodräta, ytorna mellan stolparna. */
export function railingSolids(id: string, body: RailingBody, matOf: (part: RailPart) => Partial<Solid>): Solid[] {
  const out: Solid[] = [];
  for (const a of body.along) {
    const ext = withExtension(a);
    const mat = matOf(a.part);
    for (let i = 1; i < ext.pts.length; i++) {
      const p0 = ext.pts[i - 1];
      const p1 = ext.pts[i];
      if (dist(p0, p1) < 1) continue;
      const ring = stripAlong(p0, p1, a.w, a.w / 2);
      out.push(slantSolid(id, ring, p0, p1, [ext.top[i - 1] - a.h, ext.top[i] - a.h], [ext.top[i - 1], ext.top[i]], mat, 'frame'));
    }
  }
  for (const q of [...body.posts, ...body.repeats]) {
    if (q.z1 - q.z0 < 1) continue;
    out.push({ id, rings: [postRing(q)], z0: q.z0, z1: q.z1, material: 'frame', ...matOf(q.part) });
  }
  for (const p of body.panels as PanelPiece[]) {
    const ring = stripAlong(p.a, p.b, p.t);
    out.push(slantSolid(id, ring, p.a, p.b, [p.a0, p.b0], [p.a1, p.b1], matOf(p.part), p.part.material ? 'frame' : 'glass'));
  }
  // Plintarna (0.11.3) i betong, och grindarnas blad i stängt läge.
  for (const f of body.footings) {
    const r = f.w / 2;
    out.push({ id, rings: [Array.from({ length: 8 }, (_, k): Vec2 => [f.at[0] + r * Math.cos((k * Math.PI) / 4 + Math.PI / 8), f.at[1] + r * Math.sin((k * Math.PI) / 4 + Math.PI / 8)])], z0: f.z0, z1: f.z1, material: 'frame', color: '#b9b5ad' } as Solid);
  }
  for (const g of body.gates) for (const leaf of g.leaves) out.push(...railingSolids(id, leaf.body, matOf));
  return out;
}

export const railingType: ElementType<RailingParams> = {
  type: 'Railing',
  planReads: ['Stair'],
  label: 'Räcke',
  labelPlural: 'Räcken',
  litteraPrefix: 'RÄ',
  drawOrder: 13,
  compares: true,
  defaults: () => ({}),
  alsoOnStorey: (el, doc, storey) => {
    const st = railingStair(doc, el);
    return !!st && storeyAbove(doc, st.storey)?.id === storey;
  },
  pickShape(el, ctx) {
    const path = railingPath(ctx.doc, el);
    if (!path) return [];
    const pts = dedupe(path.pts);
    return pts.length >= 2 ? [[stripRing(pts, 120)]] : [];
  },
  plan(el, ctx) {
    const r = railingBodyOf(ctx.doc, el, railingGround(ctx));
    return r ? railingPlan(el, ctx, !ctx.storey || el.storey === ctx.storey, r, (g) => gateLittera(ctx.doc, g)) : [];
  },
  model3d(el, ctx) {
    const r = railingBodyOf(ctx.doc, el, railingGround(ctx));
    if (!r) return [];
    const cache = new Map<string, Partial<Solid>>();
    const matOf = (part: RailPart): Partial<Solid> => {
      const key = part.material ?? '';
      if (!cache.has(key)) cache.set(key, part.material ? materialSolid(buildingMaterialOf({ material: part.material } as never, ctx.style)) : {});
      return cache.get(key)!;
    };
    return railingSolids(el.id, r.body, matOf) as Shape3D[];
  },
};

// ---------- Kanterna att lägga räcken längs ----------

/** Närmaste punkt på en linje: avståndet och sträckan längs den. */
function nearestOn(pts: readonly Vec2[], at: Vec2): { d: number; s: number; q: Vec2 } {
  let best = { d: Infinity, s: 0, q: pts[0] };
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const l = dist(a, b);
    if (l > 1e-9) {
      const { point: q, t } = closestOnSegment(at, a, b);
      const d = dist(q, at);
      if (d < best.d) best = { d, s: acc + t * l, q };
    }
    acc += l;
  }
  return best;
}

/**
 * Facket mellan stolparna där man klickade (0.11.3, *Gör till grind…*):
 * hålmåttet mellan stolparnas sidor. Utan stolpar en grind 1 000 kring
 * klicket. Null när räcket saknar linje.
 */
export function gateSpanAt(doc: ProjectDoc, el: Element<any>, at: Vec2): { at: number; width: number } | null {
  const path = railingPath(doc, el);
  if (!path) return null;
  const s = nearestOn(path.pts, at).s;
  const model = railingTypeOf(doc, el);
  const vals = railingValues(doc, el);
  const main = model.parts.find((q) => q.kind === 'point');
  if (!main) {
    const w = Math.min(1000, path.length);
    return { at: Math.max(0, Math.min(path.length - w, s - w / 2)), width: w };
  }
  const st = postStations(path, railNum(main.spacing, vals, 1200), main.corners !== false);
  const w = main.profile?.w ?? 40;
  let k = 0;
  while (k < st.length - 2 && st[k + 1] < s) k++;
  return { at: st[k] + w / 2, width: Math.max(100, st[k + 1] - st[k] - w) };
}

/** En trappkant nära en punkt i planen: trappan, sidan och kanten (hela trappans). */
export interface StairEdgeHit {
  stair: Element;
  side: 'left' | 'right';
  pts: Vec2[];
  /** Punkten närmast på kanten och höjden där (stegnoslinjen, mot våningens golv). */
  at: Vec2;
  z: number;
  d: number;
}

/** Trappornas kanter på våningen inom `tol` från punkten, närmast först. */
export function stairEdgesAt(doc: ProjectDoc, storey: Id, states: (el: Element) => boolean, at: Vec2, tol: number): StairEdgeHit[] {
  const out: StairEdgeHit[] = [];
  for (const st of Object.values(doc.elements)) {
    if (st.type !== 'Stair' || st.storey !== storey || st.space || !states(st)) continue;
    const sp = stairParams(doc, st);
    const g = geometryOfStair(sp);
    if (!g) continue;
    for (const side of ['left', 'right'] as const) {
      const path = hostedPath(g, { place: 'on', transition: 'knee', winder: 'stepped' }, { side });
      if (!path) continue;
      const near = nearestOn(path.pts, at);
      if (near.d > tol) continue;
      out.push({ stair: st, side, pts: dedupe(path.pts), at: near.q, z: pathZ(path, near.s) + levelOf(sp), d: near.d });
    }
  }
  return out.sort((a, b) => a.d - b.d);
}
