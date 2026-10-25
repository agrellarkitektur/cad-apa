import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { transferSettings } from '../src/core/arrange';
import { DocStore } from '../src/core/store';
import type { Element, ProjectDoc } from '../src/core/model';
import { shapePrims, type Shape2DParams } from '../src/elements/drawing2d';
import { buildPlan } from '../src/repr/plan';
import { sampleProject } from '../src/sample/sampleProject';
import { pickAt } from '../src/view2d/pick';
import { renderPrimitives } from '../src/view2d/renderPrimitives';
import { Camera } from '../src/view2d/camera';
import { writePdf } from '../src/formats/pdf';

beforeAll(() => registerBuiltInTypes());

const viewOf = (doc: ProjectDoc) => ({ state: doc.states[doc.states.length - 1].id, compareTo: doc.states[0].id });
const sq: [number, number][] = [[20000, 20000], [21000, 20000], [21000, 21000], [20000, 21000]];

function setup(params: Partial<Shape2DParams>) {
  const doc = sampleProject();
  const storey = doc.storeys[0].id;
  const el: Element = {
    id: 'form',
    type: 'Shape2D',
    storey,
    states: doc.states.map((s) => s.id),
    tags: [],
    params: { shape: 'polyline', points: sq, closed: true, weight: 0.25, linetype: 'solid', ...params },
    props: {},
  };
  doc.elements.form = el;
  return { doc, plan: buildPlan(doc, storey, viewOf(doc)) };
}

describe('2D-formen (0.8.19)', () => {
  it('linje och fyllning är samma objekt, fyllningen under modellen', () => {
    const prims = shapePrims({ shape: 'polyline', points: sq, closed: true, weight: 0.35, linetype: 'solid', fill: 'cross', fillAngle: 30, fillSpacing: 2 });
    expect(prims.some((p) => p.kind === 'polyline' && !p.under)).toBe(true);
    expect(prims.filter((p) => p.kind === 'region').every((p) => p.under)).toBe(true);
    expect(prims.some((p) => p.kind === 'region')).toBe(true);
  });

  it('utan fyllning går mitten inte att klicka på, bara linjen', () => {
    const { plan } = setup({});
    expect(pickAt(plan.pickables, [20500, 20500], 20)).not.toBe('form');
    expect(pickAt(plan.pickables, [20500, 20010], 20)).toBe('form');
  });

  it('med fyllning går mitten att klicka på', () => {
    const { plan } = setup({ fill: 'solid' });
    expect(pickAt(plan.pickables, [20500, 20500], 20)).toBe('form');
  });

  it('en öppen form kan få fyllning; den fylls som om den vore sluten', () => {
    const { plan } = setup({ closed: false, fill: 'hatch' });
    const pk = plan.pickables.find((p) => p.id === 'form')!;
    expect(pk.regions[0][0]).toHaveLength(4);
    const line = pk.prims.find((p) => p.kind === 'polyline');
    expect(line && line.kind === 'polyline' && line.closed).toBe(false);
    expect(pickAt(plan.pickables, [20500, 20500], 20)).toBe('form');
  });

  it('en rak linje får ingen fyllning', () => {
    expect(shapePrims({ shape: 'polyline', points: [[0, 0], [1000, 0]], weight: 0.25, linetype: 'solid', fill: 'solid', fillAngle: 45, fillSpacing: 2 }).map((p) => p.kind)).toEqual(['polyline']);
  });

  it('tjockleken 0 ritas inte, men går att klicka på längs linjen', async () => {
    const { plan } = setup({ weight: 0 });
    const pk = plan.pickables.find((p) => p.id === 'form')!;
    expect(pickAt(plan.pickables, [20500, 20010], 20)).toBe('form');
    const cam = new Camera();
    const svg = renderPrimitives(pk.prims, cam, { drawingScale: 100 });
    expect(svg).not.toContain('<path');
    const pdf = new TextDecoder('latin1').decode(await writePdf([{ size: [100, 100], prims: pk.prims }]));
    expect(pdf).not.toContain(' S Q');
    const drawn = new TextDecoder('latin1').decode(await writePdf([{ size: [100, 100], prims: setup({}).plan.pickables.find((p) => p.id === 'form')!.prims }]));
    expect(drawn).toContain(' S Q');
  });

  it('pipetten tar med fyllningen och tar bort den när källan saknar fyllning', () => {
    const { doc } = setup({ fill: 'hatch', fillColor: '#ff0000', fillAngle: 30 });
    doc.elements.b = { ...doc.elements.form, id: 'b', params: { shape: 'polyline', points: [[0, 0], [10, 0]], weight: 0.5, linetype: 'dashed' } };
    doc.elements.c = { ...doc.elements.form, id: 'c', params: { ...doc.elements.form.params } };
    const store = new DocStore(doc);
    transferSettings(store, 'form', ['b']);
    expect(store.doc.elements.b.params).toMatchObject({ points: [[0, 0], [10, 0]], weight: 0.25, linetype: 'solid', fill: 'hatch', fillColor: '#ff0000', fillAngle: 30 });
    transferSettings(store, 'b', ['c']);
    expect(store.doc.elements.c.params).toMatchObject({ shape: 'polyline', fill: 'hatch' });
    const s2 = new DocStore(store.doc);
    const noFill = { ...s2.doc.elements.b, id: 'd', params: { shape: 'polyline', points: [[0, 0], [10, 0]], weight: 0.5, linetype: 'solid' } };
    s2.transact('x', (tx) => tx.putElement(noFill as Element));
    transferSettings(s2, 'd', ['c']);
    expect(s2.doc.elements.c.params.fill).toBeUndefined();
  });
});
