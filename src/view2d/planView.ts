import { Camera } from './camera';
import { buildGrid } from './grid';
import { renderPrimitives } from './renderPrimitives';
import { renderScaleBar } from './scaleBar';
import { boundsOf, type Primitive, type Vec2 } from '../repr/primitives';

/** En pekarhändelse i planen, i både modell- och skärmkoordinater. */
export interface ViewPointer {
  model: Vec2;
  screen: Vec2;
  pointerType: string;
  shift: boolean;
  /** Ctrl eller Cmd. */
  mod: boolean;
  alt: boolean;
}

/**
 * Det aktiva verktyget tar emot pekarhändelser från planvyn. Panorering och
 * zoom sköter vyn själv: hjulet, mittenknappen, mellanslag + dra och två fingrar.
 */
export interface ViewTool {
  /** Muspekare som visas över planen. */
  cursor: string;
  /**
   * En knapp eller ett finger trycks ner. Svara "capture" för att få
   * drag och släpp, "pan" för att låta vyn panorera, eller "ignore".
   */
  down(p: ViewPointer): 'capture' | 'pan' | 'ignore';
  drag?(p: ViewPointer): void;
  up?(p: ViewPointer, moved: boolean): void;
  /** Ett kort tryck utan att dra, när verktyget lät vyn panorera (pekskärm). */
  tap?(p: ViewPointer): void;
  /** Gesten avbröts, t.ex. för att ett andra finger landade. */
  cancel?(): void;
  /** Pekaren rör sig utan att någon knapp är nedtryckt (mus och penna). */
  hover?(p: ViewPointer | null): void;
  /** Hjälpgrafik ovanpå ritningen, i skärmkoordinater. */
  overlay?(cam: Camera): string;
}

export interface PlanViewEvents {
  /** Pekarens position i modellen (mm), eller null när den lämnar vyn. */
  onCursor?: (p: Vec2 | null) => void;
  /** Vyn har zoomats eller panorerats. */
  onViewChange?: (cam: Camera) => void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Så långt (px) pekaren får röra sig innan ett klick räknas som ett drag. */
const CLICK_SLOP = 5;

/**
 * Planvyn: ett SVG-element som ritar rutnät, primitiver, hjälpgrafik och
 * skalstock. Vyn läser bara primitiver; den vet ingenting om väggar.
 */
export class PlanView {
  readonly camera = new Camera();
  readonly svg: SVGSVGElement;
  private gridMinor: SVGPathElement;
  private gridMajor: SVGPathElement;
  private gridAxes: SVGPathElement;
  private underlay: SVGGElement;
  private content: SVGGElement;
  private highlight: SVGGElement;
  private overlay: SVGGElement;
  private chrome: SVGGElement;

  private host: HTMLElement;
  private events: PlanViewEvents;
  private prims: readonly Primitive[] = [];
  private underlayPrims: readonly Primitive[] = [];
  private frame = 0;
  private gridVisible = true;
  private tool: ViewTool | null = null;
  private highlighter: ((cam: Camera) => string) | null = null;

  /** Fingrar och knappar som är nedtryckta just nu. */
  private pointers = new Map<number, { pos: Vec2; start: Vec2; mode: 'capture' | 'pan' | 'pinch'; pinched?: boolean }>();
  private lastMiddleDown = 0;
  private spaceDown = false;

  /** Ritningsskalans nämnare. Styr texthöjder (1:100 tills layouten finns). */
  drawingScale = 100;

  constructor(host: HTMLElement, events: PlanViewEvents = {}) {
    this.host = host;
    this.events = events;
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.classList.add('plan');
    this.svg.setAttribute('role', 'img');
    this.svg.setAttribute('aria-label', 'Planvy');
    const g = (cls: string) => {
      const el = document.createElementNS(SVG_NS, 'g');
      el.setAttribute('class', cls);
      this.svg.appendChild(el);
      return el;
    };
    const path = (parent: SVGGElement, cls: string) => {
      const el = document.createElementNS(SVG_NS, 'path');
      el.setAttribute('class', cls);
      parent.appendChild(el);
      return el;
    };
    const grid = g('grid');
    this.gridMinor = path(grid, 'grid-minor');
    this.gridMajor = path(grid, 'grid-major');
    this.gridAxes = path(grid, 'grid-axes');
    this.underlay = g('underlay');
    this.content = g('content');
    this.highlight = g('highlight');
    this.overlay = g('overlay');
    this.chrome = g('chrome');
    host.appendChild(this.svg);

    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.bindInput();
  }

  setPrimitives(prims: readonly Primitive[]): void {
    this.prims = prims;
    this.requestRender();
  }

  /** En annan vy som visas tonad under ritningen, att rita mot (kalkering). */
  setUnderlay(prims: readonly Primitive[]): void {
    this.underlayPrims = prims;
    this.requestRender();
  }

