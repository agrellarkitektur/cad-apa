import type { StyleSheet } from '../../core/graphics';
import type { PenDef } from '../../core/graphics';
import { defaultMarkerPen, MARKER_PENS, ROOM_PENS, type MarkerPenKey } from '../../repr/markerPens';
import { defaultOpeningPen, OPENING_PENS, type OpeningPenKey } from '../../repr/openingPens';
import { escapeHtml } from '../labels';
import { defaultPlanCutPen, PLAN_CUT_PENS } from '../../repr/planCutPens';
import { CONTOUR_PENS, defaultContourPen } from '../../repr/contourPens';
import { lineTypeOptions } from '../lineTypePick';
import { weightPicker } from '../weightPick';
import { fromHex, toHex } from './colors';
import { icons } from '../icons';

/** Kolumnernas namn i rubriken, i knapparnas ordning. */
const COLS = '<span class="sb-cols">tjocklek · linjetyp · färg</span>';

/**
 * Pennor i stilboken: dörrarnas och fönstrens tre klasser (0.8.33) och
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
        const linetype = own?.linetype ?? defaultPen(key).linetype;
        const reset = own
          ? `<button class="icon-btn rc-icon" data-action="pen-reset" data-pen-key="${key}" title="Tillbaka till förvalet" aria-label="Tillbaka till förvalet">${icons.restore}</button>`
          : '<span aria-hidden="true"></span>';
        // Radkontrollerna (0.10.34): tjocklek, linjetyp och färg som runda knappar (`rowControls.ts`).
        return `<div class="pen-row">
      <div class="style-name"><b>${escapeHtml(label)}</b><span>${escapeHtml(hint)}</span></div>
      <div class="rc-ctls">${weightPicker(`pen-${key}`, weight, `data-pen="${key}:weight"`, ' mm')}<select data-pen="${key}:linetype" aria-label="Linjetyp">${lineTypeOptions(style, linetype)}</select><input type="color" data-pen="${key}:color" aria-label="Färg" value="${toHex(own?.color ?? defaultPen(key).color ?? 'ink')}"></div>
      ${reset}
    </div>`;
      })
      .join('');
  return `<section class="style-labels style-pens">
    <h3>Pennor för dörrar och fönster${COLS}</h3>
    <p class="note">Tre klasser för dörrarnas och fönstrens delar. Gäller alla dörrar och fönster utan egen penna, på typen eller objektet. Väggens kontur ställs in under Åtgärder.</p>
    ${rows(OPENING_PENS)}
  </section>
  <section class="style-labels style-pens sb-rare">
    <h3>Snittet i planen${COLS}</h3>
    <p class="note">Det som ligger helt under planens snitthöjd ritas som vy, det som ligger helt över streckprickat där det sticker ut utanför det snittade. Snitthöjden ställs in per våning (1100 från början). Ett objekt eller en typ kan få en egen penna för det som ligger över.</p>
    ${rows(PLAN_CUT_PENS)}
  </section>
  <section class="style-labels style-pens">
    <h3>Penna för rum${COLS}</h3>
    <p class="note">Rummens kontur i planen, för alla rum utan egen penna på typen eller rummet. Konturen ligger under väggarna och syns mot öppningar och rumsgränser.</p>
    ${rows(ROOM_PENS)}
  </section>
  <section class="style-labels style-pens">
    <h3>Höjdkurvor${COLS}</h3>
    <p class="note">Den befintliga marken ur Höjdkurvor och marken som den blir med markobjekten, i planen och på bladen. Höjden på hela meter har kurvans färg. Grått följer skärmens tema; 3D-vyn har sina egna linjer.</p>
    ${rows(CONTOUR_PENS)}
  </section>
  <section class="style-labels style-pens">
    <h3>Pennor för pilar och markörer${COLS}</h3>
    <p class="note">Gäller hela projektet, i planen, fasaderna, sektionerna och på bladen. Färgen gäller också markörens text. Svart följer skärmens tema. Linjetypen gäller linjerna; pilspetsar och trianglar är heldragna.</p>
    ${rows(MARKER_PENS)}
  </section>`;
}

/** Förvalet för en penna i stilboken: snittet, höjdkurvorna, markör eller dörrarnas och fönstrens klass. */
function defaultPen(key: string): PenDef {
  const cut = defaultPlanCutPen(key) ?? defaultContourPen(key);
  if (cut) return cut;
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
