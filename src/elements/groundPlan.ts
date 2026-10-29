import type { Element } from '../core/model';
import { groundDefaults } from '../core/site';
import type { Primitive, Vec2 } from '../repr/primitives';
import { fillPrims, type FillParams } from './drawing2d';
import { difference, union, type Rings } from '../geometry/boolean';
import { ABOVE_PART, cutZone, planCutPen, type CutZone } from '../repr/planCutPens';
import { planCutHeight } from './planCut';
import type { WallProfile } from './groundWall';
import { groundLabel, isLineKind, storeyElevation, wallProfile, type GroundGeometry, type GroundParams } from './groundGeometry';
import { flatPoints, lineLength } from './groundLines';
import { arrow, drainLine, groundText, levelMark, minCrossText, wallLeader } from './groundMarks';
import { showLittera } from './littera';
import { outward, slopeArea, slopeMarks, slopeOutline } from './groundSlopes';
import { middleAt, rampWarnings, sideEdge, steepest } from './groundRamp';
import { rampProfile } from './rampProfile';
import type { PlanContext } from './registry';

/**
 * Markobjekten i planen (0.10.4–0.10.5, för sig sedan 0.10.6): markytor
 * som en kontur med höjden (och fallets pil), vägar med lutningen och
 * höjderna i ändarna, höjdpunkter, brytlinjer och stödmurar. Markytan och
 * vägen kan ha en fyllning (0.10.7), bakom väggarna.
 */
export function groundPlan(ctx: PlanContext, el: Element<any>, g: GroundGeometry): Primitive[] {
  const p = ctx.params<GroundParams>(el);
  if (isLineKind(p.kind)) return linePlan(ctx, el, p, g);
  const origin = { objectId: el.id, objectType: 'Ground' };
  const out: Primitive[] = fillOf(ctx, el, p, g.rings.map((poly) => [...poly, ...g.holes]));
  // Konturen: tunn, eller tjock där kanten är en stödmur. Urgrävningen under bjälklaget streckad.
  const pen = p.edge === 'wall' ? { weight: 0.5 } : p.slab ? { weight: 0.18, dash: [4, 1.5] } : { weight: 0.25 };
  for (const poly of g.rings) for (const ring of poly) out.push({ kind: 'polyline', points: ring, closed: true, pen, origin: { ...origin, part: 'kontur' } });
  const text = `${groundLabel(p)} ${hText(ctx, g.label.height)}${g.label.fall ? ` · 1:${g.label.fall.toLocaleString('sv-SE')}` : ''}`;
  out.push({ kind: 'text', at: g.label.at, text, height: 2, align: 'middle', pen: { weight: 0.18 }, origin: { ...origin, part: 'höjd' } });
  // Minsta sidolutning (0.10.20) under höjden, understruken.
  out.push(...minCrossText(ctx, el, p, [g.label.at[0], g.label.at[1] - (g.label.fall && !p.around ? 6 : 3.5) * ctx.scale]));
  // Fallets riktning: runt huset en pil ut från varje fasad (0.10.8), annars en från mitten.
  if (g.label.fall && p.around) out.push(...aroundArrows(ctx, g, p.distance ?? groundDefaults(ctx.doc.site).distance, { ...origin, part: 'fall' }));
  if (g.label.fall && !p.around) {
    const a = ((p.fallDir ?? 0) * Math.PI) / 180;
    const l = 8 * ctx.scale;
    const s: Vec2 = [g.label.at[0], g.label.at[1] - 3 * ctx.scale];
    out.push(...arrow(ctx, s, [s[0] + Math.cos(a) * l, s[1] + Math.sin(a) * l], { ...origin, part: 'fall' }));
  }
  // Slänternas fyllning (0.10.14) bakom objektets egen.
  if (p.slopeFill?.fill) out.unshift(...fillOf(ctx, el, p.slopeFill, slopeArea(ctx, g), 'släntens fyllning'));
  out.push(...slopeMarks(ctx, g, { ...origin, part: 'slänt' }), ...slopeOutline(ctx, g, { ...origin, part: 'släntkontur' }));
  return out;
}

