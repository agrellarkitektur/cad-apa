import type { ProjectDoc } from '../core/model';
import { areaText } from '../core/general';
import { defaultSchedule } from '../core/schedules';
import { roundArea } from '../elements/areaCalc';
import { scheduleTable } from './schedules';

/**
 * Areorna som smarttext (0.12.3): `{BOA}`, `{BTA}`, `{BYA}`, `{BRA}` …
 * för hela projektet i förslaget, i hela m² (summaposter, SS 21054 4.3),
 * t.ex. *96 m²*. Saknas slaget blir texten tom.
 */
export const AREA_TAGS: readonly [string, string][] = [
  ['BYA', 'Byggnadsarea, markplanet med de mätvärda taksprången'],
  ['BTA', 'Bruttoarea, alla våningar'],
  ['BRA', 'Bruksarea, summan av BOA, BIA, LOA och ÖVA'],
  ['BOA', 'Boarea'],
  ['BIA', 'Biarea'],
  ['LOA', 'Lokalarea'],
  ['ÖVA', 'Övrig area'],
  ['OPA', 'Öppenarea'],
];

const cache = new WeakMap<object, Record<string, string>>();

/** Värdena per tagg (nyckeln med små bokstäver, som fälten). */
export function areaVars(doc: ProjectDoc): Record<string, string> {
  const hit = cache.get(doc);
  if (hit) return hit;
  const out: Record<string, string> = {};
  const hasAreas = Object.values(doc.elements).some((e) => e.type === 'Wall' || e.type === 'Area');
  if (hasAreas) {
    const t = scheduleTable(doc, { id: 'areas', name: 'Areor', ...defaultSchedule('Area') });
    for (const g of t.groups) {
      const v = g.rows.reduce((a, r) => a + (r[3].value ?? 0), 0);
      if (g.label && v > 0) out[g.label.toLowerCase()] = areaText(roundArea(v, 0), 0);
    }
  }
  for (const [k] of AREA_TAGS) out[k.toLowerCase()] ??= '';
  cache.set(doc, out);
  return out;
}
