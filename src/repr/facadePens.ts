import type { PenDef, StyleSheet } from '../core/graphics';
import { lineTypeDash } from '../core/lineTypes';
import type { Pen } from './primitives';
import type { EdgePart } from './solids';

/**
 * Fasadernas och sektionernas konturlinjer (0.8; i stilboken sedan 0.10.36,
 * per objekt sedan 0.10.38): det som syns bortom snittet, ett ställe per
 * objekttyp och del (väggens kontur och hålets kant, dörrens och fönstrens
 * karm, båge, blad, glas …). Raderna står i samma grupper som planens
 * (`group`) men är egna ställen med egna förval, eftersom fasaden oftast
 * vill ha tjockare linjer (Carl August 30 oktober). Sektionernas snitt har
 * planens snittlinjer (`wallCut` …, `objectPens.ts`).
 */
export const FACADE_PENS = [
  { key: 'wallElev', group: 'walls', part: 'wall', label: 'Vägg: konturlinje', hint: 'Väggarnas kanter och hörn', weight: 0.25, tags: ['vägg', 'kontur', 'konturlinje'] },
  { key: 'wallHoleElev', group: 'walls', part: 'hole', label: 'Vägg: hålets kant', hint: 'Vägghålet runt dörrar och fönster, tjockare än karmen', weight: 0.35, tags: ['vägg', 'hål', 'kontur', 'konturlinje'] },
  { key: 'doorFrameElev', group: 'doors', part: 'frame', label: 'Dörr: karm (kontur)', hint: 'Karmen', weight: 0.25, tags: ['dörr', 'karm', 'kontur', 'konturlinje'] },
  { key: 'doorLeafElev', group: 'doors', part: 'leaf', label: 'Dörr: blad', hint: 'Dörrbladet och glasningen', weight: 0.25, tags: ['dörr', 'dörrblad', 'kontur'] },
  { key: 'doorLiningElev', group: 'doors', part: 'lining', label: 'Dörr: foder', hint: 'Fodret runt karmen', weight: 0.18, tags: ['dörr', 'foder', 'kontur'] },
  { key: 'doorHandleElev', group: 'doors', part: 'handle', label: 'Dörr: handtag', hint: 'Handtaget', weight: 0.18, tags: ['dörr', 'handtag', 'kontur'] },
  { key: 'doorGlassElev', group: 'doors', part: 'glass', label: 'Dörr: glas', hint: 'Glaset i dörrbladet', weight: 0.13, color: 'muted', tags: ['dörr', 'glas', 'kontur'] },
  { key: 'doorJointElev', group: 'doors', part: 'joint', label: 'Dörr: skarvar', hint: 'Karmens hörn och falsen', weight: 0.13, color: 'muted', tags: ['dörr', 'skarv', 'kontur'] },
  { key: 'doorSwingElev', group: 'doors', part: 'swing', label: 'Dörr: öppningssätt', hint: 'Symbolen för öppningssättet', weight: 0.13, linetype: 'dashed', tags: ['dörr', 'öppningssätt', 'symbol'] },
  { key: 'windowFrameElev', group: 'windows', part: 'frame', label: 'Fönster: karm (kontur)', hint: 'Karmen', weight: 0.25, tags: ['fönster', 'karm', 'kontur', 'konturlinje'] },
  { key: 'windowSashElev', group: 'windows', part: 'sash', label: 'Fönster: båge', hint: 'Bågarna', weight: 0.25, tags: ['fönster', 'båge', 'kontur'] },
  { key: 'windowGlassElev', group: 'windows', part: 'glass', label: 'Fönster: glas', hint: 'Glasets linjer', weight: 0.13, color: 'muted', tags: ['fönster', 'glas', 'kontur'] },
  { key: 'windowSillElev', group: 'windows', part: 'sill', label: 'Fönster: bleck', hint: 'Fönsterblecket', weight: 0.25, tags: ['fönster', 'bleck', 'kontur'] },
  { key: 'windowLiningElev', group: 'windows', part: 'lining', label: 'Fönster: foder', hint: 'Fodret runt karmen', weight: 0.18, tags: ['fönster', 'foder', 'kontur'] },
  { key: 'windowJointElev', group: 'windows', part: 'joint', label: 'Fönster: skarvar', hint: 'Karmens och bågarnas hörn', weight: 0.13, color: 'muted', tags: ['fönster', 'skarv', 'kontur'] },
  { key: 'windowSwingElev', group: 'windows', part: 'swing', label: 'Fönster: öppningssätt', hint: 'Symbolen för öppningssättet', weight: 0.13, linetype: 'dashed', tags: ['fönster', 'öppningssätt', 'symbol'] },
  { key: 'roofElev', group: 'others', part: 'roof', label: 'Tak: konturlinje', hint: 'Takfot, nock och gavlar', weight: 0.25, tags: ['tak', 'kontur', 'konturlinje'] },
  { key: 'slabElev', group: 'others', part: null, label: 'Bjälklag: konturlinje', hint: 'Bjälklagens kanter bortom snittet', weight: 0.18, tags: ['bjälklag', 'kontur', 'konturlinje'] },
  { key: 'otherElev', group: 'others', part: null, label: 'Övrigt: konturlinje', hint: 'Allt annat som syns: stödmurar, ramper, möbler …', weight: 0.18, tags: ['stödmur', 'möbel', 'kontur', 'konturlinje'] },
] as const satisfies readonly { key: string; group: string; part: EdgePart | null; label: string; hint: string; weight: number; color?: string; linetype?: string; tags: readonly string[] }[];

