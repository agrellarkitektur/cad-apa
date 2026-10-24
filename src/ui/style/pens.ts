import type { StyleSheet } from '../../core/graphics';
import { defaultMarkerPen, MARKER_PENS, type MarkerPenKey } from '../../repr/markerPens';
import { escapeHtml } from '../labels';
import { weightPicker } from '../weightPick';
import { fromHex, toHex } from './colors';

/**
 * Pennor för pilar och markörer (0.8.26): linjetjocklek och färg per sorts
 * markör, för hela projektet. Färgen gäller också markörens text och fyllda
 * trianglar.
 */
export function penSection(style: StyleSheet): string {
  const rows = MARKER_PENS.map(({ key, label, hint }) => {
    const own = style.pens?.[key];
    const weight = own?.weight ?? defaultMarkerPen(key).weight;
    const reset = own
      ? `<button class="btn" data-action="pen-reset" data-pen-key="${key}" title="Tillbaka till förvalet">Förval</button>`
      : '<span aria-hidden="true"></span>';
    return `<div class="pen-row">
      <div class="style-name"><b>${escapeHtml(label)}</b><span>${escapeHtml(hint)}</span></div>
      <div class="pen-weight"><span>Tjocklek</span>${weightPicker(`pen-${key}`, weight, `data-pen="${key}:weight"`, ' mm')}</div>
      <label><span>Färg</span><input type="color" data-pen="${key}:color" value="${toHex(own?.color ?? 'ink')}"></label>
      ${reset}
    </div>`;
  }).join('');
  return `<section class="style-labels style-pens">
    <h3>Pennor för pilar och markörer</h3>
    <p class="note">Gäller hela projektet, i planen, fasaderna, sektionerna och på bladen. Färgen gäller också markörens text. Svart följer skärmens tema.</p>
    ${rows}
  </section>`;
}

/** Ändra en penna i `style` (en kopia) efter fältet; null om fältet inte hör hit. */
export function applyPenField(style: StyleSheet, input: HTMLInputElement | HTMLSelectElement): string | null {
  if (!input.dataset.pen) return null;
  const [key, field] = input.dataset.pen.split(':') as [MarkerPenKey, 'weight' | 'color'];
  const pens = (style.pens ??= {});
  const pen = { ...defaultMarkerPen(key), ...pens[key] };
  if (field === 'weight' && Number(input.value) > 0) pen.weight = Number(input.value);
  if (field === 'color') {
    const c = fromHex(input.value);
    if (c === 'ink' || c === 'paper') delete pen.color;
    else pen.color = c;
  }
  // Förvalet sparas inte, så att en senare ändring av förvalen slår igenom.
  if (pen.weight === defaultMarkerPen(key).weight && !pen.color) delete pens[key];
  else pens[key] = pen;
  if (!Object.keys(pens).length) delete style.pens;
  return 'Ändra pennor';
}

/** Pennan tillbaka till förvalet (knappen Förval); false om den redan var det. */
export function resetPen(style: StyleSheet, key: string): boolean {
  if (!style.pens?.[key as MarkerPenKey]) return false;
  delete style.pens[key as MarkerPenKey];
  if (!Object.keys(style.pens).length) delete style.pens;
  return true;
}
