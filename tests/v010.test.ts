import { beforeAll, describe, expect, it } from 'vitest';
import { moveElements } from '../src/core/commands';
import { DocStore } from '../src/core/store';
import { mirrorAbout } from '../src/core/wallEdit';
import { registerBuiltInTypes } from '../src/elements';
import { outlineRing, roofFrame, roofPlanes, roofRange, trimToRoofs, type RoofParams } from '../src/elements/roof';
import { dragRoofGrip, roofGripsInView } from '../src/elements/roofGrips';
import { quickRoofs, trimRoof } from '../src/elements/roofMaker';
import { roofShape, shapePatch } from '../src/elements/shapeEdit';
import { buildModel3d } from '../src/repr/model3d';
import { zOn, type Edges3D, type Solid } from '../src/repr/solids';
import { sampleProject } from '../src/sample/sampleProject';
import { modifyContextAt, opsFor } from '../src/ui/modify/ops';
import { ModifyTool } from '../src/ui/modify/tool';
import { applyField } from '../src/ui/selectionEdits';
import type { ViewPointer } from '../src/view2d/planView';
import { toolHost, twoStoreys } from './projekt';

beforeAll(() => registerBuiltInTypes());

type P = [number, number];
const roof = (over: Partial<RoofParams> = {}): RoofParams => ({
  outline: [[0, -500], [10000, -500], [10000, 5000], [0, 5000]],
  ref: [[0, 0], [10000, 0]],
  height: 2700,
  slope: 27,
  thickness: 300,
  ...over,
});
const k27 = Math.tan((27 * Math.PI) / 180);
const tv27 = 300 / Math.cos((27 * Math.PI) / 180);
const at = (model: P) => ({ model, pointerType: 'mouse' }) as unknown as ViewPointer;

describe('takfallet (0.10)', () => {
  it('ligger på höjden vid referenslinjen och stiger åt vänster om den; under linjen fortsätter det nedåt', () => {
    const f = roofFrame(roof());
    expect(f.under([5000, 0])).toBeCloseTo(2700, 6);
    expect(f.under([5000, 2000])).toBeCloseTo(2700 + 2000 * k27, 6);
    expect(f.under([5000, -500])).toBeCloseTo(2700 - 500 * k27, 6);
    expect(f.top([5000, 0]) - f.under([5000, 0])).toBeCloseTo(tv27, 6);
    // Med höjden på ovansidan ligger ovansidan på höjden.
    expect(roofFrame(roof({ heightAt: 'top' })).top([3000, 0])).toBeCloseTo(2700, 6);
    // Referenslinjen vänd: taket stiger åt andra hållet.
    expect(roofFrame(roof({ ref: [[10000, 0], [0, 0]] })).under([5000, 2000])).toBeCloseTo(2700 - 2000 * k27, 6);
    expect(roofRange(roof()).underMin).toBeCloseTo(2700 - 500 * k27, 6);
  });

  it('en referenslinje med radie ger en kon: höjden följer avståndet till bågen, och bitarna möts utan glipor', () => {
    // Halvcirkel som ett burspråk, referenslinjen moturs runt centrum: taket stiger mot centrum.
    const p = roof({ outline: [[-3000, 0], [3000, 0]], bulges: [0, 3000], ref: [[-2500, 0], [2500, 0]], refBulge: -2500 });
    const f = roofFrame(p);
    expect(f.under([0, -2500])).toBeCloseTo(2700, 6);
    expect(f.under([0, -1000])).toBeCloseTo(2700 + 1500 * k27, 6);
    expect(f.under([-1000, 0])).toBeCloseTo(2700 + 1500 * k27, 6);
    const planes = roofPlanes(p);
    expect(planes.length).toBeGreaterThan(10);
    // Varje bit ligger på konen i sina hörn (inom någon millimeter).
    for (const rp of planes) for (const q of rp.rings[0]) expect(Math.abs(zOn(rp.under, q[0], q[1]) - f.under(q))).toBeLessThan(3);
    expect(roofRange(p).topMax).toBeCloseTo(2700 + 2500 * k27 + tv27, 3);
  });

  it('kapar väggar på andra våningar men drar inte upp dem (Upp till taket gäller den egna)', () => {
    // Taken på plan 2: gaveln på plan 1 har Upp till taket men går inte upp genom plan 2.
    const top = (doc: ReturnType<typeof twoStoreys>, id: string) =>
      Math.max(...buildModel3d(doc, { state: 'st-a' }).filter((s): s is Solid => s.kind !== 'edges' && s.id === id).map((s) => s.z1));
    expect(top(twoStoreys(), 'yv-o')).toBeLessThanOrEqual(2701);
    expect(top(twoStoreys(), 'yv-o-2')).toBeGreaterThan(5400);
    // Ett tak på plan 1 i 4000 mm kapar väggarna på plan 2 (golv 2700, upp till 5400).
    const doc = twoStoreys();
    doc.elements['tak-low'] = { ...structuredClone(doc.elements['tak']), id: 'tak-low', storey: 'pl-1', params: { ...doc.elements['tak'].params, ref: [[0, 0], [12000, 0]], height: 4000, slope: 0 } };
    expect(top(doc, 'yv-s-2')).toBeCloseTo(4000, 0);
    // Ett tak under väggens fot påverkar den inte.
    const piece: P[][] = [[[0, 0], [1000, 0], [1000, 200], [0, 200]]];
    expect(trimToRoofs(piece, 2700, false, [{ rings: piece, under: [0, 0, -100], top: [0, 0, 200] }])).toEqual([{ rings: piece }]);
  });

  it('i 3D syns inte skarven vid nocken mellan sadeltakets två takfall, men hörnen vid takfoten gör det (med lodrätt snitt, 0.10.2)', () => {
    const doc = sampleProject();
    for (const id of ['tak', 'tak-n']) doc.elements[id] = { ...doc.elements[id], params: { ...doc.elements[id].params, eaveCut: 'plumb' } };
    const shapes = buildModel3d(doc, { state: 'st-a' });
    for (const id of ['tak', 'tak-n']) {
      const e = shapes.find((s): s is Edges3D => s.kind === 'edges' && s.id === id)!;
      const upright = e.segments.filter((q) => q[0] === q[3] && q[1] === q[4]);
      expect(upright).toHaveLength(2);
      expect(upright.every((q) => Math.min(q[2], q[5]) < 2500)).toBe(true);
    }
  });
});

