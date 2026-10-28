import { buildingFootprint } from '../../elements/footprint';
import { typeOf } from '../../elements/registry';
import { createContext } from '../../repr/context';
import { faceAround, signedArea, simplify } from '../../geometry/chains';
import { pointInRings } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import { nearSegments } from '../tools/snap';
import type { WandContext } from './wand';

/** Så långt bort (i toleranser) linjerna kring en sluten yta söks, och högst så långt i mm. */
const FACE_REACH = 400;
const FACE_MAX_MM = 200_000;

/** En sluten yta där markören står, medurs. */
export interface Ring {
  points: Vec2[];
  /** Hur den hittades: en ritad yta (snittyta), ett objekts kontur eller ytan mellan linjerna. */
  kind: 'region' | 'outline' | 'face';
  /** Objektet den hör till, om någon. */
  id?: string;
  what?: string;
  area: number;
}

/**
 * De slutna ytorna runt markören (0.10.22, utbrutet 0.10.23): ytor som ritas
 * (snittytor), objektens konturer i planen och den minsta slutna ytan som
 * linjerna stänger in, den minsta först och samma yta bara en gång.
 */
export function ringsAt(ctx: WandContext, opts: { regions?: boolean; outlines?: boolean; face?: boolean; skip?: (id: string | undefined) => boolean } = {}): Ring[] {
  const rings: Omit<Ring, 'area'>[] = [];
  const section = !!(ctx.app.ui.marker || ctx.app.ui.worksheet);
  const skip = opts.skip ?? (() => false);
  const what = (id: string | undefined): string | undefined => {
    const el = id ? ctx.app.store.doc.elements[id] : undefined;
    return el ? typeOf(el.type)?.label : undefined;
  };
  if (opts.regions !== false)
    for (const p of ctx.app.plan.prims) {
      // Snittytor och andra ytor som ritas (inte fyllningar, som ligger i en kontur ändå).
      if (p.kind !== 'region' || (p.noOutline && p.ownFill) || !p.rings.length) continue;
      const id = p.origin?.objectId;
      if (skip(id) || !pointInRings(ctx.at, p.rings)) continue;
      rings.push({ points: [...p.rings[0]], kind: 'region', id, what: what(id) });
    }
  if (opts.outlines !== false && !section)
    for (const pk of ctx.app.plan.pickables) {
      if (skip(pk.id)) continue;
      for (const r of pk.regions) if (r.length && pointInRings(ctx.at, r)) rings.push({ points: [...r[0]], kind: 'outline', id: pk.id, what: what(pk.id) });
    }
  if (opts.face !== false) {
    const face = closedFace(ctx);
    if (face) rings.push({ points: face, kind: 'face' });
  }
  const sorted = rings
    .map((r) => ({ ...r, points: simplify({ points: r.points, closed: true }).points }))
    .filter((r) => r.points.length >= 3)
    .map((r) => ({ ...r, area: Math.abs(signedArea(r.points)) }))
    .sort((a, b) => a.area - b.area);
  const out: Ring[] = [];
  for (const r of sorted) {
    if (out.some((o) => Math.abs(o.area - r.area) <= 1e-3 * Math.max(o.area, 1))) continue;
    // Medurs som allt annat spöet lägger.
    out.push({ ...r, points: signedArea(r.points) > 0 ? [...r.points].reverse() : r.points });
  }
  return out;
}

/** Den minsta slutna ytan som de synliga linjerna stänger in runt markören. */
function closedFace(ctx: WandContext): Vec2[] | null {
  const all = ctx.app.host.snapSegments();
  // Samma linjer och markören kvar i samma yta (eller nära där ingen fanns): samma svar, utan att räkna om.
  if (last && last.all === all && last.tol === ctx.tol && (last.face ? pointInRings(ctx.at, [last.face]) : Math.hypot(ctx.at[0] - last.at[0], ctx.at[1] - last.at[1]) < ctx.tol)) return last.face;
  const r = Math.min(ctx.tol * FACE_REACH, FACE_MAX_MM);
  // Höjdkurvorna stänger inga ytor: de går genom allt på situationsplanen.
  const segs = nearSegments(all, ctx.at, r).filter((s) => !s.point && !s.ref && !s.wandOnly);
  const face = segs.length ? faceAround(segs, ctx.at) : null;
  last = { all, tol: ctx.tol, at: ctx.at, face };
  return face;
}
let last: { all: unknown; tol: number; at: Vec2; face: Vec2[] | null } | null = null;

/**
 * Husets kontur (ytterväggarnas utsida, `buildingFootprint`) som markören
 * ligger innanför, medurs, eller null (0.10.23). Räknas en gång per projekt
 * och vy.
 */
export function houseAt(ctx: WandContext): Vec2[] | null {
  const doc = ctx.app.store.doc;
  const view = ctx.app.viewStates();
  if (!house || house.elements !== doc.elements || house.state !== view.state) {
    const { ctx: plan } = createContext(doc, ctx.app.ui.storey, view, doc.graphics, () => true);
    house = { elements: doc.elements, state: view.state, rings: buildingFootprint(plan).map((poly) => poly[0]).filter((r) => r && r.length >= 3) };
  }
  const r = house.rings.find((q) => pointInRings(ctx.at, [q]));
  if (!r) return null;
  const pts = simplify({ points: r.map((q): Vec2 => [q[0], q[1]]), closed: true }).points;
  return signedArea(pts) > 0 ? pts.reverse() : pts;
}
let house: { elements: unknown; state: string; rings: readonly (readonly Vec2[])[] } | null = null;
