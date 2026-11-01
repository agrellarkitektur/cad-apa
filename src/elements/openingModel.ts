import type { WallFrame } from '../geometry/wallFrame';
import type { Vec2 } from '../repr/primitives';
import type { Edges3D, EdgePart, Shape3D, Solid } from '../repr/solids';
import { symbolSegments } from '../core/openingSymbol';
import { hardwareOf, hasSash, holeOf, layoutLeaf, leafGridOf, LEAF_OPS, muntinLines, muntinOutline, muntinWidth, standsOnFloor, trimOf, type LaidCell, type OpeningLayout, type OpeningTypeModel, type Rect } from '../core/openingTypes';

/**
 * Dörrar och fönster i 3D, och därmed i fasader och sektioner (0.7.1; ur
 * typens rutnät sedan 0.11.8). Detaljnivån styr vad som finns med:
 *
 * - Skiss: karmens kontur och delningen.
 * - Normal: karm, poster, bågar, blad, glas och öppningssymbolen.
 * - Detalj: dessutom foder, bleck med droppnäsa, fönsterbänk och beslag
 *   (handtag, gångjärnens markering, dörrstängare, brevinkast; 0.11.8.2).
 *
 * Kropparna ritas utan egna kantlinjer; kanterna levereras här, med vilken
 * sorts linje de är, så att fasaden kan ge dem rätt tjocklek. Karmens delar
 * blir på så vis en hel karm, utan skarvar, utom i Detalj.
 */

export type Level = 'sketch' | 'normal' | 'detail';

type P3 = [number, number, number];

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
  box(material: Solid['material'], s0: number, s1: number, o0: number, o1: number, z0: number, z1: number, extra: Partial<Solid> = {}): void {
    const f = this.f;
    this.solids.push({ id: this.id, rings: [[f.at(s0, o0), f.at(s1, o0), f.at(s1, o1), f.at(s0, o1)] as Vec2[]], z0, z1, material, noEdges: true, ...extra });
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
  done(): Shape3D[] {
    return [...this.solids, ...this.edges.values()];
  }
}

/**
 * Fodret på väggens liv på sidan `side` (1 eller −1), runt hålet h1–h2 upp
 * till `zTop`. Med `bottomPiece` går fodret runt hela hålet (under `zLow`),
 * annars är det ett upp- och nedvänt U som börjar vid `zLow` (dörrar, och
 * fönster där bänken eller blecket tar underdelen).
 */
function lining(b: Builder, side: 1 | -1, h1: number, h2: number, zTop: number, zLow: number, bottomPiece: boolean, w: number, T: number, level: Level): void {
  const f = b.f;
  if (w <= 0 || T <= 0) return;
  const o0 = side * f.half;
  const o1 = side * (f.half + T);
  const [oa, ob] = [Math.min(o0, o1), Math.max(o0, o1)];
  const top = zTop + w;
  const bottom = bottomPiece ? zLow - w : zLow;
  b.box('frame', h1 - w, h1, oa, ob, bottom, top);
  b.box('frame', h2, h2 + w, oa, ob, bottom, top);
  b.box('frame', h1, h2, oa, ob, zTop, top);
  if (bottomPiece) b.box('frame', h1, h2, oa, ob, bottom, zLow);
  const open = !bottomPiece;
  b.ring('lining', h1 - w, h2 + w, bottom, top, w, o1, open);
  b.depth('lining', [[h1 - w, top], [h2 + w, top], [h1 - w, bottom], [h2 + w, bottom]], o0, o1);
  if (level === 'detail') b.joints(h1 - w, h2 + w, bottom, top, w, o1, 'mitre', open);
}

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
  /** Stilbokens material för en fyllning i dörrbladet (kulören och nyckeln). */
  mat?: (id: string) => Partial<Solid>;
  /** Nischens sida för ett vägghål (0.11.8.3). */
  niche?: 1 | -1;
}

