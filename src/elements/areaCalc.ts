// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import { type Element, type Id } from '../core/model';
import { difference, intersection, union, type Rings } from '../geometry/boolean';
import { signedArea } from '../geometry/chains';
import { bufferRings } from '../geometry/offset';
import { clipAll, clipTo, minus, solid } from './areaGeom';
import { aboveGroundZone } from './areaGround';
import { measurable, splitByHeight } from './areaHeight';
import type { Vec2 } from '../repr/primitives';
import { openingZone } from './opening';
import { type PlanContext } from './registry';
import { holeWidth, wallFrame, type OpeningParams } from './wall';
import { outsideSide } from './wallSides';
import { ringsArea, type WallInfo, wallsOf, existsNow, massOf, sidesIn, holesAt, otherFloorOpenings, outerContour, btaRegion, groundStorey, byaRegion } from './areaRegions';

/**
 * Areorna enligt SS 21054:2020 (0.12.3). Beräkningen ur modellen; objektet
 * som ritas och klickas på är `area.ts`, förteckningen `repr/schedules.ts`.
 *
 * - **BTA** per våning: husets ytterkontur (ytterväggarnas utsida, 8.4)
 *   utan andra hål i bjälklaget än trappans (8.3.1, 5.17.3).
 * - **BYA** på markplanet: samma kontur och de taksprång som enligt 6.4.2
 *   är mätvärda (djupare än 0,50 m med lägsta punkten under 3,00 m, eller
 *   mer än 1,50 m utanför fasaden mellan 3,00 och 5,00 m). Marken räknas vid ±0.
 * - **Areaobjekten** (BOA, BIA, LOA, ÖVA, OPA): en nyttjandeenhet ur rummen
 *   man klickat i (konturen följer de omslutande väggarnas insida), eller
 *   en egen ritad kontur. Med de automatiska avdragen räknas innerväggar
 *   upp till 0,30 m i sin helhet och tjockare 0,15 m in från varje sida
 *   (5.16.3); fristående pelare och schakt likadant (5.12.3, 5.8.2); en
 *   öppning eller smyg på minst 1,50 m räknas till karmen eller öppningens
 *   mitt (5.3.2, 5.17.2); väggen mellan en BIA och en BOA i samma bostad,
 *   med en dörr emellan, hör till BIA (5.18.2).
 *
 * - **Under taken** (0.12.4, `areaHeight.ts`): det mätvärda under snedtak
 *   (5.13, 8.4) och takkupor (5.14), och delningen i H och L (18.5).
 * - **Under mark** (0.12.4, `areaGround.ts`): 6-meterszonen (10.3.1.3,
 *   11.3.1.3, 18.3); BOA bortom zonen blir BIA(u), de andra slagen får (o)
 *   och (u). `areaParts` ger delarna som förteckningen och stämpeln visar.
 * - **OPA** (7.4): en egen kontur, utan avdrag, som slutar vid ytterväggens
 *   utsida.
 */

/** Areaslagen som kan ritas som objekt, och de som räknas fram. */
export type AreaKind = 'BOA' | 'BIA' | 'LOA' | 'ÖVA' | 'OPA' | 'BTA' | 'BYA';
export const AREA_KINDS: readonly AreaKind[] = ['BYA', 'BTA', 'BOA', 'BIA', 'LOA', 'ÖVA', 'OPA'];
/** Slagen som är bruksarea (BRA = summan av dem). */
export const BRA_KINDS: readonly AreaKind[] = ['BOA', 'BIA', 'LOA', 'ÖVA'];
/** Slagen som räknas fram av sig själva; ett objekt av dem visar bara konturen. */
export const COMPUTED_KINDS: readonly AreaKind[] = ['BTA', 'BYA'];

export const AREA_NAMES: Record<AreaKind | 'BRA', string> = {
  BYA: 'Byggnadsarea',
  BTA: 'Bruttoarea',
  BRA: 'Bruksarea',
  BOA: 'Boarea',
  BIA: 'Biarea',
  LOA: 'Lokalarea',
  ÖVA: 'Övrig area',
  OPA: 'Öppenarea',
};

export interface AreaParams {
  kind: AreaKind;
  /** Punkterna man klickat i (rummen i enheten); konturen följer väggarna. Utelämnad = den ritade konturen. */
  seeds?: [number, number][];
  /** Den ritade (lösgjorda) konturen, mm. */
  outline: [number, number][];
  /** Utan de automatiska avdragen (tjocka väggar, pelare, schakt). */
  noDeduct?: boolean;
  /** Underindelning efter funktion, t.ex. *Handel* och *Kontor* inom LOA (18.1). */
  func?: string;
  /** Tillhörighet (18.2): enskild eller gemensam. */
  belong?: 'e' | 'g';
  /** Temperaturreglering (18.6). */
  temp?: 't' | 'it';
  /** Stämpelns mittpunkt när den dragits dit. */
  labelAt?: [number, number];
  /** Delas efter rumshöjd (18.5): BOA:H och BOA:L (0.12.4). */
  heightSplit?: true;
}

