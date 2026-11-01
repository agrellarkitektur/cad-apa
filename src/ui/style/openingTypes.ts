import type { Id, ProjectDoc } from '../../core/model';
import { addDefaultOpeningTypes, duplicateOpeningType, missingDefaultOpeningTypes, newOpeningType, openingGroups, openingTypeUses, openingTypesOf, removeOpeningType, updateOpeningType } from '../../core/openings';
import { DOOR_OPS, LEAF_OPS, MUNTIN_KINDS, SIDE_HUNG, WINDOW_OPS, frameFromModule, hardwareOf, hasSash, layoutOpening, leafGridOf, muntinWidth, standsOnFloor, trimOf, type LeafGrid, type MuntinKind, type CellFill, type LeafStyle, type OpeningCell, type OpeningKind, type OpeningTypeModel, type OpKind, type Track } from '../../core/openingTypes';
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
  /** Den valda fyllningen i ett dörrblad (index i bladets `fills`). */
  fill?: number | null;
  /** *Rita spröjs* (special): den första punkten när en linje är påbörjad (andelar av glaset). */
  draw?: { start: [number, number] | null } | null;
}

export const newOpeningEditorState = (): OpeningEditorState => ({ def: null, cell: null, tryMod: null, query: '', fill: null, draw: null });

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
    <p class="note">Siffran: hur många objekt har typen. Vägghålen (ventgaller, nisch, genomföring) kommer med verktyget i 0.11.8.3.</p>
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
    ${trimMarkup(m)}
    ${hardwareMarkup(m)}
    <div class="rt-sec">Mått</div>
    ${row('Förvalt modulmått', `<input type="text" class="rt-val" data-ot="size" value="${Math.round(m.size[0] / 100)}×${Math.round(m.size[1] / 100)}">`)}
    ${door ? '' : row('Förvald bröstning', `<input type="text" class="rt-val" data-ot="sill" value="${m.sill ?? ''}" placeholder="Överkant karm" title="Tomt: fönstret placeras med överkant karm (stilboken › Allmänt); 0 för en fönsterdörr">`)}
    ${m.kind !== 'hole' ? row('Karmavdrag', `<input type="text" class="rt-val" data-ot="frameLess" value="${m.frameLess ?? ''}" placeholder="${openingSettingsOf(doc.graphics).frameLess}" title="Tillverkarens: karmyttermåttet är modulmåttet minus detta, mm. Tomt = stilboken › Allmänt">`) : ''}
    ${row('Minsta', `<input type="text" class="rt-val" data-ot="min" value="${m.min ? `${m.min[0]}×${m.min[1]}` : ''}" placeholder="–" title="Karmyttermått, mm: en varning, ingen spärr">`)}
    ${row('Största', `<input type="text" class="rt-val" data-ot="max" value="${m.max ? `${m.max[0]}×${m.max[1]}` : ''}" placeholder="–">`)}
    <p class="note">${used ? `Används av ${used} objekt.` : 'Används inte.'}</p>
  </div>`;
  const mod = st.tryMod ?? m.size;
  const [fw, fh] = frameFromModule(m, mod, openingSettingsOf(doc.graphics));
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
    <div class="ot-canvas">${openingPreviewSvg(m, fw, fh, st.cell, { fill: st.fill ?? null, drawing: !!st.draw })}</div>
  </div>`;
  const cellCol = cur ? cellMarkup(doc, m, cur, st.cell!, st) : `<div class="rt-typecol"><p class="note">Välj en luft i ritytan eller i listan.</p></div>`;
  return section(listCol + typeCol + canvas + cellCol);
}

