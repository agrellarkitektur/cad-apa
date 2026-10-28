import { beforeAll, describe, expect, it } from 'vitest';
import { updateParams } from '../src/core/commands';
import { canFuse, fuseLines } from '../src/core/joinLines';
import { GROUND_DEFAULTS, groundAt } from '../src/core/site';
import { mirrorElements } from '../src/core/transforms';
import { registerBuiltInTypes } from '../src/elements';
import { finishedTerrain, groundGeometry, groundType, type GroundParams } from '../src/elements/ground';
import { flatLine, lineLength, offsetArcLine } from '../src/elements/groundLines';
import { extendRamp, fusedRamp, rampLevels, rampProfile, rampRuns, rampSideLines, rampSides, remapLevels, reversedRamp } from '../src/elements/groundRamp';
import { bendShapeEdge, roundShapeCorner, shapeCan, shapeOf, shapePatch, subShapes } from '../src/elements/shapeEdit';
import { modifyContextAt, opsFor } from '../src/ui/modify/ops';
import { setRampEase } from '../src/ui/modify/rampOps';
import { applyGroundField } from '../src/ui/groundFieldEdits';
import { GroundTool } from '../src/ui/tools/groundTool';
import type { ViewPointer } from '../src/view2d/planView';
import { buildPlan } from '../src/repr/plan';
import { addGround, onSlope, planCtx, toolHost } from './projekt';
import { DocStore } from '../src/core/store';

/**
 * Markobjektens bågar (0.10.19): bågar på referenslinjen, sidorna och
 * stödmurens och brytlinjens linjer; mjuka övergångar i höjd; dockade ramper.
 * Den sneda marken (`onSlope`): marken ligger x/10 mm över ±0.
 */

beforeAll(() => registerBuiltInTypes());

const finished = (store: DocStore) => finishedTerrain(planCtx(store))!.terrain;
const params = (store: DocStore, id: string) => store.doc.elements[id].params as unknown as GroundParams;
const at = (model: [number, number]) => ({ model, pointerType: 'mouse' }) as unknown as ViewPointer;

function host(store: DocStore, selected: string[] = []) {
  const h = toolHost(store, selected);
  const list = h.selection.list.bind(h.selection);
  return { ...h, selection: { ...h.selection, list, has: (id: string) => list().includes(id) } as never, plan: () => buildPlan(store.doc, store.doc.storeys[0].id, { state: 'st-a' }) };
}

