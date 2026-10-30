import type { StyleSheet } from '../../core/graphics';
import type { ViewType } from '../../core/viewCategories';
import { penDefault, penGroupsFor, type PenGroup } from '../../repr/penRows';
import { escapeHtml } from '../labels';
import { lineTypeOptions } from '../lineTypePick';
import { weightPicker } from '../weightPick';
import { fromHex, toHex } from './colors';
import { icons } from '../icons';

/** Kolumnernas namn i rubriken, i knapparnas ordning. */
const COLS = '<span class="sb-cols">tjocklek · linjetyp · färg</span>';

/**
 * Pennor i en vykategori: grupperna som hör till vytypen (0.10.36, förut
 * alla överallt), en rad per ställe med tjocklek, linjetyp och färg.
 * Pennlistan med alla ställen ligger under Resurser › Pennor.
 */
export function penSection(style: StyleSheet, type: ViewType, list?: PenListInfo): string {
  const rows = (g: PenGroup) =>
    g.rows
      .map(({ key, label, hint }) => {
        const own = style.pens?.[key];
        const d = penDefault(key);
        const weight = own?.weight ?? d.weight;
        const linetype = own?.linetype ?? d.linetype;
        const color = own?.color ?? d.color;
        const no = list?.(weight, color);
        const reset = own
          ? `<button class="icon-btn rc-icon" data-action="pen-reset" data-pen-key="${key}" title="Tillbaka till förvalet" aria-label="Tillbaka till förvalet">${icons.restore}</button>`
          : '<span aria-hidden="true"></span>';
        // Radkontrollerna (0.10.34): tjocklek, linjetyp och färg som runda knappar (`rowControls.ts`); pennans nummer (0.10.36) först.
        return `<div class="pen-row">
      <div class="style-name"><b>${escapeHtml(label)}</b><span>${escapeHtml(hint)}</span></div>
      <div class="rc-ctls">${no ? `<button class="pen-no" data-pen-goto="${no}" title="Penna ${no}: visa pennan och dess ställen">${no}</button>` : ''}${weightPicker(`pen-${key}`, weight, `data-pen="${key}:weight"`, ' mm')}<select data-pen="${key}:linetype" aria-label="Linjetyp">${lineTypeOptions(style, linetype)}</select><input type="color" data-pen="${key}:color" aria-label="Färg" value="${toHex(color ?? 'ink')}"></div>
      ${reset}
    </div>`;
      })
      .join('');
  return penGroupsFor(type)
    .map(
      (g) => `<section class="style-labels style-pens${g.rare ? ' sb-rare' : ''}">
    <h3>${escapeHtml(g.title)}${COLS}</h3>
    <p class="note">${escapeHtml(g.note)}</p>
    ${rows(g)}
  </section>`,
    )
    .join('');
}

/** Pennans nummer för en tjocklek och färg (0.10.36), för numret framför raden. */
export type PenListInfo = (weight: number, color: string | undefined) => number | undefined;

const defaultPen = penDefault;

/** Ändra en penna i `style` (en kopia) efter fältet; null om fältet inte hör hit. */
export function applyPenField(style: StyleSheet, input: HTMLInputElement | HTMLSelectElement): string | null {
  if (!input.dataset.pen) return null;
  const [key, field] = input.dataset.pen.split(':') as [string, 'weight' | 'color' | 'linetype'];
  const pens = (style.pens ??= {});
  const pen = { ...defaultPen(key), ...pens[key] };
  if (field === 'weight' && (Number(input.value) > 0 || defaultPen(key).weight === 0)) pen.weight = Number(input.value);
  if (field === 'color') {
    // Ett förval med färg (den ändrade markens grå) behåller den; annars är svart förvalet.
    const c = fromHex(input.value);
    const dc = defaultPen(key).color;
    if (dc && input.value.toLowerCase() === toHex(dc)) pen.color = dc;
    else if (!dc && (c === 'ink' || c === 'paper')) delete pen.color;
    else pen.color = c;
  }
  if (field === 'linetype') {
    // Heldraget sparas bara när förvalet är en annan linjetyp (snittets pennor, 0.10.16).
    if (input.value === 'solid' && !defaultPen(key).linetype) delete pen.linetype;
    else pen.linetype = input.value;
  }
  // Förvalet sparas inte, så att en senare ändring av förvalen slår igenom.
  const d = defaultPen(key);
  if (pen.weight === d.weight && pen.color === d.color && (pen.linetype ?? undefined) === d.linetype) delete pens[key];
  else pens[key] = pen;
  if (!Object.keys(pens).length) delete style.pens;
  return 'Ändra pennor';
}

/** Pennan tillbaka till förvalet (knappen Förval); false om den redan var det. */
export function resetPen(style: StyleSheet, key: string): boolean {
  if (!style.pens?.[key]) return false;
  delete style.pens[key];
  if (!Object.keys(style.pens).length) delete style.pens;
  return true;
}
