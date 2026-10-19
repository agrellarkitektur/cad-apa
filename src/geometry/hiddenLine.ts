/**
 * Dolda linjer i en parallellprojektion (fasader och sektioner).
 *
 * Allt ges i vykoordinater: x åt höger, y uppåt och d, djupet bort från
 * betraktaren. En kant syns där ingen triangel ligger framför den. För varje
 * kant räknas, triangel för triangel, den del av kanten som ligger innanför
 * triangeln i bilden och bakom dess plan; det som blir kvar ritas.
 *
 * Det är exakt för plana ytor och räknas i bråkdelar av kanten, inte i
 * pixlar, så resultatet håller för PDF och DXF. Ett rutnät över bilden gör
 * att varje kant bara prövas mot trianglarna i närheten.
 */

export type V3 = readonly [x: number, y: number, d: number];

export interface Seg<K> {
  a: V3;
  b: V3;
  key: K;
}

export interface Visible<K> {
  a: readonly [number, number];
  b: readonly [number, number];
  key: K;
}

/** Hur långt bakom en yta en kant måste ligga för att räknas som dold (mm). */
const DEPTH_EPS = 1.5;
/** Kortare synliga bitar än så här kastas (mm). */
const MIN_PIECE = 0.3;

interface Occluder {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  cx: number;
  cy: number;
  /** 1 eller -1: åt vilket håll triangeln går i bilden. */
  s: number;
  /** Djupet över triangelns plan: d = px·x + py·y + p0. */
  px: number;
  py: number;
  p0: number;
  dmin: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Klipp en triangel (eller polygon) mot djupintervallet [d0, d1]. */
export function clipDepth(poly: V3[], d0: number, d1: number | null): V3[] {
  let pts = clipPlane(poly, (p) => p[2] - d0);
  if (d1 !== null) pts = clipPlane(pts, (p) => d1 - p[2]);
  return pts;
}

/** Klipp en polygon mot halvrummet f(p) ≥ 0, där f är linjär. */
export function clipPlane(poly: V3[], f: (p: V3) => number): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const fa = f(a);
    const fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  return out;
}

/** Klipp en sträcka mot djupintervallet; null om inget blir kvar. */
export function clipSegDepth(a: V3, b: V3, d0: number, d1: number | null): [V3, V3] | null {
  return clipSegAxis(a, b, 2, d0, d1);
}

