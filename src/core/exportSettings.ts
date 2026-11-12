import { normalizeDxfSettings, type DxfSettings } from './dxfLayers';
import type { Id } from './model';

/**
 * Exporten (0.12): det som exporteras, i vilka format, och uppsättningarna
 * som sparas med namn. Formaten är skrivare bakom en dialog och kommer en i
 * taget (DXF i 0.12.1, förteckningarna i 0.12.2, IFC i 0.12.7); en
 * rad i dialogen är ett blad, en vy, en 3D-vy eller modellen.
 *
 * Inställningar som hör till kontorets sätt att leverera (filnamnsmallarna)
 * ligger i stilboken › Allmänt › Export och följer med stilboken; det som
 * väljs för en leverans (vad, format, vart) ligger i uppsättningen.
 */

/** Sorten på en rad i exporten. */
export type ExportKind = 'sheet' | 'view' | 'schedule' | 'image' | 'model';
export type ExportFormat = 'pdf' | 'dxf' | 'csv' | 'xlsx' | 'png' | 'jpeg' | 'glb';

export const EXPORT_KINDS: readonly ExportKind[] = ['sheet', 'view', 'schedule', 'image', 'model'];

/** Formaten en sort kan exporteras i, förvalet först. */
export const FORMATS_FOR: Record<ExportKind, readonly ExportFormat[]> = {
  sheet: ['pdf', 'dxf'],
  // Vyer går till dem som ritar vidare (konstruktören, landskap), så DXF är förvalet (0.12.1).
  view: ['dxf', 'pdf'],
  // Förteckningarna (0.12.2) går till kalkylen som CSV, eller XLSX med summorna som formler (0.12.3); på bladet följer de med i bladets PDF.
  schedule: ['csv', 'xlsx', 'pdf'],
  image: ['png', 'jpeg'],
  model: ['glb'],
};

export const FORMAT_LABEL: Record<ExportFormat, string> = { pdf: 'PDF', dxf: 'DXF', csv: 'CSV', xlsx: 'XLSX', png: 'PNG', jpeg: 'JPEG', glb: 'glTF' };
export const FORMAT_EXT: Record<ExportFormat, string> = { pdf: 'pdf', dxf: 'dxf', csv: 'csv', xlsx: 'xlsx', png: 'png', jpeg: 'jpg', glb: 'glb' };
/** Undermappen per format när *Undermappar* är valt. */
export const FORMAT_FOLDER: Record<ExportFormat, string> = { pdf: 'PDF', dxf: 'DXF', csv: 'Förteckningar', xlsx: 'Förteckningar', png: 'Bilder', jpeg: 'Bilder', glb: 'glTF' };

/** Raden för den nuvarande 3D-vyn (0.12; de sparade 3D-vyerna kommer i 0.12.9) och för modellen. */
export const IMAGE_CURRENT = 'image:current';
export const MODEL_ALL = 'model:all';

export const kindOf = (key: string): ExportKind => key.slice(0, key.indexOf(':')) as ExportKind;
export const idOf = (key: string): Id => key.slice(key.indexOf(':') + 1);

/** Stilboken › Allmänt › Export (0.12). Utelämnat = förvalet. */
export interface ExportSettings {
  /** Filnamnsmallen per sort, med smarttext. */
  names?: Partial<Record<ExportKind, string>>;
  /** DXF (0.12.1): lagerkartan, en egen lagerlista och om alla lager skrivs. */
  dxf?: DxfSettings;
}

/**
 * Filnamnen som förval: ritningsnumret för blad (beteckningen inte i namnet,
 * enligt praxis, så att filen behåller sitt namn mellan beteckningarna).
 */
export const NAME_DEFAULTS: Record<ExportKind, string> = {
  sheet: '{ritningsnummer}',
  view: '{projekt}_{vy}',
  schedule: '{projekt}_{vy}',
  image: '{projekt}_{vy}',
  model: '{projekt}',
};

export const nameTemplate = (s: ExportSettings | undefined, kind: ExportKind): string => s?.names?.[kind]?.trim() || NAME_DEFAULTS[kind];

/** Hur PDF:erna lagras. */
export type PdfLayers = 'none' | 'views' | 'groups';

/** Det som väljs i dialogen för en leverans; utelämnat = förvalet (`EXPORT_OPTION_DEFAULTS`). */
export interface ExportOptions {
  /** Alla blad i en samlad PDF med bokmärken, i stället för en fil per blad. */
  combined?: boolean;
  /** Lager i PDF:en: inga, en per vy på bladet, eller dessutom per objektgrupp. */
  layers?: PdfLayers;
  /** Stämpeln *ARBETSMATERIAL* med datum nederst på bladen. */
  workStamp?: boolean;
  /** Bildens storlek i bildpunkter. */
  imageSize?: [number, number];
  /** Undermappar per format (*PDF/*, *Bilder/* …). */
  subfolders?: boolean;
  /** Vart filerna skrivs: en vald mapp eller en zipfil. */
  target?: 'folder' | 'zip';
  /** DXF-versionen (0.12.1): AutoCAD 2000, som alla program öppnar, eller 2018. */
  dxfVersion?: 'R2000' | 'R2018';
}

export const EXPORT_OPTION_DEFAULTS: Required<ExportOptions> = {
  combined: false,
  layers: 'views',
  workStamp: false,
  imageSize: [3000, 2000],
  subfolders: false,
  target: 'folder',
  dxfVersion: 'R2000',
};

