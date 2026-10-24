import { evaluate } from './expr';
import type { Vec2 } from '../repr/primitives';

/**
 * Punkter som skrivs (0.8.20), som i AutoCAD:
 *
 *   2400          avståndet från förra punkten, åt det håll markören pekar
 *   @1200,600     relativt förra punkten
 *   @3000<45      relativt förra punkten: avstånd och vinkel (moturs från x-axeln)
 *   1200,600      i projektets koordinater (# först går också: #1200,600)
 *   <45           låser riktningen; nästa punkt klickas eller skrivs som avstånd
 *
 * Talen är uttryck som i sifferfälten (2,4m, 1200+300). Skiljetecknet
 * mellan x och y är komma; med decimaler skrivs punkt, eller semikolon
 * mellan x och y (1200,5;600).
 */
export type PointEntry =
  | { kind: 'abs'; p: Vec2 }
  | { kind: 'rel'; d: Vec2 }
  | { kind: 'polar'; len: number; deg: number }
  | { kind: 'dist'; len: number }
  | { kind: 'angle'; deg: number };

/** Om texten ser ut att vara en punkt och inte ett kommando: börjar med siffra, @, #, <, minus eller punkt. */
export function looksLikePoint(text: string): boolean {
  return /^\s*[-+@#<.0-9(]/.test(text);
}

function pair(s: string): Vec2 | null {
  const parts = s.includes(';') ? s.split(';') : s.split(',');
  if (parts.length !== 2) return null;
  const x = evaluate(parts[0], null, 'mm');
  const y = evaluate(parts[1], null, 'mm');
  return x === null || y === null ? null : [x, y];
}

export function parsePoint(text: string): PointEntry | null {
  let s = text.trim().replace(/\s+/g, '');
  if (!s) return null;
  if (s.startsWith('<')) {
    const deg = evaluate(s.slice(1), null, 'deg');
    return deg === null ? null : { kind: 'angle', deg };
  }
  let rel = false;
  if (s.startsWith('@')) {
    rel = true;
    s = s.slice(1);
  } else if (s.startsWith('#')) s = s.slice(1);
  if (s.includes('<')) {
    const [a, b] = s.split('<');
    const len = evaluate(a, null, 'mm');
    const deg = evaluate(b, null, 'deg');
    if (len === null || deg === null) return null;
    // Utan @ räknas avstånd och vinkel från projektets nollpunkt, som i AutoCAD.
    return rel ? { kind: 'polar', len, deg } : { kind: 'abs', p: polar([0, 0], len, deg) };
  }
  // 2,4m är ett avstånd med decimalkomma, inte punkten (2; 4000).
  const decimal = !rel && /^\d+,\d+(mm|cm|dm|m)$/i.test(s);
  if (!decimal && (s.includes(',') || s.includes(';'))) {
    // Ett ensamt decimalkomma (2,4m) är ett avstånd, inte en punkt.
    const p = pair(s);
    if (p) return rel ? { kind: 'rel', d: p } : { kind: 'abs', p };
    if (rel) return null;
  }
  const len = evaluate(s, null, 'mm');
  if (len === null) return null;
  return rel ? null : { kind: 'dist', len };
}

function polar(from: Vec2, len: number, deg: number): Vec2 {
  const r = (deg * Math.PI) / 180;
  return [from[0] + len * Math.cos(r), from[1] + len * Math.sin(r)];
}

/**
 * Punkten som skrivits, räknad från förra punkten och markören. Null med en
 * förklaring om det inte går (ett avstånd utan förra punkt, eller utan riktning).
 */
export function resolvePoint(e: PointEntry, last: Vec2 | undefined, cursor: Vec2 | undefined, lockAngle: number | null = null): { p: Vec2 } | { error: string } {
  const from = last ?? ([0, 0] as Vec2);
  switch (e.kind) {
    case 'abs':
      return { p: e.p };
    case 'rel':
      return { p: [from[0] + e.d[0], from[1] + e.d[1]] };
    case 'polar':
      return { p: polar(from, e.len, e.deg) };
    case 'angle':
      return { error: 'En vinkel ensam ger ingen punkt.' };
    case 'dist': {
      if (!last) return { error: 'Ange första punkten med x,y eller klicka den.' };
      if (lockAngle !== null) return { p: polar(last, e.len, lockAngle) };
      if (!cursor) return { error: 'Peka först åt det håll avståndet ska gå.' };
      const d = [cursor[0] - last[0], cursor[1] - last[1]];
      const l = Math.hypot(d[0], d[1]);
      if (l < 1) return { error: 'Peka först åt det håll avståndet ska gå.' };
      return { p: [last[0] + (d[0] / l) * e.len, last[1] + (d[1] / l) * e.len] };
    }
  }
}

/**
 * Ett verktyg som tar emot skrivna punkter: väggen, 2D-formen och måttet.
 * `lockAngle` låses med `<45`.
 */
export interface PointTaker {
  lastPoint(): Vec2 | undefined;
  cursorPoint(): Vec2 | undefined;
  takePoint(p: Vec2): void;
  lockAngle: number | null;
  /** Vad verktyget vill ha just nu, för raden under smartshell. */
  hintText(): string;
}
