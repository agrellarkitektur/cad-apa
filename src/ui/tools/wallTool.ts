import { addElements, reversedWall } from '../../core/commands';
import type { Id } from '../../core/model';
import { resolveParams } from '../../elements/registry';
import { wallFrame, type WallParams } from '../../elements/wall';
import { wallsFacingOut, type WallFace } from '../../elements/wallSides';
import { add, angleDeg, dist, dot, fromAngleDeg, norm, scale, sub } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import { pxToMm, type ToolHost } from './host';
import { lengthLabel, snapMarker } from './overlay';
import { roundMm, snap, type SnapResult } from './snap';

export interface WallToolOptions {
  /** Väggtypens id (littera). */
  definition: Id | null;
  /**
   * Vilket liv den ritade linjen ligger i. Medan man ritar antas att man går
   * medurs; när väggen är klar vänds de väggar som hamnade fel.
   */
  face: WallFace;
  height: number;
}

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });

/**
 * Väggverktyget: klicka (eller tryck) punkt för punkt. Varje sträcka blir en
 * vägg direkt, så att ångra tar bort en i taget. Skriv en längd och tryck
 * Enter för exakt mått i den riktning markören pekar. Avsluta med Esc,
 * dubbelklick, Enter utan längd, knappen Klar, eller genom att klicka på
 * startpunkten.
 */
export class WallTool implements ViewTool {
  cursor = 'crosshair';
  readonly options: WallToolOptions;
  private host: ToolHost;
  private chain: [number, number][] = [];
  private current: SnapResult | null = null;
  private lastUp = { t: 0, at: [0, 0] as Vec2 };
  /** Väggarna i kedjan som ritas just nu. */
  private created: Id[] = [];
  /** Inskriven vinkel i grader: nästa vägg går i den riktningen. */
  lockAngle: number | null = null;
  /** Anropas när kedjan börjar eller slutar, så att gränssnittet kan visa rätt knappar. */
  onChange?: () => void;

  constructor(host: ToolHost, options: WallToolOptions) {
    this.host = host;
    this.options = options;
  }

  get drawing(): boolean {
    return this.chain.length > 0;
  }

  /** Väggar ritade i kedjan som pågår. */
  get placed(): number {
    return this.created.length;
  }

  /** Börja kedjan i en given punkt, t.ex. en väggs ände (0.8.4). */
  startAt(pt: [number, number]): void {
    this.chain = [pt];
    this.created = [];
    this.lockAngle = null;
    this.current = null;
    this.onChange?.();
    this.host.view.requestRender();
  }

  down(): 'capture' {
    return 'capture';
  }

  drag(p: ViewPointer): void {
    this.track(p);
  }

  hover(p: ViewPointer | null): void {
    if (p) this.track(p);
    else if (!this.drawing) this.current = null;
  }

  up(p: ViewPointer): void {
    this.track(p);
    const now = performance.now();
    const double = now - this.lastUp.t < 350 && dist(p.screen, this.lastUp.at) < 8;
    this.lastUp = { t: now, at: p.screen };
    if (double && this.drawing) {
      this.finish();
      return;
    }
    if (this.current) this.place(roundMm(this.current.point));
  }

  cancel(): void {
    // En avbruten gest (t.ex. nypning) ska inte sätta en punkt.
  }

  /**
   * Placera nästa punkt på en inskriven längd, i den inskrivna vinkeln om det
   * finns en, annars i markörens riktning.
   */
  placeLength(mm: number): boolean {
    const last = this.chain.at(-1);
    if (!last || !(mm > 0)) return false;
    let dir: Vec2;
    if (this.lockAngle !== null) dir = fromAngleDeg(this.lockAngle);
    else {
      if (!this.current) return false;
      const d = sub(this.current.point, last);
      if (Math.hypot(d[0], d[1]) < 1) return false;
      dir = norm(d);
    }
    this.place(roundMm(add(last, scale(dir, mm))));
    return true;
  }

  finish(): void {
    this.fixFaces();
    this.chain = [];
    this.created = [];
    this.onChange?.();
    this.host.view.requestRender();
  }

