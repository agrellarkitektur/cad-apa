import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { sb11Name, simpleName } from '../src/core/dxfLayers';
import { dxfBytesText } from '../src/formats/dxfLayerList';
import { viewDxf } from '../src/repr/exportDxf';
import { createSchedule } from '../src/core/schedules';
import { defaultState } from '../src/core/states';
import { DocStore } from '../src/core/store';
import { defaultCategories, defaultSheet } from '../src/core/viewCategories';
import { areaRegion, btaRegion, byaRegion, ringsArea, roundArea } from '../src/elements/areaCalc';
import { writeXlsx } from '../src/formats/xlsxWrite';
import { areaVars } from '../src/repr/areaTotals';
import { createContext } from '../src/repr/context';
import { scheduleSheet, scheduleTable, scheduleXlsx } from '../src/repr/schedules';
import { sampleProject } from '../src/sample/sampleProject';

beforeAll(() => registerBuiltInTypes());

const storeyOf = (store: DocStore) => store.doc.storeys.find((s) => !s.site)!.id;
const ctxOf = (store: DocStore) => createContext(store.doc, storeyOf(store), { state: defaultState(store.doc), hide: ['+Area'] }, defaultSheet(store.doc.graphics), () => true).ctx;
const allSeeds = (store: DocStore) => Object.values(store.doc.elements).filter((e) => e.type === 'Space').map((e) => (e.params as { seed: [number, number] }).seed);
const m2 = (store: DocStore, id: string) => roundArea(ringsArea(areaRegion(ctxOf(store), store.doc.elements[id])), 2);

function addArea(store: DocStore, id: string, params: Record<string, unknown>): void {
  store.transact('area', (tx) => tx.putElement({ id, type: 'Area', storey: storeyOf(store), states: store.doc.states.map((s) => s.id), tags: [], props: {}, params: { outline: [], ...params } } as never));
}

function addWall(store: DocStore, id: string, start: [number, number], end: [number, number], thickness: number): void {
  store.transact('vägg', (tx) => tx.putElement({ id, type: 'Wall', storey: storeyOf(store), states: store.doc.states.map((s) => s.id), tags: [], props: {}, params: { start, end, thickness, height: 2700, justification: 'center' } } as never));
}

