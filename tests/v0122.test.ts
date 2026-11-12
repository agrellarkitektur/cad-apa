import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { exportKeys, planExport } from '../src/core/exportJobs';
import { optionsOf } from '../src/core/exportSettings';
import { createSchedule, normalizeSchedule, removeSchedule, updateSchedule } from '../src/core/schedules';
import { addViewport, createSheet } from '../src/core/sheets';
import { DocStore } from '../src/core/store';
import { scheduleCsv, scheduleTable } from '../src/repr/schedules';
import { schedulePrims } from '../src/repr/scheduleTable';
import { buildSheet, buildViewPage } from '../src/repr/sheet';
import { sampleProject } from '../src/sample/sampleProject';

beforeAll(() => registerBuiltInTypes());

const TODAY = '2026-11-10';
const texts = (rows: { text: string }[][]) => rows.map((r) => r.map((c) => c.text));
const tableOf = (store: DocStore, id: string) => scheduleTable(store.doc, store.doc.schedules!.find((s) => s.id === id)!);

describe('förteckningarna (0.12.2)', () => {
  it('rummen: en rad per rum i förslaget, sorterade efter nummer, med arean summerad', () => {
    const store = new DocStore(sampleProject());
    const id = createSchedule(store, 'Space');
    const t = tableOf(store, id);
    expect(t.columns.map((c) => c.title)).toEqual(['Nummer', 'Namn', 'Våning', 'Area, m²', 'Rumshöjd, mm']);
    expect(texts(t.groups[0].rows).map((r) => r.slice(0, 2))).toEqual([
      ['1101', 'Allrum'],
      ['1102', 'Sovrum 1'],
      ['1103', 'Bad'],
      ['1104', 'Sovrum 2'],
    ]);
    expect(t.total![3].value).toBe(78.6);
    // Fallande efter area, och grupperat efter våning med en delsumma.
    updateSchedule(store, id, { sort: [{ field: 'Area', desc: true }], group: 'Våning' });
    const g = tableOf(store, id);
    expect(g.groups.map((x) => x.label)).toEqual(['Plan 1']);
    expect(g.groups[0].rows[0][1].text).toBe('Allrum');
    expect(g.groups[0].sums![3].text).toBe('78,6');
  });

  it('dörrar och fönster: en rad per littera med antal, eller en per objekt där det som skiljer står som Olika', () => {
    const store = new DocStore(sampleProject());
    const id = createSchedule(store, 'Door');
    expect(texts(tableOf(store, id).groups[0].rows)).toEqual([
      ['D01', '1', '10×21', '990×2090', 'V', 'Ytterdörr glasad'],
      ['D02', '3', '9×21', '890×2090', 'H', 'Innerdörr slät'],
    ]);
    updateSchedule(store, id, { perLittera: undefined, columns: [{ field: 'Littera' }, { field: 'Antal', sum: true }] });
    const each = tableOf(store, id);
    expect(each.count).toBe(4);
    expect(each.total![1].value).toBe(4);
    // Ett eget fält (förteckningens) läses ur objekten; två olika värden blir Olika per littera.
    const doors = Object.values(store.doc.elements).filter((e) => e.type === 'Door' && e.definition === Object.values(store.doc.elements).find((x) => x.type === 'Door' && x.definition)?.definition);
    store.transact('fält', (tx) => doors.forEach((d, i) => tx.putElement({ ...d, params: { ...d.params, fields: { Brandklass: i ? 'EI30' : 'EI60' } } })));
    updateSchedule(store, id, { perLittera: true, columns: [{ field: 'Littera' }, { field: 'Brandklass' }] });
    const merged = texts(tableOf(store, id).groups[0].rows);
    expect(merged.some((r) => r[1] === 'Olika' || r[1] === 'EI60')).toBe(true);
    const win = tableOf(store, createSchedule(store, 'Window'));
    expect(win.groups[0].rows.map((r) => r[0].text)).toEqual(['F01', 'F02', 'F03', 'F04']);
    expect(win.total![1].value).toBe(6);
  });

  it('grindarna och det generella litterat', () => {
    const store = new DocStore(sampleProject());
    const st = store.doc.states.map((s) => s.id);
    const storey = store.doc.storeys[0].id;
    store.transact('räcke och littera', (tx) => {
      tx.putElement({ id: 'r1', type: 'Railing', storey, states: st, tags: [], props: {}, params: { line: [[0, 0], [5000, 0]], gates: [{ id: 'g1', at: 500, width: 1000, littera: 'G01' }, { id: 'g2', at: 2500, width: 1200, littera: 'G01', hang: 'pair' }] } } as never);
      tx.putElement({ id: 'L1', type: 'Label', storey, states: st, tags: [], props: {}, params: { pos: [0, 0], text: 'BRANDCELL {nr}', sort: 'Brandcell', targets: [] } } as never);
      tx.putElement({ id: 'L2', type: 'Label', storey, states: st, tags: [], props: {}, params: { pos: [0, 0], text: 'Träd', sort: 'Träd', targets: [] } } as never);
    });
    const gates = tableOf(store, createSchedule(store, 'Gate'));
    expect(texts(gates.groups[0].rows)).toEqual([['G01', '2', 'Olika', '', 'Olika', '']]);
    const labels = createSchedule(store, 'Label', { labelSort: 'brandcell' });
    expect(texts(tableOf(store, labels).groups[0].rows)).toEqual([['01', 'Brandcell', 'BRANDCELL 01', 'Plan 1']]);
  });

  it('CSV: semikolon, decimalkomma, BOM, gruppernas rubriker och summarader', () => {
    const store = new DocStore(sampleProject());
    const id = createSchedule(store, 'Space', { group: 'Våning' });
    const csv = scheduleCsv(tableOf(store, id));
    const lines = csv.split('\r\n');
    expect(csv.startsWith('﻿Nummer;Namn;Våning;Area, m²;Rumshöjd, mm')).toBe(true);
    expect(lines[1]).toBe('Plan 1');
    expect(lines[2]).toBe('1101;Allrum;Plan 1;32,7;');
    expect(lines).toContain('Summa Plan 1;;;78,6;');
    expect(lines).toContain('Summa;;;78,6;');
  });

  it('på bladet: en vy i 1:1 med rubriken ovanför, bruten i delar bredvid varandra, och borta med förteckningen', () => {
    const store = new DocStore(sampleProject());
    const id = createSchedule(store, 'Space');
    const sheet = createSheet(store, { name: 'Förteckningar' });
    const vp = addViewport(store, sheet, { view: id, scale: 1, at: [40, 250], hideScale: true })!;
    const drawn = (s = store) => buildSheet(s.doc, s.doc.sheets.find((x) => x.id === sheet)!, { today: TODAY });
    const v = drawn().views.find((x) => x.id === vp)!;
    expect(v.schedule).toBe(true);
    expect(v.prims.some((p) => p.kind === 'text' && p.text === 'Rumsförteckning' && p.at[1] > v.frame.maxY - 4)).toBe(true);
    expect(v.prims.some((p) => p.kind === 'text' && p.text === 'Allrum')).toBe(true);
    const frames = (prims: readonly { kind: string; origin?: { objectType?: string } }[]) => prims.filter((p) => p.kind === 'polyline' && p.origin?.objectType === 'Schedule').length;
    expect(frames(v.prims)).toBe(1);
    // Fyra rader, summan och rubriken är 6 × 5,5 mm; 20 mm ger plats för två rader under rubriken per del.
    store.transact('höjd', (tx) => tx.setField('sheets', tx.doc.sheets.map((s) => ({ ...s, viewports: s.viewports.map((x) => ({ ...x, maxHeight: 20 })) }))));
    const split = drawn().views.find((x) => x.id === vp)!;
    expect(frames(split.prims)).toBe(3);
    expect(split.frame.maxX - split.frame.minX).toBeGreaterThan(2 * (v.frame.maxX - v.frame.minX));
    // En ensam förteckning blir en PDF-sida med rubriken.
    expect(buildViewPage(store.doc, id, {})!.name).toBe('Rumsförteckning');
    removeSchedule(store, id);
    expect(store.doc.schedules).toBeUndefined();
    expect(store.doc.sheets.find((s) => s.id === sheet)!.viewports).toEqual([]);
  });

  it('tabellen i 1:100 ligger i vyns koordinater: papperets mm gånger skalan', () => {
    const store = new DocStore(sampleProject());
    const t = tableOf(store, createSchedule(store, 'Space'));
    const one = schedulePrims(t, { id: 'x' });
    const hundred = schedulePrims(t, { id: 'x', scale: 100 });
    const a = one.find((p) => p.kind === 'polyline')!;
    const b = hundred.find((p) => p.kind === 'polyline')!;
    expect(a.kind === 'polyline' && b.kind === 'polyline' && b.points[2][0]).toBeCloseTo(a.kind === 'polyline' ? a.points[2][0] * 100 : 0);
  });

  it('exporten: en rad per förteckning, CSV som förval, och förteckningar ur en fil läses med förval', () => {
    const store = new DocStore(sampleProject());
    const id = createSchedule(store, 'Door');
    const key = `schedule:${id}`;
    expect(exportKeys(store.doc)).toContain(key);
    const plan = planExport(store.doc, [key], undefined, optionsOf({ subfolders: true }), TODAY);
    expect(plan.jobs.map((j) => j.path)).toEqual([`Förteckningar/${store.doc.project.name.replace(/[\\/:*?"<>|]/g, '')}_Dörrförteckning.csv`]);
    expect(normalizeSchedule({ id: 'a', source: 'Space' })!.columns.map((c) => c.field)).toEqual(['Nummer', 'Namn', 'Våning', 'Area', 'Rumshöjd']);
    expect(normalizeSchedule({ id: 'a', source: 'Hus' })).toBeNull();
    expect(normalizeSchedule({ id: 'a', source: 'Space', perLittera: true })!.perLittera).toBeUndefined();
  });
});

describe('förteckningen på bladet i DXF och smarttexten (0.12.2)', () => {
  it('får lagret för förteckningar, inte ramens, och räknas inte i bladets {skala}', async () => {
    const { sheetDxf } = await import('../src/repr/exportDxf');
    const { parseDxf } = await import('../src/formats/dxf');
    const { dxfBytesText } = await import('../src/formats/dxfLayerList');
    const { smartVars } = await import('../src/repr/smartText');
    const store = new DocStore(sampleProject());
    const id = createSchedule(store, 'Space');
    const sheet = createSheet(store, { name: 'Förteckningar' });
    addViewport(store, sheet, { view: id, scale: 1, at: [40, 250], hideScale: true });
    const r = sheetDxf(store.doc, sheet, { version: 'R2000', today: TODAY })!;
    const items = parseDxf(dxfBytesText(r.bytes)).items;
    const layerOfText = (t: string) => items.find((x) => (x as { text?: string }).text === t)?.layer;
    expect(layerOfText('Allrum')).toBe('A-------I--');
    expect(smartVars(store.doc, store.doc.sheets.find((s) => s.id === sheet)!, TODAY).skala).toBe('');
  });
});
