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
}

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

/** Det ritade räcket: referenslinjen med bågar, höjden i varje punkt. */
export function freePath(p: RailingParams): RailPath | null {
  const line = p.line ?? [];
  if (line.length < 2) return null;
  const flat = flatLine(line, p.bulges);
  const pts = flat.points.filter((q, i, a) => i === 0 || dist(q, a[i - 1]) > 1e-6);
  if (pts.length < 2) return null;
  const cum = cumOf(flat.points);
  const prof: Prof[] = line.map((_, i) => ({ e: cum[flat.at[i]] ?? 0, z: Number(p.z?.[i]) || 0 }));
  const shaped = p.transition === 'knee' ? prof : bendProfile(prof, BEND_RADIUS);
  const out = sample(pts, shaped, 0);
  const moved = shift(out.pts, placeOffset(p), 1);
  const s = cumOf(moved);
  return { pts: moved, z: out.z, s, length: s[s.length - 1], inward: 1 };
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
  w: number;
  h: number;
  round: boolean;
  /** Förlängningen (mm) i början och slutet. */
  ext: number;
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

export interface RailingBody {
  along: AlongPiece[];
  posts: PostPiece[];
  repeats: PostPiece[];
  panels: PanelPiece[];
}

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

/**
 * Typens delar längs linjen. Höjderna är mot linjens höjd (stegnoslinjen
 * eller golvet); stolparna står med jämn delning, spjälorna fördelas mellan
 * stolparna med högst `spacing` öppning, och ytorna fyller mellanrummen.
 */
export function railingBody(path: RailPath, model: RailingTypeModel, vals: ReadonlyMap<string, number>): RailingBody {
  const body: RailingBody = { along: [], posts: [], repeats: [], panels: [] };
  const num = (v: RailPart['z'], f = 0) => railNum(v, vals, f);
  const pointParts = model.parts.filter((p) => p.kind === 'point');
  // Stolparnas läge (den första punktdelens), som spjälorna och ytorna fördelas mellan.
  const main = pointParts[0];
  const mainW = main ? profileOf(main).w : 0;
  const stations = main ? postStations(path, num(main.spacing, 1200), main.corners !== false) : [0, path.length];
  for (const part of model.parts) {
    const off = num(part.offset);
    if (part.kind === 'along') {
      const { w, h, round } = profileOf(part);
      const pts = shift(path.pts, off, path.inward);
      const zTop = num(part.z, 900);
      body.along.push({ part, pts, top: path.z.map((z) => z + zTop), w, h, round, ext: Math.max(0, num(part.extend)) });
      continue;
    }
    if (part.kind === 'point') {
      const { w, h, round } = profileOf(part);
      const at = part === main ? stations : postStations(path, num(part.spacing, 1200), part.corners !== false);
      const from = num(part.from);
      const to = num(part.to, 900);
      for (const s of at) {
        const q = pathPoint(path, s);
        const c = shift([q.at, [q.at[0] + q.dir[0], q.at[1] + q.dir[1]]], off, path.inward)[0];
        const z = pathZ(path, s);
        body.posts.push({ part, at: c, dir: q.dir, z0: z + from, z1: z + to, w, d: h, round });
      }
      continue;
    }
    const from = num(part.from);
    const to = num(part.to, 900);
    if (part.kind === 'repeat') {
      const { w, h, round } = profileOf(part);
      const gap = Math.max(10, num(part.spacing, 100));
      for (let k = 0; k < stations.length - 1; k++) {
        const a = stations[k] + mainW / 2;
        const b = stations[k + 1] - mainW / 2;
        const room = b - a;
        if (room <= gap) continue;
        // Lika öppningar, högst `gap`: n delar ger n + 1 öppningar.
        const n = Math.ceil((room - gap) / (gap + w) - 1e-6);
        const open = (room - n * w) / (n + 1);
        for (let j = 1; j <= n; j++) {
          const s = a + open * j + w * (j - 0.5);
          const q = pathPoint(path, s);
          const c = shift([q.at, [q.at[0] + q.dir[0], q.at[1] + q.dir[1]]], off, path.inward)[0];
          // Spjälorna står lodrätt; höjden mäts mitt på spjälan.
          const z = pathZ(path, s);
          body.repeats.push({ part, at: c, dir: q.dir, z0: z + from, z1: z + to, w, d: h, round });
        }
      }
      continue;
    }
    // En yta i varje mellanrum, delad i linjens brytpunkter.
    const t = Math.max(1, part.thickness ?? 10);
    for (let k = 0; k < stations.length - 1; k++) {
      const a = stations[k] + (main ? mainW / 2 + 10 : 0);
      const b = stations[k + 1] - (main ? mainW / 2 + 10 : 0);
      if (b - a < 20) continue;
      const cuts = [a, ...path.s.filter((s) => s > a + 1 && s < b - 1), b];
      for (let j = 0; j < cuts.length - 1; j++) {
        const pa = pathPoint(path, cuts[j]).at;
        const pb = pathPoint(path, cuts[j + 1]).at;
        if (dist(pa, pb) < 5) continue;
        const [sa, sb] = shift([pa, pb], off, path.inward);
        const za = pathZ(path, cuts[j]);
        const zb = pathZ(path, cuts[j + 1]);
        body.panels.push({ part, a: sa, b: sb, a0: za + from, a1: za + to, b0: zb + from, b1: zb + to, t });
      }
    }
  }
  return body;
}

/** Mittlinjen för en längsgående del med förlängningen i ändarna (vågrät, i linjens riktning). */
export function withExtension(a: AlongPiece): { pts: Vec2[]; top: number[] } {
  if (a.ext <= 0 || a.pts.length < 2) return { pts: a.pts, top: a.top };
  const n = a.pts.length;
  let i = 1;
  while (i < n - 1 && dist(a.pts[0], a.pts[i]) < 1e-6) i++;
  let j = n - 2;
  while (j > 0 && dist(a.pts[n - 1], a.pts[j]) < 1e-6) j--;
  const d0 = norm(sub(a.pts[0], a.pts[i]));
  const d1 = norm(sub(a.pts[n - 1], a.pts[j]));
  const start: Vec2 = [a.pts[0][0] + d0[0] * a.ext, a.pts[0][1] + d0[1] * a.ext];
  const end: Vec2 = [a.pts[n - 1][0] + d1[0] * a.ext, a.pts[n - 1][1] + d1[1] * a.ext];
  return { pts: [start, ...a.pts, end], top: [a.top[0], ...a.top, a.top[n - 1]] };
}
