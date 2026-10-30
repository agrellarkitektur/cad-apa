import type { Vec2 } from '../../repr/primitives';
import { railValues, type RailingTypeModel, type RailPart } from '../../core/railingTypes';
import { freePath, railingBody, withExtension, type BodyOptions, type GroundFn, type RailingBody, type RailPath } from '../../elements/railingGeometry';
import { escapeHtml } from '../labels';

/**
 * Förhandsvisningen i räckestypeditorn (0.11.2, tavla 4): typen ritad på en
 * rak bit, i en trappa, på en sluttning, vid en grind, i planen och i 3D,
 * med samma geometri som räckena i ritningen (`railingBody`). Varje del
 * har `data-rt-part`, så att ett klick väljer den; den valda är markerad.
 */
export type PreviewMode = 'straight' | 'stair' | 'slope' | 'gate' | 'plan' | '3d';

export const PREVIEW_MODES: readonly [PreviewMode, string][] = [
  ['straight', 'Rak'],
  ['stair', 'I trappa'],
  ['slope', 'På sluttning'],
  ['gate', 'Grind'],
  ['plan', 'Planen'],
  ['3d', '3D'],
];

const f = (v: number) => (Math.round(v * 10) / 10).toString();
const pts = (list: Vec2[]) => list.map((p) => `${f(p[0])},${f(p[1])}`).join(' ');

