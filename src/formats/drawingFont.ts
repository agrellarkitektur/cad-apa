import { winAnsi } from './helvetica';
import { fontOf, OSIFONT, type DrawingFontInfo } from './fonts';

/**
 * Ritningens typsnitt (0.8.18, valbart sedan 0.12): osifont (ISO 3098,
 * https://github.com/hikikomori82/osifont) som förval, eller det som valts i
 * stilboken (`src/formats/fonts.ts`). Samma bredder används för att bryta och
 * mäta texter, på skärmen och i PDF:en, där typsnittet bäddas in. Fet text är
 * samma typsnitt med ett tunt streck runt tecknen.
 *
 * Typsnittet som mäter är det som valdes senast med `useDrawingFont`
 * (planen och sektionerna väljer projektets innan de ritar).
 */

let active: DrawingFontInfo = OSIFONT;

/** Mät med projektets typsnitt. Billig när det redan är valt. */
export function useDrawingFont(doc: Parameters<typeof fontOf>[0]): DrawingFontInfo {
  active = fontOf(doc);
  return active;
}

/** Typsnittet som mäter just nu. */
export const activeDrawingFont = (): DrawingFontInfo => active;

/** Tecken i WinAnsi som ett typsnitt kan sakna, och vad som skrivs i stället. */
const SUBSTITUTES: Record<string, string> = {
  '‚': ',', '„': '"', '…': '...', '†': '+', '‡': '+', 'ˆ': '^', '‹': '<', '›': '>',
  '‘': '’', '“': '"', '”': '"', '˜': '~', '¥': 'Y', '¦': '|', '¨': '"', 'ª': 'a',
  '¬': '-', '­': '-', '¯': '-', '¸': ',', 'º': 'o',
};
const SUB_RE = new RegExp(`[${Object.keys(SUBSTITUTES).join('')}]`, 'g');

/** Texten med de tecken typsnittet saknar utbytta. */
export function drawingText(text: string, font: DrawingFontInfo = active): string {
  return text.replace(SUB_RE, (c) => {
    const b = winAnsi(c)[0];
    return font.metrics.widths[b - 32] ? c : SUBSTITUTES[c];
  });
}

/** Texten som WinAnsi-byte för PDF:en. */
export function drawingBytes(text: string, font: DrawingFontInfo = active): number[] {
  return winAnsi(drawingText(text, font));
}

/** Textens bredd i mm med typsnittet. Fet text är lika bred. */
export function textWidth(text: string, height: number, _bold = false, font: DrawingFontInfo = active): number {
  const w = font.metrics.widths;
  let sum = 0;
  for (const b of drawingBytes(text, font)) sum += w[b - 32] || 465;
  return (sum / 1000) * height;
}
