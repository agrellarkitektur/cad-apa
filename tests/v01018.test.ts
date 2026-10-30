import { bookWithSheet, defaultSheet } from '../src/core/viewCategories';
import { beforeAll, describe, expect, it } from 'vitest';
import { moveElements, updateParams } from '../src/core/commands';
import { GROUND_DEFAULTS, groundAt, terrainOf } from '../src/core/site';
import { mirrorElements } from '../src/core/transforms';
import { registerBuiltInTypes } from '../src/elements';
import { finishedTerrain, groundGeometry, groundType, type GroundParams } from '../src/elements/ground';
import { rampSides, rampWarnings } from '../src/elements/groundRamp';
import { rampLevels, rampRuns } from '../src/elements/rampProfile';
import { extendRamp } from '../src/elements/rampEdits';
import { editedShape, moveShapeNode, insertShapeNode, shapePatch, subShapes } from '../src/elements/shapeEdit';
import { modifyContextAt, opsFor } from '../src/ui/modify/ops';
import { clearRampLevel, setRampLevel } from '../src/ui/modify/rampOps';
import { GroundTool } from '../src/ui/tools/groundTool';
import type { ViewPointer } from '../src/view2d/planView';
import { buildPlan } from '../src/repr/plan';
import { addGround, groundProject, onSlope, planCtx, toolHost } from './projekt';
import { DocStore } from '../src/core/store';
import { setGraphics } from '../src/core/commands';
import { SWEDISH_STANDARD as DEFAULT_STYLE, normalizeStyle } from '../src/core/graphics';
import { applyPenField } from '../src/ui/style/pens';

/**
 * Rampens referenslinje (0.10.18). Den sneda marken (`onSlope`): marken
 * ligger x/10 mm över ±0 i modellen.
 */

beforeAll(() => registerBuiltInTypes());

const finished = (store: DocStore) => finishedTerrain(planCtx(store))!.terrain;
const params = (store: DocStore, id: string) => store.doc.elements[id].params as unknown as GroundParams;
const at = (model: [number, number]) => ({ model, pointerType: 'mouse' }) as unknown as ViewPointer;

/** Värden för verktyg och Modifiera, med planen i Förslag A där markobjekten ligger. */
function host(store: DocStore, selected: string[] = []) {
  const h = toolHost(store, selected, 'platsen');
  const list = h.selection.list.bind(h.selection);
  return { ...h, selection: { ...h.selection, list, has: (id: string) => list().includes(id) } as never, plan: () => buildPlan(store.doc, 'platsen', { state: 'st-a' }) };
}

/** En ramp längs x med en punkt i mitten: 2 000 → 2 500 på 6 m, sedan plan i 6 m. */
function withLanding(store: DocStore, over: Partial<GroundParams> = {}): string {
  return addGround(store, { kind: 'path', outline: [], line: [[20000, 0], [26000, 0], [32000, 0]], height: 2000, levels: [null, 2500], endHeight: 2500, ...over });
}

