// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import { LEAF_OPS, type Track, type LeafStyle, MUNTIN_KINDS, type Muntins, type OpeningCell, type OpeningTypeModel, fr, mm } from './openingTypes';


// ---------------------------------------------------------------------------
// Rutnätet

export interface Rect {
  /** Längs karmen från dess vänstra kant sett utifrån (u) och uppåt från karmens underkant (z), mm. */
  u0: number;
  u1: number;
  z0: number;
  z1: number;
}

export interface LaidCell extends OpeningCell {
  rect: Rect;
}

export interface OpeningLayout {
  w: number;
  h: number;
  /** Karmens delar: vänster, höger, över och (om den finns) under. */
  frame: Rect[];
  /** Poster (lodräta) och tvärstycken (vågräta). */
  mullions: Rect[];
  transoms: Rect[];
  cells: LaidCell[];
}

/** Fördela `inner` mm på spåren: fasta mm först, resten i andelar. */
export function trackSizes(list: readonly Track[], inner: number): number[] {
  const fixed = list.reduce((a, t) => a + (t.unit === 'mm' ? t.size : 0), 0);
  const frs = list.reduce((a, t) => a + (t.unit === 'fr' ? t.size : 0), 0);
  const rest = Math.max(0, inner - fixed);
  return list.map((t) => (t.unit === 'mm' ? t.size : frs > 0 ? (rest * t.size) / frs : 0));
}

/**
 * Karmen, posterna, tvärstyckena och lufterna i ett karmyttermått `w` × `h`.
 * Rutor i rutnätet som ingen luft täcker blir fast glas.
 */
export function layoutOpening(m: OpeningTypeModel, w: number, h: number): OpeningLayout {
  const fw = m.kind === 'hole' ? 0 : m.frame.width;
  const fb = m.frame.bottom ?? 0;
  const frame: Rect[] = fw > 0 ? [{ u0: 0, u1: fw, z0: 0, z1: h }, { u0: w - fw, u1: w, z0: 0, z1: h }, { u0: fw, u1: w - fw, z0: h - fw, z1: h }] : [];
  if (fb > 0 && fw > 0) frame.push({ u0: fw, u1: w - fw, z0: 0, z1: fb });
  const nc = m.cols.length;
  const nr = m.rows.length;
  const ws = trackSizes(m.cols, w - 2 * fw - (nc - 1) * m.mullion);
  const hs = trackSizes(m.rows, h - fw - fb - (nr - 1) * m.transom);
  const u: number[] = [fw];
  for (let i = 0; i < nc; i++) u.push(u[i] + ws[i] + (i < nc - 1 ? m.mullion : 0));
  // Raderna uppifrån.
  const z: number[] = [h - fw];
  for (let j = 0; j < nr; j++) z.push(z[j] - hs[j] - (j < nr - 1 ? m.transom : 0));
  const colU = (i: number): [number, number] => [u[i], u[i] + ws[i]];
  const rowZ = (j: number): [number, number] => [z[j] - hs[j], z[j]];
  const covered = new Set<string>();
  const cells: LaidCell[] = [];
  const add = (c: OpeningCell) => {
    const cs = c.colSpan ?? 1;
    const rs = c.rowSpan ?? 1;
    for (let i = c.col; i < c.col + cs; i++) for (let j = c.row; j < c.row + rs; j++) covered.add(`${i},${j}`);
    cells.push({ ...c, rect: { u0: colU(c.col)[0], u1: colU(c.col + cs - 1)[1], z0: rowZ(c.row + rs - 1)[0], z1: rowZ(c.row)[1] } });
  };
  for (const c of m.cells) if (!c.col || c.col < nc) if (c.row < nr && !covered.has(`${c.col},${c.row}`)) add(c);
  for (let i = 0; i < nc; i++) for (let j = 0; j < nr; j++) if (!covered.has(`${i},${j}`)) add({ col: i, row: j, fill: m.kind === 'hole' ? 'open' : 'glass', op: 'fixed' });
  // Poster och tvärstycken där två lufter möts (inte inne i en sammanslagen luft).
  const mullions: Rect[] = [];
  const transoms: Rect[] = [];
  if (m.mullion > 0)
    for (let i = 0; i < nc - 1; i++) {
      const a = colU(i)[1];
      // Bitvis per rad, utom där en luft går över.
      for (let j = 0; j < nr; j++) {
        if (cells.some((c) => c.col <= i && c.col + (c.colSpan ?? 1) - 1 > i && c.row <= j && c.row + (c.rowSpan ?? 1) - 1 >= j)) continue;
        const [r0, r1] = rowZ(j);
        mullions.push({ u0: a, u1: a + m.mullion, z0: j === nr - 1 ? fb : r0, z1: j === 0 ? h - fw : r1 + m.transom });
      }
    }
  if (m.transom > 0)
    for (let j = 0; j < nr - 1; j++) {
      const b = rowZ(j)[0];
      for (let i = 0; i < nc; i++) {
        if (cells.some((c) => c.row <= j && c.row + (c.rowSpan ?? 1) - 1 > j && c.col <= i && c.col + (c.colSpan ?? 1) - 1 >= i)) continue;
        const [c0, c1] = colU(i);
        transoms.push({ u0: c0, u1: c1, z0: b - m.transom, z1: b });
      }
    }
  return { w, h, frame, mullions, transoms, cells };
}
/** Om luften har en båge (öppningsbar glasluft) och inte bara glas i karmen. */
export const hasSash = (c: Pick<OpeningCell, 'op' | 'fill'>): boolean => c.fill === 'glass' && c.op !== 'fixed' && !LEAF_OPS.has(c.op);

