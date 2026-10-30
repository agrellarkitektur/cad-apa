import type { DocStore } from '../../core/store';
import type { Id, ProjectDoc } from '../../core/model';
import { defaultGroundRailingTypes, defaultRailingTypes, PART_KIND_LABELS, railNum, railValues, type RailingTypeModel, type RailNum, type RailPart, type RailPartKind } from '../../core/railingTypes';
import { addDefaultRailingTypes, addRailingGroup, addRailingType, moveRailingGroup, moveRailingPart, newRailingModel, railingGroups, railingPrefix, railingTypesIn, railingTypeUses, removeRailingGroup, removeRailingType, renameRailingGroup, setRailingTypeGroup } from '../../core/railings';
import { RAIL_PENS } from '../../repr/railingPens';
import { applyRailingField, railingAction } from '../railingFields';
import { askConfirm, askText } from '../ask';
import { escapeHtml, nextLittera } from '../labels';
import { icons } from '../icons';
import { previewMarkup, PREVIEW_MODES, type PreviewMode } from './railingPreview';

/**
 * Räckestypeditorn (0.11.2, tavla 4 i utredningen): stilboken › Resurser ›
 * *Räckestyper*. Till vänster typlistan i grupper (egna grupper skapas,
 * döps om, flyttas och tas bort; typer dras mellan grupperna), i mitten
 * typens huvud, förhandsvisningen och delträdet, till höger den valda
 * delens egenskaper och typens parametrar. Fälten har samma nycklar som
 * typen i räckets panel (`rail:type:<def>:…`), så ändringarna går genom
 * `applyRailingField` och `railingAction`.
 */
export interface RailEditorState {
  def: Id | null;
  part: string | null;
  mode: PreviewMode;
  /** Sökningen i typlistan (0.11.3). */
  query?: string;
}

export const newRailEditorState = (): RailEditorState => ({ def: null, part: null, mode: 'straight' });

/** Sök i typlistan utan att rita om (fokus stannar i fältet). */
export function railEditorSearch(root: HTMLElement, st: RailEditorState, value: string): void {
  st.query = value;
  const q = value.trim().toLowerCase();
  for (const b of root.querySelectorAll<HTMLElement>('[data-rt-find]')) b.hidden = !!q && !(b.dataset.rtFind ?? '').includes(q);
}

const mm = (v: number) => Math.round(v).toLocaleString('sv-SE');
const opt = (v: string, label: string, cur: string | undefined) => `<option value="${escapeHtml(v)}"${(cur ?? '') === v ? ' selected' : ''}>${escapeHtml(label)}</option>`;

/** Den valda typen och delen, eller de första som finns. */
function chosen(doc: ProjectDoc, st: RailEditorState): { def: Id | null; model: RailingTypeModel | null; part: RailPart | null } {
  let def = st.def && doc.definitions[st.def]?.railing ? st.def : null;
  if (!def) def = railingGroups(doc).flatMap((g) => railingTypesIn(doc, g))[0]?.id ?? null;
  st.def = def;
  const model = def ? (doc.definitions[def].railing ?? null) : null;
  const part = model ? (model.parts.find((p) => p.id === st.part) ?? model.parts[0] ?? null) : null;
  st.part = part?.id ?? null;
  return { def, model, part };
}

