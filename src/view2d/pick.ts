import { closestOnSegment, dist, distToSegment, pointInRings } from '../geometry/vec';
import type { Pickable } from '../repr/plan';
import type { Bounds, Primitive, Vec2 } from '../repr/primitives';
import { boundsOf, imageCorners } from '../repr/primitives';

/**
 * Vilket element ligger under en punkt? I tur och ordning:
 * 1. en snittyta som punkten ligger i (vägg, öppning),
 * 2. en linje eller båge inom toleransen (dörrblad, möbelkant, 2D-linje),
 * 3. en mjuk yta som punkten ligger i (sluten 2D-form, fyllning; 0.8.11),
 * 4. en annan sluten form som punkten ligger i (rum, underlag).
 * Inom varje nivå vinner det som ritas överst.
 */
export function pickAt(pickables: readonly Pickable[], p: Vec2, tol: number, drawingScale = 100): string | null {
  return pickAllAt(pickables, p, tol, drawingScale)[0] ?? null;
}

/**
 * Alla element under en punkt, det som `pickAt` väljer först och sedan i
 * samma ordning (0.8.4): Tab växlar mellan dem innan man markerar.
 */
export function pickAllAt(pickables: readonly Pickable[], p: Vec2, tol: number, drawingScale = 100): string[] {
  const best = new Map<string, { score: number; i: number }>();
  for (let i = 0; i < pickables.length; i++) {
    const item = pickables[i];
    let d = Infinity;
    for (const prim of item.prims) d = Math.min(d, distToPrim(p, prim, drawingScale));
    // Kanten på en yta räknas som en linje, så att tunna väggar går att träffa.
    for (const rings of item.regions) d = Math.min(d, distToPrim(p, { kind: 'region', rings, role: 'cut', fill: { kind: 'none' }, outline: null }, drawingScale));
    let score = -Infinity;
    const inside = item.regions.some((rings) => pointInRings(p, rings));
    if (inside && !item.soft) score = 3000 + item.priority;
    else if (d <= tol) score = 2000 + item.priority - d / tol;
    else if (inside) score = 1500 + item.priority;
    else if (item.prims.some((prim) => (prim.kind === 'polyline' && prim.closed && pointInRings(p, [prim.points])) || (prim.kind === 'image' && pointInRings(p, [imageCorners(prim)]))))
      score = 1000 + item.priority;
    const was = best.get(item.id);
    if (score > -Infinity && (!was || score > was.score)) best.set(item.id, { score, i });
  }
  // Vid lika poäng vinner det som kom först, som förut.
  return [...best.entries()].sort((a, b) => b[1].score - a[1].score || a[1].i - b[1].i).map(([id]) => id);
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

export function distToPrim(p: Vec2, prim: Primitive, drawingScale: number): number {
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
      return distToText(p, prim, drawingScale);
    case 'image': {
      const c = imageCorners(prim);
      let d = Infinity;
      for (let i = 0; i < 4; i++) d = Math.min(d, distToSegment(p, c[i], c[(i + 1) % 4]));
      return d;
    }
  }
}

/**
 * Avstånd till en ungefärlig ruta runt texten (0 inuti), så att man träffar
 * en etikett var man än pekar på den, även långa vänsterjusterade rader.
 */
function distToText(p: Vec2, t: Extract<Primitive, { kind: 'text' }>, drawingScale: number): number {
  // Texthöjden på papper genom ritningsskalan, som i planen.
  const h = t.height * drawingScale;
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
