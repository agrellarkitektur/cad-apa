import type { PenDef, StyleSheet } from '../core/graphics';
import { lineTypeDash } from '../core/lineTypes';
import type { Pen } from './primitives';
import type { EdgePart } from './solids';

/**
 * Fasadernas och sektionernas linjer (0.8, i stilboken sedan 0.10.36):
 * en penna per del av det som syns bortom snittet (vägghål, karm, båge,
 * glas …), i samma tabell som markörerna (`pens`, nyckeln är delens namn).
 * Snittets kontur ställs in under Åtgärder.
 */
export const FACADE_PENS: readonly { key: EdgePart; label: string; hint: string; weight: number; color?: string; linetype?: string; tags: readonly string[] }[] = [
  { key: 'hole', label: 'Vägghål', hint: 'Hålets kant, tjockare än karmen', weight: 0.35, tags: ['vägg', 'dörr', 'fönster', 'hål'] },
  { key: 'wall', label: 'Väggar', hint: 'Väggarnas kanter och hörn', weight: 0.25, tags: ['vägg'] },
  { key: 'roof', label: 'Tak', hint: 'Takfot, nock och gavlar', weight: 0.25, tags: ['tak'] },
  { key: 'frame', label: 'Karmar', hint: 'Dörrarnas och fönstrens karmar', weight: 0.25, tags: ['dörr', 'fönster', 'karm'] },
  { key: 'sash', label: 'Bågar', hint: 'Fönstrens bågar', weight: 0.25, tags: ['fönster', 'båge'] },
  { key: 'leaf', label: 'Dörrblad', hint: 'Dörrarnas blad', weight: 0.25, tags: ['dörr', 'dörrblad'] },
  { key: 'sill', label: 'Bleck', hint: 'Fönsterbleck under fönstren', weight: 0.25, tags: ['fönster', 'bleck'] },
  { key: 'lining', label: 'Foder', hint: 'Dörrarnas och fönstrens foder', weight: 0.18, tags: ['dörr', 'fönster', 'foder'] },
  { key: 'handle', label: 'Handtag', hint: 'Dörrarnas handtag', weight: 0.18, tags: ['dörr', 'handtag'] },
  { key: 'joint', label: 'Skarvar', hint: 'Skarven mellan befintligt och nytt', weight: 0.13, color: 'muted', tags: ['vägg', 'skarv'] },
  { key: 'glass', label: 'Glas', hint: 'Glasets linjer', weight: 0.13, color: 'muted', tags: ['fönster', 'dörr', 'glas'] },
  { key: 'swing', label: 'Öppningssätt', hint: 'Dörrarnas och fönstrens öppningssätt', weight: 0.13, linetype: 'dashed', tags: ['dörr', 'fönster', 'symbol'] },
];

const BY_KEY = new Map(FACADE_PENS.map((p) => [p.key as string, p]));

/** Förvalet för en fasadlinje, eller undefined om nyckeln inte är en. */
export function defaultFacadePen(key: string): PenDef | undefined {
  const d = BY_KEY.get(key);
  if (!d) return undefined;
  return { weight: d.weight, ...(d.color ? { color: d.color } : {}), ...(d.linetype ? { linetype: d.linetype } : {}) };
}

/**
 * Pennan för en del i fasaden eller sektionen: förvalet och stilbokens rad
 * ovanpå (med linjetypens streckning).
 */
export function facadePen(style: StyleSheet, part: EdgePart): Pen {
  const d = BY_KEY.get(part)!;
  const base: Pen = { weight: d.weight, ...(d.color ? { color: d.color as Pen['color'] } : {}), ...(d.linetype ? { dash: lineTypeDash(style, d.linetype) } : {}) };
  const pen: Pen = base;
  const own = style.pens?.[part];
  if (!own) return pen;
  const out: Pen = { ...pen, weight: own.weight };
  if (own.color) out.color = own.color as Pen['color'];
  if (own.linetype) {
    const dash = lineTypeDash(style, own.linetype);
    if (dash) out.dash = dash;
    else delete out.dash;
  }
  return out;
}
