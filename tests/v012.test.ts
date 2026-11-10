import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { exportKeys, isIfcGuid, newIfcGuid, planExport, safeFileName, setKeys, uniquePaths, withGuids } from '../src/core/exportJobs';
import { normalizeExportSets, optionsOf, setByName, templateSets, type ExportSet } from '../src/core/exportSettings';
import { addViewport, createSheet } from '../src/core/sheets';
import { DocStore } from '../src/core/store';
import { exportBook, readBookFile } from '../src/core/styleBookFile';
import { activeDrawingFont, textWidth, useDrawingFont } from '../src/formats/drawingFont';
import { BUNDLED_FONTS, bundledFontBytes, readFontFile } from '../src/formats/fonts';
import { writePdf } from '../src/formats/pdf';
import { objectGroup, pdfMeta, sheetPage, SHEET_LAYER, viewPage } from '../src/repr/exportPages';
import { parse, serialize } from '../src/storage/format';
import { sampleProject } from '../src/sample/sampleProject';

beforeAll(() => registerBuiltInTypes());

const TODAY = '2026-11-07';
const latin = (b: Uint8Array) => new TextDecoder('latin1').decode(b);

/** Exempelvillan med två blad (A-101 med två vyer, A-102 med en). */
function withSheets() {
  const store = new DocStore(sampleProject());
  const a = createSheet(store, { name: 'Plan 1', fields: { datum: '2026-11-01', skede: 'BYGGLOVSHANDLING' } });
  addViewport(store, a, { view: 'vy-a-bl', scale: 100, at: [100, 150] });
  addViewport(store, a, { view: 'vy-a-bl', scale: 50, at: [300, 150] });
  const b = createSheet(store, { name: 'Fasader' });
  addViewport(store, b, { view: 'vy-a-bl', scale: 100, at: [200, 150] });
  return { store, a, b };
}

describe('typsnitten (0.12)', () => {
  it('bredderna ur en TTF-fil är desamma som skriptets, och Arimo mäter som Arial', async () => {
    for (const f of BUNDLED_FONTS) {
      const r = readFontFile(await bundledFontBytes(f.id));
      if ('error' in r) throw new Error(r.error);
      // Avrundningen kan skilja en tusendel (osifont har inte 1000 enheter per em).
      r.metrics.widths.forEach((w, i) => expect(Math.abs(w - f.metrics.widths[i])).toBeLessThanOrEqual(1));
    }
    const arimo = BUNDLED_FONTS.find((f) => f.id === 'arimo')!;
    // Arial: A = 667/1000.
    expect(textWidth('A', 10, false, arimo)).toBeCloseTo(6.67, 2);
  });

  it('projektets typsnitt mäter texterna; ett eget som saknas blir osifont', () => {
    const doc = sampleProject();
    const osi = textWidth('Kök', 3);
    useDrawingFont({ ...doc, graphics: { ...doc.graphics, font: 'josefin' } });
    expect(activeDrawingFont().id).toBe('josefin');
    expect(textWidth('Kök', 3)).not.toBeCloseTo(osi, 3);
    useDrawingFont({ ...doc, graphics: { ...doc.graphics, font: 'fil-finns-inte' } });
    expect(activeDrawingFont().id).toBe('osifont');
    expect(textWidth('Kök', 3)).toBeCloseTo(osi, 6);
  });

  it('WOFF och annat som inte är typsnitt säger varför', () => {
    expect(readFontFile(new TextEncoder().encode('wOFF0000000000000'))).toEqual({ error: expect.stringMatching(/WOFF/) });
    expect(readFontFile(new TextEncoder().encode('hej hej hej hej'))).toEqual({ error: expect.stringMatching(/inget/) });
  });

  it('ett eget typsnitt följer med stilboken som en fil', async () => {
    const store = new DocStore(sampleProject());
    const bytes = await bundledFontBytes('josefin');
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    store.transact('Typsnitt', (tx) => {
      tx.putAsset({ id: 'fil-ttf', name: 'Egen.ttf', mime: 'font/ttf', data: btoa(s) });
      tx.setGraphics({ ...tx.doc.graphics, font: 'fil-ttf' });
    });
    const file = exportBook(store.doc);
    expect(file.font).toBe('fil-ttf');
    expect(file.assets?.map((a) => a.id)).toContain('fil-ttf');
    expect(useDrawingFont(store.doc).name).toMatch(/^Josefin Sans/);
  });
});

