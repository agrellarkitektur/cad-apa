import type { RailPart } from '../core/railingTypes';
import { dist, norm, sub } from '../geometry/vec';
import { railPen, type RailPenKey } from '../repr/railingPens';
import type { Origin, Pen, Primitive, Vec2 } from '../repr/primitives';
import { offsetLine } from './groundLines';
import { planCutHeight } from './planCut';
import { gateHole, withExtension, type AlongPiece, type GatePiece, type PostPiece, type RailingBody } from './railingBody';
import { dedupe, dedupeZ, pathPoint, pathZ, type RailGate, type RailPath } from './railingGeometry';
import type { Element } from '../core/model';
import type { PlanContext } from './registry';

/**
 * Räcket i planen (0.11.1, bruten ur `railing.ts` i granskningen efter
 * 0.11.5): en linje i Skiss och Normal (med ledstångens förlängning i
 * Normal), delarna i Detalj, det som står över snittet streckprickat, och
 * grindarna (0.11.3) som dörrarna med blad och slagbåge.
 */

const RANK = { sketch: 0, normal: 1, detail: 2 } as const;

/** Lägsta detaljnivån en del ritas i (stolpar, spjälor och ytor i Detalj). */
const partDetail = (part: RailPart): keyof typeof RANK => part.detail ?? 'detail';

/** Linjen i bitar efter om de ligger över planens snitt (höjden mitt på biten). */
function splitAbove(pts: readonly Vec2[], zs: readonly number[], cut: number | undefined): { pts: Vec2[]; above: boolean }[] {
  const out: { pts: Vec2[]; above: boolean }[] = [];
  const add = (a: Vec2, b: Vec2, above: boolean) => {
    const last = out[out.length - 1];
    if (last && last.above === above) last.pts.push(b);
    else out.push({ pts: [a, b], above });
  };
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (dist(a, b) < 1e-6) continue;
    const z0 = zs[i - 1];
    const z1 = zs[i];
    // En bit som går genom snittet delas där.
    if (cut !== undefined && (z0 - cut - 0.5) * (z1 - cut - 0.5) < 0) {
      const t = (cut + 0.5 - z0) / (z1 - z0);
      const m: Vec2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      add(a, m, z0 > cut + 0.5);
      add(m, b, z1 > cut + 0.5);
      continue;
    }
    add(a, b, cut !== undefined && (z0 + z1) / 2 > cut + 0.5);
  }
  return out;
}

/** En stolpe eller spjäla ovanifrån: rektangeln i linjens riktning, eller en åttahörning. */
export function postRing(q: PostPiece): Vec2[] {
  if (q.round) {
    const r = q.w / 2;
    return Array.from({ length: 8 }, (_, k): Vec2 => [q.at[0] + r * Math.cos((k * Math.PI) / 4), q.at[1] + r * Math.sin((k * Math.PI) / 4)]);
  }
  const d = q.dir;
  const n: Vec2 = [-d[1], d[0]];
  const a = q.w / 2;
  const b = q.d / 2;
  return [
    [q.at[0] - d[0] * a - n[0] * b, q.at[1] - d[1] * a - n[1] * b],
    [q.at[0] + d[0] * a - n[0] * b, q.at[1] + d[1] * a - n[1] * b],
    [q.at[0] + d[0] * a + n[0] * b, q.at[1] + d[1] * a + n[1] * b],
    [q.at[0] - d[0] * a + n[0] * b, q.at[1] - d[1] * a + n[1] * b],
  ];
}

/** Räckets plan: en linje i Skiss och Normal (med ledstångens förlängning i Normal), delarna i Detalj. */
export function railingPlan(el: Element<any>, ctx: PlanContext, own: boolean, r: { path: RailPath; body: RailingBody }, littera: (g: RailGate) => string): Primitive[] {
  const { path, body } = r;
  const out: Primitive[] = [];
  const o = (part: string): Origin => ({ objectId: el.id, objectType: 'Railing', part });
  const pen = (k: string | undefined, fallback: RailPenKey): Pen => railPen(ctx.style, (k && k.startsWith('rail') ? k : fallback) as RailPenKey);
  const detail = RANK[ctx.view.detail ?? 'normal'];
  const cut = own ? planCutHeight(ctx) : undefined;
  const above = pen('railAbove', 'railAbove');
  const draw = (pts: Vec2[], zs: number[], p: Pen, part: string) => {
    for (const run of splitAbove(pts, zs, cut)) out.push({ kind: 'polyline', points: run.pts, closed: false, pen: run.above ? above : p, origin: o(run.above ? 'över' : part) });
  };
  const contour = pen('railContour', 'railContour');
  const along = body.along;
  const drawnInDetail = (a: AlongPiece) => detail >= RANK.detail && detail >= RANK[partDetail(a.part)];
  // Linjen: i Skiss och Normal, och i Detalj när ingen längsgående del ritas; avbruten vid grindarna.
  if (detail < RANK.detail || !along.some(drawnInDetail)) for (const run of openPieces(path, body.gates)) draw(run.pts, run.z, contour, 'kontur');
  for (const a of along) {
    const ext = withExtension(a);
    const zs = ext.z;
    const p = pen(a.part.pen, 'railHandrail');
    if (drawnInDetail(a)) {
      for (const side of [1, -1]) draw(offsetLine(dedupe(ext.pts), (side * a.w) / 2), dedupeZ(ext.pts, zs), p, a.part.id);
      if (a.ext > 0)
        for (const [i, j] of [
          [0, 1],
          [ext.pts.length - 1, ext.pts.length - 2],
        ]) {
          const q = ext.pts[i];
          const d = norm(sub(q, ext.pts[j]));
          const n: Vec2 = [-d[1] * (a.w / 2), d[0] * (a.w / 2)];
          out.push({ kind: 'line', a: [q[0] + n[0], q[1] + n[1]], b: [q[0] - n[0], q[1] - n[1]], pen: cut !== undefined && zs[i] > cut + 0.5 ? above : p, origin: o(a.part.id) });
        }
    } else if (detail >= RANK.normal && a.ext > 0 && ext.pts.length > a.pts.length) {
      // Ledstångens förlängning förbi trappan.
      const n = ext.pts.length;
      draw([ext.pts[0], ext.pts[1]], [zs[0], zs[1]], pen(a.part.pen, 'railGrab'), a.part.id);
      draw([ext.pts[n - 2], ext.pts[n - 1]], [zs[n - 2], zs[n - 1]], pen(a.part.pen, 'railGrab'), a.part.id);
    }
  }
  for (const g of body.gates) out.push(...gatePlan(el, g, o('grind'), railPen(ctx.style, 'railGate'), railPen(ctx.style, 'railGateSwing'), littera(g.gate)));
  if (detail >= RANK.normal) {
    for (const q of body.posts) {
      if (detail < RANK[partDetail(q.part)]) continue;
      const up = cut !== undefined && q.z0 > cut + 0.5;
      out.push({ kind: 'polyline', points: postRing(q), closed: true, pen: up ? above : pen(q.part.pen, 'railPost'), origin: o(q.part.id) });
    }
  }
  return out;
}

