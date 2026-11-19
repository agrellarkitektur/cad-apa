// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import type { Vec2 } from '../repr/primitives';
import type { Plane, Solid } from '../repr/solids';


/**
 * Profilen svept längs banan (0.11.6), som ren räkning. Varje delprofil
 * delas i konvexa celler (band i x, `stripCells`), och varje cell sveps längs
 * varje rak bit av banan som en konvex kropp, kapad av planen i ändarna och
 * i knäckarna (gering). Kroppen görs sedan om till programmets 3D-format
 * (lodräta extruderingar med sneda ovan- och undersidor, `solidsOf`), så att
 * 3D-vyn, sektionerna och fasaderna ritar den som allt annat. Kantlinjerna
 * levereras för sig: delprofilernas hörn längs banan och konturerna i
 * ändarna och knäckarna.
 */

export type Vec3 = [number, number, number];

export const v3 = {
  add: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a: Vec3): number => Math.hypot(a[0], a[1], a[2]),
  norm: (a: Vec3): Vec3 => {
    const l = Math.hypot(a[0], a[1], a[2]);
    return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
  },
};

/** Ett plan som halvrum: det som behålls är `n·x ≤ d`. */
export interface HalfSpace {
  n: Vec3;
  d: number;
}

export const halfAt = (n: Vec3, p: Vec3): HalfSpace => ({ n, d: v3.dot(n, p) });

// ---------- Konvexa kroppar ----------

/** En konvex kropp som en lista med plana sidor (punkterna i ordning runt sidan). */
export type Poly3 = Vec3[][];

/** Sutherland–Hodgman: en plan polygon kapad till halvrummet; punkterna på planet samlas i `onPlane`. */
export function clipFace(face: Vec3[], h: HalfSpace, onPlane: Vec3[]): Vec3[] {
  const out: Vec3[] = [];
  const side = (p: Vec3) => v3.dot(h.n, p) - h.d;
  for (let i = 0; i < face.length; i++) {
    const a = face[i];
    const b = face[(i + 1) % face.length];
    const sa = side(a);
    const sb = side(b);
    if (sa <= 1e-9) out.push(a);
    if (sa <= 1e-9 && Math.abs(sa) <= 1e-9) onPlane.push(a);
    if ((sa < -1e-9 && sb > 1e-9) || (sa > 1e-9 && sb < -1e-9)) {
      const t = sa / (sa - sb);
      const p = v3.add(a, v3.mul(v3.sub(b, a), t));
      out.push(p);
      onPlane.push(p);
    }
  }
  return out;
}

/** Punkter i ett plan i ordning runt deras mitt. */
export function orderOnPlane(pts: Vec3[], n: Vec3): Vec3[] {
  const uniq: Vec3[] = [];
  for (const p of pts) if (!uniq.some((q) => v3.len(v3.sub(p, q)) < 1e-6)) uniq.push(p);
  if (uniq.length < 3) return [];
  const c = v3.mul(uniq.reduce((s, p) => v3.add(s, p), [0, 0, 0] as Vec3), 1 / uniq.length);
  const u = v3.norm(v3.sub(uniq[0], c));
  const w = v3.cross(n, u);
  return uniq.map((p) => ({ p, a: Math.atan2(v3.dot(v3.sub(p, c), w), v3.dot(v3.sub(p, c), u)) })).sort((a, b) => a.a - b.a).map((x) => x.p);
}

/** Den konvexa kroppen kapad till halvrummet. */
export function clipPoly(poly: Poly3, h: HalfSpace): Poly3 {
  const onPlane: Vec3[] = [];
  const faces: Poly3 = [];
  // En sida som redan ligger i planet är locket (0.11.7: ändprofilens kanter kan sammanfalla med tvärsnittets).
  let hasCap = false;
  for (const f of poly) {
    if (f.every((p) => Math.abs(v3.dot(h.n, p) - h.d) <= 1e-6)) {
      if (v3.dot(faceNormal(f, centroid(poly)), h.n) > 0) {
        faces.push(f);
        hasCap = true;
      }
      continue;
    }
    const c = clipFace(f, h, onPlane);
    if (c.length >= 3) faces.push(c);
  }
  const cap = hasCap ? [] : orderOnPlane(onPlane, h.n);
  if (cap.length >= 3 && faces.length) faces.push(cap);
  return faces.length >= 4 ? faces : [];
}

