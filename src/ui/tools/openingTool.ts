import { addElements } from '../../core/commands';
import type { Element, Id } from '../../core/model';
import { actionOf } from '../../core/states';
import { resolveParams } from '../../elements/registry';
import { holeHeight, holeWidth, wallFrame, type OpeningParams, type WallFrame, type WallParams } from '../../elements/wall';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import { pxToMm, type ToolHost } from './host';
import { openingModelOf, uMapping, viewFace, type OpeningObjParams } from '../../elements/openingSpec';
import { outsideSide } from '../../elements/wallSides';

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });

export interface OpeningToolOptions {
  /** Typen som sätts in. */
  definition: Id | null;
  /** Modulmåttet (mm), eller null för typens förval. */
  module?: [number, number] | null;
  /** Eget karmyttermått (mm), när det inte följer modulen. */
  frame?: [number, number] | null;
  /** Höjdläget för fönster: överkant karm (förval) eller bröstning, med värdet; null = stilbokens/typens. */
  heightRef?: 'head' | 'sill';
  height?: number | null;
  /** *Spegla* (S): hängningen spegelvänd mot typen (sedd utifrån). */
  mirror?: boolean;
  /** Karmens läge och avståndet. */
  place?: 'out' | 'in' | 'mid' | null;
  inset?: number | null;
}

interface Placement {
  wall: Element;
  f: WallFrame;
  at: number;
  width: number;
  /** Sidan markören är på: 1 = vänster om väggens riktning. */
  side: 1 | -1;
  hinge: 'start' | 'end';
  /** Krockar med en annan öppning i väggen. */
  blocked: boolean;
  label: string;
}

/**
 * Sätt in dörrar och fönster: peka på en vägg och klicka. För dörrar blir
 * sidan man pekar på öppningssidan och gångjärnen hamnar på den sida av
 * mitten man pekar på. Läget snäpper mot väggens mitt och till hela 10 mm,
 * och avståndet till väggens ändar visas medan man pekar.
 */
export class OpeningTool implements ViewTool {
  cursor = 'crosshair';
  readonly kind: 'Door' | 'Window' | 'WallHole';
  readonly options: OpeningToolOptions;
  private host: ToolHost;
  private place: Placement | null = null;

  constructor(host: ToolHost, kind: 'Door' | 'Window' | 'WallHole', options: OpeningToolOptions) {
    this.host = host;
    this.kind = kind;
    this.options = options;
  }

  down(): 'capture' {
    return 'capture';
  }

  drag(p: ViewPointer): void {
    this.track(p);
  }

  hover(p: ViewPointer | null): void {
    if (p) this.track(p);
    else this.place = null;
  }

  up(p: ViewPointer, moved: boolean): void {
    this.track(p);
    if (moved && p.pointerType === 'touch') return;
    this.insert();
  }

  tap(p: ViewPointer): void {
    this.track(p);
    this.insert();
  }

  cancel(): void {
    this.place = null;
  }

