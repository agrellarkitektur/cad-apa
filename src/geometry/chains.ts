import type { Vec2 } from '../repr/primitives';
import { closestOnSegment, cross, dist, dot, sub } from './vec';
import { BoxIndex } from './boxIndex';

/**
 * Kedjor och slutna ytor ur lösa sträckor (0.10.22), för smartspöt: följ en
 * kontur från kanten man pekar på, eller hitta ytan som en punkt ligger i.
 */

export interface Seg {
  a: Vec2;
  b: Vec2;
}

/** En följd av punkter; sluten om sista punkten går tillbaka till den första (som inte upprepas). */
export interface Chain {
  points: Vec2[];
  closed: boolean;
}

const key = (p: Vec2, eps: number): string => `${Math.round(p[0] / eps)},${Math.round(p[1] / eps)}`;

/**
 * Kedjan genom sträckan `start` bland `segs`: sträckor som möts ände mot
 * ände (inom `eps` mm) läggs till så länge det bara finns en väg vidare. Där
 * tre eller fler möts tar kedjan slut. Riktningen följer `start`.
 */
export function chainThrough(segs: readonly Seg[], start: number, eps = 0.5): Chain & { at: number } {
  const ends = new Map<string, number[]>();
  segs.forEach((s, i) => {
    for (const p of [s.a, s.b]) {
      const k = key(p, eps);
      const list = ends.get(k);
      if (list) list.push(i);
      else ends.set(k, [i]);
    }
  });
  const used = new Set<number>([start]);
  /** Gå vidare från punkten `p` (änden av sträckan `from`) så länge vägen är entydig. */
  const walk = (p: Vec2, from: number): { pts: Vec2[]; closedAt: boolean } => {
    const pts: Vec2[] = [];
    let cur = p;
    let prev = from;
    for (;;) {
      const here = (ends.get(key(cur, eps)) ?? []).filter((i) => i !== prev);
      if (here.length !== 1) return { pts, closedAt: false };
      const next = here[0];
      if (next === start) return { pts, closedAt: true };
      if (used.has(next)) return { pts, closedAt: false };
      used.add(next);
      const s = segs[next];
      const other = key(s.a, eps) === key(cur, eps) ? s.b : s.a;
      pts.push(other);
      cur = other;
      prev = next;
    }
  };
  const s0 = segs[start];
  const fwd = walk(s0.b, start);
  if (fwd.closedAt) {
    const pts = [s0.a, s0.b, ...fwd.pts];
    // Den sista punkten är startsträckans början igen.
    if (pts.length > 2 && dist(pts[pts.length - 1], pts[0]) <= eps) pts.pop();
    return { points: pts, closed: true, at: 0 };
  }
  const back = walk(s0.a, start);
  const before = back.pts.reverse();
  return { points: [...before, s0.a, s0.b, ...fwd.pts], closed: false, at: before.length };
}

/** Ta bort punkter där linjen går rakt fram (inom `tolDeg`), och punkter som ligger på varandra. */
export function simplify(c: Chain, tolDeg = 0.3): Chain {
  const pts: Vec2[] = [];
  for (const p of c.points) if (!pts.length || dist(pts[pts.length - 1], p) > 0.5) pts.push(p);
  if (c.closed && pts.length > 1 && dist(pts[0], pts[pts.length - 1]) <= 0.5) pts.pop();
  const sin = Math.sin((tolDeg * Math.PI) / 180);
  const straight = (a: Vec2, b: Vec2, q: Vec2): boolean => {
    const u = sub(b, a);
    const v = sub(q, b);
    const lu = Math.hypot(u[0], u[1]);
    const lv = Math.hypot(v[0], v[1]);
    return lu > 0 && lv > 0 && Math.abs(cross(u, v)) <= sin * lu * lv && dot(u, v) > 0;
  };
  let changed = true;
  let out = pts;
  while (changed && out.length > (c.closed ? 3 : 2)) {
    changed = false;
    const n = out.length;
    const keep: Vec2[] = [];
    for (let i = 0; i < n; i++) {
      const inner = c.closed || (i > 0 && i < n - 1);
      if (inner && straight(out[(i - 1 + n) % n], out[i], out[(i + 1) % n]) && !changed) {
        changed = true;
        continue;
      }
      keep.push(out[i]);
    }
    out = keep;
  }
  return { points: out, closed: c.closed };
}

