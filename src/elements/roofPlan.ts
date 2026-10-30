import { signedArea } from '../geometry/chains';
import type { Element, Id, ProjectDoc, Storey } from '../core/model';
import { LINE_TYPES } from '../core/lineTypes';
import { boxesTouch, boxOf, difference, intersection, union, type Rings } from '../geometry/boolean';
import { dist, pointInRings } from '../geometry/vec';
import type { Pen, Primitive, Vec2 } from '../repr/primitives';
import { buildingFootprint } from './footprint';
import { cutHeightOf } from './planCut';
import { ABOVE_PART, planCutPen } from '../repr/planCutPens';
import { resolveParams, type PlanContext } from './registry';
import { fillPrims, materialCutFill, materialCutPrims, type FillParams } from './fill2d';
import { buildingMaterialOf, materialPen } from './buildingMaterial';
import { halfPlaneBelow, outlineEdges, outlineRing, roofFrame, roofPlanes, roofRange, type RoofParams } from './roof';

/**
 * Taket i planen (0.10.2). Planen är ett snitt i våningens snitthöjd
 * (`Storey.cutHeight`): det av taket som ligger ovanför ritas punktstreckat,
 * det som ligger under heldraget, och där snittet går genom taket ritas en
 * snittyta. Med *Husets kontur genom taket* under Visa ritas ytterväggarnas
 * utsida streckad där taket ligger över.
 */

export { cutHeightOf, DEFAULT_CUT_HEIGHT } from './planCut';

/** Visa-nyckeln för husets kontur genom taket; den är släckt om den inte står i vyns `hide` med plus. */
export const FOOTPRINT_KEY = 'footprint';

/**
 * Visa-nyckeln för tak på andra våningar (0.10.10), släckt från början: ett
 * tak ovanför vyn streckprickat, ett under våningens golv streckat. Gäller
 * våningen ovanför och alla under (0.10.12).
 */
export const ROOFS_AROUND_KEY = 'roofsAround';


/**
 * Om taket syns i planen för en annan våning: det går upp i våningen, så att
 * en vindsvåning ser ett tak som ligger på planet under. Med *Tak på andra
 * våningar* under Visa (0.10.10) syns också taken på våningen ovanför och på
 * alla våningar under (0.10.12).
 */
export function roofShownOn(el: Element<any>, doc: ProjectDoc, storey: Id, hide?: readonly string[]): boolean {
  const home = doc.storeys.find((s) => s.id === el.storey);
  const here = doc.storeys.find((s) => s.id === storey);
  if (!home || !here || home === here) return false;
  const p = resolveParams<RoofParams>(doc, el);
  if (!p.outline?.length || !p.ref) return false;
  // På Platsen (0.10.25) syns alla tak, ovanifrån.
  if (here.site) return true;
  const r = roofRange(p);
  if (hide?.includes(`+${ROOFS_AROUND_KEY}`) && aroundStorey(doc, home, here)) return true;
  return home.elevation + r.topMax > here.elevation + 1 && home.elevation + r.underMin < here.elevation + here.height - 1;
}

/**
 * Våningarna vars tak syns med *Tak på andra våningar* (0.10.12): våningen
 * närmast ovanför och alla under (förut alla våningar).
 */
function aroundStorey(doc: ProjectDoc, home: Storey, here: Storey): boolean {
  if (home.elevation < here.elevation) return true;
  const above = doc.storeys.filter((s) => !s.site && s.elevation > here.elevation);
  return above.length > 0 && home.elevation === Math.min(...above.map((s) => s.elevation));
}

