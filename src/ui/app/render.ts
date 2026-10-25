import { tracedStorey } from '../../core/storeys';
import { addElements } from '../../core/commands';
import { modelViewId, onPaper, type ViewDef } from '../../core/model';
import { PRESETS, type StyleSheet } from '../../core/graphics';
import { paperSize } from '../../core/sheets';
import { existingState } from '../../core/states';
import { skewText, skewWarnings } from '../../elements/angleCheck';
import { markerName } from '../../elements/markers';
import { buildPlan, type PlanResult } from '../../repr/plan';
import type { SectionResult } from '../../repr/section';
import { paperPrim, stampOrigin } from '../../repr/sheet';
import type { Camera } from '../../view2d/camera';
import { icons } from '../icons';
import { escapeHtml } from '../labels';
import type { AppContext } from './context';
import { defaultState } from './helpers';
import { createSectionQueue, spawnSectionWorker } from './sectionQueue';
import { selectionBounds } from './selectionPlace';

/** Det på sidan som ritningen styr utöver själva planen. */
export interface RenderParts {
  chips: HTMLElement;
  compareToggle: HTMLInputElement;
  compareLabel: HTMLElement;
  /** Visas medan en fasad eller sektion räknas i bakgrundstråden (0.8.2). */
  computing: HTMLElement;
}

/**
 * Det som visas (0.8.11, ur app.ts): vad vyn visar (tillstånd, stilmall,
 * skala), planen eller fasaden, sektionen, arbetsbladet, mallbladet eller
 * ritningsbladet ritad i `renderAll`, och det som hör till: utropstecken
 * vid nästan raka vinklar, måttrutan och att zooma till det markerade.
 */
