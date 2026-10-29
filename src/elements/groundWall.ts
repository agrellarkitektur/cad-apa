import { groundDefaults } from '../core/site';
import type { Vec2 } from '../repr/primitives';
import type { Edges3D, Plane, Shape3D } from '../repr/solids';
import { along, centerShift, offsetLine } from './groundLines';
import type { PlanContext } from './registry';

/**
 * Stödmurens linje och krön (0.10.9). Referenslinjen ligger i mitten eller
 * på en kant med förskjutning, som vägens. Krönet:
 *
 * - i ändarna *Över marken* (början och slutet), eller en egen ÖK;
 * - längs muren följer det den högre sidans mark (eller den lägre, 0.10.12), utjämnad med ett
 *   glidande medelvärde (±1 m, kortare och symmetriskt nära ändarna), med tillägget rakt mellan ändarna; eller,
 *   med *Rakt krön*, en rät linje mellan ändarna och höjdpunkterna;
 * - höjdpunkter på muren (en punkt på referenslinjen och en ÖK) låser
 *   krönet, och korrigeringen fördelas rakt mot grannpunkterna.
 *
 * Foten ligger 300 under den lägre sidans lägsta mark inom ±1 m. Muren
 * byggs av bitar på högst 0,5 m med lutande ovansida och undersida, utan
 * egna kanter; kanterna levereras för sig, så att skarvarna inte syns.
 */

/** Hur långt ut från muren marken känns på, mm (en ruta i rutnätet räcker). */
const WALL_REACH = 700;
/** Stödmurens grund under den lägre sidan, mm. */
export const WALL_FOOTING = 300;
/** Bitarnas längd längs muren, mm. */
const STEP = 500;
/** Utjämningen: medelvärdet inom så här långt åt båda håll, mm. */
const SMOOTH = 1000;
/** Kortaste höjden på muren, mm. */
const MIN_HEIGHT = 50;

/** En höjdpunkt på muren: punkten på referenslinjen och krönets höjd där (mm från ±0). */
export interface CrestPoint {
  at: [number, number];
  h: number;
}

/** Stödmurens parametrar, de som rör linjen och krönet. */
export interface WallParams {
  line?: [number, number][];
  thickness?: number;
  refSide?: 'center' | 'left' | 'right';
  refOffset?: number;
  /** ÖK i början och slutet (mm från ±0); tomt = *Över marken*. */
  height?: number;
  endHeight?: number;
  /** Krönet över den högre sidans mark i början och slutet, mm. Slutet följer början när det är tomt. */
  above?: number;
  endAbove?: number;
  /** Vilken sidas mark *Över marken* och krönet längs muren mäts mot (0.10.12): den högre (förval) eller den lägre. */
  aboveSide?: 'high' | 'low';
  /** Höjdpunkterna på muren. */
  crest?: CrestPoint[];
  /** Rakt krön mellan ändarna och höjdpunkterna, i stället för att följa marken. */
  straight?: boolean;
}

/** Murens tjocklek, mm. */
export const wallThickness = (ctx: PlanContext, p: WallParams): number => Math.max(50, p.thickness ?? groundDefaults(ctx.doc.site).wallThickness);

/** Murens mittlinje: referenslinjen förskjuten efter `refSide` och `refOffset`. */
export function wallCenter(pts: readonly Vec2[], th: number, p: Pick<WallParams, 'refSide' | 'refOffset'>): Vec2[] {
  const c = centerShift(p.refSide, p.refOffset, th);
  return Math.abs(c) > 0.5 ? offsetLine(pts, c) : pts.map((q): Vec2 => [q[0], q[1]]);
}

/** En punkt längs muren: sträckan, mittlinjens punkt, ytterpunkterna åt höger och vänster, krönet och foten. */
export interface Station {
  s: number;
  at: Vec2;
  right: Vec2;
  left: Vec2;
  /** Segmentet punkten ligger på (vid ett hörn: det som börjar där). */
  seg: number;
  top: number;
  bottom: number;
}

export interface WallProfile {
  center: Vec2[];
  stations: Station[];
  /** Höjdpunkternas läge längs mittlinjen och höjd, i ordning. */
  pins: { s: number; at: Vec2; h: number }[];
  /** Krönet i början och slutet. */
  start: number;
  end: number;
  top: number;
  bottom: number;
}

