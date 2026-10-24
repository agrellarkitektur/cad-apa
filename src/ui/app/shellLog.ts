import type { CommandDef } from '../commandRegistry';
import { escapeHtml } from '../labels';

/** Hur många rader historiken (F2) sparar, och hur många kommandon högerklicket visar. */
const LOG_MAX = 200;
const RECENT_MAX = 6;

export interface LogLine {
  text: string;
  /** Kommandot på raden, så att ett klick kan köra det igen. */
  cmd?: CommandDef;
  kind: 'cmd' | 'point' | 'option' | 'note';
}

/**
 * Smartshells historik (0.8.21; ur commandLine.ts i 0.8.23): kommandon,
 * punkter och val, högst 200 rader, i rutan som F2 visar. Ett klick på ett
 * kommando kör det igen. `recent` ger de senaste kommandona till
 * högerklicksmenyn. Rutan döljs medan listan med kommandon är öppen.
 */
export function createShellLog(el: HTMLElement, logEl: HTMLOListElement, listEl: HTMLElement, run: (c: CommandDef) => void) {
  const log: LogLine[] = [];
  let open = false;

  function add(line: LogLine): void {
    log.push(line);
    if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
    if (open) render();
  }

  function render(): void {
    logEl.hidden = !open || !listEl.hidden;
    el.querySelector('[data-ss="log"]')!.setAttribute('aria-pressed', String(open));
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

  function toggle(on = !open): void {
    open = on;
    render();
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

  logEl.addEventListener('mousedown', (e) => e.preventDefault());
  logEl.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('[data-log]');
    const c = li ? log[Number(li.dataset.log)]?.cmd : undefined;
    if (c) run(c);
  });

  return {
    add,
    render,
    toggle,
    recent,
    get open() {
      return open;
    },
  };
}
