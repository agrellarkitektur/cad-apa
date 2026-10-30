import { railNum, type RailingTypeModel, type RailPart } from '../core/railingTypes';
import { dist, dot, norm, sub } from '../geometry/vec';
import type { Vec2 } from '../repr/primitives';
import { flatLine, offsetLine } from './groundLines';
import { sideBetween, type StairGeometry } from './stairGeometry';

/**
 * Räckets geometri (0.11.1), ren räkning utan ritning. Räcket har en
 * referenslinje med punkter i X, Y och Z: ritad fritt (Z per punkt, mot
 * våningens golv) eller längs en kant på en trappa, där höjden mäts lodrätt
 * från stegnoslinjen. Vid kilstegen är linjen *Utjämnad* (rak lutning längs
 * kanten genom loppet, förval) eller *Hoppande* (exakt höjd över varje
 * stegnos). Övergången mellan lutning och plant är en krök (R 150) eller
 * ett knäck. Delarna (stolpar, liggare, spjälor, ytor) läggs längs linjen
 * med typens mått (`railingBody`).
 */

/** Kanten räcket hänger på; trappan är elementets `host`. */
export interface RailingHost {
  /** Trappans kant, sett i gångriktningen. */
  side: 'left' | 'right';
  /** Var längs gånglinjen räcket börjar och slutar (mm); utelämnat = hela trappan. */
  from?: number;
  to?: number;
}

export interface RailingParams {
  /** Den ritade referenslinjen (mm); utelämnad när räcket hänger på en trappa. */
  line?: [number, number][];
  bulges?: number[];
  /** Höjden i varje punkt mot våningens golv (mm); utelämnad = 0. */
  z?: number[];
  /** Kopplat till en trappas kant: följer trappan. */
  host?: RailingHost;
  /** Läge mot kanten: innanför (förval på en trappa), på kanten (förval ritat) eller utanpå. */
  place?: 'inside' | 'on' | 'outside';
  /** Avståndet från kanten innanför eller utanpå, mm (50 från början). */
  inset?: number;
  /** Räckets egna värden för typens parametrar som får ändras per räcke. */
  values?: Record<string, number>;
  /** Vid kilstegen: utjämnad (utelämnad) eller hoppande. */
  winder?: 'stepped';
  /** Övergången lutning–plan: krök (utelämnad) eller knäck. */
  transition?: 'knee';
  /** Varningar som kvitterats. */
  ack?: string[];
  /**
   * Höjden från (0.11.3, på Platsen): den färdiga marken (utelämnad; `z` är
   * då höjden över marken) eller fast (`z` mot ±0, t.ex. längs stödmurens krön).
   */
  heightFrom?: 'fixed';
  /** Grindarna (0.11.3): sträckor i räcket. */
  gates?: RailGate[];
}

/**
 * En grind (0.11.3, tavla 5): en sträcka i räcket. Längsgående delar (och de
 * andra med *Vid grind: Avbryts*) avbryts där, och grindstolpar står på var
 * sida. Bladet är grindtypens delar, eller staketets (*Följer staketet*).
 */
export interface RailGate {
  id: string;
  /** Var hålmåttet börjar längs räckets linje, mm. */
  at: number;
  /** Hålmåttet, mm. */
  width: number;
  /** Grindtypen (G01 …); utelämnad = följer staketet. */
  type?: string;
  /** *Eget här*: bladet som staketet men med egen höjd och littera. */
  own?: boolean;
  /** Bladets höjd (Eget här), mm. */
  height?: number;
  /** Hängning: vänster (förval), höger, par eller skjut, sett i linjens riktning. */
  hang?: 'right' | 'pair' | 'slide';
  /** Öppnas inåt (mot räckets insida); utelämnad = utåt. */
  swing?: 'in';
  /** Öppningsvinkeln i planen, grader (förval 90). */
  angle?: number;
  /** Grindstolparnas sida, mm (förval 100). */
  post?: number;
  /** Lås och stopp, fritt (t.ex. Regel, markstopp). */
  lock?: string;
  /** Egen littera (Eget här och Följer staketet); en grindtyp ger sin. */
  littera?: string;
}

export const GATE_POST = 100;
export const GROUND_STEP = 250;

export const RAIL_INSET = 50;
export const BEND_RADIUS = 150;

