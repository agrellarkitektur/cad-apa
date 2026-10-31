import type { Definition } from './model';

/**
 * Öppningstyperna (0.11.8, format 28): fönster, dörrar och vägghål delar en
 * motor. En typ är fabrikens modell (*Sidohängt 1-luft*, *Pardörr*) med ett
 * beskrivande namn och ingen littera; litteran hör till objektet och räknas
 * fram ur projektets litteraregel (`openingLitteras` i
 * `elements/openingLittera.ts`).
 *
 * Typen är en **karm** med ett **rutnät av lufter**: kolumner och rader med
 * poster och tvärstycken mellan. Varje luft är fast (glas, panel eller
 * öppen), öppningsbar på något av fönstrens sätt, eller ett dörrblad.
 * Rutnätets mått är fasta mm eller andelar (`fr`), så att samma typ
 * fungerar i alla storlekar.
 */

export type OpeningKind = 'window' | 'door' | 'hole';

/** Hur en luft öppnas. Fönstrens sätt, dörrbladens och `fixed`. */
export type OpKind =
  | 'fixed'
  | 'side'
  | 'bottom'
  | 'top'
  | 'tiltturn'
  | 'pivotH'
  | 'pivotV'
  | 'slide'
  | 'fold'
  | 'leaf'
  | 'slideLeaf'
  | 'pocket'
  | 'foldLeaf'
  | 'garage';

export const WINDOW_OPS: readonly { op: OpKind; label: string }[] = [
  { op: 'fixed', label: 'Fast' },
  { op: 'side', label: 'Sidohängd' },
  { op: 'bottom', label: 'Underkantshängd' },
  { op: 'top', label: 'Överkantshängd' },
  { op: 'tiltturn', label: 'Dreh-kipp' },
  { op: 'pivotH', label: 'Horisontell pivå' },
  { op: 'pivotV', label: 'Vertikal pivå' },
  { op: 'slide', label: 'Skjut' },
  { op: 'fold', label: 'Vik' },
];

export const DOOR_OPS: readonly { op: OpKind; label: string }[] = [
  { op: 'leaf', label: 'Dörrblad, slag' },
  { op: 'slideLeaf', label: 'Skjutdörr utanpå' },
  { op: 'pocket', label: 'Skjutdörr in i vägg' },
  { op: 'foldLeaf', label: 'Vikdörr' },
  { op: 'garage', label: 'Port, uppåt' },
];

export const OP_LABEL: Record<OpKind, string> = Object.fromEntries([...WINDOW_OPS, ...DOOR_OPS].map((o) => [o.op, o.label])) as Record<OpKind, string>;

/** Öppningssätt med gångjärn på en sida (vänster/höger). */
export const SIDE_HUNG: ReadonlySet<OpKind> = new Set(['side', 'tiltturn', 'leaf', 'foldLeaf']);
/** Dörrbladen. */
export const LEAF_OPS: ReadonlySet<OpKind> = new Set(['leaf', 'slideLeaf', 'pocket', 'foldLeaf', 'garage']);

/** Ett mått i rutnätet: fast i mm eller en andel av det som blir över. */
export interface Track {
  size: number;
  unit: 'mm' | 'fr';
}

export type CellFill = 'glass' | 'panel' | 'open';
export type LeafStyle = 'flat' | 'panel' | 'glazed';

/** En luft i rutnätet. `col` och `row` räknas från vänster och uppifrån, sett utifrån. */
export interface OpeningCell {
  col: number;
  row: number;
  colSpan?: number;
  rowSpan?: number;
  fill: CellFill;
  op: OpKind;
  /** Gångjärnssidan sett utifrån, för sidohängda lufter och dörrblad. */
  hinge?: 'left' | 'right';
  /** Dörrbladets utförande. */
  leaf?: LeafStyle;
  /** Fönsterluften öppnas inåt (förval utåt). Dörrar öppnas åt det håll objektet slår. */
  inward?: boolean;
}

