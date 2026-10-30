import { setGraphics } from '../core/commands';
import type { StyleBook } from '../core/graphics';
import { exportBook, importBook, paperCounts, paperInFile, readBookFile, type PaperChoice, type StyleBookFile } from '../core/styleBookFile';
import { clearTemplate, loadTemplate, saveTemplate } from '../storage/localStore';
import type { DocStore } from '../core/store';
import { DETAIL_LABELS, DETAIL_LEVELS } from '../core/states';
import { SITE_CATEGORIES, SITE_STOREY, type SiteCategory } from '../core/model';
import { toggleUnderlay, type ViewUnderlay } from '../core/viewUnderlays';
import { editUnderlays, hostFor, underlayAddSelect, underlayRowsMarkup } from './underlayRows';
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
import { askChecks, askConfirm, askText } from './ask';
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
import { closeRowControl, enhanceRowControls, type RowControlOptions } from './style/rowControls';
import { contentIcon, RARE_CONTENT } from './style/contentIcons';
import { newPlacesState, penListMarkup, placesSection, type PlaceKind } from './style/places';
import { addPen, editPen, objectOf, removePens, setPlaces } from './style/placeEdits';
import { penKey, penTable, stylePlaces, withFrozenPens } from '../repr/penPlaces';
import { fromHex, toHex } from './style/colors';
import { generalChange, generalClick, generalMarkup } from './style/general';

/** Raderna som sök och *Vanliga/Alla* (0.10.34) visar eller döljer. */
const FILTER_ROWS = '.style-row, .pen-row, .material-row, .linetype-row, .filltype, .filltype-builtin, .tpl-row, .sb-groups label.check, .sb-show label.field, .sb-show label.check, .sb-views li';

/** Det som visas till höger: Allmänt, en vytyp eller en resurs. */
type Place = { kind: 'general' } | { kind: 'type'; type: ViewType } | { kind: 'res'; res: Resource };
type Resource = 'pens' | 'materials' | 'lineTypes' | 'fillTypes' | 'text';

