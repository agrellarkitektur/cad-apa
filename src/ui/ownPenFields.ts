import type { Element, Id, OwnPen, ProjectDoc } from '../core/model';
import type { DocStore } from '../core/store';
import { PEN_WEIGHTS } from '../elements/drawing2d';
import { lineTypeOptions } from './lineTypePick';

/**
 * Egen penna för ett objekt (0.8.31): tjocklek, färg och linjetyp var för
 * sig, *Stilmallens* från början. För de udda fall där stilmallens
 * ritning blir missvisande, t.ex. en vägg som ska vara streckad.
 */

/** Sorterna som kan få en egen penna. 2D-formen har redan sin egen. */
export const OWN_PEN_TYPES = new Set(['Wall', 'Door', 'Window', 'Roof', 'Furniture']);

const comma = (n: number) => n.toLocaleString('sv-SE');

/** Värdet om det är lika för alla, null om det skiljer sig. */
function same<K extends keyof OwnPen>(els: readonly Element[], k: K): OwnPen[K] | null {
  const v = els[0].pen?.[k];
  return els.every((e) => e.pen?.[k] === v) ? v : null;
}

/** Avsnittet i egenskaperna, eller tomt om något markerat inte kan få en penna. */
export function ownPenSection(doc: ProjectDoc, els: readonly Element[]): string {
  if (!els.length || !els.every((e) => OWN_PEN_TYPES.has(e.type) && !e.space)) return '';
  const mixed = '<option selected disabled>Olika</option>';
  const weight = same(els, 'weight');
  const weights = `<select data-key="pen:weight" aria-label="Tjocklek">${weight === null ? mixed : ''}<option value="style"${weight === undefined ? ' selected' : ''}>Stilmallens</option>${PEN_WEIGHTS.filter((w) => w > 0)
    .map((w) => `<option value="${w}"${w === weight ? ' selected' : ''}>${comma(w)} mm</option>`)
    .join('')}</select>`;
  const color = same(els, 'color');
  const colors = `<select data-key="pen:colorOn" aria-label="Färg">${color === null ? mixed : ''}<option value="style"${color === undefined ? ' selected' : ''}>Stilmallens</option><option value="own"${color ? ' selected' : ''}>Egen</option></select>`;
  const own = color ? `<label class="field"><span>Egen färg</span><input type="color" data-key="pen:color" value="${color}"></label>` : '';
  const linetype = same(els, 'linetype');
  const types = `<select data-key="pen:linetype" aria-label="Linjetyp">${lineTypeOptions(doc.graphics, linetype, { value: 'style', label: 'Stilmallens' })}</select>`;
  const any = els.some((e) => e.pen);
  return `<section class="own-pen">
    <h3>Penna</h3>
    <div class="fields">
      <label class="field"><span>Tjocklek</span>${weights}</label>
      <label class="field"><span>Färg</span>${colors}</label>
      ${own}
      <label class="field"><span>Linjetyp</span>${types}</label>
    </div>
    <p class="note">Stilmallens penna gäller från början. En egen gäller objektets linjer och konturer i planen, fasaderna och sektionerna, men inte fyllningar och text.</p>
    ${any ? '<div class="row"><button class="btn" data-action="own-pen-reset">Stilmallens penna</button></div>' : ''}
  </section>`;
}

/** Sätt eller ta bort ett fält i pennan för de markerade, i en transaktion. */
function setPen(store: DocStore, ids: readonly Id[], change: Partial<Record<keyof OwnPen, unknown>>, label: string): void {
  store.transact(label, (tx) => {
    for (const id of ids) {
      const el = store.doc.elements[id];
      if (!el || !OWN_PEN_TYPES.has(el.type)) continue;
      const pen: OwnPen = { ...el.pen };
      for (const [k, v] of Object.entries(change) as [keyof OwnPen, unknown][]) {
        if (v === undefined) delete pen[k];
        else (pen as Record<string, unknown>)[k] = v;
      }
      const next = { ...el };
      if (Object.keys(pen).length) next.pen = pen;
      else delete next.pen;
      tx.putElement(next);
    }
  });
}

/** Ändringar i fälten (`pen:…`). Svarar true om ändringen hanterades. */
export function ownPenChange(store: DocStore, ids: readonly Id[], name: string, input: HTMLInputElement | HTMLSelectElement): boolean {
  const v = input.value;
  if (name === 'weight') setPen(store, ids, { weight: v === 'style' ? undefined : Number(v) }, v === 'style' ? 'Stilmallens tjocklek' : 'Egen tjocklek');
  else if (name === 'colorOn') setPen(store, ids, { color: v === 'style' ? undefined : (ids.map((id) => store.doc.elements[id]?.pen?.color).find(Boolean) ?? '#c2372c') }, v === 'style' ? 'Stilmallens färg' : 'Egen färg');
  else if (name === 'color') setPen(store, ids, { color: v }, 'Ändra färg');
  else if (name === 'linetype') setPen(store, ids, { linetype: v === 'style' ? undefined : v }, v === 'style' ? 'Stilmallens linjetyp' : 'Egen linjetyp');
  else return false;
  return true;
}

/** Knappen Stilmallens penna: allt tillbaka. */
export function resetOwnPen(store: DocStore, ids: readonly Id[]): void {
  setPen(store, ids, { weight: undefined, color: undefined, linetype: undefined }, 'Stilmallens penna');
}