/** Fasader kortare än så får ingen egen pil runt huset, mm. */
const ARROW_FACADE = 3000;

/** Runt huset (0.10.8): en pil ut från varje fasad, mitt på markytan, med fallet. */
function aroundArrows(ctx: PlanContext, g: GroundGeometry, distance: number, origin: Primitive['origin']): Primitive[] {
  const out: Primitive[] = [];
  const fall = g.label.fall!;
  const l = Math.min(6 * ctx.scale, Math.max(distance * 0.8, 1));
  for (const ring of g.holes) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const n = outward(ring, a, b);
      if (!n || Math.hypot(b[0] - a[0], b[1] - a[1]) < ARROW_FACADE) continue;
      const m: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const s: Vec2 = [m[0] + n[0] * (distance - l) / 2, m[1] + n[1] * (distance - l) / 2];
      const e: Vec2 = [s[0] + n[0] * l, s[1] + n[1] * l];
      out.push(...arrow(ctx, s, e, origin));
      // Fallet vid pilen, längs fasaden.
      let ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      if (ang > Math.PI / 2 + 1e-6) ang -= Math.PI;
      if (ang < -Math.PI / 2 + 1e-6) ang += Math.PI;
      const t = 2 * ctx.scale;
      out.push({ kind: 'text', at: [(s[0] + e[0]) / 2 + Math.cos(ang) * t * 1.5, (s[1] + e[1]) / 2 + Math.sin(ang) * t * 1.5], angle: ang, text: `1:${fall.toLocaleString('sv-SE')}`, height: 1.8, align: 'middle', pen: { weight: 0.18 }, origin });
    }
  }
  return out;
}

/** Fyllningen (0.10.7), som 2D-formens, bakom väggarna. */
function fillOf(ctx: PlanContext, el: Element<any>, p: Partial<FillParams>, polys: Vec2[][][], part?: string): Primitive[] {
  if (!p.fill || ctx.view.hide?.includes('fill')) return [];
  return polys.flatMap((rings) => fillPrims(rings, p as FillParams, { objectId: el.id, objectType: 'Ground' }, true, ctx.style, ctx.scale, ctx.view.category)).map((q) => (part && q.origin ? { ...q, origin: { ...q.origin, part } } : q));
}

/** Höjden som text, i RH 2000 när projektet har en plats, med projektets decimaler (0.10.20). */
const hText = groundText;

/** Normalen åt vänster längs polylinjen vid sträckan `s` mm. */
function normalAt(pts: readonly Vec2[], s: number): Vec2 {
  let rest = s;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if ((l >= rest || i === pts.length - 1) && l > 0) return [-(pts[i][1] - pts[i - 1][1]) / l, (pts[i][0] - pts[i - 1][0]) / l];
    rest -= l;
  }
  return [0, 1];
}

/**
 * Ramp/väg, höjdpunkt, brytlinje och stödmur i planen (0.10.5).
 * Vägen: sidorna och tvärlinjerna i ändarna (som kan slås av, 0.10.7), en
 * pil nedför mittlinjen med lutningen (*1:12*) och höjderna i ändarna; en
 * varning när den är för brant eller saknar vilplan.
 */
