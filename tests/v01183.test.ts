import { beforeAll, describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { emptyProject, type Element, type ProjectDoc } from '../src/core/model';
import { DEFAULT_OPENING_TYPES, holeOf, normalizeLeafGrid, normalizeOpeningModel, openingDefinition, STARTER_OPENING_TYPES, trimOf } from '../src/core/openingTypes';
import { registerBuiltInTypes } from '../src/elements';
import { resolveParams } from '../src/elements/registry';
import type { OpeningObjParams } from '../src/elements/openingSpec';
import { openingRings, wallFrame, type WallParams } from '../src/elements/wall';
import { markerFrame } from '../src/elements/markers';
import { buildModel3d } from '../src/repr/model3d';
import type { Edges3D, Solid } from '../src/repr/solids';
import { facadeShift, moveOpeningsInView } from '../src/core/facadeMove';
import { alignWithBelow, centerInRoom, equalSpacing, equalSpacingPlan, openingBelow, roomMidAt } from '../src/core/openingAlign';
import { glassAreaOf, glassByCompass, glassFacing, glassPanes, roomDaylight } from '../src/elements/daylight';

/**
 * 0.11.8.3 Smart och vägghål: blecklutningen och spegelns raka kant
 * (Inkorgen), vägghålen med verktyg och typer, fasaden som arbetsyta, *I liv
 * med fönstret under*, *Lika avstånd*, *Mitt i rummet* och dagsljuset.
 */

beforeAll(() => registerBuiltInTypes());

type Opening = { id: string; type: 'Window' | 'Door' | 'WallHole'; def: string; at: number; host?: string; storey?: string; params?: Record<string, unknown> };

function house(openings: Opening[], twoStoreys = false): ProjectDoc {
  const doc = emptyProject('Hus', 'nybyggnad');
  for (const t of DEFAULT_OPENING_TYPES) doc.definitions[t.id] = openingDefinition(t);
  if (twoStoreys) doc.storeys = [...doc.storeys.filter((s) => s.id === 'pl-1'), { id: 'pl-2', name: 'Plan 2', elevation: 3000, height: 3000 }, ...doc.storeys.filter((s) => s.id !== 'pl-1')];
  const pts: [number, number][] = [
    [0, 0],
    [6000, 0],
    [6000, 4000],
    [0, 4000],
  ];
  for (const storey of twoStoreys ? ['pl-1', 'pl-2'] : ['pl-1']) {
    const base = { storey, states: ['st-ny'], tags: [] as string[], props: {} };
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % 4];
      const id = `${storey}-w${i}`;
      doc.elements[id] = { ...base, id, type: 'Wall', definition: 't-yv01', params: { start: b, end: a, justification: 'center' } } as Element;
    });
  }
  for (const o of openings) {
    const storey = o.storey ?? 'pl-1';
    doc.elements[o.id] = { storey, states: ['st-ny'], tags: [], props: {}, id: o.id, type: o.type, host: o.host ?? `${storey}-w0`, definition: o.def, params: { at: o.at, ...(o.params ?? {}) } } as Element;
  }
  return doc;
}

const solidsOf = (doc: ProjectDoc, id: string) => buildModel3d(doc, { state: 'st-ny', detail: 'detail' } as never).filter((s): s is Solid => s.id === id && (s as Edges3D).kind !== 'edges');

describe('Inkorgen: blecket och spegeln', () => {
  it('blecket lutar 15° som förval, och lutningen läses ur filen inom 0–45°', () => {
    const win = DEFAULT_OPENING_TYPES.find((t) => t.id === 't-of-sid1')!.model;
    expect(trimOf(win).flashing?.slope).toBe(15);
    const m = normalizeOpeningModel({ kind: 'window', trim: { flashing: { overhang: 60, drip: 25, slope: 80 } } });
    expect(m.trim?.flashing).toEqual({ overhang: 60, drip: 25, slope: 45 });
    // En fil från 0.11.8.2 utan lutning får förvalet.
    expect(trimOf(normalizeOpeningModel({ kind: 'window', trim: { flashing: { overhang: 40, drip: 20 } } })).flashing?.slope).toBe(15);
  });

  it('det lutande blecket är en kropp med sned ovansida i Detalj, det plana en låda', () => {
    const doc = house([{ id: 'f1', type: 'Window', def: 't-of-sid1', at: 2000 }]);
    const sloped = solidsOf(doc, 'f1').filter((s) => s.top);
    expect(sloped.length).toBe(1);
    const flat = house([{ id: 'f1', type: 'Window', def: 't-of-sid1', at: 2000 }]);
    flat.definitions['t-of-sid1'].opening!.trim = { flashing: { overhang: 40, drip: 20, slope: 0 } };
    expect(solidsOf(flat, 'f1').filter((s) => s.top).length).toBe(0);
  });

  it('en spegel kan ha rak kant (utan fas)', () => {
    const g = normalizeLeafGrid({ cols: [{ size: 1, unit: 'fr' }], rows: [{ size: 1, unit: 'fr' }], fills: [{ col: 0, row: 0, flat: true }, { col: 0, row: 0 }] });
    expect(g?.fills[0].flat).toBe(true);
    expect(g?.fills[1].flat).toBeUndefined();
  });
});

