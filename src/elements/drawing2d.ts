import { arcFromBulge, bulgeThrough } from '../geometry/arc';
import { dist } from '../geometry/vec';
import type { Color, FillDef } from '../core/graphics';
import type { Pen, Primitive, Vec2 } from '../repr/primitives';
import type { ElementType } from './registry';

/**
 * 2D-formen (0.8.19, format 12): en linje, polylinje, rektangel, båge,
 * cirkel eller spline, med penna och fyllning. Linje, rektangel och de andra
 * är bara sätt att rita formen; fyllningen kan läggas på vilken form som
 * helst, också en öppen (den fylls som om den vore sluten, som i
 * Illustrator). Formen är ritningsinformation, finns inte i 3D och följer
 * inte med till IFC. Den ritas på en yta (planen, en fasad, en sektion, ett
 * arbetsblad eller ett blad) och kan väljas att synas i vissa vyer
 * (`Element.show`).
 */

export type ShapeKind = 'line' | 'polyline' | 'rect' | 'arc' | 'circle' | 'spline';
export type LineType = 'solid' | 'dashed' | 'dotted' | 'dashdot';

/** Linjetypernas streckmönster på papper, mm. */
export const LINE_TYPES: Record<LineType, { label: string; dash?: number[] }> = {
  solid: { label: 'Heldragen' },
  dashed: { label: 'Streckad', dash: [3, 1.5] },
  dotted: { label: 'Prickad', dash: [0.3, 1] },
  dashdot: { label: 'Streckprickad', dash: [5, 1, 0.3, 1] },
};

/**
 * Linjebredderna som går att välja, mm på papper. 0 = ingen linje (0.8.19):
 * formen syns inte men går att klicka på längs linjen.
 */
export const PEN_WEIGHTS = [0, 0.13, 0.18, 0.25, 0.35, 0.5, 0.7, 1, 1.4];

/**
 * Pennfärgerna i "gammel-cad" (0.8.14): färgen som tjockleken hade i äldre
 * CAD-program, så att den som är van vid dem känner igen valet.
 */
export const PEN_COLORS: Record<number, { name: string; color: string }> = {
  0.13: { name: 'Grå', color: '#8c9196' },
  0.18: { name: 'Cyan', color: '#00b4c8' },
  0.25: { name: 'Röd', color: '#e0302a' },
  0.35: { name: 'Grön', color: '#1fa24a' },
  0.5: { name: 'Svart', color: '#1d2328' },
  0.7: { name: 'Magenta', color: '#d42ab8' },
  1: { name: 'Blå', color: '#2456e0' },
  1.4: { name: 'Gul', color: '#e8b800' },
};

export type FillPattern = 'solid' | 'hatch' | 'cross';

export interface Shape2DParams {
  /** Hur formen ritades; bestämmer punkternas betydelse och greppen. `line` ritas inte längre (0.8.22). */
  shape: ShapeKind;
  /**
   * Punkterna. Linje: två. Polylinje och spline: två eller fler.
   * Rektangel: fyra hörn. Båge: start, en punkt på bågen och slut.
   * Cirkel: centrum och en punkt på cirkeln.
   */
  points: [number, number][];
  /** Polylinje och spline: sluten. */
  closed?: boolean;
  /** Pennans bredd på papper i mm; 0 = ingen linje. */
  weight: number;
  linetype: LineType;
  /** Linjens färg som #rrggbb; utelämnad = ritningens svart. */
  color?: string;
  /** Fyllningens mönster; utelämnad = ingen fyllning. */
  fill?: FillPattern;
  /** Fyllningens färg som #rrggbb; utelämnad = grå. */
  fillColor?: string;
  /** Skrafferingens vinkel i grader och avstånd på papper i mm. */
  fillAngle: number;
  fillSpacing: number;
  /** Linjens opacitet i procent (0.8.22); utelämnad = 100. */
  opacity?: number;
  /**
   * Fyllningens opacitet i procent (0.8.22). Utelämnad = samma som linjen,
   * så att en ändring av `opacity` gäller båda tills de skiljs åt.
   */
  fillOpacity?: number;
}

