import type { MenuItem } from '../contextMenu';
import { saveUiSettings, type ShellDock } from '../uiSettings';
import type { AppContext } from './context';

/** Släppt så här nära ritytans över- eller underkant (px) dockas raden där. */
const EDGE = 48;

/**
 * Var smartshell ligger (0.8.21; ur commandLine.ts i 0.8.23): dockad nere
 * eller uppe, eller fritt över ritytan. Blixten dras; släppt nära ritytans
 * över- eller underkant dockas raden där, och dubbelklick dockar den nere.
 * Läget sparas i `UiSettings.shellDock` och `shellAt` (andel av ritytan).
 */
export function installShellDock(app: AppContext, el: HTMLElement, grip: HTMLElement, input: HTMLInputElement, shown: () => boolean) {
  const canvas = app.$<HTMLElement>('.canvas');

  function apply(): void {
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

  function set(dock: ShellDock, at?: [number, number]): void {
    app.uiSettings.shellDock = dock;
    if (at) app.uiSettings.shellAt = at;
    saveUiSettings(app.uiSettings);
    apply();
    // Ritytan ändrar storlek när raden flyttas mellan nere och uppe.
    window.dispatchEvent(new Event('resize'));
  }

  // Dra i blixten: raden följer med; släppt nära ritytans över- eller underkant dockas den där.
  let start: { x: number; y: number; dx: number; dy: number } | null = null;
  let dragging = false;
  let drop: ShellDock = 'float';
  const zone = document.createElement('div');
  zone.className = 'ss-dropzone';
  zone.hidden = true;
  canvas.appendChild(zone);

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
        apply();
      }
    }
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const x = Math.max(0, Math.min(c.width - w, e.clientX - start.dx - c.left));
    const y = Math.max(0, Math.min(c.height - h, e.clientY - start.dy - c.top));
    app.uiSettings.shellAt = [c.width ? x / c.width : 0, c.height ? y / c.height : 0];
    apply();
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
    set(drop);
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
  grip.addEventListener('dblclick', () => set('bottom'));

  /** Valen för var raden ligger, i menyerna. */
  function items(): MenuItem[] {
    const d = app.uiSettings.shellDock;
    return [
      { label: 'Dockad nere', checked: d === 'bottom', run: () => set('bottom') },
      { label: 'Dockad uppe', checked: d === 'top', run: () => set('top') },
      { label: 'Fritt över ritytan', checked: d === 'float', run: () => set('float') },
    ];
  }

  return { apply, set, items };
}
