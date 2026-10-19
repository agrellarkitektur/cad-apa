import { arcFromBulge, bulgeThrough } from '../geometry/arc';
import { dist } from '../geometry/vec';
import type { Color, FillDef } from '../core/graphics';
import type { Pen, Primitive, Vec2 } from '../repr/primitives';
import type { ElementType } from './registry';

/**
 * 2D-element (0.8, format 5): linjer, polylinjer, rektanglar, bågar,
 * cirklar, splines och fyllningar. De är ritningsinformation, finns inte i
 * 3D och följer inte med till IFC. De ritas på en yta (planen, en fasad, en
 * sektion eller ett arbetsblad) och kan väljas att synas i vissa vyer
 * (`Element.show`).
 */

export type Shape2D = 'line' | 'polyline' | 'rect' | 'arc' | 'circle' | 'spline';
export type LineType = 'solid' | 'dashed' | 'dotted' | 'dashdot';

/** Linjetypernas streckmönster på papper, mm. */
export const LINE_TYPES: Record<LineType, { label: string; dash?: number[] }> = {
  solid: { label: 'Heldragen' },
  dashed: { label: 'Streckad', dash: [3, 1.5] },
  dotted: { label: 'Prickad', dash: [0.3, 1] },
  dashdot: { label: 'Streckprickad', dash: [5, 1, 0.3, 1] },
};

/** Linjebredderna som går att välja, mm på papper. */
export const PEN_WEIGHTS = [0.13, 0.18, 0.25, 0.35, 0.5, 0.7];

export interface Line2DParams {
  shape: Shape2D;
  /**
   * Punkterna. Linje: två. Polylinje och spline: två eller fler.
   * Rektangel: fyra hörn. Båge: start, en punkt på bågen och slut.
   * Cirkel: centrum och en punkt på cirkeln.
   */
  points: [number, number][];
  /** Polylinje och spline: sluten. */
  closed?: boolean;
  weight: number;
  linetype: LineType;
  /** Färg som #rrggbb; utelämnad = ritningens svart. */
  color?: string;
}

export type FillPattern = 'solid' | 'hatch' | 'cross';

export interface Fill2DParams {
  /** Ytans hörn. */
  points: [number, number][];
  pattern: FillPattern;
  /** Fyllningens färg som #rrggbb; utelämnad = grå. */
  color?: string;
  /** Kontur runt ytan. */
  outline: boolean;
  /** Skrafferingens vinkel i grader och avstånd på papper i mm. */
  angle: number;
  spacing: number;
}

export const SHAPE_LABELS: Record<Shape2D, string> = {
  line: 'Linje',
  polyline: 'Polylinje',
  rect: 'Rektangel',
  arc: 'Båge',
  circle: 'Cirkel',
  spline: 'Spline',
};

export const PATTERN_LABELS: Record<FillPattern, string> = {
  solid: 'Hel fyllning',
  hatch: 'Skraffering',
  cross: 'Korsskraffering',
};

/** Punkterna som formen ritas med (bågar och splines som korta raka bitar). */
export function shapePoints(p: Pick<Line2DParams, 'shape' | 'points' | 'closed'>): { points: Vec2[]; closed: boolean } {
  const pts = p.points as Vec2[];
  switch (p.shape) {
    case 'rect':
      return { points: pts, closed: true };
    case 'circle': {
      if (pts.length < 2) return { points: [], closed: false };
      const r = dist(pts[0], pts[1]);
      const n = Math.max(24, Math.min(160, Math.round(r / 40)));
      return { points: Array.from({ length: n }, (_, i): Vec2 => [pts[0][0] + r * Math.cos((2 * Math.PI * i) / n), pts[0][1] + r * Math.sin((2 * Math.PI * i) / n)]), closed: true };
    }
    case 'arc':
      return { points: pts.length >= 3 ? arcThrough(pts[0], pts[1], pts[2]) : pts, closed: false };
    case 'spline':
      return { points: catmullRom(pts, !!p.closed), closed: !!p.closed };
    default:
      return { points: pts, closed: !!p.closed && pts.length > 2 };
  }
}