/**
 * Sidan av en kedja kring sträckan `at` (från punkten `at` till nästa):
 * delen mellan de närmaste hörnen där kedjan viker mer än `cornerDeg`. En
 * sluten kedja utan sådana hörn är hela kedjan.
 */
export function sideOf(c: Chain, at: number, cornerDeg = 35): Chain {
  const pts = c.points;
  const n = pts.length;
  const turn = (i: number): number => {
    const a = pts[(i - 1 + n) % n];
    const b = pts[i];
    const q = pts[(i + 1) % n];
    const u = sub(b, a);
    const v = sub(q, b);
    return (Math.abs(Math.atan2(cross(u, v), dot(u, v))) * 180) / Math.PI;
  };
  const corner = (i: number): boolean => (!c.closed && (i <= 0 || i >= n - 1)) || turn(i) > cornerDeg;
  if (c.closed && ![...pts.keys()].some(corner)) return c;
  let i0 = at;
  let steps = 0;
  while (!corner(i0) && steps++ < n) i0 = (i0 - 1 + n) % n;
  let i1 = (at + 1) % n;
  steps = 0;
  while (!corner(i1) && steps++ < n) i1 = (i1 + 1) % n;
  const out: Vec2[] = [pts[i0]];
  for (let i = i0; i !== i1; ) {
    i = (i + 1) % n;
    out.push(pts[i]);
    if (out.length > n + 1) break;
  }
  return { points: out, closed: false };
}

