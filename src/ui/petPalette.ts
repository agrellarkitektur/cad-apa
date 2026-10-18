import type { PropertiesPanel } from './propertiesPanel';

/**
 * Snabbmenyn vid markören (som "pet palette" i ArchiCAD): när något
 * markeras med musen visas de vanligaste åtgärderna intill, så att man inte
 * behöver föra musen bort till panelen. "Mer" öppnar hela panelen.
 */
export class PetPalette {
  readonly el: HTMLElement;
  private container: HTMLElement;
  private panel: PropertiesPanel;
  private at: { x: number; y: number } | null = null;

  constructor(container: HTMLElement, panel: PropertiesPanel) {
    this.container = container;
    this.panel = panel;
    this.el = document.createElement('div');
    this.el.className = 'pet-palette quick-bar';
    this.el.hidden = true;
    // Klick i paletten ska inte nå planen under den.
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.addEventListener('click', (e) => this.panel.handleClick(e));
    container.appendChild(this.el);
  }

  get visible(): boolean {
    return !this.el.hidden;
  }

  /** Visa vid en punkt i fönstret (clientX/Y). */
  show(clientX: number, clientY: number): void {
    this.at = { x: clientX, y: clientY };
    this.refresh();
  }

  hide(): void {
    this.at = null;
    this.el.hidden = true;
  }

  /** Rita om innehållet, t.ex. när markeringen eller modellen ändrats. */
  refresh(): void {
    if (!this.at) return;
    const html = this.panel.quickMarkup(true);
    if (!html) {
      this.hide();
      return;
    }
    this.el.innerHTML = html;
    this.el.hidden = false;
    // Intill markören, men inom ritytan.
    const r = this.container.getBoundingClientRect();
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    let x = this.at.x - r.left + 18;
    let y = this.at.y - r.top + 18;
    if (x + w > r.width - 8) x = Math.max(8, this.at.x - r.left - w - 18);
    if (y + h > r.height - 8) y = Math.max(8, this.at.y - r.top - h - 18);
    this.el.style.left = `${Math.round(x)}px`;
    this.el.style.top = `${Math.round(y)}px`;
  }
}
