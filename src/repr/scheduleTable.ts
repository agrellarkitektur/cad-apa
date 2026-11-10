import type { Id } from '../core/model';
import { textWidth } from '../formats/drawingFont';
import type { Cell, ScheduleTable } from './schedules';
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
export function schedulePrims(t: ScheduleTable, opt: { id: Id; scale?: number; maxHeight?: number }): Primitive[] {
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
