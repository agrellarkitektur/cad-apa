import type { Color, FillDef, PenDef, StyleSheet } from '../core/graphics';
import { lineTypeDash } from '../core/lineTypes';
import type { Pen } from './primitives';

/**
 * Pennorna för pilar och markörer (0.8.26): linjetjocklek och färg som
 * ställs in centralt i stilmallen (`pens`, samma tabell som fasadernas och
 * sektionernas linjer). Det som saknas i stilmallen har förvalet här.
 * Färgen gäller markörens linjer, pilspetsar, fyllda trianglar och text;
 * tjockleken gäller linjerna (texten behåller sin).
 */
export const MARKER_PENS = [
  { key: 'sectionLine', label: 'Sektionslinje', hint: 'Ändar, skaft, pil och bokstav', weight: 0.5 },
  { key: 'elevationLine', label: 'Fasadlinje', hint: 'Linje, triangel och namn', weight: 0.18 },
  { key: 'north', label: 'Norrpil', hint: 'Cirkel, pil och N', weight: 0.18 },
  { key: 'roomLeader', label: 'Rumsstämpelns pil', hint: 'När stämpeln står utanför rummet', weight: 0.18 },
  { key: 'roofSlope', label: 'Taklutning', hint: 'Båge eller triangel och gradtal', weight: 0.18 },
  { key: 'dimension', label: 'Mått', hint: 'Måttlinje, hjälplinjer och måttal', weight: 0.18 },
  { key: 'dimensionTick', label: 'Måttens snedstreck', hint: 'Strecket i varje måttpunkt', weight: 0.35 },
  { key: 'level', label: 'Nivåkota', hint: 'I fasader och sektioner', weight: 0.18 },
  { key: 'litteraLeader', label: 'Litterans streck', hint: 'Från väggens littera in till väggen', weight: 0.18 },
] as const;

/**
 * Rummens kontur (0.8.34), i samma tabell. Från början ingen linje (0);
 * ett rum eller en rumstyp kan få en egen penna.
 */
export const ROOM_PENS = [{ key: 'roomOutline', label: 'Rummens kontur', hint: 'Ingen linje från början; ligger under väggarna', weight: 0 }] as const;

export type MarkerPenKey = (typeof MARKER_PENS)[number]['key'] | (typeof ROOM_PENS)[number]['key'];

/** Förvalet för en markörpenna. */
export function defaultMarkerPen(key: MarkerPenKey): PenDef {
  return { weight: [...MARKER_PENS, ...ROOM_PENS].find((m) => m.key === key)!.weight };
}

/**
 * Pennan för en sorts markör, ur stilmallen eller förvalet, med linjetypen
 * (0.8.30). Pilspetsar och fyllda trianglar ritas heldragna (`solidPen`).
 */
export function markerPen(style: StyleSheet | undefined, key: MarkerPenKey): Pen {
  return stylePen(style, key, defaultMarkerPen(key).weight);
}

/**
 * En rad i stilmallens penntabell (`pens`) som penna: tjockleken (eller
 * förvalet), färgen om den inte är svart, och linjetypens streckning.
 * Markörerna och dörrarnas och fönstrens klasser (0.8.33) läser så.
 */
export function stylePen(style: StyleSheet | undefined, key: string, weight: number): Pen {
  const own = style?.pens?.[key];
  const color = own?.color && own.color !== 'ink' ? (own.color as Pen['color']) : undefined;
  const dash = lineTypeDash(style, own?.linetype);
  return { weight: own?.weight ?? weight, ...(color ? { color } : {}), ...(dash ? { dash } : {}) };
}

/** Samma penna heldragen, för pilspetsar och trianglar (0.8.30). */
export function solidPen(pen: Pen): Pen {
  if (!pen.dash) return pen;
  const { dash: _, ...rest } = pen;
  return rest;
}

/** Samma penna med en annan tjocklek, t.ex. för text (färgen följer med). */
export function withWeight(pen: Pen, weight: number): Pen {
  return pen.color ? { weight, color: pen.color } : { weight };
}

/** En fylld triangel i pennans färg (svart om pennan saknar egen färg). */
export function penFill(pen: Pen): FillDef {
  const c = pen.color;
  return { kind: 'solid', color: c && c.startsWith('#') ? (c as Color) : 'ink' };
}
