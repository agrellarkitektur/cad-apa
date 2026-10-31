import type { Definition, Id } from './model';
import type { ProfileDim } from './profileContour';
import { railValues, type RailParam } from './railingTypes';

/**
 * Profiltyperna (0.11.6, utredningen 31 oktober 2026): ett tvärsnitt som
 * sveps längs en bana. En typ (littera PR01 …) bor i en definition
 * (`Definition.profile`, `elementType` Profile) och har
 *
 * - **delprofiler** A, B, C …: slutna konturer med var sitt material; en
 *   senare delprofil som ligger ovanpå en tidigare tar sin yta ur den (B
 *   ovanpå A ger A ett hål där);
 * - **ankare**: numrerade insättningspunkter med namn, ett av nio lägen i
 *   tvärsnittets omslutande rektangel eller en egen punkt; ett är förval;
 * - **sträckzoner**: band i tvärsnittet (Höjd lodrätt, Bredd vågrätt) där
 *   punkterna följer med när måttet ändras; över och under behåller formen;
 * - **parametrar** som räckestypernas (värde eller formel, *per objekt*).
 *
 * Tvärsnittets x går bort från väggen (till höger om banan), y uppåt, mm.
 */

/** En punkt i tvärsnittet, mm. */
export type PPoint = [number, number];

/** En sluten kontur med bågar (pilhöjd per kant, som linjerna; kant i går från punkt i till nästa, den sista tillbaka till den första). */
export interface ProfileContour {
  pts: PPoint[];
  bulges?: number[];
}

export interface SubProfile {
  id: string;
  /** Bokstaven: A, B, C … */
  letter: string;
  name: string;
  contour: ProfileContour;
  /** Stilbokens material; utelämnat = typens grupp (trä, betong …) eller inget. */
  material?: string;
  /** Materialet får bytas per objekt; utelämnad = ja. */
  perObject?: boolean;
  /** Läget mot de andra delprofilerna i editorn: kant i kant, ovanpå eller fritt. */
  place?: 'edge' | 'over' | 'free';
  /** Följer avslutet (förval) eller kapas vinkelrätt. */
  followsEnd?: boolean;
  /** Förlängning utöver referenslinjens ände (mm), t.ex. en avtäckning som sticker ut. */
  extend?: number;
  /** Lägsta detaljnivå delprofilen syns i planen; utelämnad = alla. */
  detail?: 'sketch' | 'normal' | 'detail';
}

/** Ett av nio lägen i tvärsnittets omslutande rektangel. */
export type AnchorPos = 'tl' | 't' | 'tr' | 'l' | 'c' | 'r' | 'bl' | 'b' | 'br';

export const ANCHOR_POS_LABELS: Record<AnchorPos, string> = {
  tl: 'Övre bakkant',
  t: 'Överkant mitt',
  tr: 'Övre framkant',
  l: 'Bakkant mitt',
  c: 'Mitten',
  r: 'Framkant mitt',
  bl: 'Nedre bakkant',
  b: 'Underkant mitt',
  br: 'Nedre framkant',
};

export interface ProfileAnchor {
  no: number;
  name: string;
  /** Ett av de nio lägena, eller en egen punkt (`at`). */
  pos?: AnchorPos;
  at?: PPoint;
}

/** En sträckzon: ett band i tvärsnittet. Höjd: y mellan `from` och `to`; Bredd: x. */
export interface StretchZone {
  axis: 'height' | 'width';
  from: number;
  to: number;
}

/** Vad typen får användas som (utredningen, tavla 1). */
export type ProfileUse = 'free' | 'railing' | 'stringer' | 'lining' | 'skirting';

export const PROFILE_USE_LABELS: Record<ProfileUse, string> = {
  free: 'Fritt profilobjekt',
  railing: 'Del i räcke',
  stringer: 'Vangstycke',
  lining: 'Foder, tröskel, bleck',
  skirting: 'Sockel, taklist',
};

/** Avslutets sort i en ände: lodrät, vågrät, vinkelrät mot banan eller lodrät i en vinkel i planen. */
export type EndKind = 'plumb' | 'level' | 'square' | 'angle';

export const END_KIND_LABELS: Record<EndKind, string> = { plumb: 'Lodrät', level: 'Vågrät', square: 'Vinkelrät', angle: 'Vinkel…' };

