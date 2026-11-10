import { buildingStoreys, type ProjectDoc } from '../core/model';
import { isNumberField, scheduleOf, sourceFields, SOURCE_NAMES, type Schedule } from '../core/schedules';
import { defaultState } from '../core/states';
import { columnTitle, cachedTable } from '../repr/schedules';
import { icons } from './icons';
import { escapeHtml as esc } from './labels';

/**
 * Förteckningens inställningar i egenskaperna (0.12.2): namn, tillstånd,
 * våningar, kolumnerna med rubrik och summa, sorteringen, grupperingen och
 * summaraden. Varje ändring sparas direkt (`data-sch`, bundet i
 * `src/ui/app/schedules.ts`) och syns i tabellen bredvid.
 */

const field = (label: string, input: string) => `<label class="field"><span>${label}</span>${input}</label>`;

function fieldOptions(doc: ProjectDoc, s: Schedule, current: string | undefined, none?: string): string {
  const fields = sourceFields(doc, s.source).map((f) => f.name);
  // Ett eget fält (smarttext) som används finns också i listan.
  for (const c of s.columns) if (!fields.includes(c.field)) fields.push(c.field);
  return `${none ? `<option value=""${current ? '' : ' selected'}>${none}</option>` : ''}${fields.map((f) => `<option value="${esc(f)}"${f === current ? ' selected' : ''}>${esc(f)}</option>`).join('')}`;
}

