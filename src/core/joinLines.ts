import { isClosed, type Shape2DParams } from '../elements/drawing2d';
import { resolveParams } from '../elements/registry';
import type { Element, Id, ProjectDoc } from './model';
import type { DocStore } from './store';

/**
 * Foga ihop (0.10.17): öppna 2D-linjer som delar en ändpunkt blir en lång
 * linje. Linjer och splines fogas var för sig. Den första linjen i en kedja
 * (i markeringens ordning) behåller sin penna, fyllning och sitt id; de
 * andra tas bort. Slutar kedjan där den började blir linjen sluten.
 */

type P = [number, number];

/** Ändar närmare än så räknas som samma punkt (mm). */
const SAME = 1;

/** En öppen linje eller spline som kan fogas. */
export function canFuse(doc: ProjectDoc, el: Element | undefined): boolean {
  if (el?.type !== 'Shape2D' || el.locked) return false;
  const q = resolveParams<Shape2DParams>(doc, el);
  return (q.shape === 'polyline' || q.shape === 'spline') && q.points.length >= 2 && !isClosed(q);
}

interface Chain {
  ids: Id[];
  points: P[];
  /** Pilhöjd per kant, i kedjans riktning. */
  bulges: number[];
  startCap?: string;
  endCap?: string;
}

const same = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= SAME;

function chainOf(doc: ProjectDoc, el: Element): Chain {
  const q = resolveParams<Shape2DParams>(doc, el);
  const pts = q.points.map((p): P => [p[0], p[1]]);
  return { ids: [el.id], points: pts, bulges: pts.slice(1).map((_, i) => Number(q.bulges?.[i]) || 0), startCap: q.startCap, endCap: q.endCap };
}

function reversed(c: Chain): Chain {
  return { ids: c.ids, points: [...c.points].reverse(), bulges: [...c.bulges].reverse().map((b) => (b ? -b : 0)), startCap: c.endCap, endCap: c.startCap };
}

/** b fogad efter a (a:s slut i b:s början). */
function append(a: Chain, b: Chain): Chain {
  return { ids: [...a.ids, ...b.ids], points: [...a.points, ...b.points.slice(1)], bulges: [...a.bulges, ...b.bulges], startCap: a.startCap, endCap: b.endCap };
}

/** Kedjorna som linjerna bildar, i markeringens ordning; bara kedjor av minst två linjer. */
export function fuseChains(doc: ProjectDoc, ids: readonly Id[]): Chain[] {
  const out: Chain[] = [];
  const left = ids.map((id) => doc.elements[id]).filter((el) => canFuse(doc, el));
  while (left.length) {
    const first = left.shift()!;
    const kind = resolveParams<Shape2DParams>(doc, first).shape;
    let c = chainOf(doc, first);
    for (let grew = true; grew; ) {
      grew = false;
      // Sluten: inget mer att foga till.
      if (c.points.length >= 3 && same(c.points[0], c.points[c.points.length - 1])) break;
      for (let k = 0; k < left.length; k++) {
        const el = left[k];
        if (resolveParams<Shape2DParams>(doc, el).shape !== kind) continue;
        const o = chainOf(doc, el);
        const head = c.points[0];
        const tail = c.points[c.points.length - 1];
        const a = o.points[0];
        const z = o.points[o.points.length - 1];
        let next: Chain | null = null;
        if (same(tail, a)) next = append(c, o);
        else if (same(tail, z)) next = append(c, reversed(o));
        else if (same(head, z)) next = append(o, c);
        else if (same(head, a)) next = append(reversed(o), c);
        if (next) {
          c = next;
          left.splice(k, 1);
          grew = true;
          break;
        }
      }
    }
    if (c.ids.length >= 2) out.push(c);
  }
  return out;
}

/**
 * Foga ihop de markerade linjerna. Svarar med id:na som blev kvar, eller
 * null om inget delade en ände.
 */
export function fuseLines(store: DocStore, ids: readonly Id[]): Id[] | null {
  const doc = store.doc;
  const chains = fuseChains(doc, ids);
  if (!chains.length) return null;
  const kept: Id[] = [];
  store.transact(chains.reduce((n, c) => n + c.ids.length, 0) > 2 ? 'Foga ihop linjer' : 'Foga ihop två linjer', (tx) => {
    for (const c of chains) {
      const el = tx.doc.elements[c.ids[0]];
      if (!el) continue;
      let pts = c.points;
      let bulges = c.bulges;
      const closed = pts.length >= 4 && same(pts[0], pts[pts.length - 1]);
      // Den sista punkten är samma som den första; den sista kanten går tillbaka till början.
      if (closed) pts = pts.slice(0, -1);
      if (!closed) bulges = bulges.slice(0, pts.length - 1);
      while (bulges.length && Math.abs(bulges[bulges.length - 1]) < 0.5) bulges = bulges.slice(0, -1);
      const spline = el.params.shape === 'spline';
      const params: Record<string, unknown> = { ...el.params, points: pts, bulges: spline || !bulges.length ? undefined : bulges.map((b) => (Math.abs(b) < 0.5 ? 0 : b)), closed: closed || undefined };
      if (closed) {
        delete params.startCap;
        delete params.endCap;
      } else {
        params.startCap = c.startCap;
        params.endCap = c.endCap;
      }
      for (const k of Object.keys(params)) if (params[k] === undefined) delete params[k];
      tx.putElement({ ...el, params });
      for (const id of c.ids.slice(1)) tx.removeElement(id);
      kept.push(el.id);
    }
  });
  return kept;
}
