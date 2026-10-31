import type { Id, ProjectDoc } from '../../core/model';
import { addDefaultOpeningTypes, duplicateOpeningType, missingDefaultOpeningTypes, newOpeningType, openingGroups, openingTypeUses, openingTypesOf, removeOpeningType, updateOpeningType } from '../../core/openings';
import { DOOR_OPS, LEAF_OPS, SIDE_HUNG, WINDOW_OPS, frameFromModule, type CellFill, type LeafStyle, type OpeningCell, type OpeningKind, type OpeningTypeModel, type OpKind, type Track } from '../../core/openingTypes';
import { openingSettingsOf } from '../../core/general';
import type { DocStore } from '../../core/store';
import { askText } from '../ask';
import { escapeHtml } from '../labels';
import { openingPreviewSvg, trackText } from './openingPreview';

/**
 * Dörr- och fönstereditorn (0.11.8, tavla 3): stilboken › Typer › Fönster
 * och dörrar. Samma manér som räckestyp- och profileditorn: typlistan i
 * grupper, typens struktur (karm, rutnät, lufter, mått), ritytan med
 * rutnätets och luftens knappar, och den valda luftens egenskaper.
 * Fälten heter `data-ot` = "fält" och knapparna `data-ot-act`.
 */

export interface OpeningEditorState {
  def: Id | null;
  /** Den valda luften (index i typens `cells`). */
  cell: number | null;
  /** *Prova mått* (modulmått, mm), eller typens förval. */
  tryMod: [number, number] | null;
  query: string;
}

export const newOpeningEditorState = (): OpeningEditorState => ({ def: null, cell: null, tryMod: null, query: '' });

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
const opt = (v: string, label: string, cur: string) => `<option value="${v}"${v === cur ? ' selected' : ''}>${escapeHtml(label)}</option>`;

function chosen(doc: ProjectDoc, st: OpeningEditorState) {
  const types = openingTypesOf(doc);
  if (!st.def || !doc.definitions[st.def]?.opening) st.def = types[0]?.id ?? null;
  const d = st.def ? doc.definitions[st.def] : undefined;
  const m = d?.opening;
  if (m && st.cell !== null && !m.cells[st.cell]) st.cell = null;
  return { d, m };
}

