import { Camera } from './camera';
import { buildGrid } from './grid';
import { renderPrimitives, type LineWeights } from './renderPrimitives';
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
  /** Det översta lagret: markering, verktygens grafik och skalstock. Tar emot pekaren. */
  readonly svg: SVGSVGElement;
  /** Rutnätet, underst. */
  private gridSvg: SVGSVGElement;
  /**
   * Ritningen och den kalkerade vyn, i ett eget lager (0.8.3) som webbläsaren
   * kan flytta vid panorering utan att måla om det.
   */
  private drawingSvg: SVGSVGElement;
  /** Rutnätets nivåer, en bana per nivå (0.8.18). */
  private gridLevels: SVGGElement;
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
  /** Hjälpgrafik som inte hör till verktyget, t.ex. segmentpunkterna (0.8.18). */
  decorator: ((cam: Camera) => string) | null = null;

  // Ritningen ritas om bara när innehållet ändrats (0.8.3). Panorering flyttar
  // den färdiga bilden; zoom skalar den tills hjulet stått still en stund och
  // ritar sedan om, så att streck, text och skraffering blir rätt igen.
  private contentDirty = true;
  /** Kameran som ritningen senast ritades med. */
  private drawnCam: { center: Vec2; scale: number; width: number; height: number } | null = null;
  private zoomSettle = 0;
  private scaleOfDrawing = 100;

  /** Fingrar och knappar som är nedtryckta just nu. */
  private pointers = new Map<number, { pos: Vec2; start: Vec2; mode: 'capture' | 'pan' | 'pinch'; pinched?: boolean }>();
  private lastMiddleDown = 0;
  private spaceDown = false;

  /** Ritningsskalans nämnare. Styr texthöjder; 1 på ritningsblad, där allt är mm på papperet. */
  get drawingScale(): number {
    return this.scaleOfDrawing;
  }

  set drawingScale(v: number) {
    if (v === this.scaleOfDrawing) return;
    this.scaleOfDrawing = v;
    this.redraw();
  }

  /** Skalstocken i nedre vänstra hörnet (inte på ritningsblad). */
  showScaleBar = true;

  private weights: LineWeights = 'screen';
  /** Linjernas tjocklek på skärmen (0.8.11). */
  get lineWeights(): LineWeights {
    return this.weights;
  }

  set lineWeights(v: LineWeights) {
    if (v === this.weights) return;
    this.weights = v;
    this.redraw();
  }

  /** Adressen till bilderna i underlagen (0.8), se `RenderOptions.imageHref`. */
  imageHref?: (source: { asset: string; page?: number }) => string | null;

  constructor(host: HTMLElement, events: PlanViewEvents = {}) {
    this.host = host;
    this.events = events;
    const layer = (cls: string) => {
      const el = document.createElementNS(SVG_NS, 'svg');
      el.setAttribute('class', cls);
      return el;
    };
    this.gridSvg = layer('plan-layer plan-grid');
    this.drawingSvg = layer('plan-layer plan-drawing');
    this.svg = layer('plan');
    this.svg.setAttribute('role', 'img');
    this.svg.setAttribute('aria-label', 'Planvy');
    const g = (cls: string, parent: SVGSVGElement = this.svg) => {
      const el = document.createElementNS(SVG_NS, 'g');
      el.setAttribute('class', cls);
      parent.appendChild(el);
      return el;
    };
    const path = (parent: SVGGElement, cls: string) => {
      const el = document.createElementNS(SVG_NS, 'path');
      el.setAttribute('class', cls);
      parent.appendChild(el);
      return el;
    };
    const grid = g('grid', this.gridSvg);
    this.gridLevels = document.createElementNS(SVG_NS, 'g');
    grid.appendChild(this.gridLevels);
    this.gridAxes = path(grid, 'grid-axes');
    this.underlay = g('underlay', this.drawingSvg);
    this.content = g('content', this.drawingSvg);
    this.highlight = g('highlight');
    this.overlay = g('overlay');
    this.chrome = g('chrome');
    host.append(this.gridSvg, this.drawingSvg, this.svg);

    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.bindInput();
  }

  setPrimitives(prims: readonly Primitive[]): void {
    if (prims === this.prims) return;
    this.prims = prims;
    this.redraw();
  }

  /** En annan vy som visas tonad under ritningen, att rita mot (kalkering). */
  setUnderlay(prims: readonly Primitive[]): void {
    if (prims === this.underlayPrims || (!prims.length && !this.underlayPrims.length)) return;
    this.underlayPrims = prims;
    this.redraw();
  }

  /**
   * Rita om själva ritningen, t.ex. när en bild laddats klart eller temat
   * bytts. `requestRender` ritar bara om markering och verktygets grafik.
   */
  redraw(): void {
    this.contentDirty = true;
    this.requestRender();
  }

  /**
   * Hur den kalkerade vyn ritas: under eller över ritningen, i ritningens
   * färger (tonade) eller i en egen färg, och med vilken opacitet.
   */
  setUnderlayLook(look: { above: boolean; color: string | null; opacity: number }): void {
    const g = this.underlay;
    if (look.above) this.drawingSvg.appendChild(g);
    else this.drawingSvg.insertBefore(g, this.content);
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

  /** Verktyget som tar emot pekarhändelserna just nu. */
  get currentTool(): ViewTool | null {
    return this.tool;
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
    if (b) this.camera.fit(b, Math.min(64, this.camera.width * 0.08), this.drawingScale * 10);
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
    this.gridSvg.classList.toggle('no-grid', !v);
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
    for (const el of [this.gridSvg, this.drawingSvg, this.svg]) el.setAttribute('viewBox', `0 0 ${this.camera.width} ${this.camera.height}`);
    if (first && r.width > 1) this.zoomToFit();
    else this.changed();
  }

  private changed(): void {
    this.requestRender();
    this.noteZoom();
    this.events.onViewChange?.(this.camera);
  }

  // Förra zoomen (0.7.1): kameran sparas när den legat still en stund, och
  // läget innan en ändring läggs på en stapel.
  private zoomStack: { center: Vec2; scale: number }[] = [];
  private settled: { center: Vec2; scale: number } | null = null;
  private settleTimer = 0;
  private restoring = false;

  private noteZoom(): void {
    const now = { center: [this.camera.center[0], this.camera.center[1]] as Vec2, scale: this.camera.scale };
    if (!this.settled) {
      this.settled = now;
      return;
    }
    const s = this.settled;
    const same = Math.abs(s.scale - now.scale) < 1e-9 && Math.abs(s.center[0] - now.center[0]) < 1e-6 && Math.abs(s.center[1] - now.center[1]) < 1e-6;
    if (same) return;
    if (!this.settleTimer && !this.restoring) {
      this.zoomStack.push(s);
      if (this.zoomStack.length > 30) this.zoomStack.shift();
    }
    clearTimeout(this.settleTimer);
    this.settleTimer = window.setTimeout(() => {
      this.settleTimer = 0;
      this.settled = { center: [this.camera.center[0], this.camera.center[1]], scale: this.camera.scale };
    }, 450);
  }

  /** Tillbaka till läget före den senaste zoomningen eller panoreringen. Falskt om det inte finns något. */
  previousZoom(): boolean {
    clearTimeout(this.settleTimer);
    this.settleTimer = 0;
    const prev = this.zoomStack.pop();
    if (!prev) return false;
    this.camera.center = [prev.center[0], prev.center[1]];
    this.camera.scale = prev.scale;
    this.settled = prev;
    this.restoring = true;
    this.changed();
    this.restoring = false;
    return true;
  }

  /** Visa precis ett område (mm), t.ex. en ruta man dragit upp. */
  zoomToArea(b: { minX: number; minY: number; maxX: number; maxY: number }): void {
    this.camera.fit(b, 8);
    this.changed();
  }

  private render(): void {
    const cam = this.camera;
    this.renderDrawing();
    if (this.gridVisible) {
      const grid = buildGrid(cam);
      const paths = this.gridLevels.children;
      while (paths.length > grid.levels.length) paths[paths.length - 1].remove();
      grid.levels.forEach((level, i) => {
        let el = paths[i] as SVGPathElement | undefined;
        if (!el) {
          el = document.createElementNS(SVG_NS, 'path');
          el.setAttribute('class', 'grid-level');
          this.gridLevels.appendChild(el);
        }
        el.setAttribute('d', level.d);
        el.style.opacity = String(level.opacity);
      });
      this.gridAxes.setAttribute('d', grid.axes);
    }
    // Markering och verktygets grafik skrivs bara in när de ändrats, så att
    // webbläsaren inte målar om dem vid varje musrörelse (0.8.3).
    setMarkup(this.highlight, this.highlighter?.(cam) ?? '');
    setMarkup(this.overlay, this.tool?.overlay?.(cam) ?? '');
    setMarkup(this.chrome, (this.decorator?.(cam) ?? '') + (this.showScaleBar ? renderScaleBar(cam, 20, cam.height - 22) : ''));
  }

  /**
   * Ritningen och den kalkerade vyn. Har bara kameran ändrats flyttas (och
   * vid zoom skalas) den färdiga bilden: kameran är en förskjutning och en
   * likformig skalning, så samma transform gäller för allt i den.
   */
  private renderDrawing(): void {
    const cam = this.camera;
    const d = this.drawnCam;
    if (!this.contentDirty && d) {
      const k = cam.scale / d.scale;
      if (k === 1 && d.center[0] === cam.center[0] && d.center[1] === cam.center[1] && d.width === cam.width && d.height === cam.height) return;
      // En gammal skärmpunkt s blir (s − mitten förut)·k + förskjutningen + mitten nu.
      const tx = -(d.width / 2) * k + (d.center[0] - cam.center[0]) * cam.scale + cam.width / 2;
      const ty = -(d.height / 2) * k - (d.center[1] - cam.center[1]) * cam.scale + cam.height / 2;
      if (k === 1) {
        // Panorering: hela lagret flyttas, utan att något målas om.
        this.drawingSvg.style.transform = `translate(${tx}px, ${ty}px)`;
        this.setGroupTransform(null);
        return;
      }
      // Zoom: grupperna skalas (strecken behåller sin bredd) och ritas om när hjulet stått still.
      this.drawingSvg.style.transform = '';
      this.setGroupTransform(`translate(${tx} ${ty}) scale(${k})`);
      clearTimeout(this.zoomSettle);
      this.zoomSettle = window.setTimeout(() => this.redraw(), 140);
      return;
    }
    clearTimeout(this.zoomSettle);
    this.contentDirty = false;
    this.drawnCam = { center: [cam.center[0], cam.center[1]], scale: cam.scale, width: cam.width, height: cam.height };
    this.drawingSvg.style.transform = '';
    this.setGroupTransform(null);
    this.underlay.innerHTML = this.underlayPrims.length ? renderPrimitives(this.underlayPrims, cam, { drawingScale: this.drawingScale, idPrefix: 'u', imageHref: this.imageHref, lineWeights: this.weights }) : '';
    this.content.innerHTML = renderPrimitives(this.prims, cam, { drawingScale: this.drawingScale, imageHref: this.imageHref, lineWeights: this.weights });
  }

  private setGroupTransform(t: string | null): void {
    for (const g of [this.content, this.underlay]) {
      if (t) g.setAttribute('transform', t);
      else g.removeAttribute('transform');
    }
    this.drawingSvg.classList.toggle('zooming', !!t);
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

    // Hjulet zoomar kring pekaren.
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

/** Det som senast skrevs in i en grupp. */
const written = new WeakMap<Element, string>();

function setMarkup(g: Element, markup: string): void {
  if (written.get(g) === markup) return;
  written.set(g, markup);
  g.innerHTML = markup;
}
