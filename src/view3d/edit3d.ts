import * as THREE from 'three';
import type { Vec2 } from '../repr/primitives';
import { clearGroup, horizontalPlane } from './geometry3d';

/**
 * Redigeringen i 3D-vyn (granskningen efter 0.10.12, förut i `view3d.ts`):
 * grepp i ändarna på markerade väggar och flytt av det markerade genom att
 * dra det på ett vågrätt plan. Vyn skickar pekarhändelserna hit först, så
 * att ett drag i ett grepp inte också snurrar vyn.
 */

/** Ett grepp i en väggände som kan dras i 3D. */
export interface Handle3D {
  wallId: string;
  end: 'start' | 'end';
  point: Vec2;
  /** Höjd där greppet visas, mm. */
  z: number;
  /** Den andra änden, som ligger still. */
  fixed: Vec2;
}

/** Det 3D-vyn behöver från appen för att kunna ändra modellen. */
export interface Edit3DHost {
  isSelected(id: string): boolean;
  selectedIds(): string[];
  handles(): Handle3D[];
  /** Referenslinjerna på markerade väggar, på väggarnas överkant. */
  refLines(): { a: Vec2; b: Vec2; z: number; zb?: number }[];
  /** Snäpp en punkt (mm) med samma regler som i planen. */
  snap(cursor: Vec2, from: Vec2 | undefined, exclude: string[], tolMm: number, ortho: boolean): { point: Vec2; label: string };
  commitWallEnd(wallId: string, end: 'start' | 'end', to: Vec2): void;
  commitMove(ids: string[], d: Vec2, anchor: Vec2): void;
}

/** Det redigeringen behöver av vyn. */
export interface EditView {
  el: HTMLElement;
  canvas: HTMLCanvasElement;
  editor(): Edit3DHost | undefined;
  meshes(): readonly THREE.Mesh[];
  /** Slå av och på kamerastyrningen medan något dras. */
  orbit(on: boolean): void;
  project(p: Vec2, z: number): Vec2 | null;
  mmPerPx(p: Vec2, z: number): number;
  ray(e: Pick<PointerEvent, 'clientX' | 'clientY'>): THREE.Raycaster;
  hitAt(e: Pick<PointerEvent, 'clientX' | 'clientY'>): THREE.Intersection | undefined;
  pick(e: PointerEvent): void;
  /** Markera det som ryms i (window) eller nuddar (crossing) en ruta i fönstrets pixlar (0.10.27). */
  pickBox(r: ScreenRect, mode: 'window' | 'crossing', additive: boolean): void;
  /** Mellanslaget hålls ned: draget panorerar i stället. */
  panning(): boolean;
  hover(e: PointerEvent): void;
  render(): void;
}

/** En ruta i fönstrets pixlar (clientX, clientY). */
export interface ScreenRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

type Drag =
  | { kind: 'grip'; handle: Handle3D; plane: THREE.Plane; point: Vec2; label: string }
  | { kind: 'move'; ids: string[]; plane: THREE.Plane; base: Vec2; point: Vec2; label: string };

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });

export class Edit3D {
  readonly handlesGroup = new THREE.Group();
  readonly previewGroup = new THREE.Group();
  private refMaterial = new THREE.LineBasicMaterial({ color: 0x1f4fa3, depthTest: false, linewidth: 2 });
  private accentLine = new THREE.LineBasicMaterial({ color: 0xa86b12, depthTest: false });
  private handleMaterial = new THREE.MeshBasicMaterial({ color: 0xa86b12, depthTest: false });
  private down: { x: number; y: number } | null = null;
  private drag: Drag | null = null;
  /** Markeringsrutan (0.10.27): ett vänsterdrag som inte börjar i ett grepp eller på det markerade. */
  private box: { x: number; y: number; id: number; on: boolean } | null = null;
  private boxEl: HTMLElement;
  private label: HTMLElement;
  private view: EditView;

  constructor(view: EditView) {
    this.view = view;
    this.label = document.createElement('div');
    this.label.className = 'label3d';
    this.label.hidden = true;
    view.el.appendChild(this.label);
    this.boxEl = document.createElement('div');
    this.boxEl.className = 'sel-box3d';
    this.boxEl.hidden = true;
    view.el.appendChild(this.boxEl);
  }

  /** Samma färg som referenslinjerna i planen. */
  setColor(ref: string): void {
    this.accentLine.color.set(ref);
    this.handleMaterial.color.set(ref);
    this.refMaterial.color.set(ref);
  }

