// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import type { Definition } from './model';
import type { LeafFill, LeafGrid } from './openingLayout';

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

/** Spröjsens utförande: löstagbar (28 mm), mellan glasen (26) eller fast i bågen (28). */
export type MuntinKind = 'loose' | 'between' | 'fixed';
export const MUNTIN_KINDS: readonly { kind: MuntinKind; label: string; width: number }[] = [
  { kind: 'loose', label: 'Löstagbar', width: 28 },
  { kind: 'between', label: 'Mellan glasen', width: 26 },
  { kind: 'fixed', label: 'Fast', width: 28 },
];

/**
 * Spröjsen i en luft (0.11.8.1, kommentar D): fritt antal lodräta och
 * vågräta, jämnt fördelade i glaset, eller **special**: referenslinjer
 * ritade i editorn (ändarna som andelar 0–1 av glasets bredd och höjd, från
 * nedre vänstra hörnet sett utifrån). Bredden och utförandet för sig.
 */
export interface Muntins {
  v: number;
  h: number;
  kind: MuntinKind;
  width?: number;
  lines?: { a: [number, number]; b: [number, number] }[];
}

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
  /** Spröjsen i glaset (0.11.8.1). */
  muntins?: Muntins;
  /** Dörrbladets indelning (0.11.8.1). */
  leafGrid?: LeafGrid;
  /** En panels material ur stilboken (0.11.8.2, panel under glas i fönster); tomt = som karmen. */
  material?: string;
}

/**
 * Fodret, fönsterblecket och fönsterbänken (0.11.8.2). Typen har dem; det
 * som saknas i filen får förvalet för sorten (`trimOf`). Fodret sitter på
 * väggens liv runt hålet, blecket med droppnäsa ute under karmen och bänken
 * inne, båda i ytterväggar.
 */
interface OpeningTrim {
  /** Fodret: bredd i fasaden, tjocklek ut från väggens liv, och på vilka sidor. */
  lining: { width: number; thickness: number; sides: 'both' | 'in' | 'out' | 'none' };
  /**
   * Fönsterblecket ute: utsprånget förbi väggens liv, droppnäsans höjd och
   * lutningen utåt i grader (0.11.8.3; förval 15°); null = inget.
   */
  flashing: { overhang: number; drip: number; slope: number } | null;
  /** Fönsterbänken inne: tjocklek och utsprång förbi väggens liv; null = ingen. */
  board: { thickness: number; overhang: number } | null;
}

/** Beslagen (0.11.8.2): punktdelar som ritas i Detalj. */
interface OpeningHardware {
  /** Handtaget: trycke, draghandtag eller inget (fönstren: handtag på låssidan). */
  handle: 'lever' | 'pull' | 'none';
  /** Handtagets höjd över golvet för dörrar, mm (fönstren: mitt på bågen). */
  handleHeight: number;
  /** Gångjärnen som markering: två, 100 från över- och underkant. */
  hinges: boolean;
  /** Dörrstängare överst på bladet, på slagsidan. */
  closer: boolean;
  /** Brevinkast mitt på bladet. */
  letterbox: boolean;
}

/**
 * Vägghålets form (0.11.8.3): rektangel eller rund (genomföring),
 * genomgående eller en nisch med ett djup från väggens liv, och om det har
 * ett galler (ventgaller).
 */
interface HoleSpec {
  shape: 'rect' | 'round';
  /** Nischens djup från livet, mm; null = genom väggen. */
  depth: number | null;
  /** Ventgallrets lameller i fasaden och en tunn platta i 3D. */
  grille: boolean;
}

/** Vägghålets form som den gäller: typens, annars ett rent, rektangulärt hål genom väggen. */
export const holeOf = (m: Pick<OpeningTypeModel, 'hole'>): HoleSpec => ({ shape: 'rect', depth: null, grille: false, ...(m.hole ?? {}) });

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
  /** Tillverkarens karmavdrag: karmyttermåttet är modulmåttet minus detta (tomt = stilboken › Allmänt). */
  frameLess?: number;
  /** Typens min- och maxmått (karmyttermått), mm: en varning, ingen spärr. */
  min?: [number, number];
  max?: [number, number];
  /** Foder, bleck och fönsterbänk (0.11.8.2); det som saknas får sortens förval. */
  trim?: Partial<OpeningTrim>;
  /** Beslagen (0.11.8.2); det som saknas får sortens förval. */
  hardware?: Partial<OpeningHardware>;
  /** Vägghålets form (0.11.8.3); bara för sorten `hole`. */
  hole?: Partial<HoleSpec>;
}

