import type { PenDef, StyleSheet } from '../core/graphics';
import { lineTypeDash } from '../core/lineTypes';
import type { Pen } from './primitives';

/**
 * Pennor för dörrarnas och fönstrens delar (0.8.33), i tre klasser i
 * stilmallen (`pens`, samma tabell som markörerna): snitt (karmarna), vy
 * (dörrblad, bågar och glas) och symbol (slagbågen, öppningssättet i
 * fasader). Symbollinjerna är tunnast från början.
 */
export const OPENING_PENS = [
  { key: 'openingCut', label: 'Snitt', hint: 'Dörrarnas och fönstrens karmar i planen', weight: 0.25 },
  { key: 'openingView', label: 'Vy', hint: 'Dörrblad, bågar och glas i planen', weight: 0.18 },
  { key: 'openingSymbol', label: 'Symbol', hint: 'Slagbågen i planen, öppningssättet i fasader', weight: 0.13 },
] as const;

export type OpeningPenKey = (typeof OPENING_PENS)[number]['key'];
export type OpeningClass = 'cut' | 'view' | 'symbol';

const KEY_OF: Record<OpeningClass, OpeningPenKey> = { cut: 'openingCut', view: 'openingView', symbol: 'openingSymbol' };

/** Delarna som ritas med symbolpennan: slagbågen i planen och öppningssättet i fasader. */
export const SYMBOL_PARTS: ReadonlySet<string> = new Set(['slagbåge', 'swing']);

/** Förvalet för en klass. */
export function defaultOpeningPen(key: OpeningPenKey): PenDef {
  return { weight: OPENING_PENS.find((m) => m.key === key)!.weight };
}

/** Pennan för en klass, ur stilmallen eller förvalet, med färg och linjetyp. */
export function openingPen(style: StyleSheet | undefined, cls: OpeningClass): Pen {
  const key = KEY_OF[cls];
  const own = style?.pens?.[key];
  const weight = own?.weight ?? defaultOpeningPen(key).weight;
  const color = own?.color && own.color !== 'ink' ? (own.color as Pen['color']) : undefined;
  const dash = lineTypeDash(style, own?.linetype);
  return { weight, ...(color ? { color } : {}), ...(dash ? { dash } : {}) };
}

/** Alla tre pennorna, för en dörr eller ett fönster som ritas. */
export function openingPens(style: StyleSheet | undefined): Record<OpeningClass, Pen> {
  return { cut: openingPen(style, 'cut'), view: openingPen(style, 'view'), symbol: openingPen(style, 'symbol') };
}
