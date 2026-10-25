import { beforeAll, describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { addStorey, toStorey } from '../src/core/storeys';
import { registerBuiltInTypes } from '../src/elements';
import { buildModel3d } from '../src/repr/model3d';
import { buildSection, heightChain } from '../src/repr/section';
import type { Solid } from '../src/repr/solids';
import { sampleProject } from '../src/sample/sampleProject';

beforeAll(() => registerBuiltInTypes());

/** Exempelvillan med en våning till ovanpå: väggarna och plattan kopierade dit. */
function twoStoreys() {
  const s = new DocStore(structuredClone(sampleProject()));
  const two = addStorey(s, 'pl-1', 'above')!;
  const walls = Object.values(s.doc.elements).filter((e) => e.type === 'Wall' && e.storey === 'pl-1').map((e) => e.id);
  toStorey(s, ['bj1', ...walls], two, true, 'st-a');
  return { s, two };
}
const view = { state: 'st-a' };
const wallTops = (shapes: ReturnType<typeof buildModel3d>, storeyWalls: Set<string>) =>
  new Set(shapes.filter((x): x is Solid => x.kind !== 'edges' && storeyWalls.has(x.id) && (x.material === 'wall' || x.material === 'wall-new')).map((x) => Math.round(x.z1)));

describe('Nivåer (0.9.2)', () => {
  it('innerväggarna slutar vid bjälklaget ovanför; ytterväggarna går golv till golv', () => {
    const { s } = twoStoreys();
    const plan1 = new Set(Object.values(s.doc.elements).filter((e) => e.type === 'Wall' && e.storey === 'pl-1').map((e) => e.id));
    // Plattan på plan 2 är 400 tjock: undersidan i 2300. Gavlarna går upp till taket.
    const all = wallTops(buildModel3d(s.doc, view), plan1);
    expect(all.has(2300) && all.has(2700)).toBe(true);
    // Med bara plan 1 i 3D kapas de likadant.
    expect(wallTops(buildModel3d(s.doc, view, 'pl-1'), plan1)).toEqual(all);
    // Utan bjälklag ovanför: hela våningshöjden.
    const one = new DocStore(structuredClone(sampleProject()));
    const walls1 = new Set(Object.values(one.doc.elements).filter((e) => e.type === 'Wall').map((e) => e.id));
    const tops1 = wallTops(buildModel3d(one.doc, view), walls1);
    expect(tops1.has(2300)).toBe(false);
    expect(tops1.has(2700)).toBe(true);
  });

  it('nivåkoter FG och UK bjl, och höjdmått med tjocklek och fri höjd', () => {
    const { s } = twoStoreys();
    const sec = buildSection(s.doc, 'sektion-a', view)!;
    const texts = (part: string) => sec.prims.flatMap((p) => (p.kind === 'text' && p.origin?.part === part ? [p.text] : []));
    expect(texts('nivå')).toEqual(expect.arrayContaining(['FG ±0,000', 'FG +2,700', 'UK bjl −0,400', 'UK bjl +2,300']));
    expect(texts('höjdmått')).toEqual(['400', '2300', '400']);
    // Fasaderna har golven men inga höjdmått.
    const el = buildSection(s.doc, 'fasad-1', view)!;
    expect(el.prims.some((p) => p.kind === 'text' && p.text === 'FG +2,700')).toBe(true);
    expect(el.prims.some((p) => p.origin?.part === 'höjdmått')).toBe(false);
    // Släckta i Visa.
    const off = buildSection(s.doc, 'sektion-a', { ...view, hide: ['level', 'heightDims'] })!;
    expect(off.prims.some((p) => p.origin?.part === 'nivå' || p.origin?.part === 'höjdmått')).toBe(false);
  });

  it('höjdmåttets punkter: bjälklagens under- och ovansidor nerifrån, utan dubbletter', () => {
    expect(heightChain([{ z0: 2300, z1: 2700 }, { z0: -400, z1: 0 }, { z0: 2300.2, z1: 2700 }])).toEqual([-400, 0, 2300, 2700]);
    expect(heightChain([])).toEqual([]);
  });
});
