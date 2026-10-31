import { beforeAll, describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { defaultRailingTypes, type RailingTypeModel } from '../src/core/railingTypes';
import { registerBuiltInTypes } from '../src/elements';
import { railingSolids } from '../src/elements/railing';
import { alongFinishes, DROP, railingBody } from '../src/elements/railingBody';
import { freePath } from '../src/elements/railingGeometry';
import { stairGeometry, stairWarnings, type StairParams } from '../src/elements/stairGeometry';
import { buildPlan } from '../src/repr/plan';
import { applyStairField } from '../src/ui/stairFields';
import { twoStoreys } from './projekt';

/**
 * 0.11.7.2: räckets avslut Böjd nedåt och Mot vägg, spiraltrappans fria höjd
 * under nästa varv, mittpelarens material och stegnumren under Visa.
 */

beforeAll(() => registerBuiltInTypes());

const VALS = new Map([['Skyddshöjd', 900], ['Ledstångshöjd', 860], ['Förlängning', 300], ['Spjälöppning', 100]]);
const type = (i: number): RailingTypeModel => structuredClone(defaultRailingTypes()[i].railing!);
const path = freePath({ line: [[0, 0], [3000, 0]], z: [0, 0] })!;

describe('Räckets avslut (0.11.7.2)', () => {
  it('Böjd nedåt går 100 mm ned under ledstången i båda ändarna, efter förlängningen', () => {
    const body = railingBody(path, type(0), VALS);
    const a = body.along.find((x) => x.part.finish === 'down')!;
    const f = alongFinishes(a);
    expect(f.map((x) => x.kind)).toEqual(['down', 'down']);
    expect(f[0].at[0]).toBeCloseTo(-300);
    expect(f[1].at[0]).toBeCloseTo(3300);
    expect(f[0].top - f[0].z0).toBeCloseTo(a.h + DROP);
    // I 3D: en lodrät bit till per ände, 100 mm under ledstången.
    const solids = railingSolids('r', { ...body, along: [a], posts: [], repeats: [], panels: [] }, () => ({}));
    expect(solids.filter((s) => s.z1 - s.z0 > a.h + DROP - 1)).toHaveLength(2);
  });

  it('Mot vägg går tillbaka till räckets linje, och inte vid en grind', () => {
    const m = type(2);
    const body = railingBody(path, m, VALS);
    const a = body.along.find((x) => x.part.finish === 'wall')!;
    const f = alongFinishes(a);
    expect(f).toHaveLength(2);
    for (const x of f) {
      expect(Math.abs(x.to[1])).toBeLessThan(1);
      expect(Math.abs(x.at[1])).toBeCloseTo(Math.abs(a.pts[0][1]));
    }
    // En bit som slutar vid en grind har inget avslut där.
    expect(alongFinishes({ ...a, ends: [true, false] })).toHaveLength(1);
    // Rak ger inget.
    expect(alongFinishes({ ...a, part: { ...a.part, finish: 'straight' } })).toHaveLength(0);
  });
});

const spiral = (s: Partial<NonNullable<StairParams['spiral']>> = {}, over: Partial<StairParams> = {}): StairParams => ({ line: [[0, 0], [1000, 0]], width: 1, rise: 2700, spiral: { inner: 200, outer: 1800, sweep: 360, ...s }, ...over });

describe('Spiraltrappan (0.11.7.2)', () => {
  it('varnar när den fria höjden under nästa varv är under 2 000 mm', () => {
    const warns = (p: StairParams) => stairWarnings(p, stairGeometry(p)!).filter((w) => w.startsWith('Den fria höjden'));
    // Ett varv: inget under.
    expect(warns(spiral())).toHaveLength(0);
    // 540° med 15 sättsteg: 10 steg per varv à 180 = 1 800 − 180.
    expect(warns(spiral({ sweep: 540 }))).toHaveLength(1);
    // 450°: drygt 11 steg per varv à 180 − 40 är strax under; 400° ger fler steg per varv.
    expect(warns(spiral({ sweep: 450 }, { build: 'built' }))[0]).toMatch(/1\s976 mm/);
    expect(warns(spiral({ sweep: 400 }, { build: 'built' }))).toHaveLength(0);
  });

  it('mittpelaren får eget material, och det följer med när diametern ändras', () => {
    const doc = twoStoreys();
    doc.elements.tr = { id: 'tr', type: 'Stair', storey: 'pl-1', states: ['st-a', 'st-b'], tags: [], props: {}, params: { line: [[3000, 4000], [4000, 4000]], width: 800, spiral: { inner: 200, outer: 1800, sweep: 360 } } } as any;
    const store = new DocStore(doc);
    const mat = store.doc.graphics.materials?.find((x) => x.building)!;
    expect(applyStairField(store, ['tr'], 'pole', { value: mat.id } as HTMLSelectElement)).toBe(true);
    expect(applyStairField(store, ['tr'], 'outer', { value: '2000' } as HTMLInputElement)).toBe(true);
    expect((store.doc.elements.tr.params.spiral as any).pole).toBe(mat.id);
  });
});

describe('Stegnumren under Visa (0.11.7.2)', () => {
  it('släcks med stairNumbers, utan att resten av trappan försvinner', () => {
    const doc = twoStoreys();
    doc.elements.tr = { id: 'tr', type: 'Stair', storey: 'pl-1', states: ['st-a', 'st-b'], tags: [], props: {}, params: { line: [[1000, 4500], [4500, 4500]], width: 1000 } } as any;
    const parts = (hide: string[]) => buildPlan(doc, 'pl-1', { state: 'st-a', detail: 'detail', hide } as any).prims.filter((q) => q.origin?.objectId === 'tr').map((q) => q.origin!.part);
    expect(parts([])).toContain('stegnummer');
    expect(parts([])).toContain('stegtext');
    const off = parts(['stairNumbers']);
    expect(off).not.toContain('stegnummer');
    expect(off).not.toContain('stegtext');
    expect(off).toContain('steg');
  });
});
