import { beforeAll, describe, expect, it } from 'vitest';
import { moveElements } from '../src/core/commands';
import type { ProjectDoc } from '../src/core/model';
import { DocStore } from '../src/core/store';
import { registerBuiltInTypes } from '../src/elements';
import { roofFrame, type RoofParams } from '../src/elements/roof';
import { bodyEdges, cutPlane, ownCut, roofBody } from '../src/elements/roofBody';
import { quickRoofs } from '../src/elements/roofMaker';
import { buildModel3d } from '../src/repr/model3d';
import { buildPlan } from '../src/repr/plan';
import type { LinePrim, Primitive, Vec2 } from '../src/repr/primitives';
import { zOn, type Solid } from '../src/repr/solids';
import { sampleProject } from '../src/sample/sampleProject';
import { isShown, setShown } from '../src/ui/app/showKeys';
import { modifyContextAt, opsFor } from '../src/ui/modify/ops';
import { ModifyTool, runInstant } from '../src/ui/modify/tool';
import type { ViewPointer } from '../src/view2d/planView';
import { toolHost, twoStoreys } from './projekt';

beforeAll(() => registerBuiltInTypes());

const deg = Math.PI / 180;
const at = (model: [number, number]) => ({ model, pointerType: 'mouse' }) as unknown as ViewPointer;
// Exempelvillans södra takfall: takfot vid y = -500, nock vid y = 4000, huset (ytterväggarnas utsida) 0–12000 × 0–8000.
const south = (doc: ProjectDoc, over: Partial<RoofParams> = {}) => {
  doc.elements['tak'] = { ...doc.elements['tak'], params: { ...doc.elements['tak'].params, ...over } };
  return doc;
};
const roofSolids = (doc: ProjectDoc, id = 'tak') => buildModel3d(doc, { state: 'st-a' }).filter((s): s is Solid => s.kind !== 'edges' && s.id === id);
const roofLines = (prims: readonly Primitive[], id = 'tak') => prims.filter((p): p is LinePrim => p.kind === 'line' && p.origin?.objectId === id);

