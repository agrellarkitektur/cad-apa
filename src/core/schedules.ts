import { newId } from './ids';
import type { Id, ProjectDoc } from './model';
import { scheduleFields } from './openingSchedule';
import type { DocStore, TxBuilder } from './store';

/**
 * Förteckningarna (0.12.2): en tabell ur objekten i modellen, som kan
 * visas för sig, läggas på ett blad och exporteras som CSV. En förteckning
 * har en **källa** (rum, dörrar, fönster, grindar eller det generella
 * litterat), **kolumner** ur källans fält eller smarttext, **sortering**,
 * **gruppering** och en **summarad** för kolumnerna med tal.
 *
 * Förteckningen sparar bara hur tabellen ställs upp; raderna räknas fram
 * ur modellen varje gång (`src/repr/schedules.ts`), så att den alltid är
 * aktuell. Ett valfritt fält i projektet (`ProjectDoc.schedules`), inget
 * nytt formatnummer.
 */

export type ScheduleSource = 'Space' | 'Area' | 'Door' | 'Window' | 'Gate' | 'Label';

export interface ScheduleColumn {
  /** Fältets namn: ett av källans (`SCHEDULE_FIELDS`) eller ett eget, som läses som smarttext. */
  field: string;
  /** Kolumnens rubrik; utelämnad = fältets namn. */
  title?: string;
  /** Summeras i summaraden (bara fält med tal). */
  sum?: boolean;
}

export interface Schedule {
  id: Id;
  name: string;
  source: ScheduleSource;
  columns: ScheduleColumn[];
  /** Sorteringen, första nyckeln först. */
  sort: { field: string; desc?: boolean }[];
  /** Fältet raderna grupperas efter, med en rubrikrad och en delsumma per grupp. */
  group?: string;
  /** En rad per littera med antalet (dörrar, fönster och grindar). */
  perLittera?: boolean;
  /** Tillståndet som räknas; utelämnat = projektets förslag. */
  state?: Id;
  /** Bara de här våningarna; utelämnad = alla (och Platsen för grindar). */
  storeys?: Id[];
  /** Det generella litterat: bara den här sorten (t.ex. *Brandcell*); utelämnad = alla. */
  labelSort?: string;
  /** Summaraden längst ned (förval på). */
  noTotal?: boolean;
}

export const SOURCE_NAMES: Record<ScheduleSource, string> = {
  Space: 'Rum',
  Area: 'Areor',
  Door: 'Dörrar',
  Window: 'Fönster',
  Gate: 'Grindar',
  Label: 'Littera',
};

export const SOURCES: readonly ScheduleSource[] = ['Space', 'Area', 'Door', 'Window', 'Gate', 'Label'];

/** Ett fält i en källa: namnet och om det är ett tal (kan summeras, högerställs). */
export interface ScheduleField {
  name: string;
  number?: boolean;
}

const num = (name: string): ScheduleField => ({ name, number: true });
const txt = (name: string): ScheduleField => ({ name });

/** Fälten som räknas fram för varje källa, i den ordning de erbjuds. */
export const SCHEDULE_FIELDS: Record<ScheduleSource, readonly ScheduleField[]> = {
  Space: [txt('Nummer'), txt('Namn'), txt('Våning'), num('Area'), num('Omkrets'), num('Rumshöjd'), txt('Dagsljus'), num('Glasarea'), txt('Status')],
  // Areorna (0.12.3): de ritade och de framräknade (BYA, BTA och BRA per våning).
  Area: [txt('Areaslag'), txt('Beteckning'), txt('Funktion'), txt('Våning'), num('Area'), txt('Status')],
  Door: [txt('Littera'), num('Antal'), txt('Nummer'), txt('Typ'), txt('Beskrivning'), txt('Våning'), txt('Modulmått'), txt('Karmyttermått'), txt('Hålmått'), txt('Hängning'), txt('Status')],
  Window: [txt('Littera'), num('Antal'), txt('Typ'), txt('Beskrivning'), txt('Våning'), txt('Modulmått'), txt('Karmyttermått'), txt('Hålmått'), txt('Hängning'), num('Bröstningshöjd'), txt('Status')],
  Gate: [txt('Littera'), num('Antal'), txt('Räcke'), txt('Våning'), num('Bredd'), num('Höjd'), txt('Hängning'), txt('Lås'), txt('Status')],
  Label: [txt('Nummer'), txt('Sort'), txt('Text'), txt('Våning'), num('Antal objekt'), txt('Status')],
};

