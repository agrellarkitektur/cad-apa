import type { Element, Id, ProjectDoc } from './model';
import type { DocStore } from './store';
import { kindOfElementType } from './openingTypes';
import { resolveParams } from '../elements/registry';
import { wallFrame, type WallFrame, type WallParams } from '../elements/wall';
import type { OpeningObjParams } from '../elements/openingSpec';
import { holeAt, roomHoles } from '../elements/rooms';
import { outsideSide } from '../elements/wallSides';
import type { Vec2 } from '../repr/primitives';

/**
 * Smarta lägen för dörrar, fönster och vägghål (0.11.8.3): *I liv med
 * fönstret under* (lodrätt mellan våningarna), *Lika avstånd* mellan flera i
 * samma vägg och *Mitt i rummet* (mitt på rummets vägg). Bara läget längs
 * väggen ändras; allt i en transaktion.
 */

interface Placed {
  el: Element;
  p: OpeningObjParams;
  f: WallFrame;
  /** Mitten i planen och väggens riktning där. */
  c: Vec2;
  t: Vec2;
}

const isOpening = (el: Element | undefined): el is Element => !!el?.host && kindOfElementType(el.type) !== null;

function placed(doc: ProjectDoc, el: Element): Placed | null {
  const host = el.host ? doc.elements[el.host] : undefined;
  if (!host || host.type !== 'Wall') return null;
  const p = resolveParams<OpeningObjParams>(doc, el);
  const f = wallFrame(resolveParams<WallParams>(doc, host));
  return { el, p, f, c: f.at(p.at, 0), t: f.tangent(p.at) };
}

/** Läget längs väggen (hålets mitt) för en punkt i planen, inom väggen. */
function atFor(q: Placed, pt: Vec2): number {
  const half = q.p.holeW / 2 + 10;
  return Math.round(Math.min(q.f.length - half, Math.max(half, q.f.project(pt)[0])));
}

const elevationOf = (doc: ProjectDoc, storey: Id): number => doc.storeys.find((s) => s.id === storey)?.elevation ?? 0;

/**
 * Öppningen under: på närmaste våning under (eller längre ned om den saknar
 * en), i en vägg i samma liv (parallell och högst 300 mm från linjen
 * genom öppningen), den vars mitt ligger närmast längs väggen.
 */
export function openingBelow(doc: ProjectDoc, id: Id): Element | null {
  const el = doc.elements[id];
  const me = isOpening(el) ? placed(doc, el) : null;
  if (!me) return null;
  const z = elevationOf(doc, el!.storey);
  let best: { el: Element; z: number; d: number } | null = null;
  for (const o of Object.values(doc.elements)) {
    if (o.id === id || !isOpening(o)) continue;
    const oz = elevationOf(doc, o.storey);
    if (oz >= z) continue;
    const q = placed(doc, o);
    if (!q || Math.abs(q.t[0] * me.t[0] + q.t[1] * me.t[1]) < 0.98) continue;
    const dx = q.c[0] - me.c[0];
    const dy = q.c[1] - me.c[1];
    const across = Math.abs(dx * -me.t[1] + dy * me.t[0]);
    if (across > 300 + me.f.half + q.f.half) continue;
    const along = Math.abs(dx * me.t[0] + dy * me.t[1]);
    // Närmaste våningen går först, sedan närmast längs väggen.
    if (!best || oz > best.z || (oz === best.z && along < best.d)) best = { el: o, z: oz, d: along };
  }
  return best?.el ?? null;
}

/** *I liv med fönstret under*: mitten lodrätt över öppningen under. Antalet som flyttades. */
export function alignWithBelow(store: DocStore, ids: readonly Id[]): number {
  let n = 0;
  store.transact('I liv med fönstret under', (tx) => {
    for (const id of ids) {
      const below = openingBelow(tx.doc, id);
      const el = tx.doc.elements[id];
      const me = el && below ? placed(tx.doc, el) : null;
      const q = below ? placed(tx.doc, below) : null;
      if (!me || !q) continue;
      const at = atFor(me, q.c);
      if (Math.abs(at - me.p.at) < 0.5) continue;
      tx.putElement({ ...el!, params: { ...el!.params, at } });
      n++;
    }
  });
  return n;
}

