import type { DocStore } from '../../core/store';
import type { StyleBook } from '../../core/graphics';
import type { SiteCategory } from '../../core/model';
import { toggleUnderlay, type ViewUnderlay } from '../../core/viewUnderlays';
import {
  categoriesOf,
  categoryUses,
  copyCategoryFrom,
  deleteCategory,
  duplicateCategory,
  editStyle,
  moveCategory,
  newCategory,
  renameCategory,
  resetCategory,
  resetViewOverrides,
  stylePresets,
  viewsWithCategory,
  viewToCategoryDefault,
  viewToNewCategory,
  type CategoryShow,
  type DetailLevel,
  type ViewCategory,
  type ViewType,
} from '../../core/viewCategories';
import { askConfirm, askText } from '../ask';
import { editUnderlays } from '../underlayRows';
import { setShown } from '../app/showKeys';
import { applyActionField } from './actions';
import { applyLabelField } from './labels';
import { applyLineTypeField } from './lineTypes';
import { applyFillTypeField } from './fillTypes';
import { applyPenField } from './pens';
import type { StyleScope } from './categoryTab';

/** Det `styleDialog.ts` låter kategoriflikens klick och fält nå. */
export interface CategoryHost {
  store: DocStore;
  readonly book: StyleBook;
  /** Den valda kategorin per vytyp. */
  chosen: Partial<Record<ViewType, string>>;
  scope(type: ViewType): StyleScope;
  /** Lägg stilboken (resurser, kategorier). */
  set(book: StyleBook, label: string): void;
  /** Lägg det ändrade i kategorin, eller som vyns avvikelser från den. */
  commit(type: ViewType, cur: ViewCategory, label: string, book?: StyleBook): void;
  render(): void;
}

/** En vys stil (0.10.33): återställ till kategorin, gör avvikelserna till kategorins förval, spara som ny kategori. */
export async function viewAction(h: CategoryHost, action: string, type: ViewType): Promise<void> {
  const s = h.scope(type);
  const v = s.view;
  if (!v) return;
  const doc = h.store.doc;
  if (action === 'view-reset') {
    h.store.transact(`Återställ till kategorin: ${v.name}`, (tx) => tx.setViews(resetViewOverrides(tx.doc.views, v.id)));
  } else if (action === 'view-default') {
    const others = viewsWithCategory(doc, s.cat).filter((x) => x.id !== v.id).length;
    if (others && !(await askConfirm('Gör avvikelserna till kategorins förval', `${s.cat.name} får det ${v.name} ser ut med. ${others} ${others === 1 ? 'vy till har' : 'vyer till har'} kategorin och ändras också, utom det de själva avviker på.`, 'Gör till förval'))) return;
    const r = viewToCategoryDefault(h.store.doc, v.id);
    if (r)
      h.store.transact(`Gör avvikelserna till förval: ${s.cat.name}`, (tx) => {
        tx.setGraphics(r.book);
        tx.setViews(r.views);
      });
  } else if (action === 'view-newcat') {
    const name = (await askText('Spara som ny kategori', v.name))?.trim();
    if (!name) return;
    const r = viewToNewCategory(h.store.doc, v.id, name);
    if (!r) return;
    h.chosen[type] = r.cat.id;
    h.store.transact(`Ny kategori: ${r.cat.name}`, (tx) => {
      tx.setGraphics(r.book);
      tx.setViews(r.views);
    });
  }
}

/** Flikarnas verktyg: ny, duplicera, byt namn, återställ, flytta, ta bort. */
export async function categoryAction(h: CategoryHost, action: string, type: ViewType): Promise<void> {
  const c = h.scope(type).cat;
  if (action === 'cat-new') {
    const r = newCategory(h.book, type);
    h.chosen[type] = r.cat.id;
    h.set(r.book, `Ny kategori: ${r.cat.name}`);
  } else if (action === 'cat-duplicate') {
    const r = duplicateCategory(h.book, c);
    h.chosen[type] = r.cat.id;
    h.set(r.book, `Duplicera kategori: ${c.name}`);
  } else if (action === 'cat-rename') {
    const name = (await askText('Byt namn på kategorin', c.name))?.trim();
    if (name && name !== c.name) h.set(renameCategory(h.book, h.scope(type).cat, name), `Byt namn på kategori: ${name}`);
  } else if (action === 'cat-reset') {
    if (await askConfirm('Återställ kategorin', `Visningen, innehållet, åtgärderna och pennorna i ${c.name} blir som förvalet. Vyernas egna ändringar är kvar.`, 'Återställ')) {
      h.set(resetCategory(h.book, h.scope(type).cat), `Återställ kategori: ${c.name}`);
    }
  } else if (action === 'cat-left' || action === 'cat-right') {
    h.set(moveCategory(h.book, c, action === 'cat-left' ? -1 : 1), 'Flytta kategori');
  } else if (action === 'cat-delete') {
    const uses = categoryUses(h.store.doc, c);
    const first = categoriesOf(h.book, type).find((x) => x !== c)?.name ?? '';
    if (uses && !(await askConfirm('Ta bort kategorin', `${uses} ${uses === 1 ? 'vy har' : 'vyer har'} ${c.name}. De får ${first} i stället, med sina egna ändringar kvar.`))) return;
    const r = deleteCategory(h.store.doc, h.scope(type).cat);
    if (!r) return;
    delete h.chosen[type];
    h.store.transact(`Ta bort kategori: ${c.name}`, (tx) => {
      tx.setGraphics(r.book);
      tx.setViews(r.views);
    });
  }
}