/** Klipp en sträcka mot ett intervall längs en axel (0 = x, 1 = y, 2 = djup). */
export function clipSegAxis(a: V3, b: V3, axis: 0 | 1 | 2, d0: number, d1: number | null): [V3, V3] | null {
  let t0 = 0;
  let t1 = 1;
  const lim = (fa: number, fb: number) => {
    // f(t) = fa + t(fb − fa) ≥ 0
    if (fa < 0 && fb < 0) return false;
    if (fa >= 0 && fb >= 0) return true;
    const t = fa / (fa - fb);
    if (fa < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    return true;
  };
  if (!lim(a[axis] - d0, b[axis] - d0)) return null;
  if (d1 !== null && !lim(d1 - a[axis], d1 - b[axis])) return null;
  if (t1 - t0 < 1e-9) return null;
  const at = (t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  return [at(t0), at(t1)];
}

function makeOccluder(a: V3, b: V3, c: V3): Occluder | null {
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  // Ytor som syns från kanten (väggarnas ovansida i en fasad) skymmer inget.
  if (Math.abs(area) < 1) return null;
  // Djupet som ett plan i bilden: lös d = px·x + py·y + p0 genom hörnen.
  const px = ((b[2] - a[2]) * (c[1] - a[1]) - (c[2] - a[2]) * (b[1] - a[1])) / area;
  const py = ((c[2] - a[2]) * (b[0] - a[0]) - (b[2] - a[2]) * (c[0] - a[0])) / area;
  const p0 = a[2] - px * a[0] - py * a[1];
  return {
    ax: a[0],
    ay: a[1],
    bx: b[0],
    by: b[1],
    cx: c[0],
    cy: c[1],
    s: area > 0 ? 1 : -1,
    px,
    py,
    p0,
    dmin: Math.min(a[2], b[2], c[2]),
    minX: Math.min(a[0], b[0], c[0]),
    minY: Math.min(a[1], b[1], c[1]),
    maxX: Math.max(a[0], b[0], c[0]),
    maxY: Math.max(a[1], b[1], c[1]),
  };
}

/**
 * De synliga delarna av kanterna. `triangles` är platta listor med nio tal
 * per triangel (x, y, d för tre hörn).
 */
export function visibleSegments<K>(segs: readonly Seg<K>[], triangles: readonly (readonly number[])[]): Visible<K>[] {
  const occ: Occluder[] = [];
  for (const tris of triangles) {
    for (let i = 0; i + 8 < tris.length; i += 9) {
      const o = makeOccluder([tris[i], tris[i + 1], tris[i + 2]], [tris[i + 3], tris[i + 4], tris[i + 5]], [tris[i + 6], tris[i + 7], tris[i + 8]]);
      if (o) occ.push(o);
    }
  }
  if (!segs.length) return [];
  // Närmast betraktaren först (0.8.1). Då ligger varje rutas trianglar i
  // djupordning: när en triangel ligger bakom kanten gör resten av rutan det
  // också, och den som döljer kanten helt hittas tidigt.
  occ.sort((p, q) => p.dmin - q.dmin);

  // Rutnät över bilden.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const o of occ) {
    minX = Math.min(minX, o.minX);
    minY = Math.min(minY, o.minY);
    maxX = Math.max(maxX, o.maxX);
    maxY = Math.max(maxY, o.maxY);
  }
  const N = Math.max(64, Math.min(256, Math.round(Math.sqrt(occ.length) * 2)));
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const cw = w / N;
  const ch = h / N;
  const cells: number[][] = Array.from({ length: N * N }, () => []);
  const cx = (x: number) => Math.max(0, Math.min(N - 1, Math.floor((x - minX) / cw)));
  const cy = (y: number) => Math.max(0, Math.min(N - 1, Math.floor((y - minY) / ch)));
  occ.forEach((o, i) => {
    for (let gx = cx(o.minX); gx <= cx(o.maxX); gx++) for (let gy = cy(o.minY); gy <= cy(o.maxY); gy++) cells[gy * N + gx].push(i);
  });

  const stamp = new Int32Array(occ.length).fill(-1);
  const out: Visible<K>[] = [];
  segs.forEach((seg, si) => {
    const { a, b } = seg;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < MIN_PIECE) return;
    const sMinX = Math.min(a[0], b[0]);
    const sMaxX = Math.max(a[0], b[0]);
    const sMinY = Math.min(a[1], b[1]);
    const sMaxY = Math.max(a[1], b[1]);
    const sMaxD = Math.max(a[2], b[2]);
    const hidden: [number, number][] = [];
    if (occ.length && !(sMaxX < minX || sMinX > maxX || sMaxY < minY || sMinY > maxY)) {
      // Rutorna längs kantens omslutande rektangel.
      const x0 = cx(sMinX);
      const x1 = cx(sMaxX);
      const y0 = cy(sMinY);
      const y1 = cy(sMaxY);
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      for (let gx = x0; gx <= x1; gx++) {
        for (let gy = y0; gy <= y1; gy++) {
          // Hoppa över rutor som kanten inte går igenom (långa sneda kanter).
          if (x1 > x0 && y1 > y0) {
            const rx0 = minX + gx * cw;
            const ry0 = minY + gy * ch;
            const c0 = (rx0 - a[0]) * dy - (ry0 - a[1]) * dx;
            const c1 = (rx0 + cw - a[0]) * dy - (ry0 - a[1]) * dx;
            const c2 = (rx0 - a[0]) * dy - (ry0 + ch - a[1]) * dx;
            const c3 = (rx0 + cw - a[0]) * dy - (ry0 + ch - a[1]) * dx;
            if ((c0 > 0 && c1 > 0 && c2 > 0 && c3 > 0) || (c0 < 0 && c1 < 0 && c2 < 0 && c3 < 0)) continue;
          }
          for (const oi of cells[gy * N + gx]) {
            if (stamp[oi] === si) continue;
            stamp[oi] = si;
            const o = occ[oi];
            // Resten av rutan ligger lika långt bort eller längre (djupordning).
            if (o.dmin >= sMaxD - DEPTH_EPS) break;
            if (o.maxX < sMinX || o.minX > sMaxX || o.maxY < sMinY || o.minY > sMaxY) continue;
            const iv = occludedBy(o, a, b);
            if (!iv) continue;
            hidden.push(iv);
            // Helt dold: inget mer att pröva, och inget att rita. Provas när
            // biten når en ände och när antalet bitar fördubblats.
            const n = hidden.length;
            if ((iv[0] <= 0 || iv[1] >= 1 || (n & (n - 1)) === 0) && fullyHidden(hidden)) return;
          }
        }
      }
    }
    for (const [t0, t1] of visibleParts(hidden)) {
      if ((t1 - t0) * len < MIN_PIECE) continue;
      out.push({
        a: [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0],
        b: [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1],
        key: seg.key,
      });
    }
  });
  return out;
}

