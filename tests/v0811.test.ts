import { describe, expect, it } from 'vitest';
import { parseDxf, type DxfItem } from '../src/formats/dxf';
import { mtextLines } from '../src/formats/dxfText';
import { dxf } from './projekt';


const texts = (d: ReturnType<typeof parseDxf>) => d.items.filter((i): i is Extract<DxfItem, { kind: 'text' }> => i.kind === 'text');
const near = (a: readonly number[], b: readonly number[]) => expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(1e-6);

describe('text i DXF-underlag (0.8.11)', () => {
  it('MTEXT: formateringskoder tolkas bort och stycken blir rader', () => {
    expect(mtextLines('\\pxql;Förråd')).toEqual(['Förråd']);
    expect(mtextLines('{\\fArial|b1|i0|c0|p34;\\H2.5x;Kök}\\PBad')).toEqual(['Kök', 'Bad']);
    expect(mtextLines('\\pi-3,l3,t3;1\\~st \\S1/2; \\U+00E5 %%c100')).toEqual(['1 st 1/2 å Ø100']);
    expect(mtextLines('a\\\\b \\{c\\}')).toEqual(['a\\b {c}']);
  });

  it('TEXT följer justeringen: mitt och höger på punkten i 11/21, mitten och överkant flyttar baslinjen', () => {
    const d = parseDxf(
      dxf(`
      0\nTEXT\n8\nT\n10\n0\n20\n0\n40\n100\n1\nVänster\n
      0\nTEXT\n8\nT\n10\n0\n20\n0\n11\n500\n21\n0\n40\n100\n72\n1\n1\nMitt\n
      0\nTEXT\n8\nT\n10\n0\n20\n0\n11\n500\n21\n0\n40\n100\n72\n2\n73\n3\n1\nHöger överkant\n
      0\nTEXT\n8\nT\n10\n0\n20\n0\n11\n500\n21\n0\n40\n100\n72\n4\n1\nMitten\n`),
    );
    const [left, mid, topRight, middle] = texts(d);
    expect(left.align).toBe('start');
    near(left.at, [0, 0]);
    expect(mid.align).toBe('middle');
    near(mid.at, [500, 0]);
    expect(topRight.align).toBe('end');
    near(topRight.at, [500, -100]);
    expect(middle.align).toBe('middle');
    near(middle.at, [500, -50]);
  });

  it('MTEXT med fästpunkt mitt i: raderna fördelas kring punkten, också när texten är vriden', () => {
    const d = parseDxf(dxf(`0\nMTEXT\n8\nT\n10\n1000\n20\n1000\n40\n60\n71\n5\n50\n90\n1\nRad ett\\PRad två\n`));
    const [a, b] = texts(d);
    expect([a.text, b.text]).toEqual(['Rad ett', 'Rad två']);
    expect(a.align).toBe('middle');
    expect(a.angle).toBeCloseTo(90);
    // Två rader: total höjd 60 + 100 (radavstånd 5/3), första baslinjen 20 över mitten.
    // Vriden 90°: "uppåt" för texten är −x.
    near(a.at, [1000 - 20, 1000]);
    near(b.at, [1000 + 80, 1000]);
  });

  it('MTEXT fäst mitt i med vänsterjusterade stycken: raderna börjar på samma x, till vänster om punkten', () => {
    const d = parseDxf(dxf(`0\nMTEXT\n8\nT\n10\n1000\n20\n0\n40\n100\n71\n5\n1\n\\pxql;Förråd\\PRad två längre\n`));
    const [a, b] = texts(d);
    expect(a.align).toBe('start');
    expect(b.align).toBe('start');
    expect(a.at[0]).toBeCloseTo(b.at[0]);
    expect(a.at[0]).toBeLessThan(1000);
  });
});

