// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import type { EndKind, PPoint, ProfileSection, SubProfile } from '../core/profileTypes';
import { difference, intersection, union, type Rings } from '../geometry/boolean';
import type { Vec2 } from '../repr/primitives';
import type { Edges3D } from '../repr/solids';
import { type Vec3, v3, type HalfSpace, halfAt, type Poly3, clipPoly, prism, area2 } from './poly3';

export { v3 };

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

// ---------- Tvärsnittet i celler ----------

/**
 * Delprofilernas ytor: en senare delprofil som ligger ovanpå en tidigare tar
 * sin yta ur den (B ovanpå A ger A ett hål). Polygoner med hål.
 */
export function partRegions(section: ProfileSection): { part: SubProfile; polys: Rings[] }[] {
  const rings = section.parts.map((p) => p.ring as Vec2[]);
  return section.parts.map((p, i) => {
    const later = rings.slice(i + 1).map((r): Rings => [r]);
    const polys = later.length ? difference([rings[i]], later) : [[rings[i]]];
    return { part: p.part, polys };
  });
}

/**
 * En yta (polygoner med hål) i konvexa celler: band mellan hörnens x, och i
 * varje band trapetser mellan kanterna som korsar det, parvis nerifrån.
 */
export function stripCells(polys: readonly Rings[]): PPoint[][] {
  const edges: [Vec2, Vec2][] = [];
  const xs: number[] = [];
  for (const poly of polys)
    for (const ring of poly)
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        xs.push(a[0]);
        if (Math.abs(a[0] - b[0]) > 1e-9) edges.push(a[0] < b[0] ? [a, b] : [b, a]);
      }
  xs.sort((a, b) => a - b);
  const cuts = xs.filter((x, i) => !i || x - xs[i - 1] > 1e-6);
  const out: PPoint[][] = [];
  for (let k = 1; k < cuts.length; k++) {
    const xa = cuts[k - 1];
    const xb = cuts[k];
    const xm = (xa + xb) / 2;
    const ys = edges
      .filter(([a, b]) => a[0] < xm && b[0] > xm)
      .map(([a, b]) => {
        const at = (x: number) => a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
        return { ya: at(xa), yb: at(xb), ym: at(xm) };
      })
      .sort((p, q) => p.ym - q.ym);
    for (let i = 0; i + 1 < ys.length; i += 2) {
      const lo = ys[i];
      const hi = ys[i + 1];
      const cell: PPoint[] = [[xa, lo.ya], [xb, lo.yb], [xb, hi.yb], [xa, hi.ya]];
      const clean = cell.filter((p, j) => {
        const q = cell[(j + cell.length - 1) % cell.length];
        return Math.abs(p[0] - q[0]) > 1e-6 || Math.abs(p[1] - q[1]) > 1e-6;
      });
      if (clean.length >= 3) out.push(clean);
    }
  }
  return out;
}

// ---------- Svepningen ----------

/** Hur tvärsnittet läggs på banan: ankaret, förskjutningen, vridningen kring ankaret och spegling. */
interface Placement {
  anchor: PPoint;
  offset?: readonly [number, number];
  /** Grader moturs kring ankaret. */
  rotate?: number;
  mirror?: boolean;
}

