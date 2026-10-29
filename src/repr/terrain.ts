import type { ProjectDoc } from '../core/model';
import { fromRh, groundAt, levelText as siteLevelText, meanGroundLevel, terrainOf, type Terrain } from '../core/site';
import { buildingFootprint } from '../elements/footprint';
import type { PlanContext } from '../elements/registry';
import type { ViewStates } from '../core/states';
import { createContext } from './context';
import { finishedTerrain, showsProposal, type Finished } from '../elements/ground';
import { resolveFill } from '../core/fillTypes';
import type { Primitive, Vec2 } from './primitives';
import { lastResults } from './reuse';
import { crispHeight, crispMesh, crispShapes } from './crispGround';

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
  /** Höjden i en punkt (0.10.26: med de skarpa kanterna); förval rutnätets. */
  height: (p: Vec2) => number | null = (p) => groundAt(t, p[0], p[1]),
  /** Fler punkter längs linjen (u), t.ex. på var sida om en stödmurskant. */
  extra: readonly number[] = [],
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
  const us: number[] = [];
  for (let i = 0; i <= n; i++) us.push(u0 + ((u1 - u0) * i) / n);
  if (extra.length) {
    us.push(...extra.filter((u) => u > u0 && u < u1));
    us.sort((a, b) => a - b);
  }
  for (const u of us) {
    const d = edges.length ? depthAt(u) : 0;
    const z = height([O[0] + r[0] * u + v[0] * d, O[1] + r[1] * u + v[1] * d]);
    if (z === null) {
      if (cur.length >= 2) parts.push(cur);
      cur = [];
    } else cur.push([u, z]);
  }
  if (cur.length >= 2) parts.push(cur);
  return parts;
}

/** Var linjen (u längs `frame`) korsar ringens kanter. */
function crossings(ring: readonly Vec2[], frame: { start: Vec2; right: Vec2; view: Vec2 }): number[] {
  const O = frame.start;
  const out: number[] = [];
  const q = ring.map((p): Vec2 => [(p[0] - O[0]) * frame.right[0] + (p[1] - O[1]) * frame.right[1], (p[0] - O[0]) * frame.view[0] + (p[1] - O[1]) * frame.view[1]]);
  for (let i = 0; i < q.length; i++) {
    const a = q[i];
    const b = q[(i + 1) % q.length];
    if ((a[1] > 0) === (b[1] > 0) || a[1] === b[1]) continue;
    out.push(a[0] + ((b[0] - a[0]) * a[1]) / (a[1] - b[1]));
  }
  return out;
}

/** Jordskrafferingens djup under marklinjen, mm. */
const EARTH_DEPTH = 600;

/**
 * Marklinjerna i en fasad eller sektion (0.10.4). Marken som den blir är
 * tjock och heldragen: i ett förslag den färdiga (den befintliga där inga
 * markobjekt finns), i Befintligt den befintliga (0.10.8). Den befintliga
 * ritas tunn och streckad bara där markobjekten ändrat den. Under den
 * tjocka linjen i sektioner jord, skrafferad eller vit, om det valts under
 * *Platsen* (vit sedan 0.10.8: bara snittlinjen syns).
 */