/** Profilen ur referenslinjen, tjockleken, parametrarna och marken (mm). Ren räkning, för testerna. */
export function computeProfile(ref: readonly Vec2[], th: number, p: WallParams, ground: (x: number, y: number) => number | null): WallProfile | null {
  const center = wallCenter(ref, th, p);
  const half = th / 2;
  const seg: { a: Vec2; u: Vec2; n: Vec2; l: number; s0: number }[] = [];
  let total = 0;
  for (let i = 1; i < center.length; i++) {
    const a = center[i - 1];
    const b = center[i];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u: Vec2 = l > 0 ? [(b[0] - a[0]) / l, (b[1] - a[1]) / l] : [1, 0];
    seg.push({ a, u, n: [-u[1], u[0]], l, s0: total });
    total += l;
  }
  if (total < 1) return null;
  const rightLine = offsetLine(center, -half);
  const leftLine = offsetLine(center, half);
  const pins = (p.crest ?? [])
    .map((c) => {
      const a = along(center, c.at[0], c.at[1]);
      return { s: a.s, at: a.at, h: c.h };
    })
    .filter((c) => c.s > 1 && c.s < total - 1)
    .sort((a, b) => a.s - b.s);
  // Punkterna: hörnen, höjdpunkterna och var 0,5 m.
  const ss = new Set<number>();
  for (const g of seg) {
    const n = Math.max(1, Math.ceil(g.l / STEP));
    for (let k = 0; k < n; k++) ss.add(g.s0 + (g.l * k) / n);
  }
  ss.add(total);
  for (const pin of pins) ss.add(pin.s);
  const sorted = [...ss].sort((a, b) => a - b).filter((s, i, arr) => i === 0 || s - arr[i - 1] > 1);
  const segAt = (s: number) => {
    let i = 0;
    while (i < seg.length - 1 && s >= seg[i].s0 + seg[i].l - 1e-6) i++;
    return i;
  };
  // Marken på båda sidor vid varje punkt.
  const hi: (number | null)[] = [];
  const lo: (number | null)[] = [];
  const raw = sorted.map((s) => {
    const i = segAt(s);
    const g = seg[i];
    const f = s - g.s0;
    const at: Vec2 = [g.a[0] + g.u[0] * f, g.a[1] + g.u[1] * f];
    const r = half + WALL_REACH;
    const a = ground(at[0] + g.n[0] * r, at[1] + g.n[1] * r);
    const b = ground(at[0] - g.n[0] * r, at[1] - g.n[1] * r);
    hi.push(a === null ? b : b === null ? a : Math.max(a, b));
    lo.push(a === null ? b : b === null ? a : Math.min(a, b));
    return { s, i, at };
  });
  if (hi.every((h) => h === null)) return null;
  // Utjämnat: medelvärdet av den sida krönet mäts mot (den högre om inget
  // annat valts), och den lägre sidans lägsta, inom ±1 m.
  const side = p.aboveSide === 'low' ? lo : hi;
  const refS: number[] = [];
  const loS: number[] = [];
  for (let k = 0; k < raw.length; k++) {
    let sum = 0;
    let n = 0;
    let low = Infinity;
    // Nära ändarna krymper fönstret så att det är lika långt åt båda håll (0.10.28.3):
    // annars drar den ena sidan krönet nedåt i början av en stigande mur.
    const win = Math.max(STEP / 2, Math.min(SMOOTH, raw[k].s, total - raw[k].s));
    for (let j = 0; j < raw.length; j++) {
      if (Math.abs(raw[j].s - raw[k].s) > win) continue;
      const h = side[j];
      if (h !== null) {
        sum += h;
        n++;
      }
      const l = lo[j];
      if (l !== null) low = Math.min(low, l);
    }
    refS.push(n ? sum / n : NaN);
    loS.push(low);
  }
  fillGaps(refS);
  fillGaps(loS);
  const smooth = (s: number) => interp(raw.map((r) => r.s), refS, s);
  // Ankarna: ändarna och höjdpunkterna, med krönet där.
  const above0 = p.above ?? 0;
  const above1 = p.endAbove ?? above0;
  const anchors = [
    { s: 0, h: p.height ?? smooth(0) + above0 },
    ...pins.map((pin) => ({ s: pin.s, h: pin.h })),
    { s: total, h: p.endHeight ?? smooth(total) + above1 },
  ];
  const as = anchors.map((a) => a.s);
  const crestAt = p.straight
    ? (s: number) => interp(as, anchors.map((a) => a.h), s)
    : (s: number) =>
        smooth(s) +
        interp(
          as,
          anchors.map((a) => a.h - smooth(a.s)),
          s,
        );
  const all = raw.map((r, k) => {
    // Vid ett hörn: geringens punkter; annars rakt ut från mittlinjen.
    const corner = center.findIndex((c, ci) => ci > 0 && ci < center.length - 1 && Math.hypot(c[0] - r.at[0], c[1] - r.at[1]) < 1);
    const end = k === 0 ? 0 : k === raw.length - 1 ? center.length - 1 : corner;
    const g = seg[r.i];
    const right: Vec2 = end >= 0 ? rightLine[end] : [r.at[0] - g.n[0] * half, r.at[1] - g.n[1] * half];
    const left: Vec2 = end >= 0 ? leftLine[end] : [r.at[0] + g.n[0] * half, r.at[1] + g.n[1] * half];
    const top = crestAt(r.s);
    return { s: r.s, at: end >= 0 ? center[end] : r.at, right, left, seg: r.i, top, bottom: Math.min(loS[k] - WALL_FOOTING, top - MIN_HEIGHT), keep: end >= 0 || pins.some((q) => Math.abs(q.s - r.s) < 1) };
  });
  const kept = simplify(all);
  const stations: Station[] = kept.map(({ keep: _, ...st }) => st);
  return {
    center,
    stations,
    pins,
    start: stations[0].top,
    end: stations[stations.length - 1].top,
    top: Math.max(...stations.map((s) => s.top)),
    bottom: Math.min(...stations.map((s) => s.bottom)),
  };
}

