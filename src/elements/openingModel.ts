import type { WallFrame } from '../geometry/wallFrame';
import type { Vec2 } from '../repr/primitives';
import type { Edges3D, EdgePart, Shape3D, Solid } from '../repr/solids';
import { hasSash, LEAF_OPS, type LaidCell, type OpeningLayout, type OpeningTypeModel, type Rect } from '../core/openingTypes';

/**
 * Dörrar och fönster i 3D, och därmed i fasader och sektioner (0.7.1; ur
 * typens rutnät sedan 0.11.8). Detaljnivån styr vad som finns med:
 *
 * - Skiss: karmens kontur och delningen.
 * - Normal: karm, poster, bågar, blad, glas och öppningssymbolen.
 * - Detalj: dessutom handtag, foder och fönsterbleck (mer i 0.11.8.1).
 *
 * Kropparna ritas utan egna kantlinjer; kanterna levereras här, med vilken
 * sorts linje de är, så att fasaden kan ge dem rätt tjocklek. Karmens delar
 * blir på så vis en hel karm, utan skarvar, utom i Detalj.
 */

export type Level = 'sketch' | 'normal' | 'detail';

type P3 = [number, number, number];

/** Fodrets bredd och tjocklek, mm. */
export const LINING = 70;
const LINING_T = 15;

class Builder {
  readonly solids: Solid[] = [];
  readonly edges = new Map<string, Edges3D>();
  readonly id: string;
  readonly f: WallFrame;
  constructor(id: string, f: WallFrame) {
    this.id = id;
    this.f = f;
  }
  pt(s: number, o: number, z: number): P3 {
    const q = this.f.at(s, o);
    return [q[0], q[1], z];
  }
  line(part: EdgePart, a: P3, b: P3, extra: Partial<Edges3D> = {}): void {
    const key = `${part}|${extra.dash ? 'd' : ''}|${extra.drawingOnly ? 'o' : ''}`;
    let e = this.edges.get(key);
    if (!e) this.edges.set(key, (e = { kind: 'edges', id: this.id, segments: [], part, ...extra }));
    e.segments.push([...a, ...b]);
  }
  /** En rektangel i ett plan parallellt med väggen (o fast). */
  rect(part: EdgePart, s0: number, s1: number, z0: number, z1: number, o: number, extra: Partial<Edges3D> = {}): void {
    const c = [this.pt(s0, o, z0), this.pt(s1, o, z0), this.pt(s1, o, z1), this.pt(s0, o, z1)];
    for (let i = 0; i < 4; i++) this.line(part, c[i], c[(i + 1) % 4], extra);
  }
  /** En låda (s × o × z) utan egna kantlinjer. */
  box(material: Solid['material'], s0: number, s1: number, o0: number, o1: number, z0: number, z1: number): void {
    const f = this.f;
    this.solids.push({ id: this.id, rings: [[f.at(s0, o0), f.at(s1, o0), f.at(s1, o1), f.at(s0, o1)] as Vec2[]], z0, z1, material, noEdges: true });
  }
  /** Kanter genom djupet i ett antal hörn. */
  depth(part: EdgePart, pts: [number, number][], o0: number, o1: number): void {
    for (const [s, z] of pts) this.line(part, this.pt(s, o0, z), this.pt(s, o1, z));
  }
  /** En ram med bredd w i ett plan, ytter- och innerkontur (karm, båge, foder). */
  ring(part: EdgePart, s0: number, s1: number, z0: number, z1: number, w: number, o: number, open = false): void {
    if (open) {
      // Utan underdel (dörrkarm, dörrfoder): ett upp- och nedvänt U.
      const outer = [this.pt(s0, o, z0), this.pt(s0, o, z1), this.pt(s1, o, z1), this.pt(s1, o, z0)];
      const inner = [this.pt(s0 + w, o, z0), this.pt(s0 + w, o, z1 - w), this.pt(s1 - w, o, z1 - w), this.pt(s1 - w, o, z0)];
      for (const r of [outer, inner]) for (let i = 0; i < 3; i++) this.line(part, r[i], r[i + 1]);
      this.line(part, outer[0], inner[0]);
      this.line(part, outer[3], inner[3]);
    } else {
      this.rect(part, s0, s1, z0, z1, o);
      this.rect(part, s0 + w, s1 - w, z0 + w, z1 - w, o);
    }
  }
  /** Sammanfogningar i en rams hörn: stumt (karm) eller i gering (båge, foder). */
  joints(s0: number, s1: number, z0: number, z1: number, w: number, o: number, kind: 'butt' | 'mitre', open = false): void {
    if (kind === 'mitre') {
      const c: [number, number, number, number][] = [
        [s0, z1, s0 + w, z1 - w],
        [s1, z1, s1 - w, z1 - w],
      ];
      if (!open) c.push([s0, z0, s0 + w, z0 + w], [s1, z0, s1 - w, z0 + w]);
      for (const [a, b, c2, d] of c) this.line('joint', this.pt(a, o, b), this.pt(c2, o, d));
    } else {
      // Överstycket (och nederstycket) går hela bredden; sidorna stöter mot dem.
      this.line('joint', this.pt(s0, o, z1 - w), this.pt(s0 + w, o, z1 - w));
      this.line('joint', this.pt(s1 - w, o, z1 - w), this.pt(s1, o, z1 - w));
      if (!open) {
        this.line('joint', this.pt(s0, o, z0 + w), this.pt(s0 + w, o, z0 + w));
        this.line('joint', this.pt(s1 - w, o, z0 + w), this.pt(s1, o, z0 + w));
      }
    }
  }
  /** Glasmarkering: tre tunna, grå snedstreck mitt i glaset. */
  glassMark(s0: number, s1: number, z0: number, z1: number, o: number): void {
    const cs = (s0 + s1) / 2;
    const cz = (z0 + z1) / 2;
    const L = Math.max(60, Math.min(220, 0.16 * Math.min(s1 - s0, z1 - z0)));
    const gap = L * 0.32;
    [-1, 0, 1].forEach((k) => {
      const l = k === 0 ? L : L * 0.7;
      // 45° i fasadens plan, förskjutna vinkelrätt mot strecken.
      const ds = (l / 2) * Math.SQRT1_2;
      const os = k * gap * Math.SQRT1_2;
      this.line('glass', this.pt(cs - ds + os, o, cz - ds - os), this.pt(cs + ds + os, o, cz + ds - os), { drawingOnly: true });
    });
  }
  /** Öppningssätt: streckade linjer från gångjärnssidans hörn till mitten av andra sidan. */
  swing(sHinge: number, sFree: number, z0: number, z1: number, os: number[]): void {
    for (const o of os) {
      const mid = this.pt(sFree, o, (z0 + z1) / 2);
      this.line('swing', this.pt(sHinge, o, z1), mid, { dash: [3, 1.5], drawingOnly: true });
      this.line('swing', this.pt(sHinge, o, z0), mid, { dash: [3, 1.5], drawingOnly: true });
    }
  }
  done(): Shape3D[] {
    return [...this.solids, ...this.edges.values()];
  }
}

