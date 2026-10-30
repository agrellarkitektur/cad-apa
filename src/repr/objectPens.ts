import type { PenDef, StyleSheet } from '../core/graphics';
import { lineTypeDash } from '../core/lineTypes';
import { defaultedPen } from './markerPens';
import type { Pen } from './primitives';

/**
 * Snitt- och konturlinjer i planen (0.10.37, ersätter dörrarnas och
 * fönstrens klasser *Snitt*, *Vy* och *Symbol* från 0.8.33): ett ställe
 * per objekttyp och del i stilbokens penntabell (`pens`). Snittlinjen är
 * konturen där objektet skärs; konturlinjen det oskurna som syns.
 * Snittlinjen ger tjockleken, och när jämförelsen är på ger åtgärden färg
 * och streckning (`applyStyle`). Över- och undersnitten (`planCutPens.ts`)
 * gäller läget och är kvar som egna ställen.
 */
export const OBJECT_PENS = [
  { key: 'wallCut', group: 'walls', label: 'Vägg: snittlinje', hint: 'Väggarnas kontur i snittet och igensatta hål', weight: 0.35, tags: ['vägg', 'snitt', 'snittlinje'] },
  { key: 'wallContour', group: 'walls', label: 'Vägg: konturlinje', hint: 'Det oskurna: vägghålets kanter under fönstren', weight: 0.13, tags: ['vägg', 'kontur', 'konturlinje', 'hål'] },
  { key: 'doorFrameCut', group: 'doors', label: 'Dörr: karm (snitt)', hint: 'Karmarna i snittet', weight: 0.25, tags: ['dörr', 'karm', 'snitt', 'snittlinje'] },
  { key: 'doorLeaf', group: 'doors', label: 'Dörr: blad', hint: 'Dörrbladet och glasningen', weight: 0.18, tags: ['dörr', 'dörrblad', 'kontur'] },
  { key: 'doorSwing', group: 'doors', label: 'Dörr: slagbåge', hint: 'Slagbågen', weight: 0.13, tags: ['dörr', 'slagbåge', 'symbol'] },
  { key: 'windowFrameCut', group: 'windows', label: 'Fönster: karm (snitt)', hint: 'Sidokarmarna i snittet', weight: 0.25, tags: ['fönster', 'karm', 'snitt', 'snittlinje'] },
  { key: 'windowFrameContour', group: 'windows', label: 'Fönster: karm (kontur)', hint: 'Under- och överkarmen sedda uppifrån', weight: 0.18, tags: ['fönster', 'karm', 'kontur', 'konturlinje'] },
  { key: 'windowSash', group: 'windows', label: 'Fönster: båge', hint: 'Bågarna (i Detalj)', weight: 0.18, tags: ['fönster', 'båge', 'kontur'] },
  { key: 'windowGlass', group: 'windows', label: 'Fönster: glas', hint: 'Glaset', weight: 0.18, tags: ['fönster', 'glas', 'kontur'] },
  { key: 'slabCut', group: 'others', label: 'Bjälklag: snittlinje', hint: 'Bjälklag som går genom snittet, t.ex. i ett souterränghus', weight: 0.35, tags: ['bjälklag', 'snitt', 'snittlinje'] },
  { key: 'roofCut', group: 'others', label: 'Tak: snittlinje', hint: 'Taket där snitthöjden går genom det', weight: 0.35, tags: ['tak', 'snitt', 'snittlinje'] },
  { key: 'groundCut', group: 'others', label: 'Stödmur: snittlinje', hint: 'Stödmurar som går genom snittet', weight: 0.35, tags: ['stödmur', 'snitt', 'snittlinje'] },
  { key: 'furnitureFixed', group: 'others', label: 'Fast inredning: konturlinje', hint: 'Kök, bad och skåp', weight: 0.25, tags: ['möbel', 'fast inredning', 'kontur', 'konturlinje'] },
  { key: 'furniture', group: 'others', label: 'Möbel: konturlinje', hint: 'Lösa möbler', weight: 0.18, color: 'muted', tags: ['möbel', 'kontur', 'konturlinje'] },
] as const satisfies readonly { key: string; group: string; label: string; hint: string; weight: number; color?: string; tags: readonly string[] }[];

export type ObjectPenKey = (typeof OBJECT_PENS)[number]['key'];

const BY_KEY = new Map<string, (typeof OBJECT_PENS)[number]>(OBJECT_PENS.map((p) => [p.key, p]));

/** Förvalet för ett objekts ställe, eller undefined om nyckeln inte är ett. */
export function defaultObjectPen(key: string): PenDef | undefined {
  const d = BY_KEY.get(key);
  if (!d) return undefined;
  return { weight: d.weight, ...('color' in d ? { color: d.color } : {}) };
}

/** Pennan för ett objekts ställe, ur stilboken eller förvalet, med färg och linjetyp. */
export function objectPen(style: StyleSheet | undefined, key: ObjectPenKey): Pen {
  return defaultedPen(style, key, defaultObjectPen(key)!);
}

/** Snittlinjens ställe för en objekttyp; igensatta hål och öppningsmarkeringar är väggens. */
export function cutRowOf(objectType: string | undefined): ObjectPenKey {
  return objectType === 'Slab' ? 'slabCut' : objectType === 'Roof' ? 'roofCut' : objectType === 'Ground' ? 'groundCut' : 'wallCut';
}

/** Snittlinjens tjocklek, färg och linjetyp (streckning) för en objekttyp. */
export function cutRowPen(style: StyleSheet, objectType: string | undefined): { weight: number; color?: string; dash?: number[] } {
  const key = cutRowOf(objectType);
  const row: PenDef = { ...defaultObjectPen(key)!, ...style.pens?.[key] };
  const dash = lineTypeDash(style, row.linetype);
  return { weight: row.weight, ...(row.color && row.color !== 'ink' ? { color: row.color } : {}), ...(dash ? { dash } : {}) };
}

/** Delarna som är symboler: slagbågen i planen och öppningssättet i fasader. Den egna pennans *Symbol* gäller dem. */
export const SYMBOL_PARTS: ReadonlySet<string> = new Set(['slagbåge', 'swing']);
