import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { DocStore } from '../src/core/store';
import type { Element } from '../src/core/model';
import type { Shape2DParams } from '../src/elements/drawing2d';
import { buildPlan } from '../src/repr/plan';
import { clipOutside, coverLines } from '../src/repr/cover';
import type { PolylinePrim, Primitive } from '../src/repr/primitives';
import { sampleProject } from '../src/sample/sampleProject';
import type { ToolHost } from '../src/ui/tools/host';
import { Draw2DTool } from '../src/ui/tools/draw2dTool';
import { shapeSmartFields } from '../src/ui/shapeFields';

beforeAll(() => registerBuiltInTypes());

const base: Shape2DParams = { shape: 'polyline', points: [], weight: 0.25, linetype: 'solid', fillAngle: 45, fillSpacing: 2 };
const square = (x: number, y: number, s = 1000): [number, number][] => [
  [x, y],
  [x + s, y],
  [x + s, y + s],
  [x, y + s],
];

function storeWith(shapes: Record<string, Partial<Shape2DParams> & { order?: number }>) {
  const doc = sampleProject();
  const storey = doc.storeys[0].id;
  for (const [id, { order, ...p }] of Object.entries(shapes))
    doc.elements[id] = { id, type: 'Shape2D', storey, states: doc.states.map((s) => s.id), tags: [], params: { ...base, ...p }, props: {}, ...(order !== undefined ? { order } : {}) } as Element;
  return new DocStore(doc);
}

const plan = (store: DocStore) => buildPlan(store.doc, store.doc.storeys[0].id, { state: store.doc.states.at(-1)!.id });
const linesOf = (store: DocStore, id: string) => plan(store).prims.filter((q): q is PolylinePrim => q.kind === 'polyline' && q.origin?.objectId === id && q.pen.weight > 0);
const length = (pts: readonly (readonly [number, number])[]) => pts.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]), 0);

describe('Linjen kapas där en täckande yta ligger över (0.8.28)', () => {
  it('kapar en sträcka genom en kvadrat i två delar', () => {
    const pieces = clipOutside([[-1000, 500], [2000, 500]], [[square(0, 0)]]);
    expect(pieces).toEqual([[[-1000, 500], [0, 500]], [[1000, 500], [2000, 500]]]);
  });

  it('lämnar linjen hel när den inte rör ytan', () => {
    const prims: Primitive[][] = [[{ kind: 'polyline', points: [[0, 5000], [1000, 5000]], closed: false, pen: { weight: 0.25 } }], [{ kind: 'region', role: 'cut', rings: [square(0, 0)], fill: { kind: 'solid', color: '#000' }, outline: null }]];
    const out = coverLines(prims);
    expect(out[0]).toBe(prims[0]);
  });
});

describe('Det överst döljer det under (0.8.28)', () => {
  it('den övre formens hela fyllning döljer den undre formens linje', () => {
    const store = storeWith({
      under: { points: square(50000, 0), closed: true, order: 0 },
      over: { points: square(50500, 500), closed: true, fill: 'solid', order: 1 },
    });
    const total = linesOf(store, 'under').reduce((s, q) => s + length(q.closed ? [...q.points, q.points[0]] : q.points), 0);
    // Två kanter går in i den övre kvadraten med 500 mm var.
    expect(total).toBeCloseTo(4000 - 1000, 0);
    // Den övre formens egen linje är hel.
    expect(linesOf(store, 'over')).toHaveLength(1);
  });

  it('skickas den undre fram döljs ingenting av den andra', () => {
    const store = storeWith({
      under: { points: square(50000, 0), closed: true, order: 2 },
      over: { points: square(50500, 500), closed: true, fill: 'solid', order: 1 },
    });
    expect(linesOf(store, 'under')).toHaveLength(1);
  });

  it('en skraffering eller en genomskinlig fyllning döljer ingenting', () => {
    for (const p of [{ fill: 'hatch' as const }, { fill: 'solid' as const, opacity: 50 }]) {
      const store = storeWith({
        under: { points: square(50000, 0), closed: true, order: 0 },
        over: { points: square(50500, 500), closed: true, order: 1, ...p },
      });
      expect(linesOf(store, 'under')).toHaveLength(1);
    }
  });
});