export function railEditorMarkup(doc: ProjectDoc, st: RailEditorState): string {
  const { def, model, part } = chosen(doc, st);
  const groups = railingGroups(doc);
  const q = (st.query ?? '').trim().toLowerCase();
  const list = groups
    .map((g, gi) => {
      const types = railingTypesIn(doc, g);
      const rows = types
        .map((d) => {
          const n = railingTypeUses(doc, d.id);
          const mb = `${d.railing?.ground ? 'M' : ''}${d.railing?.building ? ' B' : ''}`.trim();
          const hit = !q || `${d.name} ${d.description ?? ''}`.toLowerCase().includes(q);
          return `<button class="rt-type${d.id === def ? ' on' : ''}" draggable="true" data-rt-type="${escapeHtml(d.id)}" data-rt-find="${escapeHtml(`${d.name} ${d.description ?? ''}`.toLowerCase())}"${hit ? '' : ' hidden'} title="${n ? `${n} ${n === 1 ? 'räcke' : 'räcken'} i projektet. ` : ''}Dra till en annan grupp för att flytta typen"><b>${escapeHtml(d.name)}</b><span>${escapeHtml(d.description ?? '')}</span><i>${mb}</i></button>`;
        })
        .join('');
      const g_ = escapeHtml(g);
      return `<div class="rt-group" data-rt-group="${g_}">
        <div class="rt-group-head"><span>${g_}</span>
          <button class="icon-btn" data-rt-act="group-rename" data-rt-g="${g_}" title="Byt namn på gruppen" aria-label="Byt namn">✎</button>
          <button class="icon-btn" data-rt-act="group-up" data-rt-g="${g_}"${gi ? '' : ' disabled'} title="Flytta upp" aria-label="Flytta upp">↑</button>
          <button class="icon-btn" data-rt-act="group-down" data-rt-g="${g_}"${gi < groups.length - 1 ? '' : ' disabled'} title="Flytta ned" aria-label="Flytta ned">↓</button>
          <button class="icon-btn" data-rt-act="group-remove" data-rt-g="${g_}"${types.length ? ' disabled title="Flytta eller ta bort typerna i gruppen först"' : ' title="Ta bort gruppen"'} aria-label="Ta bort">${icons.trash}</button>
        </div>
        ${rows || '<p class="rt-empty">Dra hit en typ</p>'}
      </div>`;
    })
    .join('');
  const used = def ? railingTypeUses(doc, def) : 0;
  const missing = [...defaultRailingTypes(), ...defaultGroundRailingTypes()].filter((d) => !doc.definitions[d.id]).length;
  const listCol = `<div class="rt-list">
    <label class="field rt-search"><span>Sök</span><input type="search" data-rt-search placeholder="typ eller littera" value="${escapeHtml(st.query ?? '')}" autocomplete="off"></label>
    ${list}
    <div class="rt-list-actions">
      <button class="btn btn-small" data-rt-act="type-new">Ny typ…</button>
      <button class="btn btn-small" data-rt-act="type-dup"${def ? '' : ' disabled'}>Duplicera</button>
      <button class="btn btn-small" data-rt-act="type-remove"${def && !used ? '' : ` disabled title="${def ? `Används av ${used} räcken` : ''}"`}>Ta bort</button>
      <button class="btn btn-small" data-rt-act="group-new">Ny grupp…</button>
      ${missing ? `<button class="btn btn-small" data-rt-act="types-default" title="RÄ01–RÄ03, ST01–ST03, SP01 och G01: de som saknas i projektet">Lägg in förvalda typer</button>` : ''}
    </div>
    <p class="note">Dra typer mellan grupperna; pennan, pilarna och papperskorgen vid gruppens namn döper om, flyttar och tar bort den. M = Mark (Platsen) · B = Byggnad.</p>
  </div>`;
  if (!def || !model) return section(`${listCol}<div class="rt-typecol"><p class="note">Inga räckestyper än. <b>Ny typ…</b> lägger till en, och de förvalda kommer första gången ett räcke läggs (staketen på Platsen).</p><div class="row"><button class="btn" data-rt-act="types-default">Lägg in förvalda typer</button></div></div>`);
  const d = doc.definitions[def];
  const k = (rest: string) => `rail:type:${def}:${rest}`;
  const vals = railValues(model);
  const head = `<div class="rt-head">
    <div class="rt-title"><input type="text" class="rt-littera" aria-label="Littera" data-key="${k('name')}" value="${escapeHtml(d.name)}"><input type="text" class="rt-desc" aria-label="Beskrivning" data-key="${k('description')}" value="${escapeHtml(d.description ?? '')}" placeholder="Beskrivning"></div>
    <span class="rt-checks">
      <label class="check" title="Visas på Platsen"><input type="checkbox" data-key="${k('ground')}"${model.ground ? ' checked' : ''}> M</label>
      <label class="check" title="Visas på våningarna"><input type="checkbox" data-key="${k('building')}"${model.building ? ' checked' : ''}> B</label>
      <label class="check" title="Varningarna för öppningar och klätterbarhet (BFS 2024:9, 2 kap. 11 §)"><input type="checkbox" data-key="${k('childSafe')}"${model.childSafe ? ' checked' : ''}> Barnsäkert</label>
    </span>
    <span class="rt-used">${used ? `${used} ${used === 1 ? 'räcke' : 'räcken'} i projektet` : 'Används inte'}</span>
  </div>`;
  // Mönstret: modulen (stolparnas delning), i trappa och på sluttning (tavla 4).
  const mainIdx = model.parts.findIndex((p) => p.kind === 'point');
  const main = mainIdx >= 0 ? model.parts[mainIdx] : undefined;
  const slopes = new Set(model.parts.map((p) => p.slope ?? 'follow'));
  const slope = slopes.size === 1 ? [...slopes][0] : 'mixed';
  const row = (label: string, value: string) => `<div class="rt-row"><span>${label}</span>${value}</div>`;
  const pattern = `<div class="rt-sec">Mönster</div>
    ${main ? row('Modul', `<input type="text" class="rt-val" aria-label="Modul" title="Stolparnas största delning, jämnt fördelat" data-key="${k(`part:${mainIdx}:spacing`)}" value="${escapeHtml(String(main.spacing ?? 1200))}">`) : ''}
    ${row('I trappa', `<i>${model.parts.some((p) => p.kind === 'repeat') ? 'följer lutningen, spjälorna lodräta' : 'följer lutningen'}</i>`)}
    ${row('På sluttning', `<select class="rt-val" data-key="${k('slope')}" aria-label="På sluttning">${slope === 'mixed' ? '<option value="" selected>Blandat</option>' : ''}${opt('follow', 'Följer marken', slope)}${opt('stepped', 'Trappstegat', slope)}</select>`)}`;
  const sections: [string, RailPartKind[]][] = [
    ['Stolpar', ['point']],
    ['Längsgående', ['along']],
    ['Fyllning', ['repeat', 'surface']],
  ];
  const partRow = (q: RailPart) => {
    const i = model.parts.indexOf(q);
    return `<li class="rt-part${q.id === part?.id ? ' on' : ''}" data-rt-part="${escapeHtml(q.id)}">
        <span class="rt-chip">${CHIP[q.kind]}</span><b>${escapeHtml(q.name)}</b><span class="rt-sum">${escapeHtml(partSummary(q, vals))}</span>
        <span class="rt-part-acts">
        <button class="icon-btn" data-rt-act="part-up" data-rt-p="${escapeHtml(q.id)}"${i ? '' : ' disabled'} title="Flytta upp (ordningen i 3D och planen)" aria-label="Flytta upp">↑</button>
        <button class="icon-btn" data-rt-act="part-down" data-rt-p="${escapeHtml(q.id)}"${i < model.parts.length - 1 ? '' : ' disabled'} title="Flytta ned" aria-label="Flytta ned">↓</button>
        <button class="icon-btn" data-action="railtype-part-remove" data-def="${escapeHtml(def)}" data-index="${i}" title="Ta bort delen" aria-label="Ta bort">×</button></span>
      </li>`;
  };
  const tree = sections
    .map(([title, kinds]) => {
      const rows = model.parts.filter((p) => kinds.includes(p.kind)).map(partRow).join('');
      return rows ? `<div class="rt-sec">${title}</div><ul class="rt-tree">${rows}</ul>` : '';
    })
    .join('');
  const add = `<details class="rt-add"><summary class="btn btn-small">+ Lägg till del…</summary><div>${(Object.keys(PART_KIND_LABELS) as RailPartKind[])
    .map((kind) => `<button class="btn btn-small" data-action="railtype-part-add" data-def="${escapeHtml(def)}" data-kind="${kind}" title="${KIND_HINT[kind]}">${PART_KIND_LABELS[kind]}</button>`)
    .join('')}</div></details>`;
  // Ändarna: stolpe, och de längsgående delarnas förlängning och avslut.
  const endText = () => {
    const bits = [main ? main.name.toLowerCase() : ''];
    for (const a of model.parts.filter((p) => p.kind === 'along' && railNum(p.extend, vals, 0) > 0)) bits.push(`${a.name.toLowerCase()} +${mm(railNum(a.extend, vals, 0))} ${a.finish === 'down' ? '↓' : a.finish === 'wall' ? '⟂' : '→'}`);
    return bits.filter(Boolean).join(' · ') || '–';
  };
  const ends = `<div class="rt-sec">Ändar</div>${row('Början', `<i>${escapeHtml(endText())}</i>`)}${row('Slutet', `<i>${escapeHtml(endText())}</i>`)}`;
  const gateTypes = Object.values(doc.definitions)
    .filter((x) => x.railing?.group === 'Grindar')
    .sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }));
  const gate =
    model.group === 'Grindar' || model.group === 'Ledstänger'
      ? ''
      : `<div class="rt-sec">Grind</div>${row('Grindtyp', `<select class="rt-val" data-key="${k('gateType')}" aria-label="Grindtyp" title="Typen nya grindar i räcket får (Gör till grind…)">${opt('', 'Följer staketet', model.gateType ?? '')}${gateTypes.map((x) => opt(x.id, `${x.name} ${x.description ?? ''}`.trim(), model.gateType)).join('')}</select>`)}`;
  const typeCol = `<div class="rt-typecol">${head}${pattern}${tree}${ends}${gate}${add}</div>`;
  const tabs = `<div class="rt-tabs" role="tablist">${PREVIEW_MODES.map(([m, l]) => `<button role="tab" data-rt-mode="${m}" aria-selected="${m === st.mode}" class="${m === st.mode ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const preview = `<div class="rt-preview">${tabs}<div class="rt-canvas"><p class="note rt-canvas-hint">Klicka på en del i bilden eller i listan</p>${previewMarkup(model, st.mode, part?.id ?? null)}</div></div>`;
  const center = `<div class="rt-center">${preview}${paramsMarkup(def, model)}</div>`;
  const side = `<div class="rt-side">${part ? partMarkup(doc, def, model, part) : '<p class="note">Typen har inga delar.</p>'}</div>`;
  return section(`${listCol}${typeCol}${center}${side}`);
}

