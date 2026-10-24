import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { addElements, addWithAsset } from '../src/core/commands';
import { modelViewId } from '../src/core/model';
import { addViewport, createSheet, deleteSheet, duplicateSheet, nextSheetNumber, paperSize, removeViewport, renameProject, saveSheet, sheetOfViewport, updateViewport } from '../src/core/sheets';
import { DocStore } from '../src/core/store';
import { applyFieldChanges } from '../src/core/sheetFields';
import { clipPolyline, clipRing, clipSegment } from '../src/geometry/clipRect';
import { textWidth, writePdf } from '../src/formats/pdf';
import { crc32, uniqueNames, writeZip } from '../src/formats/zip';
import { buildPlan } from '../src/repr/plan';
import { buildSection } from '../src/repr/section';
import { buildSheet, buildViewPage, centeredAt, placeableViews, toPaper, viewSource } from '../src/repr/sheet';
import { expandSmartText, sheetScales } from '../src/repr/smartText';
import type { Primitive } from '../src/repr/primitives';
import { sampleProject } from '../src/sample/sampleProject';
import { parse, serialize } from '../src/storage/format';

beforeAll(() => registerBuiltInTypes());

const texts = (prims: readonly Primitive[]) => prims.filter((p): p is Extract<Primitive, { kind: 'text' }> => p.kind === 'text');

describe('ritningsblad (0.8 del 3)', () => {
  it('skapas med nästa ritningsnummer och dagens datum, sparas och tas bort med ångra', () => {
    const store = new DocStore(sampleProject());
    expect(nextSheetNumber(store.doc)).toBe('A-101');
    const a = createSheet(store, { name: 'Planer' });
    const b = createSheet(store);
    expect(store.doc.sheets.map((s) => s.number)).toEqual(['A-101', 'A-102']);
    expect(store.doc.sheets[0].fields.datum).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    saveSheet(store, b, { number: 'A-40.1-09', name: '  Fasader ', size: 'A1', orientation: 'portrait', fields: { skede: 'FÖRFRÅGNINGSUNDERLAG', ritat: '' } });
    const s = store.doc.sheets.find((x) => x.id === b)!;
    expect(s.name).toBe('Fasader');
    expect(s.fields).toEqual({ skede: 'FÖRFRÅGNINGSUNDERLAG' });
    expect(paperSize(s)).toEqual([594, 841]);
    expect(nextSheetNumber(store.doc)).toBe('A-40.1-10');
    deleteSheet(store, a);
    expect(store.doc.sheets).toHaveLength(1);
    store.undo();
    expect(store.doc.sheets.map((x) => x.id)).toEqual([a, b]);
  });

  it('vyer läggs på, flyttas, får skala och rubrik och tas bort; duplicering kopierar dem', () => {
    const store = new DocStore(sampleProject());
    const id = createSheet(store);
    const vp = addViewport(store, id, { view: 'vy-a-bl', scale: 100, at: [100, 100] })!;
    updateViewport(store, id, vp, { at: [120, 90], scale: 50, title: 'PLAN 1' });
    let v = store.doc.sheets[0].viewports[0];
    expect(v).toMatchObject({ at: [120, 90], scale: 50, title: 'PLAN 1' });
    updateViewport(store, id, vp, { title: '  ' });
    v = store.doc.sheets[0].viewports[0];
    expect(v.title).toBeUndefined();
    expect(sheetOfViewport(store.doc, vp)?.id).toBe(id);
    const copy = duplicateSheet(store, id)!;
    const c = store.doc.sheets.find((s) => s.id === copy)!;
    expect(c.number).toBe('A-102');
    expect(c.viewports[0].id).not.toBe(vp);
    removeViewport(store, id, vp);
    expect(store.doc.sheets[0].viewports).toHaveLength(0);
  });

  it('sparas i projektfilen och läses tillbaka', () => {
    const store = new DocStore(sampleProject());
    const id = createSheet(store, { name: 'Planer' });
    addViewport(store, id, { view: modelViewId('fasad-1'), scale: 100, at: [200, 150] });
    applyFieldChanges(store, [], { values: { arkitekt: 'Agrell Arkitektur', adress: 'Exempelgatan 1' } });
    renameProject(store, 'Villa Test');
    const back = parse(serialize(store.doc));
    expect(back.sheets).toEqual(store.doc.sheets);
    expect(back.project.name).toBe('Villa Test');
    expect(back.project.fields.arkitekt).toBe('Agrell Arkitektur');
  });

  it('allt som går att lägga på ett blad: sparade vyer och modellvyerna', () => {
    const doc = sampleProject();
    const ids = placeableViews(doc).map((v) => v.id);
    expect(ids).toContain('vy-a-bl');
    expect(ids).toContain(modelViewId('pl-1'));
    expect(ids).toContain(modelViewId('sektion-a'));
    expect(viewSource(doc, modelViewId('fasad-1'))!.def.marker).toBe('fasad-1');
    expect(viewSource(doc, 'finns-inte')).toBeNull();
  });
});

