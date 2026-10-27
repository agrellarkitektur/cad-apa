import type { Element } from '../core/model';
import { groundAt, groundDefaults, levelText, terrainOf } from '../core/site';
import type { Primitive, Vec2 } from '../repr/primitives';
import { fillPrims, type FillParams } from './drawing2d';
import { difference, union, type Rings } from '../geometry/boolean';
import { ABOVE_PART, cutZone, planCutPen, type CutZone } from '../repr/planCutPens';
import { planCutHeight } from './planCut';
import type { WallProfile } from './groundWall';
import { sameItems } from '../repr/reuse';
import { finishedTerrain, groundLabel, isLineKind, storeyElevation, wallProfile, type GroundGeometry, type GroundParams } from './groundGeometry';
import { lineLength } from './groundLines';
import { middleAt, rampLevels, rampRuns, rampWarnings, sideEdge, steepest } from './groundRamp';
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
  const text = `${groundLabel(p)} ${levelText(ctx.doc.site, g.label.height)}${g.label.fall ? ` · 1:${g.label.fall.toLocaleString('sv-SE')}` : ''}`;
  out.push({ kind: 'text', at: g.label.at, text, height: 2, align: 'middle', pen: { weight: 0.18 }, origin: { ...origin, part: 'höjd' } });
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
  out.push(...slopeMarks(ctx, g, { ...origin, part: 'slänt' }));
  return out;
}

