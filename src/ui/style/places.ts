import type { NumberedPen, StyleBook } from '../../core/graphics';
import type { Element, Id, ProjectDoc } from '../../core/model';
import { isSite } from '../../core/model';
import { lineTypeList } from '../../core/lineTypes';
import { fillTypeList } from '../../core/fillTypes';
import { materialObjectsByMaterial } from '../../core/materials';
import { typeOf } from '../../elements/registry';
import { colorKey, lineTypeName, penKey, penOrder, penTable, stylePlaces, COLOR_RANK, type StylePlace } from '../../repr/penPlaces';
import { escapeHtml } from '../labels';
import { icons } from '../icons';
import { weightPicker } from '../weightPick';
import { toHex } from './colors';

/**
 * Pennor och ställen (0.10.36, tavla 3): till vänster pennlistan (nummer,
 * prov, tjocklek, färg och antal ställen), till höger ställena med sök,
 * automatiska taggar (vytyp och objekt), byt per ställe, *Gå dit* och
 * *Flytta till pennan…* för de markerade. Samma lista över ställen finns
 * under linjetyperna, fyllningstyperna och materialen (där är ställena
 * objekten med materialet).
 */

export type PlaceKind = 'pen' | 'linetype' | 'filltype' | 'material';

/** En rad i listan över ställen: ett ställe i stilboken, eller (materialen) ett objekt. */
export interface PlaceRow {
  id: string;
  label: string;
  sub: string;
  whereName: string;
  viewTags: string[];
  tags: string[];
  /** Värdet i resurslistan: pennans nummer, linjetypens, fyllningstypens eller materialets nyckel. */
  value: string;
  place?: StylePlace;
  object?: { id: Id; nested?: string };
}

/** Det som väljs och filtreras i listan, per sort. */
export interface PlacesState {
  /** Pennan, linjetypen … vars ställen visas; '' = alla. */
  filter: Partial<Record<PlaceKind, string>>;
  tags: Set<string>;
  checked: Set<string>;
  query: string;
}

export const newPlacesState = (): PlacesState => ({ filter: {}, tags: new Set(), checked: new Set(), query: '' });

const comma = (n: number) => n.toLocaleString('sv-SE', { minimumFractionDigits: 2 });
const COLOR_NAMES: Record<string, string> = { ink: 'Svart', muted: 'Grå', paper: 'Vit' };
const colorName = (c: string | undefined) => COLOR_NAMES[colorKey(c)] ?? colorKey(c);
/** Pennans namn i listorna: "3 · 0,25 svart". */
const penLabel = (p: NumberedPen) => `${p.no} · ${p.weight ? comma(p.weight) : 'ingen linje'} ${colorName(p.color).toLowerCase()}`;
/** Sorteringsnyckeln för färgkolumnen (`data-sort`): samma ordning som `penOrder`. */
const sortColor = (c: string | undefined) => `${COLOR_RANK(colorKey(c))}${colorKey(c)}`;

/** Ett prov av pennan: en linje i färgen med tjockleken. */
function penSample(p: NumberedPen): string {
  const c = colorKey(p.color);
  const stroke = c === 'ink' ? 'var(--ink, currentColor)' : c === 'muted' ? 'var(--muted)' : c === 'paper' ? 'var(--paper, #fff)' : c;
  return `<svg class="pp-sample" viewBox="0 0 60 10" width="60" height="10" aria-hidden="true"><line x1="3" y1="5" x2="57" y2="5" stroke="${stroke}" stroke-width="${p.weight ? Math.max(0.6, p.weight * 6) : 0}" stroke-linecap="round"/></svg>`;
}

