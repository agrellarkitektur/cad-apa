import { beforeAll, describe, expect, it } from 'vitest';
import { COLOUR_CODED, SWEDISH_STANDARD, type StyleSheet } from '../src/core/graphics';
import type { ProjectDoc } from '../src/core/model';
import { DocStore } from '../src/core/store';
import { bookWithSheet, defaultSheet } from '../src/core/viewCategories';
import { registerBuiltInTypes } from '../src/elements';
import { facadePen } from '../src/repr/facadePens';
import { cutRowOf, OBJECT_PENS } from '../src/repr/objectPens';
import { penTable, stylePlaces } from '../src/repr/penPlaces';
import { penDefault } from '../src/repr/penRows';
import { applyStyle, buildPlan } from '../src/repr/plan';
import type { Primitive, RegionPrim } from '../src/repr/primitives';
import { sampleProject } from '../src/sample/sampleProject';
import { ownPenSection } from '../src/ui/ownPenFields';
import { editPen, setPlaces } from '../src/ui/style/placeEdits';
import { placeRows } from '../src/ui/style/places';
import { penSection } from '../src/ui/style/pens';

beforeAll(() => registerBuiltInTypes());

/**
 * Snitt- och konturlinjer i planen (0.10.37): ställen per objekttyp i
 * stället för dörrarnas och fönstrens klasser, snittlinjen ger tjockleken
 * och åtgärden färg och streckning, väggens konturlinje för hålets
 * oskurna kanter, symbolen följer snittet, och egna pennor som ställen.
 */
const plan = (doc: ProjectDoc, compare = false) => buildPlan(doc, doc.storeys[0].id, { state: doc.states.at(-1)!.id, ...(compare ? { compareTo: doc.states[0].id } : {}) });
const withPens = (doc: ProjectDoc, pens: StyleSheet['pens'], base?: StyleSheet): ProjectDoc => {
  const style = { ...structuredClone(base ?? defaultSheet(doc.graphics)), pens: { ...defaultSheet(doc.graphics).pens, ...pens } };
  return { ...doc, graphics: bookWithSheet(doc.graphics, style) };
};
const wallCutRegions = (prims: readonly Primitive[]) => prims.filter((p): p is RegionPrim => p.kind === 'region' && p.origin?.objectType === 'Wall' && p.origin?.part === 'snitt');

describe('ställena per objekttyp', () => {
  it('förvalen ritar som förut, och raderna står i planens grupper', () => {
    expect(penDefault('wallCut')).toEqual({ weight: 0.35 });
    expect(penDefault('doorFrameCut')).toEqual({ weight: 0.25 });
    expect(penDefault('furniture')).toEqual({ weight: 0.18, color: 'muted' });
    expect(cutRowOf('Slab')).toBe('slabCut');
    expect(cutRowOf('Door')).toBe('wallCut');
    const html = penSection(defaultSheet(sampleProject().graphics), 'storey');
    for (const r of OBJECT_PENS) expect(html).toContain(r.label);
    expect(html).not.toContain('Pennor för dörrar och fönster');
    // Fasadernas öppningssätt har sin egen rad, utan symbolpennan under.
    expect(facadePen(SWEDISH_STANDARD, 'swing')).toEqual({ weight: 0.13, dash: [3, 1.5] });
  });

  it('väggens snittlinje ger tjockleken och, utan jämförelse, färgen och linjetypen', () => {
    const doc = sampleProject();
    expect(wallCutRegions(plan(doc).prims).every((p) => p.outline?.weight === 0.35)).toBe(true);
    const red = withPens(doc, { wallCut: { weight: 0.5, color: '#c2372c', linetype: 'dashed' } });
    const r = wallCutRegions(plan(red).prims);
    expect(r.length).toBeGreaterThan(0);
    for (const p of r) expect(p.outline).toEqual({ weight: 0.5, color: '#c2372c', dash: [3, 1.5] });
  });

  it('med jämförelsen ger åtgärden färg och streckning, snittlinjen tjockleken', () => {
    const doc = sampleProject();
    const fat = withPens(doc, { wallCut: { weight: 0.5, color: '#2f6db5' } });
    const r = wallCutRegions(plan(fat, true).prims);
    expect(r.length).toBeGreaterThan(0);
    for (const p of r) expect(p.outline).toMatchObject({ weight: 0.5, color: 'ink' });
    // Det som rivs: streckat i åtgärdens färg, snittlinjens tjocklek.
    const sheet = { ...SWEDISH_STANDARD, pens: { wallCut: { weight: 0.5, color: '#2f6db5' } } };
    const gone = applyStyle({ kind: 'region', role: 'cut', rings: [], fill: { kind: 'none' }, outline: null, origin: { objectType: 'Wall' } }, sheet.actions.demolished, 'demolished', sheet, 1, true);
    expect(gone.kind === 'region' && gone.outline).toEqual({ weight: 0.5, color: 'ink', dash: [2, 1] });
    // Färgmarkerad: det nya rött, också dörrblad med en blå rad.
    const s = applyStyle({ kind: 'line', a: [0, 0], b: [1, 0], pen: { weight: 0.18, color: '#0000ff' } }, COLOUR_CODED.actions.new, 'new', COLOUR_CODED, 1, true);
    expect(s.kind === 'line' && s.pen.color).toBe('#c2372c');
    const plain = applyStyle({ kind: 'line', a: [0, 0], b: [1, 0], pen: { weight: 0.18, color: '#0000ff' } }, COLOUR_CODED.actions.plain, 'plain', COLOUR_CODED, 1, true);
    expect(plain.kind === 'line' && plain.pen.color).toBe('#0000ff');
    // Utan kontur i åtgärden ritas ingen snittlinje.
    const none = applyStyle({ kind: 'region', role: 'cut', rings: [], fill: { kind: 'none' }, outline: null, origin: { objectType: 'Wall' } }, COLOUR_CODED.actions.new, 'new', COLOUR_CODED, 1, true);
    expect(none.kind === 'region' && none.outline).toBeNull();
  });

  it('fönstrets delar och väggens konturlinje under fönstret, med väggens egen penna', () => {
    const doc = sampleProject();
    const win = Object.values(doc.elements).find((e) => e.type === 'Window')!;
    const pens = { windowFrameContour: { weight: 0.25 }, windowGlass: { weight: 0.13, color: '#2f6db5' }, wallContour: { weight: 0.18 } };
    const host = doc.elements[win.host!];
    win.pen = { weight: 0.7 };
    host.pen = { color: '#c2372c' };
    const prims = plan(withPens(doc, pens)).prims;
    const of = (part: string, id = win.id) => prims.filter((p) => p.origin?.objectId === id && p.origin?.part === part && p.kind === 'line');
    // Fönstrets egen penna går före raderna; under fönstret är det väggens.
    expect(of('karm').every((p) => p.kind === 'line' && p.pen.weight === 0.7)).toBe(true);
    const under = of('under', host.id);
    expect(under.length).toBeGreaterThanOrEqual(2);
    for (const p of under) expect(p.kind === 'line' && p.pen).toEqual({ weight: 0.18, color: '#c2372c' });
    delete win.pen;
    const again = plan(withPens(doc, pens)).prims.filter((p) => p.origin?.objectId === win.id && p.kind === 'line');
    expect(again.filter((p) => p.origin?.part === 'karm').every((p) => p.kind === 'line' && p.pen.weight === 0.25)).toBe(true);
    expect(again.filter((p) => p.origin?.part === 'glas').every((p) => p.kind === 'line' && p.pen.color === '#2f6db5')).toBe(true);
  });

  it('dörrens slagbåge följer den egna pennans snitt där symbolen inte är satt', () => {
    const doc = sampleProject();
    const door = Object.values(doc.elements).find((e) => e.type === 'Door')!;
    door.pen = { weight: 0.5, color: '#00aa00', symbol: { weight: 0.13 } };
    const arc = plan(doc).prims.find((p) => p.origin?.objectId === door.id && p.origin?.part === 'slagbåge');
    expect(arc?.kind === 'arc' && arc.pen).toMatchObject({ weight: 0.13, color: '#00aa00' });
    expect(ownPenSection(doc, [door])).toContain('Snittets');
  });
});

