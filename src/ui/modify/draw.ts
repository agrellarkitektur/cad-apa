import type { Id } from '../../core/model';
import { arcFromBulge } from '../../geometry/arc';
import { pickableById, type Pickable } from '../../repr/plan';
import type { Primitive, Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ToolHost } from '../tools/host';

/**
 * Det Modifiera-verktygen ritar som förhandsvisning (0.8.15, ur tool.ts och
 * arrangeTool.ts): gummiband, bågar och spöken av det som ändras.
 */

/** En bruten linje genom punkterna, som SVG. */
export function svgLine(cam: Camera, pts: readonly Vec2[], cls = 'rubber'): string {
  return `<path d="${pts.map((q, i) => `${i ? 'L' : 'M'}${cam.toScreen(q).join(' ')}`).join('')}" class="${cls}"/>`;
}

/** Bågen från a till b med pilhöjden, som 49 punkter (eller rak om den inte är en båge). */
export function arcPoints(a: Vec2, b: Vec2, bulge: number): Vec2[] {
  const arc = arcFromBulge(a, b, bulge);
  if (!arc) return [a, b];
  const pts: Vec2[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = arc.theta0 - arc.sigma * arc.sweep * (i / 48);
    pts.push([arc.center[0] + arc.radius * Math.cos(t), arc.center[1] + arc.radius * Math.sin(t)]);
  }
  return pts;
}

/** Konturen av ett element avbildad med `map`, som förhandsvisning. */
export function ghostPath(cam: Camera, item: Pickable, map: (q: Vec2) => Vec2): string {
  const sh = (q: Vec2) => cam.toScreen(map(q));
  const path = (pts: readonly Vec2[], closed: boolean) => pts.map((q, i) => `${i ? 'L' : 'M'}${sh(q).join(' ')}`).join('') + (closed ? 'Z' : '');
  const parts: string[] = [];
  for (const rings of item.regions) parts.push(rings.map((r) => path(r, true)).join(''));
  for (const q of item.prims as Primitive[]) {
    if (q.kind === 'line') parts.push(path([q.a, q.b], false));
    else if (q.kind === 'polyline') parts.push(path(q.points, q.closed));
    else if (q.kind === 'region') parts.push(q.rings.map((r) => path(r, true)).join(''));
  }
  return `<path d="${parts.join('')}" class="ghost"/>`;
}

/** Spöken av flera element, avbildade med `map`. */
export function ghostOf(host: ToolHost, ids: readonly Id[], map: (q: Vec2) => Vec2, cam: Camera): string {
  const byId = pickableById(host.plan().pickables);
  return ids
    .map((id) => byId.get(id))
    .filter((x): x is Pickable => !!x)
    .map((item) => ghostPath(cam, item, map))
    .join('');
}
