import { beforeAll, describe, expect, it } from 'vitest';
import { areaText, generalOf, lengthText, normalizeGeneral, normalizeOffice, officeVars, weightList } from '../src/core/general';
import { normalizeBook } from '../src/core/graphics';
import { emptyProject, type Asset } from '../src/core/model';
import { placeLogo, setOfficeLogo, setProjectPhase } from '../src/core/office';
import { fieldsOf } from '../src/core/sheetFields';
import { createSheet } from '../src/core/sheets';
import { DocStore } from '../src/core/store';
import { defaultSheet } from '../src/core/viewCategories';
import { dimensionPrims } from '../src/elements/annotation';
import { registerBuiltInTypes } from '../src/elements';
import { levelText } from '../src/repr/terrain';
import { smartVars } from '../src/repr/smartText';
import { generalMarkup } from '../src/ui/style/general';

beforeAll(() => registerBuiltInTypes());

/**
 * Projektet › Allmänt (0.10.39): kontorets uppgifter och inställningarna i
 * stilboken, projektets uppgifter i projektet och smarttexten från båda.
 */
const asset = (id: string): Asset => ({ id, name: `${id}.png`, mime: 'image/png', data: 'AA==' });

describe('stilbokens allmänna inställningar', () => {
  it('förvalen, med Platsens gamla val som reserv', () => {
    expect(generalOf(undefined)).toMatchObject({ textSize: 2.5, heightSystem: 'RH 2000', levelDecimals: 3, groundDecimals: 2, litteraDigits: 2, lengthUnit: 'mm', areaDecimals: 1 });
    const site = { ground: { levelDecimals: 3, litteraDigits: 3 }, crs: { epsg: 3006, name: 'SWEREF 99 TM', height: 'RH 70' } } as never;
    expect(generalOf(undefined, site)).toMatchObject({ groundDecimals: 3, litteraDigits: 3, heightSystem: 'RH 70' });
    expect(generalOf({ general: { groundDecimals: 1 } }, site).groundDecimals).toBe(1);
  });

  it('läses från fil, och det som inte går att använda hoppas över', () => {
    expect(normalizeGeneral({ textSize: 3.5, levelDecimals: 9, lengthUnit: 'dm', weights: ['0,25', 0.13, 0.13, -1], heightSystem: ' RH 2000 ' })).toEqual({ textSize: 3.5, weights: [0.13, 0.25], heightSystem: 'RH 2000' });
    expect(normalizeGeneral({})).toBeNull();
    expect(normalizeOffice({ company: ' Agrell Arkitektur ', logo: { asset: 'a', width: 0, height: 1 }, tags: { 'Org.nr': '556' } })).toEqual({ company: 'Agrell Arkitektur', tags: { 'org.nr': '556' } });
    const book = normalizeBook({ ...emptyProject('P', 'nybyggnad').graphics, office: { company: 'AA' }, general: { areaDecimals: 2 } });
    expect(book.office).toEqual({ company: 'AA' });
    expect(book.general).toEqual({ areaDecimals: 2 });
    expect(weightList([0.5, '0.18', 'x'])).toEqual([0.18, 0.5]);
  });

  it('mått, areor och nivåer skrivs som valt', () => {
    expect(lengthText(3450)).toBe('3450');
    expect(lengthText(3455, 'cm')).toBe('345,5');
    expect(lengthText(3450, 'm')).toBe('3,45');
    expect(areaText(12.345, 2)).toBe('12,35 m²');
    expect(areaText(12.345, 0)).toBe('12 m²');
    const doc = emptyProject('P', 'nybyggnad');
    const style = { ...defaultSheet(doc.graphics), general: { lengthUnit: 'm' as const } };
    const texts = dimensionPrims({ points: [[0, 0], [3450, 0]], angle: 0, offset: 500 }, 100, undefined, 2.2, style).filter((p) => p.kind === 'text');
    expect(texts.map((t) => (t as { text: string }).text)).toEqual(['3,45']);
    expect(levelText({ site: undefined, graphics: { ...doc.graphics, general: { levelDecimals: 2 } } }, 2400)).toBe('+2,40');
    expect(levelText({ site: undefined }, 2400)).toBe('+2,400');
  });
});

