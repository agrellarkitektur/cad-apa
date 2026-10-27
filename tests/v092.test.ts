import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { buildSection } from '../src/repr/section';
import { heightChain } from '../src/repr/sectionLevels';
import { twoStoreys } from './projekt';

beforeAll(() => registerBuiltInTypes());

const view = { state: 'st-a' };
describe('Nivåer (0.9.2)', () => {
  it('nivåmarkörer FG och UK bjl, och höjdmått med tjocklek och fri höjd', () => {
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
