import { beforeAll, describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { emptyProject, type Element, type ProjectDoc } from '../src/core/model';
import { DEFAULT_OPENING_TYPES, layoutOpening, normalizeOpeningModel, openingDefinition, frameFromModule, holeFromModule } from '../src/core/openingTypes';
import { registerBuiltInTypes } from '../src/elements';
import { resolveParams } from '../src/elements/registry';
import { openingLitteras, renumberOpenings, applyFormula, missingOpeningNumbers } from '../src/elements/openingLittera';
import type { OpeningObjParams } from '../src/elements/openingSpec';
import { buildPlan } from '../src/repr/plan';
import { buildModel3d } from '../src/repr/model3d';
import { parse, serialize } from '../src/storage/format';
import type { Edges3D } from '../src/repr/solids';

/**
 * 0.11.8: öppningstyperna (karm och rutnät av lufter), måtten ur
 * modulmåttet och drevmånen, höjdläget, litteraregeln och ritningen ur
 * typen.
 */

beforeAll(() => registerBuiltInTypes());

const T = (id: string) => DEFAULT_OPENING_TYPES.find((t) => t.id === id)!;

/** Ett rum 6 × 4 m med ytterväggar (söder, öster, norr, väster) och öppningar i södra väggen. */
function house(openings: { id: string; type: 'Window' | 'Door'; def: string; at: number; params?: Record<string, unknown> }[]): ProjectDoc {
  const doc = emptyProject('Hus', 'nybyggnad');
  for (const t of DEFAULT_OPENING_TYPES) doc.definitions[t.id] = openingDefinition(t);
  const pts: [number, number][] = [
    [0, 0],
    [6000, 0],
    [6000, 4000],
    [0, 4000],
  ];
  const base = { storey: 'pl-1', states: ['st-ny'], tags: [] as string[], props: {} };
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % 4];
    // Moturs, så att utsidan ligger till höger: ritat medurs med utsidan till vänster.
    doc.elements[`w${i}`] = { ...base, id: `w${i}`, type: 'Wall', definition: 't-yv01', params: { start: b, end: a, justification: 'center' } } as Element;
  });
  for (const o of openings) doc.elements[o.id] = { ...base, id: o.id, type: o.type, host: 'w0', definition: o.def, params: { at: o.at, ...(o.params ?? {}) } } as Element;
  return doc;
}

describe('öppningstypen (0.11.8)', () => {
  it('modulmåttet: hålet + 10 och karmen − 10 som förval (0.11.8.1); typen kan ha tillverkarens avdrag', () => {
    const st = { holeAdd: 10, frameLess: 10 };
    expect(frameFromModule(T('t-of-sid1').model, [1000, 1300], st)).toEqual([990, 1290]);
    expect(holeFromModule(T('t-dd-slat').model, [900, 2100], st)).toEqual([910, 2110]);
    expect(frameFromModule({ ...T('t-of-sid1').model, frameLess: 20 }, [1000, 1300], st)).toEqual([980, 1280]);
  });

  it('rutnätet: fasta mm först, andelarna fördelar resten; poster mellan lufterna', () => {
    const m = { ...T('t-dd-sido').model };
    const L = layoutOpening(m, 1380, 2090);
    expect(L.cells).toHaveLength(2);
    const [leaf, side] = L.cells;
    expect(side.rect.u1 - side.rect.u0).toBe(400);
    // 1380 − 2 × 50 karm − 60 post − 400 sidoljus = 820 till bladet.
    expect(leaf.rect.u1 - leaf.rect.u0).toBe(820);
    expect(L.mullions).toHaveLength(1);
    // Flaggfönstret: två rader, den övre en tredjedel, och tvärstycken mellan.
    const f = layoutOpening(T('t-of-flagg').model, 1180, 1380);
    expect(f.cells).toHaveLength(4);
    expect(f.transoms.length).toBeGreaterThan(0);
  });

  it('en typ från fil får förval för det som saknas och tappar lufter utanför rutnätet', () => {
    const m = normalizeOpeningModel({ kind: 'window', cols: [{ size: 1, unit: 'fr' }], cells: [{ col: 3, row: 0, op: 'side' }, { col: 0, row: 0, op: 'nonsens' }] });
    expect(m.cells).toEqual([{ col: 0, row: 0, fill: 'glass', op: 'fixed' }]);
    expect(m.frame.depth).toBe(105);
    const doc = house([{ id: 'f', type: 'Window', def: 't-of-sid2', at: 3000 }]);
    const back = parse(serialize(doc));
    expect(back.definitions['t-of-sid2'].opening).toEqual(doc.definitions['t-of-sid2'].opening);
  });

  it('överkant karm som förval: bröstningen räknas ur den; bröstning som höjdläge står fast', () => {
    const doc = house([
      { id: 'a', type: 'Window', def: 't-of-sid1', at: 1500, params: { width: 1000, height: 1300 } },
      { id: 'b', type: 'Window', def: 't-of-sid1', at: 4000, params: { width: 1000, height: 600, heightRef: 'sill', sill: 1500 } },
    ]);
    const a = resolveParams<OpeningObjParams>(doc, doc.elements.a);
    expect([a.frameW, a.frameH, a.holeW, a.holeH]).toEqual([990, 1290, 1010, 1310]);
    expect(a.head).toBe(2100);
    expect(a.sill).toBe(2100 - 1290 - 10);
    const b = resolveParams<OpeningObjParams>(doc, doc.elements.b);
    expect(b.sill).toBe(1500);
    // Ett eget karmyttermått går före modulen; hålet följer modulmåttet.
    doc.elements.a = { ...doc.elements.a, params: { ...doc.elements.a.params, frame: [975, 1280] } };
    const a2 = resolveParams<OpeningObjParams>(doc, doc.elements.a);
    expect([a2.frameW, a2.holeW]).toEqual([975, 1010]);
  });
});

