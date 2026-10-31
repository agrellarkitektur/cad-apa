import { cross, dist, dot, intersectLines, lerp, norm, sub } from '../geometry/vec';
import type { Vec2 } from '../repr/primitives';
import { flatLine } from './groundLines';

/**
 * Trappans geometri (0.11): ren räkning utan ritning. Trappan är ett band
 * med bredden `width` längs en referenslinje med raka sträckor och bågar.
 * Gånglinjen, där stegdjupet räknas, ligger parallellt med kanterna. Stegen
 * fördelas lika längs gånglinjen; varje stegs framkant är ett *revben* över
 * bandet: vinkelrätt på raka sträckor och, i en sväng, en stråle från det
 * inre hörnet (kilsteg). En båge är många små svängar, så revbenen blir
 * radiella. En sträcka eller en sväng kan vara vilplan: plant och utan
 * steg. Sträckan längs gånglinjen kallas `u` (mm från trappans början).
 */

type P = readonly [number, number];

/** Var referenslinjen ligger på trappan, sett i linjens riktning. */
export type StairRefSide = 'center' | 'left' | 'right';

export interface StairParams {
  /** Referenslinjen (format 26), mm. */
  line: [number, number][];
  /** Pilhöjd per kant (bågar), som rampens; utelämnad = raka. */
  bulges?: number[];
  /** Trappans bredd, mm. */
  width: number;
  /** Var referenslinjen ligger; utelämnad = i mitten. */
  refSide?: StairRefSide;
  /** Sidan gånglinjen räknas från; utelämnad = utsidan av svängarna (mitten i en rak trappa). */
  walkSide?: 'left' | 'right';
  /** Gånglinjens avstånd från sin sida, mm (300 från början). */
  walkLine?: number;
  /** Stigningen, mm; utelämnad = våningshöjden (till våningen ovanför). */
  rise: number;
  /** Egen stigning sparad i elementet (inte våningens). */
  ownRise?: boolean;
  /** Antal sättsteg; utelämnat = stigningen genom förvald steghöjd (180), avrundat. */
  risers?: number;
  /** Fotens nivå mot våningens golv, mm. */
  level?: number;
  /** Början: sättsteg (förval) eller ett plansteg i golvnivå. */
  start?: 'riser' | 'tread';
  /** Slutet: sättsteg mot golvet ovanför (förval) eller ett sista plansteg. */
  end?: 'riser' | 'tread';
  /** Första och sista plansteget längs gånglinjen, mm (300 från början). */
  startTread?: number;
  endTread?: number;
  /** Punkterna där sträckan efter är vilplan (*Vilplan härifrån*). */
  landings?: number[];
  /** Punkterna där svängen är vilplan i stället för kilsteg. */
  turnLandings?: number[];
  /** Uppbyggnad: monolitisk (en kropp, förval) eller byggd (0.11.4). */
  build?: 'monolithic' | 'built';
  /** Den monolitiska kroppens tjocklek under stegen, mm. */
  thickness?: number;
  /**
   * Den byggda trappans delar (0.11.4): vangstyckena (sidorna, bredd, lodrät
   * höjd), plansteget (tjocklek, stegnos) och sättsteget (tjocklek; 0 = öppen
   * trappa), var och en med stilbokens material. Förvalen i `stairBuilt.ts`.
   */
  built?: {
    stringer?: { sides?: 'both' | 'left' | 'right' | 'none'; width?: number; height?: number; material?: string };
    tread?: { thickness?: number; nosing?: number; material?: string };
    riser?: { thickness?: number; material?: string };
  };
  /** Kontrastmarkering på stegens framkant (0.11.4): ingen (förval), första och sista steget, eller alla. */
  contrast?: 'none' | 'ends' | 'all';
  /** Kontrastmarkeringens bredd från framkanten, mm (50 från början). */
  contrastWidth?: number;
  /** Spiraltrappa (0.11.5; läses inte än): referenslinjen blir en genererad helix. */
  spiral?: { inner: number; outer: number; sweep: number; dir?: 'cw' | 'ccw' };
  /** Hålet i bjälklaget ovanför: automatiskt ur den fria höjden (förval) eller inget. */
  hole?: 'auto' | 'none';
  /** Den fria höjden som hålet räknas ur, mm (2100 från början). */
  headroom?: number;
  /** Stilbokens material (kulören i 3D och snittet). */
  material?: string;
}

