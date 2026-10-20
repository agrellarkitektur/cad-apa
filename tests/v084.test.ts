import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { setSkewOk, updateParams } from '../src/core/commands';
import { DocStore } from '../src/core/store';
import { serialize, parse } from '../src/storage/format';
import { skewOf, skewWarnings } from '../src/elements/angleCheck';
import { sampleProject } from '../src/sample/sampleProject';

beforeAll(() => registerBuiltInTypes());

describe('varningen för sneda vinklar per element (0.8.4)', () => {
  it('kan stängas av för en vägg, sparas i filen och ångras', () => {
    const store = new DocStore(sampleProject());
    updateParams(store, ['iv-1'], { start: [5000, 400], end: [5060, 7600] });
    expect(skewWarnings(store.doc, 'pl-1', 'st-a', 5).map((w) => w.id)).toEqual(['iv-1']);

    setSkewOk(store, ['iv-1'], true);
    expect(skewWarnings(store.doc, 'pl-1', 'st-a', 5)).toHaveLength(0);
    expect(skewOf(store.doc, store.doc.elements['iv-1'], 5)).toBeNull();
    // Egenskaperna räknar ändå, för raden som slår på varningen igen.
    expect(skewOf(store.doc, store.doc.elements['iv-1'], 5, true)?.nearest).toBe(90);
    expect(parse(serialize(store.doc)).elements['iv-1'].skewOk).toBe(true);

    store.undo();
    expect(store.doc.elements['iv-1'].skewOk).toBeUndefined();
    expect(skewWarnings(store.doc, 'pl-1', 'st-a', 5)).toHaveLength(1);
  });
});

describe('Tab mellan objekt på varandra (0.8.4)', () => {
  it('pickAllAt börjar med det pickAt väljer och tar med allt under punkten', async () => {
    const { pickAllAt, pickAt } = await import('../src/view2d/pick');
    const { buildPlan } = await import('../src/repr/plan');
    const doc = sampleProject();
    const plan = buildPlan(doc, 'pl-1', { state: 'st-a' });
    let tried = 0;
    let stacked = 0;
    for (const item of plan.pickables.slice(0, 60)) {
      const ring = item.regions[0]?.[0];
      if (!ring?.length) continue;
      const q = ring[0];
      const all = pickAllAt(plan.pickables, q, 20);
      expect(all[0] ?? null).toBe(pickAt(plan.pickables, q, 20));
      expect(new Set(all).size).toBe(all.length);
      tried++;
      if (all.length > 1) stacked++;
    }
    expect(tried).toBeGreaterThan(5);
    expect(stacked).toBeGreaterThan(0);
  });
});

describe('flytta med måttbandet (0.8.4)', () => {
  it('flyttar längs sträckan så att avståndet blir det inskrivna', async () => {
    const { moveAlong } = await import('../src/ui/tools/measureTool');
    expect(moveAlong([0, 0], [1000, 0], 1200)).toEqual([200, 0]);
    expect(moveAlong([0, 0], [0, 1000], 600)).toEqual([0, -400]);
    const d = moveAlong([0, 0], [300, 400], 1000);
    expect(Math.hypot(300 + d[0], 400 + d[1])).toBeCloseTo(1000, 1);
    expect(moveAlong([5, 5], [5, 5], 100)).toEqual([0, 0]);
  });
});