const CHIP: Record<RailPartKind, string> = { point: 'punkt', along: 'längs', repeat: 'upprepas', surface: 'yta' };

/** En rad om delen i typens lista: profilen och det viktigaste måttet. */
function partSummary(q: RailPart, vals: ReadonlyMap<string, number>): string {
  const show = (v: RailNum | undefined, f = 0) => (typeof v === 'string' ? v : mm(railNum(v, vals, f)));
  const prof = q.kind === 'surface' ? `t ${mm(q.thickness ?? 10)}` : q.profile?.shape === 'round' ? `Ø ${mm(q.profile.w)}` : `${mm(q.profile?.w ?? 40)} × ${mm(q.profile?.h ?? q.profile?.w ?? 40)}`;
  if (q.kind === 'point') return [prof, q.spacing !== undefined && railNum(q.spacing, vals, 0) < 1e6 ? `c/c ≤ ${show(q.spacing)}` : '', q.below?.footing ? 'i plint' : q.below?.depth ? `nedgrävd ${show(q.below.depth)}` : ''].filter(Boolean).join(' · ');
  if (q.kind === 'along') return `${prof} · ${show(q.z, 900)}`;
  if (q.kind === 'repeat') return `${prof} · fritt ${show(q.spacing, 100)}`;
  return `${prof} · ${show(q.from)}–${show(q.to, 900)}`;
}

