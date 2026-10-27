import { beforeAll, describe, expect, it } from 'vitest';
import { fuseLines } from '../src/core/joinLines';
import { DocStore } from '../src/core/store';
import { registerBuiltInTypes } from '../src/elements';
import type { Shape2DParams } from '../src/elements/drawing2d';
import type { RoofParams } from '../src/elements/roof';
import { edgeRun, holeShape, holesOf, offsetShapeEdges } from '../src/elements/shapeEdit';
import type { SlabHole } from '../src/elements/slab';
import { arcFromBulge } from '../src/geometry/arc';
import { sampleProject } from '../src/sample/sampleProject';
import { Modifier } from '../src/ui/modify/controller';
import { modifyContextAt, opsFor, type ModifyHost } from '../src/ui/modify/ops';
import { ModifyTool } from '../src/ui/modify/tool';
import { ChainInput } from '../src/ui/tools/chainInput';
import { RoofTool } from '../src/ui/tools/roofTool';
import { SlabTool } from '../src/ui/tools/slabTool';
import type { ViewPointer } from '../src/view2d/planView';
import { square, storeWithShapes, toolHost } from './projekt';

beforeAll(() => registerBuiltInTypes());

const at = (model: [number, number]) => ({ model, pointerType: 'mouse' }) as unknown as ViewPointer;
const rect = { type: 'Shape2D', params: { shape: 'polyline', points: square(0, 0, 2000), closed: true } };

describe('Förskjut flera kanter (0.10.17)', () => {
  it('väljer kanter symmetriskt kring den klickade, runt en sluten form och till ändarna i en öppen', () => {
    expect(edgeRun(rect, 0, 3)).toEqual([0, 1, 3]);
    expect(edgeRun(rect, 2, 1)).toEqual([2]);
    expect(edgeRun(rect, 2, 0)).toEqual([0, 1, 2, 3]);
    const open = { type: 'Shape2D', params: { shape: 'polyline', points: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]], closed: false } };
    expect(edgeRun(open, 0, 3)).toEqual([0, 1]);
    expect(edgeRun(open, 2, 3)).toEqual([1, 2, 3]);
  });

  it('alla kanter ger en större rektangel, och utåt för en moturs rektangel är åt höger', () => {
    // square går moturs, så vänster är inåt: −100 är utåt.
    expect(offsetShapeEdges(rect, edgeRun(rect, 0, 0), -100)!.points).toEqual([[-100, -100], [2100, -100], [2100, 2100], [-100, 2100]]);
    expect(offsetShapeEdges(rect, edgeRun(rect, 0, 0), 100)!.points).toEqual([[100, 100], [1900, 100], [1900, 1900], [100, 1900]]);
    // Tre kanter: den motsatta ligger kvar.
    expect(offsetShapeEdges(rect, edgeRun(rect, 0, 3), -100)!.points).toEqual([[-100, -100], [2100, -100], [2100, 2000], [-100, 2000]]);
    // För långt inåt vänder formen.
    expect(offsetShapeEdges(rect, edgeRun(rect, 0, 0), 1200)).toBeNull();
  });

  it('en cirkel blir en större cirkel med samma centrum', () => {
    const circle = holeShape({ points: [[1000, 0], [-1000, 0]], bulges: [1000, 1000] });
    // Cirkeln går medurs, så vänster är utåt.
    const r = offsetShapeEdges(circle, edgeRun(circle, 0, 0), 200)!;
    const pts = r.points as [number, number][];
    const arc = arcFromBulge(pts[0], pts[1], (r.bulges as number[])[0])!;
    expect(arc.radius).toBeCloseTo(1200, 0);
    expect(arc.center[0]).toBeCloseTo(0, 0);
  });

  it('Modifiera förskjuter tre kanter i ett 2D-element med valet Kanter', () => {
    const store = storeWithShapes({ r: { points: square(50000, 0, 2000), closed: true } });
    const host = toolHost(store, ['r']);
    const edge = modifyContextAt(host, at([51000, 0]), 0, 0, null)!;
    const t = new ModifyTool(host, 'shapeOffset', edge, 100, () => {});
    t.edges = 3;
    t.takePoint([51000, -100]);
    expect((store.doc.elements.r.params as unknown as Shape2DParams).points).toEqual([[49900, -100], [52100, -100], [52100, 2000], [49900, 2000]]);
  });
});

