import type { EndKind, PPoint, ProfileSection, SubProfile } from '../core/profileTypes';
import { difference, union, type Rings } from '../geometry/boolean';
import type { Vec2 } from '../repr/primitives';
import type { Edges3D, Plane, Solid } from '../repr/solids';

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

const v3 = {
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

export { v3 };

/** Ett plan som halvrum: det som behålls är `n·x ≤ d`. */
export interface HalfSpace {
  n: Vec3;
  d: number;
}

const halfAt = (n: Vec3, p: Vec3): HalfSpace => ({ n, d: v3.dot(n, p) });

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

// ---------- Konvexa kroppar ----------

/** En konvex kropp som en lista med plana sidor (punkterna i ordning runt sidan). */
export type Poly3 = Vec3[][];

/** Sutherland–Hodgman: en plan polygon kapad till halvrummet; punkterna på planet samlas i `onPlane`. */
function clipFace(face: Vec3[], h: HalfSpace, onPlane: Vec3[]): Vec3[] {
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
function orderOnPlane(pts: Vec3[], n: Vec3): Vec3[] {
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
  for (const f of poly) {
    const c = clipFace(f, h, onPlane);
    if (c.length >= 3) faces.push(c);
  }
  const cap = orderOnPlane(onPlane, h.n);
  if (cap.length >= 3 && faces.length) faces.push(cap);
  return faces.length >= 4 ? faces : [];
}

/** Ett prisma: cellen (i världen, i början och slutet) med sidorna. */
function prism(a: Vec3[], b: Vec3[]): Poly3 {
  const faces: Poly3 = [[...a].reverse(), b];
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    faces.push([a[i], a[j], b[j], b[i]]);
  }
  return faces;
}

const centroid = (poly: Poly3): Vec3 => {
  const all = poly.flat();
  return v3.mul(all.reduce((s, p) => v3.add(s, p), [0, 0, 0] as Vec3), 1 / Math.max(1, all.length));
};

/** Sidans normal (Newell), vänd utåt från kroppens mitt. */
function faceNormal(f: Vec3[], c: Vec3): Vec3 {
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

const area2 = (r: readonly Vec2[]): number => {
  let a = 0;
  for (let i = 0; i < r.length; i++) a += r[i][0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * r[i][1];
  return a / 2;
};

const ccw = (r: Vec2[]): Vec2[] => (area2(r) < 0 ? [...r].reverse() : r);

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

/** En konvex polygon kapad till halvplanet a·x + b·y + c ≥ 0. */
export function clipHalfPlane(r: readonly Vec2[], a: number, b: number, c: number): Vec2[] {
  const out: Vec2[] = [];
  const f = (p: Vec2) => a * p[0] + b * p[1] + c;
  for (let i = 0; i < r.length; i++) {
    const p = r[i];
    const q = r[(i + 1) % r.length];
    const fp = f(p);
    const fq = f(q);
    if (fp >= 0) out.push(p);
    if ((fp >= 0) !== (fq >= 0)) {
      const t = fp / (fp - fq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

// ---------- Kroppen som lodräta extruderingar ----------

/** Planet z = a·x + b·y + c genom en sida med normalen n. */
function planeOf(n: Vec3, p: Vec3): Plane {
  return [-n[0] / n[2], -n[1] / n[2], p[2] + (n[0] * p[0] + n[1] * p[1]) / n[2]];
}

const zAt = (pl: Plane, q: Vec2) => pl[0] * q[0] + pl[1] * q[1] + pl[2];

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

// ---------- Svepningen ----------

/** Hur tvärsnittet läggs på banan: ankaret, förskjutningen, vridningen kring ankaret och spegling. */
export interface Placement {
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

/** Ett avslut i en ände. */
export interface EndSpec {
  kind: EndKind;
  /** Vinkeln i planen för `angle`, grader från vinkelrätt. */
  angle?: number;
  /** Utöver referenslinjens längd (i stället för inom). */
  beyond?: boolean;
  /** Förskjutning, mm; plus ut från linjen. */
  shift?: number;
}

/** Banans ram i en rak bit: riktningen, x åt höger och y uppåt. */
export interface Frame {
  t: Vec3;
  X: Vec3;
  Y: Vec3;
}

/** Ramen för en rak bit från a till b: lodrätt (`up` plumb) eller vinkelrätt mot banan uppåt. En lodrät bit (pelare) har x längs x-axeln. */
export function frameOf(a: Vec3, b: Vec3, up: 'plumb' | 'normal'): Frame | null {
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
 * Avslutets halvrum i en ände (0.11.6, beslut G): planet läggs så att hela
 * tvärsnittet ryms inom referenslinjen (*Inom*) eller så att det sticker ut
 * utöver den (*Utöver*), och flyttas sedan förskjutningen (plus ut).
 */
export function endHalfSpace(p: Vec3, tOut: Vec3, f: Frame, pts: readonly PPoint[], e: EndSpec, extra = 0): HalfSpace {
  const n = endNormal(e.kind, tOut, e.angle);
  const nt = v3.dot(n, tOut);
  const k = Math.abs(nt) > 1e-6 ? nt : 1;
  const a = pts.map((q) => (q[0] * v3.dot(n, f.X) + q[1] * v3.dot(n, f.Y)) / k);
  const s = a.length ? (e.beyond ? Math.max(...a) : Math.min(...a)) : 0;
  return halfAt(n, v3.add(p, v3.mul(tOut, s + (e.shift ?? 0) + extra)));
}

/** Geringen i en knäck mellan riktningarna ta och tb: planet genom punkten med normalen längs medelriktningen. */
function miter(p: Vec3, ta: Vec3, tb: Vec3): HalfSpace {
  let n = v3.norm(v3.add(ta, tb));
  if (v3.len(n) < 0.5) n = ta;
  return halfAt(n, p);
}

/** En svept del: delprofilen, biten av banan och kroppen. */
export interface SweptPiece {
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
  const margin = 10 * Math.max(1, ...all.map((q) => Math.hypot(q[0], q[1])));
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
      for (const cell of cells) {
        let poly = prism(
          cell.map((q) => world(a, s.f, q, -margin)),
          cell.map((q) => world(a, s.f, q, L + margin)),
        );
        poly = clipPoly(poly, lo);
        if (poly.length) poly = clipPoly(poly, hi);
        if (poly.length) out.pieces.push({ part: ri, segment: s.i, poly });
      }
      // Kantlinjerna: hörnen längs biten, och konturen i början (och i slutet på den sista biten).
      for (const poly of reg.polys)
        for (const ring of poly) {
          for (const c of edgeCorners(ring)) {
            const p0 = hitPlane(a, s.f, ring[c] as PPoint, lo);
            const p1 = hitPlane(a, s.f, ring[c] as PPoint, hi);
            if (p0 && p1) out.edges.push([...p0, ...p1]);
          }
          // Konturen i en knäck bara där banan viker mer än 8° (inte i bågarnas korta bitar).
          const prev = k ? segs[k - 1] : closed ? last : null;
          const kink = !prev || v3.dot(prev.f.t, s.f.t) < Math.cos((8 * Math.PI) / 180);
          for (const h of [...(kink ? [lo] : []), ...(k === segs.length - 1 && !closed ? [hi] : [])]) {
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

/** Kroppens fotavtryck (det konvexa höljet av hörnen i planet) och höjderna. */
export function footprint(poly: Poly3): { ring: Vec2[] | null; z0: number; z1: number } {
  const all = poly.flat();
  return { ring: hull(all.map((p): Vec2 => [p[0], p[1]])), z0: Math.min(...all.map((p) => p[2])), z1: Math.max(...all.map((p) => p[2])) };
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