/** Raderna för en sort. */
export function placeRows(doc: Pick<ProjectDoc, 'graphics' | 'views' | 'elements' | 'storeys'>, kind: PlaceKind, places: StylePlace[] = stylePlaces(doc)): PlaceRow[] {
  const row = (p: StylePlace, value: string): PlaceRow => ({ id: p.id, label: p.label, sub: p.group, whereName: p.whereName, viewTags: p.viewTags, tags: p.tags, value, place: p });
  if (kind === 'pen') {
    const no = new Map<string, number>();
    for (const r of penTable(doc.graphics, places)) no.set(penKey(r.pen), r.pen.no);
    return places.filter((p) => p.pen).map((p) => row(p, String(no.get(penKey(p.pen!)) ?? '')));
  }
  if (kind === 'linetype') return places.filter((p) => p.linetype !== undefined).map((p) => row(p, p.linetype!));
  if (kind === 'filltype') return places.filter((p) => p.fillType).map((p) => row(p, p.fillType!));
  const out: PlaceRow[] = [];
  const byMaterial = materialObjectsByMaterial(doc);
  const storeyName = new Map(doc.storeys.map((s) => [s.id, s.name]));
  for (const m of doc.graphics.materials ?? []) {
    for (const o of byMaterial.get(m.id) ?? []) {
      const el = doc.elements[o.id] as Element;
      const t = typeOf(el.type);
      const storey = isSite(el.storey) ? 'Platsen' : (storeyName.get(el.storey) ?? '');
      const name = (t?.label ?? el.type) + (o.nested ? ', slänten' : '');
      out.push({ id: `obj:${o.id}:${o.nested ?? ''}`, label: name, sub: storey, whereName: storey, viewTags: [isSite(el.storey) ? 'platsen' : 'plan'], tags: [(t?.label ?? el.type).toLowerCase(), ...(o.nested ? ['slänt'] : [])], value: m.id, object: o });
    }
  }
  return out;
}

/** Valen i resurslistan för en sort: värde och namn. */
function choices(book: StyleBook, kind: PlaceKind, pens: NumberedPen[]): { value: string; name: string }[] {
  if (kind === 'pen') return pens.map((p) => ({ value: String(p.no), name: penLabel(p) }));
  if (kind === 'linetype') return lineTypeList(book).map((t) => ({ value: t.id, name: t.name }));
  if (kind === 'filltype') return fillTypeList(book).map((t) => ({ value: t.id, name: t.name }));
  return (book.materials ?? []).map((m) => ({ value: m.id, name: m.name }));
}

const WORD: Record<PlaceKind, { one: string; move: string; all: string }> = {
  pen: { one: 'pennan', move: 'Flytta till pennan…', all: 'Alla pennor' },
  linetype: { one: 'linjetypen', move: 'Flytta till linjetypen…', all: 'Alla linjetyper' },
  filltype: { one: 'fyllningstypen', move: 'Flytta till fyllningstypen…', all: 'Alla fyllningstyper' },
  material: { one: 'materialet', move: 'Flytta till materialet…', all: 'Alla material' },
};

/** Om raden syns med sökningen och taggarna. */
export function rowMatches(r: PlaceRow, state: PlacesState, filter: string): boolean {
  if (filter && r.value !== filter) return false;
  for (const t of state.tags) if (!r.viewTags.includes(t) && !r.tags.includes(t)) return false;
  const q = state.query.trim().toLowerCase();
  if (!q) return true;
  return [r.label, r.sub, r.whereName, ...r.viewTags, ...r.tags].some((s) => s.toLowerCase().includes(q));
}