export interface OpeningTypeModel {
  kind: OpeningKind;
  /** Gruppen i editorn: *Fönster*, *Dörrar*, *Vägghål* eller en egen. */
  group: string;
  /** Karmen: bredd i fasaden, djup genom väggen, och nederstycket (tröskel i dörrar; null = ingen). */
  frame: { width: number; depth: number; bottom: number | null };
  /** Förvalt modulmått (mm) när typen väljs i verktyget. */
  size: [number, number];
  /** Förvald bröstning för fönster (fönsterdörren 0), mm. */
  sill?: number;
  cols: Track[];
  rows: Track[];
  /** Postens och tvärstyckets bredd, mm (0 = bågarna möts). */
  mullion: number;
  transom: number;
  /** Bågens bredd i fasaden och djup, mm; bladets tjocklek. */
  sash: number;
  sashDepth: number;
  leaf: number;
  cells: OpeningCell[];
  /** Föreskriften, t.ex. *Träfönster typ Elitfönster EFS eller likvärdig*. */
  spec?: string;
  /** Typens min- och maxmått (karmyttermått), mm: en varning, ingen spärr. */
  min?: [number, number];
  max?: [number, number];
}

export const OPENING_GROUPS: readonly { group: string; kind: OpeningKind; type: string }[] = [
  { group: 'Fönster', kind: 'window', type: 'Window' },
  { group: 'Dörrar', kind: 'door', type: 'Door' },
  { group: 'Vägghål', kind: 'hole', type: 'WallHole' },
];

/** Elementtypen för en sort. */
export const elementTypeOfKind = (k: OpeningKind): string => (k === 'door' ? 'Door' : k === 'hole' ? 'WallHole' : 'Window');
export const kindOfElementType = (t: string): OpeningKind | null => (t === 'Door' ? 'door' : t === 'Window' ? 'window' : t === 'WallHole' ? 'hole' : null);

const fr = (n = 1): Track => ({ size: n, unit: 'fr' });
const mm = (n: number): Track => ({ size: n, unit: 'mm' });

function windowModel(cells: OpeningCell[], extra: Partial<OpeningTypeModel> = {}): OpeningTypeModel {
  return {
    kind: 'window',
    group: 'Fönster',
    frame: { width: 45, depth: 105, bottom: 45 },
    size: [1000, 1200],
    cols: [fr()],
    rows: [fr()],
    mullion: 63,
    transom: 63,
    sash: 50,
    sashDepth: 60,
    leaf: 40,
    cells,
    ...extra,
  };
}

function doorModel(cells: OpeningCell[], extra: Partial<OpeningTypeModel> = {}): OpeningTypeModel {
  return {
    kind: 'door',
    group: 'Dörrar',
    frame: { width: 50, depth: 100, bottom: null },
    size: [900, 2100],
    cols: [fr()],
    rows: [fr()],
    mullion: 60,
    transom: 60,
    sash: 50,
    sashDepth: 60,
    leaf: 40,
    cells,
    ...extra,
  };
}

const glass = (col: number, row: number, op: OpKind, hinge?: 'left' | 'right'): OpeningCell => ({ col, row, fill: 'glass', op, ...(hinge ? { hinge } : {}) });
const leafCell = (col: number, row: number, op: OpKind, leaf: LeafStyle, hinge?: 'left' | 'right'): OpeningCell => ({ col, row, fill: 'panel', op, leaf, ...(hinge ? { hinge } : {}) });

