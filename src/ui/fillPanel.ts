import type { StyleSheet } from '../core/graphics';
import { FILL_TYPES, fillTypeList, fillTypeOf } from '../core/fillTypes';
import { FILL_BACKGROUND, FILL_COLOR, BACKGROUND_COLOR, FILL_WEIGHT, type FillParams, type FillPattern } from '../elements/drawing2d';
import { escapeHtml } from './labels';
import { fillTypeSwatch, patternSwatch } from './patternPick';
import { weightPicker } from './weightPick';

/**
 * Fyllningens panel (0.10.14): samma för 2D-former, rum, markobjekt och
 * slänterna. Fyra lägen, **Ingen**, **Solid**, **Mask** och **Mönster**, och
 * under varje läge fälten och förslagen (bubblor) för det. Opaciteten är
 * fyllningens egen (`fillOpacity`); linjens opacitet står vid linjen.
 *
 * Fälten har nycklarna `fillKind`, `fillColor`, `fillOpacity`, `pattern`,
 * `fillWeight`, `fillAngle`, `fillSpacing`, `fillTypeAngle`, `fillTypeScale`,
 * `fillBackgroundKind`, `fillBackground`, `fillBackgroundOpacity` och
 * `fillPreset`; `fillPatch` gör om en ändring till nya parametrar.
 */

export type FillKind = 'none' | 'solid' | 'mask' | 'pattern';

export const FILL_KIND_LABELS: Record<FillKind, string> = { none: 'Ingen', solid: 'Solid', mask: 'Mask', pattern: 'Mönster' };

export function fillKindOf(fill: FillPattern | undefined): FillKind {
  return !fill ? 'none' : fill === 'solid' ? 'solid' : fill === 'mask' ? 'mask' : 'pattern';
}

/** Opaciteten i tio steg för Solid och Mönster, och listan för Mask. */
export const OPACITY_STEPS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
export const MASK_STEPS = [100, 75, 50, 25];

/** Fyllningens opacitet i procent som den ritas: egen, annars linjens (som före 0.10.14), annars 100. */
export function fillOpacityOf(p: Pick<FillParams, 'opacity' | 'fillOpacity'>): number {
  return p.fillOpacity ?? p.opacity ?? 100;
}

/** Ett förslag: ett namn och parametrarna det sätter. */
export interface FillPreset {
  id: string;
  label: string;
  kind: Exclude<FillKind, 'none'>;
  patch: Partial<FillParams>;
}

/**
 * Förslagen under varje läge. Ett förslag sätter alla fält som hör till
 * läget, så att det ser likadant ut vad som än var valt förut.
 */
