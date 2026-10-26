import { finishedGround, nearestEdge, withHeights, type Barrier, type FinishedGround, type GroundShape } from '../core/ground';
import type { Element, Id } from '../core/model';
import { groundAt, groundDefaults, terrainOf, type Terrain } from '../core/site';
import type { Rings } from '../geometry/boolean';
import { bufferRings } from '../geometry/offset';
import type { Vec2 } from '../repr/primitives';
import { sameItems } from '../repr/reuse';
import { buildingFootprint } from './footprint';
import { along, barriersOf, lineLength, lockShape, PATH_WIDTH, pathShape, stripRing, type PathKind } from './groundLines';
import { resolveParams, type PlanContext } from './registry';
import type { SlabParams } from './slab';

/**
 * Markobjekten som de räknas (0.10.4–0.10.5, för sig sedan 0.10.6):
 * parametrarna, varje objekts form för den färdiga marken, den färdiga
 * marken i vyn och stödmurens krön. Ritningen i planen ligger i
 * `groundPlan.ts`, elementtypen i `ground.ts`.
 *
 * - **Platå**: en ritad kontur med en höjd, plan eller med fall. Kanterna
 *   möter marken med slänt (förval 1:2) eller stödmur.
 * - **Urgrävning**: en ritad kontur med bottenhöjd; slänten går utåt och
 *   tar bara ned marken.
 * - **Platå runt huset** (`around`): husets kontur, avståndet ut och fallet
 *   från fasaden (förval sockel 200, 1:20 de första 3 m). Följer huset.
 * - **Urgrävning under bjälklaget** (`slab`): bjälklagets kontur (med
 *   väggarna, när det följer dem) och arbetsutrymmet; botten i
 *   bjälklagets underkant. Följer bjälklaget.
 * - **Ramp, gångväg och infart** (`path`, 0.10.5): en mittlinje med
 *   bredd och höjd i början och slutet; infarten med tvärfall. Sidorna
 *   möter marken med slänt eller stödmur.
 * - **Höjdpunkt** och **brytlinje** (`point`, `breakline`, 0.10.5): låser
 *   marken och tonar den runt omkring inom en radie.
 * - **Stödmur** (`wall`, 0.10.5): en linje med tjocklek som slänterna inte
 *   går över. Krönet följer den högre sidan, eller en egen höjd.
 *
 * Höjderna är i mm från ±0, som allt annat i modellen. Det som saknas tas ur
 * projektets förval (`site.ground`), så att ett ändrat förval gäller alla
 * objekt som inte har ett eget värde.
 */

export type GroundKind = 'plateau' | 'excavation' | 'path' | 'point' | 'breakline' | 'wall';

/** Sorterna som ritas som en linje (eller en punkt) i stället för en kontur. */
export const LINE_KINDS: readonly GroundKind[] = ['path', 'point', 'breakline', 'wall'];
export const isLineKind = (k: GroundKind | undefined): boolean => !!k && LINE_KINDS.includes(k);

export interface GroundParams {
  kind: GroundKind;
  /** Den ritade konturen, mm. Tom för platån runt huset och urgrävningen under ett bjälklag. */
  outline: [number, number][];
  /** Platån runt huset. */
  around?: boolean;
  /** Bjälklaget som urgrävningen följer. */
  slab?: Id;
  /** Platåns höjd (i konturens mitt när den har fall) eller urgrävningens botten, mm från ±0. */
  height?: number;
  /** Fallet 1:N; 0 eller utelämnat = plan. Runt huset: fallet från fasaden. */
  fall?: number;
  /** Riktningen ytan faller åt, grader moturs från x-axeln. */
  fallDir?: number;
  /** Hur kanterna möter marken. */
  edge?: 'slope' | 'wall';
  /** Släntens lutning 1:N. */
  slope?: number;
  /** Runt huset: hur långt ut, och hur långt fallet gäller (mm). */
  distance?: number;
  fallLength?: number;
  /** Runt huset: från golvet ned till marken vid fasaden (mm). */
  sockel?: number;
  /** Under bjälklaget: arbetsutrymmet (mm). */
  margin?: number;
  /** Mittlinjen, brytlinjen, murens linje eller höjdpunkten (en punkt), mm (0.10.5). */
  line?: [number, number][];
  /** Vägens sort. */
  path?: PathKind;
  /** Vägens bredd, mm. */
  width?: number;
  /** Höjden i linjens slut (i början gäller `height`), mm från ±0. */
  endHeight?: number;
  /** Infartens tvärfall 1:N; positivt faller åt höger, negativt åt vänster. */
  crossFall?: number;
  /** Höjdpunkt och brytlinje: hur långt marken tonas, mm. */
  radius?: number;
  /** Stödmuren: tjockleken, mm. Krönet är `height` när den är satt, annars den högre sidan plus `above`. */
  thickness?: number;
  above?: number;
}

