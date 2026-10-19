import { updateParams } from '../../core/commands';
import type { Id } from '../../core/model';
import { underlayCorners, type UnderlayParams } from '../../elements/underlay';
import { resolveParams } from '../../elements/registry';
import { angleDeg, dist, sub } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import { askText } from '../ask';
import { evaluate } from '../expr';
import { pxToMm, type ToolHost } from './host';
import { lengthLabel, snapMarker } from './overlay';
import { roundMm, snap, type SnapResult } from './snap';

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });

/**
 * Kalibrera och rikta ett underlag (0.8 del 2). Man klickar två punkter på
 * underlaget.
 *
 * - Kalibrera: man skriver hur långt det verkligen är mellan punkterna, och
 *   underlaget skalas om kring den första punkten.
 * - Rikta: underlaget vrids kring den första punkten så att linjen mellan
 *   punkterna hamnar i närmaste projektvinkel (0°, 45°, 90° och projektets egna).
 */
export class UnderlayTool implements ViewTool {
  cursor = 'crosshair';
  private host: ToolHost;
  private id: Id;
  private mode: 'calibrate' | 'align';
  private a: Vec2 | null = null;
  private at: SnapResult | null = null;
  private busy = false;
  /** Klart (true) eller avbrutet (false). */
  onDone?: (ok: boolean) => void;

  constructor(host: ToolHost, id: Id, mode: 'calibrate' | 'align') {
    this.host = host;
    this.id = id;
    this.mode = mode;
  }

  down(): 'capture' {
    return 'capture';
  }

  drag(p: ViewPointer): void {
    this.track(p);
  }

  hover(p: ViewPointer | null): void {
    if (p) this.track(p);
  }

  cancel(): void {}

  private track(p: ViewPointer): void {
    this.at = snap({ cursor: p.model, from: this.a ?? undefined, segments: this.host.snapSegments(), tol: pxToMm(this.host, p.pointerType === 'touch' ? 18 : 10), ortho: p.shift });
  }

  up(p: ViewPointer): void {
    if (this.busy) return;
    this.track(p);
    // Inte avrundat: en punkt som snäppt mot en DXF-linje ska ge exakt vinkel och avstånd.
    const snapped = this.at && this.at.kind !== 'free' && this.at.kind !== 'angle';
    const pt: Vec2 = snapped ? this.at!.point : roundMm(this.at?.point ?? p.model);
    if (!this.a) {
      this.a = pt;
      this.host.hint(this.mode === 'calibrate' ? 'Klicka den andra punkten.' : 'Klicka en punkt till längs linjen som ska bli rak.', 4000);
      return;
    }
    if (dist(this.a, pt) < 1) return;
    const a = this.a;
    this.a = null;
    if (this.mode === 'calibrate') void this.calibrate(a, pt);
    else this.align(a, pt);
  }

  private params(): UnderlayParams | null {
    const el = this.host.store.doc.elements[this.id];
    return el ? resolveParams<UnderlayParams>(this.host.store.doc, el) : null;
  }

  private async calibrate(a: Vec2, b: Vec2): Promise<void> {
    const p = this.params();
    if (!p) return this.onDone?.(false);
    const measured = dist(a, b);
    this.busy = true;
    const answer = await askText('Verkligt avstånd mellan punkterna, mm', nf.format(Math.round(measured)).replace(/\s/g, ''), 'Kalibrera');
    this.busy = false;
    const real = answer === null ? null : evaluate(answer, measured, 'mm');
    if (!real || real <= 0) return this.onDone?.(false);
    const f = real / measured;
    // Skala om kring den första punkten.
    const pos: [number, number] = [Math.round((a[0] + (p.pos[0] - a[0]) * f) * 10) / 10, Math.round((a[1] + (p.pos[1] - a[1]) * f) * 10) / 10];
    updateParams(this.host.store, [this.id], { scale: p.scale * f, pos }, 'Kalibrera underlaget');
    this.host.hint(`Kalibrerat: ${nf.format(Math.round(measured))} mm blev ${nf.format(Math.round(real))} mm.`, 4000);
    this.onDone?.(true);
  }

  private align(a: Vec2, b: Vec2): void {
    const p = this.params();
    if (!p) return this.onDone?.(false);
    const ang = angleDeg(sub(b, a));
    // Närmaste projektvinkel, åt båda hållen (och vinkelrätt).
    const own = this.host.store.doc.project.angles ?? [];
    const targets = [0, 45, ...own, ...own.map((x) => x + 90)];
    let best = { delta: 0, target: 0, d: Infinity };
    for (const t of targets)
      for (const k of [-360, -270, -180, -90, 0, 90, 180, 270, 360]) {
        const delta = t + k - ang;
        if (Math.abs(delta) < best.d) best = { delta, target: (((t + k) % 180) + 180) % 180, d: Math.abs(delta) };
      }
    if (best.d < 0.001) {
      this.host.hint('Linjen ligger redan rakt.');
      return this.onDone?.(true);
    }
    const r = (best.delta * Math.PI) / 180;
    const c = Math.cos(r);
    const s = Math.sin(r);
    const pos: [number, number] = [a[0] + (p.pos[0] - a[0]) * c - (p.pos[1] - a[1]) * s, a[1] + (p.pos[0] - a[0]) * s + (p.pos[1] - a[1]) * c];
    // Fyra decimaler räcker; 359,9999° blir 0°.
    let angle = Math.round((((p.angle + best.delta) % 360) + 360) % 360 * 10000) / 10000;
    if (angle >= 360) angle -= 360;
    updateParams(this.host.store, [this.id], { angle, pos: [Math.round(pos[0] * 10) / 10, Math.round(pos[1] * 10) / 10] }, 'Rikta underlaget');
    this.host.hint(`Riktat: linjen ligger nu i ${best.target.toLocaleString('sv-SE', { maximumFractionDigits: 2 })}°.`, 4000);
    this.onDone?.(true);
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    const p = this.params();
    if (p) {
      const c = underlayCorners(p).map((q) => cam.toScreen(q));
      out.push(`<path d="M${c.map((q) => q.join(' ')).join('L')}Z" class="hl-sel-line"/>`);
    }
    if (this.at) out.push(snapMarker(cam, this.at));
    if (this.a && this.at) {
      const s = cam.toScreen(this.a);
      const e = cam.toScreen(this.at.point);
      out.push(`<path d="M${s[0]} ${s[1]}L${e[0]} ${e[1]}" class="rubber"/>`);
      out.push(`<circle cx="${s[0]}" cy="${s[1]}" r="4" class="grip"/>`);
      const d = sub(this.at.point, this.a);
      out.push(lengthLabel(cam, this.a, this.at.point, this.mode === 'calibrate' ? `${nf.format(Math.round(Math.hypot(d[0], d[1])))} mm` : `${angleDeg(d).toLocaleString('sv-SE', { maximumFractionDigits: 1 })}°`));
    }
    return out.join('');
  }
}
