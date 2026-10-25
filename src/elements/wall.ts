import { effectivePen } from '../repr/ownPen';
import { ownedOutlines } from '../repr/outlineOwners';
import { lastResults, sameItems } from '../repr/reuse';
import type { Element } from '../core/model';
import { boxesTouch, boxOf, difference, union, type Box, type Rings } from '../geometry/boolean';
import { BoxIndex } from '../geometry/boxIndex';
import { wallFrame, type WallFrame } from '../geometry/wallFrame';
import { add, cross, dist, dot, intersectLines, scale, sub } from '../geometry/vec';
import type { Primitive, Vec2 } from '../repr/primitives';
import { zOn, type Edges3D, type Plane, type Shape3D } from '../repr/solids';
import { planeRange, roofPlanes, trimToRoofs, type RoofParams } from './roof';
import { litteraTag, showLittera } from './littera';
import type { ElementType, PlanContext } from './registry';
import { INSIDE } from './wallSides';

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
}

export { wallFrame, type WallFrame } from '../geometry/wallFrame';

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

/**
 * Markeringar för öppningar i befintliga väggar, enligt svensk praxis:
 * - en dörr som tas bort lämnar ett igensatt hål med nytt väggmaterial,
 * - en ny öppning får en skrafferad zon på var sida i den befintliga väggen.
 * Ritas av dörr- och fönsterreglerna, ovanpå väggen.
 */
export function openingMarks(
  el: Element<any>,
  host: Element<any>,
  p: OpeningParams,
  ctx: PlanContext,
  opts: { infillWhenRemoved: boolean },
): Primitive[] {
  const action = ctx.actionOf(el);
  if (ctx.actionOf(host) !== 'existing') return [];
  const f = wallFrame(ctx.params<WallParams>(host));
  const s1 = p.at - holeWidth(p) / 2;
  const s2 = p.at + holeWidth(p) / 2;
  const rect = (a: number, b: number): Vec2[] => [...f.trace(a, b, -f.half), ...f.trace(b, a, f.half)];
  const origin = { objectId: el.id, objectType: el.type, part: 'markering' };

  if (action === 'demolished' && opts.infillWhenRemoved) {
    return [{ kind: 'region', role: 'cut', rings: openingRings(f, p)[0], fill: { kind: 'none' }, outline: null, styleAs: 'new', origin }];
  }
  const mark = ctx.style.openingMark;
  if (action === 'new' && mark > 0) {
    const a1 = Math.max(0, s1 - mark);
    const b2 = Math.min(f.length, s2 + mark);
    const out: Primitive[] = [];
    if (s1 - a1 > 1) out.push({ kind: 'region', role: 'cut', rings: [rect(a1, s1)], fill: { kind: 'none' }, outline: null, styleAs: 'new', noOutline: true, origin });
    if (b2 - s2 > 1) out.push({ kind: 'region', role: 'cut', rings: [rect(s2, b2)], fill: { kind: 'none' }, outline: null, styleAs: 'new', noOutline: true, origin });
    // Ingen tvärgående kontur: skrafferingen går rakt över i den befintliga väggen.
    return out;
  }
  return [];
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
      (id) => ctx.openingsIn(id).map((o) => ctx.params<OpeningParams>(o)),
      wallsWithOpenings,
    ),
  );
}

/**
 * Väggtypens littera längs väggen, på insidan av ytterväggar. Läget väljs
 * där ingen öppning är i vägen.
 */
function wallTag(ctx: PlanContext, el: Element): Primitive[] {
  const f = wallFrame(ctx.params<WallParams>(el));
  const room = ctx.scale * 8;
  if (f.length < room * 1.5) return [];
  const openings = ctx.openingsIn(el.id).map((o) => ctx.params<OpeningParams>(o));
  const free = (s: number) => openings.every((o) => Math.abs(o.at - s) > o.width / 2 + room / 2);
  const s = [0.5, 0.35, 0.65, 0.2, 0.8].map((t) => t * f.length).find(free);
  if (s === undefined) return [];
  return litteraTag(ctx, el, f.local(s), s, INSIDE, { leader: true });
}

