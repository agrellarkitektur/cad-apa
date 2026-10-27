import { addElement, updateParams } from '../../core/commands';
import { statesForNewElement } from '../../core/states';
import type { Element } from '../../core/model';
import { newId } from '../../core/ids';
import type { MarkerParams } from '../../elements/markers';
import { dist, distToSegment, left, norm, sub } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import { pxToMm, type ToolHost } from './host';
import { lengthLabel, snapMarker } from './overlay';
import { nearSegments, roundMm, snap, type SnapResult, type SnapSegment } from './snap';
import type { PointTaker } from '../pointInput';

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });

/**
 * Sektion och fasad (0.7): klicka linjens början och slut, och sedan på den
 * sida som ska synas. Sektioner får nästa lediga
 * bokstav; fasader namnges efter väderstrecket de vetter mot.
 */
export class MarkerTool implements ViewTool, PointTaker {
  cursor = 'crosshair';
  private host: ToolHost;
  private kind: 'Section' | 'Elevation';
  private a: Vec2 | null = null;
  private b: Vec2 | null = null;
  private current: SnapResult | null = null;
  /**
   * Fasadverktyget ritar i stället linjen *Beräkningsgrundande fasad*
   * (0.10.8b): två klick längs fasadlivet, ingen sida.
   */
  basis = false;
  /** Ett nytt element har lagts till. */
  onCreated?: (id: string) => void;
  onChange?: () => void;

  constructor(host: ToolHost, kind: 'Section' | 'Elevation') {
    this.host = host;
    this.kind = kind;
  }

  get step(): 0 | 1 | 2 {
    return !this.a ? 0 : !this.b ? 1 : 2;
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
  }

  private track(p: ViewPointer): void {
    if (this.b) {
      this.current = { point: p.model, kind: 'free', label: '' };
      return;
    }
    if (this.a && this.lockAngle !== null) {
      this.current = lockedAt(this.a, this.lockAngle, p.model);
      return;
    }
    this.current = snap({
      cursor: p.model,
      from: this.a ?? undefined,
      segments: this.host.snapSegments(),
      tol: pxToMm(this.host, p.pointerType === 'touch' ? 18 : 10),
      ortho: p.shift,
    });
  }

  up(p: ViewPointer): void {
    this.track(p);
    this.click(this.current ? roundMm(this.current.point) : roundMm(p.model), p.model);
  }

  private click(pt: Vec2, side: Vec2): void {
    if (!this.a) {
      this.a = pt;
    } else if (!this.b) {
      if (dist(this.a, pt) < 300) {
        this.host.hint('Linjen måste vara minst 300 mm lång.');
        return;
      }
      this.b = pt;
      this.lockAngle = null;
      if (this.basis) this.commitBasis();
    } else {
      this.commit(side);
    }
    this.onChange?.();
  }

  cancel(): void {}

  // Skrivna punkter i smartshell (0.8.21). Den tredje punkten anger sidan.
  lockAngle: number | null = null;

  lastPoint(): Vec2 | undefined {
    return this.b ?? this.a ?? undefined;
  }

  cursorPoint(): Vec2 | undefined {
    return this.current?.point;
  }

  takePoint(p: Vec2): void {
    this.click(roundMm(p), p);
    this.host.view.requestRender();
  }

  hintText(): string {
    if (this.basis) return this.step === 0 ? 'Klicka där den beräkningsgrundande fasaden börjar, på fasadlivet.' : 'Klicka där den slutar. Byggnadshöjden mäts sedan mot den fasaden.';
    const what = this.kind === 'Section' ? 'sektionsmarkören' : 'fasadmarkören';
    return this.step === 0 ? `Klicka där ${what} börjar.` : this.step === 1 ? `Klicka där ${what} slutar.` : 'Klicka på den sida som ska synas.';
  }

  /** Ett steg tillbaka (Ångra i smartshell, 0.8.21). */
  back(): void {
    if (this.b) this.b = null;
    else this.a = null;
    this.onChange?.();
    this.host.view.requestRender();
  }

  reset(): void {
    this.a = null;
    this.b = null;
    this.onChange?.();
  }

  private sideOf(at: Vec2): 1 | -1 {
    const u = norm(sub(this.b!, this.a!));
    const l = left(u);
    return (at[0] - this.a![0]) * l[0] + (at[1] - this.a![1]) * l[1] >= 0 ? 1 : -1;
  }

  private commit(at: Vec2): void {
    const doc = this.host.store.doc;
    const params: MarkerParams = { start: [this.a![0], this.a![1]], end: [this.b![0], this.b![1]], side: this.sideOf(at), depth: null, auto: false };
    if (this.kind === 'Section') params.label = nextLetter(Object.values(doc.elements).filter((e) => e.type === 'Section').map((e) => String(e.params.label ?? '')));
    const el = addElement(this.host.store, { type: this.kind, storey: this.host.storey(), tags: [], params: params as unknown as Record<string, unknown>, props: {} }, this.host.activeState());
    this.a = null;
    this.b = null;
    this.onCreated?.(el.id);
  }