/** Den del av sträckan (i t, 0–1) som triangeln skymmer, eller null. */
function occludedBy(o: Occluder, a: V3, b: V3): [number, number] | null {
  let t0 = 0;
  let t1 = 1;
  const edges = [
    [o.ax, o.ay, o.bx, o.by],
    [o.bx, o.by, o.cx, o.cy],
    [o.cx, o.cy, o.ax, o.ay],
  ];
  for (const [x0, y0, x1, y1] of edges) {
    // Innanför: s · ((B − A) × (P − A)) > 0. Linjärt i t.
    const ex = x1 - x0;
    const ey = y1 - y0;
    const el = Math.hypot(ex, ey) || 1;
    // En liten marginal utåt: kanter som ligger precis i triangelns kant räknas
    // som innanför. Ligger de bakom triangeln döljs de (baksidans kanter, och
    // kanter som annars skulle lysa igenom längs trianguleringens diagonaler);
    // ligger de i samma plan syns de.
    const fa = (o.s * (ex * (a[1] - y0) - ey * (a[0] - x0))) / el + 0.05;
    const fb = (o.s * (ex * (b[1] - y0) - ey * (b[0] - x0))) / el + 0.05;
    if (fa <= 0 && fb <= 0) return null;
    if (fa > 0 && fb > 0) continue;
    const t = fa / (fa - fb);
    if (fa <= 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t1 <= t0) return null;
  }
  // Bakom triangelns plan: g(t) = d_kant(t) − d_plan(t) − ε > 0.
  const g = (t: number) => {
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t;
    const d = a[2] + (b[2] - a[2]) * t;
    return d - (o.px * x + o.py * y + o.p0) - DEPTH_EPS;
  };
  const g0 = g(t0);
  const g1 = g(t1);
  if (g0 <= 0 && g1 <= 0) return null;
  if (g0 > 0 && g1 > 0) return [t0, t1];
  const tr = t0 + ((t1 - t0) * g0) / (g0 - g1);
  return g0 > 0 ? [t0, tr] : [tr, t1];
}

/** Om de skymda intervallen täcker hela [0, 1], med samma regler som `visibleParts`. */
function fullyHidden(hidden: [number, number][]): boolean {
  hidden.sort((p, q) => p[0] - q[0]);
  let at = 0;
  for (const [s, e] of hidden) {
    if (s > at) return false;
    at = Math.max(at, e);
    if (at >= 1) return true;
  }
  return at >= 1;
}

