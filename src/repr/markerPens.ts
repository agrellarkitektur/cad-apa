import type { Color, FillDef, PenDef, StyleSheet } from '../core/graphics';
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

export type MarkerPenKey = (typeof MARKER_PENS)[number]['key'];

/** Förvalet för en markörpenna. */
export function defaultMarkerPen(key: MarkerPenKey): PenDef {
  return { weight: MARKER_PENS.find((m) => m.key === key)!.weight };
}

/** Pennan för en sorts markör, ur stilmallen eller förvalet. */
export function markerPen(style: StyleSheet | undefined, key: MarkerPenKey): Pen {
  const own = style?.pens?.[key];
  const weight = own?.weight ?? defaultMarkerPen(key).weight;
  const color = own?.color && own.color !== 'ink' ? (own.color as Pen['color']) : undefined;
  return color ? { weight, color } : { weight };
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