/** Opaciteten 0–1 för linjen och fyllningen; 1 = helt täckande. */
export function opacitiesOf(p: Pick<Shape2DParams, 'opacity' | 'fillOpacity'>): { line: number; fill: number } {
  const of = (v: number | undefined) => (v === undefined || !Number.isFinite(v) ? 1 : Math.max(0, Math.min(100, v)) / 100);
  return { line: of(p.opacity), fill: of(p.fillOpacity ?? p.opacity) };
}

/**
 * Namnen på sätten att rita. Polylinjen heter *Linje* (0.8.22): en linje med
 * två punkter är en polylinje, och den gamla enkellinjen ritas inte längre
 * (former ritade som linje före 0.8.22 finns kvar och heter också Linje).
 */
export const SHAPE_LABELS: Record<ShapeKind, string> = {
  line: 'Linje',
  polyline: 'Linje',
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
export function shapePoints(p: Pick<Shape2DParams, 'shape' | 'points' | 'closed'>): { points: Vec2[]; closed: boolean } {
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

function penOf(p: Shape2DParams, opacity: number): Pen {
  const dash = LINE_TYPES[p.linetype]?.dash;
  return { weight: p.weight, ...(p.color ? { color: p.color as Color } : {}), ...(dash ? { dash } : {}), ...(opacity < 1 ? { opacity } : {}) };
}

/** Fyllningens förvalda färg. */
export const FILL_COLOR = '#9aa0a6';

/**
 * Formens primitiver: fyllningen (under modellen, `under`) och linjen. Linjen
 * finns också med tjockleken 0; den ritas inte, men går att klicka på och
 * snäppa mot. Med `noFill` ritas ingen fyllning (Visa → Fyllningar, 0.8.22).
 */
export function shapePrims(p: Shape2DParams, origin?: Primitive['origin'], noFill = false): Primitive[] {
  const { points, closed } = shapePoints(p);
  if (points.length < 2) return [];
  const out: Primitive[] = [];
  const op = opacitiesOf(p);
  if (p.fill && points.length > 2 && !noFill && op.fill > 0) {
    const color = (p.fillColor ?? FILL_COLOR) as Color;
    const alpha = op.fill < 1 ? { opacity: op.fill } : {};
    const hatch = (angle: number): FillDef => ({ kind: 'hatch', color, angle, spacing: p.fillSpacing, weight: 0.13, ...alpha });
    const fills: FillDef[] = p.fill === 'solid' ? [{ kind: 'solid', color, ...alpha }] : p.fill === 'cross' ? [hatch(p.fillAngle), hatch(p.fillAngle + 90)] : [hatch(p.fillAngle)];
    for (const fill of fills) out.push({ kind: 'region', role: 'cut', rings: [points], fill, outline: null, noOutline: true, ownFill: true, under: true, origin: origin && { ...origin, part: 'fyllning' } });
  }
  // Helt genomskinlig ritas som ingen linje: går att klicka på, syns inte.
  out.push({ kind: 'polyline', points, closed, pen: op.line > 0 ? penOf(p, op.line) : { ...penOf(p, 1), weight: 0 }, origin });
  return out;
}

export const shape2dType: ElementType<Shape2DParams> = {
  type: 'Shape2D',
  planReads: [],
  label: '2D-form',
  labelPlural: '2D-former',
  drawOrder: 58,
  compares: false,
  defaults: () => ({ shape: 'polyline', points: [], weight: 0.25, linetype: 'solid', fillAngle: 45, fillSpacing: 2 }),
  plan(el, ctx) {
    const p = ctx.params<Shape2DParams>(el);
    return shapePrims(p, { objectId: el.id, objectType: 'Shape2D', part: p.shape }, !!ctx.view.hide?.includes('fill'));
  },
  // Mitten går att klicka på bara när formen har en fyllning (0.8.19); annars bara linjen.
  pickSoft: true,
  pickShape(el, ctx) {
    const p = ctx.params<Shape2DParams>(el);
    if (!p.fill) return [];
    const { points } = shapePoints(p);
    return points.length > 2 ? [[points]] : [];
  },
};