export interface ProfileTypeModel {
  group: string;
  /** Visas på Platsen och på våningarna, som materialen. */
  ground?: boolean;
  building?: boolean;
  /** Utelämnad = bara fritt profilobjekt. */
  uses?: ProfileUse[];
  parts: SubProfile[];
  anchors: ProfileAnchor[];
  /** Förvalt ankare (dess nummer). */
  anchor: number;
  zones: StretchZone[];
  /** Höjd och Bredd (när en sträckzon finns) och egna parametrar. */
  params: RailParam[];
  /** "Uppåt" i tvärsnittet: lodrätt (förval) eller vinkelrätt mot banan. */
  up?: 'plumb' | 'normal';
  /** Avslutet nya objekt får i ändarna; utelämnat = efter gruppen. */
  ends?: EndKind;
  /** Måtten i editorns rityta (0.11.6.1); ett mått kan peka på en parameter. */
  dims?: ProfileDim[];
}

export const PROFILE_GROUPS = ['Pelare och balkar', 'Lister och gesimser', 'Takdetaljer', 'Räckesdelar', 'Dörr- och fönsterdelar', 'Ytskiktslister', 'Ändprofiler'] as const;

/** Profiltypen i en definition, eller undefined. */
export const profileModel = (def: Definition | undefined): ProfileTypeModel | undefined => (def?.elementType === 'Profile' ? def.profile : undefined);

/** Avslutet i ändarna när objektet inte valt: typens, annars lodrätt för pelare och balkar, vinkelrätt för resten. */
export const defaultEnd = (m: ProfileTypeModel): EndKind => m.ends ?? (m.group === 'Pelare och balkar' ? 'plumb' : 'square');

/** Parametrarnas namn för sträckzonerna. */
export const ZONE_PARAM = { height: 'Höjd', width: 'Bredd' } as const;

/** Typens parametrar som tal, med objektets egna värden (samma räknare som räckestyperna). */
export function profileValues(model: ProfileTypeModel, own?: Record<string, number>): Map<string, number> {
  return railValues({ params: model.params } as never, own);
}

// ---------- Tvärsnittet ----------

/** Bågarnas bitar i tvärsnittet: högst 12° per bit. */
function arcPoints(a: PPoint, b: PPoint, bulge: number): PPoint[] {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (Math.abs(bulge) < 0.05 || L < 1e-6) return [a];
  const u: PPoint = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const n: PPoint = [-u[1], u[0]];
  const h = L / 2;
  const R = (h * h + bulge * bulge) / (2 * Math.abs(bulge));
  const sigma = bulge > 0 ? 1 : -1;
  const k = bulge - sigma * R;
  const c: PPoint = [(a[0] + b[0]) / 2 + n[0] * k, (a[1] + b[1]) / 2 + n[1] * k];
  const t0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
  const sweep = 4 * Math.atan(Math.abs(bulge) / h);
  // Ett jämnt antal bitar, så att en halvcirkel får sin topp.
  const m = 2 * Math.max(1, Math.ceil(sweep / ((24 * Math.PI) / 180)));
  const out: PPoint[] = [];
  for (let i = 0; i < m; i++) {
    const t = t0 - (sigma * sweep * i) / m;
    out.push([c[0] + R * Math.cos(t), c[1] + R * Math.sin(t)]);
  }
  return out;
}

/** Konturen med bågarna som korta raka bitar, moturs. */
export function flatContour(c: ProfileContour): PPoint[] {
  const n = c.pts.length;
  const out: PPoint[] = [];
  for (let i = 0; i < n; i++) out.push(...arcPoints(c.pts[i], c.pts[(i + 1) % n], Number(c.bulges?.[i]) || 0));
  return ringArea(out) < 0 ? out.reverse() : out;
}