const RESOURCES: readonly { res: Resource; name: string }[] = [
  { res: 'pens', name: 'Pennor' },
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
  private onSaveFile: (file: StyleBookFile) => void;
  private onError: (msg: string) => void;
  private place: Place = { kind: 'type', type: 'storey' };
  /** Den valda kategorin per vytyp. */
  private chosen: Partial<Record<ViewType, string>> = {};
  /** Vyn vars stil visas (0.10.33, *Stil för den här vyn…*), annars kategorin. */
  private viewId: string | null = null;
  /** *Visa bara avvikelser* (0.10.33). */
  private onlyChanged = false;
  /** Sökningen i panelen (0.10.34). */
  private query = '';
  /** *Vanliga* (sant) eller *Alla* (0.10.34): det sällan ändrade döljs under Vanliga, utom det som är ändrat. */
  private common = true;
  /** Radkontrollernas koppling till stilboken (0.10.34). */
  private controls: RowControlOptions = {
    colorSets: () => this.book.colorSets ?? [],
    setColorSets: (sets) => {
      const book = { ...this.book };
      if (sets.length) book.colorSets = sets;
      else delete book.colorSets;
      this.set(book, 'Ändra favoritfärger');
    },
    addLineType: () => {
      const book = structuredClone(this.book);
      addLineType(book);
      this.place = { kind: 'res', res: 'lineTypes' };
      this.viewId = null;
      this.set(book, 'Ny linjetyp');
      this.render();
      const own = this.el.querySelectorAll<HTMLInputElement>('[data-linetype$=":name"]');
      own[own.length - 1]?.select();
    },
  };
  /** Pennor och ställen (0.10.36): det som väljs och filtreras i listorna över ställen. */
  private pp = newPlacesState();
  /** Raden som visas och blinkar efter *Gå dit* till ett ställe (en väljare). */
  private flash: string | null = null;
  /** Öppna en vy i appen (*Gå dit* i listan över vyer med kategorin). */
  goToView: (id: string) => void = () => {};
  /** Visa ett objekt i ritningen (*Gå dit* i materialens ställen, 0.10.36). */
  goToObject: (id: string | string[]) => void = () => {};

  constructor(store: DocStore, onSaveFile: (file: StyleBookFile) => void, onError: (msg: string) => void) {
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
    this.el.addEventListener('input', (e) => {
      const t = e.target as HTMLElement;
      if (t.matches('[data-pp-search]')) {
        this.pp.query = (t as HTMLInputElement).value;
        this.render();
        return;
      }
      if (!t.matches('[data-sb-search]')) return;
      this.query = (t as HTMLInputElement).value;
      this.applyFilter();
    });
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
    closeRowControl();
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
      const views = ov ? tx.doc.views.map((v) => (v.id === id ? { ...v, overrides: ov } : v)) : resetViewOverrides(tx.doc.views, id);
      const next = withFrozenPens({ ...tx.doc, graphics: book, views });
      if (next !== this.book) tx.setGraphics(next);
      tx.setViews(views);
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
          <label class="sb-search">${icons.zoomIn}<input type="search" data-sb-search placeholder="Sök" aria-label="Sök inställning" value="${escapeHtml(this.query)}"></label>
          <span class="sb-seg" role="group" aria-label="Vanliga eller alla inställningar">
            <button class="${this.common ? 'on' : ''}" data-sb-common="1" aria-pressed="${this.common}" title="Vanliga: det som sällan ändras döljs, utom det som är ändrat">Vanliga</button>
            <button class="${this.common ? '' : 'on'}" data-sb-common="0" aria-pressed="${!this.common}" title="Alla inställningar">Alla</button>
          </span>
          <span class="sb-file" role="group" aria-label="Stilboken som fil">
            <button class="btn" data-action="save-style" title="Spara hela stilboken som fil, med logotypen, texturerna och (om du vill) mallbladen och stämplarna">Exportera…</button>
            <button class="btn" data-action="open-style" title="Läs in en stilbok (eller en äldre stilmall) från fil">Importera…</button>
            <button class="btn" data-action="template-style" title="Spara stilboken i webbläsaren som mall för nya projekt">Mall för nya projekt…</button>
          </span>
        </div>
        <button class="icon-btn" data-action="close" aria-label="Stäng">×</button>
      </header>
      <div class="sb-body">
        <nav class="sb-rail" aria-label="Stilboken">${this.railMarkup()}</nav>
        <div class="sb-main">${this.mainMarkup()}<p class="note sb-nohit" hidden>Inget i den här delen matchar sökningen.</p><p class="note sb-more" hidden>Det som sällan ändras visas under <button class="btn btn-ghost" data-sb-common="0">Alla</button>.</p></div>
      </div>
      <footer>
        <p class="note">Svart visas ljust på mörk skärm och vitt följer bakgrunden. På papper blir de svart och vitt.</p>
        <button class="btn btn-primary" data-action="close">Klar</button>
      </footer>
    </div>`;
    if (guideOpen) this.el.querySelector<HTMLDetailsElement>('.filltype-guide')?.setAttribute('open', '');
    if (viewsOpen) this.el.querySelector<HTMLDetailsElement>('.sb-views')?.setAttribute('open', '');
    this.markRows();
    const main = this.el.querySelector<HTMLElement>('.sb-main');
    if (main) enhanceRowControls(main, this.controls);
    this.applyFilter();
    this.el.querySelectorAll<HTMLElement>('.sb-main, .sb-rail').forEach((e, i) => (e.scrollTop = scrolled[i] ?? 0));
    if (focus) {
      const f = this.el.querySelector<HTMLElement>(focus);
      f?.focus({ preventScroll: true });
      if (f instanceof HTMLInputElement && f.type === 'search') f.setSelectionRange(f.value.length, f.value.length);
    }
    // *Gå dit* till ett ställe (0.10.36): raden rullas fram och blinkar.
    if (this.flash) {
      const row = this.el.querySelector(this.flash)?.closest<HTMLElement>('.pen-row, .style-row, .material-row');
      this.flash = null;
      if (row) {
        row.scrollIntoView({ block: 'center' });
        row.classList.add('sb-flash');
      }
    }
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
      mark.innerHTML = `<i class="sb-dot" aria-hidden="true"></i><button type="button" class="sb-row-reset" data-sb-reset="${escapeHtml(row)}" title="Ändrad mot ${escapeHtml(above)}. Återställ till dess värde." aria-label="Återställ">${icons.restore}</button>`;
      const at = host.matches('.style-row, .pen-row') ? host.querySelector('.style-name') : host.matches('label.field') ? host.firstElementChild : host;
      (at ?? host).append(mark);
    }
    main.classList.toggle('only-changed', this.onlyChanged);
    const none = main.querySelector<HTMLElement>('.sb-none');
    if (none) none.hidden = !this.onlyChanged || rows.size > 0;
  }

  /**
   * Sök och *Vanliga/Alla* (0.10.34): raderna som inte innehåller det sökta
   * döljs (en rubrik som träffar visar hela delen), och under Vanliga det som
   * sällan ändras (`.sb-rare`) utom det som är ändrat.
   */
  private applyFilter(): void {
    const main = this.el.querySelector<HTMLElement>('.sb-main');
    if (!main) return;
    const q = this.query.trim().toLowerCase();
    main.classList.toggle('sb-common', this.common && !q);
    const text = (el: Element) => {
      let t = el.textContent ?? '';
      el.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input[type="text"], textarea, select, [aria-label]').forEach((f) => {
        t += ` ${f.getAttribute('aria-label') ?? ''}`;
        if (f instanceof HTMLSelectElement) t += ` ${f.selectedOptions[0]?.textContent ?? ''}`;
        else if (!(f instanceof HTMLButtonElement)) t += ` ${f.value}`;
      });
      return t.toLowerCase();
    };
    for (const sec of main.querySelectorAll<HTMLElement>('.style-labels')) {
      const head = q && (sec.querySelector('h3')?.textContent ?? '').toLowerCase().includes(q);
      let any = false;
      for (const row of sec.querySelectorAll<HTMLElement>(FILTER_ROWS)) {
        const miss = !!q && !head && !text(row).includes(q);
        row.classList.toggle('sb-miss', miss);
        if (!miss) any = true;
      }
      for (const fs of sec.querySelectorAll<HTMLElement>('.sb-groups fieldset')) fs.classList.toggle('sb-miss', !!q && !fs.querySelector('label.check:not(.sb-miss)'));
      sec.classList.toggle('sb-miss', !!q && !head && !any);
    }
    const note = main.querySelector<HTMLElement>('.sb-more');
    if (note) note.hidden = !(this.common && !q && main.querySelector('.sb-rare:not(.sb-changed):not(:has(.sb-changed))'));
    const empty = main.querySelector<HTMLElement>('.sb-nohit');
    if (empty) empty.hidden = !q || !!main.querySelector('.style-labels:not(.sb-miss)');
  }

  private mainMarkup(): string {
    const p = this.place;
    if (p.kind === 'general') return generalMarkup(this.store.doc);
    if (p.kind === 'res') {
      const sheet = this.book;
      const doc = this.store.doc;
      if (p.res === 'pens') return penListMarkup(doc, this.pp);
      if (p.res === 'materials') return materialSection(sheet, this.materialUses()) + placesSection(doc, 'material', this.pp);
      if (p.res === 'lineTypes') return lineTypeSection(sheet, this.lineTypeUses()) + placesSection(doc, 'linetype', this.pp);
      if (p.res === 'fillTypes') return fillTypeSection(sheet, this.fillTypeUses()) + placesSection(doc, 'filltype', this.pp);
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
      ${this.underlayMarkup(s.cur, s.view)}
      <section class="style-labels style-actions">
        <h3>Åtgärder</h3>
        <p class="note">Hur väggarnas snitt och linjerna ritas för det som finns kvar, rivs och planeras.</p>
        ${actionRows(sheet)}
      </section>
      ${penSection(sheet, type, this.penNumbers())}`;
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
            .map(
              ([k, label]) =>
                `<label class="check sb-tog${OFF_BY_DEFAULT.has(k) ? ' off-default' : ''}${RARE_CONTENT.has(k) ? ' sb-rare' : ''}"><input type="checkbox" data-cat-hide="${escapeHtml(k)}"${isShown(c.show, k) ? ' checked' : ''}>${contentIcon(k, g.id)}<span>${escapeHtml(label)}</span></label>`,
            )
            .join('')}</fieldset>`,
        )
        .join('')}</div>
    </section>`;
  }

  /**
   * Underlagen i vyn (0.10.35): samma rader som under Visa. En kategori har
   * ingen våning, så *Våningen under* gäller där vyn står.
   */
  private underlayMarkup(c: ViewCategory, view?: ViewDef): string {
    const doc = this.store.doc;
    const list = c.show.underlays ?? [];
    const host = view ? hostFor(view.storey, { ...view, viewId: view.id }) : { storey: c.type === 'site' ? SITE_STOREY : '', plan: c.type === 'storey' || c.type === 'site' };
    return `<section class="style-labels sb-underlays"><h3>Underlag i vyn</h3>
      <div class="style-row sb-ul-head" data-cat-underlays><span class="style-name">Underlagen, nedifrån och upp</span></div>
      ${underlayRowsMarkup(doc, list, view ? host : null, underlayAddSelect(doc, host, list))}
      <p class="note">Ritas tonade under eller över vyn och följer med till bladet: en våning, Platsen, ortofotot, ett arbetsblad eller en annan vy. Kalkera i projektträdet lägger ett underlag där du är.</p>
    </section>`;
  }

  /** Pennans nummer för en tjocklek och färg (0.10.36), för numret framför pennraderna. */
  private penNumbers(): (weight: number, color: string | undefined) => number | undefined {
    const no = new Map(penTable(this.book, stylePlaces(this.store.doc)).map((r) => [penKey(r.pen), r.pen.no]));
    return (weight, color) => no.get(penKey({ weight, color }));
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

  /** Sorten av ställen som visas: pennor, linjetyper, fyllningstyper eller material. */
  private placeKind(): PlaceKind | null {
    const p = this.place;
    if (p.kind !== 'res') return null;
    return p.res === 'pens' ? 'pen' : p.res === 'lineTypes' ? 'linetype' : p.res === 'fillTypes' ? 'filltype' : p.res === 'materials' ? 'material' : null;
  }

  /** Klicken i pennlistan och listorna över ställen (0.10.36). Sant om klicket hörde hit. */
  private async placesClick(e: Event, target: HTMLElement): Promise<boolean> {
    // Numret framför en pennrad i en kategori: pennan och dess ställen.
    const penGo = target.closest<HTMLElement>('[data-pen-goto]')?.dataset.penGoto;
    if (penGo) {
      e.preventDefault();
      this.goToPens(penGo);
      return true;
    }
    const kind = this.placeKind();
    if (!kind) return false;
    const pick = target.closest<HTMLElement>('[data-pp-pick]')?.dataset.ppPick;
    if (pick) {
      this.pp.filter.pen = this.pp.filter.pen === pick ? '' : pick;
      this.pp.checked.clear();
      this.render();
      return true;
    }
    const tag = target.closest<HTMLElement>('[data-pp-tag]')?.dataset.ppTag;
    if (tag) {
      if (this.pp.tags.has(tag)) this.pp.tags.delete(tag);
      else this.pp.tags.add(tag);
      this.render();
      return true;
    }
    const goto = target.closest<HTMLElement>('[data-pp-goto]')?.dataset.ppGoto;
    if (goto) {
      this.goToPlace(kind, goto);
      return true;
    }
    const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'pen-add') {
      this.pp.filter.pen = String(addPen(this.store));
      this.render();
      return true;
    }
    if (action === 'pen-remove' || action === 'pen-remove-unused') {
      const no = Number(target.closest<HTMLElement>('[data-pen-no]')?.dataset.penNo);
      removePens(this.store, action === 'pen-remove' ? no : undefined);
      if (action === 'pen-remove' && this.pp.filter.pen === String(no)) this.pp.filter.pen = '';
      return true;
    }
    return false;
  }

  /** Pennlistan med pennan vald (numret i en kategori leder hit). */
  private goToPens(no: string): void {
    this.place = { kind: 'res', res: 'pens' };
    this.viewId = null;
    this.pp.filter.pen = no;
    this.pp.checked.clear();
    this.pp.tags.clear();
    this.pp.query = '';
    this.render();
  }

  /** *Gå dit* för ett ställe: kategorins eller vyns rad i stilboken, materialet, eller objektet i ritningen. */
  private goToPlace(kind: PlaceKind, id: string): void {
    const doc = this.store.doc;
    if (kind === 'material') {
      const obj = objectOf(doc, id);
      if (!obj) return;
      this.close();
      this.goToObject(obj);
      return;
    }
    const place = stylePlaces(doc).find((p) => p.id === id);
    if (!place) return;
    const w = place.where;
    const key = place.key;
    // En typs eller ett objekts egen penna (0.10.37): objekten i ritningen.
    if (w.kind === 'def' || w.kind === 'object') {
      const ids = w.kind === 'object' ? [w.id] : Object.values(doc.elements).filter((e) => e.definition === w.def).map((e) => e.id);
      if (!ids.length) return;
      this.close();
      this.goToObject(ids);
      return;
    }
    if (w.kind === 'material') {
      this.place = { kind: 'res', res: 'materials' };
      this.viewId = null;
      this.flash = `[data-material="${CSS.escape(w.material)}:name"]`;
    } else {
      if (w.kind === 'view') this.showView(w.view);
      else {
        this.viewId = null;
        this.place = { kind: 'type', type: w.type };
        this.chosen[w.type] = w.cat;
      }
      this.onlyChanged = false;
      this.common = false;
      this.query = '';
      const k = key.slice(key.indexOf('.') + 1);
      this.flash = key.startsWith('pens.') ? `[data-pen="${CSS.escape(k)}:weight"]` : `[data-key="${CSS.escape(k)}"][data-field="fill"]`;
    }
    this.render();
  }

  /** Fälten i pennlistan och listorna över ställen (0.10.36). Sant om fältet hörde hit. */
  private placesChange(input: HTMLInputElement | HTMLSelectElement): boolean {
    const kind = this.placeKind();
    if (!kind) return false;
    const pp = this.pp;
    if (input.matches('[data-pp-filter]')) {
      pp.filter[kind] = input.value;
      pp.checked.clear();
      this.render();
      return true;
    }
    if (input.matches('[data-pp-check]')) {
      const id = input.dataset.ppCheck!;
      if ((input as HTMLInputElement).checked) pp.checked.add(id);
      else pp.checked.delete(id);
      this.render();
      return true;
    }
    if (input.matches('[data-pp-all]')) {
      const ids = [...this.el.querySelectorAll<HTMLInputElement>('[data-pp-check]')].map((x) => x.dataset.ppCheck!);
      for (const id of ids) {
        if ((input as HTMLInputElement).checked) pp.checked.add(id);
        else pp.checked.delete(id);
      }
      this.render();
      return true;
    }
    if (input.matches('[data-pp-set]')) {
      setPlaces(this.store, kind, [input.dataset.ppSet!], input.value);
      return true;
    }
    if (input.matches('[data-pp-move]')) {
      const ids = [...this.el.querySelectorAll<HTMLInputElement>('[data-pp-check]:checked')].map((x) => x.dataset.ppCheck!);
      if (input.value && ids.length) {
        // Ställenas nycklar är kvar efter flytten (materialens rader byter material), så markeringen är kvar där de hamnar.
        pp.checked.clear();
        setPlaces(this.store, kind, ids, input.value);
      } else this.render();
      return true;
    }
    const field = input.dataset.penlist;
    if (field) {
      const [no, what] = field.split(':');
      const pen = penTable(this.book, stylePlaces(this.store.doc)).find((r) => String(r.pen.no) === no)?.pen;
      if (!pen) return true;
      let err: string | null = null;
      if (what === 'weight') err = editPen(this.store, Number(no), { weight: Number(input.value) });
      else if (input.value.toLowerCase() !== toHex(pen.color ?? 'ink')) err = editPen(this.store, Number(no), { color: fromHex(input.value) });
      if (err) {
        this.onError(err);
        this.render();
      }
      return true;
    }
    return false;
  }

  /** Lägg stilboken; pennlistan låses (0.10.36), så att pennornas nummer inte flyttar när ställena ändras. */
  private set(book: StyleBook, label: string): void {
    setGraphics(this.store, withFrozenPens({ ...this.store.doc, graphics: book }), label);
  }

  private async onClick(e: Event): Promise<void> {
    const target = e.target as HTMLElement;
    const common = target.closest<HTMLElement>('[data-sb-common]')?.dataset.sbCommon;
    if (common !== undefined) {
      this.common = common === '1';
      this.render();
      return;
    }
    if (await this.placesClick(e, target)) return;
    if (await generalClick(this.store, target, (book, label) => this.set(book, label))) return;
    const go = target.closest<HTMLElement>('[data-sb-go]')?.dataset.sbGo;
    if (go) {
      const [kind, what] = go.split(':');
      this.pp.checked.clear();
      this.pp.tags.clear();
      this.pp.query = '';
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
    const ulBtn = target.closest<HTMLElement>('button[data-ul-field]');
    if (ulBtn && this.place.kind === 'type') {
      const type = this.place.type;
      const s = this.scope(type);
      const next = editUnderlays(s.cur.show.underlays ?? [], ulBtn);
      if (next) this.commit(type, { ...s.cur, show: withList(s.cur.show, next) }, `Ändra underlag: ${s.view ? `vyn ${s.view.name}` : s.cat.name}`);
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
    if (action === 'save-style') {
      const choice = await this.askPaper('Exportera stilboken', 'Hela stilboken sparas som fil, med logotypen och materialens texturer. Projektets uppgifter (namn, nummer, fastighet, skede) följer inte med.', 'Exportera');
      if (choice) this.onSaveFile(exportBook(this.store.doc, choice));
    }
    if (action === 'open-style') this.importFile();
    if (action === 'template-style') await this.template();
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

  /**
   * Fråga om mallbladen och stämplarna ska med (0.10.40). Har projektet
   * inga svaras direkt utan dem; null om man avbryter.
   */
  private async askPaper(title: string, text: string, ok: string, extra?: string, counts = paperCounts(this.store.doc)): Promise<(PaperChoice & { extra?: boolean }) | null> {
    if (!counts.masters && !counts.stamps && !extra) return { masters: false, stamps: false };
    const checks = [
      ...(counts.masters ? [{ key: 'masters', label: `Mallbladen (${counts.masters}), med det som är ritat på dem`, checked: true }] : []),
      ...(counts.stamps ? [{ key: 'stamps', label: `Stämplarna (${counts.stamps})`, checked: true }] : []),
    ];
    const r = await askChecks(title, text, checks, ok, extra);
    return r ? { masters: !!r.masters, stamps: !!r.stamps, ...(r.extra ? { extra: true } : {}) } : null;
  }

  /** *Mall för nya projekt* (0.10.40): stilboken i webbläsaren, som nya projekt får. */
  private async template(): Promise<void> {
    const had = await loadTemplate();
    const when = had ? new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short' }).format(had.savedAt) : '';
    const text = had
      ? `Mallen i webbläsaren är ${had.name}, sparad ${when}. Den ersätts med den här stilboken. Nya projekt får mallen; under Nytt projekt kan du också välja Svensk standard eller en stilboksfil.`
      : 'Nya projekt får den här stilboken i stället för Svensk standard. Mallen sparas i webbläsaren och försvinner om webbläsarens data rensas: exportera stilboken också som fil, så kan du välja filen under Nytt projekt.';
    const choice = await this.askPaper('Mall för nya projekt', text, 'Spara som mall', had ? 'Ta bort mallen' : undefined);
    if (!choice) return;
    if (choice.extra) {
      await clearTemplate();
      this.onError('Mallen är borttagen. Nya projekt får Svensk standard.');
      return;
    }
    const ok = await saveTemplate(JSON.stringify(exportBook(this.store.doc, choice)), this.book.name);
    this.onError(ok ? `${this.book.name} är mall för nya projekt.` : 'Webbläsaren sparade inte mallen (privat fönster eller blockerad webbplatsdata). Exportera stilboken som fil i stället.');
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
        const read = readBookFile(JSON.parse(await file.text()), this.book, at);
        const choice = read.paper
          ? await this.askPaper('Importera stilboken', `Stilboken i ${file.name} ersätter projektets. Filen har också mallblad eller stämplar; de du kryssar läggs till bredvid de som finns.`, 'Importera', undefined, paperInFile(read))
          : { masters: false, stamps: false };
        if (!choice) return;
        // Pennlistan låses (0.10.36), som vid andra ändringar.
        read.book = withFrozenPens({ ...this.store.doc, graphics: read.book });
        importBook(this.store, read, choice, `Importera stilbok: ${read.book.name}`);
      } catch (err) {
        this.onError(err instanceof SyntaxError ? 'Filen gick inte att läsa som stilbok.' : (err as Error).message);
      }
    });
    input.click();
  }

  private onChange(e: Event): void {
    const input = e.target as HTMLInputElement | HTMLSelectElement;
    if (input.matches('[data-sb-search], [data-pp-search]')) return;
    if (this.placesChange(input)) return;
    if (input.matches('[data-sb-only]')) {
      this.onlyChanged = (input as HTMLInputElement).checked;
      this.render();
      return;
    }
    if (generalChange(this.store, input, (book, label) => this.set(book, label))) return;
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
    // Underlagen (0.10.35): lägg till ur listan, eller ändra en rad.
    if (input.matches('[data-ul-addsel]')) {
      if (input.value) this.commit(type, { ...cur, show: { ...structuredClone(cur.show), underlays: toggleUnderlay(cur.show.underlays, input.value) } }, `Lägg till underlag: ${what}`);
      return;
    }
    if (input.matches('[data-ul-field]')) {
      const next = editUnderlays(cur.show.underlays ?? [], input);
      if (next) this.commit(type, { ...cur, show: withList(cur.show, next) }, `Ändra underlag: ${what}`);
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

/** Visningen med en ny lista underlag (en tom tas bort). */
function withList(show: CategoryShow, list: ViewUnderlay[]): CategoryShow {
  const out = structuredClone(show);
  if (list.length) out.underlays = list;
  else delete out.underlays;
  return out;
}

/** Fältets data-attribut och värde, så att samma fält hittas efter omritningen; null utanför dialogen. */
function focusSelector(el: Element | null, root: HTMLElement): string | null {
  if (!(el instanceof HTMLElement) || !root.contains(el)) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  const attrs = ['data-key', 'data-field', 'data-lab', 'data-pen', 'data-linetype', 'data-filltype', 'data-material', 'data-material-id', 'data-action', 'data-pen-key', 'data-filltype-id', 'data-linetype-id', 'data-family', 'data-sb-go', 'data-sb-cat', 'data-cat-show', 'data-cat-hide', 'data-cat-scale', 'data-cat-kind', 'data-sb-name', 'data-sb-only', 'data-sb-search', 'data-sb-reset', 'data-sb-view', 'data-sb-goview', 'data-ul', 'data-ul-field', 'data-ul-addsel', 'data-pp-search', 'data-pp-filter', 'data-pp-set', 'data-pp-check', 'data-pp-all', 'data-pp-move', 'data-penlist', 'data-pp-tag', 'data-pp-pick', 'data-gen', 'data-gen-action'];
  const parts = attrs.filter((a) => el.hasAttribute(a)).map((a) => `[${a}="${CSS.escape(el.getAttribute(a)!)}"]`);
  if (!parts.length) return null;
  const v = el instanceof HTMLInputElement && el.type === 'radio' ? `[value="${CSS.escape(el.value)}"]` : '';
  return el.tagName.toLowerCase() + parts.join('') + v;
}
