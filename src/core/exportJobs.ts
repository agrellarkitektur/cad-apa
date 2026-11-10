import { generalOf, officeVars } from './general';
import type { Id, ProjectDoc, TreeTab } from './model';
import { expandSmartText, smartVars } from '../repr/smartText';
import {
  FORMAT_EXT,
  FORMAT_FOLDER,
  formatsFor,
  IMAGE_CURRENT,
  idOf,
  kindOf,
  MODEL_ALL,
  nameTemplate,
  type ExportFormat,
  type ExportKind,
  type ExportOptions,
  type ExportSet,
  type ExportSettings,
} from './exportSettings';

/**
 * Vad en export blir (0.12): raderna i trädets ordning, filnamnen ur
 * smarttexten och jobben som skrivarna kör, ett per fil. Rent, utan
 * webbläsaren, så att förhandslistan och testerna räknar likadant.
 */

/** Bladen eller vyerna i projektträdets ordning: undermapparna (efter namn) före det som ligger direkt i mappen. */
export function treeOrder(doc: Pick<ProjectDoc, 'folders' | 'tree'>, tab: TreeTab, ids: readonly Id[]): Id[] {
  const folders = doc.folders.filter((f) => f.tab === tab);
  const valid = new Set(folders.map((f) => f.id));
  const out: Id[] = [];
  const walk = (parent: Id | null) => {
    for (const f of folders.filter((x) => x.parent === parent).sort((a, b) => a.name.localeCompare(b.name, 'sv', { numeric: true }))) walk(f.id);
    for (const id of ids) {
      const at = doc.tree[id];
      if (parent ? at === parent : !(at && valid.has(at))) out.push(id);
    }
  };
  walk(null);
  return out;
}

/** Alla rader som går att exportera, i trädets ordning. */
export function exportKeys(doc: ProjectDoc): string[] {
  return [
    ...treeOrder(doc, 'ritningar', doc.sheets.map((s) => s.id)).map((id) => `sheet:${id}`),
    ...treeOrder(doc, 'vyer', doc.views.map((v) => v.id)).map((id) => `view:${id}`),
    IMAGE_CURRENT,
    MODEL_ALL,
  ];
}

/** De rader en uppsättning tar: de valda som finns, och allt av sorterna under `all`. */
export function setKeys(doc: ProjectDoc, set: Pick<ExportSet, 'items' | 'all'>): string[] {
  const all = new Set(set.all ?? []);
  const items = new Set(set.items);
  return exportKeys(doc).filter((k) => items.has(k) || all.has(kindOf(k)));
}

/** Smarttexten för en rad: bladets som på bladet, och för vyer, bilder och modellen projektets och kontorets. */
export function exportVars(doc: ProjectDoc, key: string, today: string): Record<string, string> {
  const kind = kindOf(key);
  if (kind === 'sheet') {
    const s = doc.sheets.find((x) => x.id === idOf(key));
    if (s) {
      const sv = smartVars(doc, s, today);
      return { ...sv, titel: s.name, datum: sv.datum?.trim() || today, typ: 'ritning' };
    }
  }
  const office = officeVars(doc.graphics?.office);
  const fields = doc.project.fields;
  const base: Record<string, string> = {
    ...office,
    ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k.toLowerCase(), v])),
    projekt: doc.project.name,
    projektnummer: fields.projektnummer?.trim() || fields.uppdragsnummer || '',
    höjdsystem: generalOf(doc.graphics, doc.site).heightSystem,
    idag: today,
    datum: today,
  };
  if (kind === 'view') {
    const v = doc.views.find((x) => x.id === idOf(key));
    return { ...base, vy: v?.name ?? '', titel: v?.name ?? '', skala: `1:${v?.scale ?? 100}`, typ: 'vy' };
  }
  if (kind === 'image') return { ...base, vy: '3D', titel: '3D', typ: 'bild' };
  return { ...base, vy: 'modell', titel: 'modell', typ: 'modell' };
}

/** Ett filnamn som går att spara på Windows (utan ändelse): inga otillåtna tecken, inga punkter eller mellanslag i slutet. */
export function safeFileName(raw: string): string {
  return (
    raw
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[. ]+$/, '')
      .replace(/^(con|prn|aux|nul|com\d|lpt\d)$/i, '$1-') || 'fil'
  );
}

/** Ett jobb: en fil som en skrivare gör. */
export interface ExportJob {
  /** Raderna filen görs av (flera blad i en samlad PDF). */
  keys: string[];
  kind: ExportKind;
  format: ExportFormat;
  /** Sökvägen i mappen eller zipfilen, med undermappen och ändelsen. */
  path: string;
  /** Titeln i filen och förloppet. */
  title: string;
}

export interface ExportPlan {
  jobs: ExportJob[];
  /** Sökvägarna som förekommer mer än en gång (gemener). */
  duplicates: Set<string>;
}

