import type { PenDef } from '../core/graphics';
import type { ViewType } from '../core/viewCategories';
import { CONTOUR_PENS, defaultContourPen } from './contourPens';
import { defaultFacadePen, FACADE_PENS } from './facadePens';
import { defaultMarkerPen, MARKER_PENS, ROOM_PENS, type MarkerPenKey } from './markerPens';
import { defaultObjectPen, OBJECT_PENS } from './objectPens';
import { defaultPlanCutPen, PLAN_CUT_PENS } from './planCutPens';
import { defaultStairPen, STAIR_PENS } from './stairPens';
import { defaultRailPen, RAIL_PENS } from './railingPens';
import { defaultProfilePen, PROFILE_PENS } from './profilePens';

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
  /** Vytyperna där raden visas, om inte alla gruppens (0.10.38: planens och fasadernas rader i samma grupp). */
  types?: readonly ViewType[];
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

const PLAN: readonly ViewType[] = ['storey'];
const PLAN_AND_SECTION: readonly ViewType[] = ['storey', 'section'];
const ELEVATION: readonly ViewType[] = ['facade', 'section'];
/** Snittlinjerna gäller också sektionernas snitt (0.10.38). */
const SECTION_CUT = new Set(['wallCut', 'slabCut', 'roofCut', 'groundCut']);

/** Gruppens rader: planens (snittlinjerna också i sektionerna) och sedan fasadernas och sektionernas konturlinjer. */
const objectRows = (group: string): PenRow[] => [
  ...OBJECT_PENS.filter((r) => r.group === group).map((r) => ({ key: r.key, label: r.label, hint: r.hint, tags: r.tags, types: SECTION_CUT.has(r.key) ? PLAN_AND_SECTION : PLAN })),
  ...FACADE_PENS.filter((r) => r.group === group).map((r) => ({ key: r.key, label: r.label, hint: r.hint, tags: r.tags, types: ELEVATION })),
];
const ALL_MODEL: readonly ViewType[] = ['storey', 'facade', 'section'];

/** Snittets nycklar heter t.ex. `aboveWall`: läget och objekttypen. */
function cutTags(key: string): string[] {
  const m = /^(above|below)(.+)$/.exec(key);
  return m ? [...(CUT_OBJECT[m[2]] ?? []), m[1] === 'above' ? 'över snittet' : 'under snittet'] : [];
}

