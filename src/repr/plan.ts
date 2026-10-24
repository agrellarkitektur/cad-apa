import type { ActionStyle, StyleSheet } from '../core/graphics';
import type { Element, Id, ProjectDoc } from '../core/model';
import type { Action, ViewStates } from '../core/states';
import { allTypes, typeOf, type ElementType, type PlanContext, type PlanItem } from '../elements/registry';
import { autoDimensions } from '../elements/autoDims';
import { createContext } from './context';
import { sameItems } from './reuse';
import type { Pen, Primitive, Vec2 } from './primitives';

/** Det som går att klicka på i planen: ett element med sina ytor och linjer. */
export interface Pickable {
  id: Id;
  /** Högre ligger överst och vinner vid klick. */
  priority: number;
  regions: Vec2[][][];
  /** Ytorna är mjuka (se `pickSoft` i registry.ts). */
  soft?: boolean;
  prims: Primitive[];
}

export interface PlanResult {
  prims: Primitive[];
  pickables: Pickable[];
}

/**
 * Bygger en planvy: vilka element som syns på ett våningsplan i ett visst
 * tillstånd, deras primitiver och grafiken för befintligt, rivs och nytt.
 *
 * Elementtyperna ritar sina former. Färger, fyllningar och streckning för
 * varje åtgärd läggs på här, från projektets stilmall, så att grafiken går
 * att byta utan att röra någon elementtyp.
 *
 * Planen ritas i grupper (typ och åtgärd), och varje grupp sparas (0.8.3).
 * Nästa gång återanvänds en grupp om dess element är desamma och inget av
 * det typen läser (`planReads`) har ändrats; element som bara ritar sig
 * själva återanvänds ett och ett. Har inget ändrats alls ges samma svar
 * tillbaka, så att planvyn inte behöver rita om.
 */
