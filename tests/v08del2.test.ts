import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import type { RoofParams } from '../src/elements/roof';
import { dragRoofGrip, roofGripsInView, slopeForRidge } from '../src/elements/roofGrips';
import { buildSection } from '../src/repr/section';
import { parseDxf } from '../src/formats/dxf';
import { addWithAsset, deleteElements, moveElements } from '../src/core/commands';
import { copyPayload, pasteClip } from '../src/core/clipboard';
import { DocStore } from '../src/core/store';
import { createWorksheet, deleteWorksheet } from '../src/core/treeCommands';
import { underlayCorners, underlayInverse, underlayTransform, type UnderlayParams } from '../src/elements/underlay';
import { buildPlan } from '../src/repr/plan';
import { parse, serialize } from '../src/storage/format';
import { insertShapeNode, moveShapeNode, offsetShapeEdge, rectWithCorner, removeShapeNode, shapeEdgeAt } from '../src/elements/shapeEdit';
import { sampleProject } from '../src/sample/sampleProject';

beforeAll(() => registerBuiltInTypes());

const view = { state: 'st-a', compareTo: 'st-bef', detail: 'normal' as const };

describe('grepp för taket i fasader och sektioner (0.8 del 2)', () => {
  it('från gaveln: ett grepp i nocken och ett i varje takfot, på takets linjer', () => {
    const doc = sampleProject();
    const grips = roofGripsInView(doc, 'fasad-2', ['tak']);
    expect(grips.filter((g) => g.kind === 'ridge')).toHaveLength(1);
    expect(grips.filter((g) => g.kind === 'eave')).toHaveLength(2);
    const p = doc.elements.tak.params as unknown as RoofParams;
    for (const g of grips.filter((x) => x.kind === 'eave')) expect(g.at[1]).toBe(p.eave);
    // Nocken är takets högsta punkt i fasaden.
    const s = buildSection(doc, 'fasad-2', view)!;
    const ys = s.prims.flatMap((q) => (q.kind === 'line' && q.origin?.objectId === 'tak' ? [q.a[1], q.b[1]] : []));
    expect(Math.abs(grips.find((g) => g.kind === 'ridge')!.at[1] - Math.max(...ys))).toBeLessThan(2);
  });

  it('från långsidan ligger takfötterna på varandra: ett grepp räcker', () => {
    const grips = roofGripsInView(sampleProject(), 'fasad-1', ['tak']);
    expect(grips.filter((g) => g.kind === 'eave')).toHaveLength(1);
  });

  it('nocken uppåt ger brantare tak i hela grader, och takfoten ligger kvar', () => {
    const doc = sampleProject();
    const ridge = roofGripsInView(doc, 'fasad-2', ['tak']).find((g) => g.kind === 'ridge')!;
    const r = dragRoofGrip(doc, 'fasad-2', ridge, [ridge.at[0], ridge.at[1] + 600])!;
    const p = doc.elements.tak.params as unknown as RoofParams;
    expect(r.params.slope).toBeGreaterThan(p.slope);
    expect(Number.isInteger(r.params.slope)).toBe(true);
    expect(r.params.eave).toBe(p.eave);
    expect(r.text).toContain('Lutning');
    // Fritt (Alt): en decimal.
    const free = dragRoofGrip(doc, 'fasad-2', ridge, [ridge.at[0], ridge.at[1] + 613], { free: true })!;
    expect(free.params.slope).not.toBe(r.params.slope);
  });

  it('lutningen räknas tillbaka ur nockens höjd', () => {
    const top = 2450 + Math.tan((30 * Math.PI) / 180) * 4000 + 300 / Math.cos((30 * Math.PI) / 180);
    expect(slopeForRidge(2450, 4000, 300, top)).toBeCloseTo(30, 3);
  });

  it('takfoten uppåt höjer hela taket med samma lutning; med Shift står nocken still', () => {
    const doc = sampleProject();
    const eave = roofGripsInView(doc, 'fasad-2', ['tak']).find((g) => g.kind === 'eave')!;
    const p = doc.elements.tak.params as unknown as RoofParams;
    const up = dragRoofGrip(doc, 'fasad-2', eave, [eave.at[0], eave.at[1] + 200])!;
    expect(up.params.eave).toBe(p.eave + 200);
    expect(up.params.slope).toBe(p.slope);
    expect(up.params.outline).toEqual(p.outline);
    const keep = dragRoofGrip(doc, 'fasad-2', eave, [eave.at[0], eave.at[1] + 200], { keepRidge: true })!;
    expect(keep.params.eave).toBe(p.eave + 200);
    expect(keep.params.slope).toBeLessThan(p.slope);
  });

  it('takfoten åt sidan ändrar taksprånget lika på båda sidor, längs takfallet', () => {
    const doc = sampleProject();
    const p = doc.elements.tak.params as unknown as RoofParams;
    const grips = roofGripsInView(doc, 'fasad-2', ['tak']).filter((g) => g.kind === 'eave');
    // Greppet längst till höger, dras 300 mm utåt (åt höger).
    const right = grips.reduce((a, g) => (g.at[0] > a.at[0] ? g : a));
    const r = dragRoofGrip(doc, 'fasad-2', right, [right.at[0] + 300, right.at[1]])!;
    const ys = (o: [number, number][]) => o.map((q) => q[1]);
    const span = (o: [number, number][]) => Math.max(...ys(o)) - Math.min(...ys(o));
    expect(span(r.params.outline)).toBe(span(p.outline) + 600);
    // Takfallet ligger kvar: takfoten sänks med lutningen.
    expect(r.params.eave).toBe(Math.round(p.eave - Math.tan((p.slope * Math.PI) / 180) * 300));
    expect(r.params.slope).toBe(p.slope);
    expect(r.text).toContain('Taksprång');
  });
});

