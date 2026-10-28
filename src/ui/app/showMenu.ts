import { PRESETS } from '../../core/graphics';
import { isSite } from '../../core/model';
import { DETAIL_LABELS, DETAIL_LEVELS } from '../../core/states';
import { saveUiSettings } from '../uiSettings';
import { escapeHtml } from '../labels';
import { hiddenObjects, HIDDEN_OBJECT } from '../../core/visibility';
import type { AppContext } from './context';
import { ANNOTATION_SCALES } from './helpers';
import { installScalePop } from './scalePop';
import { isShown, OFF_BY_DEFAULT, setShown, showGroupsFor, traceStoreyOptions } from './showKeys';

/** Visa-menyn med kalkeringen (och skärmskalan i statusraden, `scalePop.ts`). */
export function installShowMenu(app: AppContext) {
  /** Hur den kalkerade vyn ritas, under Visa. Gäller för användaren, i alla projekt. */
  function traceLookMarkup(): string {
    if (!app.ui.trace) return '';
    const t = app.uiSettings.trace;
    return `<div class="trace-look">
      <div class="segmented wide" role="group" aria-label="Kalkeringens läge">
        <button data-trace-above="0" aria-pressed="${!t.above}">Under</button>
        <button data-trace-above="1" aria-pressed="${t.above}">Över</button>
      </div>
      <label class="check"><input type="checkbox" data-trace-own${t.color ? '' : ' checked'}> Ritningens färger</label>
      <label class="field inline"><span>Färg</span><input type="color" data-trace-color value="${t.color ?? '#c2372c'}"${t.color ? '' : ' disabled'}></label>
      <label class="field"><span>Opacitet <b data-out="trace-opacity">${Math.round(t.opacity * 100)} %</b></span><input type="range" min="5" max="100" step="5" data-trace-opacity value="${Math.round(t.opacity * 100)}"></label>
    </div>`;
  }

  function applyTraceLook(): void {
    app.view.setUnderlayLook(app.uiSettings.trace);
  }

  const scale = installScalePop(app);

  // Stilmall och kalkering i Visa-menyn.
  app.root.addEventListener('change', (e) => {
    const t = e.target as HTMLSelectElement;
    if (t.matches('[data-show-scale]')) {
      // Annoteringsskalan (0.8 del 3): texter och mått får rätt höjd på papper i den skalan.
      app.ui.scale = Number(t.value) || 100;
      app.renderAll();
    } else if (t.matches('[data-show-style]')) {
      app.ui.styleName = t.value || null;
      app.renderAll();
    } else if (t.matches('[data-show-trace]')) {
      app.ui.trace = t.value || null;
      app.renderAll();
      refreshShowMenu();
    } else if (t.matches('[data-trace-own]')) {
      app.uiSettings.trace.color = (t as unknown as HTMLInputElement).checked ? null : app.$<HTMLInputElement>('[data-trace-color]').value;
      saveUiSettings(app.uiSettings);
      applyTraceLook();
      refreshShowMenu();
    }
  });
  // Kalkeringens färg och opacitet ändras medan man drar.
  app.root.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.matches('[data-trace-color]')) app.uiSettings.trace.color = t.value;
    else if (t.matches('[data-trace-opacity]')) {
      app.uiSettings.trace.opacity = Number(t.value) / 100;
      app.out('trace-opacity').textContent = `${t.value} %`;
    } else return;
    saveUiSettings(app.uiSettings);
    applyTraceLook();
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

  /** Visa-menyn: detaljnivå, vad som visas, skala, stilmall och kalkering. */
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

  /** Visa-menyns inställningar: skala, stilmall och kalkering. */
  function settingsMarkup(): string {
    const { ui, store } = app;
    return (
      `<label class="field"><span>Skala för texter och mått</span><select data-show-scale>${ANNOTATION_SCALES.map((n) => `<option value="${n}"${n === ui.scale ? ' selected' : ''}>1:${n}</option>`).join('')}${ANNOTATION_SCALES.includes(ui.scale) ? '' : `<option value="${ui.scale}" selected>1:${ui.scale}</option>`}</select></label>` +
      `<label class="field"><span>Stilmall i vyn</span><select data-show-style><option value="">Projektets (${escapeHtml(store.doc.graphics.name)})</option>${PRESETS.map((p) => `<option value="${escapeHtml(p.name)}"${ui.styleName === p.name ? ' selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}</select></label>` +
      `<label class="field"><span>Kalkera en annan vy</span><select data-show-trace><option value="">Ingen</option>${traceStoreyOptions(ui.trace, isSite(ui.storey))}${store.doc.views
        .filter((v) => v.id !== ui.activeView)
        .map((v) => `<option value="${v.id}"${ui.trace === v.id ? ' selected' : ''}>${escapeHtml(v.name)}</option>`)
        .join('')}</select></label>` +
      traceLookMarkup() +
      `<button class="btn show-style-link" data-action="style">Stilmall och ritningsgrafik…</button>`
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

  return { ...scale, applyTraceLook, closeShowMenu, refreshShowMenu, toggleShowItem, toggleShowMenu };
}