const KIND_HINT: Record<RailPartKind, string> = {
  point: 'Stolpe, konsol, plint: står med jämn delning',
  along: 'Handledare, liggare, bottenlist, ledstång, spänntråd',
  repeat: 'Spjälor, ribbor: med en största öppning mellan stolparna',
  surface: 'Glas, plåt, nät, spaljérutnät: mellan stolparna',
};

const section = (inner: string) => `<section class="style-labels rt-editor"><h3>Räckestyper</h3><p class="note">Ändras en typ här ändras alla räcken med den. Måtten är mm eller formler med typens parametrar, t.ex. <code>Skyddshöjd - 40</code>; höjderna räknas från referenslinjen (stegnoslinjen i en trappa, golvet eller marken annars).</p><div class="rt-grid">${inner}</div></section>`;

function partMarkup(doc: ProjectDoc, def: Id, m: RailingTypeModel, q: RailPart): string {
  const i = m.parts.indexOf(q);
  const k = (field: string) => `rail:type:${def}:part:${i}:${field}`;
  const vals = railValues(m);
  const text = (field: string, label: string, v: RailNum | undefined, title = '') => {
    const calc = typeof v === 'string' ? ` title="${escapeHtml(title ? `${title}. ` : '')}= ${mm(railNum(v, vals, 0))} mm"` : title ? ` title="${escapeHtml(title)}"` : '';
    return `<label class="field"${calc}><span>${escapeHtml(label)}</span><input type="text" autocomplete="off" data-key="${k(field)}" value="${escapeHtml(v === undefined ? '' : String(v))}"></label>`;
  };
  const select = (field: string, label: string, cur: string | undefined, options: [string, string][], title = '') =>
    `<label class="field"${title ? ` title="${escapeHtml(title)}"` : ''}><span>${escapeHtml(label)}</span><select data-key="${k(field)}">${options.map(([v, l]) => opt(v, l, cur)).join('')}</select></label>`;
  const check = (field: string, label: string, on: boolean, title = '') => `<label class="check"${title ? ` title="${escapeHtml(title)}"` : ''}><input type="checkbox" data-key="${k(field)}"${on ? ' checked' : ''}> ${escapeHtml(label)}</label>`;
  const materials = (doc.graphics.materials ?? []).filter((x) => x.building || x.ground);
  const group = (title: string, body: string) => (body ? `<div class="field-label">${title}</div><div class="fields">${body}</div>` : '');
  const profile =
    q.kind === 'surface'
      ? text('thickness', 'Tjocklek', q.thickness ?? 10)
      : `${select('shape', 'Profil', q.profile?.shape ?? 'rect', [
          ['rect', 'Rektangel'],
          ['round', 'Rund'],
        ])}${text('w', q.profile?.shape === 'round' ? 'Diameter' : 'Bredd', q.profile?.w ?? 40)}${q.profile?.shape === 'round' ? '' : text('h', q.kind === 'along' ? 'Höjd' : 'Djup', q.profile?.h ?? q.profile?.w ?? 40, q.kind === 'along' ? '' : 'Tvärs linjen')}`;
  const mat = `<label class="field"><span>Material</span><select data-key="${k('material')}"><option value="">${q.kind === 'surface' ? 'Glas' : 'Metall'}</option>${materials.map((x) => opt(x.id, x.name, q.material)).join('')}</select></label>`;
  const place =
    (q.kind === 'along' ? text('z', 'Överkant', q.z, 'Höjden över referenslinjen') : `${text('from', 'Underkant', q.from)}${text('to', 'Överkant', q.to)}`) +
    text('offset', 'Inåt', q.offset, 'Läge i sidled från referenslinjen; positivt inåt (mot trappan)') +
    (q.kind === 'point' ? text('spacing', 'Största delning', q.spacing) : q.kind === 'repeat' ? text('spacing', 'Största öppning', q.spacing) : '');
  const ends =
    q.kind === 'along'
      ? `${text('extend', 'Förlängning', q.extend, 'Förbi början och slutet, vågrätt')}${select('finish', 'Avslut', q.finish ?? 'straight', [
          ['straight', 'Rak'],
          ['down', 'Böjd nedåt'],
          ['wall', 'Mot vägg'],
        ], 'Sparas i typen; ritas i 3D senare')}`
      : q.kind === 'point'
        ? check('corners', 'Också i hörnen', q.corners !== false, 'En stolpe där linjen viker mer än 15°')
        : '';
  const behaviour =
    (q.kind === 'point' || q.kind === 'surface'
      ? select('stair', 'I trappa', q.stair ?? 'follow', [
          ['follow', 'Följer lutningen'],
          ['plumb', 'Lodrät'],
        ])
      : '') +
    select('slope', 'På sluttning', q.slope ?? 'follow', [
      ['follow', 'Följer marken'],
      ['stepped', 'Trappstegat'],
    ], 'Gäller på Platsen, där höjden mäts från marken') +
    select('gate', 'Vid grind', q.gate ?? 'break', [
      ['break', 'Avbryts'],
      ['continue', 'Fortsätter'],
    ], 'Avbryts: delen slutar vid grindstolparna (och finns i bladet när grinden följer staketet)');
  const below = q.kind === 'point' ? `${text('depth', 'Nedgrävd', q.below?.depth, 'Hur långt stolpen går under marken, på Platsen')}${check('footing', 'I plint', !!q.below?.footing)}` : '';
  const pens = RAIL_PENS.filter((p) => p.view === 'plan');
  const drawing =
    select('detail', 'Syns i planen från', q.detail ?? '', [
      ['', 'Efter slaget'],
      ['sketch', 'Skiss'],
      ['normal', 'Normal'],
      ['detail', 'Detalj'],
    ]) + `<label class="field" title="Stilbokens ställe i planen"><span>Ställe</span><select data-key="${k('pen')}">${opt('', 'Efter slaget', q.pen)}${pens.map((p) => opt(p.key, p.label.replace('Räcke: ', ''), q.pen)).join('')}</select></label>`;
  return `<div class="rt-partprops">
    <div class="rt-part-name"><input type="text" aria-label="Delens namn" data-key="${k('name')}" value="${escapeHtml(q.name)}"><span>${PART_KIND_LABELS[q.kind]}</span></div>
    ${group('Form', profile + mat)}
    ${group('Läge', place + behaviour)}
    ${group(q.kind === 'along' ? 'Ändar och skarvar' : 'Stolparna', ends)}
    ${group('Under mark', below)}
    ${group('Ritningen', drawing)}
  </div>`;
}