/** Hur mycket muren ska vika för att hörnet ska få en kantlinje i 3D (0.10.26), radianer (20°). */
const CORNER = (20 * Math.PI) / 180;

/** Hur mycket linjen viker i punkt `i` (där segment i börjar), radianer. */
function turnAt(c: readonly Vec2[], i: number): number {
  if (i <= 0 || i >= c.length - 1) return Math.PI;
  const a = Math.atan2(c[i][1] - c[i - 1][1], c[i][0] - c[i - 1][0]);
  const b = Math.atan2(c[i + 1][1] - c[i][1], c[i + 1][0] - c[i][0]);
  const d = Math.abs(b - a) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
}

/** Hur långt krönet och foten får avvika när punkter slås ihop, mm. */
const SIMPLIFY = 5;

/**
 * Färre bitar: en punkt mitt på ett segment tas bort när krönet och foten
 * går rakt genom den (inom 5 mm), räknat från den senast behållna. Hörn,
 * ändar och höjdpunkter behålls. Ett rakt krön blir en bit per sträcka.
 */
function simplify<T extends Station & { keep: boolean }>(st: T[]): T[] {
  const out: T[] = [st[0]];
  let from = 0;
  for (let i = 1; i < st.length - 1; i++) {
    if (st[i].keep) {
      out.push(st[i]);
      from = i;
      continue;
    }
    // Går det rakt från den behållna till nästa, genom alla däremellan?
    const a = st[from];
    const b = st[i + 1];
    const d = b.s - a.s;
    let straight = d > 0;
    for (let j = from + 1; j <= i && straight; j++) {
      const f = (st[j].s - a.s) / d;
      straight = Math.abs(a.top + (b.top - a.top) * f - st[j].top) <= SIMPLIFY && Math.abs(a.bottom + (b.bottom - a.bottom) * f - st[j].bottom) <= SIMPLIFY;
    }
    if (!straight) {
      out.push(st[i]);
      from = i;
    }
  }
  out.push(st[st.length - 1]);
  return out;
}

