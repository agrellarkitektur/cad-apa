import { setGraphics } from '../core/commands';
import type { StyleBook } from '../core/graphics';
import type { StyleBookFile } from '../core/styleBookFile';
import type { DocStore } from '../core/store';
import type { ViewDef } from '../core/model';
import { categoryDefault, categoryOf, editStyle, effectiveCategory, overridesFrom, putCategory, resetViewOverrides, viewTypeOf, VIEW_TYPES, type ViewCategory, type ViewType } from '../core/viewCategories';
import { escapeHtml } from './labels';
import { icons } from './icons';
import { labelSection } from './style/labels';
import { addLineType, lineTypeSection } from './style/lineTypes';
import { fillTypeSection } from './style/fillTypes';
import { resetPen } from './style/pens';
import { materialSection } from './style/materials';
import { showGroupsFor } from './app/showKeys';
import { changedRows, resetRow, rowSelector } from './style/deviations';
import { closeRowControl, enhanceRowControls, type RowControlOptions } from './style/rowControls';
import { newPlacesState, penListMarkup, placesSection, type PlaceKind } from './style/places';
import { objectOf } from './style/placeEdits';
import { stylePlaces, withFrozenPens } from '../repr/penPlaces';
import { generalChange, generalClick, generalMarkup } from './style/general';
import { categoryTabMarkup, type StyleScope } from './style/categoryTab';
import { categoryAction, categoryChange, underlayClick, viewAction } from './style/categoryEdits';
import { fillTypeUses, lineTypeUses, materialUsesMap, resourceChange, resourceClick } from './style/resourceEdits';
import { placesChange, placesClick } from './style/placesPanel';
import { exportBookFile, importBookFile, templateDialog } from './style/bookFile';
import { newRailEditorState, railEditorChange, railEditorClick, railEditorDrag, railEditorMarkup, railEditorSearch } from './style/railingTypes';
import { newProfileEditorState, profileCanvasPointer, profileEditorChange, profileEditorClick, profileEditorDrag, profileEditorMarkup, profileEditorSearch } from './style/profileTypes';

/** Raderna som sök och *Vanliga/Alla* (0.10.34) visar eller döljer. */
const FILTER_ROWS = '.style-row, .pen-row, .material-row, .linetype-row, .filltype, .filltype-builtin, .tpl-row, .sb-groups label.check, .sb-show label.field, .sb-show label.check, .sb-views li';

/** Det som visas till höger: Allmänt, en vytyp eller en resurs. */
type Place = { kind: 'general' } | { kind: 'type'; type: ViewType } | { kind: 'res'; res: Resource };
type Resource = 'pens' | 'materials' | 'lineTypes' | 'fillTypes' | 'railings' | 'profiles' | 'text';

/** Stilbokens flikar (0.11.6, beslut D och H): Stil, Typer och Allmänt. */
export type BookTab = 'style' | 'types' | 'general';

const TABS: readonly [BookTab, string][] = [
  ['style', 'Stil'],
  ['types', 'Typer'],
  ['general', 'Allmänt'],
];

/** Ritresurserna under Stil. */
const RESOURCES: readonly { res: Resource; name: string }[] = [
  { res: 'pens', name: 'Pennor' },
  { res: 'lineTypes', name: 'Linjetyper' },
  { res: 'fillTypes', name: 'Fyllningstyper' },
  { res: 'text', name: 'Text och littera' },
];

/** Typerna under Typer (0.11.6); de som kommer senare står tonade. */
const TYPES: readonly { res: Resource | null; name: string; later?: string }[] = [
  { res: 'materials', name: 'Material' },
  { res: 'profiles', name: 'Profiler' },
  { res: null, name: 'Ändprofiler', later: 'Kommer i 0.11.7' },
  { res: 'railings', name: 'Räckestyper' },
  { res: null, name: 'Dörr- och fönstertyper', later: 'Kommer i 0.11.8' },
];