export type FacadePenKey = (typeof FACADE_PENS)[number]['key'];
type FacadeRow = (typeof FACADE_PENS)[number];

const BY_KEY = new Map<string, FacadeRow>(FACADE_PENS.map((p) => [p.key, p]));
const OPENING_ROW = new Map<string, FacadePenKey>(FACADE_PENS.filter((p) => p.group === 'doors' || p.group === 'windows').map((p) => [`${p.group}|${p.part}`, p.key]));

/**
 * Raden för en linje: delen och objekttypen. Dörrens delar har dörrens rader
 * och andra öppningars fönstrets (en del som bara den andra har tar dess
 * rad). Linjer utan del (bjälklagens och andra formers kanter) är
 * bjälklagets eller Övrigt.
 */
export function facadeRowOf(part: EdgePart | undefined, objectType: string | undefined): FacadePenKey {
  if (part === 'wall') return 'wallElev';
  if (part === 'hole') return 'wallHoleElev';
  if (part === 'roof') return 'roofElev';
  if (!part) return objectType === 'Slab' ? 'slabElev' : 'otherElev';
  const [mine, other] = objectType === 'Door' ? ['doors', 'windows'] : ['windows', 'doors'];
  return OPENING_ROW.get(`${mine}|${part}`) ?? OPENING_ROW.get(`${other}|${part}`) ?? 'otherElev';
}

/** Förvalet för en fasadlinje, eller undefined om nyckeln inte är en. */
export function defaultFacadePen(key: string): PenDef | undefined {
  const d = BY_KEY.get(key);
  if (!d) return undefined;
  return { weight: d.weight, ...('color' in d ? { color: d.color } : {}), ...('linetype' in d ? { linetype: d.linetype } : {}) };
}

/**
 * Pennan för en rad i fasaden eller sektionen: förvalet och stilbokens rad
 * ovanpå (med linjetypens streckning).
 */
export function facadePen(style: StyleSheet, key: FacadePenKey): Pen {
  const row: PenDef = { ...defaultFacadePen(key)!, ...style.pens?.[key] };
  const dash = lineTypeDash(style, row.linetype);
  return { weight: row.weight, ...(row.color ? { color: row.color as Pen['color'] } : {}), ...(dash ? { dash } : {}) };
}
