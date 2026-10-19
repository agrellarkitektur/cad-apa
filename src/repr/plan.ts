import type { ActionStyle, StyleSheet } from '../core/graphics';
import type { Id, ProjectDoc } from '../core/model';
import type { Action, ViewStates } from '../core/states';
import { typeOf, type PlanItem } from '../elements/registry';
import { autoDimensions } from '../elements/autoDims';
import { createContext } from './context';
import type { Pen, Primitive, Vec2 } from './primitives';

/** Det som går att klicka på i planen: ett element med sina ytor och linjer. */
export interface Pickable {
  id: Id;
  /** Högre ligger överst och vinner vid klick. */
  priority: number;
  regions: Vec2[][][];
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
 */
export function buildPlan(doc: ProjectDoc, storey: Id, view: ViewStates, style: StyleSheet = doc.graphics): PlanResult {
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

  const prims: Primitive[] = [];
  const pickables: Pickable[] = [];
  for (const key of keys) {
    const items = groups.get(key)!;
    const t = typeOf(items[0].el.type)!;
    const s = style.actions[ctx.styleKeyOf(items[0].action)];
    const drawn = t.planBatch ? t.planBatch(items, ctx) : items.flatMap(({ el }) => t.plan!(el, ctx));
    const hidden = ctx.hiddenInView(items[0].el);
    for (const p of drawn) prims.push(hidden ? ghost(applyStyle(p, s, items[0].action, style)) : applyStyle(p, s, items[0].action, style));

    for (const { el } of items) {
      const own = t.plan ? t.plan(el, ctx) : [];
      pickables.push({
        id: el.id,
        priority: t.drawOrder,
        regions: t.pickShape ? t.pickShape(el, ctx) : [],
        prims: own,
      });
    }
  }
  if (view.autoDims && view.compareTo && !view.place && !view.hide?.includes('Dimension')) prims.push(...autoDimensions(ctx));
  return { prims, pickables };
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
