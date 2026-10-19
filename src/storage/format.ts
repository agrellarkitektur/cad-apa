import { SWEDISH_STANDARD, normalizeStyle } from '../core/graphics';
import { DEFAULT_VIEW_TAGS, drawingMarkers, emptyTree, FORMAT, FORMAT_VERSION, type ProjectDoc } from '../core/model';
import { orientExteriorWalls } from '../elements/orient';

/**
 * Projektfilens format. Varje gång formatet ändras höjs FORMAT_VERSION.
 * Före formatfrysen (pilotprojektet, 0.13) läggs inga nya migreringar till:
 * en fil i ett äldre format får ett tydligt meddelande i stället. Migreringarna
 * nedan, till och med format 5, ligger kvar. Efter formatfrysen får varje
 * formatändring en migrering här igen. Nyckeln är versionen migreringen leder
 * till.
 */
const migrations: Record<number, (doc: any) => any> = {
  // 1 → 2: stilmall för ritningsgrafiken. Äldre projekt får svensk standard.
  2: (doc) => ({ ...doc, graphics: structuredClone(SWEDISH_STANDARD) }),
  // 2 → 3: väggar har en insida (höger i ritriktningen), vyer, mått som pekar
  // på objekt och egna egenskaper. Ytterväggarna vänds efter läsningen, se nedan.
  3: (doc) => doc,
  // 3 → 4: bågväggar (pilhöjd), väggar upp till taket, tak, norrpil, fasader
  // och sektioner. Äldre projekt får norrpil, fyra fasader och en sektion.
  4: (doc) => {
    const storey = doc.storeys?.[0]?.id ?? 'pl-1';
    const markers = drawingMarkers(storey, northBeside(doc));
    const elements = { ...(doc.elements ?? {}) };
    for (const [id, el] of Object.entries(markers)) if (!elements[id]) elements[id] = el;
    return { ...doc, elements };
  },
  // 4 → 5: mappar i projektträdet, vy-taggar, 2D-element med Visas i, lås,
  // arbetsblad, ritningsblad och underlag. Inget i en äldre fil ändras; de
  // nya fälten börjar tomma (vy-taggarna med förslagen).
  5: (doc) => ({ ...emptyTree(), ...doc }),
};

/** En plats för norrpilen strax utanför väggarnas övre högra hörn. */
function northBeside(doc: any): [number, number] {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const el of Object.values<any>(doc.elements ?? {})) {
    if (el?.type !== 'Wall' || !el.params?.start || !el.params?.end) continue;
    xs.push(el.params.start[0], el.params.end[0]);
    ys.push(el.params.start[1], el.params.end[1]);
  }
  if (!xs.length) return [6000, 4000];
  return [Math.round(Math.max(...xs) + 3000), Math.round(Math.max(...ys))];
}

export class ProjectFormatError extends Error {}

/** Gör om ett projekt till text för att spara. */
export function serialize(doc: ProjectDoc): string {
  return JSON.stringify(doc, null, 1);
}

/**
 * Läs ett projekt från text. Kör de migreringar som behövs för att nå
 * nuvarande version. Element av typer som programmet inte känner till får
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
  let version = Number(data.formatVersion) || 1;
  const from = version;
  if (version > FORMAT_VERSION) {
    throw new ProjectFormatError(
      `Projektet är sparat med en nyare version av programmet (format ${version}). Ladda om sidan för att hämta den senaste versionen.`,
    );
  }
  while (version < FORMAT_VERSION) {
    const step = migrations[version + 1];
    if (!step) {
      throw new ProjectFormatError(
        `Projektet är sparat med en äldre betaversion av programmet (format ${version}). Före version 1.0 uppgraderas inte äldre projekt; öppna det i den version det gjordes med.`,
      );
    }
    data = step(data);
    version += 1;
    data.formatVersion = version;
  }
  let doc = normalize(data);
  // Före format 3 kunde ytterväggar vara ritade åt båda hållen.
  if (from < 3) doc = orientExteriorWalls(doc);
  return doc;
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
    sheets: Array.isArray(d.sheets) ? d.sheets : [],
    assets: d.assets && typeof d.assets === 'object' ? d.assets : {},
  };
  for (const [id, el] of Object.entries<any>(d.elements ?? {})) {
    doc.elements[id] = { ...el, id, states: el.states ?? [], tags: el.tags ?? [], params: el.params ?? {}, props: el.props ?? {} };
  }
  return doc;
}
