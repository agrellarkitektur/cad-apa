import type { DocStore } from '../../core/store';
import type { StyleBook } from '../../core/graphics';
import { penTable, stylePlaces } from '../../repr/penPlaces';
import type { PlaceKind, PlacesState } from './places';
import { addPen, editPen, removePens, setPlaces } from './placeEdits';
import { fromHex, toHex } from './colors';

/** Det `styleDialog.ts` låter pennlistan och listorna över ställen nå. */
export interface PlacesHost {
  store: DocStore;
  readonly book: StyleBook;
  el: HTMLElement;
  /** Det som väljs och filtreras i listorna över ställen. */
  pp: PlacesState;
  render(): void;
  onError(msg: string): void;
  /** Sorten av ställen som visas, eller null utanför resurserna. */
  placeKind(): PlaceKind | null;
  /** Pennlistan med pennan vald (numret i en kategori leder hit). */
  goToPens(no: string): void;
  /** *Gå dit* för ett ställe: raden i stilboken, materialet, eller objektet i ritningen. */
  goToPlace(kind: PlaceKind, id: string): void;
}

/** Klicken i pennlistan och listorna över ställen (0.10.36). Sant om klicket hörde hit. */
export function placesClick(h: PlacesHost, e: Event, target: HTMLElement): boolean {
  // Numret framför en pennrad i en kategori: pennan och dess ställen.
  const penGo = target.closest<HTMLElement>('[data-pen-goto]')?.dataset.penGoto;
  if (penGo) {
    e.preventDefault();
    h.goToPens(penGo);
    return true;
  }
  const kind = h.placeKind();
  if (!kind) return false;
  const pp = h.pp;
  const pick = target.closest<HTMLElement>('[data-pp-pick]')?.dataset.ppPick;
  if (pick) {
    pp.filter.pen = pp.filter.pen === pick ? '' : pick;
    pp.checked.clear();
    h.render();
    return true;
  }
  const tag = target.closest<HTMLElement>('[data-pp-tag]')?.dataset.ppTag;
  if (tag) {
    if (pp.tags.has(tag)) pp.tags.delete(tag);
    else pp.tags.add(tag);
    h.render();
    return true;
  }
  const goto = target.closest<HTMLElement>('[data-pp-goto]')?.dataset.ppGoto;
  if (goto) {
    h.goToPlace(kind, goto);
    return true;
  }
  const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
  if (action === 'pen-add') {
    pp.filter.pen = String(addPen(h.store));
    h.render();
    return true;
  }
  if (action === 'pen-remove' || action === 'pen-remove-unused') {
    const no = Number(target.closest<HTMLElement>('[data-pen-no]')?.dataset.penNo);
    removePens(h.store, action === 'pen-remove' ? no : undefined);
    if (action === 'pen-remove' && pp.filter.pen === String(no)) pp.filter.pen = '';
    return true;
  }
  return false;
}

/** Fälten i pennlistan och listorna över ställen (0.10.36). Sant om fältet hörde hit. */
export function placesChange(h: PlacesHost, input: HTMLInputElement | HTMLSelectElement): boolean {
  const kind = h.placeKind();
  if (!kind) return false;
  const pp = h.pp;
  const checked = (input as HTMLInputElement).checked;
  if (input.matches('[data-pp-filter]')) {
    pp.filter[kind] = input.value;
    pp.checked.clear();
    h.render();
    return true;
  }
  if (input.matches('[data-pp-check]')) {
    const id = input.dataset.ppCheck!;
    if (checked) pp.checked.add(id);
    else pp.checked.delete(id);
    h.render();
    return true;
  }
  if (input.matches('[data-pp-all]')) {
    for (const x of h.el.querySelectorAll<HTMLInputElement>('[data-pp-check]')) {
      if (checked) pp.checked.add(x.dataset.ppCheck!);
      else pp.checked.delete(x.dataset.ppCheck!);
    }
    h.render();
    return true;
  }
  if (input.matches('[data-pp-set]')) {
    setPlaces(h.store, kind, [input.dataset.ppSet!], input.value);
    return true;
  }
  if (input.matches('[data-pp-move]')) {
    const ids = [...h.el.querySelectorAll<HTMLInputElement>('[data-pp-check]:checked')].map((x) => x.dataset.ppCheck!);
    if (input.value && ids.length) {
      // Ställenas nycklar är kvar efter flytten (materialens rader byter material), så markeringen är kvar där de hamnar.
      pp.checked.clear();
      setPlaces(h.store, kind, ids, input.value);
    } else h.render();
    return true;
  }
  const field = input.dataset.penlist;
  if (field) {
    const [no, what] = field.split(':');
    const pen = penTable(h.book, stylePlaces(h.store.doc)).find((r) => String(r.pen.no) === no)?.pen;
    if (!pen) return true;
    let err: string | null = null;
    if (what === 'weight') err = editPen(h.store, Number(no), { weight: Number(input.value) });
    else if (input.value.toLowerCase() !== toHex(pen.color ?? 'ink')) err = editPen(h.store, Number(no), { color: fromHex(input.value) });
    if (err) {
      h.onError(err);
      h.render();
    }
    return true;
  }
  return false;
}
