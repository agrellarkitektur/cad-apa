import { symbolSegments } from '../../core/openingSymbol';
import { hasSash, layoutLeaf, layoutOpening, leafGridOf, muntinLines, muntinWidth, LEAF_OPS, SIDE_HUNG, type LaidCell, type OpeningTypeModel, type Rect, type Track } from '../../core/openingTypes';

/**
 * Typen sedd utifrån i dörr- och fönstereditorn (0.11.8, tavla 3): karmen,
 * posterna, lufterna med glas, panel eller blad, öppningssymbolen (spretar
 * mot gångjärnssidan; streckad när luften öppnas inåt), gångjärnen som en
 * markering (två, 100 från över- och underkant) och handtagen på låssidan.
 * Varje luft har `data-ot-cell` så att den går att välja.
 */

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
export const trackText = (t: Track): string => (t.unit === 'fr' ? `${nf.format(t.size)} ${t.size === 1 ? 'andel' : 'andelar'}` : nf.format(t.size));

export function openingPreviewSvg(m: OpeningTypeModel, w: number, h: number, selected: number | null, opts: { fill?: number | null; drawing?: boolean } = {}): string {
  const L = layoutOpening(m, w, h);
  const pad = Math.max(w, h) * 0.14;
  const vb = `${-pad} ${-pad} ${w + 2 * pad} ${h + 2 * pad}`;
  const Y = (z: number) => h - z;
  const k = Math.max(w, h) / 260;
  const rect = (r: Rect, cls: string, extra = '') => `<rect class="${cls}" x="${r.u0}" y="${Y(r.z1)}" width="${Math.max(0, r.u1 - r.u0)}" height="${Math.max(0, r.z1 - r.z0)}"${extra}/>`;
  const out: string[] = [];
  out.push(rect({ u0: 0, u1: w, z0: 0, z1: h }, 'op-frame'));
  for (const r of [...L.frame, ...L.mullions, ...L.transoms]) out.push(rect(r, 'op-frame'));
  L.cells.forEach((c, i) => {
    const r = c.rect;
    const idx = m.cells.findIndex((x) => x.col === c.col && x.row === c.row);
    const at = '';
    out.push(`<g data-ot-cell="${c.col},${c.row}" class="op-cell">`);
    if (LEAF_OPS.has(c.op)) {
      out.push(rect(r, 'op-leaf', at));
      // Bladets indelning (0.11.8.1): fyllningarna går att välja när luften är vald.
      const grid = leafGridOf(c);
      const sel = idx >= 0 && idx === selected;
      if (grid && sel)
        // Bladets rutor utan fyllning: ett klick gör en fyllning där.
        for (const fr of layoutLeaf(grid, r).frame) out.push(rect(fr, 'op-leafcell', ` data-ot-lcell="${fr.col},${fr.row}"`));
      if (grid)
        layoutLeaf(grid, r).fills.forEach((f) => {
          const fi = grid.fills.findIndex((x) => x.col === f.col && x.row === f.row);
          const on = idx >= 0 && idx === selected && opts.fill === fi;
          out.push(rect(f.rect, `${f.glass ? 'op-glass' : 'op-fillpanel'}${on ? ' on' : ''}`, idx >= 0 && idx === selected ? ` data-ot-fill="${fi}"` : ''));
        });
    } else if (c.fill === 'panel') out.push(rect(r, 'op-panel', at));
    else if (c.fill === 'open') out.push(rect(r, 'op-open', at));
    else if (hasSash(c)) {
      const s = Math.min(m.sash, (r.u1 - r.u0) / 3, (r.z1 - r.z0) / 3);
      const gl = { u0: r.u0 + s, u1: r.u1 - s, z0: r.z0 + s, z1: r.z1 - s };
      out.push(rect(r, 'op-sash', at), rect(gl, 'op-glass'), muntins(c, gl, Y, k));
    } else out.push(rect(r, 'op-glass', at), muntins(c, r, Y, k));
    out.push(symbol(c, Y));
    out.push(hardware(c, Y, k));
    out.push('</g>');
    const lab = `L${i + 1}`;
    out.push(`<text class="op-cell-label${idx >= 0 && idx === selected ? ' on' : ''}" x="${(r.u0 + r.u1) / 2}" y="${Y(r.z1) + 40 * k}" font-size="${13 * k}" text-anchor="middle">${lab}</text>`);
    if (idx >= 0 && idx === selected) out.push(rect(r, 'op-selected'));
  });
  // Spårens mått ovanför och till vänster.
  const xs = L.cells.filter((c) => c.row === 0 && !c.colSpan);
  for (const c of xs) out.push(`<text class="op-track" x="${(c.rect.u0 + c.rect.u1) / 2}" y="${-pad * 0.35}" font-size="${12 * k}" text-anchor="middle">${trackText(m.cols[c.col])}</text>`);
  const ys = L.cells.filter((c) => c.col === 0 && !c.rowSpan);
  for (const c of ys) out.push(`<text class="op-track" x="${-pad * 0.2}" y="${Y((c.rect.z0 + c.rect.z1) / 2)}" font-size="${12 * k}" text-anchor="end">${trackText(m.rows[c.row])}</text>`);
  out.push(`<text class="op-dim" x="${w / 2}" y="${h + pad * 0.6}" font-size="${12 * k}" text-anchor="middle">${nf.format(w)} × ${nf.format(h)}</text>`);
  return `<svg class="op-preview${opts.drawing ? ' drawing' : ''}" data-h="${h}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" style="--k:${k}">${out.join('')}</svg>`;
}

/** Spröjsen som breda linjer. */
function muntins(c: LaidCell, gl: Rect, Y: (z: number) => number, k: number): string {
  if (!c.muntins) return '';
  const w = muntinWidth(c.muntins);
  const lines = muntinLines(c.muntins, gl);
  const L = (cls: string, sw: number) => lines.map(([a, b, d, e]) => `<line class="${cls}" x1="${a}" y1="${Y(b)}" x2="${d}" y2="${Y(e)}" style="stroke-width:${sw}"/>`).join('');
  return L('op-muntin-o', w) + L('op-muntin', Math.max(w * 0.4, w - 2.4 * k));
}

function symbol(c: LaidCell, Y: (z: number) => number): string {
  const cls = c.inward && !LEAF_OPS.has(c.op) ? 'op-symbol inward' : 'op-symbol';
  return symbolSegments(c).map(([a, b, d, e]) => `<line class="${cls}" x1="${a}" y1="${Y(b)}" x2="${d}" y2="${Y(e)}"/>`).join('');
}

/** Gångjärnen (två, 100 från över- och underkant) och handtaget på låssidan. */
function hardware(c: LaidCell, Y: (z: number) => number, k: number): string {
  if (!SIDE_HUNG.has(c.op) || !c.hinge) return '';
  const r = c.rect;
  const hu = c.hinge === 'left' ? r.u0 : r.u1;
  const lu = c.hinge === 'left' ? r.u1 - 40 : r.u0 + 40;
  const gw = 8 * k;
  const gh = 70;
  const out: string[] = [];
  for (const z of [r.z1 - 100 - gh, r.z0 + 100]) out.push(`<rect class="op-hinge" x="${hu - gw / 2}" y="${Y(z + gh)}" width="${gw}" height="${gh}"/>`);
  const hz = LEAF_OPS.has(c.op) ? Math.min(1000, (r.z0 + r.z1) / 2) : (r.z0 + r.z1) / 2;
  out.push(`<rect class="op-handle" x="${lu - gw / 2}" y="${Y(hz + 60)}" width="${gw}" height="120"/>`);
  return out.join('');
}