/** Fodret runt hålet på väggens båda liv. */
function linings(b: Builder, h1: number, h2: number, zTop: number, zBottom: number | null, level: Level): void {
  const f = b.f;
  for (const side of [1, -1]) {
    const o0 = side * f.half;
    const o1 = side * (f.half + LINING_T);
    const w = LINING;
    const top = zTop + w;
    const bottom = zBottom === null ? 0 : zBottom - w;
    b.box('frame', h1 - w, h1, o0, o1, bottom, top);
    b.box('frame', h2, h2 + w, o0, o1, bottom, top);
    b.box('frame', h1, h2, o0, o1, zTop, top);
    if (zBottom !== null) b.box('frame', h1, h2, o0, o1, bottom, zBottom);
    const open = zBottom === null;
    b.ring('lining', h1 - w, h2 + w, bottom, top, w, o1, open);
    b.depth('lining', open ? [[h1 - w, top], [h2 + w, top], [h1 - w, 0], [h2 + w, 0]] : [[h1 - w, top], [h2 + w, top], [h1 - w, bottom], [h2 + w, bottom]], o0, o1);
    if (level === 'detail') b.joints(h1 - w, h2 + w, bottom, top, w, o1, 'mitre', open);
  }
}

/** Öppningssymbolens streckning på papperet, mm. */
const SWING_DASH = [3, 1.5] as const;

