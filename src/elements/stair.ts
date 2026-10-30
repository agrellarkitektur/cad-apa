import { storeysUpFrom, type Element, type Id, type ProjectDoc, type Storey } from '../core/model';
import { dot } from '../geometry/vec';
import type { Origin, Pen, Primitive, Vec2 } from '../repr/primitives';
import { levelOf, type Plane, type Shape3D, type Solid } from '../repr/solids';
import { stairPen, type StairPenKey } from '../repr/stairPens';
import { buildingMaterialOf, materialSolid } from './buildingMaterial';
import { planCutHeight } from './planCut';
import { resolveParams, type ElementType, type PlanContext } from './registry';
import { bandBetween, HEADROOM, sideBetween, stairGeometry, stairOutline, STAIR_THICKNESS, STAIR_WIDTH, walkBetween, walkDir, type StairGeometry, type StairParams } from './stairGeometry';

/**
 * Trappan (0.11, format 26). Ett band längs en referenslinje som ritas i
 * trappverktyget; formen är linjen (ingen formväljare). Geometrin ligger i
 * `stairGeometry.ts`. I planen ritas det under snittet heldraget och det
 * ovanför streckprickat med snittlinjen snett över; i våningen ovanför ritas
 * trappan hel. I 3D och sektioner är trappan en monolitisk kropp med
 * sågtandsprofil och sned undersida. Hålet i bjälklaget ovanför räknas ur den
 * fria höjden (`stairHoles`, läses av bjälklagen).
 */

export type { StairParams } from './stairGeometry';

/** Våningen närmast ovanför (utan Platsen). */
export function storeyAbove(doc: Pick<ProjectDoc, 'storeys'>, id: Id): Storey | undefined {
  const list = storeysUpFrom(doc);
  const i = list.findIndex((s) => s.id === id);
  return i >= 0 ? list[i + 1] : undefined;
}

/** Våningen närmast under. */
export function storeyBelow(doc: Pick<ProjectDoc, 'storeys'>, id: Id): Storey | undefined {
  const list = storeysUpFrom(doc);
  const i = list.findIndex((s) => s.id === id);
  return i > 0 ? list[i - 1] : undefined;
}

/**
 * Trappans parametrar ur dokumentet. Utan egen stigning går trappan till
 * våningen ovanför: våningshöjden minus fotens nivå.
 */
export function stairParams(doc: ProjectDoc, el: Element<any>): StairParams {
  const p = resolveParams<StairParams>(doc, el);
  if (typeof el.params.rise === 'number') return p;
  const lv = levelOf(p);
  return lv ? { ...p, rise: Math.max(1, p.rise - lv) } : p;
}

const saved = new WeakMap<StairParams, StairGeometry | null>();

/** Trappans geometri, sparad per parametrar. */
export function geometryOfStair(p: StairParams): StairGeometry | null {
  if (saved.has(p)) return saved.get(p)!;
  const g = stairGeometry(p);
  saved.set(p, g);
  return g;
}

/** Var planens snitt går över trappan (sträckan längs gånglinjen), eller längden när allt ligger under. */
export function cutAlong(g: StairGeometry, lv: number, cut: number | undefined): number {
  if (cut === undefined) return g.length;
  const it = g.items.find((i) => i.kind !== 'startTread' && lv + i.z > cut + 0.5);
  return it ? it.u0 : g.length;
}

const line = (a: Vec2, b: Vec2, pen: Pen, origin: Origin): Primitive => ({ kind: 'line', a, b, pen, origin });
const poly = (points: Vec2[], pen: Pen, origin: Origin): Primitive => ({ kind: 'polyline', points, closed: false, pen, origin });

