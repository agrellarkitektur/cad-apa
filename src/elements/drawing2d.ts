import { arcFromBulge, arcSegments, bulgeThrough, STRAIGHT, type Arc } from '../geometry/arc';
import { dist } from '../geometry/vec';
import type { Color, StyleSheet } from '../core/graphics';
import { lineTypeDash } from '../core/lineTypes';
import type { Pen, Primitive, Vec2 } from '../repr/primitives';
import type { ElementType } from './registry';
import { fillPrims, opacitiesOf, type FillParams } from './fill2d';

export {
  anchorLines,
  BACKGROUND_COLOR,
  backgroundOpacity,
  effectiveFill,
  FILL_BACKGROUND,
  FILL_COLOR,
  FILL_FIELDS,
  FILL_WEIGHT,
  fillPrims,
  hasBackground,
  opacitiesOf,
  PATTERN_LABELS,
  type FillParams,
  type FillPattern,
} from './fill2d';

/**
 * 2D-formen (0.8.19, 0.8.24, format 13): en kedja av raka segment och
 * bågar, eller en spline, med penna, fyllning och ändformer. Linje,
 * rektangel, båge och cirkel är bara sätt att rita kedjan; fyllningen kan läggas på vilken form som
 * helst, också en öppen (den fylls som om den vore sluten, som i
 * Illustrator). Formen är ritningsinformation, finns inte i 3D och följer
 * inte med till IFC. Den ritas på en yta (planen, en fasad, en sektion, ett
 * arbetsblad eller ett blad) och kan väljas att synas i vissa vyer
 * (`Element.show`).
 */

/** Sätten att rita (verktyget). Efter ritandet är formen en kedja eller en spline (0.8.24). */
export type ShapeKind = 'polyline' | 'rect' | 'arc' | 'circle' | 'spline';
/** Vad formen är: en kedja av raka segment och bågar, eller en spline (0.8.24, format 13). */
export type ShapePath = 'polyline' | 'spline';
/** Linjetypens nyckel: en inbyggd eller en egen i stilmallen (0.8.30, `src/core/lineTypes.ts`). */
export type LineType = string;

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

export interface Shape2DParams extends FillParams {
  /**
   * Kedjan (raka segment och bågar) eller en spline (0.8.24). Rektangel,
   * båge och cirkel ritas som kedjor och går sedan att ändra som andra.
   */
  shape: ShapePath;
  /** Punkterna, två eller fler. */
  points: [number, number][];
  /**
   * Pilhöjden per segment i mm (0.8.24), som väggarnas: segment i går från
   * punkt i till i + 1 (i en sluten form från sista punkten till den första).
   * Positiv buktar åt vänster; saknas eller 0 = rakt. Bara kedjor.
   */
  bulges?: number[];
  /** Sluten: segmentet från sista punkten till den första finns. */
  closed?: boolean;
  /** Pennans bredd på papper i mm; 0 = ingen linje. */
  weight: number;
  linetype: LineType;
  /** Linjens färg som #rrggbb; utelämnad = ritningens svart. */
  color?: string;
  /** Ändformen i början och slutet av en öppen form (0.8.24); utelämnad = ingen. */
  startCap?: CapKind;
  endCap?: CapKind;
  /** Ändformernas storlek på papper i mm; utelämnad = `CAP_SIZE`. */
  capSize?: number;
  /** Fyllningen ritas framför väggarna (0.8.25); utelämnad = bakom, som förut. */
  fillFront?: boolean;
  /** Linjen ritas bakom väggarna (0.8.25); utelämnad = framför, som förut. */
  lineBehind?: boolean;
  /**
   * Avgränsar rum (0.8.34): linjen räknas som en tunn vägg när rummen räknas
   * ut, för alkover och öppna planlösningar. Gäller också med pennan 0.
   */
  boundsRooms?: boolean;
}

/** Ändformerna (0.8.24). */
export type CapKind = 'arrow' | 'open' | 'triangle' | 'dot' | 'circle' | 'tick' | 'bar';

export const CAP_LABELS: Record<CapKind, string> = {
  arrow: 'Pil',
  open: 'Öppen pil',
  triangle: 'Triangel',
  dot: 'Punkt',
  circle: 'Cirkel',
  tick: 'Snedstreck',
  bar: 'Tvärstreck',
};

/** Ändformernas förvalda storlek på papper, mm. */
export const CAP_SIZE = 2.5;

/** Namnen på sätten att rita, i verktyget. */
export const SHAPE_LABELS: Record<ShapeKind, string> = {
  polyline: 'Linje',
  rect: 'Rektangel',
  arc: 'Båge',
  circle: 'Cirkel',
  spline: 'Spline',
};

/** Vad formen är, i egenskaperna. */
export const PATH_LABELS: Record<ShapePath, string> = { polyline: 'Linje', spline: 'Spline' };