describe('Linjer med bågar (0.10.19)', () => {
  it('plattas ut till korta raka bitar, med de ritade punkterna på sina platser', () => {
    // En halvcirkel med radien 5 m: pilhöjden är radien.
    const { points, at: idx } = flatLine([[0, 0], [10000, 0], [20000, 0]], [5000]);
    expect(idx).toEqual([0, points.length - 2, points.length - 1]);
    expect(points[idx[1]]).toEqual([10000, 0]);
    expect(lineLength(points)).toBeCloseTo(Math.PI * 5000 + 10000, -1);
    // Toppen av bågen ligger 5 m åt vänster (+y).
    expect(Math.max(...points.map((q) => q[1]))).toBeCloseTo(5000, -1);
    expect(flatLine([[0, 0], [1000, 0]]).points).toEqual([[0, 0], [1000, 0]]);
  });

  it('förskjuts koncentriskt: bågen behåller sin vinkel och får en större eller mindre radie', () => {
    const off = offsetArcLine([[0, 0], [10000, 0]], [5000], -1000);
    // Åt höger sett i bågens riktning är mot centrum: radien 4 m, kordan 8 m, pilhöjden 4 m.
    expect(off.points.map((q) => q.map((v) => Math.round(v) || 0))).toEqual([[1000, 0], [9000, 0]]);
    expect(off.bulges?.[0]).toBeCloseTo(4000, 0);
    expect(offsetArcLine([[0, 0], [10000, 0]], undefined, 500).bulges).toBeUndefined();
  });

  it('referenslinjen, stödmuren och brytlinjen kan böjas och avrundas i Modifiera', () => {
    const store = onSlope();
    for (const kind of ['path', 'wall', 'breakline'] as const) {
      const id = addGround(store, { kind, outline: [], line: [[20000, 0], [26000, 0], [26000, 6000]], height: 2000, endHeight: 2000 });
      const s = shapeOf(store.doc.elements[id])!;
      expect(shapeCan(s).bend).toBe(true);
      const bent = shapePatch(store.doc, id, undefined, bendShapeEdge(s, 0, 1000)!);
      expect(bent).toEqual({ bulges: [1000] });
      const rounded = shapePatch(store.doc, id, undefined, roundShapeCorner(s, 1, 2000, 'fillet')!);
      expect((rounded.line as number[][]).length).toBe(4);
      // Hörnet svänger åt vänster: bågen buktar åt höger om kordan.
      expect((rounded.bulges as number[])[1]).toBeLessThan(0);
    }
  });

  it('räknas mot marken längs bågen: höjden följer sträckan längs kurvan', () => {
    const store = onSlope();
    // En halvcirkel på 20 000 ± 5 000 med höjden 2 000 i början och 2 000 + π·5 000/12 i slutet: 1:12 längs bågen.
    const rise = Math.round((Math.PI * 5000) / 12);
    const id = addGround(store, { kind: 'path', outline: [], line: [[15000, 0], [25000, 0]], bulges: [5000], width: 2000, height: 2000, endHeight: 2000 + rise });
    const p = params(store, id);
    expect(rampRuns(rampLevels(p))[0].ratio).toBeCloseTo(12, 0);
    // Toppen av bågen, halvvägs: halva höjdskillnaden.
    expect(groundAt(finished(store), 20000, 5000)).toBeCloseTo(2000 + rise / 2, -1);
    // Sidorna följer med koncentriskt och ritas som bågar i planen.
    const sides = rampSideLines(p);
    // Vänster är utåt från centrum: större radie.
    expect(sides.left.bulges?.[0]).toBeCloseTo(6000, 0);
    expect(sides.right.bulges?.[0]).toBeCloseTo(4000, 0);
    expect(rampSides(p).left.length).toBeGreaterThan(10);
    const g = groundGeometry(planCtx(store), store.doc.elements[id])!;
    expect(g.rings[0][0].length).toBeGreaterThan(20);
  });

  it('en båge på en sida ändrar bara bredden; sidan blir ritad med sin båge', () => {
    const store = onSlope();
    const id = addGround(store, { kind: 'path', outline: [], line: [[20000, 0], [26000, 0]], width: 2000, height: 2000, endHeight: 2500 });
    const side = subShapes(store.doc.elements[id])[1].shape;
    updateParams(store, [id], shapePatch(store.doc, id, 1, bendShapeEdge(side, 0, -500)!), 'Prov');
    expect(params(store, id)).toMatchObject({ right: [[20000, -1000], [26000, -1000]], rightBulges: [-500] });
    // Höjden tas som förut från referenslinjen; punkten ligger på rampen tack vare bågen (utan den i slänten, ca 2 450).
    expect(groundAt(finished(store), 23000, -1000)).toBeCloseTo(2250, -1);
    expect(groundAt(finished(store), 23000, -1400)!).toBeLessThan(2300);
    expect(rampSides(params(store, id)).right.length).toBeGreaterThan(2);
    // Speglat buktar bågen åt andra hållet och byter sida.
    mirrorElements(store, [id], [23000, 0]);
    expect(params(store, id)).toMatchObject({ left: [[26000, -1000], [20000, -1000]], leftBulges: [500] });
  });

  it('höjden i ett avrundat hörn flyttar till den nya punkten; en borttagen punkt ger inget till grannarna', () => {
    const before: [number, number][] = [[0, 0], [6000, 0], [6000, 6000]];
    expect(remapLevels(before, [[0, 0], [5000, 0], [6000, 1000], [6000, 6000]], [null, 500])).toEqual([null, 500]);
    expect(remapLevels([[0, 0], [3000, 0], [6000, 0], [6000, 6000]], before, [null, 500])).toBeUndefined();
  });

  it('förlängs med bågar: den nya biten behåller sin båge, också i början', () => {
    const p: GroundParams = { kind: 'path', outline: [], line: [[0, 0], [6000, 0]], height: 0, endHeight: 500 };
    const end = extendRamp(p, false, [[12000, 0]], [1000]);
    expect(end.bulges).toEqual([0, 1000]);
    const start = extendRamp(p, true, [[-6000, 0]], [1000]);
    expect(start.line).toEqual([[-6000, 0], [0, 0], [6000, 0]]);
    // Baklänges buktar den åt andra hållet.
    expect(start.bulges).toEqual([-1000]);
    // Längden längs bågen ger höjden (lutningen 1:12 fortsätter).
    expect(end.endHeight).toBeGreaterThan(1000);
  });

  it('verktyget Mark ritar bågar direkt med Båge', () => {
    const store = onSlope();
    const tool = new GroundTool(host(store));
    tool.options.mode = 'wall';
    tool.takePoint([20000, 10000]);
    tool.setArc(true);
    tool.takePoint([26000, 10000]);
    tool.takePoint([23000, 12000]);
    tool.setArc(false);
    tool.takePoint([26000, 16000]);
    tool.finish();
    const el = Object.values(store.doc.elements).find((e) => e.type === 'Ground')!;
    expect(el.params).toMatchObject({ kind: 'wall', line: [[20000, 10000], [26000, 10000], [26000, 16000]], bulges: [2000] });
  });
});