describe('Foga ihop linjer (0.10.17)', () => {
  it('fogar linjer som delar ändar till en, vänder dem som behövs och sluter en ring', () => {
    const store = storeWithShapes({
      a: { points: [[0, 0], [1000, 0]], startCap: 'arrow' },
      b: { points: [[1000, 1000], [1000, 0]], bulges: [200] },
      c: { points: [[1000, 1000], [0, 1000]] },
      x: { points: [[5000, 5000], [6000, 5000]] },
    });
    expect(fuseLines(store, ['a', 'b', 'c', 'x'])).toEqual(['a']);
    const p = store.doc.elements.a.params as unknown as Shape2DParams;
    expect(p.points).toEqual([[0, 0], [1000, 0], [1000, 1000], [0, 1000]]);
    // b vändes: pilhöjden byter tecken.
    expect(p.bulges).toEqual([0, -200]);
    expect(p.startCap).toBe('arrow');
    expect(store.doc.elements.b).toBeUndefined();
    expect(store.doc.elements.x).toBeDefined();
    // Den fjärde linjen sluter rektangeln.
    const s2 = storeWithShapes({ a: { points: [[0, 0], [1000, 0], [1000, 1000]] }, d: { points: [[1000, 1000], [0, 1000], [0, 0]] } });
    fuseLines(s2, ['a', 'd']);
    const q = s2.doc.elements.a.params as unknown as Shape2DParams;
    expect(q.closed).toBe(true);
    expect(q.points).toHaveLength(4);
    expect(fuseLines(storeWithShapes({ a: { points: [[0, 0], [1, 0]] }, b: { points: [[5, 5], [9, 9]] } }), ['a', 'b'])).toBeNull();
  });
});

describe('Konturer med bågar direkt (0.10.17)', () => {
  it('Båge: slutet och en punkt på bågen, och ett klick på början med Båge sluter med en båge', () => {
    const c = new ChainInput();
    c.click([0, 0], 10);
    c.click([2000, 0], 10);
    c.arc = true;
    expect(c.click([2000, 2000], 10)).toBe('wait');
    expect(c.click([2500, 1000], 10)).toBe('added');
    c.arc = false;
    c.click([0, 2000], 10);
    expect(c.click([0, 0], 10)).toBe('closed');
    expect(c.result()).toEqual({ points: [[0, 0], [2000, 0], [2000, 2000], [0, 2000]], bulges: [0, -500, 0, 0] });
    const d = new ChainInput();
    d.click([0, 0], 10);
    d.click([2000, 0], 10);
    d.arc = true;
    expect(d.canClose).toBe(true);
    expect(d.click([0, 0], 10)).toBe('wait');
    expect(d.click([1000, 1000], 10)).toBe('closed');
    expect(d.result().bulges).toEqual([0, -1000]);
  });

  it('takfallets kontur får bågarna, vända när konturen ritats medurs', () => {
    const s = new DocStore(sampleProject());
    const tool = new RoofTool(toolHost(s));
    tool.options.mode = 'face';
    for (const q of [[0, 0], [0, 4000], [6000, 4000]] as [number, number][]) tool.takePoint(q);
    tool.setArc(true);
    tool.takePoint([6000, 0]);
    tool.takePoint([6500, 2000]);
    tool.setArc(false);
    tool.takePoint([0, 0]);
    tool.takePoint([0, 0]);
    tool.takePoint([6000, 0]);
    tool.takePoint([3000, 2000]);
    const roof = Object.values(s.doc.elements).find((e) => e.type === 'Roof' && !['tak', 'tak-n'].includes(e.id))!;
    const p = roof.params as unknown as RoofParams;
    expect(p.outline).toEqual([[6000, 0], [6000, 4000], [0, 4000], [0, 0]]);
    // Bågen gick från (6000, 4000) till (6000, 0) med pilhöjden +500 (åt vänster); vänd blir den kant 0 med −500.
    expect(p.bulges).toEqual([-500, 0, 0, 0]);
  });

  it('bjälklagets håltagning som en cirkel och som en polygon med en båge', () => {
    const s = new DocStore(sampleProject());
    const tool = new SlabTool(toolHost(s), null);
    tool.options.mode = 'hole';
    tool.options.shape = 'circle';
    tool.takePoint([6000, 5000]);
    tool.takePoint([6500, 5000]);
    const holes = () => holesOf(s.doc.elements['bj1']);
    expect(holes().at(-1)).toEqual({ points: [[6500, 5000], [5500, 5000]], bulges: [500, 500] });
    tool.options.shape = 'polygon';
    for (const q of [[6000, 5000], [7000, 5000]] as [number, number][]) tool.takePoint(q);
    tool.setArc(true);
    tool.takePoint([6000, 5000]);
    tool.takePoint([6500, 5500]);
    expect(holes()).toHaveLength(2);
    expect((holes().at(-1) as SlabHole).bulges).toEqual([0, -500]);
  });
});

