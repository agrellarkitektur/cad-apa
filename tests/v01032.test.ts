import { beforeAll, describe, expect, it } from 'vitest';
import { normalizeBook, SWEDISH_STANDARD } from '../src/core/graphics';
import { emptyProject, FORMAT_VERSION, SITE_STOREY, type ViewDef } from '../src/core/model';
import { DocStore } from '../src/core/store';
import {
  categoriesOf,
  categoryOf,
  categoryUses,
  copyCategoryFrom,
  deleteCategory,
  duplicateCategory,
  editCategory,
  moveCategory,
  newCategory,
  putCategory,
  renameCategory,
  resetCategory,
  resolveShow,
  sheetFor,
  showOverrides,
  stylePresets,
  viewSettings,
  viewTypeOf,
  withShow,
} from '../src/core/viewCategories';
import { registerBuiltInTypes } from '../src/elements';
import { buildViewPrims, viewStatesFor } from '../src/repr/sheet';
import { sampleProject } from '../src/sample/sampleProject';
import { parse, ProjectFormatError, serialize } from '../src/storage/format';
import { applyPenField } from '../src/ui/style/pens';

beforeAll(() => registerBuiltInTypes());

/**
 * Tre nivåer med arv (0.10.32): projektets resurser → en vykategori per
 * vytyp → den enskilda vyn, som avviker rad för rad.
 */
describe('stilboken', () => {
  it('ett nytt projekt har Platsens tre kategorier och en för varje annan vytyp', () => {
    const doc = emptyProject('Prov', 'ombyggnad');
    expect(doc.graphics.format).toBe('bacchus-stylebook');
    expect(categoriesOf(doc.graphics, 'site').map((c) => c.name)).toEqual(['Situationsplan', 'Markplaneringsritning', 'Illustrationsplan']);
    // Förslagen och förinställningarna som kategorier sedan 0.10.33 (tests/v01033.test.ts).
    for (const t of ['storey', 'facade', 'section', 'worksheet'] as const) expect(categoriesOf(doc.graphics, t).length).toBeGreaterThanOrEqual(1);
    // Stilen är det som förut var projektets stilmall.
    expect(categoryOf(doc.graphics, 'storey').style.actions).toEqual(SWEDISH_STANDARD.actions);
    expect(FORMAT_VERSION).toBeGreaterThanOrEqual(25);
  });

  it('projekt från 0.10.31 öppnas inte; stilboken och avvikelserna sparas och läses', () => {
    const old = JSON.parse(serialize(emptyProject('Prov', 'nybyggnad')));
    old.formatVersion = 24;
    expect(() => parse(JSON.stringify(old))).toThrow(ProjectFormatError);
    const doc = sampleProject();
    const back = parse(serialize(doc));
    expect(back.graphics.categories.map((c) => `${c.type}:${c.id}`)).toEqual(doc.graphics.categories.map((c) => `${c.type}:${c.id}`));
    expect(back.views.find((v) => v.id === 'vy-a-bl')?.overrides).toEqual({ 'hide:Dimension': true, hideDemolished: true });
  });

  it('en äldre stilmall från fil ger resurserna och stilen till den valda kategorin', () => {
    const doc = emptyProject('Prov', 'nybyggnad');
    const fasad = categoryOf(doc.graphics, 'facade');
    const file = { ...structuredClone(SWEDISH_STANDARD), name: 'Kontorets', openingMark: 0, labels: { ...SWEDISH_STANDARD.labels, align: 'center' } };
    const book = normalizeBook(file, doc.graphics, fasad);
    expect(book.name).toBe('Kontorets');
    expect(book.labels.align).toBe('center');
    expect(categoryOf(book, 'facade').style.openingMark).toBe(0);
    expect(categoryOf(book, 'storey').style.openingMark).toBe(250);
    expect(() => normalizeBook({ format: 'annat' })).toThrow();
  });
});

