import { beforeAll, describe, expect, it } from 'vitest';
import { LINE_TYPES } from '../src/core/lineTypes';
import type { Element, ProjectDoc } from '../src/core/model';
import { registerBuiltInTypes } from '../src/elements';
import { buildPlan } from '../src/repr/plan';
import type { Primitive } from '../src/repr/primitives';
import { buildSection } from '../src/repr/section';
import { buildViewPrims, splitPlaced } from '../src/repr/sheet';
import { sampleProject } from '../src/sample/sampleProject';
import { SHAPE, twoStoreys } from './projekt';

beforeAll(() => registerBuiltInTypes());

const stateOf = (doc: ProjectDoc) => doc.states.at(-1)!.id;
const markers = (doc: ProjectDoc, type: string) => Object.values(doc.elements).filter((e) => e.type === type);
const dashed = (prims: Primitive[]) => prims.filter((p): p is Extract<Primitive, { kind: 'line' }> => p.kind === 'line' && p.origin?.part === 'dold');

describe('Dolda linjer och vyns djup (0.10.10)', () => {
  it('bjälklagen och ytterväggarnas insida streckade i fasaden, bara de dolda delarna och bara när de tänts', () => {
    const doc = twoStoreys();
    const el = markers(doc, 'Elevation')[0];
    expect(dashed(buildSection(doc, el.id, { state: stateOf(doc) })!.prims)).toHaveLength(0);
    const slabs = dashed(buildSection(doc, el.id, { state: stateOf(doc), hide: ['+hiddenSlabs'] })!.prims);
    // Plattan på plan 2 (400): över- och undersidan på +2 700 och +2 300, en linje var.
    for (const z of [2700, 2300]) expect(slabs.filter((l) => l.origin?.objectType === 'Slab' && Math.abs(l.a[1] - z) < 1 && Math.abs(l.b[1] - z) < 1)).toHaveLength(1);
    expect(slabs.every((l) => l.pen.dash === LINE_TYPES.dashed.dash && l.noPick)).toBe(true);
    const walls = dashed(buildSection(doc, el.id, { state: stateOf(doc), hide: ['+hiddenWalls'] })!.prims).filter((l) => l.origin?.objectType === 'Wall');
    // Lodräta linjer innanför fasadens ändar.
    expect(walls.length).toBeGreaterThan(0);
    expect(walls.every((l) => Math.abs(l.a[0] - l.b[0]) < 1)).toBe(true);
    // Inte i en sektion.
    const sec = markers(doc, 'Section')[0];
    expect(dashed(buildSection(doc, sec.id, { state: stateOf(doc), hide: ['+hiddenSlabs', '+hiddenWalls'] })!.prims)).toHaveLength(0);
  });

  it('Tonat från: det som ligger längre bort ritas tunt och grått, det närmare som förut', () => {
    const doc = twoStoreys();
    const el = markers(doc, 'Elevation')[0];
    const grey = (prims: Primitive[]) => prims.filter((p) => p.kind === 'line' && p.pen.color === 'muted' && p.origin?.part !== 'joint' && p.origin?.part !== 'glass');
    const before = buildSection(doc, el.id, { state: stateOf(doc) })!.prims;
    doc.elements[el.id] = { ...el, params: { ...el.params, toneDepth: 4000 } };
    const after = buildSection(doc, el.id, { state: stateOf(doc) })!.prims;
    expect(grey(after).length).toBeGreaterThan(grey(before).length);
    expect(grey(after).every((p) => p.kind === 'line' && p.pen.weight <= 0.13)).toBe(true);
    // Bortom allt: inget tonas.
    doc.elements[el.id] = { ...el, params: { ...el.params, toneDepth: 100000 } };
    expect(grey(buildSection(doc, el.id, { state: stateOf(doc) })!.prims).length).toBe(grey(before).length);
  });

  it('Tak på andra våningar: ovanför vyn streckprickat, under golvet streckat', () => {
    const doc = twoStoreys();
    const roofs = (d: ProjectDoc, storey: string, hide?: string[]) => buildPlan(d, storey, { state: stateOf(d), hide }).prims.filter((p) => p.origin?.objectType === 'Roof' && (p.kind === 'line' || p.kind === 'polyline'));
    expect(roofs(doc, 'pl-1')).toHaveLength(0);
    const above = roofs(doc, 'pl-1', ['+roofsAround']);
    expect(above.length).toBeGreaterThan(0);
    expect(above.every((p) => 'pen' in p && p.pen.dash === LINE_TYPES.dashdot.dash)).toBe(true);
    // Ett tak på plan 1 sett från en våning högt ovanför.
    const low = sampleProject();
    low.storeys.push({ id: 'pl-hog', name: 'Plan 5', elevation: 12000, height: 2700 });
    expect(roofs(low, 'pl-hog')).toHaveLength(0);
    const under = roofs(low, 'pl-hog', ['+roofsAround']);
    expect(under.length).toBeGreaterThan(0);
    expect(under.every((p) => 'pen' in p && p.pen.dash === LINE_TYPES.dashed.dash)).toBe(true);
  });

  it('ritordningen i fasaden: fyllningen bakom modellen som förval, framför när den valts', () => {
    const doc = sampleProject();
    const el = markers(doc, 'Elevation')[0];
    const shape = (id: string, extra: Record<string, unknown>): Element =>
      ({ id, type: 'Shape2D', storey: el.storey, space: el.id, states: doc.states.map((s) => s.id), tags: [], props: {}, params: { ...SHAPE, points: [[0, 0], [2000, 0], [2000, 2000], [0, 2000]], closed: true, fill: 'solid', ...extra } }) as Element;
    doc.elements.bak = shape('bak', {});
    doc.elements.fram = shape('fram', { fillFront: true, lineBehind: true });
    const drawn = buildPlan(doc, el.storey, { state: stateOf(doc), place: el.id });
    const { under, over } = splitPlaced(drawn.prims);
    const fill = (list: Primitive[], id: string) => list.some((p) => p.origin?.objectId === id && p.origin?.part === 'fyllning');
    expect(fill(under, 'bak') && !fill(over, 'bak')).toBe(true);
    expect(fill(over, 'fram') && !fill(under, 'fram')).toBe(true);
    expect(under.some((p) => p.origin?.objectId === 'fram' && p.kind === 'polyline')).toBe(true);
    // På bladet: det som ligger bakom ritas före fasaden.
    const prims = buildViewPrims(doc, { id: 'v', marker: el.id, storey: el.storey, state: stateOf(doc) } as never, { scale: 100 });
    const at = (id: string, part: string) => prims.findIndex((p) => p.origin?.objectId === id && p.origin?.part === part);
    const firstModel = prims.findIndex((p) => p.origin?.objectType === 'Wall');
    expect(at('bak', 'fyllning')).toBeLessThan(firstModel);
    expect(at('fram', 'fyllning')).toBeGreaterThan(firstModel);
  });
});
