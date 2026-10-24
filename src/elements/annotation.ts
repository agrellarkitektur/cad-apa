import { add, left, norm, scale, sub } from '../geometry/vec';
import type { StyleSheet } from '../core/graphics';
import { markerPen, withWeight } from '../repr/markerPens';
import type { Pen, Primitive, Vec2 } from '../repr/primitives';
import type { ProjectDoc } from '../core/model';
import { resolvePoint, type FeatureRef } from './features';
import { expandSmartText, layoutText, textPoint, type TextAlign, type TextAnchor, type TextLayout } from './textLayout';
import type { ElementType } from './registry';

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0, useGrouping: false });

/**
 * Måttkedja: punkterna mäts längs en riktning, och måttlinjen ligger
 * förskjuten från första punkten. Ritas med snedstreck som i svensk praxis.
 */
export interface DimensionParams {
  /** Punkterna: fria punkter eller punkter knutna till linjer i modellen. */
  points: DimPoint[];
  /** Mätriktningen i grader moturs från x-axeln. */
  angle: number;
  /** Måttlinjens avstånd från första punkten, vinkelrätt mot riktningen (mm, åt vänster positivt). */
  offset: number;
}

/** En måttpunkt: en fri punkt, eller en punkt som följer en eller flera linjer i modellen. */
export type DimPoint = [number, number] | { at: [number, number]; refs: FeatureRef[] };

export function pointAt(q: DimPoint): [number, number] {
  return Array.isArray(q) ? q : q.at;
}

export const dimensionType: ElementType<DimensionParams> = {
  type: 'Dimension',
  label: 'Mått',
  labelPlural: 'Mått',
  drawOrder: 60,
  compares: false,
  defaults: () => ({ points: [], angle: 0, offset: 500 }),
  plan(el, ctx) {
    const p = ctx.params<DimensionParams>(el);
    const r = (p.angle * Math.PI) / 180;
    const dir: Vec2 = [Math.cos(r), Math.sin(r)];
    // Ett mått till något som inte syns i vyn döljs, t.ex. en vägg som inte
    // finns i förslaget eller något som rivs när rivet är dolt.
    const visible = (id: string) => {
      const target = ctx.doc.elements[id];
      if (!target) return false;
      const a = ctx.actionOf(target);
      return a !== 'absent' && !(a === 'demolished' && ctx.view.hideDemolished);
    };
    for (const q of p.points) if (!Array.isArray(q) && q.refs.length && !q.refs.some((ref) => visible(ref.id))) return [];
    const points = p.points.map((q): [number, number] => {
      if (Array.isArray(q)) return q;
      const pt = resolvePoint(ctx.doc, q.at, q.refs.filter((ref) => visible(ref.id)), dir);
      return [pt[0], pt[1]];
    });
    return dimensionPrims({ ...p, points }, ctx.scale, { objectId: el.id, objectType: 'Dimension' }, ctx.style.labels.heights.dimension, ctx.style);
  },
};

/** Primitiver för en måttkedja; används också för förhandsvisningen i verktyget. */
/** `style` ger måttens pennor (0.8.26); utan den gäller förvalen. */
export function dimensionPrims(p: DimensionParams, drawingScale: number, origin?: Primitive['origin'], textHeight = 2.2, style?: StyleSheet): Primitive[] {
  if (p.points.length < 2) return [];
  const pts = p.points.map(pointAt);
  const paper = (mm: number) => mm * drawingScale;
  const r = (p.angle * Math.PI) / 180;
  const u: Vec2 = [Math.cos(r), Math.sin(r)];
  const n = left(u);
  const base = pts[0];
  const ts = [...new Set(pts.map((q) => Math.round((q[0] - base[0]) * u[0] + (q[1] - base[1]) * u[1])))].sort((a, b) => a - b);
  if (ts.length < 2) return [];
  const on = (t: number, o = 0): Vec2 => add(add(base, scale(u, t)), scale(n, p.offset + o));
  const thin: Pen = markerPen(style, 'dimension');
  const tick: Pen = markerPen(style, 'dimensionTick');
  const out: Primitive[] = [];
  const ext = paper(2);
  // Måttlinjen, lite förlängd förbi ytterpunkterna.
  out.push({ kind: 'line', a: on(ts[0] - ext), b: on(ts[ts.length - 1] + ext), pen: thin, origin });
  // Hjälplinjer från punkterna fram till och lite förbi måttlinjen.
  for (const q of pts) {
    const t = (q[0] - base[0]) * u[0] + (q[1] - base[1]) * u[1];
    const o = (q[0] - base[0]) * n[0] + (q[1] - base[1]) * n[1];
    const dir = Math.sign(p.offset - o) || 1;
    const gap = paper(1);
    if (Math.abs(p.offset - o) > gap) {
      out.push({ kind: 'line', a: add(add(base, scale(u, t)), scale(n, o + dir * gap)), b: on(t, dir * paper(1.5)), pen: thin, origin });
    }
  }
  // Snedstreck i varje måttpunkt.
  const slash = norm(add(u, n));
  const half = paper(1.25);
  for (const t of ts) out.push({ kind: 'line', a: sub(on(t), scale(slash, half)), b: add(on(t), scale(slash, half)), pen: tick, origin });
  // Måtten, läsbara nedifrån eller från höger.
  let a = r;
  while (a > Math.PI / 2 + 1e-6) a -= Math.PI;
  while (a <= -Math.PI / 2 + 1e-6) a += Math.PI;
  const flip = Math.abs(a - r) > 1e-6;
  const above = flip ? -1 : 1;
  for (let i = 0; i + 1 < ts.length; i++) {
    const mid = (ts[i] + ts[i + 1]) / 2;
    out.push({
      kind: 'text',
      at: on(mid, above * paper(0.9)),
      text: nf.format(ts[i + 1] - ts[i]),
      height: textHeight,
      align: 'middle',
      angle: a,
      pen: withWeight(thin, 0.18),
      origin,
    });
  }
  return out;
}

