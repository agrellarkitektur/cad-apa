import { add, left, norm, scale, sub } from '../geometry/vec';
import type { Pen, Primitive, Vec2 } from '../repr/primitives';
import type { ProjectDoc } from '../core/model';
import { resolvePoint, type FeatureRef } from './features';
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
    return dimensionPrims({ ...p, points }, ctx.scale, { objectId: el.id, objectType: 'Dimension' }, ctx.style.labels.heights.dimension);
  },
};

/** Primitiver för en måttkedja; används också för förhandsvisningen i verktyget. */
export function dimensionPrims(p: DimensionParams, drawingScale: number, origin?: Primitive['origin'], textHeight = 2.2): Primitive[] {
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
  const thin: Pen = { weight: 0.18 };
  const tick: Pen = { weight: 0.35 };
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
      pen: { weight: 0.18 },
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
    return [[textBox(ctx.params<TextParams>(el), ctx.scale)]];
  },
  plan(el, ctx) {
    const p = ctx.params<TextParams>(el);
    const origin = { objectId: el.id, objectType: 'Text' };
    const r = (p.angle * Math.PI) / 180;
    const step = p.height * ctx.scale * 1.5;
    return String(p.text)
      .split('\n')
      .map((text, i): Primitive => ({
        kind: 'text',
        at: [p.pos[0] + i * step * Math.sin(r), p.pos[1] - i * step * Math.cos(r)],
        text,
        height: p.height,
        angle: r || undefined,
        pen: { weight: 0.25 },
        origin,
      }));
  },
};

/** Ungefärlig ruta runt en text, för att kunna peka på den. */
function textBox(p: TextParams, drawingScale: number): Vec2[] {
  const lines = String(p.text).split('\n');
  const r = (p.angle * Math.PI) / 180;
  const step = p.height * drawingScale * 1.5;
  const w = Math.max(1, ...lines.map((l) => l.length)) * p.height * drawingScale * 0.62;
  const top = p.height * drawingScale;
  const bottom = -step * (lines.length - 1) - p.height * drawingScale * 0.3;
  const c = (x: number, y: number): Vec2 => [p.pos[0] + x * Math.cos(r) - y * Math.sin(r), p.pos[1] + x * Math.sin(r) + y * Math.cos(r)];
  return [c(0, bottom), c(w, bottom), c(w, top), c(0, top)];
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
