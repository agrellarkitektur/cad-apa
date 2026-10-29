import type { Material, StyleSheet } from '../core/graphics';
import type { Pen } from '../repr/primitives';
import { materialOf, type FillParams } from './fill2d';

/**
 * Materialet på bjälklag och tak (0.10.28.2). Objektet har fyllningens fält
 * och `material` direkt i parametrarna, som rummen och markytorna: planens
 * fyllning (en kopia av materialets), kulören i 3D, snittet i sektion,
 * ytan i fasad och konturens penna i planen.
 */

/** Materialet som objektet är kopplat till, om det finns i stilmallen. */
export function buildingMaterialOf(p: Partial<FillParams>, style: StyleSheet | undefined): Material | undefined {
  return materialOf(p, style);
}

/** Konturens penna i planen: materialets, annars `pen` (stilmallens för typen). */
export function materialPen(m: Material | undefined, pen: Pen): Pen {
  return m?.pen ? ({ weight: m.pen.weight, ...(m.pen.color ? { color: m.pen.color } : {}) } as Pen) : pen;
}

/** Formens fält i 3D för materialet: kulören och materialets nyckel (för snittet och ytan i sektioner och fasader). */
export function materialSolid(m: Material | undefined): { color?: string; matId?: string; texture?: { asset: string; size: number } } {
  return m ? { ...(m.color3d ? { color: m.color3d } : {}), matId: m.id, ...(m.texture ? { texture: m.texture } : {}) } : {};
}
