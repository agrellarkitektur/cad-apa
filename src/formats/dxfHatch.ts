/**
 * Skraffering i DXF (HATCH, 0.8.3; egen fil 0.8.32): konturerna av linjer,
 * bågar, ellipser och splines, och mönstrets linjefamiljer.
 */

import { arcPts, bspline, bulgePts, num, type P2, type RawEntity } from './dxfCodes';

/**
 * En skraffering (HATCH): konturerna och mönstret, i entitetens egna
 * koordinater. Koderna läses i ordning, eftersom samma koder (10, 20, 40 …)
 * återkommer i varje kontur och kant.
 */
export function readHatch(e: RawEntity): { rings: P2[][]; solid: boolean; lines: { dir: P2; base: P2; off: P2; dash: number[] }[] } | null {
  const c = e.codes;
  let i = c.findIndex((x) => x[0] === 91);
  if (i < 0) return null;
  const opt = (code: number): number | undefined => {
    if (c[i]?.[0] !== code) return undefined;
    const v = Number(c[i++][1]);
    return Number.isFinite(v) ? v : 0;
  };
  const need = (code: number): number => opt(code) ?? 0;
  const point = (cx: number, cy: number): P2 => [need(cx), need(cy)];

  const rings: P2[][] = [];
  const paths = need(91);
  for (let k = 0; k < paths && i < c.length; k++) {
    const flags = need(92);
    if (flags & 2) {
      // Polylinje med bultar.
      const hasBulge = need(72);
      const closed = need(73);
      const n = need(93);
      const verts: P2[] = [];
      const bulges: number[] = [];
      for (let v = 0; v < n && i < c.length; v++) {
        verts.push(point(10, 20));
        bulges.push(hasBulge || c[i]?.[0] === 42 ? (opt(42) ?? 0) : 0);
      }
      const pts: P2[] = verts.length ? [verts[0]] : [];
      for (let v = 0; v < verts.length - (closed || verts.length > 2 ? 0 : 1); v++) pts.push(...bulgePts(verts[v], verts[(v + 1) % verts.length], bulges[v]));
      if (pts.length > 1 && Math.hypot(pts[0][0] - pts.at(-1)![0], pts[0][1] - pts.at(-1)![1]) < 1e-9) pts.pop();
      if (pts.length >= 3) rings.push(pts);
    } else {
      // Kanter: varje kant kan ha flera tolkningar (bågarnas riktning), och
      // den som hänger ihop med grannarna väljs när konturen sätts ihop.
      const edges: P2[][][] = [];
      const n = need(93);
      for (let k2 = 0; k2 < n && i < c.length; k2++) {
        const type = need(72);
        if (type === 1) {
          edges.push([[point(10, 20), point(11, 21)]]);
        } else if (type === 2) {
          const [cx, cy] = point(10, 20);
          const r = need(40);
          const s0 = need(50);
          const s1 = need(51);
          const ccw = need(73);
          const forward = arcPts(cx, cy, r, s0, s1);
          // Medurs bågar sparas speglade (360 − vinkeln); pröva båda läsningarna.
          const mirrored = arcPts(cx, cy, r, 360 - s1, 360 - s0).reverse();
          const asIs = arcPts(cx, cy, r, s1, s0).reverse();
          edges.push(ccw ? [forward, mirrored] : [mirrored, asIs, forward]);
        } else if (type === 3) {
          const [cx, cy] = point(10, 20);
          const maj = point(11, 21);
          const ratio = need(40) || 1;
          const s0 = need(50);
          const s1 = need(51);
          const ccw = need(73);
          const min: P2 = [-maj[1] * ratio, maj[0] * ratio];
          const at = (deg: number): P2 => {
            const t = (deg * Math.PI) / 180;
            return [cx + maj[0] * Math.cos(t) + min[0] * Math.sin(t), cy + maj[1] * Math.cos(t) + min[1] * Math.sin(t)];
          };
          const sweep = (a0: number, a1: number): P2[] => {
            let d = a1 - a0;
            while (d <= 0) d += 360;
            const m = Math.max(4, Math.min(120, Math.ceil(d / 5)));
            return Array.from({ length: m + 1 }, (_, j) => at(a0 + (d * j) / m));
          };
          const forward = sweep(s0, s1);
          const mirrored = sweep(360 - s1, 360 - s0).reverse();
          edges.push(ccw ? [forward, mirrored] : [mirrored, forward]);
        } else if (type === 4) {
          const degree = need(94);
          const rational = need(73);
          need(74);
          const nk = need(95);
          const nc = need(96);
          const knots: number[] = [];
          for (let j = 0; j < nk; j++) knots.push(need(40));
          const ctrl: P2[] = [];
          for (let j = 0; j < nc; j++) {
            ctrl.push(point(10, 20));
            if (rational || c[i]?.[0] === 42) opt(42);
          }
          const fit: P2[] = [];
          const nf = opt(97) ?? 0;
          for (let j = 0; j < nf; j++) fit.push(point(11, 21));
          for (const code of [12, 22, 13, 23]) opt(code);
          const pts = ctrl.length >= 2 ? bspline(ctrl, degree || 3, knots) : fit;
          if (pts.length >= 2) edges.push([pts]);
        } else break;
      }
      const ring = chain(edges);
      if (ring.length >= 3) rings.push(ring);
    }
    // Konturens ursprungsobjekt.
    const src = opt(97) ?? 0;
    for (let j = 0; j < src; j++) opt(330);
  }
  if (!rings.length) return null;

  const solid = num(e, 70) === 1 || e.codes.some((x) => x[0] === 450 && Number(x[1]) === 1);
  const lines: { dir: P2; base: P2; off: P2; dash: number[] }[] = [];
  if (!solid) {
    const at78 = c.findIndex((x, j) => j >= i && x[0] === 78);
    if (at78 >= 0) {
      i = at78;
      const n = need(78);
      for (let k = 0; k < n && i < c.length; k++) {
        const angle = (need(53) * Math.PI) / 180;
        const base = point(43, 44);
        const off = point(45, 46);
        const dashes = need(79);
        // Strecken (0.8.36): positiva streck, negativa mellanrum, 0 en punkt, som i .pat.
        const dash: number[] = [];
        for (let j = 0; j < dashes; j++) dash.push(opt(49) ?? 0);
        lines.push({ dir: [Math.cos(angle), Math.sin(angle)], base, off, dash });
      }
    }
  }
  return { rings, solid, lines };
}

