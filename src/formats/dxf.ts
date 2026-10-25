/**
 * En liten DXF-läsare (0.8 del 2) för underlag. Läser ASCII-DXF och ger
 * linjerna och texterna i modellrymden som polylinjer och texter i filens
 * egna enheter, med lager. Bågar, cirklar, ellipser, splines och bulter i
 * polylinjer blir korta raka bitar. Block (INSERT och måttens block) packas
 * upp. Skraffering (HATCH) blir ytor med fyllning eller mönster (0.8.3).
 * Bilder och 3D-ytor hoppas över.
 *
 * Filen beror bara på teckenbredderna i helvetica.ts och kan användas överallt.
 * Skrafferingen och texterna ligger i dxfHatch.ts och dxfText.ts, och
 * läsningen av koderna och kurvorna i dxfCodes.ts (0.8.32).
 */

import { all, arcPts, bspline, bulgePts, entities, num, pairs, str, type P2, type RawEntity } from './dxfCodes';
import { readHatch } from './dxfHatch';
import { textPlacement } from './dxfText';

export type DxfItem =
  | {
      kind: 'poly';
      layer: string;
      pts: P2[];
      closed: boolean;
      /**
       * Hörnen bland punkterna (0.8.16), när några punkter bara följer en båge
       * (bultar, bågar, cirklar). Saknas: alla punkter är hörn.
       */
      corners?: number[];
      /** Bågens eller cirkelns centrum, mittpunkt och kvadrantpunkter, att snäppa till. */
      curve?: { c: P2; mid?: P2; quadrants?: P2[] };
    }
  /**
   * En textrad. `at` är radens baslinje vid `align` (vänster, mitt eller
   * höger), `height` versalhöjden i filens enheter (så mäts texthöjd i
   * DXF). MTEXT med flera stycken blir en rad per stycke.
   */
  | { kind: 'text'; layer: string; at: P2; height: number; text: string; angle: number; align?: 'start' | 'middle' | 'end' }
  /**
   * Skraffering (HATCH, 0.8.3): konturerna (jämn–udda), och antingen solid
   * fyllning eller mönstrets linjefamiljer med riktning (grader) och avstånd
   * mellan linjerna, i filens enheter. Streckade mönsterlinjer blir heldragna.
   */
  | { kind: 'fill'; layer: string; rings: P2[][]; solid: boolean; lines: { angle: number; spacing: number }[] };

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

