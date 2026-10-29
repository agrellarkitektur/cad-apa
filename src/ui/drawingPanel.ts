import { ownPenChange, typePenChange } from './ownPenFields';
import { setLocked, updateParams } from '../core/commands';
import { modelViewId, type Element, type Id, type ProjectDoc } from '../core/model';
import type { DocStore } from '../core/store';
import { resolveParams } from '../elements/registry';
import { SLOPE_STYLES, type RoofSlopeParams } from '../elements/roofSlope';
import { icons } from './icons';
import { escapeHtml } from './labels';
import { fillChange, shapeChange, shapeFields } from './shapeFields';
import { askText } from './ask';
import { deleteMaterial, saveMaterial, updateMaterial } from '../core/materials';
import { showChange, showClick } from './showFields';
import { underlayChange, underlayFields } from './underlayFields';

/**
 * Egenskaperna för det som ritas på ritningen (0.8): 2D-element,
 * taklutningar, Visas i och Lås. Delar av egenskapspanelen, i en egen fil.
 * Sedan 0.8.27 ligger 2D-formens fält i shapeFields.ts, underlagets i
 * underlayFields.ts och Visas i i showFields.ts; här finns taklutningen,
 * Lås och det som fördelar fälten och knapparna till dem.
 */

/** Typer som kan låsas. Markobjekten sedan 0.10.7. */
/** Allt går att låsa (0.10.12), utom marken och kartan som hör till platsen. */
const UNLOCKABLE: ReadonlySet<string> = new Set(['Terrain', 'SiteMap']);

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
  if (!els.length || els.some((e) => UNLOCKABLE.has(e.type))) return '';
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
  // Markobjektets slänter (0.10.14): en egen fyllning i `slopeFill`.
  if (scope === 'sf') return fillChange(store, ids, name, input, 'slopeFill');
  if (scope === 'ul') return underlayChange(store, ids, name, input);
  if (scope === 'slope') {
    if (name === 'style') updateParams(store, ids, { style: input.value }, 'Ändra stil');
    else if (name === 'len' && Number(input.value) >= 100) updateParams(store, ids, { len: Math.round(Number(input.value)) }, 'Ändra längd');
    return true;
  }
  if (scope === 'show') return showChange(store, ids, name, input, here);
  if (scope === 'pen') return ownPenChange(store, ids, name, input);
  if (scope === 'defpen') return typePenChange(store, ids, name, input);
  return false;
}

/** Klick på knappar i Visas i. Svarar true om klicket hanterades. */
export function drawingClick(store: DocStore, ids: Id[], b: HTMLElement, root: HTMLElement): boolean {
  // Materialen (0.10.28, sparade fyllningar 0.10.14).
  if (b.dataset.action === 'fill-save') {
    const nested = b.dataset.scope === 'sf' ? 'slopeFill' : undefined;
    void askText('Spara fyllningen som material med namnet', b.dataset.name ?? '').then((name) => {
      if (name?.trim()) saveMaterial(store, ids, name, nested);
    });
    return true;
  }
  if (b.dataset.action === 'material-rename' && b.dataset.id) {
    const id = b.dataset.id;
    void askText('Materialets nya namn', b.dataset.name ?? '').then((name) => {
      const n = name?.trim();
      if (n && n !== b.dataset.name) updateMaterial(store, id, `Byt namn på material: ${n}`, (m) => ({ ...m, name: n }));
    });
    return true;
  }
  if (b.dataset.action === 'fill-unsave' && b.dataset.id) {
    deleteMaterial(store, b.dataset.id);
    return true;
  }
  return showClick(store, ids, b, root);
}

/** Id för vyn som visas, för "Bara den här vyn". */
export function hereOf(view: { viewId?: Id }, storey: Id): Id {
  return view.viewId ?? modelViewId(storey);
}