/** Trappans plan: det egna våningsplanet (`own`) med snittet, annars hel som i våningen ovanför. */
function stairPlan(el: Element<any>, ctx: PlanContext, p: StairParams, g: StairGeometry, own: boolean): Primitive[] {
  const out: Primitive[] = [];
  const pen = (k: StairPenKey) => stairPen(ctx.style, k);
  const o = (part: string): Origin => ({ objectId: el.id, objectType: 'Stair', part });
  const lv = levelOf(p);
  const L = g.length;
  const uCut = own ? cutAlong(g, lv, planCutHeight(ctx)) : L;
  const a = p.start === 'tread' ? g.items[0]?.u1 ?? 0 : 0;
  const endTread = g.items.find((i) => i.kind === 'endTread');
  const b0 = endTread ? endTread.u0 : L;
  const contour = pen('stairContour');
  const above = pen('stairAbove');
  const floor = pen('stairFloorTread');
  // Sidorna: plansteget i golvet, det under snittet, det ovanför (och i våningen ovanför det sista plansteget i golvet).
  const spans: { u0: number; u1: number; pen: Pen; part: string }[] = [];
  if (a > 0) spans.push({ u0: 0, u1: a, pen: floor, part: 'plansteg' });
  const top = !own && endTread ? b0 : L;
  if (Math.min(uCut, top) - a > 0.5) spans.push({ u0: a, u1: Math.min(uCut, top), pen: contour, part: 'kontur' });
  if (own && uCut < L - 0.5) spans.push({ u0: Math.max(a, uCut), u1: L, pen: above, part: 'över' });
  if (!own && endTread) spans.push({ u0: b0, u1: L, pen: floor, part: 'plansteg' });
  for (const s of spans) for (const side of ['left', 'right'] as const) out.push(poly(sideBetween(g, side, s.u0, s.u1), s.pen, o(s.part)));
  // Början och slutet.
  const r0 = g.ribAt(0);
  out.push(line(r0.L, r0.R, a > 0 ? floor : contour, o(a > 0 ? 'plansteg' : 'kontur')));
  const rL = g.ribAt(L);
  out.push(line(rL.L, rL.R, own && uCut < L - 0.5 ? above : !own && endTread ? floor : contour, o('slut')));
  // Stegens framkanter.
  const below = pen('stairBelow');
  for (const u of g.risers) {
    if (u < 0.5 || u > L - 0.5) continue;
    const r = g.ribAt(u);
    const up = own && u >= uCut - 0.5;
    out.push(line(r.L, r.R, up ? above : below, o(up ? 'över' : 'steg')));
  }
  // Stegnosen (i Detalj): sättsteget under nosen, 30 mm innanför stegets framkant.
  if ((ctx.view.detail ?? 'normal') === 'detail') {
    const nosing = pen('stairNosing');
    for (const it of g.items) {
      if (it.kind === 'startTread' || it.u1 - it.u0 < 60 || (own && it.u0 >= uCut - 0.5)) continue;
      const r = g.ribAt(it.u0 + 30);
      out.push(line(r.L, r.R, nosing, o('stegnos')));
    }
  }
  // Snittlinjen snett över trappan.
  if (own && uCut < L - 0.5) {
    const d = Math.min(g.width * 0.35, 250);
    const s = g.ribAt(Math.max(0, uCut - d));
    const e = g.ribAt(Math.min(L, uCut + d));
    const ext = (q: Vec2, from: Vec2): Vec2 => [q[0] + (q[0] - from[0]) * 0.08, q[1] + (q[1] - from[1]) * 0.08];
    out.push(line(ext(s.L, e.R), ext(e.R, s.L), pen('stairCut'), o('snittlinje')));
  }
  // Gångriktningen: ring i början, pil i slutet.
  const walk = pen('stairWalk');
  const ring = 1.25 * ctx.scale;
  const start = g.ribAt(0).w;
  const dir0 = walkDir(g, 0);
  const centre: Vec2 = [start[0] + dir0[0] * ring, start[1] + dir0[1] * ring];
  for (const s of [0, Math.PI]) out.push({ kind: 'arc', center: centre, radius: ring, start: s, end: s + Math.PI, pen: walk, origin: o('gånglinje') });
  const pts = walkBetween(g, Math.min(L * 0.5, ring * 2), L);
  out.push(poly(pts, walk, o('gånglinje')));
  const tip = pts[pts.length - 1];
  const dir1 = walkDir(g, L);
  const head = 3 * ctx.scale;
  for (const s of [1, -1]) {
    const ang = (s * 25 * Math.PI) / 180;
    const back: Vec2 = [-(dir1[0] * Math.cos(ang) - dir1[1] * Math.sin(ang)), -(dir1[0] * Math.sin(ang) + dir1[1] * Math.cos(ang))];
    out.push(line(tip, [tip[0] + back[0] * head, tip[1] + back[1] * head], walk, o('gånglinje')));
  }
  return out;
}

