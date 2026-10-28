import { litteraSection } from './litteraSection';
import { setDefinition, setGraphics, updateDefinition } from '../core/commands';
import { onPaper as paperSpace, type Element, type ProjectDoc } from '../core/model';
import { isViewportId } from '../core/sheets';
import type { Action, ViewStates } from '../core/states';
import { actionOf } from '../core/states';
import type { DocStore } from '../core/store';
import { typeOf } from '../elements/registry';
import type { QuickId } from './uiSettings';
import { quickButton, quickButtons } from './quickBar';
import { icons } from './icons';
import { escapeHtml, labelOf } from './labels';
import type { Selection } from './selection';
import { skewOf, skewText } from '../elements/angleCheck';
import { bindTreeForm, treeItemExists, treeItemMarkup, type TreeItem } from './treeItemPanel';
import { bindSheetForm, sheetFormMarkup, type SheetFormHost } from './sheetForms';
import { orderSection } from './app/drawOrderUi';
import { ownPenSection } from './ownPenFields';
import { drawingChange, drawingClick, hereOf, lockField } from './drawingPanel';
import { shapeSmartFields } from './shapeFields';
import { resetShowList, showSection } from './showFields';
import { underlayPlaceFields } from './underlayFields';
import { instanceFields, markerSection, propsSection, sharedSection, summarizeTypes, typesMarkup } from './selectionFields';
import { applyPenField } from './style/pens';
import { applyField } from './selectionEdits';
import { selectionAction, type ActionPanel } from './selectionActions';

type Tab = 'selection' | 'types';

const ACTION_LABEL: Record<Action, string> = {
  plain: 'Visas',
  existing: 'Befintligt',
  demolished: 'Rivs',
  new: 'Planerat',
  absent: 'Finns inte',
};

/**
 * Sidopanelen: egenskaper för det som är markerat, och typerna (littera) med
 * deras gemensamma mått. På mobilen ligger den som ett blad nederst.
 *
 * Fältens HTML ligger i selectionFields.ts, det fälten ändrar i
 * selectionEdits.ts och det knapparna gör i selectionActions.ts; 2D,
 * taklutning, Visas i och Lås i drawingPanel.ts, och det som väljs i
 * projektträdet i treeItemPanel.ts och sheetForms.ts.
 */
export class PropertiesPanel implements ActionPanel {
  readonly el: HTMLElement;
  private body: HTMLElement;
  private tab: Tab = 'selection';
  private store: DocStore;
  private selection: Selection;
  private getView: () => ViewStates;
  /** Markeringen förra gången panelen ritades. */
  private lastSelKey = '';
  private quick: HTMLElement;
  /** Vilka snabbknappar som visas för en sorts objekt ("mixed" när de är olika). */
  quickFor: (type: string) => QuickId[] = () => ['demolish', 'delete'];
  /** Anropas när något kopierats, så att kopian kan flyttas. */
  onCopied?: (ids: string[], center: [number, number]) => void;

  /** Ta bort det markerade (snabbknappen), med meddelande om låsta (0.10.12). */
  onErase?: (ids: string[]) => void;

  /** Öppna en fasad eller sektion (knappen i panelen). */
  onOpenMarker?: (id: string) => void;
  /** Gränsen för varningen om nästan raka vinklar, grader (0 = av). */
  angleWarn: () => number = () => 5;
  /** Rikta en sektions- eller fasadmarkör efter något man klickar på i planen. */
  onAlignMarker?: (id: string) => void;
  /** Kalibrera eller rikta ett underlag (0.8 del 2). */
  onUnderlayTool?: (id: string, mode: 'calibrate' | 'align') => void;
  /** Bildens egna proportioner igen (0.8.16). */
  onUnderlayProportions?: (id: string) => void;
  /**
   * Det man valt i projektträdet (0.8). Dess inställningar visas när inget
   * i ritningen är markerat, med en Spara-knapp.
   */
  treeItem: TreeItem | null = null;
  /** Anropas när inställningarna för något i trädet har sparats. */
  onTreeSaved?: (item: TreeItem) => void;
  /** Anropas när det valda i trädet släpps (t.ex. en borttagen mapp). */
  onTreeClosed?: () => void;
  /** Det formulären för ritningsblad behöver av appen (0.8 del 3). */
  sheetHost?: SheetFormHost;
  /** Något i markeringen som visas med ett eget formulär, t.ex. en ensam vy på ett blad (0.8.9). */
  selectionItem?: () => TreeItem | null;

  /** Visa inställningarna för något i projektträdet. */
  showTreeItem(item: TreeItem | null): void {
    this.treeItem = item;
    this.showTab('selection');
  }