export function openingEditorMarkup(doc: ProjectDoc, st: OpeningEditorState): string {
  const { d, m } = chosen(doc, st);
  const q = st.query.trim().toLowerCase();
  const list = openingGroups(doc)
    .map((g) => {
      const types = openingTypesOf(doc).filter((t) => t.opening!.group === g);
      if (!types.length) return '';
      const rows = types
        .map((t) => {
          const n = openingTypeUses(doc, t.id);
          const hit = !q || `${t.name} ${t.description ?? ''}`.toLowerCase().includes(q);
          return `<button class="rt-type${t.id === st.def ? ' on' : ''}" data-ot-type="${escapeHtml(t.id)}"${hit ? '' : ' hidden'} title="${n ? `${n} i projektet` : 'Används inte'}"><b>${escapeHtml(t.name)}</b><span>${escapeHtml(t.description ?? '')}</span><i>${n || ''}</i></button>`;
        })
        .join('');
      return `<div class="rt-group"><div class="rt-group-head"><span>${escapeHtml(g)}</span></div>${rows}</div>`;
    })
    .join('');
  const missing = missingDefaultOpeningTypes(doc);
  const used = d ? openingTypeUses(doc, d.id) : 0;
  const listCol = `<div class="rt-list">
    <label class="field rt-search"><span>Sök</span><input type="search" data-ot-search placeholder="typ" value="${escapeHtml(st.query)}" autocomplete="off"></label>
    ${list || '<p class="rt-empty">Inga typer än</p>'}
    <div class="rt-list-actions">
      <button class="btn btn-small" data-ot-act="new-window">Nytt fönster…</button>
      <button class="btn btn-small" data-ot-act="new-door">Ny dörr…</button>
      <button class="btn btn-small" data-ot-act="dup"${d ? '' : ' disabled'}>Duplicera</button>
      <button class="btn btn-small" data-ot-act="remove"${d && !used ? '' : ` disabled title="${d ? `Används av ${used} objekt` : ''}"`}>Ta bort</button>
      <button class="btn btn-small" data-ot-act="group"${d ? '' : ' disabled'} title="Flytta den valda typen till en ny eller annan grupp">Ny grupp…</button>
      ${missing ? `<button class="btn btn-small" data-ot-act="defaults" title="Fast, Sidohängt 1-luft … Garageport: de som saknas i projektet">Lägg in förvalda typer (${missing})</button>` : ''}
    </div>
    <p class="note">Siffran: hur många objekt har typen. Vägghålen (ventgaller, nisch, genomföring) kommer med verktyget i 0.11.8.2.</p>
  </div>`;
  if (!d || !m) return section(`${listCol}<div class="rt-typecol"><p class="note">Inga dörr- eller fönstertyper än.</p><button class="btn" data-ot-act="defaults">Lägg in förvalda typer</button></div>`);
  const door = m.kind === 'door';
  const row = (label: string, value: string) => `<div class="rt-row"><span>${label}</span>${value}</div>`;
  const num = (field: string, v: number, title = '') => `<input type="text" class="rt-val" data-ot="${field}" value="${nf.format(v).replace(/\s/g, '')}"${title ? ` title="${escapeHtml(title)}"` : ''}>`;
  const track = (axis: 'col' | 'row', i: number, t: Track, n: number) =>
    `<div class="rt-row"><span>${axis === 'col' ? 'Kolumn' : 'Rad'} ${i + 1}</span><span class="ot-track"><input type="text" class="rt-val ot-size" data-ot="${axis}:${i}:size" value="${t.size}"><select data-ot="${axis}:${i}:unit">${opt('fr', 'andel', t.unit)}${opt('mm', 'mm', t.unit)}</select>${n > 1 ? `<button class="icon-btn" data-ot-act="${axis}-remove" data-ot-i="${i}" title="Ta bort" aria-label="Ta bort">×</button>` : ''}</span></div>`;
  const cells = m.cells
    .map((c, i) => {
      const label = (door ? DOOR_OPS : WINDOW_OPS).concat(door ? WINDOW_OPS : DOOR_OPS).find((o) => o.op === c.op)?.label ?? c.op;
      const hinge = SIDE_HUNG.has(c.op) ? `, ${c.hinge === 'right' ? 'H' : 'V'}` : '';
      const fill = c.fill === 'panel' && !LEAF_OPS.has(c.op) ? ' · panel' : c.fill === 'open' ? ' · öppen' : '';
      return `<button class="rt-part${i === st.cell ? ' on' : ''}" data-ot-act="cell" data-ot-i="${i}"><b>L${i + 1}</b> <span>${escapeHtml(label)}${hinge}${fill}</span><i class="rt-sum">${c.inward ? 'inåt' : LEAF_OPS.has(c.op) ? '' : c.op === 'fixed' ? '' : 'utåt'}</i></button>`;
    })
    .join('');
  const typeCol = `<div class="rt-typecol">
    <div class="rt-title"><input type="text" class="rt-desc" aria-label="Typens namn" data-ot="name" value="${escapeHtml(d.name)}"></div>
    <input type="text" data-ot="description" value="${escapeHtml(d.description ?? '')}" placeholder="Beskrivning" aria-label="Beskrivning">
    <label class="field"><span>Föreskrift</span><input type="text" data-ot="spec" value="${escapeHtml(m.spec ?? '')}" placeholder="Träfönster typ … eller likvärdig"></label>
    <div class="rt-sec">Karm och rutnät</div>
    ${row('Karmens bredd', num('frame.width', m.frame.width))}
    ${row('Karmdjup', num('frame.depth', m.frame.depth))}
    ${row(door ? 'Tröskel' : 'Nederstycke', `<input type="text" class="rt-val" data-ot="frame.bottom" value="${m.frame.bottom ?? ''}" placeholder="${door ? 'Ingen' : 'Som karmen'}" title="${door ? 'Tröskelns höjd, mm (42, låg 25), tomt = ingen' : 'Tomt = ingen'}">`)}
    ${row('Post', num('mullion', m.mullion, '0 = bågarna möts'))}
    ${row('Tvärstycke', num('transom', m.transom))}
    ${m.cols.map((t, i) => track('col', i, t, m.cols.length)).join('')}
    ${m.rows.map((t, i) => track('row', i, t, m.rows.length)).join('')}
    <div class="rt-sec">Lufter</div>
    ${cells}
    <div class="rt-sec">Delar</div>
    ${row('Bågens bredd', num('sash', m.sash))}
    ${row('Bågens djup', num('sashDepth', m.sashDepth))}
    ${door || m.cells.some((c) => LEAF_OPS.has(c.op)) ? row('Bladets tjocklek', num('leaf', m.leaf)) : ''}
    ${row('Foder, bleck, bänk', '<i>0.11.8.1</i>')}
    <div class="rt-sec">Mått</div>
    ${row('Förvalt modulmått', `<input type="text" class="rt-val" data-ot="size" value="${Math.round(m.size[0] / 100)}×${Math.round(m.size[1] / 100)}">`)}
    ${door ? '' : row('Förvald bröstning', `<input type="text" class="rt-val" data-ot="sill" value="${m.sill ?? ''}" placeholder="Överkant karm" title="Tomt: fönstret placeras med överkant karm (stilboken › Allmänt); 0 för en fönsterdörr">`)}
    ${row('Minsta', `<input type="text" class="rt-val" data-ot="min" value="${m.min ? `${m.min[0]}×${m.min[1]}` : ''}" placeholder="–" title="Karmyttermått, mm: en varning, ingen spärr">`)}
    ${row('Största', `<input type="text" class="rt-val" data-ot="max" value="${m.max ? `${m.max[0]}×${m.max[1]}` : ''}" placeholder="–">`)}
    <p class="note">${used ? `Används av ${used} objekt.` : 'Används inte.'}</p>
  </div>`;
  const gap = openingSettingsOf(doc.graphics).gap;
  const mod = st.tryMod ?? m.size;
  const [fw, fh] = frameFromModule(m, mod, gap);
  const ops = door ? [...DOOR_OPS, { op: 'fixed' as OpKind, label: 'Fast' }] : WINDOW_OPS;
  const cur = st.cell !== null ? m.cells[st.cell] : null;
  const tries: [number, number][] = door ? [[800, 2100], [m.size[0], m.size[1]], [1200, 2100]] : [[600, 600], [m.size[0], m.size[1]], [1800, 1500]];
  const canvas = `<div class="rt-typecol">
    <div class="row wrap ot-tools"><span class="rt-sec">Rutnät</span>
      <button class="btn btn-small" data-ot-act="col-add">+ Kolumn</button><button class="btn btn-small" data-ot-act="row-add">+ Rad</button>
      <button class="btn btn-small" data-ot-act="merge"${cur ? '' : ' disabled'} title="Slå ihop den valda luften med luften till höger">Slå ihop</button>
      <button class="btn btn-small" data-ot-act="split"${cur && ((cur.colSpan ?? 1) > 1 || (cur.rowSpan ?? 1) > 1) ? '' : ' disabled'}>Dela</button></div>
    <div class="row wrap ot-tools"><span class="rt-sec">Luften</span>${ops.map((o) => `<button class="btn btn-small${cur?.op === o.op ? ' on' : ''}" data-ot-act="op" data-ot-op="${o.op}"${cur ? '' : ' disabled'} aria-pressed="${cur?.op === o.op}">${escapeHtml(o.label)}</button>`).join('')}</div>
    <div class="row wrap ot-tools"><span class="rt-sec">Prova mått</span>${tries.map(([a, b]) => `<button class="btn btn-small${a === mod[0] && b === mod[1] ? ' on' : ''}" data-ot-act="try" data-ot-w="${a}" data-ot-h="${b}">${Math.round(a / 100)} × ${Math.round(b / 100)}</button>`).join('')}</div>
    <p class="note rt-canvas-hint">Sedd utifrån. Klicka på en luft för att välja den.</p>
    <div class="ot-canvas">${openingPreviewSvg(m, fw, fh, st.cell)}</div>
  </div>`;
  const cellCol = cur ? cellMarkup(m, cur, st.cell!) : `<div class="rt-typecol"><p class="note">Välj en luft i ritytan eller i listan.</p></div>`;
  return section(listCol + typeCol + canvas + cellCol);
}