describe('vyn följer sin kategori', () => {
  const plan = (doc: ReturnType<typeof sampleProject>) => categoryOf(doc.graphics, 'storey', 'plan');

  it('visningen är kategorins med vyns avvikelser, rad för rad', () => {
    const doc = sampleProject();
    const v = doc.views.find((x) => x.id === 'vy-a-bl')!;
    expect(viewSettings(doc, v).show).toMatchObject({ compare: true, hideDemolished: true, hide: ['Dimension'] });
    // Kategorin ändras: vyn följer med, utom på raderna den själv ändrat.
    const c = plan(doc);
    doc.graphics = putCategory(doc.graphics, { ...c, show: { ...c.show, detail: 'detail', hide: ['Furniture'], hideDemolished: false } });
    expect(viewSettings(doc, v).show).toMatchObject({ detail: 'detail', hideDemolished: true });
    expect(viewSettings(doc, v).show.hide.sort()).toEqual(['Dimension', 'Furniture']);
  });

  it('avvikelserna räknas fram ur det som visas, och stilens avvikelser är kvar', () => {
    const c = plan(sampleProject());
    const show = { ...c.show, compare: false, hide: ['Space'] };
    const ov = showOverrides(c, show);
    expect(ov).toEqual({ compare: false, 'hide:Space': true });
    expect(resolveShow(c, ov)).toEqual(show);
    expect(showOverrides(c, c.show)).toEqual({});
    const kept = withShow(c, { openingMark: 0, compare: false }, c.show);
    expect(kept).toEqual({ openingMark: 0 });
    expect(withShow(c, undefined, c.show)).toBeUndefined();
    // En sak som kategorin döljer och vyn visar.
    const c2 = { ...c, show: { ...c.show, hide: ['Furniture'] } };
    expect(showOverrides(c2, c.show)).toEqual({ 'hide:Furniture': false });
    expect(resolveShow(c2, { 'hide:Furniture': false }).hide).toEqual([]);
  });

  it('stilen: samma kategori ger samma stilmall, och vyns avvikelse en egen', () => {
    const doc = sampleProject();
    const c = plan(doc);
    expect(sheetFor(doc.graphics, c)).toBe(sheetFor(doc.graphics, c));
    const red = { ...c.style.actions.new, cutFill: { kind: 'solid' as const, color: '#c2372c' as const } };
    const own = sheetFor(doc.graphics, c, { 'actions.new': red, compare: false });
    expect(own.actions.new.cutFill).toEqual(red.cutFill);
    expect(own).toBe(sheetFor(doc.graphics, c, { 'actions.new': red }));
    expect(sheetFor(doc.graphics, c).actions.new).toEqual(c.style.actions.new);
    // Resurserna följer med.
    expect(own.materials).toBe(doc.graphics.materials);
    // En penna tillbaka till förvalet (null).
    const pens = editCategory(doc.graphics, c, (s) => applyPenField(s, { dataset: { pen: 'north:weight' }, value: '0.5' } as unknown as HTMLInputElement)).book;
    const c3 = categoryOf(pens, 'storey', 'plan');
    expect(sheetFor(pens, c3).pens?.north?.weight).toBe(0.5);
    expect(sheetFor(pens, c3, { 'pens.north': null }).pens?.north).toBeUndefined();
  });

  it('exemplets skiss har kategorin Skiss med Poché; väggarna ritas svarta', () => {
    const doc = sampleProject();
    const fill = (id: string) => {
      const v = doc.views.find((x) => x.id === id)!;
      return buildViewPrims(doc, v, { scale: 100 }).find((q) => q.kind === 'region' && q.origin?.objectType === 'Wall' && q.role === 'cut');
    };
    const skiss = doc.views.find((x) => x.id === 'vy-skiss')!;
    expect(viewSettings(doc, skiss).cat.name).toBe('Skiss');
    expect(viewStatesFor(doc, skiss, { scale: 100 })).toMatchObject({ detail: 'sketch', hide: ['Furniture'], compareTo: undefined });
    expect(fill('vy-skiss')).toMatchObject({ fill: { kind: 'solid', color: 'ink' } });
    expect(fill('vy-a')).not.toMatchObject({ fill: { kind: 'solid', color: 'ink' } });
  });

  it('vytypen kommer av vad vyn visar; Platsens kategorier ritar materialen efter sin sort', () => {
    const doc = sampleProject();
    const at = (p: Partial<ViewDef>) => viewTypeOf(doc, { storey: 'pl-1', ...p });
    expect([at({}), at({ storey: SITE_STOREY }), at({ marker: 'sektion-a' }), at({ marker: 'fasad-1' }), at({ worksheet: 'ws' })]).toEqual(['storey', 'site', 'section', 'facade', 'worksheet']);
    const v: ViewDef = { id: 'v', name: 'Ill', storey: SITE_STOREY, state: doc.states[0].id, category: 'illustration' };
    expect(viewStatesFor(doc, v, { scale: 200 }).category).toBe('illustration');
    // En kategori som inte finns, eller hör till en annan vytyp: vytypens första.
    expect(viewSettings(doc, { ...v, category: 'plan' }).cat.id).toBe('situation');
  });
});

