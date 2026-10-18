/** Smal skärm: panelen ligger som ett blad nederst i stället för vid sidan. */
export function isNarrow(): boolean {
  return window.innerWidth <= 960;
}

type SheetState = 'peek' | 'full';

/**
 * Gör egenskapsbladet dragbart på mobilen, som ett mejlutkast i iPhone:
 * greppet och snabbraden kan dras upp till hela bladet och ned till bara
 * snabbraden, och vidare ned för att stänga. Ett tryck på greppet växlar.
 */
export function setupSheetDrag(
  sheet: HTMLElement,
  ctl: { narrow: () => boolean; state: () => SheetState; set: (open: boolean, state: SheetState) => void },
): void {
  let drag: { id: number; y0: number; h0: number; peekH: number; fullH: number; moved: boolean } | null = null;

  const handleOf = (t: EventTarget | null) => (t as HTMLElement | null)?.closest('.sheet-grip, .qb-title');

  sheet.addEventListener('pointerdown', (e) => {
    if (!ctl.narrow() || !handleOf(e.target)) return;
    const h0 = sheet.offsetHeight;
    const parent = sheet.closest('.app')?.querySelector<HTMLElement>('.canvas') ?? sheet.parentElement!;
    const fullH = Math.round(parent.clientHeight * 0.7);
    drag = { id: e.pointerId, y0: e.clientY, h0, peekH: ctl.state() === 'peek' ? h0 : peekHeight(sheet), fullH, moved: false };
    sheet.setPointerCapture(e.pointerId);
  });

  sheet.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moved && Math.abs(dy) < 6) return;
    drag.moved = true;
    sheet.classList.add('dragging');
    sheet.style.height = `${Math.max(24, Math.min(drag.fullH, drag.h0 - dy))}px`;
  });

  const end = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    sheet.classList.remove('dragging');
    const h = sheet.offsetHeight;
    sheet.style.height = '';
    if (!d.moved) {
      // Ett tryck på greppet växlar mellan nere och uppe.
      if ((e.target as HTMLElement).closest('.sheet-grip')) ctl.set(true, ctl.state() === 'full' ? 'peek' : 'full');
      return;
    }
    if (h > (d.peekH + d.fullH) / 2) ctl.set(true, 'full');
    else if (h < d.peekH * 0.6) ctl.set(false, 'peek');
    else ctl.set(true, 'peek');
  };
  sheet.addEventListener('pointerup', end);
  sheet.addEventListener('pointercancel', end);

  sheet.querySelector('.sheet-grip')?.addEventListener('keydown', (e) => {
    const k = (e as KeyboardEvent).key;
    if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      ctl.set(true, ctl.state() === 'full' ? 'peek' : 'full');
    }
  });
}

/** Höjden på bladet när bara greppet och snabbraden syns. */
function peekHeight(sheet: HTMLElement): number {
  const grip = sheet.querySelector<HTMLElement>('.sheet-grip')?.offsetHeight ?? 0;
  const quick = sheet.querySelector<HTMLElement>('.quick-bar')?.offsetHeight ?? 0;
  return grip + quick;
}