export function installRender(app: AppContext, parts: RenderParts) {
  const { chips, compareToggle, compareLabel, computing } = parts;
  let plan: PlanResult = { prims: [], pickables: [] };
  /** Den öppna fasaden eller sektionen, senast den räknades. */
  let lastSection: SectionResult | null = null;
  const sectionQueue = createSectionQueue(() => renderAll(), { spawn: typeof Worker === 'undefined' ? undefined : spawnSectionWorker });

  /**
   * En automatisk taklutning som markeras blir ett eget objekt (0.8), så att
   * den går att flytta och ge en egen stil.
   */
  function materializeSlopes(): void {
    const ids = app.selection.list().filter((id) => id.startsWith('slope:'));
    if (!ids.length || !app.ui.marker || !lastSection) return;
    const marker = app.store.doc.elements[app.ui.marker];
    if (!marker) return;
    const made = addElements(
      app.store,
      ids
        .filter((id) => lastSection!.slopes[id])
        .map((id) => ({ type: 'RoofSlope', storey: marker.storey, space: marker.id, states: [], tags: [], params: { ...lastSection!.slopes[id] }, props: {} })),
      app.ui.state,
      'Taklutningen blir ett eget objekt',
    );
    app.selection.set([...app.selection.list().filter((id) => !id.startsWith('slope:')), ...made.map((e) => e.id)]);
  }


  // ---------- Vyn som visas ----------

  /** Stilmallen för vyn: en förinställd mall med projektets texter, eller projektets egen. */
  // Samma förinställda stilmall ger samma objekt, så att planens cache träffar (0.8.3).
  // Projektets egna linjetyper följer med (0.8.30), så att formerna ritas likadant.
  // Fyllningstyperna likaså (0.8.36).
  const presetStyles = new Map<string, { labels: StyleSheet['labels']; lineTypes: StyleSheet['lineTypes']; fillTypes: StyleSheet['fillTypes']; sheet: StyleSheet }>();
  function styleFor(name: string | null): StyleSheet {
    const g = app.store.doc.graphics;
    const preset = name ? PRESETS.find((p) => p.name === name) : undefined;
    if (!preset) return g;
    const hit = presetStyles.get(preset.name);
    if (hit && hit.labels === g.labels && hit.lineTypes === g.lineTypes && hit.fillTypes === g.fillTypes) return hit.sheet;
    const sheet = { ...preset, labels: g.labels, ...(g.lineTypes ? { lineTypes: g.lineTypes } : {}), ...(g.fillTypes ? { fillTypes: g.fillTypes } : {}) };
    presetStyles.set(preset.name, { labels: g.labels, lineTypes: g.lineTypes, fillTypes: g.fillTypes, sheet });
    return sheet;
  }

  function viewStatesOf(v: ViewDef) {
    const ex = existingState(app.store.doc);
    return {
      state: v.state,
      compareTo: v.compare && ex && ex.id !== v.state ? ex.id : undefined,
      detail: v.detail,
      labelDetail: v.labelDetail,
      modelDetail: v.modelDetail,
      hide: v.hide,
      hideDemolished: v.hideDemolished,
      autoDims: app.uiSettings.autoDims,
      viewId: v.id,
      viewTags: v.tags ?? [],
      scale: v.scale ?? 100,
    };
  }

  /** Mallbladet som visas (0.8.8), ritat i mm på papperet i skala 1:1. */
  function shownMaster() {
    const w = app.ui.worksheet ? app.store.doc.worksheets.find((x) => x.id === app.ui.worksheet) : undefined;
    return onPaper(w) ? w : undefined;
  }

  function viewStates() {
    const doc = app.store.doc;
    const ex = existingState(doc);
    const compareTo = app.ui.compare && ex && ex.id !== app.ui.state ? ex.id : undefined;
    // Vilken vy det är, för 2D-element med Visas i (0.8).
    const v = app.ui.activeView ? doc.views.find((x) => x.id === app.ui.activeView) : undefined;
    const viewId = v ? v.id : modelViewId(app.ui.marker ?? app.ui.worksheet ?? app.ui.storey);
    return {
      state: app.ui.state,
      compareTo,
      detail: app.ui.detail,
      labelDetail: app.ui.labelDetail,
      modelDetail: app.ui.modelDetail,
      hide: app.ui.hide,
      hideDemolished: app.ui.hideDemolished,
      autoDims: app.uiSettings.autoDims,
      viewId,
      viewTags: v?.tags ?? [],
      showHidden: app.ui.showHidden,
      ...(app.uiSettings.slabArea ? { slabArea: true } : {}),
      scale: shownMaster() ? 1 : app.ui.scale,
    };
  }

  /** Utropstecken vid det som ligger nästan men inte exakt rakt (bara i planen, inte på papper). */
  function skewMarks(cam: Camera): string {
    if (app.ui.marker || app.ui.worksheet || app.ui.layout) return '';
    return skewWarnings(app.store.doc, app.ui.storey, app.ui.state, app.uiSettings.angleWarn)
      .map((w) => {
        const [x, y] = cam.toScreen(w.at);
        return `<g class="skew-mark" transform="translate(${x.toFixed(1)} ${(y - 14).toFixed(1)})"><title>${escapeHtml(skewText(w))}</title><path d="M0 -8L8 6H-8Z"/><text y="4.5" text-anchor="middle">!</text></g>`;
      })
      .join('');
  }

  // ---------- Rendering ----------
  function renderAll(): void {
    const doc = app.store.doc;
    if (!doc.states.some((s) => s.id === app.ui.state)) app.ui.state = defaultState(doc);
    if (!doc.storeys.some((s) => s.id === app.ui.storey)) app.ui.storey = doc.storeys[0].id;
    const vs = viewStates();

    app.out('project').textContent = doc.project.name;
    if (app.ui.marker && !doc.elements[app.ui.marker]) app.ui.marker = null;
    if (app.ui.worksheet && !doc.worksheets.some((w) => w.id === app.ui.worksheet)) app.ui.worksheet = null;
    if (app.ui.layout && !doc.sheets.some((s) => s.id === app.ui.layout)) app.ui.layout = null;
    const markerEl = app.ui.marker ? doc.elements[app.ui.marker] : undefined;
    const sheet = app.ui.worksheet ? doc.worksheets.find((w) => w.id === app.ui.worksheet) : undefined;
    const layout = app.ui.layout ? doc.sheets.find((s) => s.id === app.ui.layout) : undefined;
    app.out('storey').textContent = markerEl ? markerName(doc, markerEl) : sheet ? sheet.name : layout ? `${layout.number} ${layout.name}` : (doc.storeys.find((s) => s.id === app.ui.storey)?.name ?? '');
    app.appEl.dataset.place = markerEl ? 'section' : sheet ? (onPaper(sheet) ? 'master' : 'worksheet') : layout ? 'sheet' : 'plan';
    // Ett ritningsblad och ett mallblad ritas i mm på papperet, 1:1; annars i vyns annoteringsskala (0.8 del 3).
    const master = onPaper(sheet) ? sheet : undefined;
    app.view.drawingScale = layout || master ? 1 : app.ui.scale;
    app.view.showGrid = layout || master ? false : app.uiSettings.grid;
    app.syncStatus();
    app.view.showScaleBar = !layout && !master;
    // Markera på ett blad tar också vyerna (0.8.9); tillbaka i planen det vanliga.
    if (layout && app.view.currentTool === app.selectTool) app.view.setTool(app.sheets.tool);
    else if (!layout && app.view.currentTool === app.sheets.tool) app.view.setTool(app.toolFor(app.ui.tool));

    chips.innerHTML =
      doc.states
        .map((s) => `<button role="tab" class="chip" data-state="${s.id}" aria-selected="${s.id === app.ui.state}">${escapeHtml(s.name)}</button>`)
        .join('') + `<button class="chip chip-add" data-action="new-proposal" aria-label="Nytt förslag" title="Nytt förslag">${icons.plus}</button>`;

    const ex = existingState(doc);
    compareLabel.hidden = !ex || ex.id === app.ui.state;
    if (ex) app.out('compare-label').textContent = `Jämför med ${ex.name}`;
    compareToggle.checked = app.ui.compare;

    // Fasad eller sektion: räknas fram ur modellen i stället för planen. Det
    // som är ritat i den (mått, text, 2D, taklutningar) läggs ovanpå (0.8).
    // Stora fasader och sektioner räknas i en bakgrundstråd (0.8.2): medan
    // den räknar visas den förra versionen, och renderAll körs igen när den är klar.
    const section = markerEl ? sectionQueue.get(doc, markerEl.id, vs, styleFor(app.ui.styleName), app.ui.styleName ?? '') : null;
    lastSection = section;
    computing.hidden = !(markerEl && sectionQueue.pending);
    const paper = layout ? app.sheets.drawing() : null;
    if (paper) {
      plan = { prims: paper.prims, pickables: paper.pickables };
    } else if (markerEl) {
      const drawn = buildPlan(doc, markerEl.storey, { ...vs, place: markerEl.id }, styleFor(app.ui.styleName));
      // Underlagen ligger under fasaden eller sektionen; det andra som ritats i den ovanpå.
      // Första gången en stor vy räknas finns ingen fasad än, bara det ritade.
      const under = drawn.prims.filter((q) => q.origin?.objectType === 'Underlay');
      const over = drawn.prims.filter((q) => q.origin?.objectType !== 'Underlay');
      plan = { prims: [...under, ...(section?.prims ?? []), ...over], pickables: [...(section?.pickables ?? []), ...drawn.pickables] };
    } else if (sheet) {
      // Ett arbetsblad (0.8 del 2): bara det som är ritat på det. Ett mallblad (0.8.8) med papperet under.
      plan = buildPlan(doc, app.ui.storey, { ...vs, place: sheet.id }, styleFor(app.ui.styleName));
      if (sheet.paper) {
        const [w, h] = paperSize(sheet.paper);
        plan = { prims: [paperPrim(w, h), ...plan.prims], pickables: plan.pickables };
      } else if (sheet.stamp) plan = { prims: [...stampOrigin(), ...plan.prims], pickables: plan.pickables };
    } else plan = buildPlan(doc, app.ui.storey, vs, styleFor(app.ui.styleName));
    // Kalkerad vy: en annan vy tonad under, t.ex. möbleringen under en undertaksplan.
    // Våningen under eller över (0.9) kalkeras med vyns inställningar, utan fasad- och sektionslinjerna.
    const tracing = app.ui.trace && !section && !sheet && !layout;
    const traced = tracing ? doc.views.find((v) => v.id === app.ui.trace) : undefined;
    const nextTo = tracing ? tracedStorey(doc, app.ui.storey, app.ui.trace) : undefined;
    app.view.setUnderlay(
      nextTo
        ? buildPlan(doc, nextTo.id, { ...vs, viewId: undefined, hide: [...(vs.hide ?? []), 'Section', 'Elevation', 'North'] }, styleFor(app.ui.styleName)).prims
        : traced
          ? buildPlan(doc, traced.storey, viewStatesOf(traced), styleFor(traced.style ?? null)).prims
          : [],
    );
    app.views.renderViewButton();
    if (app.ui.navOpen) app.navigator.render();
    positionMeasureBox();
    app.selection.prune((id) => !!doc.elements[id] || !!layout?.viewports.some((v) => v.id === id));
    app.view.setPrimitives(plan.prims);
    app.update3d();
    app.panel.render();
    app.smartMenu.refresh();
    if (app.ui.tool === 'wall') app.toolOpts.renderToolOptions();

    const undo = app.$<HTMLButtonElement>('[data-action="undo"]');
    const redo = app.$<HTMLButtonElement>('[data-action="redo"]');
    undo.disabled = !app.store.canUndo;
    redo.disabled = !app.store.canRedo;
    undo.title = app.store.undoLabel ? `Ångra: ${app.store.undoLabel} (Ctrl+Z)` : 'Ångra';
    redo.title = app.store.redoLabel ? `Gör om: ${app.store.redoLabel} (Ctrl+Shift+Z)` : 'Gör om';
  }

  /** Zooma planen till det markerade. */
  function zoomToSelection(): void {
    const b = selectionBounds(plan, app.selection.list());
    if (!b) return;
    if (app.ui.mode === '3d') void app.setMode('2d');
    app.view.zoomToBounds(b);
  }

  /** Måttrutan sitter vid sin punkt i planen, eller i 3D när bara 3D visas. */
  function positionMeasureBox(): void {
    if (!app.measureBox.open) return;
    const v = app.view3d;
    if (app.ui.mode === '3d' && v) app.measureBox.update((p) => v.project(p));
    else app.measureBox.update((p) => app.view.camera.toScreen(p));
  }

  return {
    /** Det som ritas just nu, med det som går att klicka på. */
    get plan() {
      return plan;
    },
    /** Den öppna fasaden eller sektionen, senast den räknades. */
    get section() {
      return lastSection;
    },
    sectionQueue,
    renderAll,
    viewStates,
    styleFor,
    skewMarks,
    materializeSlopes,
    zoomToSelection,
    positionMeasureBox,
  };
}