/** Förval. */
export const STAIR_WIDTH = 1000;
export const WALK_LINE = 300;
export const RISER_TARGET = 180;
export const TREAD_LENGTH = 300;
export const STAIR_THICKNESS = 180;
export const HEADROOM = 2100;

/** Ett revben: stegets framkant över trappan, med var den möter kanterna och gånglinjen. */
export interface Rib {
  L: Vec2;
  R: Vec2;
  /** Sträckan längs vänster och höger kant till revbenet. */
  lp: number;
  rp: number;
  /** Punkten på gånglinjen. */
  w: Vec2;
}

/** Ett steg, ett vilplan eller ett plansteg i början eller slutet: mellan u0 och u1 på höjden z (från trappans fot). */
export interface StairItem {
  u0: number;
  u1: number;
  z: number;
  kind: 'tread' | 'landing' | 'startTread' | 'endTread';
  /** Loppet steget hör till (index i `runs`), för stegen. */
  run?: number;
}

/** Ett lopp: steg i följd mellan vilplanen. */
export interface StairRun {
  u0: number;
  u1: number;
  treads: number;
  going: number;
}

interface StraightZone {
  kind: 'straight';
  u0: number;
  len: number;
  sl: Vec2;
  el: Vec2;
  sr: Vec2;
  er: Vec2;
  slp: number;
  elp: number;
  srp: number;
  erp: number;
  w0: Vec2;
  w1: Vec2;
  flat: boolean;
}

interface CornerZone {
  kind: 'corner';
  u0: number;
  len: number;
  pivot: Vec2;
  innerLeft: boolean;
  innerP: number;
  outer: Vec2[];
  outerP: number[];
  walk: Vec2[];
  walkS: number[];
  flat: boolean;
}

type Zone = StraightZone | CornerZone;

export interface StairGeometry {
  width: number;
  left: Vec2[];
  leftS: number[];
  right: Vec2[];
  rightS: number[];
  /** Gånglinjen som punkter. */
  walk: Vec2[];
  /** Gånglinjens längd. */
  length: number;
  /** Avståndet från vänster kant till gånglinjen. */
  walkFromLeft: number;
  ribAt(u: number): Rib;
  items: StairItem[];
  runs: StairRun[];
  /** Sättstegens läge längs gånglinjen, i ordning (det första lyfter från foten). */
  risers: number[];
  riserHeight: number;
  rise: number;
  /** Vilplanen längs gånglinjen. */
  landings: [number, number][];
}

/** Hur mycket en punkt svänger (radianer, positivt åt vänster) mellan två riktningar. */
const turnOf = (a: Vec2, b: Vec2): number => Math.atan2(cross(a, b), dot(a, b));

/** Var referenslinjen ligger: avståndet från den till vänster och höger kant. */
export function sideOffsets(p: Pick<StairParams, 'width' | 'refSide'>): { left: number; right: number } {
  const w = Math.max(1, p.width);
  if (p.refSide === 'left') return { left: 0, right: w };
  if (p.refSide === 'right') return { left: w, right: 0 };
  return { left: w / 2, right: w / 2 };
}

/** Sträckan till punkten `s` längs en polylinje med kumulativa längder. */
function pointAt(pts: readonly Vec2[], cum: readonly number[], s: number): Vec2 {
  if (pts.length === 1 || s <= 0) return pts[0];
  for (let i = 1; i < pts.length; i++) if (s <= cum[i] || i === pts.length - 1) {
    const l = cum[i] - cum[i - 1];
    return l < 1e-9 ? pts[i] : lerp(pts[i - 1], pts[i], Math.min(1, (s - cum[i - 1]) / l));
  }
  return pts[pts.length - 1];
}

