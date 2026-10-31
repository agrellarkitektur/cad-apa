import { addProfiles, defaultProfileDef } from '../../core/profiles';
import { anchorPoint, defaultProfileTypes, profileModel, profileSection, profileValues } from '../../core/profileTypes';
import type { Id } from '../../core/model';
import { tidyBulges } from '../../elements/groundLines';
import { placePoint } from '../../elements/profileBody';
import { chainThrough, nearestEdge, sideOf, simplify, type Chain } from '../../geometry/chains';
import { closestOnSegment, dist } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer, ViewTool } from '../../view2d/planView';
import type { PointTaker } from '../pointInput';
import { ChainInput } from './chainInput';
import { pxToMm, type ToolHost } from './host';
import { snapMarker } from './overlay';
import { nearSegments, roundMm, snap, type SnapResult } from './snap';

/** Banan: punkt för punkt, lodrät (pelare) eller längs en kant. */
export type ProfilePathMode = 'line' | 'plumb' | 'edge';

export interface ProfileToolOptions {
  mode: ProfilePathMode;
  def?: Id;
  /** Ankaret (typens nummer); utelämnat = typens förval. */
  anchor?: number;
  /** Linjen och kanten: referenslinjens höjd över golvet. */
  z: number;
  /** Pelaren: foten över golvet och höjden (utelämnad = till våningen ovanför). */
  level: number;
  height?: number;
  rotate: number;
  mirror: boolean;
}

/** En kant att lägga profilen längs: kedjan genom den och sidan mellan två hörn (som räckets). */
interface EdgeChain {
  id: Id;
  side: Chain;
  whole: Chain;
}

/** Verktygets val, delade med smartmenyn (*Profil längs kanten*, *Pelare här*): den senast valda typen och höjden gäller där också. */
export const profileToolOptions: ProfileToolOptions = { mode: 'line', z: 0, level: 0, rotate: 0, mirror: false };

/** Kanten närmast punkten (inte profilernas): kedjan genom den och sidan mellan två hörn. */
export function profileEdgeAt(host: ToolHost, at: Vec2, tol: number): EdgeChain | null {
  const doc = host.store.doc;
  const all = host.snapSegments().filter((q) => !q.ref && !q.point && doc.elements[q.id]?.type !== 'Profile');
  let best: { i: number; d: number } | null = null;
  for (const q of nearSegments(all, at, tol)) {
    const d = dist(closestOnSegment(at, q.a, q.b).point, at);
    if (d <= tol && (!best || d < best.d)) best = { i: all.indexOf(q), d };
  }
  if (!best) return null;
  const hit = all[best.i];
  const own = all.filter((q) => q.id === hit.id);
  const whole = simplify(chainThrough(own, own.indexOf(hit)));
  const side = whole.points.length > 2 || whole.closed ? sideOf(whole, nearestEdge(whole, at)) : whole;
  return { id: hit.id, side, whole };
}

/** Det gemensamma för ett nytt objekt: typen, ankaret, vridningen och speglingen. */
function baseOf(o: ProfileToolOptions): { definition?: Id; params: Record<string, unknown> } {
  return {
    ...(o.def ? { definition: o.def } : {}),
    params: { ...(o.anchor !== undefined ? { anchor: o.anchor } : {}), ...(o.rotate ? { rotate: o.rotate } : {}), ...(o.mirror ? { mirror: true } : {}) },
  };
}

/** En pelare i punkten, med verktygets typ, fot och höjd. */
export function addColumnAt(host: ToolHost, at: Vec2): Id[] {
  const o = profileToolOptions;
  const b = baseOf(o);
  const params = { ...b.params, path: 'plumb', line: [[Math.round(at[0]), Math.round(at[1])]], ...(o.level ? { level: o.level } : {}), ...(o.height ? { height: o.height } : {}) };
  return addProfiles(host.store, [{ storey: host.storey(), ...(b.definition ? { definition: b.definition } : {}), params }], [host.activeState()], 'Lägg till pelare').map((e) => e.id);
}

