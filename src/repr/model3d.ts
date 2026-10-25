import type { Id, ProjectDoc } from '../core/model';
import type { ViewStates } from '../core/states';
import type { Shape3D } from './solids';
import { modelShapes } from './storeyShapes';

/**
 * Bygger 3D-modellen i ett tillstånd: alla våningar (0.9), eller bara en med
 * `only`. Det som rivs syns inte i 3D; det som är nytt kan färgas om vyn
 * jämför med ett annat tillstånd.
 */
export function buildModel3d(doc: ProjectDoc, view: ViewStates, only?: Id): Shape3D[] {
  return modelShapes(doc, view, doc.graphics, (t, action) => !!(t.model3d || t.model3dBatch) && action !== 'demolished', only).shapes.map((x) => x.s);
}
