import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { mirrorElements } from '../src/core/transforms';
import { scaleElements, transferSettings } from '../src/core/arrange';
import { DocStore } from '../src/core/store';
import { FORMAT_VERSION, type Element } from '../src/core/model';
import { canTrim, splitLine } from '../src/core/trimEdit';
import { capPrims, shapePoints, shapePrims, trimEnds, type Shape2DParams } from '../src/elements/drawing2d';
import { bendShapeEdge, edgeIsArc, insertShapeNode, moveShapeNode, offsetShapeEdge, removeShapeNode, shapeEdgeAt } from '../src/elements/shapeEdit';
import { buildPlan } from '../src/repr/plan';
import { sampleProject } from '../src/sample/sampleProject';
import { parse, serialize } from '../src/storage/format';
import { chainFrom } from '../src/ui/tools/draw2dTool';
import { drawingFields } from '../src/ui/drawingPanel';
import { capFields, shapeSmartFields } from '../src/ui/shapeFields';

beforeAll(() => registerBuiltInTypes());

const base: Shape2DParams = { shape: 'polyline', points: [], weight: 0.25, linetype: 'solid', fillAngle: 45, fillSpacing: 2 };
const shape = (params: Partial<Shape2DParams>) => ({ type: 'Shape2D', params: { ...base, ...params } as unknown as Record<string, unknown> });

function docWith(params: Partial<Shape2DParams>, id = 'form') {
  const doc = sampleProject();
  const storey = doc.storeys[0].id;
  doc.elements[id] = { id, type: 'Shape2D', storey, states: doc.states.map((s) => s.id), tags: [], params: { ...base, ...params }, props: {} } as Element;
  return new DocStore(doc);
}

