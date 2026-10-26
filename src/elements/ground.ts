import { finishedGround, nearestEdge, withHeights, type FinishedGround, type GroundShape } from '../core/ground';
import type { Element, Id } from '../core/model';
import { groundDefaults, levelText, terrainOf, type Terrain } from '../core/site';
import type { Rings } from '../geometry/boolean';
import { bufferRings } from '../geometry/offset';
import type { Primitive, Vec2 } from '../repr/primitives';
import { lastResults } from '../repr/reuse';
import { buildingFootprint } from './footprint';
import { resolveParams, type ElementType, type PlanContext } from './registry';
import type { SlabParams } from './slab';

/**
 * Markobjekt (0.10.4): platåer och urgrävningar som gör den färdiga marken
 * ur den befintliga (`core/ground.ts`). De är fristående objekt och hör till
 * förslaget; den befintliga marken ändras aldrig.
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
 *
 * Höjderna är i mm från ±0, som allt annat i modellen. Det som saknas tas ur
 * projektets förval (`site.ground`), så att ett ändrat förval gäller alla
 * objekt som inte har ett eget värde.
 */

export type GroundKind = 'plateau' | 'excavation';

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
}

/** Namnet på objektets sort, som i egenskaperna. */
export function groundLabel(p: Pick<GroundParams, 'kind' | 'around' | 'slab'>): string {
  if (p.around) return 'Platå runt huset';
  if (p.slab) return 'Urgrävning under bjälklaget';
  return p.kind === 'excavation' ? 'Urgrävning' : 'Platå';
}

/** Ett markobjekt som det ritas och räknas: ytans ringar, hålen (huset) och formen för den färdiga marken. */
export interface GroundGeometry {
  rings: Rings[];
  /** Det som inte hör till ytan men ligger innanför den (husets kontur runt huset). */
  holes: Vec2[][];
  shape: GroundShape;
  /** Där höjden skrivs ut, och texten. */
  label: { at: Vec2; height: number; fall?: number };
}

const storeyElevation = (ctx: PlanContext, id: Id): number => ctx.doc.storeys.find((s) => s.id === id)?.elevation ?? 0;

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

/** Markobjektets form. Räknas om när objektet, förvalen, våningarna, husets kontur eller bjälklaget ändras. */
export function groundGeometry(ctx: PlanContext, el: Element<any>): GroundGeometry | null {
  const p = ctx.params<GroundParams>(el);
  const doc = ctx.doc;
  const slabEl = p.slab ? doc.elements[p.slab] : undefined;
  const slabP = slabEl ? resolveParams<SlabParams>(doc, slabEl) : undefined;
  const needsFootprint = !!p.around || !!slabP?.fromWalls;
  const footprint = needsFootprint ? buildingFootprint(ctx) : null;
  const inputs = [p, doc.site?.ground, doc.storeys, footprint, slabEl, slabP];
  const hit = savedGeometry.get(el);
  if (hit && hit.inputs.length === inputs.length && hit.inputs.every((v, i) => v === inputs[i])) return hit.out;
  const out = computeGeometry(ctx, el, p, footprint, slabEl, slabP);
  savedGeometry.set(el, { inputs, out });
  return out;
}

function computeGeometry(ctx: PlanContext, el: Element<any>, p: GroundParams, footprint: Rings[] | null, slabEl: Element<any> | undefined, slabP: SlabParams | undefined): GroundGeometry | null {
  const def = groundDefaults(ctx.doc.site);
  const slope = p.edge === 'wall' ? null : Math.max(0.1, p.slope ?? def.slope);
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
        return d <= distance ? { inside: true, d: 0, h: h0 - drop(d) } : { inside: false, d: d - distance, h: edgeH };
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
      return e.inside ? { inside: true, d: 0, h: hAt(x, y) } : { inside: false, d: e.d, h: hAt(e.at[0], e.at[1]) };
    },
  };
  return { rings: polys, holes: [], shape, label: { at: c, height, ...(fall > 0 ? { fall } : {}) } };
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

const savedFinished = lastResults<Finished | null>(6);