/** En profil längs en linje, på verktygets höjd. */
export function addProfileAlong(host: ToolHost, line: readonly Vec2[], bulges?: number[]): Id[] {
  const pts = line.map((q) => [Math.round(q[0]), Math.round(q[1])] as [number, number]);
  if (pts.length < 2) return [];
  const o = profileToolOptions;
  const b = baseOf(o);
  const params = { ...b.params, line: pts, ...(bulges ? { bulges } : {}), ...(o.z ? { z: pts.map(() => o.z) } : {}) };
  return addProfiles(host.store, [{ storey: host.storey(), ...(b.definition ? { definition: b.definition } : {}), params }], [host.activeState()], 'Lägg till profil').map((e) => e.id);
}

/**
 * Profilen (0.11.6). Tre banor: *Linje* klickar referenslinjen punkt för
 * punkt med bågar (Båge, G); *Lodrät* är en pelare: ett klick och en höjd
 * (förval till våningen ovanför); *Längs kant* tar en vägg, en
 * bjälklagskant, en linje eller en annan kant (Shift: hela konturen, Tab:
 * andra sidan). Typ, ankare, höjd, vridning och spegling i verktygsraden.
 */
export class ProfileTool implements ViewTool, PointTaker {
  cursor = 'crosshair';
  private host: ToolHost;
  readonly chain = new ChainInput();
  private lastUp = { t: 0, at: [0, 0] as Vec2 };
  private current: SnapResult | null = null;
  private other: EdgeChain | null = null;
  private shift = false;
  options: ProfileToolOptions = profileToolOptions;
  lockAngle: number | null = null;
  onCreated?: (ids: Id[]) => void;
  onChange?: () => void;

  constructor(host: ToolHost) {
    this.host = host;
  }

  get started(): boolean {
    return this.chain.count > 0;
  }

  get arc(): boolean {
    return this.chain.arc;
  }

  setArc(on: boolean): void {
    this.chain.arc = on;
    this.onChange?.();
    this.host.view.requestRender();
  }

  setMode(mode: ProfilePathMode): void {
    this.options.mode = mode;
    this.reset();
    this.host.view.requestRender();
  }

  /** Tab: andra sidan om banan. */
  flip(): void {
    this.options.mirror = !this.options.mirror;
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
    else this.other = null;
  }

  private otherAt(at: Vec2, tol: number): EdgeChain | null {
    return profileEdgeAt(this.host, at, tol);
  }

  private track(p: ViewPointer): void {
    const tol = pxToMm(this.host, p.pointerType === 'touch' ? 18 : 10);
    if (this.options.mode === 'edge') {
      this.shift = p.shift;
      this.other = this.otherAt(p.model, tol);
      this.current = null;
      return;
    }
    this.current = snap({ cursor: p.model, segments: this.host.snapSegments(), tol });
  }

  up(p: ViewPointer): void {
    this.track(p);
    if (this.options.mode === 'edge') {
      if (!this.other) {
        this.host.hint('Klicka på en kant: en vägg, ett bjälklag, en takfot eller en linje. Eller välj Linje för att rita banan fritt.');
        return;
      }
      const c = this.shift ? this.other.whole : this.other.side;
      this.createLine(c.closed ? [...c.points, c.points[0]] : c.points);
      return;
    }
    const pt = roundMm(this.current?.point ?? p.model);
    if (this.options.mode === 'plumb') {
      this.createColumn(pt);
      return;
    }
    const now = performance.now();
    const double = now - this.lastUp.t < 350 && dist(p.screen, this.lastUp.at) < 8;
    this.lastUp = { t: now, at: p.screen };
    if (double && this.chain.count >= 2 && !this.chain.waiting) {
      this.finish();
      return;
    }
    this.chain.click(pt, -1);
    this.onChange?.();
  }

  /** En pelare i punkten. */
  createColumn(at: Vec2): Id[] {
    return this.created(addColumnAt(this.host, at));
  }

