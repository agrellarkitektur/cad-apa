// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import { isIfcGuid } from '../core/ids';
import { normalizeSchedules } from '../core/schedules';
import { normalizeExportSets } from '../core/exportSettings';
import { newStyleBook, normalizeBook } from '../core/graphics';
import { kindOfElementType, normalizeOpeningModel } from '../core/openingTypes';
import { DEFAULT_VIEW_TAGS, FORMAT, FORMAT_VERSION, SITE_STOREY, withSiteLast, type ProjectDoc } from '../core/model';

/**
 * Alla nycklar i `ProjectDoc` och `ProjectDoc['project']` (0.12.5.9). Typen
 * kräver att listorna är fullständiga: ett nytt fält i modellen ger ett
 * typfel här tills det står med. Nycklar som inte står här (från en nyare
 * version) behålls orörda av `normalize`, så att en äldre, cachad version av
 * appen inte kastar dem när den autosparar till filen.
 */
export const DOC_KEYS = {
  format: true, formatVersion: true, project: true, states: true, storeys: true, definitions: true, elements: true, graphics: true, views: true,
  folders: true, tree: true, viewTags: true, worksheets: true, sheets: true, assets: true, site: true, guids: true, exportSets: true, schedules: true,
} as const satisfies Record<keyof ProjectDoc, true>;
export const PROJECT_KEYS = {
  name: true, kind: true, fields: true, roomNumbering: true, doorNumbering: true, angles: true, master: true, openingNumbers: true, openingSchedule: true,
} as const satisfies Record<keyof ProjectDoc['project'], true>;

/** Det i `o` som inte är en känd nyckel. */
function unknownKeys(o: unknown, known: object): Record<string, unknown> {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
  return Object.fromEntries(Object.entries(o).filter(([k]) => !Object.hasOwn(known, k)));
}

/** Bara objekten i en lista: `null`, tal och text i en trasig fil hoppas över (0.12.5.9). */
const objects = (a: unknown): any[] => (Array.isArray(a) ? a.filter((x) => !!x && typeof x === 'object' && !Array.isArray(x)) : []);

/**
 * Projektfilens format. Varje gång formatet ändras höjs FORMAT_VERSION.
 * Före formatfrysen (den öppna betan, se PLAN.md) skrivs inga migreringar: en fil i
 * ett äldre format får ett tydligt meddelande i stället. Migreringarna till
 * och med format 5 togs bort med format 6 (0.8.6), eftersom ingen fil längre
 * kan nå nuvarande format genom dem; de finns i git. Efter formatfrysen får
 * varje formatändring en migrering här, med ett test som öppnar en fil i det
 * gamla formatet.
 */

export class ProjectFormatError extends Error {}

/** Gör om ett projekt till text för att spara. */
export function serialize(doc: ProjectDoc): string {
  return JSON.stringify(doc, null, 1);
}

/**
 * Läs ett projekt från text i nuvarande format; äldre och nyare format får
 * ett meddelande. Element av typer som programmet inte känner till får
 * ligga kvar orörda, så att en fil från en nyare version inte förstörs.
 */
export function parse(text: string): ProjectDoc {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    // En fil som börjar som ett projekt men inte går att läsa är avhuggen eller skadad (0.12.5.9).
    if (/^\s*\{\s*"format"\s*:\s*"bacchus-project"/.test(text.slice(0, 200))) {
      throw new ProjectFormatError('Filen är skadad eller ofullständig. Den slutar för tidigt eller har fel tecken i sig.');
    }
    throw new ProjectFormatError('Filen är inte ett projekt. Den gick inte att läsa som JSON.');
  }
  if (data?.format !== FORMAT) {
    throw new ProjectFormatError('Filen är inte ett projekt från det här programmet.');
  }
  const version = Number(data.formatVersion) || 1;
  if (version > FORMAT_VERSION) {
    throw new ProjectFormatError(
      `Projektet är sparat med en nyare version av programmet (format ${version}). Ladda om sidan för att hämta den senaste versionen.`,
    );
  }
  if (version < FORMAT_VERSION) {
    throw new ProjectFormatError(
      `Projektet är sparat med en äldre alfaversion av programmet (format ${version}). Före den öppna betan uppgraderas inte äldre projekt; öppna det i den version det gjordes med.`,
    );
  }
  return normalize(data);
}

function safeStyle(g: any) {
  try {
    return normalizeBook(g);
  } catch {
    return newStyleBook();
  }
}

/**
 * Kalkeringen i en vy (`trace`, före 0.10.35) blir ett underlag i vyns
 * avvikelser, så att vyerna ser ut som förut. Samma format: fältet läses bara.
 */
function traceAsUnderlay(v: any): any {
  if (!v || typeof v !== 'object' || !('trace' in v)) return v;
  const { trace, ...rest } = v;
  if (typeof trace !== 'string' || !trace || rest.overrides?.underlays) return rest;
  return { ...rest, overrides: { ...(rest.overrides ?? {}), underlays: [{ source: trace }] } };
}

