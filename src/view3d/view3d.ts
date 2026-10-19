import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Vec2 } from '../repr/primitives';
import { solidTriangles } from '../repr/mesh';
import type { Material3D, Shape3D, Solid } from '../repr/solids';

/** Färger för materialen. Dämpade, så att linjerna bär ritningen. */
const MATERIAL_COLORS: Record<Material3D, string> = {
  wall: '#f4f2ee',
  'wall-new': '#f1ddcf',
  glass: '#bcd6e6',
  door: '#d9c4a3',
  frame: '#e9e4dc',
  furniture: '#c9cdd1',
  fixture: '#e8eef2',
  floor: '#d8d2c6',
  roof: '#b9a597',
};

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
  refLines(): { a: Vec2; b: Vec2; z: number }[];
  /** Snäpp en punkt (mm) med samma regler som i planen. */
  snap(cursor: Vec2, from: Vec2 | undefined, exclude: string[], tolMm: number, ortho: boolean): { point: Vec2; label: string };
  commitWallEnd(wallId: string, end: 'start' | 'end', to: Vec2): void;
  commitMove(ids: string[], d: Vec2, anchor: Vec2): void;
}

type Drag =
  | { kind: 'grip'; handle: Handle3D; plane: THREE.Plane; point: Vec2; label: string }
  | { kind: 'move'; ids: string[]; plane: THREE.Plane; base: Vec2; point: Vec2; label: string };

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });

/**
 * 3D-vyn: ritar formerna från modellen med three.js. Modellens mm med z uppåt
 * blir meter med y uppåt. Markerade väggar får grepp i ändarna, och markerade
 * objekt kan dras på golvplanet. Vyn ritas bara om när något ändras, för att
 * spara batteri på mobilen.
 */
export class View3D {
  readonly el: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private root = new THREE.Group();
  private handlesGroup = new THREE.Group();
  private previewGroup = new THREE.Group();
  private sun: THREE.DirectionalLight;
  private materials = new Map<string, THREE.Material>();
  private edgeMaterial: THREE.LineBasicMaterial;
  private accentLine: THREE.LineBasicMaterial;
  private handleMaterial: THREE.MeshBasicMaterial;
  private refMaterial = new THREE.LineBasicMaterial({ color: 0x1f4fa3, depthTest: false, linewidth: 2 });
  private highlightMaterial: THREE.MeshStandardMaterial;
  private meshes: THREE.Mesh[] = [];
  private selected = new Set<string>();
  private framed = false;
  private frame = 0;
  private down: { x: number; y: number } | null = null;
  private drag: Drag | null = null;
  private label: HTMLElement;

  /** Anropas med elementets id när man klickar på något, eller null för tomt. */
  onPick?: (id: string | null, additive: boolean) => void;
  /** Koppling till appen för att ändra modellen. Utan den går 3D bara att titta i. */
  editor?: Edit3DHost;

  constructor(host: HTMLElement) {
    this.el = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'view3d-canvas';
    host.appendChild(this.renderer.domElement);

    this.label = document.createElement('div');
    this.label.className = 'label3d';
    this.label.hidden = true;
    host.appendChild(this.label);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.05, 2000);
    this.camera.position.set(14, 12, 16);

    // Våra egna pekarhändelser måste komma före kamerastyrningen, så att ett
    // drag i ett grepp inte också snurrar vyn.
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', (e) => this.onDown(e), { capture: true });
    canvas.addEventListener('pointermove', (e) => this.onMove(e), { capture: true });
    canvas.addEventListener('pointerup', (e) => this.onUp(e), { capture: true });
    canvas.addEventListener('pointercancel', () => this.cancelDrag(), { capture: true });

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = false;
    this.controls.screenSpacePanning = true;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.controls.addEventListener('change', () => {
      this.requestRender();
      this.onCameraChange?.();
    });

