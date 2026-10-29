import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Vec2 } from '../repr/primitives';
import type { Material3D, Shape3D } from '../repr/solids';
import { Edit3D, type Edit3DHost, type ScreenRect } from './edit3d';
import { capObjects, clearGroup, clipPlanes, extrude, groundHit, resolveColor, shown, type Cap3D, type Clip3D } from './geometry3d';

export type { Edit3DHost, Handle3D } from './edit3d';

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
  slab: '#d6d0c4',
  roof: '#b9a597',
  site: '#d9d6d0',
  tree: '#9fb18f',
  ground: '#cfd3bf',
};

/**
 * Markobjekten (0.10.11): de är inga egna kroppar utan delar av marken, så
 * vyn träffar marken och frågar appen vilket objekt som ligger där.
 */
export interface Ground3DHost {
  /** Alla markobjekt som går att markera. */
  ids(): string[];
  /** Den färdiga markens höjd i en punkt, mm från ±0, eller null utanför markmodellen. */
  height(p: Vec2): number | null;
  /** Markobjektet i en punkt i planen, eller null. */
  pick(p: Vec2): string | null;
  /** Objektets kontur på marken, sex tal per sträcka (mm), eller null om id inte är ett markobjekt. */
  outline(id: string): Float32Array | null;
}

/**
 * 3D-vyn: ritar formerna från modellen med three.js. Modellens mm med z uppåt
 * blir meter med y uppåt. Markerade väggar får grepp i ändarna, och markerade
 * objekt kan dras på golvplanet (`edit3d.ts`). Vyn ritas bara om när något
 * ändras, för att spara batteri på mobilen.
 */
export class View3D {
  readonly el: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private root = new THREE.Group();
  /** Greppen och dragningen. */
  private edit: Edit3D;
  /** Snittytorna där en sektion skär modellen (0.8). */
  private capsGroup = new THREE.Group();
  /** Den befintliga marken (0.10.3), för sig: går inte att klicka på och räknas inte när vyn ställs in. */
  private terrainGroup = new THREE.Group();
  private shadowPlane: THREE.Mesh;
  private capMaterials: { poche: THREE.MeshBasicMaterial; other: THREE.MeshBasicMaterial; edge: THREE.LineBasicMaterial };
  private sun: THREE.DirectionalLight;
  private materials = new Map<string, THREE.Material>();
  private clipPlanes: THREE.Plane[] = [];
  private edgeMaterial: THREE.LineBasicMaterial;
  /** Höjdkurvorna på marken (0.10.8): mörka och halvgenomskinliga. */
  private contourMaterial = new THREE.LineBasicMaterial({ color: 0x3d4a3a, transparent: true, opacity: 0.55 });
  private highlightMaterial: THREE.MeshStandardMaterial;
  /** Det som pekaren står över (0.10.11), svagare än markeringen. */
  private hoverMaterial: THREE.MeshStandardMaterial;
  private hovered: string | null = null;
  private hoverAt: { x: number; y: number } | null = null;
  private hoverFrame = 0;
  /** Markobjektens linjer på marken (0.10.15), när de tänts under Visa: konturerna och släntmarkeringarna. */
  private groundLinesGroup = new THREE.Group();
  private groundLineMaterial = new THREE.LineBasicMaterial({ color: 0x2b302a });
  private slopeLineMaterial = new THREE.LineBasicMaterial({ color: 0x2b302a, transparent: true, opacity: 0.6 });
  /** Markobjektens konturer på marken: de markerade och det som hovras. */
  private marksGroup = new THREE.Group();
  private markLine = new THREE.LineBasicMaterial({ color: 0xa86b12, depthTest: false });
  private hoverLine = new THREE.LineBasicMaterial({ color: 0xa86b12, depthTest: false, transparent: true, opacity: 0.55 });
  private meshes: THREE.Mesh[] = [];
  private selected = new Set<string>();
  private framed = false;
  private frame = 0;
  /** Mellanslaget hålls ned: vänsterknappen panorerar (0.10.27). */
  private spaceDown = false;

