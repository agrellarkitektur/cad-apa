import { updateParams } from '../core/commands';
import type { Element, Id, ProjectDoc } from '../core/model';
import type { DocStore } from '../core/store';
import { CAP_LABELS, CAP_SIZE, FILL_BACKGROUND, FILL_COLOR, hasBackground, PATH_LABELS, segmentCount, type CapKind, effectiveFill, materialOf, type FillParams, type Shape2DParams } from '../elements/drawing2d';
import type { Material, StyleSheet } from '../core/graphics';
import { resolveParams } from '../elements/registry';
import { STRAIGHT } from '../geometry/arc';
import { lineTypeOptions } from './lineTypePick';
import { FILL_KEYS, fillOpacityOf, fillPanel, fillPatch, MATERIAL_3D_COLOR, withPatch, type FillPanelContext } from './fillPanel';
import { fillFieldsOf, fillOfElement, linkMaterial, materialUses, overrideMaterial, updateMaterial, withFill } from '../core/materials';
import { weightPicker } from './weightPick';

/**
 * 2D-formens fält (0.8.19–0.8.24): penna, linjetyp, färg, ändar, fyllning
 * och opacitet, i egenskaperna, i smartmenyn och (fyllningen) i verktyget.
 * Utbrutet ur drawingPanel.ts i 0.8.27.
 */

const comma = (n: number) => n.toLocaleString('sv-SE');

/**
 * Fyllningens fält (0.8.19), sedan 0.10.14 fyllningens panel (`fillPanel`):
 * samma i 2D-former, rum och markobjekt.
 */
export function fillFields(
  name: string,
  p: FillParams,
  attrs: (key: string) => string,
  style?: StyleSheet,
  title?: string,
  ctx?: FillPanelContext,
): string {
  return fillPanel(name, p, attrs, style, title, ctx);
}

/** Nycklarna för materialets illustrationsplan och 3D och objektets överstyrningar (0.10.28). */
const MATERIAL_KEYS: ReadonlySet<string> = new Set(['matIllKind', 'matIllColor', 'matIllOpacity', 'matColor3d', 'materialOpacity', 'materialAngle']);

/**
 * En ändring i fyllningens panel för objekten `ids`. Med `nested` gäller
 * den en fyllning som ligger i en egen parameter (slänternas, `slopeFill`).
 * Är det första objektet kopplat till ett material (0.10.28) ändras
 * materialet, och alla objekt med det. Svarar false när nyckeln inte hör
 * till fyllningen.
 */
export function fillChange(store: DocStore, ids: Id[], name: string, input: HTMLInputElement | HTMLSelectElement, nested?: string): boolean {
  if (name === 'material') {
    linkMaterial(store, ids, input.value || null, nested);
    return true;
  }
  if (!FILL_KEYS.has(name) && !MATERIAL_KEYS.has(name)) return false;
  const doc = store.doc;
  const first = ids.map((id) => doc.elements[id]).find(Boolean);
  if (!first) return true;
  const m = materialOf(fillOfElement(first, nested), doc.graphics);
  if (MATERIAL_KEYS.has(name)) {
    if (m) materialFieldChange(store, ids, m, name, input.value, nested);
    return true;
  }
  if (m) {
    // Materialets fyllning i planen; objekten med det följer med.
    const change = fillPatch(name, input.value, m.plan as unknown as FillParams);
    if (change) updateMaterial(store, m.id, `${change.label} (${m.name})`, (q) => ({ ...q, plan: withPatch({ ...q.plan }, change.patch) }));
    return true;
  }
  const own = (el: Element): FillParams => fillOfElement(el, nested) as FillParams;
  const change = fillPatch(name, input.value, own(first));
  if (!change) return true;
  store.transact(change.label, (tx) => {
    for (const id of ids) {
      const el = tx.doc.elements[id];
      if (!el) continue;
      const now = own(el);
      // Ett objekt i markeringen med ett material får den ändrade fyllningen som sin egen.
      const base = now.material ? fillFieldsOf(effectiveFill(now, doc.graphics)) : fillFieldsOf(now);
      const rest = nested ? Object.fromEntries(Object.entries(now).filter(([k]) => !k.startsWith('fill') && !k.startsWith('material'))) : {};
      tx.putElement(withFill(el, { ...rest, ...withPatch({ ...base }, change.patch) }, nested));
    }
  });
  return true;
}

