import { beforeAll, describe, expect, it } from 'vitest';
import { addElements, moveElements } from '../src/core/commands';
import { DocStore } from '../src/core/store';
import { mirrorAbout } from '../src/core/wallEdit';
import { registerBuiltInTypes } from '../src/elements';
import { groundGeometry } from '../src/elements/groundGeometry';
import { shapePoints } from '../src/elements/drawing2d';
import { hasOutlineShape, shapeCan, shapeOf, shapePatch } from '../src/elements/shapeEdit';
import { slabOutline, type SlabParams } from '../src/elements/slab';
import { fitArcs, reversedChain } from '../src/geometry/arcFit';
import { signedArea } from '../src/geometry/chains';
import { pointInRings } from '../src/geometry/vec';
import { buildModel3d } from '../src/repr/model3d';
import { buildPlan } from '../src/repr/plan';
import { snapSegments } from '../src/ui/app/snapping';
import type { Vec2 } from '../src/repr/primitives';
import type { Solid } from '../src/repr/solids';
import { modifyContextAt, opsFor } from '../src/ui/modify/ops';
import { ModifyTool, runInstant } from '../src/ui/modify/tool';
import { GroundTool } from '../src/ui/tools/groundTool';
import { RoomTool } from '../src/ui/tools/roomTool';
import { SlabTool } from '../src/ui/tools/slabTool';
import { groundArea } from '../src/ui/wand/groundArea';
import { slabFrom } from '../src/ui/wand/slabFrom';
import type { WandAction } from '../src/ui/wand/wand';
import type { AppContext } from '../src/ui/app/context';
import type { ViewPointer } from '../src/view2d/planView';
import { addGround, groundProject, onSlope, planCtx, toolHost, wallsProject } from './projekt';

beforeAll(() => registerBuiltInTypes());

/**
 * Bågar i bjälklagets och markytans kontur (0.10.24): `bulges` på
 * konturen som på håltagningen, konturerna ändras som 2D-former, spöet
 * och verktygen ger bågar.
 */

type P = [number, number];
const OUTLINE: P[] = [[0, 0], [4000, 0], [4000, 3000], [0, 3000]];
/** Kanten från (4000, 0) upp till (4000, 3000) buktar utåt (åt höger, negativ pilhöjd) 1 m. */
const BULGES = [0, -1000];
const at = (model: P) => ({ model, pointerType: 'mouse' }) as unknown as ViewPointer;
const flat = (points: P[], bulges?: number[]) => shapePoints({ shape: 'polyline', points, bulges, closed: true }).points;
const sortedPts = (pts: Vec2[]) => pts.map((q) => `${Math.round(q[0])},${Math.round(q[1])}`).sort();

/** Ett bjälklag med ritad kontur i ett tomt projekt. */
function withSlab(bulges: number[] | null = BULGES): DocStore {
  return wallsProject({}, {}, { bj: { type: 'Slab', params: { thickness: 300, outline: OUTLINE, ...(bulges ? { bulges } : {}) } } });
}

