import { beforeAll, describe, expect, it } from 'vitest';
import type { StyleSheet } from '../src/core/graphics';
import type { ProjectDoc } from '../src/core/model';
import { defaultSheet } from '../src/core/viewCategories';
import { registerBuiltInTypes } from '../src/elements';
import { facadeRowOf } from '../src/repr/facadePens';
import { stylePlaces } from '../src/repr/penPlaces';
import { penGroupsFor } from '../src/repr/penRows';
import type { Primitive } from '../src/repr/primitives';
import { buildSection } from '../src/repr/section';
import { sampleProject } from '../src/sample/sampleProject';

beforeAll(() => registerBuiltInTypes());

/**
 * Snitt- och konturlinjer i fasader och sektioner (0.10.38): fasadernas
 * linjer är objektens konturlinjer, egna ställen skilda från planens, och
 * sektionernas snitt har objektens snittlinjer.
 */
const section = (doc: ProjectDoc, id: string, style: StyleSheet) => buildSection(doc, id, { state: doc.states.at(-1)!.id }, style)!.prims;
const sheet = (doc: ProjectDoc, type: 'facade' | 'section', pens: StyleSheet['pens'] = {}): StyleSheet => {
  const s = structuredClone(defaultSheet(doc.graphics, type));
  return { ...s, pens: { ...s.pens, ...pens } };
};
const lines = (prims: Primitive[], type: string, part?: string) => prims.filter((p) => p.kind === 'line' && p.origin?.objectType === type && (!part || p.origin.part === part));

describe('raderna', () => {
  it('delen och objekttypen ger raden; planens och fasadens rader är var sin', () => {
    expect(facadeRowOf('frame', 'Door')).toBe('doorFrameElev');
    expect(facadeRowOf('frame', 'Window')).toBe('windowFrameElev');
    expect(facadeRowOf('sill', 'Door')).toBe('windowSillElev');
    expect(facadeRowOf('hole', 'Wall')).toBe('wallHoleElev');
    expect(facadeRowOf(undefined, 'Slab')).toBe('slabElev');
    expect(facadeRowOf(undefined, 'Furniture')).toBe('otherElev');
    const rows = (t: 'storey' | 'facade' | 'section') => penGroupsFor(t).flatMap((g) => g.rows.map((r) => r.key));
    expect(rows('storey')).toContain('doorLeaf');
    expect(rows('storey')).not.toContain('doorLeafElev');
    expect(rows('facade')).toContain('doorLeafElev');
    expect(rows('facade')).not.toContain('wallCut');
    expect(rows('section')).toEqual(expect.arrayContaining(['wallCut', 'slabCut', 'roofCut', 'wallElev']));
    expect(rows('section')).not.toContain('doorLeaf');
    // Åtgärdernas kontur är ingen penna längre, bara en linjetyp.
    const outline = stylePlaces(sampleProject()).find((p) => p.key === 'outline.plain');
    expect(outline && !outline.pen && outline.linetype !== undefined).toBe(true);
  });
});

describe('fasaderna', () => {
  it('väggens hål och fönstrets karm har var sin rad, med förvalen som förut', () => {
    const doc = sampleProject();
    const before = section(doc, 'sektion-a', sheet(doc, 'section'));
    const hole = lines(before, 'Wall', 'hole');
    expect(hole.length).toBeGreaterThan(0);
    expect(hole.every((p) => p.kind === 'line' && p.pen.weight === 0.35)).toBe(true);
    expect(lines(section(doc, 'sektion-a', sheet(doc, 'section', { wallHoleElev: { weight: 0.7 } })), 'Wall', 'hole').every((p) => p.kind === 'line' && p.pen.weight === 0.7)).toBe(true);
    const after = section(doc, 'fasad-1', sheet(doc, 'facade', { windowFrameElev: { weight: 0.5, color: '#2f6db5' } }));
    const frames = lines(after, 'Window', 'frame');
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every((p) => p.kind === 'line' && p.pen.weight === 0.5 && p.pen.color === '#2f6db5')).toBe(true);
    // Planens rad för samma del gäller inte fasaden.
    const plan = section(doc, 'fasad-1', sheet(doc, 'facade', { windowFrameContour: { weight: 0.7 } }));
    expect(lines(plan, 'Window', 'frame').every((p) => p.kind === 'line' && p.pen.weight === 0.25)).toBe(true);
  });
});

describe('sektionerna', () => {
  const cutOutlines = (prims: Primitive[]) =>
    prims.flatMap((p) => (p.kind === 'region' && p.role === 'cut' && !p.ownFill && p.outline ? [p.outline] : p.kind === 'polyline' && p.asOutline ? [p.pen] : []));

  it('snittet får objekttypens snittlinje som tjocklek', () => {
    const doc = sampleProject();
    const base = cutOutlines(section(doc, 'sektion-a', sheet(doc, 'section')));
    expect(base.length).toBeGreaterThan(0);
    expect(base.every((o) => o.weight === 0.35)).toBe(true);
    const fat = section(doc, 'sektion-a', sheet(doc, 'section', { wallCut: { weight: 0.7 } }));
    const walls = fat.filter((p) => p.kind === 'region' && p.role === 'cut' && p.origin?.objectType === 'Wall');
    expect(walls.length).toBeGreaterThan(0);
    expect(walls.every((p) => p.kind === 'region' && p.outline?.weight === 0.7)).toBe(true);
    // Bjälklagens snittlinje gäller inte väggarna.
    const slab = section(doc, 'sektion-a', sheet(doc, 'section', { slabCut: { weight: 0.7 } }));
    expect(slab.filter((p) => p.kind === 'region' && p.role === 'cut' && p.origin?.objectType === 'Wall').every((p) => p.kind === 'region' && p.outline?.weight === 0.35)).toBe(true);
  });
});