/** Materialets illustrationsplan och kulör i 3D, och objektets egen opacitet och vridning (0.10.28). */
function materialFieldChange(store: DocStore, ids: Id[], m: Material, name: string, value: string, nested?: string): void {
  const num = Number(value.replace(',', '.').replace(/[^\d.+-]/g, ''));
  const pct = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  if (name === 'materialOpacity' || name === 'materialAngle') {
    const empty = value.trim() === '';
    if (!empty && !Number.isFinite(num)) return;
    overrideMaterial(store, ids, name, empty ? undefined : name === 'materialOpacity' ? pct(num) : num || undefined, nested);
    return;
  }
  const edit = (label: string, fn: (q: Material) => Material) => updateMaterial(store, m.id, `${label} (${m.name})`, fn);
  if (name === 'matIllKind')
    edit(value === 'color' ? 'Egen färg i illustrationsplanen' : 'Illustrationsplanen som planen', (q) => {
      if (value !== 'color') {
        delete q.illustration;
        return q;
      }
      const c = q.plan.fill === 'solid' && typeof q.plan.fillColor === 'string' ? q.plan.fillColor : (q.color3d ?? MATERIAL_3D_COLOR);
      return { ...q, illustration: q.illustration ?? { color: c, opacity: Number(q.plan.fillOpacity ?? 100) } };
    });
  else if (name === 'matIllColor') edit('Ändra färgen i illustrationsplanen', (q) => ({ ...q, illustration: { ...q.illustration, color: value } }));
  else if (name === 'matIllOpacity' && Number.isFinite(num)) edit('Ändra opaciteten i illustrationsplanen', (q) => ({ ...q, illustration: { color: q.illustration?.color ?? MATERIAL_3D_COLOR, opacity: pct(num) } }));
  else if (name === 'matColor3d') edit('Ändra kulören i 3D', (q) => ({ ...q, color3d: value }));
}

/** En egen fyllningstyps vridning och skala (0.8.36). Null = olika i markeringen. */
export function typeFields(p: { fillTypeAngle: number | null; fillTypeScale: number | null }, attrs: (key: string) => string): string {
  const v = (n: number | null) => (n === null ? '' : comma(n));
  const mixed = (n: number | null) => (n === null ? ' placeholder="Olika"' : '');
  return `<label class="field"><span>Vridning</span><span class="input-unit"><input type="text" data-expr data-unit="deg" inputmode="decimal" autocomplete="off" ${attrs('fillTypeAngle')} value="${v(p.fillTypeAngle)}"${mixed(p.fillTypeAngle)}><i>°</i></span></label>
    <label class="field"><span>Skala</span><span class="input-unit"><input type="text" data-expr data-unit="" inputmode="decimal" autocomplete="off" ${attrs('fillTypeScale')} value="${v(p.fillTypeScale)}"${mixed(p.fillTypeScale)}><i>×</i></span></label>`;
}

/** Skrafferingens vinkel och avstånd; också direkt i smartmenyn (0.8.22). Null = olika i markeringen. */
export function hatchFields(p: { fillAngle: number | null; fillSpacing: number | null }, attrs: (key: string) => string): string {
  const v = (n: number | null) => (n === null ? '' : comma(n));
  const mixed = (n: number | null) => (n === null ? ' placeholder="Olika"' : '');
  return `<label class="field"><span>Vinkel</span><span class="input-unit"><input type="text" data-expr data-unit="deg" inputmode="decimal" autocomplete="off" ${attrs('fillAngle')} value="${v(p.fillAngle)}"${mixed(p.fillAngle)}><i>°</i></span></label>
    <label class="field"><span>Avstånd på papper</span><span class="input-unit"><input type="text" data-expr inputmode="decimal" autocomplete="off" ${attrs('fillSpacing')} value="${v(p.fillSpacing)}"${mixed(p.fillSpacing)}><i>mm</i></span></label>`;
}

/**
 * Mönstrets bakgrund (0.8.29) i smartmenyn: ingen, mask eller egen färg
 * (0.10.14 en lista i stället för en kryssruta), färgen och opaciteten.
 * Null = olika i markeringen.
 */
