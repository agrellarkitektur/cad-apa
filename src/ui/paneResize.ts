/**
 * Dragstrecket i vänsterkanten på navigatorn och egenskaperna på datorn.
 * Dra för att ändra bredden, klicka för att fälla ihop. Med tangentbordet:
 * pil vänster och höger ändrar bredden, Enter fäller ihop.
 */
export interface PaneResizeOptions {
  label: string;
  width(): number;
  setWidth(w: number): void;
  /** Bredden är klar (efter ett drag eller en piltangent): spara den. */
  commit(): void;
  collapse(): void;
  min: number;
  max: () => number;
}

export function clampWidth(w: number, min: number, max: number): number {
  return Math.round(Math.max(min, Math.min(Math.max(min, max), w)));
}

export function setupPaneResize(pane: HTMLElement, o: PaneResizeOptions): HTMLElement {
  const grip = document.createElement('div');
  grip.className = 'pane-resize';
  grip.setAttribute('role', 'separator');
  grip.setAttribute('aria-orientation', 'vertical');
  grip.tabIndex = 0;
  grip.title = `${o.label}: dra för att ändra bredden, klicka för att fälla ihop`;
  grip.setAttribute('aria-label', grip.title);
  pane.prepend(grip);

  let drag: { id: number; x0: number; w0: number; moved: boolean } | null = null;

  grip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    drag = { id: e.pointerId, x0: e.clientX, w0: o.width(), moved: false };
    grip.setPointerCapture(e.pointerId);
  });
  grip.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0;
    if (!drag.moved && Math.abs(dx) < 4) return;
    if (!drag.moved) {
      drag.moved = true;
      document.body.classList.add('resizing-pane');
      grip.classList.add('active');
    }
    // Strecket sitter i vänsterkanten: åt vänster blir panelen bredare.
    o.setWidth(clampWidth(drag.w0 - dx, o.min, o.max()));
  });
  const end = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const moved = drag.moved;
    drag = null;
    document.body.classList.remove('resizing-pane');
    grip.classList.remove('active');
    if (moved) o.commit();
    else if (e.type === 'pointerup') o.collapse();
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);

  grip.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const step = e.shiftKey ? 60 : 20;
      o.setWidth(clampWidth(o.width() + (e.key === 'ArrowLeft' ? step : -step), o.min, o.max()));
      o.commit();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      o.collapse();
    }
  });
  return grip;
}