/**
 * *Lika avstånd*: tre eller fler i samma vägg; de yttersta står kvar och de
 * mellan flyttas så att avstånden mellan hålen blir lika. Null om urvalet
 * inte går (färre än tre eller olika väggar).
 */
export function equalSpacingPlan(doc: ProjectDoc, ids: readonly Id[]): Map<Id, number> | null {
  const list = ids.map((id) => doc.elements[id]).filter(isOpening).map((el) => placed(doc, el)).filter((q): q is Placed => !!q);
  if (list.length < 3 || new Set(list.map((q) => q.el.host)).size !== 1) return null;
  list.sort((a, b) => a.p.at - b.p.at);
  const first = list[0];
  const last = list[list.length - 1];
  const span = last.p.at - last.p.holeW / 2 - (first.p.at + first.p.holeW / 2);
  const widths = list.slice(1, -1).reduce((a, q) => a + q.p.holeW, 0);
  const gap = (span - widths) / (list.length - 1);
  if (gap < 0) return null;
  const out = new Map<Id, number>();
  let s = first.p.at + first.p.holeW / 2;
  for (const q of list.slice(1, -1)) {
    s += gap;
    out.set(q.el.id, Math.round(s + q.p.holeW / 2));
    s += q.p.holeW;
  }
  return out;
}

export function equalSpacing(store: DocStore, ids: readonly Id[]): number | null {
  const plan = equalSpacingPlan(store.doc, ids);
  if (!plan) return null;
  let n = 0;
  store.transact('Lika avstånd', (tx) => {
    for (const [id, at] of plan) {
      const el = tx.doc.elements[id];
      if (!el || Math.abs(Number(el.params.at) - at) < 0.5) continue;
      tx.putElement({ ...el, params: { ...el.params, at } });
      n++;
    }
  });
  return n;
}

/**
 * Mitten av rummets vägg vid öppningen: rummet på insidan (ytterväggar),
 * på den sida dörren slår mot eller vänster (innerväggar); väggens del i
 * rummet är kanten av rummets kontur som ligger längs livet där öppningen
 * sitter. Null om inget rum hittas.
 */
export function roomMidAt(doc: ProjectDoc, id: Id): number | null {
  const el = doc.elements[id];
  const me = isOpening(el) ? placed(doc, el) : null;
  if (!me) return null;
  const host = doc.elements[el!.host!];
  const walls = Object.values(doc.elements)
    .filter((w) => w.type === 'Wall' && w.storey === host.storey)
    .map((w) => ({ id: w.id, p: resolveParams<WallParams>(doc, w) }));
  const holes = roomHoles(walls);
  const out = outsideSide(doc, host);
  const sides: (1 | -1)[] = out !== null ? [(-out) as 1 | -1] : [me.p.swing === -1 ? -1 : 1, me.p.swing === -1 ? 1 : -1];
  const f = me.f.local(me.p.at);
  for (const side of sides) {
    const room = holeAt(holes, f.at(me.p.at, side * (f.half + 50)));
    if (!room) continue;
    // Kanterna längs livet på den sidan, och den som täcker öppningens mitt.
    for (let i = 0; i < room.length; i++) {
      const a = room[i];
      const b = room[(i + 1) % room.length];
      const [sa, oa] = f.project(a);
      const [sb, ob] = f.project(b);
      if (Math.abs(oa - side * f.half) > 5 || Math.abs(ob - side * f.half) > 5) continue;
      if (Math.min(sa, sb) - 1 > me.p.at || Math.max(sa, sb) + 1 < me.p.at) continue;
      const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      return atFor(me, mid);
    }
  }
  return null;
}

/** *Mitt i rummet*: antalet som flyttades, eller null när inget rum hittades. */
export function centerInRoom(store: DocStore, ids: readonly Id[]): number | null {
  const plan = ids.map((id) => [id, roomMidAt(store.doc, id)] as const).filter((x): x is readonly [Id, number] => x[1] !== null);
  if (!plan.length) return null;
  let n = 0;
  store.transact('Mitt i rummet', (tx) => {
    for (const [id, at] of plan) {
      const el = tx.doc.elements[id];
      if (!el || Math.abs(Number(el.params.at) - at) < 0.5) continue;
      tx.putElement({ ...el, params: { ...el.params, at } });
      n++;
    }
  });
  return n;
}