export const muntinWidth = (m: Muntins): number => m.width ?? MUNTIN_KINDS.find((k) => k.kind === m.kind)!.width;

/** Spröjsens referenslinjer i glaset `g` (u, z i mm): special om det finns ritade linjer, annars jämnt fördelade. */
export function muntinLines(m: Muntins, g: Rect): [number, number, number, number][] {
  const W = g.u1 - g.u0;
  const H = g.z1 - g.z0;
  if (m.lines?.length) return m.lines.map((l) => [g.u0 + l.a[0] * W, g.z0 + l.a[1] * H, g.u0 + l.b[0] * W, g.z0 + l.b[1] * H]);
  const out: [number, number, number, number][] = [];
  for (let i = 1; i <= m.v; i++) {
    const u = g.u0 + (W * i) / (m.v + 1);
    out.push([u, g.z0, u, g.z1]);
  }
  for (let j = 1; j <= m.h; j++) {
    const z = g.z0 + (H * j) / (m.h + 1);
    out.push([g.u0, z, g.u1, z]);
  }
  return out;
}

/**
 * Spröjsens kanter som linjer: varje referenslinje blir två parallella
 * linjer en halv bredd ut. Vågräta spröjs bryts där en lodrät går igenom,
 * så att korsen blir rena; sneda (special) ritas hela.
 */