export const FILL_PRESETS: FillPreset[] = [
  { id: 'vit', label: 'Vit', kind: 'solid', patch: { fill: 'solid', fillColor: '#ffffff', fillOpacity: 100 } },
  { id: 'ljusgra', label: 'Ljusgrå', kind: 'solid', patch: { fill: 'solid', fillColor: '#e3e5e6', fillOpacity: 100 } },
  { id: 'gra', label: 'Grå 50 %', kind: 'solid', patch: { fill: 'solid', fillColor: '#9aa0a6', fillOpacity: 50 } },
  { id: 'grasyta', label: 'Gräs', kind: 'solid', patch: { fill: 'solid', fillColor: '#b4d39b', fillOpacity: 70 } },
  { id: 'grus', label: 'Grus', kind: 'solid', patch: { fill: 'solid', fillColor: '#ddd3bc', fillOpacity: 80 } },
  { id: 'hardgjort', label: 'Hårdgjort', kind: 'solid', patch: { fill: 'solid', fillColor: '#c9c6bf', fillOpacity: 80 } },
  { id: 'vatten', label: 'Vatten', kind: 'solid', patch: { fill: 'solid', fillColor: '#a9cbe6', fillOpacity: 70 } },
  { id: 'mask', label: 'Hel mask', kind: 'mask', patch: { fill: 'mask', fillOpacity: 100 } },
  { id: 'halvmask', label: 'Halv mask', kind: 'mask', patch: { fill: 'mask', fillOpacity: 50 } },
  { id: 'skraffering', label: 'Skraffering', kind: 'pattern', patch: { fill: 'hatch', fillAngle: 45, fillSpacing: 2, fillColor: FILL_COLOR, fillOpacity: 100, fillWeight: undefined, fillModel: undefined } },
  { id: 'tat', label: 'Tät skraffering', kind: 'pattern', patch: { fill: 'hatch', fillAngle: 45, fillSpacing: 1, fillColor: FILL_COLOR, fillOpacity: 100, fillWeight: undefined, fillModel: undefined } },
  { id: 'kors', label: 'Kors', kind: 'pattern', patch: { fill: 'cross', fillAngle: 45, fillSpacing: 2, fillColor: FILL_COLOR, fillOpacity: 100, fillWeight: undefined, fillModel: undefined } },
  { id: 'tegel', label: 'Tegel', kind: 'pattern', patch: { fill: 'type', fillType: 'tegel', fillTypeAngle: undefined, fillTypeScale: undefined, fillColor: '#1d2328', fillOpacity: 100, fillWeight: undefined, fillModel: undefined } },
  { id: 'betong', label: 'Betong', kind: 'pattern', patch: { fill: 'type', fillType: 'betong', fillTypeAngle: undefined, fillTypeScale: undefined, fillColor: '#1d2328', fillOpacity: 100, fillWeight: undefined, fillModel: undefined } },
  { id: 'plattor', label: 'Plattor 300', kind: 'pattern', patch: { fill: 'type', fillType: 'plattor300', fillTypeAngle: undefined, fillTypeScale: undefined, fillColor: FILL_COLOR, fillOpacity: 100, fillWeight: undefined, fillModel: undefined } },
  { id: 'mark', label: 'Mark', kind: 'pattern', patch: { fill: 'type', fillType: 'mark', fillTypeAngle: undefined, fillTypeScale: undefined, fillColor: FILL_COLOR, fillOpacity: 100, fillWeight: undefined, fillModel: undefined } },
];

const comma = (n: number) => n.toLocaleString('sv-SE');

/** Ett fält med enhet och uttryck; tomt med *Olika* när värdet saknas (NaN). */
function numberInput(key: string, label: string, v: number, unit: string, attrs: (key: string) => string, extra = ''): string {
  const ok = Number.isFinite(v);
  return `<label class="field"><span>${label}</span><span class="input-unit"><input type="text" data-expr inputmode="decimal" autocomplete="off" ${attrs(key)} value="${ok ? comma(Math.round(v * 100) / 100) : ''}"${ok ? '' : ' placeholder="Olika"'}${extra}><i>${unit}</i></span></label>`;
}

/** Opaciteten i tio steg (knappar) och skriven. */
function opacitySteps(name: string, key: string, label: string, v: number, attrs: (key: string) => string, steps = OPACITY_STEPS): string {
  const ok = Number.isFinite(v);
  const buttons = steps.map((s) => `<label title="${s} %"><input type="radio" name="${escapeHtml(name)}" value="${s}" ${attrs(key)}${ok && Math.round(v) === s ? ' checked' : ''}><span>${s}</span></label>`).join('');
  return `<div class="fill-opacity"><span class="fill-opacity-label">${label}</span><div class="fill-steps" role="radiogroup" aria-label="${label}">${buttons}</div>${numberInput(key, '', v, '%', attrs, ' data-unit="" data-step="10"')}</div>`;
}

