import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { deleteElements, moveElements, updateParams } from '../src/core/commands';
import { buildPlan } from '../src/repr/plan';
import { moveEach } from '../src/core/arrange';
import { rotateElements } from '../src/core/transforms';
import { labelLines, labelNumbers, targetAt, targetPoint, type LabelParams } from '../src/elements/label';
import { leaderOf, type TextBox } from '../src/elements/leader';
import type { Primitive } from '../src/repr/primitives';
import { tagGripsShown, tagPatch } from '../src/ui/tools/tagGrips';
import { toolHost, wallsProject } from './projekt';
import type { DocStore } from '../src/core/store';
import { createContext } from '../src/repr/context';

beforeAll(() => registerBuiltInTypes());

/**
 * Det generella littrat (0.10.20.2): smarttext ur objekten, flera ledare,
 * punkter som sitter fast i objekten, ram, löpnummer och sorter; och
 * svaren på frågorna om 0.10.20.1: understruken ledare och förskjutningen
 * på papperet.
 */

const PEN = { weight: 0.18 };
const box: TextBox = { center: [5000, 0], halfW: 1000, halfH: 200, along: [1, 0], up: [0, 1] };
const lines = (ps: Primitive[]) => ps.filter((p): p is Extract<Primitive, { kind: 'line' }> => p.kind === 'line');

/** Två väggar med egna namn och en egenskap, och en littera som pekar på båda. */
function project(): DocStore {
  const s = wallsProject({ a: [[0, 0], [6000, 0]], b: [[0, 3000], [6000, 3000]] });
  s.transact('namn', (tx) => {
    tx.putElement({ ...s.doc.elements.a, name: 'IV1', props: { egna: { Brandklass: 'EI30' } } });
    tx.putElement({ ...s.doc.elements.b, name: 'IV2', props: { egna: { Brandklass: 'EI60' } } });
  });
  const targets = [targetAt(s.doc, [3000, 0], 'a'), targetAt(s.doc, [3000, 3000], 'b')];
  s.transact('littera', (tx) =>
    tx.putElement({ id: 'L', type: 'Label', storey: s.doc.storeys[0].id, states: s.doc.states.map((x) => x.id), tags: [], props: {}, params: { pos: [9000, 1500], text: '{id}\n{brandklass}', targets } }),
  );
  return s;
}

const planOf = (s: DocStore, scale = 100, extra: object = {}) => buildPlan(s.doc, s.doc.storeys[0].id, { state: s.doc.states.at(-1)!.id, scale, ...extra });
const ctxOf = (s: DocStore) => createContext(s.doc, s.doc.storeys[0].id, { state: s.doc.states.at(-1)!.id } as never, s.doc.graphics, () => true).ctx;
const of = (s: DocStore, id = 'L') => planOf(s).prims.filter((p) => p.origin?.objectId === id);

describe('ledaren mot texten', () => {
  it('understruken: ett streck under hela texten, och stammen fortsätter från dess ände', () => {
    const g = leaderOf(box, [{ at: [0, -3000] }], { stub: 3, gap: 1, attach: 'underline', scale: 100, pen: PEN, end: 'none' })!;
    const [under, stem] = lines(g.prims);
    // Under rutan, över hela bredden.
    expect(under.a[1]).toBeCloseTo(-300);
    expect(Math.abs(under.a[0] - under.b[0])).toBeCloseTo(2200);
    expect(stem.a).toEqual(g.start);
    expect(g.side).toBe('left');
    // En punkt rakt under texten ger ändå en stam åt sidan.
    expect(leaderOf(box, [{ at: [5000, -3000] }], { stub: 3, attach: 'underline', scale: 100, pen: PEN })!.side).toMatch(/left|right/);
  });

  it('stödmurens text är understruken som förval', () => {
    const s = wallsProject({});
    expect(s.doc.graphics.labels.leaders.Ground.attach).toBe('underline');
    expect(s.doc.graphics.labels.leaders.Wall.attach).toBe('side');
  });
});

describe('litterans förskjutning på papperet', () => {
  it('står lika långt från väggen på papperet i olika skalor', () => {
    const s = wallsProject({ a: [[0, 0], [6000, 0]] });
    const def = Object.values(s.doc.definitions).find((d) => d.elementType === 'Wall')!.id;
    s.transact('typ', (tx) => tx.putElement({ ...s.doc.elements.a, definition: def }));
    const at = (scale: number, tag?: object) => {
      if (tag) updateParams(s, ['a'], { tag });
      const t = planOf(s, scale).prims.find((p) => p.origin?.objectId === 'a' && p.origin.part === 'littera' && p.kind === 'text') as Extract<Primitive, { kind: 'text' }>;
      return t.at;
    };
    const base50 = at(50);
    const base100 = at(100);
    const moved50 = at(50, { at: [0, 10] });
    const moved100 = at(100);
    // 10 mm på papperet: 500 mm i 1:50, 1000 mm i 1:100.
    expect(Math.hypot(moved50[0] - base50[0], moved50[1] - base50[1])).toBeCloseTo(500);
    expect(Math.hypot(moved100[0] - base100[0], moved100[1] - base100[1])).toBeCloseTo(1000);
  });

  it('textens grepp sitter på ledarens ansats och flyttar texten lika långt', () => {
    const s = project();
    const host = toolHost(s, ['L']);
    const text = tagGripsShown(host).find((g) => g.kind === 'text')!;
    expect(text.at).toEqual(text.handles.stubStart);
    updateParams(s, ['L'], tagPatch(host, text, [text.at[0] + 1000, text.at[1] - 500])!.patch);
    expect(s.doc.elements.L.params.pos).toEqual([10000, 1000]);
    // En punkt som släpps på ett annat objekt sitter fast i det.
    const second = tagGripsShown(host).find((g) => g.kind === 'target' && g.handles.index === 1)!;
    updateParams(s, ['L'], tagPatch(host, second, [1000, 0])!.patch);
    expect((s.doc.elements.L.params as unknown as LabelParams).targets[1]).toMatchObject({ id: 'a', at: [1000, 0] });
  });
});

