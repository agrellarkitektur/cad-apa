import { beforeAll, describe, expect, it } from 'vitest';
import type { ProjectDoc } from '../src/core/model';
import { DocStore } from '../src/core/store';
import { addStorey, deleteStorey, TRACE_ABOVE, TRACE_BELOW, toStorey, tracedStorey } from '../src/core/storeys';
import { saveStorey } from '../src/core/treeCommands';
import { registerBuiltInTypes } from '../src/elements';
import { resolveParams } from '../src/elements/registry';
import type { WallParams } from '../src/elements/wall';
import { buildModel3d } from '../src/repr/model3d';
import { buildPlan } from '../src/repr/plan';
import { buildSection } from '../src/repr/section';
import type { Solid } from '../src/repr/solids';
import { liftShape } from '../src/repr/storeyShapes';
import { sampleProject } from '../src/sample/sampleProject';

beforeAll(() => registerBuiltInTypes());

const store = () => new DocStore(structuredClone(sampleProject()));
const level = (doc: ProjectDoc, id: string) => doc.storeys.find((s) => s.id === id)!;

describe('Våningar (0.9)', () => {
  it('en ny våning ovanför och under får golvnivån från grannen; de som redan ligger där flyttas', () => {
    const s = store();
    const two = addStorey(s, 'pl-1', 'above')!;
    expect(level(s.doc, two)).toMatchObject({ name: 'Plan 2', elevation: 2700, height: 2700 });
    const between = addStorey(s, 'pl-1', 'above')!;
    expect(level(s.doc, between).elevation).toBe(2700);
    expect(level(s.doc, two)).toMatchObject({ elevation: 5400 });
    const cellar = addStorey(s, 'pl-1', 'below')!;
    expect(level(s.doc, cellar)).toMatchObject({ name: 'Källarplan', elevation: -2700 });
    // En högre våningshöjd flyttar våningarna ovanför, inte den under.
    saveStorey(s, 'pl-1', { height: 3000 });
    expect([level(s.doc, cellar).elevation, level(s.doc, between).elevation, level(s.doc, two).elevation]).toEqual([-2700, 3000, 5700]);
    s.undo();
    expect(level(s.doc, two).elevation).toBe(5400);
  });

  it('väggar utan egen höjd följer våningshöjden', () => {
    const s = store();
    const wall = Object.values(s.doc.elements).find((e) => e.type === 'Wall')!;
    expect(resolveParams<WallParams>(s.doc, wall).height).toBe(2700);
    saveStorey(s, 'pl-1', { height: 3100 });
    expect(resolveParams<WallParams>(s.doc, s.doc.elements[wall.id]).height).toBe(3100);
    s.transact('egen', (tx) => tx.putElement({ ...wall, params: { ...wall.params, height: 2400 } }));
    expect(resolveParams<WallParams>(s.doc, s.doc.elements[wall.id]).height).toBe(2400);
  });

  it('flytta och kopiera till en annan våning: dörrar och fönster följer väggen, fasaderna stannar', () => {
    const s = store();
    const two = addStorey(s, 'pl-1', 'above')!;
    const wall = Object.values(s.doc.elements).find((e) => e.type === 'Wall' && Object.values(s.doc.elements).some((o) => o.host === e.id))!;
    const openings = Object.values(s.doc.elements).filter((o) => o.host === wall.id);
    const copied = toStorey(s, [wall.id, 'fasad-1'], two, true, 'st-a');
    expect(copied).toHaveLength(1);
    expect(Object.values(s.doc.elements).filter((o) => o.host === copied[0] && o.storey === two)).toHaveLength(openings.length);
    expect(s.doc.elements['fasad-1'].storey).toBe('pl-1');
    const moved = toStorey(s, [wall.id], two, false, 'st-a');
    expect(moved).toEqual([wall.id]);
    expect(s.doc.elements[wall.id].storey).toBe(two);
    for (const o of openings) expect(s.doc.elements[o.id].storey).toBe(two);
  });

  it('ta bort en våning tar bort det som är ritat på den och dess vyer, men inte fasaderna; den sista går inte', () => {
    const s = store();
    expect(deleteStorey(s, 'pl-1')).toBe(false);
    const two = addStorey(s, 'pl-1', 'above')!;
    const n = Object.keys(s.doc.elements).length;
    expect(deleteStorey(s, 'pl-1')).toBe(true);
    expect(s.doc.storeys.map((x) => x.id)).toEqual([two]);
    expect(Object.values(s.doc.elements).some((e) => e.type === 'Wall')).toBe(false);
    expect(s.doc.elements['fasad-1'].storey).toBe(two);
    expect(s.doc.views.some((v) => v.storey === 'pl-1')).toBe(false);
    s.undo();
    expect(Object.keys(s.doc.elements)).toHaveLength(n);
  });

  it('fasad- och sektionslinjerna och norrpilen ritas i alla planer', () => {
    const s = store();
    const two = addStorey(s, 'pl-1', 'above')!;
    const ids = new Set(buildPlan(s.doc, two, { state: 'st-a' }).pickables.map((p) => p.id));
    for (const id of ['north', 'fasad-1', 'sektion-a']) expect(ids.has(id)).toBe(true);
  });

  it('3D, fasader och sektioner visar alla våningar, var och en på sin golvnivå', () => {
    const s = store();
    const one = buildModel3d(s.doc, { state: 'st-a' });
    const two = addStorey(s, 'pl-1', 'above')!;
    toStorey(s, Object.values(s.doc.elements).filter((e) => e.type === 'Wall').map((e) => e.id), two, true, 'st-a');
    const both = buildModel3d(s.doc, { state: 'st-a' });
    expect(buildModel3d(s.doc, { state: 'st-a' }, 'pl-1')).toHaveLength(one.length);
    const top = Math.max(...both.filter((x): x is Solid => x.kind !== 'edges').map((x) => x.z1));
    expect(top).toBeGreaterThanOrEqual(5400);
    const sec = buildSection(s.doc, 'sektion-a', { state: 'st-a' })!;
    const ys = sec.prims.flatMap((p) => (p.kind === 'polyline' ? p.points.map((q) => q[1]) : p.kind === 'line' ? [p.a[1], p.b[1]] : []));
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(5400);
  });

  it('en våning som lyfts flyttar också vägghålen och sneda plan (felet 20 oktober)', () => {
    const s: Solid = { id: 'v', rings: [], z0: 0, z1: 2700, top: [0, 0.1, 2700], cuts: [{ rings: [], z0: 900, z1: 2100 }], material: 'wall' };
    expect(liftShape(s, 1000)).toMatchObject({ z0: 1000, z1: 3700, top: [0, 0.1, 3700], cuts: [{ z0: 1900, z1: 3100 }] });
  });

  it('kalkera våningen under eller över', () => {
    const s = store();
    const two = addStorey(s, 'pl-1', 'above')!;
    expect(tracedStorey(s.doc, two, TRACE_BELOW)?.id).toBe('pl-1');
    expect(tracedStorey(s.doc, two, TRACE_ABOVE)).toBeUndefined();
    expect(tracedStorey(s.doc, 'pl-1', 'vy-a')).toBeUndefined();
  });
});