export function groundLines(
  ctx: PlanContext,
  t: Terrain,
  frame: { start: Vec2; right: Vec2; view: Vec2 },
  u0: number,
  u1: number,
  footprint: readonly (readonly Vec2[])[] | null,
  isSection: boolean,
): Primitive[] {
  const out: Primitive[] = [];
  const existing = terrainProfile(t, frame, u0, u1, footprint);
  const dashed = (pts: Vec2[]): Primitive => ({ kind: 'polyline', points: pts, closed: false, pen: { weight: 0.18, dash: [3, 1.5] }, origin: { part: 'befintlig mark' } });
  const f = showsProposal(ctx) ? finishedTerrain(ctx) : null;
  // Med rampernas och markytornas skarpa kanter (0.10.26), och i sektionen en punkt på var sida om varje kant.
  let finished = existing;
  if (f) {
    const crisps = crispShapes(ctx, f);
    const extra = footprint ? [] : crisps.flatMap((c) => crossings(c.ring, frame).flatMap((u) => [u - 2, u + 2]));
    finished = terrainProfile(f.terrain, frame, u0, u1, footprint, 250, crispHeight(crisps, f.terrain), extra);
  }
  const site = ctx.doc.site;
  if (isSection && (site?.earthHatch || site?.earthWhite)) {
    const fill = site.earthHatch ? resolveFill({ kind: 'type', type: 'mark', color: 'ink', weight: 0.13 }, ctx.style, ctx.scale) : { kind: 'solid' as const, color: 'paper' as const };
    for (const pts of finished) {
      const ring: Vec2[] = [...pts, ...pts.map((q): Vec2 => [q[0], q[1] - EARTH_DEPTH]).reverse()];
      out.push({ kind: 'region', role: 'cut', rings: [ring], fill, outline: null, noOutline: true, ownFill: true, origin: { part: 'jord' } });
    }
  }
  const part = showsProposal(ctx) ? 'färdig mark' : 'befintlig mark';
  for (const pts of finished) out.push({ kind: 'polyline', points: pts, closed: false, pen: { weight: 0.5 }, origin: { part } });
  if (f) for (const pts of differing(existing, finished)) out.push(dashed(pts));
  return out;
}

/** Bitarna av den befintliga linjen som skiljer sig från den färdiga (mer än 10 mm), med punkterna på var sida. */
function differing(existing: Vec2[][], finished: Vec2[][]): Vec2[][] {
  const at = new Map<number, number>();
  for (const part of finished) for (const q of part) at.set(Math.round(q[0]), q[1]);
  const out: Vec2[][] = [];
  for (const part of existing) {
    const diff = part.map((q) => {
      const g = at.get(Math.round(q[0]));
      return g === undefined || Math.abs(g - q[1]) > 10;
    });
    let run: Vec2[] = [];
    for (let i = 0; i < part.length; i++) {
      if (diff[i] || diff[i - 1] || diff[i + 1]) run.push(part[i]);
      else if (run.length) {
        if (run.length >= 2) out.push(run);
        run = [];
      }
    }
    if (run.length >= 2) out.push(run);
  }
  return out;
}

/**
 * Medelmarknivån längs husets kontur (mm från ±0), eller null utan markmodell
 * eller hus. I ett förslag mot den färdiga marken (0.10.4), om inte projektet
 * valt den befintliga (`existing` tvingar den befintliga).
 */
export function meanGround(ctx: PlanContext, existing = false): number | null {
  const t = terrainOf(ctx.doc);
  if (!t) return null;
  const rings = buildingFootprint(ctx).map((poly) => poly[0]);
  if (!rings.length) return null;
  const f = !existing && !ctx.doc.site?.meanOnExisting && showsProposal(ctx) ? finishedTerrain(ctx) : null;
  return meanGroundLevel(f ? f.terrain : t, rings);
}

/** En höjd (mm från ±0) som nivåmarkör: RH 2000 när projektet har en plats, annars från ±0. */
export function levelText(doc: Pick<ProjectDoc, 'site'>, zMm: number): string {
  return siteLevelText(doc.site, zMm);
}

/**
 * Terrängen som triangelnät för 3D-vyn, i modellens mm med z från ±0. Glesas
 * ut till högst `maxNodes` noder. Med `heights` (den färdiga marken, samma
 * rutnät och samma noder utan höjd) byts bara höjderna: punkternas läge och
 * trianglarna sparas per rutnät och plats (0.10.6), så att ett ändrat
 * markobjekt inte bygger om hela nätet.
 */
export function terrainMesh(doc: ProjectDoc, maxNodes = 250_000, heights?: Float32Array): { positions: Float32Array; indices: Uint32Array } | null {
  const t = terrainOf(doc);
  if (!t) return null;
  const { W, H, x0, y1, s } = t.grid;
  const k = Math.max(1, Math.ceil(Math.sqrt((W * H) / maxNodes)));
  const w = Math.floor((W - 1) / k) + 1;
  const site = t.site;
  const grid = savedGrids([t.z, W, H, x0, y1, s, k, site.origin[0], site.origin[1], site.rotation], () => meshGrid(t, k));
  const positions = grid.positions.slice();
  const z = heights ?? t.z;
  for (let n = 0; n < grid.valid.length; n++) {
    const zz = z[Math.floor(n / w) * k * W + (n % w) * k];
    positions[n * 3 + 2] = zz === zz ? fromRh(site, zz) : 0;
  }
  return { positions, indices: grid.indices };
}
const savedGrids = lastResults<{ positions: Float32Array; valid: Uint8Array; indices: Uint32Array }>(2);