describe('PDF: lager, bokmärken och uppgifter (0.12)', () => {
  it('lager per vy och objektgrupp, ett bokmärke per blad och samma bytes två gånger', async () => {
    const { store, a, b } = withSheets();
    const opt = { layers: 'groups' as const, workStamp: true, today: TODAY };
    const p1 = sheetPage(store.doc, a, opt)!;
    const p2 = sheetPage(store.doc, b, opt)!;
    // Två vyer med samma namn får var sitt lager; ramen och huvudet ligger i Bladet.
    const tops = [...new Set(p1.layers!.map((l) => l[0]))];
    expect(tops).toContain(SHEET_LAYER);
    expect(tops.filter((t) => t !== SHEET_LAYER)).toHaveLength(2);
    expect(p1.layers!.some((l) => l[1] === 'Väggar')).toBe(true);
    expect(p1.prims.some((p) => p.kind === 'text' && p.text === `ARBETSMATERIAL ${TODAY}`)).toBe(true);
    const meta = pdfMeta(store.doc, `sheet:${a}`, TODAY);
    expect(meta.fields).toMatchObject({ Ritningsnummer: 'A-101', Benamning: 'Plan 1', Skede: 'BYGGLOVSHANDLING', Datum: '2026-11-01' });
    const once = await writePdf([p1, p2], { title: 'Exempelvilla', meta });
    const twice = await writePdf([sheetPage(store.doc, a, opt)!, sheetPage(store.doc, b, opt)!], { title: 'Exempelvilla', meta });
    expect(twice).toEqual(once);
    const t = latin(once);
    expect(t).toContain('/OCProperties');
    expect(t).toContain('/Type /OCG /Name (Bladet)');
    expect(t).toMatch(/\/OC \/OC\d+ BDC/);
    expect(t.match(/BDC/g)!.length).toBe(t.match(/EMC/g)!.length);
    expect(t).toContain('/Type /Outlines');
    expect(t).toContain('/Title (A-101 Plan 1)');
    expect(t).toContain('/Ritningsnummer (A-101)');
    expect(t).toContain('<cadapa:Ritningsnummer>A-101</cadapa:Ritningsnummer>');
    expect(t).toContain('/Type /Metadata /Subtype /XML');
  });

  it('utan lager inga OCG; text utanför ASCII i egenskaperna som UTF-16', async () => {
    const { store, a } = withSheets();
    const p = sheetPage(store.doc, a, { layers: 'none', workStamp: false, today: TODAY })!;
    const t = latin(await writePdf([p], { title: 'Kök', meta: { fields: { Benämning: 'Kök' } } }));
    expect(t).not.toContain('/OCProperties');
    expect(t).toContain('/Title <FEFF004B00F6006B>');
    expect(t).toContain('/Ben#c3#a4mning <FEFF004B00F6006B>');
  });

  it('typsnittet som valts bäddas in', async () => {
    const font = BUNDLED_FONTS.find((f) => f.id === 'arimo')!;
    const t = latin(await writePdf([{ size: [100, 100], prims: [{ kind: 'text', at: [10, 10], text: 'Hej', height: 3, pen: { weight: 0.18 } }] }], { font: { info: font } }));
    expect(t).toContain('/BaseFont /Arimo');
    expect(t).toContain('/FontFile2');
  });

  it('en vy ensam får objektgrupperna som lager', () => {
    const store = new DocStore(sampleProject());
    const v = viewPage(store.doc, 'vy-a-bl', { layers: 'groups', workStamp: false, today: TODAY })!;
    expect(v.layers!.map((l) => l[0])).toContain('Väggar');
    expect(objectGroup('Window')).toBe('Dörrar, fönster och vägghål');
    expect(objectGroup('Okänd')).toBe('Övrigt');
  });
});