describe('takfotens snitt (0.10.2)', () => {
  it('takfoten snittas vinkelrätt mot takytan från början: en remsa längs kanten, lika bred som tjockleken gånger sin(lutningen)', () => {
    const solids = roofSolids(sampleProject());
    expect(solids).toHaveLength(2);
    const strip = solids.find((s) => s.rings[0].every((q) => q[1] < -300))!;
    const ys = strip.rings[0].map((q) => q[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(300 * Math.sin(27 * deg), 1);
    // Snittets undersida möter ovansidan i kanten och undersidan vid remsans inre kant.
    const f = roofFrame(sampleProject().elements['tak'].params as unknown as RoofParams);
    expect(zOn(strip.bottom!, 6000, -500)).toBeCloseTo(f.top([6000, -500]), 3);
    expect(zOn(strip.bottom!, 6000, Math.max(...ys))).toBeCloseTo(f.under([6000, Math.max(...ys)]), 3);
    // Snittet står vinkelrätt mot takytan.
    const n1 = [-strip.top![0], -strip.top![1], 1];
    const n2 = [-strip.bottom![0], -strip.bottom![1], 1];
    expect(n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2]).toBeCloseTo(0, 6);
  });

  it('lodrätt ger ingen remsa, och en vinkel mot det vågräta ger en remsa som går ned med vinkeln', () => {
    expect(roofSolids(south(sampleProject(), { eaveCut: 'plumb' }))).toHaveLength(1);
    const strip = roofSolids(south(sampleProject(), { eaveCut: 45 })).find((s) => s.rings[0].every((q) => q[1] < -200))!;
    // 45°: snittet går ned lika mycket som det går in.
    expect(zOn(strip.bottom!, 0, -400) - zOn(strip.bottom!, 0, -300)).toBeCloseTo(100, 3);
    expect(cutPlane([0, 0.5, 2700], [0, 0], [10, 0], [0, 1], 'plumb')).toBeNull();
    expect(cutPlane([0, 0.5, 2700], [0, 0], [10, 0], [0, 1], 90)).toBeNull();
    // Vid en nock (ovansidan faller inåt) går ett vinkelrätt snitt inte in under ovansidan: lodrätt.
    expect(cutPlane([0, -0.5, 2700], [0, 0], [10, 0], [0, 1], 'perp')).toBeNull();
  });

  it('nock, grat och gavel snittas lodrätt; valmens takfall får en remsa var vid takfoten', () => {
    const hip = quickRoofs([0, 0], [12000, 8000], { slope: 27, height: 2700, thickness: 300, eave: 500, gable: 300, kind: 'hip' });
    for (const r of hip) {
      const body = roofBody(r, () => []);
      expect(body.filter((b) => b.kind.startsWith('cut'))).toHaveLength(1);
      // Gratens undersida går från remsans inre hörn upp mot nocken.
      const segs = bodyEdges(body, r.outline as Vec2[], roofFrame(r).top);
      expect(segs.length).toBeGreaterThan(4);
    }
    // En kon med bågformad takfot: remsan följer bågen, utan skarvar mellan bitarna.
    const cone: RoofParams = { outline: [[-3000, 0], [3000, 0]], bulges: [0, 3000], ref: [[-2500, 0], [2500, 0]], refBulge: -2500, height: 2700, slope: 27, thickness: 300 };
    const body = roofBody(cone, () => []);
    expect(new Set(body.map((b) => b.kind))).toEqual(new Set(['in', 'cut1']));
  });

  it('en kant får ett eget snitt i Modifiera; det känns igen på hörnen och följer med när taket flyttas', () => {
    const s = new DocStore(sampleProject());
    const host = toolHost(s, ['tak']);
    const edge = modifyContextAt(host, at([6000, -500]), 0, 0, null)!;
    expect(edge).toMatchObject({ kind: 'edge', shapeId: 'tak', index: 0 });
    expect(opsFor(host, edge).flat()).toEqual(expect.arrayContaining(['roofCutPerp', 'roofCutPlumb', 'roofCutAngle']));
    expect(opsFor(host, edge).flat()).not.toContain('roofCutAuto');
    runInstant(host, 'roofCutPlumb', edge);
    const p = () => s.doc.elements['tak'].params as unknown as RoofParams;
    expect(ownCut(p(), 0)).toBe('plumb');
    expect(roofSolids(s.doc)).toHaveLength(1);
    expect(opsFor(host, edge).flat()).toContain('roofCutAuto');
    new ModifyTool(host, 'roofCutAngle', edge, 60, () => {}).applyValue(40);
    expect(ownCut(p(), 0)).toBe(40);
    moveElements(s, ['tak'], [1000, 0]);
    expect(ownCut(p(), 0)).toBe(40);
    runInstant(host, 'roofCutAuto', { ...edge, at: [7000, -500] });
    expect(p().edgeCuts).toBeUndefined();
    // En gavel kan också få ett snitt med vinkel.
    const gable = modifyContextAt(host, at([13500, 2000]), 0, 0, null)!;
    expect(gable).toMatchObject({ kind: 'edge', index: 1 });
    new ModifyTool(host, 'roofCutAngle', gable, 60, () => {}).applyValue(60);
    expect(roofSolids(s.doc).length).toBeGreaterThan(2);
  });
});

describe('språngets tjocklek (0.10.2)', () => {
  it('utanför ytterväggarnas utsida är taket tunnare; ovansidan är densamma och väggarna kapas som förut', () => {
    const plain = buildModel3d(sampleProject(), { state: 'st-a' });
    const doc = south(sampleProject(), { overhangThickness: 150 });
    const shapes = buildModel3d(doc, { state: 'st-a' });
    const solids = shapes.filter((s): s is Solid => s.kind !== 'edges' && s.id === 'tak');
    const p = doc.elements['tak'].params as unknown as RoofParams;
    const f = roofFrame(p);
    const tv150 = 150 / Math.cos(27 * deg);
    const inside = solids.find((s) => s.rings[0].some((q) => q[0] === 0 && q[1] === 0) && s.rings[0].every((q) => q[0] >= 0 && q[0] <= 12000 && q[1] >= 0))!;
    expect(zOn(inside.bottom!, 6000, 2000)).toBeCloseTo(f.under([6000, 2000]), 3);
    const out = solids.find((s) => s.rings[0].some((q) => q[0] === -500 && q[1] > 3000))!;
    expect(zOn(out.bottom!, -250, 2000)).toBeCloseTo(f.top([-250, 2000]) - tv150, 3);
    for (const s of solids) expect(zOn(s.top!, 100, 100)).toBeCloseTo(f.top([100, 100]), 3);
    // Väggarna är kapade som förut (de står innanför språnget).
    const walls = (list: typeof shapes) => JSON.stringify(list.filter((s) => s.id.startsWith('yv')));
    expect(walls(shapes)).toBe(walls(plain));
    // Samma tjocklek som taket ger ingen delning.
    expect(roofSolids(south(sampleProject(), { overhangThickness: 300 }))).toHaveLength(2);
  });
});

describe('taket i planen (0.10.2)', () => {
  it('ovanför snitthöjden punktstreckat; där snittet går genom taket en snittyta och heldraget nedanför', () => {
    const doc = sampleProject();
    const lines = roofLines(buildPlan(doc, 'pl-1', { state: 'st-a' }).prims);
    expect(lines).toHaveLength(4);
    expect(lines.every((l) => l.pen.dash?.join(' ') === '5 1 0.3 1')).toBe(true);
    // Snitthöjd 2900: takfoten ligger under, nocken över.
    doc.storeys = doc.storeys.map((s) => ({ ...s, cutHeight: 2900 }));
    const prims = buildPlan(doc, 'pl-1', { state: 'st-a' }).prims;
    const region = prims.find((p) => p.kind === 'region' && p.origin?.objectId === 'tak');
    expect(region).toBeTruthy();
    const ls = roofLines(prims);
    expect(ls.some((l) => !l.pen.dash && l.a[1] === -500 && l.b[1] === -500)).toBe(true);
    expect(ls.some((l) => l.pen.dash && l.a[1] === 4000)).toBe(true);
    // Gaveln delas där undersidan och ovansidan går genom snitthöjden.
    const gable = ls.filter((l) => l.a[0] === 12500 && l.b[0] === 12500);
    expect(gable).toHaveLength(3);
  });

  it('ett tak syns i planen för en våning som det går upp i, men inte i en våning under sig', () => {
    const doc = twoStoreys();
    // Taket på plan 1, i plan 2:s höjd: syns i plan 2 också.
    for (const id of ['tak', 'tak-n']) doc.elements[id] = { ...doc.elements[id], storey: 'pl-1', params: { ...doc.elements[id].params, height: 5400 } };
    expect(roofLines(buildPlan(doc, 'pl-2', { state: 'st-a' }).prims)).toHaveLength(4);
    expect(roofLines(buildPlan(doc, 'pl-1', { state: 'st-a' }).prims)).toHaveLength(4);
    // Taket på plan 2 syns inte i plan 1.
    expect(roofLines(buildPlan(twoStoreys(), 'pl-1', { state: 'st-a' }).prims)).toHaveLength(0);
    // 3D ritar taket en gång.
    expect(buildModel3d(doc, { state: 'st-a' }).filter((s) => s.id === 'tak' && s.kind === 'edges')).toHaveLength(1);
  });

  it('husets kontur streckad genom taket, som val under Visa', () => {
    const ui = { hide: [] as string[], hideDemolished: false };
    expect(isShown(ui, 'footprint')).toBe(false);
    setShown(ui, 'footprint', true);
    expect(ui.hide).toEqual(['+footprint']);
    const lines = buildPlan(sampleProject(), 'pl-1', { state: 'st-a', hide: ui.hide }).prims.filter((p): p is LinePrim => p.kind === 'line' && p.origin?.part === 'footprint');
    // Ytterväggarnas utsida (0–12000 × 0–8000) inne i de två takfallen; nocken är ingen del av konturen.
    expect(lines.reduce((s, l) => s + Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]), 0)).toBeCloseTo(2 * 12000 + 2 * 8000, 0);
    expect(lines.every((l) => l.pen.dash?.join(' ') === '3 1.5' && l.noPick)).toBe(true);
    setShown(ui, 'footprint', false);
    expect(ui.hide).toEqual([]);
  });
});
