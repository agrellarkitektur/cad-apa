// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import type { ProjectDoc } from '../../core/model';
import { updateOpeningType } from '../../core/openings';
import { FLASHING_SLOPE, holeOf, LEAF_OPS, SIDE_HUNG, frameFromModule, hardwareOf, trimOf, type MuntinKind, type CellFill, type LeafStyle, type OpeningCell, type OpeningTypeModel, type OpKind } from '../../core/openingTypes';
import { hasSash, layoutOpening, leafGridOf, type LeafGrid } from '../../core/openingLayout';
import { openingSettingsOf } from '../../core/general';
import type { DocStore } from '../../core/store';
import type { OpeningEditorState } from './openingTypes';


/** Bladets indelning att ändra: den egna, eller en kopia av förvalet (Spegel, Glasat). */
export function ownLeafGrid(c: OpeningCell): LeafGrid {
  if (!c.leafGrid) c.leafGrid = structuredClone(leafGridOf(c) ?? { cols: [{ size: 1, unit: 'fr' }], rows: [{ size: 1, unit: 'fr' }], fills: [] });
  return c.leafGrid;
}

export function parsePair(raw: string): [number, number] | null {
  const m = raw.trim().match(/^(\d+(?:[.,]\d+)?)\s*[×xX*\s]\s*(\d+(?:[.,]\d+)?)$/);
  if (!m) return null;
  return [Number(m[1].replace(',', '.')), Number(m[2].replace(',', '.'))];
}