/** De förvalda typerna med sina namn och id (stabila, så att *Lägg in förvalda typer* inte dubblerar). */
export const DEFAULT_OPENING_TYPES: readonly { id: string; name: string; description?: string; model: OpeningTypeModel }[] = [
  { id: 't-of-fast', name: 'Fast', model: windowModel([glass(0, 0, 'fixed')]) },
  { id: 't-of-sid1', name: 'Sidohängt 1-luft', model: windowModel([glass(0, 0, 'side', 'left')]) },
  { id: 't-of-sid2', name: 'Sidohängt 2-luft', model: windowModel([glass(0, 0, 'side', 'left'), glass(1, 0, 'side', 'right')], { cols: [fr(), fr()], mullion: 0, size: [1200, 1200] }) },
  {
    id: 't-of-flagg',
    name: 'Flaggfönster',
    model: windowModel([glass(0, 0, 'side', 'left'), glass(1, 0, 'side', 'right'), glass(0, 1, 'side', 'left'), glass(1, 1, 'side', 'right')], { cols: [fr(), fr()], rows: [fr(1), fr(2)], size: [1200, 1400] }),
  },
  { id: 't-of-uk', name: 'Underkantshängt', model: windowModel([glass(0, 0, 'bottom')], { size: [1000, 600], sill: 1500 }) },
  { id: 't-of-ok', name: 'Överkantshängt', model: windowModel([glass(0, 0, 'top')], { size: [1000, 600], sill: 1500 }) },
  { id: 't-of-pivh', name: 'Horisontell pivå', model: windowModel([glass(0, 0, 'pivotH')], { size: [1200, 1200] }) },
  { id: 't-of-pivv', name: 'Vertikal pivå', model: windowModel([glass(0, 0, 'pivotV')]) },
  { id: 't-of-dk', name: 'Dreh-kipp', model: windowModel([glass(0, 0, 'tiltturn', 'left')]) },
  { id: 't-of-skjut', name: 'Skjutfönster', model: windowModel([glass(0, 0, 'fixed'), glass(1, 0, 'slide')], { cols: [fr(), fr()], mullion: 0, size: [1600, 1200] }) },
  {
    id: 't-of-fdorr',
    name: 'Fönsterdörr',
    description: 'Balkong- eller altandörr',
    model: windowModel([glass(0, 0, 'side', 'left')], { size: [900, 2100], sill: 0, frame: { width: 45, depth: 105, bottom: 42 } }),
  },
  { id: 't-dd-slat', name: 'Innerdörr slät', model: doorModel([leafCell(0, 0, 'leaf', 'flat', 'left')]) },
  { id: 't-dd-spegel', name: 'Innerdörr spegel', model: doorModel([leafCell(0, 0, 'leaf', 'panel', 'left')]) },
  { id: 't-dd-glas', name: 'Ytterdörr glasad', model: doorModel([leafCell(0, 0, 'leaf', 'glazed', 'left')], { size: [1000, 2100], frame: { width: 50, depth: 105, bottom: 42 } }) },
  {
    id: 't-dd-par',
    name: 'Pardörr',
    model: doorModel([leafCell(0, 0, 'leaf', 'glazed', 'left'), leafCell(1, 0, 'leaf', 'glazed', 'right')], { cols: [fr(), fr()], mullion: 0, size: [1500, 2100], frame: { width: 50, depth: 105, bottom: 42 } }),
  },
  {
    id: 't-dd-sido',
    name: 'Ytterdörr med sidoljus',
    model: doorModel([leafCell(0, 0, 'leaf', 'flat', 'left'), glass(1, 0, 'fixed')], { cols: [fr(), mm(400)], size: [1400, 2100], frame: { width: 50, depth: 105, bottom: 42 } }),
  },
  { id: 't-dd-skjut', name: 'Skjutdörr utanpå', model: doorModel([leafCell(0, 0, 'slideLeaf', 'flat')]) },
  { id: 't-dd-ficka', name: 'Skjutdörr in i vägg', model: doorModel([leafCell(0, 0, 'pocket', 'flat')]) },
  { id: 't-dd-vik', name: 'Vikdörr', model: doorModel([leafCell(0, 0, 'foldLeaf', 'flat', 'left')], { size: [1200, 2100] }) },
  { id: 't-dd-port', name: 'Garageport', description: 'Enkel takskjutport', model: doorModel([leafCell(0, 0, 'garage', 'flat')], { size: [2500, 2100], frame: { width: 80, depth: 100, bottom: null } }) },
];

