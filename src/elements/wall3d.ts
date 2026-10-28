import { boxesTouch, boxOf, difference, intersection, union, type Box, type Rings } from '../geometry/boolean';
import { wallFrame } from '../geometry/wallFrame';
import { BoxIndex } from '../geometry/boxIndex';
import { cross, dist, distToSegment, dot, pointInRings, sub } from '../geometry/vec';
import { edgeOwners } from '../repr/outlineOwners';
import type { Vec2 } from '../repr/primitives';
import { levelOf, zOn, type Edges3D, type Plane, type Shape3D, type Shear } from '../repr/solids';
import type { PlanContext, PlanItem, SlabAbove } from './registry';
import { openingLift } from './opening';
import { halfPlaneBelow, planeRange, roofPlanesAround, trimToRoofs, type RoofPlane } from './roof';
import { bareWallShapes, HOLE_EXTRA, holeWidth, sagittaOver, wallShear, type OpeningParams, type WallParams } from './wallBodies';

/*
 * Väggarnas 3D (ur wall.ts i 0.10.1): kropparna kapade av taken och
 * bjälklagen ovanför, öppningarna som urtag och kantlinjerna.
 */

/** En bit av en vägg med sin ovansida: ett plan (under tak) eller en höjd. */
interface WallPiece {
  id: string;
  action: string;
  rings: Rings;
  top: Plane | null;
  height: number;
  /** Väggens fot över våningens golv (0.10.13). */
  base: number;
  /** Lutningen (0.10.21), null för en lodrät vägg. */
  shear: Shear | null;
}

/**
 * Ett plan i de oförskjutna koordinaterna för en lutande vägg (0.10.21):
 * höjden z där en punkt på konturen (vid foten, z0) når planet när den
 * lutar ut med `shear`. z = a·(x + sx·(z − z0)) + … ger z·(1 − k) = a·x + b·y
 * + c − k·z0 med k = a·sx + b·sy.
 */
function unshearPlane(pl: Plane, shear: Shear, z0: number): Plane {
  const k = pl[0] * shear[0] + pl[1] * shear[1];
  const d = Math.abs(1 - k) < 1e-6 ? 1e-6 : 1 - k;
  return [pl[0] / d, pl[1] / d, (pl[2] - k * z0) / d];
}

function shiftRings(rings: Rings, dx: number, dy: number): Rings {
  return rings.map((r) => r.map((q): Vec2 => [q[0] + dx, q[1] + dy]));
}

/**
 * Taken sedda från en lutande vägg: planen i väggens oförskjutna
 * koordinater, och takets yta i plan flyttad tillbaka så långt som väggen
 * lutar ut vid sin höjd (en förenkling: takets kant mot en lutande vägg
 * räknas vid toppen).
 */
function roofsFor(roofs: readonly RoofPlane[], shear: Shear, base: number, height: number): RoofPlane[] {
  return roofs.map((rp) => ({ ...rp, rings: shiftRings(rp.rings, -shear[0] * height, -shear[1] * height), under: unshearPlane(rp.under, shear, base), top: unshearPlane(rp.top, shear, base) }));
}

/** Bjälklagen sedda från en lutande vägg: flyttade tillbaka så långt som väggen lutar ut vid bjälklagets undersida. */
function slabsFor(slabs: readonly SlabCut[], shear: Shear, base: number): SlabCut[] {
  return slabCuts(slabs.map((sc) => ({ ...sc, rings: shiftRings(sc.rings, -shear[0] * (sc.under - base), -shear[1] * (sc.under - base)) })));
}