const cumulative = (pts: readonly Vec2[]): number[] => {
  const out = [0];
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + dist(pts[i - 1], pts[i]));
  return out;
};

/** Var strålen från `o` genom `w` träffar polylinjen; sträckan längs den. */
function rayHit(o: Vec2, w: Vec2, path: readonly Vec2[], cum: readonly number[]): { at: Vec2; s: number } {
  let d = sub(w, o);
  if (Math.hypot(d[0], d[1]) < 1e-6) d = sub(path[Math.floor(path.length / 2)], o);
  let best: { at: Vec2; s: number; t: number } | null = null;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const e = sub(path[i], a);
    const den = cross(d, e);
    if (Math.abs(den) < 1e-12) continue;
    const t = cross(sub(a, o), e) / den;
    const k = cross(sub(a, o), d) / den;
    if (t < -1e-9 || k < -1e-6 || k > 1 + 1e-6) continue;
    const kk = Math.max(0, Math.min(1, k));
    if (!best || t < best.t) best = { at: lerp(a, path[i], kk), s: cum[i - 1] + kk * (cum[i] - cum[i - 1]), t };
  }
  if (best) return best;
  // Ingen träff (en spetsig sväng): den närmaste änden.
  const first = dist(w, path[0]) <= dist(w, path[path.length - 1]);
  return first ? { at: path[0], s: 0 } : { at: path[path.length - 1], s: cum[cum.length - 1] };
}

/** En kant av bandet som byggs punkt för punkt, med sträckan längs den. */
class Edge {
  pts: Vec2[] = [];
  cum: number[] = [];
  push(q: Vec2): number {
    const last = this.pts[this.pts.length - 1];
    if (last && dist(last, q) < 1e-6) return this.cum[this.cum.length - 1];
    this.cum.push(last ? this.cum[this.cum.length - 1] + dist(last, q) : 0);
    this.pts.push(q);
    return this.cum[this.cum.length - 1];
  }
}

/**
 * Trappans band och gånglinje, utan höjder. `landingEdges` är kanterna i
 * referenslinjen som är vilplan, `landingTurns` punkterna där svängen är
 * det. Svarar null när linjen är för kort.
 */
