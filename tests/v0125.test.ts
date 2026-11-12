import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { fallbackModel } from '../src/core/openingTypes';
import { createSchedule, normalizeSchedule, updateSchedule } from '../src/core/schedules';
import { addViewport, createSheet } from '../src/core/sheets';
import { DocStore } from '../src/core/store';
import { openingFigure } from '../src/repr/openingFigure';
import { litteraRange, scheduleCsv, scheduleTable } from '../src/repr/schedules';
import { litteraLayout, schedulePrims, wrapText } from '../src/repr/scheduleTable';
import { buildSheet } from '../src/repr/sheet';
import { sampleProject } from '../src/sample/sampleProject';

beforeAll(() => registerBuiltInTypes());

const tableOf = (store: DocStore, id: string) => scheduleTable(store.doc, store.doc.schedules!.find((s) => s.id === id)!);
const rowOf = (t: ReturnType<typeof tableOf>, field: string) => t.groups[0].rows.find((r) => r[0].text === field)!.map((c) => c.text);

describe('förteckningen per littera (0.12.5)', () => {
  it('fälten är rader och varje littera en kolumn, med alla tomma rader kvar', () => {
    const store = new DocStore(sampleProject());
    const id = createSchedule(store, 'Door', { layout: 'littera' });
    const t = tableOf(store, id);
    expect(t.columns.map((c) => c.title)).toEqual(['Littera', 'D01', 'D02']);
    expect(t.count).toBe(2);
    const info = t.littera!;
    // Hela fältmallen står som rader, också det som inte är ifyllt.
    expect(info.fields.slice(0, 4)).toEqual(['Antal', 'Hängning', 'Utförande', 'Öppningssätt']);
    expect(info.fields).toHaveLength(36);
    expect(rowOf(t, 'Antal')).toEqual(['Antal', '1', '3']);
    expect(rowOf(t, 'Utförande')).toEqual(['Utförande', 'Ytterdörr glasad', 'Innerdörr slät']);
    expect(rowOf(t, 'Öppningsbredd')).toEqual(['Öppningsbredd', '1010', '910']);
    expect(rowOf(t, 'Öppningssätt')[2]).toBe('Slagdörr');
    expect(rowOf(t, 'Brandklass')).toEqual(['Brandklass', '', '']);
    // Det som räknas fram går inte att skriva i; resten gör det.
    expect(info.own[info.fields.indexOf('Antal')]).toBe(false);
    expect(info.own[info.fields.indexOf('Brandklass')]).toBe(true);
    expect(info.columns.map((c) => c.ids.length)).toEqual([1, 3]);
    // Dölj tomma rader tar bort dem som ingen littera har ifyllda.
    updateSchedule(store, id, { hideEmpty: true });
    const few = tableOf(store, id).littera!.fields;
    expect(few).toContain('Antal');
    expect(few).not.toContain('Brandklass');
  });

  it('olika värden under samma littera blir Olika, och hängningen räknas upp', () => {
    const store = new DocStore(sampleProject());
    const id = createSchedule(store, 'Door', { layout: 'littera' });
    const d02 = tableOf(store, id).littera!.columns[1].ids;
    store.transact('fält', (tx) => d02.forEach((did, i) => tx.putElement({ ...tx.doc.elements[did], params: { ...tx.doc.elements[did].params, fields: { Brandklass: i ? 'EI30' : 'EI60', Låshus: 'Assa 565' } } })));
    const t = tableOf(store, id);
    expect(rowOf(t, 'Brandklass')).toEqual(['Brandklass', '', 'Olika']);
    expect(rowOf(t, 'Låshus')).toEqual(['Låshus', '', 'Assa 565']);
    // En dörr med speglad hängning delar littera (regeln Typ och mått) och räknas upp.
    const el = store.doc.elements[d02[0]];
    store.transact('spegla', (tx) => tx.putElement({ ...el, params: { ...el.params, hinge: (el.params as { hinge?: string }).hinge === 'end' ? 'start' : 'end' } }));
    const hang = rowOf(tableOf(store, id), 'Hängning')[2];
    expect(hang.split(', ').sort()).toEqual(['1 V', '2 H'].sort());
  });

  it('ritningen sedd utifrån: karmen, luften och öppningssymbolen, spegelvänd med hängningen', () => {
    const m = fallbackModel('door');
    const f = openingFigure(m, 890, 2090);
    expect(f.lines.filter((l) => l.role === 'frame')).toHaveLength(4);
    const sym = f.lines.filter((l) => l.role === 'symbol');
    expect(sym.length).toBeGreaterThan(0);
    const g = openingFigure(m, 890, 2090, true);
    // Spegelvänd: varje punkt hamnar på andra sidan karmens mitt.
    expect(g.lines.filter((l) => l.role === 'symbol')[0].a[0]).toBeCloseTo(890 - sym[0].a[0]);
    const store = new DocStore(sampleProject());
    const t = tableOf(store, createSchedule(store, 'Window', { layout: 'littera' }));
    expect(t.littera!.figureScale).toBe(50);
    expect(t.littera!.columns.every((c) => c.figure && c.figure.w > 0)).toBe(true);
    const none = tableOf(store, createSchedule(store, 'Window', { layout: 'littera', noFigure: true }));
    expect(none.littera!.figureScale).toBe(0);
    expect(none.littera!.columns.some((c) => c.figure)).toBe(false);
  });

  it('på bladet: ritningen i skalan med måtten, och breda förteckningar bryts i band under varandra', () => {
    const store = new DocStore(sampleProject());
    const id = createSchedule(store, 'Window', { layout: 'littera' });
    const t = tableOf(store, id);
    const prims = schedulePrims(t, { id });
    const figs = prims.filter((p) => p.origin?.part === 'ritning');
    expect(figs.length).toBeGreaterThan(20);
    // Karmyttermåtten står som måttext.
    const fig = t.littera!.columns[0].figure!;
    expect(figs.some((p) => p.kind === 'text' && p.text === String(Math.round(fig.w)))).toBe(true);
    expect(figs.some((p) => p.kind === 'text' && p.text === String(Math.round(fig.h)) && p.angle)).toBe(true);
    // 1:20 gör ritningens rad högre än 1:50.
    updateSchedule(store, id, { figureScale: 20 });
    expect(litteraLayout(tableOf(store, id), tableOf(store, id).littera!).figureRow).toBeGreaterThan(litteraLayout(t, t.littera!).figureRow);
    // Smalt: ett band per kolumn, under varandra, med Littera i varje.
    const ys = (list: ReturnType<typeof schedulePrims>) => list.filter((p) => p.kind === 'text' && p.text === 'Littera').map((p) => (p.kind === 'text' ? p.at[1] : 0));
    expect(ys(prims)).toHaveLength(1);
    const narrow = ys(schedulePrims(t, { id, maxWidth: 60 }));
    expect(narrow).toHaveLength(t.littera!.columns.length);
    expect(new Set(narrow).size).toBe(narrow.length);
    // På ett blad ritas den som en vy, i bladets PDF och DXF.
    const sheet = createSheet(store, { name: 'Fönster, förteckning' });
    addViewport(store, sheet, { view: id, scale: 1, at: [40, 250] });
    const drawn = buildSheet(store.doc, store.doc.sheets.find((s) => s.id === sheet)!, { today: '2026-11-12' });
    expect(drawn.views[0].prims.some((p) => p.origin?.part === 'ritning')).toBe(true);
  });

  it('föreskrifterna: projektets rader och typernas med litterorna de gäller', () => {
    const store = new DocStore(sampleProject());
    const id = createSchedule(store, 'Window', { layout: 'littera' });
    const def = Object.values(store.doc.elements).find((e) => e.type === 'Window' && e.definition)!.definition!;
    store.transact('föreskrift', (tx) => {
      const d = tx.doc.definitions[def];
      tx.putDefinition({ ...d, opening: { ...d.opening!, spec: 'Träfönster typ X eller likvärdig.' } });
      tx.setProject({ ...tx.doc.project, openingSchedule: { notes: { Window: 'Samtliga fönster fabriksmålade.\n\nGlas enligt glasförteckning.' } } });
    });
    const t = tableOf(store, id);
    expect(t.littera!.notes.slice(0, 2)).toEqual(['Samtliga fönster fabriksmålade.', 'Glas enligt glasförteckning.']);
    expect(t.littera!.notes[2]).toMatch(/^F\d\d.*: Träfönster typ X eller likvärdig\.$/);
    expect(schedulePrims(t, { id }).some((p) => p.kind === 'text' && p.text === 'Föreskrifter')).toBe(true);
    expect(litteraRange(['F01', 'F02', 'F03', 'F05', 'YD01'])).toBe('F01–F03, F05, YD01');
    expect(wrapText('ett två tre fyra fem sex sju åtta nio tio', 20).length).toBeGreaterThan(1);
  });

  it('CSV får fälten som rader, och bara dörrar och fönster kan ställas upp per littera', () => {
    const store = new DocStore(sampleProject());
    const csv = scheduleCsv(tableOf(store, createSchedule(store, 'Door', { layout: 'littera' })));
    expect(csv.split('\r\n')[0]).toBe('﻿Littera;D01;D02');
    expect(csv).toContain('Antal;1;3');
    expect(normalizeSchedule({ id: 'a', source: 'Space', layout: 'littera' })!.layout).toBeUndefined();
    expect(normalizeSchedule({ id: 'a', source: 'Door', layout: 'littera', figureScale: 20, hideEmpty: true })).toMatchObject({ layout: 'littera', figureScale: 20, hideEmpty: true });
    expect(normalizeSchedule({ id: 'a', source: 'Door', layout: 'littera', figureScale: 37 })!.figureScale).toBeUndefined();
  });
});
