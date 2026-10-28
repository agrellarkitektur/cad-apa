import { beforeAll, describe, expect, it } from 'vitest';
import { updateParams } from '../src/core/commands';
import { encodeGrid, groundLevelText, litteraText, terrainOf } from '../src/core/site';
import { applySitePackage } from '../src/core/siteImport';
import { DocStore } from '../src/core/store';
import { registerBuiltInTypes } from '../src/elements';
import { finishedTerrain, groundType } from '../src/elements/ground';
import { levelStatus } from '../src/elements/groundMarks';
import { slopeField, steepMarks, steepSlopePrims } from '../src/elements/terrainSlopes';
import { GroundTool } from '../src/ui/tools/groundTool';
import { isShown, OFF_BY_DEFAULT, setShown } from '../src/ui/app/showKeys';
import { buildPlan } from '../src/repr/plan';
import type { Primitive } from '../src/repr/primitives';
import { sampleProject } from '../src/sample/sampleProject';
import { addGround, onSlope, planCtx, slopeSite, toolHost } from './projekt';

/**
 * 0.10.20 Situationsplanens beteckningar: markhöjder med status, låglinjen,
 * murens ledare med littera och MK, minsta sidolutning, konturen runt
 * släntmarkeringarna och de branta slänterna i den befintliga marken.
 */

beforeAll(() => registerBuiltInTypes());

const prims = (store: DocStore, hide: string[] = []): Primitive[] => buildPlan(store.doc, 'platsen', { state: 'st-a', hide }).prims;
const texts = (ps: Primitive[], id?: string): string[] => ps.filter((p): p is Extract<Primitive, { kind: 'text' }> => p.kind === 'text' && (!id || p.origin?.objectId === id)).map((p) => p.text);
const ofPart = (ps: Primitive[], id: string, part: string): Primitive[] => ps.filter((p) => p.origin?.objectId === id && p.origin.part === part);

describe('markhöjdernas text och littera', () => {
  it('skrivs med två decimaler som förval, och tre när projektet vill', () => {
    const site = { datum: 65, ground: {} };
    expect(groundLevelText(site, 1234)).toBe('+66,23');
    expect(groundLevelText({ datum: 65, ground: { levelDecimals: 3 } }, 1234)).toBe('+66,234');
    expect(groundLevelText(undefined, -500)).toBe('−0,50');
    expect(groundLevelText(site, -65000)).toBe('±0,00');
  });

  it('litterat får projektets antal siffror', () => {
    expect(litteraText(undefined, 'M', 1)).toBe('M01');
    expect(litteraText({ ground: { litteraDigits: 3 } }, 'M', 12)).toBe('M012');
    expect(litteraText({ ground: { litteraDigits: 1 } }, 'T', 7)).toBe('T7');
  });
});