export function backgroundFields(p: { fillBackground?: string | null; fillBackgroundOpacity?: number | null }, attrs: (key: string) => string): string {
  const mixed = p.fillBackground === null;
  const kind = mixed ? null : p.fillBackground === undefined ? 'none' : p.fillBackground === FILL_BACKGROUND ? 'mask' : 'color';
  const op = p.fillBackgroundOpacity === null ? NaN : (p.fillBackgroundOpacity ?? 100);
  const opt = (v: string, l: string) => `<option value="${v}"${kind === v ? ' selected' : ''}>${l}</option>`;
  const select = `<label class="field"><span>Bakgrund</span><select ${attrs('fillBackgroundKind')}>${mixed ? '<option selected disabled>Olika</option>' : ''}${opt('none', 'Ingen')}${opt('mask', 'Mask')}${opt('color', 'Egen färg')}</select></label>`;
  const colorField = kind === 'color' ? `<label class="field"><span>Bakgrundens färg</span><input type="color" ${attrs('fillBackground')} value="${p.fillBackground}"></label>` : '';
  const opField = kind === 'none' ? '' : `<label class="field"><span>Bakgrundens opacitet</span><span class="input-unit"><input type="text" data-expr data-unit="" data-step="10" inputmode="decimal" autocomplete="off" ${attrs('fillBackgroundOpacity')} value="${Number.isFinite(op) ? Math.round(op) : ''}"${Number.isFinite(op) ? '' : ' placeholder="Olika"'}><i>%</i></span></label>`;
  return `<div class="fields">${select}${colorField}${opField}</div>`;
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
  const hatch = ps.every((q) => q.fill === 'hatch' || q.fill === 'cross')
    ? hatchFields({ fillAngle: same('fillAngle'), fillSpacing: same('fillSpacing') }, attrs)
    : ps.every((q) => q.fill === 'type')
      ? typeFields({ fillTypeAngle: ps.every((q) => (q.fillTypeAngle ?? 0) === (ps[0].fillTypeAngle ?? 0)) ? (ps[0].fillTypeAngle ?? 0) : null, fillTypeScale: ps.every((q) => (q.fillTypeScale ?? 1) === (ps[0].fillTypeScale ?? 1)) ? (ps[0].fillTypeScale ?? 1) : null }, attrs)
      : '';
  if (colorField || hatch) parts.push(`<div class="fields">${colorField}${hatch}</div>`);
  // Bakgrunden (0.8.29), när alla är skrafferade eller har en egen typ.
  if (hatch && ps.every((q) => hasBackground(q.fill))) {
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
    const fills = ps.filter((q) => q.fill).map((q) => fillOpacityOf(q));
    const lines = ps.filter((q) => q.weight > 0).map((q) => q.opacity ?? 100);
    const one = (v: number[]) => (v.every((x) => x === v[0]) ? v[0] : NaN);
    parts.push(opacityFields({ weight: lines.length ? 1 : 0, fill: ps.find((q) => q.fill)?.fill, opacity: lines.length ? one(lines) : undefined, fillOpacity: fills.length ? one(fills) : undefined }, attrs, true));
  }
  // Avgränsar rum (0.8.34), i modellen.
  if (els.every((e) => !e.space)) parts.push(boundsField(ps.every((q) => !!q.boundsRooms === !!ps[0].boundsRooms) ? !!ps[0].boundsRooms : null, attrs));
  return parts.length ? parts.join('') : null;
}

/** Kryssrutan *Avgränsar rum* (0.8.34). Null = olika i markeringen. */
export function boundsField(on: boolean | null, attrs: (key: string) => string): string {
  return `<label class="check" title="Linjen räknas som en vägg när rummen räknas ut, också med pennan 0"><input type="checkbox" ${attrs('boundsRooms')}${on ? ' checked' : ''}${on === null ? ' data-mixed' : ''}> Avgränsar rum${on === null ? ' (olika)' : ''}</label>`;
}

/**
 * Opaciteten (0.8.22). Sedan 0.10.14 har fyllningen alltid sin egen
 * (`fillOpacity`, i fyllningens panel), så här står linjens; i smartmenyn
 * (`withFill`) också fyllningens. NaN = olika i markeringen.
 */
