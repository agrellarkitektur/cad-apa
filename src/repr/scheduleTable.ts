import type { Id } from '../core/model';
import { textWidth } from '../formats/drawingFont';
import type { Cell, LitteraInfo, ScheduleTable } from './schedules';
import type { FigureRole, OpeningFigure } from './openingFigure';
import type { Pen, Primitive } from './primitives';

/**
 * Förteckningens tabell ritad (0.12.2), som en vy på ett blad: rubrikraden,
 * gruppernas rubriker, raderna, delsummorna och summaraden. Måtten är på
 * papperet (mm); primitiverna lämnas i vyns koordinater (papperets mm gånger
 * skalan), så att bladet flyttar, ramar in och klipper tabellen som en vy.
 * Tabellens övre vänstra hörn ligger i 0,0.
 *
 * En tabell som är högre än `maxHeight` bryts i delar som står bredvid
 * varandra, med rubrikraden överst i varje (Carl August 10 november, C).
 */

export const TABLE_TEXT = 2.5;
export const ROW_HEIGHT = 5.5;
const PAD = 1.5;
const GAP = 8;
const MIN_COL = 10;

const GRID: Pen = { weight: 0.13 };
const FRAME: Pen = { weight: 0.25 };
const HEAD_LINE: Pen = { weight: 0.35 };

type Line = { kind: 'row' | 'group' | 'sum' | 'total' | 'empty'; cells?: Cell[]; label?: string };

/** Tabellens rader i ordning, utan rubrikraden. */
function linesOf(t: ScheduleTable): Line[] {
  const out: Line[] = [];
  for (const g of t.groups) {
    if (g.label !== undefined) out.push({ kind: 'group', label: g.label });
    for (const r of g.rows) out.push({ kind: 'row', cells: r });
    if (g.sums) out.push({ kind: 'sum', cells: g.sums, label: `Summa ${g.label ?? ''}`.trim() });
  }
  if (!t.count) out.push({ kind: 'empty', label: 'Inga objekt' });
  if (t.total) out.push({ kind: 'total', cells: t.total, label: 'Summa' });
  return out;
}

const shown = (c: Cell) => c.text || '-';

/** Kolumnernas bredd på papperet, mm. */
export function columnWidths(t: ScheduleTable): number[] {
  const w = t.columns.map((c) => textWidth(c.title, TABLE_TEXT, true) + 2 * PAD);
  for (const l of linesOf(t)) {
    l.cells?.forEach((c, i) => (w[i] = Math.max(w[i], textWidth(shown(c), TABLE_TEXT, l.kind !== 'row') + 2 * PAD)));
    // *Summa* står i första kolumnen när den är tom där.
    if (l.cells && !l.cells[0].text && l.label) w[0] = Math.max(w[0], textWidth(l.label, TABLE_TEXT, true) + 2 * PAD);
  }
  return w.map((x) => Math.max(MIN_COL, Math.ceil(x)));
}

/** Tabellens storlek på papperet utan brytning, mm. */
export function tableSize(t: ScheduleTable): [number, number] {
  const w = columnWidths(t).reduce((a, b) => a + b, 0);
  return [w, (linesOf(t).length + 1) * ROW_HEIGHT];
}

/**
 * Tabellen som primitiver i vyns koordinater (papperets mm × `scale`), med
 * det övre vänstra hörnet i 0,0. `maxHeight` (mm på papperet) bryter den i
 * delar bredvid varandra.
 */