/** Bågen från a genom m till b, som punkter. Ligger punkterna på rad blir det en rak linje. */
export function arcThrough(a: Vec2, m: Vec2, b: Vec2): Vec2[] {
  const arc = arcFromBulge(a, b, bulgeThrough(a, b, m));
  if (!arc) return [a, b];
  const n = Math.max(8, Math.min(96, Math.ceil(arc.sweep / (Math.PI / 48))));
  return Array.from({ length: n + 1 }, (_, i): Vec2 => {
    const t = arc.theta0 - arc.sigma * (arc.sweep * i) / n;
    return [arc.center[0] + arc.radius * Math.cos(t), arc.center[1] + arc.radius * Math.sin(t)];
  });
}

/** En mjuk kurva genom punkterna (Catmull–Rom). */
export function catmullRom(pts: Vec2[], closed: boolean): Vec2[] {
  if (pts.length < 3) return pts;
  const n = pts.length;
  const at = (i: number): Vec2 => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const out: Vec2[] = [];
  const segs = closed ? n : n - 1;
  const steps = 12;
  for (let i = 0; i < segs; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

function penOf(p: Line2DParams): Pen {
  const dash = LINE_TYPES[p.linetype]?.dash;
  return { weight: p.weight, ...(p.color ? { color: p.color as Color } : {}), ...(dash ? { dash } : {}) };
}

export const line2dType: ElementType<Line2DParams> = {
  type: 'Line2D',
  label: '2D-linje',
  labelPlural: '2D-linjer',
  drawOrder: 58,
  compares: false,
  defaults: () => ({ shape: 'line', points: [], weight: 0.25, linetype: 'solid' }),
  plan(el, ctx) {
    const p = ctx.params<Line2DParams>(el);
    const { points, closed } = shapePoints(p);
    if (points.length < 2) return [];
    return [{ kind: 'polyline', points, closed, pen: penOf(p), origin: { objectId: el.id, objectType: 'Line2D', part: p.shape } }];
  },
  pickShape(el, ctx) {
    // Slutna former går att klicka inuti; öppna bara på linjen.
    const p = ctx.params<Line2DParams>(el);
    const { points, closed } = shapePoints(p);
    return closed && points.length > 2 ? [[points]] : [];
  },
};

/** Fyllningens primitiver: ytan och konturen. */
export function fillPrims(p: Fill2DParams, origin?: Primitive['origin']): Primitive[] {
  if (p.points.length < 3) return [];
  const rings = [p.points as Vec2[]];
  const color = (p.color ?? '#9aa0a6') as Color;
  const hatch = (angle: number): FillDef => ({ kind: 'hatch', color, angle, spacing: p.spacing, weight: 0.13 });
  const fills: FillDef[] = p.pattern === 'solid' ? [{ kind: 'solid', color }] : p.pattern === 'cross' ? [hatch(p.angle), hatch(p.angle + 90)] : [hatch(p.angle)];
  const out: Primitive[] = fills.map((fill) => ({ kind: 'region', role: 'cut', rings, fill, outline: null, noOutline: true, ownFill: true, origin }));
  if (p.outline) out.push({ kind: 'polyline', points: rings[0], closed: true, pen: { weight: 0.18 }, origin });
  return out;
}

export const fill2dType: ElementType<Fill2DParams> = {
  type: 'Fill2D',
  label: 'Fyllning',
  labelPlural: 'Fyllningar',
  drawOrder: 4,
  compares: false,
  defaults: () => ({ points: [], pattern: 'hatch', outline: true, angle: 45, spacing: 2 }),
  plan(el, ctx) {
    return fillPrims(ctx.params<Fill2DParams>(el), { objectId: el.id, objectType: 'Fill2D', part: 'fyllning' });
  },
  pickShape(el, ctx) {
    const p = ctx.params<Fill2DParams>(el);
    return p.points.length >= 3 ? [[p.points as Vec2[]]] : [];
  },
};
