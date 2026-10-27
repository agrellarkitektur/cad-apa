import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { setGraphics, updateParams } from '../src/core/commands';
import { DocStore } from '../src/core/store';
import type { Element, ProjectDoc } from '../src/core/model';
import { opacitiesOf, shapePrims, type Shape2DParams } from '../src/elements/drawing2d';
import { buildPlan } from '../src/repr/plan';
import type { Primitive } from '../src/repr/primitives';
import { sampleProject } from '../src/sample/sampleProject';
import { pickAt } from '../src/view2d/pick';
import { opacityFields, shapeSmartFields } from '../src/ui/shapeFields';

beforeAll(() => registerBuiltInTypes());

const viewOf = (doc: ProjectDoc, hide: string[] = []) => ({ state: doc.states[doc.states.length - 1].id, compareTo: doc.states[0].id, hide });
const sq: [number, number][] = [[20000, 20000], [21000, 20000], [21000, 21000], [20000, 21000]];
const base: Shape2DParams = { shape: 'polyline', points: sq, closed: true, weight: 0.25, linetype: 'solid', fill: 'solid', fillAngle: 45, fillSpacing: 2 };

function withShape(params: Partial<Shape2DParams>) {
  const doc = sampleProject();
  const storey = doc.storeys[0].id;
  doc.elements.form = { id: 'form', type: 'Shape2D', storey, states: doc.states.map((s) => s.id), tags: [], params: { ...base, ...params }, props: {} } as Element;
  return { doc, storey };
}

const fillOf = (prims: Primitive[]) => prims.filter((p) => p.kind === 'region').map((p) => (p.kind === 'region' ? p.fill : null));
const lineOf = (prims: Primitive[]) => prims.find((p) => p.kind === 'polyline');

describe('opacitet för 2D-former (0.8.22)', () => {
  it('är 100 % utan värden, och fyllningen följer linjen tills de skiljs åt', () => {
    expect(opacitiesOf({})).toEqual({ line: 1, fill: 1 });
    expect(opacitiesOf({ opacity: 40 })).toEqual({ line: 0.4, fill: 0.4 });
    expect(opacitiesOf({ opacity: 40, fillOpacity: 80 })).toEqual({ line: 0.4, fill: 0.8 });
    expect(opacitiesOf({ opacity: 140, fillOpacity: -5 })).toEqual({ line: 1, fill: 0 });
  });

  it('läggs på linjens penna och på fyllningen, också skrafferingar', () => {
    const prims = shapePrims({ ...base, fill: 'cross', opacity: 50, fillOpacity: 25 });
    const line = lineOf(prims);
    expect(line?.kind === 'polyline' && line.pen.opacity).toBe(0.5);
    expect(fillOf(prims).map((f) => f && f.kind !== 'none' && f.opacity)).toEqual([0.25, 0.25]);
    // Helt täckande skrivs inte ut, som förut.
    const plain = shapePrims(base);
    expect(lineOf(plain)?.kind === 'polyline' && 'opacity' in (lineOf(plain) as { pen: object }).pen).toBe(false);
  });

  it('0 % ritar ingenting men går fortfarande att klicka på', () => {
    const { doc, storey } = withShape({ opacity: 0 });
    const plan = buildPlan(doc, storey, viewOf(doc));
    const pk = plan.pickables.find((p) => p.id === 'form')!;
    expect(fillOf(pk.prims)).toEqual([]);
    expect(lineOf(pk.prims)?.kind === 'polyline' && lineOf(pk.prims)!.kind === 'polyline' && (lineOf(pk.prims) as { pen: { weight: number } }).pen.weight).toBe(0);
    expect(pickAt(plan.pickables, [20500, 20500], 20)).toBe('form');
  });

  it('linjens opacitet i egenskaperna, och båda i smartmenyn (0.10.14)', () => {
    const attrs = (k: string) => `data-key="d2:${k}"`;
    const panel = opacityFields({ weight: 0.25, fill: 'solid', opacity: 60 }, attrs);
    expect(panel).toContain('data-key="d2:opacity"');
    expect(panel).not.toContain('d2:fillOpacity');
    const smart = opacityFields({ weight: 0.25, fill: 'solid', opacity: 60, fillOpacity: 30 }, attrs, true);
    expect(smart).toContain('d2:fillOpacity');
    expect(smart).toContain('value="30"');
    expect(smart).not.toContain('opacityLinked');
  });
});