/** Räckets referenslinje i 3D: punkterna i planen, höjden (mot våningens golv) och sträckan längs linjen. */
export interface RailPath {
  pts: Vec2[];
  z: number[];
  s: number[];
  length: number;
  /** Åt vilket håll *inåt* ligger: 1 = vänster om linjen, −1 = höger. */
  inward: 1 | -1;
  /** Utjämnad vid kilsteg: största avvikelsen från höjden över stegnosen (mm). */
  winderDeviation?: number;
  /**
   * Marken under linjen i varje punkt (0.11.3, på Platsen eller på
   * sluttningen i förhandsvisningen): där gäller *Trappstegat* och stolparna
   * går under mark.
   */
  base?: number[];
}

/** En punkt i höjdprofilen: sträckan längs kanten och höjden. */
interface Prof {
  e: number;
  z: number;
  /** Ett steg mitt i ett lopp (inte första eller sista). */
  inner?: boolean;
}

/** Höjden längs profilen vid e (rak mellan punkterna, plant utanför). */
function zAt(prof: readonly Prof[], e: number): number {
  if (!prof.length) return 0;
  if (e <= prof[0].e) return prof[0].z;
  for (let i = 1; i < prof.length; i++) {
    const a = prof[i - 1];
    const b = prof[i];
    if (e <= b.e) return b.e - a.e < 1e-9 ? b.z : a.z + ((b.z - a.z) * (e - a.e)) / (b.e - a.e);
  }
  return prof[prof.length - 1].z;
}

/**
 * Stegnoslinjen längs gånglinjen: nosen på varje steg, planen plana till
 * där nästa lopps lutning möter dem, och golvet ovanför i slutet. `u` är
 * sträckan längs gånglinjen, `z` höjden från trappans fot.
 */
export function nosingLine(g: StairGeometry): { u: number; z: number; inner?: boolean }[] {
  const out: { u: number; z: number; inner?: boolean }[] = [];
  const goingOf = (k: number) => {
    for (let j = k + 1; j < g.items.length; j++) if (g.items[j].kind === 'tread') return g.runs[g.items[j].run ?? 0]?.going ?? 0;
    return 0;
  };
  g.items.forEach((it, k) => {
    if (it.kind === 'tread') {
      const prev = g.items[k - 1];
      const next = g.items[k + 1];
      const inner = prev?.kind === 'tread' && prev.run === it.run && next?.kind === 'tread' && next.run === it.run;
      out.push({ u: it.u0, z: it.z, ...(inner ? { inner } : {}) });
      return;
    }
    const until = it.kind === 'endTread' ? it.u1 : Math.max(it.u0, it.u1 - goingOf(k));
    out.push({ u: it.u0, z: it.z }, { u: until, z: it.z });
  });
  const last = g.items[g.items.length - 1];
  if (!last || last.kind !== 'endTread') out.push({ u: g.length, z: g.rise });
  return out.filter((q, i) => i === 0 || q.u >= out[i - 1].u - 1e-6);
}

/** Sträckan längs en kant vid u. */
const edgeAt = (g: StairGeometry, side: 'left' | 'right', u: number) => (side === 'left' ? g.ribAt(u).lp : g.ribAt(u).rp);

/** Höjdprofilen längs en kant, utjämnad (loppens inre steg utelämnade) eller hoppande. */
function edgeProfile(g: StairGeometry, side: 'left' | 'right', stepped: boolean): { prof: Prof[]; exact: Prof[] } {
  const exact = nosingLine(g).map((q): Prof => ({ e: edgeAt(g, side, q.u), z: q.z, ...(q.inner ? { inner: true } : {}) }));
  const prof = stepped ? exact : exact.filter((q) => !q.inner);
  return { prof, exact };
}

/** Kurvor i höjdled där lutningen ändras: en krök med radien `r` (mm), som korta raka bitar. */
function bendProfile(prof: readonly Prof[], r: number): Prof[] {
  if (prof.length < 3 || r <= 0) return [...prof];
  const out: Prof[] = [prof[0]];
  for (let i = 1; i < prof.length - 1; i++) {
    const a = prof[i - 1];
    const b = prof[i];
    const c = prof[i + 1];
    const l1 = b.e - a.e;
    const l2 = c.e - b.e;
    if (l1 < 1 || l2 < 1) {
      out.push(b);
      continue;
    }
    const m1 = (b.z - a.z) / l1;
    const m2 = (c.z - b.z) / l2;
    const turn = Math.abs(Math.atan(m2) - Math.atan(m1));
    if (turn < 0.01) {
      out.push(b);
      continue;
    }
    // Tangentlängden i planen, högst halva bitarna på var sida.
    const t = r * Math.tan(turn / 2);
    const d1 = Math.min(l1 / 2, t / Math.sqrt(1 + m1 * m1));
    const d2 = Math.min(l2 / 2, t / Math.sqrt(1 + m2 * m2));
    const p0 = { e: b.e - d1, z: b.z - m1 * d1 };
    const p2 = { e: b.e + d2, z: b.z + m2 * d2 };
    for (let k = 0; k <= 6; k++) {
      const s = k / 6;
      const w0 = (1 - s) * (1 - s);
      const w1 = 2 * s * (1 - s);
      const w2 = s * s;
      out.push({ e: w0 * p0.e + w1 * b.e + w2 * p2.e, z: w0 * p0.z + w1 * b.z + w2 * p2.z });
    }
  }
  out.push(prof[prof.length - 1]);
  return out;
}

