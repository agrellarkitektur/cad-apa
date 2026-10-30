import { setGraphics } from '../core/commands';
import { normalizeBook, type StyleBook } from '../core/graphics';
import type { DocStore } from '../core/store';
import { DETAIL_LABELS, DETAIL_LEVELS } from '../core/states';
import { SITE_CATEGORIES, type SiteCategory } from '../core/model';
import {
  categoriesOf,
  categoryDefault,
  categoryOf,
  categoryUses,
  copyCategoryFrom,
  deviationCount,
  editStyle,
  effectiveCategory,
  overridesFrom,
  putCategory,
  resetViewOverrides,
  viewsWithCategory,
  viewToCategoryDefault,
  viewToNewCategory,
  viewTypeOf,
  deleteCategory,
  duplicateCategory,
  moveCategory,
  newCategory,
  renameCategory,
  resetCategory,
  sheetFor,
  stylePresets,
  VIEW_TYPES,
  type CategoryShow,
  type DetailLevel,
  type ViewCategory,
  type ViewType,
} from '../core/viewCategories';
import { escapeHtml } from './labels';
import { askConfirm, askText } from './ask';
import { icons } from './icons';
import { actionRows, applyActionField } from './style/actions';
import { applyLabelField, labelSection } from './style/labels';
import { addLineType, applyLineTypeField, lineTypeSection, removeLineType } from './style/lineTypes';
import { addFamily, addFillType, applyFillTypeField, fillTypeSection, importPat, removeFamily, removeFillType } from './style/fillTypes';
import { FILL_TYPES } from '../core/fillTypes';
import { formatPat } from '../core/patFile';
import { saveBlobFile } from '../storage/projectFile';
import { applyPenField, penSection, resetPen } from './style/pens';
import { resolveParams } from '../elements/registry';
import { materialFieldChange, materialSection } from './style/materials';
import { addMaterial, deleteMaterial, materialUses, moveMaterial, setMaterialTexture, updateMaterial } from '../core/materials';
import { chooseTexture } from './app/imageFile';
import { isShown, OFF_BY_DEFAULT, setShown, showGroupsFor } from './app/showKeys';
import { changedRows, resetRow, rowSelector } from './style/deviations';
import type { ViewDef } from '../core/model';

/** Det som visas till höger: Allmänt, en vytyp eller en resurs. */
type Place = { kind: 'general' } | { kind: 'type'; type: ViewType } | { kind: 'res'; res: Resource };
type Resource = 'materials' | 'lineTypes' | 'fillTypes' | 'text';

const RESOURCES: readonly { res: Resource; name: string }[] = [
  { res: 'materials', name: 'Material' },
  { res: 'lineTypes', name: 'Linjetyper' },
  { res: 'fillTypes', name: 'Fyllningstyper' },
  { res: 'text', name: 'Text och littera' },
];

const RAIL_ICON: Record<string, string> = { site: icons.ground, storey: icons.storeys, elevation: icons.elevation, section: icons.section, cube: icons.multi, worksheet: icons.draw2d, sheet: icons.sheet, list: icons.states };

/**
 * Stilboken (0.10.32, förut stilboken): i vänsterkanten Projektet ›
 * Allmänt, vytyperna och resurserna. En vytyp har sina kategorier som
 * flikar överst, med visningen, innehållet, åtgärderna och pennorna; en
 * vy följer sin kategori och avviker rad för rad. Resurserna (material,
 * linje- och fyllningstyper, text) gäller alla vyer. Ändringar syns direkt
 * och kan ångras.
 *
 * Delarna ligger i `src/ui/style/` (0.8.27), en fil per del med dess HTML
 * och det dess fält ändrar.
 */
export class StyleDialog {
  readonly el: HTMLElement;
  private store: DocStore;
  private onSaveFile: (book: StyleBook) => void;
  private onError: (msg: string) => void;
  private place: Place = { kind: 'type', type: 'storey' };
  /** Den valda kategorin per vytyp. */
  private chosen: Partial<Record<ViewType, string>> = {};
  /** Vyn vars stil visas (0.10.33, *Stil för den här vyn…*), annars kategorin. */
  private viewId: string | null = null;
  /** *Visa bara avvikelser* (0.10.33). */
  private onlyChanged = false;
  /** Öppna en vy i appen (*Gå dit* i listan över vyer med kategorin). */
  goToView: (id: string) => void = () => {};

