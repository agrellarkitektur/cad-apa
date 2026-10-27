import type { Color } from '../../core/graphics';

/** Svart och vitt sparas som "ink" och "paper" så att de följer skärmens tema. */
export function fromHex(hex: string): Color {
  const h = hex.toLowerCase();
  if (h === '#000000') return 'ink';
  if (h === '#ffffff') return 'paper';
  return h as Color;
}

/** Det grå som följer temat ("muted"), som det skrivs ut (granskningen efter 0.10.18). */
const MUTED_HEX = '#8c8c8c';

/** Färgen i ett färgfält: temafärgerna som svart och vitt, det grå som grått. */
export function toHex(c: string): string {
  if (c === 'muted') return MUTED_HEX;
  if (c === 'ink' || c === 'accent') return '#000000';
  if (c === 'paper') return '#ffffff';
  return c;
}

/** Ett tal mellan 0 och 1, eller 1 om det inte är ett tal. */
export function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
}
