import type { Id } from '../core/model';
import { anchorPoint, boxOfPoints, profileSection, profileValues, type Box2, type PPoint, type ProfileSection, type ProfileTypeModel } from '../core/profileTypes';
import { railNum, type RailingTypeModel, type RailPart } from '../core/railingTypes';
import type { Rings } from '../geometry/boolean';
import { dist, dot, norm, sub } from '../geometry/vec';
import type { Vec2 } from '../repr/primitives';
import { partRegions, placePoint, type EndSpec } from './profileBody';
import { endAxis } from './endProfile';
import { freePath, GATE_POST, pathPoint, pathZ, shift, type RailGate, type RailPath } from './railingGeometry';

/**
 * Räckets delar (0.11.1, bruten ur `railingGeometry.ts` i granskningen
 * efter 0.11.5): typens delar lagda längs linjen (`railingBody`): stolpar på
 * sina stationer, längsgående delar med förlängning, upprepade delar, ytor,
 * plintar (0.11.3) och grindarna som egna kroppar i hålen.
 */

/**
 * En del med en profiltyp (0.11.7): delprofilernas ytor i delens tvärsnitt.
 * För en längsgående del i banans ram (x åt höger om linjen, y uppåt) med
 * origo i tvärsnittets mitt i sidled och i överkanten; för en stolpe eller
 * spjäla i planet med x längs linjen och y utåt, origo i ankaret.
 */
export interface PartSection {
  regions: { polys: Rings[]; follows: boolean; extend: number; material?: string }[];
  /** Avsluten i början och slutet (en längsgående del), uträknade. */
  start?: EndSpec;
  end?: EndSpec;
}

/** Profiltyperna för delar med `profile` (0.11.7): typen och avslutet uträknat (ändprofilen). */
export interface RailProfiles {
  model(id: Id): ProfileTypeModel | undefined;
  end(e: EndSpec, section: ProfileSection, yShift: number, yRange: [number, number], axis?: Vec2): EndSpec;
}

/** En längsgående del: mittlinjen med överkantens höjd och förlängningen i ändarna. */
export interface AlongPiece {
  part: RailPart;
  pts: Vec2[];
  top: number[];
  /** Referenslinjens höjd i punkterna (för planens snitt). */
  z: number[];
  w: number;
  h: number;
  round: boolean;
  /** Förlängningen (mm) i början och slutet. */
  ext: number;
  /** Vilka ändar som förlängs (utelämnad = båda): en bit som slutar vid en grind eller ett trappsteg förlängs inte där. */
  ends?: [boolean, boolean];
  /** Profiltypens tvärsnitt (0.11.7). */
  sec?: PartSection;
  /** Förskjutningen tillbaka till räckets linje (0.11.7.2), med `offsetLine`s tecken: avslutet *Mot vägg* går dit. */
  back?: number;
}

/** En stolpe, en konsol eller en spjäla. */
export interface PostPiece {
  part: RailPart;
  at: Vec2;
  dir: Vec2;
  z0: number;
  z1: number;
  w: number;
  d: number;
  round: boolean;
  /** Markens höjd vid stolpen (0.11.3); det under ritas streckat. */
  ground?: number;
  /** Profiltypens tvärsnitt i planet (0.11.7). */
  sec?: PartSection;
}

/** En yta mellan två punkter längs linjen. */
export interface PanelPiece {
  part: RailPart;
  a: Vec2;
  b: Vec2;
  a0: number;
  a1: number;
  b0: number;
  b1: number;
  t: number;
}

/** En plint under en stolpe (0.11.3). */
export interface FootingPiece {
  part: RailPart;
  at: Vec2;
  z0: number;
  z1: number;
  w: number;
}

/** En grind (0.11.3): hålet längs linjen, bladen och åt vilket håll de öppnas. */
export interface GatePiece {
  gate: RailGate;
  index: number;
  /** Hålmåttets ändar på referenslinjen. */
  a: Vec2;
  b: Vec2;
  /** Bladens nivå (linjens höjd, den högre av ändarna). */
  z: number;
  /** Normalen åt det håll grinden öppnas. */
  out: Vec2;
  /** Bladen, ett per blad (två för par), i stängt läge. */
  leaves: { a: Vec2; b: Vec2; body: RailingBody }[];
  /** Bladens överkant (för förteckningar och 3D). */
  top: number;
}