/** Typerna som nya projekt börjar med (de andra med *Lägg in förvalda typer*). */
export const STARTER_OPENING_TYPES = ['t-of-sid1', 't-of-sid2', 't-of-fast', 't-dd-slat', 't-dd-glas'];

export function openingDefinition(t: (typeof DEFAULT_OPENING_TYPES)[number]): Definition {
  return {
    id: t.id,
    origin: 'component',
    name: t.name,
    ...(t.description ? { description: t.description } : {}),
    elementType: elementTypeOfKind(t.model.kind),
    params: {},
    props: {},
    opening: structuredClone(t.model),
  };
}

/** Typen när ett objekt saknar en (eller en från en annan elementtyp). */
export function fallbackModel(kind: OpeningKind): OpeningTypeModel {
  const id = kind === 'door' ? 't-dd-slat' : 't-of-sid1';
  if (kind === 'hole') return { ...windowModel([{ col: 0, row: 0, fill: 'open', op: 'fixed' }]), kind: 'hole', group: 'Vägghål', frame: { width: 0, depth: 0, bottom: null }, size: [300, 300] };
  return DEFAULT_OPENING_TYPES.find((t) => t.id === id)!.model;
}

/** En ny, tom typ i en grupp (editorns *Ny typ…*). */
export function newOpeningModel(kind: OpeningKind, group: string): OpeningTypeModel {
  return { ...structuredClone(fallbackModel(kind)), group };
}

/**
 * Om typen står på golvet (dörrar, fönsterdörren och porten): då finns
 * ingen drevmån under karmen, och karmyttermåttet i höjd är modulmåttet
 * minus en drevmån (21 → 2 090), annars minus två (13 → 1 280).
 */
export const standsOnFloor = (m: Pick<OpeningTypeModel, 'kind' | 'sill'>): boolean => m.kind === 'door' || m.sill === 0;

/** Karmyttermåttet ur modulmåttet: 1M = 100 mm med drevmånen inräknad (10 × 13 → 980 × 1 280). */
export function frameFromModule(m: Pick<OpeningTypeModel, 'kind' | 'sill'>, mod: readonly [number, number], gap: number): [number, number] {
  if (m.kind === 'hole') return [mod[0], mod[1]];
  return [mod[0] - 2 * gap, mod[1] - (standsOnFloor(m) ? gap : 2 * gap)];
}

/** Hålmåttet ur karmyttermåttet. */
export function holeFromFrame(m: Pick<OpeningTypeModel, 'kind' | 'sill'>, frame: readonly [number, number], gap: number): [number, number] {
  if (m.kind === 'hole') return [frame[0], frame[1]];
  return [frame[0] + 2 * gap, frame[1] + (standsOnFloor(m) ? gap : 2 * gap)];
}

// ---------------------------------------------------------------------------
// Från fil

const num = (v: unknown, d: number, lo = 0, hi = 100000): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};
const pair = (v: unknown, d: [number, number]): [number, number] => (Array.isArray(v) && v.length === 2 ? [num(v[0], d[0], -1000, 100000), num(v[1], d[1], -1000, 100000)] : d);
const ALL_OPS = new Set(Object.keys(OP_LABEL));

function tracks(v: unknown): Track[] {
  const out = (Array.isArray(v) ? v : []).map((t: any): Track => ({ size: num(t?.size, 1, 0.01), unit: t?.unit === 'mm' ? 'mm' : 'fr' })).slice(0, 12);
  return out.length ? out : [fr()];
}

