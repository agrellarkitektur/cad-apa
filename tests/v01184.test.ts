import { beforeAll, describe, expect, it } from 'vitest';
import { emptyProject, type Element, type ProjectDoc } from '../src/core/model';
import { DEFAULT_OPENING_TYPES, openingDefinition } from '../src/core/openingTypes';
import { registerBuiltInTypes } from '../src/elements';
import { openingWarnings } from '../src/elements/openingWarnings';
import { stairGeometry, type StairParams } from '../src/elements/stairGeometry';
import { stairWarnings } from '../src/elements/stairWarnings';

/**
 * Granskningen efter 0.11.8 (0.11.8.4): varningarna uppslagna i
 * föreskrifterna. Barnsäkra fönster (BFS 2024:9, 2 kap. 4 §) och öppningen
 * mellan planstegen i en öppen trappa (2 kap. 6 §).
 */

beforeAll(() => registerBuiltInTypes());

function house(storeyElevation: number, win: Record<string, unknown>): ProjectDoc {
  const doc = emptyProject('Hus', 'nybyggnad');
  for (const t of DEFAULT_OPENING_TYPES) doc.definitions[t.id] = openingDefinition(t);
  doc.storeys = doc.storeys.map((s) => (s.id === 'pl-1' ? { ...s, elevation: storeyElevation } : s));
  const base = { storey: 'pl-1', states: ['st-ny'], tags: [] as string[], props: {} };
  doc.elements.w0 = { ...base, id: 'w0', type: 'Wall', definition: 't-yv01', params: { start: [6000, 0], end: [0, 0], justification: 'center' } } as Element;
  doc.elements.f = { ...base, id: 'f', type: 'Window', host: 'w0', definition: 't-of-sid1', params: { at: 2000, heightRef: 'sill', ...win } } as Element;
  return doc;
}

describe('barnsäkra fönster (BFS 2024:9, 2 kap. 4 §)', () => {
  it('spärr under 600, säkerhetsanordning under 1 800, inget när fallhöjden är under 2,0 m', () => {
    const w = (elev: number, sill: number) => openingWarnings(house(elev, { sill }), house(elev, { sill }).elements.f).filter((t) => t.includes('2 kap. 4 §'));
    expect(w(3000, 300)[0]).toMatch(/spärras stängt/);
    expect(w(3000, 1000)[0]).toMatch(/säkerhetsanordning/);
    expect(w(3000, 1900)).toEqual([]);
    expect(w(0, 300)).toEqual([]);
    // Bröstningen räknas in i fallhöjden: 1 500 + 600 ≥ 2 000.
    expect(w(1500, 600)[0]).toMatch(/säkerhetsanordning/);
    expect(w(1500, 300)).toEqual([]);
  });
});

describe('öppen trappa (BFS 2024:9, 2 kap. 6 §)', () => {
  const stair = (riser: number, tread = 40): StairParams => ({ line: [[0, 0], [4000, 0]], width: 1000, rise: 2700, build: 'built', built: { riser: { thickness: riser }, tread: { thickness: tread } } });
  it('varnar när öppningen mellan planstegen är över 100 mm', () => {
    const w = (p: StairParams) => stairWarnings(p, stairGeometry(p)!).filter((t) => t.includes('2 kap. 6 §'));
    expect(w(stair(0))).toHaveLength(1);
    expect(w(stair(0))[0]).toMatch(/^Öppningen mellan planstegen är 1\d\d/);
    expect(w(stair(20))).toEqual([]);
    expect(w(stair(0, 100))).toEqual([]);
  });
});
