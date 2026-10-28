import { addElements, updateParams } from '../../core/commands';
import type { Id } from '../../core/model';
import { targetAt, targetPoint, type LabelParams, type LabelTarget } from '../../elements/label';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import { pxToMm, type ToolHost } from './host';
import { snapMarker } from './overlay';
import { roundMm, snap, type SnapResult } from './snap';
import { objectAt } from './tagGrips';

/**
 * Littera-verktyget (0.10.20.2): klicka på det litteran ska peka på, sedan
 * där texten ska stå. Med Shift (eller Ctrl) läggs fler punkter till innan
 * texten placeras; de delar stammen. En punkt på ett objekt sitter fast i
 * det. *Lägg till ledare* (egenskaperna) använder samma verktyg för en
 * befintlig littera: varje klick ger en ledare till, Esc slutar.
 */
export class LabelTool implements ViewTool {
  cursor = 'crosshair';
  text = '{typ}';
  sort = '';
  /** Textens vridning i grader (0.10.22), eller null: stilmallens förval. */
  angle: number | null = null;
  /** En befintlig littera som får fler ledare. */
  addTo: Id | null = null;
  onChange?: () => void;
  onCreated?: (id: Id) => void;
  private host: ToolHost;
  private targets: LabelTarget[] = [];
  private at: SnapResult | null = null;
  private raw: Vec2 | null = null;

  constructor(host: ToolHost) {
    this.host = host;
  }

  get count(): number {
    return this.targets.length;
  }

  hintText(): string {
    if (this.addTo) return 'Klicka på det ledaren ska peka på. Esc när du är klar.';
    if (!this.targets.length) return 'Klicka på det litteran ska peka på.';
    return 'Klicka där texten ska stå. Shift+klick: en ledare till.';
  }

  reset(): void {
    this.targets = [];
    this.addTo = null;
    this.onChange?.();
  }

  down(): 'capture' {
    return 'capture';
  }

  hover(p: ViewPointer | null): void {
    this.raw = p?.model ?? null;
    this.at = p ? snap({ cursor: p.model, segments: this.host.snapSegments(), tol: pxToMm(this.host, 10) }) : null;
  }

  drag(p: ViewPointer): void {
    this.hover(p);
  }

  up(p: ViewPointer, moved: boolean): void {
    if (moved && p.pointerType === 'touch') return;
    this.click(p);
  }

  tap(p: ViewPointer): void {
    this.click(p);
  }

  private click(p: ViewPointer): void {
    this.hover(p);
    const doc = this.host.store.doc;
    const point = this.at && this.at.kind !== 'free' ? this.at.point : p.model;
    const target = (): LabelTarget => targetAt(doc, roundMm(point), objectAt(this.host, point));
    if (this.addTo) {
      const el = doc.elements[this.addTo];
      if (!el) return this.reset();
      const prev = (el.params as unknown as LabelParams).targets ?? [];
      updateParams(this.host.store, [el.id], { targets: [...prev, target()] }, 'Lägg till ledare');
      return;
    }
    if (!this.targets.length || p.shift || p.mod) {
      this.targets.push(target());
      this.onChange?.();
      return;
    }
    const id = this.create(this.targets, p.model);
    this.targets = [];
    this.onChange?.();
    this.onCreated?.(id);
  }

  /** En littera med punkterna och texten i `pos`, med verktygets text, sort och vridning. */
  private create(targets: LabelTarget[], pos: Vec2): Id {
    const params: LabelParams = { pos: roundMm(pos), text: this.text, targets, ...(this.sort.trim() ? { sort: this.sort.trim() } : {}), ...(this.angle !== null ? { angle: this.angle } : {}) };
    const [el] = addElements(
      this.host.store,
      [{ type: 'Label', storey: this.host.storey(), ...(this.host.space?.() ? { space: this.host.space!() } : {}), tags: [], params: params as unknown as Record<string, unknown>, props: {} }],
      this.host.activeState(),
      'Littera',
    );
    return el.id;
  }

  /**
   * En littera som pekar på punkten `at` (fast i objektet där) med texten i
   * `pos` (smartspöt, 0.10.23).
   */
  createFor(at: Vec2, pos: Vec2): Id {
    const doc = this.host.store.doc;
    const id = this.create([targetAt(doc, roundMm(at), objectAt(this.host, at))], pos);
    this.onCreated?.(id);
    return id;
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    if (this.at && this.at.kind !== 'free') out.push(snapMarker(cam, this.at));
    const doc = this.host.store.doc;
    const pts = this.targets.map((t) => targetPoint(doc, t).at);
    if (this.raw && pts.length && !this.addTo) {
      const c = cam.toScreen(this.raw);
      for (const q of pts) {
        const s = cam.toScreen(q);
        out.push(`<path d="M${c[0]} ${c[1]}L${s[0]} ${s[1]}" class="rubber"/>`, `<circle cx="${s[0]}" cy="${s[1]}" r="3.5" class="chain-pt"/>`);
      }
      out.push(`<text x="${c[0] + 6}" y="${c[1] - 6}" class="text-preview">${escape(this.text.split('\n')[0] || '…')}</text>`);
    }
    return out.join('');
  }
}

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