export interface RailingBody {
  along: AlongPiece[];
  posts: PostPiece[];
  repeats: PostPiece[];
  panels: PanelPiece[];
  footings: FootingPiece[];
  gates: GatePiece[];
}

const emptyBody = (): RailingBody => ({ along: [], posts: [], repeats: [], panels: [], footings: [], gates: [] });

/** Var punkterna ligger längs linjen: jämnt med högst `spacing` mellan, i början och slutet och (med `corners`) i hörnen. */
export function postStations(path: RailPath, spacing: number, corners = true): number[] {
  const cuts = [0];
  if (corners)
    for (let i = 1; i < path.pts.length - 1; i++) {
      const a = sub(path.pts[i], path.pts[i - 1]);
      const b = sub(path.pts[i + 1], path.pts[i]);
      if (Math.hypot(...a) < 1 || Math.hypot(...b) < 1) continue;
      const c = dot(norm(a), norm(b));
      if (c < Math.cos((15 * Math.PI) / 180) && path.s[i] - cuts[cuts.length - 1] > 50) cuts.push(path.s[i]);
    }
  if (path.length - cuts[cuts.length - 1] > 50) cuts.push(path.length);
  else cuts[cuts.length - 1] = path.length;
  const sp = Math.max(100, spacing);
  const out: number[] = [];
  for (let k = 0; k < cuts.length - 1; k++) {
    const a = cuts[k];
    const b = cuts[k + 1];
    const n = Math.max(1, Math.ceil((b - a) / sp - 1e-6));
    for (let j = 0; j < n; j++) out.push(a + ((b - a) * j) / n);
  }
  out.push(path.length);
  return out;
}

const profileOf = (part: RailPart) => {
  const w = Math.max(1, part.profile?.w ?? 40);
  return { w, h: Math.max(1, part.profile?.shape === 'round' ? w : part.profile?.h ?? w), round: part.profile?.shape === 'round' };
};

/** En dels profiltyp placerad: ankaret i origo, vridningen kring det; ytorna, rektangeln och tvärsnittet. */
interface Placed {
  model: ProfileTypeModel;
  section: ProfileSection;
  regions: { polys: Rings[]; follows: boolean; extend: number; material?: string }[];
  box: Box2;
  anchor: PPoint;
  /** Vridningen kring ankaret, grader (för ändprofilen). */
  rotate: number;
}

function placedSection(part: RailPart, vals: ReadonlyMap<string, number>, profiles: RailProfiles | undefined): Placed | null {
  const pr = part.profile;
  if (pr?.shape !== 'profile' || !pr.type || !profiles) return null;
  const model = profiles.model(pr.type);
  if (!model) return null;
  const section = profileSection(model, profileValues(model));
  const a = model.anchors.find((x) => x.no === (pr.anchor ?? model.anchor)) ?? model.anchors[0];
  const anchor = anchorPoint(a, section.box, section.deltas);
  const place = { anchor, rotate: railNum(pr.rotate, vals, 0) };
  const regions = partRegions(section).map((r) => ({
    polys: r.polys.map((poly) => poly.map((ring) => ring.map((q) => placePoint([q[0], q[1]], place) as Vec2))) as Rings[],
    follows: r.part.followsEnd !== false,
    extend: r.part.extend ?? 0,
    ...(r.part.material ? { material: r.part.material } : {}),
  }));
  const box = boxOfPoints(regions.flatMap((r) => r.polys.flatMap((poly) => poly[0] as PPoint[])));
  if (box.maxX - box.minX < 0.5 || box.maxY - box.minY < 0.5) return null;
  return { model, section, regions, box, anchor, rotate: place.rotate };
}

const mapRegions = (regions: Placed['regions'], f: (q: Vec2) => Vec2): Placed['regions'] => regions.map((r) => ({ ...r, polys: r.polys.map((poly) => poly.map((ring) => ring.map(f))) }));

