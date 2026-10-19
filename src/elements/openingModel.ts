import type { WallFrame } from '../geometry/wallFrame';
import type { Vec2 } from '../repr/primitives';
import type { Edges3D, EdgePart, Shape3D, Solid } from '../repr/solids';

/**
 * Dörrar och fönster i 3D, och därmed i fasader och sektioner (0.7.1).
 * Detaljnivån styr vad som finns med:
 *
 * - Skiss: bara hålet (väggen ritar det).
 * - Normal: karm, båge, dörrblad, handtag och foder, som en bygglovsfasad.
 * - Detalj: dessutom sammanfogningar, falsar och fönsterbänk.
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
/** Bågens bredd i fasaden och djup, mm. */
const SASH = 45;
const SASH_DEPTH = 60;
/** Falsens bredd, mm. */
const REBATE = 12;

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

export interface DoorGeom {
  f: WallFrame;
  s1: number;
  s2: number;
  h1: number;
  h2: number;
  lo: number;
  hi: number;
  /** Karmens höjd (modulmått − 10). */
  height: number;
  holeTop: number;
  frameWidth: number;
  swing: 1 | -1;
  hinge: 'start' | 'end';
  glazed: boolean;
  leaf: number;
  showSwing: boolean;
}

export function doorModel(id: string, g: DoorGeom, level: Level): Shape3D[] {
  const b = new Builder(id, g.f);
  const { s1, s2, lo, hi, height: H } = g;
  const fw = g.frameWidth;
  const sHinge = g.hinge === 'start' ? s1 + fw : s2 - fw;
  const sFree = g.hinge === 'start' ? s2 - fw : s1 + fw;
  if (level === 'sketch') {
    // Bara hålet; öppningssättet över hela hålet, i väggens båda liv.
    if (g.showSwing) b.swing(g.hinge === 'start' ? g.h1 : g.h2, g.hinge === 'start' ? g.h2 : g.h1, 0, g.holeTop, [g.f.half + 1, -g.f.half - 1]);
    // En skiva i karmens läge, så att man inte ser rakt in i huset.
    b.box('door', g.h1, g.h2, (lo + hi) / 2 - 20, (lo + hi) / 2 + 20, 0, g.holeTop);
    return b.done();
  }
  // Karmen: två sidor och ett överstycke.
  b.box('frame', s1, s1 + fw, lo, hi, 0, H - fw);
  b.box('frame', s2 - fw, s2, lo, hi, 0, H - fw);
  b.box('frame', s1, s2, lo, hi, H - fw, H);
  for (const o of [lo, hi]) b.ring('frame', s1, s2, 0, H, fw, o, true);
  b.depth('frame', [[s1, H], [s2, H], [s1 + fw, H - fw], [s2 - fw, H - fw]], lo, hi);
  // Dörrbladet i karmens liv på öppningssidan.
  const face = g.swing === 1 ? hi : lo;
  const back = face - g.swing * g.leaf;
  const top = H - fw;
  b.box('door', s1 + fw, s2 - fw, Math.min(face, back), Math.max(face, back), 0, top);
  for (const o of [face, back]) b.rect('leaf', s1 + fw, s2 - fw, 0, top, o);
  if (g.glazed) {
    const gw = (s2 - s1 - 2 * fw) * 0.2;
    for (const o of [face, back]) {
      b.rect('leaf', s1 + fw + gw, s2 - fw - gw, 400, top - 250, o);
      b.glassMark(s1 + fw + gw, s2 - fw - gw, 400, top - 250, o);
    }
  }
  // Handtag på bladets båda sidor, på den fria sidan.
  const hs = g.hinge === 'start' ? s2 - fw - 70 : s1 + fw + 70;
  const dir = g.hinge === 'start' ? -1 : 1;
  for (const o of [face, back]) {
    const out = o === face ? g.swing : -g.swing;
    const o0 = o;
    const o1 = o + out * 55;
    b.box('frame', Math.min(hs, hs + dir * 130), Math.max(hs, hs + dir * 130), Math.min(o0, o1), Math.max(o0, o1), 1000, 1020);
    b.rect('handle', Math.min(hs, hs + dir * 130), Math.max(hs, hs + dir * 130), 1000, 1020, o1);
  }
  linings(b, g.h1, g.h2, g.holeTop, null, level);
  if (level === 'detail') {
    for (const o of [lo, hi]) b.joints(s1, s2, 0, H, fw, o, 'butt', true);
    // Falsen: där bladet ligger an mot karmen.
    for (const o of [lo, hi]) {
      b.line('joint', b.pt(s1 + fw - REBATE, o, 0), b.pt(s1 + fw - REBATE, o, H - fw + REBATE));
      b.line('joint', b.pt(s2 - fw + REBATE, o, 0), b.pt(s2 - fw + REBATE, o, H - fw + REBATE));
      b.line('joint', b.pt(s1 + fw - REBATE, o, H - fw + REBATE), b.pt(s2 - fw + REBATE, o, H - fw + REBATE));
    }
  }
  if (g.showSwing) b.swing(sHinge, sFree, 0, top, [face + g.swing * 1, back - g.swing * 1]);
  return b.done();
}

