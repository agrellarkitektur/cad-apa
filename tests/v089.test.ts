import { beforeAll, describe, expect, it } from 'vitest';
import { addElements, deleteElements, moveElements } from '../src/core/commands';
import { FORMAT_VERSION } from '../src/core/model';
import { addViewport, createSheet, deleteSheet, duplicateSheet, isViewportId, sheetContents } from '../src/core/sheets';
import { DocStore } from '../src/core/store';
import { registerBuiltInTypes } from '../src/elements';
import { textType } from '../src/elements/annotation';
import { layoutText, wrapLine } from '../src/elements/textLayout';
import { textWidth } from '../src/formats/drawingFont';
import { writePdf } from '../src/formats/pdf';
import type { Primitive } from '../src/repr/primitives';
import { buildSheet, centeredAt } from '../src/repr/sheet';
import { sampleProject } from '../src/sample/sampleProject';
import { parse, serialize } from '../src/storage/format';
import { pickAt } from '../src/view2d/pick';

beforeAll(() => registerBuiltInTypes());

const today = '2026-10-20';
const texts = (prims: readonly Primitive[]) => prims.flatMap((p) => (p.kind === 'text' ? [p.text] : []));
const text = (params: Record<string, unknown>) => ({ type: 'Text', storey: 'pl-1', tags: [], props: {}, params: { pos: [0, 0], text: 'TEXT', height: 2.5, angle: 0, ...params } });

/** Ett blad med en vy, och en text och en linje ritade på bladet. */
function sheetWithDrawing() {
  const store = new DocStore(sampleProject());
  const id = createSheet(store, { number: 'A-101', name: 'Planer', size: 'A1' });
  const vp = addViewport(store, id, { view: 'vy-a-bl', scale: 100, at: centeredAt(store.doc, 'vy-a-bl', 100, [400, 300]) })!;
  const [t, l] = addElements(
    store,
    [
      { ...text({ pos: [40, 100], text: 'Ritning {ritningsnummer}' }), space: id },
      { type: 'Line2D', storey: 'pl-1', tags: [], props: {}, space: id, params: { shape: 'line', points: [[30, 30], [130, 30]], weight: 0.35 } },
    ],
    'st-a',
    'Rita',
  );
  return { store, id, vp, t: t.id, l: l.id };
}