function buildZones(p: StairParams): { zones: Zone[]; left: Edge; right: Edge; walk: Vec2[]; walkFromLeft: number } | null {
  const line = (p.line ?? []) as P[];
  if (line.length < 2) return null;
  const flat = flatLine(line, p.bulges);
  // Bort med punkter som ligger på varandra. Varje punkt minns sin punkt i
  // referenslinjen (null inne i en båge) och kanten den börjar.
  const atOrig = new Map(flat.at.map((k, i) => [k, i]));
  const pts: Vec2[] = [];
  const origOf: (number | null)[] = [];
  const edgeOf: number[] = [];
  let edge = 0;
  for (let k = 0; k < flat.points.length; k++) {
    const oi = atOrig.get(k);
    if (oi !== undefined) edge = Math.min(oi, line.length - 2);
    const q = flat.points[k];
    if (pts.length && dist(pts[pts.length - 1], q) < 1) {
      if (oi !== undefined) origOf[pts.length - 1] = oi;
      continue;
    }
    pts.push(q);
    origOf.push(oi ?? null);
    edgeOf.push(edge);
  }
  if (pts.length < 2) return null;
  const W = Math.max(1, p.width);
  const off = sideOffsets(p);
  const n = pts.length - 1;
  const dirs: Vec2[] = [];
  for (let k = 0; k < n; k++) dirs.push(norm(sub(pts[k + 1], pts[k])));
  const nrm = (k: number): Vec2 => [-dirs[k][1], dirs[k][0]];
  const turns: number[] = [];
  for (let j = 1; j < n; j++) turns.push(turnOf(dirs[j - 1], dirs[j]));

  // Gånglinjens sida: utsidan av svängarna; en rak trappa i mitten.
  const sum = turns.reduce((a, b) => a + b, 0);
  const firstTurn = turns.find((t) => Math.abs(t) > 0.01) ?? 0;
  const walkLine = Math.max(0, Math.min(W, p.walkLine ?? WALK_LINE));
  let walkFromLeft: number;
  if (p.walkSide === 'left') walkFromLeft = walkLine;
  else if (p.walkSide === 'right') walkFromLeft = W - walkLine;
  else if (Math.abs(sum) > 0.01) walkFromLeft = sum > 0 ? W - walkLine : walkLine;
  else if (firstTurn) walkFromLeft = firstTurn > 0 ? W - walkLine : walkLine;
  else walkFromLeft = W / 2;
  const walkOff = off.left - walkFromLeft;

  const landingEdges = new Set(p.landings ?? []);
  const landingTurns = new Set(p.turnLandings ?? []);
  const ribEnds = (j: number, k: number): { L: Vec2; R: Vec2 } => {
    const nn = nrm(k);
    return { L: [pts[j][0] + nn[0] * off.left, pts[j][1] + nn[1] * off.left], R: [pts[j][0] - nn[0] * off.right, pts[j][1] - nn[1] * off.right] };
  };
  const offPoint = (k: number, j: number, d: number): Vec2 => [pts[j][0] + nrm(k)[0] * d, pts[j][1] + nrm(k)[1] * d];

  interface Corner {
    pivot: Vec2;
    innerLeft: boolean;
    a: { L: Vec2; R: Vec2 };
    b: { L: Vec2; R: Vec2 };
    outer: Vec2[];
    walk: Vec2[];
    flat: boolean;
  }
  const corners: (Corner | null)[] = [null];
  for (let j = 1; j < n; j++) {
    const t = turns[j - 1];
    if (Math.abs(t) < 0.005) {
      corners.push(null);
      continue;
    }
    const innerLeft = t > 0;
    const dIn = innerLeft ? off.left : -off.right;
    const dOut = innerLeft ? -off.right : off.left;
    const pivot = intersectLines(offPoint(j - 1, j, dIn), dirs[j - 1], offPoint(j, j, dIn), dirs[j]) ?? offPoint(j - 1, j, dIn);
    const po = intersectLines(offPoint(j - 1, j, dOut), dirs[j - 1], offPoint(j, j, dOut), dirs[j]) ?? offPoint(j - 1, j, dOut);
    const sgn = innerLeft ? -1 : 1;
    const ao: Vec2 = [pivot[0] + nrm(j - 1)[0] * W * sgn, pivot[1] + nrm(j - 1)[1] * W * sgn];
    const bo: Vec2 = [pivot[0] + nrm(j)[0] * W * sgn, pivot[1] + nrm(j)[1] * W * sgn];
    const a = innerLeft ? { L: pivot, R: ao } : { L: ao, R: pivot };
    const b = innerLeft ? { L: pivot, R: bo } : { L: bo, R: pivot };
    const wa = lerp(a.L, a.R, walkFromLeft / W);
    const wb = lerp(b.L, b.R, walkFromLeft / W);
    const pw = intersectLines(offPoint(j - 1, j, walkOff), dirs[j - 1], offPoint(j, j, walkOff), dirs[j]) ?? lerp(wa, wb, 0.5);
    const oi = origOf[j];
    const arcInner = oi === null;
    // En sväng i en båge är vilplan när kanten är det; en riktig punkt efter sitt eget val,
    // och när sträckan på någon sida är vilplan.
    const flatTurn = arcInner ? landingEdges.has(edgeOf[j]) : landingTurns.has(oi!) || landingEdges.has(oi!) || landingEdges.has(oi! - 1);
    corners.push({ pivot, innerLeft, a, b, outer: [ao, po, bo], walk: [wa, pw, wb], flat: flatTurn });
  }

  const zones: Zone[] = [];
  const left = new Edge();
  const right = new Edge();
  const walk: Vec2[] = [];
  let u = 0;
  for (let k = 0; k < n; k++) {
    const startRib = k === 0 || !corners[k] ? ribEnds(k, k) : corners[k]!.b;
    const endRib = k === n - 1 || !corners[k + 1] ? ribEnds(k + 1, k) : corners[k + 1]!.a;
    const slp = left.push(startRib.L);
    const srp = right.push(startRib.R);
    const elp = left.push(endRib.L);
    const erp = right.push(endRib.R);
    const w0 = lerp(startRib.L, startRib.R, walkFromLeft / W);
    const w1 = lerp(endRib.L, endRib.R, walkFromLeft / W);
    const len = Math.max(0, dot(sub(w1, w0), dirs[k]));
    if (!walk.length) walk.push(w0);
    walk.push(w1);
    zones.push({ kind: 'straight', u0: u, len, sl: startRib.L, el: endRib.L, sr: startRib.R, er: endRib.R, slp, elp, srp, erp, w0, w1, flat: landingEdges.has(edgeOf[k]) });
    u += len;
    const c = k + 1 < n ? corners[k + 1] : null;
    if (!c) continue;
    const inner = c.innerLeft ? left : right;
    const outerEdge = c.innerLeft ? right : left;
    const innerP = inner.push(c.pivot);
    const outerP = c.outer.map((q) => outerEdge.push(q));
    const walkS = cumulative(c.walk);
    walk.push(c.walk[1], c.walk[2]);
    zones.push({ kind: 'corner', u0: u, len: walkS[2], pivot: c.pivot, innerLeft: c.innerLeft, innerP, outer: c.outer, outerP, walk: c.walk, walkS, flat: c.flat });
    u += walkS[2];
  }
  return { zones, left, right, walk, walkFromLeft };
}