export interface OpeningGeom {
  f: WallFrame;
  /** Karmens djupzon (avstånd från väggens mittlinje). */
  lo: number;
  hi: number;
  /** Hålets ändar längs väggen och höjder. */
  h1: number;
  h2: number;
  holeBottom: number;
  holeTop: number;
  /** Karmens underkant. */
  z0: number;
  layout: OpeningLayout;
  model: OpeningTypeModel;
  /** Från karmens u (vänster sett utifrån) till läget längs väggen. */
  u: (u: number) => number;
  /** Sidan öppningen ses ifrån (utsidan). */
  vf: 1 | -1;
  /** Dörrens slagsida. */
  swing: 1 | -1;
  /** Ytterväggens utsida (för blecket), 0 i innerväggar. */
  outside: 1 | -1 | 0;
  showSwing: boolean;
}

/**
 * Dörrar, fönster och vägghål i 3D, och därmed i fasader och sektioner
 * (0.11.8): karmen, posterna och tvärstyckena ur typens rutnät, och varje
 * luft för sig (glas i karmen, båge med glas, panel eller dörrblad).
 * Öppningssymbolen (triangeln med spetsen mot gångjärnssidan) ritas på båda
 * sidor: heldragen från den sida luften öppnas mot, streckad från den andra.
 */