describe('litteran (0.11.8)', () => {
  it('typ och mått: samma typ och mått samma littera, i ordning längs fasaden', () => {
    const doc = house([
      { id: 'a', type: 'Window', def: 't-of-sid1', at: 1000, params: { width: 1000, height: 1300 } },
      { id: 'b', type: 'Window', def: 't-of-sid1', at: 3000, params: { width: 1200, height: 1300 } },
      { id: 'c', type: 'Window', def: 't-of-sid1', at: 5000, params: { width: 1000, height: 1300 } },
      { id: 'd', type: 'Door', def: 't-dd-glas', at: 2000, params: { swing: 1 } },
    ]);
    const lit = openingLitteras(doc);
    expect(lit.get('a')).toBe(lit.get('c'));
    expect(lit.get('a')).not.toBe(lit.get('b'));
    expect([...lit.values()].filter((l) => l.startsWith('F')).sort()).toEqual(['F01', 'F01', 'F02']);
    expect(lit.get('d')).toBe('D01');
  });

  it('bara modulmått, och hängningen ger egen littera; låsta står kvar', () => {
    const doc = house([
      { id: 'a', type: 'Window', def: 't-of-sid1', at: 1000, params: { width: 1000, height: 1300 } },
      { id: 'b', type: 'Window', def: 't-of-sid1', at: 3000, params: { width: 1000, height: 1300, hinge: 'end' } },
    ]);
    const set = (rule: 'module' | 'type' | 'hinge') => ({ ...doc, graphics: { ...doc.graphics, general: { openings: { rule } } } });
    expect(openingLitteras(set('module')).get('a')).toBe('F 10×13');
    expect(new Set(openingLitteras(set('type')).values()).size).toBe(1);
    expect(new Set(openingLitteras(set('hinge')).values()).size).toBe(2);
    const locked = set('hinge');
    locked.elements = { ...locked.elements, a: { ...locked.elements.a, params: { ...locked.elements.a.params, littera: 'F09' } } };
    expect(openingLitteras(locked).get('a')).toBe('F09');
  });

  it('formeln, sparade nummer och Numrera om', () => {
    expect(applyFormula('YD{nr:2}', 3)).toBe('YD03');
    expect(applyFormula('F{nr}', 12)).toBe('F12');
    const doc = house([
      { id: 'a', type: 'Window', def: 't-of-sid1', at: 1000, params: { width: 1000, height: 1300 } },
      { id: 'b', type: 'Window', def: 't-of-sid2', at: 4000, params: { width: 1200, height: 1300 } },
    ]);
    const missing = missingOpeningNumbers(doc);
    expect(Object.values(missing.Window ?? {}).sort()).toEqual([1, 2]);
    // Sett utifrån (söder) står b till vänster om a. Sparade nummer står kvar: a har 1, b får 2.
    const keyB = Object.keys(missing.Window).find((k) => k.startsWith('t-of-sid2'))!;
    const keyA = Object.keys(missing.Window).find((k) => k.startsWith('t-of-sid1'))!;
    expect(missing.Window[keyB]).toBe(1);
    const kept = { ...doc, project: { ...doc.project, openingNumbers: { Window: { [keyA]: 1 } } } };
    expect(openingLitteras(kept).get('a')).toBe('F01');
    expect(openingLitteras(kept).get('b')).toBe('F02');
    // Numrera om: vänster till höger sett utifrån.
    const { numbers, changes } = renumberOpenings(kept, ['Window']);
    expect(numbers.Window).toEqual({ [keyB]: 1, [keyA]: 2 });
    expect(changes.length).toBe(2);
  });
});