describe('kedjan (0.8.24, format 13)', () => {
  it('är format 13, och ett projekt i format 12 öppnas inte', () => {
    expect(FORMAT_VERSION).toBe(13);
    const old = JSON.parse(serialize(sampleProject()));
    old.formatVersion = 12;
    expect(() => parse(JSON.stringify(old))).toThrow(/äldre alfaversion/);
  });

  it('rektangel, båge och cirkel ritas som kedjor', () => {
    expect(chainFrom('rect', [[0, 0], [2000, 1000]], false)).toEqual({ shape: 'polyline', points: [[0, 0], [2000, 0], [2000, 1000], [0, 1000]], closed: true });
    // Bågen ritas start, slut och en punkt på bågen.
    const arc = chainFrom('arc', [[0, 0], [2000, 0], [1000, 500]], false);
    expect(arc.points).toEqual([[0, 0], [2000, 0]]);
    expect(arc.bulges![0]).toBeCloseTo(500, 0);
    // Cirkeln: två halvcirklar mellan två punkter på cirkeln.
    const c = chainFrom('circle', [[0, 0], [1000, 0]], false);
    expect(c).toEqual({ shape: 'polyline', points: [[1000, 0], [-1000, 0]], bulges: [1000, 1000], closed: true });
    const pts = shapePoints(c).points;
    for (const q of pts) expect(Math.hypot(q[0], q[1])).toBeCloseTo(1000, 6);
    expect(Math.max(...pts.map((q) => q[1]))).toBeGreaterThan(995);
    expect(Math.min(...pts.map((q) => q[1]))).toBeLessThan(-995);
  });

  it('ett böjt segment går genom bågens topp; de raka är raka', () => {
    const p = { ...base, points: [[0, 0], [2000, 0], [2000, 2000]] as [number, number][], bulges: [-400, 0] };
    const pts = shapePoints(p).points;
    expect(Math.min(...pts.map((q) => q[1]))).toBeCloseTo(-400, 0);
    expect(pts.at(-1)).toEqual([2000, 2000]);
    expect(pts.at(-2)).toEqual([2000, 0]);
  });

  it('en kant böjs med radie och rätas ut; en punkt på bågen hamnar på bågen', () => {
    const s = shape({ points: [[0, 0], [2000, 0], [2000, 1000]] });
    const bent = { ...s, params: { ...s.params, ...bendShapeEdge(s, 0, 1000)! } };
    expect(edgeIsArc(bent, 0)).toBe(true);
    expect(edgeIsArc(bent, 1)).toBe(false);
    // En halvcirkel: punkten på kanten ligger på cirkeln kring (1000, 0).
    const hit = shapeEdgeAt(bent, [1000, 1050], 100)!;
    expect(hit.index).toBe(0);
    const ins = insertShapeNode(bent, 0, [1000, 1200])!;
    const pts = ins.points as [number, number][];
    expect(Math.hypot(pts[1][0] - 1000, pts[1][1])).toBeCloseTo(1000, -1);
    // Delad i två kvartsbågar som tillsammans är samma halvcirkel.
    const split = { ...bent, params: { ...bent.params, ...ins } };
    for (const q of shapePoints(split.params as unknown as Shape2DParams).points.slice(0, -2)) expect(Math.hypot(q[0] - 1000, q[1])).toBeCloseTo(1000, -1);
    expect(bendShapeEdge(bent, 0, 0)).toEqual({ bulges: undefined });
    // En böjd kant förskjuts inte (än); en rak gör det.
    expect(offsetShapeEdge(bent, 0, 100)).toBeNull();
    expect(offsetShapeEdge(bent, 1, 100)).not.toBeNull();
  });

  it('en punkt som tas bort ger ett rakt segment mellan grannarna', () => {
    const s = shape({ points: [[0, 0], [1000, 0], [2000, 0], [3000, 0]], bulges: [200, 300, 0, 0] });
    expect(removeShapeNode(s, 1)).toEqual({ points: [[0, 0], [2000, 0], [3000, 0]], bulges: undefined });
    expect(removeShapeNode(s, 2)).toEqual({ points: [[0, 0], [1000, 0], [3000, 0]], bulges: [200] });
  });

  it('bågen behåller sin vinkel när en ände flyttas', () => {
    const s = shape({ points: [[0, 0], [2000, 0]], bulges: [500] });
    expect(moveShapeNode(s, 1, [4000, 0])).toEqual({ points: [[0, 0], [4000, 0]], bulges: [1000] });
  });

  it('Spegla vänder bågarna, Skala skalar dem; ändarnas storlek är på papperet', () => {
    const store = docWith({ points: [[0, 0], [2000, 0]], bulges: [500], endCap: 'arrow', capSize: 3 });
    mirrorElements(store, ['form'], [0, 0]);
    expect(store.doc.elements.form.params.bulges).toEqual([-500]);
    scaleElements(store, ['form'], [0, 0], 2);
    expect(store.doc.elements.form.params.bulges).toEqual([-1000]);
    expect(store.doc.elements.form.params.capSize).toBe(3);
  });

  it('bågar trimmas och delas inte; raka linjer delas med ändformerna på rätt del', () => {
    const arcs = docWith({ points: [[0, 0], [2000, 0]], bulges: [500] });
    expect(canTrim(arcs.doc.elements.form)).toBe(false);
    const store = docWith({ points: [[0, 0], [2000, 0]], startCap: 'dot', endCap: 'arrow' });
    const r = splitLine(store, 'form', [1000, 0]);
    expect(r.ok).toBe(true);
    const [a, b] = (r as { ids: string[] }).ids.map((id) => store.doc.elements[id].params);
    expect([a.startCap, a.endCap]).toEqual(['dot', undefined]);
    expect([b.startCap, b.endCap]).toEqual([undefined, 'arrow']);
  });

  it('pipetten tar med ändarna men inte bågarna', () => {
    const store = docWith({ points: [[0, 0], [2000, 0]], bulges: [500], endCap: 'open', capSize: 4 }, 'a');
    store.doc.elements.b = { ...structuredClone(store.doc.elements.a), id: 'b', params: { ...base, points: [[0, 1000], [2000, 1000]] } };
    transferSettings(store, 'a', ['b']);
    expect(store.doc.elements.b.params).toMatchObject({ endCap: 'open', capSize: 4 });
    expect(store.doc.elements.b.params.bulges).toBeUndefined();
  });
});

