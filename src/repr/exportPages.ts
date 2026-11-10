import type { Id, ProjectDoc } from '../core/model';
import { idOf } from '../core/exportSettings';
import { exportVars } from '../core/exportJobs';
import type { PdfLayers } from '../core/exportSettings';
import type { PdfMeta, PdfPage } from '../formats/pdf';
import type { Primitive } from './primitives';
import { buildSheet, buildViewPage } from './sheet';

/**
 * Bladen och vyerna som PDF-sidor (0.12): primitiverna med lagren, stämpeln
 * för arbetsmaterial och uppgifterna i dokumentegenskaperna.
 */

/** Objektgrupperna som egna lager under vyn, efter objektets sort. */
const GROUPS: [string, string[]][] = [
  ['Väggar', ['Wall', 'BasisFacade']],
  ['Dörrar, fönster och vägghål', ['Door', 'Window', 'WallHole']],
  ['Bjälklag och tak', ['Slab', 'Roof', 'RoofSlope']],
  ['Trappor och räcken', ['Stair', 'Railing']],
  ['Profiler', ['Profile']],
  ['Rum', ['Space']],
  ['Möbler', ['Furniture']],
  ['Mått', ['Dimension']],
  ['Text och littera', ['Text', 'Label', 'Legend', 'ViewTitle']],
  ['Förteckningar', ['Schedule']],
  ['Markörer', ['Section', 'Elevation', 'North', 'ScaleBar']],
  ['Mark och plats', ['Ground', 'Terrain', 'Tree', 'SiteBuilding', 'SiteMap', 'House']],
  ['Underlag', ['Underlay']],
  ['2D', ['Shape2D', 'Stamp']],
];
const GROUP_OF = new Map(GROUPS.flatMap(([g, types]) => types.map((t) => [t, g] as const)));

/** Objektgruppen (lagrets namn) för en sorts objekt; okända blir *Övrigt*. */
export const objectGroup = (type: string | undefined): string => (type ? (GROUP_OF.get(type) ?? 'Övrigt') : 'Övrigt');

/** Lagret för det som inte hör till en vy: ramen, ritningshuvudet och det som är ritat på bladet. */
export const SHEET_LAYER = 'Bladet';

/** Lager efter vägar av namn: lägger till en väg en gång och svarar med dess index. */
function layerTable() {
  const layers: string[][] = [];
  const index = new Map<string, number>();
  return {
    layers,
    of(path: string[]): number {
      const k = path.join('\u0000');
      let i = index.get(k);
      if (i === undefined) {
        i = layers.push(path) - 1;
        index.set(k, i);
      }
      return i;
    },
  };
}

/** Stämpeln *ARBETSMATERIAL* med datum nederst till vänster, utanför ramen. */
export function workStampPrims(today: string, at: [number, number] = [10, 4]): Primitive[] {
  return [{ kind: 'text', at, text: `ARBETSMATERIAL ${today}`, height: 2.5, pen: { weight: 0.18, color: 'muted' }, origin: { part: 'arbetsmaterial' } }];
}

export interface PageOptions {
  layers: PdfLayers;
  workStamp: boolean;
  today: string;
  autoDims?: boolean;
}

/** Ett blad som PDF-sida, med lager per vy (och objektgrupp) och bokmärke. */
export function sheetPage(doc: ProjectDoc, sheetId: Id, opt: PageOptions): PdfPage | null {
  const s = doc.sheets.find((x) => x.id === sheetId);
  if (!s) return null;
  const d = buildSheet(doc, s, { autoDims: opt.autoDims, today: opt.today });
  const prims: Primitive[] = [...d.prims, ...(opt.workStamp ? workStampPrims(opt.today) : [])];
  const page: PdfPage = { size: d.size, prims, bookmark: `${s.number} ${s.name}`.trim() };
  if (opt.layers === 'none') return page;
  const t = layerTable();
  const viewOf = new Map<Primitive, string>();
  // Två vyer med samma namn får var sitt lager.
  const names = new Map<string, number>();
  for (const v of d.views) {
    const n = (names.get(v.name) ?? 0) + 1;
    names.set(v.name, n);
    const name = n > 1 ? `${v.name} (${n})` : v.name;
    for (const p of v.prims) viewOf.set(p, name);
  }
  const layerOf = prims.map((p) => {
    const view = viewOf.get(p);
    if (!view) return t.of([SHEET_LAYER]);
    if (opt.layers === 'groups' && p.origin?.objectType) return t.of([view, objectGroup(p.origin.objectType)]);
    return t.of([view]);
  });
  return { ...page, layers: t.layers, layerOf };
}

/** En vy ensam som PDF-sida (lagren per objektgrupp när de valts). */
export function viewPage(doc: ProjectDoc, viewId: Id, opt: PageOptions): (PdfPage & { name: string }) | null {
  const v = buildViewPage(doc, viewId, { autoDims: opt.autoDims });
  if (!v) return null;
  const prims = [...v.prims, ...(opt.workStamp ? workStampPrims(opt.today, [4, 2]) : [])];
  if (opt.layers !== 'groups') return { ...v, prims, bookmark: v.name };
  const t = layerTable();
  return { ...v, prims, bookmark: v.name, layers: t.layers, layerOf: prims.map((p) => (p.origin?.objectType ? t.of([objectGroup(p.origin.objectType)]) : -1)) };
}

/** Uppgifterna i PDF:ens dokumentegenskaper för en rad, ur smarttexten. */
export function pdfMeta(doc: ProjectDoc, key: string, today: string): PdfMeta {
  const v = exportVars(doc, key, today);
  const sheet = doc.sheets.find((s) => s.id === idOf(key));
  const fields: Record<string, string> = {
    Projekt: v.projekt ?? '',
    Uppdragsnummer: v.projektnummer ?? '',
    ...(sheet ? { Ritningsnummer: sheet.number, Benamning: sheet.name, Skala: v.skala ?? '', Format: v.format ?? '' } : { Benamning: v.titel ?? '', Skala: v.skala ?? '' }),
    Skede: v.skede ?? '',
    Datum: v.datum?.trim() || today,
    Bet: v.bet ?? '',
  };
  return {
    subject: sheet ? `${sheet.number} ${sheet.name}`.trim() : (v.titel ?? ''),
    keywords: [v.skede, v.projekt].filter((x) => x?.trim()).join(', '),
    author: v['företag'] || v.arkitekt || v.ansvarig || '',
    fields: Object.fromEntries(Object.entries(fields).filter(([, x]) => x.trim())),
  };
}
