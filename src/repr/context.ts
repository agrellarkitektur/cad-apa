import type { ActionKey, StyleSheet } from '../core/graphics';
import type { Element, Id, ProjectDoc } from '../core/model';
import { actionOf, existingState, type Action, type ViewStates } from '../core/states';
import { resolveParams, typeOf, type ElementType, type PlanContext, type PlanItem } from '../elements/registry';

/**
 * Gemensam grund för planen och 3D-vyn: vilka element på ett våningsplan som
 * syns i en vy, med vilken åtgärd, och kontexten som elementtyperna ritar med.
 */
export function createContext(
  doc: ProjectDoc,
  storey: Id,
  view: ViewStates,
  style: StyleSheet,
  include: (t: ElementType, action: Action) => boolean,
): { ctx: PlanContext; visible: PlanItem[] } {
  const onStorey = Object.values(doc.elements).filter((e) => e.storey === storey);

  const actionFor = (el: Element): Action => {
    const t = typeOf(el.type);
    if (!t) return 'absent';
    return t.compares ? actionOf(el, view) : el.states.includes(view.state) ? 'plain' : 'absent';
  };

  const visible: PlanItem[] = [];
  for (const el of onStorey) {
    const t = typeOf(el.type);
    if (!t) continue; // Okända typer ligger kvar i filen men visas inte.
    const action = actionFor(el);
    if (action === 'absent' || !include(t, action)) continue;
    if (view.hide?.includes(el.type)) continue;
    // Rivna dörrar behålls även när rivet döljs: igensättningen ska synas.
    if (action === 'demolished' && view.hideDemolished && !t.hosted) continue;
    visible.push({ el, action });
  }

  // Visas Befintligt utan jämförelse ritas allt som befintligt, med 30°-dörrar.
  const viewingExisting = !view.compareTo && doc.states.find((s) => s.id === view.state)?.kind === 'existing';
  const styleKeyOf = (a: Action): ActionKey => (a === 'plain' && viewingExisting ? 'existing' : actionKey(a));

  const existingId = existingState(doc)?.id;
  const memo = new Map<string, unknown>();
  const presentInView = (el: Element) => el.states.includes(view.state);
  const ctx: PlanContext = {
    doc,
    view,
    style,
    scale: 100,
    actionOf: actionFor,
    styleOf: (el) => style.actions[styleKeyOf(actionFor(el))],
    styleKeyOf,
    doorAngleOf: (el) => style.actions[existingId && el.states.includes(existingId) ? 'existing' : 'new'].doorAngle,
    openingsIn: (hostId) => onStorey.filter((e) => e.host === hostId && presentInView(e)),
    visible: (type) => visible.filter((v) => !type || v.el.type === type).map((v) => v.el),
    memo: <T>(key: string, fn: () => T): T => {
      if (!memo.has(key)) memo.set(key, fn());
      return memo.get(key) as T;
    },
    params: <P>(el: Element<any>) => resolveParams<P>(doc, el),
  };
  return { ctx, visible };
}

export function actionKey(a: Action): ActionKey {
  return a === 'absent' ? 'plain' : a;
}
