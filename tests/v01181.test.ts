import { beforeAll, describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { emptyProject, type Element, type ProjectDoc } from '../src/core/model';
import { DEFAULT_OPENING_TYPES, layoutLeaf, leafGridPreset, muntinLines, muntinOutline, normalizeOpeningModel, openingDefinition } from '../src/core/openingTypes';
import { symbolSegments } from '../src/core/openingSymbol';
import { OPENING_DEFAULTS } from '../src/core/general';
import { commonValue, ownFields, sameLittera, scheduleFields, withField } from '../src/core/openingSchedule';
import { registerBuiltInTypes } from '../src/elements';
import { openingLitteras } from '../src/elements/openingLittera';
import { buildModel3d } from '../src/repr/model3d';
import type { Edges3D, Solid } from '../src/repr/solids';
import { setScheduleFields } from '../src/ui/openingScheduleFields';
import { snapMuntinPoint } from '../src/ui/style/openingTypes';

/**
 * 0.11.8.1: synpunkterna på mockupen till 0.11.8 (A–I) och måtten
 * (hålet modulmåttet + 10, karmen modulmåttet − 10).
 */

beforeAll(() => registerBuiltInTypes());

function house(openings: { id: string; type: 'Window' | 'Door'; def: string; at: number; params?: Record<string, unknown> }[], edit?: (doc: ProjectDoc) => void): ProjectDoc {
  const doc = emptyProject('Hus', 'nybyggnad');
  for (const t of DEFAULT_OPENING_TYPES) doc.definitions[t.id] = openingDefinition(t);
  edit?.(doc);
  const pts: [number, number][] = [
    [0, 0],
    [6000, 0],
    [6000, 4000],
    [0, 4000],
  ];
  const base = { storey: 'pl-1', states: ['st-ny'], tags: [] as string[], props: {} };
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % 4];
    doc.elements[`w${i}`] = { ...base, id: `w${i}`, type: 'Wall', definition: 't-yv01', params: { start: b, end: a, justification: 'center' } } as Element;
  });
  for (const o of openings) doc.elements[o.id] = { ...base, id: o.id, type: o.type, host: 'w0', definition: o.def, params: { at: o.at, ...(o.params ?? {}) } } as Element;
  return doc;
}

const rect = { u0: 0, u1: 1000, z0: 0, z1: 1200 };

describe('öppningssymbolen i fasaden (A, C, E)', () => {
  it('linjerna spretar mot gångjärnssidan: från handtagssidans mitt till gångjärnssidans hörn', () => {
    const segs = symbolSegments({ rect, op: 'side', hinge: 'left' });
    expect(segs).toHaveLength(2);
    for (const [u1, z1, u2] of segs) {
      expect([u1, z1]).toEqual([1000, 600]);
      expect(u2).toBe(0);
    }
    // Underkantshängd: från överkantens mitt ned till de nedre hörnen.
    expect(symbolSegments({ rect, op: 'bottom' }).map((s) => [s[0], s[1], s[3]])).toEqual([
      [500, 1200, 0],
      [500, 1200, 0],
    ]);
  });

  it('skjut: bara en pil, åt det håll bladet skjuts', () => {
    const segs = symbolSegments({ rect, op: 'pocket', hinge: 'left' });
    expect(segs).toHaveLength(3);
    // Spetsen till vänster (där det öppna läget och kassetten ligger).
    expect(segs[0][2]).toBeLessThan(segs[0][0]);
    expect(segs[1][0]).toBe(segs[0][2]);
  });

  it('en 2-luft V · H: linjerna går ut till karmsidorna, inte till mittposten', () => {
    const doc = house([{ id: 'f', type: 'Window', def: 't-of-sid2', at: 3000, params: { width: 1200, height: 1300 } }]);
    const edges = buildModel3d(doc, { state: 'st-ny' }).filter((s): s is Edges3D => s.kind === 'edges' && s.id === 'f' && s.part === 'swing');
    // Söderväggen går från x 6000 till 0; fönstret mitt på x 3000, 1 190 brett. Linjernas yttre ändar ligger vid karmsidorna.
    const xs = edges.flatMap((e) => e.segments).map((q) => [q[0], q[3]]);
    const tips = xs.map(([a, b]) => (Math.abs(a - 3000) > Math.abs(b - 3000) ? a : b));
    for (const x of tips) expect(Math.abs(Math.abs(x - 3000) - 595)).toBeLessThan(60);
  });

  it('Visa › Öppningssymboler släcker dem; pennorna för när och bortre sida är egna ställen', () => {
    const doc = house([{ id: 'd', type: 'Door', def: 't-dd-slat', at: 3000 }]);
    const off = buildModel3d(doc, { state: 'st-ny', hide: ['openingSymbol'] } as never).filter((s): s is Edges3D => s.kind === 'edges' && s.id === 'd');
    expect(off.some((e) => e.part === 'swing' || e.part === 'swingFar')).toBe(false);
  });
});

