import { closestOnSegment, dist, distToSegment, pointInRings } from '../geometry/vec';
import type { Pickable } from '../repr/plan';
import type { Bounds, Primitive, Vec2 } from '../repr/primitives';
import { boundsOf, imageCorners } from '../repr/primitives';

/**
 * Vilket element ligger under en punkt? I tur och ordning:
 * 1. en snittyta som punkten ligger i (vägg, öppning),
 * 2. en linje eller båge inom toleransen (dörrblad, möbelkant),
 * 3. en sluten form som punkten ligger i (möbel).
 * Inom varje nivå vinner det som ritas överst.
 */
export function pickAt(pickables: readonly Pickable[], p: Vec2, tol: number): string | null {
  let best: { id: string; score: number } | null = null;
  for (const item of pickables) {
    let d = Infinity;
    for (const prim of item.prims) d = Math.min(d, distToPrim(p, prim));
    // Kanten på en yta räknas som en linje, så att tunna väggar går att träffa.
    for (const rings of item.regions) d = Math.min(d, distToPrim(p, { kind: 'region', rings, role: 'cut', fill: { kind: 'none' }, outline: null }));
    let score = -Infinity;
    if (item.regions.some((rings) => pointInRings(p, rings))) score = 3000 + item.priority;
    else if (d <= tol) score = 2000 + item.priority - d / tol;
    else if (item.prims.some((prim) => (prim.kind === 'polyline' && prim.closed && pointInRings(p, [prim.points])) || (prim.kind === 'image' && pointInRings(p, [imageCorners(prim)]))))
      score = 1000 + item.priority;
    if (score > -Infinity && (!best || score > best.score)) best = { id: item.id, score };
  }
  return best?.id ?? null;
}

/**
 * Element inom en rektangel. "window" kräver att elementet ligger helt
 * innanför (dra åt höger); "crossing" räcker att det berörs (dra åt vänster),
 * som är vanligt i ritprogram.
 */
export function pickInRect(pickables: readonly Pickable[], r: Bounds, mode: 'window' | 'crossing'): string[] {
  const ids: string[] = [];
  for (const item of pickables) {
    const b = boundsOfPickable(item);
    if (!b) continue;
    const inside = b.minX >= r.minX && b.maxX <= r.maxX && b.minY >= r.minY && b.maxY <= r.maxY;
    const touches = b.maxX >= r.minX && b.minX <= r.maxX && b.maxY >= r.minY && b.minY <= r.maxY;
    if (mode === 'window' ? inside : touches) ids.push(item.id);
  }
  return ids;
}

function boundsOfPickable(item: Pickable): Bounds | null {
  const prims: Primitive[] = [...item.prims];
  for (const rings of item.regions) prims.push({ kind: 'region', rings, role: 'cut', fill: { kind: 'none' }, outline: null });
  return boundsOf(prims);
}

function distToPrim(p: Vec2, prim: Primitive): number {
  switch (prim.kind) {
    case 'line':
      return distToSegment(p, prim.a, prim.b);
    case 'polyline': {
      let d = Infinity;
      const pts = prim.points;
      const n = prim.closed ? pts.length : pts.length - 1;
      for (let i = 0; i < n; i++) d = Math.min(d, distToSegment(p, pts[i], pts[(i + 1) % pts.length]));
      return d;
    }
    case 'arc': {
      const a = Math.atan2(p[1] - prim.center[1], p[0] - prim.center[0]);
      const t = Math.PI * 2;
      const span = (((prim.end - prim.start) % t) + t) % t;
      const rel = (((a - prim.start) % t) + t) % t;
      if (rel <= span) return Math.abs(dist(p, prim.center) - prim.radius);
      const s: Vec2 = [prim.center[0] + prim.radius * Math.cos(prim.start), prim.center[1] + prim.radius * Math.sin(prim.start)];
      const e: Vec2 = [prim.center[0] + prim.radius * Math.cos(prim.end), prim.center[1] + prim.radius * Math.sin(prim.end)];
      return Math.min(dist(p, s), dist(p, e));
    }
    case 'region': {
      let d = Infinity;
      for (const ring of prim.rings) for (let i = 0; i < ring.length; i++) d = Math.min(d, dist(p, closestOnSegment(p, ring[i], ring[(i + 1) % ring.length]).point));
      return d;
    }
    case 'text':
      return distToText(p, prim);
    case 'image': {
      const c = imageCorners(prim);
      let d = Infinity;
      for (let i = 0; i < 4; i++) d = Math.min(d, distToSegment(p, c[i], c[(i + 1) % 4]));
      return d;
    }
  }
}

/** Ritningsskalan som texthöjderna räknas i (som i planen). */
const DRAWING_SCALE = 100;

/**
 * Avstånd till en ungefärlig ruta runt texten (0 inuti), så att man träffar
 * en etikett var man än pekar på den, även långa vänsterjusterade rader.
 */
function distToText(p: Vec2, t: Extract<Primitive, { kind: 'text' }>): number {
  const h = t.height * DRAWING_SCALE;
  const w = Math.max(1, t.text.length) * h * 0.62;
  const a = t.angle ?? 0;
  const dx = p[0] - t.at[0];
  const dy = p[1] - t.at[1];
  // Punkten i textens eget system: x längs raden, y uppåt från baslinjen.
  const x = dx * Math.cos(a) + dy * Math.sin(a);
  const y = -dx * Math.sin(a) + dy * Math.cos(a);
  const x0 = t.align === 'middle' ? -w / 2 : t.align === 'end' ? -w : 0;
  const ox = Math.max(x0 - x, 0, x - (x0 + w));
  const oy = Math.max(-h * 0.3 - y, 0, y - h);
  return Math.hypot(ox, oy);
}
