import type { Vec2 } from '../repr/primitives';
import type { Camera } from '../view2d/camera';

export interface TextEditRequest {
  /** Textens baslinje för första raden, i modellen (mm). */
  at: Vec2;
  /** Vridning moturs, radianer. */
  angle: number;
  /** Texthöjd på papper (mm). */
  height: number;
  /** Ritningsskalans nämnare. */
  drawingScale: number;
  value: string;
  /** Flera rader: Enter ger ny rad med Shift, annars används texten. */
  multiline: boolean;
  bold?: boolean;
  /** Etikett för skärmläsare. */
  label: string;
  commit(value: string): void;
}

/**
 * Redigera en text direkt i ritningen: ett fält läggs över texten, i samma
 * läge, vridning och storlek. Enter använder texten (Shift+Enter ger ny rad
 * i fri text), Esc avbryter, och ett tryck någon annanstans använder den.
 */
export class InlineTextEditor {
  readonly el: HTMLTextAreaElement;
  private req: TextEditRequest | null = null;
  private done = true;

  constructor(container: HTMLElement) {
    this.el = document.createElement('textarea');
    this.el.className = 'inline-text';
    this.el.hidden = true;
    this.el.spellcheck = false;
    this.el.setAttribute('enterkeyhint', 'done');
    container.appendChild(this.el);
    this.el.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close(false);
      } else if (e.key === 'Enter' && !(e.shiftKey && this.req?.multiline)) {
        e.preventDefault();
        this.close(true);
      }
    });
    this.el.addEventListener('input', () => this.fit());
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.done && e.target !== this.el) this.close(true);
      },
      true,
    );
    this.el.addEventListener('blur', () => {
      setTimeout(() => {
        if (!this.done && document.activeElement !== this.el) this.close(true);
      }, 0);
    });
  }

  get isOpen(): boolean {
    return !this.done;
  }

  open(req: TextEditRequest, cam: Camera): void {
    if (!this.done) this.close(true);
    this.req = req;
    this.done = false;
    this.el.value = req.value;
    this.el.setAttribute('aria-label', req.label);
    this.el.classList.toggle('bold', !!req.bold);
    this.el.hidden = false;
    this.position(cam);
    this.el.focus();
    this.el.select();
  }

  /** Följ med när vyn zoomas eller panoreras. */
  position(cam: Camera): void {
    const r = this.req;
    if (!r || this.done) return;
    const px = r.height * r.drawingScale * cam.scale;
    // Telefonen zoomar in i fält med mindre text än 16 px.
    const font = Math.max(px, window.matchMedia('(pointer: coarse)').matches ? 16 : 11);
    const s = cam.toScreen(r.at);
    const deg = (-r.angle * 180) / Math.PI;
    this.el.style.fontSize = `${font}px`;
    this.el.style.lineHeight = `${font * (r.multiline ? 1.5 : 1.25)}px`;
    this.el.style.left = `${s[0]}px`;
    this.el.style.top = `${s[1]}px`;
    // Fältets överkant ligger en texthöjd ovanför baslinjen.
    this.el.style.transform = `rotate(${deg}deg) translate(-3px, ${-font * 1.05}px)`;
    this.fit();
  }

  private fit(): void {
    const lines = this.el.value.split('\n');
    const longest = Math.max(4, ...lines.map((l) => l.length));
    this.el.style.width = `calc(${longest + 2}ch)`;
    this.el.rows = Math.max(1, lines.length);
  }

  private close(commit: boolean): void {
    if (this.done) return;
    this.done = true;
    const r = this.req;
    const value = this.el.value;
    this.el.hidden = true;
    this.el.blur();
    this.req = null;
    if (commit && r && value !== r.value) r.commit(r.multiline ? value : value.replace(/\n/g, ' '));
  }
}
