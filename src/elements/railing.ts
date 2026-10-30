import type { Element, Id, ProjectDoc } from '../core/model';
import { defaultRailingTypes, railingModel, railNum, railValues, type RailingTypeModel, type RailPart } from '../core/railingTypes';
import { dist, norm, sub } from '../geometry/vec';
import { railPen, type RailPenKey } from '../repr/railingPens';
import type { Origin, Pen, Primitive, Vec2 } from '../repr/primitives';
import { levelOf, type Material3D, type Plane, type Shape3D, type Solid } from '../repr/solids';
import { buildingMaterialOf, materialSolid } from './buildingMaterial';
import { offsetLine, stripRing } from './groundLines';
import { planCutHeight } from './planCut';
import { freePath, hostedPath, railingBody, withExtension, type AlongPiece, type PanelPiece, type PostPiece, type RailingBody, type RailingParams, type RailPath } from './railingGeometry';
import { resolveParams, type ElementType, type PlanContext } from './registry';
import { geometryOfStair, stairParams, storeyAbove } from './stair';

/**
 * Räcket (0.11.1): ett eget objekt för räcken, ledstänger, staket, stängsel
 * och spaljéer, med typ och littera (RÄ01 …). Referenslinjen är ritad fritt
 * eller hänger på en trappas kant (elementets `host` är trappan), och följer
 * då trappan. Typen (`Definition.railing`) är en lista med delar och
 * parametrar; räcket kan ha egna värden för de parametrar typen tillåter.
 * Geometrin ligger i `railingGeometry.ts`.
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
 * Räckets linje i 3D, med höjderna mot räckets våning: längs trappans kant
 * (från trappans fot plus fotens nivå) eller den ritade linjen.
 */
export function railingPath(doc: ProjectDoc, el: Element<any>): RailPath | null {
  const p = resolveParams<RailingParams>(doc, el);
  const stair = railingStair(doc, el);
  const sp = stair ? stairParams(doc, stair) : undefined;
  const key = [p, sp];
  const hit = savedPath.get(el);
  if (hit && hit.key.length === key.length && hit.key.every((k, i) => k === key[i])) return hit.path;
  let path: RailPath | null = null;
  if (stair && sp && p.host) {
    const g = geometryOfStair(sp);
    const raw = g ? hostedPath(g, p, p.host) : null;
    const lv = levelOf(sp);
    path = raw && lv ? { ...raw, z: raw.z.map((z) => z + lv) } : raw;
  } else if (!p.host) path = freePath(p);
  savedPath.set(el, { key, path });
  return path;
}

/** Räcket med typens delar längs linjen. */
export function railingBodyOf(doc: ProjectDoc, el: Element<any>): { path: RailPath; body: RailingBody } | null {
  const path = railingPath(doc, el);
  if (!path) return null;
  return { path, body: railingBody(path, railingTypeOf(doc, el), railingValues(doc, el)) };
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

// ---------- Planen ----------

const RANK = { sketch: 0, normal: 1, detail: 2 } as const;

/** Lägsta detaljnivån en del ritas i (stolpar, spjälor och ytor i Detalj). */
const partDetail = (part: RailPart): keyof typeof RANK => part.detail ?? 'detail';

/** Linjen i bitar efter om de ligger över planens snitt (höjden mitt på biten). */
function splitAbove(pts: readonly Vec2[], zs: readonly number[], cut: number | undefined): { pts: Vec2[]; above: boolean }[] {
  const out: { pts: Vec2[]; above: boolean }[] = [];
  const add = (a: Vec2, b: Vec2, above: boolean) => {
    const last = out[out.length - 1];
    if (last && last.above === above) last.pts.push(b);
    else out.push({ pts: [a, b], above });
  };
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (dist(a, b) < 1e-6) continue;
    const z0 = zs[i - 1];
    const z1 = zs[i];
    // En bit som går genom snittet delas där.
    if (cut !== undefined && (z0 - cut - 0.5) * (z1 - cut - 0.5) < 0) {
      const t = (cut + 0.5 - z0) / (z1 - z0);
      const m: Vec2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      add(a, m, z0 > cut + 0.5);
      add(m, b, z1 > cut + 0.5);
      continue;
    }
    add(a, b, cut !== undefined && (z0 + z1) / 2 > cut + 0.5);
  }
  return out;
}

