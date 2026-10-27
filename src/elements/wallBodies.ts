import { lastResults, sameItems } from '../repr/reuse';
import { difference, union, type Rings } from '../geometry/boolean';
import { BoxIndex } from '../geometry/boxIndex';
import { wallFrame, type WallFrame } from '../geometry/wallFrame';
import { add, cross, dist, dot, intersectLines, scale, sub } from '../geometry/vec';
import type { Vec2 } from '../repr/primitives';
import type { PlanContext } from './registry';
import { zoneInPlan } from './planCut';
import type { CutZone } from '../repr/planCutPens';
import { levelOf } from '../repr/solids';

/*
 * Väggarnas kroppar i plan (ur wall.ts i 0.10.1): parametrarna, öppningarnas
 * hål, skarvarna och de sparade ytorna. Används av planen, rummen,
 * bjälklagen, väggarnas sidor och 3D.
 */

export interface WallParams {
  start: [number, number];
  end: [number, number];
  thickness: number;
  height: number;
  /** Var väggen ligger i förhållande till den ritade linjen (referenslinjen). */
  justification: 'center' | 'left' | 'right';
  /**
   * Bågväggar: referenslinjens pilhöjd i mm, positiv åt vänster sett från
   * start mot slut. Saknas eller 0 = rak vägg. (Format 4.)
   */
  bulge?: number;
  /** Väggen går upp till taket ovanför (och kapas av det). (Format 4.) */
  toRoof?: boolean;
  /** Väggens fot mot våningens golv, mm (0.10.13); höjden räknas därifrån. Utelämnad = 0. */
  level?: number;
}

/**
 * Öppningar i en vägg anger sitt läge längs väggen och sin bredd i
 * modulmått (1000 = 10 M). Hålet görs 10 mm större och karmen 10 mm mindre,
 * enligt svensk praxis: D10×21 sitter i ett hål 1010×2110 med karm 990×2090.
 */
export interface OpeningParams {
  at: number;
  width: number;
}

/**
 * Hur mycket en bågvägg buktar över en sträcka av väggen: så mycket längre
 * ut än väggens tjocklek ett rakt hål måste gå för att gå igenom.
 */
export function sagittaOver(f: WallFrame, width: number): number {
  if (!f.arc) return 0;
  const r = f.arc.radius + f.half;
  const h = Math.min(width / 2, r);
  return r - Math.sqrt(r * r - h * h) + 1;
}

/** Hålet är 10 mm större än modulmåttet, karmen 10 mm mindre. */
export const HOLE_EXTRA = 10;
export const FRAME_LESS = 10;

/**
 * Hålets höjder från våningens golv (0.10.16): från bröstningen (ett
 * fönster) eller väggens fot (en dörr) och modulmåttet + 10 uppåt. Ett
 * fönsters bröstning räknas från golvet, om det inte följer väggens fot.
 */
export function openingSpan(wall: { level?: unknown }, o: { height?: number; sill?: number; sillFromWall?: boolean }): [number, number] {
  const z0 = (o.sill === undefined || o.sillFromWall ? levelOf(wall) : 0) + (o.sill ?? 0);
  return [z0, z0 + (o.height ?? 0) + HOLE_EXTRA];
}

/** Var väggen och öppningen ligger mot planens snitt; utan snitt (fasader, 3D) `cut`. */
export function wallZone(ctx: Pick<PlanContext, 'doc' | 'storey'>, p: WallParams): CutZone {
  return zoneInPlan(ctx, levelOf(p), levelOf(p) + p.height);
}
export function openingZoneInPlan(ctx: Pick<PlanContext, 'doc' | 'storey'>, wall: WallParams, o: { height?: number; sill?: number; sillFromWall?: boolean }): CutZone {
  const [z0, z1] = openingSpan(wall, o);
  return zoneInPlan(ctx, z0, z1);
}

export function holeWidth(o: OpeningParams): number {
  return o.width + HOLE_EXTRA;
}

/** Öppningens rektangel genom väggen, för markering. */
export function openingRings(frame: WallFrame, o: OpeningParams, grow = 0): Vec2[][][] {
  const f = frame.local(o.at);
  const s1 = o.at - holeWidth(o) / 2;
  const s2 = o.at + holeWidth(o) / 2;
  const h = f.half + sagittaOver(frame, s2 - s1) + grow;
  return [[[f.at(s1, -h), f.at(s2, -h), f.at(s2, h), f.at(s1, h)]]];
}

/** Ändpunkter som ligger närmare varandra än så här räknas som en skarv (mm). */
export const JOIN_TOLERANCE = 1;

/**
 * Räknar ut varje väggs yta med skarvar och öppningar.
 *
 * - Två väggar som möts i en ändpunkt geras (L-hörn i valfri vinkel).
 * - Tre eller fler i samma punkt förlängs så att de täcker varandra.
 * - En vägg som slutar mot en annan väggs liv (T-skarv) kapas längs livet
 *   den möter, även när den står snett. Ytorna slås sedan ihop när de ritas.
 * - Bågväggar följer sin båge; i skarvarna räknas med tangenten.
 * - Öppningar skärs ut ur sin egen vägg.
 */
