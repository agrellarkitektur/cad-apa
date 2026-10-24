import { deleteElements } from '../../core/commands';
import type { Vec2 } from '../../repr/primitives';
import { COMMANDS, commandFor, complete, findCommand, type CommandDef, type Match } from '../commandRegistry';
import { icons } from '../icons';
import { escapeHtml } from '../labels';
import { OPS, RAIL_ITEMS, type RailId } from '../modify/ops';
import { looksLikePoint, parsePoint, resolvePoint, type PointTaker } from '../pointInput';
import { isNarrow } from '../sheet';
import type { AppContext } from './context';
import type { ToolId } from './shell';

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 });
const xy = (p: Vec2): string => `${nf.format(p[0])}; ${nf.format(p[1])}`;
const POINT_HELP = 'Skriv <b>2400</b>, <b>@1200,600</b>, <b>@3000&lt;45</b> eller <b>x,y</b>.';

/**
 * Smartshell (0.8.20): kommandoraden nere under ritytan, som i AutoCAD och
 * med samma blixt som smartshell i Sisyfos. Kommandon skrivs med namn eller
 * förkortning, engelska eller svenska (src/ui/commandRegistry.ts); listan
 * över fältet kompletterar och raden under säger vad Enter gör. I vägg-,
 * 2D- och måttverktyget tar den emot punkter (src/ui/pointInput.ts).
 *
 * Enter utan att ett kommando är igång öppnar raden, mellanslag kör det
 * senaste kommandot igen. Kan döljas i Gränssnitt.
 */
