import { beforeAll, describe, expect, it } from 'vitest';
import { COLOUR_CODED, POCHE } from '../src/core/graphics';
import { emptyProject, type ViewDef } from '../src/core/model';
import { DocStore } from '../src/core/store';
import { linkMaterial, linkOrtho } from '../src/core/materials';
import { addElements } from '../src/core/commands';
import {
  categoriesOf,
  categoryDefault,
  categoryOf,
  deviationCount,
  editStyle,
  effectiveCategory,
  overridesFrom,
  resetViewOverrides,
  viewSettings,
  viewToCategoryDefault,
  viewToNewCategory,
} from '../src/core/viewCategories';
import { registerBuiltInTypes } from '../src/elements';
import { sampleProject } from '../src/sample/sampleProject';
import { changedRows, resetRow } from '../src/ui/style/deviations';
import { applyActionField } from '../src/ui/style/actions';

beforeAll(() => registerBuiltInTypes());

/**
 * Avvikelser och kategorier i vyn (0.10.33): raderna som är ändrade mot
 * nivån ovanför, en vys stil i stilboken, och kategorierna som förslag.
 */
describe('kategorierna i ett nytt projekt', () => {
  it('förslagen för planer och förinställningarna Poché och Färgmarkerad', () => {
    const b = emptyProject('Prov', 'ombyggnad').graphics;
    expect(categoriesOf(b, 'storey').map((c) => c.name)).toEqual(['Plan', 'Mått och littera', 'Undertak', 'Golvplan', 'Poché', 'Färgmarkerad']);
    expect(categoriesOf(b, 'facade').map((c) => c.name)).toEqual(['Fasad', 'Färgmarkerad']);
    expect(categoriesOf(b, 'section').map((c) => c.name)).toEqual(['Sektion', 'Poché', 'Färgmarkerad']);
    expect(categoryOf(b, 'storey', 'poche').style.actions).toEqual(POCHE.actions);
    expect(categoryOf(b, 'section', 'sektion-farg').style.actions).toEqual(COLOUR_CODED.actions);
    expect(categoryOf(b, 'storey', 'matt').show.hide).toEqual(['Furniture']);
    // Planens förval är kvar först, så att vyer utan kategori ser ut som förut.
    expect(categoryOf(b, 'storey').id).toBe('plan');
  });
});

describe('avvikelser', () => {
  const doc = sampleProject();
  const plan = categoryOf(doc.graphics, 'storey', 'plan');

  it('en vys avvikelser räknas om mot kategorin; det som inte avviker försvinner', () => {
    const cur = effectiveCategory(plan, { detail: 'detail', 'hide:Furniture': true });
    expect(overridesFrom(plan, cur)).toEqual({ detail: 'detail', 'hide:Furniture': true });
    expect(overridesFrom(plan, effectiveCategory(plan, { detail: plan.show.detail }))).toBeUndefined();
    // En penna och en åtgärd.
    const r = editStyle(doc.graphics, cur.style, (s) => applyActionField(s, { dataset: { key: 'new', field: 'fill' }, value: 'none' } as unknown as HTMLSelectElement));
    const ov = overridesFrom(plan, { ...cur, style: r.style })!;
    expect(Object.keys(ov).sort()).toEqual(['actions.new', 'detail', 'hide:Furniture']);
    expect(effectiveCategory(plan, ov).style.actions.new.cutFill).toEqual({ kind: 'none' });
  });

  it('raderna som är ändrade, och Återställ på en rad', () => {
    const cur = effectiveCategory(plan, { detail: 'detail', 'hide:Furniture': true, 'actions.new': { ...plan.style.actions.new, doorAngle: 45 } });
    const rows = changedRows(plan, cur, [], false);
    expect([...rows].sort()).toEqual(['actions.new', 'item:Furniture', 'show:detail']);
    const back = resetRow(cur, plan, 'item:Furniture');
    expect(changedRows(plan, back, [], false)).toEqual(new Set(['show:detail', 'actions.new']));
    expect(changedRows(plan, resetRow(resetRow(back, plan, 'show:detail'), plan, 'actions.new'), [], false).size).toBe(0);
  });

  it('en kategori jämförs med sitt förval: Skiss avviker, Plan inte', () => {
    const skiss = categoryOf(doc.graphics, 'storey', 'skiss');
    expect(changedRows(categoryDefault(plan), plan).size).toBe(0);
    const rows = changedRows(categoryDefault(skiss), skiss);
    expect(rows.has('show:detail')).toBe(true);
    expect(rows.has('item:Furniture')).toBe(true);
    expect(rows.has('actions.plain')).toBe(true);
    expect(changedRows(categoryDefault(skiss), resetRow(skiss, categoryDefault(skiss), 'kind')).has('show:detail')).toBe(true);
  });

  it('antalet avvikelser i en vy (punkten i projektträdet)', () => {
    const v = doc.views.find((x) => x.id === 'vy-a-bl')!;
    expect(deviationCount(doc, v)).toBe(2);
    expect(deviationCount(doc, { ...v, overrides: undefined })).toBe(0);
    // En sparad avvikelse som kategorin redan har räknas inte.
    expect(deviationCount(doc, { ...v, overrides: { compare: plan.show.compare } })).toBe(0);
  });
});