/** Källans fält: de framräknade och, för dörrar och fönster, uppställningens fält ur stilboken. */
export function sourceFields(doc: Pick<ProjectDoc, 'project' | 'graphics'>, source: ScheduleSource): ScheduleField[] {
  const out = [...SCHEDULE_FIELDS[source]];
  if (source === 'Door' || source === 'Window') {
    const have = new Set(out.map((f) => f.name));
    for (const f of scheduleFields(doc, source)) if (!have.has(f)) out.push(txt(f));
  }
  return out;
}

/** Om fältet är ett tal i källan. */
export const isNumberField = (source: ScheduleSource, field: string): boolean => !!SCHEDULE_FIELDS[source].find((f) => f.name === field)?.number;

/** Förvalen för en ny förteckning: kolumner, sortering och om den räknar per littera. */
export function defaultSchedule(source: ScheduleSource): Omit<Schedule, 'id' | 'name'> {
  const cols = (fields: string[], sum: string[] = []): ScheduleColumn[] => fields.map((field) => ({ field, ...(sum.includes(field) ? { sum: true } : {}) }));
  switch (source) {
    case 'Space':
      return { source, columns: cols(['Nummer', 'Namn', 'Våning', 'Area', 'Rumshöjd'], ['Area']), sort: [{ field: 'Nummer' }] };
    case 'Area':
      // Grupperat per areaslag med delsumman i hela m² (SS 21054, 4.3); ingen summa av alla slag.
      return { source, columns: cols(['Våning', 'Beteckning', 'Funktion', 'Area'], ['Area']), sort: [{ field: 'Våning' }, { field: 'Beteckning' }, { field: 'Funktion' }], group: 'Areaslag', perLittera: true, noTotal: true };
    case 'Door':
      return { source, columns: cols(['Littera', 'Antal', 'Modulmått', 'Karmyttermått', 'Hängning', 'Typ'], ['Antal']), sort: [{ field: 'Littera' }], perLittera: true };
    case 'Window':
      return { source, columns: cols(['Littera', 'Antal', 'Modulmått', 'Karmyttermått', 'Bröstningshöjd', 'Hängning'], ['Antal']), sort: [{ field: 'Littera' }], perLittera: true };
    case 'Gate':
      return { source, columns: cols(['Littera', 'Antal', 'Bredd', 'Höjd', 'Hängning', 'Räcke'], ['Antal']), sort: [{ field: 'Littera' }], perLittera: true };
    case 'Label':
      return { source, columns: cols(['Nummer', 'Sort', 'Text', 'Våning']), sort: [{ field: 'Sort' }, { field: 'Nummer' }] };
  }
}