/** Förslagen för ett läge, som bubblor. */
function chips(name: string, kind: FillKind, attrs: (key: string) => string): string {
  const list = FILL_PRESETS.filter((f) => f.kind === kind);
  if (!list.length) return '';
  return `<div class="fill-chips" role="radiogroup" aria-label="Förslag"><span class="fill-chips-label">Förslag</span>${list
    .map((f) => `<label><input type="radio" name="${escapeHtml(name)}-preset" value="${f.id}" ${attrs('fillPreset')}>${presetSwatch(f)}<span>${escapeHtml(f.label)}</span></label>`)
    .join('')}</div>`;
}

function presetSwatch(f: FillPreset): string {
  const p = f.patch;
  if (p.fill === 'type') {
    const t = FILL_TYPES[p.fillType ?? ''];
    return t ? fillTypeSwatch(t, p.fillColor, 14, 10) : '';
  }
  if (p.fill === 'mask') return '';
  if (p.fill === 'solid') return `<i class="fill-dot" style="background:${escapeHtml(p.fillColor ?? FILL_COLOR)};opacity:${(p.fillOpacity ?? 100) / 100}"></i>`;
  return '';
}

/**
 * Sparade fyllningar (0.10.14): bubblor som kopplar objektet till en, och
 * vilken det är kopplat till, med knappar för att spara och ta bort.
 */
function savedRow(name: string, p: FillParams, attrs: (key: string) => string, style?: StyleSheet): string {
  const saved = style?.fills ?? [];
  const linked = p.fillStyle ? saved.find((f) => f.id === p.fillStyle) : undefined;
  const scope = /data-key="([^:"]+):/.exec(attrs('x'))?.[1] ?? 'd2';
  const list = saved.length
    ? `<div class="fill-chips fill-saved" role="radiogroup" aria-label="Sparade fyllningar"><span class="fill-chips-label">Sparade</span><label${linked ? '' : ' class="is-on"'}><input type="radio" name="${escapeHtml(name)}-saved" value="" ${attrs('fillStyle')}${linked ? '' : ' checked'}><span>Egen</span></label>${saved
        .map((f) => `<label${f.id === linked?.id ? ' class="is-on"' : ''}><input type="radio" name="${escapeHtml(name)}-saved" value="${escapeHtml(f.id)}" ${attrs('fillStyle')}${f.id === linked?.id ? ' checked' : ''}>${savedSwatch(f, style)}<span>${escapeHtml(f.name)}</span></label>`)
        .join('')}</div>`
    : '';
  const buttons = p.fill
    ? `<div class="row"><button class="btn" data-action="fill-save" data-scope="${scope}" data-name="${escapeHtml(linked?.name ?? '')}" title="Sparar fyllningen med ett namn i stilmallen. Samma namn som en sparad skriver över den, och alla objekt som är kopplade till den ändras.">Spara i stilmallen…</button>${linked ? `<button class="btn btn-ghost" data-action="fill-unsave" data-id="${escapeHtml(linked.id)}" title="Objekten som är kopplade till den behåller hur de ser ut">Ta bort ur stilmallen</button>` : ''}</div>`
    : '';
  const note = linked ? `<p class="note">Kopplad till <b>${escapeHtml(linked.name)}</b> i stilmallen. Ändrar du ett fält blir fyllningen objektets egen.</p>` : '';
  return list + note + buttons;
}

function savedSwatch(f: { [k: string]: unknown }, style?: StyleSheet): string {
  const color = typeof f.fillColor === 'string' ? f.fillColor : FILL_COLOR;
  if (f.fill === 'solid') return `<i class="fill-dot" style="background:${escapeHtml(color)}"></i>`;
  if (f.fill === 'type') {
    const t = fillTypeOf(style, f.fillType as string);
    return t ? fillTypeSwatch(t, color, 14, 10) : '';
  }
  if (f.fill === 'hatch' || f.fill === 'cross') return patternSwatch(f.fill, color, Number(f.fillAngle ?? 45)).replace('width="22" height="16"', 'width="14" height="10"');
  return '';
}