export function opacityFields(p: Pick<Shape2DParams, 'weight' | 'fill' | 'opacity' | 'fillOpacity'>, attrs: (key: string) => string, withFill = false): string {
  const field = (key: string, label: string, v: number) =>
    `<label class="field"><span>${label}</span><span class="input-unit"><input type="text" data-expr data-unit="" data-step="10" inputmode="decimal" autocomplete="off" ${attrs(key)} value="${Number.isFinite(v) ? Math.round(v) : ''}"${Number.isFinite(v) ? '' : ' placeholder="Olika"'}><i>%</i></span></label>`;
  const parts: string[] = [];
  if (p.weight > 0) parts.push(field('opacity', p.fill && withFill ? 'Linjens opacitet' : 'Opacitet', p.opacity ?? 100));
  if (withFill && p.fill) parts.push(field('fillOpacity', p.weight > 0 ? 'Fyllningens opacitet' : 'Opacitet', Number.isNaN(p.fillOpacity) ? NaN : fillOpacityOf(p)));
  return parts.length ? `<div class="fields">${parts.join('')}</div>` : '';
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
      ${p.weight ? opacityFields(p, (k) => `data-key="d2:${k}"`) : ''}
      <label class="check"><input type="checkbox" data-key="d2:closed"${p.closed ? ' checked' : ''}> Sluten</label>
      ${el.space ? '' : boundsField(!!p.boundsRooms, (k) => `data-key="d2:${k}"`)}
      ${!p.closed && p.weight ? capFields(p, (k) => `data-key="d2:${k}"`) : ''}
      ${fillFields('d2-pattern-panel', p, (k) => `data-key="d2:${k}"`, doc.graphics, undefined, { uses: p.material ? materialUses(doc, p.material) : 0 })}
      ${p.weight === 0 && !p.fill ? '<p class="note">Formen har varken linje eller fyllning och syns inte, men går att klicka på längs linjen.</p>' : ''}
      ${p.shape === 'polyline' ? '<p class="note">Böj eller räta ut en kant med Modifiera: klicka på kanten när formen är markerad.</p>' : ''}`;
}

/** Ändringar i 2D-formens fält (`d2:…`); fyllningens går till `fillChange`. Också rummens och markobjektens fyllning. */
export function shapeChange(store: DocStore, ids: Id[], name: string, input: HTMLInputElement | HTMLSelectElement): boolean {
  const v = input.value;
  const num = Number(v.replace(',', '.'));
  if (name === 'weight' && num >= 0) updateParams(store, ids, { weight: num }, num ? 'Ändra penna' : 'Ingen linje');
  else if (name === 'linetype') updateParams(store, ids, { linetype: v }, 'Ändra linjetyp');
  else if (name === 'color') updateParams(store, ids, { color: v }, 'Ändra färg');
  else if (name === 'boundsRooms') {
    const on = (input as HTMLInputElement).checked;
    updateParams(store, ids, { boundsRooms: on ? true : undefined }, on ? 'Avgränsar rum' : 'Avgränsar inte rum');
  } else if (name === 'closed') updateParams(store, ids, { closed: (input as HTMLInputElement).checked }, 'Sluten');
  else if (name === 'startCap' || name === 'endCap') updateParams(store, ids, { [name]: v === 'none' ? undefined : v }, v === 'none' ? 'Ingen ändform' : 'Ändra ändform');
  else if (name === 'capSize' && num > 0) updateParams(store, ids, { capSize: num === CAP_SIZE ? undefined : num }, 'Ändra ändarnas storlek');
  else if (name === 'fillBackgroundOn') {
    // Kryssrutan före 0.10.14; finns kvar för äldre anrop.
    const on = (input as HTMLInputElement).checked;
    updateParams(store, ids, on ? { fillBackground: FILL_BACKGROUND } : { fillBackground: undefined, fillBackgroundOpacity: undefined }, on ? 'Bakgrund' : 'Ingen bakgrund');
  } else if (name === 'opacity' && percent(num) !== null) {
    // Linjens opacitet (0.10.14): fyllningen behåller sin, också när den förut följde linjen.
    const op = percent(num)!;
    store.transact('Ändra opacitet', (tx) => {
      for (const id of ids) {
        const el = tx.doc.elements[id];
        if (!el) continue;
        const params = { ...el.params } as Record<string, unknown>;
        if (params.fill && params.fillOpacity === undefined) params.fillOpacity = (params.opacity as number | undefined) ?? 100;
        if (op === 100) delete params.opacity;
        else params.opacity = op;
        tx.putElement({ ...el, params });
      }
    });
  } else if (name === 'fillLayer') updateParams(store, ids, { fillFront: v === 'front' ? true : undefined }, v === 'front' ? 'Fyllningen framför väggarna' : 'Fyllningen bakom väggarna');
  else if (name === 'lineLayer') updateParams(store, ids, { lineBehind: v === 'behind' ? true : undefined }, v === 'behind' ? 'Linjen bakom väggarna' : 'Linjen framför väggarna');
  else fillChange(store, ids, name, input);
  return true;
}