describe('Höjden längs referenslinjen (0.10.18)', () => {
  it('går rakt mellan punkterna med höjd, och en plan sträcka är ett vilplan', () => {
    const store = onSlope();
    const id = withLanding(store);
    const levels = rampLevels(params(store, id));
    expect(levels.map((l) => [l.i, l.h])).toEqual([[0, 2000], [1, 2500], [2, 2500]]);
    expect(rampRuns(levels).map((r) => r.ratio)).toEqual([12, Infinity]);
    const t = finished(store);
    expect(groundAt(t, 23000, 0)).toBeCloseTo(2250, 0);
    expect(groundAt(t, 29000, 0)).toBeCloseTo(2500, 0);
    // Utan punkten i mitten: rakt från början till slutet.
    updateParams(store, [id], { levels: undefined }, 'Prov');
    expect(groundAt(finished(store), 26000, 0)).toBeCloseTo(2250, 0);
  });

  it('varnar per sträcka: ett vilplan delar höjdskillnaden', () => {
    const one = rampLevels({ line: [[0, 0], [12000, 0]], height: 0, endHeight: 1000 });
    expect(rampWarnings(one, 12, GROUND_DEFAULTS).some((w) => w.includes('vilplan'))).toBe(true);
    // Två ramper på 0,5 m med ett vilplan emellan: ingen varning.
    const split = rampLevels({ line: [[0, 0], [6000, 0], [8000, 0], [14000, 0]], height: 0, levels: [null, 500, 500], endHeight: 1000 });
    expect(rampWarnings(split, 12, GROUND_DEFAULTS)).toEqual([]);
  });

  it('tvärfallet vrider kring referenslinjen, också när den ligger på en kant', () => {
    const store = onSlope();
    addGround(store, { kind: 'path', outline: [], line: [[20000, 0], [30000, 0]], width: 3000, refSide: 'left', height: 2500, endHeight: 2500, crossFall: 50 });
    const t = finished(store);
    // Vägen ligger till höger (−y); en meter in från referenslinjen 20 mm lägre.
    expect(groundAt(t, 25000, -50)).toBeCloseTo(2499, 0);
    expect(groundAt(t, 25000, -1000)).toBeCloseTo(2480, 0);
  });

  it('punkternas höjder följer punkterna när en punkt flyttas eller läggs till', () => {
    const store = onSlope();
    const id = withLanding(store);
    const ref = editedShape(store.doc, id)!;
    const moved = shapePatch(store.doc, id, undefined, moveShapeNode(ref, 1, [25000, 500]));
    expect(moved.levels).toEqual([null, 2500]);
    const added = shapePatch(store.doc, id, undefined, insertShapeNode(ref, 0, [22000, 0])!);
    expect(added.levels).toEqual([null, null, 2500]);
  });
});

describe('Sidorna (0.10.18)', () => {
  it('följer referenslinjen tills de ritas om, och lever sedan sitt eget liv', () => {
    const store = onSlope();
    const id = addGround(store, { kind: 'path', outline: [], line: [[20000, 0], [26000, 0]], width: 2000, height: 2500, endHeight: 2500 });
    expect(rampSides(params(store, id)).right).toEqual([[20000, -1000], [26000, -1000]]);
    // Höger sida bredare i slutet: vägen breddas från 2 till 4 m.
    const side = subShapes(store.doc.elements[id])[1].shape;
    updateParams(store, [id], shapePatch(store.doc, id, 1, moveShapeNode(side, 1, [26000, -3000])), 'Prov');
    expect(params(store, id).right).toEqual([[20000, -1000], [26000, -3000]]);
    expect(groundAt(finished(store), 25900, -2800)).toBeCloseTo(2500, 0);
    // Referenslinjen flyttas, sidan ligger kvar.
    updateParams(store, [id], { line: [[20000, 500], [26000, 500]] }, 'Prov');
    expect(rampSides(params(store, id)).right).toEqual([[20000, -1000], [26000, -3000]]);
    expect(rampSides(params(store, id)).left[0]).toEqual([20000, 1500]);
  });

  it('stödmur eller slänt per sida: utanför muren är marken orörd', () => {
    const store = onSlope();
    // Rampen på +2 000 där marken ligger på +2 300: schakt med slänt, utom på höger sida.
    addGround(store, { kind: 'path', outline: [], line: [[23000, 0], [23000, 10000]], width: 2000, height: 2000, endHeight: 2000, rightEdge: 'wall' });
    const t = finished(store);
    // Längs y: höger är +x. Där är marken orörd (x/10), till vänster tagen ned mot rampen.
    expect(groundAt(t, 24200, 5000)).toBeCloseTo(2420, 0);
    expect(groundAt(t, 21800, 5000)!).toBeLessThan(2170);
    const g = groundGeometry(planCtx(store), Object.values(store.doc.elements).find((e) => e.type === 'Ground')!)!;
    expect(g.edgeWall!.filter(Boolean)).toHaveLength(1);
  });

  it('flyttas med objektet, och byter plats speglat', () => {
    const store = onSlope();
    const id = addGround(store, { kind: 'path', outline: [], line: [[20000, 0], [26000, 0]], height: 0, left: [[20000, 1000], [26000, 1000]], right: [[20000, -2000], [26000, -2000]], rightEdge: 'wall' });
    moveElements(store, [id], [100, 0]);
    expect(params(store, id).left).toEqual([[20100, 1000], [26100, 1000]]);
    // Speglat kring x = 23 100 går linjen åt andra hållet, så vänster sida blir höger.
    mirrorElements(store, [id], [23100, 0]);
    expect(params(store, id)).toMatchObject({ line: [[26100, 0], [20100, 0]], left: [[26100, -2000], [20100, -2000]], right: [[26100, 1000], [20100, 1000]], leftEdge: 'wall' });
  });

  it('ritas med tjock linje där sidan är stödmur, och har inga släntstreck där', () => {
    const store = onSlope();
    const id = addGround(store, { kind: 'path', outline: [], line: [[23000, 0], [23000, 10000]], width: 2000, height: 2000, endHeight: 2000, rightEdge: 'wall' });
    const prims = groundType.plan!(store.doc.elements[id] as never, planCtx(store));
    const sides = prims.filter((q) => q.origin?.part === 'kant').map((q) => (q as { pen: { weight: number } }).pen.weight);
    expect(sides.sort()).toEqual([0.25, 0.5]);
    const marks = prims.filter((q) => q.origin?.part === 'slänt' && q.kind === 'line') as unknown as { a: [number, number] }[];
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.every((m) => m.a[0] < 24000)).toBe(true);
  });
});

