import type { PenDef, StyleSheet } from '../core/graphics';
import { defaultedPen } from './markerPens';
import type { Pen } from './primitives';

/**
 * Profilernas ställen (0.11.6), gruppen *Profiler* i stilboken. I planen:
 * snittlinjen (en pelare som går genom planens snitt, med materialets
 * snitt), konturlinjen (det under snittet, t.ex. en sockellist) och det
 * över snittet (en balk, streckprickad). I fasader och sektioner:
 * snittlinjen och konturlinjen.
 */
export const PROFILE_PENS = [
  { key: 'profileCut', label: 'Profil: snittlinje', hint: 'En profil som går genom planens snitt, t.ex. en pelare', weight: 0.35, view: 'plan', tags: ['profil', 'pelare', 'snitt', 'snittlinje'] },
  { key: 'profileContour', label: 'Profil: konturlinje', hint: 'Profiler under planens snitt: lister, socklar', weight: 0.18, view: 'plan', tags: ['profil', 'list', 'kontur', 'konturlinje'] },
  { key: 'profileAbove', label: 'Profil: över snittet', hint: 'Balkar och gesimser över planens snitt', weight: 0.18, linetype: 'dashdot', view: 'plan', tags: ['profil', 'balk', 'över snittet'] },
  { key: 'profileSectionCut', label: 'Profil: snittlinje (sektion)', hint: 'Profilen där en sektion går genom den', weight: 0.35, view: 'section', tags: ['profil', 'snitt', 'snittlinje'] },
  { key: 'profileElev', label: 'Profil: konturlinje (fasad och sektion)', hint: 'Profilens kanter bortom snittet', weight: 0.18, view: 'elev', tags: ['profil', 'kontur', 'konturlinje'] },
] as const satisfies readonly { key: string; label: string; hint: string; weight: number; linetype?: string; view: 'plan' | 'elev' | 'section'; tags: readonly string[] }[];

export type ProfilePenKey = (typeof PROFILE_PENS)[number]['key'];

type Row = { key: string; weight: number; linetype?: string; color?: string };
const BY_KEY = new Map<string, Row>(PROFILE_PENS.map((p): [string, Row] => [p.key, p]));

/** Förvalet för ett av profilernas ställen. */
export function defaultProfilePen(key: string): PenDef | undefined {
  const d = BY_KEY.get(key);
  if (!d) return undefined;
  return { weight: d.weight, ...(d.color ? { color: d.color } : {}), ...(d.linetype ? { linetype: d.linetype } : {}) };
}

/** Pennan för ett av profilernas ställen. */
export function profilePen(style: StyleSheet | undefined, key: ProfilePenKey): Pen {
  return defaultedPen(style, key, defaultProfilePen(key)!);
}
