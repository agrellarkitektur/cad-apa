import { angleDeg, dist, sub } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import { pxToMm, type ToolHost } from './host';
import { lengthLabel, snapMarker } from './overlay';
import { snap, type SnapResult } from './snap';

/** Det som mätts: sträckan, hela längden, vinkeln och ytan. */
export interface Measurement {
  points: number;
  /** Senaste sträckan, mm. */
  last: number;
  /** Alla sträckor tillsammans, mm. */
  total: number;
  /** Senaste sträckans vinkel, grader moturs från x-axeln. */
  angle: number;
  /** Vinkeln mellan de två senaste sträckorna, grader. */
  turn: number | null;
  /** Ytan som punkterna omsluter, m², från tre punkter. */
  area: number | null;
}

/**
 * Måttband (0.7.1): klicka punkter för att mäta avstånd, vinklar och ytor
 * utan att något ritas. Värdena står i verktygsraden och kan kopieras.
 * Dubbelklick eller Enter börjar om. Fungerar även i fasader och sektioner.
 */
export class MeasureTool implements ViewTool {
  cursor = 'crosshair';
  private host: ToolHost;
  private pts: Vec2[] = [];
  private current: SnapResult | null = null;
  private lastUp = 0;
  onChange?: () => void;

  constructor(host: ToolHost) {
    this.host = host;
  }

  down(): 'capture' {
    return 'capture';
  }

  drag(p: ViewPointer): void {
    this.track(p);
  }

  hover(p: ViewPointer | null): void {
    if (p) this.track(p);
    else this.current = null;
    this.onChange?.();
  }

  private track(p: ViewPointer): void {
    this.current = snap({
      cursor: p.model,
      from: this.pts[this.pts.length - 1],
      segments: this.host.snapSegments(),
      tol: pxToMm(this.host, p.pointerType === 'touch' ? 18 : 10),
      ortho: p.shift,
    });
  }

  up(p: ViewPointer): void {
    this.track(p);
    const pt = this.current?.point ?? p.model;
    const now = performance.now();
    // Dubbelklick: börja om.
    if (now - this.lastUp < 350 && this.pts.length && dist(pt, this.pts[this.pts.length - 1]) < pxToMm(this.host, 8)) {
      this.lastUp = 0;
      this.reset();
      return;
    }
    this.lastUp = now;
    this.pts.push([pt[0], pt[1]]);
    // Utan muspekare finns ingen nästa punkt att visa förrän man drar.
    if (p.pointerType !== 'mouse') this.current = null;
    this.onChange?.();
  }

  cancel(): void {}

  reset(): void {
    this.pts = [];
    this.onChange?.();
  }

  /** Mätningen med markören som nästa punkt. */
  measurement(): Measurement {
    const pts = [...this.pts];
    if (this.current && pts.length) pts.push(this.current.point);
    return measure(pts);
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    const pts = [...this.pts];
    if (this.current && pts.length) pts.push(this.current.point);
    if (pts.length >= 3) {
      const d = pts.map((q, i) => `${i ? 'L' : 'M'}${cam.toScreen(q).join(' ')}`).join('') + 'Z';
      out.push(`<path d="${d}" class="measure-area"/>`);
    }
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = cam.toScreen(pts[i]);
      const b = cam.toScreen(pts[i + 1]);
      out.push(`<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" class="measure-line"/>`);
      out.push(lengthLabel(cam, pts[i], pts[i + 1], fmtMm(dist(pts[i], pts[i + 1]))));
    }
    for (const q of this.pts) {
      const s = cam.toScreen(q);
      out.push(`<circle cx="${s[0]}" cy="${s[1]}" r="3.5" class="snap-dot"/>`);
    }
    if (this.current) out.push(snapMarker(cam, this.current));
    return out.join('');
  }
}

export function measure(pts: readonly Vec2[]): Measurement {
  let total = 0;
  for (let i = 0; i + 1 < pts.length; i++) total += dist(pts[i], pts[i + 1]);
  const n = pts.length;
  const last = n >= 2 ? dist(pts[n - 2], pts[n - 1]) : 0;
  const angle = n >= 2 ? angleDeg(sub(pts[n - 1], pts[n - 2])) : 0;
  let turn: number | null = null;
  if (n >= 3) {
    const a = angleDeg(sub(pts[n - 3], pts[n - 2]));
    const b = angleDeg(sub(pts[n - 1], pts[n - 2]));
    const t = Math.abs((((b - a) % 360) + 360) % 360);
    turn = t > 180 ? 360 - t : t;
  }
  let area: number | null = null;
  if (n >= 3) {
    let s = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % n];
      s += p[0] * q[1] - q[0] * p[1];
    }
    area = Math.abs(s) / 2 / 1e6;
  }
  return { points: n, last, total, angle: ((angle % 360) + 360) % 360, turn, area };
}

function fmtMm(v: number): string {
  return `${Math.round(v).toLocaleString('sv-SE')} mm`;
}

/**
 * Zooma till ett område (0.7.1, Z): dra upp en ruta. Ett klick utan att dra
 * zoomar in där. Sedan tillbaka till verktyget man hade.
 */
export class ZoomBoxTool implements ViewTool {
  cursor = 'zoom-in';
  private host: ToolHost;
  private a: Vec2 | null = null;
  private b: Vec2 | null = null;
  onDone?: () => void;

  constructor(host: ToolHost) {
    this.host = host;
  }

  down(p: ViewPointer): 'capture' {
    this.a = p.model;
    this.b = p.model;
    return 'capture';
  }

  drag(p: ViewPointer): void {
    this.b = p.model;
  }

  up(p: ViewPointer, moved: boolean): void {
    const a = this.a;
    this.a = null;
    this.b = null;
    const cam = this.host.view.camera;
    if (a && moved && Math.abs(p.model[0] - a[0]) * cam.scale > 8 && Math.abs(p.model[1] - a[1]) * cam.scale > 8) {
      this.host.view.zoomToArea({ minX: Math.min(a[0], p.model[0]), minY: Math.min(a[1], p.model[1]), maxX: Math.max(a[0], p.model[0]), maxY: Math.max(a[1], p.model[1]) });
    } else {
      cam.zoomAt(p.screen, 2);
      this.host.view.zoomBy(1);
    }
    this.onDone?.();
  }

  cancel(): void {
    this.a = null;
    this.b = null;
  }

  overlay(cam: Camera): string {
    if (!this.a || !this.b) return '';
    const a = cam.toScreen(this.a);
    const b = cam.toScreen(this.b);
    return `<rect x="${Math.min(a[0], b[0])}" y="${Math.min(a[1], b[1])}" width="${Math.abs(b[0] - a[0])}" height="${Math.abs(b[1] - a[1])}" class="zoom-box"/>`;
  }
}
