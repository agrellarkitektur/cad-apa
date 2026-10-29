import type { ProjectDoc } from '../core/model';
import type { Action } from '../core/states';
import { union, type Rings } from '../geometry/boolean';
import { clipDepth, clipPlane, clipSegAxis, clipSegDepth, featureEdges, visibleSegments, type Seg, type V3 } from '../geometry/hiddenLine';
import { solidTriangles } from './mesh';
import { innerFaceEdges, mergeCollinear } from './sectionHidden';
import type { Vec2 } from './primitives';
import { zOn, type EdgePart, type Shape3D, type Solid } from './solids';

/**
 * Linjerna i en fasad eller sektion (granskningen efter 0.10.12, förut i
 * `section.ts`): formernas kanter i vyns koordinater, det som skymmer dem,
 * och vilka som syns. Dolda linjer (0.10.10) räknas med samma skymmande
 * ytor. Snitten, pennorna och primitiverna görs i `section.ts`.
 */

export interface EdgeKey {
  id: string;
  action: Action;
  part?: EdgePart;
  dash?: readonly number[];
  /** I den tonade delen av vyn (0.10.10). */
  far?: boolean;
}

/** Vyn: linjens början, riktningen åt höger och blickriktningen, längden, djupet och var det tonade börjar. */
export interface SectionView {
  O: Vec2;
  r: Vec2;
  v: Vec2;
  uMax: number;
  depthMax: number | null;
  tone: number | null;
  /** En punkt i modellen (mm) i vyns koordinater: längs linjen, höjd, djup. */
  toView: (x: number, y: number, z: number) => V3;
}

/**
 * Linjerna som syns och de dolda (bjälklagen och ytterväggarnas insida när
 * de visas), och lägsta och högsta höjd bland formerna.
 */
export function sectionLines(
  doc: ProjectDoc,
  shapes: { s: Shape3D; demolished: boolean }[],
  sv: SectionView,
  hidden: { slabs: boolean; walls: boolean },
  actionOfId: (id: string) => Action,
  /** Formerna vars ytor fylls i fasaden (0.10.28.2): deras trianglar kommer med i svaret. */
  surfaced?: (s: Solid) => boolean,
) {
  const { O, r, v, uMax, depthMax, tone, toView } = sv;
  const hiddenSlabs = hidden.slabs;
  const hiddenWalls = hidden.walls;
  const occluders: number[][] = [];
  const faces: { s: Solid; tris: number[] }[] = [];
  const segs: Seg<EdgeKey>[] = [];
  const hiddenSegs: Seg<EdgeKey>[] = [];
  const pushSeg = (a: V3, b: V3, key: EdgeKey, list = segs) => {
    const c = clipSegDepth(a, b, 0, depthMax);
    const u = c && clipSegAxis(c[0], c[1], 0, 0, uMax);
    if (!u) return;
    if (tone === null) {
      list.push({ a: u[0], b: u[1], key });
      return;
    }
    const near = clipSegDepth(u[0], u[1], 0, tone);
    if (near) list.push({ a: near[0], b: near[1], key });
    const far = clipSegDepth(u[0], u[1], tone, depthMax);
    if (far) list.push({ a: far[0], b: far[1], key: { ...key, far: true } });
  };
  const isSlab = (id: string) => doc.elements[id]?.type === 'Slab';
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const { s, demolished } of shapes) {
    const key: EdgeKey = { id: s.id, action: actionOfId(s.id), ...(s.kind === 'edges' ? { part: s.part, dash: s.dash } : {}) };
    if (s.kind === 'edges') {
      for (const q of s.segments) pushSeg(toView(q[0], q[1], q[2]), toView(q[3], q[4], q[5]), key);
      if (hiddenSlabs && !demolished && isSlab(s.id)) for (const q of s.segments) pushSeg(toView(q[0], q[1], q[2]), toView(q[3], q[4], q[5]), key, hiddenSegs);
      continue;
    }
    const plan = solidTriangles(s);
    // Hörnen i vykoordinater, samma räkning som toView men utan en lista per
    // hörn (0.8.27).
    const tris: number[] = [];
    const whole = plan.length - (plan.length % 9);
    for (let i = 0; i < whole; i += 3) {
      const dx = plan[i] - O[0];
      const dy = plan[i + 1] - O[1];
      const z = plan[i + 2];
      tris.push(dx * r[0] + dy * r[1], z, dx * v[0] + dy * v[1]);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
    // Kanter: skarpa veck och öppna kanter, och konturer av böjda ytor.
    const edges = featureEdges(tris, { onlySilhouettes: !!s.noEdges });
    for (const [a, b] of edges) pushSeg(a, b, key);
    if (hiddenSlabs && !demolished && isSlab(s.id)) for (const [a, b] of edges) pushSeg(a, b, key, hiddenSegs);
    // Det som rivs skymmer inget: det finns inte kvar.
    if (demolished) continue;
    const clipped: number[] = [];
    const inside = (u: number, d: number) => d >= 0 && (depthMax === null || depthMax - d >= 0) && u >= 0 && uMax - u >= 0;
    for (let i = 0; i + 8 < tris.length; i += 9) {
      // Hela triangeln innanför: som den är (klippningen ger samma hörn).
      if (inside(tris[i], tris[i + 2]) && inside(tris[i + 3], tris[i + 5]) && inside(tris[i + 6], tris[i + 8])) {
        for (let k = i; k < i + 9; k++) clipped.push(tris[k]);
        continue;
      }
      const poly = clipPlane(
        clipPlane(
          clipDepth(
            [
              [tris[i], tris[i + 1], tris[i + 2]],
              [tris[i + 3], tris[i + 4], tris[i + 5]],
              [tris[i + 6], tris[i + 7], tris[i + 8]],
            ],
            0,
            depthMax,
          ),
          (p) => p[0],
        ),
        (p) => uMax - p[0],
      );
      for (let k = 1; k + 1 < poly.length; k++) clipped.push(...poly[0], ...poly[k], ...poly[k + 1]);
    }
    occluders.push(clipped);
    if (surfaced?.(s)) faces.push({ s, tris: clipped });
  }

  // Konturer av böjda väggar: där väggmassans kontur i plan vänder sig bort
  // från betraktaren utan att vika (en båge, eller en båge som övergår i en
  // vägg längs blickriktningen) blir det en lodrät konturlinje.
  for (const seg of wallSilhouettes(shapes, v)) pushSeg(toView(seg.x, seg.y, seg.z0), toView(seg.x, seg.y, seg.z1), { id: seg.id, action: actionOfId(seg.id) });

  const visibleLines = visibleSegments(segs, occluders);
  if (hiddenWalls) for (const { id, seg: q } of innerFaceEdges(doc, shapes)) pushSeg(toView(q[0], q[1], q[2]), toView(q[3], q[4], q[5]), { id, action: actionOfId(id) }, hiddenSegs);
  const hiddenLines = hiddenSegs.length ? mergeCollinear(visibleSegments(hiddenSegs, occluders, undefined, true), (k) => doc.elements[k.id]?.type ?? '') : [];
  return { visibleLines, hiddenLines, minZ, maxZ, occluders, faces };
}