describe('bjälklagets kontur med bågar', () => {
  it('konturen ritas med bågen som korta raka bitar, i planen, i 3D och i ytan man klickar i', () => {
    const s = withSlab();
    const p = s.doc.elements['bj'].params as unknown as SlabParams;
    expect(slabOutline(p).length).toBeGreaterThan(8);
    expect(slabOutline({ outline: OUTLINE })).toEqual(OUTLINE);
    const state = s.doc.states.at(-1)!.id;
    const solids = buildModel3d(s.doc, { state }).filter((x): x is Solid => x.kind !== 'edges' && x.id === 'bj');
    // Utanför den raka kanten men innanför bågen.
    expect(solids.some((x) => pointInRings([4800, 1500], x.rings))).toBe(true);
    expect(solids.some((x) => pointInRings([5200, 1500], x.rings))).toBe(false);
    const own = buildPlan(s.doc, s.doc.storeys[0].id, { state }).pickables.find((q) => q.id === 'bj')!.prims.filter((q) => q.origin?.part === 'kontur');
    expect(own.filter((q) => q.kind === 'line')).toHaveLength(3);
    expect(own.filter((q) => q.kind === 'polyline')).toHaveLength(1);
    // Utan bågar är allt raka linjer, som förut.
    const plain = withSlab(null);
    const prims = buildPlan(plain.doc, plain.doc.storeys[0].id, { state }).pickables.find((q) => q.id === 'bj')!.prims.filter((q) => q.origin?.part === 'kontur');
    expect(prims.every((q) => q.kind === 'line')).toBe(true);
  });

  it('konturen ändras som en 2D-form: punkter, Böj, Räta ut; ett bjälklag ur väggarna har ingen', () => {
    const s = withSlab();
    const el = s.doc.elements['bj'];
    expect(hasOutlineShape(el)).toBe(true);
    const shape = shapeOf(el)!;
    expect(shape.params.closed).toBe(true);
    expect(shape.params.bulges).toEqual(BULGES);
    expect(shapeCan(shape).bend).toBe(true);
    expect(shapePatch(s.doc, 'bj', undefined, { points: OUTLINE, bulges: [0, 0, 500] })).toEqual({ outline: OUTLINE, bulges: [0, 0, 500] });
    expect(hasOutlineShape({ type: 'Slab', params: { outline: [], fromWalls: true } })).toBe(false);
    const host = toolHost(s, ['bj']);
    // Hörnet: punktens val; bågen: Räta ut; den raka kanten: Böj.
    const corner = modifyContextAt(host, at([0, 0]), 0, 0, null)!;
    expect(corner).toMatchObject({ kind: 'point', shapeId: 'bj', index: 0 });
    expect(opsFor(host, corner).flat()).toEqual(expect.arrayContaining(['shapeMove', 'shapeRemove', 'shapeFillet', 'shapeChamfer', 'move']));
    const arc = modifyContextAt(host, at([5000, 1500]), 0, 0, null)!;
    expect(arc).toMatchObject({ kind: 'edge', shapeId: 'bj', index: 1 });
    expect(opsFor(host, arc).flat()).toContain('shapeStraighten');
    const edge = modifyContextAt(host, at([2000, 3000]), 0, 0, null)!;
    expect(edge).toMatchObject({ kind: 'edge', shapeId: 'bj', index: 2 });
    expect(opsFor(host, edge).flat()).toEqual(expect.arrayContaining(['shapeInsert', 'shapeBend', 'shapeOffset']));
    // Kanten går åt vänster; en punkt ovanför den är till höger om den: utåt, negativ pilhöjd.
    new ModifyTool(host, 'shapeBend', edge, 0, () => {}).takePoint([2000, 3600]);
    const p = s.doc.elements['bj'].params as unknown as SlabParams;
    expect(p.outline).toEqual(OUTLINE);
    expect(p.bulges?.[2]).toBeCloseTo(-600, 0);
    runInstant(host, 'shapeStraighten', arc);
    expect((s.doc.elements['bj'].params as unknown as SlabParams).bulges?.[1] ?? 0).toBe(0);
  });

  it('en cirkel av två punkter och bågar är en kontur, och ett hål som dras ifrån', () => {
    const s = wallsProject({}, {}, { bj: { type: 'Slab', params: { thickness: 300, outline: [[3000, 0], [-3000, 0]], bulges: [3000, 3000], holes: [{ points: [[500, 0], [-500, 0]], bulges: [500, 500] }] } } });
    const state = s.doc.states.at(-1)!.id;
    const solids = buildModel3d(s.doc, { state }).filter((x): x is Solid => x.kind !== 'edges' && x.id === 'bj');
    expect(solids.some((x) => pointInRings([2000, 0], x.rings))).toBe(true);
    expect(solids.some((x) => pointInRings([0, 0], x.rings))).toBe(false);
    expect(solids.some((x) => pointInRings([0, 3500], x.rings))).toBe(false);
    const prims = buildPlan(s.doc, s.doc.storeys[0].id, { state }).pickables.find((q) => q.id === 'bj')!.prims;
    expect(prims.filter((q) => q.origin?.part === 'kontur' && q.kind === 'polyline')).toHaveLength(2);
    expect(prims.filter((q) => q.origin?.part === 'hål' && q.kind === 'polyline')).toHaveLength(2);
  });

  it('spegla vänder konturens bågar, flytta behåller dem', () => {
    const s = withSlab();
    moveElements(s, ['bj'], [100, 0]);
    expect(s.doc.elements['bj'].params.bulges).toEqual(BULGES);
    expect((s.doc.elements['bj'].params.outline as P[])[1]).toEqual([4100, 0]);
    mirrorAbout(s, ['bj'], [0, 0], [1, 0]);
    expect(s.doc.elements['bj'].params.bulges).toEqual([0, 1000]);
  });
});

