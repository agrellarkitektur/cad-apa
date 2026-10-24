import type { Element, Id, Worksheet } from './model';

/**
 * Exempelmallbladet (0.8.8) som nya projekt och exemplet börjar med: A3
 * liggande med ritningsram (20 mm till vänster för inbindning, 10 mm i
 * övrigt) och ett huvud i BH90-stil, 180 mm brett så att ett vikt blad blir
 * A4. Allt är vanliga linjer och texter som går att ändra, kopiera eller ta
 * bort; texterna i huvudet är smarttext som fylls i från bladet.
 */

export const EXAMPLE_MASTER_ID = 'mall-a3';

/** En ruta i huvudet: läge och storlek i mm från huvudets nedre vänstra hörn, rubrik och värde. */
interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  value: string;
  size?: number;
  bold?: boolean;
  /** En rad till under värdet, mindre. */
  more?: string;
}

const ROWS = [12, 9, 14, 9, 15, 16];

/** Rutorna nedifrån och upp: uppdrag och ritningsnummer, skala och signaturer, innehåll, skede, projektet, arkitekten. */
function cells(): Cell[] {
  const y: number[] = [];
  ROWS.reduce((acc, h, i) => ((y[i] = acc), acc + h), 0);
  return [
    { x: 0, y: y[0], w: 40, h: ROWS[0], label: 'Uppdragsnummer', value: '{uppdragsnummer}' },
    { x: 40, y: y[0], w: 105, h: ROWS[0], label: 'Ritningsnummer', value: '{ritningsnummer}', size: 5, bold: true },
    { x: 145, y: y[0], w: 35, h: ROWS[0], label: 'Ändring', value: '{ändring}', size: 3.5 },
    { x: 0, y: y[1], w: 45, h: ROWS[1], label: 'Skala', value: '{skala}' },
    { x: 45, y: y[1], w: 45, h: ROWS[1], label: 'Datum', value: '{datum}' },
    { x: 90, y: y[1], w: 45, h: ROWS[1], label: 'Ritat av', value: '{ritat}' },
    { x: 135, y: y[1], w: 45, h: ROWS[1], label: 'Granskat av', value: '{granskat}' },
    { x: 0, y: y[2], w: 180, h: ROWS[2], label: 'Ritningens innehåll', value: '{innehåll}', size: 5, bold: true },
    { x: 0, y: y[3], w: 180, h: ROWS[3], label: 'Skede', value: '{skede}', size: 3.5, bold: true },
    { x: 0, y: y[4], w: 120, h: ROWS[4], label: 'Projekt', value: '{projekt}', size: 3.5, bold: true, more: '{adress}  {fastighet}' },
    { x: 120, y: y[4], w: 60, h: ROWS[4], label: 'Beställare', value: '{beställare}' },
    { x: 0, y: y[5], w: 120, h: ROWS[5], label: 'Arkitekt', value: '{arkitekt}', size: 3.5, bold: true },
    { x: 120, y: y[5], w: 60, h: ROWS[5], label: 'Ansvarig', value: '{ansvarig}' },
  ];
}

/** Exempelmallbladet och det som är ritat på det. `states` är projektets tillstånd. */
export function exampleMaster(storey: Id, states: Id[]): { worksheet: Worksheet; elements: Record<Id, Element> } {
  const space = EXAMPLE_MASTER_ID;
  const out: Element[] = [];
  const add = (type: string, params: Record<string, unknown>) => out.push({ id: `${space}-${out.length + 1}`, type, storey, states: [...states], tags: [], space, params, props: {} });
  const rect = (x: number, y: number, w: number, h: number, weight: number) =>
    add('Shape2D', {
      shape: 'polyline',
      closed: true,
      points: [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ],
      weight,
      linetype: 'solid',
    });
  const text = (x: number, y: number, t: string, height: number, bold?: boolean) => add('Text', { pos: [x, y], text: t, height, angle: 0, ...(bold ? { bold: true } : {}) });

  // Ritningsramen på ett A3 liggande, 420 × 297 mm.
  rect(20, 10, 390, 277, 0.5);
  // Huvudet i ramens nedre högra hörn.
  const x0 = 410 - 180;
  const y0 = 10;
  for (const c of cells()) {
    const x = x0 + c.x;
    const y = y0 + c.y;
    rect(x, y, c.w, c.h, 0.18);
    text(x + 1.5, y + c.h - 2.6, c.label.toUpperCase(), 1.8);
    const base = y + 2.4 + (c.more ? 3.4 : 0);
    text(x + 1.5, base, c.value, c.size ?? 2.5, c.bold);
    if (c.more) text(x + 1.5, base - 3.4, c.more, 2.5);
  }
  rect(x0, y0, 180, ROWS.reduce((a, b) => a + b, 0), 0.35);
  return {
    worksheet: { id: space, name: 'A3 med ritningshuvud', paper: { size: 'A3', orientation: 'landscape' } },
    elements: Object.fromEntries(out.map((e) => [e.id, e])),
  };
}
