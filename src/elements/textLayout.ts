import { textWidth } from '../formats/helvetica';
import type { Vec2 } from '../repr/primitives';

/**
 * Textrutor (0.8.9): radbrytning och placering av fri text. Raderna bryts
 * vid ord med Helveticas bredder (`textWidth`), samma som PDF:en skriver
 * med, så att skärmen och utskriften bryter på samma ställen.
 *
 * Allt räknas först på papperet (mm, texthöjden) och sedan gånger skalan,
 * så att en text i en vy i 1:100 får samma ruta på papperet som på ett blad.
 */

/** Radavståndet, gånger texthöjden, som för fri text i vyerna. */
export const LINE_STEP = 1.5;
/** Hur långt under baslinjen texten når (gemener med nedstapel), gånger texthöjden. */
const DESCENT = 0.3;

export type TextAlign = 'start' | 'middle' | 'end';
/** Var textens punkt ligger i höjdled: på första radens baslinje (förval) eller i rutans över-, mitt- eller underkant. */
export type TextAnchor = 'top' | 'middle' | 'bottom';

export interface TextBoxInput {
  text: string;
  /** Texthöjd på papper, mm. */
  height: number;
  bold?: boolean;
  align?: TextAlign;
  anchor?: TextAnchor;
  /** Största bredd på papper, mm. Raderna bryts vid ord. */
  maxWidth?: number;
  /** Största höjd på papper, mm. Ryms texten inte visas en markering på skärmen. */
  maxHeight?: number;
}

/** En text uppdelad i rader och placerad i sitt eget system: x längs raden från punkten, y uppåt, mm på papperet. */
export interface TextLayout {
  lines: string[];
  /** Varje rads baslinje i höjdled. */
  baselines: number[];
  /** Ytan texten tar (x0, y0, x1, y1). */
  extent: [number, number, number, number];
  /** Rutan (om den har bredd eller höjd). */
  box: [number, number, number, number] | null;
  /** Texten ryms inte i rutans höjd. */
  overflow: boolean;
}

/** Bryt en rad vid ord så att den ryms i `width`. Ett ord som är längre än rutan bryts mitt i. */
export function wrapLine(line: string, width: number, height: number, bold = false): string[] {
  if (textWidth(line, height, bold) <= width) return [line];
  const out: string[] = [];
  let cur = '';
  const fits = (s: string) => textWidth(s, height, bold) <= width;
  for (const word of line.split(/ +/)) {
    const next = cur ? `${cur} ${word}` : word;
    if (fits(next)) {
      cur = next;
      continue;
    }
    if (cur) out.push(cur);
    cur = word;
    // Ett ord som inte ryms på en egen rad bryts tecken för tecken.
    while (!fits(cur) && cur.length > 1) {
      let n = cur.length - 1;
      while (n > 1 && !fits(cur.slice(0, n))) n--;
      out.push(cur.slice(0, n));
      cur = cur.slice(n);
    }
  }
  out.push(cur);
  return out;
}

/** Textens rader: radbrytningarna i texten och, med en största bredd, bryten vid ord. */
export function textLines(t: Pick<TextBoxInput, 'text' | 'height' | 'bold' | 'maxWidth'>): string[] {
  const raw = String(t.text).split('\n');
  return t.maxWidth && t.maxWidth > 0 ? raw.flatMap((l) => wrapLine(l, t.maxWidth!, t.height, t.bold)) : raw;
}

/** Placera texten kring sin punkt, i mm på papperet. */
export function layoutText(t: TextBoxInput): TextLayout {
  const h = t.height;
  const step = h * LINE_STEP;
  const lines = textLines(t);
  const n = lines.length;
  // Från första radens överkant till sista radens nedstaplar.
  const blockH = h + (n - 1) * step + DESCENT * h;
  const W = t.maxWidth && t.maxWidth > 0 ? t.maxWidth : 0;
  const H = t.maxHeight && t.maxHeight > 0 ? t.maxHeight : 0;
  let top: number;
  switch (t.anchor) {
    case 'top':
      top = 0;
      break;
    case 'middle':
      top = blockH / 2;
      break;
    case 'bottom':
      top = blockH;
      break;
    default:
      top = h;
  }
  const baselines = lines.map((_, i) => top - h - i * step);
  const textW = Math.max(h * 0.5, ...lines.map((l) => textWidth(l, h, t.bold)));
  const xOf = (w: number): [number, number] => (t.align === 'middle' ? [-w / 2, w / 2] : t.align === 'end' ? [-w, 0] : [0, w]);
  const [tx0, tx1] = xOf(textW);
  const extent: [number, number, number, number] = [tx0, top - blockH, tx1, top];
  let box: TextLayout['box'] = null;
  if (W || H) {
    const [bx0, bx1] = W ? xOf(W) : [tx0, tx1];
    // Utan förankring står rutan som om texten var förankrad i överkant.
    const bTop = H ? (t.anchor === 'middle' ? H / 2 : t.anchor === 'bottom' ? H : t.anchor === 'top' ? 0 : top) : top;
    box = [bx0, bTop - (H || blockH), bx1, bTop];
  }
  return { lines, baselines, extent, box, overflow: !!H && blockH > H + 1e-6 };
}

/** Ett hörn i textens eget system i modellen: punkten, vridningen och skalan. */
export function textPoint(pos: Vec2, angleRad: number, scale: number, x: number, y: number): Vec2 {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return [pos[0] + (x * c - y * s) * scale, pos[1] + (x * s + y * c) * scale];
}

/** Byt ut `{namn}` mot värdet (smarttext eller fält). Namn utan värde blir tomma. */
export function expandSmartText(text: string, vars: Readonly<Record<string, string>>): string {
  // Allt inom klamrar är smarttext eller ett fält (0.8.10); ett fält utan värde blir tomt.
  return text.replace(/\{([^{}]+)\}/g, (m, name: string) => {
    const k = name.trim().replace(/\s+/g, ' ').toLowerCase();
    return k ? (Object.hasOwn(vars, k) ? vars[k] : '') : m;
  });
}