describe('snabbvalen (0.10)', () => {
  const o = { slope: 27, height: 2700, thickness: 300, eave: 500, gable: 300 };

  it('pulpet, sadel och valm ger ett, två och fyra takfall som täcker rektangeln med sprången', () => {
    const area = (r: RoofParams) => {
      const ring = outlineRing(r);
      let a = 0;
      for (let i = 0; i < ring.length; i++) a += ring[i][0] * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * ring[i][1];
      return a / 2;
    };
    const shed = quickRoofs([0, 0], [12000, 8000], { ...o, kind: 'shed' });
    const gable = quickRoofs([0, 0], [12000, 8000], { ...o, kind: 'gable' });
    const hip = quickRoofs([0, 0], [12000, 8000], { ...o, kind: 'hip' });
    expect([shed.length, gable.length, hip.length]).toEqual([1, 2, 4]);
    // Konturerna går moturs och täcker tillsammans rektangeln med sprången.
    expect(gable.reduce((s, r) => s + area(r), 0)).toBeCloseTo(12600 * 9000, -2);
    expect(hip.reduce((s, r) => s + area(r), 0)).toBeCloseTo(13000 * 9000, -2);
    // Alla takfall ligger på höjden vid ytterlivet och stiger inåt.
    for (const r of [...gable, ...hip]) {
      const f = roofFrame(r);
      expect(f.under(r.ref[0] as P)).toBeCloseTo(2700, 6);
      expect(f.under([6000, 4000])).toBeGreaterThan(2700);
    }
    // Valmens nock: alla fyra når samma höjd.
    const ridge = hip.map((r) => roofRange(r).topMax);
    for (const z of ridge) expect(z).toBeCloseTo(ridge[0], 3);
    // Ett högt hus: nocken längs y.
    const tall = quickRoofs([0, 0], [8000, 12000], { ...o, kind: 'gable' });
    expect(tall.map((r) => r.ref[0][0] === r.ref[1][0])).toEqual([true, true]);
  });
});