/**
 * Kanterna i en kontur till en sluten slinga: varje kant tas i den tolkning
 * och riktning som börjar närmast där den förra slutade.
 */
function chain(edges: P2[][][]): P2[] {
  if (!edges.length) return [];
  const d = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  // Den första kanten: den tolkning vars ände ligger närmast nästa kant (eller den sista).
  const next = edges[1] ?? edges[0];
  const ends = next.flatMap((p) => [p[0], p.at(-1)!]);
  let first = edges[0][0];
  let best = Infinity;
  for (const cand of edges[0])
    for (const pts of [cand, [...cand].reverse()]) {
      const gap = Math.min(...ends.map((q) => d(pts.at(-1)!, q)));
      if (gap < best - 1e-9) {
        best = gap;
        first = pts;
      }
    }
  const ring: P2[] = [...first];
  for (const cands of edges.slice(1)) {
    const end = ring.at(-1)!;
    let pick = cands[0];
    let gap = Infinity;
    for (const cand of cands)
      for (const pts of [cand, [...cand].reverse()]) {
        const g = d(pts[0], end);
        if (g < gap - 1e-9) {
          gap = g;
          pick = pts;
        }
      }
    ring.push(...(d(pick[0], end) < 1e-9 ? pick.slice(1) : pick));
  }
  if (ring.length > 1 && d(ring[0], ring.at(-1)!) < 1e-9) ring.pop();
  return ring;
}
