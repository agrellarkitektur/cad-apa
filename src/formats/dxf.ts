/**
 * En liten DXF-läsare (0.8 del 2) för underlag. Läser ASCII-DXF och ger
 * linjerna och texterna i modellrymden som polylinjer och texter i filens
 * egna enheter, med lager. Bågar, cirklar, ellipser, splines och bulter i
 * polylinjer blir korta raka bitar. Block (INSERT och måttens block) packas
 * upp. Det som inte går att rita som linjer (skraffering, bilder, 3D-ytor)
 * hoppas över.
 *
 * Filen beror inte på något annat i programmet och kan användas överallt.
 */

export type P2 = [number, number];

export type DxfItem =
  | { kind: 'poly'; layer: string; pts: P2[]; closed: boolean }
  | { kind: 'text'; layer: string; at: P2; height: number; text: string; angle: number };

export interface DxfDrawing {
  items: DxfItem[];
  /** Lagren, i den ordning de först förekommer. */
  layers: string[];
  /** Omslutande rektangel i filens enheter. Null om filen saknar ritbart innehåll. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  /** Millimeter per enhet i filen ($INSUNITS); 1 om enheten inte är angiven. */
  mmPerUnit: number;
  /** Om enheten stod i filen. */
  unitsKnown: boolean;
}

/** $INSUNITS till millimeter. */
const UNITS: Record<number, number> = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000, 7: 1e6, 8: 0.0000254, 9: 0.0254, 10: 914.4, 14: 100, 15: 10000 };

type Pair = [number, string];

function pairs(text: string): Pair[] {
  const lines = text.split(/\r\n|\r|\n/);
  const out: Pair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i].trim());
    if (!Number.isFinite(code)) continue;
    out.push([code, lines[i + 1]]);
  }
  return out;
}

interface RawEntity {
  type: string;
  codes: Pair[];
  /** POLYLINE: hörnen (VERTEX). */
  vertices?: RawEntity[];
}

/** Dela en följd av par i entiteter (ny vid varje kod 0). */
function entities(ps: Pair[], from: number, to: number): RawEntity[] {
  const out: RawEntity[] = [];
  let cur: RawEntity | null = null;
  let poly: RawEntity | null = null;
  for (let i = from; i < to; i++) {
    const [c, v] = ps[i];
    if (c === 0) {
      const type = v.trim();
      if (poly) {
        if (type === 'VERTEX') {
          cur = { type, codes: [] };
          poly.vertices!.push(cur);
          continue;
        }
        if (type === 'SEQEND') {
          poly = null;
          cur = null;
          continue;
        }
        poly = null;
      }
      cur = { type, codes: [] };
      out.push(cur);
      if (type === 'POLYLINE') {
        cur.vertices = [];
        poly = cur;
      }
      continue;
    }
    cur?.codes.push([c, v]);
  }
  return out;
}

const num = (e: RawEntity, code: number, dflt = 0): number => {
  const p = e.codes.find((x) => x[0] === code);
  const n = p ? Number(p[1]) : NaN;
  return Number.isFinite(n) ? n : dflt;
};
const str = (e: RawEntity, code: number, dflt = ''): string => e.codes.find((x) => x[0] === code)?.[1].trim() ?? dflt;
const all = (e: RawEntity, code: number): number[] => e.codes.filter((x) => x[0] === code).map((x) => Number(x[1]));

/** Ett affint 2D-avbildning: x' = a·x + c·y + e, y' = b·x + d·y + f. */
type M = [number, number, number, number, number, number];
const ID: M = [1, 0, 0, 1, 0, 0];
const apply = (m: M, p: P2): P2 => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

/** Bågen från vinkel a0 till a1 (grader, moturs) som punkter. */
function arcPts(cx: number, cy: number, r: number, a0: number, a1: number): P2[] {
  let sweep = a1 - a0;
  while (sweep <= 0) sweep += 360;
  const n = Math.max(2, Math.min(96, Math.ceil(sweep / 7.5)));
  return Array.from({ length: n + 1 }, (_, i): P2 => {
    const t = ((a0 + (sweep * i) / n) * Math.PI) / 180;
    return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
  });
}