describe('ändformer (0.8.24)', () => {
  const line = { ...base, points: [[0, 0], [10000, 0]] as [number, number][] };

  it('linjen kapas där en ändform täcker den, och den hela finns kvar att klicka på', () => {
    expect(trimEnds([[0, 0], [100, 0], [100, 100]], 50, 30)).toEqual([[50, 0], [100, 0], [100, 70]]);
    const prims = shapePrims({ ...line, endCap: 'arrow', startCap: 'circle' }, { objectId: 'x' }, false, 100);
    const drawn = prims.find((p) => p.origin?.part === 'linje');
    // Pilen 2,5 mm i 1:100 är 250 mm; linjen slutar en bit in i den. Cirkeln har radien 62,5 mm.
    expect(drawn && drawn.kind === 'polyline' && drawn.points.at(-1)![0]).toBeCloseTo(10000 - 225, 6);
    expect(drawn && drawn.kind === 'polyline' && drawn.points[0][0]).toBeCloseTo(62.5, 6);
    expect(prims.some((p) => p.kind === 'polyline' && p.pen.weight === 0 && p.points.length === 2)).toBe(true);
    expect(prims.filter((p) => p.origin?.part === 'ände')).toHaveLength(2);
  });

  it('pekar längs linjen, också i slutet av en båge', () => {
    const tip = capPrims('open', [0, 0], [1, 0], 100, { weight: 0.25 }, undefined).prims[0];
    expect(tip.kind === 'polyline' && tip.points.every((q) => q[0] <= 0)).toBe(true);
    // Bågen från (0,0) till (2000,0) som buktar uppåt slutar på väg nedåt.
    const prims = shapePrims({ ...base, points: [[0, 0], [2000, 0]], bulges: [1000], endCap: 'open' }, undefined, false, 100);
    const head = prims.find((p) => p.kind === 'polyline' && p.points.length === 3)!;
    expect(head.kind === 'polyline' && head.points.every((q) => q[1] >= -1)).toBe(true);
  });

  it('alla former ger något; slutna former och former utan linje får inga ändar', () => {
    for (const k of ['arrow', 'open', 'triangle', 'dot', 'circle', 'tick', 'bar'] as const) expect(capPrims(k, [0, 0], [1, 0], 100, { weight: 0.25 }, '#ff0000').prims.length, k).toBe(1);
    const sq = { ...base, points: [[0, 0], [1000, 0], [1000, 1000]] as [number, number][], startCap: 'arrow' as const };
    expect(shapePrims({ ...sq, closed: true }).some((p) => p.origin?.part === 'ände')).toBe(false);
    expect(shapePrims({ ...sq, weight: 0 }, { objectId: 'x' }).some((p) => p.origin?.part === 'ände')).toBe(false);
  });

  it('ritas i planen i ritningens skala', () => {
    const store = docWith({ points: [[20000, 20000], [25000, 20000]], endCap: 'dot' });
    const doc = store.doc;
    const view = { state: doc.states[doc.states.length - 1].id, compareTo: doc.states[0].id };
    const pk = buildPlan(doc, doc.storeys[0].id, view).pickables.find((p) => p.id === 'form')!;
    const dot = pk.prims.find((p) => p.kind === 'region' && p.origin?.part === 'ände');
    expect(dot).toBeTruthy();
  });

  it('väljs i egenskaperna och i smartmenyn', () => {
    const store = docWith({ points: [[0, 0], [2000, 0]], endCap: 'arrow' });
    const html = drawingFields(store.doc, store.doc.elements.form);
    expect(html).toContain('data-key="d2:startCap"');
    expect(html).toContain('Storlek på papper');
    expect(shapeSmartFields(store.doc, [store.doc.elements.form])).toContain('d2:endCap');
    expect(capFields({ startCap: null, endCap: 'dot' }, (k) => `data-key="${k}"`)).toContain('Olika');
  });
});
