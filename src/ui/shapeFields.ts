import { updateParams } from '../core/commands';
import type { Element, Id, ProjectDoc } from '../core/model';
import type { DocStore } from '../core/store';
import { BACKGROUND_COLOR, CAP_LABELS, CAP_SIZE, FILL_BACKGROUND, FILL_COLOR, PATH_LABELS, segmentCount, type CapKind, type Shape2DParams } from '../elements/drawing2d';
import { resolveParams } from '../elements/registry';
import { STRAIGHT } from '../geometry/arc';
import { lineTypeOptions } from './lineTypePick';
import { patternPicker } from './patternPick';
import { weightPicker } from './weightPick';

/**
 * 2D-formens fält (0.8.19–0.8.24): penna, linjetyp, färg, ändar, fyllning
 * och opacitet, i egenskaperna, i smartmenyn och (fyllningen) i verktyget.
 * Utbrutet ur drawingPanel.ts i 0.8.27.
 */

const comma = (n: number) => n.toLocaleString('sv-SE');

/**
 * Fyllningens fält (0.8.19): mönstret (eller ingen), färgen och för en
 * skraffering vinkel och avstånd. Samma fält i verktyget och i egenskaperna.
 */
export function fillFields(name: string, p: Pick<Shape2DParams, 'fill' | 'fillColor' | 'fillAngle' | 'fillSpacing' | 'fillBackground' | 'fillBackgroundOpacity'>, attrs: (key: string) => string): string {
  const color = p.fillColor ?? FILL_COLOR;
  const hatched = p.fill === 'hatch' || p.fill === 'cross';
  // Masken (0.8.30) har ingen egen färg.
  const more =
    p.fill === 'mask'
      ? '<p class="note">Masken döljer det som ligger under och syns som ritningens bakgrund (papperet i PDF:en).</p>'
      : p.fill
        ? `<div class="fields"><label class="field"><span>Färg</span><input type="color" ${attrs('fillColor')} value="${color}"></label>
    ${hatched ? hatchFields(p, attrs) : ''}</div>
    ${hatched ? backgroundFields({ fillBackground: p.fillBackground, fillBackgroundOpacity: p.fillBackgroundOpacity }, attrs) : ''}`
        : '';
  return `<div class="field-label">Fyllning</div>${patternPicker(name, p.fill ?? 'none', attrs('pattern'), { color, angle: p.fillAngle })}${more}`;
}

/** Skrafferingens vinkel och avstånd; också direkt i smartmenyn (0.8.22). Null = olika i markeringen. */
export function hatchFields(p: { fillAngle: number | null; fillSpacing: number | null }, attrs: (key: string) => string): string {
  const v = (n: number | null) => (n === null ? '' : comma(n));
  const mixed = (n: number | null) => (n === null ? ' placeholder="Olika"' : '');
  return `<label class="field"><span>Vinkel</span><span class="input-unit"><input type="text" data-expr data-unit="deg" inputmode="decimal" autocomplete="off" ${attrs('fillAngle')} value="${v(p.fillAngle)}"${mixed(p.fillAngle)}><i>°</i></span></label>
    <label class="field"><span>Avstånd på papper</span><span class="input-unit"><input type="text" data-expr inputmode="decimal" autocomplete="off" ${attrs('fillSpacing')} value="${v(p.fillSpacing)}"${mixed(p.fillSpacing)}><i>mm</i></span></label>`;
}

/**
 * Skrafferingens bakgrund (0.8.29): en kryssruta, och när den är på färgen
 * och opaciteten. Null = olika i markeringen (för smartmenyn).
 */
export function backgroundFields(p: { fillBackground?: string | null; fillBackgroundOpacity?: number | null }, attrs: (key: string) => string): string {
  const on = p.fillBackground !== undefined;
  const mixed = p.fillBackground === null;
  const op = p.fillBackgroundOpacity === null ? NaN : (p.fillBackgroundOpacity ?? 100);
  const box = `<label class="check"><input type="checkbox" ${attrs('fillBackgroundOn')}${on && !mixed ? ' checked' : ''}${mixed ? ' title="Olika"' : ''}> Bakgrund</label>`;
  if (!on) return box;
  // Masken (0.8.30, förval) eller en egen färg.
  const mask = p.fillBackground === FILL_BACKGROUND;
  const kind = `<label class="field"><span>Bakgrund</span><select ${attrs('fillBackgroundKind')}>${mixed ? '<option selected disabled>Olika</option>' : ''}<option value="mask"${mask ? ' selected' : ''}>Mask</option><option value="color"${!mask && !mixed ? ' selected' : ''}>Egen färg</option></select></label>`;
  const colorField = mask || mixed ? '' : `<label class="field"><span>Bakgrundens färg</span><input type="color" ${attrs('fillBackground')} value="${p.fillBackground}"></label>`;
  return `${box}<div class="fields">${kind}${colorField}
    <label class="field"><span>Bakgrundens opacitet</span><span class="input-unit"><input type="text" data-expr data-unit="" data-step="10" inputmode="decimal" autocomplete="off" ${attrs('fillBackgroundOpacity')} value="${Number.isFinite(op) ? Math.round(op) : ''}"${Number.isFinite(op) ? '' : ' placeholder="Olika"'}><i>%</i></span></label></div>`;
}

