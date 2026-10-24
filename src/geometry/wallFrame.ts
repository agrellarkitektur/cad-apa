import type { Vec2 } from '../repr/primitives';
import { arcFromBulge, arcSegments } from './arc';
import { add, left, norm, scale, sub } from './vec';

/** Det som avgör en väggs läge: referenslinjen, tjockleken och justeringen. */
export interface WallGeometry {
  start: readonly [number, number];
  end: readonly [number, number];
  thickness: number;
  justification: 'center' | 'left' | 'right';
  /** Pilhöjd för bågväggar (mm, positiv åt vänster). */
  bulge?: number;
}

/** En väggs lokala koordinatsystem: s längs väggen, o åt vänster om mittlinjen. */
export interface WallFrame {
  length: number;
  half: number;
  /** Riktningen längs väggen. För bågväggar kordans riktning, se tangent(). */
  u: Vec2;
  n: Vec2;
  /** Mittlinjens ändpunkter. */
  a: Vec2;
  b: Vec2;
  /** Punkt på avståndet s längs väggens mittlinje och o åt vänster om den. */
  at(s: number, o: number): Vec2;
  /** Mittlinjens båge, för bågväggar. */
  arc?: { center: Vec2; radius: number; sigma: 1 | -1; theta0: number; sweep: number };
  /** Riktningen längs väggen vid s. */
  tangent(s: number): Vec2;
  /** Vänster sida vid s. */
  normal(s: number): Vec2;
  /** En rak ram som sammanfaller med väggen vid s (för dörrar och fönster i bågväggar). */
  local(s: number): WallFrame;
  /** Var en punkt ligger: s längs väggen och o åt vänster om mittlinjen. */
  project(p: Vec2): [s: number, o: number];
  /** Punkter längs väggen från s1 till s2 på avståndet o, med ändpunkterna. */
  trace(s1: number, s2: number, o: number): Vec2[];
}

function straightFrame(a: Vec2, u: Vec2, length: number, half: number): WallFrame {
  const n = left(u);
  const at = (s: number, o: number): Vec2 => [a[0] + u[0] * s + n[0] * o, a[1] + u[1] * s + n[1] * o];
  const f: WallFrame = {
    length,
    half,
    u,
    n,
    a,
    b: at(length, 0),
    at,
    tangent: () => u,
    normal: () => n,
    local: () => f,
    project: (p) => {
      const r = sub(p, a);
      return [r[0] * u[0] + r[1] * u[1], r[0] * n[0] + r[1] * n[1]];
    },
    trace: (s1, s2, o) => [at(s1, o), at(s2, o)],
  };
  return f;
}

export function wallFrame(p: WallGeometry): WallFrame {
  const d = sub(p.end, p.start);
  const chord = Math.hypot(d[0], d[1]) || 1;
  const half = p.thickness / 2;
  // Mittlinjens förskjutning från referenslinjen.
  const shift = p.justification === 'left' ? half : p.justification === 'right' ? -half : 0;
  const arc = p.bulge ? arcFromBulge(p.start, p.end, p.bulge) : null;
  if (!arc) {
    const u = norm(d);
    const n = left(u);
    return straightFrame(add(p.start, scale(n, shift)), u, chord, half);
  }
  const { center, sigma, theta0, sweep } = arc;
  // Vänster sida pekar ut från centrum när bågen buktar åt vänster.
  const rc = Math.max(1, arc.radius + sigma * shift);
  const length = rc * sweep;
  const theta = (s: number) => theta0 - (sigma * s) / rc;
  const at = (s: number, o: number): Vec2 => {
    const t = theta(s);
    const r = Math.max(0.01, rc + sigma * o);
    return [center[0] + r * Math.cos(t), center[1] + r * Math.sin(t)];
  };
  const tangent = (s: number): Vec2 => {
    const t = theta(s);
    return [sigma * Math.sin(t), -sigma * Math.cos(t)];
  };
  const u = norm(d);
  const f: WallFrame = {
    length,
    half,
    u,
    n: left(u),
    a: at(0, 0),
    b: at(length, 0),
    at,
    arc: { center, radius: rc, sigma, theta0, sweep },
    tangent,
    normal: (s) => left(tangent(s)),
    local: (s) => {
      const t = tangent(s);
      const q = at(s, 0);
      return straightFrame([q[0] - t[0] * s, q[1] - t[1] * s], t, length, half);
    },
    project: (q) => {
      const ang = Math.atan2(q[1] - center[1], q[0] - center[0]);
      let delta = sigma * (theta0 - ang);
      // Lägg vinkeln i intervallet runt bågen, så att punkter strax före
      // starten får negativt s.
      const pad = (2 * Math.PI - sweep) / 2;
      while (delta < -pad) delta += 2 * Math.PI;
      while (delta > sweep + pad) delta -= 2 * Math.PI;
      return [delta * rc, sigma * (Math.hypot(q[0] - center[0], q[1] - center[1]) - rc)];
    },
    trace: (s1, s2, o) => {
      const k = Math.max(1, Math.ceil((arcSegments(sweep, rc) * Math.abs(s2 - s1)) / length));
      const pts: Vec2[] = [];
      for (let i = 0; i <= k; i++) pts.push(at(s1 + ((s2 - s1) * i) / k, o));
      return pts;
    },
  };
  return f;
}

