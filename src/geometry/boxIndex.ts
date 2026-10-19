import type { Box } from './boolean';
import type { Vec2 } from '../repr/primitives';

/** Rektanglar som täcker fler rutor än så här prövas alltid i stället. */
const MAX_CELLS = 4096;

/**
 * Ett rutnät över rektanglar (0.8.1): ger de rektanglar som kan innehålla en
 * punkt eller röra en annan rektangel, så att man slipper pröva varje objekt
 * mot alla andra. Svaren kommer i den ordning rektanglarna lades in, så den
 * som använder rutnätet får samma resultat som om alla prövats i tur och
 * ordning (det spelar roll när den första träffen vinner).
 *
 * Rutnätet sållar bara bort det som säkert ligger för långt bort; det exakta
 * provet görs av den som frågar.
 */
export class BoxIndex {
  private readonly cells = new Map<number, Map<number, number[]>>();
  /** De som prövas varje gång: utan rektangel, eller för stora för rutnätet. */
  private readonly always: number[] = [];
  /** Alla som lagts in, för frågor som täcker för många rutor. */
  private readonly all: number[] = [];

  /** Rutornas sida, i samma enhet som rektanglarna (mm). */
  private readonly cell: number;

  constructor(cell: number) {
    this.cell = cell;
  }

  /** Lägg till nummer `i` med sin rektangel; null betyder att den alltid prövas. */
  add(i: number, box: Box | null): void {
    this.all.push(i);
    if (!box || !box.every(Number.isFinite)) {
      this.always.push(i);
      return;
    }
    const [x0, y0, x1, y1] = this.range(box);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_CELLS) {
      this.always.push(i);
      return;
    }
    for (let x = x0; x <= x1; x++) {
      let col = this.cells.get(x);
      if (!col) this.cells.set(x, (col = new Map()));
      for (let y = y0; y <= y1; y++) {
        const list = col.get(y);
        if (list) list.push(i);
        else col.set(y, [i]);
      }
    }
  }

  /** Numren vars rektangel kan innehålla punkten, i stigande ordning. */
  at(p: Vec2): number[] {
    return this.near([p[0], p[1], p[0], p[1]]);
  }

  /** Numren vars rektangel kan röra rektangeln, i stigande ordning. */
  near(box: Box): number[] {
    const [x0, y0, x1, y1] = this.range(box);
    if (!box.every(Number.isFinite) || (x1 - x0 + 1) * (y1 - y0 + 1) > MAX_CELLS) return [...this.all].sort((a, b) => a - b);
    const found = new Set<number>(this.always);
    for (let x = x0; x <= x1; x++) {
      const col = this.cells.get(x);
      if (!col) continue;
      for (let y = y0; y <= y1; y++) for (const i of col.get(y) ?? []) found.add(i);
    }
    return [...found].sort((a, b) => a - b);
  }

  private range(b: Box): [number, number, number, number] {
    const c = this.cell;
    return [Math.floor(b[0] / c), Math.floor(b[1] / c), Math.floor(b[2] / c), Math.floor(b[3] / c)];
  }
}