export interface WindowGeom {
  f: WallFrame;
  s1: number;
  s2: number;
  h1: number;
  h2: number;
  lo: number;
  hi: number;
  /** Karmens under- och överkant. */
  z0: number;
  z1: number;
  /** Hålets under- och överkant. */
  holeBottom: number;
  holeTop: number;
  frameWidth: number;
  /** Den sida (1 eller -1) som vetter ut, eller 0 för innerväggar. */
  outside: 1 | -1 | 0;
}

export function windowModel(id: string, g: WindowGeom, level: Level): Shape3D[] {
  const b = new Builder(id, g.f);
  if (level === 'sketch') {
    // Bara hålet, med en ruta i karmens läge så att man inte ser in i huset.
    b.box('glass', g.h1, g.h2, (g.lo + g.hi) / 2 - 6, (g.lo + g.hi) / 2 + 6, g.holeBottom, g.holeTop);
    return b.done();
  }
  const { s1, s2, lo, hi, z0, z1 } = g;
  const fw = g.frameWidth;
  // Karmen: fyra delar; över- och understycket går hela bredden.
  b.box('frame', s1, s1 + fw, lo, hi, z0 + fw, z1 - fw);
  b.box('frame', s2 - fw, s2, lo, hi, z0 + fw, z1 - fw);
  b.box('frame', s1, s2, lo, hi, z0, z0 + fw);
  b.box('frame', s1, s2, lo, hi, z1 - fw, z1);
  for (const o of [lo, hi]) b.ring('frame', s1, s2, z0, z1, fw, o);
  b.depth('frame', [[s1, z0], [s2, z0], [s1, z1], [s2, z1]], lo, hi);
  // Bågar innanför karmen; breda fönster får två.
  const b0 = s1 + fw;
  const b1 = s2 - fw;
  const two = b1 - b0 > 1100;
  const c = (b0 + b1) / 2;
  const mid = (lo + hi) / 2;
  const so0 = mid - SASH_DEPTH / 2;
  const so1 = mid + SASH_DEPTH / 2;
  const sashes: [number, number][] = two
    ? [
        [b0, c],
        [c, b1],
      ]
    : [[b0, b1]];
  const sz0 = z0 + fw;
  const sz1 = z1 - fw;
  for (const [a, e] of sashes) {
    b.box('frame', a, a + SASH, so0, so1, sz0 + SASH, sz1 - SASH);
    b.box('frame', e - SASH, e, so0, so1, sz0 + SASH, sz1 - SASH);
    b.box('frame', a, e, so0, so1, sz0, sz0 + SASH);
    b.box('frame', a, e, so0, so1, sz1 - SASH, sz1);
    b.box('glass', a + SASH, e - SASH, mid - 6, mid + 6, sz0 + SASH, sz1 - SASH);
    for (const o of [so0, so1]) {
      b.ring('sash', a, e, sz0, sz1, SASH, o);
      if (level === 'detail') b.joints(a, e, sz0, sz1, SASH, o, 'mitre');
    }
    b.depth('sash', [[a, sz0], [e, sz0], [a, sz1], [e, sz1]], so0, so1);
    // På glasets båda ytor, så att markeringen syns från båda hållen.
    for (const o of [mid - 6, mid + 6]) b.glassMark(a + SASH, e - SASH, sz0 + SASH, sz1 - SASH, o);
  }
  linings(b, g.h1, g.h2, g.holeTop, g.holeBottom, level);
  if (level === 'detail') {
    for (const o of [lo, hi]) b.joints(s1, s2, z0, z1, fw, o, 'butt');
    // Fönsterbänk av plåt på utsidan.
    if (g.outside !== 0) {
      const side = g.outside;
      const o0 = side * g.f.half;
      const o1 = side * (g.f.half + 60);
      b.box('frame', g.h1 - LINING - 20, g.h2 + LINING + 20, Math.min(o0, o1), Math.max(o0, o1), g.holeBottom - LINING - 25, g.holeBottom - LINING);
      b.rect('sill', g.h1 - LINING - 20, g.h2 + LINING + 20, g.holeBottom - LINING - 25, g.holeBottom - LINING, o1);
    }
  }
  return b.done();
}
