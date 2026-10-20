import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { addElement, addWithAsset, deleteElements, moveElements, renameElement, setGraphics, updateParams } from '../src/core/commands';
import { DocStore } from '../src/core/store';
import type { ProjectDoc } from '../src/core/model';
import type { ViewStates } from '../src/core/states';
import { buildPlan } from '../src/repr/plan';
import { furnitureType } from '../src/elements/furniture';
import { sampleProject } from '../src/sample/sampleProject';
import { roomGrid } from './projekt';
import { readFileSync } from 'node:fs';
import { parseDxf } from '../src/formats/dxf';
import type { UnderlayParams } from '../src/elements/underlay';
import { flushSnap, snap, snapIndex, type SnapSegment } from '../src/ui/tools/snap';
import type { Vec2 } from '../src/repr/primitives';

beforeAll(() => registerBuiltInTypes());

/**
 * Planen med cachen (0.8.3) ska bli exakt samma som en plan räknad från
 * början. En djup kopia av dokumentet har nya objekt överallt, så den
 * träffar ingen cache.
 */
function sameAsFresh(doc: ProjectDoc, view: ViewStates): void {
  const storey = doc.storeys[0].id;
  const cached = buildPlan(doc, storey, view);
  const fresh = buildPlan(structuredClone(doc), storey, view);
  expect(JSON.stringify(cached.prims)).toBe(JSON.stringify(fresh.prims));
  expect(JSON.stringify(cached.pickables)).toBe(JSON.stringify(fresh.pickables));
}

function edits(store: DocStore, view: ViewStates): void {
  const doc = () => store.doc;
  const ofType = (t: string) => Object.values(doc().elements).filter((e) => e.type === t);
  const check = () => sameAsFresh(doc(), view);
  check();
  check(); // oförändrat: samma svar ur cachen
  const wall = ofType('Wall')[1];
  moveElements(store, [wall.id], [150, 0]);
  check();
  const door = ofType('Door')[0];
  if (door) {
    updateParams(store, [door.id], { at: (door.params as { at: number }).at + 100 });
    check();
  }
  addElement(store, { type: 'Furniture', storey: doc().storeys[0].id, params: { ...furnitureType.defaults(), origin: [1000, 1000] } }, view.state);
  check();
  const room = ofType('Space')[0];
  if (room) {
    renameElement(store, room.id, 'Nytt namn');
    check();
  }
  deleteElements(store, [ofType('Wall')[2].id]);
  check();
  store.undo();
  check();
  store.undo();
  check();
  setGraphics(store, structuredClone(doc().graphics), 'Stilmall');
  check();
}

describe('planen med cache (0.8.3)', () => {
  it('exempelprojektet: samma plan som utan cache efter varje ändring', () => {
    const store = new DocStore(sampleProject());
    const d = store.doc;
    edits(store, { state: d.states[1].id, compareTo: d.states[0].id });
  });

  it('ett rutnät av rum: samma plan som utan cache, också i Befintligt', () => {
    const store = new DocStore(roomGrid(3));
    const d = store.doc;
    edits(store, { state: d.states[1].id, compareTo: d.states[0].id });
    edits(store, { state: d.states[0].id });
  });

  it('en ny möbel ritar inte om väggarna, en flyttad vägg gör det', () => {
    const store = new DocStore(roomGrid(3));
    const d = store.doc;
    const view = { state: d.states[1].id, compareTo: d.states[0].id };
    const storey = d.storeys[0].id;
    const wallId = Object.values(d.elements).find((e) => e.type === 'Wall')!.id;
    const pick = () => buildPlan(store.doc, storey, view).pickables.find((p) => p.id === wallId);
    const before = pick();
    addElement(store, { type: 'Furniture', storey, params: { ...furnitureType.defaults(), origin: [500, 500] } }, view.state);
    expect(pick()).toBe(before);
    moveElements(store, [wallId], [50, 0]);
    expect(pick()).not.toBe(before);
  });

  it('oförändrat dokument ger samma svar, så att planvyn inte ritar om', () => {
    const doc = roomGrid(2);
    const view = { state: doc.states[1].id, compareTo: doc.states[0].id };
    const a = buildPlan(doc, doc.storeys[0].id, view);
    const b = buildPlan(doc, doc.storeys[0].id, { ...view });
    expect(b).toBe(a);
  });
});