  constructor(store: DocStore, onSaveFile: (book: StyleBook) => void, onError: (msg: string) => void) {
    this.store = store;
    this.onSaveFile = onSaveFile;
    this.onError = onError;
    this.el = document.createElement('div');
    this.el.className = 'dialog-backdrop';
    this.el.hidden = true;
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
      void this.onClick(e);
    });
    this.el.addEventListener('change', (e) => this.onChange(e));
    store.subscribe(() => {
      if (!this.el.hidden) this.render();
    });
  }

  /** Öppna stilboken, gärna vid en vytyp och kategori (den där man är), eller vid en vys stil (0.10.33). */
  open(at?: { type: ViewType; category?: string } | { view: string }): void {
    if (at && 'view' in at) this.showView(at.view);
    else if (at) {
      this.viewId = null;
      this.place = { kind: 'type', type: at.type };
      if (at.category) this.chosen[at.type] = at.category;
    }
    this.el.hidden = false;
    this.render();
  }

  close(): void {
    this.el.hidden = true;
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  private get book(): StyleBook {
    return this.store.doc.graphics;
  }

  /** Den valda kategorin i vytypen. */
  private cat(type: ViewType): ViewCategory {
    return categoryOf(this.book, type, this.chosen[type]);
  }

  /** Visa vyns stil: dess vytyp, med kategorin vald. */
  private showView(id: string): void {
    const doc = this.store.doc;
    const v = doc.views.find((x) => x.id === id);
    if (!v) return;
    const type = viewTypeOf(doc, v);
    this.viewId = id;
    this.place = { kind: 'type', type };
    this.chosen[type] = categoryOf(this.book, type, v.category).id;
  }

  /** Vyn som visas, om den finns och hör till vytypen. */
  private view(type: ViewType): ViewDef | undefined {
    const doc = this.store.doc;
    const v = this.viewId ? doc.views.find((x) => x.id === this.viewId) : undefined;
    return v && viewTypeOf(doc, v) === type ? v : undefined;
  }

  /**
   * Det som ändras (0.10.33): kategorin, med förvalet som nivån ovanför,
   * eller vyn, med kategorin ovanför. `cur` är det som visas.
   */
  private scope(type: ViewType): { cat: ViewCategory; ref: ViewCategory; cur: ViewCategory; view?: ViewDef } {
    const view = this.view(type);
    if (!view) {
      const cat = this.cat(type);
      return { cat, ref: categoryDefault(cat), cur: cat };
    }
    const cat = categoryOf(this.book, type, view.category);
    return { cat, ref: cat, cur: effectiveCategory(cat, view.overrides), view };
  }

  /** Lägg det ändrade: i kategorin, eller som vyns avvikelser från den. `book` har resurserna (fyllningstyper …) om de ändrats. */
  private commit(type: ViewType, cur: ViewCategory, label: string, book: StyleBook = this.book): void {
    const s = this.scope(type);
    if (!s.view) {
      this.set(putCategory(book, cur), label);
      return;
    }
    const id = s.view.id;
    const ov = overridesFrom(categoryOf(book, type, s.view.category), cur);
    this.store.transact(`${label} (${s.view.name})`, (tx) => {
      if (book !== this.book) tx.setGraphics(book);
      tx.setViews(ov ? tx.doc.views.map((v) => (v.id === id ? { ...v, overrides: ov } : v)) : resetViewOverrides(tx.doc.views, id));
    });
  }

  /**
   * Rullningen och fältet med fokus är kvar när dialogen ritas om efter en
   * ändring, och snabbguiden för fyllningstyperna är kvar utfälld.
   */
  private render(): void {
    const guideOpen = this.el.querySelector<HTMLDetailsElement>('.filltype-guide')?.open ?? false;
    const viewsOpen = this.el.querySelector<HTMLDetailsElement>('.sb-views')?.open ?? false;
    const scrolled = [...this.el.querySelectorAll<HTMLElement>('.sb-main, .sb-rail')].map((e) => e.scrollTop);
    const focus = focusSelector(document.activeElement, this.el);
    this.el.innerHTML = `<div class="dialog style-dialog stylebook" role="dialog" aria-modal="true" aria-labelledby="style-title">
      <header>
        <h2 id="style-title">Stilbok</h2>
        <div class="sb-head-actions">
          <button class="btn" data-action="open-style" title="Läs in en stilbok (eller en äldre stilmall) från fil">Importera…</button>
          <button class="btn" data-action="save-style" title="Spara hela stilboken som fil">Exportera…</button>
        </div>
        <button class="icon-btn" data-action="close" aria-label="Stäng">×</button>
      </header>
      <div class="sb-body">
        <nav class="sb-rail" aria-label="Stilboken">${this.railMarkup()}</nav>
        <div class="sb-main">${this.mainMarkup()}</div>
      </div>
      <footer>
        <p class="note">Svart visas ljust på mörk skärm och vitt följer bakgrunden. På papper blir de svart och vitt.</p>
        <button class="btn btn-primary" data-action="close">Klar</button>
      </footer>
    </div>`;
    if (guideOpen) this.el.querySelector<HTMLDetailsElement>('.filltype-guide')?.setAttribute('open', '');
    if (viewsOpen) this.el.querySelector<HTMLDetailsElement>('.sb-views')?.setAttribute('open', '');
    this.markRows();
    this.el.querySelectorAll<HTMLElement>('.sb-main, .sb-rail').forEach((e, i) => (e.scrollTop = scrolled[i] ?? 0));
    if (focus) this.el.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
  }

  private railMarkup(): string {
    const p = this.place;
    const btn = (go: string, icon: string, name: string, on: boolean, later?: string) =>
      `<button class="sb-rail-item${on ? ' on' : ''}" data-sb-go="${go}"${on ? ' aria-current="page"' : ''}${later ? ` disabled title="${escapeHtml(later)}"` : ''}>${icon}<span>${escapeHtml(name)}</span></button>`;
    return `<h4>Projektet</h4>
      ${btn('general', icons.properties, 'Allmänt', p.kind === 'general')}
      <h4>Vytyper</h4>
      ${VIEW_TYPES.map((t) => btn(t.type ? `type:${t.type}` : '', RAIL_ICON[t.icon] ?? '', t.name, p.kind === 'type' && p.type === t.type, t.later)).join('')}
      <h4>Resurser</h4>
      ${RESOURCES.map((r) => btn(`res:${r.res}`, '', r.name, p.kind === 'res' && p.res === r.res)).join('')}`;
  }

  /**
   * Ockra prick och *Återställ* på varje rad som är ändrad mot nivån ovanför
   * (0.10.33): en kategori mot förvalet, en vy mot kategorin.
   */
  private markRows(): void {
    const main = this.el.querySelector<HTMLElement>('.sb-main');
    if (!main || this.place.kind !== 'type') return;
    const s = this.scope(this.place.type);
    const extra = showGroupsFor(this.store.doc).flatMap((g) => g.items.map(([k]) => k));
    const rows = changedRows(s.ref, s.cur, extra, !s.view);
    const above = s.view ? `kategorin ${s.cat.name}` : 'förvalet';
    for (const row of rows) {
      const host = main.querySelector(rowSelector(row))?.closest<HTMLElement>('.style-row, .pen-row, label.check, label.field');
      if (!host || host.classList.contains('sb-changed')) continue;
      host.classList.add('sb-changed');
      const mark = document.createElement('span');
      mark.className = 'sb-mark';
      mark.innerHTML = `<i class="sb-dot" aria-hidden="true"></i><button type="button" class="sb-row-reset" data-sb-reset="${escapeHtml(row)}" title="Ändrad mot ${escapeHtml(above)}. Tillbaka till dess värde.">Återställ</button>`;
      const at = host.matches('.style-row, .pen-row') ? host.querySelector('.style-name') : host.matches('label.field') ? host.firstElementChild : host;
      (at ?? host).append(mark);
    }
    main.classList.toggle('only-changed', this.onlyChanged);
    const none = main.querySelector<HTMLElement>('.sb-none');
    if (none) none.hidden = !this.onlyChanged || rows.size > 0;
  }

  private mainMarkup(): string {
    const p = this.place;
    if (p.kind === 'general') {
      return `<section class="style-labels"><h3>Allmänt</h3>
        <div class="fields"><label class="field"><span>Stilbokens namn</span><input data-sb-name value="${escapeHtml(this.book.name)}"></label></div>
        <p class="note">Här samlas projektets uppgifter i 0.10.37: företagsnamn, logotyp, ansvarig, projektnamn och -nummer, fastighet, skede, typsnitt och textstorlek, höjdsystem och decimaler, enheter, litterats sifferantal och smarttextens taggar.</p></section>`;
    }
    if (p.kind === 'res') {
      const sheet = this.book;
      if (p.res === 'materials') return materialSection(sheet, this.materialUses());
      if (p.res === 'lineTypes') return lineTypeSection(sheet, this.lineTypeUses());
      if (p.res === 'fillTypes') return fillTypeSection(sheet, this.fillTypeUses());
      return labelSection(sheet);
    }
    return this.typeMarkup(p.type);
  }

  /** En vytyp: kategorierna som flikar, verktygen för den valda och dess inställningar; eller en vys stil (0.10.33). */
  private typeMarkup(type: ViewType): string {
    const doc = this.store.doc;
    const cats = categoriesOf(this.book, type);
    const s = this.scope(type);
    const c = s.cat;
    const only = `<label class="check sb-only"><input type="checkbox" data-sb-only${this.onlyChanged ? ' checked' : ''}> Visa bara avvikelser</label>`;
    const sheet = sheetFor(this.book, c, s.view?.overrides);
    const body = `<p class="note sb-none" hidden>Inga avvikelser: allt är som ${s.view ? `kategorin ${escapeHtml(c.name)}` : 'förvalet'}.</p>
      ${this.showMarkup(s.cur, !!s.view)}
      ${this.contentMarkup(s.cur)}
      <section class="style-labels style-actions">
        <h3>Åtgärder</h3>
        <p class="note">Hur väggarnas snitt och linjerna ritas för det som finns kvar, rivs och planeras.</p>
        ${actionRows(sheet)}
      </section>
      ${penSection(sheet)}`;
    if (s.view) {
      const n = deviationCount(doc, s.view);
      return `<div class="sb-viewhead">
          <button class="btn btn-ghost sb-back" data-action="sb-back" title="Tillbaka till kategorin">${icons.chevron}<span>${escapeHtml(c.name)}</span></button>
          <div class="sb-viewname"><b>Stil för vyn ${escapeHtml(s.view.name)}</b><span>Följer kategorin ${escapeHtml(c.name)}${n ? ` · avviker på ${n} ${n === 1 ? 'rad' : 'rader'}` : ' utan avvikelser'}. Det som ändras här gäller bara vyn.</span></div>
        </div>
        <div class="sb-toolbar">
          <button class="btn" data-action="view-reset"${n ? '' : ' disabled'} title="Ta bort vyns avvikelser, så att den följer kategorin helt">Återställ till kategorin</button>
          <button class="btn" data-action="view-default"${n ? '' : ' disabled'} title="Kategorin får det vyn ser ut med; vyn följer den utan avvikelser">Gör avvikelserna till kategorins förval</button>
          <button class="btn" data-action="view-newcat" title="En ny kategori med det vyn ser ut med; vyn följer den">Spara som ny kategori…</button>
          ${only}
        </div>
        ${body}`;
    }
    const views = viewsWithCategory(doc, c);
    const uses = views.length;
    const changed = views.filter((v) => deviationCount(doc, v) > 0).length;
    const tool = (action: string, icon: string, title: string, disabled = false) => `<button class="icon-btn sb-tool" data-action="${action}" title="${title}" aria-label="${title}"${disabled ? ' disabled' : ''}>${icon}</button>`;
    const others = this.book.categories.filter((x) => x !== c);
    const copyOptions =
      `<option value="">Kopiera från…</option>` +
      (others.some((x) => x.type === type) ? `<optgroup label="Den här vytypen">${others.filter((x) => x.type === type).map((x) => `<option value="cat:${escapeHtml(x.type)}:${escapeHtml(x.id)}">${escapeHtml(x.name)}</option>`).join('')}</optgroup>` : '') +
      `<optgroup label="Andra vytyper (bara stilen)">${others.filter((x) => x.type !== type).map((x) => `<option value="cat:${escapeHtml(x.type)}:${escapeHtml(x.id)}">${escapeHtml(VIEW_TYPES.find((t) => t.type === x.type)?.name ?? '')} › ${escapeHtml(x.name)}</option>`).join('')}</optgroup>` +
      `<optgroup label="Förinställningar (bara stilen)">${stylePresets().map((p) => `<option value="preset:${p.id}">${escapeHtml(p.name)}</option>`).join('')}</optgroup>`;
    const viewList = uses
      ? `<details class="sb-views"><summary>Vyer med den här kategorin (${uses})</summary><ul>${views
          .map((v) => {
            const n = deviationCount(doc, v);
            return `<li><button class="sb-view-link" data-sb-view="${escapeHtml(v.id)}" title="Visa vyns stil och dess avvikelser">${escapeHtml(v.name)}</button>${n ? `<span class="sb-dev" title="Avviker från kategorin på ${n} ${n === 1 ? 'rad' : 'rader'}"><i class="sb-dot" aria-hidden="true"></i>${n}</span>` : ''}<button class="btn btn-ghost" data-sb-goview="${escapeHtml(v.id)}">Gå dit</button></li>`;
          })
          .join('')}</ul></details>`
      : '';
    return `<div class="sb-tabs" role="tablist" aria-label="Kategorier">
        ${cats.map((x) => `<button role="tab" class="sb-tab" data-sb-cat="${escapeHtml(x.id)}" aria-selected="${x === c}">${escapeHtml(x.name)}</button>`).join('')}
        <button class="sb-tab sb-tab-add" data-action="cat-new" title="Ny kategori">${icons.plus}<span>Ny kategori</span></button>
      </div>
      <div class="sb-toolbar">
        ${tool('cat-duplicate', icons.copy, 'Duplicera')}
        ${tool('cat-rename', icons.text, 'Byt namn')}
        <select class="sb-copy" data-sb-copy aria-label="Kopiera från">${copyOptions}</select>
        ${tool('cat-reset', icons.restore, 'Återställ till förvalet')}
        ${tool('cat-left', icons.chevron, 'Flytta åt vänster', cats[0] === c)}
        ${tool('cat-right', icons.chevron, 'Flytta åt höger', cats[cats.length - 1] === c)}
        ${tool('cat-delete', icons.trash, 'Ta bort', cats.length < 2)}
        <span class="sb-uses">Används av ${uses} ${uses === 1 ? 'vy' : 'vyer'}${changed ? ` · ${changed} med avvikelser` : ''}</span>
        ${only}
      </div>
      ${viewList}
      ${body}`;
  }

  /** Visningen: detaljnivåerna, jämförelsen, skalan och (Platsen) hur materialen ritas. */
  private showMarkup(c: ViewCategory, inView = false): string {
    const s = c.show;
    const level = (k: 'detail' | 'labelDetail' | 'modelDetail', label: string) =>
      `<label class="field"><span>${label}</span><select data-cat-show="${k}">${DETAIL_LEVELS.map((l) => `<option value="${l}"${s[k] === l ? ' selected' : ''}>${DETAIL_LABELS[l]}</option>`).join('')}</select></label>`;
    return `<section class="style-labels sb-show"><h3>Visning</h3>
      <div class="fields">
        ${level('labelDetail', 'Littera')}${level('detail', '2D-symboler')}${level('modelDetail', '3D och fasader')}
        ${inView ? '' : `<label class="field"><span>Skala för nya vyer</span><span class="input-unit scale-unit"><i>1:</i><input type="text" inputmode="numeric" data-cat-scale value="${c.scale}"></span></label>`}
        ${c.type === 'site' && !inView ? `<label class="field"><span>Materialen ritas som</span><select data-cat-kind>${SITE_CATEGORIES.map((k) => `<option value="${k.id}"${(c.kind ?? 'situation') === k.id ? ' selected' : ''}>${k.name}</option>`).join('')}</select></label>` : ''}
      </div>
      <label class="check"><input type="checkbox" data-cat-show="compare"${s.compare ? ' checked' : ''}> Jämför med befintligt</label>
      <p class="note">${inView ? 'Vyns skala ändras i vyn. Det som sparas under Visa i vyn hamnar också här.' : 'Vyerna med kategorin följer den. Det en vy ändrar under Visa och sparar, eller här under <i>Stil för den här vyn…</i>, gäller bara den vyn.'}</p>
    </section>`;
  }

  /** Innehållet: samma kryss som under Visa i vyn. */
  private contentMarkup(c: ViewCategory): string {
    const groups = showGroupsFor(this.store.doc).filter((g) => g.id !== 'site' || c.type === 'site' || !!this.store.doc.site);
    return `<section class="style-labels sb-content"><h3>Innehåll</h3>
      <div class="sb-groups">${groups
        .map(
          (g) => `<fieldset><legend>${escapeHtml(g.label)}</legend>${g.items
            .map(([k, label]) => `<label class="check${OFF_BY_DEFAULT.has(k) ? ' off-default' : ''}"><input type="checkbox" data-cat-hide="${escapeHtml(k)}"${isShown(c.show, k) ? ' checked' : ''}> ${escapeHtml(label)}</label>`)
            .join('')}</fieldset>`,
        )
        .join('')}</div>
    </section>`;
  }

  /** Hur många former och pennor som har varje linjetyp (0.8.30). */
  private lineTypeUses(): Map<string, number> {
    const doc = this.store.doc;
    const uses = new Map<string, number>();
    const add = (k: unknown) => typeof k === 'string' && uses.set(k, (uses.get(k) ?? 0) + 1);
    for (const el of Object.values(doc.elements)) if (el.type === 'Shape2D') add(resolveParams<{ linetype?: string }>(doc, el).linetype);
    for (const c of doc.graphics.categories) for (const pen of Object.values(c.style.pens ?? {})) add(pen.linetype);
    return uses;
  }

  /** Hur många objekt och slänter som har varje material (0.10.28.1). */
  private materialUses(): Map<string, number> {
    const doc = this.store.doc;
    return new Map((doc.graphics.materials ?? []).map((m) => [m.id, materialUses(doc, m.id)]));
  }

  /** Hur många former, rum och snittfyllningar som har varje fyllningstyp (0.8.36). */
  private fillTypeUses(): Map<string, number> {
    const doc = this.store.doc;
    const uses = new Map<string, number>();
    const add = (k: unknown) => typeof k === 'string' && uses.set(k, (uses.get(k) ?? 0) + 1);
    for (const el of Object.values(doc.elements)) {
      if (el.type !== 'Shape2D' && el.type !== 'Space') continue;
      const p = resolveParams<{ fill?: string; fillType?: string }>(doc, el);
      if (p.fill === 'type') add(p.fillType);
    }
    for (const c of doc.graphics.categories) for (const a of Object.values(c.style.actions)) if (a.cutFill.kind === 'type') add(a.cutFill.type);
    return uses;
  }

  private set(book: StyleBook, label: string): void {
    setGraphics(this.store, book, label);
  }

  private async onClick(e: Event): Promise<void> {
    const target = e.target as HTMLElement;
    const go = target.closest<HTMLElement>('[data-sb-go]')?.dataset.sbGo;
    if (go) {
      const [kind, what] = go.split(':');
      this.place = kind === 'general' ? { kind: 'general' } : kind === 'type' ? { kind: 'type', type: what as ViewType } : { kind: 'res', res: what as Resource };
      this.viewId = null;
      this.render();
      return;
    }
    const tab = target.closest<HTMLElement>('[data-sb-cat]')?.dataset.sbCat;
    if (tab !== undefined && this.place.kind === 'type') {
      this.chosen[this.place.type] = tab;
      this.viewId = null;
      this.render();
      return;
    }
    // Avvikelserna (0.10.33): återställ en rad, en vys stil, och vyerna med kategorin.
    const row = target.closest<HTMLElement>('[data-sb-reset]')?.dataset.sbReset;
    if (row && this.place.kind === 'type') {
      e.preventDefault();
      const type = this.place.type;
      const s = this.scope(type);
      this.commit(type, resetRow(s.cur, s.ref, row), s.view ? 'Återställ till kategorin' : 'Återställ till förvalet');
      return;
    }
    const viewLink = target.closest<HTMLElement>('[data-sb-view]')?.dataset.sbView;
    if (viewLink) {
      this.showView(viewLink);
      this.render();
      return;
    }
    const goView = target.closest<HTMLElement>('[data-sb-goview]')?.dataset.sbGoview;
    if (goView) {
      this.close();
      this.goToView(goView);
      return;
    }
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'close') this.close();
    if (action === 'sb-back') {
      this.viewId = null;
      this.render();
      return;
    }
    if (action?.startsWith('view-') && this.place.kind === 'type') {
      await this.viewAction(action, this.place.type);
      return;
    }
    if (action?.startsWith('cat-') && this.place.kind === 'type') {
      await this.categoryAction(action, this.place.type);
      return;
    }
    // Materialen (0.10.28.1).
    if (action?.startsWith('material-')) {
      const id = target.closest<HTMLElement>('[data-material-id]')?.dataset.materialId ?? '';
      if (action === 'material-add') {
        const nid = addMaterial(this.store);
        this.el.querySelector<HTMLInputElement>(`[data-material="${CSS.escape(nid)}:name"]`)?.select();
      } else if (action === 'material-up' || action === 'material-down') moveMaterial(this.store, id, action === 'material-up' ? -1 : 1);
      else if (action === 'material-remove') deleteMaterial(this.store, id);
      // Texturen i 3D (0.10.31).
      else if (action === 'material-texture') void chooseTexture(this.store, id);
      else if (action === 'material-texture-remove') setMaterialTexture(this.store, id, null);
      return;
    }
    if (action === 'linetype-add' || action === 'linetype-remove') {
      const book = structuredClone(this.book);
      const id = target.closest<HTMLElement>('[data-linetype-id]')?.dataset.linetypeId;
      if (action === 'linetype-add') addLineType(book);
      else if (!id || !removeLineType(book, id)) return;
      this.set(book, action === 'linetype-add' ? 'Ny linjetyp' : 'Ta bort linjetyp');
    }
    // Fyllningstyperna (0.8.36).
    if (action?.startsWith('filltype-') && action !== 'filltype-import' && action !== 'filltype-export') {
      const at = target.closest<HTMLElement>('[data-filltype-id]');
      const id = at?.dataset.filltypeId ?? '';
      const book = structuredClone(this.book);
      const label =
        action === 'filltype-add'
          ? (addFillType(book), 'Ny fyllningstyp')
          : action === 'filltype-copy' && FILL_TYPES[id]
            ? (addFillType(book, { ...FILL_TYPES[id], name: `${FILL_TYPES[id].name} (kopia)` }), 'Kopiera fyllningstyp')
            : action === 'filltype-remove' && removeFillType(book, id)
              ? 'Ta bort fyllningstyp'
              : action === 'filltype-family-add' && addFamily(book, id)
                ? 'Ny linjefamilj'
                : action === 'filltype-family-remove' && removeFamily(book, id, Number(at?.dataset.family))
                  ? 'Ta bort linjefamilj'
                  : null;
      if (label) this.set(book, label);
    }
    if (action === 'filltype-import') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pat,text/plain';
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        const book = structuredClone(this.book);
        const { added, replaced } = importPat(book, await file.text());
        if (!added && !replaced) {
          this.onError('Filen har inga fyllningstyper som går att läsa.');
          return;
        }
        this.set(book, added + replaced === 1 ? 'Läs in fyllningstyp' : 'Läs in fyllningstyper');
      });
      input.click();
    }
    if (action === 'filltype-export') {
      const types = this.book.fillTypes ?? [];
      if (types.length) void saveBlobFile(new Blob([formatPat(types)], { type: 'text/plain' }), 'fyllningar.pat', 'Fyllningstyper', { 'text/plain': ['.pat'] });
    }
    if (action === 'pen-reset' && this.place.kind === 'type') {
      const key = target.closest<HTMLElement>('[data-pen-key]')?.dataset.penKey;
      if (!key) return;
      const type = this.place.type;
      const cur = this.scope(type).cur;
      const r = editStyle(this.book, cur.style, (s) => resetPen(s, key));
      if (r.result) this.commit(type, { ...cur, style: r.style }, 'Ändra pennor', r.book);
    }
    if (action === 'save-style') this.onSaveFile(this.book);
    if (action === 'open-style') this.importFile();
  }

  /** En vys stil (0.10.33): återställ till kategorin, gör avvikelserna till kategorins förval, spara som ny kategori. */
  private async viewAction(action: string, type: ViewType): Promise<void> {
    const s = this.scope(type);
    const v = s.view;
    if (!v) return;
    const doc = this.store.doc;
    if (action === 'view-reset') {
      this.store.transact(`Återställ till kategorin: ${v.name}`, (tx) => tx.setViews(resetViewOverrides(tx.doc.views, v.id)));
    } else if (action === 'view-default') {
      const others = viewsWithCategory(doc, s.cat).filter((x) => x.id !== v.id).length;
      if (others && !(await askConfirm('Gör avvikelserna till kategorins förval', `${s.cat.name} får det ${v.name} ser ut med. ${others} ${others === 1 ? 'vy till har' : 'vyer till har'} kategorin och ändras också, utom det de själva avviker på.`, 'Gör till förval'))) return;
      const r = viewToCategoryDefault(this.store.doc, v.id);
      if (r)
        this.store.transact(`Gör avvikelserna till förval: ${s.cat.name}`, (tx) => {
          tx.setGraphics(r.book);
          tx.setViews(r.views);
        });
    } else if (action === 'view-newcat') {
      const name = (await askText('Spara som ny kategori', v.name))?.trim();
      if (!name) return;
      const r = viewToNewCategory(this.store.doc, v.id, name);
      if (!r) return;
      this.chosen[type] = r.cat.id;
      this.store.transact(`Ny kategori: ${r.cat.name}`, (tx) => {
        tx.setGraphics(r.book);
        tx.setViews(r.views);
      });
    }
  }

  /** Flikarnas verktyg: ny, duplicera, byt namn, återställ, flytta, ta bort. */
  private async categoryAction(action: string, type: ViewType): Promise<void> {
    const c = this.cat(type);
    if (action === 'cat-new') {
      const r = newCategory(this.book, type);
      this.chosen[type] = r.cat.id;
      this.set(r.book, `Ny kategori: ${r.cat.name}`);
    } else if (action === 'cat-duplicate') {
      const r = duplicateCategory(this.book, c);
      this.chosen[type] = r.cat.id;
      this.set(r.book, `Duplicera kategori: ${c.name}`);
    } else if (action === 'cat-rename') {
      const name = (await askText('Byt namn på kategorin', c.name))?.trim();
      if (name && name !== c.name) this.set(renameCategory(this.book, this.cat(type), name), `Byt namn på kategori: ${name}`);
    } else if (action === 'cat-reset') {
      if (await askConfirm('Återställ kategorin', `Visningen, innehållet, åtgärderna och pennorna i ${c.name} blir som förvalet. Vyernas egna ändringar är kvar.`, 'Återställ')) {
        this.set(resetCategory(this.book, this.cat(type)), `Återställ kategori: ${c.name}`);
      }
    } else if (action === 'cat-left' || action === 'cat-right') {
      this.set(moveCategory(this.book, c, action === 'cat-left' ? -1 : 1), 'Flytta kategori');
    } else if (action === 'cat-delete') {
      const uses = categoryUses(this.store.doc, c);
      const first = categoriesOf(this.book, type).find((x) => x !== c)?.name ?? '';
      if (uses && !(await askConfirm('Ta bort kategorin', `${uses} ${uses === 1 ? 'vy har' : 'vyer har'} ${c.name}. De får ${first} i stället, med sina egna ändringar kvar.`))) return;
      const r = deleteCategory(this.store.doc, this.cat(type));
      if (!r) return;
      delete this.chosen[type];
      this.store.transact(`Ta bort kategori: ${c.name}`, (tx) => {
        tx.setGraphics(r.book);
        tx.setViews(r.views);
      });
    }
  }

  private importFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        // En äldre stilmall ger stilen till kategorin som är vald.
        const at = this.place.kind === 'type' ? this.cat(this.place.type) : undefined;
        const read = normalizeBook(JSON.parse(await file.text()), this.book, at);
        // Projektets egna linjetyper och fyllningstyper som filen saknar är kvar (0.8.30, 0.8.36), så att formerna ritas som förut.
        const keep = (this.book.lineTypes ?? []).filter((t) => !read.lineTypes?.some((r) => r.id === t.id));
        if (keep.length) read.lineTypes = [...(read.lineTypes ?? []), ...keep];
        const keepFills = (this.book.fillTypes ?? []).filter((t) => !read.fillTypes?.some((r) => r.id === t.id));
        if (keepFills.length) read.fillTypes = [...(read.fillTypes ?? []), ...keepFills];
        this.set(read, `Importera stilbok: ${read.name}`);
      } catch (err) {
        this.onError(err instanceof SyntaxError ? 'Filen gick inte att läsa som stilbok.' : (err as Error).message);
      }
    });
    input.click();
  }

  private onChange(e: Event): void {
    const input = e.target as HTMLInputElement | HTMLSelectElement;
    if (input.matches('[data-sb-only]')) {
      this.onlyChanged = (input as HTMLInputElement).checked;
      this.render();
      return;
    }
    if (input.matches('[data-sb-name]')) {
      const name = input.value.trim();
      if (name && name !== this.book.name) this.set({ ...this.book, name }, `Stilbokens namn: ${name}`);
      return;
    }
    // Ett material (0.10.28.1) ändras med objekten som har det.
    const mat = materialFieldChange(this.book, input);
    if (mat) {
      updateMaterial(this.store, mat.id, mat.label, mat.fn);
      return;
    }
    if (input.dataset.material) return;
    // Resurserna: linjetyper, fyllningstyper och texter.
    if (this.place.kind !== 'type') {
      const book = structuredClone(this.book);
      const label = applyLineTypeField(book, input) ?? applyFillTypeField(book, input) ?? applyLabelField(book, input);
      // Ett mönster som inte gick att läsa: visa det gamla igen.
      if (label === '') this.render();
      if (label) this.set(book, label);
      return;
    }
    const type = this.place.type;
    const s = this.scope(type);
    const c = s.cat;
    const cur = s.cur;
    const what = s.view ? `vyn ${s.view.name}` : c.name;
    if (input.matches('[data-sb-copy]')) {
      const [kind, a, b] = input.value.split(':');
      const from = kind === 'preset' ? stylePresets().find((p) => p.id === a) : this.book.categories.find((x) => x.type === a && x.id === b);
      if (from && !s.view) this.set(copyCategoryFrom(this.book, c, from), `Kopiera till ${c.name} från ${from.name}`);
      else this.render();
      return;
    }
    const showKey = input.dataset.catShow as keyof CategoryShow | undefined;
    if (showKey) {
      const show: CategoryShow = structuredClone(cur.show);
      if (showKey === 'compare' || showKey === 'hideDemolished') show[showKey] = (input as HTMLInputElement).checked;
      else if (showKey === 'detail' || showKey === 'labelDetail' || showKey === 'modelDetail') show[showKey] = input.value as DetailLevel;
      this.commit(type, { ...cur, show }, `Ändra ${s.view ? 'vyns visning' : 'kategori'}: ${what}`);
      return;
    }
    if (input.dataset.catHide !== undefined) {
      const show: CategoryShow = structuredClone(cur.show);
      setShown(show, input.dataset.catHide, (input as HTMLInputElement).checked);
      this.commit(type, { ...cur, show }, `Ändra innehåll: ${what}`);
      return;
    }
    if (input.matches('[data-cat-scale]')) {
      const n = Math.round(Number(input.value.replace(/\s/g, '')));
      if (n > 0 && !s.view) this.commit(type, { ...cur, scale: n }, `Ändra kategori: ${c.name}`);
      else this.render();
      return;
    }
    if (input.matches('[data-cat-kind]')) {
      if (!s.view) this.commit(type, { ...cur, kind: input.value as SiteCategory }, `Ändra kategori: ${c.name}`);
      return;
    }
    // Stilen: pennorna, linje- och fyllningstyperna (resurser i samma fält) och åtgärderna.
    const r = editStyle(this.book, cur.style, (sheet) => applyPenField(sheet, input) ?? applyLineTypeField(sheet, input) ?? applyFillTypeField(sheet, input) ?? applyLabelField(sheet, input) ?? applyActionField(sheet, input));
    if (r.result === '') this.render();
    if (r.result) this.commit(type, { ...cur, style: r.style }, r.result, r.book);
  }
}

/** Fältets data-attribut och värde, så att samma fält hittas efter omritningen; null utanför dialogen. */
function focusSelector(el: Element | null, root: HTMLElement): string | null {
  if (!(el instanceof HTMLElement) || !root.contains(el)) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  const attrs = ['data-key', 'data-field', 'data-lab', 'data-pen', 'data-linetype', 'data-filltype', 'data-material', 'data-material-id', 'data-action', 'data-pen-key', 'data-filltype-id', 'data-linetype-id', 'data-family', 'data-sb-go', 'data-sb-cat', 'data-cat-show', 'data-cat-hide', 'data-cat-scale', 'data-cat-kind', 'data-sb-name', 'data-sb-only', 'data-sb-reset', 'data-sb-view', 'data-sb-goview'];
  const parts = attrs.filter((a) => el.hasAttribute(a)).map((a) => `[${a}="${CSS.escape(el.getAttribute(a)!)}"]`);
  if (!parts.length) return null;
  const v = el instanceof HTMLInputElement && el.type === 'radio' ? `[value="${CSS.escape(el.value)}"]` : '';
  return el.tagName.toLowerCase() + parts.join('') + v;
}