describe('vyerna på bladet (0.8.11, sheetGeometry)', () => {
  it('en flyttad vy fäster mot en annan vys kant och mitt, Shift låser riktningen', async () => {
    const { snapMove, snapEdge, freeSpot } = await import('../src/ui/app/sheetGeometry');
    const f = { minX: 0, minY: 0, maxX: 100, maxY: 50 };
    const other = { minX: 203, minY: 300, maxX: 303, maxY: 400 };
    const r = snapMove(f, [101, 2], false, [other], null, 5);
    expect(r.d).toEqual([103, 2]);
    expect(r.guides).toHaveLength(1);
    expect(snapMove(f, [101, 2], true, [other], null, 5).d).toEqual([103, 0]);
    expect(snapEdge(198, 0, [other], { minX: 0, minY: 0, maxX: 400, maxY: 280 }, 6).at).toBe(203);
    expect(snapEdge(198, 0, [other], null, 6).at).toBe(198);
    const area = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    expect(freeSpot(area, [], [20, 20])).toEqual([10, 90]);
    expect(freeSpot(area, [{ minX: 0, minY: 60, maxX: 50, maxY: 100 }], [20, 20])).toEqual([70, 90]);
    expect(freeSpot(area, [], [200, 20])).toBeNull();
  });
});

describe('vyerna på bladen räknas inte om i onödan (0.8.11)', () => {
  it('en flyttad vy eller en text på bladet behåller vyernas ritning; en ändrad vägg ritar om', async () => {
    const { registerBuiltInTypes } = await import('../src/elements');
    const { DocStore } = await import('../src/core/store');
    const { addViewport, createSheet, moveOnSheet } = await import('../src/core/sheets');
    const { cachedViewPrims, viewSource } = await import('../src/repr/sheet');
    const { addElement, moveElements } = await import('../src/core/commands');
    const { modelViewId } = await import('../src/core/model');
    const { sampleProject } = await import('../src/sample/sampleProject');
    registerBuiltInTypes();
    const store = new DocStore(sampleProject());
    const sid = createSheet(store, { name: 'Test' });
    const marker = Object.values(store.doc.elements).find((e) => e.type === 'Section')!;
    const ref = modelViewId(marker.id);
    const vp = addViewport(store, sid, { view: ref, scale: 100, at: [100, 100] })!;
    const prims = () => cachedViewPrims(store.doc, viewSource(store.doc, ref)!.def, { scale: 100 });
    const first = prims();
    moveOnSheet(store, [vp], [10, 0]);
    expect(prims()).toBe(first);
    addElement(store, { type: 'Text', storey: store.doc.storeys[0].id, space: sid, states: [], tags: [], props: {}, params: { at: [50, 50], text: 'Hej', height: 3 } } as never, store.doc.states[0].id);
    expect(prims()).toBe(first);
    const wall = Object.values(store.doc.elements).find((e) => e.type === 'Wall')!;
    moveElements(store, [wall.id], [100, 0]);
    expect(prims()).not.toBe(first);
  });
});

describe('Visa-menyn i kategorier (0.8.11)', () => {
  it('littera släcks per typ, och en äldre vy med all littera delas upp när en typ tänds', async () => {
    const { isShown, setShown } = await import('../src/ui/app/showKeys');
    const ui = { hide: ['littera'], hideDemolished: false };
    expect(isShown(ui, 'littera:Door')).toBe(false);
    setShown(ui, 'littera:Door', true);
    expect(isShown(ui, 'littera:Door')).toBe(true);
    expect(isShown(ui, 'littera:Wall')).toBe(false);
    expect(ui.hide.sort()).toEqual(['Label', 'littera:Ground', 'littera:Wall', 'littera:Window']);
    setShown(ui, 'demolished', false);
    expect(ui.hideDemolished).toBe(true);
  });
});

describe('markering av 2D (0.8.11)', () => {
  it('en linje nära klicket går före fyllningen den ligger under; inuti fyllningen går den före rummet', async () => {
    const { pickAt } = await import('../src/view2d/pick');
    const sq = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const room = { id: 'rum', priority: 40, regions: [], prims: [{ kind: 'polyline' as const, points: sq(-100, -100, 100, 100), closed: true, pen: { weight: 0.25 } }] };
    const fill = { id: 'fyllning', priority: 4, soft: true, regions: [[sq(0, 0, 50, 50)]], prims: [] };
    const line = { id: 'linje', priority: 58, regions: [], prims: [{ kind: 'line' as const, a: [10, 25] as [number, number], b: [40, 25] as [number, number], pen: { weight: 0.25 } }] };
    const all = [room, fill, line];
    expect(pickAt(all, [20, 26], 2)).toBe('linje');
    expect(pickAt(all, [20, 40], 2)).toBe('fyllning');
    expect(pickAt(all, [80, 80], 2)).toBe('rum');
  });
});
