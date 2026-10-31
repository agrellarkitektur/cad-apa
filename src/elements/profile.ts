import type { Element, ProjectDoc } from '../core/model';
import { anchorPoint, defaultEnd, defaultProfileTypes, profileModel, profileSection, profileValues, type ProfileTypeModel, type SubProfile } from '../core/profileTypes';
import type { Rings } from '../geometry/boolean';
import { profilePen } from '../repr/profilePens';
import type { Origin, Primitive, Vec2 } from '../repr/primitives';
import type { Shape3D, Solid } from '../repr/solids';
import { buildingMaterialOf, materialSolid } from './buildingMaterial';
import { materialCutFill, materialCutPrims } from './fill2d';
import { flatLine } from './groundLines';
import { planCutHeight } from './planCut';
import { hull, merged, partRegions, placePoint, sliceAt, solidsOf, sweep, type EndSpec, type SweepResult, type Vec3 } from './profileBody';
import { resolveParams, type ElementType, type PlanContext } from './registry';

/**
 * Profilen (0.11.6): ett tvärsnitt ur en profiltyp (PR01 …) svept längs en
 * bana, för pelare, balkar, lister, gesimser, taktassar och liknande. Ett
 * verktyg för allt med "follow me"-geometri. Banan är en linje med punkter i
 * X, Y och Z (med bågar), eller lodrät (en pelare: en punkt och en höjd).
 * Svepningen ligger i `profileBody.ts`, typen i `core/profileTypes.ts`.
 */

export interface ProfileParams {
  /** `plumb`: en lodrät bana (pelare) i `line[0]` från `level` och `height` upp. Utelämnad = linjen. */
  path?: 'plumb';
  line: [number, number][];
  bulges?: number[];
  /** Höjden över golvet i varje punkt (linjen); utelämnad = 0. */
  z?: number[];
  /** Pelarens fot över golvet. */
  level?: number;
  /** Pelarens höjd; utelämnad = till våningen ovanför. */
  height?: number;
  /** Ankaret (typens nummer); utelämnat = typens förval. */
  anchor?: number;
  /** Förskjutning från ankaret i tvärsnittet: sidled och höjd, mm. */
  offset?: [number, number];
  /** Vridning kring ankaret, grader moturs. */
  rotate?: number;
  /** Speglad: tvärsnittet åt andra sidan om banan. */
  mirror?: boolean;
  /** Uppåt i tvärsnittet; utelämnad = typens (lodrätt). */
  up?: 'plumb' | 'normal';
  /** Egna värden för parametrarna typen tillåter (Höjd, Bredd …). */
  values?: Record<string, number>;
  /** Material per delprofil (delprofilens id), där typen tillåter. */
  materials?: Record<string, string>;
  /** Avsluten i början och slutet; utelämnade = typens. */
  start?: Partial<EndSpec>;
  end?: Partial<EndSpec>;
  /** Våningens höjd (förval för pelare), ur `storeyParams`; sparas inte. */
  storeyHeight?: number;
}

/** Den förvalda typen när profilen saknar en (PR01). */
const FALLBACK: ProfileTypeModel = defaultProfileTypes()[0].profile!;

/** Profiltypen för ett profilobjekt. */
export function profileTypeOf(doc: ProjectDoc, el: Element<any>): ProfileTypeModel {
  return profileModel(el.definition ? doc.definitions[el.definition] : undefined) ?? FALLBACK;
}

/** Pelarens höjd: den egna, annars till våningen ovanför. */
export function columnHeight(p: ProfileParams): number {
  return p.height ?? Math.max(100, (p.storeyHeight ?? 2700) - (p.level ?? 0));
}

/** Banan i 3D (mm, z från våningens golv): pelarens lodräta linje, eller linjen med bågarna som korta bitar och höjderna emellan. */
export function profilePath3d(p: ProfileParams): Vec3[] {
  const line = p.line ?? [];
  if (!line.length) return [];
  if (p.path === 'plumb') {
    const z0 = p.level ?? 0;
    return [
      [line[0][0], line[0][1], z0],
      [line[0][0], line[0][1], z0 + columnHeight(p)],
    ];
  }
  const { points, at } = flatLine(line, p.bulges);
  const z = (i: number) => Number(p.z?.[i]) || 0;
  const out: Vec3[] = [];
  for (let i = 0; i < line.length - 1; i++) {
    const seg = points.slice(at[i], at[i + 1] + 1);
    let total = 0;
    for (let k = 1; k < seg.length; k++) total += Math.hypot(seg[k][0] - seg[k - 1][0], seg[k][1] - seg[k - 1][1]);
    let acc = 0;
    for (let k = 0; k < seg.length - 1; k++) {
      if (k) acc += Math.hypot(seg[k][0] - seg[k - 1][0], seg[k][1] - seg[k - 1][1]);
      out.push([seg[k][0], seg[k][1], z(i) + (total > 0 ? (z(i + 1) - z(i)) * (acc / total) : 0)]);
    }
  }
  const n = line.length - 1;
  out.push([line[n][0], line[n][1], z(n)]);
  return out;
}

