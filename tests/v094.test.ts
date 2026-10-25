import { beforeAll, describe, expect, it } from 'vitest';
import { transferSettings } from '../src/core/arrange';
import { moveElements } from '../src/core/commands';
import { DocStore } from '../src/core/store';
import { mirrorAbout } from '../src/core/wallEdit';
import { registerBuiltInTypes } from '../src/elements';
import { holeRing, type SlabHole } from '../src/elements/slab';
import { canRoundCorner, holeShape, holesOf, roundShapeCorner } from '../src/elements/shapeEdit';
import { arcFromBulge } from '../src/geometry/arc';
import { pointInRings } from '../src/geometry/vec';
import { buildModel3d } from '../src/repr/model3d';
import { buildPlan } from '../src/repr/plan';
import type { Solid } from '../src/repr/solids';
import { sampleProject } from '../src/sample/sampleProject';
import { modifyContextAt, opsFor } from '../src/ui/modify/ops';
import { ModifyTool, runInstant } from '../src/ui/modify/tool';
import { pickAt } from '../src/view2d/pick';
import type { ViewPointer } from '../src/view2d/planView';
import { square, toolHost } from './projekt';

beforeAll(() => registerBuiltInTypes());

const HOLE: SlabHole = { points: [[6000, 5000], [7200, 5000], [7200, 6500], [6000, 6500]] };
/** Exempelvillan med en håltagning i plattan. */
function withHole(hole: SlabHole = HOLE): DocStore {
  const doc = sampleProject();
  doc.elements['bj1'] = { ...doc.elements['bj1'], params: { ...doc.elements['bj1'].params, holes: [hole] } };
  return new DocStore(doc);
}
const at = (model: [number, number]) => ({ model, pointerType: 'mouse' }) as unknown as ViewPointer;
const hole = (s: DocStore) => holesOf(s.doc.elements['bj1'])[0];

describe('Avrunda och fasa hörn (0.9.4)', () => {
  const sq = holeShape({ points: square(0, 0) });

  it('avrundar med en båge som tangerar båda kanterna, och fasar med en rak kant', () => {
    const f = roundShapeCorner(sq, 2, 300, 'fillet')!;
    expect(f.points).toEqual([[0, 0], [1000, 0], [1000, 700], [700, 1000], [0, 1000]]);
    const arc = arcFromBulge([1000, 700], [700, 1000], (f.bulges as number[])[2])!;
    expect(arc.radius).toBeCloseTo(300, 0);
    expect(arc.center[0]).toBeCloseTo(700, 0);
    expect(arc.center[1]).toBeCloseTo(700, 0);
    expect(roundShapeCorner(sq, 2, 300, 'chamfer')).toEqual({ points: f.points, bulges: undefined });
  });

  it('går inte när det inte ryms, intill en båge eller i en öppen linjes ände', () => {
    expect(roundShapeCorner(sq, 2, 1200, 'fillet')).toBeNull();
    const f = roundShapeCorner(sq, 2, 300, 'fillet')!;
    const rounded = holeShape(f as unknown as SlabHole);
    expect([2, 3].map((i) => canRoundCorner(rounded, i))).toEqual([false, false]);
    expect(canRoundCorner(rounded, 0)).toBe(true);
    const open = { type: 'Shape2D', params: { shape: 'polyline', points: square(0, 0), closed: false } };
    expect([0, 1, 3].map((i) => canRoundCorner(open, i))).toEqual([false, true, false]);
  });
});

