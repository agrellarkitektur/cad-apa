import { beforeAll, describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { buildPlan } from '../src/repr/plan';
import { modelShapes, WITH_DEMOLISHED } from '../src/repr/storeyShapes';
import { registerBuiltInTypes } from '../src/elements';
import { slabRings } from '../src/elements/slab';
import { createContext } from '../src/repr/context';
import { defaultSheet } from '../src/core/viewCategories';
import { mirrorElements } from '../src/core/transforms';
import { twoStoreys } from './projekt';
import { stairGeometry, stairWarnings, type StairParams } from '../src/elements/stairGeometry';
import { applyStairField } from '../src/ui/stairFields';
import { addRailingsOnStair } from '../src/ui/railingFields';
import { railingPath } from '../src/elements/railing';
import type { Vec2 } from '../src/repr/primitives';

/**
 * Spiraltrappan (0.11.5): referenslinjen är en båge runt mitten, med inner-
 * och ytterdiameter, grader och varvriktning; planen döljer det som ligger
 * mer än ett varv under det som syns.
 */

const spiral = (s: Partial<NonNullable<StairParams['spiral']>> = {}): StairParams => ({ line: [[0, 0], [1000, 0]], width: 1, rise: 2700, spiral: { inner: 200, outer: 1800, sweep: 360, ...s } });
const r = (q: Vec2) => Math.hypot(q[0], q[1]);

describe('Spiraltrappans geometri (0.11.5)', () => {
  it('ligger mellan inner- och ytterradien, med gånglinjen 300 från utsidan och ett varv på 360°', () => {
    const g = stairGeometry(spiral())!;
    expect(g.width).toBe(800);
    expect(g.turn).toBeCloseTo(g.length);
    for (const u of [0.25, 0.5, 0.75].map((k) => k * g.length)) {
      const rib = g.ribAt(u);
      expect(Math.min(r(rib.L), r(rib.R))).toBeCloseTo(100, -1);
      expect(Math.max(r(rib.L), r(rib.R))).toBeCloseTo(900, -1);
      expect(r(rib.w)).toBeCloseTo(600, -1);
    }
    expect(g.risers).toHaveLength(15);
    expect(g.runs[0].going).toBeGreaterThan(250);
    // Moturs: en fjärdedel in ligger trappan uppåt (positivt y); medurs nedåt.
    expect(g.ribAt(g.length / 4).w[1]).toBeGreaterThan(500);
    expect(stairGeometry(spiral({ dir: 'cw' }))!.ribAt(g.length / 4).w[1]).toBeLessThan(-500);
  });

  it('går också mer än ett varv, och utan mittpelare', () => {
    const g = stairGeometry(spiral({ sweep: 540, inner: 0 }))!;
    expect(g.length / g.turn!).toBeCloseTo(1.5);
    expect(g.width).toBe(900);
    expect(g.ribAt(g.length).w[0]).toBeCloseTo(-600, -1);
    // Varningen för bredden räknas ur diametrarna.
    expect(stairWarnings(spiral(), stairGeometry(spiral())!).some((w) => w.startsWith('Bredden är 800'))).toBe(true);
  });
});

beforeAll(() => registerBuiltInTypes());

function withSpiral(s: Partial<NonNullable<StairParams['spiral']>> = {}) {
  const doc = twoStoreys();
  doc.elements.tr = { id: 'tr', type: 'Stair', storey: 'pl-1', states: ['st-a', 'st-b'], tags: [], props: {}, params: { line: [[3000, 4000], [4000, 4000]], width: 800, spiral: { inner: 200, outer: 1800, sweep: 360, ...s } } } as any;
  return new DocStore(doc);
}
const prims = (store: DocStore, storey: string) => buildPlan(store.doc, storey, { state: 'st-a' }).prims.filter((q) => q.origin?.objectId === 'tr');

describe('Spiraltrappan i ritningarna (0.11.5)', () => {
  it('ritar planen med snittet, mittpelaren och i våningen ovanför bara det sista varvet', () => {
    const own = prims(withSpiral({ sweep: 540 }), 'pl-1');
    const part = new Set(own.map((q) => q.origin!.part));
    expect(part.has('över')).toBe(true);
    expect(part.has('snittlinje')).toBe(true);
    expect(part.has('pelare')).toBe(true);
    // Våningen ovanför: 1,5 varv, men bara det sista varvets steg syns (de under täcks).
    const all = prims(withSpiral({ sweep: 540 }), 'pl-2').filter((q) => q.origin!.part === 'steg').length;
    const one = prims(withSpiral({ sweep: 360 }), 'pl-2').filter((q) => q.origin!.part === 'steg').length;
    expect(all).toBeLessThan(one);
    expect(all).toBeGreaterThan(one / 2);
  });

  it('tar ett runt hål med ytterdiametern när det går ett helt varv, och bygger kroppen i 3D med pelaren', () => {
    const store = withSpiral({ sweep: 540 });
    const ctx = createContext(store.doc, 'pl-2', { state: 'st-a' }, defaultSheet(store.doc.graphics), () => true).ctx;
    const rings = slabRings(ctx, store.doc.elements['bj1-2']).flat();
    const hole = rings.find((ring) => ring.length >= 60);
    expect(hole).toBeDefined();
    expect(Math.hypot(hole![0][0] - 3000, hole![0][1] - 4000)).toBeCloseTo(900, 0);
    const shapes = modelShapes(store.doc, { state: 'st-a' }, defaultSheet(store.doc.graphics), WITH_DEMOLISHED).shapes.map((x) => x.s).filter((s) => s.id === 'tr' && s.kind !== 'edges');
    expect(shapes.length).toBe(15);
  });

  it('ändras i panelen: diametrarna ger bredden, stegdjupet ger graderna, spegling byter varvriktning', () => {
    const store = withSpiral();
    const field = (value: string) => ({ value, checked: false }) as unknown as HTMLSelectElement;
    expect(applyStairField(store, ['tr'], 'outer', field('2000'))).toBe(true);
    expect(store.doc.elements.tr.params.width).toBe(900);
    expect(applyStairField(store, ['tr'], 'inner', field('1900'))).toBe(true);
    expect((store.doc.elements.tr.params.spiral as any).outer).toBe(2200);
    expect(applyStairField(store, ['tr'], 'inner', field('200'))).toBe(true);
    const before = (store.doc.elements.tr.params.spiral as any).sweep;
    expect(applyStairField(store, ['tr'], 'going', field('400'))).toBe(true);
    expect((store.doc.elements.tr.params.spiral as any).sweep).toBeGreaterThan(before);
    mirrorElements(store, ['tr'], [0, 0]);
    expect((store.doc.elements.tr.params.spiral as any).dir).toBe('cw');
  });

  it('får räcken längs kanterna, som följer helixen uppåt', () => {
    const store = withSpiral({ sweep: 450 });
    const ids = addRailingsOnStair(store, 'tr', ['left', 'right']);
    expect(ids).toHaveLength(2);
    for (const id of ids) {
      const path = railingPath(store.doc, store.doc.elements[id])!;
      expect(path.pts.length).toBeGreaterThan(20);
      expect(Math.max(...path.z) - Math.min(...path.z)).toBeGreaterThan(2000);
    }
  });
});
