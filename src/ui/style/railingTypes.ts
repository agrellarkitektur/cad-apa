import type { DocStore } from '../../core/store';
import type { Id, ProjectDoc } from '../../core/model';
import { PART_KIND_LABELS, railNum, railValues, type RailingTypeModel, type RailNum, type RailPart, type RailPartKind } from '../../core/railingTypes';
import { addRailingGroup, addRailingType, ensureRailingTypes, moveRailingGroup, moveRailingPart, newRailingModel, railingGroups, railingPrefix, railingTypesIn, railingTypeUses, removeRailingGroup, removeRailingType, renameRailingGroup, setRailingTypeGroup } from '../../core/railings';
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
}

export const newRailEditorState = (): RailEditorState => ({ def: null, part: null, mode: 'straight' });

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
  const list = groups
    .map((g, gi) => {
      const types = railingTypesIn(doc, g);
      const rows = types
        .map((d) => {
          const n = railingTypeUses(doc, d.id);
          return `<button class="rt-type${d.id === def ? ' on' : ''}" draggable="true" data-rt-type="${escapeHtml(d.id)}" title="Dra till en annan grupp för att flytta typen"><b>${escapeHtml(d.name)}</b><span>${escapeHtml(d.description ?? '')}</span><i>${n || ''}</i></button>`;
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
  const listCol = `<div class="rt-list">
    ${list}
    <div class="rt-list-actions">
      <button class="btn btn-small" data-rt-act="type-new">Ny typ…</button>
      <button class="btn btn-small" data-rt-act="type-dup"${def ? '' : ' disabled'}>Duplicera</button>
      <button class="btn btn-small" data-rt-act="type-remove"${def && !used ? '' : ` disabled title="${def ? `Används av ${used} räcken` : ''}"`}>Ta bort</button>
      <button class="btn btn-small" data-rt-act="group-new">Ny grupp…</button>
    </div>
  </div>`;
  if (!def || !model) return section(`${listCol}<div class="rt-center"><p class="note">Inga räckestyper än. <b>Ny typ…</b> lägger till en, och de förvalda (RÄ01–RÄ03) kommer första gången ett räcke läggs.</p><div class="row"><button class="btn" data-rt-act="types-default">Lägg in RÄ01–RÄ03</button></div></div>`);
  const d = doc.definitions[def];
  const k = (rest: string) => `rail:type:${def}:${rest}`;
  const head = `<div class="rt-head">
    <label class="field"><span>Littera</span><input type="text" data-key="${k('name')}" value="${escapeHtml(d.name)}"></label>
    <label class="field rt-desc"><span>Beskrivning</span><input type="text" data-key="${k('description')}" value="${escapeHtml(d.description ?? '')}"></label>
    <span class="rt-checks">
      <label class="check" title="Visas på Platsen"><input type="checkbox" data-key="${k('ground')}"${model.ground ? ' checked' : ''}> Mark</label>
      <label class="check" title="Visas på våningarna"><input type="checkbox" data-key="${k('building')}"${model.building ? ' checked' : ''}> Byggnad</label>
      <label class="check" title="Varningarna för öppningar och klätterbarhet (BFS 2024:9, 2 kap. 11 §)"><input type="checkbox" data-key="${k('childSafe')}"${model.childSafe ? ' checked' : ''}> Barnsäkert</label>
      <span class="rt-used">${used ? `${used} ${used === 1 ? 'räcke' : 'räcken'} i projektet` : 'Används inte'}</span>
    </span>
  </div>`;
  const tabs = `<div class="rt-tabs" role="tablist">${PREVIEW_MODES.map(([m, l]) => `<button role="tab" data-rt-mode="${m}" aria-selected="${m === st.mode}" class="${m === st.mode ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const preview = `<div class="rt-preview">${tabs}<div class="rt-canvas">${previewMarkup(model, st.mode, part?.id ?? null)}</div><p class="note">Klicka på en del för att välja den.</p></div>`;
  const tree = model.parts
    .map(
      (q, i) => `<li class="rt-part${q.id === part?.id ? ' on' : ''}" data-rt-part="${escapeHtml(q.id)}">
        <span class="rt-kind rt-kind-${q.kind}" aria-hidden="true"></span><b>${escapeHtml(q.name)}</b><span class="rt-kindname">${PART_KIND_LABELS[q.kind]}</span>
        <button class="icon-btn" data-rt-act="part-up" data-rt-p="${escapeHtml(q.id)}"${i ? '' : ' disabled'} title="Flytta upp" aria-label="Flytta upp">↑</button>
        <button class="icon-btn" data-rt-act="part-down" data-rt-p="${escapeHtml(q.id)}"${i < model.parts.length - 1 ? '' : ' disabled'} title="Flytta ned" aria-label="Flytta ned">↓</button>
        <button class="icon-btn" data-action="railtype-part-remove" data-def="${escapeHtml(def)}" data-index="${i}" title="Ta bort delen" aria-label="Ta bort">×</button>
      </li>`,
    )
    .join('');
  const add = `<details class="rt-add"><summary class="btn btn-small">+ Lägg till del…</summary><div>${(Object.keys(PART_KIND_LABELS) as RailPartKind[])
    .map((kind) => `<button class="btn btn-small" data-action="railtype-part-add" data-def="${escapeHtml(def)}" data-kind="${kind}" title="${KIND_HINT[kind]}">${PART_KIND_LABELS[kind]}</button>`)
    .join('')}</div></details>`;
  const center = `<div class="rt-center">${head}${preview}<div class="field-label">Delar</div><ul class="rt-tree">${tree}</ul>${add}</div>`;
  const side = `<div class="rt-side">${part ? partMarkup(doc, def, model, part) : '<p class="note">Typen har inga delar.</p>'}${paramsMarkup(def, model)}</div>`;
  return section(`${listCol}${center}${side}`);
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
    ], 'Gäller på Platsen, från 0.11.3') +
    select('gate', 'Vid grind', q.gate ?? 'break', [
      ['break', 'Avbryts'],
      ['continue', 'Fortsätter'],
    ], 'Grindarna kommer i 0.11.3; förhandsvisningen Grind visar det redan');
  const below = q.kind === 'point' ? `${text('depth', 'Under mark', q.below?.depth, 'Nedgrävd längd, på Platsen (0.11.3)')}${check('footing', 'I plint', !!q.below?.footing)}` : '';
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
    ${group('Profil och material', profile + mat)}
    ${group('Läge', place)}
    ${group(q.kind === 'along' ? 'Ändar' : 'Stolparna', ends)}
    ${group('Beteende', behaviour)}
    ${group('Under mark', below)}
    ${group('Ritningen', drawing)}
  </div>`;
}


function paramsMarkup(def: Id, m: RailingTypeModel): string {
  const k = (rest: string) => `rail:type:${def}:${rest}`;
  const vals = railValues(m);
  const rows = m.params
    .map(
      (q, i) => `<li class="rail-param">
        <input type="text" aria-label="Namn" data-key="${k(`param:${i}:name`)}" value="${escapeHtml(q.name)}">
        <input type="text" aria-label="Värde eller formel" data-key="${k(`param:${i}:value`)}" value="${escapeHtml(String(q.value))}" title="${typeof q.value === 'string' ? `= ${mm(vals.get(q.name) ?? 0)} mm` : 'mm, eller en formel med de andra parametrarna'}">
        <label class="check" title="Får ändras på det enskilda räcket"><input type="checkbox" data-key="${k(`param:${i}:per`)}"${q.perRailing ? ' checked' : ''}> per räcke</label>
        <button class="icon-btn" data-action="railtype-param-remove" data-def="${escapeHtml(def)}" data-index="${i}" title="Ta bort parametern" aria-label="Ta bort">×</button>
      </li>`,
    )
    .join('');
  return `<div class="field-label">Typens parametrar</div><ul class="rail-params">${rows}</ul><div class="row"><button class="btn btn-small" data-action="railtype-param-add" data-def="${escapeHtml(def)}">+ Parameter</button></div><p class="note">Kryssa <i>per räcke</i> för de mått som får ändras på det enskilda räcket.</p>`;
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
      store.transact('Lägg in räckestyperna', (tx) => ensureRailingTypes(tx));
      st.def = 't-ra01';
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