/** Punkten vid sträckan s längs en linje (med dess sträckor `cum`). */
function pointAt(pts: readonly Vec2[], cum: readonly number[], s: number): Vec2 {
  if (s <= 0) return pts[0];
  for (let i = 1; i < pts.length; i++) {
    if (s <= cum[i]) {
      const l = cum[i] - cum[i - 1];
      const t = l < 1e-9 ? 0 : (s - cum[i - 1]) / l;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
    }
  }
  return pts[pts.length - 1];
}

const cumOf = (pts: readonly Vec2[]): number[] => {
  const out = [0];
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + dist(pts[i - 1], pts[i]));
  return out;
};

/**
 * Linjen i 3D ur punkterna i planen och höjdprofilen (sträckan längs linjen
 * börjar på `e0`): en punkt i varje hörn och i varje brytpunkt i profilen.
 * Samma sträcka två gånger (ett hopp vid det inre hörnet i en kilstegssväng)
 * ger två punkter på samma ställe.
 */
function sample(pts: readonly Vec2[], prof: readonly Prof[], e0: number): { pts: Vec2[]; z: number[]; s: number[] } {
  const cum = cumOf(pts);
  const L = cum[cum.length - 1];
  const at: { s: number; z?: number }[] = cum.map((s) => ({ s }));
  for (const q of prof) {
    const s = q.e - e0;
    if (s > 1e-6 && s < L - 1e-6) at.push({ s, z: q.z });
  }
  at.sort((a, b) => a.s - b.s);
  const out = { pts: [] as Vec2[], z: [] as number[], s: [] as number[] };
  for (const a of at) {
    const z = a.z ?? zAt(prof, a.s + e0);
    const n = out.s.length;
    if (n && Math.abs(out.s[n - 1] - a.s) < 1e-3 && Math.abs(out.z[n - 1] - z) < 0.5) continue;
    out.pts.push(pointAt(pts, cum, a.s));
    out.z.push(z);
    out.s.push(a.s);
  }
  return out;
}

/** Hur långt räcket ligger från kanten, med tecken (positivt inåt). */
export function placeOffset(p: Pick<RailingParams, 'place' | 'inset' | 'host'>): number {
  const place = p.place ?? (p.host ? 'inside' : 'on');
  const d = p.inset ?? RAIL_INSET;
  return place === 'inside' ? d : place === 'outside' ? -d : 0;
}

/** Linjen förskjuten d mm inåt, med samma antal punkter (höjderna följer). */
function shift(pts: readonly Vec2[], d: number, inward: 1 | -1): Vec2[] {
  if (!d) return pts.map((q): Vec2 => [q[0], q[1]]);
  // Punkter på samma ställe (ett hopp i höjd) förskjuts en gång och delar läget.
  const idx: number[] = [];
  const uniq: Vec2[] = [];
  for (const q of pts) {
    if (!uniq.length || dist(q, uniq[uniq.length - 1]) > 1e-6) uniq.push(q);
    idx.push(uniq.length - 1);
  }
  if (uniq.length < 2) return pts.map((q): Vec2 => [q[0], q[1]]);
  const moved = offsetLine(uniq, d * inward);
  return idx.map((i) => moved[i]);
}

/** Räcket längs en trappas kant, mellan `from` och `to` längs gånglinjen. Höjderna räknas från trappans fot. */
export function hostedPath(g: StairGeometry, p: RailingParams, host: RailingHost): RailPath | null {
  const u0 = Math.max(0, Math.min(g.length, host.from ?? 0));
  const u1 = Math.max(u0, Math.min(g.length, host.to ?? g.length));
  if (u1 - u0 < 10) return null;
  const edge = sideBetween(g, host.side, u0, u1).filter((q, i, a) => i === 0 || dist(q, a[i - 1]) > 1e-6);
  if (edge.length < 2) return null;
  const { prof, exact } = edgeProfile(g, host.side, p.winder === 'stepped');
  const shaped = p.transition === 'knee' ? prof : bendProfile(prof, BEND_RADIUS);
  const e0 = edgeAt(g, host.side, u0);
  const out = sample(edge, shaped, e0);
  const inward: 1 | -1 = host.side === 'left' ? -1 : 1;
  let dev = 0;
  if (p.winder !== 'stepped') for (const q of exact) if (q.inner) dev = Math.max(dev, Math.abs(zAt(prof, q.e) - q.z));
  const pts = shift(out.pts, placeOffset({ ...p, host }), inward);
  const s = cumOf(pts);
  return { pts, z: out.z, s, length: s[s.length - 1], inward, ...(dev > 0.5 ? { winderDeviation: dev } : {}) };
}