    // Modellen ligger i mm med z uppåt; vrid och skala till meter med y uppåt.
    for (const g of [this.root, this.handlesGroup, this.previewGroup]) {
      g.rotation.x = -Math.PI / 2;
      g.scale.setScalar(0.001);
      this.scene.add(g);
    }

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8d8a85, 1.6));
    this.sun = new THREE.DirectionalLight(0xffffff, 1.9);
    this.sun.position.set(-8, 16, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.16 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.031;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.edgeMaterial = new THREE.LineBasicMaterial({ color: 0x1d2328, transparent: true, opacity: 0.6 });
    this.accentLine = new THREE.LineBasicMaterial({ color: 0xa86b12, depthTest: false });
    this.handleMaterial = new THREE.MeshBasicMaterial({ color: 0xa86b12, depthTest: false });
    this.highlightMaterial = new THREE.MeshStandardMaterial({ color: 0xf2b468, roughness: 0.8, emissive: 0x6b3a00, emissiveIntensity: 0.25, side: THREE.DoubleSide });

    this.refreshColors();
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
  }

  /** Anropas när kameran rör sig, t.ex. för att flytta måttrutan. */
  onCameraChange?: () => void;

  /** Ersätt allt i scenen med nya former. Kameran ligger kvar. */
  setSolids(shapes: Shape3D[]): void {
    for (const child of this.root.children) disposeTree(child);
    this.root.clear();
    this.meshes = [];

    for (const s of shapes) {
      if (s.kind === 'edges') {
        const pos = new Float32Array(s.segments.flat());
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.root.add(new THREE.LineSegments(geom, this.edgeMaterial));
        continue;
      }
      const geom = extrude(s);
      if (!geom) continue;
      const mesh = new THREE.Mesh(geom, this.selected.has(s.id) ? this.highlightMaterial : this.material(s.material));
      mesh.userData = { id: s.id, material: s.material };
      mesh.castShadow = s.material !== 'glass' && s.material !== 'floor';
      mesh.receiveShadow = true;
      if (s.material !== 'glass' && !s.noEdges) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geom, 25), this.edgeMaterial));
      this.root.add(mesh);
      this.meshes.push(mesh);
    }
    if (!this.framed && this.meshes.length && this.el.clientWidth > 0) {
      this.frameAll();
      this.framed = true;
    }
    this.fitShadow();
    this.updateHandles();
    this.requestRender();
  }

  setSelection(ids: Iterable<string>): void {
    this.selected = new Set(ids);
    for (const m of this.meshes) {
      const { id, material } = m.userData as { id: string; material: Material3D };
      m.material = this.selected.has(id) ? this.highlightMaterial : this.material(material);
    }
    this.updateHandles();
    this.requestRender();
  }

  /** Visa hela modellen snett ovanifrån. */
  frameAll(): void {
    const box = new THREE.Box3().setFromObject(this.root);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    // Avstånd så att hela modellen ryms både på höjden och på bredden.
    const vFov = (this.camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const distance = (sphere.radius * 1.08) / Math.sin(Math.min(vFov, hFov) / 2);
    const dir = new THREE.Vector3(0.55, 0.62, 0.75).normalize();
    this.camera.position.copy(center).addScaledVector(dir, distance);
    this.controls.target.copy(center);
    this.controls.update();
    this.requestRender();
  }

  /**
   * En modellpunkt (mm, z uppåt) i pixlar relativt ritytan som vyn ligger i.
   * Null om punkten ligger bakom kameran.
   */
  project(p: Vec2, z = 0): Vec2 | null {
    const v = new THREE.Vector3(p[0] / 1000, z / 1000, -p[1] / 1000).project(this.camera);
    if (v.z > 1) return null;
    const w = this.el.clientWidth;
    const h = this.el.clientHeight;
    return [((v.x + 1) / 2) * w + this.el.offsetLeft, ((1 - v.y) / 2) * h + this.el.offsetTop];
  }

  /** Läs temats färger: bakgrund, linjer och markering. */
  refreshColors(): void {
    const css = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    this.scene.background = new THREE.Color(read('--paper', '#f3f5f6'));
    this.edgeMaterial.color.set(read('--ink', '#1d2328'));
    // Samma färger som markeringen och referenslinjerna i planen.
    const sel = resolveColor('--sel', '#a86b12');
    const ref = resolveColor('--ref', '#1f4fa3');
    this.accentLine.color.set(ref);
    this.handleMaterial.color.set(ref);
    this.refMaterial.color.set(ref);
    this.highlightMaterial.color.set(sel).lerp(new THREE.Color('#ffffff'), 0.35);
    this.highlightMaterial.emissive.set(sel).multiplyScalar(0.35);
    this.requestRender();
  }

  requestRender(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      // Greppen har samma storlek på skärmen oavsett avstånd.
      for (const c of this.handlesGroup.children) {
        const h = (c.userData as { handle?: Handle3D }).handle;
        if (!h) continue;
        c.scale.setScalar(this.mmPerPx([c.position.x, c.position.y], h.z) * (matchMedia('(pointer: coarse)').matches ? 8 : 5.5));
      }
      this.renderer.render(this.scene, this.camera);
    });
  }

  // ---------- Redigering ----------

  /** Grepp i ändarna på markerade väggar, som små klot på väggens överkant. */
  private updateHandles(): void {
    for (const c of this.handlesGroup.children) disposeTree(c);
    this.handlesGroup.clear();
    if (!this.editor) return;
    for (const r of this.editor.refLines()) {
      const geom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(r.a[0], r.a[1], r.z), new THREE.Vector3(r.b[0], r.b[1], r.z)]);
      const line = new THREE.Line(geom, this.refMaterial);
      line.renderOrder = 9;
      this.handlesGroup.add(line);
    }
    for (const h of this.editor.handles()) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), this.handleMaterial);
      ball.position.set(h.point[0], h.point[1], h.z);
      ball.renderOrder = 10;
      ball.userData = { handle: h };
      this.handlesGroup.add(ball);
    }
  }

  private ray(e: PointerEvent): THREE.Raycaster {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    return ray;
  }

  /** Var pekaren träffar ett vågrätt plan, i modellens mm. */
  private onPlane(e: PointerEvent, plane: THREE.Plane): Vec2 | null {
    const hit = this.ray(e).ray.intersectPlane(plane, new THREE.Vector3());
    return hit ? [hit.x * 1000, -hit.z * 1000] : null;
  }

  /** Ungefär hur många mm en pixel motsvarar vid en punkt. */
  private mmPerPx(p: Vec2, z: number): number {
    const d = this.camera.position.distanceTo(new THREE.Vector3(p[0] / 1000, z / 1000, -p[1] / 1000));
    const h = this.el.clientHeight || 1;
    return ((2 * Math.tan((this.camera.fov * Math.PI) / 360) * d) / h) * 1000;
  }

  private onDown(e: PointerEvent): void {
    this.down = { x: e.clientX, y: e.clientY };
    if (!this.editor || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const ray = this.ray(e);
    // Greppen träffas på avstånd i skärmen, så att de är lätta att ta med fingret.
    const rect = this.el.getBoundingClientRect();
    const at: Vec2 = [e.clientX - rect.left + this.el.offsetLeft, e.clientY - rect.top + this.el.offsetTop];
    let handle: Handle3D | null = null;
    let best = e.pointerType === 'touch' ? 26 : 12;
    for (const c of this.handlesGroup.children) {
      const h = (c.userData as { handle?: Handle3D }).handle;
      if (!h) continue;
      const s = this.project(h.point, h.z);
      const d = s ? Math.hypot(s[0] - at[0], s[1] - at[1]) : Infinity;
      if (d < best) {
        best = d;
        handle = h;
      }
    }
    if (handle) {
      this.drag = { kind: 'grip', handle, plane: horizontalPlane(handle.z), point: handle.point, label: '' };
    } else {
      const hit = ray.intersectObjects(this.meshes, false).find((h) => (h.object.userData as { material: Material3D }).material !== 'floor');
      const id = hit ? (hit.object.userData as { id: string }).id : null;
      if (!hit || !id || !this.editor.isSelected(id)) return;
      const z = hit.point.y * 1000;
      const base: Vec2 = [hit.point.x * 1000, -hit.point.z * 1000];
      this.drag = { kind: 'move', ids: this.editor.selectedIds(), plane: horizontalPlane(z), base, point: base, label: '' };
    }
    // Draget är vårt: kamerastyrningen får inte händelsen.
    e.stopImmediatePropagation();
    this.controls.enabled = false;
    this.renderer.domElement.setPointerCapture(e.pointerId);
  }

  private onMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d || !this.editor) return;
    e.stopImmediatePropagation();
    const raw = this.onPlane(e, d.plane);
    if (!raw) return;
    const z = -d.plane.constant * 1000;
    const tol = this.mmPerPx(raw, z) * (e.pointerType === 'touch' ? 18 : 12);
    if (d.kind === 'grip') {
      const s = this.editor.snap(raw, d.handle.fixed, [d.handle.wallId], tol, e.shiftKey);
      d.point = s.point;
      const len = Math.hypot(s.point[0] - d.handle.fixed[0], s.point[1] - d.handle.fixed[1]);
      const before = Math.hypot(d.handle.point[0] - d.handle.fixed[0], d.handle.point[1] - d.handle.fixed[1]);
      const delta = Math.round(len - before);
      d.label = `${nf.format(Math.round(len))} mm  ${delta >= 0 ? '+' : '−'}${nf.format(Math.abs(delta))}  ${angleText(s.point[0] - d.handle.fixed[0], s.point[1] - d.handle.fixed[1])}`;
      this.showPreviewLine(d.handle.fixed, s.point, d.handle.z);
      const ball = this.handlesGroup.children.find((c) => (c.userData as { handle?: Handle3D }).handle === d.handle);
      ball?.position.set(s.point[0], s.point[1], d.handle.z);
    } else {
      const s = this.editor.snap(raw, d.base, d.ids, tol, e.shiftKey);
      d.point = s.point;
      const dx = s.point[0] - d.base[0];
      const dy = s.point[1] - d.base[1];
      d.label = `${nf.format(Math.round(Math.hypot(dx, dy)))} mm  ${angleText(dx, dy)}`;
      // Förhandsvisning: de markerade formerna flyttas tills draget släpps.
      for (const m of this.meshes) if (d.ids.includes((m.userData as { id: string }).id)) m.position.set(dx, dy, 0);
      this.showPreviewLine(d.base, s.point, z);
    }
    this.showLabel(e);
    this.requestRender();
  }

  private onUp(e: PointerEvent): void {
    const d = this.drag;
    const moved = this.down ? Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 5 : false;
    this.down = null;
    if (d) {
      e.stopImmediatePropagation();
      this.endDrag();
      if (!moved) {
        if (d.kind === 'move') this.pick(e);
        return;
      }
      if (d.kind === 'grip') this.editor?.commitWallEnd(d.handle.wallId, d.handle.end, [Math.round(d.point[0]), Math.round(d.point[1])]);
      else this.editor?.commitMove(d.ids, [Math.round(d.point[0] - d.base[0]), Math.round(d.point[1] - d.base[1])], d.point);
      return;
    }
    if (!moved) this.pick(e);
  }

  private cancelDrag(): void {
    if (!this.drag) return;
    this.endDrag();
    for (const m of this.meshes) m.position.set(0, 0, 0);
    this.updateHandles();
  }

  private endDrag(): void {
    this.drag = null;
    this.controls.enabled = true;
    this.label.hidden = true;
    for (const c of this.previewGroup.children) disposeTree(c);
    this.previewGroup.clear();
    this.requestRender();
  }

  private showPreviewLine(a: Vec2, b: Vec2, z: number): void {
    for (const c of this.previewGroup.children) disposeTree(c);
    this.previewGroup.clear();
    const geom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a[0], a[1], z), new THREE.Vector3(b[0], b[1], z)]);
    const line = new THREE.Line(geom, this.accentLine);
    line.renderOrder = 11;
    this.previewGroup.add(line);
  }

  private showLabel(e: PointerEvent): void {
    if (!this.drag) return;
    const rect = this.el.getBoundingClientRect();
    this.label.textContent = this.drag.label;
    this.label.style.left = `${e.clientX - rect.left + 16}px`;
    this.label.style.top = `${e.clientY - rect.top + 16}px`;
    this.label.hidden = false;
  }

  private material(kind: Material3D): THREE.Material {
    let m = this.materials.get(kind);
    if (!m) {
      m =
        kind === 'glass'
          ? new THREE.MeshPhysicalMaterial({ color: MATERIAL_COLORS.glass, roughness: 0.05, transparent: true, opacity: 0.35 })
          : new THREE.MeshStandardMaterial({ color: MATERIAL_COLORS[kind], roughness: 0.92, side: THREE.DoubleSide });
      this.materials.set(kind, m);
    }
    return m;
  }

  private resize(): void {
    const r = this.el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height;
    this.camera.updateProjectionMatrix();
    this.requestRender();
    this.onCameraChange?.();
  }

  /** Låt skuggkameran täcka modellen. */
  private fitShadow(): void {
    const box = new THREE.Box3().setFromObject(this.root);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2 + 2;
    this.sun.target.position.copy(center);
    this.sun.position.copy(center).add(new THREE.Vector3(-0.45, 0.8, 0.4).normalize().multiplyScalar(r * 2));
    const cam = this.sun.shadow.camera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 0.1;
    cam.far = r * 5;
    cam.updateProjectionMatrix();
  }

  /** Det objekt som syns under en punkt i fönstret, för högerklick. */
  idAt(clientX: number, clientY: number): string | null {
    const hit = this.ray({ clientX, clientY } as PointerEvent)
      .intersectObjects(this.meshes, false)
      .find((h) => (h.object.userData as { material: Material3D }).material !== 'floor');
    return hit ? (hit.object.userData as { id: string }).id : null;
  }

  private pick(e: PointerEvent): void {
    const hit = this.ray(e)
      .intersectObjects(this.meshes, false)
      .find((h) => (h.object.userData as { material: Material3D }).material !== 'floor');
    this.onPick?.(hit ? (hit.object.userData as { id: string }).id : null, e.shiftKey || e.ctrlKey || e.metaKey || e.pointerType === 'touch');
  }
}