describe('Mjuka övergångar (0.10.19)', () => {
  const ramp = (over: Partial<GroundParams> = {}): GroundParams => ({ kind: 'path', outline: [], line: [[0, 0], [12000, 0]], height: 0, endHeight: 1000, ...over });

  it('är skarpa från början: samma profil som förut', () => {
    const prof = rampProfile(ramp());
    expect(prof.hAt(6000)).toBe(500);
    expect(prof.runs[0]).toMatchObject({ ratio: 12, la: 0, lb: 0 });
  });

  it('i ändarna börjar och slutar rampen plant, och den raka delen blir brantare', () => {
    const prof = rampProfile(ramp({ ease: true, easeRadius: 20000 }));
    const run = prof.runs[0];
    // h = g·S − g²·R: g = (12 − √(144 − 2·2·0,04·...)) …; kontrollera egenskaperna i stället för talet.
    expect(run.ratio).toBeLessThan(12);
    expect(run.la).toBeCloseTo(20000 * run.grade, 3);
    expect(run.lb).toBeCloseTo(20000 * run.grade, 3);
    // Plant i ändarna: nästan ingen höjdskillnad de första 10 mm.
    expect(prof.hAt(10)).toBeLessThan(0.1);
    expect(1000 - prof.hAt(11990)).toBeLessThan(0.1);
    // Rätt i ändarna och sammanhängande mitt i.
    expect(prof.hAt(0)).toBe(0);
    expect(prof.hAt(12000)).toBe(1000);
    expect(prof.hAt(run.la + 1) - prof.hAt(run.la - 1)).toBeCloseTo(2 * run.grade, 1);
    expect(prof.hAt(6000)).toBeCloseTo(500, 0);
    // En radie som inte ryms kortas: profilen går ändå genom ändarna.
    const tight = rampProfile(ramp({ ease: true, easeRadius: 500000 }));
    expect(tight.hAt(12000)).toBe(1000);
    expect(tight.runs[0].la + tight.runs[0].lb).toBeLessThanOrEqual(12000);
  });

  it('i en punkt däremellan ersätter kurvan brytningen, lika långt åt båda håll', () => {
    // 1:12 upp i 6 m, sedan plant: en konkav övergång med radien 20 m, längden 20·(1/12) ≈ 1,67 m.
    const p = ramp({ line: [[0, 0], [6000, 0], [12000, 0]], levels: [null, 500], endHeight: 500, ease: true, easeRadius: 20000 });
    const prof = rampProfile(p);
    // Med mjuk början är den raka delen 1:10 (g = (6 − √(36 − 2·20·0,5))/20), så kurvan är 20 000 · 0,1.
    expect(prof.runs[0].grade).toBeCloseTo(0.1, 6);
    expect(prof.curves[1]).toBeCloseTo(2000, 0);
    // Under kurvan ligger rampen lägre än brytpunkten, och utanför som förut.
    expect(prof.hAt(6000)).toBeLessThan(500);
    expect(prof.hAt(6000)).toBeGreaterThan(450);
    expect(prof.hAt(4000)).toBeCloseTo(500 - 0.1 * 2000, 3);
    expect(prof.hAt(8000)).toBe(500);
    // Ändarna är skarpa när bara punkten har en mjuk övergång.
    const own = rampProfile(ramp({ line: [[0, 0], [6000, 0], [12000, 0]], levels: [null, 500], endHeight: 500, eases: [null, { ease: true, radius: 10000 }] }));
    expect(own.curves[1]).toBeCloseTo(10000 / 12, 0);
    expect(own.runs[0].la).toBe(0);
    // En skarp punkt i en mjuk ramp.
    const sharp = rampProfile(ramp({ line: [[0, 0], [6000, 0], [12000, 0]], levels: [null, 500], endHeight: 500, ease: true, eases: [null, { ease: false }] }));
    expect(sharp.curves[1]).toBe(0);
    expect(sharp.runs[0].la).toBeGreaterThan(0);
  });

  it('räknas in i marken, varningarna och Modifiera', () => {
    const store = onSlope();
    const id = addGround(store, { kind: 'path', outline: [], line: [[20000, 0], [32000, 0]], width: 2000, height: 2000, endHeight: 3000, ease: true });
    const t = finished(store);
    // Plant i början: 10 cm in är höjden nästan 2 000; mitt på 2 500.
    expect(groundAt(t, 20100, 0)!).toBeLessThan(2003);
    expect(groundAt(t, 26000, 0)).toBeCloseTo(2500, 0);
    const prims = groundType.plan!(store.doc.elements[id] as never, planCtx(store));
    const label = prims.find((q) => q.kind === 'text' && q.origin?.part === 'lutning') as { text: string };
    // Den raka delen är brantare än 1:12.
    expect(label.text).toContain('!');
    const h = host(store, [id]);
    const end = modifyContextAt(h, at([32000, 0]), 0, 0, id)!;
    expect(opsFor(h, end).flat()).toEqual(expect.arrayContaining(['pathEase', 'pathEaseSharp']));
    expect(opsFor(h, end).flat()).not.toContain('pathEaseClear');
    setRampEase(h, end, 'sharp');
    expect(params(store, id).eases).toEqual([null, { ease: false }]);
    expect(opsFor(h, end).flat()).toContain('pathEaseClear');
    setRampEase(h, end, 'soft', 10000);
    expect(params(store, id).eases).toEqual([null, { ease: true, radius: 10000 }]);
    setRampEase(h, end, 'soft', GROUND_DEFAULTS.easeRadius);
    expect(params(store, id).eases).toEqual([null, { ease: true }]);
    setRampEase(h, end, 'clear');
    expect(params(store, id).eases).toBeUndefined();
  });

  it('fältet Lutning ger den raka delen lutningen, också med mjuka övergångar', () => {
    const store = onSlope();
    const id = addGround(store, { kind: 'path', outline: [], line: [[20000, 0], [32000, 0]], width: 2000, height: 2000, endHeight: 2500, ease: true });
    applyGroundField(store, [id], 'ratio', { value: '12' } as HTMLInputElement);
    const p = params(store, id);
    expect(p.endHeight).toBeLessThan(3000);
    expect(rampProfile(p, GROUND_DEFAULTS).runs[0].ratio).toBeCloseTo(12, 1);
  });
});