/**
 * Dörrar, fönster och vägghål i 3D, och därmed i fasader och sektioner
 * (0.11.8): karmen, posterna och tvärstyckena ur typens rutnät, och varje
 * luft för sig (glas i karmen, båge med glas, panel eller dörrblad).
 * Öppningssymbolen (linjerna spretar mot gångjärnssidan, 0.11.8.1) ritas på
 * båda sidor: ställena *öppningssätt* från den sida luften öppnas mot och
 * *öppningssätt, bortre sidan* från den andra.
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
  const box = (mat: Solid['material'], r: Rect, o0: number, o1: number, extra: Partial<Solid> = {}) => {
    const [a, c] = S(r.u0, r.u1);
    if (c - a > 0.5 && r.z1 - r.z0 > 0.5) b.box(mat, a, c, Math.min(o0, o1), Math.max(o0, o1), Z(r.z0), Z(r.z1), extra);
  };
  /** Spröjsen i glaset `gl` (0.11.8.1): kanterna på glasets båda sidor, och lister utanpå glaset när de inte sitter mellan glasen. */
  const muntins = (c: LaidCell, gl: Rect) => {
    if (!c.muntins) return;
    const lines = muntinLines(c.muntins, gl);
    const w = muntinWidth(c.muntins);
    const between = c.muntins.kind === 'between';
    const faces = between ? [mid - 6, mid + 6] : [mid - 18, mid + 18];
    for (const o of faces) for (const [u1, z1, u2, z2] of muntinOutline(lines, w)) b.line('muntin', P(u1, o, z1), P(u2, o, z2));
    if (between) return;
    for (const [u1, z1, u2, z2] of lines) {
      const r: Rect | null = Math.abs(u1 - u2) < 0.5 ? { u0: u1 - w / 2, u1: u1 + w / 2, z0: Math.min(z1, z2), z1: Math.max(z1, z2) } : Math.abs(z1 - z2) < 0.5 ? { u0: Math.min(u1, u2), u1: Math.max(u1, u2), z0: z1 - w / 2, z1: z1 + w / 2 } : null;
      if (r) for (const [o0, o1] of [[mid - 18, mid - 6], [mid + 6, mid + 18]]) box('frame', r, o0, o1);
    }
  };
  const whole: Rect = { u0: 0, u1: L.w, z0: 0, z1: L.h };

  if (m.kind === 'hole') {
    // Väggen skär och ritar hålet; här kanten på liven (så att hålet går att klicka i fasaden) och ventgallret (0.11.8.3).
    const hs = holeOf(m);
    const half = g.f.half;
    const faces = hs.depth === null ? [-half, half] : [g.niche === -1 ? -half : half];
    if (hs.shape === 'round') {
      const r = L.w / 2;
      const n = 32;
      for (const o of faces)
        for (let i = 0; i < n; i++) {
          const a = (2 * Math.PI * i) / n;
          const c = (2 * Math.PI * (i + 1)) / n;
          b.line('hole', P(r + r * Math.cos(a), o, L.h / 2 + r * Math.sin(a)), P(r + r * Math.cos(c), o, L.h / 2 + r * Math.sin(c)));
        }
    } else for (const o of faces) rectU('hole', whole, o);
    if (hs.grille && level !== 'sketch') {
      // En tunn platta i livet på utsidan, med lameller var 25 mm i fasaden.
      const face = (g.outside !== 0 ? g.outside : g.vf) * half;
      const inner = face - Math.sign(face) * 8;
      box('frame', whole, face, inner);
      const w = Math.min(12, L.w / 6, L.h / 6);
      rectU('frame', { u0: w, u1: L.w - w, z0: w, z1: L.h - w }, face);
      for (let z = w + 25; z < L.h - w - 5; z += 25) b.line('frame', P(w, face, z), P(L.w - w, face, z));
    }
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
      // Dörrbladet i karmens liv på slagsidan, med indelningen (0.11.8.1): ramstyckena hela bladets tjocklek, fyllningarna tunnare i mitten.
      const back = leafFace - g.swing * m.leaf;
      const grid = leafGridOf(c);
      const lm = (leafFace + back) / 2;
      if (!grid) box('door', r, leafFace, back);
      else {
        const laid = layoutLeaf(grid, r);
        for (const fr of laid.frame) box('door', fr, leafFace, back);
        for (const fl of laid.fills) {
          if (fl.glass) box('glass', fl.rect, lm - 6, lm + 6);
          else box('door', fl.rect, lm - 8, lm + 8, fl.material && g.mat ? g.mat(fl.material) : {});
        }
      }
      for (const o of [leafFace, back]) {
        rectU('leaf', r, o);
        if (!grid) continue;
        for (const fl of layoutLeaf(grid, r).fills) {
          rectU('leaf', fl.rect, o);
          if (fl.glass) glassMarkU(b, g, fl.rect, o);
          // Spegelns profil (0.11.8.2): en fas 15 mm innanför kanten, i Detalj.
          else if (level === 'detail' && !fl.flat && fl.rect.u1 - fl.rect.u0 > 60 && fl.rect.z1 - fl.rect.z0 > 60) rectU('leaf', { u0: fl.rect.u0 + 15, u1: fl.rect.u1 - 15, z0: fl.rect.z0 + 15, z1: fl.rect.z1 - 15 }, o);
        }
      }
      if (level === 'detail') leafHardware(b, g, c, leafFace, back);
    } else if (c.fill === 'panel') {
      box('door', r, mid - 15, mid + 15, c.material && g.mat ? g.mat(c.material) : {});
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
      muntins(c, inner);
      if (level === 'detail') sashHardware(b, g, c, w, g.vf === 1 ? so0 : so1, g.vf === 1 ? so1 : so0);
    } else {
      box('glass', r, mid - 6, mid + 6);
      for (const o of [mid - 6, mid + 6]) glassMarkU(b, g, r, o);
      muntins(c, r);
    }
    if (g.showSwing && c.op !== 'fixed') {
      const outward = LEAF_OPS.has(c.op) ? g.swing === g.vf : !c.inward;
      symbol(b, g, c, oOut, !outward);
      symbol(b, g, c, oIn, outward);
    }
  }

  if (level === 'detail') trimAndHardware(b, g);
  return b.done();
}