/** Listan över ställen för en sort, med sök, taggar, flytt och en rad per ställe. */
export function placesMarkup(doc: Pick<ProjectDoc, 'graphics' | 'views' | 'elements' | 'storeys'>, kind: PlaceKind, state: PlacesState, rows: PlaceRow[], pens: NumberedPen[]): string {
  const filter = state.filter[kind] ?? '';
  const opts = choices(doc.graphics, kind, pens);
  const nameOf = new Map(opts.map((o) => [o.value, o.name]));
  const base = rows.filter((r) => !filter || r.value === filter);
  const viewTags = [...new Set(base.flatMap((r) => r.viewTags))].sort((a, b) => a.localeCompare(b, 'sv'));
  const objTags = [...new Set(base.flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b, 'sv'));
  const chip = (t: string) => `<button type="button" class="pp-tag${state.tags.has(t) ? ' on' : ''}" data-pp-tag="${escapeHtml(t)}" aria-pressed="${state.tags.has(t)}">${escapeHtml(t)}</button>`;
  const shown = base.filter((r) => rowMatches(r, state, ''));
  const checked = shown.filter((r) => state.checked.has(r.id)).length;
  const select = (r: PlaceRow) => {
    const known = nameOf.has(r.value);
    return `<select class="rc-native pp-set" data-pp-set="${escapeHtml(r.id)}" aria-label="Byt ${WORD[kind].one}">${known ? '' : `<option value="${escapeHtml(r.value)}" selected disabled>${escapeHtml(kind === 'linetype' ? lineTypeName(doc.graphics, r.value) : 'Borttagen')}</option>`}${opts.map((o) => `<option value="${escapeHtml(o.value)}"${o.value === r.value ? ' selected' : ''}>${escapeHtml(o.name)}</option>`).join('')}</select>`;
  };
  const body = shown
    .map(
      (r) => `<tr data-pp-row="${escapeHtml(r.id)}">
        <td><input type="checkbox" data-pp-check="${escapeHtml(r.id)}"${state.checked.has(r.id) ? ' checked' : ''} aria-label="Markera"></td>
        <td data-sort="${escapeHtml(r.label)}"><b>${escapeHtml(r.label)}</b><span class="pp-sub">${escapeHtml(r.sub)}</span></td>
        <td data-sort="${escapeHtml(r.whereName)}">${escapeHtml(r.whereName)}</td>
        <td class="pp-tags-cell">${[...r.viewTags, ...r.tags].map((t) => `<span>${escapeHtml(t)}</span>`).join('')}</td>
        <td data-sort="${escapeHtml(nameOf.get(r.value) ?? r.value)}">${select(r)}</td>
        <td><button class="btn btn-ghost" data-pp-goto="${escapeHtml(r.id)}">Gå dit</button></td>
      </tr>`,
    )
    .join('');
  const head = filter ? `${kind === 'pen' ? 'Pennan' : ''} ${escapeHtml(nameOf.get(filter) ?? filter)}` : WORD[kind].all;
  return `<div class="pp-places" data-pp-kind="${kind}">
    <div class="pp-head">
      <h4>Ställen <span>${escapeHtml(head.trim())} · ${base.length}</span></h4>
      <select class="rc-native" data-pp-filter aria-label="Visa ställena för"><option value="">${WORD[kind].all}</option>${opts.map((o) => `<option value="${escapeHtml(o.value)}"${o.value === filter ? ' selected' : ''}>${escapeHtml(o.name)}</option>`).join('')}</select>
    </div>
    <label class="sb-search pp-search">${icons.zoomIn}<input type="search" data-pp-search placeholder="Sök ställe" aria-label="Sök ställe" value="${escapeHtml(state.query)}"></label>
    ${viewTags.length ? `<div class="pp-tagrow"><span>Vytyp</span>${viewTags.map(chip).join('')}</div>` : ''}
    ${objTags.length ? `<div class="pp-tagrow"><span>Objekt</span>${objTags.map(chip).join('')}</div>` : ''}
    <div class="pp-move">
      <select class="rc-native" data-pp-move${checked ? '' : ' disabled'} aria-label="${WORD[kind].move}"><option value="">${WORD[kind].move}</option>${opts.map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.name)}</option>`).join('')}</select>
      <span class="note">${checked ? `${checked} markerade` : 'Markera ställen för att flytta flera på en gång.'}</span>
    </div>
    ${
      shown.length
        ? `<table class="pp-table" data-table="places-${kind}"><thead><tr><th><input type="checkbox" data-pp-all${checked && checked === shown.length ? ' checked' : ''} aria-label="Markera alla"></th><th>Ställe</th><th>Var</th><th>Taggar</th><th>${kind === 'pen' ? 'Penna' : kind === 'linetype' ? 'Linjetyp' : kind === 'filltype' ? 'Fyllningstyp' : 'Material'}</th><th></th></tr></thead><tbody>${body}</tbody></table>`
        : `<p class="note">${base.length ? 'Inga ställen matchar sökningen och taggarna.' : `Inga ställen${filter ? ` har ${WORD[kind].one}` : ''}.`}</p>`
    }
  </div>`;
}

/** Pennlistan: nummer, prov, tjocklek, färg, antal ställen och ta bort (bara utan ställen). */
export function penListMarkup(doc: Pick<ProjectDoc, 'graphics' | 'views' | 'elements' | 'storeys'>, state: PlacesState): string {
  const places = stylePlaces(doc);
  const table = penTable(doc.graphics, places);
  // Förvalet: efter färg och sedan tjocklek (rubrikerna sorterar om).
  const sorted = [...table].sort((a, b) => penOrder(a.pen, b.pen));
  const pick = state.filter.pen ?? '';
  const rows = sorted
    .map(({ pen, places: ps }) => {
      const n = ps.length;
      return `<tr class="pp-pen${String(pen.no) === pick ? ' on' : ''}" data-pp-pen="${pen.no}">
        <td data-sort="${pen.no}"><button class="pen-no" data-pp-pick="${pen.no}" title="Visa pennans ställen">${pen.no}</button></td>
        <td>${penSample(pen)}</td>
        <td data-sort="${pen.weight}"><span class="rc-ctls">${weightPicker(`penlist-${pen.no}`, pen.weight, `data-penlist="${pen.no}:weight"`, ' mm')}</span></td>
        <td data-sort="${sortColor(pen.color)}"><span class="rc-ctls"><input type="color" data-penlist="${pen.no}:color" value="${toHex(pen.color ?? 'ink')}" aria-label="Färg"><span class="pp-cname">${escapeHtml(colorName(pen.color))}</span></span></td>
        <td data-sort="${n}"><button class="btn btn-ghost pp-count" data-pp-pick="${pen.no}" title="Visa pennans ställen">${n}</button></td>
        <td>${n ? '' : `<button class="icon-btn rc-icon" data-action="pen-remove" data-pen-no="${pen.no}" title="Ta bort pennan (inga ställen)" aria-label="Ta bort">${icons.trash}</button>`}</td>
      </tr>`;
    })
    .join('');
  const unused = table.filter((r) => !r.places.length).length;
  return `<section class="style-labels style-penlist">
    <h3>Pennor och ställen</h3>
    <p class="note">En penna är en tjocklek och en färg med ett nummer. Ett ställe är en rad i en vykategori (eller i en vy som avviker) där en objekttyp och del får sin penna, ett materials kontur, eller en typs eller ett objekts egna penna (<i>Gå dit</i> visar objekten). Ändras en penna ändras alla dess ställen; <i>Flytta till pennan…</i> byter vilka ställen som pekar på en penna, inte pennan själv. Linjetypen hör till stället.</p>
    <div class="pp-split">
      <div class="pp-pens">
        <table class="pp-table pp-pentable" data-table="pens"><thead><tr><th>Nr</th><th>Prov</th><th>Tjocklek</th><th>Färg</th><th>Ställen</th><th></th></tr></thead><tbody>${rows}</tbody></table>
        <div class="pp-penbtns"><button class="btn" data-action="pen-add">Ny penna</button>${unused ? `<button class="btn btn-ghost" data-action="pen-remove-unused">Ta bort pennor utan ställen (${unused})</button>` : ''}</div>
      </div>
      ${placesMarkup(doc, 'pen', state, placeRows(doc, 'pen', places), table.map((r) => r.pen))}
    </div>
  </section>`;
}

/** Listan över ställen under en resurs (linjetyper, fyllningstyper, material), i en egen del. */
export function placesSection(doc: Pick<ProjectDoc, 'graphics' | 'views' | 'elements' | 'storeys'>, kind: Exclude<PlaceKind, 'pen'>, state: PlacesState): string {
  const intro: Record<typeof kind, string> = {
    linetype: 'Pennraderna och snittens konturer i kategorierna och vyerna, och typernas och objektens egna pennor med en linjetyp. Byt linjetyp per ställe, eller markera flera och flytta dem.',
    filltype: 'Snittens fyllningar i kategorierna och vyerna och materialens fyllningar som har en fyllningstyp. Former och rum med egen fyllning räknas i listan ovan men står inte här.',
    material: 'Objekten (och slänterna) med varje material. Gå dit visar objektet i ritningen.',
  };
  return `<section class="style-labels style-places">
    <h3>Ställen</h3>
    <p class="note">${intro[kind]}</p>
    ${placesMarkup(doc, kind, state, placeRows(doc, kind), [])}
  </section>`;
}
