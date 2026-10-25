/**
 * Text i DXF (TEXT och MTEXT, 0.8.11; egen fil 0.8.32): formateringskoder
 * och specialtecken, och var raderna hamnar efter justering och fästpunkt.
 */

import { num, str, type P2, type RawEntity } from './dxfCodes';
import { textWidth } from './helvetica';

/** Versalhöjden (som DXF mäter texthöjd i) som andel av teckenstorleken i Helvetica och Arial. */
export const DXF_CAP_HEIGHT = 0.72;

/** Styckets justering i MTEXT (\pxqc; m.fl.), eller null om texten inte anger någon. */
function paragraphAlign(s: string): 'start' | 'middle' | 'end' | null {
  const m = /\\p[^;]*?q([lcr])[^;]*;/.exec(s);
  return m ? ({ l: 'start', c: 'middle', r: 'end' } as const)[m[1] as 'l' | 'c' | 'r'] : null;
}

/** Specialtecken som skrivs med %% i både TEXT och MTEXT. */
function percentCodes(s: string): string {
  return s
    .replace(/%%[cC]/g, 'Ø')
    .replace(/%%[dD]/g, '°')
    .replace(/%%[pP]/g, '±')
    .replace(/%%[uUoOkK]/g, '')
    .replace(/%%(\d{3})/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/%%%/g, '%');
}

/** Tecken skrivna som \U+00E5 (äldre DXF), i både TEXT och MTEXT. */
function unicodeCodes(s: string): string {
  return s.replace(/\\U\+([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

/** TEXT: en rad, bara specialtecknen tolkas. */
function textLine(s: string): string {
  return percentCodes(unicodeCodes(s)).trim();
}

/**
 * MTEXT: formateringskoderna tolkas bort (typsnitt, höjd, färg, stycken som
 * \pxql; …), och texten delas i rader vid \P. Staplade bråk (\S1/2;) blir
 * 1/2, och {} som grupperar formatering försvinner.
 */
export function mtextLines(s: string): string[] {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length) {
      const k = s[i + 1];
      if (k === 'P' || k === 'X' || k === 'N') {
        out += '\n';
        i++;
      } else if (k === '~') {
        out += ' ';
        i++;
      } else if (k === '\\' || k === '{' || k === '}') {
        out += k;
        i++;
      } else if ('LlOoKk'.includes(k)) i++;
      else if (k === 'U' && /^\+[0-9a-fA-F]{4}$/.test(s.slice(i + 2, i + 7))) {
        out += String.fromCharCode(parseInt(s.slice(i + 3, i + 7), 16));
        i += 6;
      } else if ('SACFHQTWacfhqtwp'.includes(k) && s.indexOf(';', i) > 0) {
        const end = s.indexOf(';', i);
        if (k === 'S') out += s.slice(i + 2, end).replace(/[#^]/g, '/');
        i = end;
      }
      // Okända koder: bara snedstrecket försvinner.
      continue;
    }
    if (c === '{' || c === '}') continue;
    if (c === '^' && i + 1 < s.length) {
      const k = s[i + 1];
      out += k === 'J' || k === 'M' ? '\n' : k === 'I' ? ' ' : '^';
      i++;
      continue;
    }
    out += c;
  }
  return percentCodes(out)
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim());
}

const H_ALIGN = ['start', 'middle', 'end'] as const;

/**
 * Var textens rader hamnar: radernas baslinjer i filens koordinater (före
 * blockets avbildning) och justeringen längs raden. TEXT har justeringen i
 * 72 (vänster, mitt, höger, mellan två punkter, mitten, anpassad) och 73
 * (baslinje, nederkant, mitt, överkant) med punkten i 11/21; MTEXT har sin
 * fästpunkt i 71 (1–9, uppe till vänster till nere till höger).
 */
export function textPlacement(e: RawEntity): { lines: string[]; points: P2[]; angle: number; height: number; align: 'start' | 'middle' | 'end' } | null {
  let para: 'start' | 'middle' | 'end' | null = null;
  const h = num(e, 40, 2.5);
  const p10: P2 = [num(e, 10), num(e, 20)];
  const has11 = e.codes.some((x) => x[0] === 11);
  let lines: string[];
  let angle = num(e, 50);
  let at = p10;
  let hor = 0;
  let ver: 'baseline' | 'bottom' | 'middle' | 'top' = 'baseline';
  let spacing = h * (5 / 3);
  if (e.type === 'MTEXT') {
    const raw = [...e.codes.filter((x) => x[0] === 3).map((x) => x[1]), str(e, 1)].join('');
    lines = mtextLines(raw);
    para = paragraphAlign(raw);
    // MTEXT kan ha riktningen som vektor (11/21) i stället för vinkel.
    if (has11) angle = (Math.atan2(num(e, 21), num(e, 11)) * 180) / Math.PI;
    const ap = Math.min(9, Math.max(1, num(e, 71, 1)));
    hor = (ap - 1) % 3;
    ver = ap <= 3 ? 'top' : ap <= 6 ? 'middle' : 'bottom';
    spacing *= num(e, 44, 1) || 1;
    // Tomma rader i slutet påverkar inte placeringen.
    while (lines.length && !lines.at(-1)) lines.pop();
  } else {
    lines = [textLine(str(e, 1))];
    const h72 = num(e, 72);
    const v73 = num(e, 73);
    if (has11 && (h72 || v73)) {
      const p11: P2 = [num(e, 11), num(e, 21)];
      if (h72 === 3 || h72 === 5) {
        // Mellan två punkter på baslinjen: mitt emellan, i deras riktning.
        at = [(p10[0] + p11[0]) / 2, (p10[1] + p11[1]) / 2];
        hor = 1;
        if (Math.hypot(p11[0] - p10[0], p11[1] - p10[1]) > 1e-9) angle = (Math.atan2(p11[1] - p10[1], p11[0] - p10[0]) * 180) / Math.PI;
      } else if (h72 === 4) {
        at = p11;
        hor = 1;
        ver = 'middle';
      } else {
        at = p11;
        hor = Math.min(2, h72);
        ver = (['baseline', 'bottom', 'middle', 'top'] as const)[Math.min(3, v73)];
      }
    }
  }
  if (!lines.some((l) => l)) return null;
  // Första radens baslinje räknat uppåt från punkten. Nederkant är under
  // de nedre staplarna (g, p), ungefär 0,3 av versalhöjden under baslinjen.
  const n = lines.length;
  const total = h + (n - 1) * spacing;
  const first = ver === 'top' ? -h : ver === 'middle' ? total / 2 - h : ver === 'bottom' ? (n - 1) * spacing + 0.3 * h : 0;
  const a = (angle * Math.PI) / 180;
  const up: P2 = [-Math.sin(a), Math.cos(a)];
  const along: P2 = [Math.cos(a), Math.sin(a)];
  // MTEXT med flera rader och ett eget styckesjusterat (\pxql;): blocket
  // fästs efter sin bredeste rad, och raderna justeras inom blocket.
  let shift = 0;
  let align = H_ALIGN[hor];
  if (para && para !== align && lines.length > 1) {
    const em = h / DXF_CAP_HEIGHT;
    const width = Math.max(...lines.map((l) => textWidth(l, em)));
    const k = { start: 0, middle: 0.5, end: 1 };
    shift = (k[para] - k[align]) * width;
    align = para;
  }
  const points = lines.map((_, i): P2 => {
    const k = first - i * spacing;
    return [at[0] + up[0] * k + along[0] * shift, at[1] + up[1] * k + along[1] * shift];
  });
  return { lines, points, angle, height: h, align };
}
