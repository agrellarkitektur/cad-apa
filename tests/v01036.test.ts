import { beforeAll, describe, expect, it } from 'vitest';
import { normalizeBook, normalizePenList } from '../src/core/graphics';
import { emptyProject, type ViewDef } from '../src/core/model';
import { DocStore } from '../src/core/store';
import { addElements } from '../src/core/commands';
import { linkMaterial } from '../src/core/materials';
import { categoryOf, defaultSheet } from '../src/core/viewCategories';
import { registerBuiltInTypes } from '../src/elements';
import { sampleProject } from '../src/sample/sampleProject';
import { facadePen } from '../src/repr/facadePens';
import { penGroupsFor } from '../src/repr/penRows';
import { editPlaces, penKey, penTable, setFillTypeEdit, setLineTypeEdit, setPenEdit, stylePlaces, withFrozenPens } from '../src/repr/penPlaces';
import { addPen, editPen, removePens, setPlaces } from '../src/ui/style/placeEdits';
import { penListMarkup, placeRows, placesMarkup, rowMatches, newPlacesState } from '../src/ui/style/places';
import { penSection } from '../src/ui/style/pens';
import { compareCells } from '../src/ui/tableSort';

beforeAll(() => registerBuiltInTypes());

/**
 * Pennor och ställen (0.10.36): pennlistan med nummer, ställena i
 * kategorierna och vyerna, byt och flytta, och samma listor för
 * linjetyper, fyllningstyper och material.
 */
const placeIn = (doc: Parameters<typeof stylePlaces>[0], id: string) => stylePlaces(doc).find((p) => p.id === id)!;

describe('pennraderna per vytyp', () => {
  it('varje vytyp visar sina grupper', () => {
    const ids = (t: Parameters<typeof penGroupsFor>[0]) => penGroupsFor(t).map((g) => g.id);
    expect(ids('storey')).toEqual(['walls', 'doors', 'windows', 'objects', 'cut', 'contours', 'markers']);
    expect(ids('facade')).toEqual(['facade', 'markers']);
    expect(ids('site')).toEqual(['contours', 'markers']);
    expect(ids('worksheet')).toEqual(['markers']);
    const book = emptyProject('Prov', 'ombyggnad').graphics;
    const html = penSection(defaultSheet(book, 'facade'), 'facade');
    expect(html).toContain('Linjer i fasader och sektioner');
    expect(html).not.toContain('Snittet i planen');
  });

  it('fasadens linjer läser linjetypen ur stilboken', () => {
    const style = structuredClone(defaultSheet(emptyProject('Prov', 'ombyggnad').graphics, 'facade'));
    expect(facadePen(style, 'swing').dash).toEqual([3, 1.5]);
    expect(facadePen(style, 'glass')).toMatchObject({ weight: 0.13, color: 'muted' });
    style.pens = { glass: { weight: 0.18, color: 'ink' }, wall: { weight: 0.25, linetype: 'dotted' }, swing: { weight: 0.13, linetype: 'solid' } };
    expect(facadePen(style, 'glass')).toMatchObject({ weight: 0.18, color: 'ink' });
    expect(facadePen(style, 'wall').dash).toEqual([0.3, 1]);
    expect(facadePen(style, 'swing').dash).toBeUndefined();
  });
});