/** En stolpe eller spjäla ovanifrån: rektangeln i linjens riktning, eller en åttahörning. */
function postRing(q: PostPiece): Vec2[] {
  if (q.round) {
    const r = q.w / 2;
    return Array.from({ length: 8 }, (_, k): Vec2 => [q.at[0] + r * Math.cos((k * Math.PI) / 4), q.at[1] + r * Math.sin((k * Math.PI) / 4)]);
  }
  const d = q.dir;
  const n: Vec2 = [-d[1], d[0]];
  const a = q.w / 2;
  const b = q.d / 2;
  return [
    [q.at[0] - d[0] * a - n[0] * b, q.at[1] - d[1] * a - n[1] * b],
    [q.at[0] + d[0] * a - n[0] * b, q.at[1] + d[1] * a - n[1] * b],
    [q.at[0] + d[0] * a + n[0] * b, q.at[1] + d[1] * a + n[1] * b],
    [q.at[0] - d[0] * a + n[0] * b, q.at[1] - d[1] * a + n[1] * b],
  ];
}

/** Räckets plan: en linje i Skiss och Normal (med ledstångens förlängning i Normal), delarna i Detalj. */
function railingPlan(el: Element<any>, ctx: PlanContext, own: boolean): Primitive[] {
  const r = railingBodyOf(ctx.doc, el);
  if (!r) return [];
  const { path, body } = r;
  const out: Primitive[] = [];
  const o = (part: string): Origin => ({ objectId: el.id, objectType: 'Railing', part });
  const pen = (k: string | undefined, fallback: RailPenKey): Pen => railPen(ctx.style, (k && k.startsWith('rail') ? k : fallback) as RailPenKey);
  const detail = RANK[ctx.view.detail ?? 'normal'];
  const cut = own ? planCutHeight(ctx) : undefined;
  const above = pen('railAbove', 'railAbove');
  const draw = (pts: Vec2[], zs: number[], p: Pen, part: string) => {
    for (const run of splitAbove(pts, zs, cut)) out.push({ kind: 'polyline', points: run.pts, closed: false, pen: run.above ? above : p, origin: o(run.above ? 'över' : part) });
  };
  const contour = pen('railContour', 'railContour');
  const along = body.along;
  const drawnInDetail = (a: AlongPiece) => detail >= RANK.detail && detail >= RANK[partDetail(a.part)];
  // Linjen: i Skiss och Normal, och i Detalj när ingen längsgående del ritas.
  if (detail < RANK.detail || !along.some(drawnInDetail)) draw(path.pts, path.z, contour, 'kontur');
  for (const a of along) {
    const ext = withExtension(a);
    const zs = ext.pts.length > a.pts.length ? [path.z[0], ...path.z, path.z[path.z.length - 1]] : path.z;
    const p = pen(a.part.pen, 'railHandrail');
    if (drawnInDetail(a)) {
      for (const side of [1, -1]) draw(offsetLine(dedupe(ext.pts), (side * a.w) / 2), dedupeZ(ext.pts, zs), p, a.part.id);
      if (a.ext > 0)
        for (const [i, j] of [
          [0, 1],
          [ext.pts.length - 1, ext.pts.length - 2],
        ]) {
          const q = ext.pts[i];
          const d = norm(sub(q, ext.pts[j]));
          const n: Vec2 = [-d[1] * (a.w / 2), d[0] * (a.w / 2)];
          out.push({ kind: 'line', a: [q[0] + n[0], q[1] + n[1]], b: [q[0] - n[0], q[1] - n[1]], pen: cut !== undefined && zs[i] > cut + 0.5 ? above : p, origin: o(a.part.id) });
        }
    } else if (detail >= RANK.normal && a.ext > 0 && ext.pts.length > a.pts.length) {
      // Ledstångens förlängning förbi trappan.
      const n = ext.pts.length;
      draw([ext.pts[0], ext.pts[1]], [zs[0], zs[1]], pen(a.part.pen, 'railGrab'), a.part.id);
      draw([ext.pts[n - 2], ext.pts[n - 1]], [zs[n - 2], zs[n - 1]], pen(a.part.pen, 'railGrab'), a.part.id);
    }
  }
  if (detail >= RANK.detail) {
    for (const q of body.posts) {
      if (detail < RANK[partDetail(q.part)]) continue;
      const up = cut !== undefined && q.z0 > cut + 0.5;
      out.push({ kind: 'polyline', points: postRing(q), closed: true, pen: up ? above : pen(q.part.pen, 'railPost'), origin: o(q.part.id) });
    }
  }
  return out;
}

