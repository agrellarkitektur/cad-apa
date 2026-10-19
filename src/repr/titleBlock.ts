import type { ProjectDoc, Sheet } from '../core/model';
import { textWidth } from '../formats/helvetica';
import type { Primitive, Vec2 } from './primitives';

/**
 * Ritningshuvudet enligt BH90 (0.8 del 3) och smarttext: text som fylls i
 * av sig själv, t.ex. `{skala}` eller `{ritningsnummer}`.
 *
 * Huvudet är 180 mm brett (så att ett vikt blad blir A4) och står i
 * ritningsramens nedre högra hörn. Rutorna har en liten rubrik överst och
 * värdet under. Allt anges i mm på papperet, y uppåt.
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

/** Värdena för smarttexten på ett blad. */
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
    skala: sheetScales(sheet),
    format: sheet.size,
    datum: s.datum ?? '',
    skede: s.skede ?? 'BYGGLOVSHANDLING',
    ändring: s.andring ?? '',
    idag: todayText,
  };
}

/** En ruta i huvudet: läge och storlek, rubrik och värde (med smarttext). */
interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  value: string;
  /** Värdets texthöjd, mm. */
  size?: number;
  bold?: boolean;
  /** Fler rader under värdet, mindre. */
  more?: string[];
  logo?: boolean;
}

export const TITLE_BLOCK_WIDTH = 180;

/**
 * Rutorna nedifrån och upp: uppdrag, ritningsnummer och ändring längst ned,
 * sedan skala, datum och signaturer, ritningens innehåll, skede, projektet
 * med beställaren, och överst arkitekten med logga och ansvarig.
 */
function cells(doc: Pick<ProjectDoc, 'project'>, sheet: Sheet): Cell[] {
  const s = sheet.fields;
  const f = doc.project.fields;
  const W = TITLE_BLOCK_WIDTH;
  const rows = [12, 9, 14, 9, 15, 16];
  const y: number[] = [];
  rows.reduce((acc, h, i) => ((y[i] = acc), acc + h), 0);
  return [
    { x: 0, y: y[0], w: 40, h: rows[0], label: 'Uppdragsnummer', value: f.uppdragsnummer ?? '{uppdragsnummer}' },
    { x: 40, y: y[0], w: 105, h: rows[0], label: 'Ritningsnummer', value: '{ritningsnummer}', size: 5, bold: true },
    { x: 145, y: y[0], w: 35, h: rows[0], label: 'Ändring', value: s.andring ?? '–', size: 3.5 },
    { x: 0, y: y[1], w: 45, h: rows[1], label: 'Skala', value: s.skala ?? '{skala}' },
    { x: 45, y: y[1], w: 45, h: rows[1], label: 'Datum', value: s.datum ?? '' },
    { x: 90, y: y[1], w: 45, h: rows[1], label: 'Ritat av', value: s.ritat ?? '' },
    { x: 135, y: y[1], w: 45, h: rows[1], label: 'Granskat av', value: s.granskat ?? '' },
    { x: 0, y: y[2], w: W, h: rows[2], label: 'Ritningens innehåll', value: '{innehåll}', size: 5, bold: true },
    { x: 0, y: y[3], w: W, h: rows[3], label: 'Skede', value: s.skede ?? 'BYGGLOVSHANDLING', size: 3.5, bold: true },
    {
      x: 0,
      y: y[4],
      w: 120,
      h: rows[4],
      label: 'Projekt',
      value: '{projekt}',
      size: 3.5,
      bold: true,
      more: [[f.adress, f.fastighet].filter(Boolean).join(' · ')].filter(Boolean),
    },
    { x: 120, y: y[4], w: 60, h: rows[4], label: 'Beställare', value: f.bestallare ?? '' },
    { x: 0, y: y[5], w: 120, h: rows[5], label: 'Arkitekt', value: f.arkitekt ?? '', size: 3.5, bold: true, logo: true },
    { x: 120, y: y[5], w: 60, h: rows[5], label: 'Ansvarig', value: f.ansvarig ?? '' },
  ];
}

/** Huvudets höjd, mm. */
export const TITLE_BLOCK_HEIGHT = 12 + 9 + 14 + 9 + 15 + 16;

/** Korta en text så att den får plats i bredden, med … sist. */
function fit(text: string, size: number, width: number, bold?: boolean): string {
  if (textWidth(text, size, bold) <= width) return text;
  let t = text;
  while (t.length > 1 && textWidth(`${t}…`, size, bold) > width) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/**
 * Ritningshuvudet som primitiver, med nedre högra hörnet i `corner`.
 * Loggan ritas som en bild om projektet har en.
 */
export function titleBlockPrims(doc: Pick<ProjectDoc, 'project'>, sheet: Sheet, corner: Vec2, todayText: string): Primitive[] {
  const vars = smartVars(doc, sheet, todayText);
  const x0 = corner[0] - TITLE_BLOCK_WIDTH;
  const y0 = corner[1];
  const origin = { objectType: 'TitleBlock', part: 'ritningshuvud' };
  const thin = { weight: 0.18 };
  const outline = { weight: 0.35 };
  const out: Primitive[] = [];
  const logoId = doc.project.fields.logo;
  const ratio = Number(doc.project.fields.logoRatio) || 3;
  for (const c of cells(doc, sheet)) {
    const x = x0 + c.x;
    const y = y0 + c.y;
    out.push({
      kind: 'polyline',
      points: [
        [x, y],
        [x + c.w, y],
        [x + c.w, y + c.h],
        [x, y + c.h],
      ],
      closed: true,
      pen: thin,
      origin,
    });
    out.push({ kind: 'text', at: [x + 1.5, y + c.h - 2.6], text: c.label.toUpperCase(), height: 1.6, pen: { weight: 0.13 }, origin });
    let tx = x + 1.5;
    const room = c.w - 3;
    if (c.logo && logoId) {
      // Loggan till vänster i rutan, högst 10 mm hög och 40 mm bred.
      const lh = Math.min(10, c.h - 5, 40 / ratio);
      const lw = lh * ratio;
      out.push({ kind: 'image', corner: [x + 2, y + 1.8], u: [lw, 0], v: [0, lh], source: { asset: logoId }, opacity: 1, origin });
      tx = x + 2 + lw + 3;
    }
    const size = c.size ?? 2.5;
    const value = fit(expandSmartText(c.value, vars), size, x + 1.5 + room - tx, c.bold);
    const lines = c.more?.map((m) => fit(expandSmartText(m, vars), 2.2, x + 1.5 + room - tx)) ?? [];
    const base = y + 2.4 + lines.length * 3.4;
    if (value) out.push({ kind: 'text', at: [tx, base], text: value, height: size, bold: c.bold, pen: { weight: 0.25 }, origin });
    lines.forEach((l, i) => out.push({ kind: 'text', at: [tx, base - 3.4 * (i + 1)], text: l, height: 2.2, pen: { weight: 0.18 }, origin }));
  }
  // Ytterkanten tjockare.
  out.push({
    kind: 'polyline',
    points: [
      [x0, y0],
      [x0 + TITLE_BLOCK_WIDTH, y0],
      [x0 + TITLE_BLOCK_WIDTH, y0 + TITLE_BLOCK_HEIGHT],
      [x0, y0 + TITLE_BLOCK_HEIGHT],
    ],
    closed: true,
    pen: outline,
    origin,
  });
  return out;
}
