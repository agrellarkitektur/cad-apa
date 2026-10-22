import { isMaster, type Id, type ProjectDoc, type Sheet } from './model';
import type { DocStore, TxBuilder } from './store';

/**
 * Smarta fält (0.8.10, format 10). Allt inom klamrar i en text på ett
 * mallblad eller ett blad, som inte är en inbyggd smarttext, är ett fält,
 * t.ex. `{Konstruktör}`. Namnen jämförs utan hänsyn till stora och små
 * bokstäver och mellanslag i ändarna; nyckeln är namnet med små bokstäver.
 *
 * Värdena sparas på bladet (`Sheet.fields`) eller, för fält som gäller hela
 * projektet, i `project.fields`. Ett fält gäller hela projektet när dess
 * nyckel finns där, också med ett tomt värde.
 */

/** Nyckeln för ett fältnamn: små bokstäver, ett mellanslag mellan orden. */
export function fieldKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Inbyggd smarttext, som räknas fram av sig själv, och vad den betyder. */
export const BUILT_IN: [string, string][] = [
  ['projekt', 'Projektets namn'],
  ['ritningsnummer', 'Bladets ritningsnummer'],
  ['innehåll', 'Bladets namn'],
  ['mapp', 'Mappen bladet ligger i, t.ex. BYGGLOV'],
  ['skala', 'Vyernas skalor, t.ex. 1:100 (kan skrivas över per blad)'],
  ['skala a3', 'Skalan när bladet skrivs ut på A3, t.ex. 1:100 för ett A1 i 1:50'],
  ['format', 'Pappersformatet, t.ex. A3'],
  ['idag', 'Dagens datum'],
];

const BUILT_IN_KEYS = new Set(BUILT_IN.map(([k]) => k));

/** Inbyggd smarttext som går att skriva över med ett fält på bladet. */
const OVERRIDABLE = new Set(['skala', 'skala a3']);

/** Om ett namn är inbyggd smarttext (och alltså inget fält). */
export function isBuiltIn(name: string): boolean {
  return BUILT_IN_KEYS.has(fieldKey(name));
}

/** Namnen inom klamrar i en text, i ordning, som de är skrivna. */
export function bracedNames(text: string): string[] {
  return [...text.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1].trim()).filter(Boolean);
}

export interface FieldInfo {
  key: string;
  /** Namnet som det först är skrivet, t.ex. "Konstruktör". */
  label: string;
  /** Om fältet gäller hela projektet. */
  shared: boolean;
  /** Om fältet används i mallen eller på bladet (annars har det bara ett värde kvar). */
  used: boolean;
}

/**
 * Texterna på papperet som ett blad visar, mallens först och sedan bladets,
 * uppifrån och ned och från vänster, så att fälten kommer i huvudets ordning.
 */
function sheetTexts(doc: Pick<ProjectDoc, 'elements' | 'worksheets'>, sheet: Pick<Sheet, 'id' | 'master'>): string[] {
  const master = sheet.master ? doc.worksheets.find((w) => w.id === sheet.master) : undefined;
  const order = (space: Id) =>
    Object.values(doc.elements)
      .filter((el) => el.space === space && typeof el.params.text === 'string' && el.params.text.includes('{'))
      .map((el) => ({ text: el.params.text as string, at: (el.params.pos as readonly [number, number] | undefined) ?? [0, 0] }))
      .sort((a, b) => b.at[1] - a.at[1] || a.at[0] - b.at[0])
      .map((t) => t.text);
  // Stämplarna på bladet (0.8.12), i den ordning de ligger.
  const stamps = Object.values(doc.elements)
    .filter((el) => el.space === sheet.id && el.type === 'Stamp' && typeof el.params.stamp === 'string')
    .map((el) => el.params.stamp as Id);
  return [...(isMaster(master) ? order(master.id) : []), ...order(sheet.id), ...[...new Set(stamps)].flatMap(order)];
}

/** Namnet med stor första bokstav, som rubrik i tabellen. */
const label = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

/**
 * Fälten som bladen använder (mallens och bladens egna texter), i den
 * ordning de först förekommer, och fält som har ett värde på något av
 * bladen men inte används längre. Inbyggd smarttext är inga fält, utom
 * skalan som går att skriva över.
 */
