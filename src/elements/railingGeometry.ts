import { dist, norm, sub } from '../geometry/vec';
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
 * med typens mått i `railingBody.ts`.
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
const GROUND_STEP = 250;

export const RAIL_INSET = 50;
const BEND_RADIUS = 150;

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
function placeOffset(p: Pick<RailingParams, 'place' | 'inset' | 'host'>): number {
  const place = p.place ?? (p.host ? 'inside' : 'on');
  const d = p.inset ?? RAIL_INSET;
  return place === 'inside' ? d : place === 'outside' ? -d : 0;
}

/** Linjen förskjuten d mm inåt, med samma antal punkter (höjderna följer). */
export function shift(pts: readonly Vec2[], d: number, inward: 1 | -1): Vec2[] {
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

/** Punkterna utan dubbletter på samma ställe, och höjderna till dem. */
export const dedupe = (pts: readonly Vec2[]): Vec2[] => pts.filter((q, i) => i === 0 || dist(q, pts[i - 1]) > 1e-6);
export const dedupeZ = (pts: readonly Vec2[], zs: readonly number[]): number[] => zs.filter((_, i) => i === 0 || dist(pts[i], pts[i - 1]) > 1e-6);

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
