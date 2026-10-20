import { beforeAll, describe, expect, it } from 'vitest';
import { addElements, deleteElements, moveElements, setLocked, setShowIn } from '../src/core/commands';
import { modelViewId, type Element } from '../src/core/model';
import { DocStore } from '../src/core/store';
import { allViews, countViews, shownIn } from '../src/core/visibility';
import { registerBuiltInTypes } from '../src/elements';
import { arcThrough, catmullRom, shapePoints } from '../src/elements/drawing2d';
import { markerFrame } from '../src/elements/markers';
import { buildPlan } from '../src/repr/plan';
import { autoSlopeId, buildSection } from '../src/repr/section';
import { sampleProject } from '../src/sample/sampleProject';
import { parse, serialize } from '../src/storage/format';

beforeAll(() => registerBuiltInTypes());

const view = { state: 'st-a', compareTo: 'st-bef', detail: 'normal' as const };

function line(id: string, extra: Partial<Element> = {}): Element {
  return { id, type: 'Line2D', storey: 'pl-1', states: ['st-bef', 'st-a', 'st-b'], tags: [], params: { shape: 'line', points: [[0, 0], [1000, 0]], weight: 0.25, linetype: 'solid' }, props: {}, ...extra };
}

describe('format 5 (0.8)', () => {
  it('sparas och läses utan förlust, med 2D-element, Visas i och lås', () => {
    const doc = sampleProject();
    doc.elements.l1 = line('l1', { show: { kind: 'tags', tags: ['undertak'], match: 'any' }, locked: true });
    doc.elements.l2 = line('l2', { space: 'sektion-a' });
    const back = parse(serialize(doc));
    expect(back.elements.l1.show).toEqual({ kind: 'tags', tags: ['undertak'], match: 'any' });
    expect(back.elements.l1.locked).toBe(true);
    expect(back.elements.l2.space).toBe('sektion-a');
    expect(back.folders).toEqual(doc.folders);
    expect(back.tree).toEqual(doc.tree);
  });
});

describe('Visas i (0.8)', () => {
  const plan = { id: modelViewId('pl-1'), place: 'pl-1', tags: [] as string[] };
  const ceiling = { id: 'vy-tak', place: 'pl-1', tags: ['undertak', '1:50'] };
  it('utan Visas i: alla vyer av ytan, inga andra', () => {
    expect(shownIn(line('a'), plan)).toBe(true);
    expect(shownIn(line('a'), ceiling)).toBe(true);
    expect(shownIn(line('a', { space: 'sektion-a' }), plan)).toBe(false);
  });
  it('bara den här vyn och utvalda vyer, även andra våningars', () => {
    const el = line('a', { show: { kind: 'views', views: ['vy-tak', 'vy-pl2'] } });
    expect(shownIn(el, ceiling)).toBe(true);
    expect(shownIn(el, plan)).toBe(false);
    expect(shownIn(el, { id: 'vy-pl2', place: 'pl-2', tags: [] })).toBe(true);
  });
  it('taggar: någon av eller alla', () => {
    const any = line('a', { show: { kind: 'tags', tags: ['undertak', 'bygglov'], match: 'any' } });
    const all = line('b', { show: { kind: 'tags', tags: ['undertak', 'bygglov'], match: 'all' } });
    expect(shownIn(any, ceiling)).toBe(true);
    expect(shownIn(all, ceiling)).toBe(false);
    expect(shownIn(any, plan)).toBe(false);
    expect(shownIn(line('c', { show: { kind: 'tags', tags: [], match: 'any' } }), ceiling)).toBe(false);
  });
  it('räknar vyerna, och planen ritar bara det som syns', () => {
    const doc = sampleProject();
    doc.views = doc.views.map((v) => (v.id === 'vy-a-bl' ? { ...v, tags: ['bygglov'] } : v));
    doc.elements.l1 = line('l1', { show: { kind: 'tags', tags: ['bygglov'], match: 'any' } });
    expect(countViews(doc, doc.elements.l1)).toBe(1);
    expect(allViews(doc).length).toBe(doc.storeys.length + 5 + doc.views.length);
    const has = (vs: object) => buildPlan(doc, 'pl-1', { ...view, ...vs }).pickables.some((p) => p.id === 'l1');
    expect(has({})).toBe(false);
    expect(has({ viewId: 'vy-a-bl', viewTags: ['bygglov'] })).toBe(true);
    // Visa dolda: syns tonat i modellvyn.
    expect(has({ showHidden: true })).toBe(true);
  });
  it('kommandot sätter och tar bort Visas i, och ångras', () => {
    const store = new DocStore(sampleProject());
    const [el] = addElements(store, [{ type: 'Line2D', storey: 'pl-1', tags: [], params: line('x').params, props: {} }], 'st-a', 'Rita 2D');
    setShowIn(store, [el.id], { kind: 'views', views: ['vy-a'] });
    expect(store.doc.elements[el.id].show).toEqual({ kind: 'views', views: ['vy-a'] });
    setShowIn(store, [el.id], null);
    expect(store.doc.elements[el.id].show).toBeUndefined();
    store.undo();
    expect(store.doc.elements[el.id].show).toEqual({ kind: 'views', views: ['vy-a'] });
  });
});

