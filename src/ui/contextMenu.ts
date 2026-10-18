import { escapeHtml } from './labels';

/** En rad i en kontextmeny. */
export type MenuItem =
  | { kind?: 'item'; label: string; run: () => void; sub?: string; hint?: string; checked?: boolean; disabled?: boolean; danger?: boolean }
  | { kind: 'sep' }
  | { kind: 'header'; label: string; sub?: string }
  /** Fri markup, t.ex. snabbknapparna. Klick i den sköts av `onClick`. */
  | { kind: 'html'; html: string; onClick: (e: MouseEvent) => void };

/**
 * Menyn vid högerklick (och långt tryck på telefonen). En enda meny i taget;
 * den stängs med Esc, ett klick utanför eller när ett val görs. Menyn hålls
 * inom fönstret.
 */
export class ContextMenu {
  readonly el: HTMLElement;
  private items: MenuItem[] = [];

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'ctx-menu';
    this.el.setAttribute('role', 'menu');
    this.el.hidden = true;
    document.body.appendChild(this.el);
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const row = t.closest<HTMLElement>('[data-i]');
      if (row) {
        const item = this.items[Number(row.dataset.i)];
        if (item && (item.kind === undefined || item.kind === 'item') && !item.disabled) {
          this.close();
          item.run();
        }
        return;
      }
      const html = t.closest<HTMLElement>('[data-html]');
      if (html) {
        const item = this.items[Number(html.dataset.html)];
        if (item?.kind === 'html') {
          item.onClick(e);
          this.close();
        }
      }
    });
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.el.hidden && !this.el.contains(e.target as Node)) this.close();
      },
      true,
    );
    window.addEventListener('keydown', (e) => {
      if (!this.el.hidden && e.key === 'Escape') {
        e.stopImmediatePropagation();
        this.close();
      }
    });
    window.addEventListener('blur', () => this.close());
  }

  get isOpen(): boolean {
    return !this.el.hidden;
  }

  open(x: number, y: number, items: MenuItem[], label = 'Meny'): void {
    this.items = items;
    this.el.setAttribute('aria-label', label);
    this.el.innerHTML = items
      .map((it, i) => {
        if (it.kind === 'sep') return '<hr>';
        if (it.kind === 'header')
          return `<div class="ctx-head"><b>${escapeHtml(it.label)}</b>${it.sub ? `<small>${escapeHtml(it.sub)}</small>` : ''}</div>`;
        if (it.kind === 'html') return `<div class="ctx-html" data-html="${i}">${it.html}</div>`;
        const role = it.checked === undefined ? 'menuitem' : 'menuitemcheckbox';
        const check = it.checked === undefined ? '' : `<span class="ctx-check${it.checked ? ' on' : ''}" aria-hidden="true"></span>`;
        return `<button type="button" role="${role}"${it.checked !== undefined ? ` aria-checked="${it.checked}"` : ''} data-i="${i}" class="${it.danger ? 'danger' : ''}"${it.disabled ? ' aria-disabled="true"' : ''}>${check}<span class="ctx-label">${escapeHtml(it.label)}${it.sub ? `<small>${escapeHtml(it.sub)}</small>` : ''}</span>${it.hint ? `<kbd>${escapeHtml(it.hint)}</kbd>` : ''}</button>`;
      })
      .join('');
    this.el.hidden = false;
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = x + w + 8 > vw ? Math.max(8, x - w) : x;
    const top = y + h + 8 > vh ? Math.max(8, vh - h - 8) : y;
    this.el.style.left = `${Math.round(left)}px`;
    this.el.style.top = `${Math.round(top)}px`;
    this.el.querySelector<HTMLElement>('button:not([aria-disabled])')?.focus({ preventScroll: true });
  }

  close(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.items = [];
  }
}

/**
 * Långt tryck på pekskärm: anropar `fire` om fingret ligger still i en halv
 * sekund. Svarar med en funktion som säger om trycket just utlöstes, så att
 * det vanliga trycket kan hoppas över.
 */
export function onLongPress(el: HTMLElement, fire: (x: number, y: number, target: EventTarget | null) => void, ms = 500, mouseToo = false): () => boolean {
  let timer = 0;
  let start: { x: number; y: number; id: number } | null = null;
  let fired = false;
  const cancel = () => {
    clearTimeout(timer);
    start = null;
  };
  el.addEventListener(
    'pointerdown',
    (e) => {
      fired = false;
      // Ett andra finger är nypzoom, inte ett långt tryck.
      if (start) return cancel();
      if (e.pointerType === 'mouse' && (!mouseToo || e.button !== 0)) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      const target = e.target;
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!start) return;
        fired = true;
        fire(start.x, start.y, target);
        start = null;
      }, ms);
    },
    { capture: true },
  );
  el.addEventListener(
    'pointermove',
    (e) => {
      if (start && e.pointerId === start.id && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) cancel();
    },
    { capture: true },
  );
  el.addEventListener('pointerup', cancel, { capture: true });
  el.addEventListener('pointercancel', cancel, { capture: true });
  return () => {
    const f = fired;
    fired = false;
    return f;
  };
}
