import { deleteElements } from '../../core/commands';
import type { Vec2 } from '../../repr/primitives';
import { COMMANDS, commandFor, complete, findCommand, type CommandDef, type Match } from '../commandRegistry';
import type { MenuItem } from '../contextMenu';
import { icons } from '../icons';
import { escapeHtml } from '../labels';
import { OPS, type RailId } from '../modify/ops';
import { ModifyTool } from '../modify/tool';
import { looksLikePoint, parsePoint, resolvePoint, type PointTaker } from '../pointInput';
import { isNarrow } from '../sheet';
import { saveUiSettings, type ShellDock } from '../uiSettings';
import type { AppContext } from './context';
import { currentPrompt, matchOption, type Prompt, type PromptOption } from './prompts';
import type { ToolId } from './shell';

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 });
const xy = (p: Vec2): string => `${nf.format(p[0])}; ${nf.format(p[1])}`;
const POINT_HELP = 'Skriv <b>2400</b>, <b>@1200,600</b>, <b>@3000&lt;45</b> eller <b>x,y</b>.';
/** Hur många rader historiken (F2) sparar, och hur många kommandon högerklicket visar. */
const LOG_MAX = 200;
const RECENT_MAX = 6;

interface LogLine {
  text: string;
  /** Kommandot på raden, så att ett klick kan köra det igen. */
  cmd?: CommandDef;
  kind: 'cmd' | 'point' | 'option' | 'note';
}

/**
 * Smartshell (0.8.20, 0.8.21): kommandoraden, som i AutoCAD och med samma
 * blixt som smartshell i Sisyfos. Kommandon skrivs med namn eller
 * förkortning, engelska eller svenska (src/ui/commandRegistry.ts); listan
 * kompletterar och raden under säger vad Enter gör.
 *
 * Det som pågår frågar efter nästa steg med alternativen i hakparentes
 * (src/ui/app/prompts.ts), som går att skriva eller klicka. Punkter skrivs
 * i alla verktyg som ritar med punkter och i Modifiera (src/ui/pointInput.ts).
 * F2 visar historiken; högerklick visar de senaste kommandona. Raden kan
 * dockas nere eller uppe, eller ligga fritt över ritytan (dra i blixten).
 *
 * Enter utan att ett kommando är igång öppnar raden, mellanslag kör det
 * senaste kommandot igen. Kan döljas i Gränssnitt.
 */
