import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import type { AppContext } from '../app/context';
import { escapeHtml } from '../labels';
import { pxToMm } from '../tools/host';
import { wandActions, type WandContext, type WandHit } from './wand';

/**
 * Smartspöt som verktyg (0.10.22): ligger över verktyget man står i. Vid
 * hovring visas det troligaste förslaget; Tab växlar, klick utför, och
 * Shift+klick samlar fler som utförs med nästa klick utan Shift (i Markera
 * läggs de till i markeringen direkt). Esc eller Q stänger spöet.
 */
export class WandTool implements ViewTool {
  cursor = 'crosshair';
  private hits: WandHit[] = [];
  private index = 0;
  private at: Vec2 | null = null;
  private screen: Vec2 | null = null;
  /** Pekaren senast, så att Tab direkt efter ett klick kan räkna om förslagen (0.10.22.1). */
  private last: ViewPointer | null = null;
  /** Förslag samlade med Shift, som utförs med nästa klick. */
  private pending: WandHit[] = [];
  /** Signaturen för förslagen, så att Tab-valet ligger kvar medan markören rör sig längs samma sak. */
  private sig = '';

  private app: AppContext;

  constructor(app: AppContext) {
    this.app = app;
  }

  /** Förslaget som gäller just nu. */
  get current(): WandHit | null {
    return this.hits[this.index] ?? null;
  }

  get count(): number {
    return this.hits.length;
  }

  get collected(): number {
    return this.pending.length;
  }

  reset(): void {
    this.hits = [];
    this.index = 0;
    this.pending = [];
    this.at = null;
    this.last = null;
    this.sig = '';
  }

  /** Nästa (eller förra) förslag där markören står. Efter ett klick utan rörelse räknas förslagen om först. */
  cycle(back = false): boolean {
    if (!this.hits.length && this.last) this.find(this.last);
    if (this.hits.length < 2) return false;
    this.index = (this.index + (back ? this.hits.length - 1 : 1)) % this.hits.length;
    this.app.view.requestRender();
    return true;
  }

  private ctx(p: ViewPointer): WandContext {
    return { app: this.app, at: p.model, tol: pxToMm(this.app.host, p.pointerType === 'touch' ? 18 : 10), shift: p.shift };
  }

  private find(p: ViewPointer): void {
    const ctx = this.ctx(p);
    this.last = p;
    this.at = p.model;
    this.screen = p.screen;
    const hits: WandHit[] = [];
    for (const a of wandActions(this.app.ui.tool)) {
      try {
        hits.push(...a.find(ctx));
      } catch (e) {
        console.error('Smartspöt', a.id, e);
      }
    }
    const sig = hits.map((h) => `${h.label}|${h.what ?? ''}|${(h.preview.lines ?? []).map((l) => l.points.length).join(',')}|${(h.preview.ids ?? []).length}`).join(';');
    if (sig !== this.sig) this.index = 0;
    this.sig = sig;
    this.hits = hits;
  }

  down(): 'capture' {
    return 'capture';
  }

  hover(p: ViewPointer | null): void {
    if (p) this.find(p);
    else {
      this.hits = [];
      this.at = null;
    }
    this.app.view.requestRender();
  }

  drag(p: ViewPointer): void {
    this.find(p);
    this.app.view.requestRender();
  }

  up(p: ViewPointer, moved: boolean): void {
    if (moved) return;
    this.find(p);
    const hit = this.current;
    const select = this.app.ui.tool === 'select';
    if (p.shift && !select) {
      if (hit) this.pending.push(hit);
      this.app.view.requestRender();
      return;
    }
    const todo = [...this.pending, ...(hit ? [hit] : [])];
    this.pending = [];
    if (!todo.length) {
      this.app.hint('Inget att följa här. Peka på en kant eller i en yta; Tab växlar mellan förslagen.', 3000);
      return;
    }
    for (const h of todo) h.apply(p.shift);
    // Det som just lagts ska kunna pekas på igen: räkna om vid nästa rörelse.
    this.hits = [];
    this.sig = '';
    this.app.view.requestRender();
  }

  /** Utför de samlade förslagen (Enter). */
  flush(): boolean {
    if (!this.pending.length) return false;
    const todo = this.pending;
    this.pending = [];
    for (const h of todo) h.apply(true);
    this.app.view.requestRender();
    return true;
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    const path = (pts: readonly Vec2[], closed: boolean, cls: string): void => {
      if (pts.length < 2) return;
      const s = pts.map((q) => cam.toScreen(q));
      out.push(`<path d="M${s.map((q) => `${q[0]} ${q[1]}`).join('L')}${closed ? 'Z' : ''}" class="${cls}"/>`);
    };
    const ids = (list: readonly string[], cls: string): void => {
      const want = new Set(list);
      for (const pk of this.app.plan.pickables) {
        if (!want.has(pk.id)) continue;
        for (const rings of pk.regions) for (const r of rings) path(r, true, cls);
        for (const q of pk.prims) {
          if (q.kind === 'line') path([q.a, q.b], false, cls);
          else if (q.kind === 'polyline') path(q.points, q.closed, cls);
        }
      }
    };
    for (const h of this.pending) {
      for (const l of h.preview.lines ?? []) path(l.points, l.closed, 'wand-line wand-pending');
      if (h.preview.ids) ids(h.preview.ids, 'wand-line wand-pending');
    }
    const cur = this.current;
    if (cur) {
      for (const l of cur.preview.lines ?? []) {
        path(l.points, l.closed, 'wand-line');
        // Riktningen, där det spelar roll (vilken sida en vägg eller mur hamnar på).
        if (l.points.length >= 2) {
          const a = cam.toScreen(l.points[0]);
          out.push(`<circle cx="${a[0]}" cy="${a[1]}" r="3.5" class="chain-pt"/>`);
        }
      }
      if (cur.preview.ids) ids(cur.preview.ids, 'wand-line');
    }
    if (this.screen && this.at) {
      const [x, y] = this.screen;
      const text = cur
        ? `${cur.label}${cur.what ? ` · ${cur.what}` : ''}${this.hits.length > 1 ? `  (Tab ${this.index + 1}/${this.hits.length})` : ''}`
        : 'Smartspöt: peka på en kant eller i en yta';
      const extra = this.pending.length ? `  · ${this.pending.length} samlade, klicka eller Enter` : '';
      out.push(`<path d="M${x + 4} ${y + 4}l9 9" class="wand-cursor"/><path d="M${x + 1} ${y - 3}v-4M${x - 3} ${y + 1}h-4M${x + 4} ${y - 2}l3 -3M${x - 2} ${y + 4}l-3 3" class="wand-spark"/>`);
      // Nära högerkanten står texten till vänster om markören.
      const flip = x > cam.width * 0.55;
      out.push(`<text x="${flip ? x - 8 : x + 16}" y="${y + 24}"${flip ? ' text-anchor="end"' : ''} class="snap-label">${escapeHtml(text + extra)}</text>`);
    }
    return out.join('');
  }
}
