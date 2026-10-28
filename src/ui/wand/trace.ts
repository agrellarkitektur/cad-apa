import { typeOf } from '../../elements/registry';
import { chainThrough, sideOf, signedArea, simplify, type Chain } from '../../geometry/chains';
import { closestOnSegment, dist, norm, pointInRings, sub } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import { nearSegments, type SnapSegment } from '../tools/snap';
import type { WandContext } from './wand';

/**
 * Det spöet följer (0.10.22): kanten närmast markören, kedjan den hör till
 * (allt som hänger ihop ände mot ände i samma objekt) och sidan (delen
 * mellan två tydliga hörn). Sträckorna är desamma som snäppet använder, så
 * allt man kan snäppa mot kan spöet följa.
 */
export interface Traced {
  id: string;
  /** Vad det är, för texten vid markören. */
  what: string;
  /** Hela kedjan och sidan, med insidan till höger när den är känd. */
  whole: Chain;
  side: Chain;
  /** Om insidan är känd (en sluten kontur eller ett objekt med yta). */
  inside: boolean;
}

/** Det som går att följa: inte väggarnas referenslinjer och inga lösa punkter. */
const traceable = (s: SnapSegment): boolean => !s.ref && !s.point;

/** Vad det följda heter, för texten vid markören. */
export function whatOf(ctx: WandContext, id: string, seg?: SnapSegment): string {
  if (id === 'kalkering') return 'Kalkeringen';
  if (id === 'vy' || id === 'snitt') return 'Linjen';
  const el = ctx.app.store.doc.elements[id];
  if (el?.type === 'SiteMap' && el.params.kind === 'boundary') return 'Fastighetsgräns';
  if (seg?.on === 'På höjdkurvan') return 'Höjdkurva';
  return (el && typeOf(el.type)?.label) ?? 'Linjen';
}

/** Kanten närmast markören inom toleransen, och kedjan genom den. */
export function traceAt(ctx: WandContext, keep: (s: SnapSegment) => boolean = () => true): Traced | null {
  const all = ctx.app.host.snapSegments();
  let best: { s: SnapSegment; d: number } | null = null;
  for (const s of nearSegments(all, ctx.at, ctx.tol)) {
    if (!traceable(s) || !keep(s)) continue;
    const d = dist(closestOnSegment(ctx.at, s.a, s.b).point, ctx.at);
    if (d <= ctx.tol && (!best || d < best.d - 1e-6)) best = { s, d };
  }
  if (!best) return null;
  const hit = best.s;
  // Samma kant i samma lista: samma kedja (hovringen frågar vid varje musrörelse).
  if (!chains || chains.all !== all || chains.hit !== hit) {
    const own = all.filter((s) => s.id === hit.id && traceable(s) && keep(s));
    chains = { all, hit, whole: simplify(chainThrough(own, own.indexOf(hit))) };
  }
  // Sidan räknas på den förenklade kedjan, och sträckan man pekar på letas upp i den.
  const whole = chains.whole;
  const at = nearestEdge(whole, ctx.at);
  const side = whole.points.length > 2 || whole.closed ? sideOf(whole, at) : whole;
  const regions = ctx.app.plan.pickables.find((p) => p.id === hit.id)?.regions ?? [];
  const w = insideRight(whole, regions);
  const sd = side === whole ? w : insideRight(side, regions);
  return { id: hit.id, what: whatOf(ctx, hit.id, hit), whole: w.chain, side: sd.chain, inside: sd.known };
}

let chains: { all: readonly SnapSegment[]; hit: SnapSegment; whole: Chain } | null = null;

/** Den sträcka i kedjan som ligger närmast punkten: index till dess första punkt. */
function nearestEdge(c: Chain, p: Vec2): number {
  const n = c.points.length;
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i + 1 < n + (c.closed ? 1 : 0); i++) {
    const d = dist(closestOnSegment(p, c.points[i], c.points[(i + 1) % n]).point, p);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/**
 * Vänd kedjan så att insidan ligger till höger (medurs runt en sluten
 * kontur, som väggverktyget antar). En öppen kedja prövas mot objektets yta
 * en bit åt vänster och höger om sin längsta sträcka.
 */
export function insideRight(c: Chain, regions: readonly (readonly (readonly Vec2[])[])[]): { chain: Chain; known: boolean } {
  if (c.closed) return { chain: signedArea(c.points) > 0 ? reversed(c) : c, known: true };
  const n = c.points.length;
  let i = 0;
  for (let k = 1; k + 1 < n; k++) if (dist(c.points[k], c.points[k + 1]) > dist(c.points[i], c.points[i + 1])) i = k;
  const a = c.points[i];
  const b = c.points[i + 1];
  if (!a || !b) return { chain: c, known: false };
  const u = norm(sub(b, a));
  const m: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const off = 2;
  const leftP: Vec2 = [m[0] - u[1] * off, m[1] + u[0] * off];
  const rightP: Vec2 = [m[0] + u[1] * off, m[1] - u[0] * off];
  const inL = regions.some((r) => pointInRings(leftP, r));
  const inR = regions.some((r) => pointInRings(rightP, r));
  if (inL && !inR) return { chain: reversed(c), known: true };
  if (inR && !inL) return { chain: c, known: true };
  return { chain: c, known: false };
}

export function reversed(c: Chain): Chain {
  return { points: [...c.points].reverse(), closed: c.closed };
}

/** Om två kedjor är samma (för att inte visa samma förslag två gånger). */
export function sameChain(a: Chain, b: Chain): boolean {
  return a.closed === b.closed && a.points.length === b.points.length && a.points.every((p, i) => dist(p, b.points[i]) < 0.5);
}

/** Avrunda till hela mm. */
export const mm = (p: Vec2): [number, number] => [Math.round(p[0]) || 0, Math.round(p[1]) || 0];
