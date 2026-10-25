import { SWEDISH_STANDARD, normalizeStyle } from '../core/graphics';
import { DEFAULT_VIEW_TAGS, FORMAT, FORMAT_VERSION, type ProjectDoc } from '../core/model';

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
    return normalizeStyle(g);
  } catch {
    return structuredClone(SWEDISH_STANDARD);
  }
}

/** Fyll i fält som kan saknas i handskrivna eller äldre filer. */
function normalize(d: any): ProjectDoc {
  const doc: ProjectDoc = {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    project: {
      name: d.project?.name ?? 'Namnlöst projekt',
      kind: d.project?.kind ?? 'nybyggnad',
      fields: d.project?.fields ?? {},
      ...(d.project?.roomNumbering ? { roomNumbering: d.project.roomNumbering } : {}),
      ...(d.project?.doorNumbering ? { doorNumbering: d.project.doorNumbering } : {}),
      ...(Array.isArray(d.project?.angles) ? { angles: d.project.angles.map(Number).filter(Number.isFinite) } : {}),
      ...(typeof d.project?.master === 'string' ? { master: d.project.master } : {}),
    },
    views: Array.isArray(d.views) ? d.views : [],
    states: Array.isArray(d.states) && d.states.length ? d.states : [{ id: 'st-ny', name: 'Förslag', kind: 'proposal' }],
    storeys: Array.isArray(d.storeys) && d.storeys.length ? d.storeys : [{ id: 'pl-1', name: 'Plan 1', elevation: 0, height: 2700 }],
    definitions: d.definitions ?? {},
    elements: {},
    graphics: safeStyle(d.graphics),
    folders: Array.isArray(d.folders) ? d.folders : [],
    tree: d.tree && typeof d.tree === 'object' ? d.tree : {},
    viewTags: Array.isArray(d.viewTags) ? d.viewTags.map(String) : [...DEFAULT_VIEW_TAGS],
    worksheets: Array.isArray(d.worksheets) ? d.worksheets : [],
    sheets: Array.isArray(d.sheets) ? d.sheets.map((s: any) => ({ ...s, fields: s.fields ?? {}, viewports: Array.isArray(s.viewports) ? s.viewports : [] })) : [],
    assets: d.assets && typeof d.assets === 'object' ? d.assets : {},
  };
  for (const [id, el] of Object.entries<any>(d.elements ?? {})) {
    doc.elements[id] = { ...el, id, states: el.states ?? [], tags: el.tags ?? [], params: el.params ?? {}, props: el.props ?? {} };
  }
  return doc;
}