/** Profilen svept, med typen, tvärsnittet och delprofilernas ytor (placerade). */
export interface ProfileBody {
  model: ProfileTypeModel;
  parts: SubProfile[];
  sweep: SweepResult;
  path: Vec3[];
  /** Delprofilernas ytor i tvärsnittet, placerade (ankaret, vridningen, speglingen). */
  regions: { polys: Rings[] }[];
  plumb: boolean;
}

const saved = new WeakMap<object, { key: unknown[]; body: ProfileBody | null }>();

/** Avslutet i en ände: objektets, annars typens. */
export const endOf = (model: ProfileTypeModel, e: Partial<EndSpec> | undefined): EndSpec => ({ kind: e?.kind ?? defaultEnd(model), ...(e?.angle !== undefined ? { angle: e.angle } : {}), ...(e?.beyond ? { beyond: true } : {}), ...(e?.shift ? { shift: e.shift } : {}) });

/** Profilen svept längs banan. */
export function profileBodyOf(doc: ProjectDoc, el: Element<any>): ProfileBody | null {
  const p = resolveParams<ProfileParams>(doc, el);
  const def = el.definition ? doc.definitions[el.definition] : undefined;
  const key = [p, def];
  const hit = saved.get(el);
  if (hit && hit.key.every((k, i) => k === key[i])) return hit.body;
  const model = profileTypeOf(doc, el);
  const path = profilePath3d(p);
  let body: ProfileBody | null = null;
  if (path.length >= 2) {
    const section = profileSection(model, profileValues(model, p.values));
    const a = model.anchors.find((x) => x.no === (p.anchor ?? model.anchor)) ?? model.anchors[0];
    const place = { anchor: anchorPoint(a, section.box, section.deltas), offset: p.offset, rotate: p.rotate, mirror: p.mirror };
    const regions = partRegions(section).map((r) => ({
      polys: r.polys.map((poly) => poly.map((ring) => ring.map((q) => placePoint([q[0], q[1]], place) as Vec2))) as Rings[],
      follows: r.part.followsEnd !== false,
      extend: r.part.extend ?? 0,
    }));
    const plumb = p.path === 'plumb';
    const res = sweep(regions, path, plumb ? 'plumb' : (p.up ?? model.up ?? 'plumb'), plumb ? { kind: 'square' } : endOf(model, p.start), plumb ? { kind: 'square' } : endOf(model, p.end));
    body = { model, parts: section.parts.map((x) => x.part), sweep: res, path, regions, plumb };
  }
  saved.set(el, { key, body });
  return body;
}

/** Delprofilens material: objektets, där typen tillåter, annars typens. */
export function partMaterial(p: ProfileParams, part: SubProfile): string | undefined {
  return (part.perObject !== false ? p.materials?.[part.id] : undefined) ?? part.material;
}

const RANK = { sketch: 0, normal: 1, detail: 2 } as const;

/** Profilen ovanifrån mot planens snitt: det under, det över och det snittade per delprofil. */
interface PlanShapes {
  below: Vec2[][];
  above: Vec2[][];
  cut: Map<number, Vec2[][]>;
}

/**
 * Ytorna ovanifrån. En pelare är tvärsnittet självt i punkten; en linje är
 * ett konvext hölje per rak bit (alla delprofiler), och en bit som går
 * genom snitthöjden får sitt snitt per delprofil.
 */
