import { beforeAll, describe, expect, it } from 'vitest';
import type { ProjectDoc } from '../src/core/model';
import { registerBuiltInTypes } from '../src/elements';
import { slabCuts, underSlabs } from '../src/elements/wall3d';
import { buildModel3d } from '../src/repr/model3d';
import { buildSection } from '../src/repr/section';
import type { Edges3D, Solid } from '../src/repr/solids';
import { sampleProject } from '../src/sample/sampleProject';
import { twoStoreys } from './projekt';

beforeAll(() => registerBuiltInTypes());

const view = { state: 'st-a' };
const isWall = (s: { kind?: string; material?: string }): s is Solid => s.kind !== 'edges' && (s.material === 'wall' || s.material === 'wall-new');
/** Väggens bitar i 3D: ovansidornas höjder. */
const tops = (doc: ProjectDoc, id: string) => [...new Set(buildModel3d(doc, view).filter((s) => isWall(s) && s.id === id).map((s) => Math.round((s as Solid).z1)))].sort();
/** Bjälklaget på plan 2 med en ritad kontur. */
const drawn = (outline: [number, number][], holes?: { points: [number, number][] }[]) => {
  const doc = twoStoreys();
  doc.elements['bj1-2'].params = { ...doc.elements['bj1-2'].params, fromWalls: false, outline, ...(holes ? { holes } : {}) };
  return doc;
};

describe('Granskning (0.10.1)', () => {
  it('varje väggs kantlinjer har väggens id, och innerväggarnas slutar vid bjälklaget', () => {
    // Förut fick alla väggar med samma höjd den första väggens id.
    const one = buildModel3d(sampleProject(), view);
    const walls = new Set(one.filter(isWall).map((s) => s.id));
    const edged = new Set(one.filter((s): s is Edges3D => s.kind === 'edges' && s.part === 'wall').map((s) => s.id));
    expect(edged).toEqual(walls);
    const shapes = buildModel3d(twoStoreys(), view);
    for (const id of ['iv-1', 'iv-2', 'iv-4']) {
      const z = shapes.filter((s): s is Edges3D => s.kind === 'edges' && s.part === 'wall' && s.id === id).flatMap((s) => s.segments.flatMap((q) => [q[2], q[5]]));
      expect(Math.max(...z)).toBe(2300);
    }
  });

  it('bjälklaget kapar väggen där det täcker den, som taket', () => {
    // Utan bjälklag ovanför: hela våningshöjden (0.9.2).
    expect(tops(sampleProject(), 'iv-1')).toEqual([2700]);
    // Ur väggarna: ytterväggarna går golv till golv, innerväggarna slutar under plattan (400).
    const doc = twoStoreys();
    expect(tops(doc, 'yv-s')).toEqual([2700]);
    expect(tops(doc, 'iv-1')).toEqual([2300]);
    // Till ytterväggarnas utsida: hela väggen kapas.
    expect(tops(drawn([[0, 0], [12000, 0], [12000, 8000], [0, 8000]]), 'yv-s')).toEqual([2300]);
    // Till väggarnas mitt: halva väggen kapas. I ett hål kapas den inte.
    const half = drawn([[200, 200], [11800, 200], [11800, 7800], [200, 7800]], [{ points: [[4700, 5000], [5300, 5000], [5300, 6000], [4700, 6000]] }]);
    expect(tops(half, 'yv-s')).toEqual([2300, 2700]);
    expect(tops(half, 'iv-1')).toEqual([2300, 2700]);
    // Med bara plan 1 kapas de likadant.
    const only = buildModel3d(half, view, 'pl-1').filter((s) => isWall(s) && s.id === 'yv-s').map((s) => Math.round((s as Solid).z1));
    expect([...new Set(only)].sort()).toEqual([2300, 2700]);
  });

  it('under tak gäller det lägsta av taket och bjälklaget', () => {
    // En väggbit vars ovansida stiger från 2000 till 3000, under ett bjälklag i 2500.
    const piece = [[[0, 0], [1000, 0], [1000, 100], [0, 100]] as [number, number][]];
    const slabs = slabCuts([{ rings: [[[-500, -500], [1500, -500], [1500, 500], [-500, 500]]], under: 2500 }]);
    const out = underSlabs(piece, [1, 0, 2000], 2700, slabs);
    const sloped = out.filter((o) => o.top);
    const flat = out.filter((o) => !o.top);
    expect(sloped.length).toBe(1);
    expect(Math.max(...sloped[0].rings[0].map((q) => q[0]))).toBeCloseTo(500);
    expect(flat.map((o) => o.height)).toEqual([2500]);
    // Ett bjälklag som bara når halva biten, och ett ovanför väggen, som inget gör.
    const part = underSlabs(piece, null, 2700, slabCuts([{ rings: [[[500, -500], [1500, -500], [1500, 500], [500, 500]]], under: 2300 }, { rings: [[[-500, -500], [1500, -500], [1500, 500], [-500, 500]]], under: 2800 }]));
    expect(part.map((o) => o.height).sort()).toEqual([2300, 2700]);
  });

  it('ingen linje mellan våningar med samma liv, också befintligt mot nytt (0.10.11), men kvar under dörren och där väggen kragar ut', () => {
    const joint = (doc: ProjectDoc, v: { state: string; compareTo?: string } = view) =>
      buildSection(doc, 'fasad-1', v)!.prims.flatMap((p) => (p.kind === 'line' && p.origin?.part === 'wall' && Math.abs(p.a[1] - 2700) < 0.1 && Math.abs(p.b[1] - 2700) < 0.1 ? [Math.abs(p.b[0] - p.a[0])] : []));
    // Bara dörren på plan 2 (D10, 1010 mm hål) står på skarven, och hörnens små bitar.
    const doc = twoStoreys();
    expect(joint(doc).filter((l) => l > 10).map(Math.round)).toEqual([1010, 1010]);
    // Söderväggen på plan 2 ny (bara i förslagen), den på plan 1 befintlig: samma, också i jämförelsen.
    doc.elements['yv-s-2'].states = ['st-a', 'st-b'];
    for (const v of [view, { state: 'st-a', compareTo: 'st-bef' }]) expect(joint(doc, v).filter((l) => l > 10).map(Math.round)).toEqual([1010, 1010]);
    // Med söderväggen på plan 2 400 mm utanför den på plan 1 är skarven en kant.
    const out = twoStoreys();
    const p = out.elements['yv-s-2'].params as { start: [number, number]; end: [number, number] };
    out.elements['yv-s-2'].params = { ...p, start: [p.start[0], p.start[1] - 400], end: [p.end[0], p.end[1] - 400] };
    expect(Math.max(...joint(out))).toBeGreaterThan(5000);
  });
});