describe('smarttext och ritningshuvud (0.8 del 3)', () => {
  it('fyller i kända namn; fält utan värde blir tomma (0.8.10)', () => {
    expect(expandSmartText('{Projekt}, {skala} {okänd}', { projekt: 'Villa', skala: '1:100' })).toBe('Villa, 1:100 ');
    expect(expandSmartText('{constructor}{}', {})).toBe('{}');
  });

  it('skalorna på bladet, störst först', () => {
    expect(sheetScales({ viewports: [{ id: 'a', view: 'v', at: [0, 0], scale: 50 }, { id: 'b', view: 'v', at: [0, 0], scale: 100 }, { id: 'c', view: 'v', at: [0, 0], scale: 50 }] })).toBe('1:100, 1:50');
  });

  it('mallbladet fyller i projektet, numret och skalan i huvudet', () => {
    const store = new DocStore(sampleProject());
    applyFieldChanges(store, [], { values: { arkitekt: 'Agrell Arkitektur', uppdragsnummer: '2026-014' } });
    const id = createSheet(store, { name: 'Plan 1', fields: { datum: '2026-10-20' } });
    addViewport(store, id, { view: 'vy-a-bl', scale: 100, at: [0, 0] });
    const d = buildSheet(store.doc, store.doc.sheets[0], { today: '2026-10-20' });
    const t = texts(d.prims).map((x) => x.text);
    expect(t).toEqual(expect.arrayContaining(['Exempelvilla', 'A-101', 'Plan 1', '1:100', '2026-10-20', 'Agrell Arkitektur', '2026-014', 'BYGGLOVSHANDLING']));
  });
});

