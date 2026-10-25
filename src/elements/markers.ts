import type { Element, ProjectDoc } from '../core/model';
import { left, norm, sub } from '../geometry/vec';
import { markerPen, penFill, solidPen, withWeight } from '../repr/markerPens';
import type { Pen, Primitive, Vec2 } from '../repr/primitives';
import { resolveParams, type ElementType, type PlanContext } from './registry';
import type { RoofParams } from './roof';

/**
 * Norrpil, fasader och sektioner (format 4). De hör till ritningen, inte
 * till byggnaden, och finns därför i alla tillstånd.
 */

export interface NorthParams {
  pos: [number, number];
  /** Riktningen mot norr i grader, moturs från x-axeln. 90 = rakt upp. */
  angle: number;
}

/**
 * En fasad- eller sektionslinje. Betraktaren står vid linjen och ser åt
 * `side`: 1 = åt vänster sett från start mot slut, -1 = åt höger. Det som
 * ligger bakom betraktaren syns inte; en sektion skär där linjen går.
 */
export interface MarkerParams {
  start: [number, number];
  end: [number, number];
  side: 1 | -1;
  /** Hur långt bortom linjen som visas, mm. Null = allt. */
  depth: number | null;
  /** Placeras automatiskt utanför byggnaden (fasader) eller genom mitten (sektioner). */
  auto: boolean;
  /** Fasader: åt vilket håll fasaden vetter, grader moturs från x-axeln. */
  facing?: number;
  /** Sektioner: bokstaven, t.ex. "A" för Sektion A-A. */
  label?: string;
}

/** Hur långt utanför byggnaden automatiska fasadlinjer läggs, mm. */
const MARGIN = 2500;

/** Byggnadens utbredning i plan på en våning: väggar och tak. */
export function modelBounds(doc: ProjectDoc, storey: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
  // Utan listor över alla punkter (0.8.27): anropas flera gånger för varje
  // fasad och sektion när planen ritas.
  let n = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x: number, y: number) => {
    n++;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const id in doc.elements) {
    const el = doc.elements[id];
    if (el.storey !== storey) continue;
    if (el.type === 'Wall') {
      const p = resolveParams<{ start: Vec2; end: Vec2; thickness: number }>(doc, el);
      const h = (p.thickness ?? 0) / 2;
      for (const q of [p.start, p.end]) {
        add(q[0] - h, q[1] - h);
        add(q[0] + h, q[1] + h);
      }
    } else if (el.type === 'Roof') {
      for (const q of resolveParams<RoofParams>(doc, el).outline) add(q[0], q[1]);
    }
  }
  if (!n) return null;
  return { minX, minY, maxX, maxY };
}

/** Linjen och riktningarna för en fasad eller sektion. */
export interface MarkerFrame {
  start: Vec2;
  end: Vec2;
  /** Riktningen betraktaren ser åt (enhetsvektor i plan). */
  view: Vec2;
  /** Betraktarens högerhand: x-led i fasaden. */
  right: Vec2;
  depth: number | null;
}