/** Blecklutningens förval, grader (0.11.8.3). */
export const FLASHING_SLOPE = 15;

/**
 * Foder, bleck och bänk som de gäller: typens, annars förvalet. Fönster har
 * foder på båda sidor, bleck med droppnäsa (utsprång 40, droppnäsa 20) och
 * en fönsterbänk (22 mm, utsprång 20); det som står på golvet (fönsterdörren)
 * har varken bleck eller bänk. Dörrar har foder på båda sidor. Vägghål har
 * inget.
 */
export function trimOf(m: Pick<OpeningTypeModel, 'kind' | 'sill' | 'trim'>): OpeningTrim {
  if (m.kind === 'hole') return { lining: { width: 0, thickness: 0, sides: 'none' }, flashing: null, board: null };
  const win = m.kind === 'window' && !standsOnFloor(m);
  const t = m.trim ?? {};
  return {
    lining: { width: 70, thickness: 15, sides: 'both', ...(t.lining ?? {}) },
    flashing: t.flashing === null ? null : t.flashing ? { ...t.flashing, slope: t.flashing.slope ?? FLASHING_SLOPE } : win ? { overhang: 40, drip: 20, slope: FLASHING_SLOPE } : null,
    board: t.board === null ? null : t.board ? { ...t.board } : win ? { thickness: 22, overhang: 20 } : null,
  };
}

/** Beslagen som de gäller: typens, annars förvalet (trycke på 1 000 och gångjärnsmarkeringen). */
export function hardwareOf(m: Pick<OpeningTypeModel, 'kind' | 'hardware'>): OpeningHardware {
  return { handle: m.kind === 'hole' ? 'none' : 'lever', handleHeight: 1000, hinges: m.kind !== 'hole', closer: false, letterbox: false, ...(m.hardware ?? {}) };
}

export const OPENING_GROUPS: readonly { group: string; kind: OpeningKind; type: string }[] = [
  { group: 'Fönster', kind: 'window', type: 'Window' },
  { group: 'Dörrar', kind: 'door', type: 'Door' },
  { group: 'Vägghål', kind: 'hole', type: 'WallHole' },
];

/** Elementtypen för en sort. */
export const elementTypeOfKind = (k: OpeningKind): string => (k === 'door' ? 'Door' : k === 'hole' ? 'WallHole' : 'Window');
export const kindOfElementType = (t: string): OpeningKind | null => (t === 'Door' ? 'door' : t === 'Window' ? 'window' : t === 'WallHole' ? 'hole' : null);

export const fr = (n = 1): Track => ({ size: n, unit: 'fr' });
export const mm = (n: number): Track => ({ size: n, unit: 'mm' });

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
    // Innerdörrens karm 40 (0.11.8.2, förut 50), så att en 9M-dörr ger fri passage 770.
    frame: { width: 40, depth: 100, bottom: null },
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

function holeModel(hole: Partial<HoleSpec>, extra: Partial<OpeningTypeModel>): OpeningTypeModel {
  return { ...windowModel([{ col: 0, row: 0, fill: 'open', op: 'fixed' }]), kind: 'hole', group: 'Vägghål', frame: { width: 0, depth: 0, bottom: null }, hole, ...extra };
}

export const glass = (col: number, row: number, op: OpKind, hinge?: 'left' | 'right'): OpeningCell => ({ col, row, fill: 'glass', op, ...(hinge ? { hinge } : {}) });
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
  { id: 't-vg-galler', name: 'Ventgaller', description: 'I sockeln eller gavelspetsen', model: holeModel({ grille: true }, { size: [300, 200], sill: 300 }) },
  { id: 't-vg-nisch', name: 'Nisch', description: 'Inte genom väggen', model: holeModel({ depth: 100 }, { size: [600, 600], sill: 900 }) },
  { id: 't-vg-genom', name: 'Genomföring', description: 'Rund, för rör och kanaler', model: holeModel({ shape: 'round' }, { size: [160, 160], sill: 300 }) },
  { id: 't-vg-hal', name: 'Rent hål', model: holeModel({}, { size: [600, 600], sill: 900 }) },
  { id: 't-dd-port', name: 'Garageport', description: 'Enkel takskjutport', model: doorModel([leafCell(0, 0, 'garage', 'flat')], { size: [2500, 2100], frame: { width: 80, depth: 100, bottom: null } }) },
];