/** En typ från fil: det som saknas eller är fel får förval. */
export function normalizeOpeningModel(v: unknown, kindHint: OpeningKind = 'window'): OpeningTypeModel {
  const m = (v && typeof v === 'object' ? v : {}) as Record<string, any>;
  const kind: OpeningKind = m.kind === 'door' || m.kind === 'hole' || m.kind === 'window' ? m.kind : kindHint;
  const base = fallbackModel(kind);
  const cols = tracks(m.cols);
  const rows = tracks(m.rows);
  const cells = (Array.isArray(m.cells) ? m.cells : [])
    .map((c: any): OpeningCell | null => {
      const col = Math.round(num(c?.col, -1, -1, 99));
      const row = Math.round(num(c?.row, -1, -1, 99));
      if (col < 0 || row < 0 || col >= cols.length || row >= rows.length) return null;
      const out: OpeningCell = { col, row, fill: c.fill === 'panel' || c.fill === 'open' ? c.fill : 'glass', op: ALL_OPS.has(c.op) ? c.op : 'fixed' };
      const cs = Math.round(num(c.colSpan, 1, 1, cols.length - col));
      const rs = Math.round(num(c.rowSpan, 1, 1, rows.length - row));
      if (cs > 1) out.colSpan = cs;
      if (rs > 1) out.rowSpan = rs;
      if (c.hinge === 'left' || c.hinge === 'right') out.hinge = c.hinge;
      if (c.inward === true) out.inward = true;
      if (c.leaf === 'flat' || c.leaf === 'panel' || c.leaf === 'glazed') out.leaf = c.leaf;
      return out;
    })
    .filter((c: OpeningCell | null): c is OpeningCell => !!c);
  const f = (m.frame ?? {}) as Record<string, unknown>;
  const out: OpeningTypeModel = {
    kind,
    group: typeof m.group === 'string' && m.group.trim() ? m.group.trim() : base.group,
    frame: { width: num(f.width, base.frame.width, 0, 500), depth: num(f.depth, base.frame.depth, 0, 1000), bottom: f.bottom === null ? null : f.bottom === undefined ? base.frame.bottom : num(f.bottom, 0, 0, 500) },
    size: pair(m.size, base.size),
    cols,
    rows,
    mullion: num(m.mullion, base.mullion, 0, 500),
    transom: num(m.transom, base.transom, 0, 500),
    sash: num(m.sash, base.sash, 0, 300),
    sashDepth: num(m.sashDepth, base.sashDepth, 0, 300),
    leaf: num(m.leaf, base.leaf, 0, 300),
    cells,
  };
  if (m.sill !== undefined && Number.isFinite(Number(m.sill))) out.sill = num(m.sill, 900, -5000, 10000);
  if (typeof m.spec === 'string' && m.spec.trim()) out.spec = m.spec.trim();
  if (m.min) out.min = pair(m.min, [0, 0]);
  if (m.max) out.max = pair(m.max, [0, 0]);
  return out;
}

// ---------------------------------------------------------------------------
// Rutnätet

export interface Rect {
  /** Längs karmen från dess vänstra kant sett utifrån (u) och uppåt från karmens underkant (z), mm. */
  u0: number;
  u1: number;
  z0: number;
  z1: number;
}

export interface LaidCell extends OpeningCell {
  rect: Rect;
}

export interface OpeningLayout {
  w: number;
  h: number;
  /** Karmens delar: vänster, höger, över och (om den finns) under. */
  frame: Rect[];
  /** Poster (lodräta) och tvärstycken (vågräta). */
  mullions: Rect[];
  transoms: Rect[];
  cells: LaidCell[];
}

/** Fördela `inner` mm på spåren: fasta mm först, resten i andelar. */
export function trackSizes(list: readonly Track[], inner: number): number[] {
  const fixed = list.reduce((a, t) => a + (t.unit === 'mm' ? t.size : 0), 0);
  const frs = list.reduce((a, t) => a + (t.unit === 'fr' ? t.size : 0), 0);
  const rest = Math.max(0, inner - fixed);
  return list.map((t) => (t.unit === 'mm' ? t.size : frs > 0 ? (rest * t.size) / frs : 0));
}

/**
 * Karmen, posterna, tvärstyckena och lufterna i ett karmyttermått `w` × `h`.
 * Rutor i rutnätet som ingen luft täcker blir fast glas.
 */