describe('Dockade ramper (0.10.19)', () => {
  it('fogar två ramper vars ändar ligger nära: en punkt med höjd i skarven, den första behåller sitt', () => {
    const a: GroundParams = { kind: 'path', outline: [], line: [[0, 0], [6000, 0]], height: 0, endHeight: 500, crossFall: 50 };
    const b: GroundParams = { kind: 'path', outline: [], line: [[6000, 0], [12000, 0], [12000, 6000]], height: 500, endHeight: 500, bulges: [0, 1000] };
    const f = fusedRamp(a, b);
    expect(f).toMatchObject({ line: [[0, 0], [6000, 0], [12000, 0], [12000, 6000]], height: 0, endHeight: 500, levels: [null, 500], bulges: [0, 0, 1000], crossFall: 50 });
    expect(f.left).toBeUndefined();
    expect(rampRuns(rampLevels(f)).map((r) => r.ratio)).toEqual([12, Infinity]);
    // Olika bredd: sidorna ritas.
    const wide = fusedRamp(a, { ...b, bulges: undefined, width: 3000 });
    expect(wide.left).toEqual([[0, 750], [6000, 750], [6000, 1500], [10500, 1500], [10500, 6000]]);
  });

  it('baklänges byter början och slutet, sidorna och tvärfallet plats', () => {
    const r = reversedRamp({ line: [[0, 0], [6000, 0], [6000, 6000]], bulges: [1000], height: 0, levels: [null, 300], endHeight: 500, left: [[0, 1000], [6000, 1000]], leftEdge: 'wall', crossFall: 50, refSide: 'left' });
    expect(r).toMatchObject({ line: [[6000, 6000], [6000, 0], [0, 0]], bulges: [0, -1000], height: 500, endHeight: 0, levels: [null, 300], right: [[6000, 1000], [0, 1000]], rightEdge: 'wall', crossFall: -50, refSide: 'right' });
    expect(r.left).toBeUndefined();
  });

  it('Foga ihop dockar ramperna i projektet, också när den andra ligger baklänges', () => {
    const store = onSlope();
    const a = addGround(store, { kind: 'path', outline: [], line: [[20000, 0], [26000, 0]], width: 2000, height: 2000, endHeight: 2500 });
    const b = addGround(store, { kind: 'path', outline: [], line: [[32000, 0], [26200, 0]], width: 2000, height: 2500, endHeight: 2500 });
    expect(canFuse(store.doc, store.doc.elements[a])).toBe(true);
    const h = host(store, [a, b]);
    expect(opsFor(h, modifyContextAt(h, at([23000, 0]), 0, 0, a)!).flat()).toContain('shapeFuse');
    expect(fuseLines(store, [a, b])).toEqual([a]);
    expect(store.doc.elements[b]).toBeUndefined();
    expect(params(store, a)).toMatchObject({ line: [[20000, 0], [26000, 0], [32000, 0]], height: 2000, endHeight: 2500, levels: [null, 2500] });
    expect(groundAt(finished(store), 29000, 0)).toBeCloseTo(2500, 0);
    // För långt ifrån varandra: inget.
    const c = addGround(store, { kind: 'path', outline: [], line: [[36000, 0], [40000, 0]], width: 2000, height: 2500, endHeight: 2500 });
    expect(fuseLines(store, [a, c])).toBeNull();
  });
});
