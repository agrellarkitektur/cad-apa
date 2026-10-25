import { beforeAll, describe, expect, it } from 'vitest';
import { combine, emptyCriteria, filterElements, propertyNames } from '../src/core/filterSelect';
import type { Element, ProjectDoc } from '../src/core/model';
import { actionOf, type ViewStates } from '../src/core/states';
import { registerBuiltInTypes } from '../src/elements';
import { typeOf } from '../src/elements/registry';
import { sampleProject } from '../src/sample/sampleProject';

/**
 * Filtrera och markera (0.8.35): villkoren (sort, typ, tillstånd, åtgärd,
 * egen penna, egenskap, våning) och hur markeringen ändras.
 */

beforeAll(() => registerBuiltInTypes());

const setup = () => {
  const doc: ProjectDoc = sampleProject();
  const storey = doc.storeys[0].id;
  const existing = doc.states.find((s) => s.kind === 'existing')!.id;
  const proposal = doc.states.find((s) => s.id !== existing)!.id;
  const view: ViewStates = { state: proposal, compareTo: existing };
  const shown = Object.values(doc.elements).filter((e) => e.storey === storey && !e.space && (!!typeOf(e.type)?.global || actionOf(e, view) !== 'absent'));
  // Markörerna (fasader, sektioner, norrpil) finns i alla tillstånd.
  return { doc, storey, view, shown, proposal };
};
const ids = (els: Element[]) => els.map((e) => e.id).sort();

describe('filtrera och markera (0.8.35)', () => {
  it('sort och typ; tomma villkor gäller allt det som syns', () => {
    const { doc, storey, view, shown } = setup();
    expect(filterElements(doc, view, storey, emptyCriteria()).length).toBe(shown.length);
    const walls = filterElements(doc, view, storey, { ...emptyCriteria(), types: ['Wall'] });
    expect(ids(walls)).toEqual(ids(shown.filter((e) => e.type === 'Wall')));
    const def = walls.find((e) => e.definition)!.definition!;
    expect(ids(filterElements(doc, view, storey, { ...emptyCriteria(), types: ['Wall'], definitions: [def] }))).toEqual(ids(walls.filter((e) => e.definition === def)));
  });

  it('åtgärd i jämförelsen, tillstånd och egen penna', () => {
    const { doc, storey, view, shown, proposal } = setup();
    const demolished = filterElements(doc, view, storey, { ...emptyCriteria(), actions: ['demolished'] });
    expect(demolished.length).toBeGreaterThan(0);
    expect(demolished.every((e) => actionOf(e, view) === 'demolished')).toBe(true);
    // Åtgärden gäller inte utan jämförelse.
    expect(filterElements(doc, { state: proposal }, storey, { ...emptyCriteria(), actions: ['demolished'] }).length).toBe(shown.filter((e) => typeOf(e.type)?.global || e.states.includes(proposal)).length);
    expect(filterElements(doc, view, storey, { ...emptyCriteria(), states: [proposal], types: ['Wall'] }).every((e) => e.states.includes(proposal))).toBe(true);
    const wall = shown.find((e) => e.type === 'Wall')!;
    doc.elements[wall.id] = { ...wall, pen: { weight: 0.5 } };
    expect(ids(filterElements(doc, view, storey, { ...emptyCriteria(), types: ['Wall'], ownPen: 'with' }))).toEqual([wall.id]);
    expect(filterElements(doc, view, storey, { ...emptyCriteria(), types: ['Wall'], ownPen: 'without' }).map((e) => e.id)).not.toContain(wall.id);
  });

  it('egen egenskap: finns, och innehåller värdet; objektets eller typens', () => {
    const { doc, storey, view, shown } = setup();
    const [a, b] = shown.filter((e) => e.type === 'Door');
    doc.elements[a.id] = { ...a, props: { Egna: { Brandklass: 'EI 30' } } };
    doc.elements[b.id] = { ...b, props: { Egna: { brandklass: 'EI 60' } } };
    expect(propertyNames(doc, Object.values(doc.elements))).toContain('Brandklass');
    const prop = (value: string) => filterElements(doc, view, storey, { ...emptyCriteria(), prop: { key: 'Brandklass', value } });
    expect(ids(prop(''))).toEqual(ids([a, b]));
    expect(ids(prop('ei 30'))).toEqual([a.id]);
  });

  it('alla våningar, och ersätt, lägg till och dra ifrån', () => {
    const { doc, storey, view } = setup();
    const wall = Object.values(doc.elements).find((e) => e.type === 'Wall' && e.storey === storey)!;
    doc.storeys.push({ id: 'pl-2', name: 'Plan 2', elevation: 2700, height: 2700 });
    doc.elements['ovan'] = { ...wall, id: 'ovan', storey: 'pl-2' };
    const c = { ...emptyCriteria(), types: ['Wall'] };
    expect(filterElements(doc, view, storey, c).map((e) => e.id)).not.toContain('ovan');
    expect(filterElements(doc, view, storey, { ...c, allStoreys: true }).map((e) => e.id)).toContain('ovan');
    expect(combine(['a', 'b'], ['b', 'c'], 'replace')).toEqual(['b', 'c']);
    expect(combine(['a', 'b'], ['b', 'c'], 'add')).toEqual(['a', 'b', 'c']);
    expect(combine(['a', 'b'], ['b', 'c'], 'subtract')).toEqual(['a']);
  });
});