export function installCommandLine(app: AppContext, pressRail: (id: RailId) => void) {
  const el = app.$<HTMLElement>('.smartshell');
  el.innerHTML = `
    <div class="ss-row">
      <span class="ss-grip" title="Smartshell. Dra för att flytta raden; dubbelklicka för att docka den nere." role="button" tabindex="-1" aria-label="Flytta smartshell">${icons.bolt}</span>
      <label class="ss-prompt" for="ss-input">Smartshell</label>
      <input id="ss-input" class="ss-input" autocomplete="off" spellcheck="false" autocapitalize="off" enterkeyhint="go" role="combobox" aria-autocomplete="list" aria-controls="ss-list" aria-expanded="false" aria-describedby="ss-hint" placeholder="Skriv ett kommando eller en punkt">
      <button type="button" class="ss-btn" data-ss="log" title="Historik (F2)" aria-pressed="false">${icons.history}<span>Historik</span></button>
      <button type="button" class="ss-btn" data-ss="help" title="Alla kommandon och förkortningar">${icons.help}<span>Kommandon</span></button>
      <button type="button" class="ss-btn ss-dock-btn" data-ss="dock" title="Var raden ligger" aria-haspopup="true">${icons.dock}</button>
    </div>
    <div class="ss-hint" id="ss-hint" aria-live="polite"></div>
    <ul class="ss-list" id="ss-list" role="listbox" hidden></ul>
    <ol class="ss-log" aria-label="Historik" hidden></ol>`;
  const input = el.querySelector<HTMLInputElement>('.ss-input')!;
  const hintEl = el.querySelector<HTMLElement>('.ss-hint')!;
  const listEl = el.querySelector<HTMLUListElement>('.ss-list')!;
  const logEl = el.querySelector<HTMLOListElement>('.ss-log')!;
  const grip = el.querySelector<HTMLElement>('.ss-grip')!;
  const canvas = app.$<HTMLElement>('.canvas');

  let last: CommandDef | null = null;
  let matches: Match[] = [];
  let picked = 0;
  /** Alla kommandon visas (Kommandon, ? eller hjälp). */
  let showAll = false;
  /** Det som skrivits tidigare, för pil upp och ned. */
  const typed: string[] = [];
  let typedAt = -1;
  /** Allt som hänt, för historiken (F2) och högerklicket. */
  const log: LogLine[] = [];
  let logOpen = false;
  /** Medan ett kommando körs från raden ska setTool inte skriva över det som det senaste. */
  let running = false;
  /** Ett kommando för det markerade som väntar på att något markeras (Flytta utan markering). */
  let pending: CommandDef | null = null;
  /** Frågan som visas nu, så att ett klick på ett alternativ hittar rätt. */
  let prompt: Prompt | null = null;

  const shown = (): boolean => app.uiSettings.smartshell && !isNarrow();

  /** Verktyget som tar emot skrivna punkter just nu, eller null. */
  function taker(): PointTaker | null {
    if (app.aligning || app.zoomingBox || app.underlays.busy() || pending) return null;
    if (app.ui.mode === '3d') return null;
    const m = app.modifier;
    if (m.busy) {
      if (m.drawingWall) return app.wallTool;
      const t = m.runningTool;
      return t instanceof ModifyTool && t.takesPoints ? t : null;
    }
    switch (app.ui.tool) {
      case 'wall':
        return app.wallTool;
      case 'draw2d':
        return app.draw2dTool;
      case 'dimension':
        return app.dimensionTool;
      case 'roof':
        return app.roofTool;
      case 'section':
        return app.sectionTool;
      case 'elevation':
        return app.elevationTool;
      default:
        return null;
    }
  }

  /** Om ett kommando är igång: något ritas, Modifiera pågår eller ett kommando väntar på en markering. Enter och mellanslag hör då till det. */
  function busy(): boolean {
    if (pending || app.modifier.busy || app.aligning || app.zoomingBox || app.underlays.busy()) return true;
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

  // ---------- Historiken ----------

  function addLog(line: LogLine): void {
    log.push(line);
    if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
    if (logOpen) renderLog();
  }

  function renderLog(): void {
    logEl.hidden = !logOpen || !listEl.hidden;
    el.querySelector('[data-ss="log"]')!.setAttribute('aria-pressed', String(logOpen));
    if (logEl.hidden) return;
    logEl.innerHTML = log.length
      ? log
          .map(
            (l, i) =>
              `<li class="ss-log-${l.kind}"${l.cmd ? ` data-log="${i}" title="Klicka för att köra ${escapeHtml(l.cmd.label.toLowerCase())} igen"` : ''}>${l.kind === 'cmd' ? `<b>${escapeHtml(l.text)}</b>` : escapeHtml(l.text)}</li>`,
          )
          .join('')
      : '<li class="ss-log-note">Inget har hänt än. Kommandon, punkter och val hamnar här.</li>';
    logEl.scrollTop = logEl.scrollHeight;
  }

  function toggleLog(open = !logOpen): void {
    logOpen = open;
    renderLog();
  }

  /** De senaste kommandona, nyast först, utan dubbletter. */
  function recent(filter: (c: CommandDef) => boolean = () => true): CommandDef[] {
    const out: CommandDef[] = [];
    for (let i = log.length - 1; i >= 0 && out.length < RECENT_MAX; i--) {
      const c = log[i].cmd;
      if (c && filter(c) && !out.includes(c)) out.push(c);
    }
    return out;
  }

  function remember(c: CommandDef | undefined): void {
    if (!c || c.action === 'help' || c.tool === 'select') return;
    last = c;
    addLog({ text: c.label, cmd: c, kind: 'cmd' });
    refresh();
  }

  /** Ett verktyg valdes (knapp, kortkommando eller kommando). */
  function toolChosen(id: ToolId): void {
    if (!running) remember(commandFor({ tool: id }));
    // Ett annat verktyg avbryter ett kommando som väntar på en markering.
    if (pending && id !== 'select') pending = null;
    refresh();
  }

  // ---------- Kommandon ----------

  function run(c: CommandDef): void {
    running = true;
    pending = null;
    try {
      if (c.shape) {
        app.setTool('draw2d');
        if (app.ui.tool === 'draw2d') {
          app.draw2dTool.setKind(c.shape);
          app.toolOpts.renderToolOptions();
        }
      } else if (c.tool) app.setTool(c.tool);
      else if (c.rail) {
        if (app.selection.size) pressRail(c.rail);
        else waitForSelection(c);
      } else if (c.action) action(c);
    } finally {
      running = false;
    }
    remember(c);
  }

  /** Kommandot för det markerade körs när något markerats och Enter trycks (som i AutoCAD). */
  function waitForSelection(c: CommandDef): void {
    if (app.ui.tool !== 'select') app.setTool('select');
    if (app.ui.mode === '3d') void app.setMode('2d');
    pending = c;
    refresh();
  }

  function runPending(): void {
    const c = pending;
    if (!c) return;
    if (!app.selection.size) {
      app.hint('Markera något först, eller tryck Esc.', 2500);
      return;
    }
    pending = null;
    running = true;
    try {
      if (c.rail) pressRail(c.rail);
      else if (c.action === 'erase') erase();
    } finally {
      running = false;
    }
    refresh();
  }

  /** Esc: ett kommando som väntar på en markering avbryts. */
  function cancelPending(): boolean {
    if (!pending) return false;
    pending = null;
    addLog({ text: 'Avbrutet', kind: 'note' });
    refresh();
    return true;
  }

  function erase(): void {
    deleteElements(app.store, app.selection.list());
    app.selection.clear();
  }

  function action(c: CommandDef): void {
    switch (c.action) {
      case 'erase':
        if (!app.selection.size) waitForSelection(c);
        else erase();
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

  /** Enter i ett verktyg, som Enter på tangentbordet: avsluta det som ritas, eller kör kommandot som väntade på en markering. */
  function enterInTool(): void {
    if (pending) runPending();
    else if (app.ui.tool === 'measure') app.measureTool.reset();
    else if (app.ui.tool === 'wall') app.wallTool.finish();
    else if (app.ui.tool === 'dimension') app.dimensionTool.donePoints();
    else if (app.ui.tool === 'draw2d') app.draw2dTool.finish(false);
    refresh();
  }

  /** Enter eller mellanslag utanför fältet. */
  function key(kind: 'enter' | 'space'): void {
    if (busy()) enterInTool();
    else if (kind === 'enter') {
      if (!open()) enterInTool();
    } else if (!repeat()) app.hint('Inget kommando att köra igen än.');
  }

  function runOption(o: PromptOption): void {
    addLog({ text: `[${o.label}]`, kind: 'option' });
    o.run();
    app.view.requestRender();
    refresh();
  }

  // ---------- Punkter ----------

  /** Ett Modifiera-val med ett värde (radie, vinkel …): ett ensamt tal är värdet, inte ett avstånd. */
  function valueOp(): boolean {
    const a = app.modifier.active;
    return !!a && !!OPS[a].value && app.modifier.runningTool instanceof ModifyTool;
  }

  /** Om det skrivna är en punkt till verktyget: det ser ut som en och är inget kommando (3d). */
  const isPoint = (text: string): boolean => !!taker() && looksLikePoint(text) && (parsePoint(text) !== null || !findCommand(text));

  function pointFor(text: string): { p: Vec2 } | { error: string } | { angle: number } | { value: number } | null {
    const t = taker();
    const e = parsePoint(text);
    if (!t || !e) return null;
    if (e.kind === 'angle') return { angle: e.deg };
    if (e.kind === 'dist' && valueOp()) return { value: e.len };
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
      addLog({ text: `<${nf.format(r.angle)}°`, kind: 'point' });
      app.toolOpts.renderToolOptions();
      app.view.requestRender();
      return true;
    }
    if ('value' in r) {
      addLog({ text: `${nf.format(r.value)}`, kind: 'point' });
      app.modifier.applyValue(r.value);
      return true;
    }
    addLog({ text: `${text.trim()}  →  ${xy(r.p)}`, kind: 'point' });
    t.takePoint(r.p);
    app.view.requestRender();
    return true;
  }

  // ---------- Fältet ----------

  function submit(): void {
    const text = input.value.trim();
    if (text) {
      if (typed[0] !== text) typed.unshift(text);
      typed.length = Math.min(typed.length, 30);
    }
    typedAt = -1;
    if (!text) {
      clear();
      if (busy()) enterInTool();
      else if (!repeat()) input.blur();
      return;
    }
    const opt = prompt && matchOption(prompt.options, text);
    if (opt) {
      clear();
      runOption(opt);
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
    if (!text.trim() || isPoint(text) || (prompt && matchOption(prompt.options, text))) matches = [];
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
    renderLog();
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

  /** Ett alternativ med sin bokstav understruken: [Avsluta/Stäng/Ångra]. */
  function optionMarkup(o: PromptOption, i: number): string {
    const k = o.key.toLowerCase();
    const label = o.label.toLowerCase().startsWith(k) ? `<u>${escapeHtml(o.label.slice(0, k.length))}</u>${escapeHtml(o.label.slice(k.length))}` : `${escapeHtml(o.label)} <u>${escapeHtml(o.key)}</u>`;
    return `<button type="button" class="ss-opt" data-opt="${i}"${o.on ? ' aria-pressed="true"' : ''} title="Skriv ${escapeHtml(o.key)} eller klicka">${label}</button>`;
  }

  function promptMarkup(p: Prompt, withPointHelp: boolean): string {
    const opts = p.options.length ? ` <span class="ss-opts">[${p.options.map(optionMarkup).join('/')}]</span>` : '';
    const help = withPointHelp && !p.options.length ? ` ${POINT_HELP}` : '';
    return `<b class="ss-head">${escapeHtml(p.head)}:</b> ${escapeHtml(p.text)}${opts}${help}`;
  }

  function renderHint(): void {
    const text = input.value.trim();
    const t = taker();
    prompt = shown() ? currentPrompt(app, pending, runPending) : null;
    let h = '';
    let bad = false;
    const opt = text && prompt ? matchOption(prompt.options, text) : null;
    if (showAll) h = 'Klicka på ett kommando, eller skriv namnet eller förkortningen. Esc stänger listan.';
    else if (!text) {
      if (prompt) h = promptMarkup(prompt, !!t);
      else if (busy()) h = 'Enter avslutar det som pågår, Esc avbryter.';
      else h = `Skriv ett kommando, t.ex. <b>L</b> för linje eller <b>vägg</b>.${last ? ` Mellanslag: <b>${escapeHtml(last.label)}</b> igen.` : ''}`;
    } else if (opt) h = `Enter: <b>${escapeHtml(opt.label)}</b>.`;
    else if (isPoint(text) && t) {
      const r = pointFor(text);
      if (!r) {
        h = `Det går inte att läsa som en punkt. ${POINT_HELP}`;
        bad = true;
      } else if ('error' in r) {
        h = escapeHtml(r.error);
        bad = true;
      } else if ('angle' in r) h = `Enter: låser riktningen till <b>${nf.format(r.angle)}°</b>; klicka eller skriv avståndet.`;
      else if ('value' in r) h = `Enter: ${escapeHtml(OPS[app.modifier.active!].value!.label.toLowerCase())} <b>${nf.format(r.value)}</b>.`;
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
    hintEl.title = hintEl.textContent ?? '';
  }

  /** Läget har ändrats (verktyg, punkter, Modifiera): frågan och raden under. */
  function refresh(): void {
    const show = shown();
    el.hidden = !show;
    app.appEl.classList.toggle('smartshell-on', show);
    applyDock();
    if (!show) return;
    renderHint();
  }

  // ---------- Läget: dockad nere, uppe eller fritt ----------

  function applyDock(): void {
    const dock = shown() ? app.uiSettings.shellDock : 'bottom';
    app.appEl.classList.toggle('ss-top', dock === 'top');
    app.appEl.classList.toggle('ss-float', dock === 'float');
    el.dataset.dock = dock;
    if (dock !== 'float') {
      el.style.left = el.style.top = el.style.width = '';
      el.classList.toggle('ss-down', dock === 'top');
      return;
    }
    const c = canvas.getBoundingClientRect();
    const a = app.appEl.getBoundingClientRect();
    const w = Math.min(720, Math.max(320, c.width - 24));
    const h = el.offsetHeight || 54;
    const [fx, fy] = app.uiSettings.shellAt;
    const x = Math.max(0, Math.min(c.width - w, fx * c.width));
    const y = Math.max(0, Math.min(c.height - h, fy * c.height));
    el.style.width = `${w}px`;
    el.style.left = `${c.left - a.left + x}px`;
    el.style.top = `${c.top - a.top + y}px`;
    // Listan och historiken öppnas nedåt när raden ligger i övre halvan.
    el.classList.toggle('ss-down', y < c.height / 2 - h / 2);
  }

  function setDock(dock: ShellDock, at?: [number, number]): void {
    app.uiSettings.shellDock = dock;
    if (at) app.uiSettings.shellAt = at;
    saveUiSettings(app.uiSettings);
    applyDock();
    // Ritytan ändrar storlek när raden flyttas mellan nere och uppe.
    window.dispatchEvent(new Event('resize'));
  }

  /** Dra i blixten: raden följer med; släppt nära ritytans över- eller underkant dockas den där. */
  function installDrag(): void {
    let start: { x: number; y: number; dx: number; dy: number } | null = null;
    let dragging = false;
    let drop: ShellDock = 'float';
    const zone = document.createElement('div');
    zone.className = 'ss-dropzone';
    zone.hidden = true;
    canvas.appendChild(zone);
    const EDGE = 48;

    grip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      start = { x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top };
      dragging = false;
      grip.setPointerCapture(e.pointerId);
    });
    grip.addEventListener('pointermove', (e) => {
      if (!start) return;
      if (!dragging && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 5) return;
      const c = canvas.getBoundingClientRect();
      if (!dragging) {
        dragging = true;
        app.appEl.classList.add('ss-dragging');
        if (app.uiSettings.shellDock !== 'float') {
          app.uiSettings.shellDock = 'float';
          applyDock();
        }
      }
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const x = Math.max(0, Math.min(c.width - w, e.clientX - start.dx - c.left));
      const y = Math.max(0, Math.min(c.height - h, e.clientY - start.dy - c.top));
      app.uiSettings.shellAt = [c.width ? x / c.width : 0, c.height ? y / c.height : 0];
      applyDock();
      drop = e.clientY > c.bottom - EDGE ? 'bottom' : e.clientY < c.top + EDGE ? 'top' : 'float';
      zone.hidden = drop === 'float';
      zone.dataset.edge = drop;
    });
    const end = (e: PointerEvent) => {
      if (!start) return;
      start = null;
      if (grip.hasPointerCapture(e.pointerId)) grip.releasePointerCapture(e.pointerId);
      zone.hidden = true;
      app.appEl.classList.remove('ss-dragging');
      if (!dragging) {
        input.focus();
        return;
      }
      dragging = false;
      setDock(drop);
    };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    grip.addEventListener('dblclick', () => setDock('bottom'));
  }
  installDrag();

  // ---------- Menyerna ----------

  function dockItems(): MenuItem[] {
    const d = app.uiSettings.shellDock;
    return [
      { label: 'Dockad nere', checked: d === 'bottom', run: () => setDock('bottom') },
      { label: 'Dockad uppe', checked: d === 'top', run: () => setDock('top') },
      { label: 'Fritt över ritytan', checked: d === 'float', run: () => setDock('float') },
    ];
  }

  /**
   * De senaste kommandona för högerklicksmenyn (0.8.21). Med något markerat
   * de som gäller det markerade, annars de andra.
   */
  function recentItems(forSelection: boolean): MenuItem[] {
    const cmds = recent((c) => (forSelection ? !!c.rail : !c.rail));
    if (!cmds.length) return [];
    return [
      { kind: 'header', label: 'Senaste kommandon' },
      ...cmds.map((c, i): MenuItem => ({ label: c.label, hint: i === 0 && c === last ? 'Mellanslag' : undefined, run: () => run(c) })),
      { kind: 'sep' },
    ];
  }

  /** Högerklick medan något pågår: alternativen i frågan, Enter och Avbryt, som i AutoCAD. */
  function promptItems(): MenuItem[] | null {
    if (!shown() || !busy()) return null;
    const p = currentPrompt(app, pending, runPending);
    return [
      ...(p ? [{ kind: 'header', label: p.head } as MenuItem] : []),
      // Enter avslutar; finns Avsluta eller Klar bland alternativen räcker de.
      ...(app.modifier.busy || p?.options.some((o) => o.label === 'Avsluta' || o.label === 'Klar') ? [] : [{ label: 'Enter', run: () => enterInTool() } as MenuItem]),
      ...(p?.options.map((o): MenuItem => ({ label: o.label, hint: o.key, checked: o.on, run: () => runOption(o) })) ?? []),
      { kind: 'sep' },
      { label: 'Avbryt', hint: 'Esc', run: () => (cancelPending() || app.cancelCommand(), refresh()) },
    ];
  }

  function shellMenu(x: number, y: number): void {
    app.ctxMenu.open(
      x,
      y,
      [
        ...recentItems(app.selection.size > 0),
        { label: 'Historik', hint: 'F2', checked: logOpen, run: () => toggleLog() },
        { label: 'Alla kommandon', run: () => openAll() },
        { kind: 'sep' },
        ...dockItems(),
      ],
      'Smartshell',
    );
  }

  // ---------- Händelser ----------

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
        renderLog();
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
        } else if (typed.length) {
          typedAt = Math.max(-1, Math.min(typed.length - 1, typedAt - step));
          input.value = typedAt < 0 ? '' : typed[typedAt];
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
          if (!cancelPending() && (busy() || app.ui.tool !== 'select')) app.cancelCommand();
          refresh();
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
  // Ett klick på ett alternativ ska inte ta fokus från fältet eller ritningen.
  hintEl.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).closest('[data-opt]')) e.preventDefault();
  });
  hintEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-opt]');
    const o = b && prompt ? prompt.options[Number(b.dataset.opt)] : undefined;
    if (o) runOption(o);
  });
  logEl.addEventListener('mousedown', (e) => e.preventDefault());
  logEl.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('[data-log]');
    const c = li ? log[Number(li.dataset.log)]?.cmd : undefined;
    if (c) run(c);
  });
  for (const b of el.querySelectorAll<HTMLElement>('.ss-btn')) b.addEventListener('mousedown', (e) => e.preventDefault());
  el.querySelector('[data-ss="help"]')!.addEventListener('click', () => (showAll && !listEl.hidden ? clear() : openAll()));
  el.querySelector('[data-ss="log"]')!.addEventListener('click', () => toggleLog());
  el.querySelector('[data-ss="dock"]')!.addEventListener('click', (e) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    app.ctxMenu.open(r.left, app.uiSettings.shellDock === 'top' ? r.bottom + 4 : r.top - 4, dockItems(), 'Var smartshell ligger');
  });
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    shellMenu(e.clientX, e.clientY);
  });
  // F2 visar och döljer historiken, också när man skriver i ett fält.
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'F2' || !shown() || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    toggleLog();
  });
  window.addEventListener('resize', () => applyDock());
  app.selection.subscribe(() => renderHint());
  app.modifier.subscribe(() => refresh());
  app.store.subscribe(() => {
    if (prompt?.options.length) renderHint();
  });

  /** Modifiera väntar på en punkt (baspunkten) och inte på värdet: siffrorna ska då till raden. */
  function wantsPoint(): boolean {
    const t = app.modifier.runningTool;
    return t instanceof ModifyTool && t.takesPoints && t.prompt() !== null;
  }

  /**
   * Om en bokstav på tangentbordet är början på ett alternativ i frågan
   * medan något pågår (S för Stäng i väggen): då går den till raden i
   * stället för att vara ett kortkommando, som i AutoCAD.
   */
  function optionLetter(k: string): boolean {
    if (!shown() || k.length !== 1 || !/\p{L}/u.test(k) || !busy()) return false;
    const p = currentPrompt(app, pending, runPending);
    return !!p?.options.some((o) => o.key.toLowerCase().startsWith(k.toLowerCase()));
  }

  /** Öppna raden (Enter utan kommando igång), med en första bokstav eller siffra. */
  function open(first = ''): boolean {
    if (!shown()) return false;
    input.focus();
    if (first) {
      input.value = first;
      update();
    }
    return true;
  }

  return {
    el,
    input,
    get last() {
      return last;
    },
    get pending() {
      return pending;
    },
    get logOpen() {
      return logOpen;
    },
    busy,
    taker,
    refresh,
    /** Ett kommando från en knapp eller ett kortkommando; det som körs från raden har redan räknats. */
    remember: (c: CommandDef | undefined) => {
      if (!running) remember(c);
    },
    toolChosen,
    run,
    repeat,
    key,
    optionLetter,
    wantsPoint,
    cancelPending,
    recentItems,
    promptItems,
    toggleLog,
    setDock,
    open,
    get shown() {
      return shown();
    },
  };
}

export type CommandLine = ReturnType<typeof installCommandLine>;