/** Bulten mellan två hörn i en polylinje som punkter (utan startpunkten). */
function bulgePts(a: P2, b: P2, bulge: number): P2[] {
  if (Math.abs(bulge) < 1e-9) return [b];
  const theta = 4 * Math.atan(bulge);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-12) return [b];
  const r = chord / (2 * Math.sin(theta / 2));
  // Mittpunkten ligger vinkelrätt från kordans mitt.
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const h = r * Math.cos(theta / 2);
  const cx = mx - (dy / chord) * h;
  const cy = my + (dx / chord) * h;
  const a0 = Math.atan2(a[1] - cy, a[0] - cx);
  const n = Math.max(2, Math.min(64, Math.ceil(Math.abs(theta) / (Math.PI / 24))));
  const out: P2[] = [];
  for (let i = 1; i <= n; i++) {
    const t = a0 + (theta * i) / n;
    out.push([cx + Math.abs(r) * Math.cos(t), cy + Math.abs(r) * Math.sin(t)]);
  }
  out[out.length - 1] = b;
  return out;
}

/** En B-spline med knutvektor, som punkter (de Boor). */
function bspline(ctrl: P2[], degree: number, knots: number[]): P2[] {
  const n = ctrl.length;
  const p = Math.max(1, Math.min(degree, n - 1));
  if (knots.length !== n + p + 1) {
    // Saknas knutvektorn: en jämn, fastklämd.
    knots = [];
    for (let i = 0; i <= n + p; i++) knots.push(i <= p ? 0 : i >= n ? n - p : i - p);
  }
  const t0 = knots[p];
  const t1 = knots[n];
  const steps = Math.max(8, Math.min(400, n * 10));
  const out: P2[] = [];
  for (let s = 0; s <= steps; s++) {
    const t = s === steps ? t1 - 1e-9 * (t1 - t0) : t0 + ((t1 - t0) * s) / steps;
    let k = p;
    while (k < n - 1 && t >= knots[k + 1]) k++;
    const d = Array.from({ length: p + 1 }, (_, j): P2 => [...ctrl[k - p + j]] as P2);
    for (let r = 1; r <= p; r++) {
      for (let j = p; j >= r; j--) {
        const i = k - p + j;
        const den = knots[i + p - r + 1] - knots[i];
        const a = den === 0 ? 0 : (t - knots[i]) / den;
        d[j] = [(1 - a) * d[j - 1][0] + a * d[j][0], (1 - a) * d[j - 1][1] + a * d[j][1]];
      }
    }
    out.push(d[p]);
  }
  return out;
}

/** MTEXT:s formateringskoder bort, radbrytningar till mellanslag. */
function plainText(s: string): string {
  return s
    .replace(/\\P/g, ' ')
    .replace(/\\[ACFHQTWfhcqtw][^;]*;/g, '')
    .replace(/\\[LlOoKk]/g, '')
    .replace(/\\S([^;]*);/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/%%[cC]/g, 'Ø')
    .replace(/%%[dD]/g, '°')
    .replace(/%%[pP]/g, '±')
    .replace(/\\\\/g, '\\')
    .trim();
}