describe('areorna enligt SS 21054 (0.12.3)', () => {
  it('BTA till ytterväggarnas utsida, BYA utan ett språng på 0,50 m, BOA med de tunna innerväggarna', () => {
    const store = new DocStore(sampleProject());
    const ctx = ctxOf(store);
    expect(ringsArea(btaRegion(ctx))).toBeCloseTo(96, 6);
    // Exemplets tak har 500 mm språng: inte djupare än 0,50 m (6.4.2).
    expect(ringsArea(byaRegion(ctx))).toBeCloseTo(96, 6);
    addArea(store, 'A1', { kind: 'BOA', seeds: allSeeds(store) });
    // 11,2 × 7,2 innanför ytterväggarna; innerväggarna 120 räknas med i sin helhet.
    expect(m2(store, 'A1')).toBe(80.64);
  });

  it('pelare och tjocka väggar räknas 0,15 m in från varje sida', () => {
    const store = new DocStore(sampleProject());
    addArea(store, 'A1', { kind: 'BOA', seeds: allSeeds(store) });
    // En fristående pelare 600 × 600 i allrummet: mitten 300 × 300 räknas bort.
    addWall(store, 'P1', [2000, 2300], [2000, 2900], 600);
    expect(m2(store, 'A1')).toBe(80.55);
    // 900 × 900: mitten 600 × 600.
    store.transact('större', (tx) => tx.putElement({ ...tx.doc.elements.P1, params: { ...tx.doc.elements.P1.params, start: [2000, 2150], end: [2000, 3050], thickness: 900 } }));
    expect(m2(store, 'A1')).toBe(80.28);
    // Utan de automatiska avdragen räknas pelaren med.
    store.transact('utan', (tx) => tx.putElement({ ...tx.doc.elements.A1, params: { ...tx.doc.elements.A1.params, noDeduct: true } }));
    expect(m2(store, 'A1')).toBe(80.64);
  });

  it('en egen kontur: väggar som går över kanten räknas bort helt', () => {
    const store = new DocStore(sampleProject());
    // Konturen till ytterväggarnas mitt: väggarna 200 in på varje sida räknas bort.
    addArea(store, 'A2', { kind: 'BOA', outline: [[200, 200], [11800, 200], [11800, 7800], [200, 7800]] });
    expect(m2(store, 'A2')).toBe(80.64);
  });

  it('en BIA och en BOA i samma bostad: väggen med dörren emellan hör till BIA (5.18.2)', () => {
    const store = new DocStore(sampleProject());
    // Förslag A: badet (BIA) under sovrum 1 (BOA), med dörren d04 i väggen mellan.
    addArea(store, 'BOA', { kind: 'BOA', seeds: [[8330, 5830]] });
    addArea(store, 'BIA', { kind: 'BIA', seeds: [[9480, 2170]] });
    expect(defaultState(store.doc)).toBe('st-a');
    // Sovrum 1 till väggarnas insida: 6,54 × 3,54.
    expect(m2(store, 'BOA')).toBe(23.15);
    // Badet 4,24 × 3,54 och väggen 0,12 längs det.
    const bia = m2(store, 'BIA');
    expect(bia).toBeGreaterThan(15.01 + 0.5);
    expect(bia).toBeLessThan(15.01 + 0.53);
    // Bostaden har en dörr mellan BIA och BOA: alla väggar mellan dem hör till BIA, också den utan dörr mot sovrum 2.
    addArea(store, 'BOA', { kind: 'BOA', seeds: [[2670, 4000], [8330, 5830], [6150, 2170]] });
    expect(roundArea(m2(store, 'BOA') + m2(store, 'BIA'), 2)).toBe(80.64);
    store.transact('bara sovrum 1', (tx) => tx.putElement({ ...tx.doc.elements.BOA, params: { ...tx.doc.elements.BOA.params, seeds: [[8330, 5830]] } }));
    // Utan dörren hör väggen till ingen av dem.
    store.transact('ingen dörr', (tx) => tx.removeElement('d04'));
    expect(m2(store, 'BIA')).toBe(15.01);
  });

  it('en öppning på minst 1,50 m räknas till karmens mitt (5.17.2)', () => {
    const store = new DocStore(sampleProject());
    addArea(store, 'BOA', { kind: 'BOA', seeds: [[8330, 5830]] });
    store.transact('bred dörr', (tx) => tx.putElement({ ...tx.doc.elements.d04, params: { ...tx.doc.elements.d04.params, width: 1600 } }));
    const a = m2(store, 'BOA');
    // Ungefär halva väggen (0,06) över öppningens 1,6 m, efter var karmen sitter.
    expect(a).toBeGreaterThan(23.15 + 0.05);
    expect(a).toBeLessThan(23.15 + 0.15);
  });

  it('andra hål i bjälklaget än trappans räknas inte (5.17.3)', () => {
    const store = new DocStore(sampleProject());
    const st = storeyOf(store);
    store.transact('bjälklag', (tx) => tx.putElement({ id: 'S1', type: 'Slab', storey: st, states: tx.doc.states.map((s) => s.id), tags: [], props: {}, params: { thickness: 250, outline: [], fromWalls: true, holes: [{ points: [[1000, 1000], [2000, 1000], [2000, 2000], [1000, 2000]] }] } } as never));
    addArea(store, 'A1', { kind: 'BOA', seeds: allSeeds(store) });
    expect(ringsArea(btaRegion(ctxOf(store)))).toBeCloseTo(95, 6);
    expect(m2(store, 'A1')).toBe(79.64);
  });

  it('ett språng djupare än 0,50 m under 3,00 m räknas till BYA (6.4.2)', () => {
    const store = new DocStore(sampleProject());
    store.transact('språng', (tx) => {
      for (const e of Object.values(tx.doc.elements)) {
        if (e.type !== 'Roof') continue;
        const o = (e.params.outline as [number, number][]).map(([x, y]): [number, number] => [x < 6000 ? x - 200 : x + 200, y < 0 ? y - 200 : y > 8000 ? y + 200 : y]);
        tx.putElement({ ...e, params: { ...e.params, outline: o } });
      }
    });
    // Språnget 700 runt om: (12 + 1,4) × (8 + 1,4).
    expect(ringsArea(byaRegion(ctxOf(store)))).toBeCloseTo(13.4 * 9.4, 3);
  });
});