/** Hur långt in i en vägg tjockare än 0,30 m arean räknas från varje sida, mm (5.16.3). */
const WALL_INTO = 150;
/** Bredaste öppningen som räknas som vägg, mm (5.3, 5.17). */
const WIDE_OPENING = 1500;
/** Glaspartiets högsta bröstning, mm (5.7): lägre räknas till karmlivet. */
const GLASS_SILL = 150;

/** Beteckningen med tillhörighet och temperaturreglering, t.ex. *BOAe(t)*. */
export function areaCode(p: Pick<AreaParams, 'kind' | 'belong' | 'temp'>): string {
  return `${p.kind}${p.belong ?? ''}${p.temp ? `(${p.temp})` : ''}`;
}

/**
 * Avrundning enligt SS 14141 regel A (4.3): närmaste, och en femma uppåt.
 * Delposter med en decimal, summor i hela m².
 */
export function roundArea(m2: number, decimals: number): number {
  const k = 10 ** decimals;
  return Math.floor(m2 * k + 0.5 + 1e-9) / k;
}

// ---------------------------------------------------------------------------
// Areaobjekten

/** Enheten ur rummen man klickat i: rummen, innerväggarna mellan dem och breda öppningar. */
function unitRegion(ctx: PlanContext, el: Element<any>, p: AreaParams): { region: Rings[]; inner: Set<Id>; shared: Rings[] } {
  const sel = holesAt(ctx, p.seeds ?? []);
  const inner = new Set<Id>();
  if (!sel.length) return { region: [], inner, shared: [] };
  const innerBodies: Rings[] = [];
  const parts: Rings[] = sel.map((h) => [h]);
  const shared: Rings[] = [];
  // Rummen utvidgade: innerväggarna klipps till det som ligger mellan rummen på båda sidor.
  const grown = new Map<string, Rings[]>();
  const around = (holes: readonly Vec2[][], d: number): Rings[] => {
    const k = `${holes.map((h) => sel.indexOf(h)).join(',')}:${Math.round(d)}`;
    let g = grown.get(k);
    if (!g) grown.set(k, (g = bufferRings(holes.map((h) => [h]), Math.round(d), 8)));
    return g;
  };
  const toBia = p.kind === 'BIA' ? biaWalls(ctx, el.id, sel) : new Set<Id>();
  for (const w of wallsOf(ctx)) {
    if (!w.body.length) continue;
    const f = wallFrame(w.p);
    const [l, r] = sidesIn(w, sel);
    if (l && r) {
      // En innervägg i enheten: den del som ligger mellan rum på båda sidor.
      inner.add(w.el.id);
      innerBodies.push(...w.body);
      const left = sel.filter((h) => sidesIn(w, [h])[0]);
      const right = sel.filter((h) => sidesIn(w, [h])[1]);
      parts.push(...w.body.flatMap((b) => clipTo(b, around(left, 2 * f.half + 2)).flatMap((x) => clipTo(x, around(right, 2 * f.half + 2)))));
      continue;
    }
    if (!l && !r) continue;
    if (toBia.has(w.el.id)) {
      const piece = w.body.flatMap((b) => clipTo(b, around(sel, 2 * f.half + 2)));
      parts.push(...piece);
      shared.push(...piece);
      continue;
    }
    parts.push(...wideOpenings(ctx, w, l ? 1 : -1));
  }
  const merged = parts.length > 1 ? union(parts) : parts;
  // Där innerväggar korsar varandra blir det små hål mitt i korsningen,
  // längre än en halv väggtjocklek från rummen; de ligger helt i väggarna och fylls.
  const region = innerBodies.length
    ? merged.map((poly) => [poly[0], ...poly.slice(1).filter((h) => ringsArea(innerBodies.flatMap((b) => intersection(b, [[h]]))) < ringsArea([[h]]) - 1e-6)])
    : merged;
  return { region, inner, shared };
}

/** Det som BIA-objekten på våningen tar av väggarna mot den här BOA:n. */
function biaClaims(ctx: PlanContext, boa: Id): Rings[] {
  const out: Rings[] = [];
  for (const e of ctx.visible('Area')) {
    const q = e.params as unknown as AreaParams;
    if (q.kind !== 'BIA' || !q.seeds?.length || !existsNow(ctx, e)) continue;
    if (![...biaWalls(ctx, e.id, holesAt(ctx, q.seeds), boa)].length) continue;
    out.push(...ctx.memo(`area-bia-shared:${e.id}`, () => unitRegion(ctx, e, q).shared));
  }
  return out;
}