export const wallType: ElementType<WallParams> = {
  type: 'Wall',
  planReads: ['Wall', 'hosted'],
  label: 'Vägg',
  labelPlural: 'Väggar',
  litteraPrefix: 'IV',
  drawOrder: 10,
  compares: true,
  typeParams: ['thickness'],
  defaults: () => ({ start: [0, 0], end: [3000, 0], thickness: 120, height: 2700, justification: 'center' }),
  // Utan egen höjd följer väggen våningshöjden (0.9).
  storeyParams: (s) => ({ height: s.height }),

  planBatch(items, ctx) {
    const shapes = wallShapesFor(ctx);
    const pieces = items.flatMap(({ el }) => shapes.get(el.id) ?? []);
    // Väggar med samma åtgärd flyter ihop till en yta, så att skarvarna blir rena.
    let regions = union(pieces);
    // Där en ny eller riven vägg går in i en befintlig hör ytan till den befintliga.
    const action = items[0]?.action;
    if (action === 'new' || action === 'demolished') {
      const existing = ctx.memo('walls-existing', () =>
        union(
          ctx
            .visible('Wall')
            .filter((w) => ctx.actionOf(w) === 'existing')
            .flatMap((w) => shapes.get(w.id) ?? []),
        ),
      );
      if (existing.length) regions = regions.flatMap((r) => difference(r, existing));
    }
    // Väggar med egen penna (0.8.31): ytan är en, men konturen delas efter
    // vilken vägg kanten kommer ifrån, så att den egna pennan hamnar på rätt kanter.
    const owned = new Set(items.filter(({ el }) => effectivePen(ctx.doc, el)).map(({ el }) => el.id));
    const out = regions.map(
      (rings): Primitive => ({
        kind: 'region',
        role: 'cut',
        rings,
        fill: { kind: 'solid', color: 'ink' },
        outline: { weight: 0.35 },
        ...(owned.size ? { noOutline: true } : {}),
        origin: { objectType: 'Wall', part: 'snitt' },
      }),
    );
    if (owned.size) {
      const own = items.flatMap(({ el }) => (shapes.get(el.id) ?? []).map((r) => ({ id: el.id, rings: r })));
      for (const o of ownedOutlines(regions, own, owned))
        out.push({ kind: 'polyline', points: o.points, closed: o.closed, pen: { weight: 0.35 }, asOutline: true, origin: { ...(o.id ? { objectId: o.id } : {}), objectType: 'Wall', part: 'kontur' } });
    }
    if (showLittera(ctx, 'Wall') && action !== 'demolished') {
      for (const { el } of items) out.push(...wallTag(ctx, el));
    }
    return out;
  },

  pickShape(el, ctx) {
    return wallShapesFor(ctx).get(el.id) ?? [];
  },

  model3dBatch(items, ctx) {
    const walls = items.map(({ el, action }) => ({ el, action, p: ctx.params<WallParams>(el) }));
    // Väggkropparna utan öppningar, med gering i hörnen.
    const bodies = bareWallShapes(walls.map((w) => ({ id: w.el.id, p: w.p })));
    // Där väggar går in i varandra (T-skarvar) får den längre väggen ytan,
    // så att inga ytor ligger dubbelt och flimrar. Bara väggar vars
    // omskrivande rektanglar möts prövas (0.8 del 2.1): förut slogs varje
    // vägg ihop med alla tidigare, vilket växte med kvadraten på antalet.
    const order = [...walls].sort((a, b) => wallFrame(b.p).length - wallFrame(a.p).length);
    const taken: { rings: Rings; box: Box }[] = [];
    const own = new Map<string, Rings[]>();
    for (const w of order) {
      const body = bodies.get(w.el.id) ?? [];
      const mine = body.flatMap((r) => {
        const box = boxOf(r);
        const near = taken.filter((t) => boxesTouch(t.box, box)).map((t) => t.rings);
        return near.length ? difference(r, union(near)) : [r];
      });
      own.set(w.el.id, mine);
      for (const r of body) taken.push({ rings: r, box: boxOf(r) });
    }

    // Taken på våningen kapar väggarna, eller drar upp dem (Upp till taket).
    const roofs = ctx.memo('roof-planes', () =>
      ctx
        .visible('Roof')
        .filter((r) => ctx.actionOf(r) !== 'demolished')
        .flatMap((r) => roofPlanes(ctx.params<RoofParams>(r))),
    );
    const pieces: WallPiece[] = [];
    for (const { el, action, p } of walls) {
      for (const piece of own.get(el.id) ?? []) {
        for (const t of trimToRoofs(piece, p.height, !!p.toRoof, roofs)) {
          pieces.push({ id: el.id, action, rings: t.rings, top: t.top ?? null, height: p.height });
        }
      }
    }

    const solids: Shape3D[] = [...wallEdges(pieces)];
    for (const { el, action, p } of walls) {
      const f = wallFrame(p);
      const material = action === 'new' ? 'wall-new' : 'wall';
      // Öppningarna i höjdled: dörrar från golvet, fönster från bröstningen.
      const openings = ctx.openingsIn(el.id).map((o) => {
        const op = ctx.params<OpeningParams & { height: number; sill?: number }>(o);
        const sill = op.sill ?? 0;
        return { at: op.at, width: holeWidth(op), z0: sill, z1: Math.min(p.height, sill + op.height + HOLE_EXTRA) };
      });
      // Varje vägg är en hel kropp med öppningarna som genomgående urtag,
      // så att ytan runt dörrar och fönster inte delas upp i bitar.
      const h = f.half;
      const rect = (o: { at: number; width: number }, grow: number): Rings => {
        const s1 = o.at - o.width / 2;
        const s2 = o.at + o.width / 2;
        const lf = f.local(o.at);
        const hh = h + grow + sagittaOver(f, o.width);
        return [[lf.at(s1, -hh), lf.at(s2, -hh), lf.at(s2, hh), lf.at(s1, hh)]];
      };
      const cuts = openings.map((o) => ({ rings: rect(o, 1), z0: o.z0, z1: o.z1 }));
      for (const piece of pieces) {
        if (piece.id !== el.id) continue;
        const z1 = piece.top ? planeRange(piece.top, piece.rings)[1] : p.height;
        solids.push({ id: el.id, rings: piece.rings, z0: 0, z1, ...(piece.top ? { top: piece.top } : {}), material, noEdges: true, cuts });
      }
      for (const o of openings) {
        // Öppningens omfattning på båda sidor och djupet i smygen.
        const s1 = o.at - o.width / 2;
        const s2 = o.at + o.width / 2;
        const seg: Edges3D = { kind: 'edges', id: el.id, segments: [], part: 'hole' };
        // I bågväggar är hålet rakt; omfattningen ligger där hålet möter livet.
        const lf = f.local(o.at);
        const pt = (s: number, off: number, z: number): [number, number, number] => {
          let q = lf.at(s, off);
          if (f.arc) {
            // Punkten där den raka smygen skär bågens liv.
            const ray = lf.at(s, 0);
            const dir = lf.n;
            const c = f.arc.center;
            const rr = f.arc.radius + f.arc.sigma * off;
            const ox = ray[0] - c[0];
            const oy = ray[1] - c[1];
            const bq = ox * dir[0] + oy * dir[1];
            const cq = ox * ox + oy * oy - rr * rr;
            const disc = bq * bq - cq;
            if (disc >= 0) {
              const t1 = -bq + Math.sqrt(disc);
              const t2 = -bq - Math.sqrt(disc);
              const t = Math.abs(t1 - off) < Math.abs(t2 - off) ? t1 : t2;
              q = [ray[0] + dir[0] * t, ray[1] + dir[1] * t];
            }
          }
          return [q[0], q[1], z];
        };
        for (const side of [-h, h]) {
          seg.segments.push([...pt(s1, side, o.z0), ...pt(s1, side, o.z1)], [...pt(s2, side, o.z0), ...pt(s2, side, o.z1)]);
          if (o.z1 < p.height - 1) seg.segments.push([...pt(s1, side, o.z1), ...pt(s2, side, o.z1)]);
          if (o.z0 > 1) seg.segments.push([...pt(s1, side, o.z0), ...pt(s2, side, o.z0)]);
        }
        for (const s of [s1, s2]) {
          if (o.z1 < p.height - 1) seg.segments.push([...pt(s, -h, o.z1), ...pt(s, h, o.z1)]);
          if (o.z0 > 1) seg.segments.push([...pt(s, -h, o.z0), ...pt(s, h, o.z0)]);
        }
        solids.push(seg);
      }
    }
    return solids;
  },
};

