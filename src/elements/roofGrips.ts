import type { Id, ProjectDoc } from '../core/model';
import type { Vec2 } from '../repr/primitives';
import { zOn } from '../repr/solids';
import { markerFrame } from './markers';
import { resolveParams } from './registry';
import { outlineRing, roofFrame, roofPlanes, type RoofParams } from './roof';

/**
 * Grepp för taket i fasader och sektioner (0.8, takfall sedan 0.10).
 * Höjdgreppet sitter vid referenslinjen och dras upp eller ned: hela
 * takfallet följer med i samma lutning. Lutningsgreppet sitter i takfallets
 * punkt längst från referenslinjen och dras upp eller ned: lutningen ändras,
 * och höjden vid referenslinjen ligger kvar.
 *
 * Koordinaterna är vyns: x längs linjen, y = höjd över nollnivån.
 */

export interface RoofGrip {
  roof: Id;
  kind: 'height' | 'slope';
  /** Greppets plats i vyn. */
  at: Vec2;
  /** För lutningsgreppet: punkten i plan där det sitter. */
  point?: Vec2;
}

export interface RoofDrag {
  /** Det som ändras i takets parametrar. */
  patch: Partial<RoofParams>;
  /** Vad som ändras, för texten vid markören. */
  text: string;
  /** Takets nya kontur i vyn: över- och undersida, för förhandsvisningen. */
  outline: Vec2[][];
}

/** Vyns ram: från plan till vyns x. */
function viewFrame(doc: ProjectDoc, markerId: Id) {
  const marker = doc.elements[markerId];
  if (!marker) return null;
  const fr = markerFrame(doc, marker);
  const u = (q: Vec2) => (q[0] - fr.start[0]) * fr.right[0] + (q[1] - fr.start[1]) * fr.right[1];
  const uMax = Math.hypot(fr.end[0] - fr.start[0], fr.end[1] - fr.start[1]);
  return { fr, u, uMax };
}

/** Mitten av punkternas läge i vyn, begränsad till linjens längd. Null om allt ligger utanför. */
function midU(us: number[], uMax: number): number | null {
  const lo = Math.max(0, Math.min(...us));
  const hi = Math.min(uMax, Math.max(...us));
  if (hi < lo - 1) return null;
  return (lo + Math.max(lo, hi)) / 2;
}

/** Takets golvnivå: våningens. */
const floorOf = (doc: ProjectDoc, storey: Id) => doc.storeys.find((s) => s.id === storey)?.elevation ?? 0;

/** Punkterna i konturen längst från referenslinjen, där lutningen syns mest (alla på samma avstånd). */
function farPoints(p: RoofParams): Vec2[] {
  const f = roofFrame(p);
  const ring = outlineRing(p);
  const ws = ring.map((q) => f.w(q));
  const far = Math.max(...ws.map(Math.abs));
  if (!(far > 100)) return [];
  return ring.filter((_, i) => Math.abs(Math.abs(ws[i]) - far) < 1);
}

/** Greppen för de markerade taken i fasaden eller sektionen. */
export function roofGripsInView(doc: ProjectDoc, markerId: Id, roofIds: readonly Id[]): RoofGrip[] {
  const vf = viewFrame(doc, markerId);
  if (!vf) return [];
  const out: RoofGrip[] = [];
  for (const id of roofIds) {
    const el = doc.elements[id];
    if (el?.type !== 'Roof') continue;
    const p = resolveParams<RoofParams>(doc, el);
    if (p.outline.length < 3 || !p.ref) continue;
    const z0 = floorOf(doc, el.storey);
    const hu = midU(p.ref.map((q) => vf.u(q as Vec2)), vf.uMax);
    if (hu !== null) out.push({ roof: id, kind: 'height', at: [Math.round(hu), Math.round(z0 + p.height)] });
    const far = farPoints(p);
    const su = far.length ? midU(far.map(vf.u), vf.uMax) : null;
    if (su !== null) {
      const top = roofFrame(p).top(far[0]);
      // Ser man takfallet rakt framifrån hamnar greppen på samma ställe: höjden räcker.
      if (hu === null || Math.abs(su - hu) > 50 || Math.abs(top - p.height) > 50) out.push({ roof: id, kind: 'slope', at: [Math.round(su), Math.round(z0 + top)], point: far[0] });
    }
  }
  return out;
}

/** Takets nya kontur i vyn: varje bits över- och undersida. */
function outlineInView(p: RoofParams, u: (q: Vec2) => number, z0: number): Vec2[][] {
  const out: Vec2[][] = [];
  for (const rp of roofPlanes(p)) {
    for (const ring of rp.rings) {
      for (const pl of [rp.top, rp.under]) out.push(ring.map((q): Vec2 => [u(q), z0 + zOn(pl, q[0], q[1])]));
    }
  }
  return out;
}

const fmtM = (mm: number) => {
  const m = mm / 1000;
  return `${m < 0 ? '−' : '+'}${Math.abs(m).toLocaleString('sv-SE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
};
const fmtDeg = (d: number) => `${d.toLocaleString('sv-SE', { maximumFractionDigits: 1 })}°`;

/** Lutningen (grader) som ger ovansidan höjden `top` (över golvet) i punkten q, med höjden vid referenslinjen kvar. Null om det inte går. */
export function slopeThrough(p: RoofParams, q: Vec2, top: number): number | null {
  const at = (slope: number) => roofFrame({ ...p, slope }).top(q);
  let lo = 0.5;
  let hi = 80;
  const up = at(hi) > at(lo);
  const below = (s: number) => (up ? at(s) < top : at(s) > top);
  if (!below(lo)) return lo;
  if (below(hi)) return hi;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (below(mid)) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Taket efter att greppet dragits till `to` (vyns koordinater; bara höjden
 * gäller). `free` ger lutningen utan avrundning till hela grader.
 */
export function dragRoofGrip(doc: ProjectDoc, markerId: Id, grip: RoofGrip, to: Vec2, opts: { free?: boolean } = {}): RoofDrag | null {
  const vf = viewFrame(doc, markerId);
  const el = doc.elements[grip.roof];
  if (!vf || !el) return null;
  const p = resolveParams<RoofParams>(doc, el);
  const z0 = floorOf(doc, el.storey);
  const done = (patch: Partial<RoofParams>, text: string): RoofDrag => ({ patch, text, outline: outlineInView({ ...p, ...patch }, vf.u, z0) });
  if (grip.kind === 'slope' && grip.point) {
    const s = slopeThrough(p, grip.point, to[1] - z0);
    if (s === null) return null;
    const slope = Math.max(0.5, Math.min(80, opts.free ? Math.round(s * 10) / 10 : Math.round(s)));
    return done({ slope }, `Lutning ${fmtDeg(p.slope)} → ${fmtDeg(slope)}`);
  }
  const height = Math.round(to[1] - z0);
  return done({ height }, `${p.heightAt === 'top' ? 'Ovansidan' : 'Undersidan'} vid referenslinjen ${fmtM(z0 + height)}`);
}
