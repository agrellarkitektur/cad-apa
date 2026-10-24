import type { Vec2 } from '../../repr/primitives';
import { escapeHtml } from '../labels';
import type { Prompt, PromptOption } from './prompts';

/**
 * Texten på raden under smartshell (0.8.20–0.8.21; ur commandLine.ts i
 * 0.8.23): frågan med alternativen i hakparentes och hjälpen för punkter.
 */

export const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 });
export const xy = (p: Vec2): string => `${nf.format(p[0])}; ${nf.format(p[1])}`;
export const POINT_HELP = 'Skriv <b>2400</b>, <b>@1200,600</b>, <b>@3000&lt;45</b> eller <b>x,y</b>.';

/** Ett alternativ med sin bokstav understruken: [Avsluta/Stäng/Ångra]. */
export function optionMarkup(o: PromptOption, i: number): string {
  const k = o.key.toLowerCase();
  const label = o.label.toLowerCase().startsWith(k) ? `<u>${escapeHtml(o.label.slice(0, k.length))}</u>${escapeHtml(o.label.slice(k.length))}` : `${escapeHtml(o.label)} <u>${escapeHtml(o.key)}</u>`;
  return `<button type="button" class="ss-opt" data-opt="${i}"${o.on ? ' aria-pressed="true"' : ''} title="Skriv ${escapeHtml(o.key)} eller klicka">${label}</button>`;
}

/** Frågan: verktygets namn, vad det vill ha och alternativen; med punkthjälpen när den passar. */
export function promptMarkup(p: Prompt, withPointHelp: boolean): string {
  const opts = p.options.length ? ` <span class="ss-opts">[${p.options.map(optionMarkup).join('/')}]</span>` : '';
  const help = withPointHelp && !p.options.length ? ` ${POINT_HELP}` : '';
  return `<b class="ss-head">${escapeHtml(p.head)}:</b> ${escapeHtml(p.text)}${opts}${help}`;
}