export const PEN_GROUPS: readonly PenGroup[] = [
  {
    id: 'walls',
    title: 'Väggar',
    note: 'Snittlinjen är väggens kontur där snittet går genom den, konturlinjen det oskurna (i planen vägghålets kanter under fönstren, i fasaden väggens kanter). Snittlinjen ger tjockleken; när jämförelsen är på ger åtgärden (under Åtgärder) färg och streckning. Ett objekt eller en typ kan ha en egen penna.',
    types: ALL_MODEL,
    rows: objectRows('walls'),
  },
  {
    id: 'doors',
    title: 'Dörrar',
    note: 'Gäller alla dörrar utan egen penna, på typen eller objektet. Hålets kanter i väggen följer väggens pennor. Planens och fasadens rader är var sin.',
    types: ALL_MODEL,
    rows: objectRows('doors'),
  },
  {
    id: 'windows',
    title: 'Fönster',
    note: 'Gäller alla fönster utan egen penna, på typen eller objektet. Hålets kanter i väggen följer väggens pennor. Planens och fasadens rader är var sin.',
    types: ALL_MODEL,
    rows: objectRows('windows'),
  },
  {
    id: 'objects',
    title: 'Bjälklag, tak, stödmurar, möbler och rum',
    note: 'Snittlinjerna ger tjockleken, och åtgärden färg och streckning när jämförelsen är på. I planen har det som ligger helt under eller över snittet sina pennor under Snittet i planen, och rummens kontur ligger under väggarna och har ingen linje från början. I fasader och sektioner ritas det tonade djupet och de dolda linjerna alltid tunna.',
    types: ALL_MODEL,
    rows: [...objectRows('others'), ...ROOM_PENS.map((r) => ({ key: r.key, label: 'Rum: konturlinje', hint: r.hint, tags: ['rum', 'kontur', 'konturlinje'], types: PLAN }))],
  },
  {
    id: 'seen',
    title: 'Från annan våning',
    note: 'Trappor, räcken, ramper, markytor, stödmurar och bjälklag som valts att synas också här (Syns också på, i objektets egenskaper) ritas som vy, utan snitt, fyllning och text.',
    types: ['site', 'storey'],
    rows: OBJECT_PENS.filter((r) => r.group === 'seen').map((r) => ({ key: r.key, label: r.label, hint: r.hint, tags: r.tags })),
  },
  {
    id: 'stairs',
    title: 'Trappor',
    note: 'Det under planens snitt heldraget, det ovanför streckprickat med snittlinjen snett över; i våningen ovanför ritas trappan hel. Gångriktningen går från ringen till pilen. Stegnosen ritas i Detalj. Snittlinjen gäller också trappans snitt i sektionerna.',
    types: PLAN_AND_SECTION,
    rows: STAIR_PENS.map((r) => ({ key: r.key, label: r.label, hint: r.hint, tags: r.tags, ...(r.key === 'stairCut' ? {} : { types: PLAN }) })),
  },
  {
    id: 'railings',
    title: 'Räcken',
    note: 'Räcken, ledstänger, staket och spaljéer. I planen en linje i Skiss och Normal (med ledstångens förlängning i Normal), handledaren, ledstången och stolparna i Detalj; det som står på trappsteg ovanför snittet streckprickat. I fasader och sektioner snittlinjen och konturlinjen.',
    types: ALL_MODEL,
    rows: RAIL_PENS.map((r) => ({ key: r.key, label: r.label, hint: r.hint, tags: r.tags, types: r.view === 'plan' ? PLAN : r.key === 'railCut' ? ['section'] : ELEVATION })),
  },
  {
    id: 'profiles',
    title: 'Profiler',
    note: 'Pelare, balkar, lister och gesimser (verktyget Profil). I planen snittas det som går genom planens snitt (med materialets snitt), det under snittet är en konturlinje och det över streckprickat. I fasader och sektioner snittlinjen och konturlinjen.',
    types: ALL_MODEL,
    rows: PROFILE_PENS.map((r) => ({ key: r.key, label: r.label, hint: r.hint, tags: r.tags, types: r.view === 'plan' ? PLAN : r.view === 'section' ? ['section'] : ELEVATION })),
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
export const penGroupsFor = (type: ViewType): PenGroup[] =>
  PEN_GROUPS.filter((g) => g.types.includes(type))
    .map((g) => (g.rows.some((r) => r.types) ? { ...g, rows: g.rows.filter((r) => !r.types || r.types.includes(type)) } : g))
    .filter((g) => g.rows.length);

const ROW_OF = new Map(PEN_GROUPS.flatMap((g) => g.rows.map((r) => [r.key, { row: r, group: g }] as const)));

/** Raden och gruppen för en nyckel i penntabellen. */
export const penRowOf = (key: string) => ROW_OF.get(key);

/** Förvalet för en rad i penntabellen: objekten, snittet, höjdkurvorna, fasaderna eller en markör. */
export function penDefault(key: string): PenDef {
  return defaultObjectPen(key) ?? defaultStairPen(key) ?? defaultRailPen(key) ?? defaultProfilePen(key) ?? defaultPlanCutPen(key) ?? defaultContourPen(key) ?? defaultFacadePen(key) ?? defaultMarkerPen(key as MarkerPenKey);
}

/**
 * Ändra en rad i penntabellen: `fn` får raden med förvalet ifyllt och
 * förvalet. Förvalet sparas inte, så att en senare ändring av förvalen
 * slår igenom; en tom tabell tas bort.
 */
export function putPen(style: { pens?: Record<string, PenDef> }, key: string, fn: (pen: PenDef, def: PenDef) => void): void {
  const d = penDefault(key);
  const p: PenDef = { ...d, ...style.pens?.[key] };
  fn(p, d);
  const pens = { ...style.pens };
  if (p.weight === d.weight && p.color === d.color && (p.linetype ?? undefined) === d.linetype) delete pens[key];
  else pens[key] = p;
  if (Object.keys(pens).length) style.pens = pens;
  else delete style.pens;
}
