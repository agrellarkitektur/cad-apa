import { updateParams } from '../core/commands';
import { areaText } from '../core/general';
import type { Element, ProjectDoc } from '../core/model';
import type { DocStore } from '../core/store';
import type { ViewStates } from '../core/states';
import { defaultSheet } from '../core/viewCategories';
import { AREA_KINDS, AREA_NAMES, COMPUTED_KINDS, areaCode, areaRegion, areaValue, largestRing, ringsArea, roundArea, type AreaKind, type AreaParams } from '../elements/areaCalc';
import { resolveParams } from '../elements/registry';
import { createContext } from '../repr/context';
import { escapeHtml } from './labels';

/**
 * Areans egenskaper (0.12.3): slaget, funktionen, tillhörigheten och
 * temperaturregleringen, de automatiska avdragen, och *Följer väggarna*,
 * som bockas ur för att rita konturen själv.
 */
export function areaFieldsMarkup(doc: ProjectDoc, el: Element, view: ViewStates): string {
  const p = resolveParams<AreaParams>(doc, el);
  const { ctx } = createContext(doc, el.storey, view, defaultSheet(doc.graphics), () => true);
  const computed = COMPUTED_KINDS.includes(p.kind);
  const m2 = computed ? roundArea(ringsArea(areaRegion(ctx, el)), 1) : areaValue(ctx, el);
  const opt = (v: string, label: string, cur: string | undefined) => `<option value="${v}"${(cur ?? '') === v ? ' selected' : ''}>${escapeHtml(label)}</option>`;
  const kinds = AREA_KINDS.map((k) => opt(k, `${k} – ${AREA_NAMES[k]}`, p.kind)).join('');
  const own = computed
    ? '<p class="note">Räknas fram ur modellen: BTA till ytterväggarnas utsida utan andra hål i bjälklaget än trappans, BYA på markplanet med de mätvärda taksprången (SS 21054, 6.4.2).</p>'
    : `<div class="fields">
        <label class="field"><span>Funktion</span><input data-key="area:func" value="${escapeHtml(p.func ?? '')}" placeholder="t.ex. Kontor"></label>
        <label class="field"><span>Tillhörighet</span><select data-key="area:belong">${opt('', '–', p.belong)}${opt('e', 'e – enskild', p.belong)}${opt('g', 'g – gemensam', p.belong)}</select></label>
        <label class="field"><span>Temperatur</span><select data-key="area:temp">${opt('', '–', p.temp)}${opt('t', '(t) – temperaturreglerad', p.temp)}${opt('it', '(it) – icke temperaturreglerad', p.temp)}</select></label>
      </div>
      <label class="check"><input type="checkbox" data-key="area:deduct"${p.noDeduct ? '' : ' checked'}> Automatiska avdrag <span class="note">väggar, pelare och schakt tjockare än 0,30 m räknas 0,15 m in från varje sida</span></label>
      ${p.seeds?.length ? `<label class="check"><input type="checkbox" data-key="area:follow" checked> Följer väggarna (${p.seeds.length} ${p.seeds.length === 1 ? 'rum' : 'rum'})</label><p class="note">Shift+klick med verktyget Area lägger till eller tar bort rum. Bocka ur för att rita konturen själv i Modifiera.</p>` : '<p class="note">Egen kontur: ändra punkterna i Modifiera.</p>'}`;
  return `<div class="fields">
      <label class="field"><span>Areaslag</span><select data-key="area:kind">${kinds}</select></label>
      <label class="field"><span>Area</span><input value="${areaText(m2, 1)}" readonly title="${escapeHtml(areaCode(p))}, mätt enligt SS 21054:2020"></label>
    </div>${own}`;
}

/** Ett ändrat fält; false när värdet inte gick att använda. */
export function applyAreaField(store: DocStore, ids: string[], name: string, input: HTMLInputElement | HTMLSelectElement, view: ViewStates): boolean {
  const doc = store.doc;
  const v = input.value.trim();
  if (name === 'kind') {
    if (!AREA_KINDS.includes(v as AreaKind)) return false;
    updateParams(store, ids, { kind: v }, `Areaslag ${v}`);
    return true;
  }
  if (name === 'func') {
    updateParams(store, ids, { func: v || undefined }, 'Areans funktion');
    return true;
  }
  if (name === 'belong') {
    updateParams(store, ids, { belong: v === 'e' || v === 'g' ? v : undefined }, 'Areans tillhörighet');
    return true;
  }
  if (name === 'temp') {
    updateParams(store, ids, { temp: v === 't' || v === 'it' ? v : undefined }, 'Areans temperaturreglering');
    return true;
  }
  if (name === 'deduct') {
    updateParams(store, ids, { noDeduct: (input as HTMLInputElement).checked ? undefined : true }, (input as HTMLInputElement).checked ? 'Automatiska avdrag' : 'Utan avdrag');
    return true;
  }
  if (name === 'follow' && !(input as HTMLInputElement).checked) {
    // Lösgör: konturen som den är nu, utan avdragen, blir en egen kontur.
    store.transact('Lösgör arean', (tx) => {
      for (const id of ids) {
        const el = tx.doc.elements[id];
        if (el?.type !== 'Area') continue;
        const p = resolveParams<AreaParams>(doc, el);
        const { ctx } = createContext(doc, el.storey, view, defaultSheet(doc.graphics), () => true);
        const ring = largestRing(areaRegion(ctx, { ...el, params: { ...el.params, noDeduct: true } }));
        if (ring.length < 3) continue;
        const { seeds: _s, ...rest } = el.params as Record<string, unknown>;
        tx.putElement({ ...el, params: { ...rest, outline: ring.map((q) => [Math.round(q[0]), Math.round(q[1])]), ...(p.noDeduct ? { noDeduct: true } : {}) } });
      }
    });
    return true;
  }
  return false;
}