/**
 * Väggarna som hör till BIA:n (5.18.2): upp till 0,30 m mellan den och en
 * BOA i samma bostad, alla väggar mellan dem när någon av dem har en dörr
 * (bostaden har inbördes förbindelse).
 */
function biaWalls(ctx: PlanContext, self: Id, own: readonly Vec2[][], only?: Id): Set<Id> {
  const out = new Set<Id>();
  for (const e of ctx.visible('Area')) {
    const q = e.params as unknown as AreaParams;
    if (e.id === self || q.kind !== 'BOA' || !q.seeds?.length || !existsNow(ctx, e) || (only && e.id !== only)) continue;
    const boa = holesAt(ctx, q.seeds);
    const between: Id[] = [];
    let door = false;
    for (const w of wallsOf(ctx)) {
      if (w.p.thickness > 300 + 0.5) continue;
      const [l, r] = sidesIn(w, own);
      if (l === r) continue;
      const [bl, br] = sidesIn(w, boa);
      if (!((l && br) || (r && bl))) continue;
      between.push(w.el.id);
      if (ctx.openingsIn(w.el.id).some((o) => existsNow(ctx, o))) door = true;
    }
    if (door) for (const id of between) out.add(id);
  }
  return out;
}

/**
 * Breda öppningar och smygar (minst 1,50 m) i en omslutande vägg (5.3.2,
 * 5.7, 5.17.2): i en yttervägg till karmens insida, i en vägg mot en annan
 * enhet till karmens mitt. Fönster med bröstning räknas till bröstningen.
 */
function wideOpenings(ctx: PlanContext, w: WallInfo, side: 1 | -1): Rings[] {
  const out: Rings[] = [];
  const exterior = ctx.memo(`area-outside:${w.el.id}`, () => outsideSide(ctx.doc, w.el)) !== null;
  for (const o of ctx.openingsIn(w.el.id)) {
    if (!existsNow(ctx, o)) continue;
    const op = ctx.params<OpeningParams & { sill?: number; swing?: 1 | -1; place?: 'out' | 'in' | 'mid'; floor?: boolean }>(o);
    if (holeWidth(op) < WIDE_OPENING - 0.5) continue;
    if (o.type === 'Window' && !op.floor && (op.sill ?? 0) > GLASS_SILL) continue;
    if (o.type !== 'Door' && o.type !== 'Window') continue;
    const z = openingZone(ctx, w.el, { ...op, door: o.type === 'Door' });
    const f = z.f;
    const face = side * f.half;
    const to = exterior ? (side > 0 ? z.hi : z.lo) : (z.lo + z.hi) / 2;
    const [a, b] = face > to ? [to, face] : [face, to];
    if (b - a < 1) continue;
    out.push([[f.at(z.h1, a), f.at(z.h2, a), f.at(z.h2, b), f.at(z.h1, b)]]);
  }
  return out;
}

/**
 * De automatiska avdragen (5.8, 5.12, 5.16): det som ligger mer än 0,15 m
 * från golvet i en vägg, pelare eller ett schakt inom enheten räknas bort,
 * och väggar som skär den ritade konturen (omslutande) räknas bort helt.
 */
function deducted(ctx: PlanContext, region: Rings[], inner: Set<Id> | null, shared: Rings[]): Rings[] {
  if (!region.length) return region;
  const mass = massOf(ctx);
  const walls = wallsOf(ctx);
  // Den ritade konturen: väggar som går över kanten är omslutande.
  const enclosing: Rings[] = [];
  if (!inner) {
    for (const w of walls) {
      if (!w.body.length) continue;
      const a = ringsArea(w.body);
      const inside = ringsArea(region.flatMap((r) => w.body.flatMap((b) => intersection(b, [r]))));
      if (inside > 1e-4 && inside < a - 1e-4) enclosing.push(...w.body);
    }
  }
  const floor = minus(region, [...mass, ...enclosing]);
  const keep = [...bufferRings(floor, WALL_INTO, 16, true), ...shared];
  const inMass = region.flatMap((r) => clipTo(r, mass));
  const core = inMass.length ? inMass.flatMap((m) => difference(m, keep)) : [];
  return minus(region, [...enclosing, ...core]);
}