const shape = (params: Record<string, unknown>, type = 'Line2D') => ({ type, params: { weight: 0.25, linetype: 'solid', ...params } });

describe('punkter i 2D-element (0.8 del 2)', () => {
  it('en punkt i en polylinje flyttas; de andra ligger kvar', () => {
    const s = shape({ shape: 'polyline', points: [[0, 0], [1000, 0], [1000, 1000]] });
    expect(moveShapeNode(s, 1, [1200, 50]).points).toEqual([[0, 0], [1200, 50], [1000, 1000]]);
  });
  it('en rektangel förblir rät när ett hörn dras, och det motstående hörnet står still', () => {
    const r = rectWithCorner([[0, 0], [2000, 0], [2000, 1000], [0, 1000]], 2, [2500, 1500])!;
    expect(r).toEqual([[0, 0], [2500, 0], [2500, 1500], [0, 1500]]);
    // Snedställd 45°: sidorna behåller sina riktningar.
    const c = Math.SQRT1_2;
    const sq: [number, number][] = [[0, 0], [1000 * c, 1000 * c], [0, 2000 * c], [-1000 * c, 1000 * c]];
    const t = rectWithCorner(sq, 2, [0, 3000])!;
    const d = (a: number[], b: number[]) => [b[0] - a[0], b[1] - a[1]];
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1];
    expect(Math.abs(dot(d(t[0], t[1]), d(t[1], t[2])))).toBeLessThan(2000);
    expect(t[0]).toEqual([0, 0]);
  });
  it('cirkelns centrum flyttar hela cirkeln; radiepunkten ändrar radien', () => {
    const s = shape({ shape: 'circle', points: [[0, 0], [500, 0]] });
    expect(moveShapeNode(s, 0, [100, 100]).points).toEqual([[100, 100], [600, 100]]);
    expect(moveShapeNode(s, 1, [0, 800]).points).toEqual([[0, 0], [0, 800]]);
  });
  it('lägg till och ta bort punkt; en linje blir polylinje, en rektangel sluten polylinje', () => {
    const l = shape({ shape: 'line', points: [[0, 0], [1000, 0]] });
    const hit = shapeEdgeAt(l, [400, 20], 50)!;
    expect(hit.index).toBe(0);
    const ins = insertShapeNode(l, hit.index, [400, 300])!;
    expect(ins).toEqual({ shape: 'polyline', points: [[0, 0], [400, 300], [1000, 0]], closed: false });
    expect(removeShapeNode(l, 0)).toBeNull();
    const rect = shape({ shape: 'rect', points: [[0, 0], [1000, 0], [1000, 500], [0, 500]] });
    expect(removeShapeNode(rect, 2)).toEqual({ shape: 'polyline', points: [[0, 0], [1000, 0], [0, 500]], closed: true });
    const fill = shape({ points: [[0, 0], [1000, 0], [0, 500]], pattern: 'solid' }, 'Fill2D');
    expect(removeShapeNode(fill, 0)).toBeNull();
    // Kanten från sista punkten tillbaka till den första i en sluten form.
    expect(shapeEdgeAt(rect, [0, 250], 20)!.index).toBe(3);
  });
  it('förskjut en kant: i en rektangel följer grannkanterna med, i en öppen polylinje flyttas änden rakt ut', () => {
    const rect = shape({ shape: 'rect', points: [[0, 0], [1000, 0], [1000, 500], [0, 500]] });
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

/** En liten DXF: rubrik, ett block och entiteter. */
function dxf(entities: string, blocks = '', units = 4): string {
  const pairs = (s: string) => s.trim().split(/\n/).map((l) => l.trim()).join('\n');
  return pairs(`0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n${units}\n0\nENDSEC\n0\nSECTION\n2\nBLOCKS\n${blocks}0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF`);
}

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

  it('läggs in med sin fil i ett steg, ritas i planen och följer med när filen sparas', () => {
    const store = new DocStore(sampleProject());
    const el = addWithAsset(store, dxfAsset, underlay(dxfParams()), 'st-a', 'Lägg in');
    expect(store.doc.assets['fil-1'].name).toBe('grannhus.dxf');
    const plan = buildPlan(store.doc, 'pl-1', view);
    const mine = plan.pickables.find((pk) => pk.id === el.id)!;
    expect(mine.prims.filter((q) => q.kind === 'polyline')).toHaveLength(2);
    // I alla tillstånd: underlaget hör till ritningen.
    expect(buildPlan(store.doc, 'pl-1', { state: 'st-bef', detail: 'normal' }).pickables.some((pk) => pk.id === el.id)).toBe(true);
    const back = parse(serialize(store.doc));
    expect(back.assets['fil-1'].data).toBe(dxfAsset.data);
    expect(back.elements[el.id].params).toEqual(store.doc.elements[el.id].params);
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
    store.transact('vy', (tx) => tx.setViews([...tx.doc.views, { id: 'vy-ab', name: 'Detalj 1:20', storey: 'pl-1', state: 'st-a', compare: false, detail: 'detail', hide: [], hideDemolished: false, worksheet: ws }]));
    const l = { id: 'l1', type: 'Line2D', storey: 'pl-1', states: ['st-a'], tags: [], props: {}, params: { shape: 'line', points: [[0, 0], [1000, 0]], weight: 0.25, linetype: 'solid' } };
    store.transact('linje', (tx) => tx.putElement(l));
    const [copy] = pasteClip(store, copyPayload(store.doc, ['l1'], 'pl-1')!, 'st-a', 'pl-1', [0, 0], ws);
    expect(store.doc.elements[copy].space).toBe(ws);
    addWithAsset(store, dxfAsset, underlay(dxfParams(), { space: ws }), 'st-a', 'Lägg in');
    deleteWorksheet(store, ws);
    expect(store.doc.worksheets).toHaveLength(0);
    expect(store.doc.elements[copy]).toBeUndefined();
    expect(store.doc.elements.l1).toBeDefined();
    expect(store.doc.views.some((v) => v.id === 'vy-ab')).toBe(false);
    expect(store.doc.assets['fil-1']).toBeUndefined();
    store.undo();
    expect(store.doc.worksheets).toHaveLength(1);
    expect(store.doc.elements[copy].space).toBe(ws);
    expect(store.doc.assets['fil-1']).toBeDefined();
  });
});