describe('Vägghålen', () => {
  it('fyra förvalda typer, varav Ventgaller och Rent hål i nya projekt', () => {
    const holes = DEFAULT_OPENING_TYPES.filter((t) => t.model.kind === 'hole');
    expect(holes.map((t) => t.name)).toEqual(['Ventgaller', 'Nisch', 'Genomföring', 'Rent hål']);
    expect(STARTER_OPENING_TYPES).toEqual(expect.arrayContaining(['t-vg-galler', 't-vg-hal']));
    expect(holeOf(holes[1].model).depth).toBe(100);
    expect(holeOf(holes[2].model).shape).toBe('round');
    expect(Object.values(emptyProject('Hus', 'nybyggnad').definitions).filter((d) => d.opening?.kind === 'hole').length).toBe(2);
  });

  it('formen läses ur filen: rund, nisch och galler; okänt blir förval', () => {
    const m = normalizeOpeningModel({ kind: 'hole', hole: { shape: 'round', depth: 50, grille: true } });
    expect(m.hole).toEqual({ shape: 'round', depth: 50, grille: true });
    expect(normalizeOpeningModel({ kind: 'hole', hole: { shape: 'oval' } }).hole).toBeUndefined();
    // Bara vägghål har en form.
    expect(normalizeOpeningModel({ kind: 'window', hole: { shape: 'round' } }).hole).toBeUndefined();
  });

  it('vägghålet står på sin underkant, med måttet i mm och formen ur typen', () => {
    const doc = house([
      { id: 'g', type: 'WallHole', def: 't-vg-galler', at: 1000 },
      { id: 'n', type: 'WallHole', def: 't-vg-nisch', at: 3000, params: { swing: -1 } },
      { id: 'r', type: 'WallHole', def: 't-vg-genom', at: 5000, params: { sill: -200 } },
    ]);
    const g = resolveParams<OpeningObjParams>(doc, doc.elements.g);
    expect([g.holeW, g.holeH, g.sill, g.heightRef]).toEqual([300, 200, 300, 'sill']);
    const n = resolveParams<OpeningObjParams>(doc, doc.elements.n);
    expect(n.niche).toEqual({ depth: 100, side: -1 });
    const r = resolveParams<OpeningObjParams>(doc, doc.elements.r);
    expect([r.round, r.holeW, r.sill]).toEqual([true, 160, -200]);
  });

  it('nischen tar bara upp djupet i väggen; den runda skärs i skivor', () => {
    const doc = house([
      { id: 'n', type: 'WallHole', def: 't-vg-nisch', at: 3000, params: { swing: 1 } },
      { id: 'r', type: 'WallHole', def: 't-vg-genom', at: 5000 },
    ]);
    const wall = resolveParams<WallParams>(doc, doc.elements['pl-1-w0']);
    const f = wallFrame(wall);
    const n = resolveParams<OpeningObjParams>(doc, doc.elements.n);
    const os = openingRings(f, n)[0][0].map((q) => f.project(q)[1]);
    expect(Math.min(...os)).toBeCloseTo(f.half - 100, 0);
    expect(Math.max(...os)).toBeGreaterThanOrEqual(f.half - 0.01);
    const wallSolid = buildModel3d(doc, { state: 'st-ny' } as never).find((s): s is Solid => s.id === 'pl-1-w0' && !!(s as Solid).cuts);
    expect(wallSolid?.cuts?.length).toBe(1 + 16);
  });

  it('ventgallret har en platta i 3D', () => {
    const doc = house([{ id: 'g', type: 'WallHole', def: 't-vg-galler', at: 1000 }]);
    expect(solidsOf(doc, 'g').length).toBe(1);
  });
});

describe('Fasaden som arbetsyta', () => {
  const south = (doc: ProjectDoc) => Object.values(doc.elements).find((e) => {
    if (e.type !== 'Elevation') return false;
    const f = markerFrame(doc, e);
    return Math.abs(f.view[1] - 1) < 1e-6;
  })!;

  it('ett drag i fasaden blir läget längs väggen och överkant karm, eller bröstningen', () => {
    const doc = house([{ id: 'f1', type: 'Window', def: 't-of-sid1', at: 2000 }, { id: 'f2', type: 'Window', def: 't-of-sid1', at: 4000, params: { heightRef: 'sill', sill: 900 } }]);
    const m = south(doc);
    const r = markerFrame(doc, m).right;
    const t = wallFrame(resolveParams<WallParams>(doc, doc.elements['pl-1-w0'])).tangent(2000);
    const k = t[0] * r[0] + t[1] * r[1];
    const s1 = facadeShift(doc, m.id, doc.elements.f1, [100, 200])!;
    expect(s1.at).toBe(2000 + Math.round(100 / k));
    expect(s1.head).toBe(2300);
    expect(facadeShift(doc, m.id, doc.elements.f2, [0, -100])).toEqual({ sill: 800 });
  });

  it('dörrar flyttas bara i sidled, och allt i en transaktion', () => {
    const doc = house([{ id: 'd1', type: 'Door', def: 't-dd-glas', at: 2000 }, { id: 'f1', type: 'Window', def: 't-of-sid1', at: 4000 }]);
    const store = new DocStore(doc);
    const m = south(doc);
    expect(facadeShift(doc, m.id, doc.elements.d1, [0, 300])).toBeNull();
    const before = store.doc;
    expect(moveOpeningsInView(store, m.id, ['d1', 'f1'], [-200, 0])).toBe(2);
    store.undo();
    expect(store.doc.elements.f1.params.at).toBe(before.elements.f1.params.at);
  });
});

