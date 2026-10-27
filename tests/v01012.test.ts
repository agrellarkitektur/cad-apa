import { beforeAll, describe, expect, it } from 'vitest';
import { deleteElements } from '../src/core/commands';
import { DocStore } from '../src/core/store';
import { registerBuiltInTypes } from '../src/elements';
import { computeProfile } from '../src/elements/groundWall';
import { buildSection } from '../src/repr/section';
import { sampleProject } from '../src/sample/sampleProject';
import { twoStoreys } from './projekt';

beforeAll(() => registerBuiltInTypes());

describe('Småjusteringar (0.10.12)', () => {
  it('låst betyder låst: låsta tas inte bort, inte heller en vägg med något låst i sig', () => {
    const store = new DocStore(sampleProject());
    const door = Object.values(store.doc.elements).find((e) => e.type === 'Door' && e.host)!;
    const wall = door.host!;
    const other = Object.values(store.doc.elements).find((e) => e.type === 'Wall' && e.id !== wall && !Object.values(store.doc.elements).some((o) => o.host === e.id))!;
    const shape = Object.values(store.doc.elements).find((e) => e.type === 'Furniture')!;
    store.transact('lås', (tx) => {
      tx.putElement({ ...tx.doc.elements[door.id], locked: true });
      tx.putElement({ ...tx.doc.elements[shape.id], locked: true });
    });
    // En blandad markering: bara det olåsta tas bort.
    const r = deleteElements(store, [wall, other.id, shape.id]);
    expect(r).toEqual({ removed: 1, locked: [wall, shape.id] });
    expect(store.doc.elements[other.id]).toBeUndefined();
    expect(store.doc.elements[wall]).toBeDefined();
    expect(store.doc.elements[door.id]).toBeDefined();
    expect(store.doc.elements[shape.id]).toBeDefined();
  });

  it('stödmurens Över marken mot den högre sidan, eller den lägre', () => {
    // Marken 1 000 på ena sidan, 0 på den andra.
    const ground = (_x: number, y: number) => (y > 0 ? 1000 : 0);
    const ref: [number, number][] = [[0, 0], [6000, 0]];
    expect(computeProfile(ref, 200, { above: 500 }, ground)!.start).toBeCloseTo(1500, 0);
    expect(computeProfile(ref, 200, { above: 500, aboveSide: 'low' }, ground)!.start).toBeCloseTo(500, 0);
  });

  it('bjälklag bakom snittet streckade i sektionen, med en vyinställning', () => {
    const doc = twoStoreys();
    // Ett bjälklag på plan 2 bakom väggarna i sektionen, och inget som snittas där.
    delete doc.elements['bj1-2'];
    doc.elements['bj-bak'] = { ...structuredClone(doc.elements['bj1']), id: 'bj-bak', storey: 'pl-2', params: { thickness: 300, outline: [[1000, 1000], [3000, 1000], [3000, 3000], [1000, 3000]] } };
    const state = doc.states.at(-1)!.id;
    const dashed = (hide?: string[]) =>
      buildSection(doc, 'sektion-a', { state, hide })!.prims.filter((p) => p.kind === 'line' && p.origin?.part === 'dold' && p.origin.objectId === 'bj-bak');
    expect(dashed().length).toBeGreaterThan(0);
    expect(dashed(['hiddenSlabsSection'])).toHaveLength(0);
    // Det snittade bjälklaget ritas som snitt, utan streckade linjer.
    expect(buildSection(twoStoreys(), 'sektion-a', { state })!.prims.some((p) => p.kind === 'line' && p.origin?.part === 'dold')).toBe(false);
  });
});
