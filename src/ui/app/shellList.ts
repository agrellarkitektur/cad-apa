import { COMMANDS, complete, type Match } from '../commandRegistry';
import { escapeHtml } from '../labels';

/**
 * Smartshells lista med kommandon (0.8.20; ur commandLine.ts i 0.10.22.1):
 * det skrivna kompletteras medan man skriver, pil upp och ned väljer, Tab
 * fyller i, ? eller knappen Kommandon visar alla i grupper. Listan är
 * öppen bara medan fältet har fokus; historiken ritas om när den öppnas
 * och stängs, eftersom de delar plats.
 */
export function createShellList(
  input: HTMLInputElement,
  listEl: HTMLUListElement,
  hooks: {
    /** Det skrivna är en punkt eller ett alternativ i frågan: då kompletteras inget. */
    taken: (text: string) => boolean;
    /** Historiken, som ritas om när listan öppnas eller stängs. */
    renderLog: () => void;
    /** Raden under fältet, som följer det valda. */
    renderHint: () => void;
  },
) {
  let matches: Match[] = [];
  let picked = 0;
  /** Alla kommandon visas (Kommandon, ? eller hjälp). */
  let showAll = false;

  function clear(): void {
    input.value = '';
    showAll = false;
    matches = [];
    picked = 0;
    render();
    hooks.renderHint();
  }

  function openAll(): void {
    input.focus();
    showAll = true;
    matches = COMMANDS.map((cmd) => ({ cmd, name: cmd.sv[0], exact: false }));
    picked = -1;
    render();
    hooks.renderHint();
  }

  /** Det skrivna ändrades. */
  function update(): void {
    const text = input.value;
    showAll = false;
    if (!text.trim() || hooks.taken(text)) matches = [];
    else if (text.trim() === '?') {
      openAll();
      return;
    } else matches = complete(text);
    picked = 0;
    render();
    hooks.renderHint();
  }

  function render(): void {
    const open = matches.length > 0 && (showAll || !(matches.length === 1 && matches[0].exact)) && document.activeElement === input;
    listEl.hidden = !open;
    input.setAttribute('aria-expanded', String(open));
    hooks.renderLog();
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

  /** Fältet tappade fokus: listan stängs. */
  function close(): void {
    showAll = false;
    listEl.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    hooks.renderLog();
  }

  /** Pil upp eller ned i den öppna listan. */
  function step(by: 1 | -1): void {
    picked = (Math.max(-1, picked) + by + matches.length) % matches.length;
    render();
    hooks.renderHint();
  }

  /** Tab: det valda kommandots namn i fältet. Svarar false om listan är stängd eller tom. */
  function fill(): boolean {
    const m = matches[Math.max(0, picked)];
    if (listEl.hidden || !m) return false;
    input.value = m.name.toUpperCase();
    update();
    return true;
  }

  return {
    get matches() {
      return matches;
    },
    get picked() {
      return picked;
    },
    get showAll() {
      return showAll;
    },
    get open() {
      return !listEl.hidden;
    },
    clear,
    openAll,
    update,
    render,
    close,
    step,
    fill,
  };
}
