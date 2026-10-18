import { icons } from './icons';
import type { PropertiesPanel } from './propertiesPanel';

/**
 * Snabbmenyn vid markören (som "pet palette" i ArchiCAD): när något
 * markeras med musen visas de vanligaste åtgärderna intill, så att man inte
 * behöver föra musen bort till panelen.
 *
 * - Greppet till vänster flyttar menyn. En flyttad meny stannar där tills
 *   man dubbelklickar på greppet, då följer den markören igen.
 * - Mer fäller ut menyn med alla inställningar för det markerade, i samma
 *   kompakta form, så att egenskapspanelen kan vara minimerad eller stängd.
 */
export class PetPalette {
  readonly el: HTMLElement;
  private container: HTMLElement;
  private panel: PropertiesPanel;
  private at: { x: number; y: number } | null = null;
  /** Var menyn lagts när den flyttats (i ritytan), annars null. */
  private pinned: { x: number; y: number } | null = null;
  private drag: { id: number; dx: number; dy: number } | null = null;
  expanded = false;

  constructor(container: HTMLElement, panel: PropertiesPanel) {
    this.container = container;
    this.panel = panel;
    this.el = document.createElement('div');
    this.el.className = 'pet-palette';
    this.el.hidden = true;
    // Klick i paletten ska inte nå planen under den.
    this.el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const grip = (e.target as HTMLElement).closest('.pp-grip');
      if (grip && e.button === 0) {
        e.preventDefault();
        const r = this.el.getBoundingClientRect();
        this.drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
        (grip as HTMLElement).setPointerCapture(e.pointerId);
        this.el.classList.add('dragging');
      }
    });
    this.el.addEventListener('pointermove', (e) => {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      const c = this.container.getBoundingClientRect();
      this.pinned = { x: e.clientX - c.left - this.drag.dx, y: e.clientY - c.top - this.drag.dy };
      this.place();
    });
    const end = (e: PointerEvent) => {
      if (!this.drag || e.pointerId !== this.drag.id) return;
      this.drag = null;
      this.el.classList.remove('dragging');
    };
    this.el.addEventListener('pointerup', end);
    this.el.addEventListener('pointercancel', end);
    this.el.addEventListener('dblclick', (e) => {
      if ((e.target as HTMLElement).closest('.pp-grip')) {
        this.pinned = null;
        this.refresh();
      }
    });
    this.el.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
      if (a === 'palette-more' || a === 'palette-less') {
        this.expanded = a === 'palette-more';
        this.refresh();
        return;
      }
      this.panel.handleClick(e);
    });
    this.el.addEventListener('change', (e) => this.panel.handleChange(e));
    container.appendChild(this.el);
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  /** Visa vid en punkt i fönstret (clientX/Y). */
  show(clientX: number, clientY: number, expanded = false): void {
    this.at = { x: clientX, y: clientY };
    if (expanded) this.expanded = true;
    this.refresh();
  }

  hide(): void {
    this.at = null;
    this.expanded = false;
    this.el.hidden = true;
  }

  /** Rita om innehållet, t.ex. när markeringen eller modellen ändrats. */
  refresh(): void {
    if (!this.at) return;
    const quick = this.panel.quickMarkup(this.expanded ? 'less' : true);
    if (!quick) {
      this.hide();
      return;
    }
    // Rör inte ett fält som någon skriver i.
    if (this.el.contains(document.activeElement) && (document.activeElement as HTMLElement).matches('input, select, textarea')) return;
    const grip = `<button type="button" class="pp-grip" aria-label="Flytta snabbmenyn" title="Dra för att flytta${this.pinned ? ', dubbelklicka för att följa markören igen' : ''}">${icons.grip}</button>`;
    const body = this.expanded ? this.panel.selectionMarkup() : null;
    const scroll = this.el.querySelector('.pp-body')?.scrollTop ?? 0;
    this.el.classList.toggle('expanded', this.expanded);
    this.el.classList.toggle('pinned', !!this.pinned);
    this.el.innerHTML =
      `<div class="pp-top quick-bar">${grip}${quick}</div>` +
      (body
        ? `<div class="pp-body compact">${body}<div class="pp-foot"><button type="button" class="btn" data-action="open-panel">Visa i egenskapspanelen</button></div></div>`
        : '');
    const b = this.el.querySelector('.pp-body');
    if (b) b.scrollTop = scroll;
    this.el.hidden = false;
    this.place();
  }

  /** Intill markören eller där menyn lagts, men alltid inom ritytan. */
  private place(): void {
    const r = this.container.getBoundingClientRect();
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    let x: number;
    let y: number;
    if (this.pinned) {
      x = this.pinned.x;
      y = this.pinned.y;
    } else if (this.at) {
      x = this.at.x - r.left + 18;
      y = this.at.y - r.top + 18;
      if (x + w > r.width - 8) x = this.at.x - r.left - w - 18;
      if (y + h > r.height - 8) y = this.at.y - r.top - h - 18;
    } else return;
    x = Math.max(8, Math.min(x, r.width - w - 8));
    y = Math.max(8, Math.min(y, r.height - h - 8));
    this.el.style.left = `${Math.round(x)}px`;
    this.el.style.top = `${Math.round(y)}px`;
  }
}