export function schedulePrims(t: ScheduleTable, opt: { id: Id; scale?: number; maxHeight?: number; maxWidth?: number }): Primitive[] {
  if (t.littera) return litteraPrims(t, t.littera, opt);
  const k = opt.scale ?? 1;
  const origin = { objectType: 'Schedule', objectId: opt.id, part: 'tabell' };
  const widths = columnWidths(t);
  const total = widths.reduce((a, b) => a + b, 0);
  const lines = linesOf(t);
  // Raderna per del: minst en rad under rubriken, också när höjden är liten.
  const perPart = Math.max(1, Math.floor((opt.maxHeight ?? Infinity) / ROW_HEIGHT) - 1);
  const parts: Line[][] = [];
  for (let i = 0; i < lines.length; i += perPart) parts.push(lines.slice(i, i + perPart));
  if (!parts.length) parts.push([]);
  const out: Primitive[] = [];
  const P = (x: number, y: number): [number, number] => [x * k, y * k];
  const text = (x: number, top: number, s: string, align: 'start' | 'end', bold: boolean) =>
    out.push({ kind: 'text', at: P(x, top - (ROW_HEIGHT + TABLE_TEXT * 0.72) / 2), text: s, height: TABLE_TEXT, align, bold, pen: { weight: bold ? 0.25 : 0.18 }, origin });
  const hline = (x0: number, x1: number, y: number, pen: Pen) => out.push({ kind: 'line', a: P(x0, y), b: P(x1, y), pen, origin });
  parts.forEach((part, pi) => {
    const x0 = pi * (total + GAP);
    const h = (part.length + 1) * ROW_HEIGHT;
    // Rubrikraden.
    let x = x0;
    t.columns.forEach((c, i) => {
      if (c.number) text(x + widths[i] - PAD, 0, c.title, 'end', true);
      else text(x + PAD, 0, c.title, 'start', true);
      x += widths[i];
    });
    hline(x0, x0 + total, -ROW_HEIGHT, HEAD_LINE);
    // Kolumnernas linjer; gruppernas rubriker går över alla kolumner.
    const spans: [number, number][] = [];
    part.forEach((l, ri) => {
      const top = -(ri + 1) * ROW_HEIGHT;
      if (l.kind === 'group' || l.kind === 'empty') {
        text(x0 + PAD, top, l.label ?? '', 'start', l.kind === 'group');
        spans.push([top, top - ROW_HEIGHT]);
      } else {
        let cx = x0;
        l.cells!.forEach((c, i) => {
          const s = i === 0 && !c.text && l.label ? l.label : l.kind === 'row' ? shown(c) : c.text;
          if (s) {
            if (t.columns[i].number && !(i === 0 && s === l.label)) text(cx + widths[i] - PAD, top, s, 'end', l.kind !== 'row');
            else text(cx + PAD, top, s, 'start', l.kind !== 'row');
          }
          cx += widths[i];
        });
      }
      const bottom = top - ROW_HEIGHT;
      if (ri < part.length - 1) hline(x0, x0 + total, bottom, part[ri + 1].kind === 'total' ? HEAD_LINE : GRID);
    });
    // Lodräta linjer mellan kolumnerna, avbrutna vid gruppernas rubriker.
    x = x0;
    for (let i = 0; i < widths.length - 1; i++) {
      x += widths[i];
      let y = 0;
      for (const [a, b] of spans) {
        if (a < y) out.push({ kind: 'line', a: P(x, y), b: P(x, a), pen: GRID, origin });
        y = b;
      }
      if (y > -h) out.push({ kind: 'line', a: P(x, y), b: P(x, -h), pen: GRID, origin });
    }
    out.push({ kind: 'polyline', points: [P(x0, 0), P(x0 + total, 0), P(x0 + total, -h), P(x0, -h)], closed: true, pen: FRAME, origin });
  });
  return out;
}

// ---------------------------------------------------------------------------
// Uppställd per littera (0.12.5)

const MIN_LITTERA_COL = 22;
const FIG_PAD = 4;
/** Platsen för måtten: under ritningen (bredden) och till höger om den (höjden), mm. */
const DIM_SPACE = 7;
const DIM_TEXT = 1.8;
const NOTE_WIDTH = 70;
const NOTE_STEP = 4;

/** Ritningens pennor per roll: karmens kontur, delarna, det tunna och öppningssymbolen. */
export const FIGURE_PENS: Record<FigureRole, Pen> = {
  frame: { weight: 0.25 },
  part: { weight: 0.18 },
  thin: { weight: 0.13 },
  symbol: { weight: 0.13 },
  symbolIn: { weight: 0.13, dash: [1.5, 1] },
};

const dimText = (v: number) => String(Math.round(v));

