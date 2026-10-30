import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { parseDxf } from '../src/formats/dxf';
import { addWithAsset, deleteElements, moveElements } from '../src/core/commands';
import { copyPayload, pasteClip } from '../src/core/clipboard';
import { DocStore } from '../src/core/store';
import { createWorksheet, deleteWorksheet } from '../src/core/treeCommands';
import { underlayCorners, underlayInverse, underlayTransform, type UnderlayParams } from '../src/elements/underlay';
import { buildPlan } from '../src/repr/plan';
import { insertShapeNode, moveShapeNode, offsetShapeEdge, removeShapeNode, shapeEdgeAt } from '../src/elements/shapeEdit';
import { sampleProject } from '../src/sample/sampleProject';
import { dxf } from './projekt';

beforeAll(() => registerBuiltInTypes());

const view = { state: 'st-a', compareTo: 'st-bef', detail: 'normal' as const };

const shape = (params: Record<string, unknown>, type = 'Shape2D') => ({ type, params: { weight: 0.25, linetype: 'solid', ...params } });

describe('punkter i 2D-element (0.8 del 2)', () => {
  it('en punkt i en polylinje flyttas; de andra ligger kvar', () => {
    const s = shape({ shape: 'polyline', points: [[0, 0], [1000, 0], [1000, 1000]] });
    expect(moveShapeNode(s, 1, [1200, 50]).points).toEqual([[0, 0], [1200, 50], [1000, 1000]]);
  });
  it('cirkeln (två halvcirklar, 0.8.24) förblir en cirkel när en punkt dras', () => {
    const s = shape({ shape: 'polyline', points: [[500, 0], [-500, 0]], bulges: [500, 500], closed: true });
    const m = moveShapeNode(s, 1, [-1500, 0]);
    expect(m.points).toEqual([[500, 0], [-1500, 0]]);
    expect(m.bulges).toEqual([1000, 1000]);
  });
  it('lägg till och ta bort punkt; ritsättet spelar ingen roll (0.8.24)', () => {
    const l = shape({ shape: 'polyline', points: [[0, 0], [1000, 0]] });
    const hit = shapeEdgeAt(l, [400, 20], 50)!;
    expect(hit.index).toBe(0);
    const ins = insertShapeNode(l, hit.index, [400, 300])!;
    expect(ins).toEqual({ points: [[0, 0], [400, 300], [1000, 0]], bulges: undefined });
    expect(removeShapeNode(l, 0)).toBeNull();
    const rect = shape({ shape: 'polyline', points: [[0, 0], [1000, 0], [1000, 500], [0, 500]], closed: true });
    expect(removeShapeNode(rect, 2)).toEqual({ points: [[0, 0], [1000, 0], [0, 500]], bulges: undefined });
    const fill = shape({ shape: 'polyline', points: [[0, 0], [1000, 0], [0, 500]], closed: true, fill: 'solid' });
    expect(removeShapeNode(fill, 0)).toBeNull();
    // Kanten från sista punkten tillbaka till den första i en sluten form.
    expect(shapeEdgeAt(rect, [0, 250], 20)!.index).toBe(3);
  });
  it('förskjut en kant: i en rektangel följer grannkanterna med, i en öppen polylinje flyttas änden rakt ut', () => {
    const rect = shape({ shape: 'polyline', points: [[0, 0], [1000, 0], [1000, 500], [0, 500]], closed: true });
    // Kant 0 går åt höger; vänster är uppåt, in i rektangeln. Minus: utåt (nedåt).
    expect(offsetShapeEdge(rect, 0, -200)!.points).toEqual([[0, -200], [1000, -200], [1000, 500], [0, 500]]);
    const pl = shape({ shape: 'polyline', points: [[0, 0], [1000, 0], [1000, 1000]] });
    expect(offsetShapeEdge(pl, 0, 100)!.points).toEqual([[0, 100], [1000, 100], [1000, 1000]]);
  });
  it('kanten på en spline hittas på kurvan', () => {
    const s = shape({ shape: 'spline', points: [[0, 0], [1000, 500], [2000, 0], [3000, 500]] });
    expect(shapeEdgeAt(s, [1500, 300], 200)?.index).toBe(1);
  });
});


