import type { Camera } from './camera';

export interface GridPaths {
  /** Tunna linjer. */
  minor: string;
  /** Kraftigare linjer. */
  major: string;
  /** Origo-axlarna. */
  axes: string;
  /** Hur synliga de tunna linjerna ska vara (0–1), så att de tonas in vid zoom. */
  minorOpacity: number;
  minorStep: number;
  majorStep: number;
}

/** Minsta avstånd i pixlar mellan två rutnätslinjer innan de glesas ut. */
const MIN_SPACING_PX = 8;

/**
 * Rutnät som anpassar sig efter zoomen. Stegen följer serien
 * 1 · 5 · 10 · 50 · 100 · 500 · 1000 mm …, och de kraftiga linjerna ligger
 * på närmaste jämna tiopotens (100 mm, 1 m, 10 m …).
 */
export function buildGrid(cam: Camera): GridPaths {
  const minorStep = minorStepFor(cam.scale);
  const majorStep = leadingDigit(minorStep) === 1 ? minorStep * 10 : minorStep * 2;
  const spacing = minorStep * cam.scale;
  const minorOpacity = smoothstep(MIN_SPACING_PX, MIN_SPACING_PX * 3, spacing);

  const v = cam.visible();
  const minor: string[] = [];
  const major: string[] = [];

  const x0 = Math.floor(v.minX / minorStep) * minorStep;
  for (let x = x0; x <= v.maxX; x += minorStep) {
    const sx = crisp(cam.toScreen([x, 0])[0]);
    const seg = `M${sx} 0V${cam.height}`;
    if (isMultiple(x, majorStep)) major.push(seg);
    else minor.push(seg);
  }
  const y0 = Math.floor(v.minY / minorStep) * minorStep;
  for (let y = y0; y <= v.maxY; y += minorStep) {
    const sy = crisp(cam.toScreen([0, y])[1]);
    const seg = `M0 ${sy}H${cam.width}`;
    if (isMultiple(y, majorStep)) major.push(seg);
    else minor.push(seg);
  }

  const o = cam.toScreen([0, 0]);
  const axes = `M${crisp(o[0])} 0V${cam.height}M0 ${crisp(o[1])}H${cam.width}`;

  return { minor: minor.join(''), major: major.join(''), axes, minorOpacity, minorStep, majorStep };
}

/** Rutnätets minsta steg i mm vid en viss zoom (pixlar per mm). */
export function minorStepFor(scale: number): number {
  return pickStep(MIN_SPACING_PX / scale);
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

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