/** Namnet på objektets sort, som i egenskaperna. */
export function groundLabel(p: Pick<GroundParams, 'kind' | 'around' | 'slab' | 'path'>): string {
  if (p.around) return 'Platå runt huset';
  if (p.slab) return 'Urgrävning under bjälklaget';
  switch (p.kind) {
    case 'excavation':
      return 'Urgrävning';
    case 'path':
      return p.path === 'walk' ? 'Gångväg' : p.path === 'drive' ? 'Infart' : 'Ramp';
    case 'point':
      return 'Höjdpunkt';
    case 'breakline':
      return 'Brytlinje';
    case 'wall':
      return 'Stödmur';
    default:
      return 'Platå';
  }
}

/** Volymen som text, m³ med en decimal. */
export const m3 = (v: number): string => `${(Math.round(v * 10) / 10).toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m³`;

/** Ett markobjekt som det ritas och räknas: ytans ringar, hålen (huset) och formen för den färdiga marken. */
export interface GroundGeometry {
  rings: Rings[];
  /** Det som inte hör till ytan men ligger innanför den (husets kontur runt huset). */
  holes: Vec2[][];
  /** Formen för den färdiga marken; en stödmur har ingen, bara `barriers`. */
  shape: GroundShape | null;
  /** Stödmurens linje, som slänterna inte går över. */
  barriers?: Barrier[];
  /** Där höjden skrivs ut, och texten. */
  label: { at: Vec2; height: number; fall?: number };
}

export const storeyElevation = (ctx: PlanContext, id: Id): number => ctx.doc.storeys.find((s) => s.id === id)?.elevation ?? 0;

function boxOfRings(polys: readonly Rings[]): [number, number, number, number] {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const poly of polys)
    for (const ring of poly)
      for (const q of ring) {
        b[0] = Math.min(b[0], q[0]);
        b[1] = Math.min(b[1], q[1]);
        b[2] = Math.max(b[2], q[0]);
        b[3] = Math.max(b[3], q[1]);
      }
  return b;
}

const savedGeometry = new WeakMap<Element<any>, { inputs: unknown[]; out: GroundGeometry | null }>();

/**
 * Markobjektets form. Räknas om bara när det som formen beror på ändras
 * (0.10.6): objektet, förvalen, våningens golvnivå, husets kontur (till
 * värdet, se `buildingFootprint`) och bjälklagets kontur, tjocklek och
 * golvnivå. En ny penna eller ett nytt namn på bjälklaget, en annan våning
 * som ändras eller ett nytt kurvavstånd räknar inte om den.
 */
export function groundGeometry(ctx: PlanContext, el: Element<any>): GroundGeometry | null {
  const p = ctx.params<GroundParams>(el);
  const doc = ctx.doc;
  const slabEl = p.slab ? doc.elements[p.slab] : undefined;
  const slabP = slabEl ? resolveParams<SlabParams>(doc, slabEl) : undefined;
  const needsFootprint = !!p.around || !!slabP?.fromWalls;
  const footprint = needsFootprint ? buildingFootprint(ctx) : null;
  const inputs = [doc.site?.ground, storeyElevation(ctx, el.storey), footprint, slabP?.fromWalls, slabP?.outline, slabP?.thickness, slabEl && storeyElevation(ctx, slabEl.storey)];
  const hit = savedGeometry.get(el);
  if (hit && sameItems(hit.inputs, inputs)) return hit.out;
  const out = computeGeometry(ctx, el, p, footprint, slabEl, slabP);
  savedGeometry.set(el, { inputs, out });
  return out;
}

