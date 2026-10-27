import { groundAt, terrainOf } from '../core/site';
import { union, type Rings } from '../geometry/boolean';
import type { Primitive, Vec2 } from '../repr/primitives';
import { sameItems } from '../repr/reuse';
import { finishedTerrain, type GroundGeometry } from './groundGeometry';
import type { PlanContext } from './registry';

/**
 * Slänterna i planen (0.10.8, 0.10.14): släntstrecken och slänternas yta
 * för markobjekten, och kanternas normaler. Utbrutet ur groundPlan.ts i
 * granskningen efter 0.10.18.
 */

/** Ytan som ringen omsluter, positiv moturs. */
export function signedArea(ring: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** Normalen ut från ringen längs kanten `a`–`b`, eller null för en kant utan längd. */
export function outward(ring: readonly Vec2[], a: Vec2, b: Vec2): Vec2 | null {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (l < 1) return null;
  const sgn = signedArea(ring) >= 0 ? 1 : -1;
  return [(sgn * (b[1] - a[1])) / l, (-sgn * (b[0] - a[0])) / l];
}

/** Hur tätt släntstrecken ligger, mm på papperet. */
const MARK_SPACING = 2.5;

/**
 * Släntmarkeringar (0.10.8): där markobjektet möter marken med slänt,
 * streck vinkelrätt mot kanten från släntens krön ned mot foten, långa och
 * korta om vartannat. Slänten känns ut från kanten i den färdiga marken: den
 * går så länge den färdiga skiljer sig från den befintliga och lutar som en
 * slänt. Schakt har krönet ute vid marken, fyll vid kanten.
 */
export function slopeMarks(ctx: PlanContext, g: GroundGeometry, origin: Primitive['origin']): Primitive[] {
  const reach = slopeReach(ctx, g);
  if (!reach) return [];
  const minLen = 0.8 * ctx.scale;
  const pen = { weight: 0.13 };
  const out: Primitive[] = [];
  let k = 0;
  walkSlope(g, MARK_SPACING * ctx.scale, false, (q, n) => {
    k++;
    const r = reach(q, n);
    if (!r || r.d < minLen) return;
    const end: Vec2 = [q[0] + n[0] * r.d, q[1] + n[1] * r.d];
    // Krönet: ute vid marken i schakt, vid kanten i fyll.
    const [from, to] = r.cut ? [end, q] : [q, end];
    const part = k % 2 === 1 ? 1 : 0.4;
    out.push({ kind: 'line', a: from, b: [from[0] + (to[0] - from[0]) * part, from[1] + (to[1] - from[1]) * part], pen, origin });
  });
  return out;
}

/**
 * Hur långt slänten går ut från kanten i `q` längs normalen `n`, och om den
 * är schakt; null där ingen slänt börjar. Null för ett objekt utan slänt.
 */
function slopeReach(ctx: PlanContext, g: GroundGeometry): ((q: Vec2, n: Vec2) => { d: number; cut: boolean } | null) | null {
  const sh = g.shape;
  if (!sh || sh.slope === null || sh.blend) return null;
  const f = finishedTerrain(ctx);
  const t = terrainOf(ctx.doc);
  if (!f || !t) return null;
  const step = Math.max(100, (t.grid.s * 1000) / 3);
  const steep = 0.5 / sh.slope;
  const diff = (x: number, y: number): number | null => {
    const a = groundAt(f.terrain, x, y);
    const b = groundAt(t, x, y);
    return a === null || b === null ? null : a - b;
  };
  return (q, n) => {
    const d0 = diff(q[0] + n[0] * 60, q[1] + n[1] * 60);
    if (d0 === null || Math.abs(d0) < 30) return null;
    // Gå ut längs normalen så länge marken är ändrad och lutar som en slänt.
    let d = 60;
    let prev = groundAt(f.terrain, q[0] + n[0] * d, q[1] + n[1] * d)!;
    while (d < MARK_REACH) {
      const x = q[0] + n[0] * (d + step);
      const y = q[1] + n[1] * (d + step);
      const z = groundAt(f.terrain, x, y);
      const dz = diff(x, y);
      if (z === null || dz === null || Math.abs(dz) < 15 || Math.abs(z - prev) / step < steep) break;
      prev = z;
      d += step;
    }
    return { d, cut: d0 < 0 };
  };
}

/**
 * Går runt konturens kanter med avståndet `spacing` och anropar `at` med
 * punkten på kanten och normalen ut; i utåtgående hörn i en solfjäder.
 * Med `ends` också i kanternas ändar (för slänternas yta, som ska vara hel).
 */
function walkSlope(g: GroundGeometry, spacing: number, ends: boolean, at: (q: Vec2, n: Vec2, ring: number) => void): void {
  for (let r = 0; r < g.rings.length; r++) {
    const ring = g.rings[r][0];
    const ccw = signedArea(ring) >= 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const n = outward(ring, a, b);
      // Rampens sidor som är stödmur (0.10.18) har ingen slänt.
      if (!n || (r === 0 && g.edgeWall?.[i])) continue;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (ends) at(a, n, r);
      for (let s = spacing / 2; s < len; s += spacing) at([a[0] + ((b[0] - a[0]) * s) / len, a[1] + ((b[1] - a[1]) * s) / len], n, r);
      if (ends) at(b, n, r);
      // Ett utåtgående hörn: strecken i en solfjäder mellan kanternas normaler.
      const c = ring[(i + 2) % ring.length];
      const n2 = outward(ring, b, c);
      if (!n2 || (r === 0 && g.edgeWall?.[(i + 1) % ring.length])) continue;
      const turn = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (ccw ? turn <= 0 : turn >= 0) continue;
      const a1 = Math.atan2(n[1], n[0]);
      let da = Math.atan2(n2[1], n2[0]) - a1;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      // Lika tätt som längs kanten 1,5 m ut från hörnet.
      const m = Math.floor((Math.abs(da) * FAN_RADIUS) / spacing);
      for (let j = 1; j <= m; j++) {
        const ang = a1 + (da * j) / (m + 1);
        at(b, [Math.cos(ang), Math.sin(ang)], r);
      }
    }
  }
}