describe('Håltagningarna i Modifiera (0.9.4)', () => {
  it('ett hörn och en kant i ett hål ger 2D-formens val, och hålet flyttas och tas bort för sig', () => {
    const s = withHole();
    const host = toolHost(s, ['bj1']);
    const corner = modifyContextAt(host, at([7200, 6500]), 0, 0, null)!;
    expect(corner).toMatchObject({ kind: 'point', shapeId: 'bj1', hole: 0, index: 2 });
    const ops = opsFor(host, corner).flat();
    expect(ops).toEqual(expect.arrayContaining(['shapeMove', 'shapeRemove', 'shapeFillet', 'shapeChamfer', 'holeMove', 'holeRemove']));
    // Det allmänna (flytta, vrida …) gäller hela bjälklaget och finns inte här.
    expect(ops).not.toContain('move');
    new ModifyTool(host, 'shapeFillet', corner, 300, () => {}).applyValue(300);
    expect(hole(s).points).toHaveLength(5);
    expect(hole(s).bulges?.some((b) => b !== 0)).toBe(true);

    const edge = modifyContextAt(host, at([6600, 5000]), 0, 0, null)!;
    expect(edge).toMatchObject({ kind: 'edge', shapeId: 'bj1', hole: 0, index: 0 });
    expect(opsFor(host, edge).flat()).toEqual(expect.arrayContaining(['shapeInsert', 'shapeBend', 'shapeOffset']));
    new ModifyTool(host, 'holeMove', edge, 0, () => {}).takePoint([6600, 4000]);
    expect(hole(s).points[0]).toEqual([6000, 4000]);
    runInstant(host, 'holeRemove', edge);
    expect(holesOf(s.doc.elements['bj1'])).toHaveLength(0);
    s.undo();
    expect(holesOf(s.doc.elements['bj1'])).toHaveLength(1);
  });

  it('hål med bågar: dras ifrån i 3D, ritas med bågen i planen och krysset ligger i hålet', () => {
    const s = withHole({ ...HOLE, bulges: [300] });
    const ring = holeRing(hole(s));
    expect(ring.length).toBeGreaterThan(8);
    const slab = buildModel3d(s.doc, { state: 'st-a' }).filter((x): x is Solid => x.kind !== 'edges' && x.id === 'bj1');
    // Bågen buktar in i hålet: punkten strax innanför kantens mitt ligger i bjälklaget, inte i hålet.
    expect(slab.some((x) => pointInRings([6600, 5200], x.rings))).toBe(true);
    expect(slab.some((x) => pointInRings([6600, 5800], x.rings))).toBe(false);
    const own = buildPlan(s.doc, 'pl-1', { state: 'st-a' }).pickables.find((p) => p.id === 'bj1')!.prims.filter((p) => p.origin?.part === 'hål');
    expect(own.filter((p) => p.kind === 'polyline')).toHaveLength(1);
    const cross = own.filter((p) => p.kind === 'line' && p.a[0] !== p.b[0] && p.a[1] !== p.b[1]);
    expect(cross.length).toBeGreaterThanOrEqual(2);
    for (const c of cross) if (c.kind === 'line') expect(pointInRings([(c.a[0] + c.b[0]) / 2, (c.a[1] + c.b[1]) / 2], [ring])).toBe(true);
  });

  it('spegla vänder hålens bågar, flytta behåller dem; pipetten för inte över håltagningarna', () => {
    const s = withHole({ ...HOLE, bulges: [300] });
    moveElements(s, ['bj1'], [100, 0]);
    expect(hole(s)).toEqual({ points: [[6100, 5000], [7300, 5000], [7300, 6500], [6100, 6500]], bulges: [300] });
    mirrorAbout(s, ['bj1'], [0, 0], [0, 1000]);
    expect(hole(s).bulges).toEqual([-300]);
    s.transact('nytt', (tx) => tx.putElement({ ...tx.doc.elements['bj1'], id: 'bj2', params: { thickness: 200, outline: square(20000, 0, 4000) } }));
    transferSettings(s, 'bj1', ['bj2']);
    expect(s.doc.elements['bj2'].params).toMatchObject({ outline: square(20000, 0, 4000) });
    expect(s.doc.elements['bj2'].params.holes).toBeUndefined();
    expect(s.doc.elements['bj2'].params.fromWalls).toBeUndefined();
  });
});

describe('Bjälklagets yta går att klicka i (0.9.4)', () => {
  it('med inställningen markerar ett klick i ett rum bjälklaget; väggarna och rumsstämpeln går före', () => {
    const doc = sampleProject();
    const off = buildPlan(doc, 'pl-1', { state: 'st-a' });
    expect(pickAt(off.pickables, [2000, 2000], 50)).toBeNull();
    const on = buildPlan(doc, 'pl-1', { state: 'st-a', slabArea: true });
    expect(pickAt(on.pickables, [2000, 2000], 50)).toBe('bj1');
    expect(pickAt(on.pickables, [200, 2000], 50)).toBe('yv-v');
    const stamp = on.pickables.find((p) => p.id === 'r01')!.prims.find((p) => p.kind === 'text')!;
    expect(pickAt(on.pickables, stamp.kind === 'text' ? stamp.at : [0, 0], 50)).toBe('r01');
  });
});