/** Areaobjektets yta i vyn, med avdragen och utan andra hål i bjälklaget. */
export function areaRegion(ctx: PlanContext, el: Element<any>): Rings[] {
  return ctx.memo(`area-region:${el.id}`, () => {
    const p = ctx.params<AreaParams>(el);
    if (p.kind === 'BTA') return btaRegion(ctx);
    if (p.kind === 'BYA') return el.storey === groundStorey(ctx.doc) ? byaRegion(ctx) : [];
    let region: Rings[];
    let inner: Set<Id> | null = null;
    let shared: Rings[] = [];
    if (p.seeds?.length) {
      const u = unitRegion(ctx, el, p);
      region = u.region;
      inner = u.inner;
      shared = u.shared;
      // Väggarna mot en BIA i samma bostad hör till den (5.18.2), också där de korsar BOA:ns innerväggar.
      if (p.kind === 'BOA') region = minus(region, biaClaims(ctx, el.id));
    } else {
      const ring = (p.outline ?? []).map((q): Vec2 => [q[0], q[1]]);
      region = ring.length >= 3 ? [[ring]] : [];
    }
    // OPA (7.4): utan avdrag, och slutar vid ytterväggens utsida.
    if (p.kind === 'OPA') return solid(p.seeds?.length ? region : minus(region, outerContour(ctx)));
    if (!p.noDeduct) region = deducted(ctx, region, inner, shared);
    return solid(measurable(ctx, minus(region, otherFloorOpenings(ctx))));
  });
}

/** En del av ett areaobjekt som redovisas för sig (0.12.4): slaget, beteckningen och ytan. */
export interface AreaPart {
  kind: AreaKind;
  /** T.ex. *BOA*, *BIA(u)*, *BOA:L*, *LOAe(o)(t)*. */
  code: string;
  region: Rings[];
}

/**
 * Areaobjektets delar: på en våning delvis under mark ytan inom 6-meterszonen
 * och den bortom (BOA blir BIA, de andra får (o) och (u); 10.3.1.3, 18.3),
 * och med *Dela efter rumshöjd* H och L (18.5).
 */
export function areaParts(ctx: PlanContext, el: Element<any>): AreaPart[] {
  return ctx.memo(`area-parts:${el.id}`, () => {
    const p = ctx.params<AreaParams>(el);
    const region = areaRegion(ctx, el);
    if (COMPUTED_KINDS.includes(p.kind) || p.kind === 'OPA') return [{ kind: p.kind, code: areaCode(p), region }];
    const zone = aboveGroundZone(ctx);
    const byGround: { kind: AreaKind; level: '' | 'o' | 'u'; region: Rings[] }[] = !zone
      ? [{ kind: p.kind, level: '', region }]
      : [
          { kind: p.kind, level: p.kind === 'BOA' ? '' : 'o', region: clipAll(region, zone) },
          { kind: p.kind === 'BOA' ? 'BIA' : p.kind, level: 'u', region: minus(region, zone) },
        ];
    const out: AreaPart[] = [];
    for (const g of byGround) {
      const code = `${g.kind}${p.belong ?? ''}${g.level ? `(${g.level})` : ''}${p.temp ? `(${p.temp})` : ''}`;
      if (p.heightSplit && g.kind !== 'ÖVA') {
        const { high, low } = splitByHeight(ctx, g.region);
        out.push({ kind: g.kind, code: `${code}:H`, region: solid(high) }, { kind: g.kind, code: `${code}:L`, region: solid(low) });
      } else out.push({ kind: g.kind, code, region: solid(g.region) });
    }
    const kept = out.filter((x) => ringsArea(x.region) >= 0.005);
    return kept.length ? kept : [{ kind: p.kind, code: areaCode(p), region: [] }];
  });
}

/**
 * BTA på våningen i delar ovan och under mark (8.5, 18.3): BTA(o) och BTA(u)
 * på en våning delvis under mark, annars BTA.
 */
export function btaParts(ctx: PlanContext): { code: string; region: Rings[] }[] {
  const bta = btaRegion(ctx);
  const zone = aboveGroundZone(ctx);
  if (!zone) return [{ code: 'BTA', region: bta }];
  return [
    { code: 'BTA(o)', region: solid(clipAll(bta, zone)) },
    { code: 'BTA(u)', region: solid(minus(bta, zone)) },
  ].filter((x) => ringsArea(x.region) >= 0.005);
}

/** Arean i m², med en decimal (delpost, 4.3). */
export function areaValue(ctx: PlanContext, el: Element<any>): number {
  return roundArea(ringsArea(areaRegion(ctx, el)), 1);
}

/** Den yttre konturen av den största delen, för *Lösgör*. */
export function largestRing(polys: readonly Rings[]): Vec2[] {
  let best: Vec2[] = [];
  let a = 0;
  for (const p of polys) {
    const x = Math.abs(signedArea(p[0]));
    if (x > a) {
      a = x;
      best = p[0];
    }
  }
  return best;
}
