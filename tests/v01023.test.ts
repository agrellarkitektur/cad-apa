import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { DocStore } from '../src/core/store';
import { addElements } from '../src/core/commands';
import { buildPlan } from '../src/repr/plan';
import { fitArcs } from '../src/geometry/arcFit';
import { signedArea } from '../src/geometry/chains';
import { snapSegments } from '../src/ui/app/snapping';
import { WallTool } from '../src/ui/tools/wallTool';
import { GroundTool } from '../src/ui/tools/groundTool';
import { Draw2DTool } from '../src/ui/tools/draw2dTool';
import { SlabTool } from '../src/ui/tools/slabTool';
import { RoofTool } from '../src/ui/tools/roofTool';
import { RoomTool } from '../src/ui/tools/roomTool';
import { LabelTool } from '../src/ui/tools/labelTool';
import { DimensionTool } from '../src/ui/tools/annotationTools';
import { wallAlong } from '../src/ui/wand/wallAlong';
import { lineAlong } from '../src/ui/wand/lineAlong';
import { shapeAround } from '../src/ui/wand/shapeAround';
import { slabFrom } from '../src/ui/wand/slabFrom';
import { roofOver } from '../src/ui/wand/roofOver';
import { groundArea } from '../src/ui/wand/groundArea';
import { groundAlong } from '../src/ui/wand/groundAlong';
import { labelOn } from '../src/ui/wand/labelOn';
import { dimWall } from '../src/ui/wand/dimWall';
import type { WandAction } from '../src/ui/wand/wand';
import type { AppContext } from '../src/ui/app/context';
import type { Vec2 } from '../src/repr/primitives';
import { groundProject, toolHost, wallsProject } from './projekt';

beforeAll(() => registerBuiltInTypes());

/**
 * Smartspöt del 2 (0.10.23): bågar ur kedjor, och spöet i Bjälklag, Tak,
 * Mark (markyta), 2D (linje), Littera och Mått.
 */

/** Det spöet behöver av appen, utan webbläsare. Planen räknas om efter varje ändring. */
function fakeApp(store: DocStore, tool: string, state = store.doc.states.at(-1)!.id) {
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
  app.wallTool = new WallTool(host, { definition: null, face: 'outside', height: null });
  app.groundTool = new GroundTool(host);
  app.draw2dTool = new Draw2DTool(host);
  app.slabTool = new SlabTool(host, null);
  app.roofTool = new RoofTool(host);
  app.roomTool = new RoomTool(host);
  app.labelTool = new LabelTool(host);
  app.dimensionTool = new DimensionTool(host);
  return app as unknown as AppContext;
}

const find = (a: WandAction, app: AppContext, at: Vec2, tol = 100) => a.find({ app, at, tol, shift: false });
const last = (store: DocStore) => Object.values(store.doc.elements).at(-1)!;
const ofType = (store: DocStore, t: string) => Object.values(store.doc.elements).filter((e) => e.type === t);

/** Punkter på en båge, som de ritas: korta raka bitar. */
const arcPts = (c: Vec2, r: number, a0: number, a1: number, n: number): Vec2[] => Array.from({ length: n + 1 }, (_, i) => [c[0] + r * Math.cos(a0 + ((a1 - a0) * i) / n), c[1] + r * Math.sin(a0 + ((a1 - a0) * i) / n)]);

/** Ett hus av fyra väggar, 8 × 6 m (mitt i väggarna), 200 tjocka. */
const house = (extra: Parameters<typeof wallsProject>[2] = {}, lines: Parameters<typeof wallsProject>[1] = {}) =>
  wallsProject({ a: [[0, 0], [8000, 0]], b: [[8000, 0], [8000, 6000]], c: [[8000, 6000], [0, 6000]], d: [[0, 6000], [0, 0]] }, lines, extra);