function planShapes(body: ProfileBody, cutH: number | undefined, keep: (part: number) => boolean): PlanShapes {
  const out: PlanShapes = { below: [], above: [], cut: new Map() };
  const zone = (z0: number, z1: number) => (cutH === undefined || z1 < cutH - 0.5 ? 'below' : z0 > cutH + 0.5 ? 'above' : 'cut');
  if (body.plumb) {
    const [x, y, z0] = body.path[0];
    const z1 = body.path[1][2];
    const z = zone(Math.min(z0, z1), Math.max(z0, z1));
    body.regions.forEach((r, i) => {
      if (!keep(i)) return;
      const rings = r.polys.map((poly) => poly[0].map((q): Vec2 => [x + q[0], y + q[1]]));
      if (z === 'cut') out.cut.set(i, [...(out.cut.get(i) ?? []), ...rings]);
      else out[z].push(...rings);
    });
    return out;
  }
  const bySeg = new Map<number, typeof body.sweep.pieces>();
  for (const pc of body.sweep.pieces) if (keep(pc.part)) bySeg.set(pc.segment, [...(bySeg.get(pc.segment) ?? []), pc]);
  for (const pcs of bySeg.values()) {
    const all = pcs.flatMap((pc) => pc.poly.flat());
    const ring = hull(all.map((p): Vec2 => [p[0], p[1]]));
    if (!ring) continue;
    const z = zone(Math.min(...all.map((p) => p[2])), Math.max(...all.map((p) => p[2])));
    if (z !== 'cut') {
      out[z].push(ring);
      continue;
    }
    out.below.push(ring);
    for (const pc of pcs) {
      const sl = sliceAt(pc.poly, cutH!);
      if (sl) out.cut.set(pc.part, [...(out.cut.get(pc.part) ?? []), sl]);
    }
  }
  return out;
}

/** Profilen i planen: det snittade med materialets snitt, det under som konturlinje och det över streckprickat. */
function profilePlan(el: Element<any>, ctx: PlanContext): Primitive[] {
  const body = profileBodyOf(ctx.doc, el);
  if (!body) return [];
  const p = ctx.params<ProfileParams>(el);
  const h = el.storey === ctx.storey ? planCutHeight(ctx) : undefined;
  const cutH = h === undefined || !Number.isFinite(h) ? undefined : h;
  const detail = RANK[ctx.view.detail ?? 'normal'];
  const o = (part: string): Origin => ({ objectId: el.id, objectType: 'Profile', part });
  const { below, above, cut: cuts } = planShapes(body, cutH, (i) => !body.parts[i]?.detail || RANK[body.parts[i].detail!] <= detail);
  const out: Primitive[] = [];
  const outline = (rings: Vec2[][], key: 'profileContour' | 'profileAbove', part: string) => {
    if (!rings.length) return;
    const pen = profilePen(ctx.style, key);
    for (const poly of merged(rings)) for (const r of poly) out.push({ kind: 'polyline', points: r, closed: true, pen, origin: o(part) });
  };
  outline(below, 'profileContour', 'kontur');
  for (const [i, rings] of cuts) {
    const m = buildingMaterialOf({ material: partMaterial(p, body.parts[i]) } as never, ctx.style);
    const fill = materialCutFill(m, ctx.actionOf(el));
    for (const poly of merged(rings)) {
      if (fill) out.push(...materialCutPrims(poly, fill, o('snitt'), ctx.style, ctx.scale, false, true));
      else out.push({ kind: 'region', role: 'cut', rings: poly, fill: { kind: 'solid', color: 'ink' }, outline: profilePen(ctx.style, 'profileCut'), origin: o('snitt') } as Primitive);
    }
  }
  outline(above, 'profileAbove', 'över');
  return out;
}

export const profileType: ElementType<ProfileParams> = {
  type: 'Profile',
  planReads: [],
  label: 'Profil',
  labelPlural: 'Profiler',
  litteraPrefix: 'PR',
  drawOrder: 12,
  compares: true,
  defaults: () => ({ line: [] }),
  storeyParams: (s) => ({ storeyHeight: s.height }),
  pickShape(el, ctx) {
    const body = profileBodyOf(ctx.doc, el);
    if (!body) return [];
    const sh = planShapes(body, undefined, () => true);
    return merged([...sh.below, ...sh.above]).map((poly) => poly.map((r) => [...r]));
  },
  plan: profilePlan,
  model3d(el, ctx) {
    const body = profileBodyOf(ctx.doc, el);
    if (!body) return [];
    const p = ctx.params<ProfileParams>(el);
    const bases = body.parts.map((part): Partial<Solid> => {
      const m = buildingMaterialOf({ material: partMaterial(p, part) } as never, ctx.style);
      return { material: 'frame', ...materialSolid(m) };
    });
    const out: Shape3D[] = [];
    for (const pc of body.sweep.pieces) out.push(...solidsOf(el.id, pc.poly, bases[pc.part] ?? {}));
    if (body.sweep.edges.length) out.push({ kind: 'edges', id: el.id, segments: body.sweep.edges });
    return out;
  },
};