/** Ytan som ringen omsluter, positiv moturs. */
function signedArea(ring: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** Normalen ut från ringen längs kanten `a`–`b`, eller null för en kant utan längd. */
function outward(ring: readonly Vec2[], a: Vec2, b: Vec2): Vec2 | null {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (l < 1) return null;
  const sgn = signedArea(ring) >= 0 ? 1 : -1;
  return [(sgn * (b[1] - a[1])) / l, (-sgn * (b[0] - a[0])) / l];
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

/** Hur tätt släntstrecken ligger, mm på papperet. */
const MARK_SPACING = 2.5;

/**
 * Släntmarkeringar (0.10.8): där markobjektet möter marken med slänt,
 * streck vinkelrätt mot kanten från släntens krön ned mot foten, långa och
 * korta om vartannat. Slänten känns ut från kanten i den färdiga marken: den
 * går så länge den färdiga skiljer sig från den befintliga och lutar som en
 * slänt. Schakt har krönet ute vid marken, fyll vid kanten.
 */
function slopeMarks(ctx: PlanContext, g: GroundGeometry, origin: Primitive['origin']): Primitive[] {
  const reach = slopeReach(ctx, g);
  if (!reach) return [];
  const minLen = 0.8 * ctx.scale;
  const pen = { weight: 0.13 };
  const out: Primitive[] = [];
  let k = 0;
  walkSlope(g, MARK_SPACING * ctx.scale, false, (q, n) => {
    k++;
    const r = reach(q, n);
    if (!r || r.d < minLen) return;
    const end: Vec2 = [q[0] + n[0] * r.d, q[1] + n[1] * r.d];
    // Krönet: ute vid marken i schakt, vid kanten i fyll.
    const [from, to] = r.cut ? [end, q] : [q, end];
    const part = k % 2 === 1 ? 1 : 0.4;
    out.push({ kind: 'line', a: from, b: [from[0] + (to[0] - from[0]) * part, from[1] + (to[1] - from[1]) * part], pen, origin });
  });
  return out;
}

/**
 * Hur långt slänten går ut från kanten i `q` längs normalen `n`, och om den
 * är schakt; null där ingen slänt börjar. Null för ett objekt utan slänt.
 */
function slopeReach(ctx: PlanContext, g: GroundGeometry): ((q: Vec2, n: Vec2) => { d: number; cut: boolean } | null) | null {
  const sh = g.shape;
  if (!sh || sh.slope === null || sh.blend) return null;
  const f = finishedTerrain(ctx);
  const t = terrainOf(ctx.doc);
  if (!f || !t) return null;
  const step = Math.max(100, (t.grid.s * 1000) / 3);
  const steep = 0.5 / sh.slope;
  const diff = (x: number, y: number): number | null => {
    const a = groundAt(f.terrain, x, y);
    const b = groundAt(t, x, y);
    return a === null || b === null ? null : a - b;
  };
  return (q, n) => {
    const d0 = diff(q[0] + n[0] * 60, q[1] + n[1] * 60);
    if (d0 === null || Math.abs(d0) < 30) return null;
    // Gå ut längs normalen så länge marken är ändrad och lutar som en slänt.
    let d = 60;
    let prev = groundAt(f.terrain, q[0] + n[0] * d, q[1] + n[1] * d)!;
    while (d < MARK_REACH) {
      const x = q[0] + n[0] * (d + step);
      const y = q[1] + n[1] * (d + step);
      const z = groundAt(f.terrain, x, y);
      const dz = diff(x, y);
      if (z === null || dz === null || Math.abs(dz) < 15 || Math.abs(z - prev) / step < steep) break;
      prev = z;
      d += step;
    }
    return { d, cut: d0 < 0 };
  };
}

/**
 * Går runt konturens kanter med avståndet `spacing` och anropar `at` med
 * punkten på kanten och normalen ut; i utåtgående hörn i en solfjäder.
 * Med `ends` också i kanternas ändar (för slänternas yta, som ska vara hel).
 */
function walkSlope(g: GroundGeometry, spacing: number, ends: boolean, at: (q: Vec2, n: Vec2, ring: number) => void): void {
  for (let r = 0; r < g.rings.length; r++) {
    const ring = g.rings[r][0];
    const ccw = signedArea(ring) >= 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const n = outward(ring, a, b);
      // Rampens sidor som är stödmur (0.10.18) har ingen slänt.
      if (!n || (r === 0 && g.edgeWall?.[i])) continue;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (ends) at(a, n, r);
      for (let s = spacing / 2; s < len; s += spacing) at([a[0] + ((b[0] - a[0]) * s) / len, a[1] + ((b[1] - a[1]) * s) / len], n, r);
      if (ends) at(b, n, r);
      // Ett utåtgående hörn: strecken i en solfjäder mellan kanternas normaler.
      const c = ring[(i + 2) % ring.length];
      const n2 = outward(ring, b, c);
      if (!n2 || (r === 0 && g.edgeWall?.[(i + 1) % ring.length])) continue;
      const turn = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (ccw ? turn <= 0 : turn >= 0) continue;
      const a1 = Math.atan2(n[1], n[0]);
      let da = Math.atan2(n2[1], n2[0]) - a1;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      // Lika tätt som längs kanten 1,5 m ut från hörnet.
      const m = Math.floor((Math.abs(da) * FAN_RADIUS) / spacing);
      for (let j = 1; j <= m; j++) {
        const ang = a1 + (da * j) / (m + 1);
        at(b, [Math.cos(ang), Math.sin(ang)], r);
      }
    }
  }
}

const savedSlopeArea = new WeakMap<GroundGeometry, { inputs: unknown[]; out: Rings[] }>();

/**
 * Slänternas yta (0.10.14): det släntmarkeringarna täcker, som polygoner.
 * Kanten känns av tätare än strecken (halva avståndet, och kanternas
 * ändar), och fyrhörningarna mellan två grannar slås ihop. Sparas tills
 * formen, den färdiga marken eller skalan ändras.
 */
export function slopeArea(ctx: PlanContext, g: GroundGeometry): Rings[] {
  const f = finishedTerrain(ctx);
  const inputs = [f, terrainOf(ctx.doc)?.z, ctx.scale];
  const hit = savedSlopeArea.get(g);
  if (hit && sameItems(hit.inputs, inputs)) return hit.out;
  const reach = slopeReach(ctx, g);
  const out: Rings[] = [];
  if (reach) {
    // Strålarna per kontur; grannarna går inte över till nästa kontur.
    const rays: { q: Vec2; e: Vec2 | null }[][] = g.rings.map(() => []);
    walkSlope(g, (MARK_SPACING * ctx.scale) / 2, true, (q, n, ring) => {
      const r = reach(q, n);
      rays[ring].push({ q, e: r ? [q[0] + n[0] * r.d, q[1] + n[1] * r.d] : null });
    });
    for (const list of rays)
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        const b = list[(i + 1) % list.length];
        if (!a.e && !b.e) continue;
        const quad = [a.q, a.e ?? a.q, b.e ?? b.q, b.q];
        if (Math.abs(signedArea(quad)) > 1) out.push([quad]);
      }
  }
  const merged = out.length ? union(out) : [];
  savedSlopeArea.set(g, { inputs, out: merged });
  return merged;
}

/** Där solfjäderns streck i ett hörn ligger lika tätt som längs kanten, mm. */
const FAN_RADIUS = 1500;

/** Hur långt ut en slänt högst känns, mm. */
const MARK_REACH = 40_000;

/** Fyllningen (0.10.7), som 2D-formens, bakom väggarna. */
function fillOf(ctx: PlanContext, el: Element<any>, p: Partial<FillParams>, polys: Vec2[][][], part?: string): Primitive[] {
  if (!p.fill || ctx.view.hide?.includes('fill')) return [];
  return polys.flatMap((rings) => fillPrims(rings, p as FillParams, { objectId: el.id, objectType: 'Ground' }, true, ctx.style, ctx.scale)).map((q) => (part && q.origin ? { ...q, origin: { ...q.origin, part } } : q));
}