export function scheduleFormMarkup(doc: ProjectDoc, id: string): string {
  const s = scheduleOf(doc, id);
  if (!s) return '';
  const t = cachedTable(doc, s);
  const storeys = [...buildingStoreys(doc)].sort((a, b) => b.elevation - a.elevation);
  const site = doc.storeys.find((x) => x.site);
  const places = s.source === 'Gate' || s.source === 'Label' ? [...(site ? [site] : []), ...storeys] : storeys;
  const on = (sid: string) => !s.storeys?.length || s.storeys.includes(sid);
  const unused = sourceFields(doc, s.source).filter((f) => !s.columns.some((c) => c.field === f.name));
  const sorts = [...new Set(Object.values(doc.elements).filter((e) => e.type === 'Label').map((e) => String((e.params as { sort?: string }).sort ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'sv'));
  const cols = s.columns
    .map((c, i) => {
      const n = isNumberField(s.source, c.field);
      return `<div class="sch-col" data-sch-col="${i}">
        <span class="sch-col-field" title="Fältet">${esc(c.field)}</span>
        <input data-sch="title:${i}" value="${esc(c.title ?? '')}" placeholder="${esc(columnTitle({ field: c.field }))}" aria-label="Rubrik för ${esc(c.field)}">
        ${n ? `<label class="check" title="Summeras i summaraden"><input type="checkbox" data-sch="sum:${i}"${c.sum ? ' checked' : ''}> Σ</label>` : '<span class="sch-col-gap"></span>'}
        <button type="button" class="icon-mini" data-sch-act="up:${i}" aria-label="Flytta ${esc(c.field)} åt vänster" title="Åt vänster"${i ? '' : ' disabled'}>↑</button>
        <button type="button" class="icon-mini" data-sch-act="down:${i}" aria-label="Flytta ${esc(c.field)} åt höger" title="Åt höger"${i < s.columns.length - 1 ? '' : ' disabled'}>↓</button>
        <button type="button" class="icon-mini" data-sch-act="remove:${i}" aria-label="Ta bort ${esc(c.field)}" title="Ta bort kolumnen"${s.columns.length > 1 ? '' : ' disabled'}>×</button>
      </div>`;
    })
    .join('');
  const sortRow = (k: 0 | 1) => {
    const cur = s.sort[k];
    return `<div class="sch-sort">${field(k ? 'Sedan efter' : 'Sortera efter', `<select data-sch="sort:${k}">${fieldOptions(doc, s, cur?.field, k ? 'Inget' : 'Ingen ordning')}</select>`)}
      <select data-sch="desc:${k}" aria-label="Ordning"${cur ? '' : ' disabled'}><option value=""${cur?.desc ? '' : ' selected'}>Stigande</option><option value="1"${cur?.desc ? ' selected' : ''}>Fallande</option></select></div>`;
  };
  const sheets = [...doc.sheets].sort((a, b) => a.number.localeCompare(b.number, 'sv', { numeric: true }));
  const placed = doc.sheets.filter((sh) => sh.viewports.some((v) => v.view === s.id));
  return `<form class="tree-form schedule-form" data-schedule-form="${s.id}">
    <header class="sel-head"><h2>${esc(s.name)}</h2><p>Förteckning · ${SOURCE_NAMES[s.source]} · ${t.count} ${t.count === 1 ? 'rad' : 'rader'}</p></header>
    <section>
      <div class="fields">
        ${field('Namn', `<input data-sch="name" value="${esc(s.name)}" autocomplete="off">`)}
        ${field('Tillstånd', `<select data-sch="state">${doc.states.map((x) => `<option value="${x.id}"${x.id === (s.state ?? defaultState(doc)) ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`)}
        ${s.source === 'Label' ? field('Sort', `<select data-sch="labelSort"><option value="">Alla</option>${sorts.map((x) => `<option${x.toLowerCase() === s.labelSort?.toLowerCase() ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>`) : ''}
      </div>
      ${s.source === 'Door' || s.source === 'Window' || s.source === 'Gate' ? `<label class="check"><input type="checkbox" data-sch="perLittera"${s.perLittera ? ' checked' : ''}> En rad per littera, med antal</label>` : ''}
      ${s.source === 'Area' ? `<label class="check"><input type="checkbox" data-sch="perLittera"${s.perLittera ? ' checked' : ''}> En rad per beteckning, funktion och våning</label><p class="note">BYA, BTA och BRA räknas fram per våning; delsummorna i hela m², mätt enligt SS 21054:2020.</p>` : ''}
      ${places.length > 1 ? `<div class="field-label">Våningar</div><div class="sch-storeys">${places.map((x) => `<label class="check"><input type="checkbox" data-sch-storey="${x.id}"${on(x.id) ? ' checked' : ''}> ${esc(x.name)}</label>`).join('')}</div>` : ''}
    </section>
    <section>
      <h3>Kolumner</h3>
      <div class="sch-cols">${cols}</div>
      <div class="sch-add">
        <select data-sch-add aria-label="Lägg till kolumn"><option value="">Lägg till kolumn…</option>${unused.map((f) => `<option value="${esc(f.name)}">${esc(f.name)}</option>`).join('')}<option value="*">Eget fält (smarttext)…</option></select>
      </div>
      <div class="sch-own" hidden><input data-sch-own placeholder="Fältets namn, t.ex. Golv eller U-värde" autocomplete="off"><button type="button" class="btn" data-sch-act="own">Lägg till</button></div>
      <p class="note">Ett eget fält läses som smarttext ur objektet: dess egna egenskaper, typens, och uppställningens fält för dörrar och fönster. Σ summerar kolumnen.</p>
    </section>
    <section>
      <h3>Ordning</h3>
      ${sortRow(0)}
      ${s.sort[0] ? sortRow(1) : ''}
      <div class="fields">${field('Gruppera efter', `<select data-sch="group">${fieldOptions(doc, s, s.group, 'Ingen gruppering')}</select>`)}</div>
      <label class="check"><input type="checkbox" data-sch="total"${s.noTotal ? '' : ' checked'}> Summarad längst ned</label>
      ${s.group ? '<p class="note">Varje grupp får en rubrik och, med Σ, en delsumma.</p>' : ''}
    </section>
    <section>
      <h3>På blad</h3>
      ${placed.length ? `<p class="note">Ligger på ${placed.map((sh) => `<b>${esc(sh.number)}</b>`).join(', ')}.</p>` : ''}
      ${sheets.length ? `<div class="fields">${field('Blad', `<select data-sch-sheet>${sheets.map((sh) => `<option value="${sh.id}">${esc(`${sh.number} ${sh.name}`.trim())}</option>`).join('')}</select>`)}</div><div class="row"><button type="button" class="btn" data-sch-act="place">${icons.plus}<span>Lägg på bladet</span></button></div>` : '<p class="note">Inga ritningsblad än. Skapa ett under Ritningar i projektträdet.</p>'}
    </section>
    <div class="tree-save">
      <button type="button" class="btn btn-danger" data-sch-act="delete">Ta bort</button>
      <button type="button" class="btn" data-sch-act="duplicate">Kopiera</button>
      <button type="button" class="btn" data-sch-act="csv">Spara som CSV</button>
      <button type="button" class="btn" data-sch-act="xlsx" title="Excel-fil med delsummorna och summan som formler">Spara som XLSX</button>
    </div>
  </form>`;
}