/**
 * Fälten som smartmenyn visar direkt för markerade 2D-former (0.8.22):
 * fyllningens färg (0.8.28), skrafferingens vinkel och avstånd och opaciteten. Värden som skiljer sig
 * mellan formerna står tomma. Null när det inte finns något att visa.
 */
export function shapeSmartFields(doc: ProjectDoc, els: Element[]): string | null {
  if (!els.length || !els.every((e) => e.type === 'Shape2D')) return null;
  const ps = els.map((e) => resolveParams<Shape2DParams>(doc, e));
  const same = <K extends keyof Shape2DParams>(k: K): Shape2DParams[K] | null => (ps.every((q) => q[k] === ps[0][k]) ? ps[0][k] : null);
  const attrs = (k: string) => `data-key="d2:${k}"`;
  const parts: string[] = [];
  // Fyllningens färg (0.8.28), när alla har en fyllning; tom ruta = olika.
  const color = ps.every((q) => q.fill && q.fill !== 'mask') ? (ps.every((q) => (q.fillColor ?? FILL_COLOR) === (ps[0].fillColor ?? FILL_COLOR)) ? (ps[0].fillColor ?? FILL_COLOR) : null) : undefined;
  const colorField = color === undefined ? '' : `<label class="field"><span>Fyllningens färg</span><input type="color" ${attrs('fillColor')} value="${color ?? FILL_COLOR}"${color === null ? ' title="Olika"' : ''}></label>`;
  const hatch = ps.every((q) => q.fill === 'hatch' || q.fill === 'cross') ? hatchFields({ fillAngle: same('fillAngle'), fillSpacing: same('fillSpacing') }, attrs) : '';
  if (colorField || hatch) parts.push(`<div class="fields">${colorField}${hatch}</div>`);
  // Bakgrunden (0.8.29), när alla är skrafferade.
  if (hatch) {
    const backs = ps.map((q) => q.fillBackground);
    const back = backs.every((b) => b === backs[0]) ? backs[0] : backs.some((b) => b) ? null : undefined;
    parts.push(backgroundFields({ fillBackground: back, fillBackgroundOpacity: ps.every((q) => q.fillBackgroundOpacity === ps[0].fillBackgroundOpacity) ? ps[0].fillBackgroundOpacity : null }, attrs));
  }
  // Ändarna (0.8.24), när alla är öppna och har en linje.
  if (ps.every((q) => !q.closed && q.weight > 0)) {
    const cap = (k: 'startCap' | 'endCap') => (ps.every((q) => q[k] === ps[0][k]) ? ps[0][k] : null);
    parts.push(capFields({ startCap: cap('startCap'), endCap: cap('endCap'), capSize: ps.every((q) => (q.capSize ?? CAP_SIZE) === (ps[0].capSize ?? CAP_SIZE)) ? ps[0].capSize : null }, attrs));
  }
  if (ps.some((q) => q.weight > 0 || q.fill)) {
    const linked = ps.every((q) => q.fillOpacity === undefined) ? undefined : ps.every((q) => q.fillOpacity !== undefined) ? (same('fillOpacity') ?? NaN) : NaN;
    parts.push(opacityFields({ weight: ps.some((q) => q.weight > 0) ? 1 : 0, fill: ps.find((q) => q.fill)?.fill, opacity: same('opacity') ?? (ps.every((q) => q.opacity === undefined) ? undefined : NaN), fillOpacity: linked }, attrs));
  }
  return parts.length ? parts.join('') : null;
}

/**
 * Opaciteten (0.8.22): för linjen och fyllningen tillsammans, eller var för
 * sig. Tillsammans är förvalt; då styr `opacity` båda och `fillOpacity`
 * saknas. Med bara linje eller bara fyllning visas ett fält.
 */