describe('vyer på bladet och annoteringsskalan (0.8 del 3)', () => {
  it('texter, mått och symboler ritas för vyns skala; väggarna är desamma', () => {
    const doc = sampleProject();
    const view = { state: 'st-a', compareTo: 'st-bef' };
    const at100 = buildPlan(doc, 'pl-1', { ...view, scale: 100 }).prims;
    const at50 = buildPlan(doc, 'pl-1', { ...view, scale: 50 }).prims;
    // Väggarnas ytor ändras inte med skalan.
    const walls = (ps: Primitive[]) => ps.filter((p) => p.kind === 'region' && p.origin?.objectType === 'Wall').map((p) => (p as Extract<Primitive, { kind: 'region' }>).rings);
    expect(walls(at50)).toEqual(walls(at100));
    // Texthöjden på papper är densamma, men rumsetiketternas rader ligger tätare i modellen i 1:50.
    const room = (ps: Primitive[]) => texts(ps).filter((t) => t.origin?.objectType === 'Space');
    expect(room(at50)[0].height).toBe(room(at100)[0].height);
    const gap = (ps: Primitive[]) => Math.abs(room(ps)[0].at[1] - room(ps)[1].at[1]);
    expect(gap(at50)).toBeCloseTo(gap(at100) / 2, 3);
    // Nivåkoterna i en sektion följer också skalan.
    const s100 = buildSection(doc, 'sektion-a', { ...view, scale: 100 })!;
    const s50 = buildSection(doc, 'sektion-a', { ...view, scale: 50 })!;
    const level = (r: typeof s100) => texts(r.prims).find((t) => t.origin?.part === 'nivå')!;
    expect(level(s50).at[0]).toBeLessThan(level(s100).at[0]);
  });

  it('flyttas och skalas från modellen till papperet', () => {
    const prims: Primitive[] = [
      { kind: 'line', a: [0, 0], b: [10000, 0], pen: { weight: 0.25 } },
      { kind: 'arc', center: [1000, 1000], radius: 900, start: 0, end: Math.PI / 2, pen: { weight: 0.18 } },
      { kind: 'text', at: [500, 500], text: 'Kök', height: 2.5, pen: { weight: 0.18 } },
    ];
    const p = toPaper(prims, [50, 40], 100);
    expect(p[0]).toMatchObject({ a: [50, 40], b: [150, 40] });
    expect(p[1]).toMatchObject({ center: [60, 50], radius: 9 });
    // Texthöjden är redan mm på papper.
    expect(p[2]).toMatchObject({ at: [55, 45], height: 2.5 });
  });

  it('ett blad med vyer: mallen, vyerna i sin skala; centrerad där man vill', () => {
    const store = new DocStore(sampleProject());
    const id = createSheet(store);
    const at = centeredAt(store.doc, 'vy-a-bl', 100, [150, 160]);
    addViewport(store, id, { view: 'vy-a-bl', scale: 100, at });
    addViewport(store, id, { view: modelViewId('fasad-1'), scale: 50, at: centeredAt(store.doc, modelViewId('fasad-1'), 50, [300, 200]) });
    const d = buildSheet(store.doc, store.doc.sheets[0], { today: '2026-10-20' });
    expect(d.size).toEqual([420, 297]);
    expect(d.frame).toEqual({ minX: 20, minY: 10, maxX: 410, maxY: 287 });
    const plan = d.views[0];
    expect((plan.frame.minX + plan.frame.maxX) / 2).toBeCloseTo(150, 0);
    expect((plan.frame.minY + plan.frame.maxY) / 2).toBeCloseTo(160, 0);
    expect(texts(plan.prims).some((t) => t.text === 'SKALA 1:100')).toBe(true);
    // Fasaden i 1:50 blir dubbelt så stor på papperet som i 1:100.
    const f50 = d.views[1].frame;
    const f100 = buildSheet(
      store.doc,
      { ...store.doc.sheets[0], viewports: [{ ...store.doc.sheets[0].viewports[1], scale: 100 }] },
      { today: '' },
    ).views[0].frame;
    // Nivåkoterna ligger lite närmare i 1:50, så det blir inte exakt dubbelt.
    expect((f50.maxX - f50.minX - 8) / (f100.maxX - f100.minX - 8)).toBeGreaterThan(1.85);
    expect(d.prims[0].origin?.part).toBe('papper');
    expect(texts(d.prims).some((t) => t.text === 'A-101')).toBe(true);
  });

  it('en vy som tagits bort visas som en tom ram', () => {
    const store = new DocStore(sampleProject());
    const id = createSheet(store);
    addViewport(store, id, { view: 'borta', scale: 100, at: [100, 100] });
    const d = buildSheet(store.doc, store.doc.sheets[0], { today: '' });
    expect(d.views[0].missing).toBe(true);
    expect(texts(d.views[0].prims).some((t) => t.text === 'Vyn finns inte längre')).toBe(true);
  });

  it('underlag som är större än vyn klipps mot dess ram', () => {
    const store = new DocStore(sampleProject());
    const dxf = btoa(`0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nKARTA\n10\n-100000\n20\n0\n11\n100000\n21\n0\n0\nENDSEC\n0\nEOF`);
    addWithAsset(
      store,
      { id: 'fil-k', name: 'karta.dxf', mime: 'application/dxf', data: dxf },
      { type: 'Underlay', storey: 'pl-1', tags: [], props: {}, params: { asset: 'fil-k', kind: 'dxf', pos: [0, 4000], angle: 0, scale: 1, size: [200000, 1], ref: [0, 0], opacity: 70 } },
      'st-a',
      'Lägg in',
    );
    const id = createSheet(store);
    addViewport(store, id, { view: modelViewId('pl-1'), scale: 100, at: [100, 100] });
    const d = buildSheet(store.doc, store.doc.sheets[0], { today: '' });
    const v = d.views[0];
    const map = v.prims.filter((p) => p.origin?.objectType === 'Underlay');
    expect(map.length).toBeGreaterThan(0);
    for (const p of map)
      if (p.kind === 'polyline')
        for (const q of p.points) {
          expect(q[0]).toBeGreaterThanOrEqual(v.frame.minX - 1e-6);
          expect(q[0]).toBeLessThanOrEqual(v.frame.maxX + 1e-6);
        }
  });

  it('en vy ensam på ett papper som är precis så stort som den', () => {
    const page = buildViewPage(sampleProject(), 'vy-a-bl', {})!;
    expect(page.name).toBe('Plan 1 – Förslag A, bygglov');
    expect(page.size[0]).toBeGreaterThan(50);
    const xs = page.prims.flatMap((p) => (p.kind === 'line' ? [p.a[0], p.b[0]] : []));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...xs)).toBeLessThanOrEqual(page.size[0] - 10);
  });

  it('en Text i en vy i 1:50 får samma höjd på papper som i 1:100', () => {
    const store = new DocStore(sampleProject());
    addElements(store, [{ type: 'Text', storey: 'pl-1', tags: [], props: {}, params: { pos: [1000, 1000], text: 'Uteplats', height: 2.5, angle: 0 } }], 'st-a', 'Text');
    const id = createSheet(store);
    addViewport(store, id, { view: modelViewId('pl-1'), scale: 50, at: [0, 0] });
    const d = buildSheet(store.doc, store.doc.sheets[0], { today: '' });
    const t = texts(d.views[0].prims).find((x) => x.text === 'Uteplats')!;
    expect(t.height).toBe(2.5);
    expect(t.at).toEqual([20, 20]);
  });
});