/** Glasmarkeringen i en ruta (u, z). */
function glassMarkU(b: Builder, g: OpeningGeom, r: Rect, o: number): void {
  const [a, c] = [g.u(r.u0), g.u(r.u1)];
  if (Math.abs(c - a) < 120 || r.z1 - r.z0 < 120) return;
  b.glassMark(Math.min(a, c), Math.max(a, c), g.z0 + r.z0, g.z0 + r.z1, o);
}

/** Ett litet rätblock med kanterna (beslag): u0–u1 längs karmen, z0–z1, från `o` ut till `o1`. */
function fitting(b: Builder, g: OpeningGeom, u0: number, u1: number, z0: number, z1: number, o: number, o1: number, solid = true): void {
  const [a, e] = [Math.min(g.u(u0), g.u(u1)), Math.max(g.u(u0), g.u(u1))];
  if (solid) b.box('frame', a, e, Math.min(o, o1), Math.max(o, o1), z0, z1);
  b.rect('handle', a, e, z0, z1, o1);
}

/**
 * Dörrbladets beslag (0.11.8.2): handtaget på låssidan på bladets båda
 * sidor (trycke eller draghandtag, typens höjd), gångjärnen som markering
 * på slagsidan (två, 100 från över- och underkant), dörrstängaren överst på
 * slagsidan och brevinkastet mitt på bladet.
 */
