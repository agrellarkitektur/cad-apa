import { penFill, solidPen } from '../repr/markerPens';
import type { Origin, Pen, Primitive, TagHandles, Vec2 } from '../repr/primitives';

export type { TagHandles };

/**
 * Litterans ledare (0.10.20.1), gemensam för alla sorter: rummets stämpel,
 * väggarnas, dörrarnas och fönstrens littera och stödmurens. Ledaren går
 * först vinkelrätt ut från textens sida (stammen, eller ansatsen) och viker
 * sedan snett mot punkten den pekar på. Flera ledare (det generella littrat
 * i 0.10.20.2) delar stammen: med en gemensam vinkel räknas knäckarna ut så
 * att de sneda delarna blir parallella, och stammen blir så lång som behövs.
 */

/** Stammens sida; `auto` väljer efter var punkten ligger. */
export type LeaderSide = 'auto' | 'up' | 'right' | 'down' | 'left';
/** Ledarens ände; `auto` ger pil mot en kant och prick inne i en yta. */
export type LeaderEnd = 'auto' | 'none' | 'arrow' | 'filled' | 'dot' | 'slash' | 'ring';

export const LEADER_SIDES: [LeaderSide, string][] = [
  ['auto', 'Automatiskt'],
  ['up', 'Uppåt'],
  ['right', 'Åt höger'],
  ['down', 'Nedåt'],
  ['left', 'Åt vänster'],
];

export const LEADER_ENDS: [LeaderEnd, string][] = [
  ['auto', 'Automatiskt'],
  ['none', 'Ingen'],
  ['arrow', 'Pil'],
  ['filled', 'Fylld pil'],
  ['dot', 'Prick'],
  ['slash', 'Snedstreck'],
  ['ring', 'Ring'],
];

/**
 * Litterans läge och ledare på objektet (0.10.20.1), alla valfria. `at` och
 * `to` är förskjutningar i mm i modellen från förvalet: för littera längs en
 * vägg i textens egen riktning (längs, upp), så att de följer väggen när den
 * vrids; annars i planens axlar. Rummets text står i `labelAt` som förut.
 */
export interface TagParams {
  /** Textens förskjutning från sitt förval. */
  at?: [number, number];
  /** Punktens förskjutning från sitt förval. */
  to?: [number, number];
  /** Stammens längd, mm på papperet; utelämnad = stilmallens. */
  stub?: number;
  side?: LeaderSide;
  end?: LeaderEnd;
}

/** Textens ruta i modellen: mitten, halva bredden och höjden längs textens axlar. */
export interface TextBox {
  center: Vec2;
  halfW: number;
  halfH: number;
  along: Vec2;
  up: Vec2;
}

/** En punkt som ledaren pekar på; `inside` när den ligger inne i en yta (prick som förval). */
export interface LeaderTarget {
  at: Vec2;
  inside?: boolean;
}

export interface LeaderOptions {
  side?: LeaderSide;
  end?: LeaderEnd;
  /** Stammens minsta längd, mm på papperet. */
  stub: number;
  /** Gemensam vinkel i grader mellan stammen och de sneda delarna; utelämnad = fria knäckar i stammens ände. */
  angle?: number;
  /** Mellanrummet mellan texten och stammen, mm på papperet. */
  gap?: number;
  scale: number;
  pen: Pen;
  origin?: Origin;
}

export interface LeaderGeometry {
  side: Exclude<LeaderSide, 'auto'>;
  /** Stammens riktning, ut från texten. */
  dir: Vec2;
  /** Där stammen börjar, vid textens sida. */
  start: Vec2;
  /** Stammens ände. */
  stubEnd: Vec2;
  /** Där varje ledare viker av mot sin punkt. */
  knees: Vec2[];
  prims: Primitive[];
}

const dot = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1];
const add = (a: Vec2, b: Vec2, k = 1): Vec2 => [a[0] + b[0] * k, a[1] + b[1] * k];
const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
const neg = (a: Vec2): Vec2 => [-a[0], -a[1]];

/**
 * Stammens sida när den inte är vald: åt höger eller vänster efter vilken
 * sida av textens mittlinje punkterna ligger (så att den byter sida när
 * texten dras förbi), uppåt eller nedåt när de ligger rakt över eller under
 * textens mittersta halva.
 */
export function autoSide(box: TextBox, targets: readonly LeaderTarget[]): Exclude<LeaderSide, 'auto'> {
  const m: [number, number] = [0, 0];
  for (const t of targets) {
    m[0] += t.at[0] / targets.length;
    m[1] += t.at[1] / targets.length;
  }
  const d = sub(m, box.center);
  const x = dot(d, box.along);
  const y = dot(d, box.up);
  if (Math.abs(x) < box.halfW / 2) return y >= 0 ? 'up' : 'down';
  return x > 0 ? 'right' : 'left';
}

/** Stammens riktning för en sida. */
export function sideDir(box: TextBox, side: Exclude<LeaderSide, 'auto'>): Vec2 {
  return side === 'right' ? box.along : side === 'left' ? neg(box.along) : side === 'up' ? box.up : neg(box.up);
}