export function openingModel3d(id: string, g: OpeningGeom, level: Level): Shape3D[] {
  const b = new Builder(id, g.f);
  const L = g.layout;
  const m = g.model;
  const S = (u0: number, u1: number): [number, number] => {
    const a = g.u(u0);
    const c = g.u(u1);
    return [Math.min(a, c), Math.max(a, c)];
  };
  const Z = (z: number) => g.z0 + z;
  const mid = (g.lo + g.hi) / 2;
  const P = (u: number, o: number, z: number) => b.pt(g.u(u), o, Z(z));
  const rectU = (part: EdgePart, r: Rect, o: number, extra: Partial<Edges3D> = {}) => {
    const c = [P(r.u0, o, r.z0), P(r.u1, o, r.z0), P(r.u1, o, r.z1), P(r.u0, o, r.z1)];
    for (let i = 0; i < 4; i++) b.line(part, c[i], c[(i + 1) % 4], extra);
  };
  const box = (mat: Solid['material'], r: Rect, o0: number, o1: number) => {
    const [a, c] = S(r.u0, r.u1);
    if (c - a > 0.5 && r.z1 - r.z0 > 0.5) b.box(mat, a, c, Math.min(o0, o1), Math.max(o0, o1), Z(r.z0), Z(r.z1));
  };
  const whole: Rect = { u0: 0, u1: L.w, z0: 0, z1: L.h };

  if (m.kind === 'hole') {
    // Ett rent hål: väggen ritar hålet; här bara kanten i fasaden.
    for (const o of [g.lo, g.hi]) rectU('hole', whole, o);
    return b.done();
  }

  if (level === 'sketch') {
    // Karmens yttre kontur och delningen, med en skiva i karmens läge så att man inte ser in i huset.
    box(m.kind === 'door' ? 'door' : 'glass', whole, mid - 6, mid + 6);
    for (const o of [g.lo, g.hi]) {
      rectU('frame', whole, o);
      for (const r of L.mullions) b.line('frame', P((r.u0 + r.u1) / 2, o, r.z0), P((r.u0 + r.u1) / 2, o, r.z1));
      for (const r of L.transoms) b.line('frame', P(r.u0, o, (r.z0 + r.z1) / 2), P(r.u1, o, (r.z0 + r.z1) / 2));
    }
    return b.done();
  }

  // Karmen, posterna och tvärstyckena genom hela djupet.
  for (const r of [...L.frame, ...L.mullions, ...L.transoms]) box('frame', r, g.lo, g.hi);
  for (const o of [g.lo, g.hi]) {
    rectU('frame', whole, o);
    for (const c of L.cells) rectU('frame', c.rect, o);
  }
  for (const [u, z] of [[0, 0], [L.w, 0], [0, L.h], [L.w, L.h]] as const) b.line('frame', P(u, g.lo, z), P(u, g.hi, z));

  const oOut = (g.vf === 1 ? g.hi : g.lo) + g.vf;
  const oIn = (g.vf === 1 ? g.lo : g.hi) - g.vf;
  const leafFace = g.swing === 1 ? g.hi : g.lo;
  for (const c of L.cells) {
    const r = c.rect;
    if (c.fill === 'open' && !LEAF_OPS.has(c.op)) continue;
    if (LEAF_OPS.has(c.op)) {
      // Dörrbladet i karmens liv på slagsidan.
      const back = leafFace - g.swing * m.leaf;
      box('door', r, leafFace, back);
      for (const o of [leafFace, back]) {
        rectU('leaf', r, o);
        const w = r.u1 - r.u0;
        if (c.leaf === 'glazed') {
          const gl: Rect = { u0: r.u0 + Math.min(150, w * 0.2), u1: r.u1 - Math.min(150, w * 0.2), z0: r.z0 + Math.min(400, (r.z1 - r.z0) * 0.25), z1: r.z1 - 150 };
          rectU('leaf', gl, o);
          glassMarkU(b, g, gl, o);
        } else if (c.leaf === 'panel') {
          // Spegeldörr: två speglar.
          const inset = Math.min(120, w * 0.15);
          const zMid = r.z0 + (r.z1 - r.z0) * 0.45;
          rectU('leaf', { u0: r.u0 + inset, u1: r.u1 - inset, z0: r.z0 + inset * 1.5, z1: zMid - inset / 2 }, o);
          rectU('leaf', { u0: r.u0 + inset, u1: r.u1 - inset, z0: zMid + inset / 2, z1: r.z1 - inset }, o);
        }
      }
      if (level === 'detail' && c.op === 'leaf') handle(b, g, c, leafFace, back);
    } else if (c.fill === 'panel') {
      box('door', r, mid - 15, mid + 15);
      for (const o of [mid - 15, mid + 15]) rectU('leaf', r, o);
    } else if (hasSash(c)) {
      const sd = Math.min(m.sashDepth, g.hi - g.lo);
      const so0 = mid - sd / 2;
      const so1 = mid + sd / 2;
      const w = Math.min(m.sash, (r.u1 - r.u0) / 3, (r.z1 - r.z0) / 3);
      const inner: Rect = { u0: r.u0 + w, u1: r.u1 - w, z0: r.z0 + w, z1: r.z1 - w };
      box('frame', { u0: r.u0, u1: r.u0 + w, z0: r.z0 + w, z1: r.z1 - w }, so0, so1);
      box('frame', { u0: r.u1 - w, u1: r.u1, z0: r.z0 + w, z1: r.z1 - w }, so0, so1);
      box('frame', { u0: r.u0, u1: r.u1, z0: r.z0, z1: r.z0 + w }, so0, so1);
      box('frame', { u0: r.u0, u1: r.u1, z0: r.z1 - w, z1: r.z1 }, so0, so1);
      box('glass', inner, mid - 6, mid + 6);
      for (const o of [so0, so1]) {
        rectU('sash', r, o);
        rectU('sash', inner, o);
      }
      for (const o of [mid - 6, mid + 6]) glassMarkU(b, g, inner, o);
    } else {
      box('glass', r, mid - 6, mid + 6);
      for (const o of [mid - 6, mid + 6]) glassMarkU(b, g, r, o);
    }
    if (g.showSwing && c.op !== 'fixed') {
      const outward = LEAF_OPS.has(c.op) ? g.swing === g.vf : !c.inward;
      symbol(b, g, c, oOut, !outward);
      symbol(b, g, c, oIn, outward);
    }
  }

  if (level === 'detail') {
    const door = g.model.kind === 'door' || g.layout.frame.length < 4;
    linings(b, g.h1, g.h2, g.holeTop, door ? null : g.holeBottom, level);
    // Fönsterbleck av plåt på utsidan.
    if (!door && g.outside !== 0) {
      const side = g.outside;
      const o0 = side * g.f.half;
      const o1 = side * (g.f.half + 60);
      b.box('frame', g.h1 - LINING - 20, g.h2 + LINING + 20, Math.min(o0, o1), Math.max(o0, o1), g.holeBottom - LINING - 25, g.holeBottom - LINING);
      b.rect('sill', g.h1 - LINING - 20, g.h2 + LINING + 20, g.holeBottom - LINING - 25, g.holeBottom - LINING, o1);
    }
  }
  return b.done();
}

