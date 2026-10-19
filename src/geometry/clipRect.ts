import type { Bounds, Primitive, Vec2 } from '../repr/primitives';

/**
 * Klipp primitiver mot en rektangel (0.8 del 3), t.ex. ett underlag mot
 * vyns ram på ett ritningsblad. Linjer och ytor klipps exakt, bågar som
 * sticker ut blir korta raka bitar, texter behålls om insättningspunkten
 * ligger inne, och bilder får en klippram som ritas av skärmen och PDF:en.
 */
export function clipPrims(prims: readonly Primitive[], r: Bounds): Primitive[] {
  const out: Primitive[] = [];
  for (const p of prims) {
    switch (p.kind) {
      case 'line': {
        const s = clipSegment(p.a, p.b, r);
        if (s) out.push({ ...p, a: s[0], b: s[1] });
        break;
      }
      case 'polyline':
        for (const pts of clipPolyline(p.closed && p.points.length > 2 ? [...p.points, p.points[0]] : p.points, r))
          out.push({ ...p, points: pts, closed: false });
        break;
      case 'region': {
        const rings = p.rings.map((ring) => clipRing(ring, r)).filter((ring) => ring.length >= 3);
        if (rings.length) out.push({ ...p, rings });
        break;
      }
      case 'arc': {
        if (p.center[0] - p.radius >= r.minX && p.center[0] + p.radius <= r.maxX && p.center[1] - p.radius >= r.minY && p.center[1] + p.radius <= r.maxY) {
          out.push(p);
          break;
        }
        const sweep = (((p.end - p.start) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) || 2 * Math.PI;
        const n = Math.max(4, Math.ceil(sweep / (Math.PI / 24)));
        const pts: Vec2[] = [];
        for (let i = 0; i <= n; i++) {
          const a = p.start + (sweep * i) / n;
          pts.push([p.center[0] + p.radius * Math.cos(a), p.center[1] + p.radius * Math.sin(a)]);
        }
        for (const q of clipPolyline(pts, r)) out.push({ kind: 'polyline', points: q, closed: false, pen: p.pen, origin: p.origin });
        break;
      }
      case 'text':
        if (inside(p.at, r)) out.push(p);
        break;
      case 'image': {
        const c = [p.corner, [p.corner[0] + p.u[0], p.corner[1] + p.u[1]], [p.corner[0] + p.u[0] + p.v[0], p.corner[1] + p.u[1] + p.v[1]], [p.corner[0] + p.v[0], p.corner[1] + p.v[1]]] as Vec2[];
        if (c.every((q) => inside(q, r))) out.push(p);
        else if (clipRing(c, r).length >= 3) out.push({ ...p, clip: { minX: r.minX, minY: r.minY, maxX: r.maxX, maxY: r.maxY } });
        break;
      }
    }
  }
  return out;
}

function inside(p: Vec2, r: Bounds): boolean {
  return p[0] >= r.minX && p[0] <= r.maxX && p[1] >= r.minY && p[1] <= r.maxY;
}

/** En sträcka klippt mot rektangeln (Liang–Barsky), eller null om den ligger utanför. */
export function clipSegment(a: Vec2, b: Vec2, r: Bounds): [Vec2, Vec2] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const edges: [number, number][] = [
    [-dx, a[0] - r.minX],
    [dx, r.maxX - a[0]],
    [-dy, a[1] - r.minY],
    [dy, r.maxY - a[1]],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return null;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return null;
      if (t < t1) t1 = t;
    }
  }
  return [
    [a[0] + dx * t0, a[1] + dy * t0],
    [a[0] + dx * t1, a[1] + dy * t1],
  ];
}

/** En polylinje klippt mot rektangeln: de bitar som ligger inne. */
export function clipPolyline(points: readonly Vec2[], r: Bounds): Vec2[][] {
  const out: Vec2[][] = [];
  let cur: Vec2[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const s = clipSegment(points[i], points[i + 1], r);
    if (!s) {
      if (cur.length > 1) out.push(cur);
      cur = [];
      continue;
    }
    const last = cur[cur.length - 1];
    if (last && Math.abs(last[0] - s[0][0]) < 1e-9 && Math.abs(last[1] - s[0][1]) < 1e-9) cur.push(s[1]);
    else {
      if (cur.length > 1) out.push(cur);
      cur = [s[0], s[1]];
    }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

/** En sluten ring klippt mot rektangeln (Sutherland–Hodgman). */
export function clipRing(ring: readonly Vec2[], r: Bounds): Vec2[] {
  let pts: Vec2[] = [...ring];
  const planes: [(p: Vec2) => number][] = [[(p) => p[0] - r.minX], [(p) => r.maxX - p[0]], [(p) => p[1] - r.minY], [(p) => r.maxY - p[1]]];
  for (const [d] of planes) {
    if (!pts.length) break;
    const next: Vec2[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const da = d(a);
      const db = d(b);
      if (da >= 0) next.push(a);
      if (da >= 0 !== db >= 0) {
        const t = da / (da - db);
        next.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    pts = next;
  }
  return pts;
}
