import { symbolSegments } from '../core/openingSymbol';
import { hasSash, layoutLeaf, layoutOpening, leafGridOf, muntinLines, LEAF_OPS, type OpeningTypeModel, type Rect } from '../core/openingTypes';

/**
 * En dörr eller ett fönster ritat för sig, sett utifrån (0.12.5): ritningen
 * i förteckningens kolumn. Nivån är Normal: karmen, posterna och
 * tvärstyckena, bågarna, bladen med sin indelning, spröjsen och
 * öppningssymbolen (streckad när luften öppnas inåt), utan foder, bleck och
 * beslag. Måtten är karmens, i mm, med karmens nedre vänstra hörn i 0,0 och
 * y uppåt; `mirrored` vänder typen som objektets hängning gör.
 *
 * Linjerna lämnas som enkla streck med en roll, så att tabellen på bladet
 * (primitiver) och tabellen på skärmen (SVG) ritar samma sak.
 */

export type FigureRole = 'frame' | 'part' | 'thin' | 'symbol' | 'symbolIn';

export interface FigureLine {
  role: FigureRole;
  a: [number, number];
  b: [number, number];
}

export interface OpeningFigure {
  w: number;
  h: number;
  lines: FigureLine[];
}

export function openingFigure(m: OpeningTypeModel, w: number, h: number, mirrored = false): OpeningFigure {
  const L = layoutOpening(m, w, h);
  const lines: FigureLine[] = [];
  const X = (u: number) => (mirrored ? w - u : u);
  const line = (role: FigureRole, u1: number, z1: number, u2: number, z2: number) => lines.push({ role, a: [X(u1), z1], b: [X(u2), z2] });
  const rect = (role: FigureRole, r: Rect) => {
    if (r.u1 - r.u0 <= 0.5 || r.z1 - r.z0 <= 0.5) return;
    line(role, r.u0, r.z0, r.u1, r.z0);
    line(role, r.u1, r.z0, r.u1, r.z1);
    line(role, r.u1, r.z1, r.u0, r.z1);
    line(role, r.u0, r.z1, r.u0, r.z0);
  };
  rect('frame', { u0: 0, u1: w, z0: 0, z1: h });
  for (const c of L.cells) {
    const r = c.rect;
    // Luftens kant mot karmen, posterna och tvärstyckena.
    rect('part', r);
    let glass: Rect | null = null;
    if (LEAF_OPS.has(c.op)) {
      const grid = leafGridOf(c);
      if (grid) for (const f of layoutLeaf(grid, r).fills) rect('thin', f.rect);
    } else if (c.fill === 'glass') {
      if (hasSash(c)) {
        const s = Math.min(m.sash, (r.u1 - r.u0) / 3, (r.z1 - r.z0) / 3);
        glass = { u0: r.u0 + s, u1: r.u1 - s, z0: r.z0 + s, z1: r.z1 - s };
        rect('part', glass);
      } else glass = r;
    } else if (c.fill === 'open') {
      // Öppet: ett kryss, som ett hål.
      line('thin', r.u0, r.z0, r.u1, r.z1);
      line('thin', r.u0, r.z1, r.u1, r.z0);
    }
    if (glass && c.muntins) for (const [u1, z1, u2, z2] of muntinLines(c.muntins, glass)) line('part', u1, z1, u2, z2);
    const role: FigureRole = c.inward && !LEAF_OPS.has(c.op) ? 'symbolIn' : 'symbol';
    for (const [u1, z1, u2, z2] of symbolSegments(c)) line(role, u1, z1, u2, z2);
  }
  return { w, h, lines };
}