/** Väggarna med en åtgärd i 3D, för `model3dBatch` på väggtypen. */
export function wallModel3d(items: PlanItem[], ctx: PlanContext): Shape3D[] {
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

  // Taken kapar väggarna, eller drar upp dem (Upp till taket). Takfall på
  // alla våningar (0.10), i den här våningens höjder. Sedan bjälklagen
  // ovanför (0.10.1), där de täcker väggen.
  const roofs = ctx.memo('roof-planes', () => roofPlanesAround(ctx));
  const slabs = ctx.memo('slabs-above', () => slabCuts(ctx.slabsAbove ?? []));
  const pieces: WallPiece[] = [];
  // Höjderna gäller från våningens golv; foten ligger på väggens nivå (0.10.13).
  for (const { el, action, p } of walls) {
    const base = levelOf(p);
    const top = base + p.height;
    // En lutande vägg (0.10.21) räknas i sina egna, oförskjutna koordinater.
    const shear = wallShear(p);
    const myRoofs = shear && roofs.length ? roofsFor(roofs, shear, base, p.height) : roofs;
    const mySlabs = shear && slabs.length ? slabsFor(slabs, shear, base) : slabs;
    for (const piece of own.get(el.id) ?? []) {
      for (const t of trimToRoofs(piece, top, !!p.toRoof, myRoofs)) {
        for (const s of underSlabs(t.rings, t.top ?? null, top, mySlabs, base)) pieces.push({ id: el.id, action, base, shear, ...s });
      }
    }
  }

  const solids: Shape3D[] = [...wallEdges(pieces)];
  // Bitarna per vägg (0.10.1; förut prövades alla bitar för varje vägg).
  const byWall = new Map<string, WallPiece[]>();
  for (const pc of pieces) {
    const list = byWall.get(pc.id);
    if (list) list.push(pc);
    else byWall.set(pc.id, [pc]);
  }
  for (const { el, action, p } of walls) {
    const f = wallFrame(p);
    const material = action === 'new' ? 'wall-new' : 'wall';
    const base = levelOf(p);
    const wallTop = base + p.height;
    const shear = wallShear(p);
    // Öppningarna i höjdled: dörrar från väggens fot, fönster från bröstningen.
    const openings = ctx.openingsIn(el.id).map((o) => {
      const op = ctx.params<OpeningParams & { height: number; sill?: number; sillFromWall?: boolean }>(o);
      const sill = openingLift(p, op) + (op.sill ?? 0);
      return { at: op.at, width: holeWidth(op), z0: sill, z1: Math.min(wallTop, sill + op.height + HOLE_EXTRA) };
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
    for (const piece of byWall.get(el.id) ?? []) {
      const z1 = piece.top ? planeRange(piece.top, piece.rings)[1] : piece.height;
      // Under ett bjälklag slutar urtagen vid väggens ovansida.
      const mine = z1 < wallTop ? cuts.map((c) => ({ ...c, z1: Math.min(c.z1, z1) })).filter((c) => c.z1 > c.z0) : cuts;
      solids.push({ id: el.id, rings: piece.rings, z0: base, z1, ...(piece.top ? { top: piece.top } : {}), ...(shear ? { shear } : {}), material, noEdges: true, cuts: mine });
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
        // Öppningen följer väggens lutning (0.10.21).
        return shear ? [q[0] + shear[0] * (z - base), q[1] + shear[1] * (z - base), z] : [q[0], q[1], z];
      };
      for (const side of [-h, h]) {
        seg.segments.push([...pt(s1, side, o.z0), ...pt(s1, side, o.z1)], [...pt(s2, side, o.z0), ...pt(s2, side, o.z1)]);
        if (o.z1 < wallTop - 1) seg.segments.push([...pt(s1, side, o.z1), ...pt(s2, side, o.z1)]);
        if (o.z0 > base + 1) seg.segments.push([...pt(s1, side, o.z0), ...pt(s2, side, o.z0)]);
      }
      for (const s of [s1, s2]) {
        if (o.z1 < wallTop - 1) seg.segments.push([...pt(s, -h, o.z1), ...pt(s, h, o.z1)]);
        if (o.z0 > base + 1) seg.segments.push([...pt(s, -h, o.z0), ...pt(s, h, o.z0)]);
      }
      solids.push(seg);
    }
  }
  return solids;
}

/**
 * Bjälklagen ovanför kapar väggen där de täcker den (0.10.1), som taket
 * gör: delen under ett bjälklag slutar vid dess undersida, resten står
 * kvar. Täcker bjälklaget halva väggens tjocklek kapas halva väggen; ett
 * bjälklag ur väggarna slutar vid ytterväggarnas insida, så de går obrutna
 * golv till golv. Bjälklagen prövas nerifrån, så det lägsta gäller, och
 * bara de vars undersida ligger mellan väggens fot och ovansida. Under ett
 * tak blir ovansidan det som är lägst av taket och bjälklaget.
 */
export function underSlabs(rings: Rings, top: Plane | null, height: number, slabs: readonly SlabCut[], base = 0): { rings: Rings; top: Plane | null; height: number }[] {
  const out: { rings: Rings; top: Plane | null; height: number }[] = [];
  let rest: { rings: Rings; top: Plane | null; height: number }[] = [{ rings, top, height }];
  for (const slab of slabs) {
    if (slab.under <= base + 1) continue;
    const next: typeof rest = [];
    for (const r of rest) {
      const high = r.top ? planeRange(r.top, r.rings)[1] : r.height;
      const lies = slab.under >= high - 1 || !boxesTouch(boxOf(r.rings), slab.box) ? 'out' : cover(r.rings, slab);
      if (lies === 'out') {
        next.push(r);
        continue;
      }
      // Helt under bjälklaget behövs ingen boolesk operation (det vanliga).
      const inside = lies === 'in' ? [r.rings] : intersection(r.rings, [slab.rings]).filter(solidEnough);
      if (!inside.length) {
        next.push(r);
        continue;
      }
      for (const q of inside) {
        if (!r.top) {
          out.push({ rings: q, top: null, height: slab.under });
          continue;
        }
        // Under tak: där taket ligger lägre än bjälklaget står det kvar.
        const below = halfPlaneBelow(r.top, slab.under);
        if (!below) {
          out.push({ rings: q, top: null, height: slab.under });
          continue;
        }
        for (const lo of intersection(q, [below]).filter(solidEnough)) out.push({ rings: lo, top: r.top, height: r.height });
        for (const hi of difference(q, [below]).filter(solidEnough)) out.push({ rings: hi, top: null, height: slab.under });
      }
      if (lies === 'in') continue;
      for (const q of difference(r.rings, [slab.rings]).filter(solidEnough)) next.push({ ...r, rings: q });
    }
    rest = next;
  }
  return [...out, ...rest];
}

/** Ett bjälklag ovanför med dess kanter i ett rutnät, så att det går fort att se om en vägg ligger helt i eller utanför det. */
export interface SlabCut extends SlabAbove {
  box: Box;
  edges: [Vec2, Vec2][];
  index: BoxIndex;
}

const ON = 0.5;

/** Bjälklagen nerifrån, med det som `underSlabs` behöver. */
export function slabCuts(slabs: readonly SlabAbove[]): SlabCut[] {
  return [...slabs]
    .sort((a, b) => a.under - b.under)
    .map((s) => {
      const edges: [Vec2, Vec2][] = s.rings.flatMap((ring) => ring.map((q, i): [Vec2, Vec2] => [q, ring[(i + 1) % ring.length]]));
      const index = new BoxIndex(2000);
      edges.forEach(([a, b], i) => index.add(i, [Math.min(a[0], b[0]) - ON, Math.min(a[1], b[1]) - ON, Math.max(a[0], b[0]) + ON, Math.max(a[1], b[1]) + ON]));
      return { ...s, box: boxOf(s.rings), edges, index };
    });
}

/**
 * Ligger väggbiten helt under bjälklaget, helt utanför eller delvis? Helt
 * i när inget hörn ligger utanför (ett hörn får ligga på kanten, som där en
 * innervägg möter ytterväggens insida) och ingen av bjälklagets kanter går
 * in i biten (en håltagning över väggen); likadant utanför.
 */
function cover(rings: Rings, slab: SlabCut): 'in' | 'out' | 'mixed' {
  if (rings.length !== 1) return 'mixed';
  const ring = rings[0];
  let hasIn = false;
  let hasOut = false;
  for (const q of ring) {
    const c = side(q, slab);
    if (c > 0) hasIn = true;
    else if (c < 0) hasOut = true;
    if (hasIn && hasOut) return 'mixed';
  }
  if (!hasIn && !hasOut) return 'mixed';
  const b = boxOf(rings);
  for (const i of slab.index.near(b)) {
    const [p, q] = slab.edges[i];
    if (enters(p, q, ring)) return 'mixed';
  }
  return hasIn ? 'in' : 'out';
}

/** Om sträckan p–q går in i ringens inre: en ände eller mitten inne i den, eller rakt genom en kant. */
function enters(p: Vec2, q: Vec2, ring: readonly Vec2[]): boolean {
  const deep = (x: Vec2) => pointInRings(x, [ring]) && ring.every((a, i) => distToSegment(x, a, ring[(i + 1) % ring.length]) >= ON);
  if (deep(p) || deep(q) || deep([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2])) return true;
  const d = sub(q, p);
  const l = Math.hypot(d[0], d[1]);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const e = sub(b, a);
    const le = Math.hypot(e[0], e[1]);
    const s1 = cross(e, sub(p, a));
    const s2 = cross(e, sub(q, a));
    const s3 = cross(d, sub(a, p));
    const s4 = cross(d, sub(b, p));
    if (((s1 > ON * le && s2 < -ON * le) || (s1 < -ON * le && s2 > ON * le)) && ((s3 > ON * l && s4 < -ON * l) || (s3 < -ON * l && s4 > ON * l))) return true;
  }
  return false;
}