describe('Modifiera och förlängning (0.10.18)', () => {
  it('referenslinjens punkter får Höjd i punkten, ändarna Förläng; sidornas punkter ändras för sig', () => {
    const store = onSlope();
    const id = withLanding(store, { width: 2000 });
    const h = { ...host(store, [id]), startRampFrom: () => true };
    const end = modifyContextAt(h, at([32000, 0]), 0, 0, id)!;
    expect(opsFor(h, end).flat()).toEqual(expect.arrayContaining(['pathLevel', 'pathExtend']));
    const mid = modifyContextAt(h, at([26000, 0]), 0, 0, id)!;
    expect(opsFor(h, mid).flat()).toEqual(expect.arrayContaining(['pathLevel', 'pathLevelClear']));
    expect(opsFor(h, mid).flat()).not.toContain('pathExtend');
    const side = modifyContextAt(h, at([26000, -1000]), 0, 0, id)!;
    expect(side).toMatchObject({ kind: 'point', hole: 1, index: 1 });
    expect(opsFor(h, side).flat()).not.toContain('holeMove');
    // Skriven i meter RH 2000 (±0 = +65).
    setRampLevel(h, mid, 67.4);
    expect(params(store, id).levels).toEqual([null, 2400]);
    clearRampLevel(h, mid);
    expect(params(store, id).levels).toBeUndefined();
    // En punkt utan höjd får förslaget ur lutningen där.
    setRampLevel(h, mid);
    expect(params(store, id).levels).toEqual([null, 2250]);
  });

  it('förlängd fortsätter lutningen; den gamla änden behåller sin höjd, och ritade sidor följer med', () => {
    const p: GroundParams = { kind: 'path', outline: [], line: [[0, 0], [6000, 0]], height: 0, endHeight: 500, left: [[0, 1000], [6000, 1000]], right: [[0, -1000], [6000, -2000]] };
    const end = extendRamp(p, false, [[12000, 0]]);
    expect(end).toMatchObject({ line: [[0, 0], [6000, 0], [12000, 0]], endHeight: 1000, levels: [null, 500] });
    expect(end.left).toEqual([[0, 1000], [6000, 1000], [12000, 1000]]);
    expect(end.right).toEqual([[0, -1000], [6000, -2000], [12000, -2000]]);
    const start = extendRamp(p, true, [[-6000, 0]]);
    expect(start).toMatchObject({ line: [[-6000, 0], [0, 0], [6000, 0]], height: -500, levels: [null, 0] });
    expect(start.left).toEqual([[-6000, 1000], [0, 1000], [6000, 1000]]);
    expect(start.right).toEqual([[-6000, -1000], [0, -1000], [6000, -2000]]);
  });

  it('verktyget: ett klick på rampens ände förlänger den', () => {
    const store = onSlope();
    const id = addGround(store, { kind: 'path', outline: [], line: [[20000, 10000], [26000, 10000]], height: 2000, endHeight: 2500 });
    const tool = new GroundTool(host(store));
    tool.options.mode = 'path';
    tool.takePoint([26000, 10000]);
    expect(tool.continuing).toBe(id);
    tool.takePoint([32000, 10000]);
    tool.finish();
    expect(params(store, id)).toMatchObject({ line: [[20000, 10000], [26000, 10000], [32000, 10000]], endHeight: 3000, levels: [null, 2500] });
    expect(Object.values(store.doc.elements).filter((e) => e.type === 'Ground')).toHaveLength(1);
    expect(terrainOf(store.doc)).toBeTruthy();
  });
});