export function parseDxf(text: string): DxfDrawing {
  const ps = pairs(text);
  // Avsnitten: HEADER, BLOCKS och ENTITIES.
  const sections = new Map<string, [number, number]>();
  for (let i = 0; i < ps.length; i++) {
    if (ps[i][0] === 0 && ps[i][1].trim() === 'SECTION' && ps[i + 1]?.[0] === 2) {
      const name = ps[i + 1][1].trim();
      let j = i + 2;
      while (j < ps.length && !(ps[j][0] === 0 && ps[j][1].trim() === 'ENDSEC')) j++;
      sections.set(name, [i + 2, j]);
      i = j;
    }
  }
  let mmPerUnit = 1;
  let unitsKnown = false;
  const header = sections.get('HEADER');
  if (header) {
    for (let i = header[0]; i < header[1]; i++) {
      if (ps[i][0] === 9 && ps[i][1].trim() === '$INSUNITS') {
        const u = Number(ps[i + 1]?.[1]);
        if (UNITS[u]) {
          mmPerUnit = UNITS[u];
          unitsKnown = true;
        }
      }
    }
  }
  // Blocken: namn → baspunkt och entiteter.
  const blocks = new Map<string, { base: P2; ents: RawEntity[] }>();
  const bs = sections.get('BLOCKS');
  if (bs) {
    const ents = entities(ps, bs[0], bs[1]);
    let cur: { name: string; base: P2; ents: RawEntity[] } | null = null;
    for (const e of ents) {
      if (e.type === 'BLOCK') cur = { name: str(e, 2), base: [num(e, 10), num(e, 20)], ents: [] };
      else if (e.type === 'ENDBLK') {
        if (cur) blocks.set(cur.name, { base: cur.base, ents: cur.ents });
        cur = null;
      } else cur?.ents.push(e);
    }
  }

  const items: DxfItem[] = [];
  const layers: string[] = [];
  const seen = new Set<string>();
  const useLayer = (l: string) => {
    if (!seen.has(l)) {
      seen.add(l);
      layers.push(l);
    }
  };

  const draw = (list: RawEntity[], m: M, parentLayer: string | null, depth: number) => {
    for (const e of list) {
      if (num(e, 67) === 1) continue; // pappersrymden
      // Lager 0 i ett block tar blockets lager.
      let layer = str(e, 8, '0');
      if (layer === '0' && parentLayer) layer = parentLayer;
      // Entiteter med negativ z-extrudering är speglade i x (vanligt för speglade bågar).
      const flip = num(e, 230, 1) < 0;
      const ocs = (p: P2): P2 => (flip ? [-p[0], p[1]] : p);
      const poly = (pts: P2[], closed: boolean) => {
        if (pts.length < 2) return;
        useLayer(layer);
        items.push({ kind: 'poly', layer, pts: pts.map((q) => apply(m, q)), closed });
      };
      switch (e.type) {
        case 'LINE':
          poly([[num(e, 10), num(e, 20)], [num(e, 11), num(e, 21)]], false);
          break;
        case 'LWPOLYLINE': {
          const xs = all(e, 10);
          const ys = all(e, 20);
          // Bulten (42) gäller hörnet före den; följ ordningen i filen.
          const bulges: number[] = new Array(xs.length).fill(0);
          let vi = -1;
          for (const [c, v] of e.codes) {
            if (c === 10) vi++;
            else if (c === 42 && vi >= 0) bulges[vi] = Number(v) || 0;
          }
          const closed = (num(e, 70) & 1) === 1;
          const verts: P2[] = xs.map((x, i) => ocs([x, ys[i] ?? 0]));
          const pts: P2[] = verts.length ? [verts[0]] : [];
          const n = closed ? verts.length : verts.length - 1;
          for (let i = 0; i < n; i++) pts.push(...bulgePts(verts[i], verts[(i + 1) % verts.length], flip ? -bulges[i] : bulges[i]));
          if (closed && pts.length > 1) pts.pop();
          poly(pts, closed);
          break;
        }
        case 'POLYLINE': {
          const flags = num(e, 70);
          if (flags & (16 | 64)) break; // nät och ytor
          const closed = (flags & 1) === 1;
          const vs = (e.vertices ?? []).filter((v) => !(num(v, 70) & 16));
          const verts: P2[] = vs.map((v) => ocs([num(v, 10), num(v, 20)]));
          const bul = vs.map((v) => (flip ? -1 : 1) * num(v, 42));
          const pts: P2[] = verts.length ? [verts[0]] : [];
          const n = closed ? verts.length : verts.length - 1;
          for (let i = 0; i < n; i++) pts.push(...bulgePts(verts[i], verts[(i + 1) % verts.length], bul[i]));
          if (closed && pts.length > 1) pts.pop();
          poly(pts, closed);
          break;
        }
        case 'CIRCLE': {
          const c = ocs([num(e, 10), num(e, 20)]);
          const pts = arcPts(c[0], c[1], num(e, 40), 0, 360);
          pts.pop();
          poly(pts, true);
          break;
        }
        case 'ARC': {
          const c = ocs([num(e, 10), num(e, 20)]);
          let a0 = num(e, 50);
          let a1 = num(e, 51);
          if (flip) [a0, a1] = [180 - a1, 180 - a0];
          poly(arcPts(c[0], c[1], num(e, 40), a0, a1), false);
          break;
        }
        case 'ELLIPSE': {
          const c: P2 = [num(e, 10), num(e, 20)];
          const maj: P2 = [num(e, 11), num(e, 21)];
          const ratio = num(e, 40, 1);
          let t0 = num(e, 41, 0);
          let t1 = num(e, 42, Math.PI * 2);
          while (t1 <= t0) t1 += Math.PI * 2;
          const min: P2 = [-maj[1] * ratio, maj[0] * ratio];
          const n = Math.max(8, Math.min(120, Math.ceil(((t1 - t0) / (Math.PI * 2)) * 72)));
          const pts = Array.from({ length: n + 1 }, (_, i): P2 => {
            const t = t0 + ((t1 - t0) * i) / n;
            return ocs([c[0] + maj[0] * Math.cos(t) + min[0] * Math.sin(t), c[1] + maj[1] * Math.cos(t) + min[1] * Math.sin(t)]);
          });
          const full = Math.abs(t1 - t0 - Math.PI * 2) < 1e-6;
          if (full) pts.pop();
          poly(pts, full);
          break;
        }
        case 'SPLINE': {
          const fx = all(e, 11);
          const fy = all(e, 21);
          const closed = (num(e, 70) & 1) === 1;
          if (fx.length >= 2) {
            poly(fx.map((x, i): P2 => [x, fy[i] ?? 0]), closed);
            break;
          }
          const cx = all(e, 10);
          const cy = all(e, 20);
          const ctrl = cx.map((x, i): P2 => [x, cy[i] ?? 0]);
          if (ctrl.length < 2) break;
          poly(bspline(ctrl, num(e, 71, 3), all(e, 40)), closed);
          break;
        }
        case 'TEXT':
        case 'MTEXT': {
          const raw = e.type === 'MTEXT' ? [...e.codes.filter((x) => x[0] === 3).map((x) => x[1]), str(e, 1)].join('') : str(e, 1);
          const t = plainText(raw);
          if (!t) break;
          // TEXT med justering har sin punkt i 11/21.
          const aligned = e.type === 'TEXT' && (num(e, 72) || num(e, 73)) && e.codes.some((x) => x[0] === 11);
          const at = apply(m, aligned ? [num(e, 11), num(e, 21)] : [num(e, 10), num(e, 20)]);
          // MTEXT kan ha riktningen som vektor (11/21) i stället för vinkel.
          let angle = num(e, 50);
          if (e.type === 'MTEXT' && e.codes.some((x) => x[0] === 11)) angle = (Math.atan2(num(e, 21), num(e, 11)) * 180) / Math.PI;
          const sx = Math.hypot(m[0], m[1]);
          const rot = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
          useLayer(layer);
          items.push({ kind: 'text', layer, at, height: num(e, 40, 2.5) * sx, text: t, angle: angle + rot });
          break;
        }
        case 'INSERT':
        case 'DIMENSION': {
          if (depth > 8) break;
          const b = blocks.get(str(e, 2));
          if (!b) break;
          if (e.type === 'DIMENSION') {
            // Måttets block ligger redan på rätt plats.
            draw(b.ents, m, layer, depth + 1);
            break;
          }
          const ins = ocs([num(e, 10), num(e, 20)]);
          const sx = num(e, 41, 1) * (flip ? -1 : 1);
          const sy = num(e, 42, 1);
          const r = (num(e, 50) * Math.PI) / 180;
          const cos = Math.cos(r);
          const sin = Math.sin(r);
          // Kolumner och rader (70/71, 44/45).
          const cols = Math.max(1, num(e, 70, 1));
          const rows = Math.max(1, num(e, 71, 1));
          for (let ci = 0; ci < cols; ci++)
            for (let ri = 0; ri < rows; ri++) {
              const ox = ins[0] + (cos * num(e, 44) * ci - sin * num(e, 45) * ri);
              const oy = ins[1] + (sin * num(e, 44) * ci + cos * num(e, 45) * ri);
              // Flytta baspunkten till origo, skala, vrid, flytta till insättningspunkten.
              const local: M = mul([cos * sx, sin * sx, -sin * sy, cos * sy, ox, oy], [1, 0, 0, 1, -b.base[0], -b.base[1]]);
              draw(b.ents, mul(m, local), layer, depth + 1);
            }
          break;
        }
        default:
          break;
      }
    }
  };

  const es = sections.get('ENTITIES');
  if (es) draw(entities(ps, es[0], es[1]), ID, null, 0);

  let bounds: DxfDrawing['bounds'] = null;
  for (const it of items) {
    const pts = it.kind === 'poly' ? it.pts : [it.at];
    for (const q of pts) {
      if (!bounds) bounds = { minX: q[0], minY: q[1], maxX: q[0], maxY: q[1] };
      else {
        bounds.minX = Math.min(bounds.minX, q[0]);
        bounds.minY = Math.min(bounds.minY, q[1]);
        bounds.maxX = Math.max(bounds.maxX, q[0]);
        bounds.maxY = Math.max(bounds.maxY, q[1]);
      }
    }
  }
  return { items, layers, bounds, mmPerUnit, unitsKnown };
}