describe('Kapa mot tak (0.10)', () => {
  it('kapar vid nocken där takfallen möts, och behåller den sida man klickade', () => {
    const a = roof({ outline: [[0, -500], [10000, -500], [10000, 6000], [0, 6000]] });
    const b = roof({ outline: [[0, 8500], [10000, 8500], [10000, 2000], [0, 2000]], ref: [[10000, 8000], [0, 8000]] });
    const kept = trimRoof(a, b, [5000, 1000])!;
    expect(kept.outline).toEqual([[0, -500], [10000, -500], [10000, 4000], [0, 4000]]);
    expect(trimRoof(a, b, [5000, 5000])!.outline).toEqual([[0, 4000], [10000, 4000], [10000, 6000], [0, 6000]]);
    // Utan punkt: den största delen. Takfall som inte möts inom konturen: inget att kapa.
    expect(trimRoof(a, b, null)!.outline).toEqual(kept.outline);
    expect(trimRoof(roof(), roof({ ref: [[0, 20000], [10000, 20000]], height: 9000 }), null)).toBeNull();
  });

  it('i Modifiera: ett takfall kapas mot det man klickar på', () => {
    const doc = sampleProject();
    doc.elements['tak'].params.outline = [[-500, -500], [12500, -500], [12500, 6000], [-500, 6000]];
    const s = new DocStore(doc);
    const host = toolHost(s, ['tak']);
    const edge = modifyContextAt(host, at([6000, -500]), 0, 0, null)!;
    expect(edge).toMatchObject({ kind: 'edge', shapeId: 'tak' });
    expect(opsFor(host, edge).flat()).toEqual(expect.arrayContaining(['shapeInsert', 'shapeBend', 'shapeOffset', 'roofTrim', 'move']));
    const t = new ModifyTool(host, 'roofTrim', edge, 0, () => {});
    t.up(at([6000, 7000]));
    expect(s.doc.elements['tak'].params.outline).toEqual([[-500, -500], [12500, -500], [12500, 4000], [-500, 4000]]);
  });
});

describe('takfallet i Modifiera, egenskaperna och greppen (0.10)', () => {
  it('konturen ändras som en 2D-form, med bågar', () => {
    const doc = sampleProject();
    const el = doc.elements['tak'];
    const shape = roofShape(el);
    expect(shape.params.points).toEqual(el.params.outline);
    expect(shapePatch(doc, 'tak', undefined, { points: [[0, 0], [1, 0], [1, 1]], bulges: [0, 300] })).toEqual({ outline: [[0, 0], [1, 0], [1, 1]], bulges: [0, 300] });
  });

  it('flytta och spegla följer med referenslinjen; speglat stiger taket åt samma håll i förhållande till huset', () => {
    const s = new DocStore(sampleProject());
    moveElements(s, ['tak'], [100, 0]);
    expect(s.doc.elements['tak'].params.ref).toEqual([[100, 0], [12100, 0]]);
    const before = roofFrame(s.doc.elements['tak'].params as unknown as RoofParams).under([6100, 2000]);
    mirrorAbout(s, ['tak'], [6100, 0], [6100, 1000]);
    const p = s.doc.elements['tak'].params as unknown as RoofParams;
    // Speglat kring x = 6100 hamnar linjen där den låg, med samma riktning.
    expect(p.ref).toEqual([[100, 0], [12100, 0]]);
    expect(roofFrame(p).under([6100, 2000])).toBeCloseTo(before, 6);
  });

  it('höjden kan gälla ovansidan; taket ligger kvar när valet byts', () => {
    const s = new DocStore(sampleProject());
    const before = roofFrame(s.doc.elements['tak'].params as unknown as RoofParams).top([6000, 3000]);
    applyField(s, ['tak'], 'roof:heightAt', { value: 'top' } as HTMLSelectElement, { state: 'st-a' });
    const p = s.doc.elements['tak'].params as unknown as RoofParams;
    expect(p.heightAt).toBe('top');
    expect(roofFrame(p).top([6000, 3000])).toBeCloseTo(before, 0);
    applyField(s, ['tak'], 'roof:radius', { value: '8000' } as HTMLInputElement, { state: 'st-a' });
    expect(Math.abs(Number(s.doc.elements['tak'].params.refBulge))).toBeGreaterThan(0);
  });

  it('i fasaden: höjden dras vid referenslinjen och lutningen i punkten längst bort', () => {
    const doc = sampleProject();
    const grips = roofGripsInView(doc, 'fasad-2', ['tak']);
    const h = grips.find((g) => g.kind === 'height')!;
    const sl = grips.find((g) => g.kind === 'slope')!;
    expect(h.at[1]).toBe(2700);
    expect(dragRoofGrip(doc, 'fasad-2', h, [h.at[0], h.at[1] + 200])!.patch).toEqual({ height: 2900 });
    const up = dragRoofGrip(doc, 'fasad-2', sl, [sl.at[0], sl.at[1] + 600])!;
    expect(up.patch.slope).toBeGreaterThan(27);
    expect(Number.isInteger(up.patch.slope)).toBe(true);
    expect(up.text).toContain('Lutning');
  });
});
