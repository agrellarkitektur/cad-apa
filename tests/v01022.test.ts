import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { DocStore } from '../src/core/store';
import { addElements } from '../src/core/commands';
import { buildPlan } from '../src/repr/plan';
import { chainThrough, faceAround, sideOf, signedArea, simplify, type Seg } from '../src/geometry/chains';
import { drawnSegments, snapSegments } from '../src/ui/app/snapping';
import { WallTool } from '../src/ui/tools/wallTool';
import { GroundTool } from '../src/ui/tools/groundTool';
import { Draw2DTool } from '../src/ui/tools/draw2dTool';
import { wallAlong } from '../src/ui/wand/wallAlong';
import { groundAlong } from '../src/ui/wand/groundAlong';
import { shapeAround } from '../src/ui/wand/shapeAround';
import { connected, selectConnected } from '../src/ui/wand/selectConnected';
import type { WandAction } from '../src/ui/wand/wand';
import type { AppContext } from '../src/ui/app/context';
import type { Vec2 } from '../src/repr/primitives';
import { groundProject, toolHost, wallsProject } from './projekt';
import type { WallParams } from '../src/elements/wall';

beforeAll(() => registerBuiltInTypes());

/**
 * Snäpp och smartspöt (0.10.22): snäppet läser allt som ritas, kedjor och
 * slutna ytor ur lösa sträckor, och spötets funktioner i Vägg, Mark, 2D och
 * Markera.
 */

/** Det spöet och snäppet behöver av appen, utan webbläsare. Planen räknas om efter varje ändring. */
function fakeApp(store: DocStore, tool: string, state = store.doc.states.at(-1)!.id) {
  const hints: string[] = [];
  let sel: string[] = [];
  const vs = { state };
  const host = { ...toolHost(store), activeState: () => state, snapSegments: () => snapSegments(app as never), selection: { set: (ids: string[]) => (sel = [...ids]), list: () => sel } } as never;
  const app = {
    store,
    hints,
    get selected() {
      return sel;
    },
    get plan() {
      return buildPlan(store.doc, store.doc.storeys[0].id, vs);
    },
    host,
    ui: { storey: store.doc.storeys[0].id, marker: null, worksheet: null, tool },
    uiSettings: { snapTrace: false },
    view: { underlayPrimitives: [], drawingScale: 100, requestRender: () => {} },
    viewStates: () => vs,
    selection: { set: (ids: string[]) => (sel = [...ids]), list: () => sel },
    hint: (t: string) => hints.push(t),
  } as Record<string, unknown>;
  app.wallTool = new WallTool(host, { definition: null, face: 'outside', height: null });
  app.groundTool = new GroundTool(host);
  app.draw2dTool = new Draw2DTool(host);
  return app as unknown as AppContext & { hints: string[]; selected: string[]; groundTool: GroundTool };
}

const find = (a: WandAction, app: AppContext, at: Vec2, tol = 100) => a.find({ app, at, tol, shift: false });
const square = (x: number, y: number, s: number): Seg[] => [
  { a: [x, y], b: [x + s, y] },
  { a: [x + s, y], b: [x + s, y + s] },
  { a: [x + s, y + s], b: [x, y + s] },
  { a: [x, y + s], b: [x, y] },
];

describe('kedjor och slutna ytor', () => {
  it('kedjan går runt en sluten kontur och stannar där tre linjer möts', () => {
    const segs = square(0, 0, 1000);
    const c = chainThrough(segs, 2);
    expect(c.closed).toBe(true);
    expect(c.points).toHaveLength(4);
    // En fjärde linje ut från ett hörn: kedjan genom den slutar i hörnet.
    const t = chainThrough([...segs, { a: [1000, 0], b: [2000, 0] }], 4);
    expect(t.closed).toBe(false);
    expect(t.points).toEqual([[1000, 0], [2000, 0]]);
  });

  it('sidan går mellan två tydliga hörn, och raka mellanpunkter försvinner', () => {
    const c = simplify({ points: [[0, 0], [500, 0], [1000, 0], [1000, 1000], [0, 1000]], closed: true });
    expect(c.points).toHaveLength(4);
    const side = sideOf(c, 0);
    expect(side.closed).toBe(false);
    expect(side.points).toEqual([[0, 0], [1000, 0]]);
    // En båge av små bitar är en sida.
    const arc: Vec2[] = Array.from({ length: 10 }, (_, i) => [Math.cos(i / 10), Math.sin(i / 10)].map((v) => v * 5000) as unknown as Vec2);
    expect(sideOf({ points: [...arc, [0, 0]], closed: true }, 3).points).toHaveLength(10);
  });

  it('den minsta slutna ytan runt en punkt, också där linjerna korsar varandra', () => {
    // Ett rutnät av två vågräta och två lodräta linjer som sticker ut: rutan i mitten.
    const segs: Seg[] = [
      { a: [-500, 0], b: [1500, 0] },
      { a: [-500, 1000], b: [1500, 1000] },
      { a: [0, -500], b: [0, 1500] },
      { a: [1000, -500], b: [1000, 1500] },
    ];
    const f = faceAround(segs, [500, 500])!;
    expect(f).toHaveLength(4);
    expect(Math.abs(signedArea(f))).toBeCloseTo(1_000_000);
    // Utanför finns ingen sluten yta.
    expect(faceAround(segs, [1300, 1300])).toBeNull();
    // Två rutor bredvid varandra: den man pekar i.
    const two = [...square(0, 0, 1000), ...square(1000, 0, 1000)];
    expect(Math.min(...faceAround(two, [1500, 500])!.map((q) => q[0]))).toBe(1000);
  });
});

