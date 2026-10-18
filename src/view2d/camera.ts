import type { Bounds, Vec2 } from '../repr/primitives';

/**
 * Kameran för planvyn. Modellen räknas i mm med y uppåt; skärmen i CSS-pixlar
 * med y nedåt. `scale` är antal pixlar per mm.
 */
export class Camera {
  /** Modellpunkt som ligger i vyns mitt. */
  center: Vec2 = [0, 0];
  scale = 0.05;
  width = 1;
  height = 1;

  static readonly MIN_SCALE = 0.0005; // ca 1:530 000 på skärmen
  static readonly MAX_SCALE = 20; // ca 1:0,2

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  toScreen(p: Vec2): Vec2 {
    return [
      (p[0] - this.center[0]) * this.scale + this.width / 2,
      -(p[1] - this.center[1]) * this.scale + this.height / 2,
    ];
  }

  toModel(s: Vec2): Vec2 {
    return [
      (s[0] - this.width / 2) / this.scale + this.center[0],
      -(s[1] - this.height / 2) / this.scale + this.center[1],
    ];
  }

  /** Flytta vyn så många skärmpixlar. */
  panBy(dx: number, dy: number): void {
    this.center = [this.center[0] - dx / this.scale, this.center[1] + dy / this.scale];
  }

  /** Zooma med faktorn `factor` kring en skärmpunkt som ligger kvar under pekaren. */
  zoomAt(screen: Vec2, factor: number): void {
    const before = this.toModel(screen);
    this.scale = clamp(this.scale * factor, Camera.MIN_SCALE, Camera.MAX_SCALE);
    const after = this.toModel(screen);
    this.center = [this.center[0] + before[0] - after[0], this.center[1] + before[1] - after[1]];
  }

  /** Visa hela rektangeln med marginal. */
  fit(b: Bounds, marginPx = 48): void {
    const w = Math.max(b.maxX - b.minX, 1000);
    const h = Math.max(b.maxY - b.minY, 1000);
    const sx = (this.width - marginPx * 2) / w;
    const sy = (this.height - marginPx * 2) / h;
    this.scale = clamp(Math.min(sx, sy), Camera.MIN_SCALE, Camera.MAX_SCALE);
    this.center = [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
  }

  /** Synlig del av modellen. */
  visible(): Bounds {
    const a = this.toModel([0, this.height]);
    const b = this.toModel([this.width, 0]);
    return { minX: a[0], minY: a[1], maxX: b[0], maxY: b[1] };
  }

  /**
   * Skärmskalan uttryckt som ritningsskala, räknat på CSS-pixeln
   * (1/96 tum = 0,2646 mm). Ger t.ex. 100 för "1:100".
   */
  screenScaleDenominator(): number {
    return 1 / this.scale / (25.4 / 96);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
