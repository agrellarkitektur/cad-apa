import type { Id } from './model';
import type { DocStore } from './store';

type P = [number, number];

/**
 * Ändra en kontur (0.7.1, takets till 0.10, nu bjälklagets): lägg till,
 * flytta och ta bort hörn, och förskjut en kant. Konturen är en sluten polygon; kant i går från hörn i
 * till hörn i + 1.
 */

/** En ny punkt på kant i. */
export function insertNode(outline: readonly P[], edge: number, at: readonly [number, number]): P[] {
  const out = outline.map((q) => [q[0], q[1]] as P);
  out.splice(edge + 1, 0, [Math.round(at[0]), Math.round(at[1])]);
  return out;
}

/** Hörn i flyttat. */
export function moveNode(outline: readonly P[], i: number, to: readonly [number, number]): P[] {
  return outline.map((q, k) => (k === i ? ([Math.round(to[0]), Math.round(to[1])] as P) : ([q[0], q[1]] as P)));
}

/** Hörn i borttaget; null om bara tre finns kvar. */
export function removeNode(outline: readonly P[], i: number): P[] | null {
  if (outline.length <= 3) return null;
  return outline.filter((_, k) => k !== i).map((q) => [q[0], q[1]] as P);
}

/**
 * Kant i förskjuten d mm åt vänster sett längs kanten (utåt för en kontur
 * som går moturs). Grannkanterna förlängs eller kortas så att hörnen följer
 * med längs dem. Null om kanten skulle vända sig eller grannarna är
 * parallella med den.
 */
export function offsetEdge(outline: readonly P[], i: number, d: number): P[] | null {
  const n = outline.length;
  const a = outline[i];
  const b = outline[(i + 1) % n];
  const prev = outline[(i - 1 + n) % n];
  const next = outline[(i + 2) % n];
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const len = Math.hypot(ux, uy);
  if (len < 1) return null;
  const nx = -uy / len;
  const ny = ux / len;
  const a2: P = [a[0] + nx * d, a[1] + ny * d];
  // Skär den förskjutna kanten med grannkanternas linjer.
  const hit = (p: P, q: P): P | null => {
    const rx = q[0] - p[0];
    const ry = q[1] - p[1];
    const den = ux * ry - uy * rx;
    if (Math.abs(den) < 1e-9 * len * Math.hypot(rx, ry)) return null;
    const t = ((p[0] - a2[0]) * ry - (p[1] - a2[1]) * rx) / den;
    return [a2[0] + ux * t, a2[1] + uy * t];
  };
  const na = hit(prev, a);
  const nb = hit(b, next);
  if (!na || !nb) return null;
  // Kanten får inte vända riktning.
  if ((nb[0] - na[0]) * ux + (nb[1] - na[1]) * uy <= 1) return null;
  const out = outline.map((q) => [q[0], q[1]] as P);
  out[i] = [Math.round(na[0]), Math.round(na[1])];
  out[(i + 1) % n] = [Math.round(nb[0]), Math.round(nb[1])];
  // Konturen får inte klappa ihop eller vända sig ut och in.
  if (signedArea(out) * signedArea(outline) <= 0 || Math.abs(signedArea(out)) < 1e4) return null;
  return out;
}

function signedArea(outline: readonly P[]): number {
  let a = 0;
  for (let i = 0; i < outline.length; i++) {
    const p = outline[i];
    const q = outline[(i + 1) % outline.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** Konturens riktning: 1 moturs, -1 medurs. */
export function orientation(outline: readonly P[]): 1 | -1 {
  return signedArea(outline) >= 0 ? 1 : -1;
}

export function setOutline(store: DocStore, id: Id, outline: P[], label: string): void {
  const el = store.doc.elements[id];
  if (!el) return;
  store.transact(label, (tx) => tx.putElement({ ...el, params: { ...el.params, outline } }));
}

/**
 * Element med en kontur som ändras med punkter och kanter i Modifiera:
 * bjälklag med ritad kontur (0.9.1; ett bjälklag ur väggarna följer
 * väggarna) och markobjekt (0.10.4). Takfallets kontur ändras sedan 0.10 som en 2D-form (`shapeOf`).
 */
export function hasEditableOutline(el: { type: string; params: Record<string, unknown> } | undefined): boolean {
  if (!el || !Array.isArray(el.params.outline)) return false;
  // Markobjekt (0.10.4) med ritad kontur; platån runt huset och urgrävningen under ett bjälklag följer dem.
  if (el.type === 'Ground') return !el.params.around && !el.params.slab && (el.params.kind === 'area');
  return el.type === 'Slab' && !el.params.fromWalls;
}