describe('DXF-läsaren (0.8 del 2)', () => {
  it('linjer, polylinjer och cirklar med lager och enhet', () => {
    const d = parseDxf(
      dxf(`0\nLINE\n8\nVÄGG\n10\n0\n20\n0\n11\n1000\n21\n0\n0\nLWPOLYLINE\n8\nA-40\n90\n3\n70\n1\n10\n0\n20\n0\n10\n500\n20\n0\n10\n500\n20\n500\n0\nCIRCLE\n8\nVÄGG\n10\n2000\n20\n0\n40\n100\n`, '', 6),
    );
    expect(d.layers).toEqual(['VÄGG', 'A-40']);
    expect(d.mmPerUnit).toBe(1000);
    expect(d.unitsKnown).toBe(true);
    const polys = d.items.filter((i) => i.kind === 'poly');
    expect(polys).toHaveLength(3);
    expect(polys[1].kind === 'poly' && polys[1].closed).toBe(true);
    expect(d.bounds).toEqual({ minX: 0, minY: -100, maxX: 2100, maxY: 500 });
  });
  it('bulten i en polylinje blir en båge åt rätt håll', () => {
    // Halvcirkel moturs från (0,0) till (1000,0): bulten 1 går under linjen.
    const d = parseDxf(dxf(`0\nLWPOLYLINE\n8\n0\n90\n2\n70\n0\n10\n0\n20\n0\n42\n1\n10\n1000\n20\n0\n`));
    const p = d.items[0];
    expect(p.kind).toBe('poly');
    if (p.kind !== 'poly') return;
    const lowest = Math.min(...p.pts.map((q) => q[1]));
    expect(lowest).toBeCloseTo(-500, 0);
    expect(p.pts.at(-1)).toEqual([1000, 0]);
  });
  it('block packas upp med insättningspunkt, skala och vridning; text läses', () => {
    const block = `0\nBLOCK\n2\nKVADRAT\n10\n0\n20\n0\n0\nLINE\n8\n0\n10\n0\n20\n0\n11\n100\n21\n0\n0\nENDBLK\n`;
    const d = parseDxf(dxf(`0\nINSERT\n8\nMÖBEL\n2\nKVADRAT\n10\n1000\n20\n1000\n41\n2\n42\n2\n50\n90\n0\nTEXT\n8\nTEXT\n10\n5\n20\n5\n40\n250\n1\nKök\n`, block));
    const line = d.items.find((i) => i.kind === 'poly');
    expect(line && line.kind === 'poly' && line.layer).toBe('MÖBEL');
    if (line?.kind === 'poly') {
      expect(line.pts[0][0]).toBeCloseTo(1000);
      expect(line.pts[1][0]).toBeCloseTo(1000);
      expect(line.pts[1][1]).toBeCloseTo(1200);
    }
    const text = d.items.find((i) => i.kind === 'text');
    expect(text && text.kind === 'text' && text.text).toBe('Kök');
  });
  it('utan enhet antas millimeter', () => {
    const d = parseDxf(`0\nSECTION\n2\nENTITIES\n0\nLINE\n10\n0\n20\n0\n11\n1\n21\n1\n0\nENDSEC\n0\nEOF`);
    expect(d.mmPerUnit).toBe(1);
    expect(d.unitsKnown).toBe(false);
    expect(d.items).toHaveLength(1);
  });
});

const DXF_TEXT = dxf(`0\nLINE\n8\nVÄGG\n10\n0\n20\n0\n11\n10000\n21\n0\n0\nLINE\n8\nMÖBEL\n10\n0\n20\n0\n11\n0\n21\n7000\n`);
const dxfAsset = { id: 'fil-1', name: 'grannhus.dxf', mime: 'application/dxf', data: btoa(DXF_TEXT) };
const dxfParams = (extra: Partial<UnderlayParams> = {}): UnderlayParams => ({ asset: 'fil-1', kind: 'dxf', pos: [1000, 2000], angle: 0, scale: 1, size: [10000, 7000], ref: [0, 0], opacity: 70, ...extra });
const underlay = (params: UnderlayParams, extra = {}) => ({ type: 'Underlay', name: 'Grannhus', storey: 'pl-1', tags: [], props: {}, params: params as unknown as Record<string, unknown>, ...extra });

