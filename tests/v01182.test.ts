import { beforeAll, describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { emptyProject, type Element, type ProjectDoc } from '../src/core/model';
import { DEFAULT_OPENING_TYPES, hardwareOf, normalizeOpeningModel, openingDefinition, trimOf } from '../src/core/openingTypes';
import { fieldByName, fieldTags, isOriginalField, scheduleFields } from '../src/core/openingSchedule';
import { exportBook, readBookFile } from '../src/core/styleBookFile';
import { normalizeBook } from '../src/core/graphics';
import { registerBuiltInTypes } from '../src/elements';
import { freePassage, openingWarnings } from '../src/elements/openingWarnings';
import { openingModelOf } from '../src/elements/openingSpec';
import { buildPlan } from '../src/repr/plan';
import { buildModel3d } from '../src/repr/model3d';
import type { Edges3D, Solid } from '../src/repr/solids';
import { scheduleTagsChanged, setScheduleFields } from '../src/ui/openingScheduleFields';
import { isShown } from '../src/ui/app/showKeys';

/**
 * 0.11.8.2 Detalj och beslag: foder, bleck med droppnäsa, fönsterbänk,
 * tröskel, spröjs i planen, beslagen, varningarna och
 * tillgänglighetscirkeln; svaren A–E (fönstrens slagbågar släckta, skrivna
 * spröjsmått, spegelns profil, fältmallen i stilboken).
 */

beforeAll(() => registerBuiltInTypes());

function house(openings: { id: string; type: 'Window' | 'Door'; def: string; at: number; host?: string; params?: Record<string, unknown> }[], edit?: (doc: ProjectDoc) => void): ProjectDoc {
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
  // En innervägg tvärs över huset.
  doc.elements.wi = { ...base, id: 'wi', type: 'Wall', definition: 't-yv01', params: { start: [3000, 0], end: [3000, 4000], justification: 'center', thickness: 120 } } as Element;
  for (const o of openings) doc.elements[o.id] = { ...base, id: o.id, type: o.type, host: o.host ?? 'w0', definition: o.def, params: { at: o.at, ...(o.params ?? {}) } } as Element;
  return doc;
}

const partsOf = (prims: { origin?: { objectId?: string; part?: string } }[], id: string) => new Set(prims.filter((p) => p.origin?.objectId === id).map((p) => p.origin!.part));

describe('typens foder, bleck, bänk och beslag', () => {
  it('förvalen: fönster med foder, bleck och bänk; fönsterdörren och dörrar utan bleck och bänk', () => {
    const win = trimOf(DEFAULT_OPENING_TYPES.find((t) => t.id === 't-of-sid1')!.model);
    expect(win.lining.sides).toBe('both');
    expect(win.flashing).toEqual({ overhang: 40, drip: 20, slope: 15 });
    expect(win.board).toEqual({ thickness: 22, overhang: 20 });
    expect(trimOf(DEFAULT_OPENING_TYPES.find((t) => t.id === 't-of-fdorr')!.model).flashing).toBeNull();
    expect(trimOf(DEFAULT_OPENING_TYPES.find((t) => t.id === 't-dd-slat')!.model).board).toBeNull();
    expect(hardwareOf(DEFAULT_OPENING_TYPES.find((t) => t.id === 't-dd-slat')!.model)).toMatchObject({ handle: 'lever', handleHeight: 1000, hinges: true, closer: false });
  });

  it('från fil: det som är fel får förval, null betyder inget', () => {
    const m = normalizeOpeningModel({ kind: 'window', trim: { lining: { width: 'x', sides: 'in' }, flashing: null, board: { thickness: 30 } }, hardware: { handle: 'pull', closer: true, junk: 1 } });
    expect(m.trim).toEqual({ lining: { width: 70, thickness: 15, sides: 'in' }, flashing: null, board: { thickness: 30, overhang: 20 } });
    expect(trimOf(m).flashing).toBeNull();
    expect(m.hardware).toEqual({ handle: 'pull', closer: true });
  });
});

describe('planen i Detalj', () => {
  it('foder, bleck och bänk vid fönstret, foder och tröskel vid ytterdörren; inget av det i Normal', () => {
    const doc = house([
      { id: 'f', type: 'Window', def: 't-of-sid1', at: 1500 },
      { id: 'd', type: 'Door', def: 't-dd-glas', at: 4000, params: { swing: 1 } },
    ]);
    const detail = buildPlan(doc, 'pl-1', { state: 'st-ny', detail: 'detail' }).prims;
    const f = partsOf(detail, 'f');
    for (const p of ['foder', 'bleck', 'fönsterbänk']) expect(f.has(p)).toBe(true);
    expect(detail.filter((p) => p.origin?.objectId === 'f' && p.origin.part === 'foder')).toHaveLength(4);
    const d = partsOf(detail, 'd');
    expect(d.has('foder') && d.has('tröskel')).toBe(true);
    const normal = buildPlan(doc, 'pl-1', { state: 'st-ny' }).prims;
    for (const p of ['foder', 'bleck', 'fönsterbänk', 'tröskel']) expect(normal.some((x) => x.origin?.part === p)).toBe(false);
  });

  it('fodret bara inne, och inget bleck: typen styr', () => {
    const doc = house([{ id: 'f', type: 'Window', def: 't-of-sid1', at: 1500 }], (d) => {
      d.definitions['t-of-sid1'].opening!.trim = { lining: { width: 60, thickness: 12, sides: 'in' }, flashing: null };
    });
    const prims = buildPlan(doc, 'pl-1', { state: 'st-ny', detail: 'detail' }).prims;
    expect(prims.filter((p) => p.origin?.objectId === 'f' && p.origin.part === 'foder')).toHaveLength(2);
    expect(partsOf(prims, 'f').has('bleck')).toBe(false);
  });

  it('lodräta spröjs i snittet (Detalj)', () => {
    const doc = house([{ id: 'f', type: 'Window', def: 't-of-fast', at: 1500, params: { width: 1200, height: 1300 } }], (d) => {
      d.definitions['t-of-fast'].opening!.cells[0].muntins = { v: 2, h: 1, kind: 'loose' };
    });
    const prims = buildPlan(doc, 'pl-1', { state: 'st-ny', detail: 'detail' }).prims;
    // Två lodräta, med en list på var sida om glaset.
    expect(prims.filter((p) => p.origin?.objectId === 'f' && p.origin.part === 'spröjs')).toHaveLength(4);
  });
});

describe('Visa: fönstrens slagbågar och tillgänglighetscirkeln (A)', () => {
  it('båda är släckta från början och tänds med +nyckeln', () => {
    expect(isShown({ hide: [], hideDemolished: false }, 'swingWindow')).toBe(false);
    expect(isShown({ hide: ['+swingWindow'], hideDemolished: false }, 'swingWindow')).toBe(true);
    expect(isShown({ hide: [], hideDemolished: false }, 'accessCircle')).toBe(false);
  });

  it('cirkeln på dörrens båda sidor med stilbokens diameter', () => {
    const doc = house([{ id: 'd', type: 'Door', def: 't-dd-slat', at: 3000 }]);
    const off = buildPlan(doc, 'pl-1', { state: 'st-ny' }).prims;
    expect(off.some((p) => p.origin?.part === 'tillgänglighetscirkel')).toBe(false);
    const on = buildPlan(doc, 'pl-1', { state: 'st-ny', hide: ['+accessCircle'] }).prims.filter((p) => p.origin?.part === 'tillgänglighetscirkel');
    expect(on).toHaveLength(2);
    for (const c of on) if (c.kind === 'arc') expect(c.radius).toBe(650);
    const big15 = house([{ id: 'd', type: 'Door', def: 't-dd-slat', at: 3000 }], (d) => (d.graphics = { ...d.graphics, general: { openings: { accessCircle: 1500 } } }));
    const big = buildPlan(big15, 'pl-1', { state: 'st-ny', hide: ['+accessCircle'] }).prims.find((p) => p.origin?.part === 'tillgänglighetscirkel');
    expect(big?.kind === 'arc' && big.radius).toBe(750);
  });
});

describe('3D och fasad i Detalj', () => {
  const edges = (doc: ProjectDoc, id: string, part: string) =>
    buildModel3d(doc, { state: 'st-ny', modelDetail: 'detail' } as never).filter((s): s is Edges3D => s.kind === 'edges' && s.id === id && s.part === part);

  it('blecket med droppnäsa ute och bänken inne; beslagen på fönstret', () => {
    const doc = house([{ id: 'f', type: 'Window', def: 't-of-sid1', at: 1500 }]);
    expect(edges(doc, 'f', 'sill').length).toBeGreaterThan(0);
    expect(edges(doc, 'f', 'board').length).toBeGreaterThan(0);
    expect(edges(doc, 'f', 'handle').length).toBeGreaterThan(0);
    // I Normal finns inget av det.
    const normal = buildModel3d(doc, { state: 'st-ny' } as never).filter((s) => s.kind === 'edges' && s.id === 'f');
    expect(normal.some((s) => s.kind === 'edges' && (s.part === 'sill' || s.part === 'board' || s.part === 'handle'))).toBe(false);
  });

  it('dörrstängare och brevinkast när typen har dem; spegelns profil', () => {
    const solidsOf = (doc: ProjectDoc) => buildModel3d(doc, { state: 'st-ny', modelDetail: 'detail' } as never).filter((s): s is Solid => s.kind !== 'edges' && s.id === 'd');
    const plain = house([{ id: 'd', type: 'Door', def: 't-dd-spegel', at: 3000 }]);
    const fitted = house([{ id: 'd', type: 'Door', def: 't-dd-spegel', at: 3000 }], (d) => {
      d.definitions['t-dd-spegel'].opening!.hardware = { closer: true, letterbox: true };
    });
    expect(solidsOf(fitted).length).toBe(solidsOf(plain).length + 1);
    expect(edges(fitted, 'd', 'handle').flatMap((e) => e.segments).length).toBeGreaterThan(edges(plain, 'd', 'handle').flatMap((e) => e.segments).length);
    // Spegeln (två fyllningar) får en fas: fler bladlinjer i Detalj än i Normal.
    const leafNormal = buildModel3d(plain, { state: 'st-ny' } as never).filter((s): s is Edges3D => s.kind === 'edges' && s.id === 'd' && s.part === 'leaf');
    expect(edges(plain, 'd', 'leaf').flatMap((e) => e.segments).length).toBeGreaterThan(leafNormal.flatMap((e) => e.segments).length);
  });
});

describe('varningarna', () => {
  it('fri passage: 9M innerdörr räcker (karmen 40), 8M gör det inte; en ytterdörr behöver 800', () => {
    const slat = DEFAULT_OPENING_TYPES.find((t) => t.id === 't-dd-slat')!.model;
    expect(freePassage(slat, 890, 2090)).toBe(890 - 80 - 40);
    const doc = house([
      { id: 'a', type: 'Door', def: 't-dd-slat', at: 1000, host: 'wi', params: { width: 900, height: 2100 } },
      { id: 'b', type: 'Door', def: 't-dd-slat', at: 3000, host: 'wi', params: { width: 800, height: 2100 } },
      { id: 'c', type: 'Door', def: 't-dd-glas', at: 4500, params: { width: 900, height: 2100 } },
    ]);
    expect(openingWarnings(doc, doc.elements.a).some((w) => w.includes('Fri passage'))).toBe(false);
    expect(openingWarnings(doc, doc.elements.b).some((w) => w.includes('Fri passage'))).toBe(true);
    // Ytterväggen: 9M ytterdörr ger 790 < 800, och tröskeln 42 > 25.
    const c = openingWarnings(doc, doc.elements.c);
    expect(c.some((w) => w.includes('under 800'))).toBe(true);
    expect(c.some((w) => w.includes('Tröskeln 42'))).toBe(true);
  });

  it('säkerhetsglas under 600, tystas av fältet; utrymningsfönstret mäts', () => {
    const doc = house([
      { id: 'f', type: 'Window', def: 't-of-fast', at: 1500, params: { heightRef: 'sill', sill: 300 } },
      { id: 'g', type: 'Window', def: 't-of-sid1', at: 3500, params: { width: 400, height: 600, fields: { 'Funktion/placering': 'Utrymning' } } },
    ]);
    expect(openingWarnings(doc, doc.elements.f).some((w) => w.includes('säkerhetsglas'))).toBe(true);
    doc.elements.f = { ...doc.elements.f, params: { ...doc.elements.f.params, fields: { Säkerhetsglas: 'Laminerat' } } };
    expect(openingWarnings(doc, doc.elements.f).some((w) => w.includes('säkerhetsglas'))).toBe(false);
    expect(openingWarnings(doc, doc.elements.g).some((w) => w.startsWith('Utrymningsfönstret'))).toBe(true);
  });
});

describe('fältmallen i stilboken (E)', () => {
  it('mallen och taggarna bor i stilboken och följer med dess fil; ett äldre projekts mall flyttas dit', () => {
    const doc = house([]);
    doc.project.openingSchedule = { fields: { Window: ['Antal', 'U-värde', 'Fönsterputs'] } };
    const store = new DocStore(doc);
    expect(scheduleFields(store.doc, 'Window')).toEqual(['Antal', 'U-värde', 'Fönsterputs']);
    scheduleTagsChanged(store, 'Window', 2, 'städ, underhåll');
    expect(store.doc.graphics.scheduleFields?.Window).toEqual(['Antal', 'U-värde', 'Fönsterputs']);
    expect(store.doc.project.openingSchedule?.fields).toBeUndefined();
    expect(fieldTags(store.doc, 'Fönsterputs')).toEqual(['städ', 'underhåll']);
    expect(fieldTags(store.doc, 'U-värde')).toContain('energi');
    expect(isOriginalField('Window', 'Fönsterputs')).toBe(false);
    // Namnbytet tar taggarna med sig.
    setScheduleFields(store, 'Window', ['Antal', 'U-värde', 'Puts'], 'byt', ['Fönsterputs', 'Puts']);
    expect(fieldTags(store.doc, 'Puts')).toEqual(['städ', 'underhåll']);
    const read = readBookFile(JSON.parse(JSON.stringify(exportBook(store.doc))), store.doc.graphics);
    expect(read.book.scheduleFields?.Window).toEqual(['Antal', 'U-värde', 'Puts']);
    expect(normalizeBook({ ...exportBook(store.doc), scheduleFields: { Window: ['', 'A', 'A', 3], tags: { A: [] } } }).scheduleFields).toEqual({ Window: ['A'] });
    // Dörr- och fönstertyperna följer med filen.
    expect(read.types?.some((d) => d.id === 't-of-sid1' && d.opening)).toBe(true);
  });

  it('fälten som smarttext: {U-värde} och {fält:U-värde}', () => {
    const el = { params: { fields: { 'U-värde': '1,2' } } } as unknown as Element;
    expect(fieldByName(el, 'u-värde')).toBe('1,2');
    expect(fieldByName(el, 'fält:U-värde')).toBe('1,2');
    expect(fieldByName(el, 'Brandklass')).toBe('');
  });
});

describe('typen ur projektet', () => {
  it('openingModelOf ger typens foder', () => {
    const doc = house([{ id: 'f', type: 'Window', def: 't-of-sid1', at: 1500 }], (d) => {
      d.definitions['t-of-sid1'].opening!.trim = { board: null };
    });
    expect(trimOf(openingModelOf(doc, doc.elements.f)).board).toBeNull();
  });
});
