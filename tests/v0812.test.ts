import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { addElements, moveElements } from '../src/core/commands';
import { isMaster, modelViewId, onPaper } from '../src/core/model';
import { addScaleBar, addViewport, createSheet, createStamp, duplicateSheet, placeStamp, saveSheet, stampUsers } from '../src/core/sheets';
import { fieldsOf } from '../src/core/sheetFields';
import { DocStore } from '../src/core/store';
import { deleteWorksheet } from '../src/core/treeCommands';
import { scaleBarLayout } from '../src/elements/scaleBar';
import type { Primitive } from '../src/repr/primitives';
import { buildSheet, placeableViews } from '../src/repr/sheet';
import { sampleProject } from '../src/sample/sampleProject';

beforeAll(() => registerBuiltInTypes());

const texts = (prims: readonly Primitive[]) => prims.filter((p): p is Extract<Primitive, { kind: 'text' }> => p.kind === 'text');

describe('skalstock (0.8.12)', () => {
  it('Carl Augusts skalstockar: talen står där de ska i skalan', () => {
    for (const s of [1, 5, 10, 20, 25, 50, 100, 1000, 2000, 2500, 4000, 5000]) {
      const b = scaleBarLayout(s);
      expect(b.length).toBe(100);
      for (const l of b.labels) {
        const v = Number(l.text.replace(',', '.'));
        expect(l.x).toBeCloseTo(s === 1 ? v : (v * 1000) / s, 6);
      }
      expect(b.labels.at(-1)!.x).toBe(100);
      expect(b.unit).toBe(s === 1 ? 'MILLIMETER' : 'METER');
    }
    expect(scaleBarLayout(5000).labels.map((l) => l.text)).toEqual(['0', '50', '100', '200', '500']);
    expect(scaleBarLayout(10).labels.at(-1)!.text).toBe('1,0');
  });

  it('andra skalor tar indelningen från samma siffror, eller jämna tal', () => {
    expect(scaleBarLayout(200).labels.map((l) => l.text)).toEqual(['0', '1', '2', '5', '10', '15', '20']);
    expect(scaleBarLayout(500).labels.map((l) => l.text)).toEqual(['0', '5', '10', '20', '50']);
    expect(scaleBarLayout(400).labels.map((l) => l.text)).toEqual(['0', '1', '5', '10', '15', '20', '30', '40']);
    expect(scaleBarLayout(10000).labels.map((l) => l.text)).toEqual(['0', '50', '100', '200', '500', '1000']);
    const two = scaleBarLayout(2);
    expect(two.unit).toBe('MILLIMETER');
    expect(two.labels.at(-1)).toEqual({ x: 100, text: '200' });
    for (const s of [75, 150, 300, 1250]) {
      const b = scaleBarLayout(s);
      expect(b.length).toBeGreaterThanOrEqual(40);
      expect(b.length).toBeLessThanOrEqual(100.0001);
      const last = b.labels.at(-1)!;
      expect(last.x).toBeCloseTo(b.length, 6);
      expect(last.x).toBeCloseTo((Number(last.text.replace(',', '.')) * 1000) / s, 6);
    }
  });

  it('läggs på bladet där Carl August har den, följer vyn och flyttas', () => {
    const store = new DocStore(sampleProject());
    const sheet = createSheet(store, { size: 'A1', orientation: 'landscape' });
    const vp = addViewport(store, sheet, { view: modelViewId(store.doc.storeys[0].id), at: [200, 300], scale: 50 })!;
    const id = addScaleBar(store, sheet)!;
    const el = store.doc.elements[id];
    expect(el.space).toBe(sheet);
    expect(el.params).toEqual({ pos: [611, 40], scale: 50, view: vp });
    const draw = () => buildSheet(store.doc, store.doc.sheets.find((s) => s.id === sheet)!, { today: '2026-10-23' });
    expect(texts(draw().prims).some((t) => t.text === 'SKALA 1:50')).toBe(true);
    // Vyns skala ändras: skalstocken följer.
    store.transact('skala', (tx) => tx.setField('sheets', tx.doc.sheets.map((s) => (s.id === sheet ? { ...s, viewports: s.viewports.map((v) => ({ ...v, scale: 100 })) } : s))));
    expect(texts(draw().prims).some((t) => t.text === 'SKALA 1:100')).toBe(true);
    expect(draw().pickables.some((p) => p.id === id && p.regions.length === 1)).toBe(true);
    moveElements(store, [id], [-10, 5]);
    expect(store.doc.elements[id].params.pos).toEqual([601, 45]);
    // Ett duplicerat blad: skalstocken följer kopians vy.
    const copy = duplicateSheet(store, sheet)!;
    const c = store.doc.sheets.find((s) => s.id === copy)!;
    const bar = Object.values(store.doc.elements).find((e) => e.space === copy && e.type === 'ScaleBar')!;
    expect(bar.params.view).toBe(c.viewports[0].id);
  });
});

