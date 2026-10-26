import type { Element, Id, ProjectDoc } from './model';
import type { DocStore } from './store';

/**
 * Ritordning (0.8.25): Längst bak, Bak, Fram och Främst.
 *
 * Planen ritas i lager efter objektens sort (underlag, väggar, möbler, rum,
 * 2D-former, text …), och ritordningen gäller inom en sort på samma yta: en
 * 2D-form bland 2D-formerna, ett underlag bland underlagen. Ordningen är
 * elementens `order` (utelämnad = 0) och vid lika värden den ordning de
 * lades till i.
 *
 * Längst bak och Främst lägger det markerade bakom eller framför alla andra
 * av samma sort. Bak och Fram flyttar det ett steg förbi närmaste objekt som
 * det överlappar (rutorna runt dem), så att varje klick syns; utan rutor ett
 * steg i listan.
 */

export type OrderMove = 'back' | 'backward' | 'forward' | 'front';

export const ORDER_LABELS: Record<OrderMove, string> = {
  back: 'Längst bak',
  backward: 'Bak',
  forward: 'Fram',
  front: 'Främst',
};

/** Sorterna som har en egen ritordning. Väggar, dörrar och fönster ritas ihop och har ingen. */
export const ORDERABLE = new Set(['Shape2D', 'Text', 'Underlay', 'Furniture', 'Dimension', 'Space', 'Ground']);

export function canOrder(els: readonly Element[]): boolean {
  return els.length > 0 && els.every((e) => ORDERABLE.has(e.type));
}

/** En rektangel [minX, minY, maxX, maxY]. */
export type OrderBox = readonly [number, number, number, number];

/** Var elementet ritas: sorten och ytan (ett blad, en fasad … eller våningens plan). */
const placeOf = (el: Element) => `${el.type}|${el.space ?? `plan:${el.storey}`}`;

/** Elementen av samma sort på samma yta, bakifrån och fram. */
export function orderedWith(doc: ProjectDoc, el: Element): Element[] {
  const key = placeOf(el);
  return sortByOrder(Object.values(doc.elements).filter((e) => placeOf(e) === key));
}

/** Bakifrån och fram: `order`, och vid lika värden ordningen i listan. */
export function sortByOrder<T extends Element | { el: Element }>(list: readonly T[]): T[] {
  const of = (x: T) => (('el' in x ? x.el.order : (x as Element).order) ?? 0);
  if (!list.some((x) => of(x) !== 0)) return [...list];
  return list
    .map((x, i) => ({ x, i }))
    .sort((a, b) => of(a.x) - of(b.x) || a.i - b.i)
    .map((a) => a.x);
}

const overlaps = (a: OrderBox | null, b: OrderBox | null) => !a || !b || (a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]);

/**
 * Flytta de markerade i ritordningen. `boxOf` ger rutan runt ett element i
 * vyn (för Bak och Fram). Svarar med hur många som flyttades.
 */
export function arrange(store: DocStore, ids: readonly Id[], move: OrderMove, boxOf?: (id: Id) => OrderBox | null): number {
  const doc = store.doc;
  const chosen = ids.map((id) => doc.elements[id]).filter((e): e is Element => !!e && ORDERABLE.has(e.type));
  // En grupp per sort och yta.
  const groups = new Map<string, Element>();
  for (const el of chosen) if (!groups.has(placeOf(el))) groups.set(placeOf(el), el);
  const want = new Set(chosen.map((e) => e.id));
  const changes: Element[] = [];
  for (const first of groups.values()) {
    const list = orderedWith(doc, first);
    const next = reorder(list, want, move, boxOf);
    if (!next) continue;
    // Längst bak och Främst: bara de markerade får nya värden.
    if (move === 'back' || move === 'front') {
      const mine = next.filter((e) => want.has(e.id));
      const rest = list.filter((e) => !want.has(e.id)).map((e) => e.order ?? 0);
      const edge = move === 'back' ? Math.min(...rest) - mine.length : Math.max(...rest) + 1;
      mine.forEach((e, k) => {
        if ((e.order ?? 0) !== edge + k) changes.push(withOrder(e, edge + k));
      });
      continue;
    }
    // Bak och Fram: hela sorten numreras om, men bara de som ändras skrivs.
    next.forEach((e, k) => {
      if ((e.order ?? 0) !== k) changes.push(withOrder(e, k));
    });
  }
  const moved = changes.filter((e) => want.has(e.id)).length;
  if (!changes.length) return 0;
  store.transact(ORDER_LABELS[move], (tx) => {
    for (const el of changes) tx.putElement(el);
  });
  return moved;
}

function withOrder(el: Element, order: number): Element {
  const next = { ...el };
  if (order) next.order = order;
  else delete next.order;
  return next;
}

/** Den nya ordningen, eller null om inget ändras. */
function reorder(list: Element[], want: Set<Id>, move: OrderMove, boxOf?: (id: Id) => OrderBox | null): Element[] | null {
  const ids = list.map((e) => e.id);
  if (move === 'back' || move === 'front') {
    const mine = list.filter((e) => want.has(e.id));
    const rest = list.filter((e) => !want.has(e.id));
    const next = move === 'back' ? [...mine, ...rest] : [...rest, ...mine];
    return next.some((e, i) => e.id !== ids[i]) ? next : null;
  }
  const box = new Map<Id, OrderBox | null>();
  const boxFor = (id: Id) => {
    if (!box.has(id)) box.set(id, boxOf ? boxOf(id) : null);
    return box.get(id)!;
  };
  const next = [...list];
  // Fram: de främsta markerade först, så att de inte hoppar över varandra.
  const order = move === 'forward' ? [...next].reverse() : [...next];
  let changed = false;
  for (const el of order) {
    if (!want.has(el.id)) continue;
    const i = next.indexOf(el);
    const step = move === 'forward' ? 1 : -1;
    // Närmaste omarkerade i riktningen som överlappar.
    let j = i + step;
    while (j >= 0 && j < next.length && (want.has(next[j].id) || !overlaps(boxFor(el.id), boxFor(next[j].id)))) j += step;
    if (j < 0 || j >= next.length || want.has(next[j].id)) continue;
    next.splice(i, 1);
    next.splice(j, 0, el);
    changed = true;
  }
  return changed ? next : null;
}