describe('grafik och textrutor på bladen (0.8.9, format 9)', () => {
  it('format 9: bladen har inga texter i sig längre; format 8 får meddelandet om en äldre alfaversion', () => {
    expect(FORMAT_VERSION).toBeGreaterThanOrEqual(9);
    const { store } = sheetWithDrawing();
    const raw = JSON.parse(serialize(store.doc));
    raw.sheets[0].items = [{ kind: 'text', id: 'x', at: [0, 0], text: 'gammal', height: 2.5 }];
    const back = parse(JSON.stringify(raw));
    expect(back.sheets[0]).not.toHaveProperty('items');
    expect(Object.values(back.elements).filter((e) => e.space === back.sheets[0].id)).toHaveLength(2);
    expect(() => parse(serialize({ ...store.doc, formatVersion: 8 }))).toThrow(/äldre alfaversion/);
  });

  it('det som är ritat på bladet ritas över vyerna i mm på papperet, med smarttext, och går att markera med vyerna', () => {
    const { store, id, vp, t, l } = sheetWithDrawing();
    const d = buildSheet(store.doc, store.doc.sheets[0], { today });
    expect(texts(d.prims)).toContain('Ritning A-101');
    const ids = d.pickables.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining([vp, t, l]));
    // Det ritade ligger över vyn: linjen på vyns kant träffas före vyn, inuti vyn träffas vyn.
    const lineAt = d.prims.findIndex((p) => p.origin?.objectId === l);
    const viewAt = d.prims.findIndex((p) => p.origin?.objectType === 'ViewTitle');
    expect(lineAt).toBeGreaterThan(viewAt);
    const v = d.views[0];
    const mid: [number, number] = [(v.frame.minX + v.frame.maxX) / 2, (v.frame.minY + v.frame.maxY) / 2];
    expect(pickAt(d.pickables, mid, 0.5, 1)).toBe(vp);
    expect(pickAt(d.pickables, [80, 30], 0.5, 1)).toBe(l);
    // Bladet följer inte tillstånden: ritat i Förslag A syns oavsett vad som är förval.
    expect(store.doc.elements[t].states).not.toContain('st-bef');
  });

  it('vyer och ritat flyttas och tas bort tillsammans; vyn finns kvar i projektet', () => {
    const { store, id, vp, t } = sheetWithDrawing();
    const at = store.doc.sheets[0].viewports[0].at;
    moveElements(store, [vp, t], [10, -5]);
    expect(store.doc.sheets[0].viewports[0].at).toEqual([at[0] + 10, at[1] - 5]);
    expect(store.doc.elements[t].params.pos).toEqual([50, 95]);
    expect(store.undoLabel).toBe('Flytta');
    expect(isViewportId(store.doc, vp)).toBe(true);
    deleteElements(store, [vp, t]);
    expect(store.doc.sheets[0].viewports).toEqual([]);
    expect(store.doc.elements[t]).toBeUndefined();
    expect(store.doc.views.some((v) => v.id === 'vy-a-bl')).toBe(true);
    store.undo();
    expect(store.doc.sheets[0].viewports).toHaveLength(1);
    expect(store.doc.elements[t]).toBeDefined();
    deleteElements(store, [vp]);
    expect(store.undoLabel).toBe('Ta bort vyn från bladet');
    expect(sheetContents(store.doc, id)).toHaveLength(2);
  });

  it('ett duplicerat blad får kopior av det ritade; ett borttaget blad tar det med sig', () => {
    const { store, id } = sheetWithDrawing();
    const copy = duplicateSheet(store, id)!;
    expect(sheetContents(store.doc, copy)).toHaveLength(2);
    expect(sheetContents(store.doc, copy).map((e) => e.id)).not.toEqual(sheetContents(store.doc, id).map((e) => e.id));
    deleteSheet(store, id);
    expect(sheetContents(store.doc, id)).toHaveLength(0);
    expect(sheetContents(store.doc, copy)).toHaveLength(2);
  });

  it('raderna bryts vid ord med Helveticas bredder; ett för långt ord bryts mitt i', () => {
    const lines = wrapLine('Detta är en text som inte ryms på en rad', 40, 2.5);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(textWidth(l, 2.5)).toBeLessThanOrEqual(40);
    expect(lines.join(' ')).toBe('Detta är en text som inte ryms på en rad');
    const long = wrapLine('Fastighetsbeteckningsregistret', 20, 3.5);
    expect(long.length).toBeGreaterThan(1);
    expect(long.join('')).toBe('Fastighetsbeteckningsregistret');
    // Utan bredd: bara radbrytningarna i texten.
    expect(layoutText({ text: 'A\nB', height: 2.5 }).lines).toEqual(['A', 'B']);
  });

  it('förankring i överkant, mitt och underkant, och markering när texten inte ryms i höjden', () => {
    const base = { text: 'Ett två tre fyra fem sex sju', height: 5, maxWidth: 40 };
    const top = layoutText({ ...base, anchor: 'top' });
    expect(top.extent[3]).toBeCloseTo(0);
    expect(top.baselines[0]).toBeCloseTo(-5);
    const bottom = layoutText({ ...base, anchor: 'bottom' });
    expect(bottom.extent[1]).toBeCloseTo(0);
    const mid = layoutText({ ...base, anchor: 'middle' });
    expect(mid.extent[1] + mid.extent[3]).toBeCloseTo(0);
    // Utan förankring står första raden på punkten, som förut.
    expect(layoutText(base).baselines[0]).toBe(0);
    // Högerställd: rutan slutar i punkten.
    const right = layoutText({ ...base, align: 'end', maxHeight: 100 });
    expect(right.box).toEqual([-40, expect.any(Number), 0, expect.any(Number)]);
    expect(right.overflow).toBe(false);
    expect(layoutText({ ...base, maxHeight: 6 }).overflow).toBe(true);
  });

  it('textrutan i planen: rader, skala och en röd ram på skärmen som inte skrivs ut', async () => {
    const ctx = { scale: 100, view: {}, params: (e: { params: unknown }) => e.params } as never;
    const el = { id: 't', ...text({ pos: [1000, 2000], text: 'Ett två tre fyra fem sex sju åtta', height: 2.5, maxWidth: 30, maxHeight: 4, anchor: 'top' }) };
    const prims = textType.plan!(el as never, ctx);
    const lines = prims.filter((p) => p.kind === 'text');
    expect(lines.length).toBeGreaterThan(1);
    // Raderna står 1,5 × höjden isär, gånger skalan.
    const ys = lines.map((p) => (p.kind === 'text' ? p.at[1] : 0));
    expect(ys[0] - ys[1]).toBeCloseTo(2.5 * 1.5 * 100);
    const mark = prims.find((p) => p.origin?.part === 'skärm');
    expect(mark?.kind).toBe('polyline');
    const pdf = new TextDecoder('latin1').decode(await writePdf([{ size: [100, 100], prims: [mark!] }]));
    expect(pdf).not.toMatch(/ RG/);
    // Smarttext fylls i före radbrytningen, och ett tomt fält ger ingen text.
    const smart = { scale: 1, view: { smart: { projekt: 'Villa Sjöbo', skede: '' } }, params: (e: { params: unknown }) => e.params } as never;
    expect(texts(textType.plan!({ id: 's', ...text({ text: '{projekt}' }) } as never, smart))).toEqual(['Villa Sjöbo']);
    expect(textType.plan!({ id: 's', ...text({ text: '{skede}' }) } as never, smart)).toEqual([]);
  });
});
