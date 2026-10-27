import type { Element, Id, ProjectDoc, Storey } from '../core/model';
import { LINE_TYPES } from '../core/lineTypes';
import { difference, intersection, union, type Rings } from '../geometry/boolean';
import { dist, pointInRings } from '../geometry/vec';
import type { Pen, Primitive, Vec2 } from '../repr/primitives';
import { buildingFootprint } from './footprint';
import { resolveParams, type PlanContext } from './registry';
import { halfPlaneBelow, outlineEdges, outlineRing, roofFrame, roofPlanes, roofRange, type RoofParams } from './roof';

/**
 * Taket i planen (0.10.2). Planen är ett snitt i våningens snitthöjd
 * (`Storey.cutHeight`): det av taket som ligger ovanför ritas punktstreckat,
 * det som ligger under heldraget, och där snittet går genom taket ritas en
 * snittyta. Med *Husets kontur genom taket* under Visa ritas ytterväggarnas
 * utsida streckad där taket ligger över.
 */

/** Snitthöjden över golvet när våningen inte har någon egen. */
export const DEFAULT_CUT_HEIGHT = 1200;

/** Visa-nyckeln för husets kontur genom taket; den är släckt om den inte står i vyns `hide` med plus. */
export const FOOTPRINT_KEY = 'footprint';

/**
 * Visa-nyckeln för tak på andra våningar (0.10.10), släckt från början: ett
 * tak ovanför vyn streckprickat, ett under våningens golv streckat.
 */
export const ROOFS_AROUND_KEY = 'roofsAround';

export const cutHeightOf = (s: Pick<Storey, 'cutHeight'>): number => s.cutHeight ?? DEFAULT_CUT_HEIGHT;

/**
 * Om taket syns i planen för en annan våning: det går upp i våningen, så att
 * en vindsvåning ser ett tak som ligger på planet under. Med *Tak på andra
 * våningar* under Visa (0.10.10) syns alla tak.
 */
export function roofShownOn(el: Element<any>, doc: ProjectDoc, storey: Id, hide?: readonly string[]): boolean {
  const home = doc.storeys.find((s) => s.id === el.storey);
  const here = doc.storeys.find((s) => s.id === storey);
  if (!home || !here || home === here) return false;
  const p = resolveParams<RoofParams>(doc, el);
  if (!p.outline?.length || !p.ref) return false;
  if (hide?.includes(`+${ROOFS_AROUND_KEY}`)) return true;
  const r = roofRange(p);
  return home.elevation + r.topMax > here.elevation + 1 && home.elevation + r.underMin < here.elevation + here.height - 1;
}

/** `under`: under våningens golv (0.10.10), syns bara med *Tak på andra våningar*. */
type Zone = 'above' | 'below' | 'cut' | 'under';

const ABOVE: Pen = { weight: 0.18, dash: LINE_TYPES.dashdot.dash };
const SEEN: Pen = { weight: 0.18 };
const UNDER: Pen = { weight: 0.18, dash: LINE_TYPES.dashed.dash };