/** Ringens area med tecken (moturs positiv). */
export function ringArea(r: readonly PPoint[]): number {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i];
    const q = r[(i + 1) % r.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export interface Box2 {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Den omslutande rektangeln för punkterna. */
export function boxOfPoints(pts: readonly PPoint[]): Box2 {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of pts) {
    b.minX = Math.min(b.minX, p[0]);
    b.minY = Math.min(b.minY, p[1]);
    b.maxX = Math.max(b.maxX, p[0]);
    b.maxY = Math.max(b.maxY, p[1]);
  }
  return Number.isFinite(b.minX) ? b : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
}

/** Typens omslutande rektangel, ritad (utan sträckning). */
export function profileBox(model: ProfileTypeModel): Box2 {
  return boxOfPoints(model.parts.flatMap((p) => flatContour(p.contour)));
}

/** En koordinat sträckt: i bandet proportionellt, över det hela tillskottet. */
function stretch(v: number, z: StretchZone, delta: number): number {
  const w = z.to - z.from;
  if (!delta || w <= 0) return v;
  if (v >= z.to) return v + delta;
  if (v > z.from) return v + ((v - z.from) / w) * delta;
  return v;
}

/** Hur mycket varje zon sträcks: parametern (Höjd, Bredd) mot det ritade måttet. Utan zon är måttet låst. */
export function zoneDeltas(model: ProfileTypeModel, vals: ReadonlyMap<string, number>): { zone: StretchZone; delta: number }[] {
  const box = profileBox(model);
  const out: { zone: StretchZone; delta: number }[] = [];
  for (const axis of ['height', 'width'] as const) {
    const zones = model.zones.filter((z) => z.axis === axis && z.to > z.from);
    const want = vals.get(ZONE_PARAM[axis]);
    if (!zones.length || want === undefined) continue;
    const drawn = axis === 'height' ? box.maxY - box.minY : box.maxX - box.minX;
    // Tillskottet delas lika på zonerna, men ingen zon krymper under noll.
    let delta = (Math.max(1, want) - drawn) / zones.length;
    for (const z of zones) delta = Math.max(delta, -(z.to - z.from) + 1);
    // Zonerna läggs på uppifrån, så att en lägre zon inte flyttar en högre zons gränser.
    for (const z of [...zones].sort((a, b) => b.from - a.from)) out.push({ zone: z, delta });
  }
  return out;
}

/** En punkt i tvärsnittet efter sträckzonerna. */
export function stretchPoint(p: PPoint, deltas: readonly { zone: StretchZone; delta: number }[]): PPoint {
  let [x, y] = p;
  for (const { zone, delta } of deltas) {
    if (zone.axis === 'height') y = stretch(y, zone, delta);
    else x = stretch(x, zone, delta);
  }
  return [x, y];
}

/** Ett ankares punkt i den sträckta rektangeln (eller den egna punkten, sträckt). */
export function anchorPoint(a: ProfileAnchor | undefined, box: Box2, deltas: readonly { zone: StretchZone; delta: number }[]): PPoint {
  if (a?.at) return stretchPoint(a.at, deltas);
  const pos = a?.pos ?? 'bl';
  const x = pos.endsWith('l') ? box.minX : pos.endsWith('r') ? box.maxX : (box.minX + box.maxX) / 2;
  const y = pos.startsWith('t') ? box.maxY : pos.startsWith('b') ? box.minY : (box.minY + box.maxY) / 2;
  return [x, y];
}

/** Tvärsnittet färdigt att svepa: delprofilernas ringar (sträckta) och rektangeln. */
export interface ProfileSection {
  parts: { part: SubProfile; ring: PPoint[] }[];
  box: Box2;
  deltas: { zone: StretchZone; delta: number }[];
}

/** Tvärsnittet med typens värden: konturerna platta och sträckta. */
export function profileSection(model: ProfileTypeModel, vals: ReadonlyMap<string, number>): ProfileSection {
  const deltas = zoneDeltas(model, vals);
  const parts = model.parts
    .map((part) => ({ part, ring: flatContour(part.contour).map((q) => stretchPoint(q, deltas)) }))
    .filter((p) => p.ring.length >= 3 && Math.abs(ringArea(p.ring)) > 1e-3);
  return { parts, box: boxOfPoints(parts.flatMap((p) => p.ring)), deltas };
}

// ---------- Typerna i ett nytt projekt ----------

const rect = (x0: number, y0: number, x1: number, y1: number): ProfileContour => ({ pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] });

/** En cirkel med diametern d kring (cx, cy): två halvbågar. */
export const circleContour = (cx: number, cy: number, d: number): ProfileContour => ({ pts: [[cx - d / 2, cy], [cx + d / 2, cy]], bulges: [d / 2, d / 2] });

const sizeParams = (h: number | null, w: number | null): RailParam[] => [...(h !== null ? [{ name: 'Höjd', value: h, perRailing: true }] : []), ...(w !== null ? [{ name: 'Bredd', value: w, perRailing: true }] : [])];

/**
 * De förvalda profiltyperna (fasta id, så att ett projekt får dem en gång):
 * en fyrkantig och en rund pelare, en balk, en gesims i två delar och en
 * sockellist.
 */
