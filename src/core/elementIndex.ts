import type { Element, Id, ProjectDoc } from './model';

/**
 * Register över elementen (0.8.15), så att verktygen slipper gå igenom hela
 * projektet för varje vägg: dörrar och fönster per vägg, och väggarnas ändar
 * i ett rutnät per våning.
 *
 * Ett register byggs första gången det behövs för en viss samling
 * (`doc.elements`) och sparas med samlingen som nyckel. Ett sparat dokument
 * ändras aldrig (`applyChanges` gör en ny samling), men en transaktion ändrar
 * sin egen kopia på plats; därför säger `TxBuilder` till om varje ändring
 * (`noteElementChange`), så att registret följer med mitt i transaktionen.
 * Den som ändrar en samling på något annat sätt får inte ha frågat förut.
 */

type Records = Readonly<Record<Id, Element>>;
export type WallEnd = 'start' | 'end';
type P = readonly [number, number];

/** Rutornas sida i mm. En ruta har sällan mer än några väggändar. */
const CELL = 1000;

interface Registry {
  /** Elementen som sitter i en vägg (`host`), per vägg. */
  hosted: Map<Id, Id[]>;
  /** Väggarnas ändar per våning och ruta. */
  ends: Map<string, { id: Id; end: WallEnd }[]>;
}

const registries = new WeakMap<object, Registry>();

const keyOf = (storey: Id, cx: number, cy: number) => `${storey}|${cx}|${cy}`;
const cellOf = (v: number) => Math.floor(v / CELL);

/** Väggens ändar, om elementet är en vägg. */
function endsOf(el: Element): [WallEnd, P][] | null {
  if (el.type !== 'Wall') return null;
  const p = el.params as { start?: P; end?: P };
  if (!Array.isArray(p.start) || !Array.isArray(p.end)) return null;
  return [
    ['start', p.start],
    ['end', p.end],
  ];
}

function add(r: Registry, el: Element): void {
  if (el.host) {
    const list = r.hosted.get(el.host);
    if (list) list.push(el.id);
    else r.hosted.set(el.host, [el.id]);
  }
  for (const [end, q] of endsOf(el) ?? []) {
    const k = keyOf(el.storey, cellOf(q[0]), cellOf(q[1]));
    const list = r.ends.get(k);
    if (list) list.push({ id: el.id, end });
    else r.ends.set(k, [{ id: el.id, end }]);
  }
}

function remove(r: Registry, el: Element): void {
  if (el.host) {
    const list = r.hosted.get(el.host);
    const i = list ? list.indexOf(el.id) : -1;
    if (i >= 0) list!.splice(i, 1);
  }
  for (const [end, q] of endsOf(el) ?? []) {
    const list = r.ends.get(keyOf(el.storey, cellOf(q[0]), cellOf(q[1])));
    const i = list ? list.findIndex((x) => x.id === el.id && x.end === end) : -1;
    if (i >= 0) list!.splice(i, 1);
  }
}

function registry(elements: Records): Registry {
  let r = registries.get(elements);
  if (!r) {
    r = { hosted: new Map(), ends: new Map() };
    for (const el of Object.values(elements)) add(r, el);
    registries.set(elements, r);
  }
  return r;
}

/**
 * Ett element i `elements` har bytts från `before` till `after` (någon av dem
 * saknas när elementet läggs till eller tas bort). Anropas av `TxBuilder`
 * när samlingen ändras på plats.
 */
export function noteElementChange(elements: Records, before: Element | undefined, after: Element | undefined): void {
  const r = registries.get(elements);
  if (!r) return;
  if (before) remove(r, before);
  if (after) add(r, after);
}

/** Elementen som sitter i väggen (dörrar, fönster …), i den ordning de kom in i projektet. */
export function hostedIn(doc: ProjectDoc, hostId: Id): Element[] {
  const ids = registry(doc.elements).hosted.get(hostId);
  if (!ids) return [];
  const out: Element[] = [];
  for (const id of ids) {
    const el = doc.elements[id];
    if (el && el.host === hostId) out.push(el);
  }
  return out;
}

/**
 * Väggändarna på en våning inom rektangeln [x0, y0, x1, y1] (kanten räknas
 * med), med ändens läge. Ordningen är inte bestämd.
 */
export function wallEndsIn(doc: ProjectDoc, storey: Id, box: readonly [number, number, number, number]): { id: Id; end: WallEnd; at: P }[] {
  const r = registry(doc.elements);
  const [x0, y0, x1, y1] = box;
  const out: { id: Id; end: WallEnd; at: P }[] = [];
  const take = (list: readonly { id: Id; end: WallEnd }[] | undefined) => {
    for (const { id, end } of list ?? []) {
      const at = (doc.elements[id]?.params as { start: P; end: P } | undefined)?.[end];
      if (at && at[0] >= x0 && at[0] <= x1 && at[1] >= y0 && at[1] <= y1) out.push({ id, end, at });
    }
  };
  const cx0 = cellOf(x0);
  const cx1 = cellOf(x1);
  const cy0 = cellOf(y0);
  const cy1 = cellOf(y1);
  if (!Number.isFinite(cx0 + cx1 + cy0 + cy1)) return out;
  if ((cx1 - cx0 + 1) * (cy1 - cy0 + 1) > r.ends.size) {
    // Större än hela registret: gå igenom det i stället för rutorna.
    const prefix = `${storey}|`;
    for (const [k, list] of r.ends) if (k.startsWith(prefix)) take(list);
    return out;
  }
  for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) take(r.ends.get(keyOf(storey, cx, cy)));
  return out;
}

/** Väggarna med en ände inom 1 mm från punkten, utom `except`; varje vägg en gång. */
export function wallsAt(doc: ProjectDoc, storey: Id, pt: P, except?: Id): Id[] {
  const out: Id[] = [];
  for (const c of wallEndsIn(doc, storey, [pt[0] - 1, pt[1] - 1, pt[0] + 1, pt[1] + 1])) {
    if (c.id !== except && !out.includes(c.id)) out.push(c.id);
  }
  return out;
}