describe('Smarta lägen', () => {
  it('I liv med fönstret under: mitten lodrätt över fönstret på våningen under', () => {
    const doc = house([
      { id: 'u', type: 'Window', def: 't-of-sid1', at: 1800 },
      { id: 'o', type: 'Window', def: 't-of-sid2', at: 2600, storey: 'pl-2' },
    ], true);
    expect(openingBelow(doc, 'o')?.id).toBe('u');
    const store = new DocStore(doc);
    expect(alignWithBelow(store, ['o'])).toBe(1);
    expect(store.doc.elements.o.params.at).toBe(1800);
    expect(alignWithBelow(store, ['u'])).toBe(0);
  });

  it('Lika avstånd: de yttersta står kvar och avstånden mellan hålen blir lika', () => {
    const doc = house([
      { id: 'a', type: 'Window', def: 't-of-sid1', at: 1000 },
      { id: 'b', type: 'Window', def: 't-of-sid1', at: 2000 },
      { id: 'c', type: 'Window', def: 't-of-sid1', at: 5000 },
    ]);
    const plan = equalSpacingPlan(doc, ['a', 'b', 'c'])!;
    expect(plan.get('b')).toBe(3000);
    expect(equalSpacingPlan(doc, ['a', 'b'])).toBeNull();
    const store = new DocStore(doc);
    expect(equalSpacing(store, ['c', 'a', 'b'])).toBe(1);
  });

  it('Mitt i rummet: mitt på rummets vägg, också när en innervägg delar fasaden', () => {
    const doc = house([{ id: 'f', type: 'Window', def: 't-of-sid1', at: 1000 }]);
    doc.elements.wi = { storey: 'pl-1', states: ['st-ny'], tags: [], props: {}, id: 'wi', type: 'Wall', definition: 't-yv01', params: { start: [3000, 0], end: [3000, 4000], justification: 'center', thickness: 120 } } as Element;
    const at = roomMidAt(doc, 'f')!;
    // Rummet går från ytterväggens insida till innerväggen; w0 går från x = 6000 mot 0.
    const f = wallFrame(resolveParams<WallParams>(doc, doc.elements['pl-1-w0']));
    const x = f.at(at, 0)[0];
    // Fönstret sitter vid x = 5 000; väggarna är 400 (YV01), så rummet går från x = 3 200 till 5 800.
    expect(x).toBeCloseTo(4500, 0);
    const store = new DocStore(doc);
    expect(centerInRoom(store, ['f'])).toBe(1);
  });
});

describe('Dagsljuset', () => {
  it('glasarean: innanför bågarna, i fast glas hela luften, i dörrar de glasade fyllningarna', () => {
    const sid1 = DEFAULT_OPENING_TYPES.find((t) => t.id === 't-of-sid1')!.model;
    const fast = DEFAULT_OPENING_TYPES.find((t) => t.id === 't-of-fast')!.model;
    const slat = DEFAULT_OPENING_TYPES.find((t) => t.id === 't-dd-slat')!.model;
    const glazed = DEFAULT_OPENING_TYPES.find((t) => t.id === 't-dd-glas')!.model;
    // 990 × 1 290 med karm 45 runt om (nederstycke 45) och båge 50.
    expect(glassAreaOf(fast, 990, 1290)).toBeCloseTo((990 - 90) * (1290 - 90), 0);
    expect(glassAreaOf(sid1, 990, 1290)).toBeCloseTo((990 - 90 - 100) * (1290 - 90 - 100), 0);
    expect(glassAreaOf(slat, 890, 2090)).toBe(0);
    expect(glassAreaOf(glazed, 990, 2090)).toBeGreaterThan(0);
  });

  it('rummets andel, med varning under 10 %, och glaset per väderstreck och mot en fasad', () => {
    const doc = house([{ id: 'f', type: 'Window', def: 't-of-sid1', at: 3000 }]);
    const panes = glassPanes(doc, 'st-ny');
    expect(panes.length).toBe(1);
    const room: [number, number][] = [[100, 100], [5900, 100], [5900, 3900], [100, 3900]];
    const d = roomDaylight(panes, 'pl-1', room, 5.8 * 3.8);
    expect(d.glass).toBeCloseTo(panes[0].area, 6);
    expect(d.low).toBe(true);
    const rows = glassByCompass(doc, panes);
    expect(rows.map((r) => r.short)).toEqual(['S']);
    expect(glassFacing(panes, [0, -1]).count).toBe(1);
    expect(glassFacing(panes, [0, 1]).count).toBe(0);
  });
});
