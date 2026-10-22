import { beforeAll, describe, expect, it } from 'vitest';
import { addElements } from '../src/core/commands';
import { emptyProject, FORMAT_VERSION } from '../src/core/model';
import { applyFieldChanges, fieldsOf, fieldValue, isBuiltIn } from '../src/core/sheetFields';
import { addViewport, createSheet, saveSheet } from '../src/core/sheets';
import { DocStore } from '../src/core/store';
import { createFolder } from '../src/core/treeCommands';
import { registerBuiltInTypes } from '../src/elements';
import type { Primitive } from '../src/repr/primitives';
import { buildSheet } from '../src/repr/sheet';
import { smartVars } from '../src/repr/smartText';
import { sampleProject } from '../src/sample/sampleProject';
import { parse, serialize } from '../src/storage/format';

beforeAll(() => registerBuiltInTypes());

const today = '2026-10-21';
const texts = (prims: readonly Primitive[]) => prims.flatMap((p) => (p.kind === 'text' ? [p.text] : []));
const text = (params: Record<string, unknown>) => ({ type: 'Text', storey: 'pl-1', tags: [], props: {}, params: { pos: [0, 0], text: 'TEXT', height: 2.5, angle: 0, ...params } });

/** Två blad med exempelmallen; det första har en egen text med ett fält. */
function twoSheets() {
  const store = new DocStore(sampleProject());
  const a = createSheet(store, { number: 'A-101', name: 'Planer', fields: { datum: '2026-10-20' } });
  const b = createSheet(store, { number: 'A-102', name: 'Fasader', fields: { datum: '2026-10-21' } });
  addElements(store, [{ ...text({ pos: [40, 100], text: 'Konstruktör: {Konstruktör}' }), space: a }], 'st-a', 'Rita');
  return { store, a, b };
}

describe('smarta fält (0.8.10, format 10)', () => {
  it('allt inom klamrar som inte är inbyggt är ett fält, utan hänsyn till stora och små bokstäver', () => {
    const { store, a, b } = twoSheets();
    const sheetA = store.doc.sheets.find((s) => s.id === a)!;
    const keys = fieldsOf(store.doc, [sheetA]).map((f) => f.key);
    // Mallens fält, i ordning, och bladets eget; inbyggda (projekt, ritningsnummer …) är inga fält.
    expect(keys).toEqual(expect.arrayContaining(['uppdragsnummer', 'ändring', 'datum', 'ritat', 'granskat', 'skede', 'adress', 'beställare', 'konstruktör', 'skala']));
    expect(keys).not.toContain('projekt');
    expect(keys).not.toContain('ritningsnummer');
    expect(fieldsOf(store.doc, [sheetA]).find((f) => f.key === 'konstruktör')!.label).toBe('Konstruktör');
    expect(fieldsOf(store.doc, [store.doc.sheets.find((s) => s.id === b)!]).map((f) => f.key)).not.toContain('konstruktör');
    expect(isBuiltIn(' Skala A3 ')).toBe(true);
    // {KONSTRUKTÖR} och {konstruktör} är samma fält.
    applyFieldChanges(store, [a], { values: { KONSTRUKTÖR: 'Ingenjörsbyrån' } });
    const d = buildSheet(store.doc, store.doc.sheets.find((s) => s.id === a)!, { today });
    expect(texts(d.prims)).toContain('Konstruktör: Ingenjörsbyrån');
  });

  it('ett fält som gäller hela projektet fylls i på ett ställe och gäller alla blad, också nya', () => {
    const { store, a, b } = twoSheets();
    expect(Object.keys(store.doc.project.fields)).toEqual(expect.arrayContaining(['adress', 'beställare', 'uppdragsnummer']));
    applyFieldChanges(store, [a], { values: { beställare: 'Kommunen' } });
    const c = createSheet(store);
    for (const id of [a, b, c]) expect(fieldValue(store.doc, store.doc.sheets.find((s) => s.id === id)!, 'beställare')).toBe('Kommunen');
    // Ett fält på bladet blir projektets med bladets värde, och tas bort från bladen.
    applyFieldChanges(store, [a], { values: { ritat: 'CAA' } });
    applyFieldChanges(store, [a], { shared: { ritat: true } });
    expect(store.doc.project.fields.ritat).toBe('CAA');
    expect(store.doc.sheets.every((s) => !('ritat' in s.fields))).toBe(true);
    // Och tillbaka: alla blad får projektets värde.
    applyFieldChanges(store, [a], { shared: { ritat: false } });
    expect(store.doc.project.fields).not.toHaveProperty('ritat');
    expect(store.doc.sheets.map((s) => s.fields.ritat)).toEqual(['CAA', 'CAA', 'CAA']);
  });

  it('flera blad: bara de fält man ändrar skrivs, i ett steg som går att ångra', () => {
    const { store, a, b } = twoSheets();
    applyFieldChanges(store, [a, b], { values: { granskat: 'MV' } }, 'Spara fälten på 2 blad');
    const [sa, sb] = [a, b].map((id) => store.doc.sheets.find((s) => s.id === id)!);
    expect([sa.fields.granskat, sb.fields.granskat]).toEqual(['MV', 'MV']);
    // Datumen skiljer och rördes inte.
    expect([sa.fields.datum, sb.fields.datum]).toEqual(['2026-10-20', '2026-10-21']);
    expect(store.undoLabel).toBe('Spara fälten på 2 blad');
    store.undo();
    expect(store.doc.sheets.every((s) => !s.fields.granskat)).toBe(true);
  });

  it('bladets formulär sparar bladet och fälten i ett steg', () => {
    const { store, a } = twoSheets();
    saveSheet(store, a, { name: 'Planer, plan 1' }, undefined, { values: { ändring: 'A' } });
    expect(store.doc.sheets[0].name).toBe('Planer, plan 1');
    expect(store.doc.sheets[0].fields['ändring']).toBe('A');
    store.undo();
    expect(store.doc.sheets[0].name).toBe('Planer');
    expect(store.doc.sheets[0].fields['ändring']).toBeUndefined();
  });

  it('{mapp} är mappen bladet ligger i, och {skala a3} skalan på A3', () => {
    const store = new DocStore(sampleProject());
    const folder = createFolder(store, 'ritningar', 'BYGGLOV');
    const id = createSheet(store, { size: 'A1' }, folder);
    addViewport(store, id, { view: 'vy-a-bl', scale: 50, at: [0, 0] });
    const s = store.doc.sheets.find((x) => x.id === id)!;
    const v = smartVars(store.doc, s, today);
    expect(v.mapp).toBe('BYGGLOV');
    expect(v.skala).toBe('1:50');
    expect(v['skala a3']).toBe('1:100');
    expect(smartVars(store.doc, { ...s, size: 'A3' }, today)['skala a3']).toBe('1:50');
    expect(smartVars(store.doc, { ...s, fields: { skala: '1:50 / 1:100' } }, today).skala).toBe('1:50 / 1:100');
  });

  it('nya projekt har projektets vanliga fält; format 9 får meddelandet om en äldre alfaversion', () => {
    expect(FORMAT_VERSION).toBe(11);
    const doc = emptyProject('Villa', 'nybyggnad', { beställare: 'Anna' });
    expect(doc.project.fields).toEqual({ adress: '', fastighet: '', beställare: 'Anna', uppdragsnummer: '', arkitekt: '', ansvarig: '' });
    expect(parse(serialize(doc)).project.fields).toEqual(doc.project.fields);
    expect(() => parse(serialize({ ...doc, formatVersion: 9 }))).toThrow(/äldre alfaversion/);
  });
});