interface Canvas {
  out: string[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const canvas = (): Canvas => ({ out: [], minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
function grow(c: Canvas, list: Vec2[]): void {
  for (const [x, y] of list) {
    c.minX = Math.min(c.minX, x);
    c.maxX = Math.max(c.maxX, x);
    c.minY = Math.min(c.minY, y);
    c.maxY = Math.max(c.maxY, y);
  }
}

const cls = (part: RailPart, sel: string | null, extra = '') => `class="rtp-part rtp-${part.kind}${part.id === sel ? ' on' : ''}${extra}" data-rt-part="${escapeHtml(part.id)}"`;

function poly(c: Canvas, part: RailPart, sel: string | null, list: Vec2[]): void {
  grow(c, list);
  c.out.push(`<polygon ${cls(part, sel)} points="${pts(list)}"><title>${escapeHtml(part.name)}</title></polygon>`);
}

function finish(c: Canvas, mode: PreviewMode, note = ''): string {
  if (!Number.isFinite(c.minX)) return '<p class="note">Typen har inga delar att visa.</p>';
  const pad = Math.max(c.maxX - c.minX, c.maxY - c.minY) * 0.06 + 40;
  const vb = [c.minX - pad, c.minY - pad, c.maxX - c.minX + 2 * pad, c.maxY - c.minY + 2 * pad].map(f).join(' ');
  return `<svg class="rtp rtp-mode-${mode}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Förhandsvisning">${c.out.join('')}</svg>${note ? `<p class="note rtp-note">${note}</p>` : ''}`;
}

/** Referenslinjen (golvet, stegnoslinjen, marken) i en vy från sidan. */
function ground(c: Canvas, list: Vec2[], extra = ''): void {
  grow(c, list);
  c.out.push(`<polyline class="rtp-ground${extra}" points="${pts(list)}"/>`);
}

/** Delarna sedda från sidan (x längs linjen, y = −höjd). `only` begränsar till vissa delar. */
function elevation(c: Canvas, body: RailingBody, sel: string | null, only?: (p: RailPart) => boolean): void {
  const ok = (p: RailPart) => !only || only(p);
  for (const q of body.panels) if (ok(q.part)) poly(c, q.part, sel, [[q.a[0], -q.a0], [q.b[0], -q.b0], [q.b[0], -q.b1], [q.a[0], -q.a1]]);
  for (const f of body.footings) {
    if (!ok(f.part)) continue;
    const x = f.at[0];
    grow(c, [[x - f.w / 2, -f.z0], [x + f.w / 2, -f.z1]]);
    c.out.push(`<polygon class="rtp-below" points="${pts([[x - f.w / 2, -f.z0], [x + f.w / 2, -f.z0], [x + f.w / 2, -f.z1], [x - f.w / 2, -f.z1]])}"/>`);
  }
  for (const q of [...body.repeats, ...body.posts]) {
    if (!ok(q.part)) continue;
    const x = q.at[0];
    // Under mark (0.11.3): streckat.
    const g = q.ground !== undefined && q.z0 < q.ground - 1 ? q.ground : null;
    if (g !== null) {
      grow(c, [[x - q.w / 2, -q.z0]]);
      c.out.push(`<polygon class="rtp-below" data-rt-part="${escapeHtml(q.part.id)}" points="${pts([[x - q.w / 2, -q.z0], [x + q.w / 2, -q.z0], [x + q.w / 2, -g], [x - q.w / 2, -g]])}"/>`);
    }
    const z0 = g ?? q.z0;
    poly(c, q.part, sel, [[x - q.w / 2, -z0], [x + q.w / 2, -z0], [x + q.w / 2, -q.z1], [x - q.w / 2, -q.z1]]);
  }
  for (const gp of body.gates) for (const leaf of gp.leaves) elevation(c, leaf.body, sel);
  for (const a of body.along) {
    if (!ok(a.part)) continue;
    const e = withExtension(a);
    const top: Vec2[] = e.pts.map((p, i) => [p[0], -e.top[i]]);
    poly(c, a.part, sel, [...top, ...top.map(([x, y]): Vec2 => [x, y + a.h]).reverse()]);
  }
}

const bodyOf = (line: [number, number][], z: number[], model: RailingTypeModel, vals: ReadonlyMap<string, number>, ground?: GroundFn, opts?: BodyOptions): { path: RailPath; body: RailingBody } | null => {
  const path = freePath({ line, z }, ground);
  return path ? { path, body: railingBody(path, model, vals, opts) } : null;
};

/** Förhandsvisningen som SVG, med typens förvalda värden. */
export function previewMarkup(model: RailingTypeModel, mode: PreviewMode, sel: string | null): string {
  const vals = railValues(model);
  const c = canvas();
  if (mode === 'straight') {
    const r = bodyOf([[0, 0], [3000, 0]], [0, 0], model, vals);
    if (!r) return '';
    ground(c, [[-300, 0], [3300, 0]]);
    elevation(c, r.body, sel);
    return finish(c, mode);
  }
  if (mode === 'stair') {
    // Åtta steg 300 × 168,75; stegnoslinjen genom nosarna, plan före och efter.
    const n = 8;
    const rise = 1350 / n;
    const x0 = 600;
    const steps: Vec2[] = [[-300, 0], [x0, 0]];
    for (let k = 0; k < n; k++) steps.push([x0 + 300 * k, -rise * (k + 1)], [x0 + 300 * (k + 1), -rise * (k + 1)]);
    steps.push([x0 + 300 * n + 600, -1350]);
    // Nosen på steg k ligger i (x0 + 300k, rise · (k + 1)); linjen når golvet ett stegdjup före.
    const r = bodyOf([[0, 0], [x0 - 300, 0], [x0 + 300 * (n - 1), 0], [x0 + 300 * n + 600, 0]], [0, 0, 1350, 1350], model, vals);
    if (!r) return '';
    ground(c, steps, ' rtp-steps');
    elevation(c, r.body, sel);
    return finish(c, mode, 'Höjderna mäts lodrätt från stegnoslinjen.');
  }
  if (mode === 'slope') {
    // Marken stiger 600 på 4 800; räcket mäts från den (som på Platsen).
    const r = bodyOf([[0, 0], [4800, 0]], [0, 0], model, vals, (q) => q[0] / 8);
    if (!r) return '';
    ground(c, [[-300, 300 / 8], [0, 0], [4800, -600], [5100, -637.5]], ' rtp-terrain');
    elevation(c, r.body, sel);
    return finish(c, mode, 'På Platsen mäts höjden från den färdiga marken. Delar med <i>Trappstegat</i> ligger vågrätt i varje fack; det streckade är under mark.');
  }
  if (mode === 'gate') {
    // Staket med en grind 1 000 i mitten (Följer staketet): det som avbryts slutar vid grindstolparna.
    const r = bodyOf([[0, 0], [4200, 0]], [0, 0], model, vals, undefined, { gates: [{ id: 'g', at: 1600, width: 1000 }] });
    if (!r) return '';
    ground(c, [[-300, 0], [4500, 0]]);
    elevation(c, r.body, sel);
    return finish(c, mode, 'En grind som följer staketet. Delar med <i>Vid grind: Avbryts</i> slutar vid grindstolparna; bladet har staketets delar med smala sidstycken. Grindtyper (G01 …) har sina egna delar.');
  }
  if (mode === 'plan') {
    const r = bodyOf([[0, 0], [2400, 0], [2400, 1500]], [0, 0, 0], model, vals);
    if (!r) return '';
    // Y uppåt i planen: y ritas som −y.
    const P = (p: Vec2): Vec2 => [p[0], -p[1]];
    ground(c, r.path.pts.map(P), ' rtp-ref');
    for (const q of r.body.panels) {
      grow(c, [P(q.a), P(q.b)]);
      c.out.push(`<line ${cls(q.part, sel, ' rtp-stroke')} x1="${f(q.a[0])}" y1="${f(-q.a[1])}" x2="${f(q.b[0])}" y2="${f(-q.b[1])}" style="stroke-width:${f(q.t)}px"><title>${escapeHtml(q.part.name)}</title></line>`);
    }
    for (const a of r.body.along) {
      const e = withExtension(a);
      grow(c, e.pts.map(P));
      c.out.push(`<polyline ${cls(a.part, sel, ' rtp-stroke')} points="${pts(e.pts.map(P))}" style="stroke-width:${f(a.w)}px"><title>${escapeHtml(a.part.name)}</title></polyline>`);
    }
    for (const q of [...r.body.repeats, ...r.body.posts]) {
      const [x, y] = P(q.at);
      if (q.round) {
        grow(c, [[x - q.w / 2, y - q.w / 2], [x + q.w / 2, y + q.w / 2]]);
        c.out.push(`<circle ${cls(q.part, sel)} cx="${f(x)}" cy="${f(y)}" r="${f(q.w / 2)}"><title>${escapeHtml(q.part.name)}</title></circle>`);
        continue;
      }
      const u: Vec2 = [q.dir[0], -q.dir[1]];
      const v: Vec2 = [-u[1], u[0]];
      const corner = (a: number, b: number): Vec2 => [x + u[0] * a + v[0] * b, y + u[1] * a + v[1] * b];
      poly(c, q.part, sel, [corner(-q.w / 2, -q.d / 2), corner(q.w / 2, -q.d / 2), corner(q.w / 2, q.d / 2), corner(-q.w / 2, q.d / 2)]);
    }
    return finish(c, mode, 'Planen i Detalj; i Skiss och Normal är räcket en linje. Den tunna linjen är referenslinjen.');
  }
  // 3D: isometriskt, längst bort först.
  const r = bodyOf([[0, 0], [2400, 0], [2400, 1500]], [0, 0, 0], model, vals);
  if (!r) return '';
  const C = Math.cos(Math.PI / 6);
  const S = Math.sin(Math.PI / 6);
  const iso = (x: number, y: number, z: number): Vec2 => [(x + y) * C, (y - x) * S - z];
  const items: { d: number; svg: () => void }[] = [];
  ground(c, r.path.pts.map((p) => iso(p[0], p[1], 0)), ' rtp-ref');
  for (const q of r.body.panels) {
    items.push({ d: (q.a[0] - q.a[1] + q.b[0] - q.b[1]) / 2, svg: () => poly(c, q.part, sel, [iso(q.a[0], q.a[1], q.a0), iso(q.b[0], q.b[1], q.b0), iso(q.b[0], q.b[1], q.b1), iso(q.a[0], q.a[1], q.a1)]) });
  }
  for (const q of [...r.body.repeats, ...r.body.posts]) {
    items.push({
      d: q.at[0] - q.at[1],
      svg: () => {
        const a = iso(q.at[0], q.at[1], q.z0);
        const b = iso(q.at[0], q.at[1], q.z1);
        grow(c, [a, b]);
        c.out.push(`<line ${cls(q.part, sel, ' rtp-stroke')} x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" style="stroke-width:${f(q.w)}px"><title>${escapeHtml(q.part.name)}</title></line>`);
      },
    });
  }
  for (const a of r.body.along) {
    const e = withExtension(a);
    for (let i = 1; i < e.pts.length; i++) {
      const p0 = e.pts[i - 1];
      const p1 = e.pts[i];
      if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 1) continue;
      const z0 = e.top[i - 1] - a.h / 2;
      const z1 = e.top[i] - a.h / 2;
      items.push({
        d: (p0[0] - p0[1] + p1[0] - p1[1]) / 2 + 1,
        svg: () => {
          const s = iso(p0[0], p0[1], z0);
          const t = iso(p1[0], p1[1], z1);
          grow(c, [s, t]);
          c.out.push(`<line ${cls(a.part, sel, ' rtp-stroke')} x1="${f(s[0])}" y1="${f(s[1])}" x2="${f(t[0])}" y2="${f(t[1])}" style="stroke-width:${f(Math.max(a.w, a.h))}px" stroke-linecap="${a.round ? 'round' : 'butt'}"><title>${escapeHtml(a.part.name)}</title></line>`);
        },
      });
    }
  }
  // Det som ligger längst bort (litet x − y … stort y) ritas först.
  items.sort((p, q) => q.d - p.d);
  for (const it of items) it.svg();
  return finish(c, mode);
}
