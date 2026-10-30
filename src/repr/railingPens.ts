import type { PenDef, StyleSheet } from '../core/graphics';
import { defaultedPen } from './markerPens';
import type { Pen } from './primitives';

/**
 * Räckenas ställen (0.11.1), gruppen *Räcken* i stilboken. I planen:
 * konturlinjen (räcket som en linje i Skiss och Normal), det ovanför
 * planens snitt (streckprickat, som trappans steg), stolparna och
 * ledstången (i Detalj, och ledstångens förlängning från Normal). I
 * fasader och sektioner: snittlinjen och konturlinjen.
 */
export const RAIL_PENS = [
  { key: 'railContour', label: 'Räcke: konturlinje', hint: 'Räcket i planen: en linje i Skiss och Normal, handledaren i Detalj', weight: 0.25, view: 'plan', tags: ['räcke', 'kontur', 'konturlinje'] },
  { key: 'railAbove', label: 'Räcke: över snittet', hint: 'Det av räcket som står på trappsteg ovanför planens snitt', weight: 0.18, linetype: 'dashdot', view: 'plan', tags: ['räcke', 'över snittet'] },
  { key: 'railPost', label: 'Räcke: stolpar', hint: 'Stolpar och konsoler, i Detalj', weight: 0.18, view: 'plan', tags: ['räcke', 'stolpe', 'konsol'] },
  { key: 'railHandrail', label: 'Räcke: handledare', hint: 'Handledaren och liggarna, i Detalj', weight: 0.18, view: 'plan', tags: ['räcke', 'handledare', 'liggare'] },
  { key: 'railGrab', label: 'Räcke: ledstång', hint: 'Ledstången med förlängningen förbi trappan (från Normal)', weight: 0.18, view: 'plan', tags: ['räcke', 'ledstång'] },
  { key: 'railGate', label: 'Räcke: grind', hint: 'Grindens blad i öppet läge, grindstolparna och litteran (0.11.3)', weight: 0.18, view: 'plan', tags: ['räcke', 'grind', 'blad'] },
  { key: 'railGateSwing', label: 'Räcke: grindens slagbåge', hint: 'Slagbågen, som dörrarnas; skjutgrindens väg', weight: 0.13, linetype: 'dashed', view: 'plan', tags: ['räcke', 'grind', 'slagbåge', 'öppningssätt'] },
  { key: 'railCut', label: 'Räcke: snittlinje', hint: 'Räcket där en sektion går genom det', weight: 0.25, view: 'elev', tags: ['räcke', 'snitt', 'snittlinje'] },
  { key: 'railElev', label: 'Räcke: konturlinje (fasad och sektion)', hint: 'Räckets delar bortom snittet', weight: 0.13, view: 'elev', tags: ['räcke', 'kontur', 'konturlinje'] },
] as const satisfies readonly { key: string; label: string; hint: string; weight: number; linetype?: string; color?: string; view: 'plan' | 'elev'; tags: readonly string[] }[];

export type RailPenKey = (typeof RAIL_PENS)[number]['key'];

type RailRow = { key: string; weight: number; linetype?: string; color?: string };
const BY_KEY = new Map<string, RailRow>(RAIL_PENS.map((p): [string, RailRow] => [p.key, p]));

/** Om nyckeln är ett av räckenas ställen. */
export const isRailPen = (key: string | undefined): key is RailPenKey => !!key && BY_KEY.has(key);

/** Förvalet för ett av räckenas ställen. */
export function defaultRailPen(key: string): PenDef | undefined {
  const d = BY_KEY.get(key);
  if (!d) return undefined;
  return { weight: d.weight, ...(d.color ? { color: d.color } : {}), ...(d.linetype ? { linetype: d.linetype } : {}) };
}

/** Pennan för ett av räckenas ställen. */
export function railPen(style: StyleSheet | undefined, key: RailPenKey): Pen {
  return defaultedPen(style, key, defaultRailPen(key)!);
}