/** En punkt i typens tvärsnitt i banans tvärsnitt (x åt höger om banan, y uppåt). */
export function placePoint(p: PPoint, pl: Placement): PPoint {
  let x = p[0] - pl.anchor[0];
  let y = p[1] - pl.anchor[1];
  const r = ((pl.rotate ?? 0) * Math.PI) / 180;
  if (r) [x, y] = [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
  if (pl.mirror) x = -x;
  return [x + (pl.offset?.[0] ?? 0), y + (pl.offset?.[1] ?? 0)];
}

/**
 * En ändprofils kontur i en ände (0.11.7), uträknad: i sidovyn med u ut från
 * referenslinjens ände (Inom/Utöver och förskjutningen inräknade) och y som
 * tvärsnittets y efter placeringen. Allt bortom `minU` som inte ligger i
 * konturen tas bort; `cells` är konturen i konvexa celler, `rings` dess
 * ytterlinjer (för kantlinjerna).
 */
export interface EndShape {
  cells: PPoint[][];
  rings: Rings[];
  minU: number;
  maxU: number;
  /**
   * Tvärsnittets y-axel i banans tvärsnitt (x, y) när profilen är vriden
   * kring ankaret eller speglad (0.11.7.3); utelämnad är den ramens Y.
   */
  axis?: Vec2;
}

/** Ramen för en ände med ändprofil: Y längs ändprofilens axel (en vriden profil), X vinkelrätt mot den. */
function endFrame(f: Frame, sh: EndShape | undefined): Frame {
  const d = sh?.axis;
  if (!d) return f;
  return { t: f.t, X: v3.add(v3.mul(f.X, d[1]), v3.mul(f.Y, -d[0])), Y: v3.add(v3.mul(f.X, d[0]), v3.mul(f.Y, d[1])) };
}

/** Tvärsnittets punkter i ändens ram (`endFrame`). */
function endPoints(pts: readonly PPoint[], sh: EndShape | undefined): PPoint[] {
  const d = sh?.axis;
  return d ? pts.map((q): PPoint => [q[0] * d[1] - q[1] * d[0], q[0] * d[0] + q[1] * d[1]]) : [...pts];
}

/** Ett avslut i en ände. */
export interface EndSpec {
  kind: EndKind;
  /** Ändprofilens typ (en PA-typs id) för `profile`. */
  profile?: string;
  /** Ändprofilens kontur, uträknad (sparas inte). */
  shape?: EndShape;
  /** Vinkeln i planen för `angle`, grader från vinkelrätt. */
  angle?: number;
  /** Utöver referenslinjens längd (i stället för inom). */
  beyond?: boolean;
  /** Förskjutning, mm; plus ut från linjen. */
  shift?: number;
}

/** Banans ram i en rak bit: riktningen, x åt höger och y uppåt. */
interface Frame {
  t: Vec3;
  X: Vec3;
  Y: Vec3;
}

/** Ramen för en rak bit från a till b: lodrätt (`up` plumb) eller vinkelrätt mot banan uppåt. En lodrät bit (pelare) har x längs x-axeln. */
function frameOf(a: Vec3, b: Vec3, up: 'plumb' | 'normal'): Frame | null {
  const d = v3.sub(b, a);
  const L = v3.len(d);
  if (L < 1e-6) return null;
  const t = v3.mul(d, 1 / L);
  const h = Math.hypot(t[0], t[1]);
  if (h < 1e-6) return { t: [0, 0, t[2] > 0 ? 1 : -1], X: [1, 0, 0], Y: [0, 1, 0] };
  const X: Vec3 = [t[1] / h, -t[0] / h, 0];
  const Y: Vec3 = up === 'normal' ? v3.norm(v3.sub([0, 0, 1], v3.mul(t, t[2]))) : [0, 0, 1];
  return { t, X, Y };
}

/** Avslutets plan med normalen utåt, för en ände i punkten p där banan går ut åt `tOut`. */
function endNormal(kind: EndKind, tOut: Vec3, angle = 0): Vec3 {
  const h = Math.hypot(tOut[0], tOut[1]);
  let n: Vec3 = tOut;
  if (kind === 'plumb' && h > 1e-6) n = [tOut[0] / h, tOut[1] / h, 0];
  else if (kind === 'level' && Math.abs(tOut[2]) > 1e-3) n = [0, 0, tOut[2] > 0 ? 1 : -1];
  else if (kind === 'angle' && h > 1e-6) {
    const a = (angle * Math.PI) / 180;
    const d: Vec3 = [tOut[0] / h, tOut[1] / h, 0];
    n = [d[0] * Math.cos(a) - d[1] * Math.sin(a), d[0] * Math.sin(a) + d[1] * Math.cos(a), 0];
  }
  return v3.norm(n);
}

/**
 * Ett halvrum ur sidovyn i en ände (0.11.7): `a·u + b·y ≤ c`, där u går ut
 * längs banan från punkten p och y längs ramens Y. Planet innehåller alltid
 * ramens X (tvärs banan), så att ändprofilen skär rakt igenom tvärsnittet.
 */
function uyHalf(p: Vec3, tOut: Vec3, f: Frame, a: number, b: number, c: number): HalfSpace {
  const g = v3.dot(tOut, f.Y);
  const det = 1 - g * g || 1;
  let n = v3.add(v3.mul(tOut, (a - b * g) / det), v3.mul(f.Y, (b - a * g) / det));
  const l = v3.len(n) || 1;
  n = v3.mul(n, 1 / l);
  return { n, d: c / l + v3.dot(n, p) };
}

/**
 * En konvex kropp i en ände med ändprofil: det före konturen (u ≤ minU) och
 * kroppen skuren med var och en av konturens konvexa celler.
 */
function endCut(poly: Poly3, p: Vec3, tOut: Vec3, f: Frame, sh: EndShape, extra: number): Poly3[] {
  const out: Poly3[] = [];
  const before = clipPoly(poly, uyHalf(p, tOut, f, 1, 0, sh.minU + extra));
  if (before.length) out.push(before);
  for (const cell of sh.cells) {
    let q = poly;
    for (let i = 0; i < cell.length && q.length; i++) {
      const A = cell[i];
      const B = cell[(i + 1) % cell.length];
      const eu = B[0] - A[0];
      const ey = B[1] - A[1];
      // Moturs cell: insidan till vänster om kanten.
      q = clipPoly(q, uyHalf(p, tOut, f, ey, -eu, ey * (A[0] + extra) - eu * A[1]));
    }
    if (q.length) out.push(q);
  }
  return out;
}

/**
 * Kantlinjerna för en ände med ändprofil: konturen (inom tvärsnittets höjd)
 * på tvärsnittets båda sidor och linjer tvärs över i konturens hörn.
 */
function endShapeEdges(p: Vec3, tOut: Vec3, f: Frame, sh: EndShape, own: readonly PPoint[], extra: number): Edges3D['segments'] {
  const xs = own.map((q) => q[0]);
  const ys = own.map((q) => q[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const band: Rings = [[[sh.minU, y0], [sh.maxU + 1, y0], [sh.maxU + 1, y1], [sh.minU, y1]]];
  let rings: Rings[];
  try {
    rings = sh.rings.flatMap((poly) => intersection(poly, [band]));
  } catch {
    rings = sh.rings;
  }
  const at = (u: number, x: number, y: number): Vec3 => v3.add(v3.add(p, v3.mul(tOut, u + extra)), v3.add(v3.mul(f.X, x), v3.mul(f.Y, y)));
  const out: Edges3D['segments'] = [];
  const onJoint = (q: Vec2) => Math.abs(q[0] - sh.minU) < 0.5;
  for (const poly of rings)
    for (const ring of poly)
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        if (!(onJoint(a) && onJoint(b))) for (const x of [x0, x1]) out.push([...at(a[0], x, a[1]), ...at(b[0], x, b[1])]);
        // Tvärs över bara i skarpa hörn (inte i bågarnas korta bitar).
        const z = ring[(i + ring.length - 1) % ring.length];
        const t1 = Math.atan2(a[1] - z[1], a[0] - z[0]);
        const t2 = Math.atan2(b[1] - a[1], b[0] - a[0]);
        let turn = Math.abs(t2 - t1);
        if (turn > Math.PI) turn = 2 * Math.PI - turn;
        if (!onJoint(a) && turn > (20 * Math.PI) / 180) out.push([...at(a[0], x0, a[1]), ...at(a[0], x1, a[1])]);
      }
  return out;
}

/**
 * Avslutets halvrum i en ände (0.11.6, beslut G): planet läggs så att hela
 * tvärsnittet ryms inom referenslinjen (*Inom*) eller så att det sticker ut
 * utöver den (*Utöver*), och flyttas sedan förskjutningen (plus ut).
 */
function endHalfSpace(p: Vec3, tOut: Vec3, f: Frame, pts: readonly PPoint[], e: EndSpec, extra = 0): HalfSpace {
  // En ändprofil: kroppen går till konturens yttersta punkt och skärs sedan med konturen (`endCut`).
  if (e.shape) return uyHalf(p, tOut, endFrame(f, e.shape), 1, 0, e.shape.maxU + extra);
  const n = endNormal(e.kind, tOut, e.angle);
  const nt = v3.dot(n, tOut);
  const k = Math.abs(nt) > 1e-6 ? nt : 1;
  const a = pts.map((q) => (q[0] * v3.dot(n, f.X) + q[1] * v3.dot(n, f.Y)) / k);
  const s = a.length ? (e.beyond ? Math.max(...a) : Math.min(...a)) : 0;
  return halfAt(n, v3.add(p, v3.mul(tOut, s + (e.shift ?? 0) + extra)));
}

/** Hur långt avslutets plan når in längs banan från referenslinjens ände (mm), samma räkning som `endHalfSpace`. */
function cutDepth(tOut: Vec3, f: Frame, pts: readonly PPoint[], e: EndSpec, extra = 0): number {
  if (e.shape) return Math.max(0, -(e.shape.minU + extra));
  const n = endNormal(e.kind, tOut, e.angle);
  const nt = v3.dot(n, tOut);
  if (Math.abs(nt) < 1e-6 || !pts.length) return 0;
  const a = pts.map((q) => (q[0] * v3.dot(n, f.X) + q[1] * v3.dot(n, f.Y)) / nt);
  const s = e.beyond ? Math.max(...a) : Math.min(...a);
  return Math.max(...a) - (s + (e.shift ?? 0) + extra);
}

/**
 * Hur långt avsluten skär in (0.11.6.1): djupet i början och slutet (mm in
 * från referenslinjens ände, det största för någon delprofil) och längden på
 * banans första och sista raka bit. Når ett avslut förbi biten skär det in i
 * nästa bit, eller i det andra avslutet, och kroppen blir fel där.
 */
export function endReach(regions: readonly { polys: Rings[]; follows: boolean; extend: number }[], path: readonly Vec3[], up: 'plumb' | 'normal', start: EndSpec, end: EndSpec): { start: number; end: number; first: number; last: number; single: boolean } | null {
  const pts = path.filter((p, i) => !i || v3.len(v3.sub(p, path[i - 1])) > 1e-3);
  const segs: { f: Frame; L: number }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const f = frameOf(pts[i - 1], pts[i], up);
    if (f) segs.push({ f, L: v3.len(v3.sub(pts[i], pts[i - 1])) });
  }
  if (!segs.length) return null;
  const all = regions.flatMap((r) => r.polys.flatMap((p) => p.flat()) as PPoint[]);
  const first = segs[0];
  const last = segs[segs.length - 1];
  let d0 = 0;
  let d1 = 0;
  for (const reg of regions) {
    const own = reg.polys.flatMap((p) => p.flat()) as PPoint[];
    if (!own.length) continue;
    const sq: EndSpec = { kind: 'square' };
    d0 = Math.max(d0, cutDepth(v3.mul(first.f.t, -1), first.f, reg.follows ? all : own, reg.follows ? start : { ...sq, shift: start.shift }, reg.extend));
    d1 = Math.max(d1, cutDepth(last.f.t, last.f, reg.follows ? all : own, reg.follows ? end : { ...sq, shift: end.shift }, reg.extend));
  }
  return { start: d0, end: d1, first: first.L, last: last.L, single: segs.length === 1 };
}

/** Geringen i en knäck mellan riktningarna ta och tb: planet genom punkten med normalen längs medelriktningen. */
function miter(p: Vec3, ta: Vec3, tb: Vec3): HalfSpace {
  let n = v3.norm(v3.add(ta, tb));
  if (v3.len(n) < 0.5) n = ta;
  return halfAt(n, p);
}

/** En svept del: delprofilen, biten av banan och kroppen. */
interface SweptPiece {
  part: number;
  segment: number;
  poly: Poly3;
}

export interface SweepResult {
  pieces: SweptPiece[];
  edges: Edges3D['segments'];
  /** Banans bitar och deras ramar. */
  frames: (Frame | null)[];
}

const world = (p: Vec3, f: Frame, q: PPoint, u: number): Vec3 => [p[0] + f.t[0] * u + f.X[0] * q[0] + f.Y[0] * q[1], p[1] + f.t[1] * u + f.X[1] * q[0] + f.Y[1] * q[1], p[2] + f.t[2] * u + f.X[2] * q[0] + f.Y[2] * q[1]];

/** Var linjen p + q + λt skär planet. */
function hitPlane(p: Vec3, f: Frame, q: PPoint, h: HalfSpace): Vec3 | null {
  const o = world(p, f, q, 0);
  const nt = v3.dot(h.n, f.t);
  if (Math.abs(nt) < 1e-9) return null;
  return world(p, f, q, (h.d - v3.dot(h.n, o)) / nt);
}

/** Hörn i en ring som ger en kantlinje längs banan: skarpa hörn, och i en rundad ring de yttersta punkterna. */
function edgeCorners(ring: readonly Vec2[]): number[] {
  const out = new Set<number>();
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[(i + n - 1) % n];
    const b = ring[i];
    const c = ring[(i + 1) % n];
    const t1 = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const t2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
    let d = Math.abs(t2 - t1);
    if (d > Math.PI) d = 2 * Math.PI - d;
    if (d > (20 * Math.PI) / 180) out.add(i);
  }
  if (n > 12) {
    const by = (f: (p: Vec2) => number) => ring.reduce((best, p, i) => (f(p) > f(ring[best]) ? i : best), 0);
    for (const k of [by((p) => p[0]), by((p) => -p[0]), by((p) => p[1]), by((p) => -p[1])]) out.add(k);
  }
  return [...out];
}

