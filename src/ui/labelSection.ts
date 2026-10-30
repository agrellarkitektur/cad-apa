import { updateParams } from '../core/commands';
import type { Element, ProjectDoc } from '../core/model';
import { litteraText } from '../core/site';
import type { DocStore } from '../core/store';
import { LABEL_FRAMES, labelAngle, labelNumbers, labelSorts, type LabelFrame, type LabelParams } from '../elements/label';
import { resolveParams } from '../elements/registry';
import { numberField } from './fieldMarkup';
import { escapeHtml, labelOf } from './labels';

/**
 * Det generella litterats fält i egenskaperna (0.10.20.2): texten med fält,
 * sorten och löpnumret, ramen, texthöjden och vridningen, vinkeln för flera
 * ledare och ledarna, som kan tas bort en och en. Ledarens sida, ände och
 * stam står under Littera, som för de andra litterorna.
 */
export function labelFields(doc: ProjectDoc, el: Element): string {
  const p = resolveParams<LabelParams>(doc, el);
  const n = labelNumbers(doc).get(el.id);
  const counted = n ? litteraText(doc.site, '', n) : '';
  const sorts = labelSorts(doc);
  const frame = p.frame ?? 'none';
  const height = p.height && p.height > 0 ? p.height : doc.graphics.labels.heights.littera;
  const angle = labelAngle(doc.graphics.labels.leaders.Label, p);
  const leaders = (p.targets ?? [])
    .map((t, i) => {
      const target = t.id ? doc.elements[t.id] : undefined;
      const what = t.id ? (target ? escapeHtml(labelOf(doc, target)) : '<span class="warn">Objektet är borttaget</span>') : 'En punkt i planen';
      return `<li><span>${what}</span><button class="link" data-action="label-drop" data-index="${i}" title="Ta bort ledaren">Ta bort</button></li>`;
    })
    .join('');
  return `<label class="field" for="f-label-text"><span>Text</span><textarea id="f-label-text" data-key="label:text" rows="2">${escapeHtml(p.text ?? '')}</textarea></label>
    <p class="note">Fält inom klammer hämtas ur det ledarna pekar på: <code>{typ}</code>, <code>{id}</code>, <code>{namn}</code>, <code>{nummer}</code>, <code>{area}</code>, <code>{bredd}</code>, <code>{höjd}</code>, <code>{längd}</code>, <code>{storlek}</code>, <code>{hål}</code> och egna egenskaper, t.ex. <code>{brandklass}</code>; <code>{löpnummer}</code> och <code>{sort}</code> ur litteran själv.</p>
    <div class="fields">
      <label class="field" for="f-label-sort"><span>Sort</span><input id="f-label-sort" data-key="label:sort" value="${escapeHtml(p.sort ?? '')}" placeholder="Ingen" list="label-sorts"><datalist id="label-sorts">${sorts.map((s) => `<option value="${escapeHtml(s)}">`).join('')}</datalist></label>
      <label class="field" for="f-label-number"><span>Löpnummer</span><input id="f-label-number" data-key="label:number" value="${escapeHtml(p.number ?? '')}" placeholder="${escapeHtml(counted)}"></label>
      <label class="field"><span>Ram</span><select data-key="label:frame">${LABEL_FRAMES.map(([k, l]) => `<option value="${k}"${k === frame ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      ${numberField('label:height', 'Texthöjd på papper', height, 'mm', 2)}${numberField('label:angle', 'Vridning', angle, '°')}
      ${numberField('label:slant', 'Flera ledares vinkel', p.slant ?? 45, '°')}
    </div>
    <div class="row"><div class="segmented" role="group" aria-label="Textens vridning">
      <button data-action="label-angle" data-angle="0" aria-pressed="${angle === 0}" title="Vågrät text">Horisontell</button>
      <button data-action="label-angle" data-angle="90" aria-pressed="${angle === 90}" title="Lodrät text, läses nedifrån">Vertikal</button>
    </div>${p.angle === undefined ? '<span class="note">Stilbokens förval</span>' : '<button class="link" data-action="label-angle" data-angle="" title="Följ stilbokens förval">Som stilboken</button>'}</div>
    <label class="check"><input type="checkbox" data-key="label:list"${p.list ? ' checked' : ''}> Olika värden som en lista (annars <i>varierar</i>)</label>
    <h3>Ledarna</h3>
    ${leaders ? `<ul class="label-leaders">${leaders}</ul>` : '<p class="note">Ingen ledare.</p>'}
    <div class="row"><button class="btn" data-action="label-add">Lägg till ledare</button></div>
    <p class="note">Litteror av samma sort numreras i den ordning de ritats; ett eget löpnummer går före. Flera ledare blir parallella med vinkeln mot stammen (0 = fria). En ledare sitter fast i objektet den pekar på och följer det; den blir röd om objektet tas bort. Dra i en punkt för att flytta den till ett annat objekt.</p>`;
}

/** Ett ändrat fält i litterans del; false när värdet inte gick att använda. */
export function applyLabelField(store: DocStore, ids: string[], name: string, input: HTMLInputElement | HTMLSelectElement): boolean {
  const value = input.value;
  const num = Number(value.replace(',', '.').replace('°', '').replace('mm', '').trim());
  switch (name) {
    case 'text':
      updateParams(store, ids, { text: value }, 'Litterans text');
      return true;
    case 'sort':
      updateParams(store, ids, { sort: value.trim() || undefined }, 'Litterans sort');
      return true;
    case 'number':
      updateParams(store, ids, { number: value.trim() || undefined }, 'Litterans löpnummer');
      return true;
    case 'frame':
      if (!LABEL_FRAMES.some(([k]) => k === value)) return false;
      updateParams(store, ids, { frame: value === 'none' ? undefined : (value as LabelFrame) }, 'Litterans ram');
      return true;
    case 'height':
      if (!(num > 0)) return false;
      updateParams(store, ids, { height: Math.round(num * 100) / 100 }, 'Litterans texthöjd');
      return true;
    case 'angle':
      if (!Number.isFinite(num)) return false;
      setLabelAngle(store, ids, num);
      return true;
    case 'slant':
      if (!(num >= 0 && num < 90)) return false;
      updateParams(store, ids, { slant: Math.round(num) === 45 ? undefined : Math.round(num) }, 'Ledarnas vinkel');
      return true;
    case 'list':
      updateParams(store, ids, { list: (input as HTMLInputElement).checked || undefined }, 'Olika värden');
      return true;
  }
  return false;
}

/**
 * Litterans vridning (0.10.22): ett tal i grader, eller null för att följa
 * stilbokens förval. Samma vinkel som förvalet sparas ändå, så att litteran
 * inte vrids om när stilboken ändras.
 */
export function setLabelAngle(store: DocStore, ids: string[], deg: number | null): void {
  const v = deg === null ? undefined : ((((Math.round(deg * 10) / 10) % 360) + 360) % 360);
  updateParams(store, ids, { angle: v }, 'Vrid litteran');
}

/** Ta bort ledare nummer `i` från litteran. */
export function dropLeader(store: DocStore, id: string, i: number): void {
  const el = store.doc.elements[id];
  const targets = [...((el?.params as unknown as LabelParams | undefined)?.targets ?? [])];
  if (!el || !targets[i]) return;
  targets.splice(i, 1);
  updateParams(store, [id], { targets }, 'Ta bort ledare');
}
