import type { Element, Id, ProjectDoc } from './model';

/**
 * Uppställningens fältmall och objektens egna fält (0.11.8.1, kommentar I
 * på mockupen). Fönster och dörrar har var sin mall: fälten i
 * förteckningarna A-42-5-101 och -102, i den ordning de står där. Ett fält
 * som läggs till i mallen blir ett fält på alla objekt av sorten; värdet
 * fylls i i objektets egenskaper (och i uppställningen när den kommer i
 * 0.12) och **bor på objektet** (`params.fields`), så att det följer med
 * även om uppställningen tas bort. Skrivs ett värde för en littera sätts
 * det på alla objekt med litteran; skiljer de sig visas *Olika*.
 *
 * Fälten som räknas fram (littera, antal, mått …), kommer ur typen
 * (hängning, öppningssätt, poster, spröjs …) eller ur objektets läge
 * (bröstningshöjd …) är inga egna fält; resten är det.
 */

export type ScheduleKind = 'Window' | 'Door';

export const DEFAULT_SCHEDULE_FIELDS: Record<ScheduleKind, readonly string[]> = {
  Window: [
    'Antal', 'Hängning', 'Utförande', 'Öppningssätt', 'Karmyttermått', 'Öppningsbredd', 'Öppningshöjd', 'Bröstningshöjd', 'Funktion/placering',
    'U-värde', 'Brandklass', 'Ljudreduktion', 'Motståndsklass', 'Poster', 'Spröjs', 'Fyllning', 'Karmdjup', 'Kulör utvändigt', 'Kulör invändigt',
    'Kulör fyllning', 'Säkerhetsglas', 'LT-värde', 'G-värde', 'Solskydd', 'Beslagning', 'Utfallsskydd', 'Anmärkning', 'Övrigt',
  ],
  Door: [
    'Antal', 'Hängning', 'Utförande', 'Öppningssätt', 'Öppningsbredd', 'Öppningshöjd', 'Utrymme', 'U-värde', 'Brandklass', 'Ljudreduktion',
    'Motståndsklass', 'Ventilation', 'Dörrbladsyta', 'Dörrbladskant', 'Kulör dörrblad', 'Kulör karm', 'Karmtyp', 'Karmdjup', 'Väggtjocklek',
    'Skyddsbeklädnad', 'Glasöppning', 'Säkerhetsglas', 'Tröskel', 'Klämskydd', 'Beslagskod', 'Låshus', 'Slutbleck', 'Karmöverföring',
    'Magnetkontakt', 'Trycke/draghandtag', 'Cylinderbehör', 'Nödbehör', 'Dörrstängare', 'Dörrautomatik', 'Anmärkning', 'Övrigt',
  ],
};

/** Fälten som räknas fram eller kommer ur typen eller läget (inga egna fält på objektet). */
export const DERIVED_FIELDS: ReadonlySet<string> = new Set([
  'Antal', 'Hängning', 'Utförande', 'Öppningssätt', 'Karmyttermått', 'Öppningsbredd', 'Öppningshöjd', 'Bröstningshöjd', 'Poster', 'Spröjs',
  'Karmdjup', 'Väggtjocklek', 'Karmtyp',
]);

export const scheduleKindOf = (type: string): ScheduleKind | null => (type === 'Window' || type === 'Door' ? type : null);

/** Fältmallen för en sort: projektets, eller förvalet. */
export function scheduleFields(doc: Pick<ProjectDoc, 'project'>, kind: ScheduleKind): string[] {
  const own = doc.project.openingSchedule?.fields?.[kind];
  return Array.isArray(own) ? own.filter((f) => typeof f === 'string' && f.trim()) : [...DEFAULT_SCHEDULE_FIELDS[kind]];
}

/** Fälten i mallen som fylls i per objekt. */
export const ownFields = (doc: Pick<ProjectDoc, 'project'>, kind: ScheduleKind): string[] => scheduleFields(doc, kind).filter((f) => !DERIVED_FIELDS.has(f));

/** Objektets värde för ett fält ('' när det saknas). */
export function fieldValue(el: Pick<Element, 'params'>, name: string): string {
  const f = (el.params as { fields?: Record<string, unknown> }).fields;
  const v = f?.[name];
  return typeof v === 'string' ? v : '';
}

/** Ett gemensamt värde för flera objekt, eller null när de skiljer sig (*Olika*). */
export function commonValue(els: readonly Pick<Element, 'params'>[], name: string): string | null {
  const vals = new Set(els.map((e) => fieldValue(e, name)));
  return vals.size === 1 ? [...vals][0] : null;
}

/** Objektets fält med ett värde ändrat (tomt tar bort det). */
export function withField(params: Record<string, unknown>, name: string, value: string): Record<string, unknown> {
  const fields = { ...((params.fields as Record<string, string> | undefined) ?? {}) };
  const v = value.trim();
  if (v) fields[name] = v;
  else delete fields[name];
  const next = { ...params };
  if (Object.keys(fields).length) next.fields = fields;
  else delete next.fields;
  return next;
}

/** Objektens fält med ett fält bytt namn (när mallen ändras). */
export function renameField(params: Record<string, unknown>, from: string, to: string): Record<string, unknown> | null {
  const fields = params.fields as Record<string, string> | undefined;
  if (!fields || !(from in fields)) return null;
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) next[k === from ? to : k] = v;
  return { ...params, fields: next };
}

/** Objekten av en sort med samma littera som de givna (för att skriva per littera). */
export function sameLittera(doc: ProjectDoc, ids: readonly Id[], litteras: ReadonlyMap<Id, string>): Id[] {
  const wanted = new Set(ids.map((id) => litteras.get(id)).filter((l): l is string => !!l));
  const types = new Set(ids.map((id) => doc.elements[id]?.type));
  const out = new Set(ids);
  for (const el of Object.values(doc.elements)) if (types.has(el.type) && wanted.has(litteras.get(el.id) ?? '')) out.add(el.id);
  return [...out];
}