describe('Håltagningen för sig (0.10.17)', () => {
  const withHole = () => {
    const doc = sampleProject();
    doc.elements['bj1'] = { ...doc.elements['bj1'], params: { ...doc.elements['bj1'].params, holes: [{ points: [[6000, 5000], [7000, 5000], [7000, 6000], [6000, 6000]], bulges: [0, 300] }] } };
    return new DocStore(doc);
  };

  it('vrids och speglas utan att bjälklaget ändras, och Flytta i raden gäller hålet', () => {
    const s = withHole();
    const host = toolHost(s, ['bj1']);
    const before = s.doc.elements['bj1'].params.outline;
    const corner = modifyContextAt(host, at([6000, 5000]), 0, 0, null)!;
    expect(opsFor(host, corner).flat()).toEqual(expect.arrayContaining(['holeMove', 'holeRotate', 'holeMirror', 'holeRemove']));
    new ModifyTool(host, 'holeRotate', corner, 90, () => {}).applyValue(90);
    const h = holesOf(s.doc.elements['bj1'])[0];
    expect(h.points).toEqual([[6000, 5000], [6000, 6000], [5000, 6000], [5000, 5000]]);
    const m = new ModifyTool(host, 'holeMirror', corner, 0, () => {});
    m.takePoint([6000, 7000]);
    const g = holesOf(s.doc.elements['bj1'])[0];
    expect(g.points[2]).toEqual([7000, 6000]);
    expect(g.bulges).toEqual([0, -300]);
    expect(s.doc.elements['bj1'].params.outline).toEqual(before);

    const mh = { ...host, startModify: () => {}, endModify: () => {} } as unknown as ModifyHost;
    const mod = new Modifier(mh);
    mod.setSelection({ kind: 'body', ids: ['bj1'], at: [0, 0], clientX: 0, clientY: 0 });
    mod.setPart(corner);
    mod.chooseRail('move');
    expect(mod.active).toBe('holeMove');
  });

  it('ett klick mitt på en kant startar det som senast användes på en kant', () => {
    const s = withHole();
    const host = { ...toolHost(s, ['bj1']), startModify: () => {}, endModify: () => {} } as unknown as ModifyHost;
    const mod = new Modifier(host);
    const edge = modifyContextAt(host, at([6500, 5000]), 0, 0, null)!;
    mod.setSelection({ kind: 'body', ids: ['bj1'], at: [0, 0], clientX: 0, clientY: 0 });
    mod.setPart(edge);
    expect(mod.active).toBeNull();
    mod.choose('shapeInsert');
    mod.cancel();
    mod.setPart(edge);
    expect(mod.active).toBe('shapeInsert');
  });
});
