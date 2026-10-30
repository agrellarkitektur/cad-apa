import { categoriesOf } from '../../core/viewCategories';
import { isSite } from '../../core/model';
import { DETAIL_LABELS, DETAIL_LEVELS } from '../../core/states';
import { escapeHtml } from '../labels';
import { hiddenObjects, HIDDEN_OBJECT } from '../../core/visibility';
import type { AppContext } from './context';
import { ANNOTATION_SCALES } from './helpers';
import { installScalePop } from './scalePop';
import { isShown, OFF_BY_DEFAULT, setShown, showGroupsFor } from './showKeys';
import { toggleUnderlay, type ViewUnderlay } from '../../core/viewUnderlays';
import { editUnderlays, hostFor, underlayRowsMarkup, underlaySourceItems } from '../underlayRows';

/** Visa-menyn med underlagen (och skärmskalan i statusraden, `scalePop.ts`). */
export function installShowMenu(app: AppContext) {
  /** Var underlagen står där man är (0.10.35). */
  function host() {
    const ui = app.ui;
    return hostFor(ui.storey, { marker: ui.marker, worksheet: ui.worksheet, viewId: ui.activeView });
  }

  /** Underlagen under Visa: raderna och *Lägg till underlag…*. Inte på ett blad. */
  function underlayMarkup(): string {
    if (app.ui.layout) return '';
    return `<div class="show-underlays"><span class="show-sub">Underlag i vyn</span>${underlayRowsMarkup(app.store.doc, app.ui.underlays, host())}</div>`;
  }

  /** Byt underlagen och rita om; menyn ritas om när raderna ändras. */
  function setUnderlays(list: ViewUnderlay[], reopen = true): void {
    app.ui.underlays = list;
    app.renderAll();
    // Efter klicket: knappen ritas bort, och ett klick utanför Visa stänger menyn.
    if (reopen)
      setTimeout(() => {
        closeShowMenu();
        toggleShowMenu();
      });
  }

  /** Menyn *Lägg till underlag…* vid knappen. Visa-menyn öppnas igen efteråt. */
  function openAddUnderlay(btn: HTMLElement): void {
    const r = btn.getBoundingClientRect();
    const items = underlaySourceItems(app.store.doc, host(), app.ui.underlays, (source) => {
      setUnderlays(toggleUnderlay(app.ui.underlays, source), false);
      // Efter klicket, som kan stänga Visa-menyn: den ritas om med det nya underlaget.
      setTimeout(() => {
        closeShowMenu();
        toggleShowMenu();
      });
    });
    items.push({ kind: 'sep' }, { label: 'Fil (DXF, PDF, bild)…', sub: 'Läggs in där du är, som förut', run: () => app.chooseUnderlayFiles() });
    app.ctxMenu.open(r.left, r.bottom + 4, items, 'Lägg till underlag');
  }

  app.root.addEventListener('click', (e) => {
    const t = e.target as Element;
    if (!t.closest('.show-menu')) return;
    const add = t.closest<HTMLElement>('[data-ul-add]');
    if (add) {
      e.stopPropagation();
      openAddUnderlay(add);
      return;
    }
    const btn = t.closest<HTMLElement>('button[data-ul-field]');
    if (!btn) return;
    const next = editUnderlays(app.ui.underlays, btn);
    if (next) setUnderlays(next);
  });

  const scale = installScalePop(app);

  // Stilmall och kalkering i Visa-menyn.
  app.root.addEventListener('change', (e) => {
    const t = e.target as HTMLSelectElement;
    if (t.matches('[data-show-scale]')) {
      // Annoteringsskalan (0.8 del 3): texter och mått får rätt höjd på papper i den skalan.
      app.ui.scale = Number(t.value) || 100;
      app.renderAll();
    } else if (t.matches('[data-show-category]')) {
      // En annan kategori (0.10.32): visningen blir kategorins.
      app.ui.category = t.value || null;
      app.place.applyShow(app.place.currentCategory().show);
      app.views.syncDetailSwitch();
      app.renderAll();
      refreshShowMenu();
    } else if (t.matches('.show-menu [data-ul-field]')) {
      // Underlagens sätt, färg och procent (0.10.35); listan ritas om när sättet ändras (färgfältet kommer och går).
      const next = editUnderlays(app.ui.underlays, t);
      if (next) setUnderlays(next, t.dataset.ulField === 'look');
    }
  });

  /** Rita om Visa-menyn om den är öppen, t.ex. när kalkeringen slås på. */
  function refreshShowMenu(): void {
    const m = app.$<HTMLElement>('.show-menu');
    if (m.hidden) return;
    closeShowMenu();
    app.$<HTMLElement>('.show-btn').click();
  }

  function closeShowMenu(): void {
    document.querySelectorAll<HTMLElement>('.show-menu').forEach((m) => (m.hidden = true));
    app.$<HTMLElement>('.show-btn').setAttribute('aria-expanded', 'false');
  }

  /** Visa-menyn: detaljnivå, vad som visas, skala, vykategori och kalkering. */
  function toggleShowMenu(): void {
    const m = app.$<HTMLElement>('.show-menu');
    if (!m.hidden) {
      closeShowMenu();
      return;
    }
    const { ui, store } = app;
    const item = (key: string, label: string, on: boolean) => `<label class="check"><input type="checkbox" data-show="${key}"${on ? ' checked' : ''}> ${label}</label>`;
    // I kolumner (0.10.11), så att allt syns samtidigt: inställningarna till
    // vänster, kategorierna i två kolumner till höger.
    m.innerHTML =
      // Detaljnivån för litteran, 2D-symbolerna och 3D var för sig (0.8.37).
      `<div class="show-col show-settings"><div class="detail-parts">${(
        [
          ['label', 'Littera', ui.labelDetail],
          ['plan', '2D-symboler', ui.detail],
          ['model', '3D och fasader', ui.modelDetail],
        ] as const
      )
        .map(
          ([part, label, cur]) =>
            `<div class="detail-part"><span>${label}</span><div class="segmented detail-switch detail-part-switch" role="group" aria-label="Detaljnivå för ${label.toLowerCase()}">${DETAIL_LEVELS.map((d) => `<button data-detail="${d}" data-detail-part="${part}" aria-pressed="${cur === d}">${DETAIL_LABELS[d]}</button>`)
              .join('')}</div></div>`,
        )
        .join('')}</div>` +
      settingsMarkup() +
      `</div><div class="show-col show-groups">` +
      showGroupsFor(store.doc).filter((g) => g.id !== 'site' || !!store.doc.site || isSite(app.ui.storey)).map((g) => {
        const shown = g.items.filter(([k]) => isShown(ui, k)).length;
        return `<div class="show-group" role="group" aria-label="${g.label}">
          <label class="check show-group-head"><input type="checkbox" data-show-group="${g.id}"${shown === g.items.length ? ' checked' : ''}> ${g.label}</label>
          ${g.items.map(([k, label]) => item(k, label, isShown(ui, k))).join('')}
        </div>`;
      }).join('') +
      item('showHidden', 'Visa dolda 2D-element (tonade)', ui.showHidden) +
      hiddenObjectsMarkup() +
      `</div>`;
    m.hidden = false;
    fitInPane(m);
    syncGroups();
    app.$<HTMLElement>('.show-btn').setAttribute('aria-expanded', 'true');
  }

  /**
   * Menyn ryms i ritytan (0.10.11): den flyttas åt vänster om den går utanför,
   * och blir smalare (kategorierna i en kolumn) om ytan är för smal.
   */
  function fitInPane(m: HTMLElement): void {
    m.style.left = '';
    m.style.width = '';
    const pane = (m.closest('.canvas') ?? document.body).getBoundingClientRect();
    const r = m.getBoundingClientRect();
    const room = pane.width - 16;
    if (r.width > room) m.style.width = `${room}px`;
    const over = m.getBoundingClientRect().right - (pane.right - 8);
    if (over > 0) m.style.left = `${-Math.min(over, r.left - pane.left - 8)}px`;
  }

  /** De enskilt dolda objekten (0.10.15): hur många, och en knapp som tar fram dem. */
  function hiddenObjectsMarkup(): string {
    const n = hiddenObjects(app.ui.hide).filter((id) => app.store.doc.elements[id]).length;
    if (!n) return '';
    return `<div class="show-hidden-objects">${n === 1 ? 'Ett objekt' : `${n} objekt`} dolt i vyn. <button type="button" class="link" data-unhide-all>Visa dolda objekt</button></div>`;
  }

  // Visa dolda objekt (0.10.15).
  app.root.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('[data-unhide-all]')) return;
    app.ui.hide = app.ui.hide.filter((h) => !h.startsWith(HIDDEN_OBJECT));
    app.renderAll();
    // Efter klicket, så att menyn inte stängs av att knappen försvunnit.
    setTimeout(refreshShowMenu);
  });

  /**
   * Dubbelklick på Visa (0.10.16): allt som är släckt i vyn tänds och de
   * dolda objekten tas fram. Det som är släckt från början (husets kontur
   * genom taket, linjerna i 3D …) och detaljnivåerna ändras inte. Klicken
   * öppnar och stänger menyn först, så den är stängd efteråt.
   */
  app.root.addEventListener('dblclick', (e) => {
    if (!(e.target as Element).closest('.show-btn')) return;
    const ui = app.ui;
    const before = JSON.stringify([ui.hide, ui.hideDemolished]);
    for (const g of showGroupsFor(app.store.doc)) for (const [k] of g.items) if (!OFF_BY_DEFAULT.has(k)) setShown(ui, k, true);
    ui.hide = ui.hide.filter((h) => !h.startsWith(HIDDEN_OBJECT));
    closeShowMenu();
    if (JSON.stringify([ui.hide, ui.hideDemolished]) === before) {
      app.hint('Allt visas redan i vyn');
      return;
    }
    app.renderAll();
    app.hint('Allt i vyn visas');
  });

  /** Visa-menyns inställningar: skala, vykategori och underlagen. */
  function settingsMarkup(): string {
    const { ui, store } = app;
    return (
      `<label class="field"><span>Skala för texter och mått</span><select data-show-scale>${ANNOTATION_SCALES.map((n) => `<option value="${n}"${n === ui.scale ? ' selected' : ''}>1:${n}</option>`).join('')}${ANNOTATION_SCALES.includes(ui.scale) ? '' : `<option value="${ui.scale}" selected>1:${ui.scale}</option>`}</select></label>` +
      `<label class="field"><span>Vykategori</span><select data-show-category>${categoriesOf(store.doc.graphics, app.place.viewType()).map((c) => `<option value="${escapeHtml(c.id)}"${c === app.place.currentCategory() ? ' selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select></label>` +
      underlayMarkup() +
      `<button class="btn show-style-link" data-action="style">Stilboken…</button>`
    );
  }

  /** Kategoriernas kryssrutor: ikryssad när allt syns, halvt när en del syns. */
  function syncGroups(): void {
    for (const g of showGroupsFor(app.store.doc)) {
      const box = app.$<HTMLElement>('.show-menu').querySelector<HTMLInputElement>(`[data-show-group="${g.id}"]`);
      if (!box) continue;
      const shown = g.items.filter(([k]) => isShown(app.ui, k)).length;
      box.checked = shown === g.items.length;
      box.indeterminate = shown > 0 && shown < g.items.length;
    }
  }

  /** En kryssruta i Visa-menyn: en sak, eller en hel kategori på en gång. */
  function toggleShowItem(input: HTMLInputElement): void {
    const ui = app.ui;
    const group = showGroupsFor(app.store.doc).find((g) => g.id === input.dataset.showGroup);
    const key = input.dataset.show!;
    if (group) {
      // Syns allt släcks allt, annars tänds allt.
      for (const [k] of group.items) setShown(ui, k, input.checked);
      for (const [k] of group.items) {
        const box = app.$<HTMLElement>('.show-menu').querySelector<HTMLInputElement>(`[data-show="${k}"]`);
        if (box) box.checked = input.checked;
      }
    } else if (key === 'showHidden') ui.showHidden = input.checked;
    // Visa dolda 2D-element (0.8) är en tillfällig hjälp, inte en del av vyn.
    else setShown(ui, key, input.checked);
    syncGroups();
    app.renderAll();
  }

  return { ...scale, closeShowMenu, refreshShowMenu, toggleShowItem, toggleShowMenu };
}