export function markerFrame(doc: ProjectDoc, el: Element<any>): MarkerFrame {
  const p = resolveParams<MarkerParams>(doc, el);
  if (p.auto) {
    const b = modelBounds(doc, el.storey) ?? { minX: -5000, minY: -5000, maxX: 5000, maxY: 5000 };
    const c: Vec2 = [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
    const corners: Vec2[] = [
      [b.minX, b.minY],
      [b.maxX, b.minY],
      [b.maxX, b.maxY],
      [b.minX, b.maxY],
    ];
    if (el.type === 'Elevation') {
      const r = ((p.facing ?? 270) * Math.PI) / 180;
      const f: Vec2 = [Math.cos(r), Math.sin(r)];
      const view: Vec2 = [-f[0], -f[1]];
      const right: Vec2 = [view[1], -view[0]];
      const out = Math.max(...corners.map((q) => (q[0] - c[0]) * f[0] + (q[1] - c[1]) * f[1])) + MARGIN;
      const half = Math.max(...corners.map((q) => Math.abs((q[0] - c[0]) * right[0] + (q[1] - c[1]) * right[1]))) + MARGIN / 2;
      const m: Vec2 = [c[0] + f[0] * out, c[1] + f[1] * out];
      return { start: [m[0] - right[0] * half, m[1] - right[1] * half], end: [m[0] + right[0] * half, m[1] + right[1] * half], view, right, depth: null };
    }
    // Sektion: vågrätt genom mitten, man ser uppåt i planen.
    const start: Vec2 = [b.minX - MARGIN / 2, c[1]];
    const end: Vec2 = [b.maxX + MARGIN / 2, c[1]];
    return { start, end, view: [0, 1], right: [1, 0], depth: p.depth };
  }
  const u = norm(sub(p.end, p.start));
  const l = left(u);
  const view: Vec2 = [l[0] * p.side, l[1] * p.side];
  const right: Vec2 = [view[1], -view[0]];
  // Linjen räknas alltid från betraktarens vänster till höger.
  const [start, end] = p.side === 1 ? [p.start, p.end] : [p.end, p.start];
  return { start, end, view, right, depth: p.depth };
}

const COMPASS = ['norr', 'nordost', 'ost', 'sydost', 'syd', 'sydväst', 'väst', 'nordväst'];
const COMPASS_SHORT = ['N', 'NO', 'O', 'SO', 'S', 'SV', 'V', 'NV'];

/** Riktningen mot norr i projektet, grader moturs från x-axeln. */
export function northAngle(doc: ProjectDoc): number {
  for (const id in doc.elements) {
    const n = doc.elements[id];
    if (n.type === 'North') return Number((n.params as Partial<NorthParams>).angle ?? 90);
  }
  return 90;
}

/** Närmaste av de åtta väderstrecken för en riktning i plan. */
export function compassOf(doc: ProjectDoc, dir: Vec2): { name: string; short: string } {
  const a = (Math.atan2(dir[1], dir[0]) * 180) / Math.PI;
  // Medurs från norr, som på en kompass.
  const bearing = (((northAngle(doc) - a) % 360) + 360) % 360;
  const i = Math.round(bearing / 45) % 8;
  return { name: COMPASS[i], short: COMPASS_SHORT[i] };
}

/** Namnet på en fasad eller sektion: eget namn, annars "Fasad mot syd" eller "Sektion A-A". */
export function markerName(doc: ProjectDoc, el: Element<any>): string {
  if (el.name) return el.name;
  if (el.type === 'Section') {
    const l = (el.params as Partial<MarkerParams>).label || 'A';
    return `Sektion ${l}-${l}`;
  }
  const f = markerFrame(doc, el);
  return `Fasad mot ${compassOf(doc, [-f.view[0], -f.view[1]]).name}`;
}

/** Kort beteckning i planen: väderstrecket för fasader, bokstaven för sektioner. */
export function markerTag(doc: ProjectDoc, el: Element<any>): string {
  if (el.type === 'Section') return (el.params as Partial<MarkerParams>).label || 'A';
  const f = markerFrame(doc, el);
  return compassOf(doc, [-f.view[0], -f.view[1]]).short;
}

/**
 * Vinkeln för text längs en riktning, vänd så att den läses från vänster
 * eller nedifrån: aldrig upp och ned.
 */
export function readableAngle(dir: Vec2): number {
  let a = Math.atan2(dir[1], dir[0]);
  if (a > Math.PI / 2 + 1e-9) a -= Math.PI;
  else if (a <= -Math.PI / 2 + 1e-9) a += Math.PI;
  return a;
}

/** En öppen pilspets: två streck bakåt från `tip`, mot `dir`. */
function openArrow(tip: Vec2, dir: Vec2, size: number, pen: Pen, origin: Primitive['origin']): Primitive[] {
  const n = left(dir);
  const base: Vec2 = [tip[0] - dir[0] * size, tip[1] - dir[1] * size];
  return [1, -1].map((s) => ({ kind: 'line', a: tip, b: [base[0] + n[0] * size * 0.5 * s, base[1] + n[1] * size * 0.5 * s], pen, origin }) as Primitive);
}

/**
 * Sektionslinjen i planen (0.7.1): tjocka streck vid ändarna, ett lika
 * tjockt skaft mot blickriktningen med en lika tjock öppen pil (0.8.22), och bokstaven ute vid
 * linjens ände, vriden efter linjen. Linjen emellan ritas inte.
 */
function sectionPlan(el: Element<any>, ctx: PlanContext): Primitive[] {
  const f = markerFrame(ctx.doc, el);
  const k = ctx.scale;
  const origin = { objectId: el.id, objectType: 'Section' };
  const u = norm(sub(f.end, f.start));
  const len = Math.hypot(f.end[0] - f.start[0], f.end[1] - f.start[1]);
  const endLen = Math.min(len / 3, 8 * k);
  const at = (t: number): Vec2 => [f.start[0] + u[0] * t, f.start[1] + u[1] * t];
  const tag = markerTag(ctx.doc, el);
  const thick = markerPen(ctx.style, 'sectionLine');
  const out: Primitive[] = [
    { kind: 'line', a: f.start, b: at(endLen), pen: thick, origin },
    { kind: 'line', a: at(len - endLen), b: f.end, pen: thick, origin },
  ];
  const angle = readableAngle(u);
  const h = 3.5;
  // Texten centreras på linjen: flytta baslinjen ned en dryg halv texthöjd.
  const down: Vec2 = [Math.sin(angle), -Math.cos(angle)];
  for (const t of [0, len]) {
    const base = at(t);
    const tip: Vec2 = [base[0] + f.view[0] * 6 * k, base[1] + f.view[1] * 6 * k];
    out.push({ kind: 'line', a: base, b: tip, pen: thick, origin });
    // Pilens hullingar är lika tjocka som vinkeln (0.8.22).
    out.push(...openArrow(tip, f.view, 2.5 * k, solidPen(thick), origin));
    const side = t === 0 ? -1 : 1;
    const c: Vec2 = [base[0] + u[0] * side * 3.2 * k, base[1] + u[1] * side * 3.2 * k];
    out.push({ kind: 'text', at: [c[0] + down[0] * h * 0.36 * k, c[1] + down[1] * h * 0.36 * k], text: tag, height: h, bold: true, align: 'middle', angle, pen: withWeight(thick, 0.35), origin });
  }
  return out;
}

/**
 * Fasadlinjen i planen (0.7.1): heldragen, med en liten fylld triangel i
 * mitten som pekar mot huset och namnet i liten text högerställt ovanför
 * linjen, vriden efter den.
 */
function elevationPlan(el: Element<any>, ctx: PlanContext): Primitive[] {
  const f = markerFrame(ctx.doc, el);
  const k = ctx.scale;
  const origin = { objectId: el.id, objectType: 'Elevation' };
  const m: Vec2 = [(f.start[0] + f.end[0]) / 2, (f.start[1] + f.end[1]) / 2];
  const u = norm(sub(f.end, f.start));
  const s = 2.6 * k;
  const tip: Vec2 = [m[0] + f.view[0] * s, m[1] + f.view[1] * s];
  const angle = readableAngle(u);
  const along: Vec2 = [Math.cos(angle), Math.sin(angle)];
  const up: Vec2 = [-along[1], along[0]];
  // Linjens högra ände sett i läsriktningen.
  const right = (f.end[0] - f.start[0]) * along[0] + (f.end[1] - f.start[1]) * along[1] > 0 ? f.end : f.start;
  const text = markerName(ctx.doc, el).toLocaleUpperCase('sv-SE');
  const pen = markerPen(ctx.style, 'elevationLine');
  return [
    { kind: 'line', a: f.start, b: f.end, pen, origin },
    {
      kind: 'region',
      role: 'cut',
      rings: [[tip, [m[0] + u[0] * s * 0.6, m[1] + u[1] * s * 0.6], [m[0] - u[0] * s * 0.6, m[1] - u[1] * s * 0.6]]],
      fill: penFill(pen),
      outline: solidPen(pen),
      ownFill: true,
      origin,
    },
    {
      kind: 'text',
      at: [right[0] - along[0] * 1.5 * k + up[0] * 1.2 * k, right[1] - along[1] * 1.5 * k + up[1] * 1.2 * k],
      text,
      height: 2,
      align: 'end',
      angle,
      pen: withWeight(pen, 0.18),
      origin,
    },
  ];
}

export const northType: ElementType<NorthParams> = {
  type: 'North',
  label: 'Norrpil',
  labelPlural: 'Norrpilar',
  drawOrder: 64,
  compares: false,
  global: true,
  defaults: () => ({ pos: [0, 0], angle: 90 }),
  plan(el, ctx) {
    const p = ctx.params<NorthParams>(el);
    const k = ctx.scale;
    const origin = { objectId: el.id, objectType: 'North' };
    const r = (p.angle * Math.PI) / 180;
    const d: Vec2 = [Math.cos(r), Math.sin(r)];
    const n = left(d);
    const c = p.pos;
    const R = 6 * k;
    const circle: Vec2[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = (i / 40) * Math.PI * 2;
      circle.push([c[0] + Math.cos(t) * R, c[1] + Math.sin(t) * R]);
    }
    const tip: Vec2 = [c[0] + d[0] * R, c[1] + d[1] * R];
    const tail: Vec2 = [c[0] - d[0] * R, c[1] - d[1] * R];
    const w = R * 0.42;
    const l: Vec2 = [c[0] - d[0] * R * 0.55 + n[0] * w, c[1] - d[1] * R * 0.55 + n[1] * w];
    const rr: Vec2 = [c[0] - d[0] * R * 0.55 - n[0] * w, c[1] - d[1] * R * 0.55 - n[1] * w];
    const label: Vec2 = [c[0] + d[0] * (R + 4.5 * k), c[1] + d[1] * (R + 4.5 * k) - 1.6 * k];
    const pen = markerPen(ctx.style, 'north');
    return [
      { kind: 'polyline', points: circle, closed: true, pen, origin },
      { kind: 'line', a: tail, b: tip, pen, origin },
      { kind: 'region', role: 'cut', rings: [[tip, l, c]], fill: penFill(pen), outline: solidPen(pen), ownFill: true, origin },
      { kind: 'polyline', points: [tip, rr, c], closed: true, pen: solidPen(pen), origin },
      { kind: 'text', at: label, text: 'N', height: 3.5, bold: true, align: 'middle', pen: withWeight(pen, 0.35), origin },
    ];
  },
};

export const sectionType: ElementType<MarkerParams> = {
  type: 'Section',
  label: 'Sektion',
  labelPlural: 'Sektioner',
  drawOrder: 66,
  compares: false,
  global: true,
  defaults: () => ({ start: [0, 0], end: [5000, 0], side: 1, depth: null, auto: false, label: 'A' }),
  plan: sectionPlan,
};

export const elevationType: ElementType<MarkerParams> = {
  type: 'Elevation',
  label: 'Fasad',
  labelPlural: 'Fasader',
  drawOrder: 65,
  compares: false,
  global: true,
  defaults: () => ({ start: [0, 0], end: [5000, 0], side: 1, depth: null, auto: true, facing: 270 }),
  plan: elevationPlan,
};
