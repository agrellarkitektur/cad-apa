import { escapeHtml } from './labels';

/** Fältens HTML i egenskapspanelen (granskningen efter 0.10.12, förut i `selectionFields.ts`). */

/**
 * Sifferfält. Mått i modellen visas i hela mm; mått på papper för
 * annotering (texthöjder) med två decimaler, `decimals = 2`.
 */
export function numberField(key: string, label: string, value: number, unit: string, decimals = 0): string {
  const id = `f-${key.replace(':', '-')}`;
  const shown = decimals > 0 ? Number(value).toFixed(decimals) : String(Math.round(value));
  const exprUnit = unit === '°' ? 'deg' : unit === 'mm' ? 'mm' : '';
  const step = decimals > 0 ? (1 / 10 ** decimals).toFixed(decimals) : '1';
  return `<label class="field" for="${id}"><span>${label}</span><span class="input-unit"><input type="text" data-expr data-unit="${exprUnit}" data-step="${step}" inputmode="decimal" autocomplete="off" id="${id}" data-key="${key}" value="${shown}"><i>${unit}</i></span></label>`;
}

export function textField(key: string, label: string, value: string): string {
  return `<label class="field" for="f-${key}"><span>${label}</span><input id="f-${key}" data-key="${key}" value="${escapeHtml(value)}"></label>`;
}
