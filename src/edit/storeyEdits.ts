// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import { copyPayload, pasteClip } from '../core/clipboard';
import { pruneAssets } from '../core/commands';
import { buildingStoreys, isSite, type Element, type Id, type ProjectDoc } from '../core/model';
import type { DocStore } from '../core/store';
import { neighbourStorey } from '../core/storeys';
import { typeOf } from '../elements/registry';

/** Det som tas bort med en våning: objekten på dess plan och vyerna av planen. */
export function storeyContents(doc: ProjectDoc, id: Id): { elements: Element[]; views: Id[] } {
  return {
    elements: Object.values(doc.elements).filter((e) => e.storey === id && !e.space && !typeOf(e.type)?.everyStorey),
    views: doc.views.filter((v) => v.storey === id && !v.marker && !v.worksheet).map((v) => v.id),
  };
}

/**
 * Ta bort en våning med allt som är ritat på den och vyerna av den. Det som
 * hör till projektet (fasader, sektioner, norrpilen) och det som är ritat i
 * fasader, sektioner och på blad flyttas till grannvåningen. Den sista
 * våningen och Platsen går inte att ta bort.
 */
export function deleteStorey(store: DocStore, id: Id): boolean {
  const doc = store.doc;
  const s = doc.storeys.find((x) => x.id === id);
  if (!s || s.site || buildingStoreys(doc).length < 2) return false;
  const other = (neighbourStorey(doc, id, -1) ?? neighbourStorey(doc, id, 1))!.id;
  const { elements, views } = storeyContents(doc, id);
  const gone = new Set<Id>([...views, `modell:${id}`]);
  store.transact(`Ta bort ${s.name}`, (tx) => {
    const files = new Set<Id>();
    for (const el of elements) {
      if (typeof el.params.asset === 'string') files.add(el.params.asset);
      tx.removeElement(el.id);
    }
    pruneAssets(tx, files);
    for (const el of Object.values(tx.doc.elements)) if (el.storey === id) tx.putElement({ ...el, storey: other });
    tx.setViews(tx.doc.views.filter((v) => !gone.has(v.id)).map((v) => (v.storey === id ? { ...v, storey: other } : v)));
    if (tx.doc.sheets.some((sh) => sh.viewports.some((vp) => gone.has(vp.view))))
      tx.setField('sheets', tx.doc.sheets.map((sh) => ({ ...sh, viewports: sh.viewports.filter((vp) => !gone.has(vp.view)) })));
    if (tx.doc.tree[id]) {
      const { [id]: _, ...tree } = tx.doc.tree;
      tx.setField('tree', tree);
    }
    tx.setStoreys(tx.doc.storeys.filter((x) => x.id !== id));
  });
  return true;
}

/**
 * Det som kan flyttas mellan våningar: modellen och planens ritning, inte det
 * som hör till projektet eller ritats i en fasad eller på ett blad. Marken
 * och platsens objekt (`onSite`) stannar på Platsen (0.10.25).
 */
function movable(doc: ProjectDoc, ids: readonly Id[], target: Id): Element[] {
  const stays = (id: Id) => !isSite(target) && !!typeOf(doc.elements[id].type)?.onSite;
  const pick = new Set(ids.filter((id) => doc.elements[id] && !doc.elements[id].space && !typeOf(doc.elements[id].type)?.everyStorey && !stays(id)));
  for (const id of [...pick]) if (doc.elements[id].host && !pick.has(doc.elements[id].host!)) pick.delete(id);
  // Dörrar och fönster följer sin vägg.
  for (const e of Object.values(doc.elements)) if (e.host && pick.has(e.host)) pick.add(e.id);
  return [...pick].map((id) => doc.elements[id]);
}

/**
 * Flytta eller kopiera det markerade till en annan våning, på samma ställe i
 * plan och i samma tillstånd. Dörrar och fönster följer sin vägg; markerade öppningar utan sin vägg
 * stannar. Svarar med de nya (eller flyttade) objektens id, utan öppningarna.
 */
export function toStorey(store: DocStore, ids: readonly Id[], target: Id, copy: boolean, state: Id): Id[] {
  const doc = store.doc;
  const t = doc.storeys.find((s) => s.id === target);
  if (!t) return [];
  const els = movable(doc, ids, target).filter((e) => e.storey !== target);
  if (!els.length) return [];
  if (copy) {
    const clip = copyPayload(doc, els.map((e) => e.id), els[0].storey);
    return clip ? pasteClip(store, clip, state, target, [0, 0], undefined, true) : [];
  }
  store.transact(`Flytta till ${t.name}`, (tx) => {
    for (const el of els) tx.putElement({ ...el, storey: target });
  });
  return els.filter((e) => !e.host).map((e) => e.id);
}
