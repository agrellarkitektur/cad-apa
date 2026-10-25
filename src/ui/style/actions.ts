import type { ActionKey, Color, FillDef, StyleSheet } from '../../core/graphics';
import { clamp01, fromHex, toHex } from './colors';
import { escapeHtml } from '../labels';
import { fillTypeList, fillTypeOf } from '../../core/fillTypes';

/**
 * Stilmallens första del: hur väggar och linjer ritas för varje åtgärd
 * (fyllning, kontur och dörrarnas öppning).
 */

const ROWS: { key: ActionKey; label: string; hint: string }[] = [
  { key: 'plain', label: 'Nybyggnad', hint: 'Utan jämförelse: nybyggnad, eller när jämförelsen är avslagen' },
  { key: 'existing', label: 'Befintligt', hint: 'Finns kvar oförändrat. Dörrar som finns i Befintligt öppnas så här i alla vyer' },
  { key: 'demolished', label: 'Rivs', hint: 'Finns i jämförelsen men inte i förslaget' },
  { key: 'new', label: 'Planerat', hint: 'Finns i förslaget men inte i jämförelsen. Övriga dörrar öppnas så här i alla vyer' },
];

export function actionRows(style: StyleSheet): string {
  return ROWS.map(({ key, label, hint }) => {
    const a = style.actions[key];
    const fill = a.cutFill;
    const fillColor = fill.kind === 'none' ? 'ink' : fill.color;
    // Skraffering och egna fyllningstyper (0.8.36) har streck och kan ha en bakgrund.
    const striped = fill.kind === 'hatch' || fill.kind === 'type';
    const back = striped && fill.background ? fill : null;
    const types = fillTypeList(style).map((t) => `<option value="type:${escapeHtml(t.id)}"${fill.kind === 'type' && fill.type === t.id ? ' selected' : ''}>${escapeHtml(t.name)}</option>`).join('');
    const gone = fill.kind === 'type' && !fillTypeOf(style, fill.type) ? `<option value="type:${escapeHtml(fill.type)}" selected disabled>Borttagen typ</option>` : '';
    const outline = a.cutOutline ? (a.cutOutline.dash?.length ? 'dashed' : 'solid') : 'none';
    return `<div class="style-row">
        <div class="style-name"><b>${label}</b><span>${hint}</span></div>
        <label><span>Fyllning</span><select data-key="${key}" data-field="fill">
          <option value="none"${fill.kind === 'none' ? ' selected' : ''}>Ingen</option>
          <option value="solid"${fill.kind === 'solid' ? ' selected' : ''}>Solid</option>
          <option value="hatch"${fill.kind === 'hatch' ? ' selected' : ''}>Skraffering</option>
          ${types}${gone}
        </select></label>
        <label><span>${striped ? 'Linjefärg' : 'Färg'}</span><input type="color" data-key="${key}" data-field="color" value="${toHex(fillColor)}"${fill.kind === 'none' ? ' disabled' : ''}></label>
        <label><span>Opacitet</span><span class="input-unit"><input type="text" data-expr data-unit="" data-step="10" inputmode="decimal" autocomplete="off" data-key="${key}" data-field="opacity" value="${Math.round((fill.kind === 'none' ? 1 : fill.opacity ?? 1) * 100)}"${fill.kind === 'none' ? ' disabled' : ''}><i>%</i></span></label>
        <label><span>Bakgrund</span><span class="bg-pick"><input type="checkbox" data-key="${key}" data-field="bgOn"${back ? ' checked' : ''}${striped ? '' : ' disabled'} aria-label="Bakgrund"><input type="color" data-key="${key}" data-field="bg" value="${toHex(back?.background ?? 'paper')}"${back ? '' : ' disabled'}><input type="text" data-expr data-unit="" data-step="10" inputmode="decimal" autocomplete="off" data-key="${key}" data-field="bgOpacity" value="${Math.round((back?.backgroundOpacity ?? 1) * 100)}"${back ? '' : ' disabled'} aria-label="Bakgrundens opacitet" title="Bakgrundens opacitet, %"></span></label>
        <label><span>Kontur</span><select data-key="${key}" data-field="outline">
          <option value="solid"${outline === 'solid' ? ' selected' : ''}>Heldragen</option>
          <option value="dashed"${outline === 'dashed' ? ' selected' : ''}>Streckad</option>
          <option value="none"${outline === 'none' ? ' selected' : ''}>Ingen</option>
        </select></label>
        <label><span>Konturfärg</span><input type="color" data-key="${key}" data-field="lineColor" value="${toHex(a.cutOutline?.color ?? a.lines.color)}"></label>
        ${key === 'existing' || key === 'new' ? `<label><span>Dörrar öppna</span><span class="input-unit"><input type="text" data-expr data-unit="deg" data-step="15" inputmode="decimal" autocomplete="off" data-key="${key}" data-field="door" value="${a.doorAngle}"><i>°</i></span></label>` : '<span class="style-door-na" aria-hidden="true"></span>'}
      </div>`;
  }).join('');
}

