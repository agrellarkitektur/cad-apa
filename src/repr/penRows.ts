import type { PenDef } from '../core/graphics';
import type { ViewType } from '../core/viewCategories';
import { CONTOUR_PENS, defaultContourPen } from './contourPens';
import { defaultFacadePen, FACADE_PENS } from './facadePens';
import { defaultMarkerPen, MARKER_PENS, ROOM_PENS, type MarkerPenKey } from './markerPens';
import { defaultOpeningPen, OPENING_PENS, type OpeningPenKey } from './openingPens';
import { defaultPlanCutPen, PLAN_CUT_PENS } from './planCutPens';

/**
 * Pennraderna i en vykategori (0.10.36), i grupper: varje rad är ett
 * ställe där en objekttyp och del får sin penna. `types` säger i vilka
 * vytyper gruppen visas (raderna gäller ändå där de ritas), och `tags` är
 * de automatiska taggarna för objekt och del.
 */
export interface PenRow {
  key: string;
  label: string;
  hint: string;
  tags: readonly string[];
}

export interface PenGroup {
  id: string;
  title: string;
  note: string;
  types: readonly ViewType[];
  /** Sällan ändrad: döljs under *Vanliga* (0.10.34). */
  rare?: boolean;
  rows: readonly PenRow[];
}

const OPENING_TAGS: Record<string, string[]> = { openingCut: ['dörr', 'fönster', 'snitt'], openingView: ['dörr', 'fönster', 'vy'], openingSymbol: ['dörr', 'fönster', 'symbol'] };
const CUT_OBJECT: Record<string, string[]> = { Wall: ['vägg'], Opening: ['dörr', 'fönster'], Slab: ['bjälklag'], Furniture: ['möbel'], Roof: ['tak'], Ground: ['stödmur'] };
const MARKER_TAGS: Record<string, string[]> = {
  sectionLine: ['markör', 'sektionsmarkör'],
  elevationLine: ['markör', 'fasadmarkör'],
  north: ['markör', 'norrpil'],
  roomLeader: ['rum', 'pil'],
  roofSlope: ['tak', 'taklutning'],
  dimension: ['mått'],
  dimensionTick: ['mått'],
  level: ['markör', 'nivåmarkör'],
  litteraLeader: ['littera', 'vägg'],
};

/** Snittets nycklar heter t.ex. `aboveWall`: läget och objekttypen. */
function cutTags(key: string): string[] {
  const m = /^(above|below)(.+)$/.exec(key);
  return m ? [...(CUT_OBJECT[m[2]] ?? []), m[1] === 'above' ? 'över snittet' : 'under snittet'] : [];
}

export const PEN_GROUPS: readonly PenGroup[] = [
  {
    id: 'openings',
    title: 'Pennor för dörrar och fönster',
    note: 'Tre klasser för dörrarnas och fönstrens delar. Gäller alla dörrar och fönster utan egen penna, på typen eller objektet. Väggens kontur ställs in under Åtgärder. Symbolen gäller också öppningssättet i fasader och sektioner.',
    types: ['storey', 'facade', 'section'],
    rows: OPENING_PENS.map((r) => ({ key: r.key, label: r.label, hint: r.hint, tags: OPENING_TAGS[r.key] })),
  },
  {
    id: 'facade',
    title: 'Linjer i fasader och sektioner',
    note: 'Det som syns bortom snittet, efter vad linjen är. Vägghålet är tjockare än karm, båge och dörrblad. Snittets kontur ställs in under Åtgärder; det tonade djupet och de dolda linjerna ritas alltid tunna.',
    types: ['facade', 'section'],
    rows: FACADE_PENS.map((r) => ({ key: r.key, label: r.label, hint: r.hint, tags: r.tags })),
  },
  {
    id: 'cut',
    title: 'Snittet i planen',
    note: 'Det som ligger helt under planens snitthöjd ritas som vy, det som ligger helt över streckprickat där det sticker ut utanför det snittade. Snitthöjden ställs in per våning (1100 från början). Ett objekt eller en typ kan få en egen penna för det som ligger över.',
    types: ['storey'],
    rare: true,
    rows: PLAN_CUT_PENS.map((r) => ({ key: r.key, label: r.label, hint: r.hint, tags: cutTags(r.key) })),
  },
  {
    id: 'room',
    title: 'Penna för rum',
    note: 'Rummens kontur i planen, för alla rum utan egen penna på typen eller rummet. Konturen ligger under väggarna och syns mot öppningar och rumsgränser.',
    types: ['storey'],
    rows: ROOM_PENS.map((r) => ({ key: r.key, label: r.label, hint: r.hint, tags: ['rum', 'kontur'] })),
  },
  {
    id: 'contours',
    title: 'Höjdkurvor',
    note: 'Den befintliga marken ur Höjdkurvor och marken som den blir med markobjekten, i planen och på bladen. Höjden på hela meter har kurvans färg. Grått följer skärmens tema; 3D-vyn har sina egna linjer.',
    types: ['site', 'storey'],
    rows: CONTOUR_PENS.map((r) => ({ key: r.key, label: r.label, hint: r.hint, tags: r.key === 'contourOld' ? ['höjdkurva', 'befintlig mark'] : ['höjdkurva'] })),
  },
  {
    id: 'markers',
    title: 'Pennor för pilar och markörer',
    note: 'I planen, fasaderna, sektionerna och på bladen. Färgen gäller också markörens text. Svart följer skärmens tema. Linjetypen gäller linjerna; pilspetsar och trianglar är heldragna.',
    types: ['site', 'storey', 'facade', 'section', 'worksheet'],
    rows: MARKER_PENS.map((r) => ({ key: r.key, label: r.label, hint: r.hint, tags: MARKER_TAGS[r.key] ?? [] })),
  },
];

/** Grupperna som visas i en vytyp. */
export const penGroupsFor = (type: ViewType): PenGroup[] => PEN_GROUPS.filter((g) => g.types.includes(type));

const ROW_OF = new Map(PEN_GROUPS.flatMap((g) => g.rows.map((r) => [r.key, { row: r, group: g }] as const)));

/** Raden och gruppen för en nyckel i penntabellen. */
export const penRowOf = (key: string) => ROW_OF.get(key);

/** Förvalet för en rad i penntabellen: snittet, höjdkurvorna, fasaderna, en markör eller dörrarnas och fönstrens klass. */
export function penDefault(key: string): PenDef {
  const d = defaultPlanCutPen(key) ?? defaultContourPen(key) ?? defaultFacadePen(key);
  if (d) return d;
  return OPENING_PENS.some((o) => o.key === key) ? defaultOpeningPen(key as OpeningPenKey) : defaultMarkerPen(key as MarkerPenKey);
}