function leafHardware(b: Builder, g: OpeningGeom, c: LaidCell, face: number, back: number): void {
  const hw = hardwareOf(g.model);
  const r = c.rect;
  const hinged = c.op === 'leaf' || c.op === 'foldLeaf';
  const hingeLeft = c.hinge !== 'right';
  const hingeU = hingeLeft ? r.u0 : r.u1;
  const dir = hingeLeft ? 1 : -1;
  const out = (o: number) => (o === face ? g.swing : -g.swing);
  const Z = (z: number) => g.z0 + z;
  if (hw.handle !== 'none' && (hinged || c.op === 'slideLeaf' || c.op === 'pocket')) {
    const lock = hinged ? (hingeLeft ? r.u1 : r.u0) : hingeLeft ? r.u1 : r.u0;
    const u = lock - dir * 70;
    for (const o of [face, back]) {
      if (hw.handle === 'pull') fitting(b, g, u - 12, u + 12, hw.handleHeight - 150, hw.handleHeight + 150, o, o + out(o) * 60);
      else fitting(b, g, u, u - dir * 130, hw.handleHeight, hw.handleHeight + 20, o, o + out(o) * 55);
    }
  }
  if (hw.hinges && hinged && r.z1 - r.z0 > 500)
    for (const [z0, z1] of [[r.z1 - 180, r.z1 - 100], [r.z0 + 100, r.z0 + 180]]) fitting(b, g, hingeU - 8, hingeU + 8, Z(z0), Z(z1), face, face + g.swing * 4, false);
  if (hw.closer && hinged) fitting(b, g, hingeU + dir * 60, hingeU + dir * 340, Z(r.z1 - 85), Z(r.z1 - 30), face, face + g.swing * 50);
  if (hw.letterbox && r.u1 - r.u0 > 400) {
    const m = (r.u0 + r.u1) / 2;
    for (const o of [face, back]) fitting(b, g, m - 150, m + 150, 850 - 22, 850 + 22, o, o + out(o) * 3, false);
  }
}

/**
 * En fönsterbåges beslag (0.11.8.2): handtaget inne på låssidan, mitt på
 * höjden (sidohängda, dreh-kipp, skjut), nertill (överkantshängda, pivå)
 * eller upptill (underkantshängda); gångjärnen som markering på den sida
 * bågen öppnas mot.
 */
function sashHardware(b: Builder, g: OpeningGeom, c: LaidCell, w: number, inner: number, outer: number): void {
  const hw = hardwareOf(g.model);
  const r = c.rect;
  const Z = (z: number) => g.z0 + z;
  const inside = -g.vf;
  const midU = (r.u0 + r.u1) / 2;
  const midZ = (r.z0 + r.z1) / 2;
  const hingeLeft = c.hinge !== 'right';
  if (hw.handle !== 'none') {
    const o1 = inner + inside * 40;
    if (c.op === 'side' || c.op === 'tiltturn' || c.op === 'slide' || c.op === 'pivotV') {
      const u = c.op === 'pivotV' ? r.u1 - w / 2 : hingeLeft ? r.u1 - w / 2 : r.u0 + w / 2;
      fitting(b, g, u - 12, u + 12, Z(midZ - 60), Z(midZ + 60), inner, o1);
    } else if (c.op === 'top' || c.op === 'pivotH' || c.op === 'bottom') {
      const z = c.op === 'bottom' ? r.z1 - w / 2 : r.z0 + w / 2;
      fitting(b, g, midU - 60, midU + 60, Z(z - 12), Z(z + 12), inner, o1);
    }
  }
  if (hw.hinges && (c.op === 'side' || c.op === 'tiltturn') && r.z1 - r.z0 > 400) {
    const face = c.inward ? inner : outer;
    const u = hingeLeft ? r.u0 : r.u1;
    for (const [z0, z1] of [[r.z1 - 180, r.z1 - 100], [r.z0 + 100, r.z0 + 180]]) fitting(b, g, u - 6, u + 6, Z(z0), Z(z1), face, face + (c.inward ? inside : g.vf) * 3, false);
  }
}

/**
 * Foder, bleck och fönsterbänk i Detalj (0.11.8.2, ur typen). Fodret på de
 * sidor typen säger; i ytterväggar blecket med droppnäsa ute och bänken
 * inne, som då tar fodrets underdel på sin sida. Det som står på golvet
 * (dörrar, fönsterdörren) har fodret som ett U.
 */
