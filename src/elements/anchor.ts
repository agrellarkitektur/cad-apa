import type { Element, ProjectDoc } from '../core/model';
import { wallFrame, type WallGeometry } from '../geometry/wallFrame';
import type { Vec2 } from '../repr/primitives';
import { resolveParams } from './registry';

/**
 * Ett objekts egna axlar (0.10.20.2), som det generella littrats ledare
 * sitter fast i: en punkt sparas i objektets axlar och följer med när
 * objektet flyttas, vrids eller ändras. Väggar räknar längs väggen (också
 * bågväggar) och åt vänster om mittlinjen, dörrar och fönster längs väggen
 * från öppningens mitt, så att punkten glider med öppningen. Andra objekt
 * får axlar ur sin första punkt och riktningen mot den andra (eller sin
 * vridning). Ett objekt utan någon punkt har inga axlar.
 */
export interface Anchor {
  toLocal(p: Vec2): [number, number];
  fromLocal(l: readonly number[]): Vec2;
}

const round = (v: number) => Math.round(v * 10) / 10;

function axes(o: Vec2, u: Vec2): Anchor {
  const l = Math.hypot(u[0], u[1]) || 1;
  const a: Vec2 = [u[0] / l, u[1] / l];
  const n: Vec2 = [-a[1], a[0]];
  return {
    toLocal: (p) => {
      const d: Vec2 = [p[0] - o[0], p[1] - o[1]];
      return [round(d[0] * a[0] + d[1] * a[1]), round(d[0] * n[0] + d[1] * n[1])];
    },
    fromLocal: (q) => [o[0] + a[0] * q[0] + n[0] * q[1], o[1] + a[1] * q[0] + n[1] * q[1]],
  };
}

const pt = (q: unknown): Vec2 | null => (Array.isArray(q) && typeof q[0] === 'number' ? [q[0], q[1]] : q && typeof q === 'object' && Array.isArray((q as { at?: unknown }).at) ? pt((q as { at: unknown }).at) : null);

/** Objektets axlar, eller null om det inte har några. */
export function anchorOf(doc: ProjectDoc, el: Element): Anchor | null {
  const p = resolveParams<Record<string, any>>(doc, el);
  if (el.host) {
    const host = doc.elements[el.host];
    if (!host || typeof p.at !== 'number') return null;
    const f = wallFrame(resolveParams<WallGeometry>(doc, host));
    return {
      toLocal: (q) => {
        const [s, o] = f.project(q);
        return [round(s - p.at), round(o)];
      },
      fromLocal: (q) => f.at(p.at + q[0], q[1]),
    };
  }
  if (el.type === 'Wall' && p.start && p.end) {
    const f = wallFrame(p as WallGeometry);
    return { toLocal: (q) => f.project(q).map(round) as [number, number], fromLocal: (q) => f.at(q[0], q[1]) };
  }
  if (p.start && p.end) return axes(p.start, [p.end[0] - p.start[0], p.end[1] - p.start[1]]);
  if (p.origin) {
    const r = ((p.rotation ?? 0) * Math.PI) / 180;
    return axes(p.origin, [Math.cos(r), Math.sin(r)]);
  }
  for (const key of ['line', 'outline', 'points']) {
    const list = p[key];
    if (!Array.isArray(list) || !list.length) continue;
    const a = pt(list[0]);
    const b = pt(list[1]);
    if (!a) continue;
    return axes(a, b && Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-6 ? [b[0] - a[0], b[1] - a[1]] : [1, 0]);
  }
  if (p.pos) {
    const r = ((p.angle ?? 0) * Math.PI) / 180;
    return axes(p.pos, [Math.cos(r), Math.sin(r)]);
  }
  if (p.seed) return axes(p.seed, [1, 0]);
  return null;
}
