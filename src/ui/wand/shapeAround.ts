import { typeOf } from '../../elements/registry';
import { faceAround, signedArea, simplify } from '../../geometry/chains';
import { pointInRings } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import { nearSegments } from '../tools/snap';
import type { WandAction, WandContext, WandHit } from './wand';

/** Så långt bort (i toleranser) linjerna kring en sluten yta söks, och högst så långt i mm. */
const FACE_REACH = 400;
const FACE_MAX_MM = 200_000;

interface Ring {
  points: Vec2[];
  label: string;
  what?: string;
}

/**
 * 2D (0.10.22): en sluten 2D-form runt det man klickar i, med verktygets
 * penna och fyllning: en snittyta i en sektion eller fasad, ett objekts
 * kontur i planen, eller den minsta slutna ytan som linjerna stänger in
 * (som skrafferingens gräns i AutoCAD). Tab växlar mellan dem, den minsta
 * först.
 */
export const shapeAround: WandAction = {
  id: 'shape-around',
  tools: ['draw2d'],
  find(ctx) {
    const rings: Ring[] = [];
    const section = !!(ctx.app.ui.marker || ctx.app.ui.worksheet);
    // Snittytor och andra ytor som ritas (inte fyllningar, som ligger i en kontur ändå).
    for (const p of ctx.app.plan.prims) {
      if (p.kind !== 'region' || (p.noOutline && p.ownFill) || !p.rings.length) continue;
      if (!pointInRings(ctx.at, p.rings)) continue;
      const id = p.origin?.objectId;
      const el = id ? ctx.app.store.doc.elements[id] : undefined;
      rings.push({ points: [...p.rings[0]], label: section ? 'Runt snittytan' : 'Runt ytan', what: el ? typeOf(el.type)?.label : undefined });
    }
    // Objektens konturer i planen.
    if (!section)
      for (const pk of ctx.app.plan.pickables)
        for (const r of pk.regions)
          if (r.length && pointInRings(ctx.at, r)) {
            const el = ctx.app.store.doc.elements[pk.id];
            rings.push({ points: [...r[0]], label: 'Runt konturen', what: el ? typeOf(el.type)?.label : undefined });
          }
    const face = closedFace(ctx);
    if (face) rings.push({ points: face, label: 'Runt den slutna ytan' });
    // Den minsta först, och samma yta bara en gång.
    const sorted = rings
      .map((r) => ({ ...r, points: simplify({ points: r.points, closed: true }).points }))
      .filter((r) => r.points.length >= 3)
      .map((r) => ({ ...r, area: Math.abs(signedArea(r.points)) }))
      .sort((a, b) => a.area - b.area);
    const out: WandHit[] = [];
    const seen: number[] = [];
    for (const r of sorted) {
      if (seen.some((a) => Math.abs(a - r.area) <= 1e-3 * Math.max(a, 1))) continue;
      seen.push(r.area);
      // Medurs som allt annat spöet lägger.
      const pts = signedArea(r.points) > 0 ? [...r.points].reverse() : r.points;
      out.push({ label: r.label, what: r.what, preview: { lines: [{ points: pts, closed: true }] }, apply: () => ctx.app.draw2dTool.createPolyline(pts, true) });
    }
    return out;
  },
};

/** Den minsta slutna ytan som de synliga linjerna stänger in runt markören. */
function closedFace(ctx: WandContext): Vec2[] | null {
  const all = ctx.app.host.snapSegments();
  // Samma linjer och markören kvar i samma yta (eller nära där ingen fanns): samma svar, utan att räkna om.
  if (last && last.all === all && last.tol === ctx.tol && (last.face ? pointInRings(ctx.at, [last.face]) : Math.hypot(ctx.at[0] - last.at[0], ctx.at[1] - last.at[1]) < ctx.tol)) return last.face;
  const r = Math.min(ctx.tol * FACE_REACH, FACE_MAX_MM);
  const segs = nearSegments(all, ctx.at, r).filter((s) => !s.point && !s.ref);
  const face = segs.length ? faceAround(segs, ctx.at) : null;
  last = { all, tol: ctx.tol, at: ctx.at, face };
  return face;
}
let last: { all: unknown; tol: number; at: Vec2; face: Vec2[] | null } | null = null;
