import { beforeAll, describe, expect, it } from 'vitest';
import { pruneAssets } from '../src/core/commands';
import { emptyProject, isMaster, isStamp, type Asset, type Element } from '../src/core/model';
import { setMaterialTexture } from '../src/core/materials';
import { placeLogo, setOfficeLogo } from '../src/core/office';
import { createSheet, createStamp } from '../src/core/sheets';
import { DocStore } from '../src/core/store';
import { applyTemplate, exportBook, importBook, paperInFile, readBookFile } from '../src/core/styleBookFile';
import { registerBuiltInTypes } from '../src/elements';

beforeAll(() => registerBuiltInTypes());

/**
 * Stilboken ut och in (0.10.40): hela stilboken som fil med bilderna, och
 * som val mallbladen och stämplarna; samma fil är mallen för nya projekt.
 */
const asset = (id: string, data = 'AA=='): Asset => ({ id, name: `${id}.png`, mime: 'image/png', data });

function office(): DocStore {
  const store = new DocStore(emptyProject('Villa A', 'nybyggnad', { fastighet: 'Vimmerby 1:1' }));
  setOfficeLogo(store, { asset: asset('logo-a', 'TE9HTw=='), width: 400, height: 100 });
  setMaterialTexture(store, store.doc.graphics.materials![0].id, asset('tex-a', 'VEVY'));
  const master = store.doc.project.master!;
  const stamp = createStamp(store, 'Granskad');
  const st: Element = { id: 'el-st', type: 'Stamp', storey: store.doc.storeys[0].id, states: [], tags: [], space: master, params: { pos: [10, 10], stamp }, props: {} };
  store.transact('stämpel på mallen', (tx) => tx.putElement(st));
  placeLogo(store, master, [20, 20]);
  return store;
}

describe('stilboken som fil', () => {
  it('bäddar in logotypen och texturerna, utan projektets uppgifter', () => {
    const file = exportBook(office().doc);
    expect(file.assets?.map((a) => a.id).sort()).toEqual(['logo-a', 'tex-a']);
    expect(file.paper).toBeUndefined();
    expect(JSON.stringify(file)).not.toContain('Vimmerby 1:1');
    expect(JSON.stringify(file)).not.toContain('Villa A');
  });

  it('mallbladen tar med det som är ritat på dem och stämplarna som ligger där', () => {
    const doc = office().doc;
    const file = exportBook(doc, { masters: true, stamps: false });
    expect(file.paper!.worksheets.filter(isMaster)).toHaveLength(1);
    expect(file.paper!.worksheets.filter(isStamp)).toHaveLength(1);
    expect(file.paper!.master).toBe(doc.project.master);
    expect(file.paper!.elements.some((e) => e.id === 'el-st')).toBe(true);
    expect(file.paper!.elements.every((e) => file.paper!.worksheets.some((w) => w.id === e.space))).toBe(true);
  });

  it('importen lägger in bilderna, logotyperna och papperet bredvid det som finns', () => {
    const from = office();
    const read = readBookFile(JSON.parse(JSON.stringify(exportBook(from.doc, { masters: true, stamps: true }))));
    expect(paperInFile(read)).toEqual({ masters: 1, stamps: 1 });
    // Samma projekt en gång till: id:na är upptagna och får nya, bilderna används igen.
    const before = from.doc.worksheets.length;
    importBook(from, read, { masters: true, stamps: true }, 'Importera');
    const doc = from.doc;
    expect(doc.worksheets).toHaveLength(before + 2);
    expect(doc.worksheets.slice(before).every((w) => w.name.endsWith('(importerat)'))).toBe(true);
    expect(Object.keys(doc.assets).sort()).toEqual(['logo-a', 'tex-a']);
    const added = doc.worksheets.slice(before);
    const stamp = added.find(isStamp)!;
    const placed = Object.values(doc.elements).filter((e) => e.type === 'Stamp' && e.space === added.find(isMaster)!.id);
    expect(placed.map((e) => e.params.stamp)).toEqual([stamp.id]);
    // Utan kryss bara stilboken.
    const other = new DocStore(emptyProject('B', 'nybyggnad'));
    const n = other.doc.worksheets.length;
    importBook(other, read, { masters: false, stamps: false }, 'Importera');
    expect(other.doc.worksheets).toHaveLength(n);
    expect(other.doc.graphics.office?.logo?.asset).toBe('logo-a');
    expect(other.doc.assets['logo-a'].data).toBe('TE9HTw==');
  });

  it('en ny logotyp ur filen byter bilden på bladen, och den gamla tas bort', () => {
    const to = new DocStore(emptyProject('B', 'nybyggnad'));
    setOfficeLogo(to, { asset: asset('logo-b', 'Qg=='), width: 200, height: 100 });
    const sheet = createSheet(to);
    const id = placeLogo(to, sheet, [0, 0])!;
    importBook(to, readBookFile(JSON.parse(JSON.stringify(exportBook(office().doc)))), { masters: false, stamps: false }, 'Importera');
    expect(to.doc.elements[id].params).toMatchObject({ asset: 'logo-a', size: [400, 100], scale: 0.1 });
    expect(to.doc.assets['logo-b']).toBeUndefined();
  });

  it('ett nytt projekt ur mallen får mallens mallblad som förval', () => {
    const tpl = readBookFile(JSON.parse(JSON.stringify(exportBook(office().doc, { masters: true, stamps: true }))));
    const store = new DocStore(emptyProject('Ny', 'nybyggnad'));
    const example = store.doc.project.master!;
    applyTemplate(store, tpl);
    const masters = store.doc.worksheets.filter(isMaster);
    // Samma namn som exemplets mallblad, som tas bort: inget *(importerat)*.
    expect(masters.map((w) => w.name)).toEqual([tpl.paper!.worksheets.find(isMaster)!.name]);
    expect(store.doc.project.master).toBe(masters[0].id);
    expect(store.doc.project.master).not.toBe(example);
    expect(Object.values(store.doc.elements).some((e) => e.space === example)).toBe(false);
    expect(store.doc.project.name).toBe('Ny');
  });

  it('logotypen räknas som använd när filerna rensas', () => {
    const store = new DocStore(emptyProject('B', 'nybyggnad'));
    setOfficeLogo(store, { asset: asset('logo-b'), width: 1, height: 1 });
    store.transact('rensa', (tx) => pruneAssets(tx, ['logo-b']));
    expect(store.doc.assets['logo-b']).toBeDefined();
  });

  it('en äldre stilbok utan bilder går att läsa', () => {
    const read = readBookFile(JSON.parse(JSON.stringify(emptyProject('B', 'nybyggnad').graphics)));
    expect(read.assets).toEqual([]);
    expect(read.paper).toBeUndefined();
  });
});
