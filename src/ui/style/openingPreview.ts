import { hasSash, layoutOpening, LEAF_OPS, SIDE_HUNG, type LaidCell, type OpeningTypeModel, type Rect, type Track } from '../../core/openingTypes';

/**
 * Typen sedd utifrån i dörr- och fönstereditorn (0.11.8, tavla 3): karmen,
 * posterna, lufterna med glas, panel eller blad, öppningssymbolen (spetsen
 * mot gångjärnen; streckad när luften öppnas inåt), gångjärnen som en
 * markering (två, 100 från över- och underkant) och handtagen på låssidan.
 * Varje luft har `data-ot-cell` så att den går att välja.
 */

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
export const trackText = (t: Track): string => (t.unit === 'fr' ? `${nf.format(t.size)} ${t.size === 1 ? 'andel' : 'andelar'}` : nf.format(t.size));

export function openingPreviewSvg(m: OpeningTypeModel, w: number, h: number, selected: number | null): string {
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
      if (c.leaf === 'glazed') {
        const iw = Math.min(150, (r.u1 - r.u0) * 0.2);
        out.push(rect({ u0: r.u0 + iw, u1: r.u1 - iw, z0: r.z0 + Math.min(400, (r.z1 - r.z0) * 0.25), z1: r.z1 - 150 }, 'op-glass'));
      } else if (c.leaf === 'panel') {
        const iw = Math.min(120, (r.u1 - r.u0) * 0.15);
        const zm = r.z0 + (r.z1 - r.z0) * 0.45;
        out.push(rect({ u0: r.u0 + iw, u1: r.u1 - iw, z0: r.z0 + iw * 1.5, z1: zm - iw / 2 }, 'op-line'), rect({ u0: r.u0 + iw, u1: r.u1 - iw, z0: zm + iw / 2, z1: r.z1 - iw }, 'op-line'));
      }
    } else if (c.fill === 'panel') out.push(rect(r, 'op-panel', at));
    else if (c.fill === 'open') out.push(rect(r, 'op-open', at));
    else if (hasSash(c)) {
      const s = Math.min(m.sash, (r.u1 - r.u0) / 3, (r.z1 - r.z0) / 3);
      out.push(rect(r, 'op-sash', at), rect({ u0: r.u0 + s, u1: r.u1 - s, z0: r.z0 + s, z1: r.z1 - s }, 'op-glass'));
    } else out.push(rect(r, 'op-glass', at));
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
  return `<svg class="op-preview" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" style="--k:${k}">${out.join('')}</svg>`;
}

function symbol(c: LaidCell, Y: (z: number) => number): string {
  const r = c.rect;
  const segs: [number, number, number, number][] = [];
  const um = (r.u0 + r.u1) / 2;
  const zm = (r.z0 + r.z1) / 2;
  const left = c.hinge !== 'right';
  const side = (l: boolean) => {
    const hu = l ? r.u0 : r.u1;
    const fu = l ? r.u1 : r.u0;
    segs.push([fu, r.z0, hu, zm], [fu, r.z1, hu, zm]);
  };
  const bottom = () => segs.push([r.u0, r.z1, um, r.z0], [r.u1, r.z1, um, r.z0]);
  const top = () => segs.push([r.u0, r.z0, um, r.z1], [r.u1, r.z0, um, r.z1]);
  const arrow = (toLeft: boolean) => {
    const w = r.u1 - r.u0;
    const a = toLeft ? r.u1 - w * 0.2 : r.u0 + w * 0.2;
    const e = toLeft ? r.u0 + w * 0.2 : r.u1 - w * 0.2;
    const k = Math.min(80, w * 0.1) * (toLeft ? 1 : -1);
    segs.push([a, zm, e, zm], [e, zm, e + k, zm + Math.abs(k) * 0.6], [e, zm, e + k, zm - Math.abs(k) * 0.6]);
  };
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
      arrow(left);
      break;
    case 'fold':
    case 'foldLeaf': {
      const n = 4;
      const w = (r.u1 - r.u0) / n;
      for (let i = 0; i < n; i++) segs.push([r.u0 + i * w, i % 2 ? r.z0 + 200 : zm, r.u0 + (i + 1) * w, i % 2 ? zm : r.z0 + 200]);
      break;
    }
    case 'garage':
      segs.push([um, r.z0 + (r.z1 - r.z0) * 0.25, um, r.z1 - (r.z1 - r.z0) * 0.25]);
      break;
  }
  const cls = c.inward && !LEAF_OPS.has(c.op) ? 'op-symbol inward' : 'op-symbol';
  return segs.map(([a, b, d, e]) => `<line class="${cls}" x1="${a}" y1="${Y(b)}" x2="${d}" y2="${Y(e)}"/>`).join('');
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
