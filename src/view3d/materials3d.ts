import * as THREE from 'three';
import type { Material3D } from '../repr/solids';

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

/** Materialets textur (0.10.31): bilden och dess sida i mm. */
export interface Texture3D {
  asset: string;
  size: number;
}

/** Ortofotot på marken (0.10.31): bilden, avbildningen från planens mm till bilden (nio tal radvis) och var det syns. */
export interface Ortho3D {
  asset: string;
  matrix: number[];
  mode: 'base' | 'all';
}

/**
 * 3D-vyns material (delade ur view3d.ts i granskningen efter 0.11.8): de
 * inbyggda per materialsort, egna kulörer (0.10.28), texturer och ortofotot
 * (0.10.31). Materialen görs en gång och klipps med vyns `clipPlanes`;
 * `onImage` anropas när en bild laddats, så att vyn ritas om.
 */
export class Materials3D {
  private materials = new Map<string, THREE.Material>();
  /** Bilderna för texturerna och ortofotot (0.10.31), per fil. */
  private images = new Map<string, THREE.Texture>();
  /** Projektets fil som URL (0.10.31), för texturerna. Sätts av den som äger vyn. */
  assetUrl: ((id: string) => string | null) | null = null;
  /** Klippplanen (0.7.1); vyn fyller på samma lista när snittet ändras. */
  readonly clipPlanes: THREE.Plane[] = [];

  private readonly onImage: () => void;

  constructor(onImage: () => void) {
    this.onImage = onImage;
  }

  /** Alla material som gjorts, för att uppdatera klippningen. */
  all(): Iterable<THREE.Material> {
    return this.materials.values();
  }

  /** Materialet för en kropp: texturen om den finns, annars kulören, annars sortens. */
  of(kind: Material3D, color?: string, texture?: Texture3D): THREE.Material {
    return texture ? this.look(color ?? null, texture) : color ? this.color(color) : this.plain(kind);
  }

  /** Ett material med en egen kulör (0.10.28), för markens material och stödmurarna. */
  color(color: string): THREE.Material {
    const key = `kulör:${color}`;
    let m = this.materials.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.92, side: THREE.DoubleSide });
      m.clippingPlanes = this.clipPlanes;
      m.clipShadows = true;
      this.materials.set(key, m);
    }
    return m;
  }

  /** Bilden i filen `asset` (0.10.31), laddad en gång; vyn ritas om när den kommit. Null om filen saknas. */
  private image(asset: string): THREE.Texture | null {
    const had = this.images.get(asset);
    if (had) return had;
    const url = this.assetUrl?.(asset);
    if (!url) return null;
    const t = new THREE.Texture();
    t.colorSpace = THREE.SRGBColorSpace;
    const img = new Image();
    img.onload = () => {
      t.image = img;
      t.needsUpdate = true;
      this.onImage();
    };
    img.src = url;
    this.images.set(asset, t);
    return t;
  }

  /**
   * Materialets utseende (0.10.31): kulören och texturen. Texturen upprepas
   * med sidan `size` mm (koordinaterna är i mm). Kulören gäller tills bilden
   * har laddats; med en textur färgar den inte bilden.
   */
  look(color: string | null, texture?: Texture3D): THREE.Material {
    const plain = () => (color ? this.color(color) : this.plain('ground'));
    if (!texture) return plain();
    const key = `textur:${texture.asset}@${texture.size}`;
    const had = this.materials.get(key);
    if (had) return had;
    const img = this.image(texture.asset);
    if (!img) return plain();
    const map = img.clone();
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(1 / texture.size, 1 / texture.size);
    const m = new THREE.MeshStandardMaterial({ map, color: 0xffffff, roughness: 0.92, side: THREE.DoubleSide });
    m.clippingPlanes = this.clipPlanes;
    m.clipShadows = true;
    this.materials.set(key, m);
    return m;
  }

  /** Ortofotot på marken (0.10.31), med avbildningen från planens mm till bilden. */
  ortho(o: Ortho3D): THREE.Material | null {
    const key = `orto:${o.asset}:${o.matrix.join(',')}`;
    const had = this.materials.get(key);
    if (had) return had;
    const img = this.image(o.asset);
    if (!img) return null;
    const map = img.clone();
    map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
    map.matrixAutoUpdate = false;
    const q = o.matrix;
    map.matrix.set(q[0], q[1], q[2], q[3], q[4], q[5], q[6], q[7], q[8]);
    const m = new THREE.MeshStandardMaterial({ map, color: 0xffffff, roughness: 1, side: THREE.DoubleSide });
    m.clippingPlanes = this.clipPlanes;
    m.clipShadows = true;
    this.materials.set(key, m);
    return m;
  }

  plain(kind: Material3D): THREE.Material {
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
}