/**
 * Svepningen: tvärsnittets delprofiler (placerade, i banans tvärsnitt) längs
 * banans punkter i 3D. Ändarna får sina avslut, knäckarna gering.
 * `ends[i]` gäller delprofil i: avslutet i början och slutet och den egna
 * förlängningen.
 */
export function sweep(regions: readonly { polys: Rings[]; follows: boolean; extend: number }[], path: readonly Vec3[], up: 'plumb' | 'normal', start: EndSpec, end: EndSpec): SweepResult {
  const pts = path.filter((p, i) => !i || v3.len(v3.sub(p, path[i - 1])) > 1e-3);
  const frames: (Frame | null)[] = [];
  for (let i = 1; i < pts.length; i++) frames.push(frameOf(pts[i - 1], pts[i], up));
  const out: SweepResult = { pieces: [], edges: [], frames };
  const segs = frames.map((f, i) => ({ f, i })).filter((s): s is { f: Frame; i: number } => !!s.f);
  if (!segs.length) return out;
  const all = regions.flatMap((r) => r.polys.flatMap((p) => p.flat()) as PPoint[]);
  const first = segs[0];
  const last = segs[segs.length - 1];
  // En sluten bana (början i slutet, minst tre bitar) geras också där den börjar.
  const closed = segs.length >= 3 && v3.len(v3.sub(pts[0], pts[pts.length - 1])) < 1e-3;
  const reachOut = Math.max(0, ...[start, end].map((e) => (e.shape ? Math.abs(e.shape.maxU) + Math.abs(e.shape.minU) : 0)));
  const margin = 10 * Math.max(1, ...all.map((q) => Math.hypot(q[0], q[1]))) + reachOut;
  regions.forEach((reg, ri) => {
    const own = reg.polys.flatMap((p) => p.flat()) as PPoint[];
    if (!own.length) return;
    const sq: EndSpec = { kind: 'square' };
    const s0 = endHalfSpace(pts[first.i], v3.mul(first.f.t, -1), first.f, reg.follows ? all : own, reg.follows ? start : { ...sq, shift: start.shift }, reg.extend);
    const s1 = endHalfSpace(pts[last.i + 1], last.f.t, last.f, reg.follows ? all : own, reg.follows ? end : { ...sq, shift: end.shift }, reg.extend);
    const cells = stripCells(reg.polys);
    segs.forEach((s, k) => {
      const a = pts[s.i];
      const b = pts[s.i + 1];
      const L = v3.len(v3.sub(b, a));
      const lo = k === 0 ? (closed ? miter(a, v3.mul(last.f.t, -1), v3.mul(s.f.t, -1)) : s0) : miter(a, v3.mul(segs[k - 1].f.t, -1), v3.mul(s.f.t, -1));
      const hi = k === segs.length - 1 ? (closed ? miter(b, s.f.t, first.f.t) : s1) : miter(b, s.f.t, segs[k + 1].f.t);
      // Ändprofilerna (0.11.7) i den första och den sista biten, för delprofiler som följer avslutet.
      const shapeLo = k === 0 && !closed && reg.follows ? start.shape : undefined;
      const shapeHi = k === segs.length - 1 && !closed && reg.follows ? end.shape : undefined;
      const tLo = v3.mul(s.f.t, -1);
      for (const cell of cells) {
        let poly = prism(
          cell.map((q) => world(a, s.f, q, -margin)),
          cell.map((q) => world(a, s.f, q, L + margin)),
        );
        poly = clipPoly(poly, lo);
        if (poly.length) poly = clipPoly(poly, hi);
        if (!poly.length) continue;
        let polys = [poly];
        if (shapeLo) polys = polys.flatMap((q) => endCut(q, a, tLo, endFrame(s.f, shapeLo), shapeLo, reg.extend));
        if (shapeHi) polys = polys.flatMap((q) => endCut(q, b, s.f.t, endFrame(s.f, shapeHi), shapeHi, reg.extend));
        for (const q of polys) out.pieces.push({ part: ri, segment: s.i, poly: q });
      }
      // Kantlinjerna i en ände med ändprofil slutar där konturen börjar.
      const loE = shapeLo ? uyHalf(a, tLo, endFrame(s.f, shapeLo), 1, 0, shapeLo.minU + reg.extend) : lo;
      const hiE = shapeHi ? uyHalf(b, s.f.t, endFrame(s.f, shapeHi), 1, 0, shapeHi.minU + reg.extend) : hi;
      if (shapeLo) out.edges.push(...endShapeEdges(a, tLo, endFrame(s.f, shapeLo), shapeLo, endPoints(own, shapeLo), reg.extend));
      if (shapeHi) out.edges.push(...endShapeEdges(b, s.f.t, endFrame(s.f, shapeHi), shapeHi, endPoints(own, shapeHi), reg.extend));
      // Kantlinjerna: hörnen längs biten, och konturen i början (och i slutet på den sista biten).
      for (const poly of reg.polys)
        for (const ring of poly) {
          for (const c of edgeCorners(ring)) {
            const p0 = hitPlane(a, s.f, ring[c] as PPoint, loE);
            const p1 = hitPlane(a, s.f, ring[c] as PPoint, hiE);
            if (p0 && p1) out.edges.push([...p0, ...p1]);
          }
          // Konturen i en knäck bara där banan viker mer än 8° (inte i bågarnas korta bitar).
          const prev = k ? segs[k - 1] : closed ? last : null;
          const kink = !prev || v3.dot(prev.f.t, s.f.t) < Math.cos((8 * Math.PI) / 180);
          for (const h of [...(kink && !shapeLo ? [lo] : []), ...(k === segs.length - 1 && !closed && !shapeHi ? [hi] : [])]) {
            const ps = ring.map((q) => hitPlane(a, s.f, q as PPoint, h));
            for (let j = 0; j < ps.length; j++) {
              const p = ps[j];
              const q = ps[(j + 1) % ps.length];
              if (p && q) out.edges.push([...p, ...q]);
            }
          }
        }
    });
  });
  return out;
}