describe('snäppet läser allt som ritas', () => {
  it('bjälklag, markobjekt, grannhus, fastighetsgräns och höjdkurvor ger sträckor; texter och släntstreck inte', () => {
    const store = new DocStore(groundProject());
    const plan = buildPlan(store.doc, store.doc.storeys[0].id, { state: 'st-a' });
    const segs = drawnSegments(plan.prims);
    const types = new Set(segs.map((s) => store.doc.elements[s.id]?.type));
    for (const t of ['Slab', 'Ground', 'SiteBuilding', 'Terrain']) expect(types.has(t)).toBe(true);
    expect(segs.some((s) => s.on === 'På höjdkurvan' && s.curve)).toBe(true);
    // Släntstrecken och texterna är beteckningar.
    const parts = new Set(plan.prims.filter((p) => segs.some((s) => s.id === p.origin?.objectId)).map((p) => p.origin?.part));
    expect(parts.has('slänt')).toBe(true);
    const fromTicks = plan.prims.filter((p) => p.origin?.part === 'slänt' && p.kind === 'line').some((p) => p.kind === 'line' && segs.some((s) => s.a === p.a));
    expect(fromTicks).toBe(false);
  });
});

describe('smartspöt', () => {
  it('Vägg: väggar runt bjälklagets kontur, medurs och innanför med Ute; Tab ger bara sidan', () => {
    const store = wallsProject({});
    addElements(store, [{ type: 'Slab', storey: store.doc.storeys[0].id, tags: [], props: {}, params: { outline: [[0, 0], [8000, 0], [8000, 6000], [0, 6000]] } }], store.doc.states.at(-1)!.id, 'bjälklag');
    const app = fakeApp(store, 'wall');
    const hits = find(wallAlong, app, [4000, 30]);
    expect(hits.map((h) => h.label)).toEqual(['Väggar runt konturen', 'Vägg längs kanten']);
    expect(hits[0].what).toBe('Bjälklag');
    hits[0].apply(false);
    const walls = Object.values(store.doc.elements).filter((e) => e.type === 'Wall');
    expect(walls).toHaveLength(4);
    // Medurs, med referenslinjen i utsidan och väggen till höger (innanför).
    const ps = walls.map((w) => w.params as unknown as WallParams);
    expect(ps.every((p) => p.justification === 'right')).toBe(true);
    const ring = ps.map((p) => p.start as Vec2);
    expect(signedArea(ring)).toBeLessThan(0);
    // Väggen följs inte: spöet i väggverktyget pekar inte på väggarnas liv.
    const store2 = wallsProject({ a: [[0, 0], [5000, 0]] });
    expect(find(wallAlong, fakeApp(store2, 'wall'), [2500, 60])).toEqual([]);
  });

  it('Mark: en stödmur längs rampens sida, utanför rampen; Tab ger hela konturen', () => {
    const store = new DocStore(groundProject());
    const app = fakeApp(store, 'ground', 'st-a');
    app.groundTool.options.mode = 'wall';
    // Rampen m-ramp: referenslinjen på vänster kant (y = -6000), bredden från förvalet.
    const hits = find(groundAlong, app, [4000, -6000], 50);
    expect(hits[0].label).toBe('Stödmur längs kanten');
    expect(hits[0].what).toBe('Markobjekt');
    expect(hits[1].label).toBe('Stödmur runt konturen');
    const before = Object.keys(store.doc.elements).length;
    hits[0].apply(false);
    const wall = Object.values(store.doc.elements).at(-1)!;
    expect(Object.keys(store.doc.elements)).toHaveLength(before + 1);
    expect(wall.params.kind).toBe('wall');
    expect(wall.params.refSide).toBe('right');
    const line = wall.params.line as Vec2[];
    expect(line).toHaveLength(2);
    expect(line.every((q) => Math.abs(q[1] + 6000) < 1)).toBe(true);
    // Brytlinje i stället när verktyget står där.
    app.groundTool.options.mode = 'breakline';
    expect(find(groundAlong, app, [4000, -6000], 50)[0].label).toBe('Brytlinje längs kanten');
    // Markyta (inget linjesätt): inget förslag.
    app.groundTool.options.mode = 'area';
    expect(find(groundAlong, app, [4000, -6000], 50)).toEqual([]);
  });

  it('2D: en sluten form runt ytan mellan fyra lösa linjer, och runt bjälklagets kontur', () => {
    const store = wallsProject({});
    const line = (a: Vec2, b: Vec2) => ({ type: 'Shape2D', storey: store.doc.storeys[0].id, tags: [], props: {}, params: { shape: 'polyline', points: [a, b], weight: 0.25, linetype: 'solid' } });
    addElements(store, [line([-500, 0], [3500, 0]), line([3000, -500], [3000, 2500]), line([3500, 2000], [-500, 2000]), line([0, 2500], [0, -500])], store.doc.states.at(-1)!.id, 'linjer');
    const app = fakeApp(store, 'draw2d');
    const hits = find(shapeAround, app, [1500, 1000]);
    expect(hits[0].label).toBe('Runt den slutna ytan');
    hits[0].apply(false);
    const shape = Object.values(store.doc.elements).at(-1)!;
    expect(shape.type).toBe('Shape2D');
    expect(shape.params.closed).toBe(true);
    expect(shape.params.points).toHaveLength(4);
  });

  it('Markera: allt som hänger ihop, sedan allt av samma sort', () => {
    const store = wallsProject({ a: [[0, 0], [5000, 0]], b: [[5000, 0], [5000, 4000]], c: [[0, 8000], [5000, 8000]] });
    const app = fakeApp(store, 'select');
    const hits = find(selectConnected, app, [2500, 0]);
    expect(hits[0].preview.ids?.sort()).toEqual(['a', 'b']);
    expect(hits[1].preview.ids?.sort()).toEqual(['a', 'b', 'c']);
    hits[0].apply(false);
    expect(app.selected.sort()).toEqual(['a', 'b']);
    expect(connected(app.plan.pickables.filter((p) => p.id !== 'b'), 'a')).toEqual(['a']);
  });
});