  constructor(store: DocStore, selection: Selection, getView: () => ViewStates) {
    this.store = store;
    this.selection = selection;
    this.getView = getView;
    this.el = document.createElement('aside');
    this.el.className = 'panel';
    this.el.setAttribute('aria-label', 'Egenskaper');
    this.el.innerHTML = `
      <div class="sheet-grip" role="button" tabindex="0" aria-label="Dra upp för alla egenskaper, ned för att stänga"><span></span></div>
      <div class="pane-title"><h2>Egenskaper</h2>
        <button class="icon-mini pane-min" data-action="min-panel" aria-label="Minimera egenskaperna" title="Minimera"></button>
        <button class="icon-mini pane-x" data-action="close-panel" aria-label="Stäng egenskaperna" title="Stäng (P)"></button>
      </div>
      <div class="panel-head">
        <div class="tabs" role="tablist">
          <button role="tab" data-tab="selection" aria-selected="true">Markerat</button>
          <button role="tab" data-tab="types" aria-selected="false">Typer</button>
        </div>
        <button class="icon-btn panel-close" data-action="toggle-panel" aria-label="Stäng panelen"></button>
      </div>
      <div class="quick-bar" hidden></div>
      <div class="panel-body"></div>`;
    this.body = this.el.querySelector('.panel-body')!;
    this.quick = this.el.querySelector('.quick-bar')!;
    this.quick.addEventListener('click', (e) => this.onClick(e));

    this.el.querySelector('.tabs')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
      if (b) this.showTab(b.dataset.tab as Tab);
    });
    this.body.addEventListener('click', (e) => this.onClick(e));
    this.body.addEventListener('change', (e) => this.onChange(e));
  }

  get currentTab(): Tab {
    return this.tab;
  }

  showTab(tab: Tab): void {
    this.tab = tab;
    this.el.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    this.render();
  }

  render(): void {
    const scroll = this.body.scrollTop;
    const doc = this.store.doc;
    if (this.treeItem && !treeItemExists(doc, this.treeItem)) this.treeItem = null;
    const item = this.tab !== 'selection' ? null : this.selection.size === 0 ? this.treeItem : (this.selectionItem?.() ?? null);
    if (item) {
      // Ändringar som inte sparats än ligger kvar när något annat ritas om.
      const open = this.body.querySelector<HTMLFormElement>('.tree-form');
      const dirty = open && open.dataset.treeId === item.id && !open.querySelector<HTMLButtonElement>('[data-tree="save"]')?.disabled;
      if (!dirty && (item.kind === 'sheet' || item.kind === 'viewport')) {
        // Ritningsblad och vyer på blad (0.8 del 3).
        this.body.innerHTML = sheetFormMarkup(doc, { kind: item.kind, id: item.id, also: item.also });
        if (this.sheetHost) bindSheetForm(this.body, this.store, this.sheetHost);
      } else if (!dirty) {
        this.body.innerHTML = treeItemMarkup(doc, item);
        bindTreeForm(
          this.body,
          this.store,
          (saved) => this.onTreeSaved?.(saved),
          () => {
            this.body.innerHTML = '';
            this.render();
          },
          () => {
            this.treeItem = null;
            this.onTreeClosed?.();
            this.render();
          },
        );
      }
      this.renderQuick();
      return;
    }
    this.body.innerHTML = this.tab === 'types' ? typesMarkup(doc) : this.renderSelection(doc);
    this.body.scrollTop = scroll;
    this.renderQuick();
  }

  /**
   * Snabbraden: vad som är markerat och de vanligaste åtgärderna för just
   * det, så att man inte behöver öppna hela panelen. På mobilen är det den
   * som syns när bladet är nere.
   */
  private renderQuick(): void {
    const html = this.tab === 'selection' ? this.quickMarkup() : null;
    this.quick.hidden = !html;
    if (html) this.quick.innerHTML = html;
  }

  /**
   * Snabbradens innehåll för det som är markerat, eller null om inget är det.
   * Används både i panelen och i smartmenyn. Med `more` får
   * raden en knapp som öppnar hela panelen.
   */
  quickMarkup(more: boolean | 'less' = false, withTitle = true): string | null {
    const doc = this.store.doc;
    const els = this.selection
      .list()
      .map((id) => doc.elements[id])
      .filter(Boolean);
    const vps = this.viewportsSelected(doc);
    if (els.length === 0 && vps === 0) return null;

    const buttons = quickButtons(doc, els, vps > 0, this.getView(), this.quickFor);
    // *Mer* bara när det finns fler inställningar än de som syns (granskningen efter 0.10.18).
    if (more === true && this.hasMore()) buttons.push(quickButton('smart-more', icons.more, 'Mer'));
    if (more === 'less') buttons.push(quickButton('smart-less', icons.collapse, 'Mindre'));
    buttons.push(quickButton('deselect', icons.close, 'Avmarkera'));

    const head = withTitle ? this.quickTitle() : '';
    return `${head}<div class="qb-actions">${buttons.join('')}</div>`;
  }

  /** Hur många vyer på ett blad som är markerade (0.8.9). */
  private viewportsSelected(doc: ProjectDoc): number {
    return this.selection.list().filter((id) => !doc.elements[id] && isViewportId(doc, id)).length;
  }

  /** Rubriken och undertiteln för det markerade, med vyerna på ett blad räknade (0.8.9). */
  private titleOf(doc: ProjectDoc, els: Element[]): { title: string; sub: string } {
    const vps = this.viewportsSelected(doc);
    const n = els.length + vps;
    const vpText = vps ? `${vps} ${vps === 1 ? 'vy' : 'vyer'} på bladet` : '';
    if (n === 0) return { title: 'Inget markerat', sub: 'Tryck på det som ska markeras' };
    if (n === 1 && els.length === 1) return { title: labelOf(doc, els[0]), sub: typeOf(els[0].type)?.label ?? '' };
    return { title: `${n} objekt`, sub: [els.length ? summarizeTypes(els) : '', vpText].filter(Boolean).join(', ') };
  }

  /** Vad som är markerat, som rubrik i snabbraden och smartmenyn. `where` ersätter undertiteln. */
  quickTitle(where?: string): string {
    const doc = this.store.doc;
    const els = this.selection
      .list()
      .map((id) => doc.elements[id])
      .filter(Boolean);
    const t = this.titleOf(doc, els);
    const title = t.title;
    const sub = where ?? t.sub;
    return `<div class="qb-title"><b>${escapeHtml(title)}</b><small>${escapeHtml(sub)}</small></div>`;
  }

  // ---------- Markerat ----------

  private renderSelection(doc: ProjectDoc): string {
    const s = this.selectionParts(doc);
    return s.head + s.sections.join('');
  }

  /**
   * Panelens innehåll för det markerade: rubriken (eller en text när inget
   * är markerat) och inställningarna, en del per avsnitt. Inga delar betyder
   * att det inte finns något att ställa in (granskningen efter 0.10.18).
   */
  private selectionParts(doc: ProjectDoc): { head: string; sections: string[] } {
    const els = this.selection
      .list()
      .map((id) => doc.elements[id])
      .filter(Boolean);
    if (els.length === 0 && this.viewportsSelected(doc)) {
      const t = this.titleOf(doc, els);
      return {
        head: `<header class="sel-head"><h2>${escapeHtml(t.title)}</h2><p>${escapeHtml(t.sub)}</p></header><p class="note">Vyerna flyttas och tas bort tillsammans. Markera en vy ensam för att ändra den.</p>`,
        sections: [],
      };
    }
    if (els.length === 0) {
      const head = `<div class="empty">
        <p><b>Inget är markerat.</b></p>
        <p>Klicka på en vägg, dörr eller möbel i planen. Håll Shift för att markera flera, eller dra en ruta: åt höger tar det som ligger helt innanför, åt vänster allt som berörs.</p>
        <p>På mobilen lägger varje tryck till i markeringen, och ett tryck i tomma delar av planen avmarkerar.</p>
      </div>`;
      return { head, sections: [] };
    }

    const view = this.getView();
    const sameType = els.every((e) => e.type === els[0].type);
    const t = typeOf(els[0].type);
    const named = this.titleOf(doc, els);
    const title = named.title;
    const sub = els.length === 1 && named.title === labelOf(doc, els[0]) ? '' : named.sub;

    const head = `<header class="sel-head"><h2>${escapeHtml(title)}</h2>${sub ? `<p>${escapeHtml(sub)}</p>` : ''}</header>`;
    const sections: string[] = [];
    // Nästan rak vinkel: en rad med en knapp som rätar upp.
    // Varningen kan stängas av för elementet (0.8.4); då står en kryssruta kvar.
    const skew = els.length === 1 ? skewOf(doc, els[0], this.angleWarn(), true) : null;
    if (skew && !els[0].skewOk)
      sections.push(
        `<p class="skew-note" role="note"><b>!</b> ${escapeHtml(skewText(skew))} <button class="btn" data-action="straighten-angle">Räta upp till ${skew.nearest}°</button> <button class="btn btn-ghost" data-action="skew-ok" title="Vinkeln är avsiktlig: visa ingen varning för det här objektet">Ignorera</button></p>`,
      );
    else if (skew) sections.push(`<label class="check skew-ignored"><input type="checkbox" data-action="skew-warn"> Varna för sned vinkel (${escapeHtml(skewText(skew).replace(/\.$/, ''))})</label>`);

    // Finns i: en ruta per tillstånd. Delvis ifylld när markeringen är blandad.
    const chips = doc.states
      .map((s) => {
        const n = els.filter((e) => e.states.includes(s.id)).length;
        const state = n === 0 ? 'off' : n === els.length ? 'on' : 'mixed';
        return `<button class="state-chip ${state}${s.id === view.state ? ' is-viewed' : ''}" data-action="toggle-state" data-state="${s.id}" aria-pressed="${state === 'on' ? 'true' : state === 'mixed' ? 'mixed' : 'false'}"><span class="box"></span>${escapeHtml(s.name)}</button>`;
      })
      .join('');
    const counts = new Map<Action, number>();
    for (const e of els) {
      const a = typeOf(e.type)?.compares ? actionOf(e, view) : e.states.includes(view.state) ? 'plain' : 'absent';
      counts.set(a, (counts.get(a) ?? 0) + 1);
    }
    const viewed = doc.states.find((s) => s.id === view.state)?.name ?? '';
    const compared = view.compareTo ? doc.states.find((s) => s.id === view.compareTo)?.name : undefined;
    const result = [...counts.entries()]
      .map(([a, n]) => `<span class="tag tag-${a}">${els.length > 1 ? `${n} ` : ''}${ACTION_LABEL[a].toLowerCase()}</span>`)
      .join(' ');
    // Norrpil, fasader och sektioner finns i alla tillstånd, och det som är ritat på ett blad eller mallblad följer dem inte (0.8.9).
    const onPaper = (e: Element) => doc.sheets.some((x) => x.id === e.space) || doc.worksheets.some((w) => w.id === e.space && paperSpace(w));
    if (!els.every((e) => typeOf(e.type)?.global || onPaper(e))) sections.push(`<section>
      <h3>Finns i</h3>
      <div class="state-chips">${chips}</div>
      <p class="note">I ${escapeHtml(viewed)}${compared ? ` jämfört med ${escapeHtml(compared)}` : ''}: ${result}</p>
    </section>`);

    // Typ (littera).
    if (sameType && t?.typeParams?.length) {
      const defs = Object.values(doc.definitions).filter((d) => d.elementType === t.type);
      const current = els.every((e) => e.definition === els[0].definition) ? els[0].definition : undefined;
      const options = defs
        .map((d) => `<option value="${d.id}"${d.id === current ? ' selected' : ''}>${escapeHtml(d.name)}${d.description ? ` – ${escapeHtml(d.description)}` : ''}</option>`)
        .join('');
      const mixedOpt = current ? '' : `<option value="" selected disabled>${els.some((e) => e.definition) ? 'Blandade typer' : 'Ingen typ'}</option>`;
      sections.push(`<section>
        <h3>Typ</h3>
        <div class="row"><select id="sel-def" data-action="set-def">${mixedOpt}${options}</select>
        <button class="btn" data-action="new-def">Ny typ</button></div>
      </section>`);
    }

    // Egna mått för ett enskilt element.
    if (els.length === 1) {
      const instance = instanceFields(doc, els[0], view);
      // En markör (0.10.12): vyn för sig och markören för sig, med låset där.
      const marker = markerSection(doc, els[0], lockField(els));
      if (instance) sections.push(`<section><h3>${escapeHtml(t?.label ?? '')}</h3>${instance}${marker ? '' : lockField(els)}</section>`);
      else if (!marker && lockField(els)) sections.push(`<section>${lockField(els)}</section>`);
      if (marker) sections.push(marker);
    } else if (els.every((e) => e.type === 'Roof')) {
      // Flera takfall (0.10, t.ex. ett snabbval): fälten gäller alla, med det första takfallets värden.
      sections.push(`<section><h3>Tak · ${els.length} takfall</h3>${instanceFields(doc, els[0], view)}<p class="note">Ett ändrat värde gäller alla markerade takfall.</p>${lockField(els)}</section>`);
    } else if (lockField(els)) sections.push(`<section>${lockField(els)}</section>`);

    // Littera (0.10.20.1): stammens sida och längd, änden, tillbaka till förvalet.
    const tags = litteraSection(doc, els);
    if (tags) sections.push(tags);

    // Ritordning (0.8.25): Längst bak … Främst, och 2D-formens lager mot väggarna.
    const order = orderSection(doc, els);
    if (order) sections.push(order);

    // Egen penna (0.8.31) för väggar, dörrar, fönster, tak och möbler.
    const pen = ownPenSection(doc, els);
    if (pen) sections.push(pen);

    // Visas i (0.8): 2D-element, text och mått kan visas i vissa vyer.
    const selKey = els.map((e) => e.id).join();
    if (selKey !== this.lastSelKey) {
      this.lastSelKey = selKey;
      resetShowList();
    }
    const show = showSection(doc, els, hereOf(view, els[0].storey));
    if (show) sections.push(show);

    // Egna egenskaper, t.ex. brandklass och ljudklass, för littera och förteckningar.
    if (els.length === 1 && ['Door', 'Window', 'Wall', 'Slab', 'Space', 'Furniture'].includes(els[0].type)) {
      sections.push(propsSection(doc, els[0]));
    }

    // Sådant som påverkar fler objekt än de markerade samlas längst ned.
    const shared = sharedSection(doc, els);
    if (shared) sections.push(shared);

    // Ta bort, riv, vänd m.m. ligger i snabbraden överst.
    return { head, sections: sections.filter(Boolean) };
  }

  // ---------- Händelser ----------

  /** Knapparna i snabbraden, var den än visas. */
  handleClick(e: Event): void {
    this.onClick(e);
  }

  /** Fälten i den utfällda smartmenyn. */
  handleChange(e: Event): void {
    this.onChange(e);
  }

  /**
   * Fält som smartmenyn visar direkt, utan *Mer*: läge och storlek för ett
   * ensamt underlag (0.8.16), skraffering och opacitet för 2D-former
   * (0.8.22). Null för allt annat.
   */
  smartFields(): string | null {
    const ids = this.selection.list();
    const doc = this.store.doc;
    const el = ids.length === 1 ? doc.elements[ids[0]] : undefined;
    if (el?.type === 'Underlay') return underlayPlaceFields(doc, el);
    // 2D-former (0.8.22): skrafferingens vinkel och avstånd, och opaciteten.
    return shapeSmartFields(doc, ids.map((id) => doc.elements[id]).filter(Boolean));
  }

  /**
   * Alla inställningar för det markerade, utan rubriken, för den utfällda
   * smartmenyn. Null när inget är markerat.
   */
  selectionMarkup(): string | null {
    if (this.selection.size === 0) return null;
    const s = this.selectionParts(this.store.doc).sections;
    return s.length ? s.join('') : null;
  }

  /**
   * Om det markerade har inställningar utöver snabbraden (granskningen efter
   * 0.10.18): annars visas inte *Mer* i smartmenyn eller *Alla
   * inställningar här* i högerklicksmenyn, t.ex. för kartans linjer och den
   * befintliga marken.
   */
  hasMore(): boolean {
    return this.selection.size > 0 && this.selectionParts(this.store.doc).sections.length > 0;
  }

  private onClick(e: Event): void {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!b) return;
    if (drawingClick(this.store, this.selection.list(), b, this.el)) return;
    selectionAction({ panel: this, store: this.store, selection: this.selection, getView: this.getView, body: this.body }, b);
  }

  private onChange(e: Event): void {
    const input = e.target as HTMLInputElement | HTMLSelectElement;
    const doc = this.store.doc;
    const ids = this.selection.list();

    if (input.id === 'sel-def') {
      setDefinition(this.store, ids, input.value);
      return;
    }
    // Typtabellen.
    if (input.dataset.def) {
      const defId = input.dataset.def;
      if (input.dataset.param) {
        const v = Number(input.value);
        if (v > 0) updateDefinition(this.store, defId, { params: { [input.dataset.param]: v } });
        else this.render();
      } else if (input.dataset.field === 'name') updateDefinition(this.store, defId, { name: input.value });
      else if (input.dataset.field === 'description') updateDefinition(this.store, defId, { description: input.value });
      return;
    }

    // Markörens penna (0.10.12): stilmallens, för alla markörer av samma sort.
    if (input.dataset.pen) {
      const style = structuredClone(doc.graphics);
      const label = applyPenField(style, input);
      if (label) setGraphics(this.store, { ...style, name: 'Egen stilmall' }, label);
      return;
    }
    const key = input.dataset.key;
    if (!key) return;
    if (drawingChange(this.store, ids, key, input, hereOf(this.getView(), doc.elements[ids[0]]?.storey ?? ''))) return;
    if (!applyField(this.store, ids, key, input, this.getView())) this.render();
  }
}
