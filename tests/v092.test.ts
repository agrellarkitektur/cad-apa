import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { buildModel3d } from '../src/repr/model3d';
import { buildSection } from '../src/repr/section';
import { heightChain } from '../src/repr/sectionLevels';
import type { Solid } from '../src/repr/solids';
import { sampleProject } from '../src/sample/sampleProject';
import { twoStoreys } from './projekt';

beforeAll(() => registerBuiltInTypes());

const view = { state: 'st-a' };
const wallTops = (shapes: ReturnType<typeof buildModel3d>, storeyWalls: Set<string>) =>
  new Set(shapes.filter((x): x is Solid => x.kind !== 'edges' && storeyWalls.has(x.id) && (x.material === 'wall' || x.material === 'wall-new')).map((x) => Math.round(x.z1)));

describe('Nivåer (0.9.2)', () => {
  it('innerväggarna slutar vid bjälklaget ovanför; ytterväggarna går golv till golv', () => {
    const doc = twoStoreys();
    const plan1 = new Set(Object.values(doc.elements).filter((e) => e.type === 'Wall' && e.storey === 'pl-1').map((e) => e.id));
    // Plattan på plan 2 är 400 tjock: undersidan i 2300.
    const all = wallTops(buildModel3d(doc, view), plan1);
    expect(all.has(2300) && all.has(2700)).toBe(true);
    // Med bara plan 1 i 3D kapas de likadant.
    expect(wallTops(buildModel3d(doc, view, 'pl-1'), plan1)).toEqual(all);
    // Utan bjälklag ovanför: hela våningshöjden.
    const one = sampleProject();
    const tops1 = wallTops(buildModel3d(one, view), plan1);
    expect(tops1.has(2300)).toBe(false);
    expect(tops1.has(2700)).toBe(true);
  });

  it('nivåkoter FG och UK bjl, och höjdmått med tjocklek och fri höjd', () => {
    const doc = twoStoreys();
    const sec = buildSection(doc, 'sektion-a', view)!;
    const texts = (part: string) => sec.prims.flatMap((p) => (p.kind === 'text' && p.origin?.part === part ? [p.text] : []));
    expect(texts('nivå')).toEqual(expect.arrayContaining(['FG ±0,000', 'FG +2,700', 'UK bjl −0,400', 'UK bjl +2,300']));
    expect(texts('höjdmått')).toEqual(['400', '2300', '400']);
    // Fasaderna har golven men inga höjdmått.
    const el = buildSection(doc, 'fasad-1', view)!;
    expect(el.prims.some((p) => p.kind === 'text' && p.text === 'FG +2,700')).toBe(true);
    expect(el.prims.some((p) => p.origin?.part === 'höjdmått')).toBe(false);
    // Släckta i Visa.
    const off = buildSection(doc, 'sektion-a', { ...view, hide: ['level', 'heightDims'] })!;
    expect(off.prims.some((p) => p.origin?.part === 'nivå' || p.origin?.part === 'höjdmått')).toBe(false);
  });

  it('höjdmåttets punkter: bjälklagens under- och ovansidor nerifrån, utan dubbletter', () => {
    expect(heightChain([{ z0: 2300, z1: 2700 }, { z0: -400, z1: 0 }, { z0: 2300.2, z1: 2700 }])).toEqual([-400, 0, 2300, 2700]);
    expect(heightChain([])).toEqual([]);
  });
});
