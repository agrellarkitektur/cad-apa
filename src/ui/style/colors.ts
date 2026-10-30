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

/** `#rrggbb` som nyans (0–360), mättnad och ljushet (0–1). */
export function hexToHsv(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max];
}

/** Nyans, mättnad och ljushet som `#rrggbb`. */
export function hsvToHex([h, s, v]: readonly [number, number, number]): string {
  const f = (k: number) => {
    const kk = (k + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(kk, 4 - kk, 1));
  };
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(f(5))}${to(f(3))}${to(f(1))}`;
}
