import { PATTERN_LABELS, type FillPattern } from '../elements/drawing2d';
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
export function patternPicker(name: string, current: FillPattern | 'none', attrs: string, look: { color?: string; angle?: number } = {}): string {
  const all: [FillPattern | 'none', string][] = [['none', 'Ingen fyllning'], ...(Object.entries(PATTERN_LABELS) as [FillPattern, string][])];
  return `<div class="pattern-pick" role="radiogroup" aria-label="Fyllning">${all
    .map(
      ([k, label]) =>
        `<label title="${label}"><input type="radio" name="${name}" value="${k}" ${attrs}${k === current ? ' checked' : ''}>${patternSwatch(k, look.color, look.angle)}<span>${label}</span></label>`,
    )
    .join('')}</div>`;
}
