import { PEN_COLORS, PEN_WEIGHTS } from '../elements/drawing2d';
import { escapeHtml } from './labels';

/**
 * Val av linjetjocklek som en tabell (0.8.14): en rad per tjocklek med
 * "gammel-cad"-färgen, färgens namn och tjockleken. Raden är en
 * radioknapp, så valet går genom samma change-händelse som en lista. Den
 * fälls ut från en knapp som visar det som är valt. `attrs` läggs på varje
 * knapp (t.ex. `data-key="d2:weight"`).
 */
export function weightPicker(name: string, current: number, attrs: string, unit = ''): string {
  const comma = (n: number) => n.toLocaleString('sv-SE', { minimumFractionDigits: 2 });
  const sw = (w: number) => `<i class="wp-swatch" style="background:${PEN_COLORS[w]?.color ?? 'transparent'}"></i>`;
  const weights = PEN_WEIGHTS.includes(current) ? PEN_WEIGHTS : [...PEN_WEIGHTS, current].sort((a, b) => a - b);
  const rows = weights
    .map(
      (w) =>
        `<label class="wp-row"><input type="radio" name="${escapeHtml(name)}" value="${w}" ${attrs}${w === current ? ' checked' : ''}>${sw(w)}<span class="wp-name">${escapeHtml(PEN_COLORS[w]?.name ?? '')}</span><span class="wp-w">${comma(w)}</span><span class="wp-line" style="height:${Math.max(1, Math.round(w * 4))}px"></span></label>`,
    )
    .join('');
  return `<details class="weight-pick"><summary aria-label="Linjetjocklek">${sw(current)}<span>${comma(current)}${unit}</span></summary><div class="wp-table" role="radiogroup" aria-label="Linjetjocklek">${rows}</div></details>`;
}
