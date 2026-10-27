import { beforeAll, describe, expect, it } from 'vitest';
import { deleteElements, setInState, setLocked } from '../src/core/commands';
import type { ProjectDoc } from '../src/core/model';
import { DocStore } from '../src/core/store';
import { registerBuiltInTypes } from '../src/elements';
import { cutHeightOf } from '../src/elements/roofPlan';
import { buildModel3d } from '../src/repr/model3d';
import { buildPlan } from '../src/repr/plan';
import { buildSection } from '../src/repr/section';
import { ground3dHost } from '../src/ui/app/ground3d';
import { groundProject, twoStoreys } from './projekt';

beforeAll(() => registerBuiltInTypes());

describe('Småsaker (0.10.11)', () => {
  it('snitthöjden är 1100 från början', () => {
    expect(cutHeightOf({})).toBe(1100);
    expect(cutHeightOf({ cutHeight: 1200 })).toBe(1200);
  });

  it('ingen linje mellan befintligt och nytt på två våningar med samma liv', () => {
    const joint = (doc: ProjectDoc, view: { state: string; compareTo?: string }) =>
      buildSection(doc, 'fasad-1', view)!.prims.flatMap((p) => (p.kind === 'line' && p.origin?.part === 'wall' && Math.abs(p.a[1] - 2700) < 0.1 && Math.abs(p.b[1] - 2700) < 0.1 ? [Math.abs(p.b[0] - p.a[0])] : []));
    // Söderväggen på plan 2 är ny (bara i förslagen); den på plan 1 befintlig.
    const doc = twoStoreys();
    doc.elements['yv-s-2'].states = ['st-a', 'st-b'];
    for (const view of [{ state: 'st-a' }, { state: 'st-a', compareTo: 'st-bef' }]) expect(joint(doc, view).filter((l) => l > 10).map(Math.round)).toEqual([1010, 1010]);
  });

  it('träd och grannhus följer tillstånden och går att ta bort när de låsts upp', () => {
    const store = new DocStore(groundProject());
    const tree = Object.values(store.doc.elements).find((e) => e.type === 'Tree')!;
    const house = Object.values(store.doc.elements).find((e) => e.type === 'SiteBuilding')!;
    expect(tree.locked && house.locked).toBe(true);
    // Trädet rivs i förslagen: kvar i Befintligt, borta i 3D i Förslag A och rivs i jämförelsen.
    setInState(store, [tree.id], 'st-a', false);
    setInState(store, [tree.id], 'st-b', false);
    expect(buildModel3d(store.doc, { state: 'st-a' }).some((s) => s.id === tree.id)).toBe(false);
    expect(buildModel3d(store.doc, { state: 'st-bef' }).some((s) => s.id === tree.id)).toBe(true);
    const plan = buildPlan(store.doc, tree.storey, { state: 'st-a', compareTo: 'st-bef' });
    expect(plan.prims.some((p) => p.origin?.objectId === tree.id)).toBe(true);
    // Låst betyder låst (0.10.12): de tas bort först när de låsts upp.
    expect(deleteElements(store, [tree.id, house.id])).toEqual({ removed: 0, locked: [tree.id, house.id] });
    setLocked(store, [tree.id, house.id], false);
    deleteElements(store, [tree.id, house.id]);
    expect(store.doc.elements[tree.id]).toBeUndefined();
    expect(store.doc.elements[house.id]).toBeUndefined();
    // Marken tas bort med platsen, inte en och en.
    const terrain = Object.values(store.doc.elements).find((e) => e.type === 'Terrain')!;
    deleteElements(store, [terrain.id]);
    expect(store.doc.elements[terrain.id]).toBeDefined();
  });

  it('markobjekten i 3D: objektet i en punkt, och konturen på marken', () => {
    const doc = groundProject();
    const host = ground3dHost(doc, { state: 'st-a' })!;
    const grounds = Object.values(doc.elements).filter((e) => e.type === 'Ground');
    const area = grounds.find((e) => (e.params as { kind: string; outline: unknown[] }).kind === 'area' && (e.params as { outline: unknown[] }).outline.length >= 3)!;
    const outline = (area.params as { outline: [number, number][] }).outline;
    const mid: [number, number] = [outline.reduce((s, q) => s + q[0], 0) / outline.length, outline.reduce((s, q) => s + q[1], 0) / outline.length];
    expect(grounds.map((g) => g.id)).toContain(host.pick(mid));
    const line = host.outline(area.id)!;
    expect(line.length % 6).toBe(0);
    // Konturen ligger på marken, lite över den.
    expect(line[2]).toBeCloseTo(host.height([line[0], line[1]])! + 60, 0);
    expect(host.outline('inget')).toBeNull();
    // Släckt mark: inga markobjekt att träffa.
    expect(ground3dHost(doc, { state: 'st-a', hide: ['Terrain'] })).toBeNull();
    expect(ground3dHost(doc, { state: 'st-a', hide: ['Ground'] })!.pick(mid)).toBeNull();
  });
});
