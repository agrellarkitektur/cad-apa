import earcut from 'earcut';
import { difference, intersection, type Rings } from '../geometry/boolean';
import type { Vec2 } from './primitives';
import { zOn, type Solid } from './solids';

/**
 * Trianglar för en extruderad form med genomgående urtag (öppningar i en
 * vägg). Varje yta byggs som en enda polygon med hål, så att väggytan blir
 * hel runt dörrar och fönster: inga skarvar och inga T-korsningar där små
 * glipor kan synas. Resultatet är x, y, z för tre hörn per triangel, i mm.
 */
export function solidTriangles(s: Solid): number[] {
  const out: number[] = [];
  const { z0, z1 } = s;
  const footprint: Rings = s.rings;
  const EPS = 0.5;
  const zTop = (p: Vec2) => (s.top ? zOn(s.top, p[0], p[1]) : z1);
  const zBot = (p: Vec2) => (s.bottom ? zOn(s.bottom, p[0], p[1]) : z0);

  // Urtagens faktiska form inom formen, och deras höjder.
  const cuts = (s.cuts ?? [])
    .map((c) => ({ polys: intersection(footprint, [c.rings]), z0: Math.max(z0, c.z0), z1: Math.min(z1, c.z1) }))
    .filter((c) => c.polys.length && c.z1 - c.z0 > EPS);

  // Ovansida och undersida, med hål där urtagen går ända upp eller ned.
  const capAt = (z: (p: Vec2) => number, through: (c: (typeof cuts)[number]) => boolean) => {
    const holes = cuts.filter(through).flatMap((c) => c.polys);
    const polys = holes.length ? difference(footprint, holes) : [footprint];
    for (const poly of polys) pushPolygon(out, poly, (p) => [p[0], p[1], z(p)]);
  };
  capAt(zTop, (c) => c.z1 >= z1 - EPS);
  capAt(zBot, (c) => c.z0 <= z0 + EPS);

  // Sidorna: varje kant av konturen blir en rektangel (längs kanten × höjd)
  // med urtagen som hål.
  for (const ring of footprint) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < EPS) continue;
      const dir: Vec2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      const holes: Rings[] = [];
      for (const c of cuts) {
        for (const poly of c.polys) {
          for (const [p, q] of edgesOf(poly)) {
            const u = onEdge(a, dir, len, p, q, EPS);
            if (u && u[1] - u[0] > EPS) holes.push([[[u[0], c.z0], [u[1], c.z0], [u[1], c.z1], [u[0], c.z1]]]);
          }
        }
      }
      const face: Rings = [[[0, zBot(a)], [len, zBot(b)], [len, zTop(b)], [0, zTop(a)]]];
      const polys = holes.length ? difference(face, holes) : [face];
      for (const poly of polys) pushPolygon(out, poly, (p) => [a[0] + dir[0] * p[0], a[1] + dir[1] * p[0], p[1]]);
    }
  }

  // Smygarna: urtagens kanter inne i formen, plus bröstningens ovansida och
  // överstyckets undersida.
  for (const c of cuts) {
    for (const poly of c.polys) {
      for (const [p, q] of edgesOf(poly)) {
        if (onFootprint(footprint, p, q, EPS)) continue;
        out.push(p[0], p[1], c.z0, q[0], q[1], c.z0, q[0], q[1], c.z1);
        out.push(p[0], p[1], c.z0, q[0], q[1], c.z1, p[0], p[1], c.z1);
      }
      if (c.z0 > z0 + EPS) pushPolygon(out, poly, (p) => [p[0], p[1], c.z0]);
      if (c.z1 < z1 - EPS) pushPolygon(out, poly, (p) => [p[0], p[1], c.z1]);
    }
  }
  return out;
}

function edgesOf(poly: Rings): [Vec2, Vec2][] {
  return poly.flatMap((ring) => ring.map((p, i) => [p, ring[(i + 1) % ring.length]] as [Vec2, Vec2]));
}

/** Om sträckan p–q ligger på kanten a + dir·u (0 ≤ u ≤ len): dess intervall i u. */
function onEdge(a: Vec2, dir: Vec2, len: number, p: Vec2, q: Vec2, eps: number): [number, number] | null {
  const off = (r: Vec2) => Math.abs((r[0] - a[0]) * dir[1] - (r[1] - a[1]) * dir[0]);
  if (off(p) > eps || off(q) > eps) return null;
  const up = (p[0] - a[0]) * dir[0] + (p[1] - a[1]) * dir[1];
  const uq = (q[0] - a[0]) * dir[0] + (q[1] - a[1]) * dir[1];
  const u0 = Math.max(0, Math.min(up, uq));
  const u1 = Math.min(len, Math.max(up, uq));
  return u1 > u0 ? [u0, u1] : null;
}

function onFootprint(footprint: Rings, p: Vec2, q: Vec2, eps: number): boolean {
  for (const [a, b] of edgesOf(footprint)) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < eps) continue;
    const u = onEdge(a, [(b[0] - a[0]) / len, (b[1] - a[1]) / len], len, p, q, eps);
    if (u && u[1] - u[0] >= Math.hypot(q[0] - p[0], q[1] - p[1]) - eps) return true;
  }
  return false;
}

function pushPolygon(out: number[], poly: Rings, to3: (p: Vec2) => [number, number, number]): void {
  const flat: number[] = [];
  const holes: number[] = [];
  const pts: Vec2[] = [];
  poly.forEach((ring, i) => {
    if (i > 0) holes.push(pts.length);
    for (const p of ring) {
      flat.push(p[0], p[1]);
      pts.push(p);
    }
  });
  const tri = earcut(flat, holes);
  for (const k of tri) out.push(...to3(pts[k]));
}