/** Fri text i planen. */
export interface TextParams {
  pos: [number, number];
  text: string;
  /** Texthöjd på papper, mm. */
  height: number;
  /** Vridning i grader moturs. */
  angle: number;
  /** Fet stil (0.8.8, format 8). */
  bold?: boolean;
  /** Var `pos` ligger på raden (0.8.8): vänster (förval), mitten eller höger. */
  align?: TextAlign;
  /**
   * Var `pos` ligger i höjdled (0.8.9, format 9): i rutans överkant, mitt
   * eller underkant. Utelämnad = på första radens baslinje.
   */
  anchor?: TextAnchor;
  /** Textrutans största bredd på papper, mm (0.8.9). Raderna bryts vid ord. */
  maxWidth?: number;
  /** Textrutans största höjd på papper, mm (0.8.9). Ryms texten inte visas en röd markering på skärmen. */
  maxHeight?: number;
}

/** Röd på skärmen för en text som inte ryms i sin ruta (skrivs inte ut). */
const OVERFLOW_PEN: Pen = { weight: 0.25, color: '#d9480f', dash: [1.5, 1] };

/** Textens innehåll med smarttexten ifylld, om vyn har värden för den (ritningsblad, 0.8.9). */
function shownText(p: TextParams, ctx: { view: { smart?: Readonly<Record<string, string>> } }): string {
  const t = String(p.text);
  return ctx.view?.smart && t.includes('{') ? expandSmartText(t, ctx.view.smart!) : t;
}

export const textType: ElementType<TextParams> = {
  type: 'Text',
  planReads: [],
  label: 'Text',
  labelPlural: 'Texter',
  drawOrder: 61,
  compares: false,
  defaults: () => ({ pos: [0, 0], text: 'TEXT', height: 2.5, angle: 0 }),
  pickShape(el, ctx) {
    const p = ctx.params<TextParams>(el);
    return [[textBox(p, layoutText({ ...p, text: shownText(p, ctx) }), ctx.scale)]];
  },
  plan(el, ctx) {
    const p = ctx.params<TextParams>(el);
    const text = shownText(p, ctx);
    // Ett tomt smart fält ger ingen text.
    if (text !== p.text && !text.trim()) return [];
    const origin = { objectId: el.id, objectType: 'Text' };
    const r = (p.angle * Math.PI) / 180;
    const lay = layoutText({ ...p, text });
    const out: Primitive[] = lay.lines.map(
      (line, i): Primitive => ({
        kind: 'text',
        at: textPoint(p.pos, r, ctx.scale, 0, lay.baselines[i]),
        text: line,
        height: p.height,
        angle: r || undefined,
        ...(p.bold ? { bold: true } : {}),
        ...(p.align && p.align !== 'start' ? { align: p.align } : {}),
        pen: { weight: 0.25 },
        origin,
      }),
    );
    if (lay.overflow && lay.box) {
      const [x0, y0, x1, y1] = lay.box;
      const c = (x: number, y: number) => textPoint(p.pos, r, ctx.scale, x, y);
      out.push({ kind: 'polyline', points: [c(x0, y0), c(x1, y0), c(x1, y1), c(x0, y1)], closed: true, pen: OVERFLOW_PEN, origin: { ...origin, part: 'skärm' } });
    }
    return out;
  },
};

/** Rutan runt en text, för att kunna peka på den: textens yta, och textrutan om den har en. */
function textBox(p: TextParams, lay: TextLayout, scale: number): Vec2[] {
  const [ex0, ey0, ex1, ey1] = lay.extent;
  const [x0, y0, x1, y1] = lay.box ? [Math.min(ex0, lay.box[0]), Math.min(ey0, lay.box[1]), Math.max(ex1, lay.box[2]), Math.max(ey1, lay.box[3])] : [ex0, ey0, ex1, ey1];
  const r = (p.angle * Math.PI) / 180;
  const c = (x: number, y: number) => textPoint(p.pos, r, scale, x, y);
  return [c(x0, y0), c(x1, y0), c(x1, y1), c(x0, y1)];
}

/**
 * Måttkedjans sträckor med värden, och vilken punkt som ligger i vardera
 * änden. Används för att kunna skriva in ett nytt mått i panelen.
 */
export function dimensionSegments(doc: ProjectDoc, p: DimensionParams): { value: number; from: number; to: number }[] {
  const r = (p.angle * Math.PI) / 180;
  const dir: Vec2 = [Math.cos(r), Math.sin(r)];
  const pts = p.points.map((q) => (Array.isArray(q) ? q : resolvePoint(doc, q.at, q.refs, dir)));
  if (pts.length < 2) return [];
  const base = pts[0];
  const ts = pts.map((q, i) => ({ i, t: (q[0] - base[0]) * dir[0] + (q[1] - base[1]) * dir[1] })).sort((a, b) => a.t - b.t);
  const out: { value: number; from: number; to: number }[] = [];
  for (let k = 0; k + 1 < ts.length; k++) {
    const value = Math.round(ts[k + 1].t - ts[k].t);
    if (value > 0) out.push({ value, from: ts[k].i, to: ts[k + 1].i });
  }
  return out;
}
