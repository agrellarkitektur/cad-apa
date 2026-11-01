import type { Element, Id, ProjectDoc } from './model';
import type { DocStore } from './store';
import { kindOfElementType } from './openingTypes';
import { resolveParams } from '../elements/registry';
import { markerFrame } from '../elements/markers';
import { wallFrame, type WallParams } from '../elements/wall';
import type { OpeningObjParams } from '../elements/openingSpec';

/**
 * Fasaden som arbetsyta (0.11.8.3): dörrar, fönster och vägghål flyttas i
 * fasaden och sektionen. Vyns x går längs markörens linje och y är höjden,
 * så ett drag blir ett nytt läge längs väggen (det som syns i vyn delat med
 * hur mycket väggen vetter mot den) och en ny höjd: bröstningen, eller
 * överkant karm när den står fast. Dörrar står på golvet och flyttas bara
 * i sidled. Allt i en transaktion.
 */

/** Om ett objekt flyttas så här i fasader och sektioner. */
export const movesInFacade = (el: Pick<Element, 'type' | 'host'> | undefined): boolean => !!el?.host && kindOfElementType(el.type) !== null;

/** Hur mycket en vägg i läget `at` vetter mot vyn: 1 rakt mot, 0 i vyns djupled. */
function facing(doc: ProjectDoc, markerId: Id, el: Element): { k: number; p: OpeningObjParams; length: number } | null {
  const marker = doc.elements[markerId];
  const host = el.host ? doc.elements[el.host] : undefined;
  if (!marker || !host) return null;
  const p = resolveParams<OpeningObjParams>(doc, el);
  const f = wallFrame(resolveParams<WallParams>(doc, host));
  const t = f.tangent(p.at);
  const r = markerFrame(doc, marker).right;
  return { k: t[0] * r[0] + t[1] * r[1], p, length: f.length };
}

/** De nya parametrarna för ett drag `d` (vyns mm) av ett objekt, eller null när inget ändras. */
export function facadeShift(doc: ProjectDoc, markerId: Id, el: Element, d: readonly [number, number]): Record<string, unknown> | null {
  const fc = facing(doc, markerId, el);
  if (!fc) return null;
  const { k, p, length } = fc;
  const out: Record<string, unknown> = {};
  // En vägg som nästan går i vyns djupled flyttas inte i sidled (det syns inte).
  if (Math.abs(k) > 0.2 && Math.abs(d[0]) > 0.5) {
    const half = p.holeW / 2 + 10;
    const at = Math.min(length - half, Math.max(half, p.at + d[0] / k));
    if (Math.abs(at - p.at) > 0.5) out.at = Math.round(at);
  }
  if (el.type !== 'Door' && Math.abs(d[1]) > 0.5) {
    const dz = Math.round(d[1]);
    if (p.heightRef === 'head' && el.type !== 'WallHole') out.head = Math.round((p.head ?? 0) + dz);
    else out.sill = Math.round((p.sill ?? 0) + dz);
  }
  return Object.keys(out).length ? out : null;
}

/** Flytta objekten med draget `d` i fasaden eller sektionen `markerId`. Antalet som ändrades. */
export function moveOpeningsInView(store: DocStore, markerId: Id, ids: readonly Id[], d: readonly [number, number], label = 'Flytta i fasaden'): number {
  let n = 0;
  store.transact(label, (tx) => {
    for (const id of ids) {
      const el = tx.doc.elements[id];
      if (!movesInFacade(el) || el.locked) continue;
      const next = facadeShift(tx.doc, markerId, el, d);
      if (!next) continue;
      tx.putElement({ ...el, params: { ...el.params, ...next } });
      n++;
    }
  });
  return n;
}
