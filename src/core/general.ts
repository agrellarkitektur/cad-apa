import type { Site } from './site';

/**
 * Projektet › Allmänt (0.10.39). Två sorters uppgifter visas på samma
 * sida i stilboken:
 *
 * - **Kontorets** (`StyleResources.office`) och **de allmänna
 *   inställningarna** (`StyleResources.general`) hör till stilboken och
 *   följer med den mellan projekt: företagsnamn, logotyp, kontaktuppgifter,
 *   ansvarig, kontorets egna taggar, textstorlek, höjdsystem och decimaler,
 *   enheter, litterats siffror och tjocklekstabellen.
 * - **Projektets** (namn, nummer, fastighet, skede och projektets fält)
 *   ligger i projektet (`ProjectDoc.project`) och följer inte med
 *   stilboken.
 *
 * Smarttexten läser från båda (`officeVars`, `smartVars`).
 */

/** Logotypen: en bild i projektets filer och dess storlek i pixlar. */
export interface OfficeLogo {
  asset: string;
  width: number;
  height: number;
}

/** Kontorets uppgifter (0.10.39). Tomma fält utelämnas. */
export interface OfficeInfo {
  company?: string;
  address?: string;
  phone?: string;
  email?: string;
  web?: string;
  responsible?: string;
  logo?: OfficeLogo;
  /** Kontorets egna taggar, t.ex. `{org.nr}`: nyckeln med små bokstäver och värdet. */
  tags?: Record<string, string>;
}

/** Kontorets fält som smarttext: taggen, rubriken och fältet. */
export const OFFICE_TAGS: readonly { tag: string; label: string; key: Exclude<keyof OfficeInfo, 'logo' | 'tags'> }[] = [
  { tag: 'företag', label: 'Företagsnamn', key: 'company' },
  { tag: 'kontorsadress', label: 'Adress', key: 'address' },
  { tag: 'telefon', label: 'Telefon', key: 'phone' },
  { tag: 'e-post', label: 'E-post', key: 'email' },
  { tag: 'webb', label: 'Webbplats', key: 'web' },
  { tag: 'ansvarig', label: 'Ansvarig', key: 'responsible' },
];

/** Måttens enhet i ritningen. */
export type LengthUnit = 'mm' | 'cm' | 'm';

/** De allmänna inställningarna (0.10.39). Utelämnat = förvalet (`generalOf`). */
export interface GeneralSettings {
  /** Texthöjd på papperet för ny text, mm. */
  textSize?: number;
  /** Höjdsystemet, t.ex. RH 2000 (smarttexten `{höjdsystem}`). */
  heightSystem?: string;
  /** Decimaler i nivåmarkörerna (+62,400 med tre). */
  levelDecimals?: number;
  /** Decimaler i markhöjderna i planen (+22,20 med två; förut under Platsen). */
  groundDecimals?: number;
  /** Siffror i numrerade litteran (M01 med två; förut under Platsen). */
  litteraDigits?: number;
  /** Måttens enhet. */
  lengthUnit?: LengthUnit;
  /** Decimaler i areorna (m²). */
  areaDecimals?: number;
  /** Tjocklekstabellen, mm (utan 0, som alltid finns: *Ingen linje*). */
  weights?: number[];
  /** Dörrarna, fönstren och vägghålen (0.11.8): litteraregeln, formlerna och måtten. */
  openings?: OpeningSettings;
}

/**
 * Litteraregeln för öppningarna (0.11.8): *Bara bokstav och modulmått*
 * (F 10×13), *Typ och mått* (F01, F02 …; förval) eller *Typ, mått och
 * hängning* (V och H var för sig).
 */
export type OpeningRule = 'module' | 'type' | 'hinge';

export interface OpeningSettings {
  rule?: OpeningRule;
  /** Formeln per sort, t.ex. `F{nr:2}` eller `YD{nr:2}`. */
  formulas?: { Window?: string; Door?: string; WallHole?: string };
  /** Hålmåttet är modulmåttet plus detta, mm (förval 10: 10 × 21 → 1 010 × 2 110). */
  holeAdd?: number;
  /** Karmyttermåttet är modulmåttet minus detta, mm (förval 10; typen kan ha tillverkarens eget). */
  frameLess?: number;
  /** Överkant karm som förval för nya fönster, mm över golvet. */
  head?: number;
  /** Sidohängda fönsterbågar ritas så här många grader öppna i planen (förval 15). */
  swingAngle?: number;
  /** Hängningen (V/H) sedd från utsidan eller insidan. */
  hingeFrom?: 'outside' | 'inside';
}

