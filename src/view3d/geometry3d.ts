import * as THREE from 'three';
import earcut from 'earcut';
import type { Vec2 } from '../repr/primitives';
import { solidTriangles } from '../repr/mesh';
import type { Solid } from '../repr/solids';

/**
 * 3D-vyns geometri (granskningen efter 0.10.12, förut i `view3d.ts`):
 * kroppar, klippningen längs en sektion, snittytorna och var en stråle
 * går ner i marken. Allt i modellens mm med z uppåt; scenen vrider och
 * skalar till meter med y uppåt.
 */

/** En sektion som klipper 3D-vyn: start, riktningen åt höger och blickriktningen (enhetsvektorer). */
export interface Clip3D {
  start: readonly [number, number];
  right: readonly [number, number];
  view: readonly [number, number];
  length: number;
  depth: number | null;
}

/** En snittyta: konturer i linjens koordinater (x längs linjen, y höjd över nollnivån). */
export interface Cap3D {
  poche: boolean;
  rings: (readonly (readonly [number, number])[])[];
}

/**
 * Planen som klipper modellen längs en sektion (0.7.1): det som ligger
 * bakom betraktaren, utanför linjens ändar eller bortom djupet syns inte.
 */
export function clipPlanes(c: Clip3D | null): THREE.Plane[] {
  const planes: THREE.Plane[] = [];
  if (!c) return planes;
  // Modellens (x, y, z) i mm blir (x, z, −y) i meter.
  const plane = (n: readonly [number, number], p: readonly [number, number]) => new THREE.Plane(new THREE.Vector3(n[0], 0, -n[1]), -(n[0] * p[0] + n[1] * p[1]) * 0.001);
  const at = (u: number, d: number): [number, number] => [c.start[0] + c.right[0] * u + c.view[0] * d, c.start[1] + c.right[1] * u + c.view[1] * d];
  planes.push(plane(c.view, c.start));
  planes.push(plane(c.right, c.start));
  planes.push(plane([-c.right[0], -c.right[1]], at(c.length, 0)));
  if (c.depth !== null) planes.push(plane([-c.view[0], -c.view[1]], at(0, c.depth)));
  return planes;
}

/**
 * Fyll snittet: ytorna ligger i sektionens plan. Väggar, bjälklag och tak
 * blir mörka som i ritningen, annat grått.
 */
export function capObjects(
  c: Pick<Clip3D, 'start' | 'right' | 'view'>,
  caps: Cap3D[],
  mat: { poche: THREE.Material; other: THREE.Material; edge: THREE.LineBasicMaterial },
): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  const at = (u: number, z: number): [number, number, number] => [c.start[0] + c.right[0] * u + c.view[0] * 0.5, c.start[1] + c.right[1] * u + c.view[1] * 0.5, z];
  for (const cap of caps) {
    const rings = cap.rings.filter((r) => r.length >= 3);
    if (!rings.length) continue;
    const flat: number[] = [];
    const holes: number[] = [];
    for (const [k, r] of rings.entries()) {
      if (k > 0) holes.push(flat.length / 2);
      for (const q of r) flat.push(q[0], q[1]);
    }
    const tri = earcut(flat, holes);
    const pos: number[] = [];
    for (let i = 0; i < flat.length; i += 2) pos.push(...at(flat[i], flat[i + 1]));
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geom.setIndex(tri);
    out.push(new THREE.Mesh(geom, cap.poche ? mat.poche : mat.other));
    const edges: number[] = [];
    for (const r of rings)
      for (let i = 0; i < r.length; i++) {
        const a = r[i];
        const b = r[(i + 1) % r.length];
        edges.push(...at(a[0], a[1]), ...at(b[0], b[1]));
      }
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.Float32BufferAttribute(edges, 3));
    out.push(new THREE.LineSegments(eg, mat.edge));
  }
  return out;
}

/** Om en punkt i scenen syns, dvs. inte är bortklippt av en sektion. */
export function shown(planes: readonly THREE.Plane[], p: THREE.Vector3): boolean {
  return planes.every((pl) => pl.distanceToPoint(p) >= -1e-6);
}

/**
 * Där strålen först går ner i den färdiga marken, i planens mm, om det är
 * närmare än `before` (meter). Marken provas i steg längs strålen, längre
 * ju längre bort, och punkten letas sedan upp mellan två steg. Inte det som
 * en sektion klipper bort.
 */
export function groundHit(
  ray: THREE.Ray,
  height: (p: Vec2) => number | null,
  near: number,
  end: number,
  planes: readonly THREE.Plane[],
): Vec2 | null {
  const o = ray.origin;
  const d = ray.direction;
  const at = (t: number): Vec2 => [(o.x + d.x * t) * 1000, -(o.z + d.z * t) * 1000];
  const above = (t: number): boolean | null => {
    const h = height(at(t));
    return h === null ? null : (o.y + d.y * t) * 1000 > h;
  };
  let prev = near;
  let was = above(prev);
  for (let t = prev; t < end; ) {
    t = Math.min(end, t + Math.max(0.1, t * 0.004));
    const now = above(t);
    if (was === true && now === false) {
      let lo = prev;
      let hi = t;
      for (let k = 0; k < 24; k++) {
        const mid = (lo + hi) / 2;
        if (above(mid) === false) hi = mid;
        else lo = mid;
      }
      return shown(planes, new THREE.Vector3(o.x + d.x * hi, o.y + d.y * hi, o.z + d.z * hi)) ? at(hi) : null;
    }
    prev = t;
    was = now;
    if (t >= end) break;
  }
  return null;
}

/** Ett vågrätt plan på höjden z (mm) i scenens koordinater (meter, y uppåt). */
export function horizontalPlane(zMm: number): THREE.Plane {
  return new THREE.Plane(new THREE.Vector3(0, 1, 0), -zMm / 1000);
}

/** En CSS-variabels färg som rgb, med var() upplöst. */
export function resolveColor(name: string, fallback: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${name}, ${fallback})`;
  document.body.appendChild(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  return c || fallback;
}

/** Släpp geometrin i ett objekt och allt under det. */
export function disposeTree(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const g = (o as THREE.Mesh).geometry;
    if (g) g.dispose();
  });
}

/** Töm en grupp och släpp geometrin i det som låg i den. */
export function clearGroup(g: THREE.Group): void {
  for (const c of g.children) disposeTree(c);
  g.clear();
}

/** En plan form med hål, extruderad från z0 till z1 (mm). */
export function extrude(s: Solid): THREE.BufferGeometry | null {
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
