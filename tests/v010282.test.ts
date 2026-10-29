import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_MATERIALS, normalizeMaterials } from '../src/core/graphics';
import { linkMaterial, updateMaterial, useOf } from '../src/core/materials';
import { registerBuiltInTypes } from '../src/elements';
import type { FillParams } from '../src/elements/drawing2d';
import type { Primitive } from '../src/repr/primitives';
import { buildSection } from '../src/repr/section';
import { visibleFaces } from '../src/repr/sectionSurfaces';
import { modelShapes, WITHOUT_DEMOLISHED } from '../src/repr/storeyShapes';
import type { Solid } from '../src/repr/solids';
import { fillPanel } from '../src/ui/fillPanel';
import { buildingChange } from '../src/ui/materialBuilding';
import { materialFieldChange, materialSection } from '../src/ui/style/materials';
import { planOf, wallsProject } from './projekt';

/**
 * Material på bjälklag och tak (0.10.28.2): planens fyllning, kulören i 3D,
 * snittet i sektion, ytan i fasad och konturens penna i planen.
 */

beforeAll(() => registerBuiltInTypes());

const OUTLINE = [[0, 0], [6000, 0], [6000, 4000], [0, 4000]];
const ROOF = { outline: OUTLINE, ref: [[0, 0], [6000, 0]], height: 2700, slope: 27, thickness: 300 };
const SLAB = { thickness: 300, outline: OUTLINE };
/** En fasad mot söder (betraktaren söder om huset) och en sektion genom huset. */
const FACADE = { type: 'Elevation', params: { start: [-2000, -6000], end: [8000, -6000], side: 1, depth: null, auto: false } };
const SECTION = { type: 'Section', params: { start: [3000, -2000], end: [3000, 6000], side: 1, depth: null, auto: false, label: 'A' } };