/** 1 inne i bjälklaget, 0 på dess kant, −1 utanför. */
function side(q: Vec2, slab: SlabCut): number {
  for (const i of slab.index.at(q)) if (distToSegment(q, slab.edges[i][0], slab.edges[i][1]) < ON) return 0;
  return pointInRings(q, slab.rings) ? 1 : -1;
}

/** En bit som är tjockare än en halv millimeter: flisor där bjälklagets kant nästan följer väggens liv räknas inte. */
function solidEnough(rings: Rings): boolean {
  const ring = rings[0];
  if (!ring || ring.length < 3) return false;
  let area = 0;
  let perimeter = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    area += a[0] * b[1] - b[0] * a[1];
    perimeter += dist(a, b);
  }
  return Math.abs(area) / perimeter > 0.5;
}

const BEND = Math.sin((9 * Math.PI) / 180);

/**
 * Väggarnas kantlinjer i 3D. Bitar med samma åtgärd och ovansida slås ihop,
 * så att skarvarna mellan väggar inte syns. Lodräta kanter ritas där
 * väggmassan viker, och där en lägre del möter en högre bara ovanför den
 * lägre. Bågar delas i raka bitar som inte får egna lodräta kanter. Varje
 * kant hör till väggen den kommer ifrån (0.10.1; förut fick alla den första
 * väggens id, så att en markerad vägg lyste upp de andras linjer och
 * bjälklagen inte kapade dem).
 */
