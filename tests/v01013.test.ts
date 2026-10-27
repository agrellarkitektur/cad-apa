import { beforeAll, describe, expect, it } from 'vitest';
import { moveVertically, setLevel } from '../src/core/levels';
import { DocStore } from '../src/core/store';
import { registerBuiltInTypes } from '../src/elements';
import { modelShapes, WITHOUT_DEMOLISHED } from '../src/repr/storeyShapes';
import type { Solid } from '../src/repr/solids';
import { sampleProject } from '../src/sample/sampleProject';
import { addCrestPoint, crestSuggestion } from '../src/ui/modify/tool';
import { crestDragTo, crestGripsShown } from '../src/ui/tools/selectGrips';
import { addGround, onSlope, planCtx, toolHost } from './projekt';
import { updateParams } from '../src/core/commands';
import { markerFrame } from '../src/elements/markers';
import { massBalance } from '../src/elements/groundGeometry';
import { buildingHeight } from '../src/repr/buildingHeight';
import { buildSection } from '../src/repr/section';
import { markerHeights } from '../src/repr/sectionLevels';

beforeAll(() => registerBuiltInTypes());

const solidsOf = (s: DocStore, id: string): Solid[] =>
  modelShapes(s.doc, { state: s.doc.states.at(-1)!.id }, s.doc.graphics, WITHOUT_DEMOLISHED).shapes.map((x) => x.s).filter((x): x is Solid => x.kind !== 'edges' && x.id === id);

describe('Höjder i förhållande till våningen (0.10.13)', () => {
  it('foten i egenskaperna flyttar bara foten; Flytta i höjd flyttar hela väggen', () => {
    const s = new DocStore(sampleProject());
    const win = Object.values(s.doc.elements).find((e) => e.type === 'Window' && e.host)!;
    const wall = s.doc.elements[win.host!];
    const top = Math.max(...solidsOf(s, wall.id).map((x) => x.z1));
    const winLow = Math.min(...solidsOf(s, win.id).map((x) => x.z0));

    expect(setLevel(s, [wall.id], 300)).toBe(true);
    const after = solidsOf(s, wall.id);
    expect(Math.min(...after.map((x) => x.z0))).toBe(300);
    expect(Math.max(...after.map((x) => x.z1))).toBeCloseTo(top);
    // Fönstret ligger kvar mot våningens golv sedan 0.10.14 (v01014.test.ts).
    expect(Math.min(...solidsOf(s, win.id).map((x) => x.z0))).toBeCloseTo(winLow);
    // Lägre än 10 mm går inte.
    expect(setLevel(s, [wall.id], top - 5)).toBe(false);

    expect(moveVertically(s, [wall.id], -500)).toBe(1);
    const moved = solidsOf(s, wall.id);
    expect(Math.min(...moved.map((x) => x.z0))).toBe(-200);
    expect(Math.max(...moved.map((x) => x.z1))).toBeCloseTo(top - 500);
  });

  it('bjälklagets ovansida och möbelns undersida följer nivån; taket flyttas med sin höjd', () => {
    const s = new DocStore(sampleProject());
    const slab = Object.values(s.doc.elements).find((e) => e.type === 'Slab')!;
    const roof = Object.values(s.doc.elements).find((e) => e.type === 'Roof')!;
    setLevel(s, [slab.id], -50);
    expect(Math.max(...solidsOf(s, slab.id).map((x) => x.z1))).toBe(-50);
    const h = Number(roof.params.height);
    moveVertically(s, [roof.id], 200);
    expect(s.doc.elements[roof.id].params.height).toBe(h + 200);
    // Låst flyttas inte.
    s.transact('lås', (tx) => tx.putElement({ ...s.doc.elements[roof.id], locked: true }));
    expect(moveVertically(s, [roof.id], 200)).toBe(0);
  });
});

describe('Stödmurens höjdpunkter (0.10.13)', () => {
  it('höjden skrivs när punkten läggs, och punkten dras längs referenslinjen', () => {
    const store = onSlope();
    const wall = addGround(store, { kind: 'wall', outline: [], line: [[20000, -6000], [20000, 6000]] });
    const host = toolHost(store, [wall]);
    const ctx = { ids: [wall], kind: 'edge' as const, shapeId: wall, index: 0, at: [20000, 0] as [number, number], clientX: 0, clientY: 0 };
    const sug = crestSuggestion(host, ctx)!;
    expect(sug).not.toBeNull();
    // Med plats skrivs höjden i meter i RH 2000.
    expect(sug.unit).toBe(store.doc.site ? 'm' : 'mm');
    addCrestPoint(host, ctx, store.doc.site ? sug.value + 0.5 : sug.value + 500);
    const crest = () => store.doc.elements[wall].params.crest as { at: [number, number]; h: number }[];
    expect(crest()[0].h).toBeCloseTo(sug.h + 500, 0);
    // Utan skrivet värde: krönets höjd där.
    addCrestPoint(host, { ...ctx, at: [20000, 3000] });
    expect(crest()).toHaveLength(2);
    // Greppet ligger på linjen; en dragning landar på linjen, inte utanför ändarna.
    expect(crestGripsShown(host).map((g) => g.at[0])).toEqual([20000, 20000]);
    expect(crestDragTo(host, wall, [21000, 2500])).toEqual([20000, 2500]);
    expect(crestDragTo(host, wall, [20000, 9000])).toEqual([20000, 5900]);
  });
});

describe('BH, NH och TH flyttas för hand (0.10.13)', () => {
  it('flyttningen i sidled sparas på markören och flyttar bara det måttet', () => {
    const store = onSlope();
    const bh = buildingHeight(planCtx(store))!;
    const el = Object.values(store.doc.elements).find((e) => e.type === 'Elevation' && markerHeights(e, markerFrame(store.doc, e).view, bh).bh)!;
    updateParams(store, [el.id], { heights: { bh: true, nh: true, th: false, mmnOld: false } }, 'Höjder');
    const xOf = (key: string) => {
      const line = buildSection(store.doc, el.id, { state: 'st-a' })!.prims.find((q) => q.kind === 'line' && q.origin?.part === `höjd-${key}` && Math.abs(q.a[0] - q.b[0]) < 0.01);
      return line && line.kind === 'line' ? line.a[0] : NaN;
    };
    const bh0 = xOf('bh');
    const nh0 = xOf('nh');
    updateParams(store, [el.id], { heightOffsets: { bh: -4000 } }, 'Flytta höjdmåttet');
    expect(xOf('bh')).toBeCloseTo(bh0 - 4000, 0);
    expect(xOf('nh')).toBeCloseTo(nh0, 0);
    // Kryssrutorna behåller flyttningen.
    updateParams(store, [el.id], { heights: { bh: true, nh: false, th: false, mmnOld: false } }, 'Höjder');
    expect(xOf('bh')).toBeCloseTo(bh0 - 4000, 0);
  });
});

describe('Markobjektens massor (0.10.13)', () => {
  it('netto är fyll minus schakt; berget är en andel av schakten', () => {
    expect(massBalance({ cut: 40, fill: 10 })).toEqual({ net: -30, rock: null, soil: null });
    const m = massBalance({ cut: 40, fill: 10 }, 25);
    expect(m.rock).toBeCloseTo(10);
    expect(m.soil).toBeCloseTo(30);
  });
});