export const OPENING_DEFAULTS: Required<Omit<OpeningSettings, 'formulas'>> & { formulas: Required<NonNullable<OpeningSettings['formulas']>> } = {
  rule: 'type',
  formulas: { Window: 'F{nr:2}', Door: 'D{nr:2}', WallHole: 'VG{nr:2}' },
  holeAdd: 10,
  frameLess: 10,
  swingAngle: 15,
  head: 2100,
  hingeFrom: 'outside',
};

/** Öppningarnas inställningar som de gäller. */
export function openingSettingsOf(book: { general?: GeneralSettings } | undefined): typeof OPENING_DEFAULTS {
  const o = book?.general?.openings ?? {};
  return { ...OPENING_DEFAULTS, ...o, formulas: { ...OPENING_DEFAULTS.formulas, ...(o.formulas ?? {}) } };
}

function normalizeOpenings(v: unknown): OpeningSettings | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, any>;
  const out: OpeningSettings = {};
  if (o.rule === 'module' || o.rule === 'type' || o.rule === 'hinge') out.rule = o.rule;
  if (o.formulas && typeof o.formulas === 'object') {
    const f: NonNullable<OpeningSettings['formulas']> = {};
    for (const k of ['Window', 'Door', 'WallHole'] as const) if (typeof o.formulas[k] === 'string' && o.formulas[k].trim()) f[k] = o.formulas[k].trim();
    if (Object.keys(f).length) out.formulas = f;
  }
  const holeAdd = clampInt(o.holeAdd, 0, 100);
  if (holeAdd !== undefined) out.holeAdd = holeAdd;
  const frameLess = clampInt(o.frameLess, 0, 100);
  if (frameLess !== undefined) out.frameLess = frameLess;
  const swingAngle = clampInt(o.swingAngle, 0, 90);
  if (swingAngle !== undefined) out.swingAngle = swingAngle;
  const head = clampInt(o.head, 0, 10000);
  if (head !== undefined) out.head = head;
  if (o.hingeFrom === 'outside' || o.hingeFrom === 'inside') out.hingeFrom = o.hingeFrom;
  return Object.keys(out).length ? out : null;
}

/** Tjocklekarna som går att välja när stilboken inte har en egen tabell. */
export const DEFAULT_WEIGHTS: readonly number[] = [0.13, 0.18, 0.25, 0.35, 0.5, 0.7, 1, 1.4];

const GENERAL_DEFAULTS: Required<Omit<GeneralSettings, 'openings'>> & Pick<GeneralSettings, 'openings'> = {
  textSize: 2.5,
  heightSystem: 'RH 2000',
  levelDecimals: 3,
  groundDecimals: 2,
  litteraDigits: 2,
  lengthUnit: 'mm',
  areaDecimals: 1,
  weights: [...DEFAULT_WEIGHTS],
};

/**
 * Inställningarna som de gäller. Det som stilboken inte har tas från
 * Platsen, där decimalerna, litterats siffror och höjdsystemet låg före
 * 0.10.39, och annars förvalet.
 */
export function generalOf(book: { general?: GeneralSettings } | undefined, site?: Pick<Site, 'ground' | 'crs'>): typeof GENERAL_DEFAULTS {
  const g = book?.general ?? {};
  return {
    ...GENERAL_DEFAULTS,
    ...(site?.crs?.height ? { heightSystem: site.crs.height } : {}),
    ...(site?.ground?.levelDecimals !== undefined ? { groundDecimals: site.ground.levelDecimals } : {}),
    ...(site?.ground?.litteraDigits !== undefined ? { litteraDigits: site.ground.litteraDigits } : {}),
    ...g,
  };
}

/** Projektets inställningar: stilbokens, med Platsen som reserv. */
export const docGeneral = (doc: { graphics?: { general?: GeneralSettings }; site?: Pick<Site, 'ground' | 'crs'> }) => generalOf(doc.graphics, doc.site);

