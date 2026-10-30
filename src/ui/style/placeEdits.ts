import type { NumberedPen, StyleBook } from '../../core/graphics';
import type { Id, ProjectDoc } from '../../core/model';
import type { DocStore } from '../../core/store';
import { linkMaterial, relinked } from '../../core/materials';
import { editPlaces, frozenPens, penKey, penTable, setFillTypeEdit, setLineTypeEdit, setPenEdit, stylePlaces, type PlaceEdit, type StylePlace } from '../../repr/penPlaces';
import { placeRows, type PlaceKind } from './places';

/**
 * Det pennornas och ställenas lista ändrar (0.10.36), i en transaktion:
 * stilboken (med pennlistan låst), vyerna, objekten med ett ändrat material
 * och typernas och objektens egna pennor (0.10.37).
 */

type Doc = Pick<ProjectDoc, 'graphics' | 'views' | 'elements' | 'storeys'> & Partial<Pick<ProjectDoc, 'definitions'>>;

/**
 * Lägg ändringen av ställena i dokumentet, med pennlistan `pens` (eller
 * den låsta efter ändringen). `all` är projektets ställen, räknade en gång.
 */
function applyEdit(store: DocStore, label: string, all: readonly StylePlace[], places: readonly StylePlace[], edit: PlaceEdit, pens?: (doc: Doc) => NumberedPen[]): void {
  const doc = store.doc;
  const before = frozenPens(doc, all);
  const r = editPlaces({ ...doc, graphics: { ...doc.graphics, penList: before } }, places, edit);
  store.transact(label, (tx) => {
    const next = { ...tx.doc, graphics: r.book, views: r.views };
    tx.setGraphics({ ...r.book, penList: pens ? pens(next) : frozenPens(next) });
    tx.setViews(r.views);
    for (const m of r.materials) for (const el of relinked(tx.doc, m)) tx.putElement(el);
    // Typernas och objektens egna pennor (0.10.37).
    for (const d of r.definitions) tx.putDefinition(d);
    for (const el of r.elements) tx.putElement(el);
  });
}

/** Ställena med radernas nycklar (i listan för sorten). */
function placesOf(doc: Doc, kind: PlaceKind, ids: readonly string[], all: readonly StylePlace[]): StylePlace[] {
  const want = new Set(ids);
  return placeRows(doc, kind, [...all])
    .filter((r) => want.has(r.id) && r.place)
    .map((r) => r.place!);
}

/** Byt värde på raderna: pennan (numret), linjetypen, fyllningstypen eller materialet. */
export function setPlaces(store: DocStore, kind: PlaceKind, ids: readonly string[], value: string): void {
  const doc = store.doc;
  if (!ids.length || !value) return;
  if (kind === 'material') {
    const rows = placeRows(doc, 'material').filter((r) => ids.includes(r.id) && r.object);
    const plain = rows.filter((r) => !r.object!.nested).map((r) => r.object!.id);
    const slopes = rows.filter((r) => r.object!.nested).map((r) => r.object!.id);
    // Objekten och slänterna kopplas var för sig (två ångringar när båda finns).
    if (plain.length) linkMaterial(store, plain, value);
    if (slopes.length) linkMaterial(store, slopes, value, 'slopeFill');
    return;
  }
  const all = stylePlaces(doc);
  const places = placesOf(doc, kind, ids, all);
  if (!places.length) return;
  const n = places.length;
  const what = n === 1 ? places[0].label : `${n} ställen`;
  if (kind === 'pen') {
    const pen = penTable(doc.graphics, all).find((r) => String(r.pen.no) === value)?.pen;
    if (pen) applyEdit(store, `Penna ${pen.no}: ${what}`, all, places, setPenEdit(pen));
  } else if (kind === 'linetype') applyEdit(store, `Linjetyp: ${what}`, all, places, setLineTypeEdit(value));
  else applyEdit(store, `Fyllningstyp: ${what}`, all, places, setFillTypeEdit(value));
}

/**
 * Ändra en penna i listan: pennan och alla dess ställen får den nya
 * tjockleken eller färgen. Svarar med ett fel om en annan penna redan har
 * samma tjocklek och färg.
 */
export function editPen(store: DocStore, no: number, patch: { weight?: number; color?: string | null }): string | null {
  const doc = store.doc;
  const places = stylePlaces(doc);
  const table = penTable(doc.graphics, places);
  const row = table.find((r) => r.pen.no === no);
  if (!row) return null;
  const next: NumberedPen = { no, weight: patch.weight ?? row.pen.weight };
  const color = patch.color === undefined ? row.pen.color : patch.color;
  if (color && color !== 'ink') next.color = color;
  if (penKey(next) === penKey(row.pen)) return null;
  const twin = table.find((r) => r.pen.no !== no && penKey(r.pen) === penKey(next));
  if (twin) return `Penna ${twin.pen.no} har redan den tjockleken och färgen. Flytta ställena dit i stället.`;
  const list = table.map((r) => (r.pen.no === no ? next : r.pen));
  applyEdit(store, `Ändra penna ${no}`, places, row.places, setPenEdit(next), (d) => withList(list, d));
  return null;
}

/** Pennlistan efter en ändring: de sparade, och nya tjocklekar och färger som ställena fått. */
function withList(list: NumberedPen[], doc: Doc): NumberedPen[] {
  return frozenPens({ ...doc, graphics: { ...doc.graphics, penList: list } });
}

const NEW_COLORS = [undefined, '#c2372c', '#2f6db5', '#c99700', '#3c8d4a'];
const NEW_WEIGHTS = [0.25, 0.18, 0.35, 0.5, 0.13, 0.7];

/** En ny penna sist i listan, med en tjocklek och färg som ingen annan har. Svarar med numret. */
export function addPen(store: DocStore): number {
  const doc = store.doc;
  const list = frozenPens(doc);
  const used = new Set(list.map(penKey));
  let pen: NumberedPen | undefined;
  for (const color of NEW_COLORS) {
    for (const weight of NEW_WEIGHTS) {
      const p: NumberedPen = { no: 0, weight, ...(color ? { color } : {}) };
      if (!used.has(penKey(p))) {
        pen = p;
        break;
      }
    }
    if (pen) break;
  }
  pen ??= { no: 0, weight: 1, color: '#777777' };
  pen.no = list.reduce((m, p) => Math.max(m, p.no), 0) + 1;
  store.transact(`Ny penna ${pen.no}`, (tx) => tx.setGraphics({ ...tx.doc.graphics, penList: [...list, pen] }));
  return pen.no;
}

/** Ta bort pennor utan ställen (en, eller alla utan ställen). */
export function removePens(store: DocStore, no?: number): void {
  const doc = store.doc;
  const table = penTable(doc.graphics, stylePlaces(doc));
  const gone = table.filter((r) => !r.places.length && (no === undefined || r.pen.no === no));
  if (!gone.length) return;
  const rest = table.filter((r) => !gone.includes(r)).map((r) => r.pen);
  const book: StyleBook = { ...doc.graphics };
  if (rest.length) book.penList = rest;
  else delete book.penList;
  store.transact(gone.length === 1 ? `Ta bort penna ${gone[0].pen.no}` : `Ta bort ${gone.length} pennor`, (tx) => tx.setGraphics(book));
}

/** Objektet bakom en rad i materialens lista. */
export function objectOf(doc: Doc, rowId: string): Id | null {
  return placeRows(doc, 'material').find((r) => r.id === rowId)?.object?.id ?? null;
}
