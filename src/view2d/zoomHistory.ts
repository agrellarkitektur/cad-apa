import type { Camera } from './camera';
import type { Vec2 } from '../repr/primitives';

/**
 * Förra zoomen (0.7.1; ur planView.ts i 0.10.22.1): kameran sparas när den
 * legat still en stund, och läget innan en ändring läggs på en stapel, så
 * att man kan gå tillbaka steg för steg (högst 30).
 */
export class ZoomHistory {
  private readonly camera: Camera;
  private stack: { center: Vec2; scale: number }[] = [];
  private settled: { center: Vec2; scale: number } | null = null;
  private settleTimer = 0;
  private restoring = false;

  constructor(camera: Camera) {
    this.camera = camera;
  }

  /** Kameran har ändrats. */
  note(): void {
    const now = { center: [this.camera.center[0], this.camera.center[1]] as Vec2, scale: this.camera.scale };
    if (!this.settled) {
      this.settled = now;
      return;
    }
    const s = this.settled;
    const same = Math.abs(s.scale - now.scale) < 1e-9 && Math.abs(s.center[0] - now.center[0]) < 1e-6 && Math.abs(s.center[1] - now.center[1]) < 1e-6;
    if (same) return;
    if (!this.settleTimer && !this.restoring) {
      this.stack.push(s);
      if (this.stack.length > 30) this.stack.shift();
    }
    clearTimeout(this.settleTimer);
    this.settleTimer = window.setTimeout(() => {
      this.settleTimer = 0;
      this.settled = { center: [this.camera.center[0], this.camera.center[1]], scale: this.camera.scale };
    }, 450);
  }

  /** Tillbaka till läget före den senaste zoomningen eller panoreringen. Falskt om det inte finns något; `changed` körs annars. */
  previous(changed: () => void): boolean {
    clearTimeout(this.settleTimer);
    this.settleTimer = 0;
    const prev = this.stack.pop();
    if (!prev) return false;
    this.camera.center = [prev.center[0], prev.center[1]];
    this.camera.scale = prev.scale;
    this.settled = prev;
    this.restoring = true;
    changed();
    this.restoring = false;
    return true;
  }
}
