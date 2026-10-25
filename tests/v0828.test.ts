import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import type { DocStore } from '../src/core/store';
import type { Shape2DParams } from '../src/elements/drawing2d';
import { clipOutside, coverLines } from '../src/repr/cover';
import type { PolylinePrim, Primitive } from '../src/repr/primitives';
import { Draw2DTool } from '../src/ui/tools/draw2dTool';
import { shapeSmartFields } from '../src/ui/shapeFields';
import { planOf as plan, square, storeWithShapes as storeWith, toolHost as host } from './projekt';

beforeAll(() => registerBuiltInTypes());

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

describe('Det överst döljer det under (0.8.28–0.8.30)', () => {
  /** Den undre kvadratens linje, med en kvadrat över hörnet. */
  const under = (over: Partial<Shape2DParams>, underOrder = 0) =>
    linesOf(storeWith({ under: { points: square(50000, 0), closed: true, order: underOrder }, over: { points: square(50500, 500), closed: true, order: 1, ...over } }), 'under');
  const total = (lines: PolylinePrim[]) => lines.reduce((s, q) => s + length(q.closed ? [...q.points, q.points[0]] : q.points), 0);

  it('en täckande fyllning ovanför döljer linjen: hel, bakgrund med 100 % (0.8.29) och mask (0.8.30)', () => {
    const covers: Partial<Shape2DParams>[] = [{ fill: 'solid' }, { fill: 'hatch', fillBackground: '#ffffff' }, { fill: 'cross', fillBackground: 'paper' }, { fill: 'mask' }];
    // Två kanter går in i den övre kvadraten med 500 mm var.
    for (const over of covers) expect(total(under(over)), JSON.stringify(over)).toBeCloseTo(4000 - 1000, 0);
  });

  it('skraffering, genomskinligt och en bakgrund under 100 % döljer ingenting', () => {
    const open: Partial<Shape2DParams>[] = [{ fill: 'hatch' }, { fill: 'solid', opacity: 50 }, { fill: 'hatch', fillBackground: '#ffffff', fillBackgroundOpacity: 60 }];
    for (const over of open) expect(under(over), JSON.stringify(over)).toHaveLength(1);
  });

  it('den övre formens linje är hel, och skickas den undre fram döljs ingenting', () => {
    const store = storeWith({ under: { points: square(50000, 0), closed: true, order: 0 }, over: { points: square(50500, 500), closed: true, fill: 'solid', order: 1 } });
    expect(linesOf(store, 'over')).toHaveLength(1);
    expect(under({ fill: 'solid' }, 2)).toHaveLength(1);
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