/** Lodräta konturlinjer för väggmassan sedd i riktningen v. */
function wallSilhouettes(shapes: { s: Shape3D; demolished: boolean }[], v: Vec2): { id: string; x: number; y: number; z0: number; z1: number }[] {
  const walls = shapes.filter((x): x is { s: Solid; demolished: boolean } => x.s.kind !== 'edges' && !x.demolished && (x.s.material === 'wall' || x.s.material === 'wall-new'));
  if (!walls.length) return [];
  const out: { id: string; x: number; y: number; z0: number; z1: number }[] = [];
  const bend = Math.sin((9 * Math.PI) / 180);
  for (const poly of union(walls.map((w) => w.s.rings as Rings))) {
    for (const ring of poly) {
      const n = ring.length;
      for (let i = 0; i < n; i++) {
        const a = ring[(i - 1 + n) % n];
        const q = ring[i];
        const b = ring[(i + 1) % n];
        const d1: Vec2 = [q[0] - a[0], q[1] - a[1]];
        const d2: Vec2 = [b[0] - q[0], b[1] - q[1]];
        const l1 = Math.hypot(d1[0], d1[1]);
        const l2 = Math.hypot(d2[0], d2[1]);
        if (l1 < 1e-6 || l2 < 1e-6) continue;
        // Riktiga hörn har egna kantlinjer.
        if (Math.abs(d1[0] * d2[1] - d1[1] * d2[0]) > bend * l1 * l2) continue;
        const c1 = (d1[0] * v[1] - d1[1] * v[0]) / l1;
        const c2 = (d2[0] * v[1] - d2[1] * v[0]) / l2;
        const zero = 1e-3;
        if (!(c1 * c2 < 0 || Math.abs(c1) < zero || Math.abs(c2) < zero)) continue;
        // Höjden från den vägg vars kontur punkten ligger på.
        let best: { id: string; z0: number; z1: number } | null = null;
        for (const w of walls) {
          if (!w.s.rings.some((r) => r.some((p) => Math.abs(p[0] - q[0]) < 0.6 && Math.abs(p[1] - q[1]) < 0.6))) continue;
          const z1 = w.s.top ? zOn(w.s.top, q[0], q[1]) : w.s.z1;
          const z0 = w.s.bottom ? zOn(w.s.bottom, q[0], q[1]) : w.s.z0;
          if (!best || z1 > best.z1) best = { id: w.s.id, z0, z1 };
        }
        if (best) out.push({ id: best.id, x: q[0], y: q[1], z0: best.z0, z1: best.z1 });
      }
    }
  }
  return out;
}