  /**
   * Hur den kalkerade vyn ritas: under eller över ritningen, i ritningens
   * färger (tonade) eller i en egen färg, och med vilken opacitet.
   */
  setUnderlayLook(look: { above: boolean; color: string | null; opacity: number }): void {
    const g = this.underlay;
    if (look.above) this.svg.insertBefore(g, this.highlight);
    else this.svg.insertBefore(g, this.content);
    g.classList.toggle('above', look.above);
    g.classList.toggle('tinted', !!look.color);
    g.style.opacity = String(look.opacity);
    for (const v of ['--ink', '--muted', '--poche', '--poche-existing', '--new', '--new-fill', '--demolished']) {
      if (look.color) g.style.setProperty(v, look.color);
      else g.style.removeProperty(v);
    }
    // Ovanpå ritningen får kalkeringen inga vita fyllningar som döljer den.
    if (look.above) g.style.setProperty('--paper', 'transparent');
    else g.style.removeProperty('--paper');
  }

  setTool(tool: ViewTool | null): void {
    this.tool?.cancel?.();
    this.tool?.hover?.(null);
    this.tool = tool;
    this.updateCursor();
    this.requestRender();
  }

  /** Grafik för markering och liknande, ritas mellan ritningen och verktyget. */
  setHighlighter(fn: ((cam: Camera) => string) | null): void {
    this.highlighter = fn;
    this.requestRender();
  }

  zoomToFit(): void {
    const b = boundsOf(this.prims);
    if (b) this.camera.fit(b, Math.min(64, this.camera.width * 0.08));
    else this.camera.fit({ minX: -5000, minY: -5000, maxX: 5000, maxY: 5000 });
    this.changed();
  }

  /** Visa ett område (mm), t.ex. det markerade, med lite luft runt. */
  zoomToBounds(b: { minX: number; minY: number; maxX: number; maxY: number }): void {
    const pad = Math.max(600, (b.maxX - b.minX) * 0.25, (b.maxY - b.minY) * 0.25);
    this.camera.fit({ minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad }, 48);
    this.changed();
  }

  zoomBy(factor: number): void {
    this.camera.zoomAt([this.camera.width / 2, this.camera.height / 2], factor);
    this.changed();
  }

  get showGrid(): boolean {
    return this.gridVisible;
  }

  set showGrid(v: boolean) {
    this.gridVisible = v;
    this.svg.classList.toggle('no-grid', !v);
    this.requestRender();
  }

  requestRender(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }

  private resize(): void {
    const r = this.host.getBoundingClientRect();
    const first = this.camera.width <= 1;
    this.camera.resize(r.width, r.height);
    this.svg.setAttribute('viewBox', `0 0 ${this.camera.width} ${this.camera.height}`);
    if (first && r.width > 1) this.zoomToFit();
    else this.changed();
  }

  private changed(): void {
    this.requestRender();
    this.events.onViewChange?.(this.camera);
  }

  private render(): void {
    const cam = this.camera;
    if (this.gridVisible) {
      const grid = buildGrid(cam);
      this.gridMinor.setAttribute('d', grid.minor);
      this.gridMinor.style.opacity = String(grid.minorOpacity);
      this.gridMajor.setAttribute('d', grid.major);
      this.gridAxes.setAttribute('d', grid.axes);
    }
    this.underlay.innerHTML = this.underlayPrims.length ? renderPrimitives(this.underlayPrims, cam, { drawingScale: this.drawingScale, idPrefix: 'u' }) : '';
    this.content.innerHTML = renderPrimitives(this.prims, cam, { drawingScale: this.drawingScale });
    this.highlight.innerHTML = this.highlighter?.(cam) ?? '';
    this.overlay.innerHTML = this.tool?.overlay?.(cam) ?? '';
    this.chrome.innerHTML = renderScaleBar(cam, 20, cam.height - 22);
  }

  private updateCursor(): void {
    const panning = [...this.pointers.values()].some((p) => p.mode === 'pan');
    this.svg.style.cursor = panning ? 'grabbing' : this.spaceDown ? 'grab' : (this.tool?.cursor ?? 'grab');
  }

  private local(e: PointerEvent | WheelEvent | MouseEvent): Vec2 {
    const r = this.svg.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private pointer(e: PointerEvent, screen: Vec2): ViewPointer {
    return {
      model: this.camera.toModel(screen),
      screen,
      pointerType: e.pointerType,
      shift: e.shiftKey,
      mod: e.ctrlKey || e.metaKey,
      alt: e.altKey,
    };
  }

  private bindInput(): void {
    const svg = this.svg;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        if (!this.spaceDown) {
          this.spaceDown = true;
          this.updateCursor();
        }
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.spaceDown = false;
        this.updateCursor();
      }
    });