/** Polygonens area med tecken (moturs positiv). */
export function signedArea(pts: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/**
 * Den minsta slutna yta som linjerna stänger in runt punkten `p`, eller
 * null. Linjerna delas där de korsar varandra; ytan hittas genom att gå
 * längs kanterna och alltid ta den skarpaste svängen åt samma håll, från
 * den kant som ligger närmast till höger om punkten. Högst `max` sträckor
 * (de närmaste) prövas.
 */
export function faceAround(segs: readonly Seg[], p: Vec2, max = 1500): Vec2[] | null {
  let list = segs.filter((s) => dist(s.a, s.b) > 1e-6);
  if (list.length > max) {
    list = list
      .map((s) => ({ s, d: dist(closestOnSegment(p, s.a, s.b).point, p) }))
      .sort((x, y) => x.d - y.d)
      .slice(0, max)
      .map((x) => x.s);
  }
  // Dela sträckorna i skärningspunkterna. Bara grannar prövas (0.10.22.1):
  // rutnätets sida är en typisk sträckas längd, så att höjdkurvornas
  // många korta bitar inte prövas mot varandra alla.
  const cuts: number[][] = list.map(() => [0, 1]);
  const boxOf = (s: Seg): [number, number, number, number] => [Math.min(s.a[0], s.b[0]), Math.min(s.a[1], s.b[1]), Math.max(s.a[0], s.b[0]), Math.max(s.a[1], s.b[1])];
  const typical = list.length ? list.map((s) => dist(s.a, s.b)).sort((x, y) => x - y)[list.length >> 1] : 1000;
  const index = new BoxIndex(Math.max(100, Math.min(5000, typical)));
  list.forEach((s, i) => index.add(i, boxOf(s)));
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const r = sub(s.b, s.a);
    const box = boxOf(s);
    for (const j of index.near(box)) {
      if (j <= i) continue;
      const t = list[j];
      if (box[2] < Math.min(t.a[0], t.b[0]) || box[0] > Math.max(t.a[0], t.b[0])) continue;
      if (box[3] < Math.min(t.a[1], t.b[1]) || box[1] > Math.max(t.a[1], t.b[1])) continue;
      const q = sub(t.b, t.a);
      const d = cross(r, q);
      if (Math.abs(d) < 1e-9 * Math.hypot(...r) * Math.hypot(...q)) continue;
      const w = sub(t.a, s.a);
      const u = cross(w, q) / d;
      const v = cross(w, r) / d;
      if (u < -1e-9 || u > 1 + 1e-9 || v < -1e-9 || v > 1 + 1e-9) continue;
      cuts[i].push(Math.min(1, Math.max(0, u)));
      cuts[j].push(Math.min(1, Math.max(0, v)));
    }
  }
  // Noder (sammanslagna inom 0,5 mm) och kanter.
  const eps = 0.5;
  const nodes: Vec2[] = [];
  const nodeOf = new Map<string, number>();
  const node = (q: Vec2): number => {
    const k = key(q, eps);
    let i = nodeOf.get(k);
    if (i === undefined) {
      i = nodes.length;
      nodes.push(q);
      nodeOf.set(k, i);
    }
    return i;
  };
  const adj = new Map<number, Set<number>>();
  const link = (a: number, b: number): void => {
    if (a === b) return;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  list.forEach((s, i) => {
    const ts = [...new Set(cuts[i])].sort((x, y) => x - y);
    for (let k = 0; k + 1 < ts.length; k++) {
      const a: Vec2 = [s.a[0] + (s.b[0] - s.a[0]) * ts[k], s.a[1] + (s.b[1] - s.a[1]) * ts[k]];
      const b: Vec2 = [s.a[0] + (s.b[0] - s.a[0]) * ts[k + 1], s.a[1] + (s.b[1] - s.a[1]) * ts[k + 1]];
      link(node(a), node(b));
    }
  });
  // Den kant som en stråle åt höger från punkten träffar först.
  let hit: { a: number; b: number; x: number } | null = null;
  for (const [a, ns] of adj)
    for (const b of ns) {
      if (b < a) continue;
      const A = nodes[a];
      const B = nodes[b];
      if (A[1] > p[1] === B[1] > p[1]) continue;
      const x = A[0] + ((p[1] - A[1]) * (B[0] - A[0])) / (B[1] - A[1]);
      if (x > p[0] && (!hit || x < hit.x)) hit = { a, b, x };
    }
  if (!hit) return null;
  // Gå moturs runt punkten: kanten riktas så att punkten ligger till vänster.
  let [from, to] = nodes[hit.a][1] < nodes[hit.b][1] ? [hit.a, hit.b] : [hit.b, hit.a];
  const start = [from, to];
  const ring: Vec2[] = [nodes[from]];
  for (let guard = 0; guard < 4 * nodes.length + 10; guard++) {
    ring.push(nodes[to]);
    const back = sub(nodes[from], nodes[to]);
    const back0 = Math.atan2(back[1], back[0]);
    // Nästa kant: den första medurs från vägen tillbaka, så att ytan blir den minsta till vänster.
    let best: { n: number; turn: number } | null = null;
    for (const n of adj.get(to) ?? []) {
      if (n === from && (adj.get(to)?.size ?? 0) > 1) continue;
      const d = sub(nodes[n], nodes[to]);
      let turn = back0 - Math.atan2(d[1], d[0]);
      while (turn <= 1e-12) turn += Math.PI * 2;
      if (!best || turn < best.turn) best = { n, turn };
    }
    if (!best) return null;
    from = to;
    to = best.n;
    if (from === start[0] && to === start[1]) break;
  }
  ring.pop();
  if (ring.length < 3 || signedArea(ring) <= 0) return null;
  // Punkten måste ligga i ytan (en kant som bara hänger ut ger ingen yta).
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside ? simplify({ points: ring, closed: true }).points : null;
}

/**
 * En sluten kontur förskjuten `d` mm åt vänster (negativt åt höger) med
 * gering i hörnen (högst fyra gånger, som ett spetsigt hörn), 0.10.23. För
 * en kontur medurs är vänster utåt: takfoten utanför väggarna.
 */
export function offsetRing(pts: readonly Vec2[], d: number): Vec2[] {
  const n = pts.length;
  const normal = (i: number): Vec2 => {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  };
  return pts.map((p, i) => {
    const a = normal((i - 1 + n) % n);
    const b = normal(i);
    const sx = a[0] + b[0];
    const sy = a[1] + b[1];
    const l = Math.hypot(sx, sy);
    const m: Vec2 = l < 1e-6 ? a : [sx / l, sy / l];
    const k = Math.min(4, 1 / Math.max(0.25, m[0] * a[0] + m[1] * a[1]));
    return [p[0] + m[0] * d * k, p[1] + m[1] * d * k];
  });
}

/** Den kant i kedjan som ligger närmast punkten: index till dess första punkt. */
export function nearestEdge(c: Chain, p: Vec2): number {
  const n = c.points.length;
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i + 1 < n + (c.closed ? 1 : 0); i++) {
    const d = dist(closestOnSegment(p, c.points[i], c.points[(i + 1) % n]).point, p);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}