describe('egna pennor som ställen', () => {
  it('materialets kontur, typens och objektets pennor står i pennlistan', () => {
    const store = new DocStore(sampleProject());
    const doc = store.doc;
    const door = Object.values(doc.elements).find((e) => e.type === 'Door' && e.definition)!;
    const wall = Object.values(doc.elements).find((e) => e.type === 'Wall')!;
    store.transact('pennor', (tx) => {
      tx.putDefinition({ ...doc.definitions[door.definition!], pen: { weight: 0.7, symbol: { linetype: 'dashed' } } });
      tx.putElement({ ...wall, pen: { weight: 0.5, color: '#c2372c' } });
      tx.setGraphics({ ...doc.graphics, materials: doc.graphics.materials!.map((m, i) => (i === 0 ? { ...m, pen: { weight: 0.35, color: '#3c8d4a' } } : m)) });
    });
    const places = stylePlaces(store.doc);
    const own = places.filter((p) => p.where.kind === 'object' || p.where.kind === 'def' || p.key === 'mpen');
    expect(own.map((p) => p.id).sort()).toEqual([`def:${door.definition}|own.main`, `def:${door.definition}|own.symbol`, `mat:${store.doc.graphics.materials![0].id}|mpen`, `obj:${wall.id}|own.main`].sort());
    expect(own.find((p) => p.key === 'own.symbol')!.pen).toBeUndefined(); // bara en linjetyp
    expect(placeRows(store.doc, 'linetype').some((r) => r.id === `def:${door.definition}|own.symbol`)).toBe(true);
    const table = penTable(store.doc.graphics, places);
    const red = table.find((r) => r.pen.weight === 0.5 && r.pen.color === '#c2372c')!;
    expect(red.places.map((p) => p.id)).toEqual([`obj:${wall.id}|own.main`]);

    // Flytta väggens penna till 0,25 svart, och ändra typens penna i listan.
    const p025 = table.find((r) => r.pen.weight === 0.25 && !r.pen.color)!;
    setPlaces(store, 'pen', [`obj:${wall.id}|own.main`], String(p025.pen.no));
    expect(store.doc.elements[wall.id].pen).toEqual({ weight: 0.25 });
    const p07 = penTable(store.doc.graphics, stylePlaces(store.doc)).find((r) => r.pen.weight === 0.7 && !r.pen.color)!;
    expect(p07.places.map((p) => p.id)).toEqual([`def:${door.definition}|own.main`]);
    expect(editPen(store, p07.pen.no, { weight: 0.6 })).toBeNull();
    expect(store.doc.definitions[door.definition!].pen).toEqual({ weight: 0.6, symbol: { linetype: 'dashed' } });
    setPlaces(store, 'linetype', [`def:${door.definition}|own.symbol`], 'dotted');
    expect(store.doc.definitions[door.definition!].pen?.symbol).toEqual({ linetype: 'dotted' });
    // En ångring per ändring.
    store.undo();
    expect(store.doc.definitions[door.definition!].pen?.symbol).toEqual({ linetype: 'dashed' });
  });
});
