import { beforeAll, describe, expect, it } from 'vitest';
import { moveElements } from '../src/core/commands';
import type { ProjectDoc } from '../src/core/model';
import { DocStore } from '../src/core/store';
import { registerBuiltInTypes } from '../src/elements';
import { resolveParams } from '../src/elements/registry';
import { roomHoles } from '../src/elements/rooms';
import { bareWallUnion, type WallParams } from '../src/elements/wall';
import { outsideSide } from '../src/elements/wallSides';
import { roomGrid } from './projekt';

/**
 * Granskningen (0.8.32): rummens hål och husets ytterkontur (vilken sida
 * av en vägg som är ute) räknas ur samma sammanslagning av väggarna, som
 * görs en gång för samma väggar. Ritningarna är desamma (referensritningarna).
 */

beforeAll(() => registerBuiltInTypes());

const wallsOf = (doc: ProjectDoc) =>
  Object.values(doc.elements)
    .filter((e) => e.type === 'Wall')
    .map((e) => ({ id: e.id, p: resolveParams<WallParams>(doc, e) }));

describe('väggarnas sammanslagning (0.8.32)', () => {
  it('samma väggar ger samma sammanslagning, en flyttad vägg en ny', () => {
    const store = new DocStore(roomGrid(3));
    const first = bareWallUnion(wallsOf(store.doc));
    expect(bareWallUnion(wallsOf(store.doc))).toBe(first);
    moveElements(store, [wallsOf(store.doc)[1].id], [100, 0]);
    expect(bareWallUnion(wallsOf(store.doc))).not.toBe(first);
  });

  it('rummen och ytterväggarnas utsida tar den ur samma minne', () => {
    const doc = roomGrid(3);
    const union = bareWallUnion(wallsOf(doc));
    // Hålen är rummen, ytterkanten är husets kontur.
    expect(roomHoles(wallsOf(doc))).toHaveLength(9);
    expect(union).toHaveLength(1);
    expect(bareWallUnion(wallsOf(doc))).toBe(union);
    const outer = Object.values(doc.elements).find((e) => e.type === 'Wall' && e.definition === 't-yv01')!;
    expect(outsideSide(doc, outer)).not.toBeNull();
  });
});