/**
 * Den färdiga marken i vyn, eller null när inga markobjekt gäller (då är den
 * färdiga marken den befintliga) eller projektet saknar markmodell.
 */
export function finishedTerrain(ctx: PlanContext): Finished | null {
  return ctx.memo('finished-terrain', () => {
    const t = terrainOf(ctx.doc);
    if (!t) return null;
    const els = groundObjects(ctx);
    if (!els.length) return null;
    const geoms = els.map((e) => groundGeometry(ctx, e));
    return savedFinished([t.z, t.site, ...geoms], () => {
      const shapes = geoms.filter((g): g is GroundGeometry => !!g).map((g) => g.shape);
      if (!shapes.length) return null;
      const f = finishedGround(t, shapes);
      return { ...f, terrain: withHeights(t, f.z, f) };
    });
  });
}

/** Om vyn visar ett förslag (inte Befintligt): då ritas den färdiga marken tjock. */
export function showsProposal(ctx: PlanContext): boolean {
  return ctx.doc.states.find((s) => s.id === ctx.view.state)?.kind !== 'existing';
}

/** Volymen som text, m³ med en decimal. */
export const m3 = (v: number): string => `${(Math.round(v * 10) / 10).toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m³`;

export const groundType: ElementType<GroundParams> = {
  type: 'Ground',
  label: 'Markobjekt',
  labelPlural: 'Markobjekt',
  drawOrder: 4.5,
  compares: true,
  planReads: ['Wall', 'Slab'],
  pickSoft: true,
  defaults: () => ({ kind: 'plateau', outline: [] }),
  pickShape(el, ctx) {
    const g = groundGeometry(ctx, el);
    if (!g) return [];
    return g.rings.map((poly) => [...poly.map((r) => r.map((q): Vec2 => [q[0], q[1]])), ...g.holes]);
  },
  plan(el, ctx) {
    const g = groundGeometry(ctx, el);
    if (!g) return [];
    const p = ctx.params<GroundParams>(el);
    const origin = { objectId: el.id, objectType: 'Ground' };
    const out: Primitive[] = [];
    // Konturen: tunn, eller tjock där kanten är en stödmur. Urgrävningen streckad.
    const pen = p.edge === 'wall' ? { weight: 0.5 } : p.kind === 'excavation' || p.slab ? { weight: 0.18, dash: [4, 1.5] } : { weight: 0.25 };
    for (const poly of g.rings) for (const ring of poly) out.push({ kind: 'polyline', points: ring, closed: true, pen, origin: { ...origin, part: 'kontur' } });
    const text = `${groundLabel(p)} ${levelText(ctx.doc.site, g.label.height)}${g.label.fall ? ` · 1:${g.label.fall.toLocaleString('sv-SE')}` : ''}`;
    out.push({ kind: 'text', at: g.label.at, text, height: 2, align: 'middle', pen: { weight: 0.18 }, origin: { ...origin, part: 'höjd' } });
    // Fallets riktning som en pil från mitten (platå med fall).
    if (g.label.fall && !p.around) {
      const a = ((p.fallDir ?? 0) * Math.PI) / 180;
      const l = 8 * ctx.scale;
      const s = g.label.at;
      const e: Vec2 = [s[0] + Math.cos(a) * l, s[1] - 3 * ctx.scale + Math.sin(a) * l];
      const s2: Vec2 = [s[0], s[1] - 3 * ctx.scale];
      const h = 1.5 * ctx.scale;
      out.push({ kind: 'line', a: s2, b: e, pen: { weight: 0.18 }, origin: { ...origin, part: 'fall' } });
      out.push({ kind: 'line', a: e, b: [e[0] - Math.cos(a - 0.4) * h, e[1] - Math.sin(a - 0.4) * h], pen: { weight: 0.18 }, origin: { ...origin, part: 'fall' } });
      out.push({ kind: 'line', a: e, b: [e[0] - Math.cos(a + 0.4) * h, e[1] - Math.sin(a + 0.4) * h], pen: { weight: 0.18 }, origin: { ...origin, part: 'fall' } });
    }
    return out;
  },
};
