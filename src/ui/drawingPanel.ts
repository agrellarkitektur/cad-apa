import { setLocked, updateParams } from '../core/commands';
import { modelViewId, type Element, type Id, type ProjectDoc } from '../core/model';
import type { DocStore } from '../core/store';
import { resolveParams } from '../elements/registry';
import { SLOPE_STYLES, type RoofSlopeParams } from '../elements/roofSlope';
import { icons } from './icons';
import { escapeHtml } from './labels';
import { shapeChange, shapeFields } from './shapeFields';
import { showChange, showClick } from './showFields';
import { underlayChange, underlayFields } from './underlayFields';

/**
 * Egenskaperna för det som ritas på ritningen (0.8): 2D-element,
 * taklutningar, Visas i och Lås. Delar av egenskapspanelen, i en egen fil.
 * Sedan 0.8.27 ligger 2D-formens fält i shapeFields.ts, underlagets i
 * underlayFields.ts och Visas i i showFields.ts; här finns taklutningen,
 * Lås och det som fördelar fälten och knapparna till dem.
 */

/** Typer som kan låsas. */
export const LOCKABLE = new Set(['Shape2D', 'Text', 'Dimension', 'RoofSlope', 'Section', 'Elevation', 'North', 'Underlay']);

const comma = (n: number) => n.toLocaleString('sv-SE');

/** Fälten för en 2D-form eller en taklutning. */
export function drawingFields(doc: ProjectDoc, el: Element): string {
  if (el.type === 'Shape2D') return shapeFields(doc, el);
  if (el.type === 'Underlay') return underlayFields(doc, el);
  if (el.type === 'RoofSlope') {
    const p = resolveParams<RoofSlopeParams>(doc, el);
    const roof = doc.elements[p.roof];
    const slope = roof ? Number(roof.params.slope ?? 0) : 0;
    return `<div class="fields">
        <label class="field"><span>Stil</span><select data-key="slope:style">${Object.entries(SLOPE_STYLES).map(([k, l]) => `<option value="${k}"${k === p.style ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field"><span>Linjens längd</span><span class="input-unit"><input type="text" data-expr inputmode="decimal" autocomplete="off" data-key="slope:len" value="${p.len}"><i>mm</i></span></label>
      </div>
      <p class="note">Visar takets lutning, ${comma(slope)}°, och följer med när lutningen ändras. Flytta den dit den ska stå; lutningen ändras på taket.</p>
      <div class="row"><button class="btn" data-action="select-roof" data-roof="${escapeHtml(p.roof)}">Markera taket</button></div>`;
  }
  return '';
}

/** Lås, med hänglås. Delvis ifyllt när markeringen är blandad. */
export function lockField(els: Element[]): string {
  if (!els.every((e) => LOCKABLE.has(e.type))) return '';
  const n = els.filter((e) => e.locked).length;
  const mixed = n > 0 && n < els.length;
  return `<label class="check lock-check" title="Ett låst objekt kan inte flyttas eller tas bort av misstag">
    <input type="checkbox" data-key="lock:"${n === els.length ? ' checked' : ''}${mixed ? ' data-mixed="1"' : ''}>
    <span class="lock-icon">${n ? icons.lock : icons.unlock}</span> Lås</label>`;
}

/** Ändringar i fälten ovan. Svarar true om ändringen hanterades. */
export function drawingChange(store: DocStore, ids: Id[], key: string, input: HTMLInputElement | HTMLSelectElement, here: Id): boolean {
  const [scope, name] = key.split(':');
  if (scope === 'lock') {
    setLocked(store, ids, (input as HTMLInputElement).checked);
    return true;
  }
  if (scope === 'd2') return shapeChange(store, ids, name, input);
  if (scope === 'ul') return underlayChange(store, ids, name, input);
  if (scope === 'slope') {
    if (name === 'style') updateParams(store, ids, { style: input.value }, 'Ändra stil');
    else if (name === 'len' && Number(input.value) >= 100) updateParams(store, ids, { len: Math.round(Number(input.value)) }, 'Ändra längd');
    return true;
  }
  if (scope === 'show') return showChange(store, ids, name, input, here);
  return false;
}

/** Klick på knappar i Visas i. Svarar true om klicket hanterades. */
export function drawingClick(store: DocStore, ids: Id[], b: HTMLElement, root: HTMLElement): boolean {
  return showClick(store, ids, b, root);
}

/** Id för vyn som visas, för "Bara den här vyn". */
export function hereOf(view: { viewId?: Id }, storey: Id): Id {
  return view.viewId ?? modelViewId(storey);
}
