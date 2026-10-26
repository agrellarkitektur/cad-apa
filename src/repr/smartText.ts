import { PAPER } from '../core/sheets';
import { BUILT_IN, folderName } from '../core/sheetFields';
import type { ProjectDoc, Sheet } from '../core/model';

/**
 * Smarttext (0.8 del 3): text som fylls i av sig själv, t.ex. `{skala}`
 * eller `{ritningsnummer}`. Texterna i ett mallblad fylls i från bladet som
 * använder mallen, och texter på bladet från bladet självt. Sedan 0.8.10 är
 * allt annat inom klamrar fält (`src/core/sheetFields.ts`).
 */

/** Den inbyggda smarttexten och vad den betyder, för hjälptexter. */
export const SMART_TEXT = BUILT_IN;

export { expandSmartText } from '../elements/textLayout';

/** Skalorna på bladet: "1:100" eller "1:100, 1:50", störst först. Med `factor` för ett annat papper. */
export function sheetScales(sheet: Pick<Sheet, 'viewports'>, factor = 1): string {
  const all = [...new Set(sheet.viewports.map((v) => Math.round(v.scale * factor)))].sort((a, b) => b - a);
  return all.map((n) => `1:${n}`).join(', ');
}

/** Hur mycket större skalans nämnare blir när bladet skrivs ut på A3 (2 för A1). */
function a3Factor(sheet: Pick<Sheet, 'size'>): number {
  return Math.max(...(PAPER[sheet.size] ?? PAPER.A3)) / PAPER.A3[0];
}

/**
 * Värdena för smarttexten på ett blad: bladets fält, projektets fält och
 * den inbyggda smarttexten. Skalorna kan skrivas över med bladets fält.
 */
export function smartVars(doc: Pick<ProjectDoc, 'project' | 'folders' | 'tree'> & Partial<Pick<ProjectDoc, 'site'>>, sheet: Sheet, todayText: string): Record<string, string> {
  const own = (k: string) => sheet.fields[k]?.trim();
  return {
    ...sheet.fields,
    ...doc.project.fields,
    projekt: doc.project.name,
    ritningsnummer: sheet.number,
    innehåll: sheet.name,
    mapp: folderName(doc, sheet.id),
    skala: own('skala') || sheetScales(sheet),
    'skala a3': own('skala a3') || sheetScales(sheet, a3Factor(sheet)),
    format: sheet.size,
    idag: todayText,
    licens: doc.site?.licence ?? '',
  };
}
