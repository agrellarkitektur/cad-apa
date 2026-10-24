import { moveElements } from '../../core/commands';
import { add, angleDeg, dist, norm, scale, sub } from '../../geometry/vec';
import { pickAllAt } from '../../view2d/pick';
import { labelOf } from '../labels';
import { ghostPath } from '../modify/draw';
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
 * Hur långt det som ligger vid `b` ska flyttas, längs linjen från `a`, för
 * att avståndet ska bli `value` (0.8.4). Avrundat till en hundradels mm.
 */
export function moveAlong(a: Vec2, b: Vec2, value: number): [number, number] {
  const len = dist(a, b);
  if (len < 1e-9) return [0, 0];
  const d = scale(norm(sub(b, a)), value - len);
  const r = (v: number) => Math.round(v * 100) / 100 || 0; // || 0 gör −0 till 0
  return [r(d[0]), r(d[1])];
}

/**
 * Måttband (0.7.1): klicka punkter för att mäta avstånd, vinklar och ytor
 * utan att något ritas. Värdena står i verktygsraden och kan kopieras.
 * Dubbelklick eller Enter börjar om. Fungerar även i fasader och sektioner.
 *
 * Flytta med måttbandet (0.8.4): efter en sträcka från A till B går Tab till
 * objektet vid B (helst ett som inte också ligger vid A). Skriv avståndet och
 * tryck Enter, så flyttas det längs sträckan. Tab igen byter objekt.
 */
export class MeasureTool implements ViewTool {
  cursor = 'crosshair';
  private host: ToolHost;
  private pts: Vec2[] = [];
  private current: SnapResult | null = null;
  private lastUp = 0;
  onChange?: () => void;
  /** Objektet att flytta (0.8.4): kandidaterna vid B och vilken som är vald. */
  private target: { ids: string[]; index: number } | null = null;
  /** Avståndet som skrivs, för förhandsvisningen. */
  private preview: number | null = null;
  /** Flytta med måttbandet började, bytte objekt eller slutade. */
  onTarget?: () => void;

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
    if (this.target) this.endMove();
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
    if (this.target) this.endMove();
    this.onChange?.();
  }

  /** Objektet som flyttas med måttbandet, eller null. */
  get moving(): string | null {
    return this.target ? this.target.ids[this.target.index] : null;
  }

  /** Sträckan som ändras: de två senast klickade punkterna. */
  get span(): [Vec2, Vec2] | null {
    const n = this.pts.length;
    return n >= 2 ? [this.pts[n - 2], this.pts[n - 1]] : null;
  }

  /**
   * Tab: gå till objektet vid sista punkten, eller nästa om det redan finns
   * ett (Shift+Tab bakåt). Svarar med vad som hände, som en text att visa
   * när det inte gick.
   */
  beginMove(back = false): string | null {
    if (this.target) {
      const n = this.target.ids.length;
      this.target.index = (this.target.index + (back ? n - 1 : 1)) % n;
      this.onTarget?.();
      this.host.view.requestRender();
      return null;
    }
    const sp = this.span;
    if (!sp) return 'Mät från en punkt till en punkt på det som ska flyttas, tryck sedan Tab.';
    const pick = (q: Vec2) =>
      pickAllAt(this.host.plan().pickables, q, pxToMm(this.host, 6), this.host.view.drawingScale).filter((id) => {
        const el = this.host.store.doc.elements[id];
        return !!el && (!this.host.readOnly?.() || !!this.host.canEdit?.(id));
      });
    const atA = new Set(pick(sp[0]));
    const atB = pick(sp[1]);
    const ids = [...atB.filter((id) => !atA.has(id)), ...atB.filter((id) => atA.has(id))];
    if (!ids.length) return 'Det finns inget att flytta vid sista punkten.';
    this.target = { ids, index: 0 };
    this.preview = null;
    this.onTarget?.();
    this.host.view.requestRender();
    return null;
  }

  /** Avbryt flytten. */
  endMove(): void {
    this.target = null;
    this.preview = null;
    this.onTarget?.();
    this.host.view.requestRender();
  }

  /** Avståndet som skrivs just nu, för förhandsvisningen. */
  setPreview(v: number | null): void {
    this.preview = v !== null && Number.isFinite(v) && v >= 0 ? v : null;
    this.host.view.requestRender();
  }

  /** Flytta objektet så att sträckan blir `value` mm. Svarar med en text att visa. */
  applyMove(value: number): string {
    const id = this.moving;
    const sp = this.span;
    if (!id || !sp || !(value >= 0)) return 'Skriv ett avstånd i mm.';
    const doc = this.host.store.doc;
    const el = doc.elements[id];
    if (!el) return '';
    if (el.locked) return 'Låst. Lås upp i egenskaperna för att flytta.';
    const d = moveAlong(sp[0], sp[1], value);
    const name = labelOf(doc, el);
    this.endMove();
    if (Math.hypot(d[0], d[1]) < 0.01) return `${name} ligger redan där.`;
    moveElements(this.host.store, [id], d, 'Flytta med måttbandet', { keepJoins: true });
    // Sträckan följer med, så att man kan ändra igen.
    this.pts[this.pts.length - 1] = add(sp[1], d);
    this.onChange?.();
    return `Flyttade ${name}: avståndet är ${Math.round(value).toLocaleString('sv-SE')} mm.`;
  }

  /** De klickade punkterna. */
  get points(): readonly Vec2[] {
    return this.pts;
  }

  /** Mätningen med markören som nästa punkt. */
  measurement(): Measurement {
    const pts = [...this.pts];
    if (this.current && pts.length && !this.target) pts.push(this.current.point);
    return measure(pts);
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    const pts = [...this.pts];
    if (this.current && pts.length && !this.target) pts.push(this.current.point);
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
    if (this.current && !this.target) out.push(snapMarker(cam, this.current));
    // Objektet som flyttas med måttbandet, och var det hamnar med avståndet som skrivs.
    const id = this.moving;
    const sp = this.span;
    if (id && sp) {
      for (const item of this.host.plan().pickables) {
        if (item.id !== id) continue;
        out.push(ghostPath(cam, item, (q) => q).replace('class="ghost"', 'class="measure-target"'));
        if (this.preview !== null) {
          const d = moveAlong(sp[0], sp[1], this.preview);
          out.push(ghostPath(cam, item, (q) => [q[0] + d[0], q[1] + d[1]]));
        }
      }
    }
    return out.join('');
  }
}

/**
 * Punkterna som delar mätningen i `parts` lika långa delar längs hela
 * sträckan (0.8.18), utan ändarna. Brytpunkterna räknas inte som skarvar.
 */
export function dividePath(pts: readonly Vec2[], parts: number): Vec2[] {
  const n = Math.floor(parts);
  if (pts.length < 2 || !(n >= 2) || n > 1000) return [];
  let total = 0;
  for (let i = 0; i + 1 < pts.length; i++) total += dist(pts[i], pts[i + 1]);
  if (total < 1e-9) return [];
  const out: Vec2[] = [];
  let seg = 0;
  let start = 0; // sträckan fram till pts[seg]
  for (let k = 1; k < n; k++) {
    const at = (total * k) / n;
    while (seg + 2 < pts.length && start + dist(pts[seg], pts[seg + 1]) < at) {
      start += dist(pts[seg], pts[seg + 1]);
      seg++;
    }
    const len = dist(pts[seg], pts[seg + 1]);
    const t = len > 0 ? (at - start) / len : 0;
    const a = pts[seg];
    const b = pts[seg + 1];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
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
