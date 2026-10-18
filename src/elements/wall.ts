import type { Element } from '../core/model';
import { difference, union, type Rings } from '../geometry/boolean';
import { add, cross, dist, intersectLines, left, norm, scale, sub } from '../geometry/vec';
import type { Primitive, Vec2 } from '../repr/primitives';
import type { Edges3D, Shape3D } from '../repr/solids';
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
}

/** En väggs lokala koordinatsystem: s längs väggen, o åt vänster om mittlinjen. */
export interface WallFrame {
  length: number;
  half: number;
  u: Vec2;
  n: Vec2;
  /** Mittlinjens ändpunkter. */
  a: Vec2;
  b: Vec2;
  /** Punkt på avståndet s längs väggens mittlinje och o åt vänster om den. */
  at(s: number, o: number): Vec2;
}

export function wallFrame(p: WallParams): WallFrame {
  const d = sub(p.end, p.start);
  const length = Math.hypot(d[0], d[1]) || 1;
  const u = norm(d);
  const n = left(u);
  const half = p.thickness / 2;
  // Mittlinjens förskjutning från referenslinjen.
  const shift = p.justification === 'left' ? half : p.justification === 'right' ? -half : 0;
  const a = add(p.start, scale(n, shift));
  const b = add(p.end, scale(n, shift));
  return { length, half, u, n, a, b, at: (s, o) => add(add(a, scale(u, s)), scale(n, o)) };
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

/** Hålet är 10 mm större än modulmåttet, karmen 10 mm mindre. */
export const HOLE_EXTRA = 10;
export const FRAME_LESS = 10;

export function holeWidth(o: OpeningParams): number {
  return o.width + HOLE_EXTRA;
}

/** Öppningens rektangel genom väggen, för markering. */
export function openingRings(f: WallFrame, o: OpeningParams): Vec2[][][] {
  const s1 = o.at - holeWidth(o) / 2;
  const s2 = o.at + holeWidth(o) / 2;
  return [[[f.at(s1, -f.half), f.at(s2, -f.half), f.at(s2, f.half), f.at(s1, f.half)]]];
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
  const rect = (a: number, b: number): Vec2[] => [f.at(a, -f.half), f.at(b, -f.half), f.at(b, f.half), f.at(a, f.half)];
  const origin = { objectId: el.id, objectType: el.type, part: 'markering' };

  if (action === 'demolished' && opts.infillWhenRemoved) {
    return [{ kind: 'region', role: 'cut', rings: [rect(s1, s2)], fill: { kind: 'none' }, outline: null, styleAs: 'new', origin }];
  }
  const mark = ctx.style.openingMark;
  if (action === 'new' && mark > 0) {
    const a1 = Math.max(0, s1 - mark);
    const b2 = Math.min(f.length, s2 + mark);
    const out: Primitive[] = [];
    if (s1 - a1 > 1) out.push({ kind: 'region', role: 'cut', rings: [rect(a1, s1)], fill: { kind: 'none' }, outline: null, styleAs: 'new', noOutline: true, origin });
    if (b2 - s2 > 1) out.push({ kind: 'region', role: 'cut', rings: [rect(s2, b2)], fill: { kind: 'none' }, outline: null, styleAs: 'new', noOutline: true, origin });
    for (const s of [a1, b2]) if (s > 1 && s < f.length - 1) out.push({ kind: 'line', a: f.at(s, -f.half), b: f.at(s, f.half), pen: { weight: 0.18 }, origin });
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
 * - En vägg som slutar mot en annan väggs liv (T-skarv) behöver inget särskilt:
 *   ytorna slås ihop när de ritas.
 * - Öppningar skärs ut ur sin egen vägg.
 */
export function computeWallShapes(
  walls: { id: string; p: WallParams }[],
  openingsOf: (wallId: string) => OpeningParams[],
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
  const others = (e: End) => ends.filter((o) => o.id !== e.id && dist(o.ref, e.ref) <= JOIN_TOLERANCE);

  // Riktning bort från skarven, och väggens sidor sett i den riktningen.
  const away = (e: End): { dir: Vec2; leftN: Vec2; rightN: Vec2; half: number } => {
    const f = frames.get(e.id)!;
    return e.end === 'start'
      ? { dir: f.u, leftN: f.n, rightN: scale(f.n, -1), half: f.half }
      : { dir: scale(f.u, -1), leftN: scale(f.n, -1), rightN: f.n, half: f.half };
  };

  /** Hörnpunkterna vid en väggände: [punkt på +n-sidan, punkt på −n-sidan]. */
  const endCorners = (e: End): [Vec2, Vec2] => {
    const f = frames.get(e.id)!;
    const A = away(e);
    const square = (extend: number): [Vec2, Vec2] => {
      const base = sub(e.point, scale(A.dir, extend));
      return [add(base, scale(f.n, f.half)), sub(base, scale(f.n, f.half))];
    };
    const os = others(e);
    if (os.length === 0) return square(0);
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
    if (dist(f.a, f.b) < 1) continue;
    const [sPos, sNeg] = endCorners({ id: w.id, end: 'start', point: f.a, ref: w.p.start });
    const [ePos, eNeg] = endCorners({ id: w.id, end: 'end', point: f.b, ref: w.p.end });
    const body: Rings = [[sNeg, eNeg, ePos, sPos]];
    const cutters: Rings[] = openingsOf(w.id).map((o) => {
      const s1 = o.at - holeWidth(o) / 2;
      const s2 = o.at + holeWidth(o) / 2;
      const h = f.half + 1;
      return [[f.at(s1, -h), f.at(s2, -h), f.at(s2, h), f.at(s1, h)]];
    });
    out.set(w.id, difference(body, cutters));
  }
  return out;
}

/** Väggarnas ytor för hela vyn, beräknade en gång per ritning. */
export function wallShapesFor(ctx: PlanContext): Map<string, Rings[]> {
  return ctx.memo('wall-shapes', () =>
    computeWallShapes(
      ctx.visible('Wall').map((el) => ({ id: el.id, p: ctx.params<WallParams>(el) })),
      (id) => ctx.openingsIn(id).map((o) => ctx.params<OpeningParams>(o)),
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
  return litteraTag(ctx, el, f, s, INSIDE, { leader: true });
}

export const wallType: ElementType<WallParams> = {
  type: 'Wall',
  label: 'Vägg',
  labelPlural: 'Väggar',
  litteraPrefix: 'IV',
  drawOrder: 10,
  compares: true,
  typeParams: ['thickness'],
  defaults: () => ({ start: [0, 0], end: [3000, 0], thickness: 120, height: 2700, justification: 'center' }),

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
    const out = regions.map(
      (rings): Primitive => ({
        kind: 'region',
        role: 'cut',
        rings,
        fill: { kind: 'solid', color: 'ink' },
        outline: { weight: 0.35 },
        origin: { objectType: 'Wall', part: 'snitt' },
      }),
    );
    if (showLittera(ctx) && action !== 'demolished') {
      for (const { el } of items) out.push(...wallTag(ctx, el));
    }
    return out;
  },

  pickShape(el, ctx) {
    return wallShapesFor(ctx).get(el.id) ?? [];
  },

  model3dBatch(items, ctx) {
    const walls = items.map(({ el }) => ({ el, p: ctx.params<WallParams>(el) }));
    // Väggkropparna utan öppningar, med gering i hörnen.
    const bodies = computeWallShapes(
      walls.map((w) => ({ id: w.el.id, p: w.p })),
      () => [],
    );
    // Där väggar går in i varandra (T-skarvar) får den längre väggen ytan,
    // så att inga ytor ligger dubbelt och flimrar.
    const order = [...walls].sort((a, b) => dist(b.p.start, b.p.end) - dist(a.p.start, a.p.end));
    const taken: Rings[] = [];
    const own = new Map<string, Rings[]>();
    for (const w of order) {
      const body = bodies.get(w.el.id) ?? [];
      const mine = taken.length ? body.flatMap((r) => difference(r, union(taken))) : body;
      own.set(w.el.id, mine);
      taken.push(...body);
    }

    const solids: Shape3D[] = [];
    // Kantlinjer: väggarnas sammanslagna kontur upptill och nedtill, lodräta
    // hörn och öppningarnas omfattningar. Bitarna själva ritas utan kanter.
    const byHeight = new Map<number, Rings[]>();
    for (const { el, p } of walls) byHeight.set(p.height, [...(byHeight.get(p.height) ?? []), ...(own.get(el.id) ?? [])]);
    const outline: Edges3D = { kind: 'edges', id: 'walls', segments: [] };
    for (const [height, list] of byHeight) {
      for (const poly of union(list)) {
        for (const ring of poly) {
          for (let i = 0; i < ring.length; i++) {
            const a = ring[i];
            const b = ring[(i + 1) % ring.length];
            const prev = ring[(i - 1 + ring.length) % ring.length];
            outline.segments.push([a[0], a[1], 0, b[0], b[1], 0], [a[0], a[1], height, b[0], b[1], height]);
            // Lodrät kant bara där konturen faktiskt viker.
            if (Math.abs(cross(sub(a, prev), sub(b, a))) > 1e-3 * dist(prev, a) * dist(a, b)) {
              outline.segments.push([a[0], a[1], 0, a[0], a[1], height]);
            }
          }
        }
      }
    }
    solids.push(outline);

    for (const { el, p } of walls) {
      const f = wallFrame(p);
      const action = ctx.actionOf(el);
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
        return [[f.at(s1, -h - grow), f.at(s2, -h - grow), f.at(s2, h + grow), f.at(s1, h + grow)]];
      };
      const cuts = openings.map((o) => ({ rings: rect(o, 1), z0: o.z0, z1: o.z1 }));
      for (const piece of own.get(el.id) ?? []) {
        solids.push({ id: el.id, rings: piece, z0: 0, z1: p.height, material, noEdges: true, cuts });
      }
      for (const o of openings) {
        // Öppningens omfattning på båda sidor och djupet i smygen.
        const s1 = o.at - o.width / 2;
        const s2 = o.at + o.width / 2;
        const seg: Edges3D = { kind: 'edges', id: el.id, segments: [] };
        const pt = (s: number, off: number, z: number): [number, number, number] => {
          const q = f.at(s, off);
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

export type WallElement = Element<WallParams>;
