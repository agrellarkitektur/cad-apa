import { dist } from '../geometry/vec';
import type { PanelPiece } from './railingBody';

/** En ribba i en yta med mönster: sträckan längs ytan (från `a`) och under- och överkantens höjd i ändarna. */
export interface PatternBar {
  s0: number;
  s1: number;
  bottom: [number, number];
  top: [number, number];
}

/**
 * En yta med mönster (0.11.7.3): ribbor i stället för en slät skiva, i
 * ytans eget plan. Höjderna räknas från ytans underkant (s längs ytan, h
 * uppåt), så att mönstret följer lutningen i en trappa eller på en
 * sluttning. Ribborna klipps mot ytans kanter; ändarna är raka.
 */
export function patternBars(p: PanelPiece): PatternBar[] {
  const pat = p.part.pattern;
  const L = dist(p.a, p.b);
  if (!pat || L < 1) return [];
  const c = Math.max(5, pat.spacing ?? 100);
  const w = Math.min(c * 0.9, Math.max(1, pat.width ?? 20));
  const base = (s: number) => p.a0 + ((p.b0 - p.a0) * s) / L;
  // Ytans höjd i s: linjär mellan ändarna.
  const H0 = p.a1 - p.a0;
  const H1 = p.b1 - p.b0;
  const Hs = (s: number) => H0 + ((H1 - H0) * s) / L;
  const out: PatternBar[] = [];
  const bar = (s0: number, s1: number, h0: number, h1: number, wv: number) => {
    if (s1 - s0 >= 0.5) out.push({ s0, s1, bottom: [base(s0) + h0, base(s1) + h1], top: [base(s0) + h0 + wv, base(s1) + h1 + wv] });
  };
  if (pat.kind === 'grid') {
    // Lodräta ribbor från underkanten till överkanten, jämnt i ytan.
    const nS = Math.floor((L - w) / c);
    const s0 = (L - nS * c) / 2;
    for (let k = 0; k <= nS; k++) {
      const s = s0 + k * c;
      out.push({ s0: s - w / 2, s1: s + w / 2, bottom: [base(s - w / 2), base(s + w / 2)], top: [base(s - w / 2) + Hs(s - w / 2), base(s + w / 2) + Hs(s + w / 2)] });
    }
    const Hmin = Math.min(H0, H1);
    const nH = Math.floor((Hmin - w) / c);
    const h0 = (Hmin - nH * c) / 2;
    for (let k = 0; k <= nH; k++) bar(0, L, h0 + k * c - w / 2, h0 + k * c - w / 2, w);
    return out;
  }
  // Diagonalt: linjerna h = ±(s − s0), c/c vinkelrätt; i s blir delningen c·√2 och ribbans höjd w·√2.
  const cs = c * Math.SQRT2;
  const wv = w * Math.SQRT2;
  const Hmax = Math.max(H0, H1);
  const k = (H1 - H0) / L;
  for (const sg of [1, -1]) {
    for (let s0 = -Hmax - cs + (L % cs) / 2; s0 <= L + Hmax + cs; s0 += cs) {
      // h(s) = sg·(s − s0) med 0 ≤ h, h + wv ≤ H(s) och 0 ≤ s ≤ L: ett intervall i s.
      let lo = 0;
      let hi = L;
      const need = (a: number, b: number) => {
        // a·s + b ≥ 0
        if (Math.abs(a) < 1e-9) {
          if (b < 0) hi = -1;
          return;
        }
        if (a > 0) lo = Math.max(lo, -b / a);
        else hi = Math.min(hi, -b / a);
      };
      need(sg, -sg * s0);
      need(k - sg, H0 - wv + sg * s0);
      if (hi - lo >= 1) bar(lo, hi, sg * (lo - s0), sg * (hi - s0), wv);
    }
  }
  return out;
}