describe('klippning mot en rektangel', () => {
  const r = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
  it('sträckor, polylinjer och ringar', () => {
    expect(clipSegment([-5, 5], [15, 5], r)).toEqual([
      [0, 5],
      [10, 5],
    ]);
    expect(clipSegment([-5, -5], [-1, 20], r)).toBeNull();
    // En polylinje som går ut och in igen blir två bitar.
    expect(
      clipPolyline(
        [
          [2, 2],
          [2, 20],
          [8, 20],
          [8, 2],
        ],
        r,
      ),
    ).toHaveLength(2);
    const ring = clipRing(
      [
        [-5, -5],
        [5, -5],
        [5, 5],
        [-5, 5],
      ],
      r,
    );
    const xs = ring.map((p) => p[0]);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(5);
  });
});

describe('PDF och zip (0.8 del 3)', () => {
  it('en PDF med rätt korsreferenser, sidstorlek i punkter och svenska tecken', async () => {
    const pdf = await writePdf(
      [
        {
          size: [420, 297],
          prims: [
            { kind: 'region', role: 'cut', rings: [[[0, 0], [420, 0], [420, 297], [0, 297]]], fill: { kind: 'solid', color: 'paper' }, outline: null, origin: { part: 'papper' } },
            { kind: 'line', a: [10, 10], b: [100, 10], pen: { weight: 0.5, dash: [2, 1], opacity: 0.5 } },
            { kind: 'region', role: 'cut', rings: [[[20, 20], [40, 20], [40, 40], [20, 40]]], fill: { kind: 'hatch', color: 'ink', angle: 45, spacing: 1.5, weight: 0.13 }, outline: { weight: 0.35 } },
            { kind: 'arc', center: [60, 60], radius: 10, start: 0, end: Math.PI, pen: { weight: 0.18 } },
            { kind: 'text', at: [50, 100], text: 'Kök − Hall (två) ±0,000 m²', height: 3.5, align: 'middle', bold: true, pen: { weight: 0.25 } },
            { kind: 'image', corner: [0, 0], u: [10, 0], v: [0, 10], source: { asset: 'saknas' }, opacity: 0.5 },
          ],
        },
      ],
      { title: 'Test' },
    );
    const text = new TextDecoder('latin1').decode(pdf);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/MediaBox [0 0 1190.551 841.89]');
    // Varje post i korsreferenstabellen pekar på sitt objekt.
    const xref = text.slice(text.lastIndexOf('xref'));
    const offsets = [...xref.matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
    offsets.forEach((o, i) => expect(text.slice(o, o + 12)).toMatch(new RegExp(`^${i + 1} 0 obj`)));
    const start = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(start, start + 4)).toBe('xref');
    // å, ö och ² i WinAnsi; minustecknet blir ett tankstreck; parenteser skyddas.
    expect(text).toContain('(K\\366k \\226 Hall \\(tv\\345\\) \\2610,000 m\\262) Tj');
    // Papperet ritas inte; skrafferingen klipps mot ytan.
    expect(text).toContain('W* n');
    expect(text).toContain('/GS50 gs');
  });

  it('osifonts bredder (0.8.18), fet lika bred', () => {
    expect(textWidth('A', 10)).toBeCloseTo(6.14, 2);
    expect(textWidth('A', 10, true)).toBeCloseTo(6.14, 2);
  });

  it('zip: CRC-32, unika filnamn och en katalog i slutet', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(uniqueNames(['A-101.pdf', 'a-101.pdf', 'Plan: 1/2.pdf', 'A-101.pdf'])).toEqual(['A-101.pdf', 'a-101 (2).pdf', 'Plan- 1-2.pdf', 'A-101 (3).pdf']);
    const zip = writeZip([
      { name: 'A-101.pdf', data: new Uint8Array([1, 2, 3]) },
      { name: 'Fasad mot väst.pdf', data: new Uint8Array([4, 5]) },
    ]);
    const v = new DataView(zip.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    const end = zip.length - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    expect(v.getUint16(end + 10, true)).toBe(2);
    const dir = v.getUint32(end + 16, true);
    expect(v.getUint32(dir, true)).toBe(0x02014b50);
    expect(new TextDecoder().decode(zip)).toContain('Fasad mot väst.pdf');
  });
});