/** Läs en ASCII-DXF: linjer, texter och skrafferingar i modellrymden, med lager och enhet. */

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
      const poly = (pts: P2[], closed: boolean, corners?: number[], curve?: { c: P2; mid?: P2; quadrants?: P2[] }) => {
        if (pts.length < 2) return;
        useLayer(layer);
        items.push({
          kind: 'poly',
          layer,
          pts: pts.map((q) => apply(m, q)),
          closed,
          ...(corners ? { corners } : {}),
          ...(curve ? { curve: { c: apply(m, curve.c), ...(curve.mid ? { mid: apply(m, curve.mid) } : {}), ...(curve.quadrants ? { quadrants: curve.quadrants.map((q) => apply(m, q)) } : {}) } } : {}),
        });
      };
      /** Hörnen i en polylinje med bultar: index för varje hörn bland punkterna. */
      const bulged = (verts: P2[], bul: number[], closed: boolean) => {
        const pts: P2[] = verts.length ? [verts[0]] : [];
        const corners = verts.length ? [0] : [];
        const n = closed ? verts.length : verts.length - 1;
        for (let i = 0; i < n; i++) {
          pts.push(...bulgePts(verts[i], verts[(i + 1) % verts.length], bul[i]));
          corners.push(pts.length - 1);
        }
        if (closed && pts.length > 1) {
          pts.pop();
          corners.pop();
        }
        poly(pts, closed, bul.some((b) => Math.abs(b) > 1e-9) ? corners : undefined);
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
          bulged(verts, bulges.map((b) => (flip ? -b : b)), closed);
          break;
        }
        case 'POLYLINE': {
          const flags = num(e, 70);
          if (flags & (16 | 64)) break; // nät och ytor
          const closed = (flags & 1) === 1;
          const vs = (e.vertices ?? []).filter((v) => !(num(v, 70) & 16));
          const verts: P2[] = vs.map((v) => ocs([num(v, 10), num(v, 20)]));
          const bul = vs.map((v) => (flip ? -1 : 1) * num(v, 42));
          bulged(verts, bul, closed);
          break;
        }
        case 'CIRCLE': {
          const c = ocs([num(e, 10), num(e, 20)]);
          const r = num(e, 40);
          const pts = arcPts(c[0], c[1], r, 0, 360);
          pts.pop();
          poly(pts, true, [], { c, quadrants: [[c[0] + r, c[1]], [c[0], c[1] + r], [c[0] - r, c[1]], [c[0], c[1] - r]] });
          break;
        }
        case 'ARC': {
          const c = ocs([num(e, 10), num(e, 20)]);
          let a0 = num(e, 50);
          let a1 = num(e, 51);
          if (flip) [a0, a1] = [180 - a1, 180 - a0];
          const r = num(e, 40);
          const pts = arcPts(c[0], c[1], r, a0, a1);
          let sweep = a1 - a0;
          while (sweep <= 0) sweep += 360;
          const am = ((a0 + sweep / 2) * Math.PI) / 180;
          poly(pts, false, [0, pts.length - 1], { c, mid: [c[0] + r * Math.cos(am), c[1] + r * Math.sin(am)] });
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
          const axis = (k: number): P2 => ocs([c[0] + maj[0] * Math.cos(k) + min[0] * Math.sin(k), c[1] + maj[1] * Math.cos(k) + min[1] * Math.sin(k)]);
          poly(pts, full, full ? [] : [0, pts.length - 1], { c: ocs(c), ...(full ? { quadrants: [0, 1, 2, 3].map((k) => axis((k * Math.PI) / 2)) } : {}) });
          break;
        }
        case 'SPLINE': {
          const fx = all(e, 11);
          const fy = all(e, 21);
          const closed = (num(e, 70) & 1) === 1;
          // En spline är en kurva: bara ändarna är punkter att snäppa till.
          const ends = (n: number) => (closed ? [] : [0, n - 1]);
          if (fx.length >= 2) {
            poly(fx.map((x, i): P2 => [x, fy[i] ?? 0]), closed, ends(fx.length));
            break;
          }
          const cx = all(e, 10);
          const cy = all(e, 20);
          const ctrl = cx.map((x, i): P2 => [x, cy[i] ?? 0]);
          if (ctrl.length < 2) break;
          const spline = bspline(ctrl, num(e, 71, 3), all(e, 40));
          poly(spline, closed, ends(spline.length));
          break;
        }
        case 'TEXT':
        case 'MTEXT': {
          const t = textPlacement(e);
          if (!t) break;
          const sx = Math.hypot(m[0], m[1]);
          const rot = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
          useLayer(layer);
          t.lines.forEach((line, i) => {
            if (line) items.push({ kind: 'text', layer, at: apply(m, t.points[i]), height: t.height * sx, text: line, angle: t.angle + rot, align: t.align });
          });
          break;
        }
        case 'HATCH': {
          const h = readHatch(e);
          if (!h || (!h.solid && !h.lines.length)) break;
          // Mönstrets linjer genom samma avbildning som konturerna: riktning
          // och avstånd vinkelrätt mot linjerna (också i speglade block).
          const lin = (v: P2): P2 => {
            const w = ocs(v);
            return [m[0] * w[0] + m[2] * w[1], m[1] * w[0] + m[3] * w[1]];
          };
          const seen = new Set<string>();
          const lines = h.lines.flatMap(({ dir, off }) => {
            const u = lin(dir);
            const len = Math.hypot(u[0], u[1]);
            if (len < 1e-12) return [];
            const o = lin(off);
            const spacing = Math.abs(u[0] * o[1] - u[1] * o[0]) / len;
            const angle = (Math.atan2(u[1], u[0]) * 180) / Math.PI;
            // Streckade familjer med samma riktning och avstånd (tegel) blir en.
            const key = `${(((Math.round(angle * 100) % 18000) + 18000) % 18000)}|${spacing.toFixed(3)}`;
            if (spacing < 1e-9 || seen.has(key)) return [];
            seen.add(key);
            return [{ angle, spacing }];
          });
          if (!h.solid && !lines.length) break;
          useLayer(layer);
          items.push({ kind: 'fill', layer, rings: h.rings.map((r) => r.map((q) => apply(m, ocs(q)))), solid: h.solid, lines });
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
    const pts = it.kind === 'poly' ? it.pts : it.kind === 'fill' ? it.rings.flat() : [it.at];
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