  /** Linjen *Beräkningsgrundande fasad*: den gamla tas bort i samma steg. */
  private commitBasis(): void {
    const store = this.host.store;
    const old = Object.values(store.doc.elements).filter((e) => e.type === 'BasisFacade');
    const el: Element = { id: newId('el'), type: 'BasisFacade', storey: this.host.storey(), tags: [], states: statesForNewElement(store.doc, this.host.activeState()), params: { start: [this.a![0], this.a![1]], end: [this.b![0], this.b![1]] }, props: {} } as Element;
    store.transact('Beräkningsgrundande fasad', (tx) => {
      for (const o of old) tx.removeElement(o.id);
      tx.putElement(el);
    });
    this.a = null;
    this.b = null;
    if (old.length) this.host.hint('Den beräkningsgrundande fasaden är flyttad hit; det finns bara en i projektet.', 4000);
    this.onCreated?.(el.id);
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    const cur = this.current?.point;
    if (this.a && !this.b && cur) {
      const a = cam.toScreen(this.a);
      const b = cam.toScreen(cur);
      out.push(`<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" class="rubber"/>`);
      out.push(lengthLabel(cam, this.a, cur, `${nf.format(Math.round(dist(this.a, cur)))} mm`));
    }
    if (this.a && this.b) {
      const a = cam.toScreen(this.a);
      const b = cam.toScreen(this.b);
      out.push(`<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" class="rubber"/>`);
      if (cur) {
        // Pilar åt det håll man kommer att se.
        const s = this.sideOf(cur);
        const u = norm(sub(this.b, this.a));
        const l = left(u);
        for (const q of [this.a, this.b]) {
          const tip = cam.toScreen([q[0] + l[0] * s * 900, q[1] + l[1] * s * 900]);
          const base = cam.toScreen(q);
          out.push(`<path d="M${base[0]} ${base[1]}L${tip[0]} ${tip[1]}" class="rubber"/><circle cx="${tip[0]}" cy="${tip[1]}" r="4" class="snap-dot"/>`);
        }
      }
    }
    if (this.current && !this.b) out.push(snapMarker(cam, this.current));
    return out.join('');
  }
}

/** Nästa lediga bokstav för en sektion: A, B, C … */
export function nextLetter(used: string[]): string {
  for (let i = 0; i < 26; i++) {
    const l = String.fromCharCode(65 + i);
    if (!used.includes(l)) return l;
  }
  return `A${used.length}`;
}

/** Markörens punkt längs en låst riktning från `from` (<45 i smartshell). */
function lockedAt(from: Vec2, deg: number, at: Vec2): SnapResult {
  const r = (deg * Math.PI) / 180;
  const dir: Vec2 = [Math.cos(r), Math.sin(r)];
  const len = Math.max(0, (at[0] - from[0]) * dir[0] + (at[1] - from[1]) * dir[1]);
  const point: Vec2 = [from[0] + dir[0] * len, from[1] + dir[1] * len];
  return { point, kind: 'angle', label: `${deg.toLocaleString('sv-SE')}°`, guide: [from, [from[0] + dir[0] * (len * 3 + 2000), from[1] + dir[1] * (len * 3 + 2000)]] };
}


/**
 * Rikta efter objekt (0.7.1): klicka på en vägg eller linje, så vrids en
 * sektions- eller fasadmarkör runt sin mitt och blir parallell med den
 * (sedan 0.8 även sektioner); med Shift vinkelrät. Blickriktningen behålls
 * så långt det går.
 */
export class AlignTool implements ViewTool {
  cursor = 'pointer';
  private host: ToolHost;
  private hoverSeg: SnapSegment | null = null;
  /** Linjen som ska riktas. */
  target: string | null = null;
  onDone?: (aligned: boolean) => void;

  constructor(host: ToolHost) {
    this.host = host;
  }

  down(): 'capture' {
    return 'capture';
  }

  hover(p: ViewPointer | null): void {
    this.hoverSeg = p ? this.segAt(p) : null;
  }

  drag(p: ViewPointer): void {
    this.hoverSeg = this.segAt(p);
  }

  up(p: ViewPointer): void {
    const seg = this.segAt(p);
    const el = this.target ? this.host.store.doc.elements[this.target] : undefined;
    if (!seg || !el) {
      this.onDone?.(false);
      return;
    }
    const mp = el.params as unknown as MarkerParams;
    const parallel = !p.shift;
    let dir = norm(sub(seg.b, seg.a));
    if (!parallel) dir = left(dir);
    // Välj den av de två riktningarna som ligger närmast den nuvarande.
    const cur = norm(sub(mp.end, mp.start));
    if (dir[0] * cur[0] + dir[1] * cur[1] < 0) dir = [-dir[0], -dir[1]];
    const half = dist(mp.start, mp.end) / 2;
    const m: Vec2 = [(mp.start[0] + mp.end[0]) / 2, (mp.start[1] + mp.end[1]) / 2];
    const start = roundMm([m[0] - dir[0] * half, m[1] - dir[1] * half]);
    const end = roundMm([m[0] + dir[0] * half, m[1] + dir[1] * half]);
    updateParams(this.host.store, [el.id], { start: [start[0], start[1]], end: [end[0], end[1]] }, 'Rikta efter objekt');
    this.onDone?.(true);
  }

  cancel(): void {
    this.hoverSeg = null;
  }

  private segAt(p: ViewPointer): SnapSegment | null {
    const tol = pxToMm(this.host, p.pointerType === 'touch' ? 18 : 10);
    let best: { s: SnapSegment; d: number } | null = null;
    // Bara sträckorna nära markören (0.8.23), i listans ordning.
    for (const s of nearSegments(this.host.snapSegments(), p.model, tol)) {
      if (s.id === this.target) continue;
      const d = distToSegment(p.model, s.a, s.b);
      if (d <= tol && (!best || d < best.d)) best = { s, d };
    }
    return best?.s ?? null;
  }

  overlay(cam: Camera): string {
    if (!this.hoverSeg) return '';
    const a = cam.toScreen(this.hoverSeg.a);
    const b = cam.toScreen(this.hoverSeg.b);
    return `<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" class="snap-guide align-pick"/>`;
  }
}