describe('markhöjden', () => {
  it('skriver den befintliga höjden understruken där marken inte ändras', () => {
    const store = onSlope();
    const id = addGround(store, { kind: 'level', outline: [], line: [[20000, 10000]] });
    const ps = prims(store);
    const t = texts(ps, id);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatch(/^\+\d+,\d\d$/);
    // Understrykningen: en linje i texten, och korset: två linjer.
    expect(ofPart(ps, id, 'markhöjd').filter((p) => p.kind === 'line')).toHaveLength(3);
    const ctx = planCtx(store);
    const st = levelStatus(ctx, { kind: 'level', outline: [] }, [20000, 10000]);
    expect(st.proposed).toBeNull();
    expect(st.existing).not.toBeNull();
  });

  it('skriver den nya höjden utan understrykning och den befintliga som utgår inom parentes', () => {
    const store = onSlope();
    addGround(store, { kind: 'area', outline: [[10000, 5000], [20000, 5000], [20000, 15000], [10000, 15000]], height: -2000 });
    const id = addGround(store, { kind: 'level', outline: [], line: [[15000, 10000]] });
    const ps = prims(store);
    const t = texts(ps, id);
    expect(t).toEqual(['+63,00', expect.stringMatching(/^\(\+\d+,\d\d\)$/)]);
    expect(ofPart(ps, id, 'markhöjd').filter((p) => p.kind === 'line')).toHaveLength(2);
  });

  it('en egen ny höjd gäller före den färdiga markens', () => {
    const store = onSlope();
    const id = addGround(store, { kind: 'level', outline: [], line: [[15000, 10000]], height: 1500 });
    expect(texts(prims(store), id)[0]).toBe('+66,50');
  });

  it('räknar inte om den färdiga marken när en markhöjd flyttas', () => {
    const store = onSlope();
    addGround(store, { kind: 'area', outline: [[10000, 5000], [20000, 5000], [20000, 15000], [10000, 15000]], height: -2000 });
    const id = addGround(store, { kind: 'level', outline: [], line: [[15000, 10000]] });
    const before = finishedTerrain(planCtx(store));
    updateParams(store, [id], { line: [[16000, 11000]] }, 'Flytta');
    expect(finishedTerrain(planCtx(store))).toBe(before);
    // Och den formar inte marken alls.
    expect(before!.volumes.has(id)).toBe(false);
  });

  it('läggs med verktyget Mark, utan höjd', () => {
    const store = onSlope();
    const tool = new GroundTool(toolHost(store));
    tool.options.mode = 'level';
    tool.takePoint([3000, 4000]);
    const el = Object.values(store.doc.elements).find((e) => e.type === 'Ground' && e.params.kind === 'level');
    expect(el?.params.line).toEqual([[3000, 4000]]);
    expect(el?.params.height).toBeUndefined();
  });
});

describe('låglinjen', () => {
  it('ritas som en linje med pilar i linjens riktning, var tionde millimeter på papperet', () => {
    const store = onSlope();
    const id = addGround(store, { kind: 'drain', outline: [], line: [[0, 0], [3000, 0]] });
    const ps = ofPart(prims(store), id, 'låglinje');
    expect(ps.filter((p) => p.kind === 'polyline')).toHaveLength(1);
    // 3 m i 1:100 är 30 mm: tre pilar med två spetsar var.
    const heads = ps.filter((p): p is Extract<Primitive, { kind: 'line' }> => p.kind === 'line');
    expect(heads).toHaveLength(6);
    // Spetsen pekar framåt: benen ligger bakom spetsen (mindre x).
    for (const h of heads) expect(h.b[0]).toBeLessThan(h.a[0]);
    expect(finishedTerrain(planCtx(store))).toBeNull();
  });

  it('en kort låglinje får minst en pil, och verktyget avslutar den som en linje', () => {
    const store = onSlope();
    const tool = new GroundTool(toolHost(store));
    tool.options.mode = 'drain';
    tool.takePoint([0, 0]);
    tool.takePoint([500, 200]);
    tool.finish();
    const el = Object.values(store.doc.elements).find((e) => e.type === 'Ground' && e.params.kind === 'drain');
    expect(el?.params.line).toEqual([[0, 0], [500, 200]]);
    expect(ofPart(prims(store), el!.id, 'låglinje').filter((p) => p.kind === 'line')).toHaveLength(2);
  });
});