export function defaultProfileTypes(): Definition[] {
  const def = (id: Id, name: string, description: string, profile: ProfileTypeModel): Definition => ({ id, origin: 'component', name, description, elementType: 'Profile', params: {}, props: {}, profile });
  const part = (letter: string, name: string, contour: ProfileContour, material?: string): SubProfile => ({ id: letter.toLowerCase(), letter, name, contour, ...(material ? { material } : {}) });
  return [
    def('t-pr01', 'PR01', 'Fyrkantspelare 140 × 140', {
      group: 'Pelare och balkar',
      building: true,
      parts: [part('A', 'Pelare', rect(0, 0, 140, 140), 'trall')],
      anchors: [
        { no: 1, name: 'Mitten', pos: 'c' },
        { no: 2, name: 'Hörn', pos: 'bl' },
      ],
      anchor: 1,
      zones: [
        { axis: 'height', from: 0, to: 140 },
        { axis: 'width', from: 0, to: 140 },
      ],
      params: sizeParams(140, 140),
    }),
    def('t-pr02', 'PR02', 'Rund pelare Ø 150', {
      group: 'Pelare och balkar',
      building: true,
      ground: true,
      parts: [part('A', 'Pelare', circleContour(75, 75, 150), 'betong')],
      anchors: [{ no: 1, name: 'Mitten', pos: 'c' }],
      anchor: 1,
      zones: [],
      params: [],
    }),
    def('t-pr03', 'PR03', 'Balk 90 × 270', {
      group: 'Pelare och balkar',
      building: true,
      parts: [part('A', 'Balk', rect(0, 0, 90, 270), 'trall')],
      anchors: [
        { no: 1, name: 'Överkant mitt', pos: 't' },
        { no: 2, name: 'Mitten', pos: 'c' },
        { no: 3, name: 'Underkant mitt', pos: 'b' },
      ],
      anchor: 1,
      zones: [
        { axis: 'height', from: 0, to: 270 },
        { axis: 'width', from: 0, to: 90 },
      ],
      params: sizeParams(270, 90),
    }),
    def('t-pr04', 'PR04', 'Gesims med plåtavtäckning', {
      group: 'Lister och gesimser',
      building: true,
      parts: [
        part('A', 'Gesims', { pts: [[0, 0], [60, 0], [60, 60], [120, 60], [120, 140], [160, 140], [160, 180], [0, 180]] }),
        { ...part('B', 'Avtäckning', { pts: [[0, 180], [160, 180], [175, 160], [180, 165], [165, 190], [0, 190]] }, 'plat'), place: 'edge', extend: 0 },
      ],
      anchors: [
        { no: 1, name: 'Nedre bakkant', pos: 'bl' },
        { no: 2, name: 'Övre bakkant', pos: 'tl' },
      ],
      anchor: 1,
      zones: [{ axis: 'height', from: 0, to: 60 }],
      params: sizeParams(190, null),
    }),
    def('t-pr05', 'PR05', 'Sockellist 12 × 70', {
      group: 'Ytskiktslister',
      building: true,
      uses: ['free', 'skirting'],
      parts: [part('A', 'Sockel', { pts: [[0, 0], [12, 0], [12, 62], [8, 70], [0, 70]] }, 'trall')],
      anchors: [{ no: 1, name: 'Nedre bakkant', pos: 'bl' }],
      anchor: 1,
      zones: [{ axis: 'height', from: 0, to: 60 }],
      params: sizeParams(70, null),
    }),
  ];
}

/** Ett nytt id för en delprofil och nästa lediga bokstav. */
export function nextPartLetter(model: ProfileTypeModel): string {
  const used = new Set(model.parts.map((p) => p.letter));
  for (let i = 0; i < 26; i++) {
    const l = String.fromCharCode(65 + i);
    if (!used.has(l)) return l;
  }
  return `A${model.parts.length + 1}`;
}

/** En ny typ i gruppen: en rektangel A, ankaret i nedre bakkanten (pelare: mitten) och sträckzonerna Höjd och Bredd. */
export function newProfileModel(group: string): ProfileTypeModel {
  const column = group === 'Pelare och balkar';
  const [w, h] = column ? [140, 140] : group === 'Ytskiktslister' ? [12, 70] : [45, 95];
  return {
    group,
    building: true,
    parts: [{ id: 'a', letter: 'A', name: 'Del A', contour: rect(0, 0, w, h) }],
    anchors: [{ no: 1, name: column ? 'Mitten' : 'Nedre bakkant', pos: column ? 'c' : 'bl' }],
    anchor: 1,
    zones: [
      { axis: 'height', from: 0, to: h },
      { axis: 'width', from: 0, to: w },
    ],
    params: sizeParams(h, w),
  };
}

/** Littera för ett profilobjekt efter typens grupp och banan: P pelare, B balk, L list, TD takdetalj (T är trädens). */
export function profileObjectPrefix(group: string, plumb: boolean): string {
  if (group === 'Pelare och balkar') return plumb ? 'P' : 'B';
  if (group === 'Takdetaljer') return 'TD';
  return 'L';
}