/** Ett prisma: cellen (i världen, i början och slutet) med sidorna. */
export function prism(a: Vec3[], b: Vec3[]): Poly3 {
  const faces: Poly3 = [[...a].reverse(), b];
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    faces.push([a[i], a[j], b[j], b[i]]);
  }
  return faces;
}

export const centroid = (poly: Poly3): Vec3 => {
  const all = poly.flat();
  return v3.mul(all.reduce((s, p) => v3.add(s, p), [0, 0, 0] as Vec3), 1 / Math.max(1, all.length));
};

/** Sidans normal (Newell), vänd utåt från kroppens mitt. */
export function faceNormal(f: Vec3[], c: Vec3): Vec3 {
  let n: Vec3 = [0, 0, 0];
  for (let i = 0; i < f.length; i++) {
    const a = f[i];
    const b = f[(i + 1) % f.length];
    n = v3.add(n, [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]);
  }
  n = v3.norm(n);
  return v3.dot(n, v3.sub(f[0], c)) < 0 ? v3.mul(n, -1) : n;
}

// ---------- Konvexa polygoner i planet ----------

export const area2 = (r: readonly Vec2[]): number => {
  let a = 0;
  for (let i = 0; i < r.length; i++) a += r[i][0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * r[i][1];
  return a / 2;
};

export const ccw = (r: Vec2[]): Vec2[] => (area2(r) < 0 ? [...r].reverse() : r);

/** Två konvexa polygoner (moturs) skurna med varandra. */
export function clipConvex(subject: readonly Vec2[], clip: readonly Vec2[]): Vec2[] {
  let out: Vec2[] = [...subject];
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const inside = (p: Vec2) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-9;
    const input = out;
    out = [];
    for (let k = 0; k < input.length; k++) {
      const p = input[k];
      const q = input[(k + 1) % input.length];
      const pi = inside(p);
      const qi = inside(q);
      if (pi) out.push(p);
      if (pi !== qi) {
        const d1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
        const d2 = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
        const t = d1 / (d1 - d2);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return out;
}

// ---------- Kroppen som lodräta extruderingar ----------

/** Planet z = a·x + b·y + c genom en sida med normalen n. */
export function planeOf(n: Vec3, p: Vec3): Plane {
  return [-n[0] / n[2], -n[1] / n[2], p[2] + (n[0] * p[0] + n[1] * p[1]) / n[2]];
}

export const zAt = (pl: Plane, q: Vec2) => pl[0] * q[0] + pl[1] * q[1] + pl[2];

/** En plan projektion och dess plan (ovan- eller undersida). */
export interface Facet {
  ring: Vec2[];
  plane: Plane;
}

/** Kroppens ovansidor och undersidor, projicerade i planet. */
export function facets(poly: Poly3): { tops: Facet[]; bottoms: Facet[] } {
  const c = centroid(poly);
  const tops: Facet[] = [];
  const bottoms: Facet[] = [];
  for (const f of poly) {
    const n = faceNormal(f, c);
    if (Math.abs(n[2]) < 1e-7) continue;
    const ring = ccw(f.map((p): Vec2 => [p[0], p[1]]));
    if (Math.abs(area2(ring)) < 1e-3) continue;
    (n[2] > 0 ? tops : bottoms).push({ ring, plane: planeOf(n, f[0]) });
  }
  return { tops, bottoms };
}

/**
 * Den konvexa kroppen som lodräta extruderingar: varje del av planet där en
 * ovansida och en undersida möts blir en form med deras plan.
 */
export function solidsOf(id: string, poly: Poly3, base: Partial<Solid>): Solid[] {
  const { tops, bottoms } = facets(poly);
  const out: Solid[] = [];
  for (const t of tops)
    for (const b of bottoms) {
      const ring = clipConvex(t.ring, b.ring);
      if (ring.length < 3 || Math.abs(area2(ring)) < 0.5) continue;
      const flatTop = Math.abs(t.plane[0]) < 1e-9 && Math.abs(t.plane[1]) < 1e-9;
      const flatBot = Math.abs(b.plane[0]) < 1e-9 && Math.abs(b.plane[1]) < 1e-9;
      const z1 = Math.max(...ring.map((q) => zAt(t.plane, q)));
      const z0 = Math.min(...ring.map((q) => zAt(b.plane, q)));
      if (z1 - z0 < 0.01) continue;
      out.push({ material: 'frame', ...base, id, rings: [ring], z0, z1, ...(flatTop ? {} : { top: t.plane }), ...(flatBot ? {} : { bottom: b.plane }), noEdges: true } as Solid);
    }
  return out;
}
