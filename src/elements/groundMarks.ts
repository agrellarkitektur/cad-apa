import type { Element } from '../core/model';
import { groundAt, groundLevelText, litteraText, terrainOf } from '../core/site';
import { textWidth } from '../formats/drawingFont';
import type { Primitive, TextPrim, Vec2 } from '../repr/primitives';
import { finishedTerrain, groundObjects, showsProposal, type GroundGeometry, type GroundParams } from './groundGeometry';
import { along, flatPoints, lineLength } from './groundLines';
import { crestAtS, type WallProfile } from './groundWall';
import { markerPen } from '../repr/markerPens';
import { leaderOf, type TagParams, type TextBox } from './leader';
import type { PlanContext } from './registry';

/**
 * Situationsplanens beteckningar (0.10.20), som landskapsarkitekter
 * redovisar: markhöjder med status, låglinjen för dagvattnet som pilar,
 * stödmurens ledare med littera och murkrön, och understrukna texter.
 * Ritningen av markobjekten i övrigt ligger i `groundPlan.ts`.
 */

/** Texthöjden för beteckningarna, mm på papper. */
export const MARK_TEXT = 2;

/** Var markhöjdernas status räknas som ändrad: nya och befintliga höjder som skiljer mindre är samma, mm. */
const SAME_LEVEL = 50;

/** Höjden som text, med projektets decimaler. */
export const groundText = (ctx: PlanContext, h: number): string => groundLevelText(ctx.doc.site, h);

/**
 * En text, understruken när `underline` är satt: strecket ligger strax
 * under baslinjen och är lika långt som texten (osifonts bredder, samma
 * som PDF:en). Texten läses vågrätt.
 */
export function markText(ctx: PlanContext, at: Vec2, text: string, origin: Primitive['origin'], opts: { underline?: boolean; align?: TextPrim['align']; height?: number; angle?: number } = {}): Primitive[] {
  const height = opts.height ?? MARK_TEXT;
  const align = opts.align ?? 'start';
  const pen = { weight: 0.18 };
  const out: Primitive[] = [{ kind: 'text', at, text, height, align, ...(opts.angle ? { angle: opts.angle } : {}), pen, origin }];
  if (opts.underline) {
    const w = textWidth(text, height) * ctx.scale;
    const x0 = align === 'start' ? 0 : align === 'end' ? -w : -w / 2;
    const a = opts.angle ?? 0;
    const u: Vec2 = [Math.cos(a), Math.sin(a)];
    const v: Vec2 = [-Math.sin(a), Math.cos(a)];
    const d = 0.35 * height * ctx.scale;
    const p0: Vec2 = [at[0] + u[0] * x0 - v[0] * d, at[1] + u[1] * x0 - v[1] * d];
    out.push({ kind: 'line', a: p0, b: [p0[0] + u[0] * w, p0[1] + u[1] * w], pen, origin });
  }
  return out;
}

/** En pil från `a` till `b` med öppen spets, i ritningens skala. */
export function arrow(ctx: PlanContext, a: Vec2, b: Vec2, origin: Primitive['origin'], pen = { weight: 0.18 }): Primitive[] {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const h = 1.5 * ctx.scale;
  return [
    { kind: 'line', a, b, pen, origin },
    { kind: 'line', a: b, b: [b[0] - Math.cos(ang - 0.4) * h, b[1] - Math.sin(ang - 0.4) * h], pen, origin },
    { kind: 'line', a: b, b: [b[0] - Math.cos(ang + 0.4) * h, b[1] - Math.sin(ang + 0.4) * h], pen, origin },
  ];
}

/** Markhöjdens status i punkten: den befintliga höjden, den nya, och om den nya gäller. */
export interface LevelStatus {
  existing: number | null;
  /** Den nya höjden: egen, eller den färdiga markens; null när marken inte ändras där. */
  proposed: number | null;
}

/**
 * Markhöjdens höjder (0.10.20): den befintliga markens höjd i punkten och
 * den nya där den skiljer sig (den färdiga markens i vyn, eller en egen
 * höjd i objektet). I Befintligt finns ingen ny höjd.
 */
export function levelStatus(ctx: PlanContext, p: GroundParams, at: Vec2): LevelStatus {
  const t = terrainOf(ctx.doc);
  const existing = t ? groundAt(t, at[0], at[1]) : null;
  if (typeof p.height === 'number') return { existing, proposed: existing === null || Math.abs(p.height - existing) >= SAME_LEVEL ? p.height : null };
  const f = showsProposal(ctx) ? finishedTerrain(ctx) : null;
  const h = f ? groundAt(f.terrain, at[0], at[1]) : null;
  return { existing, proposed: h !== null && (existing === null || Math.abs(h - existing) >= SAME_LEVEL) ? h : null };
}