/** Markens höjd längs linjen vid sträckan s (linjens egen höjd utan mark). */
function pathBase(path: RailPath, s: number): number {
  return path.base ? pathZ({ ...path, z: path.base }, s) : pathZ(path, s);
}

/** Linjen mellan sträckorna a och b: ändarna och punkterna emellan, med höjden. */
function subLine(path: RailPath, a: number, b: number): { pts: Vec2[]; z: number[] } {
  const pts: Vec2[] = [pathPoint(path, a).at];
  const z: number[] = [pathZ(path, a)];
  for (let i = 0; i < path.s.length; i++)
    if (path.s[i] > a + 1e-6 && path.s[i] < b - 1e-6) {
      pts.push(path.pts[i]);
      z.push(path.z[i]);
    }
  pts.push(pathPoint(path, b).at);
  z.push(pathZ(path, b));
  return { pts, z };
}

/** Utan punkter mitt på raka bitar (markens täta punkter), för de vågräta facken. */
function straightened(l: { pts: Vec2[]; z: number[] }): { pts: Vec2[]; z: number[] } {
  const keep = l.pts.map((q, i) => {
    if (i === 0 || i === l.pts.length - 1) return true;
    const a = sub(q, l.pts[i - 1]);
    const b = sub(l.pts[i + 1], q);
    const la = Math.hypot(...a);
    const lb = Math.hypot(...b);
    return la > 1e-6 && lb > 1e-6 && dot(a, b) / (la * lb) < Math.cos(0.5 * (Math.PI / 180));
  });
  return { pts: l.pts.filter((_, i) => keep[i]), z: l.z.filter((_, i) => keep[i]) };
}

/** Den högsta höjden längs linjen mellan a och b (det trappstegade facket ligger där). */
function maxZ(path: RailPath, a: number, b: number): number {
  let m = Math.max(pathZ(path, a), pathZ(path, b));
  for (let i = 0; i < path.s.length; i++) if (path.s[i] > a && path.s[i] < b) m = Math.max(m, path.z[i]);
  return m;
}

