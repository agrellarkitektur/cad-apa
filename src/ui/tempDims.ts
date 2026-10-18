import { moveElements } from '../core/commands';
import type { Id } from '../core/model';
import { actionOf, type ViewStates } from '../core/states';
import type { DocStore } from '../core/store';
import { resolveParams } from '../elements/registry';
import { computeTempDims, type TempDim } from '../elements/autoDims';
import type { WallParams } from '../elements/wall';
import type { Camera } from '../view2d/camera';
import { isNarrow } from './sheet';

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });

/**
 * Tillfälliga mått när en vägg är markerad: avståndet från väggens liv till
 * närmaste parallella väggs liv på var sida. Klickar man på ett mått kan man
 * skriva in ett nytt värde, och väggen flyttas så att avståndet blir det.
 *
 * Värdet används med Enter, med ✓ eller när man lämnar fältet (iPhones
 * sifferknappsats saknar Enter). Esc och ✕ avbryter. På smala skärmar
 * skrivs värdet i en rad överst i ritytan, där tangentbordet inte täcker den.
 */
export class TempDims {
  readonly el: HTMLElement;
  private store: DocStore;
  private dims: TempDim[] = [];
  private wallId: Id | null = null;
  private editing = -1;
  /** Satt när redigeringen redan avslutats, så att den inte används två gånger. */
  private closed = false;
  /** Ritar om när en redigering avbrutits. */
  requestRender?: () => void;

  constructor(container: HTMLElement, store: DocStore) {
    this.store = store;
    this.el = document.createElement('div');
    this.el.className = 'temp-dims';
    container.appendChild(this.el);
    this.el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      // Knapparna ska inte ta fokus från fältet.
      if ((e.target as HTMLElement).closest('[data-ok], [data-cancel]')) e.preventDefault();
    });
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-ok]')) return this.commit();
      if (t.closest('[data-cancel]')) return this.cancel();
      const b = t.closest<HTMLElement>('button[data-dim]');
      if (b) this.startEdit(b);
    });
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.commit();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.cancel();
      }
      e.stopPropagation();
    });
    // Ett tryck i ritningen tar inte alltid fokus från fältet (ritytan
    // hindrar det), så värdet används redan när man trycker någon annanstans.
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (this.editing >= 0 && !this.el.contains(e.target as Node)) this.commit();
      },
      true,
    );
    this.el.addEventListener('focusout', () => {
      setTimeout(() => {
        if (this.editing >= 0 && !this.el.contains(document.activeElement)) this.commit();
      }, 0);
    });
  }

  private startEdit(b: HTMLElement): void {
    this.editing = Number(b.dataset.dim);
    this.closed = false;
    const value = Math.round(this.dims[this.editing].value);
    this.el.querySelectorAll('button[data-dim]').forEach((x) => x.classList.toggle('editing', x === b));
    const input = `<input class="temp-dim-input" type="number" inputmode="numeric" enterkeyhint="done" value="${value}" aria-label="Nytt avstånd i mm">`;
    if (isNarrow()) {
      this.el.querySelector('.temp-dim-bar')?.remove();
      this.el.insertAdjacentHTML(
        'beforeend',
        `<div class="temp-dim-bar"><span>Avstånd</span>${input}<span class="unit">mm</span><button class="btn btn-primary" data-ok aria-label="Använd">✓</button><button class="btn" data-cancel aria-label="Avbryt">✕</button></div>`,
      );
    } else {
      b.outerHTML = `<span class="temp-dim-edit" style="${b.getAttribute('style')}">${input}<button class="temp-dim-ok" data-ok aria-label="Använd" title="Använd (Enter)">✓</button></span>`;
    }
    const el = this.el.querySelector<HTMLInputElement>('.temp-dim-input');
    el?.focus();
    el?.select();
  }

  private commit(): void {
    if (this.editing < 0 || this.closed) return;
    const input = this.el.querySelector<HTMLInputElement>('.temp-dim-input');
    const i = this.editing;
    this.closed = true;
    this.editing = -1;
    const value = input && input.value.trim() !== '' ? Number(input.value) : NaN;
    input?.blur();
    if (!this.apply(i, value)) this.requestRender?.();
  }

  private cancel(): void {
    this.closed = true;
    this.editing = -1;
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.requestRender?.();
  }

  /** Flytta väggen så att måttet blir det inskrivna. Sant om något ändrades. */
  private apply(i: number, value: number): boolean {
    const d = this.dims[i];
    if (!d || !this.wallId || !(value >= 0)) return false;
    const delta = value - d.value;
    if (Math.abs(delta) < 0.5) return false;
    moveElements(this.store, [this.wallId], [Math.round(d.grow[0] * delta), Math.round(d.grow[1] * delta)], 'Flytta vägg');
    return true;
  }

  /** Räkna om måtten för markeringen och rita dem. Returnerar linjerna som SVG. */
  render(cam: Camera, selected: readonly Id[], view: ViewStates, enabled: boolean): string {
    if (this.editing >= 0 && this.el.contains(document.activeElement)) return this.lines(cam);
    this.editing = -1;
    const doc = this.store.doc;
    const el = selected.length === 1 ? doc.elements[selected[0]] : undefined;
    if (!enabled || el?.type !== 'Wall') {
      this.dims = [];
      this.wallId = null;
      this.el.innerHTML = '';
      return '';
    }
    this.wallId = el.id;
    this.dims = computeTempDims(
      el,
      Object.values(doc.elements).filter((e) => e.type === 'Wall' && e.id !== el.id && e.storey === el.storey && actionOf(e, view) !== 'absent'),
      (e) => resolveParams<WallParams>(doc, e),
    );
    this.el.innerHTML = this.dims
      .map((d, i) => {
        const m = cam.toScreen([(d.a[0] + d.b[0]) / 2, (d.a[1] + d.b[1]) / 2]);
        return `<button class="temp-dim" data-dim="${i}" style="left:${Math.round(m[0])}px;top:${Math.round(m[1])}px" title="Klicka och skriv ett nytt avstånd">${nf.format(Math.round(d.value))}</button>`;
      })
      .join('');
    return this.lines(cam);
  }

  private lines(cam: Camera): string {
    return this.dims
      .map((d) => {
        const a = cam.toScreen(d.a);
        const b = cam.toScreen(d.b);
        return `<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" class="temp-dim-line"/><circle cx="${a[0]}" cy="${a[1]}" r="2.5" class="temp-dim-end"/><circle cx="${b[0]}" cy="${b[1]}" r="2.5" class="temp-dim-end"/>`;
      })
      .join('');
  }
}