function computeGeometry(ctx: PlanContext, el: Element<any>, p: GroundParams, footprint: Rings[] | null, slabEl: Element<any> | undefined, slabP: SlabParams | undefined): GroundGeometry | null {
  const def = groundDefaults(ctx.doc.site);
  const slope = p.edge === 'wall' ? null : Math.max(0.1, p.slope ?? def.slope);
  if (isLineKind(p.kind)) return lineGeometry(el, p, slope, def);
  if (p.around) {
    if (!footprint?.length) return null;
    const fp = footprint.map((poly) => poly[0]);
    const distance = Math.max(0, p.distance ?? def.distance);
    const fall = p.fall ?? def.fall;
    const fallLength = Math.max(0, p.fallLength ?? def.fallLength);
    const h0 = storeyElevation(ctx, el.storey) - (p.sockel ?? def.sockel);
    const drop = (d: number) => (fall > 0 ? Math.min(d, fallLength) / fall : 0);
    const rings = bufferRings(footprint, distance);
    const box = boxOfRings(rings);
    const edgeH = h0 - drop(distance);
    const shape: GroundShape = {
      id: el.id,
      cut: true,
      fill: true,
      slope,
      box,
      hMin: edgeH,
      hMax: h0,
      probe(x, y, cell) {
        const e = nearestEdge(fp, x, y);
        // Under huset gäller grunden (urgrävningen), inte platån; bara noderna
        // närmast fasaden får platåns höjd, så att marken mellan noderna ligger rätt vid fasaden.
        if (e.inside) return e.d > cell ? { inside: true, d: 0, h: h0, skip: true } : { inside: true, d: 0, h: h0 };
        const d = e.d;
        return d <= distance ? { inside: true, d: 0, h: h0 - drop(d) } : { inside: false, d: d - distance, h: edgeH, at: e.at };
      },
    };
    const b = boxOfRings(footprint);
    return { rings, holes: fp.map((r) => r.map((q): Vec2 => [q[0], q[1]])), shape, label: { at: [b[0] - distance / 2, (b[1] + b[3]) / 2], height: h0, fall } };
  }
  let polys: Rings[];
  let height: number;
  let fall = 0;
  if (p.slab) {
    if (!slabEl || !slabP) return null;
    const base: Rings[] = slabP.fromWalls ? (footprint ?? []).map((poly) => [poly[0]]) : slabP.outline.length >= 3 ? [[slabP.outline.map((q): Vec2 => [q[0], q[1]])]] : [];
    if (!base.length) return null;
    polys = bufferRings(base, Math.max(0, p.margin ?? def.margin));
    height = storeyElevation(ctx, slabEl.storey) - Math.max(0, slabP.thickness);
  } else {
    if (p.outline.length < 3) return null;
    polys = [[p.outline.map((q): Vec2 => [q[0], q[1]])]];
    height = p.height ?? 0;
    fall = p.kind === 'plateau' ? (p.fall ?? 0) : 0;
  }
  const flat = polys.flat();
  const box = boxOfRings(polys);
  const c: Vec2 = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
  const a = ((p.fallDir ?? 0) * Math.PI) / 180;
  const gx = fall > 0 ? -Math.cos(a) / fall : 0;
  const gy = fall > 0 ? -Math.sin(a) / fall : 0;
  const hAt = (x: number, y: number) => height + gx * (x - c[0]) + gy * (y - c[1]);
  const corners = [hAt(box[0], box[1]), hAt(box[2], box[1]), hAt(box[2], box[3]), hAt(box[0], box[3])];
  const shape: GroundShape = {
    id: el.id,
    cut: true,
    fill: p.kind === 'plateau' && !p.slab,
    slope,
    box,
    hMin: Math.min(...corners),
    hMax: Math.max(...corners),
    probe(x, y) {
      const e = nearestEdge(flat, x, y);
      return e.inside ? { inside: true, d: 0, h: hAt(x, y) } : { inside: false, d: e.d, h: hAt(e.at[0], e.at[1]), at: e.at };
    },
  };
  return { rings: polys, holes: [], shape, label: { at: c, height, ...(fall > 0 ? { fall } : {}) } };
}