function paramsMarkup(def: Id, m: RailingTypeModel): string {
  const k = (rest: string) => `rail:type:${def}:${rest}`;
  const vals = railValues(m);
  const rows = m.params
    .map((q, i) => {
      const formula = typeof q.value === 'string';
      return `<tr>
        <td><input type="text" aria-label="Namn" data-key="${k(`param:${i}:name`)}" value="${escapeHtml(q.name)}"></td>
        <td>${formula ? `<span class="rt-calc">${mm(vals.get(q.name) ?? 0)}</span>` : `<input type="text" aria-label="Värde" data-key="${k(`param:${i}:value`)}" value="${escapeHtml(String(q.value))}">`}</td>
        <td><input type="text" aria-label="Formel" placeholder="–" data-key="${k(`param:${i}:formula`)}" value="${formula ? escapeHtml(String(q.value)) : ''}" title="En formel med de andra parametrarna, t.ex. Skyddshöjd - 40; töm för ett fast värde"></td>
        <td class="rt-per"><input type="checkbox" aria-label="Ändras per räcke" title="Får ändras på det enskilda räcket" data-key="${k(`param:${i}:per`)}"${q.perRailing ? ' checked' : ''}></td>
        <td><button class="icon-btn" data-action="railtype-param-remove" data-def="${escapeHtml(def)}" data-index="${i}" title="Ta bort parametern" aria-label="Ta bort">×</button></td>
      </tr>`;
    })
    .join('');
  return `<div class="rt-params">
    <div class="rt-params-head"><b>Typens parametrar</b><button class="link-btn" data-action="railtype-param-add" data-def="${escapeHtml(def)}">+ Ny parameter…</button></div>
    <table class="rt-ptable"><thead><tr><th>Parameter</th><th>Värde</th><th>Formel</th><th class="rt-per">Per räcke</th><th></th></tr></thead><tbody>${rows}</tbody></table>
  </div>`;
}

