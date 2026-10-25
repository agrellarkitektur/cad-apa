/**
 * DXF-läsarens grund (0.8.32, ur dxf.ts): filen som par av kod och värde,
 * entiteterna med sina värden, och bågar, bultar och splines som punkter.
 */

export type P2 = [number, number];

export type Pair = [number, string];

export function pairs(text: string): Pair[] {
  const lines = text.split(/\r\n|\r|\n/);
  const out: Pair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i].trim());
    if (!Number.isFinite(code)) continue;
    out.push([code, lines[i + 1]]);
  }
  return out;
}

export interface RawEntity {
  type: string;
  codes: Pair[];
  /** POLYLINE: hörnen (VERTEX). */
  vertices?: RawEntity[];
}

/** Dela en följd av par i entiteter (ny vid varje kod 0). */
export function entities(ps: Pair[], from: number, to: number): RawEntity[] {
  const out: RawEntity[] = [];
  let cur: RawEntity | null = null;
  let poly: RawEntity | null = null;
  for (let i = from; i < to; i++) {
    const [c, v] = ps[i];
    if (c === 0) {
      const type = v.trim();
      if (poly) {
        if (type === 'VERTEX') {
          cur = { type, codes: [] };
          poly.vertices!.push(cur);
          continue;
        }
        if (type === 'SEQEND') {
          poly = null;
          cur = null;
          continue;
        }
        poly = null;
      }
      cur = { type, codes: [] };
      out.push(cur);
      if (type === 'POLYLINE') {
        cur.vertices = [];
        poly = cur;
      }
      continue;
    }
    cur?.codes.push([c, v]);
  }
  return out;
}

export const num = (e: RawEntity, code: number, dflt = 0): number => {
  const p = e.codes.find((x) => x[0] === code);
  const n = p ? Number(p[1]) : NaN;
  return Number.isFinite(n) ? n : dflt;
};
export const str = (e: RawEntity, code: number, dflt = ''): string => e.codes.find((x) => x[0] === code)?.[1].trim() ?? dflt;
export const all = (e: RawEntity, code: number): number[] => e.codes.filter((x) => x[0] === code).map((x) => Number(x[1]));

/** Bågen från vinkel a0 till a1 (grader, moturs) som punkter. */
export function arcPts(cx: number, cy: number, r: number, a0: number, a1: number): P2[] {
  let sweep = a1 - a0;
  while (sweep <= 0) sweep += 360;
  const n = Math.max(2, Math.min(96, Math.ceil(sweep / 7.5)));
  return Array.from({ length: n + 1 }, (_, i): P2 => {
    const t = ((a0 + (sweep * i) / n) * Math.PI) / 180;
    return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
  });
}

/** Bulten mellan två hörn i en polylinje som punkter (utan startpunkten). */
export function bulgePts(a: P2, b: P2, bulge: number): P2[] {
  if (Math.abs(bulge) < 1e-9) return [b];
  const theta = 4 * Math.atan(bulge);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-12) return [b];
  const r = chord / (2 * Math.sin(theta / 2));
  // Mittpunkten ligger vinkelrätt från kordans mitt.
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const h = r * Math.cos(theta / 2);
  const cx = mx - (dy / chord) * h;
  const cy = my + (dx / chord) * h;
  const a0 = Math.atan2(a[1] - cy, a[0] - cx);
  const n = Math.max(2, Math.min(64, Math.ceil(Math.abs(theta) / (Math.PI / 24))));
  const out: P2[] = [];
  for (let i = 1; i <= n; i++) {
    const t = a0 + (theta * i) / n;
    out.push([cx + Math.abs(r) * Math.cos(t), cy + Math.abs(r) * Math.sin(t)]);
  }
  out[out.length - 1] = b;
  return out;
}

/** En B-spline med knutvektor, som punkter (de Boor). */
export function bspline(ctrl: P2[], degree: number, knots: number[]): P2[] {
  const n = ctrl.length;
  const p = Math.max(1, Math.min(degree, n - 1));
  if (knots.length !== n + p + 1) {
    // Saknas knutvektorn: en jämn, fastklämd.
    knots = [];
    for (let i = 0; i <= n + p; i++) knots.push(i <= p ? 0 : i >= n ? n - p : i - p);
  }
  const t0 = knots[p];
  const t1 = knots[n];
  const steps = Math.max(8, Math.min(400, n * 10));
  const out: P2[] = [];
  for (let s = 0; s <= steps; s++) {
    const t = s === steps ? t1 - 1e-9 * (t1 - t0) : t0 + ((t1 - t0) * s) / steps;
    let k = p;
    while (k < n - 1 && t >= knots[k + 1]) k++;
    const d = Array.from({ length: p + 1 }, (_, j): P2 => [...ctrl[k - p + j]] as P2);
    for (let r = 1; r <= p; r++) {
      for (let j = p; j >= r; j--) {
        const i = k - p + j;
        const den = knots[i + p - r + 1] - knots[i];
        const a = den === 0 ? 0 : (t - knots[i]) / den;
        d[j] = [(1 - a) * d[j - 1][0] + a * d[j][0], (1 - a) * d[j - 1][1] + a * d[j][1]];
      }
    }
    out.push(d[p]);
  }
  return out;
}