/** Mönstren: skraffering, kors och fyllningstyperna (inbyggda och stilmallens egna). */
function patternList(name: string, p: FillParams, attrs: (key: string) => string, style?: StyleSheet): string {
  const color = p.fillColor ?? FILL_COLOR;
  const own = (['hatch', 'cross'] as const).map(
    (k) => `<label title="${k === 'hatch' ? 'Skraffering' : 'Korsskraffering'}"><input type="radio" name="${escapeHtml(name)}" value="${k}" ${attrs('pattern')}${p.fill === k ? ' checked' : ''}>${patternSwatch(k, color, p.fillAngle)}<span>${k === 'hatch' ? 'Skraffering' : 'Kors'}</span></label>`,
  );
  const types = fillTypeList(style).map(
    (t) => `<label title="${escapeHtml(t.name)}"><input type="radio" name="${escapeHtml(name)}" value="type:${escapeHtml(t.id)}" ${attrs('pattern')}${p.fill === 'type' && p.fillType === t.id ? ' checked' : ''}>${fillTypeSwatch(t, color)}<span>${escapeHtml(t.name)}</span></label>`,
  );
  return `<div class="pattern-pick" role="radiogroup" aria-label="Mönster">${[...own, ...types].join('')}</div>`;
}

/** Bakgrundens sort: ingen, mask (ritningens bakgrund) eller en egen färg. */
export function backgroundKindOf(b: string | undefined): 'none' | 'mask' | 'color' {
  return b === undefined ? 'none' : b === FILL_BACKGROUND ? 'mask' : 'color';
}

/**
 * Fyllningens panel. `name` skiljer radioknapparnas grupper åt när flera
 * paneler står i samma formulär; `attrs` ger varje fält dess nyckel.
 */