/** Bryt en text i rader som ryms på bredden (mm), vid mellanslagen. */
export function wrapText(text: string, width: number, height = TABLE_TEXT): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next, height) > width) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** Måtten för förteckningen per littera på papperet, mm: fältens kolumn, litterornas kolumner och ritningens rad. */
export function litteraLayout(t: ScheduleTable, info: LitteraInfo): { label: number; widths: number[]; figureRow: number } {
  const rows = t.groups[0]?.rows ?? [];
  const label = Math.max(MIN_COL, Math.ceil(Math.max(textWidth('Littera', TABLE_TEXT, true), ...info.fields.map((f) => textWidth(f, TABLE_TEXT))) + 2 * PAD));
  const n = info.figureScale;
  const widths = info.columns.map((c, i) => {
    let w = textWidth(t.columns[i + 1].title, TABLE_TEXT, true) + 2 * PAD;
    for (const r of rows) w = Math.max(w, textWidth(shown(r[i + 1]), TABLE_TEXT) + 2 * PAD);
    if (n && c.figure) w = Math.max(w, c.figure.w / n + 2 * FIG_PAD + DIM_SPACE);
    return Math.max(MIN_LITTERA_COL, Math.ceil(w));
  });
  const tallest = n ? Math.max(0, ...info.columns.map((c) => (c.figure ? c.figure.h / n : 0))) : 0;
  return { label, widths, figureRow: tallest ? Math.ceil(tallest + FIG_PAD + DIM_SPACE) : 0 };
}

/** Kolumnerna per band när tabellen är bredare än `maxWidth`: minst en kolumn i varje. */
function bandsOf(label: number, widths: number[], maxWidth: number): number[][] {
  const bands: number[][] = [];
  let cur: number[] = [];
  let w = label;
  widths.forEach((cw, i) => {
    if (cur.length && w + cw > maxWidth) {
      bands.push(cur);
      cur = [];
      w = label;
    }
    cur.push(i);
    w += cw;
  });
  if (cur.length || !bands.length) bands.push(cur);
  return bands;
}

/** Ritningen i en kolumn: linjerna i skalan, med karmyttermåtten under och till höger. */
function figurePrims(fig: OpeningFigure, n: number, x: number, y: number, P: (x: number, y: number) => [number, number], origin: Primitive['origin']): Primitive[] {
  const out: Primitive[] = [];
  const w = fig.w / n;
  const h = fig.h / n;
  for (const l of fig.lines) out.push({ kind: 'line', a: P(x + l.a[0] / n, y + l.a[1] / n), b: P(x + l.b[0] / n, y + l.b[1] / n), pen: FIGURE_PENS[l.role], origin });
  const pen: Pen = { weight: 0.13 };
  const tick = 0.6;
  // Bredden under ritningen.
  const dy = y - 2.5;
  out.push({ kind: 'line', a: P(x, dy), b: P(x + w, dy), pen, origin });
  for (const tx of [x, x + w]) out.push({ kind: 'line', a: P(tx - tick, dy - tick), b: P(tx + tick, dy + tick), pen, origin });
  out.push({ kind: 'text', at: P(x + w / 2, dy - 0.8 - DIM_TEXT), text: dimText(fig.w), height: DIM_TEXT, align: 'middle', pen, origin });
  // Höjden till höger, läst nedifrån.
  const dx = x + w + 2.5;
  out.push({ kind: 'line', a: P(dx, y), b: P(dx, y + h), pen, origin });
  for (const ty of [y, y + h]) out.push({ kind: 'line', a: P(dx - tick, ty - tick), b: P(dx + tick, ty + tick), pen, origin });
  out.push({ kind: 'text', at: P(dx + 0.8 + DIM_TEXT, y + h / 2), text: dimText(fig.h), height: DIM_TEXT, align: 'middle', angle: Math.PI / 2, pen, origin });
  return out;
}

/**
 * Förteckningen per littera som primitiver (0.12.5): litteran överst,
 * ritningen sedd utifrån med karmyttermåtten, och fälten som rader. En
 * tabell som är bredare än `maxWidth` bryts i band under varandra, med
 * fältens namn i varje; föreskrifterna står till höger om det första.
 */
