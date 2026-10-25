import type { StyleSheet } from '../core/graphics';
import { lineTypeDash } from '../core/lineTypes';
import type { Element, OwnPen, OwnPenPart, ProjectDoc } from '../core/model';
import { SYMBOL_PARTS } from './openingPens';
import type { Pen, Primitive } from './primitives';

/**
 * Objektets egen penna (0.8.31) ovanpå pennan stilmallen gav: det som är
 * satt ersätter, det som saknas är kvar. En linjetyp ersätter också
 * stilmallens streckning (heldragen tar bort den, t.ex. på en riven vägg).
 */
export function withOwnPen(pen: Pen, own: OwnPenPart, style: StyleSheet | undefined): Pen {
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

/** Två pennor fält för fält: det som är satt i `top` går före `base`. */
export function mergePens(base: OwnPen | undefined, top: OwnPen | undefined): OwnPen | undefined {
  if (!base) return top;
  if (!top) return base;
  const out: OwnPen = { ...base, ...top };
  if (base.symbol || top.symbol) out.symbol = { ...base.symbol, ...top.symbol };
  return out;
}

const merged = new WeakMap<Element, { def: unknown; pen: OwnPen | undefined }>();

/** Pennan som gäller för objektet (0.8.33): dess egen före typens, eller ingen. */
export function effectivePen(doc: ProjectDoc, el: Element): OwnPen | undefined {
  const def = el.definition ? doc.definitions[el.definition]?.pen : undefined;
  if (!def) return el.pen;
  const saved = merged.get(el);
  if (saved && saved.def === def) return saved.pen;
  const pen = mergePens(def, el.pen);
  merged.set(el, { def, pen });
  return pen;
}

/** Den egna pennan för primitivens objekt (eller dess typ), om det har en. */
export function ownPenOf(doc: ProjectDoc, p: Primitive): OwnPen | undefined {
  const id = p.origin?.objectId;
  const el = id ? doc.elements[id] : undefined;
  return el && el.type !== 'Shape2D' ? effectivePen(doc, el) : undefined;
}

/**
 * Primitiven med objektets egna penna: linjer, bågar och konturer. Ytor
 * behåller sin fyllning och texter sin penna. En yta utan kontur får en
 * bara om pennan har en tjocklek och ytan inte är gjord utan kontur
 * (`noOutline`).
 */
export function applyOwnPen(p: Primitive, pen: OwnPen | undefined, style: StyleSheet | undefined): Primitive {
  // Slagbågen och öppningssättet har pennans symboldel (0.8.33), resten den övre.
  const own = pen && p.origin?.part && SYMBOL_PARTS.has(p.origin.part) ? pen.symbol : pen;
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
