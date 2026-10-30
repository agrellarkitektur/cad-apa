import { defaultSheet } from '../src/core/viewCategories';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_MATERIALS, normalizeMaterials, normalizeStyle } from '../src/core/graphics';
import { deleteMaterial, linkMaterial, materialUses, saveMaterial } from '../src/core/materials';
import { emptyProject } from '../src/core/model';
const newProject = () => emptyProject('Prov', 'nybyggnad');
import { registerBuiltInTypes } from '../src/elements';
import { effectiveFill, fillPrims, type FillParams } from '../src/elements/drawing2d';
import { groundType, type GroundParams } from '../src/elements/ground';
import { colorGroups, colorShapes } from '../src/repr/groundColors';
import { terrainMesh3d } from '../src/repr/terrain';
import { finishedForView } from '../src/repr/terrain';
import type { RegionPrim } from '../src/repr/primitives';
import { parse } from '../src/storage/format';
import { fillChange } from '../src/ui/shapeFields';
import { fillPanel } from '../src/ui/fillPanel';
import { groundFieldsMarkup } from '../src/ui/groundFields';
import { addGround, onSlope, square, storeWithShapes } from './projekt';
import { createContext } from '../src/repr/context';
import type { DocStore } from '../src/core/store';

/**
 * Material, mark först (0.10.28): materialen i stilmallen med en
 * representation per vykategori, markobjekten kopplade till dem, och
 * kulörerna i 3D.
 */

beforeAll(() => registerBuiltInTypes());

const attrs = (k: string) => `data-key="d2:${k}"`;
const input = (value: string) => ({ value, checked: false }) as HTMLInputElement;
const params = (store: DocStore, id: string) => store.doc.elements[id].params as unknown as GroundParams & FillParams;
/** Platsens plan (0.10.25) i Förslag A, i en vykategori. */
const siteCtx = (store: DocStore, category?: 'illustration') => createContext(store.doc, 'platsen', { state: 'st-a', ...(category ? { category } : {}) }, defaultSheet(store.doc.graphics), () => true).ctx;
const area = (store: DocStore, x = 20000) => addGround(store, { kind: 'area', outline: [[x, 0], [x + 6000, 0], [x + 6000, 4000], [x, 4000]], height: 2000 });

describe('Materialen i stilmallen (0.10.28)', () => {
  it('ett nytt projekt har markmaterialen; de läses från fil och följer med en förinställd stilmall', () => {
    const doc = newProject();
    expect(doc.graphics.materials!.map((m) => m.name)).toEqual(DEFAULT_MATERIALS.map((m) => m.name));
    expect(normalizeMaterials([{ id: 'a', name: ' A ', ground: 'ja', plan: { fill: 'solid' }, illustration: { color: 'röd' }, color3d: '#112233' }, { id: 'a', plan: { fill: 'solid' } }, { id: 'b' }])).toEqual([
      { id: 'a', name: 'A', ground: false, building: false, plan: { fill: 'solid' }, color3d: '#112233' },
    ]);
    const style = normalizeStyle({ format: 'bacchus-style', materials: [...DEFAULT_MATERIALS] });
    expect(style.materials).toHaveLength(DEFAULT_MATERIALS.length);
  });

  it('ett projekt i format 22 öppnas inte', () => {
    const old = { ...newProject(), formatVersion: 22 };
    expect(() => parse(JSON.stringify(old))).toThrow(/äldre alfaversion/);
  });
});