  /** Grepp i ändarna på markerade väggar, som små klot på väggens överkant. */
  updateHandles(): void {
    clearGroup(this.handlesGroup);
    const editor = this.view.editor();
    if (!editor) return;
    for (const r of editor.refLines()) {
      const geom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(r.a[0], r.a[1], r.z), new THREE.Vector3(r.b[0], r.b[1], r.zb ?? r.z)]);
      const line = new THREE.Line(geom, this.refMaterial);
      line.renderOrder = 9;
      this.handlesGroup.add(line);
    }
    for (const h of editor.handles()) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), this.handleMaterial);
      ball.position.set(h.point[0], h.point[1], h.z);
      ball.renderOrder = 10;
      ball.userData = { handle: h };
      this.handlesGroup.add(ball);
    }
  }

  /** Greppen har samma storlek på skärmen oavsett avstånd; anropas före varje bild. */
  scaleHandles(): void {
    for (const c of this.handlesGroup.children) {
      const h = (c.userData as { handle?: Handle3D }).handle;
      if (!h) continue;
      c.scale.setScalar(this.view.mmPerPx([c.position.x, c.position.y], h.z) * (matchMedia('(pointer: coarse)').matches ? 8 : 5.5));
    }
  }

  /** Var pekaren träffar ett vågrätt plan, i modellens mm. */
  private onPlane(e: PointerEvent, plane: THREE.Plane): Vec2 | null {
    const hit = this.view.ray(e).ray.intersectPlane(plane, new THREE.Vector3());
    return hit ? [hit.x * 1000, -hit.z * 1000] : null;
  }

  onDown(e: PointerEvent): void {
    // Mitten- och högerknappen markerar inget, och Mellanslag + dra
    // panorerar (kamerastyrningen tar båda).
    this.down = null;
    if ((e.pointerType === 'mouse' && e.button !== 0) || this.view.panning()) return;
    this.down = { x: e.clientX, y: e.clientY };
    const editor = this.view.editor();
    if (!editor) {
      this.startBox(e);
      return;
    }
    // Greppen träffas på avstånd i skärmen, så att de är lätta att ta med fingret.
    const el = this.view.el;
    const rect = el.getBoundingClientRect();
    const at: Vec2 = [e.clientX - rect.left + el.offsetLeft, e.clientY - rect.top + el.offsetTop];
    let handle: Handle3D | null = null;
    let best = e.pointerType === 'touch' ? 26 : 12;
    for (const c of this.handlesGroup.children) {
      const h = (c.userData as { handle?: Handle3D }).handle;
      if (!h) continue;
      const s = this.view.project(h.point, h.z);
      const d = s ? Math.hypot(s[0] - at[0], s[1] - at[1]) : Infinity;
      if (d < best) {
        best = d;
        handle = h;
      }
    }
    if (handle) {
      this.drag = { kind: 'grip', handle, plane: horizontalPlane(handle.z), point: handle.point, label: '' };
    } else {
      const hit = this.view.hitAt(e);
      const id = hit ? (hit.object.userData as { id: string }).id : null;
      if (!hit || !id || !editor.isSelected(id)) {
        this.startBox(e);
        return;
      }
      const z = hit.point.y * 1000;
      const base: Vec2 = [hit.point.x * 1000, -hit.point.z * 1000];
      this.drag = { kind: 'move', ids: editor.selectedIds(), plane: horizontalPlane(z), base, point: base, label: '' };
    }
    // Draget är vårt: kamerastyrningen får inte händelsen.
    e.stopImmediatePropagation();
    this.view.orbit(false);
    this.view.canvas.setPointerCapture(e.pointerId);
  }

  /** Med musen blir ett vänsterdrag en markeringsruta; med fingret snurrar vyn som förut. */
  private startBox(e: PointerEvent): void {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    this.box = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false };
    e.stopImmediatePropagation();
    this.view.orbit(false);
    this.view.canvas.setPointerCapture(e.pointerId);
  }

  private boxRect(e: Pick<PointerEvent, 'clientX' | 'clientY'>): ScreenRect {
    const b = this.box!;
    return { minX: Math.min(b.x, e.clientX), minY: Math.min(b.y, e.clientY), maxX: Math.max(b.x, e.clientX), maxY: Math.max(b.y, e.clientY) };
  }

  onMove(e: PointerEvent): void {
    const b = this.box;
    if (b) {
      e.stopImmediatePropagation();
      if (!b.on && Math.hypot(e.clientX - b.x, e.clientY - b.y) <= 5) return;
      b.on = true;
      // Som i planen: heldragen åt höger (helt innanför), streckad åt vänster (allt som nuddas).
      const r = this.boxRect(e);
      const host = this.view.el.getBoundingClientRect();
      Object.assign(this.boxEl.style, { left: `${r.minX - host.left}px`, top: `${r.minY - host.top}px`, width: `${r.maxX - r.minX}px`, height: `${r.maxY - r.minY}px` });
      this.boxEl.classList.toggle('crossing', e.clientX < b.x);
      this.boxEl.hidden = false;
      return;
    }
    const d = this.drag;
    if (!d) this.view.hover(e);
    const editor = this.view.editor();
    if (!d || !editor) return;
    e.stopImmediatePropagation();
    const raw = this.onPlane(e, d.plane);
    if (!raw) return;
    const z = -d.plane.constant * 1000;
    const tol = this.view.mmPerPx(raw, z) * (e.pointerType === 'touch' ? 18 : 12);
    if (d.kind === 'grip') {
      const s = editor.snap(raw, d.handle.fixed, [d.handle.wallId], tol, e.shiftKey);
      d.point = s.point;
      const len = Math.hypot(s.point[0] - d.handle.fixed[0], s.point[1] - d.handle.fixed[1]);
      const before = Math.hypot(d.handle.point[0] - d.handle.fixed[0], d.handle.point[1] - d.handle.fixed[1]);
      const delta = Math.round(len - before);
      d.label = `${nf.format(Math.round(len))} mm  ${delta >= 0 ? '+' : '−'}${nf.format(Math.abs(delta))}  ${angleText(s.point[0] - d.handle.fixed[0], s.point[1] - d.handle.fixed[1])}`;
      this.showPreviewLine(d.handle.fixed, s.point, d.handle.z);
      const ball = this.handlesGroup.children.find((c) => (c.userData as { handle?: Handle3D }).handle === d.handle);
      ball?.position.set(s.point[0], s.point[1], d.handle.z);
    } else {
      const s = editor.snap(raw, d.base, d.ids, tol, e.shiftKey);
      d.point = s.point;
      const dx = s.point[0] - d.base[0];
      const dy = s.point[1] - d.base[1];
      d.label = `${nf.format(Math.round(Math.hypot(dx, dy)))} mm  ${angleText(dx, dy)}`;
      // Förhandsvisning: de markerade formerna flyttas tills draget släpps.
      for (const m of this.view.meshes()) if (d.ids.includes((m.userData as { id: string }).id)) m.position.set(dx, dy, 0);
      this.showPreviewLine(d.base, s.point, z);
    }
    this.showLabel(e);
    this.view.render();
  }

  onUp(e: PointerEvent): void {
    const b = this.box;
    if (b) {
      e.stopImmediatePropagation();
      const r = this.boxRect(e);
      this.endBox();
      this.down = null;
      if (b.on) this.view.pickBox(r, e.clientX >= b.x ? 'window' : 'crossing', e.shiftKey || e.ctrlKey || e.metaKey);
      else this.view.pick(e);
      return;
    }
    const d = this.drag;
    // Ett drag med Mellanslag (panorering) eller en annan knapp markerar inget.
    if (!d && !this.down) return;
    const moved = this.down ? Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 5 : false;
    this.down = null;
    if (d) {
      e.stopImmediatePropagation();
      this.endDrag();
      if (!moved) {
        if (d.kind === 'move') this.view.pick(e);
        return;
      }
      const editor = this.view.editor();
      if (d.kind === 'grip') editor?.commitWallEnd(d.handle.wallId, d.handle.end, [Math.round(d.point[0]), Math.round(d.point[1])]);
      else editor?.commitMove(d.ids, [Math.round(d.point[0] - d.base[0]), Math.round(d.point[1] - d.base[1])], d.point);
      return;
    }
    if (!moved) this.view.pick(e);
  }

  cancelDrag(): void {
    if (this.box) this.endBox();
    if (!this.drag) return;
    this.endDrag();
    for (const m of this.view.meshes()) m.position.set(0, 0, 0);
    this.updateHandles();
  }

  private endBox(): void {
    this.box = null;
    this.boxEl.hidden = true;
    this.view.orbit(true);
  }

  private endDrag(): void {
    this.drag = null;
    this.view.orbit(true);
    this.label.hidden = true;
    clearGroup(this.previewGroup);
    this.view.render();
  }

  private showPreviewLine(a: Vec2, b: Vec2, z: number): void {
    clearGroup(this.previewGroup);
    const geom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a[0], a[1], z), new THREE.Vector3(b[0], b[1], z)]);
    const line = new THREE.Line(geom, this.accentLine);
    line.renderOrder = 11;
    this.previewGroup.add(line);
  }

  private showLabel(e: PointerEvent): void {
    if (!this.drag) return;
    const rect = this.view.el.getBoundingClientRect();
    this.label.textContent = this.drag.label;
    this.label.style.left = `${e.clientX - rect.left + 16}px`;
    this.label.style.top = `${e.clientY - rect.top + 16}px`;
    this.label.hidden = false;
  }
}

function angleText(dx: number, dy: number): string {
  let a = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (a < 0) a += 360;
  const r = Math.round(a * 10) / 10;
  return `${(r === 360 ? 0 : r).toLocaleString('sv-SE')}°`;
}
