import { icons } from '../icons';
import { escapeHtml } from '../labels';
import { RAIL, RAIL_ITEMS, railFor, type RailId } from '../modify/ops';
import { isNarrow } from '../sheet';
import type { AppContext } from './context';

/**
 * Modifiera-raden (0.8.5): en lodrät rad innanför ritverktygen med alla
 * Modifiera-verktyg, så att de alltid finns på samma ställe, också när
 * smartmenyn är avstängd. Med något markerat tänds de som går att använda
 * svagt. Klick startar verktyget för det markerade; behöver det en ände,
 * ett hörn eller en kant används den man redan klickat på, annars ber raden
 * om ett klick. Kan döljas i inställningarna.
 */
export function installModifyRail(app: AppContext) {
  const el = document.createElement('nav');
  el.className = 'modify-rail';
  el.setAttribute('aria-label', 'Modifiera');
  app.$<HTMLElement>('.tools').after(el);

  el.innerHTML =
    `<div class="tool-group-label" title="Modifiera det markerade">Ändra</div>` +
    RAIL.map((g) =>
      g
        .map((r) => `<button type="button" class="mr-btn" data-rail="${r.id}" aria-label="${escapeHtml(r.label)}" title="${escapeHtml(r.label)}">${icons[r.icon]}</button>`)
        .join(''),
    ).join('<span class="mr-sep"></span>');

  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-rail]');
    if (!b) return;
    const id = b.dataset.rail as RailId;
    const label = RAIL_ITEMS.find((r) => r.id === id)?.label ?? '';
    if (b.getAttribute('aria-disabled') === 'true') {
      app.hint(app.selection.size ? `${label} går inte att använda för det markerade.` : `Markera det som ska ändras först, sedan ${label.toLowerCase()}.`, 3000);
      return;
    }
    // Ett ritverktyg är valt: tillbaka till Markera med samma markering.
    if (app.ui.tool !== 'select' && !app.modifier.drawingWall) app.setTool('select', true);
    // Modifiera görs i planen: när bara 3D visas går det över till 2D.
    if (app.ui.mode === '3d') void app.setMode('2d');
    app.modifier.chooseRail(id);
  });

  /** Vilka som går att använda: det markerade måste gå att ändra här. */
  function lit(): Set<RailId> {
    const ids = app.selection.list();
    if (!ids.length || app.ui.layout) return new Set();
    if (app.ui.marker && !ids.every((id) => app.host.canEdit?.(id))) return new Set();
    return railFor(app.host, ids);
  }

  function render(): void {
    const show = app.uiSettings.modifyRail && !isNarrow();
    el.hidden = !show;
    app.appEl.classList.toggle('modify-rail-on', show);
    if (!show) return;
    const on = lit();
    const active = app.modifier.railActive;
    el.querySelectorAll<HTMLElement>('[data-rail]').forEach((b) => {
      const id = b.dataset.rail as RailId;
      b.setAttribute('aria-disabled', String(!on.has(id)));
      b.setAttribute('aria-pressed', String(active === id));
    });
  }

  app.selection.subscribe(render);
  app.modifier.subscribe(render);
  app.store.subscribe(render);
  window.addEventListener('resize', render);
  render();
  return { render };
}