describe('Markobjektens material (0.10.28)', () => {
  it('kopplas till ett material med en kopia av planens fyllning; Eget behåller det som syntes', () => {
    const store = onSlope();
    const id = area(store);
    fillChange(store, [id], 'material', input('grus'));
    expect(params(store, id)).toMatchObject({ material: 'grus', fill: 'solid', fillColor: '#ddd3bc', fillOpacity: 80 });
    expect(materialUses(store.doc, 'grus')).toBe(1);
    fillChange(store, [id], 'material', input(''));
    expect(params(store, id).material).toBeUndefined();
    expect(params(store, id)).toMatchObject({ fill: 'solid', fillColor: '#ddd3bc' });
  });

  it('en ändring i panelen ändrar materialet och alla objekt med det', () => {
    const store = onSlope();
    const a = area(store);
    const b = area(store, 30000);
    linkMaterial(store, [a, b], 'gras');
    fillChange(store, [a], 'fillColor', input('#00ff00'));
    expect(store.doc.graphics.materials!.find((m) => m.id === 'gras')!.plan.fillColor).toBe('#00ff00');
    expect(params(store, b).fillColor).toBe('#00ff00');
    // Ångra tar tillbaka materialet och objekten i ett steg.
    store.undo();
    expect(params(store, b).fillColor).toBe('#b4d39b');
  });

  it('opaciteten och vridningen gäller bara objektet; borttaget material lämnar det som syntes', () => {
    const store = onSlope();
    const a = area(store);
    const b = area(store, 30000);
    linkMaterial(store, [a, b], 'tegel');
    fillChange(store, [a], 'materialOpacity', input('40'));
    fillChange(store, [a], 'materialAngle', input('30'));
    const fa = effectiveFill(params(store, a), store.doc.graphics);
    expect(fa).toMatchObject({ fill: 'type', fillType: 'tegel', fillOpacity: 40, fillTypeAngle: 30 });
    expect(effectiveFill(params(store, b), store.doc.graphics)).toMatchObject({ fillOpacity: 100 });
    // Tomt följer materialet igen.
    fillChange(store, [a], 'materialOpacity', input(''));
    expect(params(store, a).materialOpacity).toBeUndefined();
    deleteMaterial(store, 'tegel');
    expect(store.doc.graphics.materials!.some((m) => m.id === 'tegel')).toBe(false);
    expect(params(store, a)).toMatchObject({ fill: 'type', fillType: 'tegel', fillTypeAngle: 30 });
    expect(params(store, a).material).toBeUndefined();
  });

  it('illustrationsplanen ritar materialets färg, planen dess fyllning', () => {
    const store = onSlope();
    const a = area(store);
    linkMaterial(store, [a], 'grus');
    const draw = (category?: 'illustration') => (groundType.plan!(store.doc.elements[a] as never, siteCtx(store, category)) as RegionPrim[]).filter((q) => q.kind === 'region' && q.origin?.part === 'fyllning');
    expect(draw()[0].fill).toMatchObject({ kind: 'solid', color: '#ddd3bc', opacity: 0.8 });
    expect(draw('illustration')[0].fill).toMatchObject({ kind: 'solid', color: '#e2d6ba', opacity: 0.5 });
    // Utan egen färg i illustrationsplanen: som planen.
    fillChange(store, [a], 'matIllKind', input('plan'));
    expect(draw('illustration')[0].fill).toMatchObject({ color: '#ddd3bc' });
  });

  it('panelen heter Material för markobjekten och visar bara markens material', () => {
    const store = onSlope();
    const a = area(store);
    const html = () => groundFieldsMarkup(store.doc, store.doc.elements[a], { state: 'st-a' });
    expect(html()).toContain('>Material<');
    linkMaterial(store, [a], 'gras');
    expect(html()).toContain('d2:matColor3d');
    expect(html()).toContain('d2:materialOpacity');
    // En 2D-form ser alla material.
    const shapes = storeWithShapes({ s: { points: square(0, 0), closed: true, fill: 'solid' } });
    expect(fillPanel('x', shapes.doc.elements.s.params as unknown as FillParams, attrs, shapes.doc.graphics)).toContain('Gräs');
  });

  it('en egen fyllning sparad som material passar objektet (Mark)', () => {
    const store = onSlope();
    const a = area(store);
    fillChange(store, [a], 'fillKind', input('solid'));
    const id = saveMaterial(store, [a], 'Kullersten')!;
    expect(store.doc.graphics.materials!.find((m) => m.id === id)).toMatchObject({ name: 'Kullersten', ground: true, building: false, plan: { fill: 'solid' } });
    expect(params(store, a).material).toBe(id);
  });

  it('stödmuren ritas ovanifrån på Platsen med materialets ytfyllning (0.10.28.1) och får dess kulör i 3D', () => {
    const store = onSlope();
    const w = addGround(store, { kind: 'wall', outline: [], line: [[20000, 0], [26000, 0]], height: 3000, width: 300 } as GroundParams);
    const prims = () => groundType.plan!(store.doc.elements[w] as never, siteCtx(store)) as RegionPrim[];
    const cut = () => prims().filter((q) => q.kind === 'region');
    expect(cut()).toEqual([]);
    expect(prims().some((q) => (q as { kind: string }).kind === 'polyline' && q.origin?.part === 'mur')).toBe(true);
    linkMaterial(store, [w], 'betong');
    expect(cut()[0].fill.kind).toBe('pattern');
    expect((cut()[0] as { under?: boolean }).under).toBe(true);
    const solids = groundType.model3d!(store.doc.elements[w] as never, siteCtx(store)).filter((s) => s.kind !== 'edges');
    expect(solids.length).toBeGreaterThan(0);
    expect(solids.every((s) => (s as { color?: string }).color === '#c4c4bf')).toBe(true);
  });
});

describe('Kulörerna i 3D (0.10.28)', () => {
  it('trianglarna i en markyta med material får materialets kulör', () => {
    const store = onSlope();
    const a = area(store);
    const view = { state: 'st-a' };
    expect(colorShapes(store.doc, view)).toEqual([]);
    linkMaterial(store, [a], 'asfalt');
    const mesh = terrainMesh3d(store.doc, view, finishedForView(store.doc, view))!;
    const c = colorGroups(mesh, colorShapes(store.doc, view))!;
    expect(c.indices.length).toBe(mesh.indices.length);
    const asphalt = c.groups.find((g) => g.color === '#8f8e8a')!;
    expect(asphalt.count).toBeGreaterThan(0);
    expect(c.groups.find((g) => g.color === null)!.count).toBeGreaterThan(asphalt.count);
    // Alla trianglarna med asfalt ligger i markytan.
    const P = mesh.positions;
    for (let i = asphalt.start; i < asphalt.start + asphalt.count; i += 3) {
      const x = (P[c.indices[i] * 3] + P[c.indices[i + 1] * 3] + P[c.indices[i + 2] * 3]) / 3;
      expect(x).toBeGreaterThan(19900);
      expect(x).toBeLessThan(26100);
    }
    expect(fillPrims).toBeDefined();
  });
});