export function roofPlanPrims(el: Element<any>, ctx: PlanContext): Primitive[] {
  const p = ctx.params<RoofParams>(el);
  const origin = { objectId: el.id, objectType: 'Roof' };
  const out: Primitive[] = [];
  const here = ctx.doc.storeys.find((s) => s.id === ctx.storey);
  const home = ctx.doc.storeys.find((s) => s.id === el.storey);
  // Snitthöjden i takets egna höjder (från dess våningsgolv).
  const h = here && home ? cutHeightOf(here) + here.elevation - home.elevation : -Infinity;
  // Våningens golv i takets höjder: det som ligger under ritas streckat.
  const floor = here && home ? here.elevation - home.elevation : -Infinity;
  const f = roofFrame(p);
  const zone = (q: Vec2): Zone => (f.under(q) > h + 0.5 ? 'above' : f.top(q) < floor - 0.5 ? 'under' : f.top(q) < h - 0.5 ? 'below' : 'cut');

  // Konturen, delad där undersidan och ovansidan går genom snitthöjden.
  let run: Vec2[] = [];
  let runZone: Zone | null = null;
  let runEdge = -1;
  const flush = () => {
    if (run.length >= 2 && runZone) {
      const pen = runZone === 'above' ? ABOVE : runZone === 'under' ? UNDER : SEEN;
      out.push(run.length === 2 ? { kind: 'line', a: run[0], b: run[1], pen, origin } : { kind: 'polyline', points: run, closed: false, pen, origin });
    }
    run = [];
    runZone = null;
  };
  for (const [a, b, edge] of outlineEdges(p)) {
    if (edge !== runEdge) flush();
    runEdge = edge;
    const ts = [0, 1];
    for (const g of [(q: Vec2) => f.under(q) - h, (q: Vec2) => f.top(q) - h, (q: Vec2) => f.top(q) - floor]) {
      const ga = g(a);
      const gb = g(b);
      if ((ga < 0 && gb > 0) || (ga > 0 && gb < 0)) ts.push(ga / (ga - gb));
    }
    ts.sort((x, y) => x - y);
    const at = (t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    for (let i = 0; i + 1 < ts.length; i++) {
      const q0 = at(ts[i]);
      const q1 = at(ts[i + 1]);
      if (dist(q0, q1) < 0.01) continue;
      const z = zone(at((ts[i] + ts[i + 1]) / 2));
      if (z !== runZone) {
        flush();
        runZone = z;
        run = [q0];
      }
      run.push(q1);
    }
  }
  flush();

  // Snittytan: där snitthöjden ligger mellan undersidan och ovansidan. Den
  // ritas under väggarna, så att en vägg som står under taket syns.
  if (Number.isFinite(h)) {
    const parts: Rings[] = [];
    for (const rp of roofPlanes(p)) {
      const lower = halfPlaneBelow(rp.under, h);
      if (!lower) continue;
      const below = halfPlaneBelow(rp.top, h);
      for (const r of intersection(rp.rings, [lower])) parts.push(...(below ? difference(r, [below]) : [r]));
    }
    const merged = parts.length > 1 ? union(parts) : parts;
    for (const rings of merged) if (rings[0]?.length >= 3 && Math.abs(signedArea(rings[0])) > 100) out.push({ kind: 'region', rings, role: 'cut', fill: { kind: 'none' }, outline: null, origin, under: true });
  }

  // Husets kontur streckad genom taket (vyinställning).
  if (ctx.view.hide?.includes(`+${FOOTPRINT_KEY}`)) {
    const ring = outlineRing(p);
    const pen: Pen = { weight: 0.18, dash: LINE_TYPES.dashed.dash };
    for (const poly of buildingFootprint(ctx))
      for (const [a, b] of clipToRing(poly[0], ring)) out.push({ kind: 'line', a, b, pen, origin: { ...origin, part: 'footprint' }, noPick: true });
  }
  return out;
}

function signedArea(r: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i];
    const q = r[(i + 1) % r.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** De delar av den slutna linjen `line` som ligger inne i `ring`. */
export function clipToRing(line: readonly Vec2[], ring: readonly Vec2[]): [Vec2, Vec2][] {
  const out: [Vec2, Vec2][] = [];
  for (let i = 0; i < line.length; i++) {
    const a = line[i];
    const b = line[(i + 1) % line.length];
    const d: Vec2 = [b[0] - a[0], b[1] - a[1]];
    const ts = [0, 1];
    for (let j = 0; j < ring.length; j++) {
      const c = ring[j];
      const e = ring[(j + 1) % ring.length];
      const s: Vec2 = [e[0] - c[0], e[1] - c[1]];
      const den = d[0] * s[1] - d[1] * s[0];
      if (Math.abs(den) < 1e-12) continue;
      const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
      const u = ((c[0] - a[0]) * d[1] - (c[1] - a[1]) * d[0]) / den;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
    }
    ts.sort((x, y) => x - y);
    for (let k = 0; k + 1 < ts.length; k++) {
      if (ts[k + 1] - ts[k] < 1e-9) continue;
      const tm = (ts[k] + ts[k + 1]) / 2;
      if (!pointInRings([a[0] + d[0] * tm, a[1] + d[1] * tm], [ring])) continue;
      const q0: Vec2 = [a[0] + d[0] * ts[k], a[1] + d[1] * ts[k]];
      const q1: Vec2 = [a[0] + d[0] * ts[k + 1], a[1] + d[1] * ts[k + 1]];
      // Bitar i rad blir en linje.
      const last = out[out.length - 1];
      if (last && dist(last[1], q0) < 0.01 && k > 0) last[1] = q1;
      else out.push([q0, q1]);
    }
  }
  return out;
}
