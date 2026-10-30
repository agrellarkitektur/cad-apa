import type { ActionKey } from '../../core/graphics';
import { sameValue, styleDiff, type CategoryShow, type ViewCategory } from '../../core/viewCategories';
import { isShown, setShown, SHOW_GROUPS } from '../app/showKeys';

/**
 * Raderna i stilboken som är ändrade mot nivån ovanför (0.10.33): en
 * kategori mot sitt förval, en vy mot sin kategori. En rad är det som har
 * ett eget fält i dialogen:
 * - `show:<nyckel>`: jämförelsen och detaljnivåerna,
 * - `item:<nyckel>`: ett kryss under Innehåll (samma nycklar som under Visa),
 * - `actions.<åtgärd>`, `pens.<nyckel>`: en åtgärds rad och en penna,
 * - `underlays`: underlagen i vyn (0.10.35), hela listan som en rad,
 * - `scale`, `kind`: kategorins skala för nya vyer och Platsens sort.
 */

const SHOW_ROWS = ['compare', 'detail', 'labelDetail', 'modelDetail'] as const;

/** Kryssen under Innehåll, utan dubbletter. */
const contentKeys = (extra: readonly string[] = []): string[] => [...new Set([...SHOW_GROUPS.flatMap((g) => g.items.map(([k]) => k)), ...extra])];

/** Raderna som skiljer `cur` från `ref`. `extra` är fler kryss (det generella litterats sorter). */
export function changedRows(ref: ViewCategory, cur: ViewCategory, extra: readonly string[] = [], withCategoryRows = true): Set<string> {
  const out = new Set<string>();
  for (const k of SHOW_ROWS) if (ref.show[k] !== cur.show[k]) out.add(`show:${k}`);
  for (const k of contentKeys(extra)) if (isShown(ref.show, k) !== isShown(cur.show, k)) out.add(`item:${k}`);
  if (!sameValue(ref.show.underlays ?? [], cur.show.underlays ?? [])) out.add('underlays');
  for (const k of Object.keys(styleDiff(ref.style, cur.style))) if (k !== 'openingMark') out.add(k);
  if (withCategoryRows) {
    if (ref.scale !== cur.scale) out.add('scale');
    if ((ref.kind ?? null) !== (cur.kind ?? null)) out.add('kind');
  }
  return out;
}

/** `cur` med raden `row` tillbaka som i `ref`. */
export function resetRow(cur: ViewCategory, ref: ViewCategory, row: string): ViewCategory {
  const next: ViewCategory = structuredClone(cur);
  if (row.startsWith('show:')) {
    const k = row.slice(5) as (typeof SHOW_ROWS)[number];
    (next.show as unknown as Record<string, unknown>)[k] = (ref.show as CategoryShow)[k];
  } else if (row.startsWith('item:')) {
    const k = row.slice(5);
    setShown(next.show, k, isShown(ref.show, k));
  } else if (row.startsWith('actions.')) {
    const k = row.slice(8) as ActionKey;
    next.style.actions[k] = structuredClone(ref.style.actions[k]);
  } else if (row.startsWith('pens.')) {
    const k = row.slice(5);
    const pens = { ...next.style.pens };
    const p = ref.style.pens?.[k];
    if (p) pens[k] = structuredClone(p);
    else delete pens[k];
    if (Object.keys(pens).length) next.style.pens = pens;
    else delete next.style.pens;
  } else if (row === 'underlays') {
    if (ref.show.underlays?.length) next.show.underlays = structuredClone(ref.show.underlays);
    else delete next.show.underlays;
  } else if (row === 'scale') next.scale = ref.scale;
  else if (row === 'kind') {
    if (ref.kind) next.kind = ref.kind;
    else delete next.kind;
  }
  return next;
}

/** Fältet i dialogen som raden hör till, för att hitta raden att sätta pricken på. */
export function rowSelector(row: string): string {
  if (row.startsWith('show:')) return `[data-cat-show="${CSS.escape(row.slice(5))}"]`;
  if (row.startsWith('item:')) return `[data-cat-hide="${CSS.escape(row.slice(5))}"]`;
  if (row.startsWith('actions.')) return `[data-key="${CSS.escape(row.slice(8))}"]`;
  if (row.startsWith('pens.')) return `[data-pen^="${CSS.escape(row.slice(5))}:"]`;
  if (row === 'underlays') return '[data-cat-underlays]';
  if (row === 'scale') return '[data-cat-scale]';
  return '[data-cat-kind]';
}
