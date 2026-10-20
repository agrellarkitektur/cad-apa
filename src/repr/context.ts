import type { ActionKey, StyleSheet } from '../core/graphics';
import { modelViewId, type Element, type Id, type ProjectDoc } from '../core/model';
import { actionOf, existingState, type Action, type ViewStates } from '../core/states';
import { homeOf, shownIn, type ViewIdentity } from '../core/visibility';
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
  // Det som hör hemma på ytan som ritas (planen, en fasad, sektion eller ett
  // arbetsblad), och 2D-element från andra ytor som valts att synas i just den här vyn.
  const place = view.place ?? storey;
  const identity: ViewIdentity = { id: view.viewId ?? modelViewId(place), place, tags: view.viewTags ?? [] };
  const onStorey = Object.values(doc.elements).filter((e) => homeOf(e) === place || (e.show?.kind === 'views' && e.show.views.includes(identity.id)));
  const hiddenHere = new Set<Id>();

  const actionFor = (el: Element): Action => {
    const t = typeOf(el.type);
    if (!t) return 'absent';
    if (t.global) return 'plain';
    return t.compares ? actionOf(el, view) : el.states.includes(view.state) ? 'plain' : 'absent';
  };

  const visible: PlanItem[] = [];
  for (const el of onStorey) {
    const t = typeOf(el.type);
    if (!t) continue; // Okända typer ligger kvar i filen men visas inte.
    const action = actionFor(el);
    if (action === 'absent' || !include(t, action)) continue;
    if (view.hide?.includes(el.type)) continue;
    // Visas i (format 5): 2D-element, text och mått kan vara valda för vissa vyer.
    if (el.show && !shownIn(el, identity)) {
      if (!view.showHidden || homeOf(el) !== place) continue;
      hiddenHere.add(el.id);
    }
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
  // Öppningarna per vägg, uppslagna en gång i stället för en gång per vägg (0.8.3).
  let byHost: Map<Id, Element[]> | null = null;
  const openingsByHost = (): Map<Id, Element[]> => {
    if (byHost) return byHost;
    byHost = new Map();
    for (const e of onStorey) {
      if (!e.host || !presentInView(e)) continue;
      const list = byHost.get(e.host);
      if (list) list.push(e);
      else byHost.set(e.host, [e]);
    }
    return byHost;
  };
  const ctx: PlanContext = {
    doc,
    view,
    style,
    scale: view.scale ?? 100,
    actionOf: actionFor,
    styleOf: (el) => style.actions[styleKeyOf(actionFor(el))],
    styleKeyOf,
    doorAngleOf: (el) => style.actions[existingId && el.states.includes(existingId) ? 'existing' : 'new'].doorAngle,
    openingsIn: (hostId) => openingsByHost().get(hostId) ?? [],
    visible: (type) => visible.filter((v) => !type || v.el.type === type).map((v) => v.el),
    memo: <T>(key: string, fn: () => T): T => {
      if (!memo.has(key)) memo.set(key, fn());
      return memo.get(key) as T;
    },
    params: <P>(el: Element<any>) => resolveParams<P>(doc, el),
    hiddenInView: (el) => hiddenHere.has(el.id),
  };
  return { ctx, visible };
}

export function actionKey(a: Action): ActionKey {
  return a === 'absent' ? 'plain' : a;
}