/**
 * Jobben för det valda: en fil per rad och format, eller en samlad PDF för
 * bladen. Filnamnen ur stilbokens mallar; dubbletter markeras (och får
 * *(2)* när de skrivs, `uniquePaths`).
 */
export function planExport(
  doc: ProjectDoc,
  keys: readonly string[],
  formats: Readonly<Record<string, readonly ExportFormat[]>> | undefined,
  options: Required<ExportOptions>,
  today: string,
  settings: ExportSettings | undefined = doc.graphics.export,
  titleOf: (key: string) => string = (k) => k,
): ExportPlan {
  const jobs: ExportJob[] = [];
  const folder = (f: ExportFormat) => (options.subfolders ? `${FORMAT_FOLDER[f]}/` : '');
  const name = (key: string) => safeFileName(expandSmartText(nameTemplate(settings, kindOf(key)), exportVars(doc, key, today)));
  // Den samlade PDF:en tar bladen som ska bli PDF (inte de som bara blir DXF).
  const sheets = keys.filter((k) => kindOf(k) === 'sheet' && formatsFor(k, formats).includes('pdf'));
  if (options.combined && sheets.length > 1) {
    const vars = exportVars(doc, MODEL_ALL, today);
    jobs.push({ keys: sheets, kind: 'sheet', format: 'pdf', path: `${folder('pdf')}${safeFileName(expandSmartText('{projekt}', vars))}.pdf`, title: doc.project.name });
  }
  for (const key of keys) {
    const kind = kindOf(key);
    for (const f of formatsFor(key, formats)) {
      if (kind === 'sheet' && f === 'pdf' && options.combined && sheets.length > 1) continue;
      jobs.push({ keys: [key], kind, format: f, path: `${folder(f)}${name(key)}.${FORMAT_EXT[f]}`, title: titleOf(key) });
    }
  }
  const seen = new Map<string, number>();
  for (const j of jobs) seen.set(j.path.toLowerCase(), (seen.get(j.path.toLowerCase()) ?? 0) + 1);
  return { jobs, duplicates: new Set([...seen].filter(([, n]) => n > 1).map(([p]) => p)) };
}

/** Sökvägarna med *(2)*, *(3)* … efter dubbletterna, så att inget skrivs över. */
export function uniquePaths(paths: readonly string[]): string[] {
  const used = new Set<string>();
  return paths.map((p) => {
    const slash = p.lastIndexOf('/');
    const dir = p.slice(0, slash + 1);
    const file = p.slice(slash + 1);
    const dot = file.lastIndexOf('.');
    const stem = dot > 0 ? file.slice(0, dot) : file;
    const ext = dot > 0 ? file.slice(dot) : '';
    let out = p;
    for (let i = 2; used.has(out.toLowerCase()); i++) out = `${dir}${stem} (${i})${ext}`;
    used.add(out.toLowerCase());
    return out;
  });
}

// ---------------------------------------------------------------------------
// Objektens GUID

const IFC_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';

/** Ett nytt IfcGloballyUniqueId: 128 slumpade bitar som 22 tecken (IFC:s base64). */
export function newIfcGuid(random: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  const b = random(new Uint8Array(16));
  // Version 4 och variant som en vanlig UUID.
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  // Första tecknet bär 2 bitar, de andra 21 bär 6 bitar var.
  let big = 0n;
  for (const x of b) big = (big << 8n) | BigInt(x);
  let s = '';
  for (let i = 0; i < 22; i++) {
    s = IFC_CHARS[Number(big & 63n)] + s;
    big >>= 6n;
  }
  return s;
}

export const isIfcGuid = (s: unknown): s is string => typeof s === 'string' && /^[0-3][0-9A-Za-z_$]{21}$/.test(s);

/**
 * GUID för alla objekt (0.12), som följer med i varje export: de som redan
 * har en behåller den, nya får en, och borttagna objekt släpps ur listan.
 * Listan hör till projektet (`ProjectDoc.guids`, objektets id → GUID), så
 * att en kopia (som får ett nytt id) också får en ny GUID och att ångra
 * inte tar bort den. Null om inget ändras.
 */
export function withGuids(doc: Pick<ProjectDoc, 'elements' | 'guids'>, make: () => string = () => newIfcGuid()): Record<Id, string> | null {
  const old = doc.guids ?? {};
  const out: Record<Id, string> = {};
  let changed = false;
  const used = new Set<string>();
  for (const id of Object.keys(doc.elements).sort()) {
    let g = old[id];
    if (!isIfcGuid(g) || used.has(g)) {
      do g = make();
      while (used.has(g));
      changed = true;
    }
    used.add(g);
    out[id] = g;
  }
  if (Object.keys(old).some((id) => !doc.elements[id])) changed = true;
  return changed ? out : null;
}