function linePlan(ctx: PlanContext, el: Element<any>, p: GroundParams, g: GroundGeometry): Primitive[] {
  const origin = { objectId: el.id, objectType: 'Ground' };
  const out: Primitive[] = [];
  // Linjen med bågarna som raka bitar (0.10.19).
  const pts = flatPoints(p.line, p.bulges);
  const h0 = p.height ?? 0;
  const h1 = p.endHeight ?? h0;
  const th = 2;
  const text = (at: Vec2, t: string, part: string, extra: Partial<Primitive> = {}) => out.push({ kind: 'text', at, text: t, height: th, align: 'middle', pen: { weight: 0.18 }, origin: { ...origin, part }, ...extra } as Primitive);
  if (p.kind === 'level') return levelMark(ctx, el, p, g);
  if (p.kind === 'drain') return drainLine(ctx, el, p);
  if (p.kind === 'point') {
    const c = pts[0];
    const r = 1.2 * ctx.scale;
    out.push({ kind: 'line', a: [c[0] - r, c[1] - r], b: [c[0] + r, c[1] + r], pen: { weight: 0.25 }, origin: { ...origin, part: 'punkt' } });
    out.push({ kind: 'line', a: [c[0] - r, c[1] + r], b: [c[0] + r, c[1] - r], pen: { weight: 0.25 }, origin: { ...origin, part: 'punkt' } });
    text([c[0], c[1] + 2 * ctx.scale], hText(ctx, h0), 'höjd');
    return out;
  }
  if (p.kind === 'breakline') {
    out.push({ kind: 'polyline', points: pts, closed: false, pen: { weight: 0.25, dash: [6, 1.5, 1, 1.5] }, origin: { ...origin, part: 'linje' } });
    text([pts[0][0], pts[0][1] + 2 * ctx.scale], hText(ctx, h0), 'höjd');
    if (Math.abs(h1 - h0) >= 1) text([pts[pts.length - 1][0], pts[pts.length - 1][1] + 2 * ctx.scale], hText(ctx, h1), 'höjd');
    return out;
  }
  if (p.kind === 'wall') {
    const prof = wallProfile(ctx, el);
    // Snittet i planen (0.10.16): där krönet ligger under snitthöjden ritas
    // muren som vy, där foten ligger över streckprickad. På Platsen (0.10.25),
    // utan snitthöjd, ritas muren ovanifrån (0.10.28.1; snittad före det):
    // materialets ytfyllning, som markytorna, och konturen som vy.
    const h = planCutHeight(ctx);
    const parts = prof && h !== undefined && Number.isFinite(h) ? wallCutParts(prof, storeyElevation(ctx, el.storey) + h) : null;
    // Det snittade svart, eller med materialets fyllning (0.10.28) och konturen 0,35.
    const cut = (rings: Vec2[][]) => {
      if (!p.fill || ctx.view.hide?.includes('fill')) {
        out.push({ kind: 'region', role: 'cut', rings, fill: { kind: 'solid', color: 'ink' }, outline: { weight: 0.35 }, origin: { ...origin, part: 'mur' } } as Primitive);
        return;
      }
      out.push(...fillPrims(rings, p as unknown as FillParams, origin, false, ctx.style, ctx.scale, ctx.view.category).map((q) => ({ ...q, origin: { ...origin, part: 'mur' } })));
      for (const ring of rings) out.push({ kind: 'polyline', points: ring, closed: true, pen: { weight: 0.35 }, origin: { ...origin, part: 'mur' } });
    };
    if (!parts) {
      const pen = planCutPen(ctx.style, 'Ground', 'below');
      for (const ring of g.rings[0]) {
        if (p.fill && !ctx.view.hide?.includes('fill')) out.push(...fillPrims([ring], p as unknown as FillParams, origin, true, ctx.style, ctx.scale, ctx.view.category).map((q) => ({ ...q, origin: { ...origin, part: 'mur' } })));
        out.push({ kind: 'polyline', points: ring, closed: true, pen, origin: { ...origin, part: 'mur' } });
      }
    } else {
      for (const rings of parts.cut) cut(rings);
      for (const zone of ['below', 'above'] as const) {
        const pen = planCutPen(ctx.style, 'Ground', zone);
        for (const rings of parts[zone])
          for (const ring of rings) out.push({ kind: 'polyline', points: ring, closed: true, pen, origin: { ...origin, part: zone === 'above' ? ABOVE_PART : 'mur' } });
      }
    }
    // Krönet (0.10.9): MK i ändarna och vid höjdpunkterna, som får ett streck tvärs över muren
    // (*ÖK* före 0.10.20). Ledaren med littera och murkrön (0.10.20) på högra sidan om mitten.
    if (!prof) return out;
    if (showLittera(ctx, 'Ground')) out.push(...wallLeader(ctx, el, prof));
    const st = prof.stations;
    const half = Math.hypot(st[0].left[0] - st[0].at[0], st[0].left[1] - st[0].at[1]);
    const beside = (at: Vec2, s: number, h: number, side: 1 | -1) => {
      const n = normalAt(prof.center, s);
      const d = half + 3 * ctx.scale;
      text([at[0] + n[0] * d * side, at[1] + n[1] * d * side - 0.7 * ctx.scale], `MK ${hText(ctx, h)}`, 'höjd');
    };
    beside(st[0].at, 0, prof.start, 1);
    beside(st[st.length - 1].at, st[st.length - 1].s, prof.end, 1);
    for (const pin of prof.pins) {
      const n = normalAt(prof.center, pin.s);
      const r = half + 1.2 * ctx.scale;
      out.push({ kind: 'line', a: [pin.at[0] - n[0] * r, pin.at[1] - n[1] * r], b: [pin.at[0] + n[0] * r, pin.at[1] + n[1] * r], pen: { weight: 0.25 }, origin: { ...origin, part: 'höjdpunkt' } });
      beside(pin.at, pin.s, pin.h, -1);
    }
    return out;
  }
  // Vägen: fyllningen, sidorna och tvärlinjerna. Sidorna för sig (0.10.18), tjocka där de är stödmur.
  out.unshift(...fillOf(ctx, el, p, [g.rings[0]]));
  // Slänternas fyllning (0.10.14) bakom vägens egen; glömd här till 0.10.21.1.
  if (p.slopeFill?.fill) out.unshift(...fillOf(ctx, el, p.slopeFill, slopeArea(ctx, g), 'släntens fyllning'));
  const sides = g.sides!;
  const edge = (points: Vec2[], part: string, wall: boolean) => out.push({ kind: 'polyline', points, closed: false, pen: { weight: wall ? 0.5 : 0.25 }, origin: { ...origin, part } });
  edge(sides.right, 'kant', sideEdge(p, 'right') === 'wall');
  edge([...sides.left].reverse(), 'kant', sideEdge(p, 'left') === 'wall');
  const ends = p.edge === 'wall';
  if (p.startLine !== false) edge([sides.left[0], sides.right[0]], 'början', ends);
  if (p.endLine !== false) edge([sides.right[sides.right.length - 1], sides.left[sides.left.length - 1]], 'slutet', ends);
  // Lutningen längs referenslinjen: en pil nedför och 1:N för varje sträcka mellan punkter med höjd (0.10.18).
  const center = g.center ?? pts;
  const def = groundDefaults(ctx.doc.site);
  const { levels, runs } = rampProfile(p, def);
  const max = p.maxSlope ?? def.rampMax;
  const warn = rampWarnings(levels, max, def, p);
  const total = lineLength(center);
  const ratioText = (n: number) => `1:${(Math.round(n * 10) / 10).toLocaleString('sv-SE')}`;
  for (const r of runs) {
    if (!Number.isFinite(r.ratio)) continue;
    const len = Math.min((r.b.s - r.a.s) * 0.6, 14 * ctx.scale);
    const m = (r.a.s + r.b.s) / 2;
    const down = r.b.h <= r.a.h;
    out.push(...arrow(ctx, middleAt(center, sides, m + (down ? -len / 2 : len / 2)), middleAt(center, sides, m + (down ? len / 2 : -len / 2)), { ...origin, part: 'lutning' }));
    if (runs.length > 1) {
      const at = middleAt(center, sides, m);
      const steep = r.ratio < max - 1e-6;
      text([at[0], at[1] - 3.5 * ctx.scale], `${ratioText(r.ratio)}${steep ? ' !' : ''}`, 'lutning', steep ? { pen: { weight: 0.18, color: 'accent' } } : {});
    }
  }
  const n = steepest(runs);
  const ratio = runs.length > 1 ? '' : Number.isFinite(n) ? ` ${ratioText(n)}` : ' Plan';
  const mid = middleAt(center, sides, total / 2);
  text([mid[0], mid[1] + 2 * ctx.scale], `${groundLabel(p)}${ratio}${warn.length ? ' !' : ''}`, 'lutning', warn.length ? { pen: { weight: 0.18, color: 'accent' } } : {});
  // Minsta sidolutning (0.10.20) över namnet, understruken.
  out.push(...minCrossText(ctx, el, p, [mid[0], mid[1] + 5.5 * ctx.scale]));
  out.push(...slopeMarks(ctx, g, { ...origin, part: 'slänt' }), ...slopeOutline(ctx, g, { ...origin, part: 'släntkontur' }));
  // Höjderna i ändarna (i slutet bara när den skiljer sig från början) och i punkterna däremellan som har en höjd.
  // Ändarnas höjd står mitt på tvärlinjen, som förut; de andra vid punkten.
  const last = (p.line ?? []).length - 1;
  const midOf = (a: Vec2, b: Vec2): Vec2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  for (const l of levels) {
    if (levels.length === 2 && l.i === last && Math.abs(l.h - h0) < 1) continue;
    const at = l.i === 0 ? midOf(sides.left[0], sides.right[0]) : l.i === last ? midOf(sides.left[sides.left.length - 1], sides.right[sides.right.length - 1]) : l.at;
    text([at[0], at[1] - 3 * ctx.scale], hText(ctx, l.h), 'höjd');
  }
  return out;
}