/** Antalet segment: ett mindre än punkterna, eller lika många i en sluten form. */
export function segmentCount(n: number, closed: boolean): number {
  return n < 2 ? 0 : closed ? n : n - 1;
}

/** Om formen är sluten och har något att sluta (två punkter räcker om ett segment är en båge). */
export function isClosed(p: Pick<Shape2DParams, 'shape' | 'points' | 'closed' | 'bulges'>): boolean {
  if (!p.closed) return false;
  const n = p.points.length;
  return n > 2 || (n === 2 && p.shape !== 'spline' && (p.bulges ?? []).some((b) => Math.abs(b) >= STRAIGHT));
}

/** Bågen för segment i, eller null om det är rakt. */
export function segmentArc(p: Pick<Shape2DParams, 'points' | 'bulges'>, i: number): Arc | null {
  const b = p.bulges?.[i] ?? 0;
  if (Math.abs(b) < STRAIGHT) return null;
  const a = p.points[i];
  const c = p.points[(i + 1) % p.points.length];
  return a && c ? arcFromBulge(a, c, b) : null;
}

/** Punkterna längs en båge, utan slutpunkten. */
function arcSamples(arc: Arc): Vec2[] {
  const n = arcSegments(arc.sweep, arc.radius);
  return Array.from({ length: n }, (_, i): Vec2 => {
    const t = arc.theta0 - (arc.sigma * arc.sweep * i) / n;
    return [arc.center[0] + arc.radius * Math.cos(t), arc.center[1] + arc.radius * Math.sin(t)];
  });
}

