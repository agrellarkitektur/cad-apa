import type { PPoint, ProfileContour, ProfileTypeModel } from './profileTypes';

/**
 * Profileditorns ritverktyg (0.11.6.1), ren räkning på typens konturer:
 * *Förskjut* (hela konturen eller en kant), *Runda hörn* och sträckningen
 * när ett mått i ritytan ändras. Konturerna har bågar som pilhöjd per kant
 * (plus åt vänster om kanten), se `flatContour`.
 */

type V = [number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
const cross = (a: V, b: V) => a[0] * b[1] - a[1] * b[0];
const len = (a: V) => Math.hypot(a[0], a[1]);
const unit = (a: V): V => {
  const l = len(a);
  return l > 1e-12 ? [a[0] / l, a[1] / l] : [1, 0];
};
const rot = (a: V, t: number): V => [a[0] * Math.cos(t) - a[1] * Math.sin(t), a[0] * Math.sin(t) + a[1] * Math.cos(t)];

const bulgesOf = (c: ProfileContour) => c.pts.map((_, i) => Number(c.bulges?.[i]) || 0);
const withBulges = (pts: PPoint[], bs: number[]): ProfileContour => ({ pts, ...(bs.some((b) => Math.abs(b) > 1e-9) ? { bulges: bs } : {}) });

/** Konturens area med tecken (moturs positiv), med bågarnas segment. */
export function contourArea(c: ProfileContour): number {
  const n = c.pts.length;
  const bs = bulgesOf(c);
  let a = 0;
  for (let i = 0; i < n; i++) {
    const p = c.pts[i];
    const q = c.pts[(i + 1) % n];
    a += (p[0] * q[1] - q[0] * p[1]) / 2;
    const b = bs[i];
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (Math.abs(b) < 1e-9 || L < 1e-9) continue;
    const h = L / 2;
    const R = (h * h + b * b) / (2 * Math.abs(b));
    const sweep = 4 * Math.atan(Math.abs(b) / h);
    // En båge åt vänster om kanten tar ytan ur en kontur moturs.
    a -= Math.sign(b) * ((R * R) / 2) * (sweep - Math.sin(sweep));
  }
  return a;
}

/** Kantens riktning i början och slutet (en båge åt vänster börjar vriden moturs). */
function tangents(a: V, b: V, bulge: number): { t0: V; t1: V; half: number } {
  const u = unit(sub(b, a));
  const L = len(sub(b, a));
  const half = Math.abs(bulge) > 1e-9 && L > 1e-9 ? 2 * Math.atan(Math.abs(bulge) / (L / 2)) : 0;
  const s = Math.sign(bulge);
  return { t0: rot(u, s * half), t1: rot(u, -s * half), half };
}

/** Pilhöjden för en båge med samma vinkel över en ny korda. */
const bulgeFor = (pa: V, pb: V, oldBulge: number, half: number) => (Math.abs(oldBulge) < 1e-9 ? 0 : Math.sign(oldBulge) * (len(sub(pb, pa)) / 2) * Math.tan(half / 2));

/**
 * Förskjut konturen `d` mm utåt (minus inåt): hela konturen, eller bara
 * kanten `edge` (dess grannar förlängs eller kortas). Bågarna behåller sin
 * vinkel. Null när konturen skulle vända sig eller sakna yta.
 */
export function offsetContour(c: ProfileContour, d: number, edge?: number): ProfileContour | null {
  const n = c.pts.length;
  if (n < 2 || !Number.isFinite(d)) return null;
  const area = contourArea(c);
  const o = area < 0 ? -1 : 1;
  const bs = bulgesOf(c);
  const tg = c.pts.map((p, i) => tangents(p, c.pts[(i + 1) % n], bs[i]));
  const out = (t: V): V => mul([t[1], -t[0]], o);
  const dist = (i: number) => (edge === undefined || edge === i ? d : 0);
  const pts = c.pts.map((p, i): PPoint => {
    const j = (i + n - 1) % n;
    const dIn = dist(j);
    const dOut = dist(i);
    if (!dIn && !dOut) return [p[0], p[1]];
    const t1 = tg[j].t1;
    const t2 = tg[i].t0;
    const A = mul(out(t1), dIn);
    const B = mul(out(t2), dOut);
    const k = cross(t1, t2);
    if (Math.abs(k) < 1e-9) return add(p, dOut ? B : A) as PPoint;
    const s = cross(sub(B, A), t2) / k;
    return add(p, add(A, mul(t1, s))) as PPoint;
  });
  const next = withBulges(
    pts,
    bs.map((b, i) => bulgeFor(pts[i], pts[(i + 1) % n], b, tg[i].half)),
  );
  const a2 = contourArea(next);
  if (Math.sign(a2) !== Math.sign(area) || Math.abs(a2) < 1) return null;
  return next;
}

/** Ta bort punkter som sammanfaller med nästa (kanten utan längd faller bort). */
function dedupe(pts: PPoint[], bs: number[]): ProfileContour {
  for (let j = 0; j < pts.length && pts.length > 2; j++) {
    const q = pts[(j + 1) % pts.length];
    if (Math.hypot(q[0] - pts[j][0], q[1] - pts[j][1]) < 0.05) {
      pts.splice((j + 1) % pts.length, 1);
      bs.splice(j, 1);
      j--;
    }
  }
  return withBulges(pts, bs);
}

/**
 * Runda hörnet i punkten `i` med radien `r` (mm): hörnet byts mot två
 * punkter och en båge mellan. Bara mellan två raka kanter; radien minskas så
 * att bågen ryms på den kortare kanten. Null när det inte går.
 */
export function filletContour(c: ProfileContour, i: number, r: number): { contour: ProfileContour; r: number } | null {
  const n = c.pts.length;
  if (n < 3 || !(r > 0) || !c.pts[i]) return null;
  const bs = bulgesOf(c);
  const j = (i + n - 1) % n;
  if (Math.abs(bs[j]) > 1e-9 || Math.abs(bs[i]) > 1e-9) return null;
  const P = c.pts[i] as V;
  const A = c.pts[j] as V;
  const B = c.pts[(i + 1) % n] as V;
  const la = len(sub(A, P));
  const lb = len(sub(B, P));
  if (la < 1e-6 || lb < 1e-6) return null;
  const u = unit(sub(A, P));
  const v = unit(sub(B, P));
  const phi = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
  if (phi < 1e-3 || phi > Math.PI - 1e-3) return null;
  let t = r / Math.tan(phi / 2);
  const tMax = Math.min(la, lb);
  if (t > tMax) t = tMax;
  const rr = t * Math.tan(phi / 2);
  const p1 = add(P, mul(u, t)) as PPoint;
  const p2 = add(P, mul(v, t)) as PPoint;
  const sweep = Math.PI - phi;
  const sag = rr * (1 - Math.cos(sweep / 2));
  const bulge = Math.sign(cross(sub(p2, p1), sub(P, p1))) * sag;
  const pts = c.pts.map((q): PPoint => [q[0], q[1]]);
  pts.splice(i, 1, p1, p2);
  const nb = [...bs];
  nb.splice(i, 0, bulge);
  return { contour: dedupe(pts, nb), r: rr };
}

/** Den närmaste punkten på en ring (sluten polygon): punkten, avståndet och kanten. */
export function closestOnRing(ring: readonly PPoint[], p: PPoint): { at: PPoint; dist: number; edge: number } {
  let best = { at: ring[0] ?? p, dist: Infinity, edge: 0 };
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const d = sub(b as V, a as V);
    const l2 = d[0] * d[0] + d[1] * d[1];
    const t = l2 > 1e-12 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / l2)) : 0;
    const q: PPoint = [a[0] + d[0] * t, a[1] + d[1] * t];
    const dist = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (dist < best.dist) best = { at: q, dist, edge: i };
  }
  return best;
}