describe('stämplar (0.8.12)', () => {
  it('ritas på papper men är inget mallblad och ingen vy', () => {
    const store = new DocStore(sampleProject());
    const st = createStamp(store, 'Bygglov');
    const w = store.doc.worksheets.find((x) => x.id === st)!;
    expect(isMaster(w)).toBe(false);
    expect(onPaper(w)).toBe(true);
    expect(placeableViews(store.doc).some((v) => v.id === modelViewId(st))).toBe(false);
  });

  it('läggs på flera blad med smarttexten från bladet, ändras på ett ställe och tas bort med stämpeln', () => {
    const store = new DocStore(sampleProject());
    const st = createStamp(store, 'Bygglov');
    addElements(store, [
      { type: 'Text', storey: store.doc.storeys[0].id, space: st, states: [], tags: [], props: {}, params: { pos: [0, 0], text: 'BYGGLOV {ritningsnummer} {Granskare}', height: 5 } },
    ], 'st-a', 'Text');
    const a = createSheet(store, { number: 'A-101' });
    const b = createSheet(store, { number: 'A-102' });
    placeStamp(store, a, st, [100, 50]);
    placeStamp(store, b, st, [20, 30]);
    expect(stampUsers(store.doc, st).map((s) => s.number)).toEqual(['A-101', 'A-102']);
    saveSheet(store, a, { fields: { ...store.doc.sheets.find((s) => s.id === a)!.fields, granskare: 'KL' } });
    const draw = (id: string) => buildSheet(store.doc, store.doc.sheets.find((s) => s.id === id)!, { today: '2026-10-23' });
    const ta = texts(draw(a).prims).find((t) => t.text.startsWith('BYGGLOV '))!;
    expect(ta.text).toBe('BYGGLOV A-101 KL');
    expect(ta.at).toEqual([100, 50]);
    const tb = texts(draw(b).prims).find((t) => t.text.startsWith('BYGGLOV '))!;
    expect(tb.at).toEqual([20, 30]);
    // Fälten i stämpeln hör till bladets fält.
    expect(fieldsOf(store.doc, [store.doc.sheets.find((s) => s.id === b)!]).some((f) => f.key === 'granskare')).toBe(true);
    // Ändras texten i stämpeln ändras den på båda bladen.
    const text = Object.values(store.doc.elements).find((e) => e.space === st)!;
    store.transact('ändra', (tx) => tx.putElement({ ...text, params: { ...text.params, text: 'STÄMPELN ÄNDRAD' } }));
    expect(texts(draw(a).prims).some((t) => t.text === 'STÄMPELN ÄNDRAD')).toBe(true);
    expect(texts(draw(b).prims).some((t) => t.text === 'STÄMPELN ÄNDRAD')).toBe(true);
    deleteWorksheet(store, st);
    expect(Object.values(store.doc.elements).some((e) => e.type === 'Stamp')).toBe(false);
    store.undo();
    expect(Object.values(store.doc.elements).filter((e) => e.type === 'Stamp')).toHaveLength(2);
  });

  it('en stämpel i en stämpel ritar inte sig själv', () => {
    const store = new DocStore(sampleProject());
    const st = createStamp(store, 'Loop');
    addElements(store, [{ type: 'Stamp', storey: store.doc.storeys[0].id, space: st, states: [], tags: [], props: {}, params: { pos: [0, 0], stamp: st } }], 'st-a', 'Stämpel');
    const a = createSheet(store);
    placeStamp(store, a, st, [10, 10]);
    expect(() => buildSheet(store.doc, store.doc.sheets.find((s) => s.id === a)!, { today: '2026-10-23' })).not.toThrow();
  });
});
