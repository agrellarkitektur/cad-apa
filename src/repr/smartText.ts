import type { ProjectDoc, Sheet } from '../core/model';

/**
 * Smarttext (0.8 del 3): text som fylls i av sig själv, t.ex. `{skala}`
 * eller `{ritningsnummer}`. Sedan 0.8.8 fylls texterna i ett mallblad i från
 * bladet som använder mallen, och texter på bladet från bladet självt.
 */

/** Smarttextens namn och vad de betyder, för hjälptexter. */
export const SMART_TEXT: [string, string][] = [
  ['projekt', 'Projektets namn'],
  ['adress', 'Adress'],
  ['fastighet', 'Fastighetsbeteckning'],
  ['beställare', 'Beställare'],
  ['uppdragsnummer', 'Uppdragsnummer'],
  ['arkitekt', 'Arkitekt (företag)'],
  ['ansvarig', 'Ansvarig'],
  ['ritningsnummer', 'Bladets ritningsnummer'],
  ['innehåll', 'Bladets namn'],
  ['skala', 'Vyernas skalor, t.ex. 1:100'],
  ['format', 'Pappersformatet, t.ex. A3'],
  ['datum', 'Bladets datum'],
  ['skede', 'Skede, t.ex. BYGGLOVSHANDLING'],
  ['ändring', 'Ändring'],
  ['ritat', 'Ritat av'],
  ['granskat', 'Granskat av'],
  ['idag', 'Dagens datum'],
];

/** Byt ut `{namn}` mot värdet. Okända namn står kvar som de är. */
export function expandSmartText(text: string, vars: Record<string, string>): string {
  return text.replace(/\{([^{}]+)\}/g, (m, name: string) => {
    const k = name.trim().toLowerCase();
    return k in vars ? vars[k] : m;
  });
}

/** Skalorna på bladet: "1:100" eller "1:100, 1:50", störst först. */
export function sheetScales(sheet: Pick<Sheet, 'viewports'>): string {
  const all = [...new Set(sheet.viewports.map((v) => v.scale))].sort((a, b) => b - a);
  return all.map((n) => `1:${n}`).join(', ');
}

/** Värdena för smarttexten på ett blad. Skalan kan skrivas över i bladets fält. */
export function smartVars(doc: Pick<ProjectDoc, 'project'>, sheet: Sheet, todayText: string): Record<string, string> {
  const f = doc.project.fields;
  const s = sheet.fields;
  return {
    projekt: doc.project.name,
    adress: f.adress ?? '',
    fastighet: f.fastighet ?? '',
    beställare: f.bestallare ?? '',
    bestallare: f.bestallare ?? '',
    uppdragsnummer: f.uppdragsnummer ?? '',
    arkitekt: f.arkitekt ?? '',
    ansvarig: f.ansvarig ?? '',
    ritningsnummer: sheet.number,
    innehåll: sheet.name,
    skala: s.skala?.trim() || sheetScales(sheet),
    format: sheet.size,
    datum: s.datum ?? '',
    skede: s.skede ?? 'BYGGLOVSHANDLING',
    ändring: s.andring ?? '',
    andring: s.andring ?? '',
    ritat: s.ritat ?? '',
    granskat: s.granskat ?? '',
    idag: todayText,
  };
}
