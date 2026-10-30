import type { Material, StyleResources } from '../core/graphics';
import { fillTypeList } from '../core/fillTypes';
import { FILL_COLOR } from '../elements/drawing2d';
import { currentWeights } from './weightPick';
import { escapeHtml } from './labels';

/**
 * Byggnadsmaterialens snitt, yta och penna (0.10.28.2), i objektets panel
 * (Material, för bjälklag och tak) och i materiallistan i stilboken.
 * Mönstret väljs i en lista; dess övriga mått (vinkel, avstånd, skala)
 * behålls när mönstret byts. Nycklarna: `matCut`, `matCutColor`,
 * `matSurface`, `matSurfaceColor`, `matPen` och `matPenColor`.
 */

export const BUILDING_KEYS: ReadonlySet<string> = new Set(['matCut', 'matCutColor', 'matSurface', 'matSurfaceColor', 'matPen', 'matPenColor']);

/** Mönstrets värde i listan: `solid`, `hatch`, `cross` eller `type:<nyckel>`; tomt = inget. */
function patternValue(f: Record<string, unknown> | undefined): string {
  if (!f?.fill) return '';
  return f.fill === 'type' ? `type:${String(f.fillType ?? '')}` : String(f.fill);
}

function patternOptions(value: string, none: string, style: StyleResources | undefined): string {
  const opt = (v: string, l: string) => `<option value="${escapeHtml(v)}"${v === value ? ' selected' : ''}>${escapeHtml(l)}</option>`;
  return [opt('', none), opt('solid', 'Hel färg'), opt('hatch', 'Skraffering'), opt('cross', 'Kors'), ...fillTypeList(style).map((t) => opt(`type:${t.id}`, t.name))].join('');
}

/** Fälten för materialets snitt, yta och penna. `attrs` ger varje fält dess nyckel. */
export function buildingFields(m: Material, attrs: (key: string) => string, style: StyleResources | undefined): string {
  const cut = patternValue(m.cut);
  const surface = patternValue(m.surface);
  const color = (key: string, f: Record<string, unknown> | undefined) => `<label class="field"><span>Färg</span><input type="color" ${attrs(key)} value="${escapeHtml(typeof f?.fillColor === 'string' ? f.fillColor : FILL_COLOR)}"></label>`;
  const pen = m.pen?.weight ?? 0;
  const penOpts = [`<option value=""${pen ? '' : ' selected'}>Stilbokens</option>`, ...currentWeights().map((w) => `<option value="${w}"${w === pen ? ' selected' : ''}>${w.toLocaleString('sv-SE')} mm</option>`)].join('');
  return `<div class="fields">
    <label class="field"><span>Snittet i sektion</span><select ${attrs('matCut')}>${patternOptions(cut, 'Som stilboken', style)}</select></label>${cut ? color('matCutColor', m.cut) : ''}
    <label class="field"><span>Ytan i fasad</span><select ${attrs('matSurface')}>${patternOptions(surface, 'Ingen', style)}</select></label>${surface ? color('matSurfaceColor', m.surface) : ''}
    <label class="field"><span>Konturen i planen</span><select ${attrs('matPen')}>${penOpts}</select></label>${pen ? `<label class="field"><span>Konturens färg</span><input type="color" ${attrs('matPenColor')} value="${escapeHtml(m.pen?.color ?? '#1d2328')}"></label>` : ''}
  </div>`;
}

/** Ett nytt mönster: de andra måtten behålls, färgen och opaciteten följer med. */
function withPattern(f: Record<string, unknown> | undefined, value: string): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const base = { fillColor: '#1d2328', fillOpacity: 100, ...(f ?? {}) } as Record<string, unknown>;
  if (value.startsWith('type:')) return { ...base, fill: 'type', fillType: value.slice(5) };
  const out: Record<string, unknown> = { ...base, fill: value };
  delete out.fillType;
  if (value === 'solid' && !f?.fill) out.fillColor = '#9aa0a6';
  return out;
}

/** Ändringen av materialet för fältet, och ångra-texten; null när fältet inte hör hit eller värdet inte går att använda. */
export function buildingChange(m: Material, key: string, value: string): { label: string; fn: (q: Material) => Material } | null {
  const hex = /^#[0-9a-f]{6}$/i.test(value);
  const drop = (q: Material, k: 'cut' | 'surface' | 'pen', v: unknown): Material => {
    const out = { ...q } as Record<string, unknown>;
    if (v === undefined) delete out[k];
    else out[k] = v;
    return out as unknown as Material;
  };
  switch (key) {
    case 'matCut':
      return { label: `Snittet: ${m.name}`, fn: (q) => drop(q, 'cut', withPattern(q.cut, value)) };
    case 'matSurface':
      return { label: `Ytan i fasad: ${m.name}`, fn: (q) => drop(q, 'surface', withPattern(q.surface, value)) };
    case 'matCutColor':
      return hex ? { label: `Snittets färg: ${m.name}`, fn: (q) => (q.cut ? { ...q, cut: { ...q.cut, fillColor: value } } : q) } : null;
    case 'matSurfaceColor':
      return hex ? { label: `Ytans färg: ${m.name}`, fn: (q) => (q.surface ? { ...q, surface: { ...q.surface, fillColor: value } } : q) } : null;
    case 'matPen': {
      const w = Number(value.replace(',', '.'));
      return { label: `Konturen i planen: ${m.name}`, fn: (q) => drop(q, 'pen', w > 0 ? { ...(q.pen?.color ? { color: q.pen.color } : {}), weight: w } : undefined) };
    }
    case 'matPenColor':
      return hex ? { label: `Konturens färg: ${m.name}`, fn: (q) => (q.pen ? { ...q, pen: { ...q.pen, color: value } } : q) } : null;
  }
  return null;
}
