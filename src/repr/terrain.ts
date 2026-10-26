import type { ProjectDoc } from '../core/model';
import { fromRh, groundAt, meanGroundLevel, terrainOf, type Terrain } from '../core/site';
import { buildingFootprint } from '../elements/footprint';
import type { PlanContext } from '../elements/registry';
import type { Vec2 } from './primitives';

/**
 * Den befintliga marken i fasader, sektioner och 3D-vyn (0.10.3). Marken är
 * inga 3D-former: den skymmer inget i fasaderna och ritas som en linje.
 */

/** Marklinjens punkter i vyns koordinater (x längs linjen, y höjd i mm från ±0), bitar där marken finns. */
export function terrainProfile(
  t: Terrain,
  frame: { start: Vec2; right: Vec2; view: Vec2 },
  u0: number,
  u1: number,
  /** I en fasad: marken vid husets kontur närmast betraktaren (annars linjen själv). */
  footprint: readonly (readonly Vec2[])[] | null,
  step = 250,
): Vec2[][] {
  const O = frame.start;
  const r = frame.right;
  const v = frame.view;
  // Konturens kanter i vyns koordinater (u längs linjen, d djupet).
  const edges: [number, number, number, number][] = [];
  let front = 0;
  if (footprint?.length) {
    front = Infinity;
    for (const ring of footprint) {
      const q = ring.map((p): [number, number] => [(p[0] - O[0]) * r[0] + (p[1] - O[1]) * r[1], (p[0] - O[0]) * v[0] + (p[1] - O[1]) * v[1]]);
      for (let k = 0; k < q.length; k++) {
        const a = q[k];
        const b = q[(k + 1) % q.length];
        edges.push([a[0], a[1], b[0], b[1]]);
        front = Math.min(front, a[1]);
      }
    }
    if (!Number.isFinite(front)) front = 0;
  }
  /** Djupet där blicken vid u först träffar konturen, annars konturens framkant. */
  const depthAt = (u: number): number => {
    let best = Infinity;
    for (const [au, ad, bu, bd] of edges) {
      if ((au - u) * (bu - u) > 0 || au === bu) continue;
      const d = ad + ((u - au) / (bu - au)) * (bd - ad);
      if (d < best) best = d;
    }
    return Number.isFinite(best) ? best : front;
  };
  const parts: Vec2[][] = [];
  let cur: Vec2[] = [];
  const n = Math.max(1, Math.ceil((u1 - u0) / step));
  for (let i = 0; i <= n; i++) {
    const u = u0 + ((u1 - u0) * i) / n;
    const d = edges.length ? depthAt(u) : 0;
    const z = groundAt(t, O[0] + r[0] * u + v[0] * d, O[1] + r[1] * u + v[1] * d);
    if (z === null) {
      if (cur.length >= 2) parts.push(cur);
      cur = [];
    } else cur.push([u, z]);
  }
  if (cur.length >= 2) parts.push(cur);
  return parts;
}

/** Medelmarknivån längs husets kontur (mm från ±0), eller null utan markmodell eller hus. */
export function meanGround(ctx: PlanContext): number | null {
  const t = terrainOf(ctx.doc);
  if (!t) return null;
  const rings = buildingFootprint(ctx).map((poly) => poly[0]);
  return rings.length ? meanGroundLevel(t, rings) : null;
}

/** En höjd (mm från ±0) som nivåkot: RH 2000 när projektet har en plats, annars från ±0. */
export function levelText(doc: Pick<ProjectDoc, 'site'>, zMm: number): string {
  const m = doc.site ? doc.site.datum + zMm / 1000 : zMm / 1000;
  const r = Math.round(m * 1000) / 1000;
  return `${r === 0 ? '±' : r > 0 ? '+' : '−'}${Math.abs(r).toLocaleString('sv-SE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
}

/** Terrängen som triangelnät för 3D-vyn, i modellens mm med z från ±0. Glesas ut till högst `maxNodes` noder. */
export function terrainMesh(doc: ProjectDoc, maxNodes = 250_000): { positions: Float32Array; indices: Uint32Array } | null {
  const t = terrainOf(doc);
  if (!t) return null;
  const { W, H, x0, y1, s } = t.grid;
  const k = Math.max(1, Math.ceil(Math.sqrt((W * H) / maxNodes)));
  const w = Math.floor((W - 1) / k) + 1;
  const h = Math.floor((H - 1) / k) + 1;
  const site = t.site;
  const rot = (site.rotation * Math.PI) / 180;
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  const positions = new Float32Array(w * h * 3);
  const valid = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const zz = t.z[j * k * W + i * k];
      const a = x0 + i * k * s - site.origin[0];
      const b = y1 - j * k * s - site.origin[1];
      const n = j * w + i;
      positions[n * 3] = (a * c + b * sn) * 1000;
      positions[n * 3 + 1] = (-a * sn + b * c) * 1000;
      positions[n * 3 + 2] = zz === zz ? fromRh(site, zz) : 0;
      valid[n] = zz === zz ? 1 : 0;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const a = j * w + i;
      const b = a + 1;
      const d = a + w;
      const e = d + 1;
      // Moturs sedda ovanifrån (z uppåt): a, d, b och b, d, e, eftersom j ökar söderut.
      if (valid[a] && valid[d] && valid[b]) idx.push(a, d, b);
      if (valid[b] && valid[d] && valid[e]) idx.push(b, d, e);
    }
  }
  return { positions, indices: Uint32Array.from(idx) };
}
