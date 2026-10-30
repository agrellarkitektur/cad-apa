import type { PenDef, StyleSheet } from '../core/graphics';
import { defaultedPen } from './markerPens';
import type { Pen } from './primitives';

/**
 * Trappornas ställen (0.11), gruppen *Trappor* i stilboken. Facit är Carl
 * Augusts trappskiss för bygglov i 1:50: det under snittet heldraget, det
 * ovanför streckprickat med snittlinjen snett över, gångriktningen från
 * ring till pil, plansteg i golvnivå streckat. Snittlinjen gäller också
 * trappans snitt i sektionerna.
 */
export const STAIR_PENS = [
  { key: 'stairCut', label: 'Trappa: snittlinje', hint: 'Linjen snett över trappan där planens snitt går, och trappans snitt i sektionerna', weight: 0.25, tags: ['trappa', 'snitt', 'snittlinje'] },
  { key: 'stairContour', label: 'Trappa: konturlinje', hint: 'Trappans sidor, början och slut under snittet', weight: 0.25, tags: ['trappa', 'kontur', 'konturlinje'] },
  { key: 'stairBelow', label: 'Trappa: steg under snittet', hint: 'Stegens framkanter under snittet, och hela trappan i våningen ovanför', weight: 0.18, tags: ['trappa', 'steg', 'under snittet'] },
  { key: 'stairAbove', label: 'Trappa: steg över snittet', hint: 'Stegen och sidorna ovanför snittet', weight: 0.18, linetype: 'dashdot', tags: ['trappa', 'steg', 'över snittet'] },
  { key: 'stairFloorTread', label: 'Trappa: plansteg i golvnivå', hint: 'Första plansteget i golvet, och det sista i våningen ovanför', weight: 0.18, linetype: 'dashed', tags: ['trappa', 'plansteg'] },
  { key: 'stairNosing', label: 'Trappa: stegnos', hint: 'Sättstegen under stegnosen, i Detalj', weight: 0.13, linetype: 'dashedShort', color: 'muted', tags: ['trappa', 'stegnos'] },
  { key: 'stairWalk', label: 'Trappa: gångriktning', hint: 'Gånglinjen med ring i början och pil i slutet', weight: 0.18, tags: ['trappa', 'gånglinje', 'gångriktning'] },
] as const satisfies readonly { key: string; label: string; hint: string; weight: number; linetype?: string; color?: string; tags: readonly string[] }[];

export type StairPenKey = (typeof STAIR_PENS)[number]['key'];

const BY_KEY = new Map<string, (typeof STAIR_PENS)[number]>(STAIR_PENS.map((p) => [p.key, p]));

/** Förvalet för ett av trappornas ställen. */
export function defaultStairPen(key: string): PenDef | undefined {
  const d = BY_KEY.get(key);
  if (!d) return undefined;
  return { weight: d.weight, ...('color' in d ? { color: d.color } : {}), ...('linetype' in d ? { linetype: d.linetype } : {}) };
}

/** Pennan för ett av trappornas ställen. */
export function stairPen(style: StyleSheet | undefined, key: StairPenKey): Pen {
  return defaultedPen(style, key, defaultStairPen(key)!);
}