/** Sträckorna längs linjen utan grindarnas hål. */
function openRuns(length: number, holes: readonly [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  let at = 0;
  for (const [a, b] of [...holes].sort((p, q) => p[0] - q[0])) {
    if (a > at + 1) out.push([at, a]);
    at = Math.max(at, b);
  }
  if (length > at + 1) out.push([at, length]);
  return out;
}

/** Grindens hål, inom linjen. */
export function gateHole(g: RailGate, length: number): [number, number] | null {
  const a = Math.max(0, Math.min(length, g.at));
  const b = Math.max(a, Math.min(length, g.at + Math.max(0, g.width)));
  return b - a > 50 ? [a, b] : null;
}

/** Grindstolparna: en del för stolparna vid en grind. */
const gatePostPart = (w: number): RailPart => ({ id: 'grindstolpe', kind: 'point', name: 'Grindstolpe', profile: { shape: 'rect', w }, detail: 'normal', pen: 'railPost' });

export interface BodyOptions {
  /** Profiltyperna för delar med en profiltyp (0.11.7). */
  profiles?: RailProfiles;
  /** Grindarna längs linjen. */
  gates?: readonly RailGate[];
  /** Grindtypens modell och värden; null = följer staketet. */
  gateModel?: (g: RailGate) => { model: RailingTypeModel; vals: ReadonlyMap<string, number> } | null;
}

/**
 * Typens delar längs linjen. Höjderna är mot linjens höjd (stegnoslinjen,
 * golvet eller marken); stolparna står med jämn delning, spjälorna fördelas
 * mellan stolparna med högst `spacing` öppning, och ytorna fyller
 * mellanrummen. På marken (0.11.3) ligger delar med *Trappstegat* vågrätt i
 * varje fack, på fackets högsta punkt, och stolparna går under mark. Vid en
 * grind står grindstolpar på var sida, och delarna med *Vid grind: Avbryts*
 * slutar där.
 */
export function railingBody(path: RailPath, model: RailingTypeModel, vals: ReadonlyMap<string, number>, opts: BodyOptions = {}): RailingBody {
  const body = emptyBody();
  const num = (v: RailPart['z'], f = 0) => railNum(v, vals, f);
  const pointParts = model.parts.filter((p) => p.kind === 'point');
  const onGround = !!path.base;
  // Stolparnas läge (den första punktdelens), som spjälorna och ytorna fördelas mellan.
  const main = pointParts[0];
  const mainW = main ? profileOf(main).w : 0;
  let stations = main ? postStations(path, num(main.spacing, 1200), main.corners !== false) : [0, path.length];
  // Grindarna: hålen, och grindstolparna i stället för stolparna närmast.
  const gates = (opts.gates ?? []).map((g, index) => ({ g, index, hole: gateHole(g, path.length) })).filter((x): x is { g: RailGate; index: number; hole: [number, number] } => !!x.hole);
  const holes = gates.map((x) => x.hole);
  const widthAt = new Map<number, number>();
  // Stolpar närmare grindstolparna än en tredjedel av delningen (minst 300) tas bort.
  const near = main ? Math.max(300, num(main.spacing, 1200) / 3) : 0;
  for (const { g, hole } of gates) {
    const gp = Math.max(20, g.post ?? GATE_POST);
    stations = stations.filter((s) => s < hole[0] - gp - near || s > hole[1] + gp + near || s < 1 || s > path.length - 1);
    for (const s of [hole[0] - gp / 2, hole[1] + gp / 2]) {
      const c = Math.max(0, Math.min(path.length, s));
      stations.push(c);
      widthAt.set(c, gp);
    }
  }
  stations = [...new Set(stations)].sort((a, b) => a - b);
  const halfAt = (s: number) => (widthAt.get(s) ?? mainW) / 2;
  const inHole = (s: number) => holes.some(([a, b]) => s > a + 1 && s < b - 1);
  const bayIsGate = (k: number) => inHole((stations[k] + stations[k + 1]) / 2);
  const breaks = (part: RailPart) => part.gate !== 'continue';
  // Trappstegat: varje fack på sin högsta punkt.
  const level = stations.slice(0, -1).map((a, k) => maxZ(path, a, stations[k + 1]));
  const stepped = (part: RailPart) => onGround && part.slope === 'stepped';
  const bayOf = (s: number) => {
    let k = 0;
    while (k < stations.length - 2 && stations[k + 1] <= s) k++;
    return k;
  };
  const zFor = (part: RailPart, s: number) => (stepped(part) ? level[bayOf(s)] : pathZ(path, s));
  const at3 = (s: number, off: number) => {
    const q = pathPoint(path, s);
    return { c: shift([q.at, [q.at[0] + q.dir[0], q.at[1] + q.dir[1]]], off, path.inward)[0], dir: q.dir };
  };
  /** En stolpe eller spjäla med en profiltyp (0.11.7): tvärsnittet i planet, x längs linjen och y utåt. */
  const postSec = (placed: Placed | null): PartSection | undefined => (placed ? { regions: mapRegions(placed.regions, (q) => [q[0], q[1] * (path.inward === 1 ? -1 : 1)]) } : undefined);
  /** En stolpe (eller konsol) vid s, med det under mark och plinten. */
  const post = (part: RailPart, s: number, w: number, h: number, round: boolean, off: number, top?: number, sec?: PartSection) => {
    const { c, dir } = at3(s, off);
    const z = pathZ(path, s);
    const from = num(part.from);
    const to = top ?? num(part.to, 900);
    // Ett trappstegat fack: stolpen når det högre facket.
    const z1 = stepped(part) ? Math.max(level[Math.max(0, bayOf(s - 1))], level[bayOf(s + 1)] ?? -Infinity) + to : z + to;
    if (!onGround) {
      body.posts.push({ part, at: c, dir, z0: z + from, z1, w, d: h, round, ...(sec ? { sec } : {}) });
      return;
    }
    const g = pathBase(path, s);
    const depth = Math.max(0, num(part.below?.depth));
    const footing = !!part.below?.footing;
    const z0 = depth > 0 || footing ? g - (depth || (footing ? 100 : 0)) : z + from;
    body.posts.push({ part, at: c, dir, z0, z1, w, d: h, round, ground: g, ...(sec ? { sec } : {}) });
    if (footing) body.footings.push({ part, at: c, z0: g - Math.max(600, depth + 100), z1: g + 50, w: Math.max(250, 3 * w) });
  };
  for (const part of model.parts) {
    const off = num(part.offset);
    // En profiltyp (0.11.7): måtten ur tvärsnittet; en längsgående del läggs med ankaret på överkantens höjd.
    const placed = part.kind !== 'surface' ? placedSection(part, vals, opts.profiles) : null;
    if (part.kind === 'along') {
      let { w, h, round } = profileOf(part);
      let zTop = num(part.z, 900);
      const ext = Math.max(0, num(part.extend));
      let lateral = off;
      let sec: ((ends: [boolean, boolean]) => PartSection) | undefined;
      if (placed) {
        const b = placed.box;
        const cx = (b.minX + b.maxX) / 2;
        const sgn = path.inward === 1 ? 1 : -1;
        w = b.maxX - b.minX;
        h = b.maxY - b.minY;
        round = false;
        lateral = off - cx;
        zTop += b.maxY;
        const regions = mapRegions(placed.regions, (q) => [sgn * (q[0] - cx), q[1] - b.maxY]);
        // Ändprofilens y följer den vridna och speglade y-axeln (0.11.7.3); förskjutningen är (−sgn·cx, −maxY).
        const axis = endAxis(placed.rotate, sgn < 0);
        const ys = regions.flatMap((r) => r.polys.flatMap((poly) => poly.flatMap((ring) => ring.map((q) => q[0] * axis[0] + q[1] * axis[1]))));
        const yr: [number, number] = [Math.min(...ys), Math.max(...ys)];
        const yShift = placed.anchor[1] - (-sgn * cx * axis[0] - b.maxY * axis[1]);
        // Avslutet i en verklig ände: typens (en ändprofil), annars vinkelrätt; i en grind eller ett trappsteg vinkelrätt.
        const kind = placed.model.ends ?? 'square';
        const endAt = (real: boolean): EndSpec => (real && kind === 'profile' && opts.profiles ? opts.profiles.end({ kind, beyond: true, ...(placed.model.endProfile ? { profile: placed.model.endProfile } : {}) }, placed.section, yShift, yr, axis) : { kind: real && kind !== 'profile' ? kind : 'square' });
        sec = (e) => ({ regions, start: endAt(e[0]), end: endAt(e[1]) });
      }
      // Tillbaka till linjen (mot väggen); en del som ligger på linjen går 60 mm utåt.
      const back = lateral ? -lateral * path.inward : -RETURN * path.inward;
      const runs = breaks(part) ? openRuns(path.length, holes) : [[0, path.length] as [number, number]];
      for (const [r0, r1] of runs) {
        if (stepped(part)) {
          // Vågrätt i varje fack; facken är egna bitar.
          for (let k = 0; k < stations.length - 1; k++) {
            if (breaks(part) && bayIsGate(k)) continue;
            const a = Math.max(r0, stations[k]);
            const b = Math.min(r1, stations[k + 1]);
            if (b - a < 1) continue;
            const line = straightened(subLine(path, a, b));
            const ends: [boolean, boolean] = [a < 1, b > path.length - 1];
            body.along.push({ part, pts: shift(line.pts, lateral, path.inward), top: line.pts.map(() => level[k] + zTop), z: line.pts.map(() => level[k]), w, h, round, ext, ends, back, ...(sec ? { sec: sec(ends) } : {}) });
          }
          continue;
        }
        const line = r0 < 1 && r1 > path.length - 1 ? { pts: path.pts, z: path.z } : subLine(path, r0, r1);
        const ends: [boolean, boolean] = [r0 < 1, r1 > path.length - 1];
        body.along.push({ part, pts: shift(line.pts, lateral, path.inward), top: line.z.map((z) => z + zTop), z: line.z, w, h, round, ext, back, ...(r0 > 1 || r1 < path.length - 1 ? { ends } : {}), ...(sec ? { sec: sec(ends) } : {}) });
      }
      continue;
    }
    if (part.kind === 'point') {
      const { w, h, round } = placed ? { w: placed.box.maxX - placed.box.minX, h: placed.box.maxY - placed.box.minY, round: false } : profileOf(part);
      const sec = postSec(placed);
      if (part === main) {
        for (const s of stations) {
          const gw = widthAt.get(s);
          if (gw) post({ ...gatePostPart(gw), ...(part.material ? { material: part.material } : {}), ...(part.below ? { below: part.below } : {}) }, s, gw, gw, false, off, num(part.to, 900));
          else post(part, s, w, h, round, off, undefined, sec);
        }
        continue;
      }
      for (const s of postStations(path, num(part.spacing, 1200), part.corners !== false)) if (!inHole(s)) post(part, s, w, h, round, off, undefined, sec);
      continue;
    }
    const from = num(part.from);
    const to = num(part.to, 900);
    if (part.kind === 'repeat') {
      const { w, h, round } = placed ? { w: placed.box.maxX - placed.box.minX, h: placed.box.maxY - placed.box.minY, round: false } : profileOf(part);
      const sec = postSec(placed);
      const gap = Math.max(10, num(part.spacing, 100));
      for (let k = 0; k < stations.length - 1; k++) {
        if (breaks(part) && bayIsGate(k)) continue;
        const a = stations[k] + halfAt(stations[k]);
        const b = stations[k + 1] - halfAt(stations[k + 1]);
        const room = b - a;
        if (room <= gap) continue;
        // Lika öppningar, högst `gap`: n delar ger n + 1 öppningar.
        const n = Math.ceil((room - gap) / (gap + w) - 1e-6);
        const open = (room - n * w) / (n + 1);
        for (let j = 1; j <= n; j++) {
          const s = a + open * j + w * (j - 0.5);
          const { c, dir } = at3(s, off);
          // Spjälorna står lodrätt; höjden mäts mitt på spjälan.
          const z = zFor(part, s);
          body.repeats.push({ part, at: c, dir, z0: z + from, z1: z + to, w, d: h, round, ...(sec ? { sec } : {}) });
        }
      }
      continue;
    }
    // En yta i varje mellanrum, delad i linjens brytpunkter.
    const t = Math.max(1, part.thickness ?? 10);
    for (let k = 0; k < stations.length - 1; k++) {
      if (breaks(part) && bayIsGate(k)) continue;
      const a = stations[k] + (main ? halfAt(stations[k]) + 10 : 0);
      const b = stations[k + 1] - (main ? halfAt(stations[k + 1]) + 10 : 0);
      if (b - a < 20) continue;
      const cuts = [a, ...path.s.filter((s) => s > a + 1 && s < b - 1), b];
      for (let j = 0; j < cuts.length - 1; j++) {
        const pa = pathPoint(path, cuts[j]).at;
        const pb = pathPoint(path, cuts[j + 1]).at;
        if (dist(pa, pb) < 5) continue;
        const [sa, sb] = shift([pa, pb], off, path.inward);
        const za = stepped(part) ? level[k] : pathZ(path, cuts[j]);
        const zb = stepped(part) ? level[k] : pathZ(path, cuts[j + 1]);
        body.panels.push({ part, a: sa, b: sb, a0: za + from, a1: za + to, b0: zb + from, b1: zb + to, t });
      }
    }
  }
  for (const { g, index, hole } of gates) body.gates.push(gatePiece(path, model, vals, g, index, hole, opts));
  return body;
}

/** Grindens blad i stängt läge, med grindtypens delar eller staketets. */
function gatePiece(path: RailPath, fence: RailingTypeModel, fenceVals: ReadonlyMap<string, number>, g: RailGate, index: number, hole: [number, number], opts: BodyOptions): GatePiece {
  const a = pathPoint(path, hole[0]).at;
  const b = pathPoint(path, hole[1]).at;
  const z = Math.max(pathZ(path, hole[0]), pathZ(path, hole[1]));
  const d = norm(sub(b, a));
  const left: Vec2 = [-d[1], d[0]];
  // Utåt: bort från räckets insida.
  const sign = (g.swing === 'in' ? 1 : -1) * path.inward;
  const out: Vec2 = [left[0] * sign, left[1] * sign];
  const typed = g.type && !g.own ? opts.gateModel?.(g) : null;
  let model: RailingTypeModel;
  let vals: ReadonlyMap<string, number>;
  if (typed) {
    model = typed.model;
    vals = typed.vals;
  } else {
    // Följer staketet: staketets delar som avbryts vid grinden, med smala sidstycken i stället för stolparna.
    model = { ...fence, parts: fence.parts.filter((p) => p.kind === 'point' || p.gate !== 'continue').map((p) => (p.kind === 'point' ? { ...p, profile: { shape: 'rect' as const, w: Math.min(45, p.profile?.w ?? 45) }, below: undefined, spacing: 1e9, corners: false } : p.kind === 'along' ? { ...p, extend: 0, finish: undefined } : p)) };
    vals = fenceVals;
    if (g.own && g.height && fence.params[0]) vals = new Map([...fenceVals, [fence.params[0].name, g.height]]);
  }
  if (typed) model = { ...model, parts: model.parts.map((p) => (p.kind === 'point' ? { ...p, spacing: 1e9, corners: false, below: undefined } : p.kind === 'along' ? { ...p, extend: 0, finish: undefined } : p)) };
  const gap = 10;
  const len = dist(a, b);
  const spans: [number, number][] = g.hang === 'pair' ? [[gap, len / 2 - gap / 2], [len / 2 + gap / 2, len - gap]] : [[gap, len - gap]];
  const leaves = spans
    .filter(([s0, s1]) => s1 - s0 > 50)
    .map(([s0, s1]) => {
      const la: Vec2 = [a[0] + d[0] * s0, a[1] + d[1] * s0];
      const lb: Vec2 = [a[0] + d[0] * s1, a[1] + d[1] * s1];
      const lp = freePath({ line: [[la[0], la[1]], [lb[0], lb[1]]], z: [z, z] });
      return { a: la, b: lb, body: lp ? railingBody(lp, model, vals, opts.profiles ? { profiles: opts.profiles } : {}) : emptyBody() };
    });
  let top = z;
  for (const l of leaves) for (const q of [...l.body.posts, ...l.body.repeats]) top = Math.max(top, q.z1);
  for (const l of leaves) for (const q of l.body.along) top = Math.max(top, ...q.top);
  return { gate: g, index, a, b, z, out, leaves, top };
}

/** Mittlinjen för en längsgående del med förlängningen i ändarna (vågrät, i linjens riktning). */
export function withExtension(a: AlongPiece): { pts: Vec2[]; top: number[]; z: number[] } {
  if (a.ext <= 0 || a.pts.length < 2) return { pts: a.pts, top: a.top, z: a.z };
  const [e0, e1] = a.ends ?? [true, true];
  if (!e0 && !e1) return { pts: a.pts, top: a.top, z: a.z };
  const n = a.pts.length;
  let i = 1;
  while (i < n - 1 && dist(a.pts[0], a.pts[i]) < 1e-6) i++;
  let j = n - 2;
  while (j > 0 && dist(a.pts[n - 1], a.pts[j]) < 1e-6) j--;
  const d0 = norm(sub(a.pts[0], a.pts[i]));
  const d1 = norm(sub(a.pts[n - 1], a.pts[j]));
  const start: Vec2 = [a.pts[0][0] + d0[0] * a.ext, a.pts[0][1] + d0[1] * a.ext];
  const end: Vec2 = [a.pts[n - 1][0] + d1[0] * a.ext, a.pts[n - 1][1] + d1[1] * a.ext];
  const wrap = (v: number[]) => [...(e0 ? [v[0]] : []), ...v, ...(e1 ? [v[n - 1]] : [])];
  return { pts: [...(e0 ? [start] : []), ...a.pts, ...(e1 ? [end] : [])], top: wrap(a.top), z: wrap(a.z) };
}

/** Avslutet *Böjd nedåt* går så långt ned under delen, och *Mot vägg* så långt utåt när delen ligger på linjen (mm). */
export const DROP = 100;
export const RETURN = 60;

/**
 * Ett avslut på en längsgående del (0.11.7.2): *Böjd nedåt* lodrätt ned
 * från änden, *Mot vägg* vågrätt tillbaka till räckets linje. `ring` är
 * avslutet ovanifrån (för *Mot vägg* en rektangel från änden till linjen,
 * för *Böjd nedåt* delens tvärsnitt i änden), `top` överkantens höjd i
 * änden och `z0` avslutets undersida.
 */
export interface FinishPiece {
  kind: 'down' | 'wall';
  at: Vec2;
  to: Vec2;
  ring: Vec2[];
  top: number;
  z0: number;
  /** Referenslinjens höjd i änden (för planens snitt). */
  z: number;
}

/** Avsluten i delens verkliga ändar (inte vid grindar och trappsteg); en del med en profiltyp har sina egna avslut. */
export function alongFinishes(a: AlongPiece): FinishPiece[] {
  const kind = a.part.finish;
  if (a.sec || (kind !== 'down' && kind !== 'wall')) return [];
  const ext = withExtension(a);
  const pts = ext.pts;
  const n = pts.length;
  if (n < 2) return [];
  const [e0, e1] = a.ends ?? [true, true];
  const out: FinishPiece[] = [];
  const at = (i: number, j: number) => {
    const p = pts[i];
    // Framåt längs linjen (offsetLine räknar normalen så), och utåt från änden.
    const f = i === 0 ? norm(sub(pts[j], p)) : norm(sub(p, pts[j]));
    const outward: Vec2 = i === 0 ? [-f[0], -f[1]] : f;
    if (!Number.isFinite(f[0]) || (f[0] === 0 && f[1] === 0)) return;
    const top = ext.top[i];
    const half = a.w / 2;
    if (kind === 'down') {
      const ring: Vec2[] = a.round
        ? Array.from({ length: 8 }, (_, k): Vec2 => [p[0] + half * Math.cos((k * Math.PI) / 4 + Math.PI / 8), p[1] + half * Math.sin((k * Math.PI) / 4 + Math.PI / 8)])
        : [
            [p[0] - f[0] * half - f[1] * half, p[1] - f[1] * half + f[0] * half],
            [p[0] + f[0] * half - f[1] * half, p[1] + f[1] * half + f[0] * half],
            [p[0] + f[0] * half + f[1] * half, p[1] + f[1] * half - f[0] * half],
            [p[0] - f[0] * half + f[1] * half, p[1] - f[1] * half - f[0] * half],
          ];
      out.push({ kind, at: p, to: p, ring, top, z0: top - a.h - DROP, z: ext.z[i] });
      return;
    }
    const back = a.back ?? 0;
    if (Math.abs(back) < half + 1) return;
    const nrm: Vec2 = [-f[1], f[0]];
    const to: Vec2 = [p[0] + nrm[0] * back, p[1] + nrm[1] * back];
    // Rektangeln från delens mitt (bakåt längs linjen ett halvt tvärsnitt, så att hörnet täcks) till linjen.
    const s = Math.sign(back);
    const a0: Vec2 = [p[0] - outward[0] * half - nrm[0] * s * half, p[1] - outward[1] * half - nrm[1] * s * half];
    const a1: Vec2 = [p[0] + outward[0] * half - nrm[0] * s * half, p[1] + outward[1] * half - nrm[1] * s * half];
    const ring: Vec2[] = [a0, a1, [a1[0] + nrm[0] * (back + s * half), a1[1] + nrm[1] * (back + s * half)], [a0[0] + nrm[0] * (back + s * half), a0[1] + nrm[1] * (back + s * half)]];
    out.push({ kind, at: p, to, ring, top, z0: top - a.h, z: ext.z[i] });
  };
  if (e0) {
    let j = 1;
    while (j < n - 1 && dist(pts[0], pts[j]) < 1e-6) j++;
    at(0, j);
  }
  if (e1) {
    let j = n - 2;
    while (j > 0 && dist(pts[n - 1], pts[j]) < 1e-6) j--;
    at(n - 1, j);
  }
  return out;
}