/** Trappans kropp i 3D: ett block per steg med sned undersida, vilplan och sista plansteg som plattor. */
export function stairSolids(id: string, p: StairParams, g: StairGeometry, mat: Partial<Solid> = {}): Solid[] {
  const t = Math.max(20, p.thickness ?? STAIR_THICKNESS);
  const h = g.riserHeight;
  const out: Solid[] = [];
  for (const it of g.items) {
    if (it.kind === 'startTread') continue;
    const ring = bandBetween(g, it.u0, it.u1);
    if (ring.length < 3) continue;
    if (it.kind !== 'tread') {
      out.push({ id, rings: [ring], z0: Math.max(0, it.z - t), z1: it.z, material: 'slab', ...mat });
      continue;
    }
    const run = g.runs[it.run ?? 0];
    const k = h / Math.max(1, run.going);
    const dir = walkDir(g, (it.u0 + it.u1) / 2);
    const w0 = g.ribAt(it.u0).w;
    const waist = t * Math.sqrt(1 + k * k);
    const c = it.z - h - waist - k * dot(w0, dir);
    const plane: Plane = [k * dir[0], k * dir[1], c];
    const zs = ring.map((q) => plane[0] * q[0] + plane[1] * q[1] + plane[2]);
    const low = Math.min(...zs);
    if (low < 0 || Math.max(...zs) >= it.z - 1) out.push({ id, rings: [ring], z0: Math.max(0, Math.min(it.z - t, low)), z1: it.z, material: 'slab', ...mat });
    else out.push({ id, rings: [ring], z0: low, z1: it.z, bottom: plane, material: 'slab', ...mat });
  }
  return out;
}

/**
 * Hålet som trappan tar i ett bjälklag på våningen ovanför (0.11):
 * trappans band från det första steg där den fria höjden (2100 från
 * början) inte räcker till bjälklagets undersida, till trappans slut.
 * `top` och `thickness` är bjälklagets ovansida mot sin våning och tjocklek.
 */
export function stairHoleIn(doc: ProjectDoc, stair: Element<any>, slabStorey: Id, top: number, thickness: number, ignoreNone = false): Vec2[] | null {
  const here = doc.storeys.find((s) => s.id === slabStorey);
  const home = doc.storeys.find((s) => s.id === stair.storey);
  if (!here || !home || storeyAbove(doc, home.id)?.id !== here.id) return null;
  const p = stairParams(doc, stair);
  if (p.hole === 'none' && !ignoreNone) return null;
  const g = geometryOfStair(p);
  if (!g) return null;
  const under = here.elevation - home.elevation + top - thickness - levelOf(p);
  const head = p.headroom ?? HEADROOM;
  const it = g.items.find((i) => i.z + head > under + 0.5);
  if (!it) return null;
  const ring = bandBetween(g, it.u0, g.length);
  return ring.length >= 3 ? ring : null;
}

/** Hålen som trapporna på våningen under tar i bjälklaget (det som visas, utan det som rivs). */
export function stairHoles(ctx: PlanContext, slab: Element<any>, top: number, thickness: number): Vec2[][] {
  const doc = ctx.doc;
  const below = storeyBelow(doc, slab.storey);
  if (!below) return [];
  const out: Vec2[][] = [];
  for (const st of Object.values(doc.elements)) {
    if (st.type !== 'Stair' || st.storey !== below.id || st.space) continue;
    const act = ctx.actionOf(st);
    if (act === 'absent' || act === 'demolished') continue;
    const ring = stairHoleIn(doc, st, slab.storey, top, thickness);
    if (ring) out.push(ring);
  }
  return out;
}

export const stairType: ElementType<StairParams> = {
  type: 'Stair',
  planReads: [],
  label: 'Trappa',
  labelPlural: 'Trappor',
  litteraPrefix: 'TR',
  drawOrder: 12,
  compares: true,
  defaults: () => ({ line: [], width: STAIR_WIDTH, rise: 2700 }),
  storeyParams: (s) => ({ rise: s.height }),
  alsoOnStorey: (el, doc, storey) => storeyAbove(doc, el.storey)?.id === storey,
  pickShape(el, ctx) {
    const g = geometryOfStair(stairParams(ctx.doc, el));
    return g ? [[stairOutline(g)]] : [];
  },
  plan(el, ctx) {
    const p = stairParams(ctx.doc, el);
    const g = geometryOfStair(p);
    if (!g) return [];
    return stairPlan(el, ctx, p, g, !ctx.storey || el.storey === ctx.storey);
  },
  model3d(el, ctx) {
    const p = stairParams(ctx.doc, el);
    const g = geometryOfStair(p);
    if (!g) return [];
    const lv = levelOf(p);
    const mat = materialSolid(buildingMaterialOf(p as never, ctx.style));
    return stairSolids(el.id, p, g, mat).map((s): Shape3D => (lv ? { ...s, z0: s.z0 + lv, z1: s.z1 + lv, ...(s.bottom ? { bottom: [s.bottom[0], s.bottom[1], s.bottom[2] + lv] as Plane } : {}) } : s));
  },
};

/** Förvald bredd, för verktyget. */
export { STAIR_WIDTH };