/** Revbenet vid `u` i en zon. */
function ribIn(z: Zone, u: number, walkFromLeft: number, W: number): Rib {
  if (z.kind === 'straight') {
    const t = z.len > 1e-9 ? Math.max(0, Math.min(1, (u - z.u0) / z.len)) : 0;
    const L = lerp(z.sl, z.el, t);
    const R = lerp(z.sr, z.er, t);
    return { L, R, lp: z.slp + (z.elp - z.slp) * t, rp: z.srp + (z.erp - z.srp) * t, w: lerp(L, R, walkFromLeft / W) };
  }
  const w = pointAt(z.walk, z.walkS, u - z.u0);
  const outerCum = z.outerP.map((s) => s - z.outerP[0]);
  const hit = rayHit(z.pivot, w, z.outer, outerCum);
  const op = z.outerP[0] + hit.s;
  return z.innerLeft ? { L: z.pivot, R: hit.at, lp: z.innerP, rp: op, w } : { L: hit.at, R: z.pivot, lp: op, rp: z.innerP, w };
}

/**
 * Trappans geometri med stegen. Antalet sättsteg är `risers` eller
 * stigningen genom 180, och stegen fördelas lika i varje lopp mellan
 * vilplanen. Svarar null när referenslinjen är för kort.
 */