function cellMarkup(doc: ProjectDoc, m: OpeningTypeModel, c: OpeningCell, i: number, st: OpeningEditorState): string {
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
    ${leaf ? row('Bladet', sel(`cell:${i}:leaf`, c.leafGrid ? 'custom' : (c.leaf ?? 'flat'), [['flat', 'Slätt'], ['panel', 'Spegel'], ['glazed', 'Glasat'], ...(c.leafGrid ? ([['custom', 'Egen indelning']] as [string, string][]) : [])])) : ''}
    <p class="note">Sedd utifrån. ${SIDE_HUNG.has(c.op) ? 'Gångjärnen ritas som en markering av hängningen, alltid två, 100 från över- och underkant.' : ''} Dörrblad slår åt det håll objektet slår.</p>
    <div class="rt-sec">Mått i rutnätet</div>
    ${row('Bredd', `<i>${trackText(m.cols[c.col])}${(c.colSpan ?? 1) > 1 ? ` + ${(c.colSpan ?? 1) - 1}` : ''}</i>`)}
    ${row('Höjd', `<i>${m.rows.length === 1 ? 'hela' : trackText(m.rows[c.row])}${(c.rowSpan ?? 1) > 1 ? ` + ${(c.rowSpan ?? 1) - 1}` : ''}</i>`)}
    ${!leaf && c.fill === 'panel' ? row('Material', sel(`cell:${i}:material`, c.material ?? '', [['', 'Som karmen'], ...((doc.graphics.materials ?? []) as { id: string; name: string }[]).map((x): [string, string] => [x.id, x.name])])) : ''}
    ${leaf ? leafGridMarkup(doc, c, i, st) : c.fill === 'glass' ? muntinMarkup(doc, m, c, i, st) : ''}
  </div>`;
}

const check = (field: string, label: string, on: boolean, title = '') => `<label class="check"${title ? ` title="${escapeHtml(title)}"` : ''}><input type="checkbox" data-ot="${field}"${on ? ' checked' : ''}> ${escapeHtml(label)}</label>`;
const numIn = (field: string, v: number, title = '') => `<input type="text" class="rt-val" data-ot="${field}" value="${nf.format(v).replace(/\s/g, '')}"${title ? ` title="${escapeHtml(title)}"` : ''}>`;

/** Fodret, blecket och fönsterbänken (0.11.8.2): det som ritas i Detalj. */
function trimMarkup(m: OpeningTypeModel): string {
  if (m.kind === 'hole') return '';
  const t = trimOf(m);
  const win = m.kind === 'window' && !standsOnFloor(m);
  return `<div class="rt-sec">Foder${win ? ', bleck och bänk' : ''}</div>
    ${rowOf('Foder', selOf('trim.sides', t.lining.sides, [['both', 'Båda sidor'], ['in', 'Inne'], ['out', 'Ute'], ['none', 'Inget']]))}
    ${t.lining.sides !== 'none' ? rowOf('Fodrets bredd', numIn('trim.width', t.lining.width)) + rowOf('Fodrets tjocklek', numIn('trim.thickness', t.lining.thickness)) : ''}
    ${
      win
        ? rowOf('Bleck', selOf('trim.flashing', t.flashing ? 'on' : 'off', [['on', 'Med droppnäsa'], ['off', 'Inget']])) +
          (t.flashing ? rowOf('Utsprång', numIn('trim.overhang', t.flashing.overhang, 'mm förbi väggens liv')) + rowOf('Droppnäsa', numIn('trim.drip', t.flashing.drip, 'Höjden, mm')) : '') +
          rowOf('Fönsterbänk', selOf('trim.board', t.board ? 'on' : 'off', [['on', 'Invändig'], ['off', 'Ingen']])) +
          (t.board ? rowOf('Bänkens tjocklek', numIn('trim.boardT', t.board.thickness)) + rowOf('Bänkens utsprång', numIn('trim.boardOver', t.board.overhang, 'mm förbi väggens liv')) : '')
        : ''
    }
    <p class="note">Ritas i Detalj: i planen, fasaden, sektionen och 3D. Bleck och bänk i ytterväggar.</p>`;
}

/** Beslagen (0.11.8.2): handtag, gångjärnens markering och dörrarnas stängare och brevinkast. */
function hardwareMarkup(m: OpeningTypeModel): string {
  if (m.kind === 'hole') return '';
  const h = hardwareOf(m);
  const door = m.cells.some((c) => LEAF_OPS.has(c.op));
  return `<div class="rt-sec">Beslag</div>
    ${rowOf('Handtag', selOf('hw.handle', h.handle, door ? [['lever', 'Trycke'], ['pull', 'Draghandtag'], ['none', 'Inget']] : [['lever', 'Handtag'], ['none', 'Inget']]))}
    ${door && h.handle !== 'none' ? rowOf('Höjd', numIn('hw.handleHeight', h.handleHeight, 'Handtagets höjd över golvet, mm')) : ''}
    <div class="row wrap">${check('hw.hinges', 'Gångjärn', h.hinges, 'En markering av hängningen: två, 100 från över- och underkant')}${door ? check('hw.closer', 'Dörrstängare', h.closer) + check('hw.letterbox', 'Brevinkast', h.letterbox) : ''}</div>
    <p class="note">${door ? 'Handtaget på låssidan; ' : 'Handtaget inne på låssidan, mitt på bågen (nertill på överkantshängda); '}ritas i Detalj.</p>`;
}

const rowOf = (label: string, value: string) => `<div class="rt-row"><span>${label}</span>${value}</div>`;
const selOf = (field: string, cur: string, options: [string, string][]) => `<select class="rt-val" data-ot="${field}">${options.map(([v, l]) => opt(v, l, cur)).join('')}</select>`;

/** Spröjsen i en glasluft (0.11.8.1): inga, jämnt fördelade (antal lodräta och vågräta) eller special (ritade referenslinjer, med skrivna mått sedan 0.11.8.2). */
function muntinMarkup(doc: ProjectDoc, m: OpeningTypeModel, c: OpeningCell, i: number, st: OpeningEditorState): string {
  const mu = c.muntins;
  const mode = !mu ? 'none' : mu.lines || (st.draw && st.cell === i) ? 'special' : 'even';
  const w = mu ? muntinWidth(mu) : 28;
  const drawing = !!st.draw && st.cell === i;
  const gl = glassRectOf(doc, m, st, i);
  // Referenslinjernas ändar i mm från glasets nedre vänstra hörn, sett utifrån, i det mått ritytan visar.
  const W = gl ? gl.u1 - gl.u0 : 1;
  const H = gl ? gl.z1 - gl.z0 : 1;
  const lineRows = (mu?.lines ?? [])
    .map((l, j) => {
      const v = (k: string, x: number) => `<input type="text" class="rt-val ot-mm" data-ot="mline:${i}:${j}:${k}" value="${Math.round(x)}" aria-label="${k}">`;
      return `<div class="rt-row ot-mline"><span>S${j + 1}</span><span class="ot-track">${v('ax', l.a[0] * W)}${v('ay', l.a[1] * H)}<i>→</i>${v('bx', l.b[0] * W)}${v('by', l.b[1] * H)}<button class="icon-btn" data-ot-act="mline-remove" data-ot-i="${j}" title="Ta bort" aria-label="Ta bort">×</button></span></div>`;
    })
    .join('');
  return `<div class="rt-sec">Spröjs</div>
    ${rowOf('Indelning', selOf(`cell:${i}:mmode`, mode, [['none', 'Inga'], ['even', 'Jämn'], ['special', 'Special']]))}
    ${mode === 'even' ? rowOf('Lodräta', `<input type="text" class="rt-val" data-ot="cell:${i}:mv" value="${mu?.v ?? 0}">`) + rowOf('Vågräta', `<input type="text" class="rt-val" data-ot="cell:${i}:mh" value="${mu?.h ?? 0}">`) : ''}
    ${
      mode === 'special'
        ? `<div class="row wrap ot-tools"><button class="btn btn-small${drawing ? ' on' : ''}" data-ot-act="mdraw" aria-pressed="${drawing}">${drawing ? 'Klar' : 'Rita spröjs'}</button><button class="btn btn-small" data-ot-act="madd-v" title="En lodrät spröjs mitt i glaset, att skriva måttet på">+ Lodrät</button><button class="btn btn-small" data-ot-act="madd-h" title="En vågrät spröjs mitt i glaset">+ Vågrät</button><button class="btn btn-small" data-ot-act="mundo"${mu?.lines?.length ? '' : ' disabled'}>Ta bort senaste</button><button class="btn btn-small" data-ot-act="mclear"${mu?.lines?.length ? '' : ' disabled'}>Rensa</button></div>
      <p class="note">Klicka två punkter i glaset för en referenslinje; punkterna snäpper till kanterna, mitten, tredjedelar, fjärdedelar och andra spröjs. Eller skriv måtten nedan: x och y i mm från glasets nedre vänstra hörn sett utifrån, i det mått ritytan visar (${Math.round(W)} × ${Math.round(H)}). Linjerna följer glaset när måttet ändras.</p>
      ${lineRows}`
        : ''
    }
    ${mu ? rowOf('Utförande', selOf(`cell:${i}:mkind`, mu.kind, MUNTIN_KINDS.map((k) => [k.kind, `${k.label} (${k.width})`]))) + rowOf('Bredd', `<input type="text" class="rt-val" data-ot="cell:${i}:mwidth" value="${mu.width ?? ''}" placeholder="${w}">`) : ''}`;
}

/** Dörrbladets indelning (0.11.8.1): spåren (mm står kvar, andelar växer) och den valda fyllningens material. */
function leafGridMarkup(doc: ProjectDoc, c: OpeningCell, i: number, st: OpeningEditorState): string {
  const g = leafGridOf(c);
  if (!g) return '<div class="rt-sec">Indelning</div><p class="note">Slätt blad. Välj Spegel eller Glasat för en indelning att ändra.</p>';
  const track = (axis: 'lcol' | 'lrow', j: number, t: Track, n: number) =>
    `<div class="rt-row"><span>${axis === 'lcol' ? 'Kolumn' : 'Rad'} ${j + 1}</span><span class="ot-track"><input type="text" class="rt-val ot-size" data-ot="${axis}:${i}:${j}:size" value="${t.size}"><select data-ot="${axis}:${i}:${j}:unit">${opt('fr', 'andel', t.unit)}${opt('mm', 'mm', t.unit)}</select>${n > 1 ? `<button class="icon-btn" data-ot-act="${axis}-remove" data-ot-i="${j}" title="Ta bort" aria-label="Ta bort">×</button>` : ''}</span></div>`;
  const f = st.fill !== null && st.fill !== undefined ? g.fills[st.fill] : undefined;
  const mats = (doc.graphics.materials ?? []) as { id: string; name: string }[];
  return `<div class="rt-sec">Indelning</div>
    <p class="note">Bladets rutnät sett utifrån, uppifrån. Mått i mm står kvar (ramstyckena, avstånden till kanterna) och andelarna växer med bladet, så att samma typ fungerar i alla storlekar. Klicka en ruta i bladet för en ny fyllning, en fyllning för att välja den.</p>
    ${g.cols.map((t, j) => track('lcol', j, t, g.cols.length)).join('')}
    ${g.rows.map((t, j) => track('lrow', j, t, g.rows.length)).join('')}
    <div class="row wrap ot-tools"><button class="btn btn-small" data-ot-act="lcol-add">+ Kolumn</button><button class="btn btn-small" data-ot-act="lrow-add">+ Rad</button></div>
    <div class="rt-sec">${f ? `Fyllning ${st.fill! + 1}` : `Fyllningar (${g.fills.length})`}</div>
    ${
      f
        ? rowOf('Material', selOf(`lfill:${i}:${st.fill}:material`, f.glass ? 'glass' : (f.material ?? ''), [['', 'Som bladet'], ['glass', 'Glas'], ...mats.map((m): [string, string] => [m.id, m.name])])) +
          `<div class="row wrap ot-tools"><button class="btn btn-small" data-ot-act="lfill-wide"${f.col + (f.colSpan ?? 1) < g.cols.length ? '' : ' disabled'}>Bredda åt höger</button><button class="btn btn-small" data-ot-act="lfill-tall"${f.row + (f.rowSpan ?? 1) < g.rows.length ? '' : ' disabled'}>Förläng nedåt</button><button class="btn btn-small" data-ot-act="lfill-remove">Ta bort fyllningen</button></div>`
        : '<p class="note">Ingen vald.</p>'
    }`;
}

/** Bladets indelning att ändra: den egna, eller en kopia av förvalet (Spegel, Glasat). */
function ownLeafGrid(c: OpeningCell): LeafGrid {
  if (!c.leafGrid) c.leafGrid = structuredClone(leafGridOf(c) ?? { cols: [{ size: 1, unit: 'fr' }], rows: [{ size: 1, unit: 'fr' }], fills: [] });
  return c.leafGrid;
}

/** En punkt i glaset (andelar), snäppt till kanter, delningar och andra spröjs. */
export function snapMuntinPoint(p: [number, number], lines: readonly { a: [number, number]; b: [number, number] }[], start: [number, number] | null): [number, number] {
  const T = [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1];
  const ends = lines.flatMap((l) => [l.a, l.b]);
  const near = ends.find((e) => Math.hypot(e[0] - p[0], e[1] - p[1]) < 0.04);
  if (near) return [near[0], near[1]];
  const snap1 = (v: number, extra: number[]) => {
    const all = [...T, ...extra];
    const best = all.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), all[0]);
    // Kanterna drar lite längre än delningarna.
    return Math.abs(best - v) < (best === 0 || best === 1 ? 0.06 : 0.035) ? best : v;
  };
  // Lodräta och vågräta spröjs: deras läge snäpper den andra axeln.
  const vx = lines.filter((l) => Math.abs(l.a[0] - l.b[0]) < 1e-6).map((l) => l.a[0]);
  const hz = lines.filter((l) => Math.abs(l.a[1] - l.b[1]) < 1e-6).map((l) => l.a[1]);
  let q: [number, number] = [snap1(p[0], vx), snap1(p[1], hz)];
  if (start) {
    const dx = q[0] - start[0];
    const dz = q[1] - start[1];
    const ang = Math.abs((Math.atan2(dz, dx) * 180) / Math.PI);
    if (ang < 8 || ang > 172) q = [q[0], start[1]];
    else if (Math.abs(ang - 90) < 8) q = [start[0], q[1]];
  }
  return [Math.max(0, Math.min(1, q[0])), Math.max(0, Math.min(1, q[1]))];
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
    case 'frameLess':
      up('karmavdrag', (m) => (raw.trim() === '' ? delete m.frameLess : nonneg ? (m.frameLess = Math.min(100, Math.round(v))) : 0));
      return true;
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
  if (field.startsWith('trim.') || field.startsWith('hw.')) {
    const on = (input as HTMLInputElement).type === 'checkbox' ? (input as HTMLInputElement).checked : raw === 'on';
    up(field.startsWith('hw.') ? 'beslag' : 'foder, bleck och bänk', (m) => {
      const t = trimOf(m);
      const h = hardwareOf(m);
      const pos = (x: number) => Number.isFinite(v) && v >= 0 ? Math.round(v) : x;
      switch (field) {
        case 'trim.sides': t.lining.sides = raw as typeof t.lining.sides; break;
        case 'trim.width': t.lining.width = pos(t.lining.width); break;
        case 'trim.thickness': t.lining.thickness = pos(t.lining.thickness); break;
        case 'trim.flashing': t.flashing = on ? (t.flashing ?? { overhang: 40, drip: 20 }) : null; break;
        case 'trim.overhang': if (t.flashing) t.flashing.overhang = pos(t.flashing.overhang); break;
        case 'trim.drip': if (t.flashing) t.flashing.drip = pos(t.flashing.drip); break;
        case 'trim.board': t.board = on ? (t.board ?? { thickness: 22, overhang: 20 }) : null; break;
        case 'trim.boardT': if (t.board) t.board.thickness = Math.max(1, pos(t.board.thickness)); break;
        case 'trim.boardOver': if (t.board) t.board.overhang = pos(t.board.overhang); break;
        case 'hw.handle': h.handle = raw as typeof h.handle; break;
        case 'hw.handleHeight': h.handleHeight = pos(h.handleHeight); break;
        case 'hw.hinges': case 'hw.closer': case 'hw.letterbox': h[field.slice(3) as 'hinges' | 'closer' | 'letterbox'] = on; break;
      }
      if (field.startsWith('hw.')) m.hardware = h;
      else m.trim = t;
    });
    return true;
  }
  const [what, idx, key] = field.split(':');
  const i = Number(idx);
  if (what === 'mline') {
    const j = Number(key);
    const k = field.split(':')[3];
    const gl = glassRectOf(store.doc, d.opening, st, i);
    if (!gl || !Number.isFinite(v)) return true;
    up('spröjs', (m) => {
      const l = m.cells[i]?.muntins?.lines?.[j];
      if (!l) return;
      const frac = Math.max(0, Math.min(1, k.endsWith('x') ? v / (gl.u1 - gl.u0) : v / (gl.z1 - gl.z0)));
      (k.startsWith('a') ? l.a : l.b)[k.endsWith('x') ? 0 : 1] = frac;
    });
    return true;
  }
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
      else if (key === 'material') raw ? (c.material = raw) : delete c.material;
      else if (key === 'leaf') {
        if (raw === 'custom') return;
        c.leaf = raw as LeafStyle;
        delete c.leafGrid;
        st.fill = null;
      } else if (key === 'mmode') {
        if (raw === 'none') delete c.muntins;
        else if (raw === 'even') c.muntins = { v: c.muntins?.v || 1, h: c.muntins?.h || 1, kind: c.muntins?.kind ?? 'loose', ...(c.muntins?.width ? { width: c.muntins.width } : {}) };
        else c.muntins = { v: 0, h: 0, kind: c.muntins?.kind ?? 'loose', ...(c.muntins?.width ? { width: c.muntins.width } : {}), lines: c.muntins?.lines ?? [] };
        st.draw = raw === 'special' ? { start: null } : null;
      } else if (c.muntins && (key === 'mv' || key === 'mh')) {
        if (Number.isFinite(v) && v >= 0) c.muntins[key === 'mv' ? 'v' : 'h'] = Math.min(20, Math.round(v));
      } else if (c.muntins && key === 'mkind') c.muntins.kind = raw as MuntinKind;
      else if (c.muntins && key === 'mwidth') raw.trim() === '' ? delete c.muntins.width : Number.isFinite(v) && v > 0 && (c.muntins.width = Math.round(v));
    });
    return true;
  }
  if (what === 'lcol' || what === 'lrow') {
    const j = Number(key);
    const k2 = field.split(':')[3];
    up(what === 'lcol' ? 'bladets kolumn' : 'bladets rad', (m) => {
      const c = m.cells[i];
      if (!c) return;
      const t = (what === 'lcol' ? ownLeafGrid(c).cols : ownLeafGrid(c).rows)[j];
      if (!t) return;
      if (k2 === 'unit') t.unit = raw === 'mm' ? 'mm' : 'fr';
      else if (Number.isFinite(v) && v > 0) t.size = v;
    });
    return true;
  }
  if (what === 'lfill') {
    const j = Number(key);
    up('fyllningens material', (m) => {
      const c = m.cells[i];
      const f = c ? ownLeafGrid(c).fills[j] : undefined;
      if (!f) return;
      delete f.glass;
      delete f.material;
      if (raw === 'glass') f.glass = true;
      else if (raw) f.material = raw;
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

/** Den valda luftens glas (u, z i mm) i det mått ritytan visar. */
function glassRectOf(doc: ProjectDoc, m: OpeningTypeModel, st: OpeningEditorState, i: number): { u0: number; u1: number; z0: number; z1: number; h: number } | null {
  const [fw, fh] = frameFromModule(m, st.tryMod ?? m.size, openingSettingsOf(doc.graphics));
  const c = m.cells[i];
  const laid = c && layoutOpening(m, fw, fh).cells.find((x) => x.col === c.col && x.row === c.row);
  if (!laid) return null;
  const r = laid.rect;
  const s = hasSash(laid) ? Math.min(m.sash, (r.u1 - r.u0) / 3, (r.z1 - r.z0) / 3) : 0;
  return { u0: r.u0 + s, u1: r.u1 - s, z0: r.z0 + s, z1: r.z1 - s, h: fh };
}

export async function openingEditorClick(store: DocStore, st: OpeningEditorState, target: HTMLElement, rerender: () => void, onError: (msg: string) => void, ev?: MouseEvent): Promise<boolean> {
  const type = target.closest<HTMLElement>('[data-ot-type]')?.dataset.otType;
  if (type) {
    st.def = type;
    st.cell = null;
    st.tryMod = null;
    st.fill = null;
    st.draw = null;
    rerender();
    return true;
  }
  // Rita spröjs (special): två klick i den valda luftens glas ger en referenslinje.
  const svg = target.closest<SVGSVGElement>('svg.op-preview');
  if (svg && st.draw && st.def && st.cell !== null && ev) {
    const m = store.doc.definitions[st.def]?.opening;
    const gl = m && glassRectOf(store.doc, m, st, st.cell);
    const ctm = svg.getScreenCTM();
    if (!m || !gl || !ctm) return true;
    const pt = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(ctm.inverse());
    const raw: [number, number] = [(pt.x - gl.u0) / (gl.u1 - gl.u0), (gl.h - pt.y - gl.z0) / (gl.z1 - gl.z0)];
    if (raw[0] < -0.05 || raw[0] > 1.05 || raw[1] < -0.05 || raw[1] > 1.05) return true;
    const lines = m.cells[st.cell].muntins?.lines ?? [];
    const p = snapMuntinPoint(raw, lines, st.draw.start);
    if (!st.draw.start) st.draw.start = p;
    else {
      const a = st.draw.start;
      st.draw.start = null;
      if (Math.hypot(p[0] - a[0], p[1] - a[1]) > 0.02)
        updateOpeningType(store, st.def, 'Spröjs', (mm) => {
          const c = mm.cells[st.cell!];
          c.muntins = { ...(c.muntins ?? { v: 0, h: 0, kind: 'loose' }), lines: [...(c.muntins?.lines ?? []), { a, b: p }] };
          return mm;
        });
    }
    rerender();
    return true;
  }
  // Dörrbladets indelning: en ruta blir en fyllning, en fyllning väljs.
  const lcell = target.closest<SVGElement>('[data-ot-lcell]')?.dataset.otLcell;
  if (lcell && st.def && st.cell !== null) {
    const [col, row] = lcell.split(',').map(Number);
    updateOpeningType(store, st.def, 'Ny fyllning', (mm) => {
      const g = ownLeafGrid(mm.cells[st.cell!]);
      g.fills.push({ col, row });
      st.fill = g.fills.length - 1;
      return mm;
    });
    rerender();
    return true;
  }
  const fillAt = target.closest<SVGElement>('[data-ot-fill]')?.dataset.otFill;
  if (fillAt !== undefined && st.cell !== null) {
    st.fill = Number(fillAt);
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
      if (st.cell !== i) {
        st.fill = null;
        st.draw = null;
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
      if (st.cell !== ix) {
        st.fill = null;
        st.draw = null;
      }
      st.cell = ix;
      break;
    case 'mdraw':
      st.draw = st.draw ? null : { start: null };
      break;
    case 'madd-v':
    case 'madd-h':
      if (st.cell === null) return true;
      up('spröjs', (m) => {
        const c = m.cells[st.cell!];
        if (!c) return;
        const line = act === 'madd-v' ? { a: [0.5, 0] as [number, number], b: [0.5, 1] as [number, number] } : { a: [0, 0.5] as [number, number], b: [1, 0.5] as [number, number] };
        c.muntins = { ...(c.muntins ?? { v: 0, h: 0, kind: 'loose' }), v: 0, h: 0, lines: [...(c.muntins?.lines ?? []), line] };
      });
      break;
    case 'mline-remove':
      if (st.cell === null) return true;
      up('ta bort spröjs', (m) => {
        const mu = m.cells[st.cell!]?.muntins;
        if (mu?.lines) mu.lines = mu.lines.filter((_, k) => k !== ix);
      });
      break;
    case 'mundo':
    case 'mclear':
      if (st.cell === null) return true;
      up(act === 'mundo' ? 'ta bort spröjs' : 'rensa spröjs', (m) => {
        const mu = m.cells[st.cell!]?.muntins;
        if (mu?.lines) mu.lines = act === 'mundo' ? mu.lines.slice(0, -1) : [];
      });
      if (st.draw) st.draw.start = null;
      break;
    case 'lcol-add':
    case 'lrow-add':
      if (st.cell === null) return true;
      up(act === 'lcol-add' ? 'bladets kolumn' : 'bladets rad', (m) => {
        const g = ownLeafGrid(m.cells[st.cell!]);
        (act === 'lcol-add' ? g.cols : g.rows).push({ size: 1, unit: 'fr' });
      });
      break;
    case 'lcol-remove':
    case 'lrow-remove':
      if (st.cell === null) return true;
      up('ta bort ur bladets indelning', (m) => {
        const g = ownLeafGrid(m.cells[st.cell!]);
        const col = act === 'lcol-remove';
        (col ? g.cols : g.rows).splice(ix, 1);
        g.fills = g.fills.filter((f) => !((col ? f.col : f.row) <= ix && (col ? f.col + (f.colSpan ?? 1) : f.row + (f.rowSpan ?? 1)) > ix));
        for (const f of g.fills) {
          if (col && f.col > ix) f.col--;
          if (!col && f.row > ix) f.row--;
        }
      });
      st.fill = null;
      break;
    case 'lfill-wide':
    case 'lfill-tall':
    case 'lfill-remove':
      if (st.cell === null || st.fill === null || st.fill === undefined) return true;
      up(act === 'lfill-remove' ? 'ta bort fyllningen' : 'större fyllning', (m) => {
        const g = ownLeafGrid(m.cells[st.cell!]);
        const f = g.fills[st.fill!];
        if (!f) return;
        if (act === 'lfill-remove') {
          g.fills.splice(st.fill!, 1);
          return;
        }
        if (act === 'lfill-wide') f.colSpan = (f.colSpan ?? 1) + 1;
        else f.rowSpan = (f.rowSpan ?? 1) + 1;
        // Fyllningar som nu täcks tas bort.
        const c0 = f.col, c1 = f.col + (f.colSpan ?? 1), r0 = f.row, r1 = f.row + (f.rowSpan ?? 1);
        g.fills = g.fills.filter((x) => x === f || x.col >= c1 || x.col + (x.colSpan ?? 1) <= c0 || x.row >= r1 || x.row + (x.rowSpan ?? 1) <= r0);
        st.fill = g.fills.indexOf(f);
      });
      if (act === 'lfill-remove') st.fill = null;
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