export function fillPanel(name: string, p: FillParams, attrs: (key: string) => string, style?: StyleSheet, title = 'Fyllning'): string {
  const kind = fillKindOf(p.fill);
  const seg = (Object.keys(FILL_KIND_LABELS) as FillKind[])
    .map((k) => `<label><input type="radio" name="${escapeHtml(name)}-kind" value="${k}" ${attrs('fillKind')}${k === kind ? ' checked' : ''}><span>${FILL_KIND_LABELS[k]}</span></label>`)
    .join('');
  const op = fillOpacityOf(p);
  const color = p.fillColor ?? FILL_COLOR;
  let body = '';
  if (kind === 'solid')
    body = `<div class="fields"><label class="field"><span>Färg</span><input type="color" ${attrs('fillColor')} value="${escapeHtml(color)}"></label></div>
      ${opacitySteps(`${name}-op`, 'fillOpacity', 'Opacitet', op, attrs)}`;
  else if (kind === 'mask')
    body = `<div class="fields"><label class="field"><span>Opacitet</span><select ${attrs('fillOpacity')}>${MASK_STEPS.map((s) => `<option value="${s}"${Math.round(op) === s ? ' selected' : ''}>${s} %</option>`).join('')}${MASK_STEPS.includes(Math.round(op)) ? '' : `<option value="${Math.round(op)}" selected>${Math.round(op)} %</option>`}</select></label></div>
      <p class="note">Masken döljer det som ligger under och syns som ritningens bakgrund (papperet i PDF:en).</p>`;
  else if (kind === 'pattern') {
    const own = p.fill === 'type';
    const gone = own && !fillTypeOf(style, p.fillType) ? '<p class="note">Fyllningstypen finns inte längre i stilmallen och ritas som en skraffering.</p>' : '';
    const typeWeight = own ? fillTypeOf(style, p.fillType)?.weight : undefined;
    const weight = p.fillWeight ?? typeWeight ?? FILL_WEIGHT;
    // Måtten på papper eller i verkligheten (0.10.14); förvalet från typen, skrafferingen på papper.
    const real = p.fillModel ?? (own ? !!fillTypeOf(style, p.fillType)?.model : false);
    const measure = `<label class="field"><span>Måtten</span><select ${attrs('fillModel')}><option value="paper"${real ? '' : ' selected'}>På papper</option><option value="model"${real ? ' selected' : ''}>I verkligheten</option></select></label>`;
    const geometry = own
      ? `${numberInput('fillTypeAngle', 'Vridning', p.fillTypeAngle ?? 0, '°', attrs, ' data-unit="deg"')}${numberInput('fillTypeScale', 'Skala', p.fillTypeScale ?? 1, '×', attrs, ' data-unit=""')}${measure}`
      : `${numberInput('fillAngle', 'Vinkel', p.fillAngle ?? 45, '°', attrs, ' data-unit="deg"')}${numberInput('fillSpacing', real ? 'Avstånd i verkligheten' : 'Avstånd på papper', p.fillSpacing ?? 2, 'mm', attrs)}${measure}`;
    const back = backgroundKindOf(p.fillBackground);
    const backOp = p.fillBackgroundOpacity ?? 100;
    body = `${patternList(`${name}-pattern`, p, attrs, style)}${gone}
      <div class="field-label">Förgrund</div>
      <div class="fields"><div class="field"><span>Penna</span>${weightPicker(`${name}-weight`, weight, attrs('fillWeight'), ' mm')}</div>
        <label class="field"><span>Färg</span><input type="color" ${attrs('fillColor')} value="${escapeHtml(color)}"></label>${geometry}</div>
      ${opacitySteps(`${name}-op`, 'fillOpacity', 'Opacitet', op, attrs)}
      <div class="field-label">Bakgrund</div>
      <div class="fields"><label class="field"><span>Bakgrund</span><select ${attrs('fillBackgroundKind')}><option value="none"${back === 'none' ? ' selected' : ''}>Ingen</option><option value="mask"${back === 'mask' ? ' selected' : ''}>Mask</option><option value="color"${back === 'color' ? ' selected' : ''}>Egen färg</option></select></label>
        ${back === 'color' ? `<label class="field"><span>Bakgrundens färg</span><input type="color" ${attrs('fillBackground')} value="${escapeHtml(p.fillBackground!)}"></label>` : ''}</div>
      ${back === 'none' ? '' : opacitySteps(`${name}-bop`, 'fillBackgroundOpacity', 'Bakgrundens opacitet', backOp, attrs)}
      <p class="note">Mönstret utgår från objektets första hörn och följer med när objektet flyttas.</p>`;
  }
  return `<div class="fill-panel"><div class="field-label">${escapeHtml(title)}</div><div class="pattern-pick fill-seg" role="radiogroup" aria-label="${escapeHtml(title)}">${seg}</div>${savedRow(name, p, attrs, style)}${body}${kind === 'none' ? '' : chips(name, kind, attrs)}</div>`;
}

/** Procent 0–100, eller null om det inte är ett tal. */
function percent(v: number): number | null {
  return Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : null;
}

/**
 * En ändring i panelen som nya parametrar och ångra-texten, eller null när
 * nyckeln inte hör till fyllningen eller värdet inte går att använda.
 * `p` är objektets nuvarande fyllning (den första i markeringen).
 */
