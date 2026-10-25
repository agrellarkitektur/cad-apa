import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { DocStore } from '../src/core/store';
import type { Element } from '../src/core/model';
import { fillPrims, shapePrims, type Shape2DParams } from '../src/elements/drawing2d';
import { buildPlan } from '../src/repr/plan';
import type { PolylinePrim, RegionPrim } from '../src/repr/primitives';
import { sampleProject } from '../src/sample/sampleProject';
import { shapeChange, shapeSmartFields } from '../src/ui/shapeFields';

beforeAll(() => registerBuiltInTypes());

const base: Shape2DParams = { shape: 'polyline', points: [], weight: 0.25, linetype: 'solid', fillAngle: 45, fillSpacing: 2 };
const square = (x: number, y: number, s = 1000): [number, number][] => [
  [x, y],
  [x + s, y],
  [x + s, y + s],
  [x, y + s],
];

function storeWith(shapes: Record<string, Partial<Shape2DParams> & { order?: number }>) {
  const doc = sampleProject();
  const storey = doc.storeys[0].id;
  for (const [id, { order, ...p }] of Object.entries(shapes))
    doc.elements[id] = { id, type: 'Shape2D', storey, states: doc.states.map((s) => s.id), tags: [], params: { ...base, ...p }, props: {}, ...(order !== undefined ? { order } : {}) } as Element;
  return new DocStore(doc);
}
const plan = (store: DocStore) => buildPlan(store.doc, store.doc.storeys[0].id, { state: store.doc.states.at(-1)!.id });
const own = (store: DocStore, id: string) => plan(store).prims.filter((q) => q.origin?.objectId === id);

describe('Bakgrund i skrafferingen (0.8.29)', () => {
  it('en bakgrund är en hel yta under strecken, med egen opacitet', () => {
    const fills = fillPrims([square(0, 0)], { fill: 'cross', fillAngle: 45, fillSpacing: 2, fillBackground: '#ffeedd', fillBackgroundOpacity: 40, fillOpacity: 80 }, undefined, true) as RegionPrim[];
    expect(fills.map((f) => f.fill.kind)).toEqual(['solid', 'hatch', 'hatch']);
    expect(fills[0].fill).toMatchObject({ color: '#ffeedd', opacity: 0.4 });
    expect(fills[1].fill).toMatchObject({ opacity: 0.8 });
  });

  it('en hel fyllning får ingen bakgrund, och utan bakgrund är allt som förut', () => {
    expect(fillPrims([square(0, 0)], { fill: 'solid', fillAngle: 45, fillSpacing: 2, fillBackground: '#ffffff' }, undefined, true)).toHaveLength(1);
    expect(fillPrims([square(0, 0)], { fill: 'hatch', fillAngle: 45, fillSpacing: 2 }, undefined, true)).toHaveLength(1);
  });

  it('en bakgrund med 100 % döljer linjerna under, med lägre opacitet inte', () => {
    const lines = (o?: number) =>
      own(
        storeWith({
          under: { points: square(50000, 0), closed: true, order: 0 },
          over: { points: square(50500, 500), closed: true, fill: 'hatch', fillBackground: '#ffffff', fillBackgroundOpacity: o, order: 1 },
        }),
        'under',
      ).filter((q): q is PolylinePrim => q.kind === 'polyline' && q.pen.weight > 0);
    expect(lines().length).toBeGreaterThan(1);
    expect(lines(60)).toHaveLength(1);
  });

  it('gäller också rummens fyllning', () => {
    const doc = sampleProject();
    const room = Object.values(doc.elements).find((e) => e.type === 'Space')!;
    room.params = { ...room.params, fill: 'hatch', fillBackground: '#ddeeff' };
    const fills = buildPlan(doc, room.storey!, { state: doc.states.at(-1)!.id }).prims.filter((q): q is RegionPrim => q.kind === 'region' && q.origin?.objectId === room.id);
    expect(fills.some((f) => f.fill.kind === 'solid' && f.fill.color === '#ddeeff')).toBe(true);
  });

  it('kryssrutan sätter och tar bort bakgrunden, och smartmenyn visar den', () => {
    const store = storeWith({ a: { points: square(0, 0), closed: true, fill: 'hatch' } });
    const box = { checked: true, value: 'on' } as HTMLInputElement;
    shapeChange(store, ['a'], 'fillBackgroundOn', box);
    expect(store.doc.elements.a.params.fillBackground).toBe('#ffffff');
    expect(shapeSmartFields(store.doc, [store.doc.elements.a])).toContain('Bakgrundens opacitet');
    shapeChange(store, ['a'], 'fillBackgroundOn', { checked: false, value: 'on' } as HTMLInputElement);
    expect(store.doc.elements.a.params.fillBackground).toBeUndefined();
  });
});

describe('Ändformerna följer linjen i ritordningen (0.8.29)', () => {
  it('en hel fyllning ovanför kapar pilen och punkten', () => {
    const arrow = (cap: 'arrow' | 'dot') => {
      // Linjen slutar mitt i den övre kvadraten.
      const store = storeWith({
        line: { points: [[48000, 500], [50500, 500]], endCap: cap, capSize: 2, order: 0 },
        over: { points: square(50000, 0), closed: true, fill: 'solid', weight: 0, order: 1 },
      });
      return own(store, 'line').filter((q): q is RegionPrim => q.kind === 'region' && q.origin?.part === 'ände');
    };
    for (const cap of ['arrow', 'dot'] as const) expect(arrow(cap)).toHaveLength(0);
  });

  it('en ändform som sticker ut kapas vid kanten', () => {
    const store = storeWith({
      line: { points: [[48000, 500], [50000, 500]], endCap: 'dot', capSize: 10, order: 0 },
      over: { points: square(50000, 0), closed: true, fill: 'solid', weight: 0, order: 1 },
    });
    const dot = own(store, 'line').filter((q): q is RegionPrim => q.kind === 'region' && q.origin?.part === 'ände');
    expect(dot.length).toBeGreaterThan(0);
    for (const r of dot) for (const ring of r.rings) for (const q of ring) expect(q[0]).toBeLessThanOrEqual(50000 + 1e-6);
  });

  it('utan något ovanför är ändformen oförändrad', () => {
    const p = { ...base, points: [[0, 0], [1000, 0]] as [number, number][], endCap: 'arrow' as const };
    const store = storeWith({ line: { ...p, order: 0 } });
    const caps = own(store, 'line').filter((q) => q.kind === 'region');
    expect(caps).toHaveLength(shapePrims(p).filter((q) => q.kind === 'region').length);
  });
});