/**
 * Ändra en åtgärds stil i `style` (en kopia) efter fältet. Ger ångrarubriken,
 * eller null om fältet inte hör hit.
 */
export function applyActionField(style: StyleSheet, input: HTMLInputElement | HTMLSelectElement): string | null {
  const key = input.dataset.key as ActionKey | undefined;
  if (!key) return null;
  const a = style.actions[key];
  switch (input.dataset.field) {
    case 'fill': {
      const color: Color = a.cutFill.kind === 'none' ? 'ink' : a.cutFill.color;
      a.cutFill = makeFill(input.value, color);
      break;
    }
    case 'color':
      if (a.cutFill.kind !== 'none') a.cutFill = { ...a.cutFill, color: fromHex(input.value) };
      break;
    case 'opacity':
      if (a.cutFill.kind !== 'none') a.cutFill = { ...a.cutFill, opacity: clamp01(Number(input.value) / 100) };
      break;
    case 'bgOn':
      if (a.cutFill.kind === 'hatch' || a.cutFill.kind === 'type') a.cutFill = { ...a.cutFill, background: (input as HTMLInputElement).checked ? 'paper' : null };
      break;
    case 'bg':
      if (a.cutFill.kind === 'hatch' || a.cutFill.kind === 'type') a.cutFill = { ...a.cutFill, background: fromHex(input.value) };
      break;
    case 'bgOpacity':
      if (a.cutFill.kind === 'hatch' || a.cutFill.kind === 'type') a.cutFill = { ...a.cutFill, backgroundOpacity: clamp01(Number(input.value) / 100) };
      break;
    case 'outline': {
      const base = a.cutOutline ?? { weight: 0.35, color: a.lines.color };
      if (input.value === 'none') a.cutOutline = null;
      else a.cutOutline = { ...base, dash: input.value === 'dashed' ? [2, 1] : undefined };
      a.lines = { ...a.lines, dash: input.value === 'dashed' ? [2, 1] : undefined };
      break;
    }
    case 'lineColor': {
      const c = fromHex(input.value);
      if (a.cutOutline) a.cutOutline = { ...a.cutOutline, color: c };
      a.lines = { ...a.lines, color: c };
      break;
    }
    case 'door':
      a.doorAngle = Math.max(0, Math.min(90, Number(input.value) || 0));
      break;
  }
  return 'Ändra stilmall';
}

function makeFill(kind: string, color: Color): FillDef {
  if (kind === 'none') return { kind: 'none' };
  // En egen fyllningstyp (0.8.36), som snittfyllningens skraffering men med typens mönster.
  if (kind.startsWith('type:')) return { kind: 'type', type: kind.slice(5), color, weight: 0.18 };
  if (kind === 'solid') return { kind: 'solid', color };
  return { kind: 'hatch', color, angle: 45, spacing: 0.6, weight: 0.18 };
}