describe('snäppning nära markören (0.8.3)', () => {
  it('samma svar med rutnätet som när alla sträckor prövas', () => {
    // Ett slumpat men upprepbart rutnät av sträckor, som väggar och ett DXF-underlag.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const segments: SnapSegment[] = [];
    for (let i = 0; i < 1500; i++) {
      const a: Vec2 = [Math.round(rnd() * 40000), Math.round(rnd() * 40000)];
      const horiz = rnd() < 0.45;
      const len = 300 + rnd() * 4000;
      const b: Vec2 = horiz ? [a[0] + len, a[1]] : rnd() < 0.8 ? [a[0], a[1] + len] : [a[0] + len * 0.6, a[1] + len * 0.8];
      segments.push({ id: `s${i % 300}`, a, b });
    }
    const outline: Vec2[][] = [[[0, 0], [900, 0], [900, 600], [0, 600]]];
    let hits = 0;
    for (let k = 0; k < 400; k++) {
      const cursor: Vec2 = [rnd() * 40000, rnd() * 40000];
      const from: Vec2 | undefined = k % 3 ? [cursor[0] + (rnd() - 0.5) * 6000, cursor[1] + (rnd() - 0.5) * 6000] : undefined;
      const tol = k % 2 ? 26 : 80;
      const input = { cursor, from, segments, tol, ortho: k % 5 === 0, exclude: new Set([`s${k % 300}`]) };
      snapIndex.from = 200;
      const fast = snap(input);
      // Möbeln flyttad så att en kant hamnar nära en sträcka, för att kant i kant ska träffa.
      const s0 = segments[k % segments.length];
      const d: Vec2 = k % 2 ? [s0.a[0] + 10, s0.a[1] - 600 + 7] : cursor;
      const flushFast = flushSnap(outline, segments, d, tol);
      snapIndex.from = Infinity;
      const slow = snap(input);
      const flushSlow = flushSnap(outline, segments, d, tol);
      if (flushFast) hits++;
      expect(fast).toEqual(slow);
      expect(flushFast).toEqual(flushSlow);
    }
    snapIndex.from = 200;
    expect(hits).toBeGreaterThan(20);
  });
});

describe('skraffering i DXF-underlag (0.8.3)', () => {
  // Två skrafferingar skrivna av ezdxf: solid med ett hål (polylinjer), och
  // ANSI31 i 45° vars kontur har en medurs båge (kanter).
  const text = readFileSync(new URL('./filer/skraffering.dxf', import.meta.url), 'utf8');
  const area = (r: readonly (readonly number[])[]) => Math.abs(r.reduce((a, p, i) => a + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0) / 2);

  it('konturer, fyllning och mönster läses', () => {
    const d = parseDxf(text);
    const fills = d.items.filter((i) => i.kind === 'fill');
    expect(fills).toHaveLength(2);
    const [solid, ansi] = fills as Extract<(typeof d.items)[number], { kind: 'fill' }>[];
    expect(solid.layer).toBe('Fyll');
    expect(solid.solid).toBe(true);
    expect(solid.rings.map(area)).toEqual([12e6, 1e6]);
    expect(ansi.solid).toBe(false);
    expect(ansi.rings).toHaveLength(1);
    // 3 × 3 m med en halvcirkel (r = 1,5 m) urtagen uppifrån, som ezdxf
    // själv läser bågen (5 475 793 mm² med ezdxf:s uppdelning i rakor).
    expect(Math.abs(area(ansi.rings[0]) / 5475793 - 1)).toBeLessThan(0.005);
    expect(Math.min(...ansi.rings[0].filter((q) => q[0] > 16100 && q[0] < 18900).map((q) => q[1]))).toBeCloseTo(1500, -1);
    expect(ansi.lines).toHaveLength(1);
    expect(ansi.lines[0].angle).toBeCloseTo(90);
    expect(ansi.lines[0].spacing).toBeCloseTo(31.75);
    expect(d.bounds).toEqual({ minX: 0, minY: 0, maxX: 19000, maxY: 3000 });
  });

  it('ritas som ytor i underlaget, med mönstrets avstånd på papper', () => {
    const store = new DocStore(sampleProject());
    const asset = { id: 'fil-h', name: 'skraffering.dxf', mime: 'application/dxf', data: btoa(text) };
    const params: UnderlayParams = { asset: 'fil-h', kind: 'dxf', pos: [0, 0], angle: 10, scale: 2, size: [19000, 3000], ref: [0, 0], opacity: 80 };
    const el = addWithAsset(store, asset, { type: 'Underlay', name: 'Skraffering', storey: 'pl-1', tags: [], props: {}, params: params as unknown as Record<string, unknown> }, 'st-a', 'Lägg in');
    const view = { state: 'st-a', compareTo: 'st-bef' };
    const mine = buildPlan(store.doc, 'pl-1', view).pickables.find((pk) => pk.id === el.id)!;
    const regions = mine.prims.filter((q) => q.kind === 'region');
    expect(regions).toHaveLength(2);
    const [solid, hatch] = regions.map((q) => (q.kind === 'region' ? q : null)!);
    expect(solid.fill).toMatchObject({ kind: 'solid' });
    expect(solid.rings).toHaveLength(2);
    // Vriden 10° och skalad 2: linjerna i 100°, 2 × 31,75 mm i modellen = 0,635 mm på papper i 1:100.
    expect(hatch.fill).toMatchObject({ kind: 'hatch' });
    if (hatch.fill.kind === 'hatch') {
      expect(hatch.fill.angle).toBeCloseTo(100);
      expect(hatch.fill.spacing).toBeCloseTo(0.635);
    }
    // Släckt lager: ingen fyllning.
    const off = addWithAsset(store, null, { type: 'Underlay', name: 'Skraffering', storey: 'pl-1', tags: [], props: {}, params: { ...params, layersOff: ['Fyll'] } as unknown as Record<string, unknown> }, 'st-a', 'Lägg in igen');
    const other = buildPlan(store.doc, 'pl-1', view).pickables.find((pk) => pk.id === off.id)!;
    expect(other.prims.filter((q) => q.kind === 'region')).toHaveLength(1);
  });
});
