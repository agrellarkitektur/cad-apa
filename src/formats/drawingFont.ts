import { winAnsi } from './helvetica';
import { OSIFONT_WIDTHS } from './osifontWidths';

/**
 * Ritningens typsnitt (0.8.18): osifont (ISO 3098,
 * https://github.com/hikikomori82/osifont). Samma bredder används för att
 * bryta och mäta texter, på skärmen och i PDF:en, där typsnittet bäddas in.
 * Fet text är samma typsnitt med ett tunt streck runt tecknen.
 */

/** Tecken i WinAnsi som osifont saknar, och vad som skrivs i stället. */
const SUBSTITUTES: Record<string, string> = {
  '‚': ',', '„': '"', '…': '...', '†': '+', '‡': '+', 'ˆ': '^', '‹': '<', '›': '>',
  '‘': '’', '“': '"', '”': '"', '˜': '~', '¥': 'Y', '¦': '|', '¨': '"', 'ª': 'a',
  '¬': '-', '­': '-', '¯': '-', '¸': ',', 'º': 'o',
};
const SUB_RE = new RegExp(`[${Object.keys(SUBSTITUTES).join('')}]`, 'g');

/** Texten med de tecken osifont saknar utbytta. */
export function drawingText(text: string): string {
  return text.replace(SUB_RE, (c) => SUBSTITUTES[c]);
}

/** Texten som WinAnsi-byte för PDF:en. */
export function drawingBytes(text: string): number[] {
  return winAnsi(drawingText(text));
}

/** Textens bredd i mm med osifont. Fet text är lika bred. */
export function textWidth(text: string, height: number, _bold = false): number {
  let sum = 0;
  for (const b of drawingBytes(text)) sum += OSIFONT_WIDTHS[b - 32] || 465;
  return (sum / 1000) * height;
}