/** Kroppens snitt i höjden h: en konvex polygon per del, eller null när den inte går genom höjden. */
export function sliceAt(poly: Poly3, h: number): Vec2[] | null {
  const pts: Vec2[] = [];
  for (const f of poly)
    for (let i = 0; i < f.length; i++) {
      const a = f[i];
      const b = f[(i + 1) % f.length];
      if ((a[2] - h) * (b[2] - h) < 0) {
        const t = (h - a[2]) / (b[2] - a[2]);
        pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      } else if (Math.abs(a[2] - h) < 1e-6) pts.push([a[0], a[1]]);
    }
  return hull(pts);
}

/** Det konvexa höljet (moturs), eller null för färre än tre punkter. */
export function hull(pts: readonly Vec2[]): Vec2[] | null {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return null;
  const cr = (o: Vec2, a: Vec2, b: Vec2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Vec2[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cr(lower[lower.length - 2], lower[lower.length - 1], q) <= 1e-9) lower.pop();
    lower.push(q);
  }
  const upper: Vec2[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cr(upper[upper.length - 2], upper[upper.length - 1], q) <= 1e-9) upper.pop();
    upper.push(q);
  }
  const h = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  return h.length >= 3 && Math.abs(area2(h)) > 1e-3 ? h : null;
}

/**
 * Ytorna ihopslagna, utan att räkna en ensam yta. Punkterna avrundas till
 * 0,01 mm först; går sammanslagningen ändå inte att räkna (polygon-clipping
 * kan fastna i ytor som delar kanter) blir ytorna kvar var för sig.
 */
export function merged(rings: Vec2[][]): Rings[] {
  if (rings.length <= 1) return rings.map((r) => [r]);
  const rr = (v: number) => Math.round(v * 100) / 100;
  try {
    return union(rings.map((r): Rings => [r.map((q): Vec2 => [rr(q[0]), rr(q[1])])]));
  } catch {
    return rings.map((r) => [r]);
  }
}