export const optionsOf = (o: ExportOptions | undefined): Required<ExportOptions> => ({ ...EXPORT_OPTION_DEFAULTS, ...(o ?? {}) });

/**
 * En exportuppsättning (0.12): ett urval med format och inställningar som
 * sparas med namn i projektet (*Bygglov*, *Till konstruktören*) och körs om
 * med ett klick eller `EXPORT Bygglov` i kommandoraden.
 */
export interface ExportSet {
  id: Id;
  name: string;
  /** Raderna: `sheet:<id>`, `view:<id>`, `image:current`, `model:all`. */
  items: string[];
  /** Sorter där allt är med, också blad och vyer som läggs till senare (och i en mall). */
  all?: ExportKind[];
  /** Formaten per rad, när de inte är sortens förval. */
  formats?: Record<string, ExportFormat[]>;
  options?: ExportOptions;
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const isKind = (v: unknown): v is ExportKind => EXPORT_KINDS.includes(v as ExportKind);

/** Formaten för en rad: de valda som sorten kan, annars förvalet. */
export function formatsFor(key: string, formats: Readonly<Record<string, readonly ExportFormat[]>> | undefined): ExportFormat[] {
  const kind = kindOf(key);
  const ok = FORMATS_FOR[kind] ?? [];
  const chosen = (formats?.[key] ?? []).filter((f) => ok.includes(f));
  return chosen.length ? [...new Set(chosen)] : ok.slice(0, 1);
}

export function normalizeExportSettings(v: unknown): ExportSettings | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, any>;
  const names: Partial<Record<ExportKind, string>> = {};
  for (const k of EXPORT_KINDS) {
    const s = str(o.names?.[k]);
    if (s && s !== NAME_DEFAULTS[k]) names[k] = s;
  }
  const dxf = normalizeDxfSettings(o.dxf);
  const out: ExportSettings = { ...(Object.keys(names).length ? { names } : {}), ...(dxf ? { dxf } : {}) };
  return Object.keys(out).length ? out : null;
}

export function normalizeOptions(v: unknown): ExportOptions | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, any>;
  const out: ExportOptions = {};
  if (typeof o.combined === 'boolean') out.combined = o.combined;
  if (o.layers === 'none' || o.layers === 'views' || o.layers === 'groups') out.layers = o.layers;
  if (typeof o.workStamp === 'boolean') out.workStamp = o.workStamp;
  if (Array.isArray(o.imageSize)) {
    const [w, h] = o.imageSize.map((x: unknown) => Math.round(Number(x)));
    if (w >= 64 && h >= 64 && w <= 8192 && h <= 8192) out.imageSize = [w, h];
  }
  if (typeof o.subfolders === 'boolean') out.subfolders = o.subfolders;
  if (o.target === 'folder' || o.target === 'zip') out.target = o.target;
  if (o.dxfVersion === 'R2000' || o.dxfVersion === 'R2018') out.dxfVersion = o.dxfVersion;
  return Object.keys(out).length ? out : undefined;
}

/** Projektets uppsättningar från fil; trasiga hoppas över. */
export function normalizeExportSets(v: unknown): ExportSet[] {
  if (!Array.isArray(v)) return [];
  const out: ExportSet[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue;
    const id = str(raw.id);
    const name = str(raw.name);
    if (!id || !name || out.some((s) => s.id === id)) continue;
    const items: string[] = Array.isArray(raw.items) ? [...new Set<string>(raw.items.filter((k: unknown): k is string => typeof k === 'string' && isKind(k.split(':')[0])))] : [];
    const all = Array.isArray(raw.all) ? [...new Set(raw.all.filter(isKind))] as ExportKind[] : [];
    const formats: Record<string, ExportFormat[]> = {};
    if (raw.formats && typeof raw.formats === 'object')
      for (const [k, f] of Object.entries<any>(raw.formats)) {
        if (!isKind(k.split(':')[0]) || !Array.isArray(f)) continue;
        const ok = f.filter((x: unknown) => FORMATS_FOR[kindOf(k)].includes(x as ExportFormat));
        if (ok.length) formats[k] = ok;
      }
    const options = normalizeOptions(raw.options);
    out.push({ id, name, items, ...(all.length ? { all } : {}), ...(Object.keys(formats).length ? { formats } : {}), ...(options ? { options } : {}) });
  }
  return out;
}

/**
 * Uppsättningarna för en mall: bara sorterna där allt är med och formaten
 * per sort, eftersom bladen och vyerna i ett nytt projekt är andra.
 */
export function templateSets(sets: readonly ExportSet[]): ExportSet[] {
  return sets
    .map((s) => {
      const fixed = s.items.filter((k) => k === IMAGE_CURRENT || k === MODEL_ALL) as string[];
      const formats = Object.fromEntries(Object.entries(s.formats ?? {}).filter(([k]) => fixed.includes(k)));
      return { id: s.id, name: s.name, items: fixed, ...(s.all?.length ? { all: [...s.all] } : {}), ...(Object.keys(formats).length ? { formats } : {}), ...(s.options ? { options: { ...s.options } } : {}) };
    })
    .filter((s) => s.items.length || s.all?.length);
}

/** Uppsättningen med ett namn (skiftläget spelar ingen roll), för kommandoraden. */
export function setByName(sets: readonly ExportSet[] | undefined, name: string): ExportSet | undefined {
  const k = name.trim().toLowerCase();
  return sets?.find((s) => s.name.toLowerCase() === k) ?? sets?.find((s) => s.name.toLowerCase().startsWith(k));
}