function trimAndHardware(b: Builder, g: OpeningGeom): void {
  const m = g.model;
  const t = trimOf(m);
  const f = g.f;
  const floor = standsOnFloor(m);
  const outSide = (g.outside !== 0 ? g.outside : g.vf) as 1 | -1;
  const lined = (s: 1 | -1) => t.lining.sides === 'both' || (t.lining.sides === 'out' && s === outSide) || (t.lining.sides === 'in' && s === -outSide);
  const w = t.lining.width;
  const flashing = !floor && g.outside !== 0 ? t.flashing : null;
  const board = !floor && g.outside !== 0 ? t.board : null;
  for (const s of [1, -1] as const) {
    const flashHere = !!flashing && s === g.outside;
    const boardHere = !!board && s === -g.outside;
    if (!lined(s)) continue;
    const zLow = floor ? 0 : flashHere || boardHere ? g.z0 : g.holeBottom;
    lining(b, s, g.h1, g.h2, g.holeTop, zLow, !floor && !flashHere && !boardHere, w, t.lining.thickness, 'detail');
  }
  // Blecket: en plåt från karmens utsida förbi väggens liv, med droppnäsan nedåt längst ut.
  if (flashing) {
    const s = g.outside as 1 | -1;
    const karm = s === 1 ? g.hi : g.lo;
    const tip = s * (f.half + flashing.overhang);
    const ext = (lined(s) ? w : 0) + 10;
    const [s0, s1] = [g.h1 - ext, g.h2 + ext];
    // Lutningen (0.11.8.3): plåten faller utåt från karmen, droppnäsan hänger från den lägre änden.
    const drop = Math.abs(tip - karm) * Math.tan((Math.max(0, Math.min(45, flashing.slope)) * Math.PI) / 180);
    const zTip = g.z0 - drop;
    if (drop < 0.5) b.box('frame', s0, s1, Math.min(karm, tip), Math.max(karm, tip), g.z0 - 2, g.z0);
    else {
      const top = planeAlong(b, karm, g.z0, tip, zTip);
      b.box('frame', s0, s1, Math.min(karm, tip), Math.max(karm, tip), zTip - 2, g.z0, { top, bottom: [top[0], top[1], top[2] - 2] });
    }
    if (flashing.drip > 0) b.box('frame', s0, s1, Math.min(tip, tip - s * 2), Math.max(tip, tip - s * 2), zTip - flashing.drip, zTip);
    b.rect('sill', s0, s1, zTip - Math.max(2, flashing.drip), zTip, tip);
    for (const sx of [s0, s1]) b.line('sill', b.pt(sx, karm, g.z0), b.pt(sx, tip, zTip));
  }
  // Bänken: från karmens insida förbi väggens liv, 20 mm förbi fodret i ändarna.
  if (board) {
    const s = -g.outside as 1 | -1;
    const karm = s === 1 ? g.hi : g.lo;
    const tip = s * (f.half + board.overhang);
    const ext = (lined(s) ? w : 0) + 20;
    const [s0, s1] = [g.h1 - ext, g.h2 + ext];
    b.box('frame', s0, s1, Math.min(karm, tip), Math.max(karm, tip), g.z0 - board.thickness, g.z0);
    b.rect('board', s0, s1, g.z0 - board.thickness, g.z0, tip);
    b.depth('board', [[s0, g.z0], [s1, g.z0], [s0, g.z0 - board.thickness], [s1, g.z0 - board.thickness]], karm, tip);
  }
}

/**
 * Planet z = a·x + b·y + c genom väggens längdriktning som går från höjden
 * `za` vid djupet `oa` till `zb` vid `ob` (det lutande blecket).
 */
function planeAlong(b: Builder, oa: number, za: number, ob: number, zb: number): [number, number, number] {
  const p = b.f.at(0, oa);
  const q = b.f.at(0, ob);
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const L2 = dx * dx + dy * dy || 1;
  const k = (zb - za) / L2;
  const a = k * dx;
  const bb = k * dy;
  return [a, bb, za - a * p[0] - bb * p[1]];
}

/** Öppningssymbolen för en luft (`symbolSegments`): på den sida luften öppnas mot `swing`, på den andra `swingFar` (egna ställen i fasaden). */
function symbol(b: Builder, g: OpeningGeom, c: LaidCell, o: number, far: boolean): void {
  for (const [u1, z1, u2, z2] of symbolSegments(c)) b.line(far ? 'swingFar' : 'swing', b.pt(g.u(u1), o, g.z0 + z1), b.pt(g.u(u2), o, g.z0 + z2), { drawingOnly: true });
}