describe('2D-element (0.8)', () => {
  it('bågen genom tre punkter börjar och slutar i ändpunkterna och går genom mitten', () => {
    const pts = arcThrough([0, 0], [500, 500], [1000, 0]);
    expect(pts[0][0]).toBeCloseTo(0, 6);
    expect(pts[0][1]).toBeCloseTo(0, 6);
    expect(pts.at(-1)![0]).toBeCloseTo(1000, 6);
    expect(pts.at(-1)![1]).toBeCloseTo(0, 6);
    expect(Math.max(...pts.map((p) => p[1]))).toBeCloseTo(500, 0);
    // Åt andra hållet.
    expect(Math.min(...arcThrough([0, 0], [500, -300], [1000, 0]).map((p) => p[1]))).toBeLessThan(-290);
  });
  it('splinen går genom punkterna; cirkeln är sluten', () => {
    const s = catmullRom([[0, 0], [1000, 500], [2000, 0]], false);
    expect(s.some((p) => Math.abs(p[0] - 1000) < 1e-6 && Math.abs(p[1] - 500) < 1e-6)).toBe(true);
    expect(s.at(-1)).toEqual([2000, 0]);
    const c = shapePoints({ shape: 'circle', points: [[0, 0], [1000, 0]] });
    expect(c.closed).toBe(true);
    expect(Math.hypot(c.points[5][0], c.points[5][1])).toBeCloseTo(1000, 6);
  });
  it('det som ritas i en sektion syns där och inte i planen', () => {
    const doc = sampleProject();
    doc.elements.l2 = line('l2', { space: 'sektion-a' });
    expect(buildPlan(doc, 'pl-1', view).pickables.some((p) => p.id === 'l2')).toBe(false);
    expect(buildPlan(doc, 'pl-1', { ...view, place: 'sektion-a' }).pickables.map((p) => p.id)).toEqual(['l2']);
  });
});

describe('lås och fasader som följer byggnaden (0.8)', () => {
  it('ett låst objekt flyttas inte och tas inte bort', () => {
    const store = new DocStore(sampleProject());
    store.transact('x', (tx) => tx.putElement(line('l1')));
    setLocked(store, ['l1'], true);
    moveElements(store, ['l1'], [500, 0]);
    expect(store.doc.elements.l1.params.points).toEqual([[0, 0], [1000, 0]]);
    deleteElements(store, ['l1']);
    expect(store.doc.elements.l1).toBeDefined();
    setLocked(store, ['l1'], false);
    expect(store.doc.elements.l1.locked).toBeUndefined();
    moveElements(store, ['l1'], [500, 0]);
    expect(store.doc.elements.l1.params.points).toEqual([[500, 0], [1500, 0]]);
  });
  it('en fasad som följer byggnaden placeras för hand där den låg när den flyttas', () => {
    const store = new DocStore(sampleProject());
    const before = markerFrame(store.doc, store.doc.elements['fasad-1']);
    moveElements(store, ['fasad-1'], [0, -1000]);
    const p = store.doc.elements['fasad-1'].params as any;
    expect(p.auto).toBe(false);
    expect(p.start).toEqual([Math.round(before.start[0]), Math.round(before.start[1]) - 1000]);
    const after = markerFrame(store.doc, store.doc.elements['fasad-1']);
    expect(after.view[0]).toBeCloseTo(before.view[0], 9);
    expect(after.view[1]).toBeCloseTo(before.view[1], 9);
  });
});

describe('taklutning som eget objekt (0.8)', () => {
  it('fasaden sätter ut taklutningar som kan bli egna objekt, och hoppar över dem som blivit det', () => {
    const doc = sampleProject();
    const s = buildSection(doc, 'fasad-2', view)!;
    const ids = Object.keys(s.slopes);
    expect(ids.length).toBeGreaterThan(0);
    const store = new DocStore(doc);
    const [obj] = addElements(store, [{ type: 'RoofSlope', storey: 'pl-1', space: 'fasad-2', states: [], tags: [], params: { ...s.slopes[ids[0]] }, props: {} }], 'st-a', 'x');
    const again = buildSection(store.doc, 'fasad-2', view)!;
    expect(Object.keys(again.slopes)).not.toContain(ids[0]);
    const drawn = buildPlan(store.doc, 'pl-1', { ...view, place: 'fasad-2' });
    expect(drawn.pickables.map((p) => p.id)).toContain(obj.id);
    // Tas den bort blir den dold, så att den automatiska inte kommer tillbaka.
    deleteElements(store, [obj.id]);
    expect(store.doc.elements[obj.id].params.hidden).toBe(true);
    expect(Object.keys(buildSection(store.doc, 'fasad-2', view)!.slopes)).not.toContain(ids[0]);
    expect(buildPlan(store.doc, 'pl-1', { ...view, place: 'fasad-2' }).prims).toHaveLength(0);
    expect(autoSlopeId('tak', 0)).toBe('slope:tak:0');
  });
});