/**
 * Markhöjden i planen (0.10.20): ett litet kors i punkten och höjderna till
 * höger om det. Befintlig höjd understruken; där marken ändras står den nya
 * utan understrykning och den befintliga som utgår inom parentes under.
 */
export function levelMark(ctx: PlanContext, el: Element<any>, p: GroundParams, g: GroundGeometry): Primitive[] {
  const c = g.label.at;
  const origin = { objectId: el.id, objectType: 'Ground', part: 'markhöjd' };
  const s = ctx.scale;
  const r = 1 * s;
  const pen = { weight: 0.25 };
  const out: Primitive[] = [
    { kind: 'line', a: [c[0] - r, c[1]], b: [c[0] + r, c[1]], pen, origin },
    { kind: 'line', a: [c[0], c[1] - r], b: [c[0], c[1] + r], pen, origin },
  ];
  const st = levelStatus(ctx, p, c);
  const x = c[0] + 1.6 * s;
  if (st.proposed !== null) {
    out.push(...markText(ctx, [x, c[1] + 0.5 * s], groundText(ctx, st.proposed), origin));
    if (st.existing !== null) out.push(...markText(ctx, [x, c[1] - 2.6 * s], `(${groundText(ctx, st.existing)})`, origin));
  } else if (st.existing !== null) out.push(...markText(ctx, [x, c[1] - 0.7 * s], groundText(ctx, st.existing), origin, { underline: true }));
  else out.push(...markText(ctx, [x, c[1] - 0.7 * s], 'Ingen mark', origin));
  return out;
}

/** Avståndet mellan låglinjens pilar, mm på papper. */
const DRAIN_ARROW_STEP = 10;

/**
 * Låglinjen (0.10.20): dagvattnets väg som en linje med pilar i linjens
 * riktning (ritad från det högsta mot det lägsta), var tionde millimeter
 * på papperet och minst en.
 */
export function drainLine(ctx: PlanContext, el: Element<any>, p: GroundParams): Primitive[] {
  const pts = flatPoints(p.line, p.bulges);
  if (pts.length < 2) return [];
  const origin = { objectId: el.id, objectType: 'Ground', part: 'låglinje' };
  const pen = { weight: 0.25 };
  const out: Primitive[] = [{ kind: 'polyline', points: pts, closed: false, pen, origin }];
  const total = lineLength(pts);
  const step = DRAIN_ARROW_STEP * ctx.scale;
  const head = 1.5 * ctx.scale;
  const n = Math.max(1, Math.floor(total / step));
  for (let k = 1; k <= n; k++) {
    const s = n === 1 ? total / 2 : (total * k) / (n + 1);
    const tip = pointAt(pts, s);
    const back = pointAt(pts, Math.max(0, s - head));
    const ang = Math.atan2(tip[1] - back[1], tip[0] - back[0]);
    out.push({ kind: 'line', a: tip, b: [tip[0] - Math.cos(ang - 0.4) * head, tip[1] - Math.sin(ang - 0.4) * head], pen, origin });
    out.push({ kind: 'line', a: tip, b: [tip[0] - Math.cos(ang + 0.4) * head, tip[1] - Math.sin(ang + 0.4) * head], pen, origin });
  }
  return out;
}

/** Punkten `s` mm in längs polylinjen. */
export function pointAt(pts: readonly Vec2[], s: number): Vec2 {
  let rest = s;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (rest <= l || i === pts.length - 1) {
      const f = l > 0 ? Math.min(1, rest / l) : 0;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
    }
    rest -= l;
  }
  return pts[0];
}

/**
 * Stödmurens littera (0.10.20): det egna namnet, annars *M* och numret i
 * ritordningen bland vyns stödmurar, med projektets antal siffror.
 */
export function wallLittera(ctx: PlanContext, el: Element<any>): string {
  const p = ctx.params<GroundParams>(el);
  if (p.name?.trim()) return p.name.trim();
  const walls = ctx.memo('ground-walls', () => groundObjects(ctx).filter((e) => ctx.params<GroundParams>(e).kind === 'wall').map((e) => e.id));
  return litteraText(ctx.doc.site, 'M', Math.max(1, walls.indexOf(el.id) + 1));
}

