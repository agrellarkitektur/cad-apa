import { eraseSelection } from './erase';
import { commandFor, findCommand, type CommandDef } from '../commandRegistry';
import { icons } from '../icons';
import { escapeHtml } from '../labels';
import { OPS, type RailId } from '../modify/ops';
import { looksLikePoint, parsePoint, type PointTaker } from '../pointInput';
import { isNarrow } from '../sheet';
import type { AppContext } from './context';
import { currentPrompt, matchOption, type Prompt, type PromptOption } from './prompts';
import type { ToolId } from './shell';
import { runAction } from './shellActions';
import { installShellDock } from './shellDock';
import { nf, POINT_HELP, promptMarkup, xy } from './shellHint';
import { createShellList } from './shellList';
import { createShellLog } from './shellLog';
import { createShellMenus } from './shellMenus';
import { commandBusy, pointFor as pointOf, pointTaker, wantsPoint as modifierWantsPoint } from './shellPoints';

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
 *
 * Delarna (0.8.23): läget i shellPoints.ts, historiken i shellLog.ts, var
 * raden ligger i shellDock.ts, frågans text i shellHint.ts och kommandona
 * som gör något direkt i shellActions.ts; listan med kommandon i
 * shellList.ts och menyerna i shellMenus.ts (0.10.22.1).
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

  let last: CommandDef | null = null;
  /** Det som skrivits tidigare, för pil upp och ned. */
  const typed: string[] = [];
  let typedAt = -1;
  /** Allt som hänt, för historiken (F2) och högerklicket. */
  const log = createShellLog(el, logEl, listEl, (c) => run(c));
  /** Listan med kommandon: kompletteringen, pil upp och ned, Tab och alla kommandon. */
  const list = createShellList(input, listEl, {
    taken: (text) => isPoint(text) || !!(prompt && matchOption(prompt.options, text)),
    renderLog: () => log.render(),
    renderHint: () => renderHint(),
  });
  const { clear, openAll, update } = list;
  /** Medan ett kommando körs från raden ska setTool inte skriva över det som det senaste. */
  let running = false;
  /** Ett kommando för det markerade som väntar på att något markeras (Flytta utan markering). */
  let pending: CommandDef | null = null;
  /** Frågan som visas nu, så att ett klick på ett alternativ hittar rätt. */
  let prompt: Prompt | null = null;

  const shown = (): boolean => app.uiSettings.smartshell && !isNarrow();
  const dock = installShellDock(app, el, grip, input, shown);

  const taker = (): PointTaker | null => pointTaker(app, pending);
  const busy = (): boolean => commandBusy(app, pending);
  const addLog = log.add;

  // ---------- Historiken ----------

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
      else if (c.action) action(c);
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
    eraseSelection(app);
  }

  function action(c: CommandDef): void {
    runAction(app, c, { waitForSelection, erase, openAll });
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
    else if (app.ui.tool === 'ground') app.groundTool.finish();
    else if (app.ui.tool === 'stair') app.stairTool.finish();
    else if (app.ui.tool === 'railing') app.railingTool.finish();
    // Takets och bjälklagets kontur sluts med Enter (0.10.17).
    else if (app.ui.tool === 'roof') app.roofTool.closeContour();
    else if (app.ui.tool === 'slab') app.slabTool.closePolygon();
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

  /** Om det skrivna är en punkt till verktyget: det ser ut som en och är inget kommando (3d). */
  const isPoint = (text: string): boolean => !!taker() && looksLikePoint(text) && (parsePoint(text) !== null || !findCommand(text));

  const pointFor = (text: string) => pointOf(app, taker(), text);

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

  /**
   * Flytta i höjd (0.10.14): `M Z -500`, `FZ -500` och `MZ -500` med något
   * markerat, eller `Z -500` medan Flytta pågår. Svarar true om texten var
   * en sådan.
   */
  function enterMoveZ(text: string): boolean {
    const v = moveZValue(text, app.modifier.active === 'move');
    if (v === null) return false;
    if (!app.selection.size) {
      app.hint('Markera det som ska flyttas i höjd först.', 2500);
      return true;
    }
    if (app.modifier.moveZ(v)) addLog({ text: `Flytta i höjd ${nf.format(v)}`, kind: 'point' });
    else app.hint('Det markerade kan inte flyttas i höjd (väggar, bjälklag, möbler och tak kan det).', 3500);
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
    if (enterMoveZ(text)) {
      clear();
      refresh();
      return;
    }
    if (isPoint(text)) {
      enterPoint(text);
      clear();
      refresh();
      return;
    }
    const c = list.matches[list.picked]?.cmd ?? findCommand(text);
    if (!c) {
      app.hint(looksLikePoint(text) ? 'Välj ett ritverktyg först, t.ex. vägg eller linje.' : `Inget kommando heter ”${text}”. Skriv ? för alla.`, 3000);
      input.select();
      return;
    }
    clear();
    input.blur();
    run(c);
  }

  function renderHint(): void {
    const text = input.value.trim();
    const t = taker();
    prompt = shown() ? currentPrompt(app, pending, runPending) : null;
    let h = '';
    let bad = false;
    const opt = text && prompt ? matchOption(prompt.options, text) : null;
    if (list.showAll) h = 'Klicka på ett kommando, eller skriv namnet eller förkortningen. Esc stänger listan.';
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
      const m = list.matches[list.picked];
      if (m) h = `Enter: <b>${escapeHtml(m.cmd.label)}</b>${m.cmd.note ? ` (${escapeHtml(m.cmd.note)})` : ''}.${list.matches.length > 1 ? ' Pil upp och ned väljer, Tab fyller i.' : ''}`;
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
    dock.apply();
    if (!show) return;
    renderHint();
  }

  // ---------- Menyerna ----------

  const menus = createShellMenus({
    app,
    shown,
    busy,
    last: () => last,
    pending: () => pending,
    recent: log.recent,
    run,
    runPending,
    runOption,
    enterInTool,
    cancelPending,
    refresh,
    logOpen: () => log.open,
    toggleLog: log.toggle,
    openAll,
    dockItems: () => dock.items(),
  });

  // ---------- Händelser ----------

  input.addEventListener('input', update);
  input.addEventListener('focus', () => {
    if (!list.showAll) update();
    el.classList.add('active');
  });
  input.addEventListener('blur', () => {
    el.classList.remove('active');
    // Ett klick i listan ska hinna fram innan den stängs.
    setTimeout(() => {
      if (document.activeElement !== input) {
        list.close();
        renderHint();
      }
    }, 150);
  });
  input.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (list.showAll && list.picked < 0) return;
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
        if (list.open && list.fill()) e.preventDefault();
        break;
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        if (list.open) list.step(step);
        else if (typed.length) {
          typedAt = Math.max(-1, Math.min(typed.length - 1, typedAt - step));
          input.value = typedAt < 0 ? '' : typed[typedAt];
          update();
        }
        break;
      }
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        if (input.value || list.showAll) clear();
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
    const m = li ? list.matches[Number(li.dataset.i)] : undefined;
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
  for (const b of el.querySelectorAll<HTMLElement>('.ss-btn')) b.addEventListener('mousedown', (e) => e.preventDefault());
  el.querySelector('[data-ss="help"]')!.addEventListener('click', () => (list.showAll && list.open ? clear() : openAll()));
  el.querySelector('[data-ss="log"]')!.addEventListener('click', () => log.toggle());
  el.querySelector('[data-ss="dock"]')!.addEventListener('click', (e) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    app.ctxMenu.open(r.left, app.uiSettings.shellDock === 'top' ? r.bottom + 4 : r.top - 4, dock.items(), 'Var smartshell ligger');
  });
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    menus.shellMenu(e.clientX, e.clientY);
  });
  // F2 visar och döljer historiken, också när man skriver i ett fält.
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'F2' || !shown() || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    log.toggle();
  });
  window.addEventListener('resize', () => dock.apply());
  app.selection.subscribe(() => renderHint());
  app.modifier.subscribe(() => refresh());
  app.store.subscribe(() => {
    if (prompt?.options.length) renderHint();
  });

  /** Modifiera väntar på en punkt (baspunkten) och inte på värdet: siffrorna ska då till raden. */
  const wantsPoint = (): boolean => modifierWantsPoint(app);

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
      return log.open;
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
    recentItems: menus.recentItems,
    promptItems: menus.promptItems,
    toggleLog: log.toggle,
    setDock: dock.set,
    open,
    get shown() {
      return shown();
    },
  };
}

export type CommandLine = ReturnType<typeof installCommandLine>;

/**
 * Värdet i `M Z -500`, `FZ -500`, `MZ -500` (eller `Flytta Z -500`), och
 * `Z -500` när Flytta pågår (`moving`); null annars (0.10.14).
 */
export function moveZValue(text: string, moving: boolean): number | null {
  const m = /^(?:(?:m|move|fl|flytta)\s+z|fz|mz|(z))\s*([-+−]?\s*\d+(?:[.,]\d+)?)$/i.exec(text.trim());
  if (!m || (m[1] && !moving)) return null;
  const v = Number(m[2].replace(/\s/g, '').replace('−', '-').replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}