  /**
   * Ut- och insida går att avgöra först när väggarna finns. Ytterväggar som
   * ritats moturs vänds, så att insidan vetter in i huset och referenslinjen
   * ligger kvar i det liv man valt. Det ångras i samma steg som väggen.
   */
  private fixFaces(): void {
    if (!this.created.length) return;
    const doc = this.host.store.doc;
    const wrong = wallsFacingOut(doc, this.created);
    if (!wrong.length) return;
    this.host.store.transact(
      'Rita vägg',
      (tx) => {
        for (const w of wrong) for (const e of reversedWall(tx.doc, tx.doc.elements[w.id], false)) tx.putElement(e);
      },
      { merge: true },
    );
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    const last = this.chain.at(-1);
    const cur = this.current;
    if (last && cur && dist(last, cur.point) > 1) {
      const params = this.previewParams(last, roundMm(cur.point));
      const f = wallFrame(params);
      const pts = [f.at(0, -f.half), f.at(f.length, -f.half), f.at(f.length, f.half), f.at(0, f.half)].map((q) => cam.toScreen(q));
      out.push(`<path d="M${pts.map((q) => `${q[0]} ${q[1]}`).join('L')}Z" class="wall-preview"/>`);
      const a = cam.toScreen(last);
      const b = cam.toScreen(cur.point);
      out.push(`<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" class="rubber"/>`);
      const deg = Math.round(angleDeg(sub(cur.point, last)) * 10) / 10;
      out.push(lengthLabel(cam, last, cur.point, `${nf.format(Math.round(dist(last, cur.point)))} mm  ${(deg === 360 ? 0 : deg).toLocaleString('sv-SE')}°`));
    }
    for (const p of this.chain) {
      const s = cam.toScreen(p);
      out.push(`<circle cx="${s[0]}" cy="${s[1]}" r="3.5" class="chain-pt"/>`);
    }
    if (cur) out.push(snapMarker(cam, cur));
    return out.join('');
  }

  private track(p: ViewPointer): void {
    const last = this.chain.at(-1);
    if (last && this.lockAngle !== null) {
      // Låst vinkel: punkten följer markören men bara längs vinkelns linje.
      const dir = fromAngleDeg(this.lockAngle);
      const len = Math.max(0, dot(sub(p.model, last), dir));
      const point = add(last, scale(dir, len));
      this.current = { point, kind: 'angle', label: `${this.lockAngle.toLocaleString('sv-SE')}°`, guide: [last, add(last, scale(dir, len * 3 + 2000))] };
      return;
    }
    this.current = snap({
      cursor: p.model,
      from: this.chain.at(-1),
      chainStart: this.chain.length >= 2 ? this.chain[0] : undefined,
      segments: this.host.snapSegments(),
      tol: pxToMm(this.host, p.pointerType === 'touch' ? 18 : 10),
      ortho: p.shift,
    });
  }

  private place(pt: [number, number]): void {
    const last = this.chain.at(-1);
    if (!last) {
      this.chain = [pt];
      this.onChange?.();
      return;
    }
    if (dist(last, pt) < 1) return;
    const closes = this.chain.length >= 2 && dist(this.chain[0], pt) < 1;
    const [wall] = addElements(
      this.host.store,
      [
        {
          type: 'Wall',
          storey: this.host.storey(),
          tags: [],
          definition: this.options.definition ?? undefined,
          params: this.instanceParams(last, closes ? this.chain[0] : pt),
          props: {},
        },
      ],
      this.host.activeState(),
      'Rita vägg',
    );
    this.created.push(wall.id);
    this.lockAngle = null;
    this.onChange?.();
    if (closes) {
      this.finish();
      return;
    }
    this.chain.push(pt);
  }

  private instanceParams(a: [number, number], b: [number, number]): Record<string, unknown> {
    const p: Record<string, unknown> = { start: a, end: b, height: this.options.height, justification: this.justification() };
    if (!this.options.definition) p.thickness = 120;
    return p;
  }

  /** Medurs är insidan till höger: utsida-linjen har väggen till höger om sig. */
  private justification(): WallParams['justification'] {
    return this.options.face === 'center' ? 'center' : this.options.face === 'outside' ? 'right' : 'left';
  }

  private previewParams(a: [number, number], b: [number, number]): WallParams {
    const fake = {
      id: 'preview',
      type: 'Wall',
      storey: '',
      states: [],
      tags: [],
      definition: this.options.definition ?? undefined,
      params: this.instanceParams(a, b),
      props: {},
    };
    return resolveParams<WallParams>(this.host.store.doc, fake);
  }
}