function cellMarkup(m: OpeningTypeModel, c: OpeningCell, i: number): string {
  const door = m.kind === 'door';
  const ops = door ? [...DOOR_OPS, { op: 'fixed' as OpKind, label: 'Fast' }] : WINDOW_OPS;
  const leaf = LEAF_OPS.has(c.op);
  const row = (label: string, value: string) => `<div class="rt-row"><span>${label}</span>${value}</div>`;
  const sel = (field: string, cur: string, options: [string, string][]) => `<select class="rt-val" data-ot="${field}">${options.map(([v, l]) => opt(v, l, cur)).join('')}</select>`;
  return `<div class="rt-typecol">
    <div class="rt-sec">L${i + 1} · luft</div>
    ${row('Öppningssätt', sel(`cell:${i}:op`, c.op, ops.map((o) => [o.op, o.label])))}
    ${SIDE_HUNG.has(c.op) || c.op === 'slide' || c.op === 'slideLeaf' || c.op === 'pocket' ? row(SIDE_HUNG.has(c.op) ? 'Gångjärn' : 'Skjuts åt', sel(`cell:${i}:hinge`, c.hinge ?? 'left', [['left', 'Vänster'], ['right', 'Höger']])) : ''}
    ${!leaf && c.op !== 'fixed' ? row('Öppnas', sel(`cell:${i}:inward`, c.inward ? 'in' : 'out', [['out', 'Utåt'], ['in', 'Inåt']])) : ''}
    ${leaf ? '' : row('Fyllning', sel(`cell:${i}:fill`, c.fill, [['glass', 'Glas'], ['panel', 'Panel'], ['open', 'Öppen']]))}
    ${leaf ? row('Bladet', sel(`cell:${i}:leaf`, c.leaf ?? 'flat', [['flat', 'Slätt'], ['panel', 'Spegel'], ['glazed', 'Glasat']])) : ''}
    <p class="note">Sedd utifrån. ${SIDE_HUNG.has(c.op) ? 'Gångjärnen ritas som en markering av hängningen, alltid två, 100 från över- och underkant.' : ''} Dörrblad slår åt det håll objektet slår.</p>
    <div class="rt-sec">Mått i rutnätet</div>
    ${row('Bredd', `<i>${trackText(m.cols[c.col])}${(c.colSpan ?? 1) > 1 ? ` + ${(c.colSpan ?? 1) - 1}` : ''}</i>`)}
    ${row('Höjd', `<i>${m.rows.length === 1 ? 'hela' : trackText(m.rows[c.row])}${(c.rowSpan ?? 1) > 1 ? ` + ${(c.rowSpan ?? 1) - 1}` : ''}</i>`)}
    <div class="rt-sec">Spröjs och beslag</div>
    ${row('Spröjs', '<i>0.11.8.1</i>')}
    ${row('Handtag', `<i>${SIDE_HUNG.has(c.op) ? 'låssidan, mitt' : '–'}</i>`)}
  </div>`;
}