describe('redovisningen (0.12.3)', () => {
  it('areaförteckningen: BYA, BTA och BRA räknas fram, grupperade per areaslag med summorna i hela m²', () => {
    const store = new DocStore(sampleProject());
    addArea(store, 'A1', { kind: 'BOA', seeds: allSeeds(store) });
    const id = createSchedule(store, 'Area');
    const t = scheduleTable(store.doc, store.doc.schedules!.find((s) => s.id === id)!);
    expect(t.groups.map((g) => g.label)).toEqual(['BYA', 'BTA', 'BRA', 'BOA']);
    expect(t.groups.map((g) => g.rows[0][3].text)).toEqual(['96,0', '96,0', '80,6', '80,6']);
    expect(t.groups[3].sums![3].text).toBe('81');
    expect(t.total).toBeUndefined();
    // Smarttexten för hela projektet.
    const vars = areaVars(store.doc);
    expect(vars.boa).toBe('81 m²');
    expect(vars.bta).toBe('96 m²');
    expect(vars.loa).toBe('');
  });

  it('XLSX: rubriken fet, talen som tal och delsummorna som formler', () => {
    const store = new DocStore(sampleProject());
    const id = createSchedule(store, 'Space', { group: 'Våning' });
    const t = scheduleTable(store.doc, store.doc.schedules!.find((s) => s.id === id)!);
    const sheet = scheduleSheet(t);
    expect(sheet.rows[0][0]).toEqual({ v: 'Nummer', bold: true });
    expect(sheet.rows[1][0]).toEqual({ v: 'Plan 1', bold: true });
    const sumRow = sheet.rows.find((r) => r[3]?.f)!;
    expect(sumRow[3].f).toBe('SUM(D3:D6)');
    expect(sumRow[3].v).toBe(78.6);
    const total = sheet.rows[sheet.rows.length - 1];
    expect(total[3].f).toBe('SUM(D3:D6)');
    const bytes = scheduleXlsx(t);
    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith('PK')).toBe(true);
    expect(text).toContain('<f>SUM(D3:D6)</f>');
    expect(text).toContain('xl/worksheets/sheet1.xml');
    // Bladets namn utan tecken som Excel inte tillåter.
    expect(new TextDecoder().decode(writeXlsx({ name: 'A/B:C', rows: [[{ v: 1 }]] }))).toContain('name="A B C"');
  });

  it('DXF: areorna på mallens areaslag, och Areaplanen bland våningarnas kategorier', () => {
    expect(sb11Name({ type: 'Area', area: 'BTA', part: 'yta', status: 'N' }, false)).toBe('A-A-BTA-E-N');
    expect(sb11Name({ type: 'Area', area: 'ÖVA', part: 'areatext', status: '-' }, true)).toBe('A-A-OVA-T2N');
    expect(simpleName({ type: 'Area', area: 'BOA', status: 'N' })).toBe('A-AREA-BOA');
    // En vy med areorna tända: ytorna och stämplarna på sina lager.
    const store = new DocStore(sampleProject());
    addArea(store, 'A1', { kind: 'BOA', seeds: allSeeds(store) });
    const doc = { ...store.doc, views: store.doc.views.map((v) => (v.id === 'vy-a' ? { ...v, overrides: { ...(v.overrides ?? {}), 'hide:+Area': true } } : v)) };
    const text = dxfBytesText(viewDxf(doc, 'vy-a', { version: 'R2000', today: '2026-11-10' })!.bytes);
    // Arean finns också i Befintligt i provet, så statusen blir E.
    expect(text).toMatch(/A-A-BOA-E-[EN]/);
    expect(text).toMatch(/A-A-BOA-T2[EN]/);
    const cat = defaultCategories().find((c) => c.id === 'areaplan')!;
    expect(cat.type).toBe('storey');
    expect(cat.show.hide).toContain('+Area');
  });
});