/** Typerna som nya projekt börjar med (de andra med *Lägg in förvalda typer*). */
export const STARTER_OPENING_TYPES = ['t-of-sid1', 't-of-sid2', 't-of-fast', 't-dd-slat', 't-dd-glas', 't-vg-galler', 't-vg-hal'];

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
  if (kind === 'hole') return holeModel({}, { size: [300, 300] });
  return DEFAULT_OPENING_TYPES.find((t) => t.id === id)!.model;
}

/** En ny, tom typ i en grupp (editorns *Ny typ…*). */
export function newOpeningModel(kind: OpeningKind, group: string): OpeningTypeModel {
  return { ...structuredClone(fallbackModel(kind)), group };
}

/**
 * Om typen står på golvet (dörrar, fönsterdörren och porten): då finns
 * ingen drevmån under karmen, och karmen står på golvet.
 */
export const standsOnFloor = (m: Pick<OpeningTypeModel, 'kind' | 'sill'>): boolean => m.kind === 'door' || m.sill === 0;

/** Hur hålet och karmen räknas ur modulmåttet (stilboken › Allmänt). */
interface OpeningMeasure {
  /** Hålmåttet är modulmåttet plus detta, på båda ledder (praxis 10). */
  holeAdd: number;
  /** Karmyttermåttet är modulmåttet minus detta, på båda ledder (tillverkarens, ofta 10–20). */
  frameLess: number;
}

/** Karmavdraget för en typ: typens eget (tillverkarens) eller Allmänts. */
export const frameLessOf = (m: Pick<OpeningTypeModel, 'frameLess'>, st: OpeningMeasure): number => m.frameLess ?? st.frameLess;

/**
 * Karmyttermåttet ur modulmåttet (0.11.8.1): modulmåttet i hela decimeter
 * minus karmavdraget på båda ledder (10 × 13 → 990 × 1 290 med 10).
 */
export function frameFromModule(m: Pick<OpeningTypeModel, 'kind' | 'frameLess'>, mod: readonly [number, number], st: OpeningMeasure): [number, number] {
  if (m.kind === 'hole') return [mod[0], mod[1]];
  const d = frameLessOf(m, st);
  return [mod[0] - d, mod[1] - d];
}

/** Hålmåttet ur modulmåttet: modulmåttet plus hålets tillägg (10 × 13 → 1 010 × 1 310 med 10). */
export function holeFromModule(m: Pick<OpeningTypeModel, 'kind'>, mod: readonly [number, number], st: OpeningMeasure): [number, number] {
  if (m.kind === 'hole') return [mod[0], mod[1]];
  return [mod[0] + st.holeAdd, mod[1] + st.holeAdd];
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
      const mu = normalizeMuntins(c.muntins);
      if (mu) out.muntins = mu;
      const lg = normalizeLeafGrid(c.leafGrid);
      if (lg) out.leafGrid = lg;
      if (typeof c.material === 'string' && c.material) out.material = c.material;
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
  if (m.frameLess !== undefined && m.frameLess !== null && Number.isFinite(Number(m.frameLess))) out.frameLess = num(m.frameLess, 10, 0, 100);
  if (m.min) out.min = pair(m.min, [0, 0]);
  if (m.max) out.max = pair(m.max, [0, 0]);
  const trim = normalizeTrim(m.trim);
  if (trim) out.trim = trim;
  const hw = normalizeHardware(m.hardware);
  if (hw) out.hardware = hw;
  if (kind === 'hole' && m.hole && typeof m.hole === 'object') {
    const h: Partial<HoleSpec> = {};
    if (m.hole.shape === 'round' || m.hole.shape === 'rect') h.shape = m.hole.shape;
    if (m.hole.depth !== undefined && m.hole.depth !== null && Number.isFinite(Number(m.hole.depth))) h.depth = num(m.hole.depth, 100, 1, 2000);
    if (typeof m.hole.grille === 'boolean') h.grille = m.hole.grille;
    if (Object.keys(h).length) out.hole = h;
  }
  return out;
}