describe('ställena och pennlistan', () => {
  it('pennorna numreras efter färg och tjocklek, och ett ställe hör till pennan med samma värden', () => {
    const doc = emptyProject('Prov', 'ombyggnad');
    const places = stylePlaces(doc);
    expect(places.some((p) => p.id === 'cat:facade:fasad|pens.hole' && p.pen?.weight === 0.35)).toBe(true);
    expect(places.some((p) => p.id === 'cat:storey:plan|outline.new' && p.tags.includes('snitt'))).toBe(true);
    // Fyllningstypernas ställen: materialens fyllningar (tegel i planen och snittet).
    expect(places.some((p) => p.id === 'mat:tegel|mfill.cut' && p.fillType === 'tegel')).toBe(true);
    const table = penTable(doc.graphics, places);
    expect(table.map((r) => r.pen.no)).toEqual(table.map((_, i) => i + 1));
    expect(table[0].pen).toEqual({ no: 1, weight: 0 });
    expect(table.slice(0, 6).every((r) => !r.pen.color)).toBe(true);
    expect(table.slice(6).map((r) => r.pen.color)).toEqual(['muted', 'muted', '#c99700']);
    expect(table.reduce((n, r) => n + r.places.length, 0)).toBe(places.filter((p) => p.pen).length);
    // Taggarna: vytypen och objektet.
    const ill = places.find((p) => p.where.kind === 'cat' && p.where.cat === 'illustration')!;
    expect(ill.viewTags).toEqual(['platsen', 'illustrationsplan']);
  });

  it('en vy som avviker har sina ställen', () => {
    const store = new DocStore(sampleProject());
    const v: ViewDef = { id: 'prov', name: 'Prov', storey: store.doc.storeys.find((s) => !s.site)!.id, state: store.doc.states[0].id, category: 'plan', overrides: { 'pens.dimension': { weight: 0.35 } } };
    store.transact('vy', (tx) => tx.setViews([...tx.doc.views, v]));
    const mine = stylePlaces(store.doc).filter((p) => p.where.kind === 'view' && p.where.view === 'prov');
    expect(mine.map((p) => p.key)).toEqual(['pens.dimension']);
    expect(mine[0].whereName).toBe('Vyn Prov');
    expect(mine[0].viewTags).toContain('vy');
  });

  it('pennlistan låses, och sparade pennor utan ställen är kvar', () => {
    const doc = emptyProject('Prov', 'ombyggnad');
    const book = withFrozenPens(doc);
    expect(book.penList?.length).toBe(penTable(doc.graphics, stylePlaces(doc)).length);
    expect(withFrozenPens({ ...doc, graphics: book })).toBe(book);
    const extra = { ...book, penList: [...book.penList!, { no: 99, weight: 1.4, color: '#123456' }] };
    const t = penTable(extra, stylePlaces({ ...doc, graphics: extra }));
    expect(t.find((r) => r.pen.no === 99)!.places).toEqual([]);
    expect(normalizePenList([{ no: 2, weight: 0.25 }, { no: 2, weight: 0.5 }, { no: 3, weight: 0.25, color: 'ink' }, { no: 0, weight: 1 }, { no: 4, weight: 0.5, color: '#c2372c' }])).toEqual([
      { no: 2, weight: 0.25 },
      { no: 4, weight: 0.5, color: '#c2372c' },
    ]);
    // Följer med stilboken som fil.
    expect(normalizeBook(JSON.parse(JSON.stringify(extra))).penList?.find((p) => p.no === 99)).toEqual({ no: 99, weight: 1.4, color: '#123456' });
  });
});

describe('byt och flytta', () => {
  it('Flytta till pennan: ställena byter penna, pennorna är oförändrade', () => {
    const store = new DocStore(emptyProject('Prov', 'ombyggnad'));
    const before = penTable(withFrozenPens(store.doc), stylePlaces(store.doc));
    const p025 = before.find((r) => penKey(r.pen) === '0.25|ink')!;
    const p018 = before.find((r) => penKey(r.pen) === '0.18|ink')!;
    const ids = ['cat:storey:plan|pens.doorFrameCut', 'cat:facade:fasad|pens.wall'];
    setPlaces(store, 'pen', ids, String(p018.pen.no));
    const after = penTable(store.doc.graphics, stylePlaces(store.doc));
    expect(after.find((r) => r.pen.no === p025.pen.no)!.places.length).toBe(p025.places.length - 2);
    expect(after.find((r) => r.pen.no === p018.pen.no)!.places.length).toBe(p018.places.length + 2);
    expect(after.find((r) => r.pen.no === p025.pen.no)!.pen).toEqual(p025.pen);
    expect(categoryOf(store.doc.graphics, 'storey', 'plan').style.pens?.doorFrameCut).toEqual({ weight: 0.18 });
    // En ångring.
    store.undo();
    expect(categoryOf(store.doc.graphics, 'storey', 'plan').style.pens?.doorFrameCut).toBeUndefined();
  });

  it('en ändrad penna ändrar alla sina ställen; en penna som redan finns går inte att få', () => {
    const store = new DocStore(emptyProject('Prov', 'ombyggnad'));
    const t = penTable(store.doc.graphics, stylePlaces(store.doc));
    const p035 = t.find((r) => penKey(r.pen) === '0.35|ink')!;
    expect(editPen(store, p035.pen.no, { color: '#c2372c' })).toBeNull();
    const now = penTable(store.doc.graphics, stylePlaces(store.doc));
    const red = now.find((r) => r.pen.no === p035.pen.no)!;
    expect(red.pen).toEqual({ no: p035.pen.no, weight: 0.35, color: '#c2372c' });
    expect(red.places.length).toBe(p035.places.length);
    // Konturen i åtgärderna följer med, och linjerna får samma färg.
    expect(categoryOf(store.doc.graphics, 'storey', 'plan').style.actions.new.cutOutline).toMatchObject({ weight: 0.35, color: '#c2372c' });
    expect(categoryOf(store.doc.graphics, 'storey', 'plan').style.actions.new.lines.color).toBe('#c2372c');
    const p018 = now.find((r) => penKey(r.pen) === '0.18|ink')!;
    expect(editPen(store, p018.pen.no, { weight: 0.35, color: '#c2372c' })).toContain(`Penna ${p035.pen.no}`);
  });

  it('en vys ställe ändras i vyns avvikelser', () => {
    const store = new DocStore(sampleProject());
    const v: ViewDef = { id: 'prov', name: 'Prov', storey: store.doc.storeys.find((s) => !s.site)!.id, state: store.doc.states[0].id, category: 'plan', overrides: { 'pens.dimension': { weight: 0.35 } } };
    store.transact('vy', (tx) => tx.setViews([...tx.doc.views, v]));
    const r = editPlaces(store.doc, [placeIn(store.doc, 'view:prov|pens.dimension')], setPenEdit({ weight: 0.18 }));
    // Tillbaka som kategorin: avvikelsen försvinner.
    expect(r.views.find((x) => x.id === 'prov')!.overrides).toBeUndefined();
  });

  it('linjetypen och fyllningstypen per ställe', () => {
    const doc = emptyProject('Prov', 'ombyggnad');
    const r = editPlaces(doc, [placeIn(doc, 'cat:storey:plan|outline.existing'), placeIn(doc, 'cat:storey:plan|pens.dimension')], setLineTypeEdit('dashdot'));
    const c = categoryOf(r.book, 'storey', 'plan');
    expect(c.style.actions.existing.cutOutline?.dash).toEqual([5, 1, 0.3, 1]);
    expect(c.style.actions.existing.lines.dash).toEqual([5, 1, 0.3, 1]);
    expect(c.style.pens?.dimension).toEqual({ weight: 0.18, linetype: 'dashdot' });
    expect(placeIn({ ...doc, graphics: r.book }, 'cat:storey:plan|outline.existing').linetype).toBe('dashdot');
    const f = editPlaces(doc, [placeIn(doc, 'mat:tegel|mfill.cut')], setFillTypeEdit('betong'));
    expect(f.materials[0].cut).toMatchObject({ fill: 'type', fillType: 'betong' });
    expect(f.book.materials!.find((m) => m.id === 'tegel')!.cut).toMatchObject({ fillType: 'betong' });
  });

  it('Ny penna och ta bort pennor utan ställen', () => {
    const store = new DocStore(emptyProject('Prov', 'ombyggnad'));
    const no = addPen(store);
    const t = penTable(store.doc.graphics, stylePlaces(store.doc));
    expect(t.find((r) => r.pen.no === no)!.places).toEqual([]);
    expect(new Set(t.map((r) => penKey(r.pen))).size).toBe(t.length);
    const used = t.find((r) => r.places.length)!.pen.no;
    removePens(store, used);
    expect(penTable(store.doc.graphics, stylePlaces(store.doc)).some((r) => r.pen.no === used)).toBe(true);
    removePens(store);
    expect(penTable(store.doc.graphics, stylePlaces(store.doc)).some((r) => r.pen.no === no)).toBe(false);
  });
});