describe('det generella littrat', () => {
  it('hämtar fälten ur objekten och skriver varierar eller en lista när de skiljer sig', () => {
    const s = project();
    expect(labelLines(ctxOf(s), s.doc.elements.L)).toEqual(['varierar', 'varierar']);
    updateParams(s, ['L'], { list: true });
    expect(labelLines(ctxOf(s), s.doc.elements.L)).toEqual(['IV1, IV2', 'EI30, EI60']);
    // En ledare: objektets eget värde.
    updateParams(s, ['L'], { targets: [(s.doc.elements.L.params as unknown as LabelParams).targets[0]] });
    expect(labelLines(ctxOf(s), s.doc.elements.L)).toEqual(['IV1', 'EI30']);
  });

  it('ritar flera ledare parallella från en gemensam stam', () => {
    const s = project();
    const slanted = lines(of(s)).filter((l) => l.origin?.part === 'ledare' && Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]) > 500);
    expect(slanted).toHaveLength(2);
    const dir = (l: (typeof slanted)[number]) => Math.atan2(l.b[1] - l.a[1], l.b[0] - l.a[0]);
    // Parallella i 45° mot stammen men åt var sitt håll; vinklarna mot stammen lika.
    const a = dir(slanted[0]);
    const b = dir(slanted[1]);
    expect(Math.abs(Math.abs(Math.sin(a)) - Math.abs(Math.sin(b)))).toBeLessThan(1e-9);
  });

  it('punkterna följer objekten när de flyttas och vrids, och blir röda när objektet tas bort', () => {
    const s = project();
    moveElements(s, ['a'], [0, -1000]);
    const t = (s.doc.elements.L.params as unknown as LabelParams).targets;
    expect(targetPoint(s.doc, t[0]).at).toEqual([3000, -1000]);
    rotateElements(s, ['b'], [3000, 3000], 90);
    const p = targetPoint(s.doc, (s.doc.elements.L.params as unknown as LabelParams).targets[1]).at;
    expect(p[0]).toBeCloseTo(3000);
    expect(p[1]).toBeCloseTo(3000);
    deleteElements(s, ['a']);
    expect(targetPoint(s.doc, (s.doc.elements.L.params as unknown as LabelParams).targets[0]).lost).toBe(true);
    expect(of(s).some((q) => q.kind === 'line' && q.pen.color === '#d9480f')).toBe(true);
  });

  it('flyttas med sina fria punkter, men riktas och fördelas utan dem', () => {
    const s = project();
    updateParams(s, ['L'], { targets: [{ at: [1000, 1000] }] });
    moveElements(s, ['L'], [500, 0]);
    expect((s.doc.elements.L.params as unknown as LabelParams).targets[0].at).toEqual([1500, 1000]);
    moveEach(s, new Map([['L', [0, 700] as const]]), 'Justera');
    expect(s.doc.elements.L.params.pos).toEqual([9500, 2200]);
    expect((s.doc.elements.L.params as unknown as LabelParams).targets[0].at).toEqual([1500, 1000]);
  });

  it('numrerar litteror av samma sort i följd, med projektets siffror och egna nummer', () => {
    const s = project();
    const put = (id: string, sort: string, number?: string) =>
      s.transact('l', (tx) => tx.putElement({ id, type: 'Label', storey: s.doc.storeys[0].id, states: s.doc.states.map((x) => x.id), tags: [], props: {}, params: { pos: [0, 0], text: 'T{löpnummer}', targets: [], sort, ...(number ? { number } : {}) } }));
    put('t1', 'Träd');
    put('b1', 'Brand');
    put('t2', 'träd');
    put('t3', 'Träd', '09');
    put('t4', 'Träd');
    const n = labelNumbers(s.doc);
    expect([n.get('t1'), n.get('t2'), n.get('t4'), n.get('b1')]).toEqual([1, 2, 3, 1]);
    expect(labelLines(ctxOf(s), s.doc.elements.t4)).toEqual(['T03']);
    expect(labelLines(ctxOf(s), s.doc.elements.t3)).toEqual(['T09']);
  });

  it('har en ram och kan släckas per sort under Visa', () => {
    const s = project();
    updateParams(s, ['L'], { frame: 'hexagon', sort: 'Brand' });
    const hex = of(s).find((q) => q.kind === 'polyline');
    expect(hex && hex.kind === 'polyline' && hex.points.length).toBe(6);
    expect(planOf(s, 100, { hide: ['labelsort:brand'] }).prims.some((q) => q.origin?.objectId === 'L')).toBe(false);
  });
});