  private insert(): void {
    const pl = this.place;
    if (!pl) {
      this.host.hint(`Peka på en vägg för att sätta in ${this.kind === 'Door' ? 'dörren' : this.kind === 'Window' ? 'fönstret' : 'vägghålet'}.`);
      return;
    }
    if (pl.blocked) {
      this.host.hint('Öppningen krockar med en annan öppning i väggen.');
      return;
    }
    const o = this.options;
    const doc = this.host.store.doc;
    const params: Record<string, unknown> = { at: Math.round(pl.at), ...this.sizeParams() };
    const m = openingModelOf(doc, { type: this.kind, definition: o.definition ?? undefined });
    const outside = outsideSide(doc, pl.wall);
    if (this.kind === 'WallHole') {
      // Vägghålet (0.11.8.3): underkanten över golvet, och nischen på den sida man pekar på.
      params.swing = pl.side;
      params.hinge = 'start';
      if (o.height !== null && o.height !== undefined) params.sill = o.height;
    } else if (this.kind === 'Door') {
      params.swing = pl.side;
      // Gångjärnen närmast markören; *Spegla* byter.
      params.hinge = o.mirror ? (pl.hinge === 'start' ? 'end' : 'start') : pl.hinge;
    } else {
      // Fönstret som typen är ritad, sett utifrån; *Spegla* byter.
      const vf = viewFace(outside, 'window', undefined);
      const natural = uMapping(m, vf, 'start', 0, 1).mirrored ? 'end' : 'start';
      params.hinge = o.mirror ? (natural === 'start' ? 'end' : 'start') : natural;
      if (o.height !== null && o.height !== undefined) {
        if (o.heightRef === 'sill') params.sill = o.height;
        else params.head = o.height;
      }
      if (o.heightRef) params.heightRef = o.heightRef;
    }
    if (o.place) params.place = o.place;
    if (o.inset !== null && o.inset !== undefined) params.inset = o.inset;
    addElements(
      this.host.store,
      [{ type: this.kind, storey: this.host.storey(), tags: [], host: pl.wall.id, definition: o.definition ?? undefined, params, props: {} }],
      this.host.activeState(),
      this.kind === 'Door' ? 'Sätt in dörr' : this.kind === 'Window' ? 'Sätt in fönster' : 'Sätt in vägghål',
    );
  }

  /** Måtten verktyget sätter: modulmåttet och ett eget karmyttermått. */
  sizeParams(): Record<string, unknown> {
    const o = this.options;
    const out: Record<string, unknown> = {};
    if (o.module) {
      out.width = o.module[0];
      out.height = o.module[1];
    }
    if (o.frame) out.frame = o.frame;
    return out;
  }

  /** Det objektet skulle få, räknat som ett riktigt objekt (karmytter- och hålmått). */
  preview(): OpeningObjParams {
    const fake = { id: 'preview', type: this.kind, storey: '', states: [], tags: [], definition: this.options.definition ?? undefined, params: this.sizeParams(), props: {} };
    return resolveParams<OpeningObjParams>(this.host.store.doc, fake);
  }

  private width(): number {
    return this.preview().holeW;
  }

  private track(p: ViewPointer): void {
    const doc = this.host.store.doc;
    const view = { state: this.host.activeState() };
    const width = this.width();
    const extra = pxToMm(this.host, p.pointerType === 'touch' ? 24 : 12);
    let best: { el: Element; f: WallFrame; s: number; o: number; d: number } | null = null;
    for (const el of Object.values(doc.elements)) {
      if (el.type !== 'Wall' || el.storey !== this.host.storey() || actionOf(el, view) === 'absent') continue;
      const f = wallFrame(resolveParams<WallParams>(doc, el));
      const [s, o] = f.project(p.model);
      if (s < 0 || s > f.length) continue;
      const d = Math.abs(o) - f.half;
      if (d > extra) continue;
      if (!best || d < best.d) best = { el, f, s, o, d };
    }
    if (!best || best.f.length < width + 20) {
      this.place = null;
      return;
    }
    const { el, f } = best;
    // Läget: mitten av väggen om man är nära, annars hela 10 mm.
    const min = width / 2 + 10;
    const max = f.length - width / 2 - 10;
    let at = Math.min(max, Math.max(min, best.s));
    let label = '';
    if (Math.abs(at - f.length / 2) < pxToMm(this.host, 10)) {
      at = f.length / 2;
      label = 'Mitt på väggen';
    } else at = Math.round(at / 10) * 10;

    // Krockar den med en annan öppning i samma vägg?
    // Bara om de också möts i höjd (0.11.8.3): ett ventgaller kan sitta över ett fönster.
    const pv = this.preview();
    const oh = this.options.height;
    const z0 = this.kind === 'Door' ? 0 : oh === null || oh === undefined ? (pv.sill ?? 0) : this.kind === 'WallHole' || this.options.heightRef === 'sill' ? oh : oh - pv.frameH - pv.gap;
    const z1 = z0 + pv.holeH;
    const blocked = Object.values(doc.elements).some((o) => {
      if (o.host !== el.id || actionOf(o, view) === 'absent') return false;
      const op = resolveParams<OpeningParams & { sill?: number }>(doc, o);
      const a = o.type === 'Door' ? 0 : (op.sill ?? 0);
      const b = a + holeHeight(op);
      return Math.abs(op.at - at) < (holeWidth(op) + width) / 2 + 20 && a < z1 + 20 && b > z0 - 20;
    });
    const left = at - width / 2;
    const right = f.length - (at + width / 2);
    this.place = {
      wall: el,
      // I bågväggar sitter öppningen rak, längs tangenten.
      f: f.local(at),
      at,
      width,
      side: best.o >= 0 ? 1 : -1,
      hinge: best.s < at ? 'start' : 'end',
      blocked,
      label: `${nf.format(Math.round(left))}  ←  ${label || nf.format(width)}  →  ${nf.format(Math.round(right))}`,
    };
  }

