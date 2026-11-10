import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { createSchedule } from '../src/core/schedules';
import { defaultState } from '../src/core/states';
import { DocStore } from '../src/core/store';
import { defaultSheet } from '../src/core/viewCategories';
import { areaParts, areaRegion, btaParts, btaRegion, ringsArea, roundArea } from '../src/elements/areaCalc';
import { createContext } from '../src/repr/context';
import { scheduleTable } from '../src/repr/schedules';
import { sampleProject } from '../src/sample/sampleProject';
import { onSlope } from './projekt';

beforeAll(() => registerBuiltInTypes());

const storeyOf = (store: DocStore) => store.doc.storeys.find((s) => !s.site)!.id;
const ctxOf = (store: DocStore) => createContext(store.doc, storeyOf(store), { state: defaultState(store.doc), hide: ['+Area'] }, defaultSheet(store.doc.graphics), () => true).ctx;
const allSeeds = (store: DocStore) => Object.values(store.doc.elements).filter((e) => e.type === 'Space').map((e) => (e.params as { seed: [number, number] }).seed);
const m2 = (store: DocStore, id: string) => roundArea(ringsArea(areaRegion(ctxOf(store), store.doc.elements[id])), 2);
const parts = (store: DocStore, id: string) => Object.fromEntries(areaParts(ctxOf(store), store.doc.elements[id]).map((p) => [p.code, roundArea(ringsArea(p.region), 2)]));

function addArea(store: DocStore, id: string, params: Record<string, unknown>): void {
  store.transact('area', (tx) => tx.putElement({ id, type: 'Area', storey: storeyOf(store), states: store.doc.states.map((s) => s.id), tags: [], props: {}, params: { outline: [], ...params } } as never));
}

/** Exemplets sadeltak med undersidan `h` mm över golvet vid ytterlivet (27°, nocken vid y = 4 m). */
function lowRoof(store: DocStore, h: number): void {
  store.transact('lågt tak', (tx) => {
    for (const e of Object.values(tx.doc.elements)) if (e.type === 'Roof') tx.putElement({ ...e, params: { ...e.params, height: h } });
  });
}

const tan27 = Math.tan((27 * Math.PI) / 180);

describe('snedtaket (0.12.4)', () => {
  it('det mätvärda slutar 0,60 m utanför linjen där rumshöjden är 1,90 m, för BTA och BOA (5.13, 8.4)', () => {
    const store = new DocStore(sampleProject());
    lowRoof(store, 500);
    addArea(store, 'A1', { kind: 'BOA', seeds: allSeeds(store) });
    // 1,90 når taket (1 900 − 500)/tan 27° från ytterlivet på båda sidor; 0,60 m utanför.
    const edge = 1400 / tan27 - 600;
    expect(ringsArea(btaRegion(ctxOf(store)))).toBeCloseTo((12 * (8000 - 2 * edge)) / 1000, 1);
    expect(m2(store, 'A1')).toBeCloseTo((11.2 * (8000 - 2 * edge)) / 1000, 1);
  });

  it('ett utrymme smalare än 0,60 m under nocken är inte mätvärt (5.1.3)', () => {
    const store = new DocStore(sampleProject());
    // Undersidan vid golvet i ytterlivet: 1,90 nås 0,27 m från nocken på varje sida.
    lowRoof(store, 0);
    expect(ringsArea(btaRegion(ctxOf(store)))).toBe(0);
  });

  it('väggarna och taket vid 2,70 påverkar inte det som räknades förut', () => {
    const store = new DocStore(sampleProject());
    addArea(store, 'A1', { kind: 'BOA', seeds: allSeeds(store) });
    expect(m2(store, 'A1')).toBe(80.64);
  });

  it('BOA:H och BOA:L vid 2,10 m (18.5)', () => {
    const store = new DocStore(sampleProject());
    lowRoof(store, 500);
    addArea(store, 'A1', { kind: 'BOA', seeds: allSeeds(store), heightSplit: true });
    const p = parts(store, 'A1');
    const high = (11.2 * (8000 - (2 * 1600) / tan27)) / 1000;
    expect(p['BOA:H']).toBeCloseTo(high, 1);
    expect(roundArea(p['BOA:H'] + p['BOA:L'], 1)).toBeCloseTo(m2(store, 'A1'), 1);
    // I förteckningen som två rader.
    const s = createSchedule(store, 'Area');
    const t = scheduleTable(store.doc, store.doc.schedules!.find((x) => x.id === s)!);
    const codes = t.groups.flatMap((g) => g.rows.flatMap((r) => r.map((c) => c.text)));
    expect(codes).toContain('BOA:H');
    expect(codes).toContain('BOA:L');
  });

  it('en takkupa: kupans tak gäller i stället för taket under (5.14)', () => {
    const store = new DocStore(sampleProject());
    lowRoof(store, 500);
    const before = ringsArea(btaRegion(ctxOf(store)));
    // En kupa 2 m bred i söder med plant tak på 2,40, från ytterlivet till nocken.
    store.transact('kupa', (tx) =>
      tx.putElement({
        id: 'kupa',
        type: 'Roof',
        storey: storeyOf(store),
        states: tx.doc.states.map((s) => s.id),
        tags: [],
        props: {},
        params: { outline: [[3000, -300], [5000, -300], [5000, 4000], [3000, 4000]], ref: [[3000, 0], [5000, 0]], height: 2400, slope: 0, thickness: 200, dormer: true },
      } as never),
    );
    const after = ringsArea(btaRegion(ctxOf(store)));
    // Hela kupan till ytterväggens utsida, och lite till vid sidorna.
    expect(after - before).toBeGreaterThan((2 * (1400 / tan27 - 600)) / 1000);
    // Utan krysset gäller det lägre taket.
    store.transact('inte kupa', (tx) => tx.putElement({ ...tx.doc.elements.kupa, params: { ...tx.doc.elements.kupa.params, dormer: undefined } }));
    expect(ringsArea(btaRegion(ctxOf(store)))).toBeCloseTo(before, 6);
  });
});