const section = (inner: string) =>
  `<section class="style-labels rt-editor ot-editor"><h3>Fönster och dörrar</h3><p class="note">Typen är fabrikens modell och har ett beskrivande namn; litteran räknas fram ur projektets litteraregel (Allmänt). Ändras en typ här ändras alla objekt med den. Rutnätets mått är mm eller andelar av det som blir över.</p><div class="rt-grid">${inner}</div></section>`;

/** Typlistans sökning utan omritning. */
export function openingEditorSearch(root: HTMLElement, st: OpeningEditorState, q: string): void {
  st.query = q;
  const s = q.trim().toLowerCase();
  root.querySelectorAll<HTMLElement>('[data-ot-type]').forEach((b) => (b.hidden = !!s && !(b.textContent ?? '').toLowerCase().includes(s)));
}

function parsePair(raw: string): [number, number] | null {
  const m = raw.trim().match(/^(\d+(?:[.,]\d+)?)\s*[×xX*\s]\s*(\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  return [Number(m[1].replace(',', '.')), Number(m[2].replace(',', '.'))];
}

/** Fälten i editorn. True om fältet hörde hit. */
export function openingEditorChange(store: DocStore, st: OpeningEditorState, input: HTMLInputElement | HTMLSelectElement): boolean {
  const field = input.dataset.ot;
  if (!field || !st.def) return false;
  const def = st.def;
  const raw = input.value;
  const v = Number(raw.replace(',', '.').replace(/\s/g, ''));
  const d = store.doc.definitions[def];
  if (!d?.opening) return true;
  if (field === 'name') {
    if (raw.trim()) updateOpeningType(store, def, `Byt namn: ${raw.trim()}`, () => null, { name: raw.trim() });
    return true;
  }
  if (field === 'description') {
    updateOpeningType(store, def, 'Beskrivning', () => null, { description: raw.trim() || undefined });
    return true;
  }
  const up = (label: string, fn: (m: OpeningTypeModel) => void) =>
    updateOpeningType(store, def, `${d.name}: ${label}`, (m) => {
      fn(m);
      return m;
    });
  const nonneg = Number.isFinite(v) && v >= 0;
  switch (field) {
    case 'spec':
      up('föreskrift', (m) => (raw.trim() ? (m.spec = raw.trim()) : delete m.spec));
      return true;
    case 'frame.width':
    case 'frame.depth':
      if (nonneg) up(field === 'frame.width' ? 'karmens bredd' : 'karmdjup', (m) => (m.frame[field === 'frame.width' ? 'width' : 'depth'] = Math.round(v)));
      return true;
    case 'frame.bottom':
      up(d.opening.kind === 'door' ? 'tröskel' : 'nederstycke', (m) => (m.frame.bottom = raw.trim() === '' || v === 0 ? null : nonneg ? Math.round(v) : m.frame.bottom));
      return true;
    case 'mullion':
    case 'transom':
    case 'sash':
    case 'sashDepth':
    case 'leaf':
      if (nonneg) up(field, (m) => (m[field] = Math.round(v)));
      return true;
    case 'size': {
      const p = parsePair(raw);
      if (p) up('förvalt modulmått', (m) => (m.size = p.map((x) => (x >= 100 ? Math.round(x) : Math.round(x * 100))) as [number, number]));
      return true;
    }
    case 'sill':
      up('förvald bröstning', (m) => (raw.trim() === '' ? delete m.sill : nonneg ? (m.sill = Math.round(v)) : 0));
      return true;
    case 'min':
    case 'max': {
      const p = parsePair(raw);
      up(field === 'min' ? 'minsta mått' : 'största mått', (m) => (raw.trim() === '' ? delete m[field] : p ? (m[field] = p) : 0));
      return true;
    }
  }
  const [what, idx, key] = field.split(':');
  const i = Number(idx);
  if (what === 'col' || what === 'row') {
    up(what === 'col' ? 'kolumn' : 'rad', (m) => {
      const t = (what === 'col' ? m.cols : m.rows)[i];
      if (!t) return;
      if (key === 'unit') t.unit = raw === 'mm' ? 'mm' : 'fr';
      else if (Number.isFinite(v) && v > 0) t.size = v;
    });
    return true;
  }
  if (what === 'cell') {
    up(`L${i + 1}`, (m) => {
      const c = m.cells[i];
      if (!c) return;
      if (key === 'op') setOp(m, c, raw as OpKind);
      else if (key === 'hinge') c.hinge = raw === 'right' ? 'right' : 'left';
      else if (key === 'inward') raw === 'in' ? (c.inward = true) : delete c.inward;
      else if (key === 'fill') c.fill = raw as CellFill;
      else if (key === 'leaf') c.leaf = raw as LeafStyle;
    });
    return true;
  }
  return true;
}

function setOp(m: OpeningTypeModel, c: OpeningCell, op: OpKind): void {
  c.op = op;
  if (SIDE_HUNG.has(op) && !c.hinge) c.hinge = 'left';
  if (LEAF_OPS.has(op)) {
    c.fill = 'panel';
    c.leaf ??= 'flat';
    delete c.inward;
  } else {
    delete c.leaf;
    if (c.fill === 'panel' && m.kind === 'door') c.fill = 'glass';
  }
}

/** Säkerställ att varje ruta i rutnätet har en luft, så att den går att välja. */
function fillGrid(m: OpeningTypeModel): void {
  const covered = new Set<string>();
  for (const c of m.cells) for (let i = c.col; i < c.col + (c.colSpan ?? 1); i++) for (let j = c.row; j < c.row + (c.rowSpan ?? 1); j++) covered.add(`${i},${j}`);
  for (let j = 0; j < m.rows.length; j++) for (let i = 0; i < m.cols.length; i++) if (!covered.has(`${i},${j}`)) m.cells.push({ col: i, row: j, fill: 'glass', op: 'fixed' });
  m.cells.sort((a, b) => a.row - b.row || a.col - b.col);
}

export async function openingEditorClick(store: DocStore, st: OpeningEditorState, target: HTMLElement, rerender: () => void, onError: (msg: string) => void): Promise<boolean> {
  const type = target.closest<HTMLElement>('[data-ot-type]')?.dataset.otType;
  if (type) {
    st.def = type;
    st.cell = null;
    st.tryMod = null;
    rerender();
    return true;
  }
  const cellAt = target.closest<SVGElement>('[data-ot-cell]')?.dataset.otCell;
  if (cellAt && st.def) {
    const [col, row] = cellAt.split(',').map(Number);
    const m = store.doc.definitions[st.def]?.opening;
    if (m) {
      let i = m.cells.findIndex((c) => c.col === col && c.row === row);
      if (i < 0) {
        // En ruta utan luft (fast glas) blir en luft att ändra.
        updateOpeningType(store, st.def, 'Ny luft', (mm) => {
          fillGrid(mm);
          return mm;
        });
        i = store.doc.definitions[st.def]!.opening!.cells.findIndex((c) => c.col === col && c.row === row);
      }
      st.cell = i >= 0 ? i : null;
      rerender();
    }
    return true;
  }
  const btn = target.closest<HTMLElement>('[data-ot-act]');
  if (!btn) return false;
  const act = btn.dataset.otAct!;
  const doc = store.doc;
  const def = st.def;
  const d = def ? doc.definitions[def] : undefined;
  const ix = Number(btn.dataset.otI);
  const up = (label: string, fn: (m: OpeningTypeModel) => void) =>
    def &&
    updateOpeningType(store, def, `${d?.name}: ${label}`, (m) => {
      fn(m);
      return m;
    });
  switch (act) {
    case 'defaults':
      addDefaultOpeningTypes(store);
      break;
    case 'new-window':
    case 'new-door': {
      const kind: OpeningKind = act === 'new-door' ? 'door' : 'window';
      const name = await askText(kind === 'door' ? 'Ny dörrtyp' : 'Ny fönstertyp', kind === 'door' ? 'Ny dörr' : 'Nytt fönster', 'Skapa');
      if (!name?.trim()) return true;
      st.def = newOpeningType(store, kind, kind === 'door' ? 'Dörrar' : 'Fönster', name.trim());
      st.cell = null;
      break;
    }
    case 'dup':
      if (def) st.def = duplicateOpeningType(store, def) ?? def;
      break;
    case 'remove':
      if (def && !removeOpeningType(store, def)) onError('Typen används och kan inte tas bort.');
      else st.def = null;
      break;
    case 'group': {
      if (!d?.opening) return true;
      const name = await askText('Flytta typen till gruppen', d.opening.group, 'Flytta');
      if (name?.trim()) up(`till ${name.trim()}`, (m) => (m.group = name.trim()));
      break;
    }
    case 'cell':
      st.cell = ix;
      break;
    case 'try':
      st.tryMod = [Number(btn.dataset.otW), Number(btn.dataset.otH)];
      break;
    case 'col-add':
      up('ny kolumn', (m) => {
        m.cols.push({ size: 1, unit: 'fr' });
        fillGrid(m);
      });
      break;
    case 'row-add':
      up('ny rad', (m) => {
        // Överljus: en rad överst, 400 mm.
        m.rows.unshift({ size: 400, unit: 'mm' });
        for (const c of m.cells) c.row++;
        fillGrid(m);
        for (const c of m.cells) if (c.row === 0 && c.op === 'fixed') c.op = m.kind === 'door' ? 'fixed' : 'top';
      });
      break;
    case 'col-remove':
    case 'row-remove':
      up(act === 'col-remove' ? 'ta bort kolumn' : 'ta bort rad', (m) => {
        const col = act === 'col-remove';
        (col ? m.cols : m.rows).splice(ix, 1);
        m.cells = m.cells.filter((c) => (col ? c.col : c.row) !== ix);
        for (const c of m.cells) {
          if (col && c.col > ix) c.col--;
          if (!col && c.row > ix) c.row--;
          if (col && c.colSpan && c.col + c.colSpan > m.cols.length) c.colSpan = Math.max(1, m.cols.length - c.col);
          if (!col && c.rowSpan && c.row + c.rowSpan > m.rows.length) c.rowSpan = Math.max(1, m.rows.length - c.row);
        }
        fillGrid(m);
      });
      st.cell = null;
      break;
    case 'merge':
      if (st.cell === null) return true;
      up('slå ihop', (m) => {
        const c = m.cells[st.cell!];
        const right = c.col + (c.colSpan ?? 1);
        if (right >= m.cols.length) return;
        c.colSpan = (c.colSpan ?? 1) + 1;
        m.cells = m.cells.filter((x) => x === c || !(x.col >= c.col && x.col < c.col + c.colSpan! && x.row >= c.row && x.row < c.row + (c.rowSpan ?? 1)));
      });
      st.cell = null;
      break;
    case 'split':
      if (st.cell === null) return true;
      up('dela', (m) => {
        const c = m.cells[st.cell!];
        delete c.colSpan;
        delete c.rowSpan;
        fillGrid(m);
      });
      st.cell = null;
      break;
    case 'op': {
      if (st.cell === null) return true;
      const op = btn.dataset.otOp as OpKind;
      up('öppningssätt', (m) => {
        const c = m.cells[st.cell!];
        if (c) setOp(m, c, op);
      });
      break;
    }
    default:
      return false;
  }
  rerender();
  return true;
}