export function buildPlan(doc: ProjectDoc, storey: Id, view: ViewStates, style: StyleSheet = doc.graphics): PlanResult {
  const saved = savedFor(doc, storey, view, style);
  if (saved.elements === doc.elements && saved.result) return saved.result;
  const { ctx, visible } = createContext(doc, storey, view, style, (t) => !!(t.plan || t.planBatch));

  // Rita i typernas ordning; rivet sist så att de streckade linjerna syns.
  const groups = new Map<string, PlanItem[]>();
  for (const item of visible) {
    const key = `${typeOf(item.el.type)!.drawOrder + (item.action === 'demolished' ? 1000 : 0)}|${item.el.type}|${item.action}|${ctx.hiddenInView(item.el) ? 'dold' : ''}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  const keys = [...groups.keys()].sort((a, b) => parseFloat(a) - parseFloat(b));

  // Elementen per typ i hela projektet, för att se om det en grupp läser har ändrats.
  const byType = new Map<string, Element[]>();
  for (const el of Object.values(doc.elements)) {
    const list = byType.get(el.type);
    if (list) list.push(el);
    else byType.set(el.type, [el]);
  }
  const readsOf = (t: ElementType): unknown[] => {
    if (!t.planReads) return [doc.elements];
    const names = t.planReads.flatMap((r) => (r === 'hosted' ? allTypes().filter((h) => h.hosted).map((h) => h.type) : [r]));
    return [...new Set(names)].flatMap((n) => byType.get(n) ?? []);
  };

  const prims: Primitive[] = [];
  // Fyllningar i 2D-former (0.8.19) ritas under modellen: efter underlagen, före väggarna.
  const under: Primitive[] = [];
  let underAt = 0;
  const pickables: Pickable[] = [];
  const groupsNow = new Map<string, SavedGroup>();
  const singlesNow = new Map<Id, SavedSingle>();
  for (const key of keys) {
    const items = groups.get(key)!;
    const t = typeOf(items[0].el.type)!;
    const inputs = [...items.map((i) => i.el), ...readsOf(t)];
    let group = saved.groups.get(key);
    if (!group || !sameItems(group.inputs, inputs)) {
      group = drawGroup(t, items, ctx, style, saved.singles, singlesNow);
      group.inputs = inputs;
    } else if (!t.planBatch && t.planReads?.length === 0) {
      for (const { el } of items) {
        const one = saved.singles.get(el.id);
        if (one) singlesNow.set(el.id, one);
      }
    }
    groupsNow.set(key, group);
    for (const p of group.prims) (p.under ? under : prims).push(p);
    if (parseFloat(key) < UNDER_ORDER) underAt = prims.length;
    for (const p of group.pickables) pickables.push(p);
  }
  if (view.autoDims && view.compareTo && !view.place && !view.hide?.includes('Dimension')) prims.push(...autoDimensions(ctx));
  saved.groups = groupsNow;
  saved.singles = singlesNow;
  saved.elements = doc.elements;
  saved.result = { prims: under.length ? [...prims.slice(0, underAt), ...under, ...prims.slice(underAt)] : prims, pickables };
  return saved.result;
}

/** Typer som ritas före fyllningarna i 2D-formerna (underlagen). */
const UNDER_ORDER = 4;

/** En ritad grupp: det den ritades av, primitiverna med stil och det som går att klicka på. */
interface SavedGroup {
  inputs: unknown[];
  prims: Primitive[];
  pickables: Pickable[];
}

/** Ett element som bara ritar sig självt (`planReads: []`), ritat och med stil. */
interface SavedSingle {
  el: Element;
  prims: Primitive[];
  pickable: Pickable;
}

function drawGroup(t: ElementType, items: PlanItem[], ctx: PlanContext, style: StyleSheet, before: Map<Id, SavedSingle>, now: Map<Id, SavedSingle>): SavedGroup {
  const action = items[0].action;
  const s = style.actions[ctx.styleKeyOf(action)];
  const hidden = ctx.hiddenInView(items[0].el);
  const styled = (p: Primitive) => (hidden ? ghost(applyStyle(p, s, action, style)) : applyStyle(p, s, action, style));
  const pickable = (el: Element, own: Primitive[]): Pickable => ({
    id: el.id,
    priority: t.drawOrder,
    regions: t.pickShape ? t.pickShape(el, ctx) : [],
    ...(t.pickSoft ? { soft: true } : {}),
    prims: own,
  });

  // Element som bara ritar sig själva: ett och ett, och oförändrade återanvänds.
  if (!t.planBatch && t.planReads?.length === 0) {
    const prims: Primitive[] = [];
    const pickables: Pickable[] = [];
    for (const { el } of items) {
      let one = before.get(el.id);
      if (!one || one.el !== el) {
        const own = t.plan!(el, ctx);
        one = { el, prims: own.map(styled), pickable: pickable(el, own) };
      }
      now.set(el.id, one);
      for (const p of one.prims) prims.push(p);
      pickables.push(one.pickable);
    }
    return { inputs: [], prims, pickables };
  }

  // Varje element ritas en gång; samma primitiver används för att markera det.
  const owns = items.map(({ el }) => (t.plan ? t.plan(el, ctx) : []));
  const drawn = t.planBatch ? t.planBatch(items, ctx) : owns.flat();
  return { inputs: [], prims: drawn.map(styled), pickables: items.map(({ el }, i) => pickable(el, owns[i])) };
}

/**
 * Det sparade för en vy: ett per våningsplan (eller yta), vy och stilmall,
 * och allt i projektet utom elementen (definitioner, tillstånd, filer och
 * projektets inställningar, som ändras sällan) ska vara samma objekt. De
 * senast använda sparas.
 */
interface SavedPlan {
  key: string;
  style: StyleSheet;
  fields: unknown[];
  elements: ProjectDoc['elements'] | null;
  result: PlanResult | null;
  groups: Map<string, SavedGroup>;
  singles: Map<Id, SavedSingle>;
}

const SAVED_VIEWS = 12;
const savedPlans: SavedPlan[] = [];

function savedFor(doc: ProjectDoc, storey: Id, view: ViewStates, style: StyleSheet): SavedPlan {
  const key = `${storey}|${JSON.stringify(view)}`;
  const fields = (Object.keys(doc) as (keyof ProjectDoc)[]).filter((k) => k !== 'elements').map((k) => doc[k]);
  const i = savedPlans.findIndex((p) => p.key === key && p.style === style && sameItems(p.fields, fields));
  const plan = i >= 0 ? savedPlans.splice(i, 1)[0] : { key, style, fields, elements: null, result: null, groups: new Map(), singles: new Map() };
  savedPlans.unshift(plan);
  if (savedPlans.length > SAVED_VIEWS) savedPlans.pop();
  return plan;
}

/** Ett 2D-element som inte syns i vyn men visas för att hittas: tunt, grått och streckat. */
function ghost(p: Primitive): Primitive {
  const pen: Pen = { weight: 0.13, color: 'muted', dash: [1, 1] };
  if (p.kind === 'region') return { ...p, fill: { kind: 'none' }, outline: pen, ownFill: true };
  if (p.kind === 'text') return { ...p, pen: { ...p.pen, color: 'muted' } };
  if (p.kind === 'image') return { ...p, opacity: Math.min(p.opacity, 0.25) };
  return { ...p, pen } as Primitive;
}

/** Lägg på stilmallens färger, fyllningar och streckning för åtgärden. */
export function applyStyle(p: Primitive, s: ActionStyle, action: Action, sheet: StyleSheet): Primitive {
  if (p.kind === 'text' || p.kind === 'image') return p;
  if (p.kind === 'region') {
    if (p.ownFill) return p;
    const rs = p.styleAs ? sheet.actions[p.styleAs] : s;
    const o = p.noOutline ? null : rs.cutOutline;
    return { ...p, fill: rs.cutFill, outline: o ? { weight: o.weight, color: o.color, dash: o.dash } : null };
  }
  const pen: Pen = { ...p.pen };
  if (!pen.color || pen.color === 'ink') pen.color = s.lines.color;
  if (s.lines.dash?.length) pen.dash = s.lines.dash;
  // Möbler och annan tunn grafik blir svart när den rivs, så att den syns.
  if (action === 'demolished' && pen.color === 'muted') pen.color = s.lines.color;
  return { ...p, pen } as Primitive;
}

const pickableMaps = new WeakMap<readonly Pickable[], ReadonlyMap<Id, Pickable>>();

/**
 * Det ritade objektet för ett id (0.8.15). Listan ändras inte när planen väl
 * är byggd, så uppslaget görs en gång per plan i stället för vid varje
 * musrörelse. Finns samma id två gånger gäller det sista, som förut.
 */
export function pickableById(pickables: readonly Pickable[]): ReadonlyMap<Id, Pickable> {
  let map = pickableMaps.get(pickables);
  if (!map) pickableMaps.set(pickables, (map = new Map(pickables.map((p) => [p.id, p]))));
  return map;
}
