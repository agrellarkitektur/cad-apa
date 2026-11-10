import { AREA_NO_FILL, areaColorOf, areaSettingsOf, areaText } from '../core/general';
import type { Color } from '../core/graphics';
import type { Primitive, Vec2 } from '../repr/primitives';
import { pointInRings } from '../geometry/vec';
import { AREA_NAMES, areaCode, areaParts, areaRegion, areaValue, COMPUTED_KINDS, largestRing, ringsArea, roundArea, type AreaParams } from './areaCalc';
import type { ElementType, PlanContext } from './registry';
import type { Element } from '../core/model';
import { centroidOf } from './rooms';

export type { AreaParams, AreaKind } from './areaCalc';

/** Nyckeln under Visa: areorna är släckta utom i Areaplanen (0.12.3). */
export const AREA_SHOW_KEY = 'Area';

/**
 * Areaobjektet (0.12.3): en BOA, BIA, LOA, ÖVA eller OPA som man klickar
 * fram ur rummen eller ritar själv, eller en BTA eller BYA som visar den
 * framräknade konturen. Ritas som en halvtransparent yta med konturen i
 * samma färg och en stämpel med beteckningen och arean, bara där areorna
 * är tända (Areaplanen, eller *Areor* under Visa).
 */
export const areaType: ElementType<AreaParams> = {
  type: 'Area',
  planReads: ['Wall', 'Door', 'Window', 'Slab', 'Shape2D', 'Area', 'Profile', 'Stair', 'Roof'],
  label: 'Area',
  labelPlural: 'Areor',
  drawOrder: 42,
  compares: false,
  defaults: () => ({ kind: 'BOA', outline: [] }),
  pickSoft: true,
  pickShape(el, ctx) {
    if (!ctx.view.hide?.includes(`+${AREA_SHOW_KEY}`)) return [];
    return areaRegion(ctx, el).map((poly) => poly.map((r) => [...r]));
  },
  // BYA och BTA först, så att bruksareorna ligger ovanpå dem.
  planBatch(items, ctx) {
    const rank = (k: string) => (k === 'BYA' ? 0 : k === 'BTA' ? 1 : 2);
    return [...items]
      .sort((a, b) => rank(ctx.params<AreaParams>(a.el).kind) - rank(ctx.params<AreaParams>(b.el).kind))
      .flatMap((it) => areaPrims(it.el, ctx));
  },
};

function areaPrims(el: Element, ctx: PlanContext): Primitive[] {
  {
    if (!ctx.view.hide?.includes(`+${AREA_SHOW_KEY}`)) return [];
    const p = ctx.params<AreaParams>(el);
    const polys = areaRegion(ctx, el);
    if (!polys.length) return [];
    const color = areaColorOf(ctx.doc.graphics, p.kind, p.func) as Color;
    const { opacity } = areaSettingsOf(ctx.doc.graphics);
    const origin = { objectId: el.id, objectType: 'Area', part: 'yta' };
    const out: Primitive[] = [];
    const fill = AREA_NO_FILL.has(p.kind) || opacity <= 0 ? null : { kind: 'solid' as const, color, opacity };
    for (const rings of polys) {
      // Ovanpå väggarna, halvtransparent: det som räknas med i väggar och pelare syns (Carl August 10 november).
      if (fill) out.push({ kind: 'region', rings, role: 'cut', fill, outline: null, noOutline: true, ownFill: true, origin });
      for (const r of rings) out.push({ kind: 'polyline', points: r, closed: true, pen: { weight: 0.35, color }, origin: { ...origin, part: 'kontur' } });
    }
    // Stämpeln: beteckningen (och funktionen), arean.
    const decimals = ctx.doc.graphics.general?.areaDecimals ?? 1;
    const m2 = COMPUTED_KINDS.includes(p.kind) ? roundArea(ringsArea(polys), decimals) : areaValue(ctx, el);
    const title = [areaCode(p), p.func?.trim()].filter(Boolean).join(' ');
    // I det första rummet man klickade i, eller i den största delen.
    const seed = p.seeds?.[0];
    const at: Vec2 = p.labelAt ?? (seed && polys.some((poly) => pointInRings(seed, poly)) ? seed : labelPoint(polys));
    const h = ctx.style.labels.heights.roomInfo;
    const line = h * 1.6 * ctx.scale;
    const tag = { objectId: el.id, objectType: 'Area', part: 'areatext' };
    out.push({ kind: 'text', at: [at[0], at[1] + line * 0.15], text: title, height: h, bold: true, align: 'middle', pen: { weight: 0.18, color: 'ink' }, origin: tag });
    // Delarna för sig när objektet redovisas i flera (0.12.4): BOA och BIA(u), BOA:H och BOA:L …
    const parts = COMPUTED_KINDS.includes(p.kind) ? [] : areaParts(ctx, el);
    const lines = parts.length > 1 ? parts.map((x) => `${x.code} ${areaText(roundArea(ringsArea(x.region), decimals), decimals)}`) : [areaText(m2, decimals)];
    lines.forEach((text, i) => out.push({ kind: 'text', at: [at[0], at[1] - line * (0.85 + i)], text, height: h, align: 'middle', pen: { weight: 0.18, color: 'ink' }, origin: tag }));
    return out;
  }
}

/** Stämpelns punkt: den största delens tyngdpunkt, eller en punkt inuti när den ligger utanför. */
function labelPoint(polys: readonly (readonly (readonly Vec2[])[])[]): Vec2 {
  const ring = largestRing(polys.map((p) => p.map((r) => [...r])));
  const c = centroidOf(ring);
  const poly = polys.find((p) => p[0] === ring) ?? [ring];
  if (pointInRings(c, poly)) return c;
  // Mitt på den längsta vågräta sträckan genom ytan i tyngdpunktens höjd.
  let best: Vec2 = ring[0];
  let len = 0;
  const xs: number[] = [];
  for (const r of poly)
    for (let i = 0; i < r.length; i++) {
      const a = r[i];
      const b = r[(i + 1) % r.length];
      if (a[1] > c[1] !== b[1] > c[1]) xs.push(a[0] + ((c[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
  xs.sort((x, y) => x - y);
  for (let i = 0; i + 1 < xs.length; i += 2)
    if (xs[i + 1] - xs[i] > len) {
      len = xs[i + 1] - xs[i];
      best = [(xs[i] + xs[i + 1]) / 2, c[1]];
    }
  return best;
}

export { AREA_NAMES };