/** Öppningstyperna (0.11.8) får förval för det som saknas. */
function normalizeDefinitions(defs: any): ProjectDoc['definitions'] {
  const out: ProjectDoc['definitions'] = {};
  for (const [id, def] of Object.entries<any>(defs && typeof defs === 'object' ? defs : {})) {
    const kind = kindOfElementType(def?.elementType);
    out[id] = kind && def.opening ? { ...def, opening: normalizeOpeningModel(def.opening, kind) } : def;
  }
  return out;
}

/** Fyll i fält som kan saknas i handskrivna eller äldre filer. */
function normalize(d: any): ProjectDoc {
  const states = objects(d.states);
  const storeys = objects(d.storeys);
  const doc: ProjectDoc = {
    ...unknownKeys(d, DOC_KEYS),
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    project: {
      ...unknownKeys(d.project, PROJECT_KEYS),
      name: d.project?.name ?? 'Namnlöst projekt',
      kind: d.project?.kind ?? 'nybyggnad',
      fields: d.project?.fields ?? {},
      ...(d.project?.roomNumbering ? { roomNumbering: d.project.roomNumbering } : {}),
      ...(d.project?.doorNumbering ? { doorNumbering: d.project.doorNumbering } : {}),
      ...(Array.isArray(d.project?.angles) ? { angles: d.project.angles.map(Number).filter(Number.isFinite) } : {}),
      ...(typeof d.project?.master === 'string' ? { master: d.project.master } : {}),
      ...(d.project?.openingNumbers && typeof d.project.openingNumbers === 'object' ? { openingNumbers: d.project.openingNumbers } : {}),
      ...(d.project?.openingSchedule && typeof d.project.openingSchedule === 'object' ? { openingSchedule: d.project.openingSchedule } : {}),
    },
    views: objects(d.views).map(traceAsUnderlay),
    states: states.length ? states : [{ id: 'st-ny', name: 'Förslag', kind: 'proposal' }],
    // Platsen (0.10.25) sist, också i handskrivna filer.
    storeys: withSiteLast(storeys.some((s: any) => !s.site) ? storeys : [{ id: 'pl-1', name: 'Plan 1', elevation: 0, height: 2700 }]),
    definitions: normalizeDefinitions(d.definitions),
    elements: {},
    graphics: safeStyle(d.graphics),
    folders: objects(d.folders),
    tree: d.tree && typeof d.tree === 'object' ? d.tree : {},
    viewTags: Array.isArray(d.viewTags) ? d.viewTags.map(String) : [...DEFAULT_VIEW_TAGS],
    worksheets: objects(d.worksheets),
    sheets: objects(d.sheets).map((s: any) => ({ ...s, fields: s.fields ?? {}, viewports: objects(s.viewports) })),
    assets: d.assets && typeof d.assets === 'object' ? d.assets : {},
    ...(d.site && typeof d.site === 'object' && Array.isArray(d.site.origin) ? { site: d.site } : {}),
    ...(d.guids && typeof d.guids === 'object' ? { guids: Object.fromEntries(Object.entries<unknown>(d.guids).filter(([, g]) => isIfcGuid(g))) as Record<string, string> } : {}),
    ...(normalizeExportSets(d.exportSets).length ? { exportSets: normalizeExportSets(d.exportSets) } : {}),
    ...(normalizeSchedules(d.schedules).length ? { schedules: normalizeSchedules(d.schedules) } : {}),
  };
  // Platsen känns igen på sitt id (`SITE_STOREY`) lika väl som på flaggan: en handskriven fil
  // med ett annat id får objekten flyttade dit (granskningen efter 0.10.25).
  const site = doc.storeys[doc.storeys.length - 1];
  const oldSite = site.id === SITE_STOREY ? null : site.id;
  if (oldSite) doc.storeys[doc.storeys.length - 1] = { ...site, id: SITE_STOREY };
  for (const [id, el] of Object.entries<any>(d.elements && typeof d.elements === 'object' ? d.elements : {})) {
    // Ett element som inte är ett objekt (null, ett tal) bär inget och hoppas över (Granskning efter 0.12).
    if (!el || typeof el !== 'object' || typeof el.type !== 'string') continue;
    const params = el.params && typeof el.params === 'object' ? el.params : {};
    // Litterans mål utan punkt (en trasig fil) tas bort; de ritades förut som ett fel i hela planen.
    if (Array.isArray(params.targets)) params.targets = params.targets.filter((t: any) => Array.isArray(t?.at) && Number.isFinite(t.at[0]) && Number.isFinite(t.at[1]));
    doc.elements[id] = { ...el, id, storey: el.storey === oldSite ? SITE_STOREY : el.storey, states: el.states ?? [], tags: el.tags ?? [], params, props: el.props ?? {} };
  }
  return doc;
}
