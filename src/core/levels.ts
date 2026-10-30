import { resolveParams } from '../elements/registry';
import { levelOf } from '../repr/solids';
import type { Element, Id, ProjectDoc } from './model';
import type { DocStore } from './store';

/*
 * Höjder i förhållande till våningen (0.10.13). Väggar, bjälklag och möbler
 * har en nivå mot våningens golv (`level`, mm, plus eller minus): väggens
 * fot, bjälklagets ovansida och möbelns undersida. Taket har redan sin höjd
 * över golvet. Dörrar och fönster följer väggens fot.
 */

/** Typer som har en nivå mot våningen. */
const WITH_LEVEL = new Set(['Wall', 'Slab', 'Furniture', 'Stair']);

/** Om objektet har en nivå mot våningen. */
export function hasLevel(el: Element | undefined): boolean {
  return !!el && WITH_LEVEL.has(el.type);
}

/** Om objektet kan flyttas i höjd: de med en nivå, och taken. */
export function movesVertically(el: Element | undefined): boolean {
  return hasLevel(el) || el?.type === 'Roof';
}

/** Ett tal som sparas: 0 sparas inte. */
const stored = (v: number): number | undefined => (Math.round(v) === 0 ? undefined : Math.round(v));

/**
 * Ny nivå mot våningen ur egenskaperna. En vägg flyttar bara foten: toppen
 * ligger kvar och höjden räknas om (Carl August 27 oktober). Ger false om
 * väggen skulle bli lägre än 10 mm.
 */
export function setLevel(store: DocStore, ids: readonly Id[], level: number): boolean {
  const doc = store.doc;
  const patches: [Id, Record<string, unknown>][] = [];
  for (const id of ids) {
    const el = doc.elements[id];
    if (!hasLevel(el)) continue;
    if (el.type === 'Wall') {
      const p = resolveParams<{ height: number; level?: number }>(doc, el);
      const height = p.height - (level - levelOf(p));
      if (height < 10) return false;
      patches.push([id, { level: stored(level), height: Math.round(height) }]);
    } else patches.push([id, { level: stored(level) }]);
  }
  if (!patches.length) return true;
  store.transact('Nivå mot våningen', (tx) => {
    for (const [id, patch] of patches) {
      const el = tx.doc.elements[id];
      if (el) tx.putElement({ ...el, params: { ...el.params, ...patch } });
    }
  });
  return true;
}

/**
 * Flytta i höjd (Modifiera): hela objektet flyttas `dz` mm, med väggens
 * topp, bjälklagets tjocklek och takets lutning som de är. Låsta objekt
 * flyttas inte. Svarar med hur många som flyttades.
 */
export function moveVertically(store: DocStore, ids: readonly Id[], dz: number): number {
  const doc = store.doc;
  const d = Math.round(dz);
  if (!d) return 0;
  const patches = ids.flatMap((id): [Id, Record<string, unknown>][] => {
    const el = doc.elements[id];
    if (!el || el.locked || !movesVertically(el)) return [];
    if (el.type === 'Roof') return [[id, { height: Math.round(resolveParams<{ height: number }>(doc, el).height + d) }]];
    return [[id, { level: stored(levelOf(resolveParams<{ level?: number }>(doc, el)) + d) }]];
  });
  if (!patches.length) return 0;
  store.transact(d > 0 ? 'Flytta upp' : 'Flytta ned', (tx) => {
    for (const [id, patch] of patches) {
      const el = tx.doc.elements[id];
      if (el) tx.putElement({ ...el, params: { ...el.params, ...patch } });
    }
  });
  return patches.length;
}

/** Nivån som visas i egenskaperna, eller null om de markerade har olika. */
export function commonLevel(doc: ProjectDoc, els: readonly Element[]): number | null {
  const v = els.filter(hasLevel).map((el) => levelOf(resolveParams<{ level?: number }>(doc, el)));
  return v.length && v.every((x) => x === v[0]) ? v[0] : null;
}