function wallEdges(pieces: WallPiece[]): Edges3D[] {
  const topKey = (pc: WallPiece) => (pc.top ? pc.top.map((v) => v.toFixed(6)).join(',') : `h${pc.height}`);
  const groups = new Map<string, { id: string; base: number; shear: Shear | null; zTop: (q: Vec2) => number; pieces: WallPiece[] }>();
  for (const pc of pieces) {
    // Lutande väggar (0.10.21) är egna grupper: deras kanter flyttas med höjden.
    const key = `${pc.action}|${topKey(pc)}|${pc.base}|${pc.shear ? pc.shear.join(',') : ''}`;
    let g = groups.get(key);
    if (!g) {
      const top = pc.top;
      const h = pc.height;
      g = { id: pc.id, base: pc.base, shear: pc.shear, zTop: top ? (q) => zOn(top, q[0], q[1]) : () => h, pieces: [] };
      groups.set(key, g);
    }
    g.pieces.push(pc);
  }
  const merged = [...groups.values()].map((g) => ({ ...g, polys: union(g.pieces.map((pc) => pc.rings)) }));

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

  const byId = new Map<string, Edges3D>();
  const edgesOf = (id: string): Edges3D => {
    let e = byId.get(id);
    if (!e) byId.set(id, (e = { kind: 'edges', id, segments: [], part: 'wall' }));
    return e;
  };
  for (const g of merged) {
    // En grupp med en enda vägg behöver inte delas efter ägare.
    const one = g.pieces.every((pc) => pc.id === g.id);
    const owners = one ? null : edgeOwners(g.pieces);
    // Punkten på höjden z, flyttad som väggen lutar.
    const at = (q: Vec2, z: number): [number, number, number] => (g.shear ? [q[0] + g.shear[0] * (z - g.base), q[1] + g.shear[1] * (z - g.base), z] : [q[0], q[1], z]);
    for (const poly of g.polys) {
      for (const raw of poly) {
        const ring = owners ? raw.flatMap((q, i) => owners.split(q, raw[(i + 1) % raw.length]).slice(0, -1)) : raw;
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i];
          const b = ring[(i + 1) % ring.length];
          const e = edgesOf(owners?.ownerOf(a, b) ?? g.id);
          e.segments.push([...at(a, g.base), ...at(b, g.base)], [...at(a, g.zTop(a)), ...at(b, g.zTop(b))]);
          if (!bends(ring, i)) continue;
          const top = g.zTop(a);
          if (isCorner(a)) e.segments.push([...at(a, g.base), ...at(a, top)]);
          else {
            const from = Math.max(g.base, otherTop(g, a));
            if (top - from > 1) e.segments.push([...at(a, from), ...at(a, top)]);
          }
        }
      }
    }
  }
  return [...byId.values()];
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