/** Klick i editorn; sant om det hörde hit. */
export async function railEditorClick(store: DocStore, st: RailEditorState, target: HTMLElement, render: () => void, onError: (msg: string) => void): Promise<boolean> {
  if (!target.closest('.rt-editor')) return false;
  const mode = target.closest<HTMLElement>('[data-rt-mode]')?.dataset.rtMode;
  if (mode) {
    st.mode = mode as PreviewMode;
    render();
    return true;
  }
  const act = target.closest<HTMLElement>('[data-rt-act]');
  if (act) {
    await doAction(store, st, act, onError);
    render();
    return true;
  }
  const btn = target.closest<HTMLElement>('[data-action^="railtype-"]');
  if (btn) {
    const before = st.def ? store.doc.definitions[st.def]?.railing?.parts.length ?? 0 : 0;
    railingAction(store, [], btn.dataset.action!, btn);
    const parts = st.def ? store.doc.definitions[st.def]?.railing?.parts ?? [] : [];
    // En ny del blir vald.
    if (btn.dataset.action === 'railtype-part-add' && parts.length > before) st.part = parts[parts.length - 1].id;
    btn.closest('details')?.removeAttribute('open');
    render();
    return true;
  }
  const type = target.closest<HTMLElement>('[data-rt-type]')?.dataset.rtType;
  if (type) {
    if (st.def !== type) st.part = null;
    st.def = type;
    render();
    return true;
  }
  const part = target.closest<Element>('[data-rt-part]')?.getAttribute('data-rt-part');
  if (part && !target.closest('input, select, button')) {
    st.part = part;
    render();
    return true;
  }
  return false;
}