describe('listorna', () => {
  it('sök och taggar, och listan med pennorna', () => {
    const doc = emptyProject('Prov', 'ombyggnad');
    const rows = placeRows(doc, 'pen');
    const st = newPlacesState();
    st.tags.add('fasad');
    st.tags.add('vägg');
    const hit = rows.filter((r) => rowMatches(r, st, ''));
    expect(hit.length).toBeGreaterThan(0);
    expect(hit.every((r) => r.viewTags.includes('fasad') && r.tags.includes('vägg'))).toBe(true);
    st.tags.clear();
    st.query = 'norrpil';
    expect(rows.filter((r) => rowMatches(r, st, '')).every((r) => r.label === 'Norrpil')).toBe(true);
    const html = penListMarkup({ ...doc }, newPlacesState());
    expect(html).toContain('data-table="pens"');
    expect(html).toContain('Flytta till pennan…');
    expect(placesMarkup(doc, 'linetype', newPlacesState(), placeRows(doc, 'linetype'), [])).toContain('Punktstreckad');
  });

  it('materialens ställen är objekten; flytta byter material', () => {
    const store = new DocStore(sampleProject());
    const [el] = addElements(store, [{ type: 'Ground', storey: store.doc.storeys[0].id, states: [store.doc.states[0].id], tags: [], params: { kind: 'area', points: [[0, 0], [5000, 0], [5000, 5000]], level: 0 }, props: {} }], store.doc.states[0].id, 'Markyta');
    linkMaterial(store, [el.id], 'gras');
    const rows = placeRows(store.doc, 'material');
    expect(rows.map((r) => [r.object?.id, r.value])).toEqual([[el.id, 'gras']]);
    setPlaces(store, 'material', [rows[0].id], 'grus');
    expect((store.doc.elements[el.id].params as Record<string, unknown>).material).toBe('grus');
  });

  it('sorteringen jämför tal som tal', () => {
    expect(compareCells('0,5', '0,25')).toBeGreaterThan(0);
    expect(compareCells('10', '9')).toBeGreaterThan(0);
    expect(compareCells('Plan 10', 'Plan 9')).toBeGreaterThan(0);
    expect(compareCells('3', 'abc')).toBeLessThan(0);
  });

});
