// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import { newId } from './ids';
import { buildingStoreys, isSite, storeysUpFrom, withSiteLast, type Id, type ProjectDoc, type Storey } from './model';
import type { DocStore } from './store';

/**
 * Våningsplanen (0.9): skapa, ändra och ta bort våningar, och flytta eller
 * kopiera objekt mellan dem. Objektens koordinater gäller per våning, så en
 * våning som flyttas i höjd tar med sig allt på den.
 */

/** Våningen närmast över (`1`) eller under (`-1`), om det finns någon. */
export function neighbourStorey(doc: Pick<ProjectDoc, 'storeys'>, id: Id, dir: 1 | -1): Storey | undefined {
  const up = storeysUpFrom(doc);
  const i = up.findIndex((s) => s.id === id);
  return i < 0 ? undefined : up[i + dir];
}

/** Kalkera våningen under eller över (0.9), som värde för vyns `trace` i stället för en vy. */
export const TRACE_BELOW = 'våning:under';
export const TRACE_ABOVE = 'våning:över';
/** Kalkera Platsen (0.10.25): marken under en våningsplan. */
export const TRACE_SITE = 'våning:platsen';
/** Kalkera en viss våning (0.10.30), från högerklick i projektträdet: `våning:id:` och våningens id. */
export const TRACE_STOREY = 'våning:id:';

/** Våningen som kalkeras, om `trace` är våningen under eller över eller Platsen. */
export function tracedStorey(doc: Pick<ProjectDoc, 'storeys'>, storey: Id, trace: Id | null | undefined): Storey | undefined {
  if (trace === TRACE_BELOW) return neighbourStorey(doc, storey, -1);
  if (trace === TRACE_ABOVE) return neighbourStorey(doc, storey, 1);
  if (trace === TRACE_SITE && !isSite(storey)) return doc.storeys.find((s) => s.site);
  if (trace?.startsWith(TRACE_STOREY)) {
    const id = trace.slice(TRACE_STOREY.length);
    return id === storey ? undefined : doc.storeys.find((s) => s.id === id);
  }
  return undefined;
}


/** Ett namn för en ny våning: Plan 2, Plan 3 … uppåt, Källarplan nedåt. */
function newStoreyName(doc: Pick<ProjectDoc, 'storeys'>, where: 'above' | 'below'): string {
  const names = new Set(doc.storeys.map((s) => s.name));
  if (where === 'above') {
    const nums = doc.storeys.map((s) => /^Plan (\d+)$/.exec(s.name)).filter(Boolean).map((m) => Number(m![1]));
    let n = nums.length ? Math.max(...nums) + 1 : buildingStoreys(doc).length + 1;
    while (names.has(`Plan ${n}`)) n++;
    return `Plan ${n}`;
  }
  if (!names.has('Källarplan')) return 'Källarplan';
  let n = 2;
  while (names.has(`Källarplan ${n}`)) n++;
  return `Källarplan ${n}`;
}

/**
 * En ny våning ovanför eller under en annan, med samma våningshöjd. Golvnivån
 * räknas från grannen; våningarna som redan ligger ovanför (eller under)
 * flyttas lika mycket, så att ingen hamnar på samma nivå. Svarar med id.
 */
export function addStorey(store: DocStore, from: Id, where: 'above' | 'below'): Id | null {
  const s = store.doc.storeys.find((x) => x.id === from);
  if (!s || s.site) return null;
  const id = newId('pl');
  const name = newStoreyName(store.doc, where);
  const height = s.height;
  const elevation = where === 'above' ? s.elevation + s.height : s.elevation - height;
  store.transact(`Ny våning ${name}`, (tx) => {
    // Platsen står kvar vid ±0 och sist i listan (0.10.25).
    const moved = tx.doc.storeys.map((x) =>
      x.site ? x : where === 'above' && x.elevation > s.elevation ? { ...x, elevation: x.elevation + height } : where === 'below' && x.elevation < s.elevation ? { ...x, elevation: x.elevation - height } : x,
    );
    tx.setStoreys(withSiteLast([...moved, { id, name, elevation, height }]));
  });
  return id;
}

/**
 * Ändra en vånings namn, golvnivå och höjd. Ändras våningshöjden flyttas
 * våningarna ovanför lika mycket, så att golv möter golv som förut.
 */
export function storeyPatch(doc: Pick<ProjectDoc, 'storeys'>, id: Id, patch: Partial<Omit<Storey, 'id'>>): Storey[] {
  const s = doc.storeys.find((x) => x.id === id);
  if (!s) return doc.storeys;
  // Platsen ändras inte: den heter Platsen, ligger vid ±0 och flyttas inte med husets våningar (0.10.25).
  if (s.site) return doc.storeys;
  const dh = patch.height !== undefined ? patch.height - s.height : 0;
  return doc.storeys.map((x) => (x.id === id ? { ...x, ...patch } : dh && !x.site && x.elevation > s.elevation ? { ...x, elevation: x.elevation + dh } : x));
}