describe('murens ledare', () => {
  const wall = (store: DocStore, x: number) => addGround(store, { kind: 'wall', outline: [], line: [[x, 0], [x, 6000]], height: 1000, endHeight: 1000 });

  it('numrerar murarna M01, M02 … i ritordningen och skriver MK på raden under', () => {
    const store = onSlope();
    const a = wall(store, 0);
    const b = wall(store, 5000);
    const ps = prims(store);
    expect(ofPart(ps, a, 'littera').filter((p) => p.kind === 'text').map((p) => (p as { text: string }).text)).toEqual(['M01', 'MK +66,00']);
    expect(ofPart(ps, b, 'littera').filter((p) => p.kind === 'text').map((p) => (p as { text: string }).text)).toEqual(['M02', 'MK +66,00']);
    // Ledaren: ut från muren och ett vågrätt streck.
    expect(ofPart(ps, a, 'littera').filter((p) => p.kind === 'line')).toHaveLength(2);
    // Höjderna i ändarna heter MK nu.
    expect(texts(ps, a).filter((t) => t.startsWith('MK'))).toHaveLength(3);
    expect(texts(ps, a).some((t) => t.startsWith('ÖK'))).toBe(false);
  });

  it('ett eget littera går före numret, och krönet som varierar skrivs lägsta–högsta', () => {
    const store = onSlope();
    const a = addGround(store, { kind: 'wall', outline: [], line: [[0, 0], [0, 6000]], height: 1000, endHeight: 1500, name: 'M07' });
    const t = ofPart(prims(store), a, 'littera').filter((p) => p.kind === 'text').map((p) => (p as { text: string }).text);
    expect(t).toEqual(['M07', 'MK +66,00–+66,50']);
  });

  it('släcks under Visa, Littera', () => {
    const store = onSlope();
    const a = wall(store, 0);
    expect(ofPart(prims(store, ['littera:Ground']), a, 'littera')).toHaveLength(0);
    expect(ofPart(prims(store, ['littera']), a, 'littera')).toHaveLength(0);
  });
});

describe('minsta sidolutning', () => {
  it('skrivs understruken i procent för markytan och vägen, inte annars', () => {
    const store = onSlope();
    const a = addGround(store, { kind: 'area', outline: [[0, 0], [8000, 0], [8000, 6000], [0, 6000]], height: 0, minCross: 2 });
    const b = addGround(store, { kind: 'path', outline: [], line: [[20000, 0], [26000, 0]], height: 0, endHeight: 300, minCross: 2.5 });
    const c = addGround(store, { kind: 'path', outline: [], line: [[20000, 10000], [26000, 10000]], height: 0, endHeight: 300 });
    const ps = prims(store);
    expect(texts(ofPart(ps, a, 'sidolutning'))).toEqual(['2 %']);
    expect(ofPart(ps, a, 'sidolutning').filter((p) => p.kind === 'line')).toHaveLength(1);
    expect(texts(ofPart(ps, b, 'sidolutning'))).toEqual(['2,5 %']);
    expect(ofPart(ps, c, 'sidolutning')).toHaveLength(0);
  });
});

describe('konturen runt släntmarkeringarna', () => {
  it('ritas tunn runt en platås slänter, och inte där kanten är stödmur', () => {
    const store = onSlope();
    const a = addGround(store, { kind: 'area', outline: [[0, 0], [8000, 0], [8000, 6000], [0, 6000]], height: 1000 });
    const ps = prims(store);
    const lines = ofPart(ps, a, 'släntkontur').filter((p): p is Extract<Primitive, { kind: 'polyline' }> => p.kind === 'polyline');
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l.pen.weight).toBe(0.13);
      // Konturen ligger utanför platån.
      for (const q of l.points) expect(q[0] < -1 || q[0] > 8001 || q[1] < -1 || q[1] > 6001).toBe(true);
    }
    const b = addGround(store, { kind: 'area', outline: [[20000, 0], [28000, 0], [28000, 6000], [20000, 6000]], height: 1000, edge: 'wall' });
    expect(ofPart(prims(store), b, 'släntkontur')).toHaveLength(0);
  });

  it('släntstrecken går inte längre än slänten lutar från kanten', () => {
    const store = onSlope();
    // En platå 1 m över marken med slänt 1:2 når högst ca 2 m ut (marken lutar 1:10).
    const a = addGround(store, { kind: 'area', outline: [[0, 0], [8000, 0], [8000, 6000], [0, 6000]], height: 1000 });
    const marks = ofPart(prims(store), a, 'slänt').filter((p): p is Extract<Primitive, { kind: 'line' }> => p.kind === 'line');
    expect(marks.length).toBeGreaterThan(10);
    for (const m of marks) expect(Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1])).toBeLessThan(4000);
  });
});