describe('kategorierna', () => {
  it('ny, duplicera, byt namn, flytta och återställ', () => {
    let book = sampleProject().graphics;
    const n = newCategory(book, 'storey', 'Bygglov');
    book = n.book;
    expect(n.cat).toMatchObject({ id: 'bygglov', type: 'storey' });
    const d = duplicateCategory(book, n.cat);
    book = d.book;
    expect(d.cat.name).toBe('Bygglov (kopia)');
    expect(categoriesOf(book, 'storey').map((c) => c.id).slice(-2)).toEqual(['bygglov', 'bygglov-kopia']);
    book = renameCategory(book, d.cat, 'Undertak');
    expect(categoryOf(book, 'storey', d.cat.id).name).toBe('Undertak');
    book = moveCategory(book, categoryOf(book, 'storey', 'plan'), 1);
    expect(categoriesOf(book, 'storey')[1].id).toBe('plan');
    expect(moveCategory(book, categoriesOf(book, 'storey')[0], -1)).toBe(book);
    // Skissen återställs till vytypens förval, med namnet kvar.
    book = resetCategory(book, categoryOf(book, 'storey', 'skiss'));
    expect(categoryOf(book, 'storey', 'skiss')).toMatchObject({ name: 'Skiss', show: { detail: 'normal' }, style: { actions: SWEDISH_STANDARD.actions } });
  });

  it('kopiera från en förinställning ger bara stilen; från samma vytyp allt utom namnet', () => {
    const book = sampleProject().graphics;
    const plan = categoryOf(book, 'storey', 'plan');
    const farg = stylePresets().find((p) => p.name === 'Färgmarkerad')!;
    const a = categoryOf(copyCategoryFrom(book, plan, farg), 'storey', 'plan');
    expect(a.style.actions.new.cutFill).toMatchObject({ color: '#c2372c' });
    expect(a.show).toEqual(plan.show);
    const b = categoryOf(copyCategoryFrom(book, plan, categoryOf(book, 'storey', 'skiss')), 'storey', 'plan');
    expect(b).toMatchObject({ id: 'plan', name: 'Plan', show: { detail: 'sketch' } });
    const c = categoryOf(copyCategoryFrom(book, plan, categoryOf(book, 'site', 'illustration')), 'storey', 'plan');
    expect(c.show).toEqual(plan.show);
  });

  it('ta bort: vyerna med den får vytypens första; den sista går inte att ta bort', () => {
    const store = new DocStore(sampleProject());
    const skiss = categoryOf(store.doc.graphics, 'storey', 'skiss');
    expect(categoryUses(store.doc, skiss)).toBe(1);
    expect(categoryUses(store.doc, categoryOf(store.doc.graphics, 'storey', 'plan'))).toBe(4);
    const r = deleteCategory(store.doc, skiss)!;
    store.transact('Ta bort', (tx) => {
      tx.setGraphics(r.book);
      tx.setViews(r.views);
    });
    const v = store.doc.views.find((x) => x.id === 'vy-skiss')!;
    expect(v.category).toBeUndefined();
    expect(viewSettings(store.doc, v).cat.id).toBe('plan');
    expect(deleteCategory(store.doc, categoryOf(store.doc.graphics, 'worksheet'))).toBeNull();
  });
});