export function layoutOpening(m: OpeningTypeModel, w: number, h: number): OpeningLayout {
  const fw = m.kind === 'hole' ? 0 : m.frame.width;
  const fb = m.frame.bottom ?? 0;
  const frame: Rect[] = fw > 0 ? [{ u0: 0, u1: fw, z0: 0, z1: h }, { u0: w - fw, u1: w, z0: 0, z1: h }, { u0: fw, u1: w - fw, z0: h - fw, z1: h }] : [];
  if (fb > 0 && fw > 0) frame.push({ u0: fw, u1: w - fw, z0: 0, z1: fb });
  const nc = m.cols.length;
  const nr = m.rows.length;
  const ws = trackSizes(m.cols, w - 2 * fw - (nc - 1) * m.mullion);
  const hs = trackSizes(m.rows, h - fw - fb - (nr - 1) * m.transom);
  const u: number[] = [fw];
  for (let i = 0; i < nc; i++) u.push(u[i] + ws[i] + (i < nc - 1 ? m.mullion : 0));
  // Raderna uppifrån.
  const z: number[] = [h - fw];
  for (let j = 0; j < nr; j++) z.push(z[j] - hs[j] - (j < nr - 1 ? m.transom : 0));
  const colU = (i: number): [number, number] => [u[i], u[i] + ws[i]];
  const rowZ = (j: number): [number, number] => [z[j] - hs[j], z[j]];
  const covered = new Set<string>();
  const cells: LaidCell[] = [];
  const add = (c: OpeningCell) => {
    const cs = c.colSpan ?? 1;
    const rs = c.rowSpan ?? 1;
    for (let i = c.col; i < c.col + cs; i++) for (let j = c.row; j < c.row + rs; j++) covered.add(`${i},${j}`);
    cells.push({ ...c, rect: { u0: colU(c.col)[0], u1: colU(c.col + cs - 1)[1], z0: rowZ(c.row + rs - 1)[0], z1: rowZ(c.row)[1] } });
  };
  for (const c of m.cells) if (!c.col || c.col < nc) if (c.row < nr && !covered.has(`${c.col},${c.row}`)) add(c);
  for (let i = 0; i < nc; i++) for (let j = 0; j < nr; j++) if (!covered.has(`${i},${j}`)) add({ col: i, row: j, fill: m.kind === 'hole' ? 'open' : 'glass', op: 'fixed' });
  // Poster och tvärstycken där två lufter möts (inte inne i en sammanslagen luft).
  const mullions: Rect[] = [];
  const transoms: Rect[] = [];
  if (m.mullion > 0)
    for (let i = 0; i < nc - 1; i++) {
      const a = colU(i)[1];
      // Bitvis per rad, utom där en luft går över.
      for (let j = 0; j < nr; j++) {
        if (cells.some((c) => c.col <= i && c.col + (c.colSpan ?? 1) - 1 > i && c.row <= j && c.row + (c.rowSpan ?? 1) - 1 >= j)) continue;
        const [r0, r1] = rowZ(j);
        mullions.push({ u0: a, u1: a + m.mullion, z0: j === nr - 1 ? fb : r0, z1: j === 0 ? h - fw : r1 + m.transom });
      }
    }
  if (m.transom > 0)
    for (let j = 0; j < nr - 1; j++) {
      const b = rowZ(j)[0];
      for (let i = 0; i < nc; i++) {
        if (cells.some((c) => c.row <= j && c.row + (c.rowSpan ?? 1) - 1 > j && c.col <= i && c.col + (c.colSpan ?? 1) - 1 >= i)) continue;
        const [c0, c1] = colU(i);
        transoms.push({ u0: c0, u1: c1, z0: b - m.transom, z1: b });
      }
    }
  return { w, h, frame, mullions, transoms, cells };
}

/** Om typen har en luft eller ett blad som öppnas (för slagbåge och symboler). */
export const opens = (c: Pick<OpeningCell, 'op'>): boolean => c.op !== 'fixed';
/** Om luften har en båge (öppningsbar glasluft) och inte bara glas i karmen. */
export const hasSash = (c: Pick<OpeningCell, 'op' | 'fill'>): boolean => c.fill === 'glass' && c.op !== 'fixed' && !LEAF_OPS.has(c.op);