export function stairGeometry(p: StairParams): StairGeometry | null {
  const built = buildZones(p);
  if (!built) return null;
  const { zones, left, right, walk, walkFromLeft } = built;
  const W = Math.max(1, p.width);
  const L = zones.reduce((s, z) => s + z.len, 0);
  if (L < 1) return null;
  const ribAt = (u: number): Rib => {
    const uu = Math.max(0, Math.min(L, u));
    let z = zones[zones.length - 1];
    for (const c of zones) if (uu <= c.u0 + c.len + 1e-9) {
      z = c;
      break;
    }
    return ribIn(z, uu, walkFromLeft, W);
  };

  // Plansteg i början och slutet, och vilplanen (sammanslagna när de möts).
  const a = p.start === 'tread' ? Math.max(0, Math.min(L / 2, p.startTread ?? TREAD_LENGTH)) : 0;
  const b = p.end === 'tread' ? Math.max(0, Math.min(L / 2, p.endTread ?? TREAD_LENGTH)) : 0;
  const flats: [number, number][] = [];
  for (const z of zones) {
    if (!z.flat || z.len < 1e-6) continue;
    const s = Math.max(a, z.u0);
    const e = Math.min(L - b, z.u0 + z.len);
    if (e - s < 1) continue;
    const last = flats[flats.length - 1];
    if (last && s - last[1] < 1) last[1] = e;
    else flats.push([s, e]);
  }
  // Loppen: det som inte är vilplan mellan planstegen.
  const runSpans: [number, number][] = [];
  let at = a;
  for (const [s, e] of flats) {
    if (s - at >= 1) runSpans.push([at, s]);
    at = e;
  }
  if (L - b - at >= 1) runSpans.push([at, L - b]);
  const k = flats.length;
  const rise = Math.max(1, p.rise);
  const wanted = Math.max(2, Math.round(p.risers ?? rise / RISER_TARGET));
  let treads = Math.max(runSpans.length, wanted - 1 - k);
  if (!runSpans.length) treads = 0;
  // Stegen per lopp efter längden, minst ett i varje (störst rest först).
  const total = runSpans.reduce((s, r) => s + (r[1] - r[0]), 0) || 1;
  const exact = runSpans.map((r) => ((r[1] - r[0]) / total) * treads);
  const per = exact.map((x) => Math.max(1, Math.floor(x)));
  let left_ = treads - per.reduce((s, x) => s + x, 0);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((x, y) => y.r - x.r);
  for (let q = 0; left_ > 0 && order.length; q = (q + 1) % order.length, left_--) per[order[q].i]++;
  const runs: StairRun[] = runSpans.map((r, i) => ({ u0: r[0], u1: r[1], treads: per[i], going: (r[1] - r[0]) / per[i] }));
  const n = per.reduce((s, x) => s + x, 0) + k + 1;
  const h = rise / n;

  // Stegen i ordning längs gånglinjen.
  const items: StairItem[] = [];
  if (a > 0) items.push({ u0: 0, u1: a, z: 0, kind: 'startTread' });
  const spans = [...runs.map((r, i) => ({ s: r.u0, run: i as number | undefined })), ...flats.map((f) => ({ s: f[0], run: undefined }))].sort((x, y) => x.s - y.s);
  let level = 0;
  for (const sp of spans) {
    if (sp.run === undefined) {
      const f = flats.find((x) => x[0] === sp.s)!;
      level++;
      items.push({ u0: f[0], u1: f[1], z: level * h, kind: 'landing' });
      continue;
    }
    const r = runs[sp.run];
    for (let i = 0; i < r.treads; i++) {
      level++;
      items.push({ u0: r.u0 + i * r.going, u1: r.u0 + (i + 1) * r.going, z: level * h, kind: 'tread', run: sp.run });
    }
  }
  if (b > 0) items.push({ u0: L - b, u1: L, z: rise, kind: 'endTread' });
  const risers = [...items.filter((it) => it.kind !== 'startTread' && it.kind !== 'endTread').map((it) => it.u0), L - b];

  return {
    width: W,
    left: left.pts,
    leftS: left.cum,
    right: right.pts,
    rightS: right.cum,
    walk,
    length: L,
    walkFromLeft,
    ribAt,
    items,
    runs,
    risers,
    riserHeight: h,
    rise,
    landings: flats,
  };
}

/** Bitarna av en kant mellan sträckorna s0 och s1, med punkterna emellan. */
function edgePart(pts: readonly Vec2[], cum: readonly number[], s0: number, s1: number, a: Vec2, b: Vec2): Vec2[] {
  const out: Vec2[] = [a];
  for (let i = 0; i < pts.length; i++) if (cum[i] > s0 + 1e-6 && cum[i] < s1 - 1e-6) out.push(pts[i]);
  out.push(b);
  return out;
}

/** Ytan mellan sträckorna u0 och u1 längs gånglinjen (ett steg, ett vilplan), moturs eller medurs. */
export function bandBetween(g: StairGeometry, u0: number, u1: number): Vec2[] {
  const r0 = g.ribAt(u0);
  const r1 = g.ribAt(u1);
  const l = edgePart(g.left, g.leftS, r0.lp, r1.lp, r0.L, r1.L);
  const r = edgePart(g.right, g.rightS, r0.rp, r1.rp, r0.R, r1.R);
  const ring = [...r, ...l.reverse()];
  return ring.filter((q, i) => i === 0 || dist(q, ring[i - 1]) > 1e-6);
}