const TYPE_RES: ReadonlySet<Resource> = new Set(['materials', 'profiles', 'railings']);

const RAIL_ICON: Record<string, string> = { site: icons.ground, storey: icons.storeys, elevation: icons.elevation, section: icons.section, cube: icons.multi, worksheet: icons.draw2d, sheet: icons.sheet, list: icons.states };

/** Sorten av ställen per resurs (pennor, linjetyper, fyllningstyper, material). */
const PLACE_KIND: Partial<Record<Resource, PlaceKind>> = { pens: 'pen', lineTypes: 'linetype', fillTypes: 'filltype', materials: 'material' };

/**
 * Stilboken (0.10.32, förut stilmallen): i vänsterkanten Projektet ›
 * Allmänt, vytyperna och resurserna. En vytyp har sina kategorier som
 * flikar överst, med visningen, innehållet, åtgärderna och pennorna; en
 * vy följer sin kategori och avviker rad för rad. Resurserna (material,
 * linje- och fyllningstyper, text) gäller alla vyer. Ändringar syns direkt
 * och kan ångras.
 *
 * Den här klassen ritar ramen, söker och filtrerar, markerar avvikelser
 * och skickar klick och fält vidare. Delarna ligger i `src/ui/style/`:
 * `categoryTab.ts` och `categoryEdits.ts` (en vytyp och en vys stil),
 * `placesPanel.ts` (pennor och ställen), `resourceEdits.ts` (material,
 * linje- och fyllningstyper), `bookFile.ts` (ut och in, mallen),
 * `general.ts` (Allmänt) och en fil per del med dess HTML och fält.
 */