/** Nätets punkter i planen (z = 0), vilka som har en höjd och trianglarna. */
function meshGrid(t: Terrain, k: number): { positions: Float32Array; valid: Uint8Array; indices: Uint32Array } {
  const { W, H, x0, y1, s } = t.grid;
  const w = Math.floor((W - 1) / k) + 1;
  const h = Math.floor((H - 1) / k) + 1;
  const site = t.site;
  const rot = (site.rotation * Math.PI) / 180;
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  const positions = new Float32Array(w * h * 3);
  const valid = new Uint8Array(w * h);
  let triangles = 0;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const zz = t.z[j * k * W + i * k];
      const a = x0 + i * k * s - site.origin[0];
      const b = y1 - j * k * s - site.origin[1];
      const n = j * w + i;
      positions[n * 3] = (a * c + b * sn) * 1000;
      positions[n * 3 + 1] = (-a * sn + b * c) * 1000;
      valid[n] = zz === zz ? 1 : 0;
    }
  }
  const idx = new Uint32Array((w - 1) * (h - 1) * 6);
  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const a = j * w + i;
      const b = a + 1;
      const d = a + w;
      const e = d + 1;
      // Moturs sedda ovanifrån (z uppåt): a, d, b och b, d, e, eftersom j ökar söderut.
      if (valid[a] && valid[d] && valid[b]) {
        idx[triangles++] = a;
        idx[triangles++] = d;
        idx[triangles++] = b;
      }
      if (valid[b] && valid[d] && valid[e]) {
        idx[triangles++] = b;
        idx[triangles++] = d;
        idx[triangles++] = e;
      }
    }
  }
  return { positions, valid, indices: idx.slice(0, triangles) };
}

/** Den färdiga marken i en vy av projektet (för 3D-vyn), eller null i Befintligt och utan markobjekt. */
export function finishedForView(doc: ProjectDoc, view: ViewStates): Finished | null {
  const ctx = viewContext(doc, view);
  return ctx && showsProposal(ctx) ? finishedTerrain(ctx) : null;
}

function viewContext(doc: ProjectDoc, view: ViewStates): PlanContext | null {
  const storey = doc.storeys[0]?.id;
  if (!storey || !doc.site) return null;
  return createContext(doc, storey, view, doc.graphics, () => true).ctx;
}

/** Marken i 3D-vyn (0.10.26): nätet med den färdiga marken, skuret skarpt längs markytornas och rampernas kanter. */
export function terrainMesh3d(doc: ProjectDoc, view: ViewStates, finished: Finished | null): { positions: Float32Array; indices: Uint32Array } | null {
  const mesh = terrainMesh(doc, undefined, finished?.z);
  const ctx = finished && viewContext(doc, view);
  return mesh && ctx ? savedCrisp([mesh.positions.length, finished, ...crispShapes(ctx, finished).map((c) => c.ring)], () => crispMesh(mesh, crispShapes(ctx, finished))) : mesh;
}
const savedCrisp = lastResults<{ positions: Float32Array; indices: Uint32Array }>(2);

/** Den färdiga markens höjd i en punkt i vyn (mm från ±0), med de skarpa kanterna (0.10.26); den befintliga i Befintligt. */
export function heightForView(doc: ProjectDoc, view: ViewStates): ((p: Vec2) => number | null) | null {
  const base = terrainOf(doc);
  if (!base) return null;
  const f = finishedForView(doc, view);
  const ctx = f && viewContext(doc, view);
  if (!f || !ctx) return (p) => groundAt(base, p[0], p[1]);
  return crispHeight(crispShapes(ctx, f), f.terrain);
}