/** Ledaren med stam, knäckar och ändar; null utan punkter. */
export function leaderOf(box: TextBox, targets: readonly LeaderTarget[], o: LeaderOptions): LeaderGeometry | null {
  if (!targets.length) return null;
  const s = o.scale;
  const side = o.side && o.side !== 'auto' ? o.side : autoSide(box, targets);
  const dir = sideDir(box, side);
  const across = side === 'left' || side === 'right' ? box.up : box.along;
  const ext = (side === 'left' || side === 'right' ? box.halfW : box.halfH) + (o.gap ?? 1) * s;
  const start = add(box.center, dir, ext);
  const stub = Math.max(0, o.stub) * s;
  const tan = o.angle ? Math.tan((Math.max(5, Math.min(85, o.angle)) * Math.PI) / 180) : 0;
  // Hur långt ut längs stammen varje ledare viker av. En punkt rakt ut i
  // stammens linje nås av stammen själv.
  const ks = targets.map((t) => {
    const d = sub(t.at, start);
    const a = dot(d, dir);
    const l = Math.abs(dot(d, across));
    if (l < 0.05 * s) return { k: Math.max(0, a), straight: true };
    if (tan) return { k: Math.max(stub, a - l / tan), straight: false };
    return { k: stub, straight: false };
  });
  const len = Math.max(...ks.map((q) => q.k));
  const stubEnd = add(start, dir, len);
  const knees = ks.map((q) => add(start, dir, q.k));
  const pen = o.pen;
  const origin = o.origin;
  const prims: Primitive[] = [];
  if (len > 1e-6) prims.push({ kind: 'line', a: start, b: stubEnd, pen, origin });
  targets.forEach((t, i) => {
    const from = ks[i].straight ? start : knees[i];
    if (!ks[i].straight) prims.push({ kind: 'line', a: knees[i], b: t.at, pen, origin });
    const v = sub(t.at, from);
    const n = Math.hypot(v[0], v[1]);
    const u: Vec2 = n > 1e-9 ? [v[0] / n, v[1] / n] : dir;
    const kind = !o.end || o.end === 'auto' ? (t.inside ? 'dot' : 'arrow') : o.end;
    prims.push(...leaderEnd(kind, t.at, u, s, pen, origin));
  });
  return { side, dir, start, stubEnd, knees, prims };
}

/** Ändens tecken vid `tip`, där ledaren kommer i riktningen `u`. */
export function leaderEnd(kind: Exclude<LeaderEnd, 'auto'>, tip: Vec2, u: Vec2, s: number, pen: Pen, origin?: Origin): Primitive[] {
  const n: Vec2 = [-u[1], u[0]];
  const size = 2.5 * s;
  const base = add(tip, u, -size);
  const wing = (k: number) => add(base, n, size * 0.35 * k);
  const circle = (r: number): Vec2[] => Array.from({ length: 16 }, (_, i) => [tip[0] + r * Math.cos((i * Math.PI) / 8), tip[1] + r * Math.sin((i * Math.PI) / 8)] as Vec2);
  switch (kind) {
    case 'arrow':
      return [1, -1].map((k): Primitive => ({ kind: 'line', a: tip, b: wing(k), pen, origin }));
    case 'filled':
      return [{ kind: 'region', role: 'cut', rings: [[tip, wing(1), wing(-1)]], fill: penFill(pen), outline: solidPen(pen), ownFill: true, origin }];
    case 'dot':
      return [{ kind: 'region', role: 'cut', rings: [circle(0.6 * s)], fill: penFill(pen), outline: null, noOutline: true, ownFill: true, origin }];
    case 'slash': {
      const d: Vec2 = [(u[0] + n[0]) * Math.SQRT1_2, (u[1] + n[1]) * Math.SQRT1_2];
      return [{ kind: 'line', a: add(tip, d, -1.2 * s), b: add(tip, d, 1.2 * s), pen, origin }];
    }
    case 'ring':
      return [{ kind: 'polyline', points: circle(0.9 * s), closed: true, pen, origin }];
    case 'none':
      return [];
  }
}

/** Vinkeln från `from` till `to` avrundad till steg om 15°, med samma längd (Shift när ledaren dras). */
export function snap15(from: Vec2, to: Vec2): Vec2 {
  const v = sub(to, from);
  const l = Math.hypot(v[0], v[1]);
  if (l < 1e-9) return to;
  const step = Math.PI / 12;
  const a = Math.round(Math.atan2(v[1], v[0]) / step) * step;
  return [from[0] + Math.cos(a) * l, from[1] + Math.sin(a) * l];
}

/** En förskjutning i planens axlar uttryckt i ramens (eller planens) axlar. */
export function toFrame(d: Vec2, frame?: { along: Vec2; up: Vec2 }): [number, number] {
  return frame ? [dot(d, frame.along), dot(d, frame.up)] : [d[0], d[1]];
}

/** En förskjutning i ramens (eller planens) axlar uttryckt i planens. */
export function fromFrame(d: readonly number[] | undefined, frame?: { along: Vec2; up: Vec2 }): Vec2 {
  if (!d) return [0, 0];
  return frame ? add([frame.along[0] * d[0], frame.along[1] * d[0]], frame.up, d[1]) : [d[0], d[1]];
}
