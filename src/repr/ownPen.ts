import type { StyleSheet } from '../core/graphics';
import { lineTypeDash } from '../core/lineTypes';
import type { OwnPen, ProjectDoc } from '../core/model';
import type { Pen, Primitive } from './primitives';

/**
 * Objektets egen penna (0.8.31) ovanpå pennan stilmallen gav: det som är
 * satt ersätter, det som saknas är kvar. En linjetyp ersätter också
 * stilmallens streckning (heldragen tar bort den, t.ex. på en riven vägg).
 */
export function withOwnPen(pen: Pen, own: OwnPen, style: StyleSheet | undefined): Pen {
  const out: Pen = { ...pen };
  if (own.weight !== undefined && own.weight > 0) out.weight = own.weight;
  if (own.color) out.color = own.color as Pen['color'];
  if (own.linetype !== undefined) {
    const dash = lineTypeDash(style, own.linetype);
    if (dash) out.dash = dash;
    else delete out.dash;
  }
  return out;
}

/** Den egna pennan för primitivens objekt, om det har en. */
export function ownPenOf(doc: ProjectDoc, p: Primitive): OwnPen | undefined {
  const id = p.origin?.objectId;
  const el = id ? doc.elements[id] : undefined;
  return el && el.type !== 'Shape2D' ? el.pen : undefined;
}

/**
 * Primitiven med objektets egna penna: linjer, bågar och konturer. Ytor
 * behåller sin fyllning och texter sin penna. En yta utan kontur får en
 * bara om pennan har en tjocklek och ytan inte är gjord utan kontur
 * (`noOutline`).
 */
export function applyOwnPen(p: Primitive, own: OwnPen | undefined, style: StyleSheet | undefined): Primitive {
  if (!own) return p;
  switch (p.kind) {
    case 'line':
    case 'polyline':
    case 'arc':
      // Tjockleken 0 är en linje som inte ritas (bara för att klicka på) och får ingen penna,
      // utom en kontur som stilmallen inte ritar (`asOutline`) när pennan har en tjocklek.
      return p.pen.weight > 0 || (p.kind === 'polyline' && p.asOutline && own.weight) ? ({ ...p, pen: withOwnPen(p.pen, own, style) } as Primitive) : p;
    case 'region':
      if (p.outline) return { ...p, outline: withOwnPen(p.outline, own, style) };
      return !p.noOutline && own.weight ? { ...p, outline: withOwnPen({ weight: own.weight }, own, style) } : p;
    default:
      return p;
  }
}