    svg.addEventListener('pointerdown', (e) => {
      const screen = this.local(e);
      if (e.pointerType === 'mouse' && e.button === 1) {
        e.preventDefault();
        const now = performance.now();
        // Dubbelklick med mittenknappen: zooma till allt, som i AutoCAD.
        if (now - this.lastMiddleDown < 350) {
          this.zoomToFit();
          this.lastMiddleDown = 0;
          return;
        }
        this.lastMiddleDown = now;
      }
      if (e.pointerType === 'mouse' && e.button > 1) return;
      svg.setPointerCapture(e.pointerId);

      // Ett andra finger: avbryt verktygets gest och nyp-zooma i stället.
      if (e.pointerType === 'touch' && this.pointers.size >= 1) {
        for (const p of this.pointers.values()) {
          if (p.mode === 'capture') this.tool?.cancel?.();
          p.mode = 'pinch';
          p.pinched = true;
        }
        this.pointers.set(e.pointerId, { pos: screen, start: screen, mode: 'pinch', pinched: true });
        return;
      }

      let mode: 'capture' | 'pan' = 'pan';
      const primary = !(e.pointerType === 'mouse' && e.button === 1) && !this.spaceDown;
      if (primary && this.tool) {
        const answer = this.tool.down(this.pointer(e, screen));
        if (answer === 'ignore') return;
        mode = answer;
      }
      this.pointers.set(e.pointerId, { pos: screen, start: screen, mode });
      this.updateCursor();
    });

    svg.addEventListener('pointermove', (e) => {
      const screen = this.local(e);
      if (e.pointerType !== 'touch') this.events.onCursor?.(this.camera.toModel(screen));
      const cur = this.pointers.get(e.pointerId);

      if (!cur) {
        if (e.pointerType !== 'touch') {
          this.tool?.hover?.(this.pointer(e, screen));
          this.requestRender();
        }
        return;
      }

      if (cur.mode === 'pinch') {
        const others = [...this.pointers.entries()].filter(([id]) => id !== e.pointerId);
        if (others.length) {
          const other = others[0][1].pos;
          const prev = cur.pos;
          const midBefore: Vec2 = [(prev[0] + other[0]) / 2, (prev[1] + other[1]) / 2];
          const midAfter: Vec2 = [(screen[0] + other[0]) / 2, (screen[1] + other[1]) / 2];
          const distBefore = Math.hypot(prev[0] - other[0], prev[1] - other[1]);
          const distAfter = Math.hypot(screen[0] - other[0], screen[1] - other[1]);
          this.camera.panBy(midAfter[0] - midBefore[0], midAfter[1] - midBefore[1]);
          if (distBefore > 4) this.camera.zoomAt(midAfter, distAfter / distBefore);
          this.changed();
        }
        cur.pos = screen;
        return;
      }

      if (cur.mode === 'pan') {
        this.camera.panBy(screen[0] - cur.pos[0], screen[1] - cur.pos[1]);
        cur.pos = screen;
        this.changed();
        return;
      }

      cur.pos = screen;
      this.tool?.drag?.(this.pointer(e, screen));
      this.requestRender();
    });

    const release = (e: PointerEvent, cancelled: boolean) => {
      const cur = this.pointers.get(e.pointerId);
      if (!cur) return;
      this.pointers.delete(e.pointerId);
      const screen = this.local(e);
      const moved = Math.hypot(screen[0] - cur.start[0], screen[1] - cur.start[1]) > CLICK_SLOP;
      if (cur.mode === 'capture') {
        if (cancelled) this.tool?.cancel?.();
        else this.tool?.up?.(this.pointer(e, screen), moved);
        this.requestRender();
      } else if (cur.mode === 'pan' && !cur.pinched && !moved && !cancelled && this.pointers.size === 0) {
        this.tool?.tap?.(this.pointer(e, screen));
        this.requestRender();
      }
      // När alla fingrar släppts efter en nypning är gesten slut.
      if (this.pointers.size > 0 && [...this.pointers.values()].every((p) => p.mode === 'pinch') && this.pointers.size === 1) {
        for (const p of this.pointers.values()) p.mode = 'pan';
      }
      this.updateCursor();
    };
    svg.addEventListener('pointerup', (e) => release(e, false));
    svg.addEventListener('pointercancel', (e) => release(e, true));
    svg.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'touch' && !this.pointers.has(e.pointerId)) {
        this.events.onCursor?.(null);
        this.tool?.hover?.(null);
        this.requestRender();
      }
    });

    // Hjulet zoomar kring pekaren, som i ArchiCAD och AutoCAD.
    // Nypning på styrplattan kommer som hjul med ctrlKey och får högre känslighet.
    svg.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.camera.height : 1;
        const k = e.ctrlKey ? 0.01 : 0.0015;
        this.camera.zoomAt(this.local(e), Math.exp(-e.deltaY * unit * k));
        this.changed();
      },
      { passive: false },
    );

    svg.addEventListener('auxclick', (e) => e.preventDefault());
    svg.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
