import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { arrange, orderedWith } from '../src/core/drawOrder';
import { DocStore } from '../src/core/store';
import { FORMAT_VERSION, type Element } from '../src/core/model';
import type { Shape2DParams } from '../src/elements/drawing2d';
import { buildPlan } from '../src/repr/plan';
import { sampleProject } from '../src/sample/sampleProject';
import { parse, serialize } from '../src/storage/format';
import { pickAt } from '../src/view2d/pick';
import { orderSection } from '../src/ui/app/drawOrderUi';
import { instanceFields } from '../src/ui/selectionFields';

beforeAll(() => registerBuiltInTypes());

const base: Shape2DParams = { shape: 'polyline', points: [], weight: 0.25, linetype: 'solid', fillAngle: 45, fillSpacing: 2 };
const square = (x: number, y: number, s = 1000): [number, number][] => [
  [x, y],
  [x + s, y],
  [x + s, y + s],
  [x, y + s],
];

/** Exempelprojektet med några fyllda kvadrater långt från huset. */
function storeWith(shapes: Record<string, Partial<Shape2DParams>>) {
  const doc = sampleProject();
  const storey = doc.storeys[0].id;
  for (const [id, p] of Object.entries(shapes))
    doc.elements[id] = { id, type: 'Shape2D', storey, states: doc.states.map((s) => s.id), tags: [], params: { ...base, closed: true, fill: 'solid', ...p }, props: {} } as Element;
  return new DocStore(doc);
}

const vs = (store: DocStore) => ({ state: store.doc.states.at(-1)!.id });
const plan = (store: DocStore) => buildPlan(store.doc, store.doc.storeys[0].id, vs(store));
/** Var formens första primitiv (fyllningen) ligger i planen. */
const at = (store: DocStore, id: string, part?: string) => plan(store).prims.findIndex((q) => q.origin?.objectId === id && (!part || q.origin.part === part));
const boxes: Record<string, [number, number, number, number]> = {
  a: [50000, 0, 51000, 1000],
  b: [50500, 0, 51500, 1000],
  c: [60000, 0, 61000, 1000],
  d: [50800, 0, 51800, 1000],
};
const boxOf = (id: string) => boxes[id] ?? null;

