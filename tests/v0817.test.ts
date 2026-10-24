import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { moveElements, updateParams } from '../src/core/commands';
import { rotateElements } from '../src/core/transforms';
import { DocStore } from '../src/core/store';
import type { Element, ProjectDoc } from '../src/core/model';
import { buildPlan } from '../src/repr/plan';
import { sampleProject } from '../src/sample/sampleProject';
import { pointInRings } from '../src/geometry/vec';
import type { Primitive, Vec2 } from '../src/repr/primitives';

beforeAll(() => registerBuiltInTypes());

const viewOf = (doc: ProjectDoc) => ({ state: doc.states[doc.states.length - 1].id, compareTo: doc.states[0].id });

function setup() {
  const store = new DocStore(sampleProject());
  const room = Object.values(store.doc.elements).find((e) => e.type === 'Space') as Element;
  return { store, id: room.id };
}

function stampOf(doc: ProjectDoc, id: string): Primitive[] {
  const plan = buildPlan(doc, doc.elements[id].storey, viewOf(doc));
  return plan.pickables.find((p) => p.id === id)!.prims.filter((q) => q.origin?.part === 'rumstext');
}

const outlineOf = (doc: ProjectDoc, id: string) => {
  const plan = buildPlan(doc, doc.elements[id].storey, viewOf(doc));
  const region = plan.pickables.find((p) => p.id === id)!.regions[0];
  return region?.[0] as Vec2[] | undefined;
};

describe('rumsstämpeln (0.8.17)', () => {
  it('står i mitten utan labelAt och har ingen pil', () => {
    const { store, id } = setup();
    const prims = stampOf(store.doc, id);
    expect(prims.every((q) => q.kind === 'text')).toBe(true);
  });

  it('kan flyttas inom rummet, utan pil', () => {
    const { store, id } = setup();
    const before = stampOf(store.doc, id).filter((q) => q.kind === 'text') as Extract<Primitive, { kind: 'text' }>[];
    const at = (store.doc.elements[id].params as { seed: [number, number] }).seed;
    updateParams(store, [id], { labelAt: [at[0] + 300, at[1] + 200] });
    const after = stampOf(store.doc, id);
    expect(after.every((q) => q.kind === 'text')).toBe(true);
    const moved = after as Extract<Primitive, { kind: 'text' }>[];
    // Alla rader flyttas lika mycket.
    const dx = moved[0].at[0] - before[0].at[0];
    const dy = moved[0].at[1] - before[0].at[1];
    moved.forEach((q, i) => {
      expect(q.at[0] - before[i].at[0]).toBeCloseTo(dx);
      expect(q.at[1] - before[i].at[1]).toBeCloseTo(dy);
    });
  });

  it('utanför rummet får den en pil vars spets ligger i rummet', () => {
    const { store, id } = setup();
    const ring = outlineOf(store.doc, id);
    const xs = (ring ?? (store.doc.elements[id].params as { outline: Vec2[] }).outline).map((q) => q[0]);
    const ys = (ring ?? (store.doc.elements[id].params as { outline: Vec2[] }).outline).map((q) => q[1]);
    const outside: [number, number] = [Math.max(...xs) + 6000, (Math.min(...ys) + Math.max(...ys)) / 2];
    updateParams(store, [id], { labelAt: outside });
    const lines = stampOf(store.doc, id).filter((q): q is Extract<Primitive, { kind: 'line' }> => q.kind === 'line');
    expect(lines).toHaveLength(3);
    const outline = (ring ?? (store.doc.elements[id].params as { outline: Vec2[] }).outline) as Vec2[];
    expect(pointInRings(lines[0].b, [outline])).toBe(true);
    expect(pointInRings(lines[0].a, [outline])).toBe(false);
  });

  it('följer med när rummet flyttas eller vrids', () => {
    const { store, id } = setup();
    updateParams(store, [id], { labelAt: [1000, 2000] });
    moveElements(store, [id], [500, -100]);
    expect((store.doc.elements[id].params as { labelAt: number[] }).labelAt).toEqual([1500, 1900]);
    rotateElements(store, [id], [0, 0], 90);
    const q = (store.doc.elements[id].params as { labelAt: number[] }).labelAt;
    expect(q[0]).toBeCloseTo(-1900);
    expect(q[1]).toBeCloseTo(1500);
  });

  it('Stämpeln i mitten tar bort läget', () => {
    const { store, id } = setup();
    updateParams(store, [id], { labelAt: [1000, 2000] });
    updateParams(store, [id], { labelAt: undefined });
    expect(JSON.parse(JSON.stringify(store.doc.elements[id].params)).labelAt).toBeUndefined();
    expect(stampOf(store.doc, id).every((q) => q.kind === 'text')).toBe(true);
  });
});