export function fillPatch(name: string, value: string, p: FillParams): { patch: Partial<FillParams>; label: string } | null {
  const num = Number(value.replace(',', '.'));
  switch (name) {
    case 'fillKind': {
      const k = value as FillKind;
      if (k === 'none') return { patch: { fill: undefined }, label: 'Ingen fyllning' };
      if (k === 'solid') return { patch: { fill: 'solid' }, label: 'Solid fyllning' };
      if (k === 'mask') return { patch: { fill: 'mask' }, label: 'Mask' };
      return fillKindOf(p.fill) === 'pattern' ? null : { patch: { fill: 'hatch' }, label: 'Mönster' };
    }
    case 'pattern':
      // Ett nytt mönster tar sina mått som typen säger (fillModel nollställs).
      if (value.startsWith('type:')) return { patch: { fill: 'type', fillType: value.slice(5), fillModel: undefined }, label: 'Ändra mönster' };
      if (value === 'hatch' || value === 'cross') return { patch: { fill: value, ...(p.fill === 'type' ? { fillModel: undefined } : {}) }, label: 'Ändra mönster' };
      if (value === 'none') return { patch: { fill: undefined }, label: 'Ingen fyllning' };
      return { patch: { fill: value as FillPattern }, label: 'Ändra fyllning' };
    case 'fillPreset': {
      const f = FILL_PRESETS.find((q) => q.id === value);
      return f ? { patch: f.patch, label: `Fyllning: ${f.label}` } : null;
    }
    case 'fillColor':
      return { patch: { fillColor: value }, label: 'Ändra fyllningens färg' };
    case 'fillModel': {
      // Skrafferingens avstånd byts till något rimligt i de nya måtten.
      const real = value === 'model';
      const sp = p.fillSpacing ?? 2;
      const spacing = p.fill === 'type' ? {} : real && sp < 20 ? { fillSpacing: 100 } : !real && sp >= 20 ? { fillSpacing: 2 } : {};
      return { patch: { fillModel: real, ...spacing }, label: real ? 'Mönstret i verkliga mått' : 'Mönstret i mått på papper' };
    }
    case 'fillOpacity':
      return percent(num) === null ? null : { patch: { fillOpacity: percent(num)! }, label: 'Ändra fyllningens opacitet' };
    case 'fillWeight':
      return num >= 0 ? { patch: { fillWeight: num > 0 ? num : undefined }, label: 'Ändra mönstrets penna' } : null;
    case 'fillAngle':
      return Number.isFinite(num) ? { patch: { fillAngle: num }, label: 'Ändra vinkel' } : null;
    case 'fillSpacing':
      return num > 0 ? { patch: { fillSpacing: num }, label: 'Ändra avstånd' } : null;
    case 'fillTypeAngle':
      return Number.isFinite(num) ? { patch: { fillTypeAngle: num || undefined }, label: 'Vrid fyllningen' } : null;
    case 'fillTypeScale':
      return num > 0 ? { patch: { fillTypeScale: num === 1 ? undefined : num }, label: 'Ändra fyllningens skala' } : null;
    case 'fillBackgroundKind':
      if (value === 'none') return { patch: { fillBackground: undefined, fillBackgroundOpacity: undefined }, label: 'Ingen bakgrund' };
      if (value === 'mask') return { patch: { fillBackground: FILL_BACKGROUND }, label: 'Bakgrunden som mask' };
      return { patch: { fillBackground: backgroundKindOf(p.fillBackground) === 'color' ? p.fillBackground : BACKGROUND_COLOR }, label: 'Bakgrund med egen färg' };
    case 'fillBackground':
      return { patch: { fillBackground: value }, label: 'Ändra bakgrundens färg' };
    case 'fillBackgroundOpacity':
      return percent(num) === null ? null : { patch: { fillBackgroundOpacity: percent(num) === 100 ? undefined : percent(num)! }, label: 'Ändra bakgrundens opacitet' };
  }
  return null;
}

/** Nycklarna som `fillPatch` hanterar. */
export const FILL_KEYS: ReadonlySet<string> = new Set(['fillModel', 'fillKind', 'pattern', 'fillPreset', 'fillColor', 'fillOpacity', 'fillWeight', 'fillAngle', 'fillSpacing', 'fillTypeAngle', 'fillTypeScale', 'fillBackgroundKind', 'fillBackground', 'fillBackgroundOpacity']);

/** Parametrarna med ändringen; `undefined` tar bort en parameter. */
export function withPatch<T extends object>(params: T, patch: Partial<FillParams>): T {
  const out = { ...params } as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete out[k];
    else out[k] = v;
  }
  return out as T;
}
