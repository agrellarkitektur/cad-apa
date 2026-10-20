import { beforeAll, describe, expect, it } from 'vitest';
import { FORMAT_VERSION } from '../src/core/model';
import { addSheetText, addViewport, createSheet, duplicateSheet, moveOnSheet, removeFromSheet, saveSheet, setViewportCrop, sheetOfItem, updateSheetText, updateViewport } from '../src/core/sheets';
import { DocStore } from '../src/core/store';
import { registerBuiltInTypes } from '../src/elements';
import { buildSheet, centeredAt, contentCrop, modelToPaper } from '../src/repr/sheet';
import { sampleProject } from '../src/sample/sampleProject';
import { parse, serialize } from '../src/storage/format';

beforeAll(() => registerBuiltInTypes());

const today = '2026-10-20';
const texts = (d: ReturnType<typeof buildSheet>) => d.prims.filter((p) => p.kind === 'text' && p.origin?.objectType === 'SheetText');
const titleTexts = (d: ReturnType<typeof buildSheet>) => d.prims.filter((p) => p.kind === 'text' && p.origin?.objectType === 'ViewTitle').map((p) => (p.kind === 'text' ? p.text : ''));

describe('text på bladet och vyernas ram (0.8.7)', () => {
  it('format 8 (0.8.8)', () => {
    expect(FORMAT_VERSION).toBe(8);
  });

  it('en text på bladet ritas rad för rad, med smarttext, och tar en yta att markera', () => {
    const store = new DocStore(sampleProject());
    const id = createSheet(store, { number: 'A-101', name: 'Planer' });
    const t = addSheetText(store, id, { at: [40, 100], text: 'Ritning {ritningsnummer}\nRad två', height: 3.5, bold: true })!;
    expect(t).toBeTruthy();
    const s = store.doc.sheets[0];
    expect(s.items[0]).toEqual({ kind: 'text', id: t, at: [40, 100], text: 'Ritning {ritningsnummer}\nRad två', height: 3.5, bold: true });
    const d = buildSheet(store.doc, s, { today });
    const tp = texts(d);
    expect(tp.map((p) => (p.kind === 'text' ? [p.text, p.at[1], p.bold] : null))).toEqual([
      ['Ritning A-101', 100, true],
      ['Rad två', 100 - 3.5 * 1.5, true],
    ]);
    const f = d.items[0].frame;
    expect(d.items[0].kind).toBe('text');
    expect(f.minX).toBe(40);
    expect(f.maxY).toBeCloseTo(103.5);
    expect(f.minY).toBeLessThan(100 - 5.25);
    expect(f.maxX).toBeGreaterThan(60);
    // Tom text läggs inte på bladet.
    expect(addSheetText(store, id, { at: [0, 0], text: '  ', height: 2.5 })).toBeNull();
  });

  it('ändra, flytta, duplicera och ta bort en text; en tom text tas bort', () => {
    const store = new DocStore(sampleProject());
    const id = createSheet(store);
    const t = addSheetText(store, id, { at: [40, 100], text: 'A', height: 2.5 })!;
    updateSheetText(store, t, { text: 'B', height: 5, bold: true });
    expect(store.doc.sheets[0].items[0]).toMatchObject({ text: 'B', height: 5, bold: true });
    updateSheetText(store, t, { bold: false });
    expect(store.doc.sheets[0].items[0]).not.toHaveProperty('bold');
    moveOnSheet(store, id, [t], [10, -5]);
    expect(store.doc.sheets[0].items[0].at).toEqual([50, 95]);
    const copy = duplicateSheet(store, id)!;
    const c = store.doc.sheets.find((s) => s.id === copy)!;
    expect(c.items[0].id).not.toBe(t);
    expect(c.items[0].kind).toBe('text');
    // Texten står kvar från nedre vänstra hörnet när formatet byts.
    saveSheet(store, id, { size: 'A1' });
    expect(store.doc.sheets[0].items[0].at).toEqual([50, 95]);
    updateSheetText(store, t, { text: ' ' });
    expect(sheetOfItem(store.doc, t)).toBeUndefined();
    const t2 = addSheetText(store, id, { at: [1, 1], text: 'C', height: 2.5 })!;
    removeFromSheet(store, id, [t2]);
    expect(store.doc.sheets[0].items).toEqual([]);
  });

  it('skalan i vyns rubrik går att dölja', () => {
    const store = new DocStore(sampleProject());
    const id = createSheet(store);
    const vp = addViewport(store, id, { view: 'vy-a-bl', scale: 100, at: centeredAt(store.doc, 'vy-a-bl', 100, [150, 160]) })!;
    const scaleShown = () => titleTexts(buildSheet(store.doc, store.doc.sheets[0], { today })).some((t) => t.startsWith('SKALA'));
    expect(scaleShown()).toBe(true);
    updateViewport(store, id, vp, { hideScale: true });
    expect(store.doc.sheets[0].viewports[0].hideScale).toBe(true);
    expect(scaleShown()).toBe(false);
    updateViewport(store, id, vp, { hideScale: false });
    expect(store.doc.sheets[0].viewports[0]).not.toHaveProperty('hideScale');
    expect(scaleShown()).toBe(true);
  });

  it('vyns ram: klipper det som ritas, följer skalan och återställs till innehållet', () => {
    const store = new DocStore(sampleProject());
    const id = createSheet(store, { size: 'A1' });
    const vp = addViewport(store, id, { view: 'vy-a-bl', scale: 100, at: centeredAt(store.doc, 'vy-a-bl', 100, [400, 300]) })!;
    const full = buildSheet(store.doc, store.doc.sheets[0], { today }).views[0];
    const content = contentCrop(store.doc, store.doc.sheets[0].viewports[0])!;
    expect(modelToPaper(content, full.at, full.scale).minX).toBeCloseTo(full.frame.minX);
    expect(full.cropped).toBeFalsy();
    // Halva bredden: allt som ritas ligger inom ramen.
    const crop = { minX: content.minX, minY: content.minY, maxX: (content.minX + content.maxX) / 2, maxY: content.maxY };
    setViewportCrop(store, id, vp, crop);
    const v = buildSheet(store.doc, store.doc.sheets[0], { today }).views[0];
    expect(v.cropped).toBe(true);
    expect(v.frame.maxX).toBeCloseTo(full.at[0] + Math.round(crop.maxX) / 100);
    const drawn = v.prims.filter((p) => p.origin?.objectType !== 'ViewTitle');
    expect(drawn.length).toBeGreaterThan(0);
    const xs = drawn.flatMap((p) => (p.kind === 'line' ? [p.a[0], p.b[0]] : p.kind === 'polyline' ? p.points.map((q) => q[0]) : p.kind === 'region' ? p.rings.flat().map((q) => q[0]) : []));
    expect(Math.max(...xs)).toBeLessThanOrEqual(v.frame.maxX + 1e-6);
    // Ramen ligger i modellens koordinater: i 1:50 blir den dubbelt så stor på papperet.
    updateViewport(store, id, vp, { scale: 50 });
    const v50 = buildSheet(store.doc, store.doc.sheets[0], { today }).views[0];
    expect(v50.frame.maxX - v50.frame.minX).toBeCloseTo(2 * (v.frame.maxX - v.frame.minX), 1);
    setViewportCrop(store, id, vp, null);
    expect(store.doc.sheets[0].viewports[0]).not.toHaveProperty('crop');
    expect(buildSheet(store.doc, store.doc.sheets[0], { today }).views[0].cropped).toBeFalsy();
  });

  it('text, dold skala och ram sparas och läses', () => {
    const store = new DocStore(sampleProject());
    const id = createSheet(store);
    addSheetText(store, id, { at: [40, 100], text: 'Hej', height: 2.5 });
    const vp = addViewport(store, id, { view: 'vy-a-bl', scale: 100, at: [100, 100] })!;
    updateViewport(store, id, vp, { hideScale: true });
    setViewportCrop(store, id, vp, { minX: 0, minY: 0, maxX: 5000, maxY: 4000 });
    const back = parse(serialize(store.doc));
    expect(back.formatVersion).toBe(8);
    expect(back.sheets[0].items[0]).toMatchObject({ kind: 'text', text: 'Hej' });
    expect(back.sheets[0].viewports[0]).toMatchObject({ hideScale: true, crop: { minX: 0, minY: 0, maxX: 5000, maxY: 4000 } });
    // Ett projekt i format 7 får meddelandet om en äldre betaversion.
    expect(() => parse(serialize({ ...store.doc, formatVersion: 7 }))).toThrow(/äldre betaversion/);
  });
});
