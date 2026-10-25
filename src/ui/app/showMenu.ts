import { TRACE_ABOVE, TRACE_BELOW } from '../../core/storeys';
import { PRESETS } from '../../core/graphics';
import { DETAIL_LABELS, DETAIL_LEVELS } from '../../core/states';
import { parseScale, saveUiSettings } from '../uiSettings';
import { Camera } from '../../view2d/camera';
import { escapeHtml } from '../labels';
import type { AppContext } from './context';
import { ANNOTATION_SCALES, formatScale, nf } from './helpers';
import type { UiState } from './shell';

/**
 * Det som kan tändas och släckas under Visa, i kategorier (0.8.11). Nyckeln
 * är en objekttyp eller en del av ritningen i vyns `hide`; `demolished` är
 * vyns `hideDemolished`. Littera kan släckas per objekttyp (`littera:Wall`);
 * äldre vyer med `littera` släcker all littera.
 */
export const SHOW_GROUPS: readonly { id: string; label: string; items: readonly (readonly [key: string, label: string])[] }[] = [
  {
    id: 'model',
    label: 'Modell',
    items: [
      ['demolished', 'Det som rivs'],
      ['Slab', 'Bjälklag'],
      ['Roof', 'Tak'],
      ['Furniture', 'Möbler och inredning'],
      ['swing', 'Öppningssätt (dörrar)'],
      ['Underlay', 'Underlag'],
    ],
  },
  {
    id: 'littera',
    label: 'Littera',
    items: [
      ['littera:Wall', 'Väggar'],
      ['littera:Door', 'Dörrar'],
      ['littera:Window', 'Fönster'],
    ],
  },
  {
    id: 'annotation',
    label: 'Rum, mått och text',
    items: [
      ['Space', 'Rum'],
      ['Dimension', 'Mått'],
      ['Text', 'Text'],
    ],
  },
  {
    id: '2d',
    label: '2D',
    items: [
      ['Shape2D', '2D-former'],
      // Bara fyllningarna (0.8.22): formerna finns kvar och går att klicka på.
      ['fill', 'Fyllningar'],
    ],
  },
  {
    id: 'markers',
    label: 'Markörer',
    items: [
      ['Elevation', 'Fasader'],
      ['Section', 'Sektioner'],
      ['North', 'Norrpil'],
      ['roofSlope', 'Taklutning i fasad och sektion'],
      ['level', 'Nivåer i fasad och sektion'],
      ['heightDims', 'Höjdmått i sektion'],
    ],
  },
];

/** Våningen under och över (0.9) först bland det som går att kalkera. */
export function traceStoreyOptions(trace: string | null | undefined): string {
  return [
    [TRACE_BELOW, 'Våningen under'],
    [TRACE_ABOVE, 'Våningen över'],
  ]
    .map(([v, label]) => `<option value="${v}"${trace === v ? ' selected' : ''}>${label}</option>`)
    .join('');
}

/** Om det som nyckeln står för syns i vyn. */
export function isShown(ui: Pick<UiState, 'hide' | 'hideDemolished'>, key: string): boolean {
  if (key === 'demolished') return !ui.hideDemolished;
  if (key.startsWith('littera:') && ui.hide.includes('littera')) return false;
  return !ui.hide.includes(key);
}

/** Tänd eller släck det som nyckeln står för. */
export function setShown(ui: Pick<UiState, 'hide' | 'hideDemolished'>, key: string, on: boolean): void {
  if (key === 'demolished') {
    ui.hideDemolished = !on;
    return;
  }
  // Släckte en äldre vy all littera: dela upp den på objekttyperna först.
  if (key.startsWith('littera:') && ui.hide.includes('littera')) {
    const all = SHOW_GROUPS.find((g) => g.id === 'littera')!.items.map(([k]) => k);
    ui.hide = [...ui.hide.filter((h) => h !== 'littera'), ...all.filter((k) => !ui.hide.includes(k))];
  }
  ui.hide = on ? ui.hide.filter((h) => h !== key) : ui.hide.includes(key) ? ui.hide : [...ui.hide, key];
}

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
      // Detaljnivån för litteran, 2D-symbolerna och 3D var för sig (0.8.37).
      `<div class="detail-parts">${(
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
      SHOW_GROUPS.map((g) => {
        const shown = g.items.filter(([k]) => isShown(ui, k)).length;
        return `<div class="show-group" role="group" aria-label="${g.label}">
          <label class="check show-group-head"><input type="checkbox" data-show-group="${g.id}"${shown === g.items.length ? ' checked' : ''}> ${g.label}</label>
          ${g.items.map(([k, label]) => item(k, label, isShown(ui, k))).join('')}
        </div>`;
      }).join('') +
      item('showHidden', 'Visa dolda 2D-element (tonade)', ui.showHidden) +
      `<label class="field"><span>Skala för texter och mått</span><select data-show-scale>${ANNOTATION_SCALES.map((n) => `<option value="${n}"${n === ui.scale ? ' selected' : ''}>1:${n}</option>`).join('')}${ANNOTATION_SCALES.includes(ui.scale) ? '' : `<option value="${ui.scale}" selected>1:${ui.scale}</option>`}</select></label>` +
      `<label class="field"><span>Stilmall i vyn</span><select data-show-style><option value="">Projektets (${escapeHtml(store.doc.graphics.name)})</option>${PRESETS.map((p) => `<option value="${escapeHtml(p.name)}"${ui.styleName === p.name ? ' selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}</select></label>` +
      `<label class="field"><span>Kalkera en annan vy</span><select data-show-trace><option value="">Ingen</option>${traceStoreyOptions(ui.trace)}${store.doc.views
        .filter((v) => v.id !== ui.activeView)
        .map((v) => `<option value="${v.id}"${ui.trace === v.id ? ' selected' : ''}>${escapeHtml(v.name)}</option>`)
        .join('')}</select></label>` +
      traceLookMarkup() +
      `<button class="btn show-style-link" data-action="style">Stilmall och ritningsgrafik…</button>`;
    m.hidden = false;
    syncGroups();
    app.$<HTMLElement>('.show-btn').setAttribute('aria-expanded', 'true');
  }

  /** Kategoriernas kryssrutor: ikryssad när allt syns, halvt när en del syns. */
  function syncGroups(): void {
    for (const g of SHOW_GROUPS) {
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
    const group = SHOW_GROUPS.find((g) => g.id === input.dataset.showGroup);
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

  return { applyTraceLook, closeScalePop, closeShowMenu, openScalePop, refreshShowMenu, scalePop, toggleShowItem, toggleShowMenu };
}