export function muntinOutline(lines: readonly [number, number, number, number][], width: number): [number, number, number, number][] {
  const w = width / 2;
  const vert = lines.filter(([u1, , u2]) => Math.abs(u1 - u2) < 0.5);
  const out: [number, number, number, number][] = [];
  for (const l of lines) {
    const [u1, z1, u2, z2] = l;
    const len = Math.hypot(u2 - u1, z2 - z1);
    if (len < 1) continue;
    const nu = (-(z2 - z1) / len) * w;
    const nz = ((u2 - u1) / len) * w;
    const horizontal = Math.abs(z1 - z2) < 0.5;
    if (horizontal) {
      // Bitarna mellan de lodräta som korsar.
      const a = Math.min(u1, u2);
      const b = Math.max(u1, u2);
      const cuts = vert.filter(([u, za, , zb]) => u > a + w && u < b - w && Math.min(za, zb) <= z1 + 0.5 && Math.max(za, zb) >= z1 - 0.5).map(([u]) => u).sort((x, y) => x - y);
      let s = a;
      for (const u of [...cuts, b + w]) {
        const e = Math.min(b, u - w);
        if (e > s) for (const o of [-w, w]) out.push([s, z1 + o, e, z1 + o]);
        s = u + w;
      }
    } else for (const o of [-1, 1]) out.push([u1 + nu * o, z1 + nz * o, u2 + nu * o, z2 + nz * o]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dörrbladets indelning (0.11.8.1)

/** En fyllning (spegel) i bladet: ett eller flera fält i bladets rutnät, med material. */
export interface LeafFill {
  col: number;
  row: number;
  colSpan?: number;
  rowSpan?: number;
  /** Glas eller en skiva; materialet ur stilboken (glas, trä, plåt …). */
  glass?: boolean;
  material?: string;
  /** Rak kant, utan spegelns fas (0.11.8.3; förval fasad). */
  flat?: boolean;
}

/**
 * Dörrbladets indelning (kommentar F): ett eget rutnät i bladet, uppifrån
 * och från vänster sett utifrån. Spår i mm behåller sitt mått (ramstyckena,
 * avstånden till kanterna) och andelarna växer med bladet, som sträckzonen
 * i profileditorn, så att samma typ fungerar i alla storlekar. Rutorna med
 * en fyllning är speglar; resten är bladet.
 */
export interface LeafGrid {
  cols: Track[];
  rows: Track[];
  fills: LeafFill[];
}

/** Förvalen som motsvarar *Spegel* (två speglar) och *Glasat* (ett glas), så att de går att ändra. */
export function leafGridPreset(style: LeafStyle): LeafGrid | null {
  if (style === 'panel')
    return { cols: [mm(120), fr(), mm(120)], rows: [mm(120), fr(1.2), mm(120), fr(), mm(180)], fills: [{ col: 1, row: 1 }, { col: 1, row: 3 }] };
  if (style === 'glazed') return { cols: [mm(150), fr(), mm(150)], rows: [mm(150), fr(), mm(400)], fills: [{ col: 1, row: 1, glass: true }] };
  return null;
}

/** Bladets indelning: egen, eller förvalet för utförandet (slätt har ingen). */
export const leafGridOf = (c: Pick<OpeningCell, 'leaf' | 'leafGrid'>): LeafGrid | null => c.leafGrid ?? leafGridPreset(c.leaf ?? 'flat');

export interface LaidLeaf {
  /** Fyllningarna i bladet (u, z som luftens rutor). */
  fills: (LeafFill & { rect: Rect })[];
  /** Bladets rutor utan fyllning (ramstyckena), med sin plats i rutnätet. */
  frame: (Rect & { col: number; row: number })[];
}

/** Bladets indelning i luftens ruta `r`. */
export function layoutLeaf(g: LeafGrid, r: Rect): LaidLeaf {
  const ws = trackSizes(g.cols, r.u1 - r.u0);
  const hs = trackSizes(g.rows, r.z1 - r.z0);
  const u: number[] = [r.u0];
  for (const w of ws) u.push(u[u.length - 1] + w);
  const z: number[] = [r.z1];
  for (const h of hs) z.push(z[z.length - 1] - h);
  const covered = new Set<string>();
  const fills: LaidLeaf['fills'] = [];
  for (const f of g.fills) {
    const cs = f.colSpan ?? 1;
    const rs = f.rowSpan ?? 1;
    if (f.col + cs > ws.length || f.row + rs > hs.length) continue;
    let taken = false;
    for (let i = f.col; i < f.col + cs; i++) for (let j = f.row; j < f.row + rs; j++) taken ||= covered.has(`${i},${j}`);
    if (taken) continue;
    for (let i = f.col; i < f.col + cs; i++) for (let j = f.row; j < f.row + rs; j++) covered.add(`${i},${j}`);
    fills.push({ ...f, rect: { u0: u[f.col], u1: u[f.col + cs], z0: z[f.row + rs], z1: z[f.row] } });
  }
  const frame: LaidLeaf['frame'] = [];
  for (let j = 0; j < hs.length; j++) for (let i = 0; i < ws.length; i++) if (!covered.has(`${i},${j}`) && ws[i] > 0.5 && hs[j] > 0.5) frame.push({ u0: u[i], u1: u[i + 1], z0: z[j + 1], z1: z[j], col: i, row: j });
  return { fills, frame };
}