/** En pil från `a` till `b` med öppen spets, i ritningens skala. */
function arrow(ctx: PlanContext, a: Vec2, b: Vec2, origin: Primitive['origin']): Primitive[] {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const h = 1.5 * ctx.scale;
  const pen = { weight: 0.18 };
  return [
    { kind: 'line', a, b, pen, origin },
    { kind: 'line', a: b, b: [b[0] - Math.cos(ang - 0.4) * h, b[1] - Math.sin(ang - 0.4) * h], pen, origin },
    { kind: 'line', a: b, b: [b[0] - Math.cos(ang + 0.4) * h, b[1] - Math.sin(ang + 0.4) * h], pen, origin },
  ];
}

/** Höjden som text, i RH 2000 när projektet har en plats. */
const hText = (ctx: PlanContext, h: number) => levelText(ctx.doc.site, h);

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
  const pts = (p.line ?? []).map((q): Vec2 => [q[0], q[1]]);
  const h0 = p.height ?? 0;
  const h1 = p.endHeight ?? h0;
  const th = 2;
  const text = (at: Vec2, t: string, part: string, extra: Partial<Primitive> = {}) => out.push({ kind: 'text', at, text: t, height: th, align: 'middle', pen: { weight: 0.18 }, origin: { ...origin, part }, ...extra } as Primitive);
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
    // muren som vy, där foten ligger över streckprickad.
    const h = planCutHeight(ctx);
    const parts = prof && h !== undefined ? wallCutParts(prof, storeyElevation(ctx, el.storey) + h) : null;
    if (!parts) for (const ring of g.rings[0]) out.push({ kind: 'region', role: 'cut', rings: [ring], fill: { kind: 'solid', color: 'ink' }, outline: { weight: 0.35 }, origin: { ...origin, part: 'mur' } } as Primitive);
    else {
      for (const rings of parts.cut) out.push({ kind: 'region', role: 'cut', rings, fill: { kind: 'solid', color: 'ink' }, outline: { weight: 0.35 }, origin: { ...origin, part: 'mur' } });
      for (const zone of ['below', 'above'] as const) {
        const pen = planCutPen(ctx.style, 'Ground', zone);
        for (const rings of parts[zone])
          for (const ring of rings) out.push({ kind: 'polyline', points: ring, closed: true, pen, origin: { ...origin, part: zone === 'above' ? ABOVE_PART : 'mur' } });
      }
    }
    // Krönet (0.10.9): ÖK i ändarna och vid höjdpunkterna, som får ett streck tvärs över muren.
    if (!prof) return out;
    const st = prof.stations;
    const half = Math.hypot(st[0].left[0] - st[0].at[0], st[0].left[1] - st[0].at[1]);
    const beside = (at: Vec2, s: number, h: number, side: 1 | -1) => {
      const n = normalAt(prof.center, s);
      const d = half + 3 * ctx.scale;
      text([at[0] + n[0] * d * side, at[1] + n[1] * d * side - 0.7 * ctx.scale], `ÖK ${hText(ctx, h)}`, 'höjd');
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
  const sides = g.sides!;
  const edge = (points: Vec2[], part: string, wall: boolean) => out.push({ kind: 'polyline', points, closed: false, pen: { weight: wall ? 0.5 : 0.25 }, origin: { ...origin, part } });
  edge(sides.right, 'kant', sideEdge(p, 'right') === 'wall');
  edge([...sides.left].reverse(), 'kant', sideEdge(p, 'left') === 'wall');
  const ends = p.edge === 'wall';
  if (p.startLine !== false) edge([sides.left[0], sides.right[0]], 'början', ends);
  if (p.endLine !== false) edge([sides.right[sides.right.length - 1], sides.left[sides.left.length - 1]], 'slutet', ends);
  // Lutningen längs referenslinjen: en pil nedför och 1:N för varje sträcka mellan punkter med höjd (0.10.18).
  const center = g.center ?? pts;
  const levels = rampLevels(p);
  const runs = rampRuns(levels);
  const def = groundDefaults(ctx.doc.site);
  const max = p.maxSlope ?? def.rampMax;
  const warn = rampWarnings(levels, max, def);
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
  const n = steepest(levels);
  const ratio = runs.length > 1 ? '' : Number.isFinite(n) ? ` ${ratioText(n)}` : ' Plan';
  const mid = middleAt(center, sides, total / 2);
  text([mid[0], mid[1] + 2 * ctx.scale], `${groundLabel(p)}${ratio}${warn.length ? ' !' : ''}`, 'lutning', warn.length ? { pen: { weight: 0.18, color: 'accent' } } : {});
  out.push(...slopeMarks(ctx, g, { ...origin, part: 'slänt' }));
  // Höjderna i ändarna (i slutet bara när den skiljer sig från början) och i punkterna däremellan som har en höjd.
  // Ändarnas höjd står mitt på tvärlinjen, som förut; de andra vid punkten.
  const last = center.length - 1;
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