async function doAction(store: DocStore, st: RailEditorState, el: HTMLElement, onError: (msg: string) => void): Promise<void> {
  const doc = store.doc;
  const g = el.dataset.rtG ?? '';
  const def = st.def ? doc.definitions[st.def] : undefined;
  switch (el.dataset.rtAct) {
    case 'group-new': {
      const name = (await askText('Ny grupp', ''))?.trim();
      if (name && !addRailingGroup(store, name)) onError(`Gruppen ${name} finns redan.`);
      return;
    }
    case 'group-rename': {
      const name = (await askText('Byt namn på gruppen', g))?.trim();
      if (name && name !== g && !renameRailingGroup(store, g, name)) onError(`Gruppen ${name} finns redan.`);
      return;
    }
    case 'group-up':
    case 'group-down':
      moveRailingGroup(store, g, el.dataset.rtAct === 'group-up' ? -1 : 1);
      return;
    case 'group-remove':
      removeRailingGroup(store, g);
      return;
    case 'type-new': {
      const group = def?.railing?.group ?? railingGroups(doc)[0] ?? 'Räcken';
      const name = (await askText(`Ny typ i ${group}`, nextLittera(doc, 'Railing', railingPrefix(group)), 'Lägg till'))?.trim();
      if (!name) return;
      st.def = addRailingType(store, name, newRailingModel(group));
      st.part = null;
      return;
    }
    case 'type-dup': {
      if (!def?.railing) return;
      const name = nextLittera(doc, 'Railing', railingPrefix(def.railing.group));
      st.def = addRailingType(store, name, structuredClone(def.railing), def.description ? `${def.description} (kopia)` : undefined);
      return;
    }
    case 'type-remove': {
      if (!def || railingTypeUses(doc, def.id)) return;
      if (!(await askConfirm(`Ta bort ${def.name}?`, 'Typen används inte av något räcke.'))) return;
      removeRailingType(store, def.id);
      st.def = null;
      st.part = null;
      return;
    }
    case 'types-default':
      store.transact('Lägg in förvalda räckestyper', (tx) => void addDefaultRailingTypes(tx));
      if (!st.def) st.def = 't-ra01';
      return;
    case 'part-up':
    case 'part-down':
      if (st.def) moveRailingPart(store, st.def, el.dataset.rtP ?? '', el.dataset.rtAct === 'part-up' ? -1 : 1);
      return;
  }
}

/** Ett ändrat fält i editorn (`rail:type:…`); sant om det hörde hit. */
export function railEditorChange(store: DocStore, input: HTMLInputElement | HTMLSelectElement): boolean {
  const key = input.dataset.key;
  if (!key?.startsWith('rail:type:') || !input.closest('.rt-editor')) return false;
  applyRailingField(store, [], key.slice(5), input);
  return true;
}

/** Dra en typ till en annan grupp. */
export function railEditorDrag(store: DocStore, e: DragEvent): void {
  const t = e.target as HTMLElement;
  if (e.type === 'dragstart') {
    const id = t.closest<HTMLElement>('[data-rt-type]')?.dataset.rtType;
    if (id && e.dataTransfer) {
      e.dataTransfer.setData('application/x-rt-type', id);
      e.dataTransfer.effectAllowed = 'move';
    }
    return;
  }
  const group = t.closest<HTMLElement>('[data-rt-group]');
  if (!group || !e.dataTransfer?.types.includes('application/x-rt-type')) return;
  if (e.type === 'dragover') {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    group.classList.add('rt-drop');
  } else if (e.type === 'dragleave') {
    if (!group.contains(e.relatedTarget as Node)) group.classList.remove('rt-drop');
  } else if (e.type === 'drop') {
    e.preventDefault();
    group.classList.remove('rt-drop');
    setRailingTypeGroup(store, e.dataTransfer.getData('application/x-rt-type'), group.dataset.rtGroup ?? '');
  }
}