const normAng = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

describe('ritningen ur typen (0.11.8)', () => {
  it('planen: posten i snitt, fönstrens slag 15° kring gångjärnen, dörrens slagbåge heldragen', () => {
    const doc = house([
      { id: 'f', type: 'Window', def: 't-of-flagg', at: 1500, params: { width: 1200, height: 1400 } },
      { id: 'd', type: 'Door', def: 't-dd-par', at: 4000, params: { swing: -1 } },
    ]);
    const prims = buildPlan(doc, 'pl-1', { state: 'st-ny' }).prims;
    const of = (id: string, part: string) => prims.filter((p) => p.origin?.objectId === id && p.origin.part === part);
    expect(of('f', 'post').length).toBeGreaterThan(0);
    const winArcs = of('f', 'slagbåge').filter((p) => p.kind === 'arc');
    expect(winArcs.length).toBe(2);
    // Mitten i gångjärnet, radien bågens bredd, 15° (0.11.8.1, kommentar B).
    for (const a of winArcs) if (a.kind === 'arc') expect(Math.abs(normAng(a.end - a.start) - Math.PI / 12)).toBeLessThan(1e-6);
    // På alla nivåer, också Skiss; Visa › Slagbågar, fönster släcker dem (kommentar H).
    const sketch = buildPlan(doc, 'pl-1', { state: 'st-ny', detail: 'sketch' }).prims;
    expect(sketch.filter((p) => p.origin?.objectId === 'f' && p.origin.part === 'slagbåge' && p.kind === 'arc')).toHaveLength(2);
    expect(sketch.filter((p) => p.origin?.objectId === 'd' && p.origin.part === 'slagbåge' && p.kind === 'arc')).toHaveLength(2);
    const off = buildPlan(doc, 'pl-1', { state: 'st-ny', hide: ['swingWindow'] }).prims;
    expect(off.some((p) => p.origin?.objectId === 'f' && p.origin.part === 'slagbåge')).toBe(false);
    expect(off.some((p) => p.origin?.objectId === 'd' && p.origin.part === 'slagbåge')).toBe(true);
    // Pardörren: gångdörrens båge heldragen, den passiva streckad.
    const doorArcs = of('d', 'slagbåge').filter((p) => p.kind === 'arc');
    expect(doorArcs).toHaveLength(2);
    expect(doorArcs.filter((p) => p.kind === 'arc' && p.pen.dash)).toHaveLength(1);
  });

  it('3D och fasad: en luft per båge, symbolen per luft; Skiss bara konturen', () => {
    const doc = house([{ id: 'f', type: 'Window', def: 't-of-sid2', at: 3000, params: { width: 1200, height: 1300 } }]);
    const edges = buildModel3d(doc, { state: 'st-ny' }).filter((s): s is Edges3D => s.kind === 'edges' && s.id === 'f');
    const near = edges.filter((e) => e.part === 'swing').flatMap((e) => e.segments);
    const far = edges.filter((e) => e.part === 'swingFar').flatMap((e) => e.segments);
    // Två lufter × två linjer på var sida.
    expect(near).toHaveLength(4);
    expect(far).toHaveLength(4);
    const sketch = buildModel3d(doc, { state: 'st-ny', detail: 'sketch' }).filter((s): s is Edges3D => s.kind === 'edges' && s.id === 'f');
    expect(new Set(sketch.map((e) => e.part))).toEqual(new Set(['frame']));
  });

  it('en ytterdörr sitter i liv på slagsidan, ett fönster i liv ute', () => {
    const doc = house([
      { id: 'f', type: 'Window', def: 't-of-sid1', at: 1500, params: { width: 1000, height: 1300 } },
      { id: 'd', type: 'Door', def: 't-dd-slat', at: 4000, params: { swing: -1 } },
    ]);
    const store = new DocStore(doc);
    const prims = buildPlan(store.doc, 'pl-1', { state: 'st-ny' }).prims;
    const karm = (id: string) => prims.filter((p) => p.origin?.objectId === id && p.origin.part === 'karm' && p.kind === 'polyline');
    expect(karm('f').length).toBe(2);
    expect(karm('d').length).toBe(2);
  });
});