export function computeWallShapes(
  walls: { id: string; p: WallParams }[],
  openingsOf: (wallId: string) => OpeningParams[],
  cache?: WallShapeCache,
): Map<string, Rings[]> {
  const frames = new Map(walls.map((w) => [w.id, wallFrame(w.p)]));

  // Vilka väggändar möts i samma punkt? Det avgörs av referenslinjerna, som
  // är det man ritar och snäpper till; formen räknas från mittlinjerna.
  type End = { id: string; end: 'start' | 'end'; point: Vec2; ref: Vec2 };
  const ends: End[] = [];
  for (const w of walls) {
    const f = frames.get(w.id)!;
    ends.push({ id: w.id, end: 'start', point: f.a, ref: w.p.start }, { id: w.id, end: 'end', point: f.b, ref: w.p.end });
  }
  // Ändar och väggar i ett rutnät, så att varje ände bara prövas mot det som
  // ligger nära (0.8.1). Ordningen är densamma som i listorna.
  const reach = JOIN_TOLERANCE + 1;
  const endIndex = new BoxIndex(2000);
  ends.forEach((e, i) => endIndex.add(i, [e.ref[0] - reach, e.ref[1] - reach, e.ref[0] + reach, e.ref[1] + reach]));
  const wallIndex = new BoxIndex(2000);
  walls.forEach((w, i) => {
    const g = frames.get(w.id)!;
    const pad = g.half + reach;
    // En båge kan bukta ut utanför ändarnas rektangel; den prövas alltid.
    wallIndex.add(i, g.arc ? null : [Math.min(g.a[0], g.b[0]) - pad, Math.min(g.a[1], g.b[1]) - pad, Math.max(g.a[0], g.b[0]) + pad, Math.max(g.a[1], g.b[1]) + pad]);
  });
  const others = (e: End) =>
    endIndex
      .at(e.ref)
      .map((i) => ends[i])
      .filter((o) => o.id !== e.id && dist(o.ref, e.ref) <= JOIN_TOLERANCE);

  // Riktning bort från skarven, och väggens sidor sett i den riktningen.
  const away = (e: End): { dir: Vec2; leftN: Vec2; rightN: Vec2; half: number } => {
    const f = frames.get(e.id)!;
    const s = e.end === 'start' ? 0 : f.length;
    const t = f.tangent(s);
    const n = f.normal(s);
    return e.end === 'start'
      ? { dir: t, leftN: n, rightN: scale(n, -1), half: f.half }
      : { dir: scale(t, -1), leftN: scale(n, -1), rightN: n, half: f.half };
  };

  /**
   * T-skarv: väggänden ligger på eller i en annan vägg (inte vid dess ändar).
   * Ger livet den möter, som linje (punkt och riktning).
   */
  const teeFace = (e: End): { p: Vec2; d: Vec2 } | null => {
    const A = away(e);
    let best: { p: Vec2; d: Vec2; depth: number } | null = null;
    for (const i of wallIndex.at(e.ref)) {
      const w = walls[i];
      if (w.id === e.id) continue;
      const g = frames.get(w.id)!;
      const [s, o] = g.project(e.ref);
      if (s < 1 || s > g.length - 1 || Math.abs(o) > g.half + JOIN_TOLERANCE) continue;
      const loc = g.local(s);
      // Det liv väggen kommer ifrån: den sida dit väggen pekar bort från skarven.
      const side = dot(A.dir, loc.n) >= 0 ? 1 : -1;
      if (Math.abs(dot(A.dir, loc.u)) > 0.999) continue; // parallella
      const depth = Math.abs(o - side * g.half);
      if (!best || depth < best.depth) best = { p: loc.at(s, side * g.half), d: loc.u, depth };
    }
    return best;
  };

  /** Hörnpunkterna vid en väggände: [punkt på +n-sidan, punkt på −n-sidan]. */
  const endCorners = (e: End): [Vec2, Vec2] => {
    const f = frames.get(e.id)!;
    const A = away(e);
    const sEnd = e.end === 'start' ? 0 : f.length;
    const n = f.normal(sEnd);
    const square = (extend: number): [Vec2, Vec2] => {
      const base = sub(e.point, scale(A.dir, extend));
      return [add(base, scale(n, f.half)), sub(base, scale(n, f.half))];
    };
    const os = others(e);
    if (os.length === 0) {
      const tee = teeFace(e);
      if (tee) {
        const pL = intersectLines(add(e.point, scale(A.leftN, A.half)), A.dir, tee.p, tee.d);
        const pR = intersectLines(add(e.point, scale(A.rightN, A.half)), A.dir, tee.p, tee.d);
        const limit = 6 * A.half + 200;
        if (pL && pR && dist(pL, e.point) < limit && dist(pR, e.point) < limit) {
          return e.end === 'start' ? [pL, pR] : [pR, pL];
        }
      }
      return square(0);
    }
    if (os.length >= 2) return square(Math.max(...os.map((o) => frames.get(o.id)!.half)));

    const o = os[0];
    const B = away(o);
    if (Math.abs(cross(A.dir, B.dir)) < 1e-6) return square(0); // raka förlängningar
    const pL = intersectLines(add(e.point, scale(A.leftN, A.half)), A.dir, add(o.point, scale(B.rightN, B.half)), B.dir);
    const pR = intersectLines(add(e.point, scale(A.rightN, A.half)), A.dir, add(o.point, scale(B.leftN, B.half)), B.dir);
    const limit = 6 * Math.max(A.half, B.half);
    if (!pL || !pR || dist(pL, e.point) > limit || dist(pR, e.point) > limit) {
      return square(B.half);
    }
    // pL ligger på väggens vänstra sida sett från skarven.
    return e.end === 'start' ? [pL, pR] : [pR, pL];
  };

  const out = new Map<string, Rings[]>();
  for (const w of walls) {
    const f = frames.get(w.id)!;
    if (dist(f.a, f.b) < 1 && !f.arc) continue;
    // Väggens yta beror på väggen, de väggar som når fram till dess ändar och
    // öppningarna i den. Är de oförändrade återanvänds ytan (0.8.3).
    let near: WallParams[] = [];
    let openings: OpeningParams[] = [];
    if (cache) {
      near = [...wallIndex.at(w.p.start), ...wallIndex.at(w.p.end)].map((i) => walls[i].p);
      openings = openingsOf(w.id);
      const hit = cache.get(w.p);
      if (hit && hit.id === w.id && sameItems(hit.near, near) && sameItems(hit.openings, openings)) {
        out.set(w.id, hit.rings);
        continue;
      }
    }
    const [sPos, sNeg] = endCorners({ id: w.id, end: 'start', point: f.a, ref: w.p.start });
    const [ePos, eNeg] = endCorners({ id: w.id, end: 'end', point: f.b, ref: w.p.end });
    let body: Rings;
    if (f.arc) {
      // Bågens punkter mellan ändarna; ändarna själva kommer från skarvarna.
      const neg = f.trace(0, f.length, -f.half).slice(1, -1);
      const pos = f.trace(f.length, 0, f.half).slice(1, -1);
      body = [[sNeg, ...neg, eNeg, ePos, ...pos, sPos]];
    } else {
      body = [[sNeg, eNeg, ePos, sPos]];
    }
    const cutters: Rings[] = (cache ? openings : openingsOf(w.id)).map((o) => openingRings(f, o, 1)[0] as unknown as Rings);
    const rings = difference(body, cutters);
    out.set(w.id, rings);
    cache?.set(w.p, { id: w.id, near, openings, rings });
  }
  return out;
}