const savedSlopeArea = new WeakMap<GroundGeometry, { inputs: unknown[]; out: Rings[] }>();

/**
 * Slänternas yta (0.10.14): det släntmarkeringarna täcker, som polygoner.
 * Kanten känns av tätare än strecken (halva avståndet, och kanternas
 * ändar), och fyrhörningarna mellan två grannar slås ihop. Sparas tills
 * formen, den färdiga marken eller skalan ändras.
 */
export function slopeArea(ctx: PlanContext, g: GroundGeometry): Rings[] {
  const f = finishedTerrain(ctx);
  const inputs = [f, terrainOf(ctx.doc)?.z, ctx.scale];
  const hit = savedSlopeArea.get(g);
  if (hit && sameItems(hit.inputs, inputs)) return hit.out;
  const reach = slopeReach(ctx, g);
  const out: Rings[] = [];
  if (reach) {
    // Strålarna per kontur; grannarna går inte över till nästa kontur.
    const rays: { q: Vec2; e: Vec2 | null }[][] = g.rings.map(() => []);
    walkSlope(g, (MARK_SPACING * ctx.scale) / 2, true, (q, n, ring) => {
      const r = reach(q, n);
      rays[ring].push({ q, e: r ? [q[0] + n[0] * r.d, q[1] + n[1] * r.d] : null });
    });
    for (const list of rays)
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        const b = list[(i + 1) % list.length];
        if (!a.e && !b.e) continue;
        const quad = [a.q, a.e ?? a.q, b.e ?? b.q, b.q];
        if (Math.abs(signedArea(quad)) > 1) out.push([quad]);
      }
  }
  const merged = out.length ? union(out) : [];
  savedSlopeArea.set(g, { inputs, out: merged });
  return merged;
}

/** Där solfjäderns streck i ett hörn ligger lika tätt som längs kanten, mm. */
const FAN_RADIUS = 1500;

/** Hur långt ut en slänt högst känns, mm. */
const MARK_REACH = 40_000;