/** Markens höjd i en punkt (mm mot räckets våning), eller null utanför markmodellen. */
export type GroundFn = (at: Vec2) => number | null;

/**
 * Det ritade räcket: referenslinjen med bågar, höjden i varje punkt. Med
 * marken (0.11.3, på Platsen) är höjden i punkterna höjden över den färdiga
 * marken, och linjen följer marken med en punkt var 250 mm.
 */
export function freePath(p: RailingParams, ground?: GroundFn | null): RailPath | null {
  const line = p.line ?? [];
  if (line.length < 2) return null;
  const flat = flatLine(line, p.bulges);
  const pts = flat.points.filter((q, i, a) => i === 0 || dist(q, a[i - 1]) > 1e-6);
  if (pts.length < 2) return null;
  const cum = cumOf(flat.points);
  const prof: Prof[] = line.map((_, i) => ({ e: cum[flat.at[i]] ?? 0, z: Number(p.z?.[i]) || 0 }));
  if (ground && p.heightFrom !== 'fixed') return onGround(pts, prof, p, ground);
  const shaped = p.transition === 'knee' ? prof : bendProfile(prof, BEND_RADIUS);
  const out = sample(pts, shaped, 0);
  const moved = shift(out.pts, placeOffset(p), 1);
  const s = cumOf(moved);
  return { pts: moved, z: out.z, s, length: s[s.length - 1], inward: 1 };
}

/** Linjen på marken: tätt med punkter, höjden = marken + höjden över marken i punkterna. */
function onGround(pts: readonly Vec2[], prof: readonly Prof[], p: RailingParams, ground: GroundFn): RailPath {
  const cum = cumOf(pts);
  const dense: Vec2[] = [pts[0]];
  const es: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    const l = cum[i] - cum[i - 1];
    const n = Math.max(1, Math.ceil(l / GROUND_STEP));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      dense.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]);
      es.push(cum[i - 1] + l * t);
    }
  }
  const moved = shift(dense, placeOffset(p), 1);
  let lastG = 0;
  const base = moved.map((q) => {
    const g = ground(q);
    if (g !== null && Number.isFinite(g)) lastG = g;
    return g ?? lastG;
  });
  const z = base.map((b, i) => b + zAt(prof, es[i]));
  const s = cumOf(moved);
  return { pts: moved, z, s, length: s[s.length - 1], inward: 1, base };
}

/** Höjden längs linjen vid sträckan s. */
export function pathZ(path: RailPath, s: number): number {
  const { s: S, z } = path;
  if (s <= S[0]) return z[0];
  for (let i = 1; i < S.length; i++) {
    if (s <= S[i]) {
      const l = S[i] - S[i - 1];
      return l < 1e-9 ? z[i] : z[i - 1] + ((z[i] - z[i - 1]) * (s - S[i - 1])) / l;
    }
  }
  return z[z.length - 1];
}

/** Punkten och riktningen längs linjen vid sträckan s. */
export function pathPoint(path: RailPath, s: number): { at: Vec2; dir: Vec2 } {
  const { pts, s: S } = path;
  let i = 1;
  while (i < S.length - 1 && S[i] < s) i++;
  // Riktningen ur den närmaste biten med längd.
  let a = i - 1;
  let b = i;
  while (b < pts.length - 1 && dist(pts[a], pts[b]) < 1e-6) b++;
  while (a > 0 && dist(pts[a], pts[b]) < 1e-6) a--;
  return { at: pointAt(pts, S, s), dir: norm(sub(pts[b], pts[a])) };
}

// ---------- Delarna ----------

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

export const emptyBody = (): RailingBody => ({ along: [], posts: [], repeats: [], panels: [], footings: [], gates: [] });

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