export function opacityFields(p: Pick<Shape2DParams, 'weight' | 'fill' | 'opacity' | 'fillOpacity'>, attrs: (key: string) => string): string {
  const linked = p.fillOpacity === undefined;
  const line = p.opacity ?? 100;
  const fill = p.fillOpacity ?? line;
  const field = (key: string, label: string, v: number) =>
    `<label class="field"><span>${label}</span><span class="input-unit"><input type="text" data-expr data-unit="" data-step="10" inputmode="decimal" autocomplete="off" ${attrs(key)} value="${Number.isFinite(v) ? Math.round(v) : ''}"${Number.isFinite(v) ? '' : ' placeholder="Olika"'}><i>%</i></span></label>`;
  if (p.weight > 0 && p.fill) {
    const fields = linked ? field('opacity', 'Opacitet', line) : `${field('opacity', 'Linjens opacitet', line)}${field('fillOpacity', 'Fyllningens opacitet', fill)}`;
    return `<div class="fields">${fields}</div><label class="check"><input type="checkbox" ${attrs('opacityLinked')}${linked ? ' checked' : ''}> Samma för linje och fyllning</label>`;
  }
  if (p.fill) return `<div class="fields">${field(linked ? 'opacity' : 'fillOpacity', 'Opacitet', fill)}</div>`;
  return `<div class="fields">${field('opacity', 'Opacitet', line)}</div>`;
}

/**
 * Ändarna (0.8.24): ändformen i början och slutet och storleken på papper.
 * Null i ett värde = olika i markeringen.
 */