  /** Anropas med elementets id när man klickar på något, eller null för tomt. */
  onPick?: (id: string | null, additive: boolean) => void;
  /** Anropas med det som markeringsrutan tog (0.10.27); Shift eller Ctrl lägger till. */
  onBoxPick?: (ids: string[], additive: boolean) => void;
  /** Koppling till appen för att ändra modellen. Utan den går 3D bara att titta i. */
  editor?: Edit3DHost;
  /** Markobjekten på marken (0.10.11), eller null utan markmodell. */
  ground: Ground3DHost | null = null;

  constructor(host: HTMLElement) {
    this.el = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.localClippingEnabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'view3d-canvas';
    host.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.05, 2000);
    this.camera.position.set(14, 12, 16);

    const canvas = this.renderer.domElement;
    this.edit = new Edit3D({
      el: host,
      canvas,
      editor: () => this.editor,
      meshes: () => this.meshes,
      orbit: (on) => (this.controls.enabled = on),
      project: (p, z) => this.project(p, z),
      mmPerPx: (p, z) => this.mmPerPx(p, z),
      ray: (e) => this.ray(e),
      hitAt: (e) => this.hitAt(e),
      pick: (e) => this.pick(e),
      pickBox: (r, mode, additive) => this.onBoxPick?.(this.idsInRect(r, mode), additive),
      panning: () => this.spaceDown,
      hover: (e) => this.queueHover(e),
      render: () => this.requestRender(),
    });