describe('litterans vridning (D)', () => {
  it('egen vridning, annars stilmallens förval, och förvalet sparas i stilmallen', async () => {
    const { normalizeStyle } = await import('../src/core/graphics');
    const store = wallsProject({});
    const st = store.doc.states.at(-1)!.id;
    const label = (id: string, angle?: number) => ({ id, type: 'Label', storey: store.doc.storeys[0].id, states: [st], tags: [], props: {}, params: { pos: [0, 0], text: 'A', targets: [], ...(angle !== undefined ? { angle } : {}) } });
    store.transact('littera', (tx) => {
      tx.putElement(label('L1') as never);
      tx.putElement(label('L2', 0) as never);
    });
    const textAngle = (id: string) => buildPlan(store.doc, store.doc.storeys[0].id, { state: st }).prims.find((p) => p.origin?.objectId === id && p.kind === 'text')!;
    expect((textAngle('L1') as { angle?: number }).angle ?? 0).toBe(0);
    store.transact('stilmall', (tx) => {
      const g = structuredClone(tx.doc.graphics);
      g.labels.leaders.Label.angle = 90;
      tx.setGraphics(g);
    });
    expect((textAngle('L1') as { angle?: number }).angle).toBeCloseTo(Math.PI / 2);
    expect((textAngle('L2') as { angle?: number }).angle ?? 0).toBe(0);
    const style = normalizeStyle({ ...store.doc.graphics, labels: { ...store.doc.graphics.labels, leaders: { Label: { end: 'auto', stub: 3, attach: 'side', angle: 90 } } } });
    expect(style.labels.leaders.Label.angle).toBe(90);
    expect(style.labels.leaders.Wall.angle).toBeUndefined();
  });
});