/** En bit av en vägg med sin ovansida, för kantlinjerna. */
interface WallPiece {
  id: string;
  action: string;
  rings: Rings;
  top: Plane | null;
  height: number;
}

const BEND = Math.sin((9 * Math.PI) / 180);

/**
 * Väggarnas kantlinjer i 3D. Bitar med samma åtgärd och ovansida slås ihop,
 * så att skarvarna mellan väggar inte syns. Lodräta kanter ritas där
 * väggmassan viker, och där en lägre del möter en högre bara ovanför den
 * lägre. Bågar delas i raka bitar som inte får egna lodräta kanter.
 */
function wallEdges(pieces: WallPiece[]): Edges3D[] {
  const topKey = (pc: WallPiece) => (pc.top ? pc.top.map((v) => v.toFixed(6)).join(',') : `h${pc.height}`);
  const groups = new Map<string, { id: string; zTop: (q: Vec2) => number; rings: Rings[] }>();
  for (const pc of pieces) {
    const key = `${pc.action}|${topKey(pc)}`;
    let g = groups.get(key);
    if (!g) {
      const top = pc.top;
      const h = pc.height;
      g = { id: pc.id, zTop: top ? (q) => zOn(top, q[0], q[1]) : () => h, rings: [] };
      groups.set(key, g);
    }
    g.rings.push(pc.rings);
  }
  const merged = [...groups.values()].map((g) => ({ ...g, polys: union(g.rings) }));

  // Hörnen i hela väggmassan: där är lodräta kanter riktiga hörn.
  const all = union(pieces.map((p) => p.rings));
  const corners: Vec2[] = [];
  for (const poly of all) for (const ring of poly) ring.forEach((q, i) => bends(ring, i) && corners.push(q));
  const isCorner = (q: Vec2) => corners.some((c) => Math.abs(c[0] - q[0]) < 0.6 && Math.abs(c[1] - q[1]) < 0.6);
  /** Den högsta andra gruppen som har punkten på sin kontur. */
  const otherTop = (self: (typeof merged)[number], q: Vec2): number => {
    let best = -Infinity;
    for (const g of merged) {
      if (g === self) continue;
      if (g.polys.some((poly) => poly.some((ring) => onRing(ring, q)))) best = Math.max(best, g.zTop(q));
    }
    return best;
  };

  const out: Edges3D[] = [];
  for (const g of merged) {
    const e: Edges3D = { kind: 'edges', id: g.id, segments: [], part: 'wall' };
    for (const poly of g.polys) {
      for (const ring of poly) {
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i];
          const b = ring[(i + 1) % ring.length];
          e.segments.push([a[0], a[1], 0, b[0], b[1], 0], [a[0], a[1], g.zTop(a), b[0], b[1], g.zTop(b)]);
          if (!bends(ring, i)) continue;
          const top = g.zTop(a);
          if (isCorner(a)) e.segments.push([a[0], a[1], 0, a[0], a[1], top]);
          else {
            const from = Math.max(0, otherTop(g, a));
            if (top - from > 1) e.segments.push([a[0], a[1], from, a[0], a[1], top]);
          }
        }
      }
    }
    out.push(e);
  }
  return out;
}

function bends(ring: readonly Vec2[], i: number): boolean {
  const n = ring.length;
  const prev = ring[(i - 1 + n) % n];
  const a = ring[i];
  const b = ring[(i + 1) % n];
  return Math.abs(cross(sub(a, prev), sub(b, a))) > BEND * dist(prev, a) * dist(a, b);
}

function onRing(ring: readonly Vec2[], q: Vec2): boolean {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const ab = sub(b, a);
    const l2 = dot(ab, ab);
    const t = l2 ? Math.max(0, Math.min(1, dot(sub(q, a), ab) / l2)) : 0;
    if (dist(q, [a[0] + ab[0] * t, a[1] + ab[1] * t]) < 0.6) return true;
  }
  return false;
}