/** `under`: under våningens golv (0.10.10), syns bara med *Tak på andra våningar*. */
type Zone = 'above' | 'below' | 'cut' | 'under';

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
  // Pennorna ur stilmallen (0.10.16).
  const ABOVE = planCutPen(ctx.style, 'Roof', 'above');
  // Materialets penna (0.10.28.2) för det som syns uppifrån.
  const m = buildingMaterialOf(p, ctx.style);
  const SEEN = materialPen(m, planCutPen(ctx.style, 'Roof', 'below'));
  const zone = (q: Vec2): Zone => (f.under(q) > h + 0.5 ? 'above' : f.top(q) < floor - 0.5 ? 'under' : f.top(q) < h - 0.5 ? 'below' : 'cut');

  // Konturen, delad där undersidan och ovansidan går genom snitthöjden.
  let run: Vec2[] = [];
  let runZone: Zone | null = null;
  let runEdge = -1;
  const flush = () => {
    if (run.length >= 2 && runZone) {
      const pen = runZone === 'above' ? ABOVE : runZone === 'under' ? UNDER : SEEN;
      const o = runZone === 'above' ? { ...origin, part: ABOVE_PART } : origin;
      out.push(run.length === 2 ? { kind: 'line', a: run[0], b: run[1], pen, origin: o } : { kind: 'polyline', points: run, closed: false, pen, origin: o });
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
    const cut = materialCutFill(m, ctx.actionOf(el));
    for (const rings of merged) {
      if (!(rings[0]?.length >= 3 && Math.abs(signedArea(rings[0])) > 100)) continue;
      // Materialets snitt (0.10.28.2), annars stilmallens.
      if (cut) out.push(...materialCutPrims(rings, cut, origin, ctx.style, ctx.scale, true, true));
      else out.push({ kind: 'region', rings, role: 'cut', fill: { kind: 'none' }, outline: null, origin, under: true });
    }
  }

  // Fyllningen i planen (0.10.28.2): det av taket som ligger helt under
  // snittet, sett uppifrån (på Platsen hela taket). Går inte att klicka på.
  if (p.fill && !ctx.view.hide?.includes('fill')) {
    const seen: Rings[] = [];
    for (const rp of roofPlanes(p)) {
      if (!Number.isFinite(h)) {
        seen.push(rp.rings);
        continue;
      }
      const below = halfPlaneBelow(rp.top, h);
      if (below) seen.push(...intersection(rp.rings, [below]));
    }
    const merged = seen.length > 1 ? union(seen) : seen;
    for (const rings of merged) if (rings[0]?.length >= 3) out.push(...fillPrims(rings, p as unknown as FillParams, origin, true, ctx.style, ctx.scale, ctx.view.category).map((q) => ({ ...q, noPick: true })));
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


/** Bitarna av den slutna linjen som ligger innanför ringen (husets kontur genom taket). */
export function clipToRing(line: readonly Vec2[], ring: readonly Vec2[]): [Vec2, Vec2][] {
  return clipToRings(line, [ring], true);
}

/**
 * Bitarna av den slutna linjen som ligger innanför (`inside`) eller utanför
 * alla ringarna (0.10.25: husets kontur på Platsen, heldragen där inget tak
 * ligger över).
 */
export function clipToRings(line: readonly Vec2[], rings: readonly (readonly Vec2[])[], inside: boolean): [Vec2, Vec2][] {
  const out: [Vec2, Vec2][] = [];
  for (let i = 0; i < line.length; i++) {
    const a = line[i];
    const b = line[(i + 1) % line.length];
    const d: Vec2 = [b[0] - a[0], b[1] - a[1]];
    const ts = [0, 1];
    for (const ring of rings)
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
      const m: Vec2 = [a[0] + d[0] * tm, a[1] + d[1] * tm];
      if (rings.some((r) => pointInRings(m, [r])) !== inside) continue;
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

/** Visa-nyckeln för husets kontur på Platsen (0.10.25), tänd från början. */
export const HOUSE_KEY = 'house';

/**
 * Husets kontur på Platsen (0.10.25): ytterväggarnas utsida på alla
 * våningar, heldragen där inget tak ligger över och streckad under taken
 * (som *Husets kontur genom taket*). Går att snäppa mot.
 */
export function houseOnSite(ctx: PlanContext): Primitive[] {
  const roofs = ctx.view.hide?.includes('Roof') ? [] : ctx.visible('Roof').filter((el) => !ctx.hiddenByView(el) && ctx.actionOf(el) !== 'demolished').map((el) => outlineRing(ctx.params<RoofParams>(el))).filter((r) => r.length >= 3);
  const origin = { objectId: 'husets-kontur', objectType: 'House', part: 'husets kontur' };
  const seen: Pen = { weight: 0.35 };
  const under: Pen = { weight: 0.18, dash: LINE_TYPES.dashed.dash };
  // Under taken ritar taket den streckade konturen självt när den är tänd.
  const roofDraws = ctx.view.hide?.includes(`+${FOOTPRINT_KEY}`);
  const boxes = roofs.map((r) => boxOf([r]));
  const out: Primitive[] = [];
  for (const poly of buildingFootprint(ctx)) {
    const ring = poly[0];
    // Bara taken vars ruta rör konturen prövas kant mot kant.
    const box = boxOf([ring]);
    const near = roofs.filter((_, i) => boxesTouch(box, boxes[i]));
    if (!near.length) {
      out.push({ kind: 'polyline', points: ring, closed: true, pen: seen, origin });
      continue;
    }
    for (const [a, b] of clipToRings(ring, near, false)) out.push({ kind: 'line', a, b, pen: seen, origin });
    if (!roofDraws) for (const [a, b] of clipToRings(ring, near, true)) out.push({ kind: 'line', a, b, pen: under, origin, noPick: true });
  }
  return out;
}