/** Punkterna som formen ritas med (bågar och splines som korta raka bitar). */
export function shapePoints(p: Pick<Shape2DParams, 'shape' | 'points' | 'closed' | 'bulges'>): { points: Vec2[]; closed: boolean } {
  const pts = p.points as Vec2[];
  const closed = isClosed(p);
  if (p.shape === 'spline') return { points: catmullRom(pts, closed), closed };
  if (!p.bulges?.some((b) => Math.abs(b) >= STRAIGHT)) return { points: pts, closed };
  const out: Vec2[] = [];
  const segs = segmentCount(pts.length, closed);
  for (let i = 0; i < segs; i++) {
    const arc = segmentArc(p, i);
    if (arc) out.push(...arcSamples(arc));
    else out.push(pts[i]);
  }
  if (!closed) out.push(pts[pts.length - 1]);
  return { points: out, closed };
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

function penOf(p: Shape2DParams, opacity: number, style?: StyleSheet): Pen {
  const dash = lineTypeDash(style, p.linetype);
  return { weight: p.weight, ...(p.color ? { color: p.color as Color } : {}), ...(dash ? { dash } : {}), ...(opacity < 1 ? { opacity } : {}) };
}

/**
 * Formens primitiver: fyllningen (under modellen, `under`), linjen och
 * ändformerna (0.8.24). Linjen finns också med tjockleken 0; den ritas inte,
 * men går att klicka på och snäppa mot. Med `noFill` ritas ingen fyllning
 * (Visa → Fyllningar, 0.8.22). `scale` är modellens mm per mm på papper,
 * för ändformernas storlek, och `style` ger de egna linjetyperna (0.8.30).
 */
export function shapePrims(p: Shape2DParams, origin?: Primitive['origin'], noFill = false, scale = 1, style?: StyleSheet): Primitive[] {
  const { points, closed } = shapePoints(p);
  if (points.length < 2) return [];
  const out: Primitive[] = [];
  const op = opacitiesOf(p);
  const caps = !closed && p.weight > 0 && op.line > 0 && (p.startCap || p.endCap);
  let line = points;
  if (caps) {
    const size = (p.capSize ?? CAP_SIZE) * scale;
    const pen: Pen = { ...penOf(p, op.line) };
    delete pen.dash;
    const o = origin && { ...origin, part: 'ände' };
    let cutA = 0;
    let cutB = 0;
    if (p.startCap) {
      const c = capPrims(p.startCap, points[0], endDir(points, false), size, pen, p.color, o);
      out.push(...c.prims);
      cutA = c.cut;
    }
    if (p.endCap) {
      const c = capPrims(p.endCap, points[points.length - 1], endDir(points, true), size, pen, p.color, o);
      out.push(...c.prims);
      cutB = c.cut;
    }
    line = trimEnds(points, cutA, cutB);
  }
  // Helt genomskinlig ritas som ingen linje: går att klicka på, syns inte.
  // Den kapade linjen ritas; den hela går att klicka på (tjocklek 0) där ändformen täcker.
  const pen = op.line > 0 ? penOf(p, op.line, style) : { ...penOf(p, 1, style), weight: 0 };
  if (line !== points) {
    if (line.length >= 2) out.push({ kind: 'polyline', points: line, closed: false, pen, origin: origin && { ...origin, part: 'linje' } });
    out.push({ kind: 'polyline', points, closed, pen: { ...pen, weight: 0 }, origin });
  } else out.push({ kind: 'polyline', points, closed, pen, origin });
  // Fyllningen först; linjen och ändarna bakom väggarna om så valts (0.8.25).
  const fill = points.length > 2 && !noFill ? fillPrims([points], p, origin, !p.fillFront, style, scale) : [];
  return [...fill, ...(p.lineBehind ? out.map((q) => ({ ...q, under: true })) : out)];
}

/** Riktningen utåt i formens början (`atEnd` false) eller slut. */
function endDir(pts: readonly Vec2[], atEnd: boolean): Vec2 {
  const n = pts.length;
  const tip = atEnd ? pts[n - 1] : pts[0];
  // Första punkten som inte sammanfaller med änden.
  for (let k = 1; k < n; k++) {
    const q = atEnd ? pts[n - 1 - k] : pts[k];
    const d = dist(tip, q);
    if (d > 1e-6) return [(tip[0] - q[0]) / d, (tip[1] - q[1]) / d];
  }
  return [1, 0];
}

/** Linjen kapad `a` mm från början och `b` mm från slutet, längs linjen. */
export function trimEnds(pts: readonly Vec2[], a: number, b: number): Vec2[] {
  const cut = (q: readonly Vec2[], d: number): Vec2[] => {
    if (d <= 0) return [...q];
    let left = d;
    for (let i = 0; i + 1 < q.length; i++) {
      const l = dist(q[i], q[i + 1]);
      if (l >= left) {
        const t = left / (l || 1);
        return [[q[i][0] + (q[i + 1][0] - q[i][0]) * t, q[i][1] + (q[i + 1][1] - q[i][1]) * t], ...q.slice(i + 1)];
      }
      left -= l;
    }
    return [];
  };
  const s = cut(pts, a);
  return cut(s.reverse(), b).reverse();
}

/**
 * En ändform med spetsen (eller mitten) i `tip`, riktad utåt längs `dir`,
 * och hur långt in linjen ska kapas för att inte synas genom den.
 */
export function capPrims(kind: CapKind, tip: Vec2, dir: Vec2, size: number, pen: Pen, color: string | undefined, origin?: Primitive['origin']): { prims: Primitive[]; cut: number } {
  const n: Vec2 = [-dir[1], dir[0]];
  const at = (back: number, side: number): Vec2 => [tip[0] - dir[0] * back + n[0] * side, tip[1] - dir[1] * back + n[1] * side];
  const ink = (color ?? 'ink') as Color;
  const filled = (ring: Vec2[]): Primitive => ({
    kind: 'region',
    role: 'cut',
    rings: [ring],
    fill: { kind: 'solid', color: ink, ...(pen.opacity !== undefined ? { opacity: pen.opacity } : {}) },
    outline: pen,
    ownFill: true,
    origin,
  });
  const circle = (r: number): Vec2[] => Array.from({ length: 24 }, (_, i): Vec2 => [tip[0] + r * Math.cos((Math.PI * i) / 12), tip[1] + r * Math.sin((Math.PI * i) / 12)]);
  switch (kind) {
    case 'arrow':
      return { prims: [filled([tip, at(size, size / 6), at(size, -size / 6)])], cut: size * 0.9 };
    case 'open':
      return { prims: [{ kind: 'polyline', points: [at(size, size / 3), tip, at(size, -size / 3)], closed: false, pen, origin }], cut: 0 };
    case 'triangle':
      return { prims: [{ kind: 'polyline', points: [tip, at(size, size / 3), at(size, -size / 3)], closed: true, pen, origin }], cut: size };
    case 'dot':
      return { prims: [filled(circle(size / 5))], cut: 0 };
    case 'circle':
      return { prims: [{ kind: 'polyline', points: circle(size / 4), closed: true, pen, origin }], cut: size / 4 };
    case 'tick': {
      // Snedstreck som på mått: 45° mot linjen.
      const h = size / 2 / Math.SQRT2;
      return { prims: [{ kind: 'line', a: at(h, -h), b: at(-h, h), pen, origin }], cut: 0 };
    }
    case 'bar':
      return { prims: [{ kind: 'line', a: at(0, size / 2), b: at(0, -size / 2), pen, origin }], cut: 0 };
  }
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
    return shapePrims(p, { objectId: el.id, objectType: 'Shape2D', part: p.shape }, !!ctx.view.hide?.includes('fill'), ctx.scale, ctx.style);
  },
  // Mitten går att klicka på bara när formen har en fyllning (0.8.19); annars bara linjen.
  // En fyllning framför väggarna (0.8.25) går före dem också när man klickar.
  pickSoft: (el, ctx) => !ctx.params<Shape2DParams>(el).fillFront,
  // Det som ligger överst döljer det under (0.8.28).
  planCovers: true,
  pickShape(el, ctx) {
    const p = ctx.params<Shape2DParams>(el);
    if (!p.fill) return [];
    const { points } = shapePoints(p);
    return points.length > 2 ? [[points]] : [];
  },
};