/** Linjen utan grindarnas hål. */
function openPieces(path: RailPath, gates: readonly GatePiece[]): { pts: Vec2[]; z: number[] }[] {
  if (!gates.length) return [{ pts: path.pts, z: path.z }];
  const holes = gates.map((g) => gateHole(g.gate, path.length)!).filter(Boolean).sort((a, b) => a[0] - b[0]);
  const out: { pts: Vec2[]; z: number[] }[] = [];
  let at = 0;
  const piece = (a: number, b: number) => {
    const pts: Vec2[] = [];
    const z: number[] = [];
    const push = (s: number) => {
      pts.push(pathPoint(path, s).at);
      z.push(pathZ(path, s));
    };
    push(a);
    for (let i = 0; i < path.s.length; i++) if (path.s[i] > a + 1e-6 && path.s[i] < b - 1e-6) {
      pts.push(path.pts[i]);
      z.push(path.z[i]);
    }
    push(b);
    out.push({ pts, z });
  };
  for (const [a, b] of holes) {
    if (a > at + 1) piece(at, a);
    at = Math.max(at, b);
  }
  if (path.length > at + 1) piece(at, path.length);
  return out;
}

/**
 * Grinden i planen (0.11.3), som dörrarna: bladet öppet i vinkeln (90° som
 * förval) och slagbågen streckad till det stängda läget; en skjutgrind som
 * bladet bredvid hålet och en streckad linje dit det skjuts. Littera vid
 * hålet.
 */
function gatePlan(el: Element<any>, g: GatePiece, origin: Origin, leafPen: Pen, swingPen: Pen, lit: string): Primitive[] {
  const out: Primitive[] = [];
  const d = norm(sub(g.b, g.a));
  const len = dist(g.a, g.b);
  const ang = ((g.gate.angle ?? 90) * Math.PI) / 180;
  const o = g.out;
  if (g.gate.hang === 'slide') {
    const k = 80;
    const a: Vec2 = [g.a[0] + o[0] * k, g.a[1] + o[1] * k];
    const b: Vec2 = [g.b[0] + o[0] * k, g.b[1] + o[1] * k];
    out.push({ kind: 'line', a, b, pen: leafPen, origin });
    out.push({ kind: 'line', a: b, b: [b[0] + d[0] * len, b[1] + d[1] * len], pen: swingPen, origin });
  } else {
    const leaves: [Vec2, Vec2, number][] =
      g.gate.hang === 'pair'
        ? [
            [g.a, d, len / 2],
            [g.b, [-d[0], -d[1]], len / 2],
          ]
        : g.gate.hang === 'right'
          ? [[g.b, [-d[0], -d[1]], len]]
          : [[g.a, d, len]];
    for (const [hinge, along, l] of leaves) {
      // Bladet vrids från längs linjen mot `out` med vinkeln.
      const a0 = Math.atan2(along[1], along[0]);
      const toOut = Math.atan2(o[1], o[0]);
      let delta = toOut - a0;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      const a1 = a0 + Math.sign(delta) * ang;
      const tip: Vec2 = [hinge[0] + Math.cos(a1) * l, hinge[1] + Math.sin(a1) * l];
      out.push({ kind: 'line', a: hinge, b: tip, pen: leafPen, origin });
      out.push({ kind: 'arc', center: hinge, radius: l, start: Math.min(a0, a1), end: Math.max(a0, a1), pen: swingPen, origin });
    }
  }
  if (lit) {
    const k = -260;
    const m: Vec2 = [(g.a[0] + g.b[0]) / 2 + o[0] * k, (g.a[1] + g.b[1]) / 2 + o[1] * k];
    out.push({ kind: 'text', at: m, text: lit, height: 2.5, align: 'middle', pen: leafPen, origin: { objectId: el.id, objectType: 'Railing', part: 'grind' } });
  }
  return out;
}