describe('markytans kontur med bågar', () => {
  it('ytan följer bågen, och konturen ändras som en 2D-form', () => {
    const store = onSlope();
    const id = addGround(store, { kind: 'area', outline: [[0, 20000], [4000, 20000], [4000, 23000], [0, 23000]], bulges: [0, -1000], height: 1000 });
    const el = store.doc.elements[id];
    const p = el.params as unknown as { outline: P[]; bulges?: number[] };
    expect(slabOutline(p).length).toBeGreaterThan(8);
    const g = groundGeometry(planCtx(store), el)!;
    expect(pointInRings([4800, 21500], g.rings[0])).toBe(true);
    expect(pointInRings([5200, 21500], g.rings[0])).toBe(false);
    expect(hasOutlineShape(el)).toBe(true);
    expect(shapeOf(el)?.params.bulges).toEqual([0, -1000]);
    expect(shapePatch(store.doc, id, undefined, { bulges: [0, -500] })).toEqual({ bulges: [0, -500] });
    // Markytan runt huset och urgrävningen följer huset och bjälklaget: ingen egen kontur.
    expect(hasOutlineShape({ type: 'Ground', params: { kind: 'area', outline: [], around: true } })).toBe(false);
    expect(hasOutlineShape({ type: 'Ground', params: { kind: 'area', outline: [], slab: 'bj1' } })).toBe(false);
  });

  it('verktyget ritar markytan som en polygon med bågar', () => {
    const store = onSlope();
    const host = toolHost(store);
    const t = new GroundTool(host);
    t.options.mode = 'area';
    t.options.shape = 'polygon';
    t.takePoint([0, 20000]);
    t.takePoint([4000, 20000]);
    t.setArc(true);
    t.takePoint([4000, 23000]);
    // Punkten på bågen, 1 m utanför kordans mitt.
    t.takePoint([5000, 21500]);
    t.setArc(false);
    t.takePoint([0, 23000]);
    expect(t.canClose).toBe(true);
    t.finish();
    const el = Object.values(store.doc.elements).at(-1)!;
    expect(el.type).toBe('Ground');
    expect(el.params.outline).toEqual([[0, 20000], [4000, 20000], [4000, 23000], [0, 23000]]);
    expect((el.params.bulges as number[])[1]).toBeCloseTo(-1000, 0);
    expect(t.started).toBe(false);
  });
});