describe('smarttexten', () => {
  it('kontorets taggar, med projektets fält före när de är ifyllda', () => {
    const doc = emptyProject('Villa', 'nybyggnad', { uppdragsnummer: '2611' });
    doc.graphics = { ...doc.graphics, office: { company: 'Agrell Arkitektur', responsible: 'Carl August', tags: { 'org.nr': '556677' } } };
    const store = new DocStore(doc);
    const id = createSheet(store, { number: 'A-40.1-01', name: 'Fasader' });
    const sheet = store.doc.sheets.find((s) => s.id === id)!;
    const vars = smartVars(store.doc, sheet, '2026-10-30');
    expect(vars.företag).toBe('Agrell Arkitektur');
    expect(vars['org.nr']).toBe('556677');
    // Projektets ansvarig är tom (förval): kontorets gäller.
    expect(vars.ansvarig).toBe('Carl August');
    expect(vars.projektnummer).toBe('2611');
    expect(vars.höjdsystem).toBe('RH 2000');
    const own = smartVars({ ...store.doc, project: { ...store.doc.project, fields: { ...store.doc.project.fields, ansvarig: 'Annan' } } }, sheet, '');
    expect(own.ansvarig).toBe('Annan');
    expect(officeVars(undefined)).toEqual({});
  });

  it('kontorets taggar är inga fält på bladet', () => {
    const doc = emptyProject('Villa', 'nybyggnad');
    doc.graphics = { ...doc.graphics, office: { company: 'AA' } };
    const store = new DocStore(doc);
    const id = createSheet(store, { number: '1', name: 'Plan' });
    store.transact('text', (tx) =>
      tx.putElement({ id: 't1', type: 'Text', storey: store.doc.storeys[0].id, states: [], tags: [], space: id, params: { pos: [10, 10], text: '{företag} {ansvarig} {konstruktör}', height: 2.5, angle: 0 }, props: {} }),
    );
    const keys = fieldsOf(store.doc, store.doc.sheets).map((f) => f.key);
    expect(keys).not.toContain('företag');
    expect(keys).toContain('ansvarig');
    expect(keys).toContain('konstruktör');
  });

  it('skedet gäller alla blad när det är ifyllt, annars bladens egna', () => {
    const store = new DocStore(emptyProject('Villa', 'nybyggnad'));
    const a = createSheet(store, { number: '1', name: 'A' });
    setProjectPhase(store, 'FÖRFRÅGNINGSUNDERLAG');
    expect(store.doc.project.fields.skede).toBe('FÖRFRÅGNINGSUNDERLAG');
    expect(store.doc.sheets.find((s) => s.id === a)!.fields.skede).toBeUndefined();
    setProjectPhase(store, '');
    expect('skede' in store.doc.project.fields).toBe(false);
  });
});

describe('logotypen', () => {
  it('läggs på papperet och får den nya bilden när den byts', () => {
    const store = new DocStore(emptyProject('Villa', 'nybyggnad'));
    const sheet = createSheet(store, { number: '1', name: 'A' });
    expect(placeLogo(store, sheet, [10, 10])).toBeNull();
    setOfficeLogo(store, { asset: asset('logo-1'), width: 200, height: 100 });
    const id = placeLogo(store, sheet, [10, 10])!;
    const el = () => store.doc.elements[id];
    expect(el().params).toMatchObject({ asset: 'logo-1', logo: true, size: [200, 100], scale: 0.2 });
    setOfficeLogo(store, { asset: asset('logo-2'), width: 400, height: 400 });
    expect(el().params).toMatchObject({ asset: 'logo-2', size: [400, 400], scale: 0.1 });
    expect(store.doc.assets['logo-1']).toBeUndefined();
    setOfficeLogo(store, null);
    expect(store.doc.graphics.office).toBeUndefined();
    // Logotypen på bladet har kvar sin bild.
    expect(store.doc.assets['logo-2']).toBeDefined();
  });

  it('Allmänt visar kontoret, projektet och taggarna', () => {
    const doc = emptyProject('Villa Ek', 'nybyggnad');
    doc.graphics = { ...doc.graphics, office: { company: 'Agrell Arkitektur', tags: { 'org.nr': '1' } } };
    const html = generalMarkup(doc);
    expect(html).toContain('value="Agrell Arkitektur"');
    expect(html).toContain('value="Villa Ek"');
    expect(html).toContain('{org.nr}');
    expect(html).toContain('{höjdsystem}');
    expect(html).toContain('data-gen="weights"');
  });
});