/** Förteckningens namn som förval: *Rumsförteckning*, *Dörrförteckning* …, med nummer om namnet är taget. */
export function defaultScheduleName(doc: Pick<ProjectDoc, 'schedules'>, source: ScheduleSource): string {
  const base = { Space: 'Rumsförteckning', Area: 'Areaförteckning', Door: 'Dörrförteckning', Window: 'Fönsterförteckning', Gate: 'Grindförteckning', Label: 'Litteraförteckning' }[source];
  const taken = new Set((doc.schedules ?? []).map((s) => s.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/** En förteckning ur en fil, med det som saknas ifyllt; null om den inte går att läsa. */
export function normalizeSchedule(s: unknown): Schedule | null {
  if (!s || typeof s !== 'object') return null;
  const x = s as Partial<Schedule>;
  if (typeof x.id !== 'string' || !SOURCES.includes(x.source as ScheduleSource)) return null;
  const source = x.source as ScheduleSource;
  const columns = Array.isArray(x.columns)
    ? x.columns.filter((c) => c && typeof c.field === 'string' && c.field.trim()).map((c) => ({ field: c.field, ...(typeof c.title === 'string' && c.title ? { title: c.title } : {}), ...(c.sum ? { sum: true } : {}) }))
    : defaultSchedule(source).columns;
  const sort = Array.isArray(x.sort) ? x.sort.filter((k) => k && typeof k.field === 'string').map((k) => ({ field: k.field, ...(k.desc ? { desc: true } : {}) })) : [];
  return {
    id: x.id,
    name: typeof x.name === 'string' && x.name.trim() ? x.name : SOURCE_NAMES[source],
    source,
    columns,
    sort,
    ...(typeof x.group === 'string' && x.group ? { group: x.group } : {}),
    ...(x.perLittera && source !== 'Space' && source !== 'Label' ? { perLittera: true } : {}),
    ...(typeof x.state === 'string' ? { state: x.state } : {}),
    ...(Array.isArray(x.storeys) && x.storeys.length ? { storeys: x.storeys.filter((v) => typeof v === 'string') } : {}),
    ...(typeof x.labelSort === 'string' && x.labelSort ? { labelSort: x.labelSort } : {}),
    ...(x.noTotal ? { noTotal: true } : {}),
  };
}

export function normalizeSchedules(list: unknown): Schedule[] {
  return Array.isArray(list) ? list.map(normalizeSchedule).filter((s): s is Schedule => !!s) : [];
}

export const scheduleOf = (doc: Pick<ProjectDoc, 'schedules'>, id: Id): Schedule | undefined => doc.schedules?.find((s) => s.id === id);

/** Om id:t är en förteckning (en vy på ett blad kan vara en). */
export const isScheduleId = (doc: Pick<ProjectDoc, 'schedules'>, id: Id): boolean => !!scheduleOf(doc, id);

function putSchedules(tx: TxBuilder, list: Schedule[]): void {
  tx.setField('schedules', list.length ? list : undefined);
}

/** En ny förteckning med källans förval. Svarar med dess id. */
export function createSchedule(store: DocStore, source: ScheduleSource, init: Partial<Omit<Schedule, 'id' | 'source'>> = {}): Id {
  const id = newId('forteckning');
  const s: Schedule = { id, name: init.name ?? defaultScheduleName(store.doc, source), ...defaultSchedule(source), ...init, source };
  store.transact(`Ny förteckning ${s.name}`, (tx) => putSchedules(tx, [...(tx.doc.schedules ?? []), s]));
  return id;
}

/** Ändra en förteckning. */
export function updateSchedule(store: DocStore, id: Id, patch: Partial<Omit<Schedule, 'id' | 'source'>>, label = 'Ändra förteckningen'): void {
  const list = store.doc.schedules ?? [];
  const i = list.findIndex((s) => s.id === id);
  if (i < 0) return;
  const next = normalizeSchedule({ ...list[i], ...patch });
  if (!next) return;
  // Fält som sätts till undefined tas bort.
  for (const [k, v] of Object.entries(patch)) if (v === undefined) delete (next as unknown as Record<string, unknown>)[k];
  store.transact(label, (tx) => putSchedules(tx, list.map((s, j) => (j === i ? next : s))));
}

/** En kopia av förteckningen, sist i listan. */
export function duplicateSchedule(store: DocStore, id: Id): Id | null {
  const s = scheduleOf(store.doc, id);
  if (!s) return null;
  const copy: Schedule = { ...structuredClone(s), id: newId('forteckning'), name: `${s.name} (kopia)` };
  store.transact(`Kopiera förteckningen ${s.name}`, (tx) => putSchedules(tx, [...(tx.doc.schedules ?? []), copy]));
  return copy.id;
}

/** Ta bort förteckningen, och den från bladen där den ligger. */
export function removeSchedule(store: DocStore, id: Id): void {
  const s = scheduleOf(store.doc, id);
  if (!s) return;
  store.transact(`Ta bort förteckningen ${s.name}`, (tx) => {
    putSchedules(tx, (tx.doc.schedules ?? []).filter((x) => x.id !== id));
    if (tx.doc.sheets.some((sh) => sh.viewports.some((v) => v.view === id))) tx.setField('sheets', tx.doc.sheets.map((sh) => ({ ...sh, viewports: sh.viewports.filter((v) => v.view !== id) })));
    if (tx.doc.tree[id]) {
      const tree = { ...tx.doc.tree };
      delete tree[id];
      tx.setField('tree', tree);
    }
  });
}