  /** Avsluta linjen. */
  finish(): void {
    if (this.chain.waiting) this.chain.undo();
    const { points: line, bulges: raw } = this.chain.result();
    const bulges = tidyBulges(raw, line.length);
    this.chain.reset();
    this.onChange?.();
    if (line.length < 2) return;
    this.createLine(line, bulges);
  }

  /** En profil längs en färdig linje, på verktygets höjd. */
  createLine(line: readonly Vec2[], bulges?: number[]): Id[] {
    return this.created(addProfileAlong(this.host, line, bulges));
  }

  private created(ids: Id[]): Id[] {
    this.onCreated?.(ids);
    return ids;
  }

  undoPoint(): void {
    this.chain.undo();
    this.onChange?.();
    this.host.view.requestRender();
  }

  lastPoint(): Vec2 | undefined {
    return this.chain.last();
  }

  cursorPoint(): Vec2 | undefined {
    return this.current?.point;
  }

  takePoint(p: Vec2): void {
    if (this.options.mode === 'edge') this.setMode('line');
    const pt = roundMm(p);
    if (this.options.mode === 'plumb') this.createColumn(pt);
    else {
      this.chain.click(pt, -1);
      this.onChange?.();
    }
    this.host.view.requestRender();
  }

  hintText(): string {
    if (this.options.mode === 'edge') return 'Klicka på en kant: en vägg, ett bjälklag, en takfot eller en linje. Shift+klick tar hela konturen, Tab byter sida.';
    if (this.options.mode === 'plumb') return 'Klicka där pelaren står. Höjden går till våningen ovanför om den inte är ifylld.';
    if (this.chain.waiting) return 'Klicka en punkt på bågen.';
    if (this.chain.arc && this.chain.count) return 'Klicka var bågen slutar.';
    if (!this.chain.count) return 'Klicka banans början. Tvärsnittet läggs till höger om banan (Tab byter sida).';
    return 'Klicka nästa punkt. Dubbelklick, Enter eller Klar avslutar.';
  }

  cancel(): void {}

  reset(): void {
    this.chain.reset();
    this.lockAngle = null;
    this.onChange?.();
  }

  /** Pelarens tvärsnitt i punkten, som förhandsvisning. */
  private columnPreview(at: Vec2): Vec2[][] {
    const doc = this.host.store.doc;
    const m = profileModel(doc.definitions[defaultProfileDef(doc, this.options.def)]) ?? profileModel(defaultProfileTypes().find((d) => d.id === (this.options.def ?? 't-pr01')));
    if (!m) return [];
    const s = profileSection(m, profileValues(m));
    const a = m.anchors.find((x) => x.no === (this.options.anchor ?? m.anchor)) ?? m.anchors[0];
    const pl = { anchor: anchorPoint(a, s.box, s.deltas), rotate: this.options.rotate, mirror: this.options.mirror };
    return s.parts.map((p) => p.ring.map((q) => {
      const r = placePoint(q, pl);
      return [at[0] + r[0], at[1] + r[1]] as Vec2;
    }));
  }

  overlay(cam: Camera): string {
    const out: string[] = [];
    const path = (pts: readonly Vec2[], close = false) => `M${pts.map((q) => cam.toScreen(q).join(' ')).join('L')}${close ? 'Z' : ''}`;
    if (this.options.mode === 'edge' && this.other) {
      const c = this.shift ? this.other.whole : this.other.side;
      out.push(`<path d="${path(c.closed ? [...c.points, c.points[0]] : c.points)}" class="rubber" style="stroke-width:3"/>`);
    }
    if (this.options.mode === 'plumb' && this.current) for (const r of this.columnPreview(this.current.point)) out.push(`<path d="${path(r, true)}" class="rubber"/>`);
    if (this.chain.count) {
      const raw = this.chain.preview(this.current?.point);
      if (raw.length >= 2) out.push(`<path d="${path(raw)}" class="rubber"/>`);
    }
    if (this.current) out.push(snapMarker(cam, this.current));
    return out.join('');
  }
}
