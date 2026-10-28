import type { Id } from '../../core/model';
import { typeOf } from '../../elements/registry';
import { BoxIndex } from '../../geometry/boxIndex';
import { distToSegment } from '../../geometry/vec';
import type { Pickable } from '../../repr/plan';
import type { Vec2 } from '../../repr/primitives';
import { pickAt } from '../../view2d/pick';
import type { WandAction, WandHit } from './wand';

/**
 * Markera (0.10.22), utan något ritverktyg: klick på ett objekt markerar
 * allt av samma sort som hänger ihop med det (en väggkedja, linjer som möts
 * ände mot ände, markobjekt som ligger an mot varandra); Tab ger i stället
 * allt av samma sort i vyn. Shift lägger till det i markeringen.
 */
export const selectConnected: WandAction = {
  id: 'select-connected',
  tools: ['select'],
  find(ctx) {
    const { app } = ctx;
    const pickables = app.plan.pickables;
    const id = pickAt(pickables, ctx.at, ctx.tol, app.view.drawingScale);
    const el = id ? app.store.doc.elements[id] : undefined;
    if (!id || !el) return [];
    const plural = (typeOf(el.type)?.labelPlural ?? typeOf(el.type)?.label ?? 'objekt').toLowerCase();
    // Samma plan och samma objekt: samma svar (hovringen frågar vid varje musrörelse).
    if (!cache || cache.pickables !== pickables || cache.id !== id) {
      const same = pickables.filter((p) => app.store.doc.elements[p.id]?.type === el.type);
      cache = { pickables, id, chain: connected(same, id), all: [...new Set(same.map((p) => p.id))] };
    }
    const { chain, all } = cache;
    const make = (label: string, ids: Id[]): WandHit => ({
      label,
      preview: { ids },
      apply: (more) => {
        if (more || ctx.shift) app.selection.set([...new Set([...app.selection.list(), ...ids])]);
        else app.selection.set(ids);
        app.hint(`${ids.length} ${plural} markerade.`, 2500);
      },
    });
    const out: WandHit[] = [];
    if (chain.length > 1) out.push(make(`Sammanhängande ${plural} (${chain.length})`, chain));
    if (all.length > 1 && all.length !== chain.length) out.push(make(`Alla ${plural} i vyn (${all.length})`, all));
    if (!out.length) out.push(make(`${typeOf(el.type)?.label ?? 'Objektet'} (inget hänger ihop med det)`, [id]));
    return out;
  },
};

let cache: { pickables: readonly Pickable[]; id: Id; chain: Id[]; all: Id[] } | null = null;

/** Punkter och kanter i ett objekts ytor och linjer, att pröva om två objekt rör varandra. */
function geometry(p: Pickable): { pts: Vec2[]; edges: [Vec2, Vec2][] } {
  const pts: Vec2[] = [];
  const edges: [Vec2, Vec2][] = [];
  for (const rings of p.regions)
    for (const ring of rings)
      for (let i = 0; i < ring.length; i++) {
        pts.push(ring[i]);
        edges.push([ring[i], ring[(i + 1) % ring.length]]);
      }
  for (const q of p.prims) {
    if (q.kind === 'line') {
      pts.push(q.a, q.b);
      edges.push([q.a, q.b]);
    } else if (q.kind === 'polyline') {
      const n = q.points.length;
      for (let i = 0; i < n; i++) pts.push(q.points[i]);
      for (let i = 0; i + 1 < n + (q.closed ? 1 : 0); i++) edges.push([q.points[i], q.points[(i + 1) % n]]);
    }
  }
  return { pts, edges };
}

/**
 * De objekt som hänger ihop med `start`: en punkt i det ena ligger på en kant
 * i det andra (inom 1 mm). Bara grannar prövas, med ett rutnät över objektens
 * rektanglar.
 */
export function connected(items: readonly Pickable[], start: Id, eps = 1): Id[] {
  const byId = new Map<Id, { pts: Vec2[]; edges: [Vec2, Vec2][]; box: [number, number, number, number] }>();
  for (const p of items) {
    const g = geometry(p);
    const prev = byId.get(p.id);
    if (prev) {
      prev.pts.push(...g.pts);
      prev.edges.push(...g.edges);
    } else byId.set(p.id, { ...g, box: [Infinity, Infinity, -Infinity, -Infinity] });
  }
  const ids = [...byId.keys()];
  const index = new BoxIndex(5000);
  ids.forEach((id, i) => {
    const g = byId.get(id)!;
    for (const q of g.pts) {
      g.box[0] = Math.min(g.box[0], q[0]);
      g.box[1] = Math.min(g.box[1], q[1]);
      g.box[2] = Math.max(g.box[2], q[0]);
      g.box[3] = Math.max(g.box[3], q[1]);
    }
    index.add(i, g.pts.length ? [g.box[0] - eps, g.box[1] - eps, g.box[2] + eps, g.box[3] + eps] : null);
  });
  const touches = (a: Id, b: Id): boolean => {
    const A = byId.get(a)!;
    const B = byId.get(b)!;
    const on = (pts: Vec2[], edges: [Vec2, Vec2][]) => pts.some((q) => edges.some(([u, v]) => distToSegment(q, u, v) <= eps));
    return on(A.pts, B.edges) || on(B.pts, A.edges);
  };
  const seen = new Set<Id>([start]);
  const queue = [start];
  while (queue.length) {
    const a = queue.pop()!;
    const box = byId.get(a)?.box;
    if (!box) continue;
    for (const i of index.near([box[0] - eps, box[1] - eps, box[2] + eps, box[3] + eps])) {
      const b = ids[i];
      if (seen.has(b) || !touches(a, b)) continue;
      seen.add(b);
      queue.push(b);
    }
  }
  return ids.filter((id) => seen.has(id));
}
