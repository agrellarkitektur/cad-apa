import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { DocStore } from '../src/core/store';
import { extendAllTo, moveEach, scaleElements, transferSettings, trimAllAt } from '../src/core/arrange';
import { PEN_COLORS, PEN_WEIGHTS } from '../src/elements/drawing2d';
import { alignMoves, alignToLineMoves } from '../src/ui/modify/arrangeTool';
import { wallEnds as ends, wallsProject as project } from './projekt';

beforeAll(() => registerBuiltInTypes());

type P = [number, number];

const pts = (store: DocStore, id: string) => store.doc.elements[id].params.points as P[];

describe('Justera och Fördela', () => {
  const box = (id: string, x0: number, y0: number, x1: number, y1: number) => ({ id, x0, y0, x1, y1 });

  it('lägger vänsterkanterna mot den som ligger längst till vänster', () => {
    const m = alignMoves([box('a', 0, 0, 100, 100), box('b', 300, 50, 350, 80)], 'left');
    expect(m.get('a')).toEqual([0, 0]);
    expect(m.get('b')).toEqual([-300, 0]);
  });

  it('fördelar med lika avstånd mellan objekten och låter de yttersta ligga', () => {
    const m = alignMoves([box('a', 0, 0, 100, 10), box('b', 150, 0, 250, 10), box('c', 900, 0, 1000, 10)], 'distH');
    // Bredd 1000, tre objekt à 100: två mellanrum à 350.
    expect(m.get('b')).toEqual([300, 0]);
    expect(m.has('a')).toBe(false);
    expect(m.has('c')).toBe(false);
  });

  it('mot en linje: den närmaste kanten läggs på linjen', () => {
    const m = alignToLineMoves([{ id: 'a', pts: [[100, 500], [300, 800]] }, { id: 'b', pts: [[100, -900], [300, -400]] }], [0, 0], [1000, 0]);
    expect(m.get('a')).toEqual([0, -500]);
    expect(m.get('b')).toEqual([0, 400]);
  });

  it('flyttar väggar var för sig i ett steg, och anslutna väggar följer med', () => {
    const store = project({ a: [[0, 0], [0, 3000]], b: [[2000, 0], [2000, 3000]], c: [[0, 3000], [2000, 3000]] });
    const n = moveEach(store, new Map([['a', [-500, 0]], ['b', [500, 0]]]), 'Justera');
    expect(n).toBe(2);
    expect(ends(store, 'c')).toEqual([[-500, 3000], [2500, 3000]]);
    store.undo();
    expect(ends(store, 'a')).toEqual([[0, 0], [0, 3000]]);
  });
});

describe('Skala', () => {
  it('skalar 2D-linjer och möbler kring baspunkten men inte väggar', () => {
    const store = project({ w: [[0, 0], [1000, 0]] }, { l: [[100, 100], [300, 100]] }, { f: { type: 'Furniture', params: { origin: [1000, 1000], rotation: 0, width: 900, depth: 600, symbol: 'table' } } });
    expect(scaleElements(store, ['w', 'l', 'f'], [0, 0], 2)).toBe(2);
    expect(pts(store, 'l')).toEqual([[200, 200], [600, 200]]);
    const f = store.doc.elements.f.params as { origin: P; width: number; depth: number };
    expect(f.origin).toEqual([2000, 2000]);
    expect([f.width, f.depth]).toEqual([1800, 1200]);
    expect(ends(store, 'w')).toEqual([[0, 0], [1000, 0]]);
  });
});

describe('Hämta och överför', () => {
  it('ger samma inställningar men behåller form och läge', () => {
    const store = project({}, { a: [[0, 0], [100, 0]], b: [[0, 500], [100, 500]] });
    store.transact('x', (tx) => {
      const a = tx.doc.elements.a;
      tx.putElement({ ...a, params: { ...a.params, weight: 0.7, linetype: 'dashed', color: '#ff0000' } });
      const b = tx.doc.elements.b;
      tx.putElement({ ...b, params: { ...b.params, weight: 0.13 } });
    });
    const r = transferSettings(store, 'a', ['b']);
    expect(r.done).toBe(1);
    const b = store.doc.elements.b.params;
    expect([b.weight, b.linetype, b.color]).toEqual([0.7, 'dashed', '#ff0000']);
    expect(b.points).toEqual([[0, 500], [100, 500]]);
  });

  it('ändrar inte objekt av ett annat slag', () => {
    const store = project({ w: [[0, 0], [1000, 0]] }, { a: [[0, 0], [100, 0]] });
    expect(transferSettings(store, 'a', ['w'])).toEqual({ done: 0, other: 1, locked: 0 });
  });
});

describe('Förläng och trimma flera mot en gräns', () => {
  it('förlänger alla markerade fram till gränsen', () => {
    const store = project({ g: [[0, 5000], [6000, 5000]], a: [[1000, 0], [1000, 2000]], b: [[3000, 0], [3000, 3000]] }, { l: [[5000, 1000], [5000, 0]] });
    const r = extendAllTo(store, ['a', 'b', 'l'], 'g', [{ a: [0, 5000], b: [6000, 5000] }]);
    expect(r.done).toBe(3);
    expect(ends(store, 'a')[1]).toEqual([1000, 5000]);
    expect(ends(store, 'b')[1]).toEqual([3000, 5000]);
    expect(pts(store, 'l')[0]).toEqual([5000, 5000]);
  });

  it('trimmar bort biten på den sida man klickar', () => {
    const store = project({ g: [[0, 2000], [6000, 2000]], a: [[1000, 0], [1000, 4000]], b: [[3000, 0], [3000, 1500]] }, { l: [[5000, 0], [5000, 4000]] });
    const r = trimAllAt(store, ['a', 'b', 'l'], 'g', [{ a: [0, 2000], b: [6000, 2000] }], [2000, 3500]);
    expect(r.done).toBe(2);
    expect(r.skipped).toBe(1);
    expect(ends(store, 'a')).toEqual([[1000, 0], [1000, 2000]]);
    expect(pts(store, 'l')).toEqual([[5000, 0], [5000, 2000]]);
  });
});

describe('Tjocklekstabell', () => {
  it('har en färg för varje tjocklek', () => {
    for (const w of PEN_WEIGHTS.filter((w) => w > 0)) expect(PEN_COLORS[w]).toBeTruthy();
    expect(PEN_COLORS[0.5].name).toBe('Svart');
  });
});