function normalizeTrim(v: unknown): Partial<OpeningTrim> | null {
  if (!v || typeof v !== 'object') return null;
  const t = v as Record<string, any>;
  const out: Partial<OpeningTrim> = {};
  if (t.lining && typeof t.lining === 'object') {
    const sides = ['both', 'in', 'out', 'none'].includes(t.lining.sides) ? t.lining.sides : 'both';
    out.lining = { width: num(t.lining.width, 70, 0, 400), thickness: num(t.lining.thickness, 15, 0, 100), sides };
  }
  if (t.flashing === null) out.flashing = null;
  else if (t.flashing && typeof t.flashing === 'object') out.flashing = { overhang: num(t.flashing.overhang, 40, 0, 300), drip: num(t.flashing.drip, 20, 0, 100), slope: num(t.flashing.slope, FLASHING_SLOPE, 0, 45) };
  if (t.board === null) out.board = null;
  else if (t.board && typeof t.board === 'object') out.board = { thickness: num(t.board.thickness, 22, 1, 100), overhang: num(t.board.overhang, 20, 0, 300) };
  return Object.keys(out).length ? out : null;
}

function normalizeHardware(v: unknown): Partial<OpeningHardware> | null {
  if (!v || typeof v !== 'object') return null;
  const h = v as Record<string, any>;
  const out: Partial<OpeningHardware> = {};
  if (h.handle === 'lever' || h.handle === 'pull' || h.handle === 'none') out.handle = h.handle;
  if (h.handleHeight !== undefined && Number.isFinite(Number(h.handleHeight))) out.handleHeight = num(h.handleHeight, 1000, 0, 3000);
  for (const k of ['hinges', 'closer', 'letterbox'] as const) if (typeof h[k] === 'boolean') out[k] = h[k];
  return Object.keys(out).length ? out : null;
}

// ---------------------------------------------------------------------------
// Spröjs (0.11.8.1)

const frac = (v: unknown): number => Math.max(0, Math.min(1, Number(v) || 0));

function normalizeMuntins(v: unknown): Muntins | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, any>;
  const kind: MuntinKind = o.kind === 'between' || o.kind === 'fixed' ? o.kind : 'loose';
  const out: Muntins = { v: Math.round(num(o.v, 0, 0, 20)), h: Math.round(num(o.h, 0, 0, 20)), kind };
  if (o.width !== undefined && Number.isFinite(Number(o.width))) out.width = num(o.width, 28, 5, 200);
  if (Array.isArray(o.lines)) {
    const lines = o.lines
      .filter((l: any) => Array.isArray(l?.a) && Array.isArray(l?.b))
      .map((l: any) => ({ a: [frac(l.a[0]), frac(l.a[1])] as [number, number], b: [frac(l.b[0]), frac(l.b[1])] as [number, number] }))
      .filter((l: { a: [number, number]; b: [number, number] }) => Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]) > 1e-3)
      .slice(0, 60);
    if (lines.length) out.lines = lines;
  }
  return out.v || out.h || out.lines ? out : null;
}

export function normalizeLeafGrid(v: unknown): LeafGrid | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, any>;
  const cols = tracks(o.cols);
  const rows = tracks(o.rows);
  const fills = (Array.isArray(o.fills) ? o.fills : [])
    .map((f: any): LeafFill | null => {
      const col = Math.round(num(f?.col, -1, -1, 99));
      const row = Math.round(num(f?.row, -1, -1, 99));
      if (col < 0 || row < 0 || col >= cols.length || row >= rows.length) return null;
      const out: LeafFill = { col, row };
      const cs = Math.round(num(f.colSpan, 1, 1, cols.length - col));
      const rs = Math.round(num(f.rowSpan, 1, 1, rows.length - row));
      if (cs > 1) out.colSpan = cs;
      if (rs > 1) out.rowSpan = rs;
      if (f.glass === true) out.glass = true;
      if (typeof f.material === 'string' && f.material) out.material = f.material;
      if (f.flat === true) out.flat = true;
      return out;
    })
    .filter((f: LeafFill | null): f is LeafFill => !!f);
  return { cols, rows, fills };
}