describe('Granskningen efter 0.10.18', () => {
  it('höjdkurvorna ritas med stilmallens pennor, med förvalen som förut utom streckningen', () => {
    const store = new DocStore(groundProject());
    const prims = (part: string) => buildPlan(store.doc, 'platsen', { state: 'st-a' }).prims.filter((q) => q.origin?.part === part);
    const lines = (part: string) => prims(part).filter((q) => q.kind === 'polyline');
    // Förvalen: hela meter 0,25, däremellan 0,13; den ändrade markens grå och streckad.
    expect(new Set(lines('höjdkurva').map((q) => q.pen.weight))).toEqual(new Set([0.25, 0.13]));
    expect(lines('befintlig mark').every((q) => q.pen.color === 'muted' && q.pen.dash?.join() === '3,1.5')).toBe(true);
    const style = structuredClone(defaultSheet(store.doc.graphics, 'site'));
    style.pens = { ...style.pens, contour: { weight: 0.35, color: '#aa5500' }, contourOld: { weight: 0.25, color: 'ink', linetype: 'solid' } };
    setGraphics(store, bookWithSheet(store.doc.graphics, style));
    const major = lines('höjdkurva').filter((q) => q.pen.weight === 0.35);
    expect(major.length).toBeGreaterThan(0);
    expect(major.every((q) => q.pen.color === '#aa5500')).toBe(true);
    // Höjden har kurvans färg; den ändrade marken svart och heldragen, däremellan högst 0,13.
    expect(prims('höjdkurva').filter((q) => q.kind === 'text').every((q) => q.pen.color === '#aa5500')).toBe(true);
    const old = lines('befintlig mark');
    expect(old.every((q) => (q.pen.color ?? 'ink') === 'ink' && !q.pen.dash)).toBe(true);
    expect(new Set(old.map((q) => q.pen.weight))).toEqual(new Set([0.25, 0.13]));
  });

  it('en penna som ställts heldragen är kvar heldragen när filen läses', () => {
    const style = normalizeStyle({ ...structuredClone(DEFAULT_STYLE), pens: { aboveWall: { weight: 0.18, linetype: 'solid' } } });
    expect(style.pens?.aboveWall.linetype).toBe('solid');
  });

  it('den ändrade markens färg: grått är förvalet, svart sparas', () => {
    const field = (pen: string, value: string) => ({ dataset: { pen }, value }) as unknown as HTMLInputElement;
    const style = structuredClone(DEFAULT_STYLE);
    applyPenField(style, field('contourOld:color', '#000000'));
    expect(style.pens?.contourOld).toEqual({ weight: 0.18, color: 'ink', linetype: 'dashed' });
    applyPenField(style, field('contourOld:color', '#8c8c8c'));
    expect(style.pens).toBeUndefined();
  });
});