/** Glasmarkeringen i en ruta (u, z). */
function glassMarkU(b: Builder, g: OpeningGeom, r: Rect, o: number): void {
  const [a, c] = [g.u(r.u0), g.u(r.u1)];
  if (Math.abs(c - a) < 120 || r.z1 - r.z0 < 120) return;
  b.glassMark(Math.min(a, c), Math.max(a, c), g.z0 + r.z0, g.z0 + r.z1, o);
}

/** Handtag på bladets båda sidor, på låssidan, 1 000 över golvet. */
function handle(b: Builder, g: OpeningGeom, c: LaidCell, face: number, back: number): void {
  const r = c.rect;
  const right = c.hinge !== 'right';
  const u = right ? r.u1 - 70 : r.u0 + 70;
  const u2 = right ? u - 130 : u + 130;
  const [a, e] = [Math.min(g.u(u), g.u(u2)), Math.max(g.u(u), g.u(u2))];
  for (const o of [face, back]) {
    const out = o === face ? g.swing : -g.swing;
    const o1 = o + out * 55;
    b.box('frame', a, e, Math.min(o, o1), Math.max(o, o1), 1000, 1020);
    b.rect('handle', a, e, 1000, 1020, o1);
  }
}

/** Öppningssymbolen för en luft: triangeln med spetsen mot gångjärnen, pilar för skjut, sicksack för vik. */
function symbol(b: Builder, g: OpeningGeom, c: LaidCell, o: number, dashed: boolean): void {
  const r = c.rect;
  const extra: Partial<Edges3D> = { drawingOnly: true, ...(dashed ? { dash: SWING_DASH } : {}) };
  const L = (u1: number, z1: number, u2: number, z2: number) => b.line('swing', b.pt(g.u(u1), o, g.z0 + z1), b.pt(g.u(u2), o, g.z0 + z2), extra);
  const um = (r.u0 + r.u1) / 2;
  const zm = (r.z0 + r.z1) / 2;
  const side = (left: boolean) => {
    const hu = left ? r.u0 : r.u1;
    const fu = left ? r.u1 : r.u0;
    L(fu, r.z0, hu, zm);
    L(fu, r.z1, hu, zm);
  };
  const bottom = () => {
    L(r.u0, r.z1, um, r.z0);
    L(r.u1, r.z1, um, r.z0);
  };
  const top = () => {
    L(r.u0, r.z0, um, r.z1);
    L(r.u1, r.z0, um, r.z1);
  };
  const arrow = (toLeft: boolean, z: number) => {
    const w = r.u1 - r.u0;
    const a = toLeft ? r.u1 - w * 0.2 : r.u0 + w * 0.2;
    const e = toLeft ? r.u0 + w * 0.2 : r.u1 - w * 0.2;
    const k = Math.min(80, w * 0.1) * (toLeft ? 1 : -1);
    L(a, z, e, z);
    L(e, z, e + k, z + Math.abs(k) * 0.6);
    L(e, z, e + k, z - Math.abs(k) * 0.6);
  };
  const left = c.hinge !== 'right';
  switch (c.op) {
    case 'side':
    case 'leaf':
      side(left);
      break;
    case 'tiltturn':
      side(left);
      bottom();
      break;
    case 'bottom':
      bottom();
      break;
    case 'top':
      top();
      break;
    case 'pivotH':
      bottom();
      top();
      break;
    case 'pivotV':
      side(true);
      side(false);
      break;
    case 'slide':
    case 'slideLeaf':
    case 'pocket':
      arrow(left, zm);
      break;
    case 'fold':
    case 'foldLeaf': {
      const n = 4;
      const w = (r.u1 - r.u0) / n;
      for (let i = 0; i < n; i++) L(r.u0 + i * w, i % 2 ? r.z0 + 200 : zm, r.u0 + (i + 1) * w, i % 2 ? zm : r.z0 + 200);
      break;
    }
    case 'garage': {
      const k = Math.min(120, (r.u1 - r.u0) * 0.1);
      L(um, r.z0 + (r.z1 - r.z0) * 0.25, um, r.z1 - (r.z1 - r.z0) * 0.25);
      L(um, r.z1 - (r.z1 - r.z0) * 0.25, um - k, r.z1 - (r.z1 - r.z0) * 0.25 - k);
      L(um, r.z1 - (r.z1 - r.z0) * 0.25, um + k, r.z1 - (r.z1 - r.z0) * 0.25 - k);
      break;
    }
  }
}