const clampInt = (v: unknown, lo: number, hi: number): number | undefined => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined;
};
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** Kontorets uppgifter från fil; null om inget finns. */
export function normalizeOffice(v: unknown): OfficeInfo | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const out: OfficeInfo = {};
  for (const { key } of OFFICE_TAGS) {
    const s = str(o[key]);
    if (s) out[key] = s;
  }
  const logo = o.logo as Record<string, unknown> | undefined;
  if (logo && typeof logo.asset === 'string' && logo.asset && Number(logo.width) > 0 && Number(logo.height) > 0) out.logo = { asset: logo.asset, width: Number(logo.width), height: Number(logo.height) };
  if (o.tags && typeof o.tags === 'object') {
    const tags: Record<string, string> = {};
    for (const [k, val] of Object.entries(o.tags as Record<string, unknown>)) if (k.trim() && typeof val === 'string') tags[tagKey(k)] = val;
    if (Object.keys(tags).length) out.tags = tags;
  }
  return Object.keys(out).length ? out : null;
}

/** De allmänna inställningarna från fil; null om inget finns. */
export function normalizeGeneral(v: unknown): GeneralSettings | null {
  if (!v || typeof v !== 'object') return null;
  const g = v as Record<string, unknown>;
  const out: GeneralSettings = {};
  const size = Number(g.textSize);
  if (Number.isFinite(size) && size > 0 && size <= 50) out.textSize = size;
  const hs = str(g.heightSystem);
  if (hs) out.heightSystem = hs;
  const ld = clampInt(g.levelDecimals, 0, 3);
  if (ld !== undefined) out.levelDecimals = ld;
  const gd = clampInt(g.groundDecimals, 0, 3);
  if (gd !== undefined) out.groundDecimals = gd;
  const lt = clampInt(g.litteraDigits, 1, 4);
  if (lt !== undefined) out.litteraDigits = lt;
  if (g.lengthUnit === 'mm' || g.lengthUnit === 'cm' || g.lengthUnit === 'm') out.lengthUnit = g.lengthUnit;
  const ad = clampInt(g.areaDecimals, 0, 2);
  if (ad !== undefined) out.areaDecimals = ad;
  if (Array.isArray(g.weights)) {
    const w = weightList(g.weights);
    if (w.length) out.weights = w;
  }
  const op = normalizeOpenings(g.openings);
  if (op) out.openings = op;
  return Object.keys(out).length ? out : null;
}

/** En tjocklekstabell: positiva tal, avrundade till hundradelar, utan dubbletter, i ordning. */
export function weightList(v: readonly unknown[]): number[] {
  const out = new Set<number>();
  for (const x of v) {
    const n = Math.round(Number(typeof x === 'string' ? x.replace(',', '.') : x) * 100) / 100;
    if (Number.isFinite(n) && n > 0 && n <= 10) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

/** Taggens nyckel: små bokstäver, ett mellanslag mellan orden (som fälten). */
export function tagKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Kontorets smarttext: fälten och de egna taggarna (tomma utelämnas). */
export function officeVars(office: OfficeInfo | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { tag, key } of OFFICE_TAGS) if (office?.[key]) out[tag] = office[key]!;
  for (const [k, v] of Object.entries(office?.tags ?? {})) if (v.trim()) out[k] = v;
  return out;
}

/** Kontorets taggar (också tomma), för att skilja dem från bladens fält. */
export function officeTagKeys(office: OfficeInfo | undefined): Set<string> {
  return new Set([...OFFICE_TAGS.map((t) => t.tag), ...Object.keys(office?.tags ?? {})]);
}

// ---------------------------------------------------------------------------
// Talen i ritningen

const fmtCache = new Map<string, Intl.NumberFormat>();
function fmt(min: number, max: number): Intl.NumberFormat {
  const k = `${min}:${max}`;
  let f = fmtCache.get(k);
  if (!f) fmtCache.set(k, (f = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: false })));
  return f;
}

/** Ett mått (mm) i ritningens enhet: 3450, 345 eller 3,45. */
export function lengthText(mm: number, unit: LengthUnit = 'mm'): string {
  if (unit === 'cm') return fmt(0, 1).format(mm / 10);
  if (unit === 'm') return fmt(2, 3).format(Math.round(mm) / 1000);
  return fmt(0, 0).format(mm);
}

/** En area (m²) med så många decimaler som valts. */
export function areaText(m2: number, decimals = 1): string {
  const d = Math.max(0, Math.min(2, Math.round(decimals)));
  return `${fmt(d, d).format(m2)} m²`;
}

/** En höjd (m) med tecken: ±0,000, +62,400, −0,45. */
export function signedLevel(m: number, decimals: number): string {
  const d = Math.max(0, Math.min(3, Math.round(decimals)));
  const f = 10 ** d;
  const r = Math.round(m * f) / f;
  return `${r === 0 ? '±' : r > 0 ? '+' : '−'}${fmt(d, d).format(Math.abs(r))}`;
}