const dedupe = (pts: readonly Vec2[]): Vec2[] => pts.filter((q, i) => i === 0 || dist(q, pts[i - 1]) > 1e-6);
const dedupeZ = (pts: readonly Vec2[], zs: readonly number[]): number[] => zs.filter((_, i) => i === 0 || dist(pts[i], pts[i - 1]) > 1e-6);

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
    return railingPlan(el, ctx, !ctx.storey || el.storey === ctx.storey);
  },
  model3d(el, ctx) {
    const r = railingBodyOf(ctx.doc, el);
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

// ---------- Varningarna ----------

/**
 * Varningarna (0.11.1), som aldrig spärrar: BFS 2024:9 där det är
 * föreskrift, och *avviker från praxis* för det vedertagna (höjderna,
 * öppningarna, förlängningen och avvikelsen vid kilstegen). Uppslaget i
 * utredningen 30 oktober 2026.
 */
export function railingWarnings(doc: ProjectDoc, el: Element<any>): string[] {
  const out: string[] = [];
  const mm = (v: number) => `${Math.round(v).toLocaleString('sv-SE')} mm`;
  const model = railingTypeOf(doc, el);
  const vals = railingValues(doc, el);
  const p = el.params as RailingParams;
  const stair = railingStair(doc, el);
  const path = railingPath(doc, el);
  const n = (v: RailPart['z'], f = 0) => railNum(v, vals, f);
  const guard = vals.get('Skyddshöjd');
  if (guard !== undefined && model.group !== 'Ledstänger') {
    if (stair && guard < 900 - 0.5) out.push(`Skyddshöjden är ${mm(guard)}; avviker från praxis (900 mm i trappor).`);
    if (!stair && model.group === 'Räcken' && guard < 1100 - 0.5) out.push(`Skyddshöjden är ${mm(guard)}; avviker från praxis (1 100 mm vid ett trapphål eller en kant med fallhöjd).`);
  }
  const grabs = model.parts.filter((q) => q.kind === 'along' && (q.pen === 'railGrab' || /ledstång/i.test(q.name)));
  if (stair)
    for (const q of grabs) {
      const h = n(q.z, 900);
      if (h < 800 - 0.5 || h > 1000 + 0.5) {
        out.push(`${q.name} sitter ${mm(h)} över stegnosen; avviker från praxis (800–1 000 mm).`);
        break;
      }
    }
  if (model.childSafe) {
    const gaps = model.parts.filter((q) => q.kind === 'repeat').map((q) => n(q.spacing, 100));
    const widest = Math.max(0, ...gaps);
    if (widest > 100.5) out.push(`Barnsäkert (BFS 2024:9, 2 kap. 11 §): öppningarna mellan ${model.parts.find((q) => q.kind === 'repeat')!.name.toLowerCase()} är ${mm(widest)}; avviker från praxis (högst 100 mm).`);
    const infill = model.parts.some((q) => q.kind === 'repeat' || q.kind === 'surface');
    if (!infill) out.push('Barnsäkert (BFS 2024:9, 2 kap. 11 §): räcket har varken spjälor eller fyllning under handledaren; avviker från praxis (öppningar högst 100 mm).');
    // Glipan under räcket: den lägsta delens underkant.
    const lows = model.parts.map((q) => (q.kind === 'along' ? n(q.z, 900) - (q.profile?.shape === 'round' ? q.profile.w : q.profile?.h ?? q.profile?.w ?? 40) : n(q.from)));
    const low = Math.min(...lows.filter((v) => Number.isFinite(v)), Infinity);
    const allowed = stair ? 50 : 100;
    if (infill && low > allowed + 0.5) out.push(`Barnsäkert (BFS 2024:9, 2 kap. 11 §): glipan under räcket är ${mm(low)} ${stair ? 'över stegnosen' : 'över golvet'}; avviker från praxis (högst ${allowed} mm).`);
    const climb = model.parts.filter((q) => q.kind === 'along' && q !== grabs[0]).map((q) => n(q.z, 900)).filter((z) => z > 150 && z < 800);
    if (climb.length) out.push(`Barnsäkert (BFS 2024:9, 2 kap. 11 §): en liggare ${mm(climb[0])} upp går att klättra på; avviker från praxis (inga fotsteg under 800 mm).`);
  }
  if (stair && grabs.length) {
    const g = geometryOfStair(stairParams(doc, stair));
    const from = p.host?.from ?? 0;
    const to = p.host?.to ?? g?.length ?? 0;
    if (g && (from > 1 || to < g.length - 1)) out.push('Ledstången går inte hela trappan; BFS 2024:9, 2 kap. 13 §: kontinuerlig ledstång, med stöd före och efter trappan.');
    const ext = Math.min(...grabs.map((q) => n(q.extend)));
    if (ext < 300 - 0.5) out.push(`Ledstången förlängs ${mm(ext)} förbi trappan (BFS 2024:9, 2 kap. 13 §: stöd före och efter); avviker från praxis (300 mm).`);
  }
  if (path?.winderDeviation && path.winderDeviation > 50.5) out.push(`Den utjämnade handledaren avviker upp till ${mm(path.winderDeviation)} från höjden över stegnosen vid kilstegen; avviker från praxis (högst 50 mm). Välj Hoppande för exakt höjd.`);
  return out;
}

/**
 * Trappans varning för ledstången (BFS 2024:9, 2 kap. 12 §: ledstång på
 * båda sidor), som kan kvitteras på trappan (`ack: ['handrails']`).
 */
export function stairHandrailWarning(doc: ProjectDoc, stair: Element<any>): string | null {
  if (((stair.params.ack as string[] | undefined) ?? []).includes('handrails')) return null;
  const on = railingsOnStair(doc, stair.id);
  const missing = (['left', 'right'] as const).filter((s) => !on[s].length);
  if (!missing.length) return null;
  const name = missing.length === 2 ? 'båda sidorna saknar' : `${missing[0] === 'left' ? 'vänster' : 'höger'} sida saknar`;
  return `Ledstång på båda sidor (BFS 2024:9, 2 kap. 12 §): ${name} räcke eller ledstång. Lägg till med Räcke längs kanten i smartmenyn, eller kvittera.`;
}

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
      const t = Math.max(0, Math.min(1, ((at[0] - a[0]) * (b[0] - a[0]) + (at[1] - a[1]) * (b[1] - a[1])) / (l * l)));
      const q: Vec2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const d = dist(q, at);
      if (d < best.d) best = { d, s: acc + t * l, q };
    }
    acc += l;
  }
  return best;
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
      let z = path.z[path.z.length - 1];
      for (let i = 1; i < path.s.length; i++)
        if (near.s <= path.s[i] + 1e-6) {
          const l = path.s[i] - path.s[i - 1];
          z = l < 1e-9 ? path.z[i] : path.z[i - 1] + ((path.z[i] - path.z[i - 1]) * (near.s - path.s[i - 1])) / l;
          break;
        }
      out.push({ stair: st, side, pts: dedupe(path.pts), at: near.q, z: z + levelOf(sp), d: near.d });
    }
  }
  return out.sort((a, b) => a.d - b.d);
}