  overlay(cam: Camera): string {
    const pl = this.place;
    if (!pl) return '';
    const { f, at, width } = pl;
    const s1 = at - width / 2;
    const s2 = at + width / 2;
    const pts = [f.at(s1, -f.half), f.at(s2, -f.half), f.at(s2, f.half), f.at(s1, f.half)].map((q) => cam.toScreen(q));
    const cls = pl.blocked ? 'opening-preview blocked' : 'opening-preview';
    const lineCls = pl.blocked ? 'opening-preview-line blocked-line' : 'opening-preview-line';
    const out = [`<path d="M${pts.map((q) => `${q[0]} ${q[1]}`).join('L')}Z" class="${cls}"/>`];
    if (this.kind === 'Door') {
      // Dörrbladet öppet 90° och slagbågen, på den sida man pekar.
      const hingeS = pl.hinge === 'start' ? s1 : s2;
      const freeS = pl.hinge === 'start' ? s2 : s1;
      const h = cam.toScreen(f.at(hingeS, pl.side * f.half));
      const tipModel: Vec2 = [
        f.at(hingeS, pl.side * f.half)[0] + f.n[0] * pl.side * width,
        f.at(hingeS, pl.side * f.half)[1] + f.n[1] * pl.side * width,
      ];
      const tip = cam.toScreen(tipModel);
      const free = cam.toScreen(f.at(freeS, pl.side * f.half));
      const r = width * cam.scale;
      // Bågens riktning beror på vilket håll den går på skärmen.
      const cross = (tip[0] - h[0]) * (free[1] - h[1]) - (tip[1] - h[1]) * (free[0] - h[0]);
      out.push(`<path d="M${h[0]} ${h[1]}L${tip[0]} ${tip[1]}A${r} ${r} 0 0 ${cross > 0 ? 1 : 0} ${free[0]} ${free[1]}" class="${lineCls}"/>`);
    } else {
      const a = cam.toScreen(f.at(s1, 0));
      const b = cam.toScreen(f.at(s2, 0));
      out.push(`<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" class="${lineCls}"/>`);
    }
    // Etiketten en bit ut från väggen på den sida man pekar.
    const face = cam.toScreen(f.at(at, -pl.side * f.half));
    const c: Vec2 = [face[0] - f.n[0] * pl.side * 34, face[1] + f.n[1] * pl.side * 34];
    const text = pl.label;
    const w = text.length * 7 + 14;
    out.push(`<g class="len-label"><rect x="${c[0] - w / 2}" y="${c[1] - 11}" width="${w}" height="22" rx="4"/><text x="${c[0]}" y="${c[1] + 4}" text-anchor="middle">${text}</text></g>`);
    return out.join('');
  }
}
