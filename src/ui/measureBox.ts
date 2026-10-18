import { moveElements, moveWallEnd } from '../core/commands';
import type { Id } from '../core/model';
import type { DocStore } from '../core/store';
import type { WallParams } from '../elements/wall';
import { add, angleDeg, dist, fromAngleDeg, scale, sub } from '../geometry/vec';
import type { Vec2 } from '../repr/primitives';

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });

type Target =
  /** En väggände har dragits. Längd, ändring och vinkel kan skrivas in. */
  | { kind: 'wall-end'; wallId: Id; end: 'start' | 'end'; original: number; companions: Id[] }
  /** Objekt har flyttats. Avstånd och vinkel för flytten kan skrivas in. */
  | { kind: 'move'; ids: Id[]; applied: Vec2; anchor: Vec2 };

/**
 * Rutan som visas efter att något dragits: mått som går att skriva in för
 * att göra ändringen exakt. Enter ändrar, Esc stänger. Vinklar anges i grader
 * moturs från x-axeln (0° = åt höger på ritningen, 90° = uppåt).
 */
export class MeasureBox {
  readonly el: HTMLElement;
  private store: DocStore;
  private target: Target | null = null;

  constructor(store: DocStore) {
    this.store = store;
    this.el = document.createElement('div');
    this.el.className = 'measure-box';
    this.el.hidden = true;
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.apply(e.target as HTMLInputElement, true);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
      e.stopPropagation();
    });
    this.el.addEventListener('change', (e) => this.apply(e.target as HTMLInputElement));
    this.el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-action="close-measure"]')) this.close();
    });
  }

  get open(): boolean {
    return this.target !== null;
  }

  showWallEnd(wallId: Id, end: 'start' | 'end', original: number, companions: Id[] = []): void {
    this.target = { kind: 'wall-end', wallId, end, original, companions };
    delete this.el.dataset.kind;
    this.render();
    this.el.hidden = false;
  }

  showMove(ids: Id[], applied: Vec2, anchor: Vec2): void {
    this.target = { kind: 'move', ids, applied, anchor };
    delete this.el.dataset.kind;
    this.render();
    this.el.hidden = false;
  }

  close(): void {
    this.target = null;
    this.el.hidden = true;
  }

  /** Punkten i modellen som rutan sitter vid. */
  anchor(): Vec2 | null {
    const t = this.target;
    if (!t) return null;
    if (t.kind === 'move') return t.anchor;
    const wall = this.store.doc.elements[t.wallId];
    return wall ? (wall.params as unknown as WallParams)[t.end] : null;
  }

  /**
   * Flytta rutan till sin punkt och visa aktuella värden. `toScreen` räknar
   * om en modellpunkt till pixlar i ritytan (från planen eller 3D-vyn).
   */
  update(toScreen: (p: Vec2) => Vec2 | null): void {
    if (!this.target) return;
    if (this.target.kind === 'wall-end' && !this.store.doc.elements[this.target.wallId]) {
      this.close();
      return;
    }
    const a = this.anchor();
    const s = a ? toScreen(a) : null;
    if (!s) {
      this.el.style.visibility = 'hidden';
      return;
    }
    this.el.style.visibility = '';
    this.el.style.left = `${Math.round(s[0])}px`;
    this.el.style.top = `${Math.round(s[1])}px`;
    if (!this.el.contains(document.activeElement)) this.render();
  }

  private render(): void {
    const t = this.target;
    if (!t) return;
    // Finns fälten redan uppdateras bara värdena, så att fokus och Tab fungerar.
    if (this.el.dataset.kind === t.kind && this.el.querySelector('input')) {
      for (const [name, value] of Object.entries(this.values(t))) {
        const inp = this.el.querySelector<HTMLInputElement>(`#mb-${name}`);
        if (inp && inp !== document.activeElement) inp.value = String(value);
      }
      return;
    }
    this.el.dataset.kind = t.kind;
    const field = (name: string, label: string, value: number, unit: string) =>
      `<label><span>${label}</span><span class="input-unit"><input type="number" inputmode="decimal" id="mb-${name}" data-field="${name}" value="${value}"><i>${unit}</i></span></label>`;
    const close = `<button class="icon-mini" data-action="close-measure" aria-label="Stäng">×</button>`;

    if (t.kind === 'wall-end') {
      const wall = this.store.doc.elements[t.wallId];
      if (!wall) return;
      const p = wall.params as unknown as WallParams;
      const fixed = t.end === 'start' ? p.end : p.start;
      const length = Math.round(dist(p.start, p.end));
      const angle = round1(angleDeg(sub(p[t.end], fixed)));
      this.el.innerHTML = `
        ${field('length', 'Längd', length, 'mm')}
        ${field('delta', 'Ändring', length - Math.round(t.original), 'mm')}
        ${field('angle', 'Vinkel', angle, '°')}
        ${close}
        <span class="mb-note">Från ${nf.format(Math.round(t.original))} mm</span>`;
    } else {
      const distance = Math.round(Math.hypot(t.applied[0], t.applied[1]));
      const angle = round1(angleDeg(t.applied));
      this.el.innerHTML = `
        ${field('distance', 'Avstånd', distance, 'mm')}
        ${field('angle', 'Vinkel', angle, '°')}
        ${close}
        <span class="mb-note">Flyttat ${t.ids.length === 1 ? '1 objekt' : `${t.ids.length} objekt`}</span>`;
    }
  }

  /** Fältens aktuella värden. */
  private values(t: Target): Record<string, number> {
    if (t.kind === 'move') return { distance: Math.round(Math.hypot(t.applied[0], t.applied[1])), angle: round1(angleDeg(t.applied)) };
    const wall = this.store.doc.elements[t.wallId];
    if (!wall) return {};
    const p = wall.params as unknown as WallParams;
    const fixed = t.end === 'start' ? p.end : p.start;
    const length = Math.round(dist(p.start, p.end));
    return { length, delta: length - Math.round(t.original), angle: round1(angleDeg(sub(p[t.end], fixed))) };
  }

  private apply(input: HTMLInputElement, done = false): void {
    const t = this.target;
    if (!t || input.value === '') return;
    const read = (name: string) => Number((this.el.querySelector(`#mb-${name}`) as HTMLInputElement | null)?.value);

    if (t.kind === 'wall-end') {
      const wall = this.store.doc.elements[t.wallId];
      if (!wall) return;
      const p = wall.params as unknown as WallParams;
      const fixed = t.end === 'start' ? p.end : p.start;
      const length = input.dataset.field === 'delta' ? t.original + read('delta') : read('length');
      const angle = read('angle');
      if (!(length > 1) || !Number.isFinite(angle)) return;
      const to = add(fixed, scale(fromAngleDeg(angle), length));
      if (dist(to, p[t.end]) < 0.5) return;
      moveWallEnd(this.store, t.wallId, t.end, [Math.round(to[0]), Math.round(to[1])], {
        label: 'Ändra längd',
        connected: t.companions,
      });
    } else {
      const distance = read('distance');
      const angle = read('angle');
      if (!(distance >= 0) || !Number.isFinite(angle)) return;
      const wanted = scale(fromAngleDeg(angle), distance);
      const correction = sub(wanted, t.applied);
      if (Math.hypot(correction[0], correction[1]) < 0.5) return;
      moveElements(this.store, t.ids, [correction[0], correction[1]], 'Ändra flytt');
      this.target = { ...t, applied: wanted, anchor: add(t.anchor, correction) };
    }
    // Med Enter är man klar; med Tab vidare till nästa fält ska fokus ligga kvar där.
    if (done) input.blur();
    this.render();
  }
}

function round1(v: number): number {
  const r = Math.round(v * 10) / 10;
  return r === 360 ? 0 : r;
}