describe('våning delvis under mark (0.12.4)', () => {
  it('BOA inom 6 m från fasaden där golvet ligger över marken, resten BIA(u) (10.3.1.3)', () => {
    // Marken stiger 0,1 m per m österut från ±0 vid husets västra fasad.
    const store = onSlope();
    addArea(store, 'A1', { kind: 'BOA', seeds: allSeeds(store) });
    const p = parts(store, 'A1');
    // Västfasaden: 6 m in från insidan (x 0,4–6,4) gånger 7,2.
    expect(p.BOA).toBeCloseTo(6 * 7.2, 0);
    expect(roundArea(p.BOA + p['BIA(u)'], 2)).toBeCloseTo(80.64, 1);
    const bta = Object.fromEntries(btaParts(ctxOf(store)).map((b) => [b.code, ringsArea(b.region)]));
    // BTA(o) med västväggen: 0,4 + 6 m.
    expect(bta['BTA(o)']).toBeCloseTo(6.4 * 8, 0);
    expect(bta['BTA(o)'] + bta['BTA(u)']).toBeCloseTo(96, 3);
  });

  it('i förteckningen och smarttexten: BIA(u) räknas som BIA', () => {
    const store = onSlope();
    addArea(store, 'A1', { kind: 'BOA', seeds: allSeeds(store) });
    const s = createSchedule(store, 'Area');
    const t = scheduleTable(store.doc, store.doc.schedules!.find((x) => x.id === s)!);
    const rows = t.groups.flatMap((g) => g.rows.map((r) => r.map((c) => c.text).join(' ')));
    expect(rows.some((r) => r.includes('BIA(u)'))).toBe(true);
    expect(rows.some((r) => r.includes('BTA(o)'))).toBe(true);
    expect(rows.some((r) => r.includes('BTA(u)'))).toBe(true);
    // BIA(u) ligger i gruppen BIA, så att `{BIA}` räknar med den.
    expect(t.groups.find((g) => g.label === 'BIA')?.rows.length).toBe(1);
  });

  it('på plan mark ligger allt ovan mark', () => {
    const store = new DocStore(sampleProject());
    addArea(store, 'A1', { kind: 'LOA', seeds: allSeeds(store) });
    expect(Object.keys(parts(store, 'A1'))).toEqual(['LOA']);
    expect(btaParts(ctxOf(store)).map((b) => b.code)).toEqual(['BTA']);
  });
});

describe('OPA (0.12.4)', () => {
  it('en egen kontur utan avdrag som slutar vid ytterväggens utsida (7.4)', () => {
    const store = new DocStore(sampleProject());
    // En uteplats 3 × 2 m mot södra fasaden, ritad 0,5 m in i huset.
    addArea(store, 'O1', { kind: 'OPA', outline: [[1000, -2000], [4000, -2000], [4000, 500], [1000, 500]] });
    expect(m2(store, 'O1')).toBe(6);
    // Inte i BRA.
    const s = createSchedule(store, 'Area');
    const t = scheduleTable(store.doc, store.doc.schedules!.find((x) => x.id === s)!);
    expect(t.groups.find((g) => g.label === 'BRA')).toBeUndefined();
    expect(t.groups.find((g) => g.label === 'OPA')?.rows.length).toBe(1);
  });
});