/**
 * Sparade väggytor per vägg (0.8.3), nycklade på väggens parametrar. En för
 * ytorna med öppningar (planen) och en utan (rummen, 3D och väggarnas sidor).
 */
export type WallShapeCache = WeakMap<WallParams, { id: string; near: WallParams[]; openings: OpeningParams[]; rings: Rings[] }>;
export const wallsWithOpenings: WallShapeCache = new WeakMap();
export const bareWalls: WallShapeCache = new WeakMap();
const noOpenings = (): OpeningParams[] => [];

/** Väggarnas ytor utan öppningar, för rummen, 3D och väggarnas sidor. */
export function bareWallShapes(walls: { id: string; p: WallParams }[]): Map<string, Rings[]> {
  return computeWallShapes(walls, noOpenings, bareWalls);
}

/**
 * Väggarnas ytor utan öppningar, sammanslagna (0.8.32). Rummens hål och
 * husets ytterkontur (vilken sida som är ute) tas ur samma sammanslagning,
 * som görs en gång när de gäller samma väggar i samma ordning (samma
 * parametrar, jämförda med ===).
 */
export function bareWallUnion(walls: { id: string; p: WallParams }[]): Rings[] {
  return savedUnions(
    walls.flatMap((w) => [w.id, w.p]),
    () => union([...bareWallShapes(walls).values()].flat()),
  );
}
const savedUnions = lastResults<Rings[]>();

/** Väggarnas ytor för hela vyn, beräknade en gång per ritning. */
export function wallShapesFor(ctx: PlanContext): Map<string, Rings[]> {
  return ctx.memo('wall-shapes', () =>
    computeWallShapes(
      ctx.visible('Wall').map((el) => ({ id: el.id, p: ctx.params<WallParams>(el) })),
      // Bara öppningar som går genom snittet tar upp hål i planen (0.10.16):
      // förbi ett högt fönster går väggen obruten.
      (id) => {
        const w = ctx.doc.elements[id];
        const wp = w ? ctx.params<WallParams>(w) : undefined;
        return ctx
          .openingsIn(id)
          .map((o) => ctx.params<OpeningParams & { height?: number; sill?: number; sillFromWall?: boolean }>(o))
          .filter((o) => !wp || openingZoneInPlan(ctx, wp, o) === 'cut');
      },
      wallsWithOpenings,
    ),
  );
}