function lineGeometry(el: Element<any>, p: GroundParams, slope: number | null, def: ReturnType<typeof groundDefaults>): GroundGeometry | null {
  const pts = (p.line ?? []).map((q): Vec2 => [q[0], q[1]]);
  const h0 = p.height ?? 0;
  const h1 = p.endHeight ?? h0;
  if (p.kind === 'point') {
    if (!pts.length) return null;
    const r = 500;
    const c = pts[0];
    const ring: Vec2[] = [[c[0] - r, c[1] - r], [c[0] + r, c[1] - r], [c[0] + r, c[1] + r], [c[0] - r, c[1] + r]];
    return { rings: [[ring]], holes: [], shape: lockShape(el.id, [c], h0, h0, Math.max(1, p.radius ?? def.blend)), label: { at: c, height: h0 } };
  }
  if (pts.length < 2 || lineLength(pts) < 1) return null;
  const mid = along(pts, ...midPoint(pts));
  if (p.kind === 'breakline') {
    const ring = stripRing(pts, 400);
    return { rings: [[ring]], holes: [], shape: lockShape(el.id, pts, h0, h1, Math.max(1, p.radius ?? def.blend)), label: { at: mid.at, height: h0 } };
  }
  if (p.kind === 'wall') {
    const ring = stripRing(pts, Math.max(50, p.thickness ?? def.wallThickness));
    return { rings: [[ring]], holes: [], shape: null, barriers: barriersOf(pts), label: { at: mid.at, height: h0 } };
  }
  const kind = p.path ?? 'ramp';
  const w = Math.max(100, p.width ?? PATH_WIDTH[kind]);
  const cross = kind === 'drive' ? (p.crossFall ?? def.crossFall) : (p.crossFall ?? 0);
  const { shape, ring } = pathShape(el.id, pts, w, h0, h1, cross, slope);
  return { rings: [[ring]], holes: [], shape, label: { at: mid.at, height: h0 } };
}

/** Punkten halvvägs längs linjen. */
function midPoint(pts: readonly Vec2[]): [number, number] {
  let rest = lineLength(pts) / 2;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (l >= rest && l > 0) {
      const f = rest / l;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
    }
    rest -= l;
  }
  return [pts[0][0], pts[0][1]];
}

/**
 * Markobjekten som gäller i vyn (inte de som rivs), i ritordning.
 * Urgrävningarna under bjälklag räknas först: de är schaktet för grunden,
 * som sedan fylls igen till platåerna och den övriga marken.
 */
export function groundObjects(ctx: PlanContext): Element[] {
  return ctx.memo('ground-objects', () =>
    Object.values(ctx.doc.elements)
      .filter((e) => e.type === 'Ground' && !e.space)
      .filter((e) => {
        const a = ctx.actionOf(e);
        return a !== 'absent' && a !== 'demolished';
      })
      .map((e, i) => ({ e, i, first: e.params.slab ? 0 : 1 }))
      .sort((a, b) => a.first - b.first || (a.e.order ?? 0) - (b.e.order ?? 0) || a.i - b.i)
      .map(({ e }) => e),
  );
}

export interface Finished extends FinishedGround {
  /** Markmodellen med den färdiga markens höjder. */
  terrain: Terrain;
}

let last: { inputs: unknown[]; out: Finished | null }[] = [];