/** Ligger punkten inuti ringen? */
export function insideRing(ring: readonly PPoint[], p: PPoint): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Avståndet med tecken från kantens linje (plus utåt) för kanten `i` i konturen. */
export function edgeDistance(c: ProfileContour, i: number, p: PPoint): number {
  const n = c.pts.length;
  const a = c.pts[i] as V;
  const b = c.pts[(i + 1) % n] as V;
  const o = contourArea(c) < 0 ? -1 : 1;
  const u = unit(sub(b, a));
  return o * cross(sub(p as V, a), u);
}

// ---------- Måtten i ritytan ----------

/** Ett mått i ritytan: lodrätt (`height`, y från–till) eller vågrätt (`width`, x), ritat vid `at`; kan peka på en parameter. */
export interface ProfileDim {
  axis: 'height' | 'width';
  from: number;
  to: number;
  /** Måttlinjens läge på den andra axeln (x för ett lodrätt mått). */
  at: number;
  /** Parametern måttet styrs av (värdet är måttet). */
  param?: string;
}

const EPS = 0.05;

/**
 * Sträck typen vid `at` längs axeln: allt på eller bortom `at` flyttas
 * `delta` (punkterna, de egna ankarpunkterna, sträckzonernas och måttens
 * gränser). Bågar som sträcks behåller sin vinkel. Ändrar `m`.
 */
export function stretchModel(m: ProfileTypeModel, axis: 'height' | 'width', at: number, delta: number): void {
  if (!delta) return;
  const k = axis === 'height' ? 1 : 0;
  const mv = (v: number) => (v >= at - EPS ? v + delta : v);
  for (const p of m.parts) {
    const n = p.contour.pts.length;
    const bs = bulgesOf(p.contour);
    const tg = p.contour.pts.map((q, i) => tangents(q as V, p.contour.pts[(i + 1) % n] as V, bs[i]));
    const pts = p.contour.pts.map((q): PPoint => (k ? [q[0], mv(q[1])] : [mv(q[0]), q[1]]));
    p.contour = withBulges(
      pts,
      bs.map((b, i) => bulgeFor(pts[i], pts[(i + 1) % n], b, tg[i].half)),
    );
  }
  for (const a of m.anchors) if (a.at) a.at = k ? [a.at[0], mv(a.at[1])] : [mv(a.at[0]), a.at[1]];
  for (const z of m.zones)
    if (z.axis === axis) {
      z.from = mv(z.from);
      z.to = mv(z.to);
    }
  for (const d of m.dims ?? []) {
    if (d.axis === axis) {
      d.from = mv(d.from);
      d.to = mv(d.to);
    } else d.at = mv(d.at);
  }
}

/** Parametrarna som mått pekar på får måttets värde. */
export function syncDims(m: ProfileTypeModel): ProfileTypeModel {
  for (const d of m.dims ?? []) {
    const q = d.param ? m.params.find((x) => x.name === d.param) : undefined;
    if (q && typeof q.value === 'number') q.value = Math.round((d.to - d.from) * 10) / 10;
  }
  return m;
}

/** Ändra måttet till `value` mm: det bortre (högre eller högra) sträcks. Sant om något ändrades. */
export function setDim(m: ProfileTypeModel, i: number, value: number): boolean {
  const d = m.dims?.[i];
  if (!d || !Number.isFinite(value)) return false;
  const delta = Math.max(1, value) - (d.to - d.from);
  if (Math.abs(delta) < 1e-6) return false;
  stretchModel(m, d.axis, d.to, delta);
  syncDims(m);
  return true;
}