export function installCommandLine(app: AppContext, pressRail: (id: RailId) => void) {
  const el = app.$<HTMLElement>('.smartshell');
  el.innerHTML = `
    <div class="ss-row">
      <span class="ss-ic" title="Smartshell">${icons.bolt}</span>
      <label class="ss-prompt" for="ss-input" data-out="ss-prompt">Kommando</label>
      <input id="ss-input" class="ss-input" autocomplete="off" spellcheck="false" autocapitalize="off" enterkeyhint="go" role="combobox" aria-autocomplete="list" aria-controls="ss-list" aria-expanded="false" aria-describedby="ss-hint" placeholder="Skriv ett kommando eller en punkt">
      <button type="button" class="ss-help" data-ss="help" title="Alla kommandon och förkortningar">${icons.help}<span>Kommandon</span></button>
      <kbd>Enter</kbd>
    </div>
    <div class="ss-hint" id="ss-hint" aria-live="polite"></div>
    <ul class="ss-list" id="ss-list" role="listbox" hidden></ul>`;
  const input = el.querySelector<HTMLInputElement>('.ss-input')!;
  const hintEl = el.querySelector<HTMLElement>('.ss-hint')!;
  const listEl = el.querySelector<HTMLUListElement>('.ss-list')!;
  const promptEl = el.querySelector<HTMLElement>('.ss-prompt')!;

  let last: CommandDef | null = null;
  let matches: Match[] = [];
  let picked = 0;
  /** Alla kommandon visas (Kommandon, ? eller hjälp). */
  let showAll = false;
  /** Det som skrivits tidigare, för pil upp och ned. */
  const history: string[] = [];
  let historyAt = -1;
  /** Medan ett kommando körs från raden ska setTool inte skriva över det som det senaste. */
  let running = false;

  const shown = (): boolean => app.uiSettings.smartshell && !isNarrow();

  /** Verktyget som tar emot skrivna punkter just nu, eller null. */
  function taker(): PointTaker | null {
    if (app.modifier.busy || app.aligning || app.zoomingBox || app.underlays.busy()) return null;
    if (app.ui.mode === '3d') return null;
    switch (app.ui.tool) {
      case 'wall':
        return app.wallTool;
      case 'draw2d':
        return app.draw2dTool;
      case 'dimension':
        return app.dimensionTool;
      default:
        return null;
    }
  }

  /** Om ett kommando är igång: något ritas eller Modifiera pågår. Enter och mellanslag hör då till det. */
  function busy(): boolean {
    if (app.modifier.busy || app.aligning || app.zoomingBox || app.underlays.busy()) return true;
    switch (app.ui.tool) {
      case 'wall':
        return app.wallTool.drawing;
      case 'dimension':
        return app.dimensionTool.count > 0;
      case 'draw2d':
        return app.draw2dTool.count > 0;
      case 'measure':
        return app.measureTool.measurement().points > 0;
      case 'roof':
        return app.roofTool.started;
      case 'section':
        return app.sectionTool.step > 0;
      case 'elevation':
        return app.elevationTool.step > 0;
      default:
        return false;
    }
  }

  function remember(c: CommandDef | undefined): void {
    if (!c || c.action === 'help' || c.tool === 'select') return;
    last = c;
    refresh();
  }

  /** Ett verktyg valdes (knapp, kortkommando eller kommando). */
  function toolChosen(id: ToolId): void {
    if (!running) remember(commandFor({ tool: id }));
    refresh();
  }

  function run(c: CommandDef): void {
    running = true;
    try {
      if (c.shape) {
        app.setTool('draw2d');
        if (app.ui.tool === 'draw2d') {
          app.draw2dTool.setKind(c.shape);
          app.toolOpts.renderToolOptions();
        }
      } else if (c.tool) app.setTool(c.tool);
      else if (c.rail) pressRail(c.rail);
      else if (c.action) action(c);
    } finally {
      running = false;
    }
    remember(c);
  }

  function action(c: CommandDef): void {
    switch (c.action) {
      case 'erase':
        if (!app.selection.size) app.hint('Markera det som ska tas bort först.');
        else {
          deleteElements(app.store, app.selection.list());
          app.selection.clear();
        }
        break;
      case 'undo':
        app.store.undo();
        break;
      case 'redo':
        app.store.redo();
        break;
      case 'zoom-fit':
        app.view.zoomToFit();
        break;
      case 'zoom-box':
        app.startZoomBox();
        break;
      case 'zoom-prev':
        app.previousZoom();
        break;
      case 'grid':
        app.toggleGrid();
        break;
      case 'snap':
        app.$<HTMLElement>('[data-action="snap"]').click();
        break;
      case 'save':
        void app.saveNow(false);
        break;
      case 'save-as':
        void app.saveNow(true);
        break;
      case 'open':
        void app.openFile();
        break;
      case 'plot':
        app.$<HTMLElement>('.menu [data-action="plot"]').click();
        break;
      case 'mode-2d':
        void app.setMode('2d');
        break;
      case 'mode-3d':
        void app.setMode('3d');
        break;
      case 'mode-split':
        void app.setMode('split');
        break;
      case 'help':
        openAll();
        break;
    }
  }

  /** Mellanslag (eller Enter i ett tomt fält): det senaste kommandot igen. */
  function repeat(): boolean {
    if (!last) return false;
    run(last);
    return true;
  }

  // ---------- Punkter ----------

  /** Om det skrivna är en punkt till verktyget: det ser ut som en och är inget kommando (3d). */
  const isPoint = (text: string): boolean => !!taker() && looksLikePoint(text) && (parsePoint(text) !== null || !findCommand(text));

  function pointFor(text: string): { p: Vec2 } | { error: string } | { angle: number } | null {
    const t = taker();
    const e = parsePoint(text);
    if (!t || !e) return null;
    if (e.kind === 'angle') return { angle: e.deg };
    return resolvePoint(e, t.lastPoint(), t.cursorPoint(), t.lockAngle);
  }

  function enterPoint(text: string): boolean {
    const t = taker();
    const r = pointFor(text);
    if (!t || !r) return false;
    if ('error' in r) {
      app.hint(r.error, 3000);
      return true;
    }
    if ('angle' in r) {
      t.lockAngle = r.angle;
      app.toolOpts.renderToolOptions();
      app.view.requestRender();
      return true;
    }
    // Väggens längd följer den inskrivna vinkeln som förut (placeLength).
    t.takePoint(r.p);
    app.view.requestRender();
    return true;
  }

  // ---------- Fältet ----------

  function submit(): void {
    const text = input.value.trim();
    if (text) {
      if (history[0] !== text) history.unshift(text);
      history.length = Math.min(history.length, 30);
    }
    historyAt = -1;
    if (!text) {
      clear();
      if (busy()) enterInTool();
      else if (!repeat()) input.blur();
      return;
    }
    if (isPoint(text)) {
      enterPoint(text);
      clear();
      refresh();
      return;
    }
    const c = matches[picked]?.cmd ?? findCommand(text);
    if (!c) {
      app.hint(looksLikePoint(text) ? 'Välj ett ritverktyg först, t.ex. vägg eller linje.' : `Inget kommando heter ”${text}”. Skriv ? för alla.`, 3000);
      input.select();
      return;
    }
    clear();
    input.blur();
    run(c);
  }

  /** Enter i ett verktyg, som Enter på tangentbordet: avsluta det som ritas. */
  function enterInTool(): void {
    if (app.ui.tool === 'measure') app.measureTool.reset();
    if (app.ui.tool === 'wall') app.wallTool.finish();
    if (app.ui.tool === 'dimension') app.dimensionTool.donePoints();
    if (app.ui.tool === 'draw2d') app.draw2dTool.finish(false);
    refresh();
  }

  function clear(): void {
    input.value = '';
    showAll = false;
    matches = [];
    picked = 0;
    renderList();
    renderHint();
  }

  function openAll(): void {
    input.focus();
    showAll = true;
    matches = COMMANDS.map((cmd) => ({ cmd, name: cmd.sv[0], exact: false }));
    picked = -1;
    renderList();
    renderHint();
  }

  function update(): void {
    const text = input.value;
    showAll = false;
    if (!text.trim() || isPoint(text)) matches = [];
    else if (text.trim() === '?') {
      openAll();
      return;
    } else matches = complete(text);
    picked = 0;
    renderList();
    renderHint();
  }

  function renderList(): void {
    const open = matches.length > 0 && (showAll || !(matches.length === 1 && matches[0].exact)) && document.activeElement === input;
    listEl.hidden = !open;
    input.setAttribute('aria-expanded', String(open));
    if (!open) return;
    let group = '';
    listEl.innerHTML = matches
      .map((m, i) => {
        const c = m.cmd;
        const g = showAll ? (c.rail ? 'Ändra det markerade' : c.action ? 'Direkt' : 'Visa och rita') : '';
        const head = g && g !== group ? `<li class="ss-group" role="presentation">${(group = g)}</li>` : '';
        const names = [...c.en, ...c.sv].map((n) => `<code${n === m.name ? ' class="hit"' : ''}>${escapeHtml(n.toUpperCase())}</code>`).join('');
        return `${head}<li role="option" data-i="${i}" aria-selected="${i === picked}"><b>${escapeHtml(c.label)}</b>${c.note ? `<small>${escapeHtml(c.note)}</small>` : ''}<span class="ss-names">${names}</span></li>`;
      })
      .join('');
    listEl.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }

  function renderHint(): void {
    const text = input.value.trim();
    const t = taker();
    const tool = toolLabel();
    promptEl.textContent = tool ?? 'Kommando';
    let h = '';
    let bad = false;
    if (showAll) h = 'Klicka på ett kommando, eller skriv namnet eller förkortningen. Esc stänger listan.';
    else if (!text) {
      if (t) h = `${escapeHtml(t.hintText())} ${POINT_HELP}`;
      else if (app.modifier.active) h = `<b>${escapeHtml(OPS[app.modifier.active].label)}:</b> ${escapeHtml(OPS[app.modifier.active].hint)} Esc avbryter.`;
      else if (app.modifier.picking) h = `${escapeHtml(RAIL_ITEMS.find((r) => r.id === app.modifier.picking)?.ask ?? 'Klicka i ritningen.')} Esc avbryter.`;
      else if (busy()) h = 'Enter avslutar det som pågår, Esc avbryter.';
      else h = `Skriv ett kommando, t.ex. <b>L</b> för linje eller <b>vägg</b>.${last ? ` Mellanslag: <b>${escapeHtml(last.label)}</b> igen.` : ''}`;
    } else if (isPoint(text) && t) {
      const r = pointFor(text);
      if (!r) {
        h = `Det går inte att läsa som en punkt. ${POINT_HELP}`;
        bad = true;
      } else if ('error' in r) {
        h = escapeHtml(r.error);
        bad = true;
      } else if ('angle' in r) h = `Enter: låser riktningen till <b>${nf.format(r.angle)}°</b>; klicka eller skriv avståndet.`;
      else h = `Enter: punkt i <b>${xy(r.p)}</b>${t.lastPoint() ? `, ${nf.format(Math.hypot(r.p[0] - t.lastPoint()![0], r.p[1] - t.lastPoint()![1]))} mm från förra` : ''}.`;
    } else {
      const m = matches[picked];
      if (m) h = `Enter: <b>${escapeHtml(m.cmd.label)}</b>${m.cmd.note ? ` (${escapeHtml(m.cmd.note)})` : ''}.${matches.length > 1 ? ' Pil upp och ned väljer, Tab fyller i.' : ''}`;
      else {
        h = looksLikePoint(text) ? 'Välj ett ritverktyg först, t.ex. vägg eller linje, så går punkter att skriva.' : 'Inget kommando heter så. Skriv <b>?</b> för alla.';
        bad = true;
      }
    }
    hintEl.innerHTML = h;
    hintEl.classList.toggle('bad', bad);
  }

  /** Namnet på verktyget som är igång, som prompt framför fältet. */
  function toolLabel(): string | null {
    if (app.modifier.busy) return 'Ändra';
    const id = app.ui.tool;
    if (id === 'select' || id === 'pan') return null;
    if (id === 'draw2d') return commandFor({ shape: app.draw2dTool.options.kind })?.label ?? '2D';
    return commandFor({ tool: id })?.label ?? null;
  }

  /** Läget har ändrats (verktyg, punkter, Modifiera): prompten och raden under. */
  function refresh(): void {
    const show = shown();
    el.hidden = !show;
    app.appEl.classList.toggle('smartshell-on', show);
    if (!show) return;
    renderHint();
  }

  input.addEventListener('input', update);
  input.addEventListener('focus', () => {
    if (!showAll) update();
    el.classList.add('active');
  });
  input.addEventListener('blur', () => {
    el.classList.remove('active');
    // Ett klick i listan ska hinna fram innan den stängs.
    setTimeout(() => {
      if (document.activeElement !== input) {
        showAll = false;
        listEl.hidden = true;
        input.setAttribute('aria-expanded', 'false');
        renderHint();
      }
    }, 150);
  });
  input.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const open = !listEl.hidden;
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (showAll && picked < 0) return;
        submit();
        break;
      case ' ':
        // Mellanslag är Enter, som i AutoCAD (kommandon och punkter har inga mellanslag).
        e.preventDefault();
        if (!input.value.trim() && !busy()) {
          clear();
          if (!repeat()) app.hint('Inget kommando att köra igen än.');
          else input.blur();
        } else submit();
        break;
      case 'Tab':
        if (open && matches[Math.max(0, picked)]) {
          e.preventDefault();
          const m = matches[Math.max(0, picked)];
          input.value = m.name.toUpperCase();
          update();
        }
        break;
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        if (open) {
          picked = (Math.max(-1, picked) + step + matches.length) % matches.length;
          renderList();
          renderHint();
        } else if (history.length) {
          historyAt = Math.max(-1, Math.min(history.length - 1, historyAt - step));
          input.value = historyAt < 0 ? '' : history[historyAt];
          update();
        }
        break;
      }
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        if (input.value || showAll) clear();
        else {
          input.blur();
          if (busy() || app.ui.tool !== 'select') app.cancelCommand();
        }
        break;
    }
  });
  listEl.addEventListener('mousedown', (e) => e.preventDefault());
  listEl.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    const m = li ? matches[Number(li.dataset.i)] : undefined;
    if (!m) return;
    clear();
    input.blur();
    run(m.cmd);
  });
  el.querySelector('[data-ss="help"]')!.addEventListener('mousedown', (e) => e.preventDefault());
  el.querySelector('[data-ss="help"]')!.addEventListener('click', () => (showAll && !listEl.hidden ? clear() : openAll()));
  window.addEventListener('resize', refresh);
  app.selection.subscribe(() => renderHint());
  app.modifier.subscribe(() => refresh());

  return {
    el,
    input,
    get last() {
      return last;
    },
    busy,
    taker,
    refresh,
    remember,
    toolChosen,
    run,
    repeat,
    /** Öppna raden (Enter utan kommando igång), med en första bokstav eller siffra. */
    open(first = ''): boolean {
      if (!shown()) return false;
      input.focus();
      if (first) {
        input.value = first;
        update();
      }
      return true;
    },
    get shown() {
      return shown();
    },
  };
}

export type CommandLine = ReturnType<typeof installCommandLine>;
