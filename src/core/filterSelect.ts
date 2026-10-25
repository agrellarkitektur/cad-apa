import { effectivePen } from '../repr/ownPen';
import { ownProp } from '../elements/littera';
import { typeOf } from '../elements/registry';
import { homeOf } from './visibility';
import type { Element, Id, ProjectDoc } from './model';
import { actionOf, type Action, type ViewStates } from './states';

/**
 * Filtrera och markera (0.8.35): vilka objekt som stämmer med villkoren.
 * Alla villkor ska stämma; ett tomt villkor gäller allt. Bara det som syns
 * i det visade tillståndet räknas (som *Markera alla väggar*).
 */
export interface FilterCriteria {
  /** Sorterna (`Wall`, `Door` …); tom = alla. */
  types: string[];
  /** Typerna (definitionernas id); tom = alla. */
  definitions: Id[];
  /** Tillstånden objektet ska finnas i, alla; tom = inget villkor. */
  states: Id[];
  /** Åtgärderna i jämförelsen (befintligt, rivs, nytt); tom = alla. */
  actions: Action[];
  /** Egen penna, objektets eller typens. */
  ownPen: 'any' | 'with' | 'without';
  /** En egen egenskap; tomt värde = egenskapen har ett värde. Värdet ska finnas i egenskapens text. */
  prop: { key: string; value: string } | null;
  /** Alla våningar, inte bara den som visas (bara i modellen). */
  allStoreys: boolean;
}

export const emptyCriteria = (): FilterCriteria => ({ types: [], definitions: [], states: [], actions: [], ownPen: 'any', prop: null, allStoreys: false });

/** Objekten att välja bland: på ytan (eller alla våningar), synliga i tillståndet. */
export function filterScope(doc: ProjectDoc, view: ViewStates, place: Id, allStoreys: boolean): Element[] {
  const storeys = new Set(doc.storeys.map((s) => s.id));
  const wide = allStoreys && storeys.has(place);
  return Object.values(doc.elements).filter((e) => {
    if (!typeOf(e.type)) return false;
    if (wide ? e.space || !storeys.has(e.storey) : homeOf(e) !== place) return false;
    // På ett blad eller mallblad följer inget tillstånden; i modellen bara det som syns.
    return !storeys.has(homeOf(e)) || typeOf(e.type)!.global || actionOf(e, view) !== 'absent';
  });
}

/** Objektens egna egenskaper och deras typers, för listan. */
export function propertyNames(doc: ProjectDoc, els: readonly Element[]): string[] {
  const names = new Map<string, string>();
  const add = (props: Element['props'] | undefined) => {
    for (const set of Object.values(props ?? {})) for (const k of Object.keys(set ?? {})) if (!names.has(k.toLowerCase())) names.set(k.toLowerCase(), k);
  };
  for (const e of els) {
    add(e.props);
    if (e.definition) add(doc.definitions[e.definition]?.props);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b, 'sv'));
}

/** Om objektet stämmer med villkoren. */
export function matches(doc: ProjectDoc, view: ViewStates, el: Element, c: FilterCriteria): boolean {
  if (c.types.length && !c.types.includes(el.type)) return false;
  if (c.definitions.length && !(el.definition && c.definitions.includes(el.definition))) return false;
  if (c.states.length && !c.states.every((s) => el.states.includes(s))) return false;
  if (c.actions.length && view.compareTo && !c.actions.includes(actionOf(el, view))) return false;
  if (c.ownPen !== 'any' && (el.type === 'Shape2D' ? false : !!effectivePen(doc, el)) !== (c.ownPen === 'with')) return false;
  if (c.prop?.key) {
    const v = ownProp([el.props, el.definition ? doc.definitions[el.definition]?.props : undefined], c.prop.key);
    if (!v) return false;
    if (c.prop.value && !v.toLocaleLowerCase('sv').includes(c.prop.value.toLocaleLowerCase('sv'))) return false;
  }
  return true;
}

/** Objekten på ytan som stämmer med villkoren. */
export function filterElements(doc: ProjectDoc, view: ViewStates, place: Id, c: FilterCriteria): Element[] {
  return filterScope(doc, view, place, c.allStoreys).filter((e) => matches(doc, view, e, c));
}

/** Den nya markeringen: ersätt, lägg till eller dra ifrån. */
export function combine(current: readonly Id[], found: readonly Id[], how: 'replace' | 'add' | 'subtract'): Id[] {
  if (how === 'replace') return [...found];
  if (how === 'add') return [...new Set([...current, ...found])];
  const drop = new Set(found);
  return current.filter((id) => !drop.has(id));
}
