import { PRESETS } from '../../core/graphics';
import { parseScale, saveUiSettings } from '../uiSettings';
import { Camera } from '../../view2d/camera';
import { escapeHtml } from '../labels';
import type { AppContext } from './context';
import { ANNOTATION_SCALES, formatScale, nf } from './helpers';

/** Visa-menyn med kalkeringen, och skärmskalan i statusraden. */
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

  // ---------- Skärmskalan ----------
  // Klick på skalan i statusraden: skriv in en skala, t.ex. 100 eller 1:50.
  const scalePop = app.$<HTMLFormElement>('.scale-pop');
  const scaleBtn = app.$<HTMLButtonElement>('.scale-btn');
  function openScalePop(): void {
    const input = scalePop.elements.namedItem('scale') as HTMLInputElement;
    input.value = formatScale(app.view.camera.screenScaleDenominator(app.screenMm())).replace(/\s/g, '');
    app.out('scale-note').innerHTML = app.uiSettings.screenInches
      ? `Räknat på en skärm på ${nf.format(app.uiSettings.screenInches)}″ och 100 % zoom i webbläsaren. <button type="button" class="link" data-action="scale-settings">Ändra</button>`
      : 'Ungefärlig: räknat på en vanlig skärm. <button type="button" class="link" data-action="scale-settings">Ange skärmens storlek</button> under Gränssnitt för exakt skala.';
    scalePop.hidden = false;
    scaleBtn.setAttribute('aria-expanded', 'true');
    input.focus();
    input.select();
  }
  function closeScalePop(): void {
    scalePop.hidden = true;
    scaleBtn.setAttribute('aria-expanded', 'false');
  }
  scalePop.addEventListener('submit', (e) => {
    e.preventDefault();
    const n = parseScale((scalePop.elements.namedItem('scale') as HTMLInputElement).value);
    if (!n) {
      app.hint('Skriv skalans nämnare, t.ex. 100 eller 1:50.');
      return;
    }
    if (app.ui.mode === '3d') void app.setMode('2d');
    app.view.zoomBy(Camera.scaleFor(n, app.screenMm()) / app.view.camera.scale);
    closeScalePop();
  });
  scalePop.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') closeScalePop();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!scalePop.hidden && !(e.target as Element).closest('.scale-wrap')) closeScalePop();
  });

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
    m.innerHTML =
      `<div class="segmented detail-switch in-menu" role="group" aria-label="Detaljnivå">${(['sketch', 'normal', 'detail'] as const)
        .map((d) => `<button data-detail="${d}" aria-pressed="${ui.detail === d}">${{ sketch: 'Skiss', normal: 'Normal', detail: 'Detalj' }[d]}</button>`)
        .join('')}</div>` +
      item('demolished', 'Det som rivs', !ui.hideDemolished) +
      item('littera', 'Littera', !ui.hide.includes('littera')) +
      item('Space', 'Rum', !ui.hide.includes('Space')) +
      item('Furniture', 'Möbler och inredning', !ui.hide.includes('Furniture')) +
      item('Dimension', 'Mått', !ui.hide.includes('Dimension')) +
      item('Text', 'Text', !ui.hide.includes('Text')) +
      item('Roof', 'Tak', !ui.hide.includes('Roof')) +
      item('swing', 'Öppningssätt (dörrar)', !ui.hide.includes('swing')) +
      item('roofSlope', 'Taklutning i fasad och sektion', !ui.hide.includes('roofSlope')) +
      item('Line2D', '2D-linjer', !ui.hide.includes('Line2D')) +
      item('Fill2D', 'Fyllningar', !ui.hide.includes('Fill2D')) +
      item('showHidden', 'Visa dolda 2D-element (tonade)', ui.showHidden) +
      '<div class="menu-label">Markörer i planen</div>' +
      item('Elevation', 'Fasader', !ui.hide.includes('Elevation')) +
      item('Section', 'Sektioner', !ui.hide.includes('Section')) +
      item('North', 'Norrpil', !ui.hide.includes('North')) +
      `<label class="field"><span>Skala för texter och mått</span><select data-show-scale>${ANNOTATION_SCALES.map((n) => `<option value="${n}"${n === ui.scale ? ' selected' : ''}>1:${n}</option>`).join('')}${ANNOTATION_SCALES.includes(ui.scale) ? '' : `<option value="${ui.scale}" selected>1:${ui.scale}</option>`}</select></label>` +
      `<label class="field"><span>Stilmall i vyn</span><select data-show-style><option value="">Projektets (${escapeHtml(store.doc.graphics.name)})</option>${PRESETS.map((p) => `<option value="${escapeHtml(p.name)}"${ui.styleName === p.name ? ' selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}</select></label>` +
      `<label class="field"><span>Kalkera en annan vy</span><select data-show-trace><option value="">Ingen</option>${store.doc.views
        .filter((v) => v.id !== ui.activeView)
        .map((v) => `<option value="${v.id}"${ui.trace === v.id ? ' selected' : ''}>${escapeHtml(v.name)}</option>`)
        .join('')}</select></label>` +
      traceLookMarkup() +
      `<button class="btn show-style-link" data-action="style">Stilmall och ritningsgrafik…</button>`;
    m.hidden = false;
    app.$<HTMLElement>('.show-btn').setAttribute('aria-expanded', 'true');
  }

  return { applyTraceLook, closeScalePop, closeShowMenu, openScalePop, refreshShowMenu, scalePop, toggleShowMenu };
}