describe('spröjs (D)', () => {
  it('fritt antal lodräta och vågräta, jämnt fördelade i glaset', () => {
    const lines = muntinLines({ v: 2, h: 1, kind: 'loose' }, rect);
    expect(lines.map((l) => l[0]).slice(0, 2).map(Math.round)).toEqual([333, 667]);
    expect(lines[2]).toEqual([0, 600, 1000, 600]);
    // Kanterna: de vågräta bryts vid de lodräta (2 lodräta × 2 kanter + 3 bitar × 2 kanter).
    expect(muntinOutline(lines, 28)).toHaveLength(4 + 6);
  });

  it('special: ritade referenslinjer i andelar av glaset; punkterna snäpper', () => {
    expect(muntinLines({ v: 5, h: 5, kind: 'fixed', lines: [{ a: [0.5, 0], b: [0.5, 1] }] }, rect)).toEqual([[500, 0, 500, 1200]]);
    expect(snapMuntinPoint([0.49, 0.02], [], null)).toEqual([0.5, 0]);
    // Nästan lodrätt blir rakt.
    expect(snapMuntinPoint([0.53, 0.6], [], [0.5, 0])).toEqual([0.5, 0.6]);
  });

  it('spröjsen syns i fasaden och 3D, och följer med filen', () => {
    const doc = house([{ id: 'f', type: 'Window', def: 't-of-sid1', at: 3000 }], (d) => {
      d.definitions['t-of-sid1'].opening!.cells[0].muntins = { v: 1, h: 2, kind: 'loose' };
    });
    const shapes = buildModel3d(doc, { state: 'st-ny' });
    expect(shapes.some((s) => s.kind === 'edges' && s.id === 'f' && s.part === 'muntin')).toBe(true);
    const m = normalizeOpeningModel(JSON.parse(JSON.stringify(doc.definitions['t-of-sid1'].opening)));
    expect(m.cells[0].muntins).toEqual({ v: 1, h: 2, kind: 'loose' });
  });
});

describe('dörrbladets indelning (F)', () => {
  it('mm står kvar och andelarna växer: samma typ i två storlekar', () => {
    const g = leafGridPreset('panel')!;
    const small = layoutLeaf(g, { u0: 0, u1: 700, z0: 0, z1: 2000 });
    const big = layoutLeaf(g, { u0: 0, u1: 900, z0: 0, z1: 2000 });
    expect(small.fills).toHaveLength(2);
    expect(small.fills[0].rect.u0).toBe(120);
    expect(big.fills[0].rect.u0).toBe(120);
    expect(big.fills[0].rect.u1 - big.fills[0].rect.u0).toBe(900 - 240);
  });

  it('fyllningarnas material ur stilboken i 3D; glas är glas', () => {
    const doc = house([{ id: 'd', type: 'Door', def: 't-dd-slat', at: 3000 }], (d) => {
      d.graphics.materials = [...(d.graphics.materials ?? []), { id: 'mat-plat', name: 'Plåt', color3d: '#8899aa' } as never];
      d.definitions['t-dd-slat'].opening!.cells[0].leafGrid = {
        cols: [{ size: 120, unit: 'mm' }, { size: 1, unit: 'fr' }, { size: 120, unit: 'mm' }],
        rows: [{ size: 120, unit: 'mm' }, { size: 1, unit: 'fr' }, { size: 120, unit: 'mm' }, { size: 1, unit: 'fr' }, { size: 120, unit: 'mm' }],
        fills: [{ col: 1, row: 1, glass: true }, { col: 1, row: 3, material: 'mat-plat' }],
      };
    });
    const solids = buildModel3d(doc, { state: 'st-ny' }).filter((s): s is Solid => s.kind !== 'edges' && s.id === 'd');
    expect(solids.some((s) => s.material === 'glass')).toBe(true);
    expect(solids.some((s) => s.color === '#8899aa')).toBe(true);
    const m = normalizeOpeningModel(JSON.parse(JSON.stringify(doc.definitions['t-dd-slat'].opening)), 'door');
    expect(m.cells[0].leafGrid?.fills).toHaveLength(2);
  });
});

describe('littera och förteckningens fält (G, I)', () => {
  it('vägghålen VG01 som förval', () => {
    expect(OPENING_DEFAULTS.formulas.WallHole).toBe('VG{nr:2}');
  });

  it('fältmallen: förvalet ur förteckningarna, egna fält per objekt, Olika när de skiljer sig', () => {
    const doc = house([
      { id: 'a', type: 'Window', def: 't-of-sid1', at: 1500 },
      { id: 'b', type: 'Window', def: 't-of-sid1', at: 4500 },
    ]);
    expect(scheduleFields(doc, 'Window')[0]).toBe('Antal');
    expect(ownFields(doc, 'Window')).toContain('U-värde');
    expect(ownFields(doc, 'Window')).not.toContain('Karmyttermått');
    doc.elements.a = { ...doc.elements.a, params: withField(doc.elements.a.params, 'U-värde', 'max 1,2') };
    expect(commonValue([doc.elements.a, doc.elements.b], 'U-värde')).toBeNull();
    // Samma littera: båda (samma typ och mått).
    const lit = openingLitteras(doc);
    expect(sameLittera(doc, ['a'], lit).sort()).toEqual(['a', 'b']);
  });

  it('ett nytt fält blir ett fält på objekten; ett nytt namn följer med värdena', () => {
    const store = new DocStore(house([{ id: 'a', type: 'Window', def: 't-of-sid1', at: 1500 }]));
    store.transact('U', (tx) => tx.putElement({ ...tx.doc.elements.a, params: withField(tx.doc.elements.a.params, 'Brandklass', 'EI 30') }));
    const list = scheduleFields(store.doc, 'Window').map((f) => (f === 'Brandklass' ? 'Brandkrav' : f));
    setScheduleFields(store, 'Window', [...list, 'Myggnät'], 'mall', ['Brandklass', 'Brandkrav']);
    expect(ownFields(store.doc, 'Window')).toContain('Myggnät');
    expect((store.doc.elements.a.params as { fields?: Record<string, string> }).fields).toEqual({ Brandkrav: 'EI 30' });
  });
});