describe('vända kedjor och spöet', () => {
  it('en vänd sluten kedja ritar samma kontur åt andra hållet', () => {
    const chain = fitArcs({ points: flat(OUTLINE, BULGES), closed: true });
    expect(chain.points).toHaveLength(4);
    const back = reversedChain(chain);
    expect(back.points[0]).toEqual(chain.points[0]);
    expect(signedArea(back.points)).toBeCloseTo(-signedArea(chain.points), 0);
    expect(sortedPts(flat(back.points as P[], back.bulges))).toEqual(sortedPts(flat(chain.points as P[], chain.bulges)));
    expect(reversedChain(back)).toEqual(chain);
    // Öppen: baklänges med bågarna åt andra hållet.
    const open = reversedChain({ points: [[0, 0], [1000, 0], [2000, 0]], bulges: [300, 0], closed: false });
    expect(open).toEqual({ points: [[2000, 0], [1000, 0], [0, 0]], bulges: [0, -300], closed: false });
  });

  it('spöet ger bjälklaget och markytan riktiga bågar ur en cirkel', () => {
    const store = wallsProject({});
    const st = store.doc.states.at(-1)!.id;
    addElements(store, [{ type: 'Shape2D', storey: store.doc.storeys[0].id, tags: [], props: {}, params: { shape: 'polyline', points: [[3000, 0], [-3000, 0]], bulges: [3000, 3000], closed: true, weight: 0.25, linetype: 'solid' } }], st, 'cirkel');
    const app = fakeApp(store, 'slab');
    const hit = slabFrom.find({ app, at: [0, 0], tol: 100, shift: false })[0];
    expect(hit.label).toBe('Bjälklag i den slutna ytan');
    hit.apply(false);
    const slab = Object.values(store.doc.elements).at(-1)!;
    expect(slab.type).toBe('Slab');
    expect(slab.params.outline).toHaveLength(2);
    expect((slab.params.bulges as number[]).map((b) => Math.round(Math.abs(b)))).toEqual([3000, 3000]);
    expect(Math.abs(signedArea(slabOutline(slab.params as unknown as SlabParams)))).toBeCloseTo(Math.PI * 3000 * 3000, -5);
  });

  it('spöet ger markytan bågar också', () => {
    const store = new DocStore(groundProject());
    addElements(store, [{ type: 'Shape2D', storey: store.doc.storeys[0].id, tags: [], props: {}, params: { shape: 'polyline', points: [[33000, 21500], [31000, 21500]], bulges: [1000, 1000], closed: true, weight: 0.25, linetype: 'solid' } }], 'st-a', 'cirkel');
    const app = fakeApp(store, 'ground', 'st-a');
    app.groundTool.options.mode = 'area';
    const hit = (groundArea as WandAction).find({ app, at: [32000, 21500], tol: 100, shift: false }).find((h) => h.label !== 'Markyta runt huset')!;
    hit.apply(false);
    const g = Object.values(store.doc.elements).at(-1)!;
    expect(g.type).toBe('Ground');
    expect(g.params.outline).toHaveLength(2);
    expect((g.params.bulges as number[]).map((b) => Math.round(Math.abs(b)))).toEqual([1000, 1000]);
  });
});

/** Det spöet behöver av appen för bjälklag och markyta, utan webbläsare. */
function fakeApp(store: DocStore, tool: string, state = store.doc.states.at(-1)!.id): AppContext {
  let sel: string[] = [];
  const vs = { state };
  const plan = () => buildPlan(store.doc, store.doc.storeys[0].id, vs);
  const host = { ...toolHost(store), activeState: () => state, plan, snapSegments: () => snapSegments(app as never), selection: { set: (ids: string[]) => (sel = [...ids]), list: () => sel } } as never;
  const app = {
    store,
    get plan() {
      return plan();
    },
    host,
    ui: { storey: store.doc.storeys[0].id, marker: null, worksheet: null, tool },
    uiSettings: { snapTrace: false },
    view: { underlayPrimitives: [], drawingScale: 100, requestRender: () => {} },
    viewStates: () => vs,
    selection: { set: (ids: string[]) => (sel = [...ids]), list: () => sel },
    hint: () => {},
  } as Record<string, unknown>;
  app.groundTool = new GroundTool(host);
  app.slabTool = new SlabTool(host, null);
  app.roomTool = new RoomTool(host);
  return app as unknown as AppContext;
}
