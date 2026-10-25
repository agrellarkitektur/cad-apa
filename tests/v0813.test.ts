import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { joinLines, joinWalls, splitLine, splitWallAt, trimLine, trimPath, trimWall } from '../src/core/trimEdit';
import { cornersAmong, roundCorners } from '../src/core/wallEdit';
import { RAIL_ITEMS, railFor, type ModifyHost } from '../src/ui/modify/ops';
import { wallEnds as ends, wallsProject as project } from './projekt';

beforeAll(() => registerBuiltInTypes());

type P = [number, number];

describe('Trimma (0.8.13)', () => {
  it('tar bort biten mellan skärningarna närmast klicket', () => {
    const cutters = [
      { a: [3000, -1000] as P, b: [3000, 1000] as P },
      { a: [6000, -1000] as P, b: [6000, 1000] as P },
    ];
    const line: P[] = [[0, 0], [10000, 0]];
    expect(trimPath(line, cutters, [4500, 10])!.pieces).toEqual([[[0, 0], [3000, 0]], [[6000, 0], [10000, 0]]]);
    expect(trimPath(line, cutters, [8000, 0])!.pieces).toEqual([[[0, 0], [6000, 0]]]);
    // Inget som korsar: ingenting att trimma.
    expect(trimPath([[0, 0], [2000, 0]], cutters, [1000, 0])).toBeNull();
  });

  it('kortar en vägg mot en annan, eller delar den i två', () => {
    const store = project({ a: [[0, 0], [10000, 0]], b: [[3000, -2000], [3000, 2000]], c: [[6000, -2000], [6000, 2000]] });
    expect(trimWall(store, 'a', [8000, 50]).ok).toBe(true);
    expect(ends(store, 'a')).toEqual([[0, 0], [6000, 0]]);
    store.undo();
    const r = trimWall(store, 'a', [4500, 0]);
    expect(r.ok && r.ids.length).toBe(2);
    const second = r.ok ? r.ids[1] : '';
    expect(ends(store, 'a')).toEqual([[0, 0], [3000, 0]]);
    expect(ends(store, second)).toEqual([[6000, 0], [10000, 0]]);
    // Ett steg att ångra.
    store.undo();
    expect(store.doc.elements[second]).toBeUndefined();
    expect(ends(store, 'a')).toEqual([[0, 0], [10000, 0]]);
  });

  it('trimmar en 2D-linje mot en annan', () => {
    const store = project({}, { l: [[0, 0], [4000, 0]] });
    expect(trimLine(store, 'l', [{ a: [1000, -500], b: [1000, 500] }], [3000, 0]).ok).toBe(true);
    expect(store.doc.elements.l.params.points).toEqual([[0, 0], [1000, 0]]);
  });
});

describe('Hörnskarv (0.8.13)', () => {
  it('förlänger och kortar två väggar till ett hörn', () => {
    // a slutar före hörnet, b går förbi det.
    const store = project({ a: [[0, 0], [3000, 0]], b: [[5000, -1000], [5000, 4000]] });
    expect(joinWalls(store, 'a', [1000, 0], 'b', [5000, 2000]).ok).toBe(true);
    expect(ends(store, 'a')).toEqual([[0, 0], [5000, 0]]);
    expect(ends(store, 'b')).toEqual([[5000, 0], [5000, 4000]]);
  });

  it('parallella väggar och linjer går inte', () => {
    const store = project({ a: [[0, 0], [3000, 0]], b: [[0, 1000], [3000, 1000]] }, { l: [[0, 0], [10, 0]], m: [[0, 5], [10, 5]] });
    expect(joinWalls(store, 'a', [1000, 0], 'b', [1000, 1000]).ok).toBe(false);
    expect(joinLines(store, 'l', [5, 0], 'm', [5, 5]).ok).toBe(false);
  });
});

describe('Dela (0.8.13)', () => {
  it('delar en vägg och en polylinje utan att lägga till ett hörn', () => {
    const store = project({ a: [[0, 0], [4000, 0]] }, { p: [[0, 0], [2000, 0], [2000, 2000]] });
    expect(splitWallAt(store, 'a', [1500, 0]).ok).toBe(true);
    expect(ends(store, 'a')).toEqual([[0, 0], [1500, 0]]);
    const s = splitLine(store, 'p', [2000, 500]);
    expect(s.ok).toBe(true);
    expect(store.doc.elements.p.params.points).toEqual([[0, 0], [2000, 0], [2000, 500]]);
    const copy = s.ok ? store.doc.elements[s.ids[1]] : undefined;
    expect(copy?.params.points).toEqual([[2000, 500], [2000, 2000]]);
    expect(copy?.params.shape).toBe('polyline');
  });
});

describe('Avrunda och fasa hela markeringen (0.8.13)', () => {
  it('gör alla hörn mellan de markerade väggarna i ett steg', () => {
    const store = project({ s: [[0, 0], [6000, 0]], e: [[6000, 0], [6000, 6000]], n: [[6000, 6000], [0, 6000]], w: [[0, 6000], [0, 0]] });
    expect(cornersAmong(store.doc, ['s', 'e', 'n', 'w'])).toHaveLength(4);
    expect(cornersAmong(store.doc, ['s', 'e'])).toHaveLength(1);
    const before = Object.keys(store.doc.elements).length;
    expect(roundCorners(store, ['s', 'e', 'n', 'w'], 1000, 'fillet')).toEqual({ done: 4, skipped: 0 });
    expect(Object.keys(store.doc.elements).length).toBe(before + 4);
    expect(ends(store, 's')).toEqual([[1000, 0], [5000, 0]]);
    store.undo();
    expect(Object.keys(store.doc.elements).length).toBe(before);
    // För stort: inget går.
    expect(roundCorners(store, ['s', 'e', 'n', 'w'], 4000, 'chamfer').done).toBe(0);
  });
});

describe('kortkommandon (0.8.13)', () => {
  it('varje knapp i raden har en egen bokstav, inte Z', () => {
    const keys = RAIL_ITEMS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain('Z');
    for (const k of keys) expect(k).toMatch(/^[A-Z]$/);
  });

  it('raden tänder Trimma, Hörnskarv och Dela för väggar', () => {
    const store = project({ a: [[0, 0], [4000, 0]] });
    const on = railFor({ store } as unknown as ModifyHost, ['a']);
    for (const id of ['trim', 'join', 'split'] as const) expect(on.has(id)).toBe(true);
  });
});