describe('en vys stil', () => {
  const setup = () => {
    const store = new DocStore(sampleProject());
    const v: ViewDef = { id: 'prov', name: 'Prov', storey: store.doc.storeys.find((s) => !s.site)!.id, state: store.doc.states[0].id, category: 'plan', overrides: { detail: 'detail', 'hide:Furniture': true } };
    store.transact('vy', (tx) => tx.setViews([...tx.doc.views, v]));
    return store;
  };

  it('Återställ till kategorin', () => {
    const store = setup();
    const views = resetViewOverrides(store.doc.views, 'prov');
    expect(views.find((v) => v.id === 'prov')!.overrides).toBeUndefined();
  });

  it('Gör avvikelserna till kategorins förval: kategorin får dem, vyn följer utan', () => {
    const store = setup();
    const r = viewToCategoryDefault(store.doc, 'prov')!;
    store.transact('förval', (tx) => {
      tx.setGraphics(r.book);
      tx.setViews(r.views);
    });
    const v = store.doc.views.find((x) => x.id === 'prov')!;
    expect(v.overrides).toBeUndefined();
    const c = categoryOf(store.doc.graphics, 'storey', 'plan');
    expect(c.show.detail).toBe('detail');
    expect(c.show.hide).toContain('Furniture');
    // De andra vyerna med kategorin följer med, med sina egna avvikelser kvar.
    const other = store.doc.views.find((x) => x.id === 'vy-a-bl')!;
    expect(other.overrides).toEqual({ 'hide:Dimension': true, hideDemolished: true });
    expect(viewSettings(store.doc, other).show.detail).toBe('detail');
  });

  it('Spara som ny kategori: efter kategorin, och vyn följer den', () => {
    const store = setup();
    const r = viewToNewCategory(store.doc, 'prov', 'Detaljplan')!;
    store.transact('ny', (tx) => {
      tx.setGraphics(r.book);
      tx.setViews(r.views);
    });
    const ids = categoriesOf(store.doc.graphics, 'storey').map((c) => c.id);
    expect(ids.indexOf('detaljplan')).toBe(ids.indexOf('plan') + 1);
    const v = store.doc.views.find((x) => x.id === 'prov')!;
    expect(v).toMatchObject({ category: 'detaljplan' });
    expect(v.overrides).toBeUndefined();
    expect(viewSettings(store.doc, v).show).toMatchObject({ detail: 'detail' });
    expect(categoryOf(store.doc.graphics, 'storey', 'plan').show.detail).toBe('normal');
  });
});

describe('Ortofoto bland markobjektens material', () => {
  it('objektet får sin egen fyllning och ortofotot i 3D; ett material tar bort valet', () => {
    const store = new DocStore(sampleProject());
    const [el] = addElements(store, [{ type: 'Ground', storey: store.doc.storeys[0].id, states: [store.doc.states[0].id], tags: [], params: { kind: 'area', points: [[0, 0], [5000, 0], [5000, 5000]], level: 0 }, props: {} }], store.doc.states[0].id, 'Markyta');
    const gras = store.doc.graphics.materials!.find((m) => m.name === 'Gräs')!;
    linkMaterial(store, [el.id], gras.id);
    linkOrtho(store, [el.id]);
    const p = store.doc.elements[el.id].params as Record<string, unknown>;
    expect(p.ortho3d).toBe(true);
    expect(p.material).toBeUndefined();
    expect(p.fill).toBe((gras.plan as Record<string, unknown>).fill);
    linkMaterial(store, [el.id], gras.id);
    expect((store.doc.elements[el.id].params as Record<string, unknown>).ortho3d).toBeUndefined();
  });
});
