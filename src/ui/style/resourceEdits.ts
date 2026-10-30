import type { DocStore } from '../../core/store';
import type { ProjectDoc } from '../../core/model';
import type { StyleBook } from '../../core/graphics';
import { FILL_TYPES } from '../../core/fillTypes';
import { formatPat } from '../../core/patFile';
import { addMaterial, deleteMaterial, materialObjectsByMaterial, moveMaterial, setMaterialTexture, updateMaterial } from '../../core/materials';
import { saveBlobFile } from '../../storage/projectFile';
import { resolveParams } from '../../elements/registry';
import { chooseTexture } from '../app/imageFile';
import { addLineType, applyLineTypeField, removeLineType } from './lineTypes';
import { addFamily, addFillType, applyFillTypeField, importPat, removeFamily, removeFillType } from './fillTypes';
import { applyLabelField } from './labels';
import { materialFieldChange } from './materials';

/** Det `styleDialog.ts` låter resursernas klick och fält nå. */
export interface ResourceHost {
  store: DocStore;
  readonly book: StyleBook;
  el: HTMLElement;
  set(book: StyleBook, label: string): void;
  onError(msg: string): void;
  render(): void;
}

/**
 * Knapparna under Resurser: materialen (0.10.28.1, texturen 0.10.31),
 * linjetyperna (0.8.30) och fyllningstyperna (0.8.36, med .pat ut och
 * in). Sant om knappen hörde hit.
 */
export function resourceClick(h: ResourceHost, action: string, target: HTMLElement): boolean {
  if (action.startsWith('material-')) {
    const id = target.closest<HTMLElement>('[data-material-id]')?.dataset.materialId ?? '';
    if (action === 'material-add') {
      const nid = addMaterial(h.store);
      h.el.querySelector<HTMLInputElement>(`[data-material="${CSS.escape(nid)}:name"]`)?.select();
    } else if (action === 'material-up' || action === 'material-down') moveMaterial(h.store, id, action === 'material-up' ? -1 : 1);
    else if (action === 'material-remove') deleteMaterial(h.store, id);
    else if (action === 'material-texture') void chooseTexture(h.store, id);
    else if (action === 'material-texture-remove') setMaterialTexture(h.store, id, null);
    return true;
  }
  if (action === 'linetype-add' || action === 'linetype-remove') {
    const book = structuredClone(h.book);
    const id = target.closest<HTMLElement>('[data-linetype-id]')?.dataset.linetypeId;
    if (action === 'linetype-add') addLineType(book);
    else if (!id || !removeLineType(book, id)) return true;
    h.set(book, action === 'linetype-add' ? 'Ny linjetyp' : 'Ta bort linjetyp');
    return true;
  }
  if (action === 'filltype-import') {
    pickFile('.pat,text/plain', async (file) => {
      const book = structuredClone(h.book);
      const { added, replaced } = importPat(book, await file.text());
      if (!added && !replaced) {
        h.onError('Filen har inga fyllningstyper som går att läsa.');
        return;
      }
      h.set(book, added + replaced === 1 ? 'Läs in fyllningstyp' : 'Läs in fyllningstyper');
    });
    return true;
  }
  if (action === 'filltype-export') {
    const types = h.book.fillTypes ?? [];
    if (types.length) void saveBlobFile(new Blob([formatPat(types)], { type: 'text/plain' }), 'fyllningar.pat', 'Fyllningstyper', { 'text/plain': ['.pat'] });
    return true;
  }
  if (action.startsWith('filltype-')) {
    const at = target.closest<HTMLElement>('[data-filltype-id]');
    const id = at?.dataset.filltypeId ?? '';
    const book = structuredClone(h.book);
    const label =
      action === 'filltype-add'
        ? (addFillType(book), 'Ny fyllningstyp')
        : action === 'filltype-copy' && FILL_TYPES[id]
          ? (addFillType(book, { ...FILL_TYPES[id], name: `${FILL_TYPES[id].name} (kopia)` }), 'Kopiera fyllningstyp')
          : action === 'filltype-remove' && removeFillType(book, id)
            ? 'Ta bort fyllningstyp'
            : action === 'filltype-family-add' && addFamily(book, id)
              ? 'Ny linjefamilj'
              : action === 'filltype-family-remove' && removeFamily(book, id, Number(at?.dataset.family))
                ? 'Ta bort linjefamilj'
                : null;
    if (label) h.set(book, label);
    return true;
  }
  return false;
}

/**
 * Fälten under Resurser: ett material (ändras med objekten som har det),
 * linjetyperna, fyllningstyperna och texterna. Sant om fältet hörde hit.
 */
export function resourceChange(h: ResourceHost, input: HTMLInputElement | HTMLSelectElement): boolean {
  const mat = materialFieldChange(h.book, input);
  if (mat) {
    updateMaterial(h.store, mat.id, mat.label, mat.fn);
    return true;
  }
  if (input.dataset.material) return true;
  const book = structuredClone(h.book);
  const label = applyLineTypeField(book, input) ?? applyFillTypeField(book, input) ?? applyLabelField(book, input);
  // Ett mönster som inte gick att läsa: visa det gamla igen.
  if (label === '') h.render();
  if (label) h.set(book, label);
  return label !== null;
}

/** Låt användaren välja en fil och gör något med den. */
export function pickFile(accept: string, use: (file: File) => Promise<void> | void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) void use(file);
  });
  input.click();
}

/** Hur många former och pennor som har varje linjetyp (0.8.30). */
export function lineTypeUses(doc: ProjectDoc): Map<string, number> {
  const uses = new Map<string, number>();
  const add = (k: unknown) => typeof k === 'string' && uses.set(k, (uses.get(k) ?? 0) + 1);
  for (const el of Object.values(doc.elements)) if (el.type === 'Shape2D') add(resolveParams<{ linetype?: string }>(doc, el).linetype);
  for (const c of doc.graphics.categories) for (const pen of Object.values(c.style.pens ?? {})) add(pen.linetype);
  return uses;
}

/** Hur många objekt och slänter som har varje material (0.10.28.1). */
export function materialUsesMap(doc: ProjectDoc): Map<string, number> {
  const by = materialObjectsByMaterial(doc);
  return new Map((doc.graphics.materials ?? []).map((m) => [m.id, by.get(m.id)?.length ?? 0]));
}

/** Hur många former, rum och snittfyllningar som har varje fyllningstyp (0.8.36). */
export function fillTypeUses(doc: ProjectDoc): Map<string, number> {
  const uses = new Map<string, number>();
  const add = (k: unknown) => typeof k === 'string' && uses.set(k, (uses.get(k) ?? 0) + 1);
  for (const el of Object.values(doc.elements)) {
    if (el.type !== 'Shape2D' && el.type !== 'Space') continue;
    const p = resolveParams<{ fill?: string; fillType?: string }>(doc, el);
    if (p.fill === 'type') add(p.fillType);
  }
  for (const c of doc.graphics.categories) for (const a of Object.values(c.style.actions)) if (a.cutFill.kind === 'type') add(a.cutFill.type);
  return uses;
}