describe('underlag (0.8 del 2)', () => {
  it('filens koordinater till modellen och tillbaka, med skala och vridning', () => {
    const p = dxfParams({ angle: 90, scale: 2, ref: [100, 100] });
    const t = underlayTransform(p);
    expect(t([100, 100])).toEqual([1000, 2000]);
    const q = t([1100, 100]);
    expect(q[0]).toBeCloseTo(1000);
    expect(q[1]).toBeCloseTo(4000);
    const back = underlayInverse(p)(q);
    expect(back[0]).toBeCloseTo(1100);
    expect(back[1]).toBeCloseTo(100);
    expect(underlayCorners(dxfParams())[2]).toEqual([11000, 9000]);
  });

  it('läggs in med sin fil i ett steg och ritas i planen', () => {
    const store = new DocStore(sampleProject());
    const el = addWithAsset(store, dxfAsset, underlay(dxfParams()), 'st-a', 'Lägg in');
    expect(store.doc.assets['fil-1'].name).toBe('grannhus.dxf');
    const plan = buildPlan(store.doc, 'pl-1', view);
    const mine = plan.pickables.find((pk) => pk.id === el.id)!;
    expect(mine.prims.filter((q) => q.kind === 'polyline')).toHaveLength(2);
    // I alla tillstånd: underlaget hör till ritningen.
    expect(buildPlan(store.doc, 'pl-1', { state: 'st-bef', detail: 'normal' }).pickables.some((pk) => pk.id === el.id)).toBe(true);
    // Ångra tar bort både elementet och filen.
    store.undo();
    expect(store.doc.elements[el.id]).toBeUndefined();
    expect(store.doc.assets['fil-1']).toBeUndefined();
  });

  it('släckta lager ritas inte', () => {
    const store = new DocStore(sampleProject());
    const el = addWithAsset(store, dxfAsset, underlay(dxfParams({ layersOff: ['MÖBEL'] })), 'st-a', 'Lägg in');
    const mine = buildPlan(store.doc, 'pl-1', view).pickables.find((pk) => pk.id === el.id)!;
    expect(mine.prims).toHaveLength(1);
  });

  it('flyttas med pos, men inte när det är låst; filen tas bort med den sista placeringen', () => {
    const store = new DocStore(sampleProject());
    const a = addWithAsset(store, dxfAsset, underlay(dxfParams()), 'st-a', 'Lägg in');
    const b = addWithAsset(store, dxfAsset, underlay(dxfParams({ pos: [0, 0] })), 'st-a', 'Lägg in igen');
    moveElements(store, [a.id], [500, 0]);
    expect(store.doc.elements[a.id].params.pos).toEqual([1500, 2000]);
    store.transact('lås', (tx) => tx.putElement({ ...store.doc.elements[b.id], locked: true }));
    moveElements(store, [b.id], [500, 0]);
    expect(store.doc.elements[b.id].params.pos).toEqual([0, 0]);
    deleteElements(store, [a.id]);
    expect(store.doc.assets['fil-1']).toBeDefined();
    store.transact('lås upp', (tx) => tx.putElement({ ...store.doc.elements[b.id], locked: undefined }));
    deleteElements(store, [b.id]);
    expect(store.doc.assets['fil-1']).toBeUndefined();
    store.undo();
    expect(store.doc.assets['fil-1']).toBeDefined();
  });

  it('kopieras med sin fil till ett annat projekt', () => {
    const from = new DocStore(sampleProject());
    const el = addWithAsset(from, dxfAsset, underlay(dxfParams()), 'st-a', 'Lägg in');
    const clip = copyPayload(from.doc, [el.id], 'pl-1')!;
    expect(clip.assets?.map((x) => x.id)).toEqual(['fil-1']);
    const to = new DocStore(sampleProject());
    const [id] = pasteClip(to, JSON.parse(JSON.stringify(clip)), 'st-a', 'pl-1', [0, 0]);
    expect(to.doc.elements[id].params.asset).toBe('fil-1');
    expect(to.doc.assets['fil-1'].data).toBe(dxfAsset.data);
  });
});

describe('arbetsblad (0.8 del 2)', () => {
  it('det som ritas på ett arbetsblad syns där och inte i planen', () => {
    const store = new DocStore(sampleProject());
    const ws = createWorksheet(store, 'Detaljer');
    const el = addWithAsset(store, dxfAsset, underlay(dxfParams(), { space: ws }), 'st-a', 'Lägg in');
    expect(buildPlan(store.doc, 'pl-1', view).pickables.some((pk) => pk.id === el.id)).toBe(false);
    const sheet = buildPlan(store.doc, 'pl-1', { ...view, place: ws });
    expect(sheet.pickables.map((pk) => pk.id)).toEqual([el.id]);
  });

  it('klistras in på arbetsbladet som visas, och tas bort med sitt innehåll och sina vyer', () => {
    const store = new DocStore(sampleProject());
    const ws = createWorksheet(store, 'Detaljer');
    store.transact('vy', (tx) => tx.setViews([...tx.doc.views, { id: 'vy-ab', name: 'Detalj 1:20', storey: 'pl-1', state: 'st-a', overrides: { compare: false, detail: 'detail', labelDetail: 'detail', modelDetail: 'detail' }, worksheet: ws }]));
    const l = { id: 'l1', type: 'Shape2D', storey: 'pl-1', states: ['st-a'], tags: [], props: {}, params: { shape: 'polyline', points: [[0, 0], [1000, 0]], weight: 0.25, linetype: 'solid' } };
    store.transact('linje', (tx) => tx.putElement(l));
    const [copy] = pasteClip(store, copyPayload(store.doc, ['l1'], 'pl-1')!, 'st-a', 'pl-1', [0, 0], ws);
    expect(store.doc.elements[copy].space).toBe(ws);
    addWithAsset(store, dxfAsset, underlay(dxfParams(), { space: ws }), 'st-a', 'Lägg in');
    deleteWorksheet(store, ws);
    expect(store.doc.worksheets.some((w) => w.id === ws)).toBe(false);
    expect(store.doc.elements[copy]).toBeUndefined();
    expect(store.doc.elements.l1).toBeDefined();
    expect(store.doc.views.some((v) => v.id === 'vy-ab')).toBe(false);
    expect(store.doc.assets['fil-1']).toBeUndefined();
    store.undo();
    expect(store.doc.worksheets.some((w) => w.id === ws)).toBe(true);
    expect(store.doc.elements[copy].space).toBe(ws);
    expect(store.doc.assets['fil-1']).toBeDefined();
  });
});