    // Våra egna pekarhändelser måste komma före kamerastyrningen, så att ett
    // drag i ett grepp inte också snurrar vyn.
    canvas.addEventListener('pointerdown', (e) => this.edit.onDown(e), { capture: true });
    canvas.addEventListener('pointermove', (e) => this.edit.onMove(e), { capture: true });
    canvas.addEventListener('pointerup', (e) => this.edit.onUp(e), { capture: true });
    canvas.addEventListener('pointercancel', () => this.edit.cancelDrag(), { capture: true });
    canvas.addEventListener('pointerleave', () => this.setHover(null));

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = false;
    this.controls.screenSpacePanning = true;
    // Kameran får gå under marken, så att man ser undersidor. Strax före
    // rakt nedifrån stannar den, annars vänder sig bilden.
    this.controls.maxPolarAngle = Math.PI * 0.98;
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    // Som i ArchiCAD (0.10.27): mittenknappen panorerar och Shift +
    // mittenknappen orbitar (kamerastyrningen byter själv med Shift).
    // Vänsterknappen markerar och högerknappen öppnar menyn. Mellanslag +
    // vänsterknappen gör samma sak som mittenknappen, utan mus.
    this.controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: null };
    const typing = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t instanceof HTMLElement && t.isContentEditable);
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' || typing(e.target) || this.spaceDown) return;
      this.spaceDown = true;
      this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
      canvas.style.cursor = 'grab';
    });
    window.addEventListener('keyup', (e) => {
      if (e.code !== 'Space') return;
      this.spaceDown = false;
      this.controls.mouseButtons.LEFT = null;
      canvas.style.cursor = '';
    });
    window.addEventListener('blur', () => {
      this.spaceDown = false;
      this.controls.mouseButtons.LEFT = null;
      canvas.style.cursor = '';
    });
    // Dubbelklick med mittenknappen visar hela modellen, som i planen.
    let lastMiddle = 0;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 1) return;
      e.preventDefault();
      const now = performance.now();
      if (now - lastMiddle < 350) {
        lastMiddle = 0;
        this.frameAll();
      } else lastMiddle = now;
    });
    this.controls.addEventListener('change', () => {
      this.requestRender();
      this.onCameraChange?.();
    });

    // Modellen ligger i mm med z uppåt; vrid och skala till meter med y uppåt.
    this.capMaterials = {
      poche: new THREE.MeshBasicMaterial({ color: 0x3b4146, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      other: new THREE.MeshBasicMaterial({ color: 0x9aa1a7, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      edge: new THREE.LineBasicMaterial({ color: 0x1d2328 }),
    };
    for (const g of [this.root, this.edit.handlesGroup, this.edit.previewGroup, this.capsGroup, this.terrainGroup, this.groundLinesGroup, this.marksGroup]) {
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
    this.shadowPlane = ground;

    this.edgeMaterial = new THREE.LineBasicMaterial({ color: 0x1d2328, transparent: true, opacity: 0.6 });
    this.highlightMaterial = new THREE.MeshStandardMaterial({ color: 0xf2b468, roughness: 0.8, emissive: 0x6b3a00, emissiveIntensity: 0.25, side: THREE.DoubleSide });
    this.hoverMaterial = new THREE.MeshStandardMaterial({ color: 0xf6d3a6, roughness: 0.85, emissive: 0x6b3a00, emissiveIntensity: 0.1, side: THREE.DoubleSide });

    this.refreshColors();
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
  }

  /** Anropas när kameran rör sig, t.ex. för att flytta måttrutan. */
  onCameraChange?: () => void;

  /** Ersätt allt i scenen med nya former. Kameran ligger kvar. */
  setSolids(shapes: Shape3D[]): void {
    clearGroup(this.root);
    this.meshes = [];

    // Alla kantlinjer i en geometri (0.10.1): väggarnas linjer är en per
    // vägg, och en ritning per lista blev många.
    let count = 0;
    for (const s of shapes) if (s.kind === 'edges' && !s.drawingOnly) count += s.segments.length * 6;
    const edgePos = new Float32Array(count);
    let at = 0;
    for (const s of shapes) {
      if (s.kind === 'edges') {
        // Glasmarkering och öppningssätt hör till ritningarna, inte till 3D.
        if (s.drawingOnly) continue;
        for (const q of s.segments) for (let k = 0; k < 6; k++) edgePos[at++] = q[k];
        continue;
      }
      const geom = extrude(s);
      if (!geom) continue;
      const mesh = new THREE.Mesh(geom, this.materialFor(s.id, s.material));
      mesh.userData = { id: s.id, material: s.material };
      mesh.castShadow = s.material !== 'glass' && s.material !== 'floor';
      mesh.receiveShadow = true;
      if (s.material !== 'glass' && !s.noEdges) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geom, 25), this.edgeMaterial));
      this.root.add(mesh);
      this.meshes.push(mesh);
    }
    if (count) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
      this.root.add(new THREE.LineSegments(geom, this.edgeMaterial));
    }
    if (!this.framed && this.meshes.length && this.el.clientWidth > 0) {
      this.frameAll();
      this.framed = true;
    }
    this.fitShadow();
    this.edit.updateHandles();
    this.requestRender();
  }

  /**
   * Den befintliga marken (0.10.3) som triangelnät i modellens mm (z uppåt
   * från ±0), och höjdkurvorna som sträckor (0.10.8, sex tal per sträcka),
   * eller null. Med mark tas skuggplanet vid ±0 bort.
   */
  setTerrain(mesh: { positions: Float32Array; indices: Uint32Array } | null, contours: Float32Array | null = null): void {
    clearGroup(this.terrainGroup);
    this.shadowPlane.visible = !mesh;
    if (mesh && mesh.indices.length) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
      geom.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
      geom.computeVertexNormals();
      const m = new THREE.Mesh(geom, this.material('ground'));
      m.receiveShadow = true;
      this.terrainGroup.add(m);
      if (contours?.length) {
        const lg = new THREE.BufferGeometry();
        lg.setAttribute('position', new THREE.BufferAttribute(contours, 3));
        this.terrainGroup.add(new THREE.LineSegments(lg, this.contourMaterial));
      }
    }
    this.requestRender();
  }

  /** Markobjektens konturer och släntmarkeringar på marken (0.10.15), sex tal per sträcka, eller null. */
  setGroundLines(outlines: Float32Array | null, slopes: Float32Array | null): void {
    clearGroup(this.groundLinesGroup);
    for (const [pos, mat] of [
      [outlines, this.groundLineMaterial],
      [slopes, this.slopeLineMaterial],
    ] as const) {
      if (!pos?.length) continue;
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.groundLinesGroup.add(new THREE.LineSegments(geom, mat));
    }
    this.requestRender();
  }

  setSelection(ids: Iterable<string>): void {
    this.selected = new Set(ids);
    this.paint();
    this.edit.updateHandles();
  }

  private materialFor(id: string, material: Material3D): THREE.Material {
    return this.selected.has(id) ? this.highlightMaterial : id === this.hovered ? this.hoverMaterial : this.material(material);
  }

  /** Färga det markerade och det som hovras, och rita markobjektens konturer (0.10.11). */
  private paint(): void {
    for (const m of this.meshes) {
      const { id, material } = m.userData as { id: string; material: Material3D };
      m.material = this.materialFor(id, material);
    }
    clearGroup(this.marksGroup);
    const g = this.ground;
    if (g) {
      const add = (id: string, mat: THREE.LineBasicMaterial) => {
        const pos = g.outline(id);
        if (!pos) return;
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const line = new THREE.LineSegments(geom, mat);
        line.renderOrder = 10;
        this.marksGroup.add(line);
      };
      for (const id of this.selected) add(id, this.markLine);
      if (this.hovered && !this.selected.has(this.hovered)) add(this.hovered, this.hoverLine);
    }
    this.requestRender();
  }

  /** Det som pekaren står över; null när den lämnar vyn eller står över tomt. */
  private setHover(id: string | null): void {
    this.hoverAt = null;
    if (id === this.hovered) return;
    this.hovered = id;
    this.paint();
  }

  /** Hovringen räknas en gång per bildruta, där pekaren står då. */
  private queueHover(e: PointerEvent): void {
    // Inte medan vyn snurras eller panoreras, och inte med fingret.
    if (e.buttons || e.pointerType === 'touch') return;
    this.hoverAt = { x: e.clientX, y: e.clientY };
    if (this.hoverFrame) return;
    this.hoverFrame = requestAnimationFrame(() => {
      this.hoverFrame = 0;
      const at = this.hoverAt;
      if (at) this.setHover(this.idAt(at.x, at.y));
    });
  }

  /** Visa hela modellen snett ovanifrån. */
  frameAll(): void {
    // Huset, inte grannhusen och träden runt det (0.10.3), när det finns ett.
    const own = this.meshes.filter((m) => !['site', 'tree'].includes((m.userData as { material: Material3D }).material));
    const box = new THREE.Box3();
    if (own.length) for (const m of own) box.expandByObject(m);
    else box.setFromObject(this.root);
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
    this.edit.setColor(resolveColor('--ref', '#1f4fa3'));
    this.highlightMaterial.color.set(sel).lerp(new THREE.Color('#ffffff'), 0.35);
    this.highlightMaterial.emissive.set(sel).multiplyScalar(0.35);
    this.hoverMaterial.color.set(sel).lerp(new THREE.Color('#ffffff'), 0.65);
    this.hoverMaterial.emissive.set(sel).multiplyScalar(0.12);
    this.markLine.color.set(sel);
    this.hoverLine.color.set(sel);
    this.requestRender();
  }

  requestRender(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.edit.scaleHandles();
      this.renderer.render(this.scene, this.camera);
    });
  }

  private ray(e: Pick<PointerEvent, 'clientX' | 'clientY'>): THREE.Raycaster {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    return ray;
  }

  /** Ungefär hur många mm en pixel motsvarar vid en punkt. */
  private mmPerPx(p: Vec2, z: number): number {
    const d = this.camera.position.distanceTo(new THREE.Vector3(p[0] / 1000, z / 1000, -p[1] / 1000));
    const h = this.el.clientHeight || 1;
    return ((2 * Math.tan((this.camera.fov * Math.PI) / 360) * d) / h) * 1000;
  }

  private material(kind: Material3D): THREE.Material {
    let m = this.materials.get(kind);
    if (!m) {
      m =
        kind === 'glass'
          ? new THREE.MeshPhysicalMaterial({ color: MATERIAL_COLORS.glass, roughness: 0.05, transparent: true, opacity: 0.35 })
          : new THREE.MeshStandardMaterial({ color: MATERIAL_COLORS[kind], roughness: 0.92, side: THREE.DoubleSide });
      m.clippingPlanes = this.clipPlanes;
      m.clipShadows = true;
      this.materials.set(kind, m);
    }
    return m;
  }

  /**
   * Klipp modellen längs en sektion (0.7.1) och fyll snittet: det som
   * ligger bakom betraktaren, utanför linjens ändar eller bortom djupet syns
   * inte. Null tar bort klippningen.
   */
  setClip(c: Clip3D | null, caps: Cap3D[] = []): void {
    clearGroup(this.capsGroup);
    if (c) for (const o of capObjects(c, caps, this.capMaterials)) this.capsGroup.add(o);
    this.clipPlanes.length = 0;
    this.clipPlanes.push(...clipPlanes(c));
    for (const m of [...this.materials.values(), this.edgeMaterial, this.highlightMaterial, this.hoverMaterial, this.markLine, this.hoverLine]) {
      m.clippingPlanes = this.clipPlanes;
      m.clipShadows = true;
      m.needsUpdate = true;
    }
    this.requestRender();
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

  /**
   * Det objekt som syns under en punkt i fönstret, för klick, högerklick och
   * hovring: en kropp, eller ett markobjekt där marken ligger närmast (0.10.11).
   */
  idAt(clientX: number, clientY: number): string | null {
    const e = { clientX, clientY };
    const hit = this.hitAt(e);
    const g = this.ground;
    const end = Math.min(hit?.distance ?? Infinity, this.camera.far);
    const at = g ? groundHit(this.ray(e).ray, (p) => g.height(p), this.camera.near, end, this.clipPlanes) : null;
    const onGround = at ? g!.pick(at) : null;
    return onGround ?? (hit ? (hit.object.userData as { id: string }).id : null);
  }

  /**
   * Det första som syns under markören: inte marken, och inte det som en
   * sektion klipper bort (*Följ sektionen*). Klippningen görs bara när
   * bilden ritas, så träffar på den bortklippta sidan sorteras bort här.
   */
  private hitAt(e: Pick<PointerEvent, 'clientX' | 'clientY'>): THREE.Intersection | undefined {
    return this.ray(e)
      .intersectObjects(this.meshes, false)
      .find((h) => (h.object.userData as { material: Material3D }).material !== 'floor' && shown(this.clipPlanes, h.point));
  }

  /**
   * Det som en ruta i fönstret tar (0.10.27), som i planen: "window" det som
   * syns helt inom rutan, "crossing" allt som nuddar den. Objekten jämförs
   * med sina hörn räknade till skärmen, utom det som en sektion klipper
   * bort; ett objekt som delvis ligger bakom kameran ryms aldrig helt.
   * Rummens golv tas inte, som med ett klick.
   */
  idsInRect(r: ScreenRect, mode: 'window' | 'crossing'): string[] {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const boxes = new Map<string, { minX: number; minY: number; maxX: number; maxY: number; behind: boolean }>();
    const v = new THREE.Vector3();
    const add = (id: string, x: number, y: number, z: number) => {
      v.set(x, y, z);
      if (!shown(this.clipPlanes, v)) return;
      let b = boxes.get(id);
      if (!b) boxes.set(id, (b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, behind: false }));
      v.project(this.camera);
      if (v.z > 1 || v.z < -1) {
        b.behind = true;
        return;
      }
      const sx = rect.left + ((v.x + 1) / 2) * rect.width;
      const sy = rect.top + ((1 - v.y) / 2) * rect.height;
      b.minX = Math.min(b.minX, sx);
      b.maxX = Math.max(b.maxX, sx);
      b.minY = Math.min(b.minY, sy);
      b.maxY = Math.max(b.maxY, sy);
    };
    this.root.updateMatrixWorld();
    for (const m of this.meshes) {
      const { id, material } = m.userData as { id: string; material: Material3D };
      if (material === 'floor' || !m.visible) continue;
      const pos = m.geometry.getAttribute('position');
      const w = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        w.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        add(id, w.x, w.y, w.z);
      }
    }
    // Markobjekten med sina konturer på marken (mm, z uppåt).
    const g = this.ground;
    if (g)
      for (const id of g.ids()) {
        const o = g.outline(id);
        if (o) for (let i = 0; i < o.length; i += 3) add(id, o[i] / 1000, o[i + 2] / 1000, -o[i + 1] / 1000);
      }
    const ids: string[] = [];
    for (const [id, b] of boxes) {
      if (b.minX > b.maxX) continue;
      const inside = !b.behind && b.minX >= r.minX && b.maxX <= r.maxX && b.minY >= r.minY && b.maxY <= r.maxY;
      const touches = b.maxX >= r.minX && b.minX <= r.maxX && b.maxY >= r.minY && b.minY <= r.maxY;
      if (mode === 'window' ? inside : touches) ids.push(id);
    }
    return ids;
  }

  private pick(e: PointerEvent): void {
    this.onPick?.(this.idAt(e.clientX, e.clientY), e.shiftKey || e.ctrlKey || e.metaKey || e.pointerType === 'touch');
  }
}

