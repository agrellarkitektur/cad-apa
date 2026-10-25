import { beforeAll, describe, expect, it } from 'vitest';
import { moveElements } from '../src/core/commands';
import { DocStore } from '../src/core/store';
import { registerBuiltInTypes } from '../src/elements';
import { slabAt } from '../src/elements/slab';
import { pointInRings } from '../src/geometry/vec';
import { buildModel3d } from '../src/repr/model3d';
import { buildPlan } from '../src/repr/plan';
import { buildSection } from '../src/repr/section';
import type { Solid } from '../src/repr/solids';
import { sampleProject } from '../src/sample/sampleProject';
import { SlabTool } from '../src/ui/tools/slabTool';
import { toolHost, twoStoreys } from './projekt';

beforeAll(() => registerBuiltInTypes());

const store = () => new DocStore(structuredClone(sampleProject()));
const view = { state: 'st-a' };
const solids = (s: DocStore, id: string) => buildModel3d(s.doc, view).filter((x): x is Solid => x.kind !== 'edges' && x.id === id);
const inside = (parts: Solid[], p: [number, number]) => parts.some((x) => pointInRings(p, x.rings));

describe('Bjälklag (0.9.1)', () => {
  it('ur väggarna: innanför ytterväggarna, under innerväggarna, tjockleken nedåt från golvet', () => {
    const s = store();
    const slab = solids(s, 'bj1');
    expect(slab.length).toBeGreaterThan(0);
    expect(slab[0]).toMatchObject({ z0: -400, z1: 0, material: 'slab' });
    expect(inside(slab, [2000, 2000])).toBe(true); // i ett rum
    expect(inside(slab, [5000, 6000])).toBe(true); // under en innervägg
    expect(inside(slab, [200, 2000])).toBe(false); // i ytterväggen
    // Väggarna flyttas: bjälklaget följer med.
    expect(inside(slab, [12300, 4000])).toBe(false);
    moveElements(s, Object.values(s.doc.elements).filter((e) => e.type === 'Wall').map((e) => e.id), [1000, 0]);
    expect(inside(solids(s, 'bj1'), [12300, 4000])).toBe(true);
    expect(inside(solids(s, 'bj1'), [1000, 4000])).toBe(false);
  });

  it('rummens tunna golvskiva försvinner där det finns ett bjälklag', () => {
    const s = store();
    const floors = () => buildModel3d(s.doc, view).filter((x): x is Solid => x.kind !== 'edges' && x.material === 'floor');
    expect(floors()).toHaveLength(0);
    s.transact('bort', (tx) => tx.removeElement('bj1'));
    expect(floors().length).toBeGreaterThan(0);
  });

  it('håltagning: dras ifrån i 3D och ritas med kryss i planen; följer med när bjälklaget flyttas', () => {
    const s = store();
    const hole: [number, number][] = [[1000, 1000], [2000, 1000], [2000, 2000], [1000, 2000]];
    s.transact('hål', (tx) => tx.putElement({ ...tx.doc.elements['bj1'], params: { ...tx.doc.elements['bj1'].params, holes: [hole] } }));
    expect(inside(solids(s, 'bj1'), [1500, 1500])).toBe(false);
    expect(inside(solids(s, 'bj1'), [2500, 2500])).toBe(true);
    const own = buildPlan(s.doc, 'pl-1', view).pickables.find((p) => p.id === 'bj1')!;
    expect(own.prims.filter((p) => p.origin?.part === 'hål')).toHaveLength(6);
    moveElements(s, ['bj1'], [100, 0]);
    expect((s.doc.elements['bj1'].params.holes as number[][][])[0][0]).toEqual([1100, 1000]);
  });

  it('fylls som väggarna i sektionen och ligger på sin våning', () => {
    const s = new DocStore(twoStoreys());
    const sec = buildSection(s.doc, 'sektion-a', view)!;
    const cut = sec.prims.filter((p) => p.kind === 'region' && p.role === 'cut' && p.rings.some((r) => r.some((q) => q[1] === -400)));
    expect(cut.length).toBeGreaterThan(0);
    expect(solids(s, 'bj1-2')[0]).toMatchObject({ z0: 2300, z1: 2700 });
  });

  it('verktyget: en rektangel, och en håltagning i bjälklaget under första hörnet', () => {
    const s = store();
    const host = toolHost(s);
    const tool = new SlabTool(host, 't-bj01');
    tool.takePoint([20000, 0]);
    tool.takePoint([24000, 3000]);
    const made = Object.values(s.doc.elements).find((e) => e.type === 'Slab' && e.id !== 'bj1')!;
    expect(made).toMatchObject({ definition: 't-bj01', params: { outline: [[20000, 0], [24000, 0], [24000, 3000], [20000, 3000]] } });
    tool.options.mode = 'hole';
    tool.takePoint([30000, 0]);
    expect(host.hints.at(-1)).toMatch(/inne i ett bjälklag/);
    expect(slabAt(s.doc, 'pl-1', host.activeState(), [21000, 1000])).toBe(made.id);
    tool.takePoint([21000, 1000]);
    tool.takePoint([22000, 2000]);
    expect(s.doc.elements[made.id].params.holes).toHaveLength(1);
  });
});