const regionArea = (p: Primitive) => {
  if (p.kind !== 'region') return 0;
  let a = 0;
  for (const r of p.rings) for (let i = 0; i < r.length; i++) a += r[i][0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * r[i][1];
  return Math.abs(a / 2);
};

describe('Byggnadens material (0.10.28.2)', () => {
  it('ett nytt projekt har Takpannor och Plåt med yta i fasad; Betong och Tegel har snitt', () => {
    const by = (id: string) => DEFAULT_MATERIALS.find((m) => m.id === id)!;
    expect(by('takpannor')).toMatchObject({ building: true, ground: false, surface: { fill: 'hatch' } });
    expect(by('plat').surface).toBeTruthy();
    expect(by('betong').cut).toMatchObject({ fill: 'type', fillType: 'betong' });
    expect(by('tegel').cut).toMatchObject({ fill: 'type', fillType: 'tegel' });
    // Snittet, ytan och pennan läses ur filen; trasiga värden faller bort.
    const back = normalizeMaterials([{ ...by('betong'), surface: { fill: 'solid', fillColor: '#ffffff' }, pen: { weight: 0.5, color: '#ff0000' } }, { ...by('tegel'), id: 'x', cut: 'fel', pen: { weight: 0 } }])!;
    expect(back[0]).toMatchObject({ cut: { fillType: 'betong' }, surface: { fill: 'solid' }, pen: { weight: 0.5, color: '#ff0000' } });
    expect(back[1].cut).toBeUndefined();
    expect(back[1].pen).toBeUndefined();
  });

  it('bjälklag och tak ser byggnadens material i panelen, med snitt, yta och penna', () => {
    const s = wallsProject({}, {}, { bj: { type: 'Slab', params: SLAB } });
    expect(useOf(s.doc.elements.bj)).toBe('building');
    linkMaterial(s, ['bj'], 'betong');
    const html = fillPanel('x', s.doc.elements.bj.params as unknown as FillParams, (k) => `data-key="d2:${k}"`, s.doc.graphics, 'Material', { use: 'building' });
    expect(html).toContain('Aluminium');
    expect(html).not.toContain('Gräs');
    expect(html).toContain('Snittet i sektion');
    expect(html).toContain('Ytan i fasad');
    expect(html).toContain('Konturen i planen');
  });

  it('i planen: fyllningen under snittet, materialets penna och kulören i 3D', () => {
    const s = wallsProject({}, {}, { bj: { type: 'Slab', params: SLAB } });
    linkMaterial(s, ['bj'], 'betong');
    const prims = () => planOf(s).prims.filter((p) => p.origin?.objectId === 'bj');
    const fills = prims().filter((p) => p.kind === 'region' && p.origin?.part === 'fyllning');
    expect(fills.length).toBeGreaterThan(0);
    expect(fills.every((p) => p.noPick)).toBe(true);
    // Penna i materialet: konturen följer.
    const m = s.doc.graphics.materials!.find((q) => q.id === 'betong')!;
    const pen = buildingChange(m, 'matPen', '0.5')!;
    updateMaterial(s, m.id, pen.label, pen.fn);
    expect(prims().filter((p) => p.kind === 'line').every((p) => p.kind === 'line' && p.pen.weight === 0.5)).toBe(true);
    // 3D: materialets kulör och nyckel.
    const { shapes } = modelShapes(s.doc, { state: s.doc.states.at(-1)!.id }, s.doc.graphics, WITHOUT_DEMOLISHED);
    const slab = shapes.find(({ s: q }) => q.id === 'bj')!.s as Solid;
    expect(slab).toMatchObject({ color: m.color3d, matId: 'betong' });
  });

  it('i sektion: materialets snitt i stället för det svarta, andra material för sig', () => {
    const s = wallsProject({}, {}, { bj: { type: 'Slab', params: SLAB }, sek: SECTION });
    const cutRegions = () => buildSection(s.doc, 'sek', { state: s.doc.states.at(-1)!.id })!.prims.filter((p) => p.kind === 'region' && p.origin?.objectId === 'bj');
    // Utan material: stilmallens snitt, ingen fyllning med mönster.
    expect(cutRegions().some((p) => p.kind === 'region' && p.ownFill)).toBe(false);
    linkMaterial(s, ['bj'], 'betong');
    const mat = cutRegions();
    expect(mat.some((p) => p.kind === 'region' && p.fill.kind === 'solid' && p.fill.color === 'paper' && !!p.outline)).toBe(true);
    expect(mat.some((p) => p.kind === 'region' && p.fill.kind === 'pattern')).toBe(true);
  });

  it('i fasad: ytan fylls där taket syns, inte bakom en vägg framför', () => {
    const s = wallsProject({}, {}, { tak: { type: 'Roof', params: ROOF }, fas: FACADE });
    const surface = () => buildSection(s.doc, 'fas', { state: s.doc.states.at(-1)!.id })!.prims.filter((p) => p.origin?.part === 'yta');
    expect(surface()).toHaveLength(0);
    linkMaterial(s, ['tak'], 'takpannor');
    const all = surface().reduce((a, p) => a + regionArea(p), 0);
    expect(all).toBeGreaterThan(1e6);
    expect(surface().every((p) => p.noPick)).toBe(true);
    // En hög vägg framför halva taket skymmer den halvan.
    s.transact('vägg', (tx) => tx.putElement({ ...s.doc.elements.tak, id: 'v', type: 'Wall', params: { start: [-500, -1000], end: [3000, -1000], thickness: 200, height: 9000, justification: 'center' } } as never));
    const part = surface().reduce((a, p) => a + regionArea(p), 0);
    expect(part).toBeLessThan(all * 0.7);
    expect(part).toBeGreaterThan(all * 0.3);
    // Fyllningar släckta under Visa: ingen yta.
    expect(buildSection(s.doc, 'fas', { state: s.doc.states.at(-1)!.id, hide: ['fill'] })!.prims.some((p) => p.origin?.part === 'yta')).toBe(false);
  });

  it('en yta bakom en annan form skyms bara där formen ligger framför', () => {
    // En kvadrat 1000 × 1000 på djupet 100 och en remsa framför den (djup 50) som täcker vänstra halvan.
    const quad = (x0: number, x1: number, y0: number, y1: number, d: number) => [x0, y0, d, x1, y0, d, x1, y1, d, x0, y0, d, x1, y1, d, x0, y1, d];
    const face = quad(0, 1000, 0, 1000, 100);
    const front = quad(-100, 500, -100, 1100, 50);
    const behind = quad(500, 1200, -100, 1100, 150);
    const area = (polys: number[][][][]) => polys.reduce((a, poly) => a + regionArea({ kind: 'region', rings: poly } as unknown as Primitive), 0);
    expect(area(visibleFaces(face, [face, front, behind]) as never)).toBeCloseTo(500_000, -2);
  });

  it('materiallistan har snittet, ytan och pennan för byggnadens material', () => {
    const s = wallsProject({}, {}, {});
    const html = materialSection(s.doc.graphics, new Map());
    expect(html).toContain('data-material="takpannor:matSurface"');
    expect(html).not.toContain('data-material="gras:matSurface"');
    const field = (key: string, value: string) => ({ dataset: { material: key }, value }) as unknown as HTMLSelectElement;
    const c = materialFieldChange(s.doc.graphics, field('aluminium:matSurface', 'cross'))!;
    updateMaterial(s, c.id, c.label, c.fn);
    expect(s.doc.graphics.materials!.find((m) => m.id === 'aluminium')!.surface).toMatchObject({ fill: 'cross' });
    const none = materialFieldChange(s.doc.graphics, field('aluminium:matSurface', ''))!;
    updateMaterial(s, none.id, none.label, none.fn);
    expect(s.doc.graphics.materials!.find((m) => m.id === 'aluminium')!.surface).toBeUndefined();
  });
});