/** Fyll luckor (NaN eller Infinity, utanför markmodellen) med närmaste värde. */
function fillGaps(v: number[]): void {
  const ok = (x: number) => Number.isFinite(x);
  const first = v.findIndex(ok);
  if (first < 0) return;
  let last = v[first];
  for (let i = 0; i < v.length; i++) {
    if (ok(v[i])) last = v[i];
    else v[i] = last;
  }
}

/** Värdet i `s`, rakt mellan de givna punkterna (och lika med ändpunkterna utanför). */
function interp(xs: readonly number[], ys: readonly number[], s: number): number {
  if (s <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (s <= xs[i]) {
      const d = xs[i] - xs[i - 1];
      return d > 0 ? ys[i - 1] + ((ys[i] - ys[i - 1]) * (s - xs[i - 1])) / d : ys[i];
    }
  }
  return ys[ys.length - 1];
}

/** Krönet i en punkt längs mittlinjen (sträckan `s`), rakt mellan profilens punkter. */
export function crestAtS(prof: WallProfile, s: number): number {
  return interp(
    prof.stations.map((st) => st.s),
    prof.stations.map((st) => st.top),
    s,
  );
}

/**
 * Muren i 3D: en bit per sträcka mellan profilens punkter, med lutande
 * ovan- och undersida och utan egna kanter, och kanterna för sig (krönet,
 * foten, ändarna och hörnen). `base` är våningens golvnivå.
 */
export function wallSolids(id: string, prof: WallProfile, base: number): Shape3D[] {
  const out: Shape3D[] = [];
  const st = prof.stations;
  const z = (h: number) => h - base;
  const planeOf = (a: Station, b: Station, ha: number, hb: number): Plane => {
    const dx = b.at[0] - a.at[0];
    const dy = b.at[1] - a.at[1];
    const l2 = dx * dx + dy * dy || 1;
    const k = (hb - ha) / l2;
    return [k * dx, k * dy, z(ha) - k * (dx * a.at[0] + dy * a.at[1])];
  };
  const zOf = (pl: Plane, q: Vec2) => pl[0] * q[0] + pl[1] * q[1] + pl[2];
  for (let i = 1; i < st.length; i++) {
    const a = st[i - 1];
    const b = st[i];
    const ring: Vec2[] = [a.right, b.right, b.left, a.left];
    const top = planeOf(a, b, a.top, b.top);
    const bottom = planeOf(a, b, a.bottom, b.bottom);
    const tops = ring.map((q) => zOf(top, q));
    const bots = ring.map((q) => zOf(bottom, q));
    out.push({ id, rings: [ring], z0: Math.min(...bots), z1: Math.max(...tops), top, bottom, material: 'wall', noEdges: true });
  }
  // Kanterna: krönet och foten på båda sidor, ändarna och de riktiga hörnen.
  const seg: Edges3D = { kind: 'edges', id, segments: [] };
  const p3 = (q: Vec2, h: number): [number, number, number] => [q[0], q[1], z(h)];
  for (let i = 1; i < st.length; i++) {
    const a = st[i - 1];
    const b = st[i];
    for (const side of ['right', 'left'] as const) {
      seg.segments.push([...p3(a[side], a.top), ...p3(b[side], b.top)]);
      seg.segments.push([...p3(a[side], a.bottom), ...p3(b[side], b.bottom)]);
    }
  }
  // Bara de riktiga hörnen (0.10.26): där muren viker mer än CORNER. En båge,
  // eller en linje ritad med många punkter längs en kurva, ger inga skarvar.
  const corners = new Set<number>([0, st.length - 1]);
  for (let i = 1; i < st.length - 1; i++) if (st[i].seg !== st[i - 1].seg && turnAt(prof.center, st[i].seg) > CORNER) corners.add(i);
  for (const i of corners) {
    const s = st[i];
    for (const side of ['right', 'left'] as const) seg.segments.push([...p3(s[side], s.bottom), ...p3(s[side], s.top)]);
    seg.segments.push([...p3(s.right, s.top), ...p3(s.left, s.top)]);
    if (i === 0 || i === st.length - 1) seg.segments.push([...p3(s.right, s.bottom), ...p3(s.left, s.bottom)]);
  }
  out.push(seg);
  return out;
}