describe('smartmenyns fält för 2D-former (0.8.22)', () => {
  it('visar skrafferingens vinkel och avstånd, tomma när de skiljer sig', () => {
    const { doc } = withShape({ fill: 'hatch', fillAngle: 30 });
    const other = { ...doc.elements.form, id: 'form2', params: { ...doc.elements.form.params, fillAngle: 60 } } as Element;
    const one = shapeSmartFields(doc, [doc.elements.form])!;
    expect(one).toContain('d2:fillAngle');
    expect(one).toContain('value="30"');
    const two = shapeSmartFields(doc, [doc.elements.form, other])!;
    expect(two).toMatch(/d2:fillAngle" value="" placeholder="Olika"/);
    expect(two).toContain('value="2"');
  });

  it('har ingen vinkel för hel fyllning, men opacitet', () => {
    const { doc } = withShape({});
    const f = shapeSmartFields(doc, [doc.elements.form])!;
    expect(f).not.toContain('d2:fillAngle');
    expect(f).toContain('d2:opacity');
  });

  it('gäller bara när allt markerat är 2D-former', () => {
    const { doc } = withShape({});
    const wall = Object.values(doc.elements).find((e) => e.type === 'Wall')!;
    expect(shapeSmartFields(doc, [doc.elements.form, wall])).toBeNull();
  });
});

describe('Visa → Fyllningar (0.8.22)', () => {
  it('släcker fyllningarna men inte formen, som går att klicka på', () => {
    const { doc, storey } = withShape({});
    const shown = buildPlan(doc, storey, viewOf(doc));
    expect(fillOf(shown.pickables.find((p) => p.id === 'form')!.prims)).toHaveLength(1);
    const hidden = buildPlan(doc, storey, viewOf(doc, ['fill']));
    const pk = hidden.pickables.find((p) => p.id === 'form')!;
    expect(fillOf(pk.prims)).toHaveLength(0);
    expect(lineOf(pk.prims)).toBeTruthy();
    expect(pickAt(hidden.pickables, [20500, 20500], 20)).toBe('form');
  });
});

describe('rumsstämpelns mall (0.8.22)', () => {
  const stamp = (doc: ProjectDoc, id: string) =>
    buildPlan(doc, doc.elements[id].storey, viewOf(doc))
      .pickables.find((p) => p.id === id)!
      .prims.filter((q): q is Extract<Primitive, { kind: 'text' }> => q.kind === 'text');

  it('ger samma stämpel som förut med förvalet', () => {
    const store = new DocStore(sampleProject());
    const room = Object.values(store.doc.elements).find((e) => e.type === 'Space')!;
    updateParams(store, [room.id], { ceilingHeight: 2500 });
    const rows = stamp(store.doc, room.id);
    expect(rows[0].bold).toBe(true);
    expect(rows.at(-1)!.text).toMatch(/^TH 2\s500$/);
    expect(rows.at(-1)!.pen.color).toBe('muted');
    expect(rows[2].text).toMatch(/m²$/);
  });

  it('kan ha numret ovanför namnet, och egna egenskaper', () => {
    const store = new DocStore(sampleProject());
    const room = Object.values(store.doc.elements).find((e) => e.type === 'Space')!;
    store.transact('egenskap', (tx) => tx.putElement({ ...store.doc.elements[room.id], props: { Egenskaper: { Golv: 'Ek' } } }));
    const style = structuredClone(store.doc.graphics);
    style.labels.room = '{nummer}\n{namn}\nGolv: {golv}\n{saknas}';
    setGraphics(store, style);
    const rows = stamp(store.doc, room.id);
    expect(rows.map((r) => r.bold ?? false)).toEqual([false, true, false]);
    expect(rows[0].text).toMatch(/^\d+$/);
    expect(rows[2].text).toBe('Golv: Ek');
    // Namnet är högst upp i koordinater näst efter numret.
    expect(rows[0].at[1]).toBeGreaterThan(rows[1].at[1]);
  });

});
