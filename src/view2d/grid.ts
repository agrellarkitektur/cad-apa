import type { Camera } from './camera';

/** En nivå i rutnätet: linjerna med ett visst steg och hur starka de är. */
export interface GridLevel {
  /** Steget i mm. */
  step: number;
  /** Linjerna som inte redan ritas av en grövre nivå. */
  d: string;
  /** Opacitet 0–1. */
  opacity: number;
}

export interface GridPaths {
  /** Nivåerna, finast först. */
  levels: GridLevel[];
  /** Origo-axlarna. */
  axes: string;
  /** Finaste synliga steget (det statusraden visar). */
  minorStep: number;
}

/**
 * Linjer tätare än så ritas inte; mellan FADE_FROM och FADE_TO pixlar tonas
 * en nivå in. Alla nivåer i serien 1 · 5 · 10 · 50 · 100 · 500 · 1000 mm …
 * ritas samtidigt, var och en efter sitt avstånd på skärmen, så att en nivå
 * aldrig försvinner när en finare kommer in (0.8.18). Förut fanns bara två
 * nivåer, och 500-strecken försvann när 100-strecken tog över.
 */
const FADE_FROM = 4;
const FADE_TO = 16;
/** Grundstyrka för en nivå som har finare nivåer emellan sig blir starkare. */
const BASE = 0.5;
/** Fler nivåer än så ritas inte (de grövsta får några få linjer). */
const MAX_LEVELS = 6;

export function buildGrid(cam: Camera): GridPaths {
  const v = cam.visible();
  const span = Math.max(v.maxX - v.minX, v.maxY - v.minY);
  const steps: number[] = [];
  for (let s = pickStep(FADE_FROM / cam.scale); steps.length < MAX_LEVELS && s <= span * 2; s = nextStep(s)) steps.push(s);
  if (!steps.length) steps.push(pickStep(FADE_FROM / cam.scale));

  const levels: GridLevel[] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const coarser = steps[i + 1];
    const px = step * cam.scale;
    const opacity = strength(px);
    if (opacity <= 0.01) continue;
    const d: string[] = [];
    const x0 = Math.ceil(v.minX / step) * step;
    for (let x = x0; x <= v.maxX; x += step) {
      if (coarser && isMultiple(x, coarser)) continue;
      d.push(`M${crisp(cam.toScreen([x, 0])[0])} 0V${cam.height}`);
    }
    const y0 = Math.ceil(v.minY / step) * step;
    for (let y = y0; y <= v.maxY; y += step) {
      if (coarser && isMultiple(y, coarser)) continue;
      d.push(`M0 ${crisp(cam.toScreen([0, y])[1])}H${cam.width}`);
    }
    levels.push({ step, d: d.join(''), opacity: round(opacity) });
  }

  const o = cam.toScreen([0, 0]);
  const axes = `M${crisp(o[0])} 0V${cam.height}M0 ${crisp(o[1])}H${cam.width}`;
  return { levels, axes, minorStep: minorStepFor(cam.scale) };
}

/**
 * Hur stark en nivå är vid ett visst avstånd i pixlar: den tonas in mellan
 * FADE_FROM och FADE_TO, och blir starkare när det ryms finare linjer emellan.
 */
export function strength(px: number): number {
  const shown = smoothstep(FADE_FROM, FADE_TO, px);
  const emphasis = smoothstep(FADE_FROM, FADE_TO, px / 4);
  return shown * (BASE + (1 - BASE) * emphasis);
}

/**
 * Rutnätets finaste läsbara steg i mm vid en viss zoom (pixlar per mm): den
 * finaste nivån som är minst halvvägs inne (det statusraden visar).
 */
export function minorStepFor(scale: number): number {
  return pickStep((FADE_FROM + FADE_TO) / 2 / scale);
}

/** Minsta steg ur serien 1·10^k, 5·10^k som är minst `min` mm. */
function pickStep(min: number): number {
  let k = Math.pow(10, Math.floor(Math.log10(Math.max(min, 1e-6))));
  for (;;) {
    if (k >= min) return k;
    if (k * 5 >= min) return k * 5;
    k *= 10;
  }
}

/** Nästa steg i serien: 1 → 5 → 10 → 50 … */
function nextStep(s: number): number {
  return leadingDigit(s) === 1 ? s * 5 : s * 2;
}

function leadingDigit(n: number): number {
  return Math.round(n / Math.pow(10, Math.floor(Math.log10(n) + 1e-9)));
}

function isMultiple(v: number, step: number): boolean {
  const r = Math.abs(v / step - Math.round(v / step));
  return r < 1e-6;
}

/** Halvpixel-justering så att 1 px breda linjer blir skarpa. */
function crisp(v: number): number {
  return Math.round(v) + 0.5;
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