export class StyleDialog {
  readonly el: HTMLElement;
  readonly store: DocStore;
  readonly onError: (msg: string) => void;
  private onSaveFile: (file: StyleBookFile) => void;
  private place: Place = { kind: 'type', type: 'storey' };
  /** Den valda kategorin per vytyp. */
  chosen: Partial<Record<ViewType, string>> = {};
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
  pp = newPlacesState();
  /** Räckestypeditorn (0.11.2): vald typ, del och förhandsvisning. */
  rt = newRailEditorState();
  /** Profileditorn (0.11.6): vald typ, delprofil, verktyg och det som ritas. */
  pe = newProfileEditorState();
  /** Det som senast visades under varje flik. */
  private lastIn: Partial<Record<BookTab, Place>> = {};
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
    for (const t of ['dragstart', 'dragover', 'dragleave', 'drop'] as const)
      this.el.addEventListener(t, (e) => {
        railEditorDrag(this.store, e);
        profileEditorDrag(this.store, e);
      });
    // Profileditorns rityta (0.11.6): rita, välj och dra punkter.
    for (const t of ['pointerdown', 'pointermove', 'pointerup'] as const) this.el.addEventListener(t, (e) => void profileCanvasPointer(this.store, this.pe, e, () => this.render()));
    this.el.addEventListener('input', (e) => {
      const t = e.target as HTMLElement;
      if (t.matches('[data-pe-search]')) {
        profileEditorSearch(this.el, this.pe, (t as HTMLInputElement).value);
        return;
      }
      if (t.matches('[data-rt-search]')) {
        railEditorSearch(this.el, this.rt, (t as HTMLInputElement).value);
        return;
      }
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
  open(at?: { type: ViewType; category?: string } | { view: string } | { railingType: string } | { profileType?: string; tab?: BookTab }): void {
    if (at && 'tab' in at && at.tab) this.showTab(at.tab);
    else if (at && 'profileType' in at) {
      this.go({ kind: 'res', res: 'profiles' });
      if (at.profileType) {
        this.pe.def = at.profileType;
        this.pe.part = null;
        this.pe.pending = [];
      }
    } else if (at && 'railingType' in at) {
      this.go({ kind: 'res', res: 'railings' });
      this.rt.def = at.railingType;
      this.rt.part = null;
    } else if (at && 'view' in at) this.showView(at.view);
    else if (at && 'type' in at) {
      this.viewId = null;
      this.place = { kind: 'type', type: at.type };
      this.lastIn.style = this.place;
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

  get book(): StyleBook {
    return this.store.doc.graphics;
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

  /** Det som ändras (0.10.33): kategorin med förvalet ovanför, eller vyn med kategorin ovanför. */
  scope(type: ViewType): StyleScope {
    const view = this.view(type);
    if (!view) {
      const cat = categoryOf(this.book, type, this.chosen[type]);
      return { cat, ref: categoryDefault(cat), cur: cat };
    }
    const cat = categoryOf(this.book, type, view.category);
    return { cat, ref: cat, cur: effectiveCategory(cat, view.overrides), view };
  }

  /** Lägg det ändrade: i kategorin, eller som vyns avvikelser från den. `book` har resurserna (fyllningstyper …) om de ändrats. */
  commit(type: ViewType, cur: ViewCategory, label: string, book: StyleBook = this.book): void {
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

  /** Lägg stilboken; pennlistan låses (0.10.36), så att pennornas nummer inte flyttar när ställena ändras. */
  set(book: StyleBook, label: string): void {
    setGraphics(this.store, withFrozenPens({ ...this.store.doc, graphics: book }), label);
  }

  /**
   * Rullningen och fältet med fokus är kvar när dialogen ritas om efter en
   * ändring, och snabbguiden för fyllningstyperna är kvar utfälld.
   */
  render(): void {
    const guideOpen = this.el.querySelector<HTMLDetailsElement>('.filltype-guide')?.open ?? false;
    const viewsOpen = this.el.querySelector<HTMLDetailsElement>('.sb-views')?.open ?? false;
    const scrolled = [...this.el.querySelectorAll<HTMLElement>('.sb-main, .sb-rail')].map((e) => e.scrollTop);
    const focus = focusSelector(document.activeElement, this.el);
    this.el.innerHTML = `<div class="dialog style-dialog stylebook" role="dialog" aria-modal="true" aria-labelledby="style-title">
      <header>
        <h2 id="style-title">Stilbok</h2>
        <div class="sb-tabs" role="tablist" aria-label="Stilboken">${TABS.map(([t, name]) => `<button role="tab" class="sb-tab${this.tab === t ? ' on' : ''}" data-sb-tab="${t}" aria-selected="${this.tab === t}">${name}</button>`).join('')}</div>
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

  /** Fliken det som visas hör till. */
  get tab(): BookTab {
    const p = this.place;
    return p.kind === 'general' ? 'general' : p.kind === 'res' && TYPE_RES.has(p.res) ? 'types' : 'style';
  }

  /** Gå till en flik: det som senast visades där, annars det första. */
  showTab(tab: BookTab): void {
    const first: Place = tab === 'general' ? { kind: 'general' } : tab === 'types' ? { kind: 'res', res: 'materials' } : { kind: 'type', type: 'storey' };
    this.go(this.lastIn[tab] ?? first);
  }

  private railMarkup(): string {
    const p = this.place;
    const btn = (go: string, icon: string, name: string, on: boolean, later?: string) =>
      `<button class="sb-rail-item${on ? ' on' : ''}" data-sb-go="${go}"${on ? ' aria-current="page"' : ''}${later ? ` disabled title="${escapeHtml(later)}"` : ''}>${icon}<span>${escapeHtml(name)}</span></button>`;
    if (this.tab === 'general') return `<h4>Projektet</h4>${btn('general', icons.properties, 'Allmänt', true)}`;
    if (this.tab === 'types') return `<h4>Typer</h4>${TYPES.map((t) => btn(t.res ? `res:${t.res}` : '', '', t.name, !!t.res && p.kind === 'res' && p.res === t.res, t.later)).join('')}`;
    return `<h4>Vytyper</h4>
      ${VIEW_TYPES.map((t) => btn(t.type ? `type:${t.type}` : '', RAIL_ICON[t.icon] ?? '', t.name, p.kind === 'type' && p.type === t.type, t.later)).join('')}
      <h4>Ritresurser</h4>
      ${RESOURCES.map((r) => btn(`res:${r.res}`, '', r.name, p.kind === 'res' && p.res === r.res)).join('')}`;
  }

  private mainMarkup(): string {
    const p = this.place;
    const doc = this.store.doc;
    if (p.kind === 'general') return generalMarkup(doc);
    if (p.kind === 'type') return categoryTabMarkup(doc, p.type, this.scope(p.type), this.onlyChanged);
    if (p.res === 'pens') return penListMarkup(doc, this.pp);
    if (p.res === 'materials') return materialSection(this.book, materialUsesMap(doc)) + placesSection(doc, 'material', this.pp);
    if (p.res === 'lineTypes') return lineTypeSection(this.book, lineTypeUses(doc)) + placesSection(doc, 'linetype', this.pp);
    if (p.res === 'railings') return railEditorMarkup(doc, this.rt);
    if (p.res === 'profiles') return profileEditorMarkup(doc, this.pe);
    if (p.res === 'fillTypes') return fillTypeSection(this.book, fillTypeUses(doc)) + placesSection(doc, 'filltype', this.pp);
    return labelSection(this.book);
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

  /** Sorten av ställen som visas: pennor, linjetyper, fyllningstyper eller material. */
  placeKind(): PlaceKind | null {
    return this.place.kind === 'res' ? (PLACE_KIND[this.place.res] ?? null) : null;
  }

  /** Pennlistan med pennan vald (numret i en kategori leder hit). */
  goToPens(no: string): void {
    this.go({ kind: 'res', res: 'pens' });
    this.pp.filter.pen = no;
    this.render();
  }

  /** *Gå dit* för ett ställe: kategorins eller vyns rad i stilboken, materialet, eller objektet i ritningen. */
  goToPlace(kind: PlaceKind, id: string): void {
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

  /** Gå till en del i vänsterkanten; listorna över ställen börjar om. */
  private go(place: Place): void {
    this.lastIn[place.kind === 'general' ? 'general' : place.kind === 'res' && TYPE_RES.has(place.res) ? 'types' : 'style'] = place;
    this.pp.checked.clear();
    this.pp.tags.clear();
    this.pp.query = '';
    this.place = place;
    this.viewId = null;
  }

  private async onClick(e: Event): Promise<void> {
    const target = e.target as HTMLElement;
    const common = target.closest<HTMLElement>('[data-sb-common]')?.dataset.sbCommon;
    if (common !== undefined) {
      this.common = common === '1';
      this.render();
      return;
    }
    const bookTab = target.closest<HTMLElement>('[data-sb-tab]')?.dataset.sbTab as BookTab | undefined;
    if (bookTab) {
      this.showTab(bookTab);
      this.render();
      return;
    }
    if (placesClick(this, e, target)) return;
    if (
      await profileEditorClick(this.store, this.pe, target, () => this.render(), this.onError, (ids) => {
        if (!ids.length) return;
        this.close();
        this.goToObject(ids);
      })
    )
      return;
    if (await railEditorClick(this.store, this.rt, target, () => this.render(), this.onError)) return;
    if (await generalClick(this.store, target, (book, label) => this.set(book, label))) return;
    const go = target.closest<HTMLElement>('[data-sb-go]')?.dataset.sbGo;
    if (go) {
      const [kind, what] = go.split(':');
      this.go(kind === 'general' ? { kind: 'general' } : kind === 'type' ? { kind: 'type', type: what as ViewType } : { kind: 'res', res: what as Resource });
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
    if (this.place.kind === 'type' && underlayClick(this, this.place.type, target)) return;
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
    if (!action) return;
    if (action === 'close') this.close();
    else if (action === 'sb-back') {
      this.viewId = null;
      this.render();
    } else if (action.startsWith('view-') && this.place.kind === 'type') await viewAction(this, action, this.place.type);
    else if (action.startsWith('cat-') && this.place.kind === 'type') await categoryAction(this, action, this.place.type);
    else if (resourceClick(this, action, target)) return;
    else if (action === 'pen-reset' && this.place.kind === 'type') {
      const key = target.closest<HTMLElement>('[data-pen-key]')?.dataset.penKey;
      if (!key) return;
      const type = this.place.type;
      const cur = this.scope(type).cur;
      const r = editStyle(this.book, cur.style, (s) => resetPen(s, key));
      if (r.result) this.commit(type, { ...cur, style: r.style }, 'Ändra pennor', r.book);
    } else if (action === 'save-style') await exportBookFile(this.store.doc, this.onSaveFile);
    else if (action === 'open-style') {
      // En äldre stilmall ger stilen till kategorin som är vald.
      importBookFile(this.store, this.place.kind === 'type' ? this.scope(this.place.type).cat : undefined, this.onError);
    } else if (action === 'template-style') await templateDialog(this.store.doc, this.onError);
  }

  private onChange(e: Event): void {
    const input = e.target as HTMLInputElement | HTMLSelectElement;
    if (input.matches('[data-sb-search], [data-pp-search]')) return;
    if (placesChange(this, input)) return;
    if (input.matches('[data-sb-only]')) {
      this.onlyChanged = (input as HTMLInputElement).checked;
      this.render();
      return;
    }
    if (generalChange(this.store, input, (book, label) => this.set(book, label))) return;
    if (railEditorChange(this.store, input)) return;
    if (profileEditorChange(this.store, input)) return;
    if (input.matches('[data-sb-name]')) {
      const name = input.value.trim();
      if (name && name !== this.book.name) this.set({ ...this.book, name }, `Stilbokens namn: ${name}`);
      return;
    }
    if (this.place.kind === 'type') categoryChange(this, this.place.type, input);
    else resourceChange(this, input);
  }
}

/** Fältets data-attribut och värde, så att samma fält hittas efter omritningen; null utanför dialogen. */
function focusSelector(el: Element | null, root: HTMLElement): string | null {
  if (!(el instanceof HTMLElement) || !root.contains(el)) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  const attrs = ['data-key', 'data-field', 'data-lab', 'data-pen', 'data-linetype', 'data-filltype', 'data-material', 'data-material-id', 'data-action', 'data-pen-key', 'data-filltype-id', 'data-linetype-id', 'data-family', 'data-sb-go', 'data-sb-cat', 'data-cat-show', 'data-cat-hide', 'data-cat-scale', 'data-cat-kind', 'data-sb-name', 'data-sb-only', 'data-sb-search', 'data-sb-reset', 'data-sb-view', 'data-sb-goview', 'data-ul', 'data-ul-field', 'data-ul-addsel', 'data-pp-search', 'data-pp-filter', 'data-pp-set', 'data-pp-check', 'data-pp-all', 'data-pp-move', 'data-penlist', 'data-pp-tag', 'data-pp-pick', 'data-gen', 'data-gen-action', 'data-rt-mode', 'data-rt-act', 'data-rt-g', 'data-rt-p', 'data-rt-type', 'data-sb-tab', 'data-pe-act', 'data-pe-tool', 'data-pe-view', 'data-pe-type', 'data-pe-search'];
  const parts = attrs.filter((a) => el.hasAttribute(a)).map((a) => `[${a}="${CSS.escape(el.getAttribute(a)!)}"]`);
  if (!parts.length) return null;
  const v = el instanceof HTMLInputElement && el.type === 'radio' ? `[value="${CSS.escape(el.value)}"]` : '';
  return el.tagName.toLowerCase() + parts.join('') + v;
}
