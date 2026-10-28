import type { Camera } from './camera';
import type { Vec2 } from '../repr/primitives';
import type { ViewPointer, ViewTool } from './planView';

/** Så långt (px) pekaren får röra sig innan ett klick räknas som ett drag. */
const CLICK_SLOP = 5;

/** Det pekaren behöver av planvyn. */
export interface PlanInputHost {
  readonly svg: SVGSVGElement;
  readonly camera: Camera;
  readonly currentTool: ViewTool | null;
  events: { onCursor?: (p: Vec2 | null) => void };
  local(e: PointerEvent | WheelEvent | MouseEvent): Vec2;
  pointer(e: PointerEvent, screen: Vec2): ViewPointer;
  /** Kameran har ändrats: rita om och säg till. */
  changed(): void;
  requestRender(): void;
  zoomToFit(): void;
}

/**
 * Pekaren i planvyn (ur planView.ts i 0.10.22.1): mus, penna och fingrar
 * till verktyget, panorering med mittenknappen, mellanslag + dra eller ett
 * finger, nypning med två fingrar och hjulet som zoomar kring pekaren.
 * Dubbelklick med mittenknappen zoomar till allt, som i AutoCAD.
 */
export function bindPlanInput(view: PlanInputHost): { updateCursor: () => void } {
  /** Fingrar och knappar som är nedtryckta just nu. */
  const pointers = new Map<number, { pos: Vec2; start: Vec2; mode: 'capture' | 'pan' | 'pinch'; pinched?: boolean }>();
  let lastMiddleDown = 0;
  let spaceDown = false;

  const updateCursor = (): void => {
    const panning = [...pointers.values()].some((p) => p.mode === 'pan');
    view.svg.style.cursor = panning ? 'grabbing' : spaceDown ? 'grab' : (view.currentTool?.cursor ?? 'grab');
  };
  const svg = view.svg;
  const camera = view.camera;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
      if (!spaceDown) {
        spaceDown = true;
        updateCursor();
      }
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      spaceDown = false;
      updateCursor();
    }
  });

  svg.addEventListener('pointerdown', (e) => {
    const screen = view.local(e);
    if (e.pointerType === 'mouse' && e.button === 1) {
      e.preventDefault();
      const now = performance.now();
      // Dubbelklick med mittenknappen: zooma till allt, som i AutoCAD.
      if (now - lastMiddleDown < 350) {
        view.zoomToFit();
        lastMiddleDown = 0;
        return;
      }
      lastMiddleDown = now;
    }
    if (e.pointerType === 'mouse' && e.button > 1) return;
    svg.setPointerCapture(e.pointerId);

    // Ett andra finger: avbryt verktygets gest och nyp-zooma i stället.
    if (e.pointerType === 'touch' && pointers.size >= 1) {
      for (const p of pointers.values()) {
        if (p.mode === 'capture') view.currentTool?.cancel?.();
        p.mode = 'pinch';
        p.pinched = true;
      }
      pointers.set(e.pointerId, { pos: screen, start: screen, mode: 'pinch', pinched: true });
      return;
    }

    let mode: 'capture' | 'pan' = 'pan';
    const primary = !(e.pointerType === 'mouse' && e.button === 1) && !spaceDown;
    if (primary && view.currentTool) {
      const answer = view.currentTool.down(view.pointer(e, screen));
      if (answer === 'ignore') return;
      mode = answer;
    }
    pointers.set(e.pointerId, { pos: screen, start: screen, mode });
    updateCursor();
  });

  svg.addEventListener('pointermove', (e) => {
    const screen = view.local(e);
    if (e.pointerType !== 'touch') view.events.onCursor?.(camera.toModel(screen));
    const cur = pointers.get(e.pointerId);

    if (!cur) {
      if (e.pointerType !== 'touch') {
        view.currentTool?.hover?.(view.pointer(e, screen));
        view.requestRender();
      }
      return;
    }

    if (cur.mode === 'pinch') {
      const others = [...pointers.entries()].filter(([id]) => id !== e.pointerId);
      if (others.length) {
        const other = others[0][1].pos;
        const prev = cur.pos;
        const midBefore: Vec2 = [(prev[0] + other[0]) / 2, (prev[1] + other[1]) / 2];
        const midAfter: Vec2 = [(screen[0] + other[0]) / 2, (screen[1] + other[1]) / 2];
        const distBefore = Math.hypot(prev[0] - other[0], prev[1] - other[1]);
        const distAfter = Math.hypot(screen[0] - other[0], screen[1] - other[1]);
        camera.panBy(midAfter[0] - midBefore[0], midAfter[1] - midBefore[1]);
        if (distBefore > 4) camera.zoomAt(midAfter, distAfter / distBefore);
        view.changed();
      }
      cur.pos = screen;
      return;
    }

    if (cur.mode === 'pan') {
      camera.panBy(screen[0] - cur.pos[0], screen[1] - cur.pos[1]);
      cur.pos = screen;
      view.changed();
      return;
    }

    cur.pos = screen;
    view.currentTool?.drag?.(view.pointer(e, screen));
    view.requestRender();
  });

  const release = (e: PointerEvent, cancelled: boolean) => {
    const cur = pointers.get(e.pointerId);
    if (!cur) return;
    pointers.delete(e.pointerId);
    const screen = view.local(e);
    const moved = Math.hypot(screen[0] - cur.start[0], screen[1] - cur.start[1]) > CLICK_SLOP;
    if (cur.mode === 'capture') {
      if (cancelled) view.currentTool?.cancel?.();
      else view.currentTool?.up?.(view.pointer(e, screen), moved);
      view.requestRender();
    } else if (cur.mode === 'pan' && !cur.pinched && !moved && !cancelled && pointers.size === 0) {
      view.currentTool?.tap?.(view.pointer(e, screen));
      view.requestRender();
    }
    // När alla fingrar släppts efter en nypning är gesten slut.
    if (pointers.size > 0 && [...pointers.values()].every((p) => p.mode === 'pinch') && pointers.size === 1) {
      for (const p of pointers.values()) p.mode = 'pan';
    }
    updateCursor();
  };
  svg.addEventListener('pointerup', (e) => release(e, false));
  svg.addEventListener('pointercancel', (e) => release(e, true));
  svg.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'touch' && !pointers.has(e.pointerId)) {
      view.events.onCursor?.(null);
      view.currentTool?.hover?.(null);
      view.requestRender();
    }
  });

  // Hjulet zoomar kring pekaren.
  // Nypning på styrplattan kommer som hjul med ctrlKey och får högre känslighet.
  svg.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? camera.height : 1;
      const k = e.ctrlKey ? 0.01 : 0.0015;
      camera.zoomAt(view.local(e), Math.exp(-e.deltaY * unit * k));
      view.changed();
    },
    { passive: false },
  );

  svg.addEventListener('auxclick', (e) => e.preventDefault());
  svg.addEventListener('contextmenu', (e) => e.preventDefault());

  return { updateCursor };
}
