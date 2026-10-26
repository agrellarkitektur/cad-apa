import type { Element } from '../core/model';
import { groundDefaults, levelText } from '../core/site';
import type { Primitive, Vec2 } from '../repr/primitives';
import { groundLabel, isLineKind, wallCrest, type GroundGeometry, type GroundParams } from './groundGeometry';
import { lineLength, pathRatio, pathWarnings } from './groundLines';
import type { PlanContext } from './registry';

/**
 * Markobjekten i planen (0.10.4–0.10.5, för sig sedan 0.10.6): platåer och
 * urgrävningar som en kontur med höjden (och fallets pil), vägar med
 * lutningen och höjderna i ändarna, höjdpunkter, brytlinjer och stödmurar.
 */
export function groundPlan(ctx: PlanContext, el: Element<any>, g: GroundGeometry): Primitive[] {
  const p = ctx.params<GroundParams>(el);
  if (isLineKind(p.kind)) return linePlan(ctx, el, p, g);
  const origin = { objectId: el.id, objectType: 'Ground' };
  const out: Primitive[] = [];
  // Konturen: tunn, eller tjock där kanten är en stödmur. Urgrävningen streckad.
  const pen = p.edge === 'wall' ? { weight: 0.5 } : p.kind === 'excavation' || p.slab ? { weight: 0.18, dash: [4, 1.5] } : { weight: 0.25 };
  for (const poly of g.rings) for (const ring of poly) out.push({ kind: 'polyline', points: ring, closed: true, pen, origin: { ...origin, part: 'kontur' } });
  const text = `${groundLabel(p)} ${levelText(ctx.doc.site, g.label.height)}${g.label.fall ? ` · 1:${g.label.fall.toLocaleString('sv-SE')}` : ''}`;
  out.push({ kind: 'text', at: g.label.at, text, height: 2, align: 'middle', pen: { weight: 0.18 }, origin: { ...origin, part: 'höjd' } });
  // Fallets riktning som en pil från mitten (platå med fall).
  if (g.label.fall && !p.around) {
    const a = ((p.fallDir ?? 0) * Math.PI) / 180;
    const l = 8 * ctx.scale;
    const s: Vec2 = [g.label.at[0], g.label.at[1] - 3 * ctx.scale];
    out.push(...arrow(ctx, s, [s[0] + Math.cos(a) * l, s[1] + Math.sin(a) * l], { ...origin, part: 'fall' }));
  }
  return out;
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

/** Punkten `s` mm längs polylinjen (slutet om den är kortare). */
function pointAlong(pts: readonly Vec2[], s: number): Vec2 {
  let rest = s;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (l >= rest && l > 0) return [pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * rest) / l, pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * rest) / l];
    rest -= l;
  }
  return pts[pts.length - 1];
}

/**
 * Ramp, gångväg, infart, höjdpunkt, brytlinje och stödmur i planen (0.10.5).
 * Vägen: konturen, en pil nedför mittlinjen med lutningen (*1:12*) och
 * höjderna i ändarna; en varning när den är för brant eller saknar vilplan.
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
    for (const ring of g.rings[0]) out.push({ kind: 'region', role: 'cut', rings: [ring], fill: { kind: 'solid', color: 'ink' }, outline: { weight: 0.35 }, origin: { ...origin, part: 'mur' } } as Primitive);
    const crest = wallCrest(ctx, el);
    if (crest) text([g.label.at[0], g.label.at[1] + 2.5 * ctx.scale], `Stödmur ${hText(ctx, crest.top)}`, 'höjd');
    return out;
  }
  // Vägen.
  for (const ring of g.rings[0]) out.push({ kind: 'polyline', points: ring, closed: true, pen: { weight: p.edge === 'wall' ? 0.5 : 0.25 }, origin: { ...origin, part: 'kontur' } });
  const kind = p.path ?? 'ramp';
  const n = pathRatio(pts, h0, h1);
  // Pilen går nedför, längs mittlinjen kring mitten.
  const total = lineLength(pts);
  const len = Math.min(total * 0.6, 14 * ctx.scale);
  const down = h1 <= h0;
  const sA = total / 2 + (down ? -len / 2 : len / 2);
  const sB = total / 2 + (down ? len / 2 : -len / 2);
  if (Number.isFinite(n)) out.push(...arrow(ctx, pointAlong(pts, sA), pointAlong(pts, sB), { ...origin, part: 'lutning' }));
  const warn = pathWarnings(kind, pts, h0, h1, groundDefaults(ctx.doc.site));
  const ratio = Number.isFinite(n) ? `1:${(Math.round(n * 10) / 10).toLocaleString('sv-SE')}` : 'Plan';
  const mid = pointAlong(pts, total / 2);
  text([mid[0], mid[1] + 2 * ctx.scale], `${groundLabel(p)} ${ratio}${warn.length ? ' !' : ''}`, 'lutning', warn.length ? { pen: { weight: 0.18, color: 'accent' } } : {});
  text([pts[0][0], pts[0][1] - 3 * ctx.scale], hText(ctx, h0), 'höjd');
  if (Math.abs(h1 - h0) >= 1) text([pts[pts.length - 1][0], pts[pts.length - 1][1] - 3 * ctx.scale], hText(ctx, h1), 'höjd');
  return out;
}