describe('ritordning (0.8.25)', () => {
  it('formatet är kvar 13 och ordningen sparas med projektet', () => {
    expect(FORMAT_VERSION).toBe(13);
    const store = storeWith({ a: { points: square(50000, 0) }, b: { points: square(50500, 0) } });
    arrange(store, ['a'], 'front');
    const back = parse(serialize(store.doc));
    expect(back.elements.a.order).toBe(1);
  });

  it('Främst och Längst bak lägger det markerade först eller sist, och ritas så', () => {
    const store = storeWith({ a: { points: square(50000, 0) }, b: { points: square(50500, 0) }, c: { points: square(60000, 0) } });
    const fills = () => ['a', 'b', 'c'].map((id) => at(store, id));
    expect(fills()[0]).toBeLessThan(fills()[1]);
    expect(arrange(store, ['a'], 'front')).toBe(1);
    expect(orderedWith(store.doc, store.doc.elements.a).map((e) => e.id).slice(-1)).toEqual(['a']);
    expect(fills()[0]).toBeGreaterThan(fills()[2]);
    arrange(store, ['a'], 'back');
    expect(fills()[0]).toBeLessThan(fills()[1]);
    // Redan längst bak: inget ändras, ingen ny ångra-rad.
    const undo = store.undoLabel;
    expect(arrange(store, ['a'], 'back')).toBe(0);
    expect(store.undoLabel).toBe(undo);
    // Ångra i ett steg.
    store.undo();
    expect(orderedWith(store.doc, store.doc.elements.a).at(-1)!.id).toBe('a');
  });

  it('Fram och Bak går förbi närmaste som överlappar, inte förbi det som ligger någon annanstans', () => {
    const store = storeWith({ a: { points: square(50000, 0) }, c: { points: square(60000, 0) }, b: { points: square(50500, 0) }, d: { points: square(50800, 0) } });
    const ids = () => orderedWith(store.doc, store.doc.elements.a).map((e) => e.id).filter((id) => id in boxes);
    expect(ids()).toEqual(['a', 'c', 'b', 'd']);
    // a hoppar över c (överlappar inte) och hamnar framför b.
    arrange(store, ['a'], 'forward', boxOf);
    expect(ids()).toEqual(['c', 'b', 'a', 'd']);
    arrange(store, ['a'], 'forward', boxOf);
    expect(ids()).toEqual(['c', 'b', 'd', 'a']);
    // Längst fram bland det som överlappar: inget mer att göra.
    expect(arrange(store, ['a'], 'forward', boxOf)).toBe(0);
    arrange(store, ['d'], 'backward', boxOf);
    expect(ids()).toEqual(['c', 'd', 'b', 'a']);
  });

  it('flera markerade behåller sin inbördes ordning', () => {
    const store = storeWith({ a: { points: square(50000, 0) }, b: { points: square(50500, 0) }, d: { points: square(50800, 0) } });
    arrange(store, ['a', 'b'], 'front');
    expect(orderedWith(store.doc, store.doc.elements.a).slice(-2).map((e) => e.id)).toEqual(['a', 'b']);
    arrange(store, ['a', 'b'], 'back');
    expect(orderedWith(store.doc, store.doc.elements.a).slice(0, 2).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('väggar har ingen ritordning', () => {
    const store = storeWith({});
    const wall = Object.values(store.doc.elements).find((e) => e.type === 'Wall')!;
    expect(arrange(store, [wall.id], 'front')).toBe(0);
    expect(orderSection(store.doc, [wall])).toBe('');
  });

  it('vid lika poäng vinner det som ritas överst när man klickar', () => {
    const store = storeWith({ a: { points: square(50000, 0) }, b: { points: square(50500, 0) } });
    const pick = () => pickAt(plan(store).pickables, [50700, 500], 50);
    expect(pick()).toBe('b');
    arrange(store, ['a'], 'front');
    expect(pick()).toBe('a');
  });
});

describe('2D-formen framför eller bakom väggarna (0.8.25)', () => {
  const wallAt = (store: DocStore) => at(store, Object.values(store.doc.elements).find((e) => e.type === 'Wall')!.id);

  it('som förut: fyllningen bakom väggarna och linjen framför', () => {
    const store = storeWith({ a: { points: square(50000, 0) } });
    expect(at(store, 'a', 'fyllning')).toBeLessThan(wallAt(store));
    expect(at(store, 'a', 'polyline')).toBeGreaterThan(wallAt(store));
  });

  it('fyllningen framför och linjen bakom', () => {
    const store = storeWith({ a: { points: square(50000, 0), fillFront: true, lineBehind: true } });
    expect(at(store, 'a', 'fyllning')).toBeGreaterThan(wallAt(store));
    expect(at(store, 'a', 'polyline')).toBeLessThan(wallAt(store));
    // En fyllning framför väggarna går före dem också när man klickar.
    const pk = plan(store).pickables.find((q) => q.id === 'a')!;
    expect(pk.soft).toBeUndefined();
  });

  it('valen syns i egenskaperna för 2D-former i planen', () => {
    const store = storeWith({ a: { points: square(50000, 0), fillFront: true } });
    const html = orderSection(store.doc, [store.doc.elements.a]);
    expect(html).toContain('Längst bak');
    expect(html).toContain('data-key="d2:fillLayer"');
    expect(html).toMatch(/value="front" selected/);
  });
});

describe('fyllning i rum (0.8.25)', () => {
  it('ett rum med fyllning ritas bakom väggarna och klickas som förut', () => {
    const store = storeWith({});
    const room = Object.values(store.doc.elements).find((e) => e.type === 'Space')!;
    const before = plan(store).pickables.find((q) => q.id === room.id)!.prims.length;
    store.transact('fyll', (tx) => tx.putElement({ ...room, params: { ...room.params, fill: 'hatch', fillColor: '#ff0000' } }));
    const p = plan(store);
    const fill = p.prims.findIndex((q) => q.origin?.objectId === room.id && q.origin.part === 'fyllning');
    const wall = p.prims.findIndex((q) => q.origin?.objectType === 'Wall');
    expect(fill).toBeGreaterThanOrEqual(0);
    expect(fill).toBeLessThan(wall);
    expect(p.pickables.find((q) => q.id === room.id)!.prims.length).toBe(before);
    // Visa → Fyllningar släcker den.
    const hidden = buildPlan(store.doc, store.doc.storeys[0].id, { ...vs(store), hide: ['fill'] });
    expect(hidden.prims.some((q) => q.origin?.objectId === room.id && q.origin.part === 'fyllning')).toBe(false);
  });

  it('rummets egenskaper har fyllningens fält', () => {
    const store = storeWith({});
    const room = Object.values(store.doc.elements).find((e) => e.type === 'Space')!;
    const html = instanceFields(store.doc, { ...room, params: { ...room.params, fill: 'hatch' } }, vs(store));
    expect(html).toContain('data-key="d2:pattern"');
    expect(html).toContain('data-key="d2:fillAngle"');
    expect(html).toContain('data-key="d2:opacity"');
  });
});