export function fieldsOf(doc: Pick<ProjectDoc, 'elements' | 'worksheets' | 'project'>, sheets: readonly Sheet[]): FieldInfo[] {
  const found = new Map<string, FieldInfo>();
  const add = (name: string, used: boolean) => {
    const key = fieldKey(name);
    if (BUILT_IN_KEYS.has(key) && !OVERRIDABLE.has(key)) return;
    const f = found.get(key);
    if (f) f.used ||= used;
    else found.set(key, { key, label: label(used ? name.trim() : key), shared: key in doc.project.fields, used });
  };
  for (const s of sheets) for (const t of sheetTexts(doc, s)) for (const n of bracedNames(t)) add(n, true);
  for (const s of sheets) for (const [k, v] of Object.entries(s.fields)) if (v.trim()) add(k, false);
  // Skalan visas bara om den används eller är överskriven.
  return [...found.values()].filter((f) => !OVERRIDABLE.has(f.key) || f.used || sheets.some((s) => s.fields[f.key]?.trim()));
}

/** Värdet för ett fält på ett blad: projektets om fältet gäller hela projektet. */
export function fieldValue(doc: Pick<ProjectDoc, 'project'>, sheet: Pick<Sheet, 'fields'>, key: string): string {
  return key in doc.project.fields ? doc.project.fields[key] : (sheet.fields[key] ?? '');
}

/**
 * Ändringar i fälten för ett eller flera blad: nya värden för de fält som
 * ändrats, och fält som ska gälla hela projektet (true) eller bara bladen
 * (false). Fält som inte nämns rörs inte.
 */
export interface FieldChanges {
  values?: Record<string, string>;
  shared?: Record<string, boolean>;
}

/**
 * Skriv ändrade fält till bladen (eller projektet) i ett steg (0.8.10).
 * Ett fält som börjar gälla hela projektet tar värdet från första bladet
 * som har ett, och tas bort från bladen; ett som slutar gälla hela
 * projektet får projektets värde på alla blad. Tomma värden tas bort från
 * bladen men ligger kvar (tomma) i projektet.
 */
export function applyFieldChanges(store: DocStore, sheetIds: readonly Id[], ch: FieldChanges, label = 'Spara fälten'): void {
  if (!hasFieldChanges(ch)) return;
  store.transact(label, (tx) => applyFieldChangesTx(tx, sheetIds, ch));
}

/** Om ändringarna ändrar något alls. */
export function hasFieldChanges(ch: FieldChanges): boolean {
  return Object.keys(ch.values ?? {}).length > 0 || Object.keys(ch.shared ?? {}).length > 0;
}

/** Som `applyFieldChanges`, i en pågående transaktion (t.ex. med resten av bladets formulär). */
export function applyFieldChangesTx(tx: TxBuilder, sheetIds: readonly Id[], ch: FieldChanges): void {
  if (!hasFieldChanges(ch)) return;
  const ids = new Set(sheetIds);
  const project = { ...tx.doc.project.fields };
  const sheets = tx.doc.sheets.map((s) => ({ ...s, fields: { ...s.fields } }));
  for (const [name, on] of Object.entries(ch.shared ?? {})) {
    const k = fieldKey(name);
    if (on && !(k in project)) {
      const from = sheets.find((s) => ids.has(s.id) && s.fields[k]?.trim()) ?? sheets.find((s) => s.fields[k]?.trim());
      project[k] = from?.fields[k] ?? '';
      for (const s of sheets) delete s.fields[k];
    } else if (!on && k in project) {
      const v = project[k];
      delete project[k];
      if (v) for (const s of sheets) s.fields[k] = v;
    }
  }
  for (const [name, raw] of Object.entries(ch.values ?? {})) {
    const k = fieldKey(name);
    const v = raw.trim();
    if (k in project) project[k] = v;
    else
      for (const s of sheets) {
        if (!ids.has(s.id)) continue;
        if (v) s.fields[k] = v;
        else delete s.fields[k];
      }
  }
  tx.setProject({ ...tx.doc.project, fields: project });
  tx.setField('sheets', sheets);
}

/** Mappen bladet ligger i, eller tomt. */
export function folderName(doc: Pick<ProjectDoc, 'folders' | 'tree'>, id: Id): string {
  const f = doc.tree[id];
  return (f && doc.folders.find((x) => x.id === f)?.name) || '';
}