describe('bågar ur kedjor', () => {
  it('en rak kant, en kvartsbåge av korta bitar och en rak kant till blir tre kanter med en båge', () => {
    const pts: Vec2[] = [[-3000, 0], ...arcPts([0, 2000], 2000, -Math.PI / 2, 0, 23), [2000, 5000]];
    const a = fitArcs({ points: pts, closed: false });
    expect(a.points).toHaveLength(4);
    expect(a.bulges[0]).toBe(0);
    expect(a.bulges[2]).toBe(0);
    // Kvartsbågen med radien 2000 buktar åt höger sett från start (moturs runt centrum): pilhöjden 2000·(1 − cos 45°).
    expect(Math.abs(a.bulges[1])).toBeCloseTo(2000 * (1 - Math.SQRT1_2), 0);
  });

  it('en hel cirkel blir två halvcirklar; en polygon med hörn och en ojämn kurva blir inga bågar', () => {
    const circle = arcPts([0, 0], 1500, 0, 2 * Math.PI, 64).slice(0, 64);
    const c = fitArcs({ points: circle, closed: true });
    expect(c.points).toHaveLength(2);
    expect(c.bulges.map((b) => Math.abs(b))).toEqual([1500, 1500]);
    const box = fitArcs({ points: [[0, 0], [1000, 0], [1000, 1000], [0, 1000]], closed: true });
    expect(box.points).toHaveLength(4);
    expect(box.bulges.every((b) => b === 0)).toBe(true);
    const wiggle: Vec2[] = Array.from({ length: 40 }, (_, i) => [i * 300, 200 * Math.sin(i * 1.7) + 37 * Math.cos(i * 3.1)]);
    expect(fitArcs({ points: wiggle, closed: false }).bulges.every((b) => b === 0)).toBe(true);
  });

  it('väggar och 2D-linjer längs en cirkel blir bågar', () => {
    const store = wallsProject({});
    const st = store.doc.states.at(-1)!.id;
    addElements(store, [{ type: 'Shape2D', storey: store.doc.storeys[0].id, tags: [], props: {}, params: { shape: 'polyline', points: [[3000, 0], [-3000, 0]], bulges: [3000, 3000], closed: true, weight: 0.25, linetype: 'solid' } }], st, 'cirkel');
    const app = fakeApp(store, 'wall');
    const hits = find(wallAlong, app, [0, 3000]);
    expect(hits[0].label).toBe('Väggar runt konturen');
    hits[0].apply(false);
    const walls = ofType(store, 'Wall').map((w) => w.params as { bulge?: number });
    expect(walls).toHaveLength(2);
    expect(walls.every((p) => Math.abs(Math.abs(p.bulge ?? 0) - 3000) < 5)).toBe(true);
    // 2D: linjen runt cirkeln är sluten och har två bågar.
    const app2 = fakeApp(store, 'draw2d');
    const line = find(lineAlong, app2, [0, -3000])[0];
    expect(line.label).toBe('Linje runt konturen');
    line.apply(false);
    const shape = last(store).params as { bulges?: number[]; closed?: boolean };
    expect(shape.closed).toBe(true);
    expect(shape.bulges?.map((b) => Math.round(Math.abs(b)))).toEqual([3000, 3000]);
  });
});