describe('branta slänter i den befintliga marken', () => {
  /** En plats med en brant brink: plan mark, en slänt 1:2 över 4 m, plan mark igen. */
  function bank(): DocStore {
    const W = 101;
    const H = 81;
    const z = new Float32Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) z[j * W + i] = i < 40 ? 60 : i < 48 ? 60 + (i - 40) * 0.5 : 64;
    const store = new DocStore(structuredClone(sampleProject()));
    applySitePackage(store, slopeSite({ terrang: { rutnat: { x0: 1000, y1: 5080, s: 1, W, H, z: encodeGrid(z) } } }));
    return store;
  }

  it('lutningens fält är noll på plan mark och 0,5 i branten', () => {
    const t = terrainOf(bank().doc)!;
    const f = slopeField(t);
    expect(f[40 * 101 + 10]).toBe(0);
    expect(f[40 * 101 + 44]).toBeCloseTo(0.5, 5);
  });

  it('strecken börjar vid krönet och går nedför tills marken blir flack', () => {
    const t = terrainOf(bank().doc)!;
    const marks = steepMarks(t, 3, 100);
    expect(marks.length).toBeGreaterThan(20);
    for (const m of marks) {
      // Krönet ligger uppe vid x ≈ 48 m (modellen: −2 m från nollpunkten 50), foten vid 40 m (−10 m).
      expect(m.pts[0][0]).toBeGreaterThan(-3500);
      expect(m.pts[0][0]).toBeLessThan(-1500);
      const end = m.pts[m.pts.length - 1];
      expect(end[0]).toBeLessThan(m.pts[0][0]);
      expect(end[0]).toBeGreaterThan(-11000);
      expect(m.length).toBeGreaterThan(6000);
    }
    // Flackare gräns än branten: inga streck.
    expect(steepMarks(t, 1.5, 100)).toHaveLength(0);
  });

  it('ritas bara när de är tända i vyn, långa och korta om vartannat', () => {
    const store = bank();
    expect(prims(store).some((p) => p.origin?.part === 'brant slänt')).toBe(false);
    const on = prims(store, ['+steepSlopes']).filter((p): p is Extract<Primitive, { kind: 'polyline' }> => p.origin?.part === 'brant slänt' && p.kind === 'polyline');
    expect(on.length).toBeGreaterThan(20);
    const len = (p: Extract<Primitive, { kind: 'polyline' }>) => {
      let l = 0;
      for (let i = 1; i < p.points.length; i++) l += Math.hypot(p.points[i][0] - p.points[i - 1][0], p.points[i][1] - p.points[i - 1][1]);
      return l;
    };
    expect(len(on[1])).toBeLessThan(len(on[0]) * 0.5);
    const t = terrainOf(store.doc)!;
    expect(steepSlopePrims(t, 3, 100, {}, () => true)).toHaveLength(0);
  });

  it('är släckta från början under Visa', () => {
    expect(OFF_BY_DEFAULT.has('steepSlopes')).toBe(true);
    const ui = { hide: [] as string[], hideDemolished: false };
    expect(isShown(ui, 'steepSlopes')).toBe(false);
    setShown(ui, 'steepSlopes', true);
    expect(ui.hide).toEqual(['+steepSlopes']);
  });
});

describe('markobjektets form för beteckningarna', () => {
  it('markhöjden och låglinjen går att klicka på men formar inte marken', () => {
    const store = onSlope();
    const a = addGround(store, { kind: 'level', outline: [], line: [[1000, 1000]] });
    const b = addGround(store, { kind: 'drain', outline: [], line: [[0, 0], [5000, 0]] });
    const ctx = planCtx(store);
    expect(groundType.pickShape!(store.doc.elements[a] as never, ctx)).toHaveLength(1);
    expect(groundType.pickShape!(store.doc.elements[b] as never, ctx)).toHaveLength(1);
    expect(groundType.model3d!(store.doc.elements[a] as never, ctx)).toEqual([]);
  });
});
