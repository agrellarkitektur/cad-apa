import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { updateParams } from '../src/core/commands';
import { DEFAULT_MATERIALS } from '../src/core/graphics';
import { modelViewId, SITE_STOREY } from '../src/core/model';
import { addLegend, addViewport, createSheet } from '../src/core/sheets';
import { DocStore } from '../src/core/store';
import { tracedStorey, TRACE_STOREY } from '../src/core/storeys';
import { LEGEND_DEFAULTS, legendRows } from '../src/elements/legend';
import type { Primitive } from '../src/repr/primitives';
import { buildSheet } from '../src/repr/sheet';
import { sampleProject } from '../src/sample/sampleProject';

beforeAll(() => registerBuiltInTypes());

const texts = (prims: readonly Primitive[]) => prims.filter((p): p is Extract<Primitive, { kind: 'text' }> => p.kind === 'text').map((t) => t.text);
const style = { materials: [...DEFAULT_MATERIALS] };

describe('Teckenförklaring (0.10.30)', () => {
  it('raderna: materialen i vyerna, i stilmallens ordning eller efter namn, med egna och bortvalda', () => {
    const src = [{ viewport: 'a', scale: 200, materials: ['tegel', 'gras', 'asfalt'], own: [{ fill: 'solid', fillColor: '#ff0000' }] }];
    const names = (over = {}) => legendRows({ ...LEGEND_DEFAULTS, ...over }, src, style).map((r) => r.name);
    expect(names()).toEqual(['Gräs', 'Asfalt', 'Tegel']);
    expect(names({ order: 'name' })).toEqual(['Asfalt', 'Gräs', 'Tegel']);
    expect(names({ categories: 'building' })).toEqual(['Tegel']);
    expect(names({ removed: ['asfalt'], extra: ['grus'] })).toEqual(['Gräs', 'Grus', 'Tegel']);
    expect(names({ own: true }).at(-1)).toBe('Eget');
    // Mönstret i vyns skala.
    expect(legendRows(LEGEND_DEFAULTS, src, style)[0].scale).toBe(200);
  });

  it('läser det som syns i bladets vyer och ritar en ruta per material', () => {
    const store = new DocStore(sampleProject());
    const room = Object.values(store.doc.elements).find((e) => e.type === 'Space' && e.storey === store.doc.storeys[0].id)!;
    updateParams(store, [room.id], { material: 'gras' }, 'test');
    const sheet = createSheet(store, { size: 'A1', orientation: 'landscape' });
    addViewport(store, sheet, { view: modelViewId(store.doc.storeys[0].id), at: [200, 300], scale: 50 });
    const id = addLegend(store, sheet)!;
    expect(store.doc.elements[id].params.categories).toBe('all');
    const draw = () => buildSheet(store.doc, store.doc.sheets.find((s) => s.id === sheet)!, { today: '2026-10-29' }).prims.filter((p) => p.origin?.objectId === id);
    expect(texts(draw())).toEqual(['TECKENFÖRKLARING', 'Gräs']);
    expect(draw().some((p) => p.kind === 'region')).toBe(true);
    // Utan material ingen rad.
    updateParams(store, [room.id], { material: undefined }, 'test');
    expect(texts(draw())).toEqual(['TECKENFÖRKLARING', 'Inga material i bladets vyer']);
  });

  it('ett blad med bara Platsen tar markens material', () => {
    const store = new DocStore(sampleProject());
    const sheet = createSheet(store);
    addViewport(store, sheet, { view: modelViewId(SITE_STOREY), at: [200, 300], scale: 400 });
    const id = addLegend(store, sheet)!;
    expect(store.doc.elements[id].params.categories).toBe('ground');
  });
});

describe('Kalkera en våning från projektträdet (0.10.30)', () => {
  it('en viss våning, inte den som visas', () => {
    const doc = sampleProject();
    const [a] = doc.storeys;
    expect(tracedStorey(doc, SITE_STOREY, TRACE_STOREY + a.id)?.id).toBe(a.id);
    expect(tracedStorey(doc, a.id, TRACE_STOREY + a.id)).toBeUndefined();
  });
});
