import { PATTERN_LABELS, type FillPattern } from '../elements/drawing2d';
import { drawnDash, evenDash, hatchStrokes, patternLines, type CustomFillType, type FillTypeDef } from '../core/fillTypes';
import { escapeHtml } from './labels';

/**
 * Mönstret som en liten bild (0.8.11): hel fyllning, skraffering eller
 * korsskraffering i fyllningens färg och vinkel. En inbäddad svg klipper
 * linjerna vid kanten av sig själv.
 */
export function patternSwatch(pattern: FillPattern | 'none', color = '#9aa0a6', angle = 45): string {
  const c = escapeHtml(color);
  // Ingen fyllning (0.8.19): ett snett streck genom rutan.
  if (pattern === 'none')
    return `<svg class="pattern-swatch" viewBox="0 0 22 16" width="22" height="16" aria-hidden="true"><line x1="2" y1="14" x2="20" y2="2" class="pattern-edge"/><rect x="0.5" y="0.5" width="21" height="15" fill="none" class="pattern-edge"/></svg>`;
  // Mask (0.8.30): ritningens bakgrund, med en streckad kant.
  if (pattern === 'mask')
    return `<svg class="pattern-swatch" viewBox="0 0 22 16" width="22" height="16" aria-hidden="true"><rect x="0.5" y="0.5" width="21" height="15" class="pattern-mask" stroke-dasharray="2 1.5"/></svg>`;
  const lines = (a: number) =>
    `<g transform="rotate(${-a} 11 8)">${Array.from({ length: 13 }, (_, i) => `<line x1="-12" x2="34" y1="${-16 + i * 4}" y2="${-16 + i * 4}"/>`).join('')}</g>`;
  const body = pattern === 'solid' ? `<rect width="22" height="16" fill="${c}"/>` : lines(angle) + (pattern === 'cross' ? lines(angle + 90) : '');
  return `<svg class="pattern-swatch" viewBox="0 0 22 16" width="22" height="16" aria-hidden="true"><g stroke="${c}" stroke-width="1">${body}</g><rect x="0.5" y="0.5" width="21" height="15" fill="none" class="pattern-edge"/></svg>`;
}

/**
 * Val av mönster med förhandsvisning bredvid namnet: en radioknapp per
 * mönster och en för ingen fyllning (0.8.19), så att valet går genom samma
 * change-händelse som en lista.
 * `attrs` läggs på varje knapp (t.ex. `data-key="d2:pattern"`).
 */
export function patternPicker(name: string, current: FillPattern | 'none', attrs: string, look: { color?: string; angle?: number; types?: readonly CustomFillType[]; type?: string } = {}): string {
  const all: [FillPattern | 'none', string][] = [['none', 'Ingen fyllning'], ...(Object.entries(PATTERN_LABELS) as [FillPattern, string][]).filter(([k]) => k !== 'type')];
  const own = (look.types ?? []).map(
    (t) =>
      `<label title="${escapeHtml(t.name)}"><input type="radio" name="${name}" value="type:${escapeHtml(t.id)}" ${attrs}${current === 'type' && look.type === t.id ? ' checked' : ''}>${fillTypeSwatch(t, look.color)}<span>${escapeHtml(t.name)}</span></label>`,
  );
  return `<div class="pattern-pick" role="radiogroup" aria-label="Fyllning">${all
    .map(
      ([k, label]) =>
        `<label title="${label}"><input type="radio" name="${name}" value="${k}" ${attrs}${k === current ? ' checked' : ''}>${patternSwatch(k, look.color, look.angle)}<span>${label}</span></label>`,
    )
    .join('')}${own.join('')}</div>`;
}

/**
 * En egen fyllningstyp som en liten bild (0.8.36): familjerna med sina
 * streck, förstorade så att de tätaste linjerna ligger ungefär 3,5 px isär.
 */
export function fillTypeSwatch(t: FillTypeDef, color = '#9aa0a6', w = 22, h = 16): string {
  const c = escapeHtml(color);
  const min = Math.min(...t.families.map((f) => f.spacing).filter((x) => x > 0));
  const k = Number.isFinite(min) ? Math.max(0.02, Math.min(20, 3.5 / min)) : 1;
  const parts: string[] = [];
  for (const l of patternLines({ ...t, model: false }, 0, k)) {
    const drawn = evenDash(l.dash) && drawnDash(evenDash(l.dash)!);
    for (const s of hatchStrokes(l, { minX: 0, minY: 0, maxX: w, maxY: h }, 60)) {
      const dash = drawn ? ` stroke-dasharray="${drawn.dash.map((d) => Math.round(d * 100) / 100).join(' ')}" stroke-dashoffset="${Math.round(s.phase * 100) / 100}"${drawn.round ? ' stroke-linecap="round"' : ''}` : '';
      parts.push(`<line x1="${s.a[0].toFixed(2)}" y1="${(h - s.a[1]).toFixed(2)}" x2="${s.b[0].toFixed(2)}" y2="${(h - s.b[1]).toFixed(2)}"${dash}/>`);
    }
  }
  return `<svg class="pattern-swatch" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><g stroke="${c}" stroke-width="1">${parts.join('')}</g><rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" fill="none" class="pattern-edge"/></svg>`;
}

/** Värdet i mönsterväljaren som fyllning: `type:nyckel` blir en egen fyllningstyp (0.8.36). */
export function patternValue(v: string): { fill?: FillPattern; fillType?: string } {
  if (v.startsWith('type:')) return { fill: 'type', fillType: v.slice(5) };
  return v === 'none' ? {} : { fill: v as FillPattern };
}

export type { CustomFillType };