/**
 * Murens ledare (0.10.20, med den gemensamma ledaren från 0.10.20.1): från
 * murens kant vid mitten, vinkelrätt ut åt höger (i linjens riktning) till
 * knäcken och sedan en vågrät stam in till texten, som har ett streck mellan
 * raderna: littera på raden över, *MK* och krönets höjd på raden under.
 * Varierar krönet skrivs lägsta–högsta. Texten och punkten kan flyttas
 * (`tag`, i planens axlar).
 */
export function wallLeader(ctx: PlanContext, el: Element<any>, prof: WallProfile): Primitive[] {
  const s = ctx.scale;
  const p = ctx.params<GroundParams & { tag?: TagParams }>(el);
  const tag = p.tag ?? {};
  const style = ctx.style.labels.leaders.Ground;
  const stub = tag.stub ?? style.stub;
  const center = prof.center;
  const total = lineLength(center);
  const mid = pointAt(center, total / 2);
  const a = along(center, mid[0], mid[1]);
  // Normalen åt höger i linjens riktning.
  const dir = directionAt(center, total / 2);
  const n: Vec2 = [dir[1], -dir[0]];
  const half = Math.hypot(prof.stations[0].left[0] - prof.stations[0].at[0], prof.stations[0].left[1] - prof.stations[0].at[1]);
  const from: Vec2 = [mid[0] + n[0] * half, mid[1] + n[1] * half];
  const elbow: Vec2 = [from[0] + n[0] * 7 * s, from[1] + n[1] * 7 * s];
  const right = n[0] >= 0 ? 1 : -1;
  const lo = Math.min(prof.start, prof.end, ...prof.pins.map((q) => q.h));
  const hi = Math.max(prof.start, prof.end, ...prof.pins.map((q) => q.h));
  const mk = `MK ${hi - lo < SAME_LEVEL ? groundText(ctx, crestAtS(prof, a.s)) : `${groundText(ctx, lo)}–${groundText(ctx, hi)}`}`;
  const littera = wallLittera(ctx, el);
  const w = Math.max(textWidth(littera, MARK_TEXT), textWidth(mk, MARK_TEXT)) * s;
  const halfW = w / 2 + 0.5 * s;
  const halfH = Math.max(0.6 + MARK_TEXT, 2.6 + 0.35 * MARK_TEXT) * s;
  // Texten står så att stammen når knäcken rakt ut från muren, om den inte flyttats.
  const gap = 1;
  const c: Vec2 = [elbow[0] + right * ((stub + gap) * s + halfW) + (tag.at?.[0] ?? 0), elbow[1] + (tag.at?.[1] ?? 0)];
  const target: Vec2 = [from[0] + (tag.to?.[0] ?? 0), from[1] + (tag.to?.[1] ?? 0)];
  const box: TextBox = { center: c, halfW, halfH, along: [1, 0], up: [0, 1] };
  const pen = markerPen(ctx.style, 'litteraLeader');
  const geo = leaderOf(box, [{ at: target }], { side: tag.side, end: tag.end ?? style.end, stub, gap, scale: s, pen });
  const origin = { objectId: el.id, objectType: 'Ground', part: 'littera', tag: { param: 'tag' as const, text: c, target, stubStart: geo?.start ?? null, stubEnd: geo?.stubEnd ?? null, dir: geo?.dir ?? null } };
  const x = c[0] - halfW + 0.5 * s;
  const out: Primitive[] = [{ kind: 'line', a: [c[0] - halfW, c[1]], b: [c[0] + halfW, c[1]], pen: { weight: 0.18 }, origin }];
  for (const q of geo?.prims ?? []) out.push({ ...q, origin });
  out.push(...markText(ctx, [x, c[1] + 0.6 * s], littera, origin));
  out.push(...markText(ctx, [x, c[1] - 2.6 * s], mk, origin));
  return out;
}

/** Riktningen längs polylinjen vid sträckan `s`. */
function directionAt(pts: readonly Vec2[], s: number): Vec2 {
  let rest = s;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if ((rest <= l || i === pts.length - 1) && l > 0) return [(pts[i][0] - pts[i - 1][0]) / l, (pts[i][1] - pts[i - 1][1]) / l];
    rest -= l;
  }
  return [1, 0];
}

/** Minsta sidolutning i procent (0.10.20), understruken, som en text vid `at`. */
export function minCrossText(ctx: PlanContext, el: Element<any>, p: GroundParams, at: Vec2): Primitive[] {
  if (typeof p.minCross !== 'number' || !(p.minCross > 0)) return [];
  const origin = { objectId: el.id, objectType: 'Ground', part: 'sidolutning' };
  return markText(ctx, at, `${p.minCross.toLocaleString('sv-SE', { maximumFractionDigits: 1 })} %`, origin, { underline: true, align: 'middle' });
}