/** Ett vågrätt plan på höjden z (mm) i scenens koordinater (meter, y uppåt). */
/** En CSS-variabels färg som rgb, med var() upplöst. */
function resolveColor(name: string, fallback: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${name}, ${fallback})`;
  document.body.appendChild(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  return c || fallback;
}

function horizontalPlane(zMm: number): THREE.Plane {
  return new THREE.Plane(new THREE.Vector3(0, 1, 0), -zMm / 1000);
}

function angleText(dx: number, dy: number): string {
  let a = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (a < 0) a += 360;
  const r = Math.round(a * 10) / 10;
  return `${(r === 360 ? 0 : r).toLocaleString('sv-SE')}°`;
}

function disposeTree(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const g = (o as THREE.Mesh).geometry;
    if (g) g.dispose();
  });
}

/** En plan form med hål, extruderad från z0 till z1 (mm). */
function extrude(s: Solid): THREE.BufferGeometry | null {
  if (s.cuts || s.top || s.bottom) {
    const tris = solidTriangles(s);
    if (!tris.length) return null;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
    geom.computeVertexNormals();
    return geom;
  }
  const [outer, ...holes] = s.rings;
  if (!outer || outer.length < 3 || s.z1 - s.z0 < 0.5) return null;
  const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) if (h.length >= 3) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const geom = new THREE.ExtrudeGeometry(shape, { depth: s.z1 - s.z0, bevelEnabled: false });
  geom.translate(0, 0, s.z0);
  return geom;
}