describe('smartspöt i fler verktyg', () => {
  it('2D: kanten före ytan; en öppen linje längs sidan och sedan hela konturen', () => {
    const store = wallsProject({}, { r: [[0, 0], [4000, 0], [4000, 3000], [0, 3000], [0, 0]] });
    const app = fakeApp(store, 'draw2d');
    const hits = find(lineAlong, app, [2000, 20]);
    expect(hits.map((h) => h.label)).toEqual(['Linje längs kanten', 'Linje runt konturen']);
    hits[0].apply(false);
    expect(last(store).params.points).toEqual([[0, 0], [4000, 0]]);
    expect(last(store).params.closed).toBeFalsy();
    // Mitt i ytan, långt från kanterna: ingen linje, men formen runt ytan.
    expect(find(lineAlong, app, [2000, 1500])).toEqual([]);
    expect(find(shapeAround, app, [2000, 1500]).length).toBeGreaterThan(0);
  });

  it('Bjälklag: i rummet innanför väggarna, ur en 2D-form, och en håltagning med bågar', () => {
    const store = house({}, { f: [[10000, 0], [14000, 0], [14000, 3000], [10000, 3000], [10000, 0]] });
    const app = fakeApp(store, 'slab');
    const hits = find(slabFrom, app, [4000, 3000]);
    expect(hits[0].label).toBe('Bjälklag innanför väggarna');
    expect(hits.at(-1)!.label).toBe('Bjälklag innanför ytterväggarna');
    hits[0].apply(false);
    const slab = last(store);
    expect(slab.type).toBe('Slab');
    const outline = slab.params.outline as Vec2[];
    expect(Math.abs(signedArea(outline))).toBeCloseTo(7800 * 5800, -3);
    // Ur 2D-formen bredvid huset.
    // (En öppen 2D-linje har ingen yta att klicka i: ytan mellan linjerna.)
    const f = find(slabFrom, app, [12000, 1500]);
    expect(f[0].label).toBe('Bjälklag i den slutna ytan');
    // Håltagning: en cirkel i bjälklaget blir ett hål med bågarna kvar.
    addElements(store, [{ type: 'Shape2D', storey: store.doc.storeys[0].id, tags: [], props: {}, params: { shape: 'polyline', points: [[3500, 3000], [4500, 3000]], bulges: [500, 500], closed: true, weight: 0.25, linetype: 'solid' } }], store.doc.states.at(-1)!.id, 'cirkel');
    app.slabTool.options.mode = 'hole';
    const h = find(slabFrom, app, [4000, 3100]);
    expect(h[0].label).toMatch(/^Håltagning /);
    h[0].apply(false);
    const holes = store.doc.elements[slab.id].params.holes as { points: Vec2[]; bulges?: number[] }[];
    expect(holes).toHaveLength(1);
    expect(holes[0].bulges?.map((b) => Math.round(Math.abs(b)))).toEqual([500, 500]);
  });

  it('Tak: takfall över väggarna med takfoten utanför, och sadeltak över rektangeln', () => {
    const store = house();
    const app = fakeApp(store, 'roof');
    app.roofTool.options.mode = 'face';
    const hits = find(roofOver, app, [4000, 500]);
    expect(hits[0].label).toBe('Takfall över väggarna');
    hits[0].apply(false);
    const roof = last(store).params as { outline: Vec2[]; ref: [Vec2, Vec2] };
    const xs = roof.outline.map((q) => q[0]);
    const ys = roof.outline.map((q) => q[1]);
    // Husets utsida −100 … 8100 och takfoten 500 utanför.
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([-600, 8600, -600, 6600]);
    // Referenslinjen i takfoten vid kanten närmast (y = −600), och taket stiger inåt (åt vänster om linjen).
    expect(roof.ref.every((q) => q[1] === -600)).toBe(true);
    expect(roof.ref[1][0] - roof.ref[0][0]).toBeGreaterThan(0);
    app.roofTool.options.mode = 'gable';
    const g = find(roofOver, app, [4000, 500]);
    expect(g[0].label).toBe('Sadeltak över väggarna');
    const before = ofType(store, 'Roof').length;
    g[0].apply(false);
    expect(ofType(store, 'Roof').length).toBe(before + 2);
  });

  it('Markyta: runt huset i huset, och ur en 2D-form', () => {
    const store = new DocStore(groundProject());
    const app = fakeApp(store, 'ground', 'st-a');
    app.groundTool.options.mode = 'area';
    addElements(store, [{ type: 'Shape2D', storey: store.doc.storeys[0].id, tags: [], props: {}, params: { shape: 'polyline', points: [[30000, 20000], [34000, 20000], [34000, 23000], [30000, 23000]], closed: true, weight: 0.25, linetype: 'solid' } }], 'st-a', 'form');
    const f = find(groundArea, app, [32000, 21500]);
    expect(f[0].label).toMatch(/^Markyta (ur konturen|i den slutna ytan)$/);
    f[0].apply(false);
    const g = last(store);
    expect(g.type).toBe('Ground');
    expect(g.params.kind).toBe('area');
    expect(g.params.outline).toHaveLength(4);
    expect(typeof g.params.height).toBe('number');
    // Linjesätten har sina förslag i groundAlong, inte här.
    app.groundTool.options.mode = 'wall';
    expect(find(groundArea, app, [32000, 21500])).toEqual([]);
    expect(find(groundAlong, app, [32000, 20000], 50)[0].label).toBe('Stödmur längs kanten');
  });

  it('Markyta: i huset först runt huset', () => {
    const store = house();
    const app = fakeApp(store, 'ground');
    app.groundTool.options.mode = 'area';
    expect(find(groundArea, app, [4000, 3000])[0].label).toBe('Markyta runt huset');
  });

  it('Littera: ett klick på väggen ger en littera som sitter i den', () => {
    const store = house();
    const app = fakeApp(store, 'label');
    const hits = find(labelOn, app, [4000, 0]);
    expect(hits[0].what).toBe('Vägg');
    hits[0].apply(false);
    const l = last(store);
    expect(l.type).toBe('Label');
    expect((l.params.targets as { id?: string }[])[0].id).toBe('a');
    expect(l.params.text).toBe('{typ}');
    expect(l.params.pos).toEqual([4800, 800]);
  });

  it('Mått: kedjan längs väggen över dörren och den anslutande innerväggen, på den sida man pekar', () => {
    const store = house({ door: { type: 'Door', params: { at: 2000, width: 900, height: 2100, swing: 1, hinge: 'start', glazed: false, frameWidth: 50, frameDepth: 100, inset: null } } });
    store.transact('dörr och innervägg', (tx) => {
      tx.putElement({ ...store.doc.elements.door, host: 'a' });
      tx.putElement({ ...store.doc.elements.a, id: 'e', params: { ...store.doc.elements.a.params, start: [5000, 0], end: [5000, 6000] } });
    });
    const app = fakeApp(store, 'dimension');
    // Utsidan (y < 0): från hörnet till hörnet, med dörrens hål och innerväggens två liv.
    const hits = find(dimWall, app, [4000, -50]);
    expect(hits.map((h) => h.label)).toEqual(['Måttkedja på den här sidan', 'Måttkedja på andra sidan']);
    hits[0].apply(false);
    const d = last(store).params as { points: ({ at: Vec2 } | Vec2)[]; angle: number; offset: number };
    const xs = d.points.map((q) => (Array.isArray(q) ? q[0] : (q as { at: Vec2 }).at[0]));
    const w = (900 + 0) / 2;
    expect(xs[0]).toBeLessThanOrEqual(0);
    expect(xs).toContain(4900);
    expect(xs).toContain(5100);
    expect(xs.some((x) => Math.abs(x - (2000 - w)) < 40)).toBe(true);
    expect(d.angle).toBe(0);
    expect(d.offset).toBeLessThan(0);
    // Punkterna sitter i väggarnas liv, så att kedjan följer med.
    expect(d.points.filter((q) => !Array.isArray(q)).length).toBeGreaterThan(3);
  });
});