/**
 * Stödmuren delad längs sin längd efter planens snitt (0.10.16), `cut` i
 * absoluta höjder: bitarna mellan profilens punkter, delade där krönet
 * eller foten går genom snitthöjden. Null när hela muren är snittad (då
 * ritas den som förut, ur konturen). Det som ligger över snittet tas bort
 * där det täcks av det snittade.
 */
export function wallCutParts(prof: WallProfile, cut: number): Record<CutZone, Rings[]> | null {
  const st = prof.stations;
  const zoneOf = (top: number, bottom: number) => cutZone(bottom, top, cut);
  if (st.every((x) => zoneOf(x.top, x.bottom) === 'cut')) return null;
  const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const quads: Record<CutZone, Rings[]> = { cut: [], below: [], above: [] };
  for (let i = 1; i < st.length; i++) {
    const a = st[i - 1];
    const b = st[i];
    const ts = [0, 1];
    for (const [ga, gb] of [
      [a.top - cut, b.top - cut],
      [a.bottom - cut, b.bottom - cut],
    ])
      if ((ga < 0 && gb > 0) || (ga > 0 && gb < 0)) ts.push(ga / (ga - gb));
    ts.sort((x, y) => x - y);
    for (let k = 0; k + 1 < ts.length; k++) {
      const t0 = ts[k];
      const t1 = ts[k + 1];
      if (t1 - t0 < 1e-6) continue;
      const tm = (t0 + t1) / 2;
      const z = zoneOf(a.top + (b.top - a.top) * tm, a.bottom + (b.bottom - a.bottom) * tm);
      quads[z].push([[lerp(a.right, b.right, t0), lerp(a.right, b.right, t1), lerp(a.left, b.left, t1), lerp(a.left, b.left, t0)]]);
    }
  }
  const cutU = quads.cut.length ? union(quads.cut) : [];
  const above = quads.above.length ? union(quads.above) : [];
  return {
    cut: cutU,
    below: quads.below.length ? union(quads.below) : [],
    above: cutU.length ? above.flatMap((r) => difference(r, cutU)) : above,
  };
}
