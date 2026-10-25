import type { StyleSheet } from '../../core/graphics';
import type { PenDef } from '../../core/graphics';
import { defaultMarkerPen, MARKER_PENS, ROOM_PENS, type MarkerPenKey } from '../../repr/markerPens';
import { defaultOpeningPen, OPENING_PENS, type OpeningPenKey } from '../../repr/openingPens';
import { escapeHtml } from '../labels';
import { lineTypeOptions } from '../lineTypePick';
import { weightPicker } from '../weightPick';
import { fromHex, toHex } from './colors';

/**
 * Pennor i stilmallen: dörrarnas och fönstrens tre klasser (0.8.33) och
 * pilar och markörer (0.8.26): linjetjocklek, färg och (0.8.30)
 * linjetyp per sorts
 * markör, för hela projektet. Färgen gäller också markörens text och fyllda
 * trianglar.
 */
export function penSection(style: StyleSheet): string {
  const rows = (list: readonly { key: string; label: string; hint: string }[]) =>
    list
      .map(({ key, label, hint }) => {
        const own = style.pens?.[key];
        const weight = own?.weight ?? defaultPen(key).weight;
        const reset = own
          ? `<button class="btn" data-action="pen-reset" data-pen-key="${key}" title="Tillbaka till förvalet">Förval</button>`
          : '<span aria-hidden="true"></span>';
        return `<div class="pen-row">
      <div class="style-name"><b>${escapeHtml(label)}</b><span>${escapeHtml(hint)}</span></div>
      <div class="pen-weight"><span>Tjocklek</span>${weightPicker(`pen-${key}`, weight, `data-pen="${key}:weight"`, ' mm')}</div>
      <label><span>Färg</span><input type="color" data-pen="${key}:color" value="${toHex(own?.color ?? 'ink')}"></label>
      <label><span>Linjetyp</span><select data-pen="${key}:linetype">${lineTypeOptions(style, own?.linetype)}</select></label>
      ${reset}
    </div>`;
      })
      .join('');
  return `<section class="style-labels style-pens">
    <h3>Pennor för dörrar och fönster</h3>
    <p class="note">Tre klasser för dörrarnas och fönstrens delar. Gäller alla dörrar och fönster utan egen penna, på typen eller objektet. Väggens kontur ställs in under åtgärderna ovan.</p>
    ${rows(OPENING_PENS)}
  </section>
  <section class="style-labels style-pens">
    <h3>Penna för rum</h3>
    <p class="note">Rummens kontur i planen, för alla rum utan egen penna på typen eller rummet. Konturen ligger under väggarna och syns mot öppningar och rumsgränser.</p>
    ${rows(ROOM_PENS)}
  </section>
  <section class="style-labels style-pens">
    <h3>Pennor för pilar och markörer</h3>
    <p class="note">Gäller hela projektet, i planen, fasaderna, sektionerna och på bladen. Färgen gäller också markörens text. Svart följer skärmens tema. Linjetypen gäller linjerna; pilspetsar och trianglar är heldragna.</p>
    ${rows(MARKER_PENS)}
  </section>`;
}

/** Förvalet för en penna i stilmallen, markör eller dörrarnas och fönstrens klass. */
function defaultPen(key: string): PenDef {
  return OPENING_PENS.some((o) => o.key === key) ? defaultOpeningPen(key as OpeningPenKey) : defaultMarkerPen(key as MarkerPenKey);
}

/** Ändra en penna i `style` (en kopia) efter fältet; null om fältet inte hör hit. */
export function applyPenField(style: StyleSheet, input: HTMLInputElement | HTMLSelectElement): string | null {
  if (!input.dataset.pen) return null;
  const [key, field] = input.dataset.pen.split(':') as [string, 'weight' | 'color' | 'linetype'];
  const pens = (style.pens ??= {});
  const pen = { ...defaultPen(key), ...pens[key] };
  if (field === 'weight' && (Number(input.value) > 0 || defaultPen(key).weight === 0)) pen.weight = Number(input.value);
  if (field === 'color') {
    const c = fromHex(input.value);
    if (c === 'ink' || c === 'paper') delete pen.color;
    else pen.color = c;
  }
  if (field === 'linetype') {
    if (input.value === 'solid') delete pen.linetype;
    else pen.linetype = input.value;
  }
  // Förvalet sparas inte, så att en senare ändring av förvalen slår igenom.
  if (pen.weight === defaultPen(key).weight && !pen.color && !pen.linetype) delete pens[key];
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