/**
 * Den färdiga marken i vyn, eller null när inga markobjekt gäller (då är den
 * färdiga marken den befintliga) eller projektet saknar markmodell.
 *
 * Räknas om bara när markmodellen, platsens läge och höjd eller ett
 * markobjekts form ändras (0.10.6; inte för kurvavståndet eller jorden i
 * sektionerna). Då börjar den efter objekten före det som ändrats, som är
 * sig lika (`finishedGround` med det senaste svaret).
 */
export function finishedTerrain(ctx: PlanContext): Finished | null {
  return ctx.memo('finished-terrain', () => {
    const t = terrainOf(ctx.doc);
    if (!t) return null;
    const els = groundObjects(ctx);
    if (!els.length) return null;
    const geoms = els.map((e) => groundGeometry(ctx, e));
    const { site: s, grid: g } = t;
    const inputs = [t.z, g.x0, g.y1, g.s, g.W, g.H, s.origin[0], s.origin[1], s.rotation, s.datum, ...geoms];
    const hit = last.find((x) => sameItems(x.inputs, inputs));
    if (hit) return hit.out;
    const shapes = geoms.flatMap((g) => (g?.shape ? [g.shape] : []));
    const barriers = geoms.flatMap((g) => g?.barriers ?? []);
    let out: Finished | null = null;
    if (shapes.length) {
      const f = finishedGround(t, shapes, barriers, last.find((x) => x.out)?.out);
      out = { ...f, terrain: withHeights(t, f.z, f) };
    }
    // De senaste svaren, t.ex. för förslag A och B och en kalkerad vy samtidigt.
    last = [{ inputs, out }, ...last.slice(0, 5)];
    return out;
  });
}

/** Om vyn visar ett förslag (inte Befintligt): då ritas den färdiga marken tjock. */
export function showsProposal(ctx: PlanContext): boolean {
  return ctx.doc.states.find((s) => s.id === ctx.view.state)?.kind !== 'existing';
}

/** Hur långt ut från muren marken känns på, mm (en ruta i rutnätet räcker). */
const WALL_REACH = 700;
/** Stödmurens grund under den lägre sidan, mm. */
export const WALL_FOOTING = 300;

/**
 * Stödmurens krön och fot (mm från ±0): krönet är den egna höjden, eller
 * den högre sidans högsta mark längs muren plus `above`; foten ligger
 * under den lägre sidans lägsta mark. Null utan markmodell.
 */
export function wallCrest(ctx: PlanContext, el: Element<any>): { top: number; bottom: number } | null {
  return ctx.memo(`wall-crest:${el.id}`, () => {
    const p = ctx.params<GroundParams>(el);
    const pts = (p.line ?? []).map((q): Vec2 => [q[0], q[1]]);
    if (pts.length < 2) return null;
    const t = finishedTerrain(ctx)?.terrain ?? terrainOf(ctx.doc);
    if (!t) return null;
    const half = Math.max(50, p.thickness ?? groundDefaults(ctx.doc.site).wallThickness) / 2;
    let hi = -Infinity;
    let lo = Infinity;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l < 1) continue;
      const nx = -(b[1] - a[1]) / l;
      const ny = (b[0] - a[0]) / l;
      const steps = Math.max(1, Math.ceil(l / 500));
      for (let k = 0; k <= steps; k++) {
        const x = a[0] + ((b[0] - a[0]) * k) / steps;
        const y = a[1] + ((b[1] - a[1]) * k) / steps;
        const l1 = groundAt(t, x + nx * (half + WALL_REACH), y + ny * (half + WALL_REACH));
        const r1 = groundAt(t, x - nx * (half + WALL_REACH), y - ny * (half + WALL_REACH));
        if (l1 === null || r1 === null) continue;
        hi = Math.max(hi, l1, r1);
        lo = Math.min(lo, l1, r1);
      }
    }
    if (!Number.isFinite(hi)) return null;
    return { top: p.height ?? hi + (p.above ?? 0), bottom: lo - WALL_FOOTING };
  });
}
