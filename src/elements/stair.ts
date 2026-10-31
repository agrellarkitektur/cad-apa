import { storeysUpFrom, type Element, type Id, type ProjectDoc, type Storey } from '../core/model';
import { dot } from '../geometry/vec';
import type { Origin, Pen, Primitive, Vec2 } from '../repr/primitives';
import { levelOf, type Plane, type Shape3D, type Solid } from '../repr/solids';
import { stairPen, type StairPenKey } from '../repr/stairPens';
import { buildingMaterialOf, materialSolid } from './buildingMaterial';
import { planCutHeight } from './planCut';
import { resolveParams, type ElementType, type PlanContext } from './registry';
import { bandBetween, HEADROOM, spiralDims, sideBetween, stairGeometry, stairOutline, STAIR_THICKNESS, STAIR_WIDTH, walkBetween, walkDir, type StairGeometry, type StairParams } from './stairGeometry';
import { BUILT, builtDims, builtSolids, contrastItems, contrastSolids, insetRib, stringerInsets, stringerLine } from './stairBuilt';
import { liftShape } from '../repr/solids';

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

/** En vinkel som ger läsbar text (inte upp och ned). */
const upright = (a: number): number => (Math.cos(a) < -1e-6 ? a + Math.PI : a);
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
  // Spiraltrappan (0.11.5): det som ligger under snittet och mer än ett varv
  // under det (eller, i våningen ovanför, under trappans sista varv) syns
  // inte; stegen ovanför täcker det. `hid` är sträckan dit det är dolt.
  const hid = g.turn ? Math.max(0, (own ? uCut : L) - g.turn) : 0;
  const shown = (u: number) => u >= hid - 0.5 || (own && u >= uCut - 0.5);
  // Sidorna: plansteget i golvet, det under snittet, det ovanför (och i våningen ovanför det sista plansteget i golvet).
  const spans: { u0: number; u1: number; pen: Pen; part: string }[] = [];
  if (a > hid) spans.push({ u0: hid, u1: a, pen: floor, part: 'plansteg' });
  const top = !own && endTread ? b0 : L;
  if (Math.min(uCut, top) - Math.max(a, hid) > 0.5) spans.push({ u0: Math.max(a, hid), u1: Math.min(uCut, top), pen: contour, part: 'kontur' });
  if (own && uCut < L - 0.5) spans.push({ u0: Math.max(a, uCut), u1: L, pen: above, part: 'över' });
  if (!own && endTread) spans.push({ u0: Math.max(b0, hid), u1: L, pen: floor, part: 'plansteg' });
  for (const s of spans) for (const side of ['left', 'right'] as const) out.push(poly(sideBetween(g, side, s.u0, s.u1), s.pen, o(s.part)));
  // Spiraltrappans mittpelare: en cirkel med innerdiametern.
  const pole = poleOf(p, g);
  if (pole) out.push({ kind: 'arc', center: pole.c, radius: pole.r, start: 0, end: 2 * Math.PI, pen: contour, origin: o('pelare') });
  // Början och slutet.
  const r0 = g.ribAt(0);
  if (hid < 0.5) out.push(line(r0.L, r0.R, a > 0 ? floor : contour, o(a > 0 ? 'plansteg' : 'kontur')));
  const rL = g.ribAt(L);
  out.push(line(rL.L, rL.R, own && uCut < L - 0.5 ? above : !own && endTread ? floor : contour, o('slut')));
  // Den byggda trappan (0.11.4): stegen mellan vangstyckena, och vangstyckenas insida i Normal och Detalj.
  const detail = ctx.view.detail ?? 'normal';
  const built = p.build === 'built';
  const dims = built ? builtDims(p) : null;
  const ins = dims ? stringerInsets(dims) : { left: 0, right: 0 };
  const across = (u: number): [Vec2, Vec2] => insetRib(g.ribAt(u), ins.left, ins.right);
  if (dims && detail !== 'sketch') {
    const b1 = endTread ? b0 : L;
    for (const side of ['left', 'right'] as const) {
      const w = ins[side];
      if (!w) continue;
      const under = Math.min(uCut, b1);
      const from = Math.max(a, hid);
      if (under - from > 0.5) out.push(poly(stringerLine(g, side, w, from, under, sideBetween), pen('stairStringer'), o('vangstycke')));
      if (own && uCut < b1 - 0.5) out.push(poly(stringerLine(g, side, w, Math.max(a, uCut), b1, sideBetween), above, o('över')));
    }
  }
  // Stegens framkanter.
  const below = pen('stairBelow');
  for (const u of g.risers) {
    if (u < 0.5 || u > L - 0.5 || !shown(u)) continue;
    const [l, r] = across(u);
    const up = own && u >= uCut - 0.5;
    out.push(line(l, r, up ? above : below, o(up ? 'över' : 'steg')));
  }
  if (detail === 'detail') {
    // Stegnosen: sättsteget under nosen (30 mm innanför framkanten, i den byggda trappan dess stegnos; en öppen trappa har inget).
    const nos = dims ? (dims.riserThickness > 0 ? dims.nosing : 0) : 30;
    if (nos > 0.5) {
      const nosing = pen('stairNosing');
      for (const it of g.items) {
        if (it.kind === 'startTread' || it.u1 - it.u0 < 2 * nos || (own && it.u0 >= uCut - 0.5) || it.u0 < hid - 0.5) continue;
        const [l, r] = across(it.u0 + nos);
        out.push(line(l, r, nosing, o('stegnos')));
      }
    }
    // Kontrastmarkeringen: bakkanten på remsan.
    const cw = Math.max(10, p.contrastWidth ?? BUILT.contrastWidth);
    for (const it of contrastItems(g, p.contrast)) {
      if (it.u1 - it.u0 < cw + 1 || (own && it.u0 >= uCut - 0.5) || it.u0 < hid - 0.5) continue;
      const [l, r] = across(it.u0 + cw);
      out.push(line(l, r, pen('stairContrast'), o('kontrast')));
    }
    // Bygghandlingsgrafiken: stegens nummer nerifrån och texten med antal, steghöjd och stegdjup.
    const text = pen('stairText');
    const numbered = g.items.filter((i) => i.kind !== 'startTread');
    numbered.forEach((it, k) => {
      if (!shown(it.u0)) return;
      const rib = g.ribAt((it.u0 + it.u1) / 2);
      const far = Math.hypot(rib.w[0] - rib.L[0], rib.w[1] - rib.L[1]) > Math.hypot(rib.w[0] - rib.R[0], rib.w[1] - rib.R[1]) ? rib.L : rib.R;
      // Spiraltrappan: ett varv högre upp står numret på andra sidan gånglinjen, så att det inte hamnar på numret under.
      const k2 = g.turn && Math.floor((it.u0 - hid + 1) / g.turn) % 2 === 1 ? -0.4 : 0.45;
      const at: Vec2 = [rib.w[0] + (far[0] - rib.w[0]) * k2, rib.w[1] + (far[1] - rib.w[1]) * k2];
      out.push({ kind: 'text', at, text: String(k + 1), height: 1.8, align: 'middle', pen: text, origin: o('stegnummer') });
    });
    const run = g.runs[0];
    if (run) {
      const going = Math.min(...g.runs.map((x) => x.going));
      const h = g.riserHeight;
      // Texten längs gånglinjen i början, på samma sida som stegnumren men närmare kanten.
      const um = g.turn ? Math.min(L - going, Math.max(hid, run.u0) + going * 2.5) : Math.min(L / 2, Math.max(run.u0 + going * 2, L * 0.2));
      const rib = g.ribAt(um);
      const d = walkDir(g, um);
      const far = Math.hypot(rib.w[0] - rib.L[0], rib.w[1] - rib.L[1]) > Math.hypot(rib.w[0] - rib.R[0], rib.w[1] - rib.R[1]) ? rib.L : rib.R;
      let at: Vec2 = [rib.w[0] + (far[0] - rib.w[0]) * 0.8, rib.w[1] + (far[1] - rib.w[1]) * 0.8];
      if (g.turn) {
        // Spiraltrappan: utanför ytterkanten, så att texten inte hamnar på stegens nummer.
        const near = far === rib.L ? rib.R : rib.L;
        const e = Math.hypot(near[0] - rib.w[0], near[1] - rib.w[1]) || 1;
        const k = (e + 1.5 * ctx.scale) / e;
        at = [rib.w[0] + (near[0] - rib.w[0]) * k, rib.w[1] + (near[1] - rib.w[1]) * k];
      }
      const fmt = (v: number) => v.toLocaleString('sv-SE', { maximumFractionDigits: 1 });
      out.push({ kind: 'text', at, text: `${g.risers.length} st à ${fmt(h)}/${Math.round(going)}`, height: 2, align: 'middle', angle: g.turn ? upright(Math.atan2(d[1], d[0])) : Math.atan2(d[1], d[0]), pen: text, origin: o('stegtext') });
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
  const start = g.ribAt(hid).w;
  const dir0 = walkDir(g, hid);
  const centre: Vec2 = [start[0] + dir0[0] * ring, start[1] + dir0[1] * ring];
  for (const s of [0, Math.PI]) out.push({ kind: 'arc', center: centre, radius: ring, start: s, end: s + Math.PI, pen: walk, origin: o('gånglinje') });
  const pts = walkBetween(g, hid + Math.min((L - hid) * 0.5, ring * 2), L);
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

/** Spiraltrappans mittpelare (0.11.5): mitten och radien, när innerdiametern är minst 50 mm. */
export function poleOf(p: StairParams, g: StairGeometry): { c: Vec2; r: number } | null {
  if (!p.spiral || !g.centre) return null;
  const r = spiralDims(p.spiral).inner / 2;
  return r >= 25 ? { c: g.centre, r } : null;
}

/** Mittpelaren i 3D, från golvet till trappans topp. */
function poleSolid(id: string, p: StairParams, g: StairGeometry, mat: Partial<Solid>): Solid[] {
  const pole = poleOf(p, g);
  if (!pole) return [];
  const ring = Array.from({ length: 24 }, (_, k): Vec2 => [pole.c[0] + pole.r * Math.cos((k * Math.PI) / 12), pole.c[1] + pole.r * Math.sin((k * Math.PI) / 12)]);
  return [{ id, rings: [ring], z0: 0, z1: g.rise, material: 'slab', ...mat }];
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
  // Spiraltrappan (0.11.5): ett helt varv eller mer blir ett runt hål med ytterdiametern.
  if (g.turn && g.centre && g.outerRadius && g.length - it.u0 > g.turn * 0.97) {
    const c = g.centre;
    const r = g.outerRadius;
    return Array.from({ length: 64 }, (_, k): Vec2 => [c[0] + r * Math.cos((k * Math.PI) / 32), c[1] + r * Math.sin((k * Math.PI) / 32)]);
  }
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
    if (!g) return [];
    // Spiraltrappan i bitar om högst ett halvt varv, så att konturen inte korsar sig själv.
    if (!g.turn) return [[stairOutline(g)]];
    const n = Math.max(1, Math.ceil((g.length / g.turn) * 2));
    return Array.from({ length: n }, (_, i) => [bandBetween(g, (g.length * i) / n, (g.length * (i + 1)) / n)]);
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
    const body = p.build === 'built' ? builtSolids(el.id, p, g, ctx.style) : stairSolids(el.id, p, g, mat);
    const poleMat: Partial<Solid> = p.build === 'built' ? { color: '#ece8df' } : mat;
    return [...body, ...poleSolid(el.id, p, g, poleMat), ...contrastSolids(el.id, p, g)].map((s): Shape3D => liftShape(s, lv));
  },
};

/** Förvald bredd, för verktyget. */
export { STAIR_WIDTH };
