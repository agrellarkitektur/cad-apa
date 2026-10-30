import type { StyleResources } from '../core/graphics';
import { lineTypeList } from '../core/lineTypes';
import { escapeHtml } from './labels';

/**
 * Valen i en lista med linjetyper (0.8.30): de inbyggda och stilbokens
 * egna. En nyckel som inte finns längre (en borttagen egen linjetyp) står
 * kvar som vald, och ritas heldragen. `first` är ett val före listan.
 */
export function lineTypeOptions(style: StyleResources | undefined, selected: string | undefined | null, first?: { value: string; label: string }): string {
  const list = lineTypeList(style);
  // Utan val: det första valet (t.ex. Stilbokens, 0.8.31), annars heldragen.
  const key = selected ?? (first ? first.value : 'solid');
  const missing = selected && !list.some((t) => t.id === selected) ? `<option value="${escapeHtml(selected)}" selected>Saknas (heldragen)</option>` : '';
  const mixed = selected === null ? '<option selected disabled>Olika</option>' : '';
  const opt = (t: { id: string; name: string }) => `<option value="${escapeHtml(t.id)}"${selected !== null && t.id === key ? ' selected' : ''}>${escapeHtml(t.name)}</option>`;
  const own = list.filter((t) => t.own);
  return `${mixed}${missing}${first ? opt({ id: first.value, name: first.label }) : ''}${list.filter((t) => !t.own).map(opt).join('')}${own.length ? `<optgroup label="Egna">${own.map(opt).join('')}</optgroup>` : ''}`;
}

/** Mönstret som en liten bild, för listan över linjetyper i stilboken. */
export function lineTypeSwatch(dash: readonly number[]): string {
  const k = 3; // px per mm
  const arr = dash.length ? ` stroke-dasharray="${dash.map((d) => Math.max(0.01, d * k)).join(' ')}"` : '';
  return `<svg class="linetype-swatch" viewBox="0 0 90 8" width="90" height="8" aria-hidden="true"><line x1="2" y1="4" x2="88" y2="4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"${arr}/></svg>`;
}