/** Knapparna i underlagsraderna (upp, ned, under/över, ta bort). Sant om knappen hörde hit. */
export function underlayClick(h: CategoryHost, type: ViewType, target: HTMLElement): boolean {
  const btn = target.closest<HTMLElement>('button[data-ul-field]');
  if (!btn) return false;
  const s = h.scope(type);
  const next = editUnderlays(s.cur.show.underlays ?? [], btn);
  if (next) h.commit(type, { ...s.cur, show: withList(s.cur.show, next) }, `Ändra underlag: ${s.view ? `vyn ${s.view.name}` : s.cat.name}`);
  return true;
}

/**
 * Ett fält i kategorifliken eller vyns stil: Kopiera från, underlagen,
 * visningen, innehållet, skalan, Platsens sort, och stilen (pennorna,
 * linje- och fyllningstyperna i samma fält, texterna och åtgärderna).
 */
export function categoryChange(h: CategoryHost, type: ViewType, input: HTMLInputElement | HTMLSelectElement): void {
  const s = h.scope(type);
  const c = s.cat;
  const cur = s.cur;
  const what = s.view ? `vyn ${s.view.name}` : c.name;
  if (input.matches('[data-sb-copy]')) {
    const [kind, a, b] = input.value.split(':');
    const from = kind === 'preset' ? stylePresets().find((p) => p.id === a) : h.book.categories.find((x) => x.type === a && x.id === b);
    if (from && !s.view) h.set(copyCategoryFrom(h.book, c, from), `Kopiera till ${c.name} från ${from.name}`);
    else h.render();
    return;
  }
  // Underlagen (0.10.35): lägg till ur listan, eller ändra en rad.
  if (input.matches('[data-ul-addsel]')) {
    if (input.value) h.commit(type, { ...cur, show: { ...structuredClone(cur.show), underlays: toggleUnderlay(cur.show.underlays, input.value) } }, `Lägg till underlag: ${what}`);
    return;
  }
  if (input.matches('[data-ul-field]')) {
    const next = editUnderlays(cur.show.underlays ?? [], input);
    if (next) h.commit(type, { ...cur, show: withList(cur.show, next) }, `Ändra underlag: ${what}`);
    return;
  }
  const showKey = input.dataset.catShow as keyof CategoryShow | undefined;
  if (showKey) {
    const show: CategoryShow = structuredClone(cur.show);
    if (showKey === 'compare' || showKey === 'hideDemolished') show[showKey] = (input as HTMLInputElement).checked;
    else if (showKey === 'detail' || showKey === 'labelDetail' || showKey === 'modelDetail') show[showKey] = input.value as DetailLevel;
    h.commit(type, { ...cur, show }, `Ändra ${s.view ? 'vyns visning' : 'kategori'}: ${what}`);
    return;
  }
  if (input.dataset.catHide !== undefined) {
    const show: CategoryShow = structuredClone(cur.show);
    setShown(show, input.dataset.catHide, (input as HTMLInputElement).checked);
    h.commit(type, { ...cur, show }, `Ändra innehåll: ${what}`);
    return;
  }
  if (input.matches('[data-cat-scale]')) {
    const n = Math.round(Number(input.value.replace(/\s/g, '')));
    if (n > 0 && !s.view) h.commit(type, { ...cur, scale: n }, `Ändra kategori: ${c.name}`);
    else h.render();
    return;
  }
  if (input.matches('[data-cat-kind]')) {
    if (!s.view) h.commit(type, { ...cur, kind: input.value as SiteCategory }, `Ändra kategori: ${c.name}`);
    return;
  }
  const r = editStyle(h.book, cur.style, (sheet) => applyPenField(sheet, input) ?? applyLineTypeField(sheet, input) ?? applyFillTypeField(sheet, input) ?? applyLabelField(sheet, input) ?? applyActionField(sheet, input));
  // Ett mönster som inte gick att läsa: visa det gamla igen.
  if (r.result === '') h.render();
  if (r.result) h.commit(type, { ...cur, style: r.style }, r.result, r.book);
}

/** Visningen med en ny lista underlag (en tom tas bort). */
function withList(show: CategoryShow, list: ViewUnderlay[]): CategoryShow {
  const out = structuredClone(show);
  if (list.length) out.underlays = list;
  else delete out.underlays;
  return out;
}