describe('Fyllningens färg i smartmenyn (0.8.28)', () => {
  it('visas så snart formen har en fyllning', () => {
    const store = storeWith({ a: { points: square(50000, 0), closed: true } });
    expect(shapeSmartFields(store.doc, [store.doc.elements.a]) ?? '').not.toMatch(/fillColor/);
    store.transact('fyll', (tx) => tx.putElement({ ...store.doc.elements.a, params: { ...store.doc.elements.a.params, fill: 'solid', fillColor: '#ff0000' } }));
    expect(shapeSmartFields(store.doc, [store.doc.elements.a])).toMatch(/data-key="d2:fillColor" value="#ff0000"/);
  });
});

const shapes = (store: DocStore) => Object.values(store.doc.elements).filter((e) => e.type === 'Shape2D').length;

/** Det verktyget behöver, med en markering och formerna synliga. */
function host(store: DocStore, selected: string[]): ToolHost {
  let sel = [...selected];
  return {
    store,
    selection: { set: (ids: string[]) => (sel = [...ids]), list: () => sel } as never,
    view: { requestRender: () => {}, camera: { scale: 1 }, drawingScale: 100 } as never,
    plan: () => plan(store),
    activeState: () => store.doc.states[0].id,
    storey: () => store.doc.storeys[0].id,
    snapSegments: () => [],
    hint: () => {},
  };
}

describe('Fortsätta en linje (0.8.28)', () => {
  it('ritar vidare från slutet av den markerade linjen', () => {
    const store = storeWith({ l: { points: [[50000, 0], [51000, 0]], endCap: 'arrow' } });
    const before = shapes(store);
    const t = new Draw2DTool(host(store, ['l']));
    t.setKind('polyline');
    t.takePoint([51000, 0]);
    expect(t.continuing).toBe('l');
    t.takePoint([51000, 1000]);
    t.finish(false);
    const p = store.doc.elements.l.params as unknown as Shape2DParams;
    expect(p.points).toEqual([[50000, 0], [51000, 0], [51000, 1000]]);
    expect(p.endCap).toBe('arrow');
    expect(shapes(store)).toBe(before);
  });

  it('från början vänds punkterna, bågarna byter tecken och ändarna byter plats', () => {
    const store = storeWith({ l: { points: [[50000, 0], [51000, 0]], bulges: [200], startCap: 'dot' } });
    const t = new Draw2DTool(host(store, ['l']));
    t.setKind('polyline');
    t.takePoint([50000, 0]);
    t.takePoint([50000, -1000]);
    t.finish(false);
    const p = store.doc.elements.l.params as unknown as Shape2DParams;
    expect(p.points).toEqual([[51000, 0], [50000, 0], [50000, -1000]]);
    expect(p.bulges).toEqual([-200, 0]);
    expect(p.endCap).toBe('dot');
    expect(p.startCap).toBeUndefined();
  });

  it('sluts mot första punkten och ångrar inte linjens egna punkter', () => {
    const store = storeWith({ l: { points: [[50000, 0], [51000, 0]] } });
    const t = new Draw2DTool(host(store, ['l']));
    t.setKind('polyline');
    t.takePoint([51000, 0]);
    t.takePoint([51000, 1000]);
    t.undoPoint();
    expect(t.count).toBe(2);
    t.takePoint([51000, 1000]);
    t.takePoint([50000, 0]);
    const p = store.doc.elements.l.params as unknown as Shape2DParams;
    expect(p.closed).toBe(true);
    expect(p.points).toHaveLength(3);
  });

  it('börjar en ny linje när ingen öppen form är markerad', () => {
    const store = storeWith({ l: { points: [[50000, 0], [51000, 0]] } });
    const before = shapes(store);
    const t = new Draw2DTool(host(store, []));
    t.setKind('polyline');
    t.takePoint([51000, 0]);
    expect(t.continuing).toBeNull();
    t.takePoint([52000, 0]);
    t.finish(false);
    expect(shapes(store)).toBe(before + 1);
  });
});