/** Det som blir kvar av [0, 1] när de skymda intervallen tagits bort. */
function visibleParts(hidden: [number, number][]): [number, number][] {
  if (!hidden.length) return [[0, 1]];
  hidden.sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let at = 0;
  for (const [s, e] of hidden) {
    if (s > at) out.push([at, s]);
    at = Math.max(at, e);
    if (at >= 1) break;
  }
  if (at < 1) out.push([at, 1]);
  return out;
}

/**
 * Kanter ur trianglarna för en form: skarpa veck (över `crease` grader),
 * öppna kanter och, för böjda ytor, konturen sett från betraktaren (där ytan
 * viker undan). `onlySilhouettes` ger bara konturerna, för former som
 * levererar sina egna kantlinjer.
 */
export function featureEdges(tris: readonly number[], opts: { crease?: number; onlySilhouettes?: boolean } = {}): [V3, V3][] {
  const crease = Math.cos(((opts.crease ?? 25) * Math.PI) / 180);
  const smooth = Math.cos((30 * Math.PI) / 180);
  const verts: V3[] = [];
  const index = new Map<string, number>();
  const vid = (x: number, y: number, d: number) => {
    const k = `${Math.round(x * 100)},${Math.round(y * 100)},${Math.round(d * 100)}`;
    let i = index.get(k);
    if (i === undefined) {
      i = verts.length;
      verts.push([x, y, d]);
      index.set(k, i);
    }
    return i;
  };
  const faces: { v: [number, number, number]; n: V3 }[] = [];
  for (let i = 0; i + 8 < tris.length; i += 9) {
    const a = vid(tris[i], tris[i + 1], tris[i + 2]);
    const b = vid(tris[i + 3], tris[i + 4], tris[i + 5]);
    const c = vid(tris[i + 6], tris[i + 7], tris[i + 8]);
    if (a === b || b === c || a === c) continue;
    const A = verts[a];
    const B = verts[b];
    const C = verts[c];
    const ux = B[0] - A[0];
    const uy = B[1] - A[1];
    const uz = B[2] - A[2];
    const vx = C[0] - A[0];
    const vy = C[1] - A[1];
    const vz = C[2] - A[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz);
    if (nl < 1e-6) continue;
    faces.push({ v: [a, b, c], n: [nx / nl, ny / nl, nz / nl] });
  }
  const edges = new Map<string, { a: number; b: number; f: number[] }>();
  faces.forEach((f, fi) => {
    for (let k = 0; k < 3; k++) {
      const a = f.v[k];
      const b = f.v[(k + 1) % 3];
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      let e = edges.get(key);
      if (!e) edges.set(key, (e = { a: Math.min(a, b), b: Math.max(a, b), f: [] }));
      e.f.push(fi);
    }
  });
  const out: [V3, V3][] = [];
  for (const e of edges.values()) {
    const A = verts[e.a];
    const B = verts[e.b];
    if (e.f.length !== 2) {
      if (!opts.onlySilhouettes) out.push([A, B]);
      continue;
    }
    const [f1, f2] = [faces[e.f[0]], faces[e.f[1]]];
    const cos = Math.abs(f1.n[0] * f2.n[0] + f1.n[1] * f2.n[1] + f1.n[2] * f2.n[2]);
    if (cos < crease) {
      if (!opts.onlySilhouettes) out.push([A, B]);
      continue;
    }
    if (cos < 0.99999 && cos >= smooth) {
      // Böjd yta: kontur där båda trianglarna ligger på samma sida om kanten i bilden.
      const other = (f: { v: [number, number, number] }) => verts[f.v.find((v) => v !== e.a && v !== e.b)!];
      const side = (P: V3) => (B[0] - A[0]) * (P[1] - A[1]) - (B[1] - A[1]) * (P[0] - A[0]);
      if (side(other(f1)) * side(other(f2)) > 0) out.push([A, B]);
    }
  }
  return out;
}