/** Fälten i editorn. True om fältet hörde hit. */
export function openingEditorChange(store: DocStore, st: OpeningEditorState, input: HTMLInputElement | HTMLSelectElement): boolean {
  const field = input.dataset.ot;
  if (!field || !st.def) return false;
  const def = st.def;
  const raw = input.value;
  const v = Number(raw.replace(',', '.').replace(/\s/g, ''));
  const d = store.doc.definitions[def];
  if (!d?.opening) return true;
  if (field === 'name') {
    if (raw.trim()) updateOpeningType(store, def, `Byt namn: ${raw.trim()}`, () => null, { name: raw.trim() });
    return true;
  }
  if (field === 'description') {
    updateOpeningType(store, def, 'Beskrivning', () => null, { description: raw.trim() || undefined });
    return true;
  }
  const up = (label: string, fn: (m: OpeningTypeModel) => void) =>
    updateOpeningType(store, def, `${d.name}: ${label}`, (m) => {
      fn(m);
      return m;
    });
  const nonneg = Number.isFinite(v) && v >= 0;
  switch (field) {
    case 'spec':
      up('föreskrift', (m) => (raw.trim() ? (m.spec = raw.trim()) : delete m.spec));
      return true;
    case 'frame.width':
    case 'frame.depth':
      if (nonneg) up(field === 'frame.width' ? 'karmens bredd' : 'karmdjup', (m) => (m.frame[field === 'frame.width' ? 'width' : 'depth'] = Math.round(v)));
      return true;
    case 'frame.bottom':
      up(d.opening.kind === 'door' ? 'tröskel' : 'nederstycke', (m) => (m.frame.bottom = raw.trim() === '' || v === 0 ? null : nonneg ? Math.round(v) : m.frame.bottom));
      return true;
    case 'mullion':
    case 'transom':
    case 'sash':
    case 'sashDepth':
    case 'leaf':
      if (nonneg) up(field, (m) => (m[field] = Math.round(v)));
      return true;
    case 'size': {
      const p = parsePair(raw);
      if (p) up('förvalt modulmått', (m) => (m.size = p.map((x) => (x >= 100 ? Math.round(x) : Math.round(x * 100))) as [number, number]));
      return true;
    }
    case 'holesize': {
      const p = parsePair(raw);
      const one = Number(raw.replace(',', '.'));
      const size: [number, number] | null = p ? [Math.round(p[0]), Math.round(p[1])] : one >= 10 ? [Math.round(one), Math.round(one)] : null;
      if (size && size[0] >= 10 && size[1] >= 10) up('förvalt mått', (m) => (m.size = size));
      return true;
    }
    case 'frameLess':
      up('karmavdrag', (m) => (raw.trim() === '' ? delete m.frameLess : nonneg ? (m.frameLess = Math.min(100, Math.round(v))) : 0));
      return true;
    case 'sill':
      up('förvald bröstning', (m) => (raw.trim() === '' ? delete m.sill : nonneg ? (m.sill = Math.round(v)) : 0));
      return true;
    case 'min':
    case 'max': {
      const p = parsePair(raw);
      up(field === 'min' ? 'minsta mått' : 'största mått', (m) => (raw.trim() === '' ? delete m[field] : p ? (m[field] = p) : 0));
      return true;
    }
  }
  if (field.startsWith('hole.')) {
    const on = (input as HTMLInputElement).type === 'checkbox' ? (input as HTMLInputElement).checked : false;
    up('vägghålets form', (m) => {
      const h = holeOf(m);
      if (field === 'hole.shape') {
        h.shape = raw === 'round' ? 'round' : 'rect';
        if (h.shape === 'round') m.size = [m.size[0], m.size[0]];
      } else if (field === 'hole.through') h.depth = raw === 'niche' ? (h.depth ?? 100) : null;
      else if (field === 'hole.depth' && Number.isFinite(v) && v >= 1) h.depth = Math.round(v);
      else if (field === 'hole.grille') h.grille = on;
      m.hole = h;
    });
    return true;
  }
  if (field.startsWith('trim.') || field.startsWith('hw.')) {
    const on = (input as HTMLInputElement).type === 'checkbox' ? (input as HTMLInputElement).checked : raw === 'on';
    up(field.startsWith('hw.') ? 'beslag' : 'foder, bleck och bänk', (m) => {
      const t = trimOf(m);
      const h = hardwareOf(m);
      const pos = (x: number) => Number.isFinite(v) && v >= 0 ? Math.round(v) : x;
      switch (field) {
        case 'trim.sides': t.lining.sides = raw as typeof t.lining.sides; break;
        case 'trim.width': t.lining.width = pos(t.lining.width); break;
        case 'trim.thickness': t.lining.thickness = pos(t.lining.thickness); break;
        case 'trim.flashing': t.flashing = on ? (t.flashing ?? { overhang: 40, drip: 20, slope: FLASHING_SLOPE }) : null; break;
        case 'trim.slope': if (t.flashing && Number.isFinite(v)) t.flashing.slope = Math.max(0, Math.min(45, Math.round(v * 10) / 10)); break;
        case 'trim.overhang': if (t.flashing) t.flashing.overhang = pos(t.flashing.overhang); break;
        case 'trim.drip': if (t.flashing) t.flashing.drip = pos(t.flashing.drip); break;
        case 'trim.board': t.board = on ? (t.board ?? { thickness: 22, overhang: 20 }) : null; break;
        case 'trim.boardT': if (t.board) t.board.thickness = Math.max(1, pos(t.board.thickness)); break;
        case 'trim.boardOver': if (t.board) t.board.overhang = pos(t.board.overhang); break;
        case 'hw.handle': h.handle = raw as typeof h.handle; break;
        case 'hw.handleHeight': h.handleHeight = pos(h.handleHeight); break;
        case 'hw.hinges': case 'hw.closer': case 'hw.letterbox': h[field.slice(3) as 'hinges' | 'closer' | 'letterbox'] = on; break;
      }
      if (field.startsWith('hw.')) m.hardware = h;
      else m.trim = t;
    });
    return true;
  }
  const [what, idx, key] = field.split(':');
  const i = Number(idx);
  if (what === 'mline') {
    const j = Number(key);
    const k = field.split(':')[3];
    const gl = glassRectOf(store.doc, d.opening, st, i);
    if (!gl || !Number.isFinite(v)) return true;
    up('spröjs', (m) => {
      const l = m.cells[i]?.muntins?.lines?.[j];
      if (!l) return;
      const frac = Math.max(0, Math.min(1, k.endsWith('x') ? v / (gl.u1 - gl.u0) : v / (gl.z1 - gl.z0)));
      (k.startsWith('a') ? l.a : l.b)[k.endsWith('x') ? 0 : 1] = frac;
    });
    return true;
  }
  if (what === 'col' || what === 'row') {
    up(what === 'col' ? 'kolumn' : 'rad', (m) => {
      const t = (what === 'col' ? m.cols : m.rows)[i];
      if (!t) return;
      if (key === 'unit') t.unit = raw === 'mm' ? 'mm' : 'fr';
      else if (Number.isFinite(v) && v > 0) t.size = v;
    });
    return true;
  }
  if (what === 'cell') {
    up(`L${i + 1}`, (m) => {
      const c = m.cells[i];
      if (!c) return;
      if (key === 'op') setOp(m, c, raw as OpKind);
      else if (key === 'hinge') c.hinge = raw === 'right' ? 'right' : 'left';
      else if (key === 'inward') raw === 'in' ? (c.inward = true) : delete c.inward;
      else if (key === 'fill') c.fill = raw as CellFill;
      else if (key === 'material') raw ? (c.material = raw) : delete c.material;
      else if (key === 'leaf') {
        if (raw === 'custom') return;
        c.leaf = raw as LeafStyle;
        delete c.leafGrid;
        st.fill = null;
      } else if (key === 'mmode') {
        if (raw === 'none') delete c.muntins;
        else if (raw === 'even') c.muntins = { v: c.muntins?.v || 1, h: c.muntins?.h || 1, kind: c.muntins?.kind ?? 'loose', ...(c.muntins?.width ? { width: c.muntins.width } : {}) };
        else c.muntins = { v: 0, h: 0, kind: c.muntins?.kind ?? 'loose', ...(c.muntins?.width ? { width: c.muntins.width } : {}), lines: c.muntins?.lines ?? [] };
        st.draw = raw === 'special' ? { start: null } : null;
      } else if (c.muntins && (key === 'mv' || key === 'mh')) {
        if (Number.isFinite(v) && v >= 0) c.muntins[key === 'mv' ? 'v' : 'h'] = Math.min(20, Math.round(v));
      } else if (c.muntins && key === 'mkind') c.muntins.kind = raw as MuntinKind;
      else if (c.muntins && key === 'mwidth') raw.trim() === '' ? delete c.muntins.width : Number.isFinite(v) && v > 0 && (c.muntins.width = Math.round(v));
    });
    return true;
  }
  if (what === 'lcol' || what === 'lrow') {
    const j = Number(key);
    const k2 = field.split(':')[3];
    up(what === 'lcol' ? 'bladets kolumn' : 'bladets rad', (m) => {
      const c = m.cells[i];
      if (!c) return;
      const t = (what === 'lcol' ? ownLeafGrid(c).cols : ownLeafGrid(c).rows)[j];
      if (!t) return;
      if (k2 === 'unit') t.unit = raw === 'mm' ? 'mm' : 'fr';
      else if (Number.isFinite(v) && v > 0) t.size = v;
    });
    return true;
  }
  if (what === 'lfill' && field.endsWith(':edge')) {
    const j = Number(key);
    up('spegelns kant', (m) => {
      const f = m.cells[i] ? ownLeafGrid(m.cells[i]).fills[j] : undefined;
      if (!f) return;
      if (raw === 'flat') f.flat = true;
      else delete f.flat;
    });
    return true;
  }
  if (what === 'lfill') {
    const j = Number(key);
    up('fyllningens material', (m) => {
      const c = m.cells[i];
      const f = c ? ownLeafGrid(c).fills[j] : undefined;
      if (!f) return;
      delete f.glass;
      delete f.material;
      if (raw === 'glass') f.glass = true;
      else if (raw) f.material = raw;
    });
    return true;
  }
  return true;
}