export function capFields(p: { startCap?: CapKind | null; endCap?: CapKind | null; capSize?: number | null }, attrs: (key: string) => string): string {
  const select = (key: string, label: string, v: CapKind | null | undefined) =>
    `<label class="field"><span>${label}</span><select ${attrs(key)}>${v === null ? '<option selected disabled>Olika</option>' : ''}<option value="none"${v === undefined ? ' selected' : ''}>Ingen</option>${(Object.entries(CAP_LABELS) as [CapKind, string][]).map(([k, l]) => `<option value="${k}"${k === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
  const size = p.capSize === null ? '' : comma(p.capSize ?? CAP_SIZE);
  const showSize = p.startCap !== undefined || p.endCap !== undefined;
  return `<div class="field-label">Ändar</div><div class="fields">${select('startCap', 'Början', p.startCap)}${select('endCap', 'Slutet', p.endCap)}
    ${showSize ? `<label class="field"><span>Storlek på papper</span><span class="input-unit"><input type="text" data-expr inputmode="decimal" autocomplete="off" ${attrs('capSize')} value="${size}"${p.capSize === null ? ' placeholder="Olika"' : ''}><i>mm</i></span></label>` : ''}</div>`;
}

/** Procent 0–100, eller null om det inte är ett tal. */
function percent(v: number): number | null {
  return Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : null;
}

/** Fälten för en 2D-form i egenskaperna. */
export function shapeFields(doc: ProjectDoc, el: Element): string {
  const p = resolveParams<Shape2DParams>(doc, el);
  const arcs = p.shape === 'spline' ? 0 : (p.bulges ?? []).slice(0, segmentCount(p.points.length, !!p.closed)).filter((b) => Math.abs(b) >= STRAIGHT).length;
  return `<div class="fields">
        <label class="field"><span>Form</span><input value="${PATH_LABELS[p.shape] ?? 'Linje'}${arcs ? ` · ${arcs} ${arcs === 1 ? 'båge' : 'bågar'}` : ''}" readonly></label>
        <div class="field"><span>Penna</span>${weightPicker('d2-weight-panel', p.weight, 'data-key="d2:weight"', ' mm')}</div>
        ${p.weight ? `<label class="field"><span>Linjetyp</span><select data-key="d2:linetype">${lineTypeOptions(doc.graphics, p.linetype)}</select></label>
        <label class="field"><span>Linjens färg</span><input type="color" data-key="d2:color" value="${p.color ?? '#1d2328'}"></label>` : ''}
      </div>
      <label class="check"><input type="checkbox" data-key="d2:closed"${p.closed ? ' checked' : ''}> Sluten</label>
      ${!p.closed && p.weight ? capFields(p, (k) => `data-key="d2:${k}"`) : ''}
      ${fillFields('d2-pattern-panel', p, (k) => `data-key="d2:${k}"`)}
      ${p.weight || p.fill ? opacityFields(p, (k) => `data-key="d2:${k}"`) : ''}
      ${p.weight === 0 && !p.fill ? '<p class="note">Formen har varken linje eller fyllning och syns inte, men går att klicka på längs linjen.</p>' : ''}
      ${p.shape === 'polyline' ? '<p class="note">Böj eller räta ut en kant med Modifiera: klicka på kanten när formen är markerad.</p>' : ''}`;
}

/** Ändringar i 2D-formens fält (`d2:…`). */
export function shapeChange(store: DocStore, ids: Id[], name: string, input: HTMLInputElement | HTMLSelectElement): boolean {
  const doc = store.doc;
  const els = ids.map((id) => doc.elements[id]).filter(Boolean);
  const v = input.value;
  const num = Number(v.replace(',', '.'));
  if (name === 'weight' && num >= 0) updateParams(store, ids, { weight: num }, num ? 'Ändra penna' : 'Ingen linje');
  else if (name === 'linetype') updateParams(store, ids, { linetype: v }, 'Ändra linjetyp');
  else if (name === 'color') updateParams(store, ids, { color: v }, 'Ändra färg');
  else if (name === 'closed') updateParams(store, ids, { closed: (input as HTMLInputElement).checked }, 'Sluten');
  else if (name === 'startCap' || name === 'endCap') updateParams(store, ids, { [name]: v === 'none' ? undefined : v }, v === 'none' ? 'Ingen ändform' : 'Ändra ändform');
  else if (name === 'capSize' && num > 0) updateParams(store, ids, { capSize: num === CAP_SIZE ? undefined : num }, 'Ändra ändarnas storlek');
  else if (name === 'pattern') updateParams(store, ids, { fill: v === 'none' ? undefined : v }, v === 'none' ? 'Ingen fyllning' : 'Ändra fyllning');
  else if (name === 'fillBackgroundOn') {
    const on = (input as HTMLInputElement).checked;
    updateParams(store, ids, on ? { fillBackground: FILL_BACKGROUND } : { fillBackground: undefined, fillBackgroundOpacity: undefined }, on ? 'Bakgrund' : 'Ingen bakgrund');
  } else if (name === 'fillBackgroundKind') updateParams(store, ids, { fillBackground: v === 'mask' ? FILL_BACKGROUND : BACKGROUND_COLOR }, v === 'mask' ? 'Bakgrunden som mask' : 'Bakgrund med egen färg');
  else if (name === 'fillBackground') updateParams(store, ids, { fillBackground: v }, 'Ändra bakgrundens färg');
  else if (name === 'fillBackgroundOpacity' && percent(num) !== null) updateParams(store, ids, { fillBackgroundOpacity: percent(num) === 100 ? undefined : percent(num) }, 'Ändra bakgrundens opacitet');
  else if (name === 'fillColor') updateParams(store, ids, { fillColor: v }, 'Ändra fyllningens färg');
  else if (name === 'fillAngle' && Number.isFinite(num)) updateParams(store, ids, { fillAngle: num }, 'Ändra vinkel');
  else if (name === 'fillSpacing' && num > 0) updateParams(store, ids, { fillSpacing: num }, 'Ändra avstånd');
  else if (name === 'opacity' && percent(num) !== null) updateParams(store, ids, { opacity: percent(num) === 100 ? undefined : percent(num) }, 'Ändra opacitet');
  else if (name === 'fillOpacity' && percent(num) !== null) updateParams(store, ids, { fillOpacity: percent(num) }, 'Ändra fyllningens opacitet');
  else if (name === 'fillLayer') updateParams(store, ids, { fillFront: v === 'front' ? true : undefined }, v === 'front' ? 'Fyllningen framför väggarna' : 'Fyllningen bakom väggarna');
  else if (name === 'lineLayer') updateParams(store, ids, { lineBehind: v === 'behind' ? true : undefined }, v === 'behind' ? 'Linjen bakom väggarna' : 'Linjen framför väggarna');
  else if (name === 'opacityLinked') {
    // Var för sig: fyllningen börjar med linjens värde, för varje form.
    const linked = (input as HTMLInputElement).checked;
    store.transact(linked ? 'Samma opacitet' : 'Opacitet var för sig', (tx) => {
      for (const el of els) tx.putElement({ ...el, params: { ...el.params, fillOpacity: linked ? undefined : (el.params.opacity ?? 100) } });
    });
  }
  return true;
}