/** Markens höjd längs linjen vid sträckan s (linjens egen höjd utan mark). */
export function pathBase(path: RailPath, s: number): number {
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
  /** En stolpe (eller konsol) vid s, med det under mark och plinten. */
  const post = (part: RailPart, s: number, w: number, h: number, round: boolean, off: number, top?: number) => {
    const { c, dir } = at3(s, off);
    const z = pathZ(path, s);
    const from = num(part.from);
    const to = top ?? num(part.to, 900);
    // Ett trappstegat fack: stolpen når det högre facket.
    const z1 = stepped(part) ? Math.max(level[Math.max(0, bayOf(s - 1))], level[bayOf(s + 1)] ?? -Infinity) + to : z + to;
    if (!onGround) {
      body.posts.push({ part, at: c, dir, z0: z + from, z1, w, d: h, round });
      return;
    }
    const g = pathBase(path, s);
    const depth = Math.max(0, num(part.below?.depth));
    const footing = !!part.below?.footing;
    const z0 = depth > 0 || footing ? g - (depth || (footing ? 100 : 0)) : z + from;
    body.posts.push({ part, at: c, dir, z0, z1, w, d: h, round, ground: g });
    if (footing) body.footings.push({ part, at: c, z0: g - Math.max(600, depth + 100), z1: g + 50, w: Math.max(250, 3 * w) });
  };
  for (const part of model.parts) {
    const off = num(part.offset);
    if (part.kind === 'along') {
      const { w, h, round } = profileOf(part);
      const zTop = num(part.z, 900);
      const ext = Math.max(0, num(part.extend));
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
            body.along.push({ part, pts: shift(line.pts, off, path.inward), top: line.pts.map(() => level[k] + zTop), z: line.pts.map(() => level[k]), w, h, round, ext, ends: [a < 1, b > path.length - 1] });
          }
          continue;
        }
        const line = r0 < 1 && r1 > path.length - 1 ? { pts: path.pts, z: path.z } : subLine(path, r0, r1);
        body.along.push({ part, pts: shift(line.pts, off, path.inward), top: line.z.map((z) => z + zTop), z: line.z, w, h, round, ext, ...(r0 > 1 || r1 < path.length - 1 ? { ends: [r0 < 1, r1 > path.length - 1] as [boolean, boolean] } : {}) });
      }
      continue;
    }
    if (part.kind === 'point') {
      const { w, h, round } = profileOf(part);
      if (part === main) {
        for (const s of stations) {
          const gw = widthAt.get(s);
          if (gw) post({ ...gatePostPart(gw), ...(part.material ? { material: part.material } : {}), ...(part.below ? { below: part.below } : {}) }, s, gw, gw, false, off, num(part.to, 900));
          else post(part, s, w, h, round, off);
        }
        continue;
      }
      for (const s of postStations(path, num(part.spacing, 1200), part.corners !== false)) if (!inHole(s)) post(part, s, w, h, round, off);
      continue;
    }
    const from = num(part.from);
    const to = num(part.to, 900);
    if (part.kind === 'repeat') {
      const { w, h, round } = profileOf(part);
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
          body.repeats.push({ part, at: c, dir, z0: z + from, z1: z + to, w, d: h, round });
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
    model = { ...fence, parts: fence.parts.filter((p) => p.kind === 'point' || p.gate !== 'continue').map((p) => (p.kind === 'point' ? { ...p, profile: { shape: 'rect' as const, w: Math.min(45, p.profile?.w ?? 45) }, below: undefined, spacing: 1e9, corners: false } : p.kind === 'along' ? { ...p, extend: 0 } : p)) };
    vals = fenceVals;
    if (g.own && g.height && fence.params[0]) vals = new Map([...fenceVals, [fence.params[0].name, g.height]]);
  }
  if (typed) model = { ...model, parts: model.parts.map((p) => (p.kind === 'point' ? { ...p, spacing: 1e9, corners: false, below: undefined } : p.kind === 'along' ? { ...p, extend: 0 } : p)) };
  const gap = 10;
  const len = dist(a, b);
  const spans: [number, number][] = g.hang === 'pair' ? [[gap, len / 2 - gap / 2], [len / 2 + gap / 2, len - gap]] : [[gap, len - gap]];
  const leaves = spans
    .filter(([s0, s1]) => s1 - s0 > 50)
    .map(([s0, s1]) => {
      const la: Vec2 = [a[0] + d[0] * s0, a[1] + d[1] * s0];
      const lb: Vec2 = [a[0] + d[0] * s1, a[1] + d[1] * s1];
      const lp = freePath({ line: [[la[0], la[1]], [lb[0], lb[1]]], z: [z, z] });
      return { a: la, b: lb, body: lp ? railingBody(lp, model, vals) : emptyBody() };
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