describe('exportens filer och uppsättningar (0.12)', () => {
  it('filnamnen ur mallarna, dubbletter, undermappar och en samlad PDF', () => {
    const { store, a, b } = withSheets();
    const doc = store.doc;
    const keys = [`sheet:${a}`, `sheet:${b}`, 'view:vy-a-bl', 'image:current', 'model:all'];
    const p = planExport(doc, keys, { 'image:current': ['png', 'jpeg'] }, optionsOf({}), TODAY);
    expect(p.jobs.map((j) => j.path)).toEqual(['A-101.pdf', 'A-102.pdf', `Exempelvilla_${doc.views.find((v) => v.id === 'vy-a-bl')!.name}.dxf`, 'Exempelvilla_3D.png', 'Exempelvilla_3D.jpg', 'Exempelvilla.glb']);
    const named = planExport({ ...doc, graphics: { ...doc.graphics, export: { names: { sheet: '{ritningsnummer}_{titel}', view: '{projekt}' } } } }, keys, { 'view:vy-a-bl': ['pdf'] }, optionsOf({ subfolders: true, combined: true }), TODAY);
    expect(named.jobs.map((j) => j.path)).toEqual(['PDF/Exempelvilla.pdf', 'PDF/Exempelvilla.pdf', 'Bilder/Exempelvilla_3D.png', 'glTF/Exempelvilla.glb']);
    expect(named.jobs[0].keys).toEqual([`sheet:${a}`, `sheet:${b}`]);
    expect([...named.duplicates]).toEqual(['pdf/exempelvilla.pdf']);
    expect(uniquePaths(named.jobs.map((j) => j.path))[1]).toBe('PDF/Exempelvilla (2).pdf');
    expect(safeFileName('Plan: 1/2 . ')).toBe('Plan- 1-2');
    expect(safeFileName('CON')).toBe('CON-');
  });

  it('en uppsättning med alla blad tar också blad som läggs till senare, och följer med mallen utan bladen', () => {
    const { store, a } = withSheets();
    const set: ExportSet = { id: 'exp-1', name: 'Bygglov', items: ['view:vy-a-bl', 'model:all'], all: ['sheet'], formats: { 'model:all': ['glb'] }, options: { combined: true } };
    store.transact('Uppsättning', (tx) => tx.setField('exportSets', [set]));
    const c = createSheet(store, { name: 'Sektion' });
    expect(setKeys(store.doc, set)).toEqual([`sheet:${a}`, ...store.doc.sheets.slice(1).map((s) => `sheet:${s.id}`), 'view:vy-a-bl', 'model:all']);
    expect(setKeys(store.doc, set)).toContain(`sheet:${c}`);
    expect(setByName(store.doc.exportSets, 'bygg')?.id).toBe('exp-1');
    // Sparas och läses tillbaka.
    expect(parse(serialize(store.doc)).exportSets).toEqual([set]);
    // I mallen: inga enskilda vyer, men alla blad och modellen.
    expect(templateSets([set])).toEqual([{ id: 'exp-1', name: 'Bygglov', items: ['model:all'], all: ['sheet'], formats: { 'model:all': ['glb'] }, options: { combined: true } }]);
    expect(readBookFile(exportBook(store.doc)).exportSets).toEqual(templateSets([set]));
    expect(normalizeExportSets([{ id: 'x', name: 'Fel', items: ['blad:1', 'sheet:a'], formats: { 'sheet:a': ['png'] } }, { name: 'utan id' }])).toEqual([{ id: 'x', name: 'Fel', items: ['sheet:a'] }]);
    expect(exportKeys(store.doc).slice(-2)).toEqual(['image:current', 'model:all']);
  });
});

describe('GUID (0.12)', () => {
  it('IFC:s 22 tecken, och samma GUID nästa gång; en kopia får en ny', () => {
    const g = newIfcGuid();
    expect(isIfcGuid(g)).toBe(true);
    expect(new Set(Array.from({ length: 200 }, () => newIfcGuid())).size).toBe(200);
    const store = new DocStore(sampleProject());
    const first = withGuids(store.doc)!;
    store.setGuids(first);
    expect(Object.keys(first).length).toBe(Object.keys(store.doc.elements).length);
    expect(withGuids(store.doc)).toBeNull();
    // Ett nytt objekt (en kopia har ett nytt id) får en egen; ett borttaget släpps.
    const [id, gone] = Object.keys(store.doc.elements);
    store.transact('Kopiera', (tx) => {
      tx.putElement({ ...tx.doc.elements[id], id: 'kopia' });
      tx.removeElement(gone);
    });
    const next = withGuids(store.doc)!;
    expect(next[id]).toBe(first[id]);
    expect(next.kopia).not.toBe(first[id]);
    expect(Object.keys(next)).not.toContain(gone);
    // Ångra lämnar listan.
    store.setGuids(next);
    store.undo();
    expect(store.doc.guids).toBe(next);
    expect(parse(serialize(store.doc)).guids).toEqual(next);
  });
});
