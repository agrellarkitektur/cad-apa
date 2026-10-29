import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_MATERIALS } from '../src/core/graphics';
import { FILL_TYPES } from '../src/core/fillTypes';
import { addMaterial, linkMaterial, materialFits, moveMaterial, updateMaterial, useOf } from '../src/core/materials';
import { registerBuiltInTypes } from '../src/elements';
import type { FillParams } from '../src/elements/drawing2d';
import type { GroundParams } from '../src/elements/ground';
import { fillPanel } from '../src/ui/fillPanel';
import { materialFieldChange, materialSection } from '../src/ui/style/materials';
import { addGround, onSlope } from './projekt';

/**
 * Materiallistan (0.10.28.1): kryssrutorna *Mark* och *Byggnad*, fler
 * material i ett nytt projekt, och listan i stilmallens dialog.
 */

beforeAll(() => registerBuiltInTypes());

const field = (key: string, value: string, checked = false) => ({ dataset: { material: key }, value, checked }) as unknown as HTMLInputElement;

describe('Materialen med Mark och Byggnad (0.10.28.1)', () => {
  it('ett nytt projekt har de nya materialen, med mönster som finns', () => {
    const names = DEFAULT_MATERIALS.map((m) => m.name);
    for (const n of ['Jord', 'Stenmur', 'Singel', 'Täckbark', 'Trall', 'Planteringsyta', 'Stenmjöl', 'Gatsten', 'Aluminium']) expect(names).toContain(n);
    const by = (n: string) => DEFAULT_MATERIALS.find((m) => m.name === n)!;
    for (const n of ['Betong', 'Tegel', 'Trall']) expect(by(n)).toMatchObject({ ground: true, building: true });
    expect(by('Aluminium')).toMatchObject({ ground: false, building: true });
    expect(by('Gräs')).toMatchObject({ ground: true, building: false });
    for (const m of DEFAULT_MATERIALS) if (m.plan.fill === 'type') expect(FILL_TYPES[m.plan.fillType as string], m.name).toBeTruthy();
  });

  it('markobjekten ser markens material, 2D-formerna alla', () => {
    const store = onSlope();
    const a = addGround(store, { kind: 'area', outline: [[20000, 0], [26000, 0], [26000, 4000], [20000, 4000]], height: 2000 } as GroundParams);
    const el = store.doc.elements[a];
    expect(useOf(el)).toBe('ground');
    expect(useOf({ type: 'Shape2D' })).toBeUndefined();
    const alu = DEFAULT_MATERIALS.find((m) => m.id === 'aluminium')!;
    expect(materialFits(alu, 'ground')).toBe(false);
    expect(materialFits(alu, undefined)).toBe(true);
    const attrs = (k: string) => `data-key="g:${k}"`;
    const html = fillPanel('x', el.params as unknown as FillParams, attrs, store.doc.graphics, 'Material', { use: 'ground' });
    expect(html).toContain('Gräs');
    expect(html).not.toContain('Aluminium');
    expect(fillPanel('x', {} as FillParams, attrs, store.doc.graphics)).toContain('Aluminium');
  });
});

describe('Materiallistan i stilmallen (0.10.28.1)', () => {
  it('ett nytt material läggs sist och får ett eget namn; ordningen går att ändra', () => {
    const store = onSlope();
    const n = store.doc.graphics.materials!.length;
    const id = addMaterial(store);
    const id2 = addMaterial(store);
    const list = () => store.doc.graphics.materials!;
    expect(list()).toHaveLength(n + 2);
    expect(list()[n]).toMatchObject({ id, name: 'Nytt material', ground: true, building: false });
    expect(list()[n + 1].name).toBe('Nytt material 2');
    moveMaterial(store, id2, -1);
    expect(list()[n].id).toBe(id2);
    moveMaterial(store, list()[0].id, -1);
    expect(list()[n].id).toBe(id2);
    store.undo();
    expect(list()[n].id).toBe(id);
  });

  it('dialogens fält ändrar namnet, kryssrutorna och färgerna, och objekten följer planens färg', () => {
    const store = onSlope();
    const a = addGround(store, { kind: 'area', outline: [[20000, 0], [26000, 0], [26000, 4000], [20000, 4000]], height: 2000 } as GroundParams);
    linkMaterial(store, [a], 'gras');
    const apply = (key: string, value: string, checked = false) => {
      const c = materialFieldChange(store.doc.graphics, field(key, value, checked))!;
      updateMaterial(store, c.id, c.label, c.fn);
    };
    apply('gras:name', 'Gräsmatta');
    apply('gras:building', '', true);
    apply('gras:plan', '#112233');
    apply('gras:ill', '#445566');
    apply('gras:c3d', '#778899');
    expect(store.doc.graphics.materials!.find((m) => m.id === 'gras')).toMatchObject({ name: 'Gräsmatta', ground: true, building: true, plan: { fillColor: '#112233' }, illustration: { color: '#445566' }, color3d: '#778899' });
    expect((store.doc.elements[a].params as unknown as FillParams).fillColor).toBe('#112233');
    expect(materialFieldChange(store.doc.graphics, field('gras:plan', 'röd'))).toBeNull();
    expect(materialFieldChange(store.doc.graphics, field('finns-inte:name', 'X'))).toBeNull();
    const html = materialSection(store.doc.graphics, new Map([['gras', 1]]));
    expect(html).toContain('Gräsmatta');
    expect(html).toContain('1 objekt');
    expect(html).toContain('data-material="gras:building" checked');
  });
});