/** Vänster eller höger kant mellan u0 och u1. */
export function sideBetween(g: StairGeometry, side: 'left' | 'right', u0: number, u1: number): Vec2[] {
  const r0 = g.ribAt(u0);
  const r1 = g.ribAt(u1);
  return side === 'left' ? edgePart(g.left, g.leftS, r0.lp, r1.lp, r0.L, r1.L) : edgePart(g.right, g.rightS, r0.rp, r1.rp, r0.R, r1.R);
}

/** Gånglinjen mellan u0 och u1. */
export function walkBetween(g: StairGeometry, u0: number, u1: number): Vec2[] {
  const out: Vec2[] = [g.ribAt(u0).w];
  const cum = cumulative(g.walk);
  for (let i = 0; i < g.walk.length; i++) if (cum[i] > u0 + 1e-6 && cum[i] < u1 - 1e-6) out.push(g.walk[i]);
  out.push(g.ribAt(u1).w);
  return out.filter((q, i) => i === 0 || dist(q, out[i - 1]) > 1e-6);
}

/** Trappans hela kontur. */
export const stairOutline = (g: StairGeometry): Vec2[] => bandBetween(g, 0, g.length);

/** Riktningen längs gånglinjen vid u. */
export function walkDir(g: StairGeometry, u: number): Vec2 {
  const a = g.ribAt(Math.max(0, u - 5)).w;
  const b = g.ribAt(Math.min(g.length, u + 5)).w;
  return norm(sub(b, a));
}

/** Det minsta stegdjupet i loppen (gånglinjen). */
export const minGoing = (g: StairGeometry): number => (g.runs.length ? Math.min(...g.runs.map((r) => r.going)) : 0);

/**
 * Varningarna (0.11, texterna 0.11.1): måtten är vedertagna men står inte i
 * Boverkets föreskrifter (BFS 2024:9 har inga mått för steg och bredd; de
 * var allmänna råd i BBR 8:232), så de *avviker från praxis*. Uppslaget 30
 * oktober 2026. Trappan går alltid att rita; varningarna står i panelen.
 */
export function stairWarnings(p: StairParams, g: StairGeometry, outdoor = false): string[] {
  const out: string[] = [];
  const mm = (v: number) => `${Math.round(v).toLocaleString('sv-SE')} mm`;
  const h = g.riserHeight;
  const minG = outdoor ? 300 : 250;
  for (const r of g.runs) {
    if (r.going < minG - 0.5) {
      out.push(`Stegdjupet i gånglinjen är ${mm(r.going)}; avviker från praxis (minst ${minG} mm${outdoor ? ' utomhus' : ', 300 utomhus'}).`);
      break;
    }
  }
  for (const r of g.runs) {
    const f = 2 * h + r.going;
    if (f < 600 - 0.5 || f > 650 + 0.5) {
      out.push(`Stegformeln 2 × steghöjd + stegdjup är ${mm(f)}; avviker från praxis (600–650 mm).`);
      break;
    }
  }
  if (h > 200.5) out.push(`Steghöjden är ${mm(h)}; avviker från praxis (180–200 mm i bostäder).`);
  if (p.width < 900 - 0.5) out.push(`Bredden är ${mm(p.width)}; avviker från praxis (minst 900 mm fri bredd i bostäder).`);
  for (const [s, e] of g.landings) if (e - s < g.width - 1) {
    out.push(`Ett vilplan är ${mm(e - s)} i gånglinjen; avviker från praxis (minst trappans bredd, ${mm(g.width)}).`);
    break;
  }
  const wanted = p.risers ?? Math.max(2, Math.round(p.rise / RISER_TARGET));
  const actual = g.risers.length;
  if (p.risers !== undefined && actual !== wanted) out.push(`Trappan har ${actual} sättsteg i stället för ${wanted}: varje lopp mellan vilplanen behöver minst ett steg.`);
  return out;
}