export function setOp(m: OpeningTypeModel, c: OpeningCell, op: OpKind): void {
  c.op = op;
  if (SIDE_HUNG.has(op) && !c.hinge) c.hinge = 'left';
  if (LEAF_OPS.has(op)) {
    c.fill = 'panel';
    c.leaf ??= 'flat';
    delete c.inward;
  } else {
    delete c.leaf;
    if (c.fill === 'panel' && m.kind === 'door') c.fill = 'glass';
  }
}

/** Säkerställ att varje ruta i rutnätet har en luft, så att den går att välja. */
export function fillGrid(m: OpeningTypeModel): void {
  const covered = new Set<string>();
  for (const c of m.cells) for (let i = c.col; i < c.col + (c.colSpan ?? 1); i++) for (let j = c.row; j < c.row + (c.rowSpan ?? 1); j++) covered.add(`${i},${j}`);
  for (let j = 0; j < m.rows.length; j++) for (let i = 0; i < m.cols.length; i++) if (!covered.has(`${i},${j}`)) m.cells.push({ col: i, row: j, fill: 'glass', op: 'fixed' });
  m.cells.sort((a, b) => a.row - b.row || a.col - b.col);
}

/** Den valda luftens glas (u, z i mm) i det mått ritytan visar. */
export function glassRectOf(doc: ProjectDoc, m: OpeningTypeModel, st: OpeningEditorState, i: number): { u0: number; u1: number; z0: number; z1: number; h: number } | null {
  const [fw, fh] = frameFromModule(m, st.tryMod ?? m.size, openingSettingsOf(doc.graphics));
  const c = m.cells[i];
  const laid = c && layoutOpening(m, fw, fh).cells.find((x) => x.col === c.col && x.row === c.row);
  if (!laid) return null;
  const r = laid.rect;
  const s = hasSash(laid) ? Math.min(m.sash, (r.u1 - r.u0) / 3, (r.z1 - r.z0) / 3) : 0;
  return { u0: r.u0 + s, u1: r.u1 - s, z0: r.z0 + s, z1: r.z1 - s, h: fh };
}