function litteraPrims(t: ScheduleTable, info: LitteraInfo, opt: { id: Id; scale?: number; maxWidth?: number }): Primitive[] {
  const k = opt.scale ?? 1;
  const origin = { objectType: 'Schedule', objectId: opt.id, part: 'tabell' };
  const figOrigin = { objectType: 'Schedule', objectId: opt.id, part: 'ritning' };
  const { label, widths, figureRow } = litteraLayout(t, info);
  const rows = t.groups[0]?.rows ?? [];
  const notes = info.notes.flatMap((n) => wrapText(n, NOTE_WIDTH));
  const noteSpace = notes.length ? NOTE_WIDTH + GAP : 0;
  const bands = bandsOf(label, widths, Math.max(label + MIN_LITTERA_COL, (opt.maxWidth ?? Infinity) - noteSpace));
  const bandH = ROW_HEIGHT + figureRow + rows.length * ROW_HEIGHT;
  const out: Primitive[] = [];
  const P = (x: number, y: number): [number, number] => [x * k, y * k];
  const text = (x: number, top: number, s: string, align: 'start' | 'middle', bold: boolean) =>
    out.push({ kind: 'text', at: P(x, top - (ROW_HEIGHT + TABLE_TEXT * 0.72) / 2), text: s, height: TABLE_TEXT, align, bold, pen: { weight: bold ? 0.25 : 0.18 }, origin });
  const hline = (x0: number, x1: number, y: number, pen: Pen) => out.push({ kind: 'line', a: P(x0, y), b: P(x1, y), pen, origin });
  let widest = 0;
  bands.forEach((band, bi) => {
    const top = -bi * (bandH + GAP);
    const total = label + band.reduce((a, i) => a + widths[i], 0);
    widest = Math.max(widest, total);
    // Litterorna.
    text(PAD, top, 'Littera', 'start', true);
    let x = label;
    for (const i of band) {
      text(x + widths[i] / 2, top, t.columns[i + 1].title, 'middle', true);
      x += widths[i];
    }
    hline(0, total, top - ROW_HEIGHT, HEAD_LINE);
    // Ritningarna, stående på en gemensam linje.
    if (figureRow) {
      const base = top - ROW_HEIGHT - figureRow + DIM_SPACE;
      x = label;
      for (const i of band) {
        const fig = info.columns[i].figure;
        if (fig) out.push(...figurePrims(fig, info.figureScale, x + (widths[i] - DIM_SPACE - fig.w / info.figureScale) / 2, base, P, figOrigin));
        x += widths[i];
      }
      text(PAD, top - ROW_HEIGHT, `Sedd utifrån, 1:${info.figureScale}`, 'start', false);
      hline(0, total, top - ROW_HEIGHT - figureRow, GRID);
    }
    // Fälten.
    rows.forEach((r, ri) => {
      const y = top - ROW_HEIGHT - figureRow - ri * ROW_HEIGHT;
      text(PAD, y, r[0].text, 'start', false);
      x = label;
      for (const i of band) {
        text(x + PAD, y, shown(r[i + 1]), 'start', false);
        x += widths[i];
      }
      if (ri < rows.length - 1) hline(0, total, y - ROW_HEIGHT, GRID);
    });
    x = label;
    out.push({ kind: 'line', a: P(x, top), b: P(x, top - bandH), pen: HEAD_LINE, origin });
    for (const i of band.slice(0, -1)) {
      x += widths[i];
      out.push({ kind: 'line', a: P(x, top), b: P(x, top - bandH), pen: GRID, origin });
    }
    out.push({ kind: 'polyline', points: [P(0, top), P(total, top), P(total, top - bandH), P(0, top - bandH)], closed: true, pen: FRAME, origin });
  });
  if (!info.columns.length) text(label + PAD, -ROW_HEIGHT, 'Inga objekt', 'start', false);
  // Föreskrifterna till höger om det första bandet.
  if (notes.length) {
    const nx = widest + GAP;
    text(nx, 0, 'Föreskrifter', 'start', true);
    notes.forEach((n, i) => out.push({ kind: 'text', at: P(nx, -ROW_HEIGHT - (i + 1) * NOTE_STEP + 1), text: n, height: TABLE_TEXT, pen: { weight: 0.18 }, origin }));
  }
  return out;
}
