import { SB11_LINETYPES, SB11_TEMPLATE } from './dxfLayerData';

/**
 * Lagerkartorna för DXF (0.12.1): varifrån ett streck kommer (objektets
 * sort, delen, läget i vyn och åtgärden) blir ett lagernamn, och lagret får
 * färg, linjetyp och tjocklek. Lagret härleds ur objektet; ingen väljer
 * lager för hand.
 *
 * - **SB11 förenklad** (förval): BSAB 96-koder enligt SB-rekommendationer
 *   11, ett 40-tal lager, t.ex. `A-27C---E-N` för en bärande yttervägg.
 * - **SB11 fullständig**: dessutom vy-lagren (skuren, bortom, hitom), litteran
 *   per byggdel, finare koder för trappor, räcken och markörer.
 * - **Enkel**: svenska namn (`A-VÄGG`, `A-DÖRR` …).
 * - **Egen lista**: lagren ur en DXF (*Läs lagerlista ur DXF…*); namnen följer
 *   SB11 fullständig och hamnar på det närmaste lagret i listan.
 *
 * Färgerna och tjocklekarna ur kontorets mall (`dxfLayerData.ts`); lager som
 * inte står i mallen får färgen efter presentationskoden (EI grön 0,35 …).
 * Statusen står sist: N nytt, E befintligt, R rivs, - utan jämförelse.
 */

export type LayerMapId = 'sb11' | 'sb11full' | 'simple' | 'custom';
export const LAYER_MAPS: readonly LayerMapId[] = ['sb11', 'sb11full', 'simple', 'custom'];
export const LAYER_MAP_LABEL: Record<LayerMapId, string> = { sb11: 'SB11 förenklad', sb11full: 'SB11 fullständig', simple: 'Enkel (A-VÄGG …)', custom: 'Egen lista' };

/** Ett lager: namn, färg (ACI), linjetyp (tom = heldragen), tjocklek i hundradels mm (−3 = standard). */
export interface LayerDef {
  name: string;
  color: number;
  linetype?: string;
  lineweight: number;
  plot?: boolean;
  desc?: string;
}

export interface LinetypeDef {
  name: string;
  desc?: string;
  pattern: number[];
}

/** En inläst lagerlista (*Läs lagerlista ur DXF…*). */
export interface CustomLayerList {
  /** Filens namn, som listan visas med. */
  name: string;
  layers: LayerDef[];
  linetypes?: LinetypeDef[];
}

/** Stilboken › Allmänt › Export › DXF. Utelämnat = förvalet. */
export interface DxfSettings {
  map?: LayerMapId;
  custom?: CustomLayerList;
  /** Skriv alla lager i listan, också de tomma. */
  allLayers?: boolean;
}

export type Status = 'N' | 'E' | 'R' | '-';

/** Det lagret beror på, för en primitiv. */
export interface LayerQuery {
  /** Objektets sort; utelämnad för det som inte hör till ett objekt (marklinjen i en sektion …). */
  type?: string;
  part?: string;
  /** Primitiven ligger på bladet, inte i en vy (ram, ritningshuvud, text på bladet). */
  sheet?: boolean;
  /** En snittyta, eller dess kontur. */
  cut?: boolean;
  /** Streckad eller punktstreckad linje. */
  dashed?: boolean;
  /** En yta (fyllning). */
  region?: boolean;
  /** Väggen (eller öppningens vägg) är en yttervägg. */
  exterior?: boolean;
  /** Väggen är bärande. */
  loadBearing?: boolean;
  /** Möbeln är fast inredning. */
  fixed?: boolean;
  /** Profilens littera: P, B, L eller TD. */
  profile?: string;
  /** Objektet står på Platsen. */
  site?: boolean;
  status: Status;
}

// ---------------------------------------------------------------------------
// Pennorna

/** Pennan (tjockleken) som ACI-färg, enligt svensk praxis där färgen styr plotten. */
export const PEN_COLORS: readonly [weight: number, aci: number, name: string][] = [
  [0.13, 9, 'Grå'],
  [0.18, 4, 'Cyan'],
  [0.25, 1, 'Röd'],
  [0.35, 3, 'Grön'],
  [0.5, 7, 'Svart'],
  [0.7, 6, 'Magenta'],
  [1, 5, 'Blå'],
  [1.4, 2, 'Gul'],
];

/** ACI-färgen för en penna: den närmaste tjockleken i tabellen. */
export function penColor(weight: number): number {
  return PEN_COLORS.reduce((best, p) => (Math.abs(p[0] - weight) < Math.abs(best[0] - weight) ? p : best))[1];
}

// ---------------------------------------------------------------------------
// Mallen

const TEMPLATE: LayerDef[] = SB11_TEMPLATE.trim()
  .split('\n')
  .map((line) => {
    const [name, color, linetype, lw, plot] = line.split('|');
    return { name, color: Number(color), ...(linetype ? { linetype } : {}), lineweight: Number(lw), ...(plot === '0' ? { plot: false } : {}) };
  });
const TEMPLATE_BY_NAME = new Map(TEMPLATE.map((l) => [l.name, l]));

export const TEMPLATE_LINETYPES: readonly LinetypeDef[] = SB11_LINETYPES.map((t) => ({ ...t, pattern: [...t.pattern] }));

/** Byggdelskoderna som används, med benämning (BSAB 96). */
const BYGGDEL: Record<string, string> = {
  '------': 'Ingen kod',
  '15----': 'Grundkonstruktioner',
  '27B---': 'Stominnerväggar',
  '27C---': 'Stomytterväggar',
  '27D---': 'Pelarstommar',
  '27E---': 'Balkstommar',
  '27F---': 'Stombjälklag',
  '27G---': 'Yttertak- och ytterbjälklagsstommar',
  '3-----': 'Mark',
  '41----': 'Yttertak',
  '42A---': 'Ytterväggar, ej bärande',
  '42D--B': 'Fönster och fönsterdörrar i yttervägg',
  '42D--C': 'Dörrar i yttervägg',
  '42D--M': 'Hål i ytterväggar',
  '42E---': 'Ytterväggskompletteringar',
  '43CB--': 'Innerväggar',
  '43CC-B': 'Fönster och fönsterdörrar i innerväggar',
  '43CC-C': 'Dörrar i innerväggar',
  '45C---': 'Trappor och invändiga räcken',
  '45CA--': 'Invändiga trappor',
  '45CB--': 'Invändiga räcken',
  '46B--B': 'Fast inredning',
  '46B--C': 'Lös inredning',
  'U-----': 'Utrymme',
};

const PRESENTATION: Record<string, string> = {
  'E-': 'Beskrivande grafik',
  EI: 'Snitt (skuren)',
  EJ: 'Bortom, synlig',
  EK: 'Bortom, dold',
  EL: 'Hitom, dold',
  EM: 'Hitom, synlig',
  'T-': 'Text',
  T1: 'Namn, beteckning',
  T2: 'Littera',
  'D-': 'Måttsättning, allmänt',
  D3: 'Plushöjder, koordinater',
  'H-': 'Skraffering, allmänt',
  'J-': 'Markörer',
  J1: 'Sektions- och snittlinjer',
  J4: 'Fasadmarkörer',
  O2: 'Norrpil',
  O4: 'Skalsticka',
  'F-': 'Ritblanketten',
  V1: 'Referenser och underlag',
  'I-': 'Förtecknande information',
  Y6: 'Nivåkurvor',
  '--': 'Plan',
};

const STATUS_TEXT: Record<string, string> = { N: 'Nytt', E: 'Befintlig', R: 'Rives', '-': 'Status -' };

/** Färg, linjetyp och tjocklek efter presentationskoden, för lager som inte står i mallen. */
const BY_PRESENTATION: Record<string, Omit<LayerDef, 'name'>> = {
  EI: { color: 3, lineweight: 35 },
  EJ: { color: 1, lineweight: 25 },
  EK: { color: 1, linetype: 'DASHED_1', lineweight: 25 },
  EL: { color: 1, linetype: 'DASHDOUBLEDOT_SVE', lineweight: 25 },
  EM: { color: 1, linetype: 'DASHDOT1', lineweight: 25 },
  T: { color: 3, lineweight: 35 },
  D: { color: 1, lineweight: 25 },
  J: { color: 3, lineweight: 35 },
  H: { color: 1, lineweight: 25 },
  F: { color: 7, lineweight: -3 },
  O: { color: 4, lineweight: 18 },
  V: { color: 1, lineweight: 25 },
  I: { color: 1, lineweight: 25 },
  Y: { color: 1, lineweight: 25 },
};
const DEMOLISHED: Omit<LayerDef, 'name'> = { color: 1, linetype: 'DASHED_2', lineweight: 25 };

// ---------------------------------------------------------------------------
// SB11

/** Byggdelarna som får vy-lager (skuren, bortom, hitom) i SB11 fullständig. */
const VIEW_LAYERED = ['15', '27', '42A', '42E', '43CB', '45C', '46B'];

/** Byggdelskoden för ett objekt. */
function byggdel(q: LayerQuery, full: boolean): string {
  switch (q.type) {
    case 'Wall':
    case 'BasisFacade':
      return q.exterior ? (q.loadBearing ? '27C---' : '42A---') : q.loadBearing ? '27B---' : '43CB--';
    case 'Door':
      return q.exterior ? '42D--C' : '43CC-C';
    case 'Window':
      return q.exterior ? '42D--B' : '43CC-B';
    case 'WallHole':
      return full && q.exterior ? '42D--M' : q.exterior ? (q.loadBearing ? '27C---' : '42A---') : q.loadBearing ? '27B---' : '43CB--';
    case 'Slab':
      return '27F---';
    case 'Roof':
    case 'RoofSlope':
      return '41----';
    case 'Stair':
      return q.site ? '3-----' : full ? '45CA--' : '45C---';
    case 'Railing':
      return q.site ? '3-----' : full ? '45CB--' : '45C---';
    case 'Profile':
      return q.profile === 'P' ? '27D---' : q.profile === 'B' ? '27E---' : q.profile === 'TD' ? '41----' : '42E---';
    case 'Furniture':
      return q.fixed ? '46B--B' : '46B--C';
    case 'Space':
      return 'U-----';
    case 'Ground':
    case 'Terrain':
    case 'Tree':
    case 'SiteBuilding':
    case 'SiteMap':
    case 'House':
      return '3-----';
  }
  if (!q.type && (q.part === 'mark' || q.part === 'befintlig mark' || q.part === 'jord' || q.part === 'slänt' || q.part === 'släntkontur' || q.part === 'brant slänt' || q.part === 'höjdkurva')) return '3-----';
  return '------';
}

const LEVEL_PARTS = new Set(['nivå', 'höjdmått', 'markhöjd', 'höjdpunkt', 'höjd']);
const LITTERA_PARTS = new Set(['littera', 'label']);

/** Presentationskoden (två tecken) och om lagret är allmänt (utan byggdel och status). */
function presentation(q: LayerQuery, code: string, full: boolean): string {
  if (q.sheet || q.type === 'Stamp' || q.type === 'Sheet' || q.part === 'arbetsmaterial' || q.part === 'papper') return 'F-';
  if (q.type === 'Label' || LITTERA_PARTS.has(q.part ?? '')) return 'T2';
  if (q.type === 'Space' && q.part === 'rumstext') return 'T1';
  if (q.type === 'Text') return 'T-';
  if (q.type === 'ViewTitle' || q.part === 'vyrubrik') return 'T1';
  if (q.type === 'Legend' || q.type === 'Schedule') return 'I-';
  if (q.type === 'Dimension' || q.part === 'auto') return 'D-';
  if (LEVEL_PARTS.has(q.part ?? '')) return 'D3';
  if (q.type === 'Section') return full ? 'J1' : 'J-';
  if (q.type === 'Elevation') return full ? 'J4' : 'J-';
  if (q.type === 'North') return 'O2';
  if (q.type === 'ScaleBar') return 'O4';
  if (q.type === 'Underlay' || q.part === 'underlag') return 'V1';
  if (q.type === 'Shape2D' && q.region) return 'H-';
  if (full && q.part === 'höjdkurva') return 'Y6';
  if (full && VIEW_LAYERED.some((p) => code.startsWith(p))) {
    if (q.cut || q.part === 'snitt') return 'EI';
    if (q.part === 'över') return 'EM';
    if (q.part === 'dold' || q.dashed) return 'EK';
    return 'EJ';
  }
  return 'E-';
}

/** Lagernamnet efter SB11 (förenklad eller fullständig). */
export function sb11Name(q: LayerQuery, full: boolean): string {
  let code = q.sheet ? '------' : byggdel(q, full);
  const pres = presentation(q, code, full);
  // Allmänna lager (text, mått, markörer, ram …) har ingen byggdel; littera har det bara i fullständig.
  const general = pres[0] !== 'E' && pres !== 'H-' && !(full && pres === 'T2') && !(pres === 'T1' && code === 'U-----');
  if (general && !(pres === 'Y6')) code = '------';
  const status = code === '------' ? '-' : q.status;
  return `A-${code}${pres}${status}`;
}

/** Lagernamnet efter *Enkel*. */
export function simpleName(q: LayerQuery): string {
  if (q.sheet || q.type === 'Stamp' || q.type === 'Sheet' || q.part === 'arbetsmaterial') return 'A-RAM';
  if (q.type === 'Label' || LITTERA_PARTS.has(q.part ?? '')) return 'A-LITTERA';
  if (q.type === 'Text' || q.type === 'ViewTitle' || q.type === 'Legend' || q.type === 'Schedule' || q.part === 'vyrubrik') return 'A-TEXT';
  if (q.type === 'Dimension' || q.part === 'auto' || LEVEL_PARTS.has(q.part ?? '')) return 'A-MÅTT';
  if (q.type === 'Section' || q.type === 'Elevation' || q.type === 'North' || q.type === 'ScaleBar') return 'A-MARKÖR';
  if (q.type === 'Underlay' || q.part === 'underlag') return 'A-UNDERLAG';
  const base: Record<string, string> = {
    Wall: 'A-VÄGG',
    BasisFacade: 'A-VÄGG',
    Door: 'A-DÖRR',
    Window: 'A-FÖNSTER',
    WallHole: 'A-VÄGGHÅL',
    Slab: 'A-BJÄLKLAG',
    Roof: 'A-TAK',
    RoofSlope: 'A-TAK',
    Stair: 'A-TRAPPA',
    Railing: 'A-RÄCKE',
    Profile: 'A-PROFIL',
    Furniture: 'A-MÖBEL',
    Space: 'A-RUM',
  };
  const name = base[q.type ?? ''] ?? (byggdel(q, false) === '3-----' ? 'A-MARK' : 'A-2D');
  const suffix = name === 'A-MARK' || name === 'A-2D' ? '' : { N: '-NY', E: '-BEF', R: '-RIV', '-': '' }[q.status];
  return name + suffix;
}

/** Om en lagerlista följer SB11 (11 tecken, `A-` först), så att namnen kan läggas på närmaste lager. */
export function isSb11List(layers: readonly LayerDef[]): boolean {
  const named = layers.filter((l) => l.name !== '0' && l.name.toLowerCase() !== 'defpoints');
  return named.length > 0 && named.filter((l) => /^[A-Z]-.{9}$/.test(l.name)).length >= named.length / 2;
}

/**
 * Lagret i en egen lista för ett SB11-namn: namnet om det finns, annars
 * samma lager med en annan status, med *Beskrivande grafik*, eller det
 * första lagret med samma byggdel. Null om inget passar.
 */
export function nearestLayer(name: string, layers: ReadonlyMap<string, LayerDef>): string | null {
  if (layers.has(name)) return name;
  const stem = name.slice(0, 10);
  const status = name[10];
  for (const s of [status, 'N', '-', 'E']) if (layers.has(stem + s)) return stem + s;
  const element = `${name.slice(0, 8)}E-`;
  for (const s of [status, 'N', '-', 'E']) if (layers.has(element + s)) return element + s;
  for (const n of [8, 6, 5, 4]) {
    const hit = [...layers.keys()].find((k) => k.length === 11 && k.startsWith(name.slice(0, n)));
    if (hit) return hit;
  }
  return null;
}

/** Benämningen av ett SB11-lager ur koderna, som i kontorets mall. */
export function sb11Description(name: string): string | undefined {
  if (!/^A-.{9}$/.test(name)) return undefined;
  const code = name.slice(2, 8);
  const pres = name.slice(8, 10);
  const parts = ['Arkitekt', BYGGDEL[code] ?? `Element ${code}`, PRESENTATION[pres] ?? `Presentation ${pres}`, STATUS_TEXT[name[10]] ?? `Status ${name[10]}`];
  return parts.join(', ');
}

/** Lagrets färg, linjetyp och tjocklek: ur listan, ur mallen eller efter koderna. */
export function layerDef(name: string, own?: ReadonlyMap<string, LayerDef>): LayerDef {
  const hit = own?.get(name) ?? TEMPLATE_BY_NAME.get(name);
  if (hit) return { ...hit, desc: hit.desc ?? sb11Description(name) };
  const desc = sb11Description(name);
  if (/^A-.{9}$/.test(name)) {
    const status = name[10];
    if (status === 'R') return { name, ...DEMOLISHED, desc };
    for (const s of ['N', '-', 'E']) {
      const t = TEMPLATE_BY_NAME.get(name.slice(0, 10) + s);
      if (t) return { ...t, name, desc };
    }
    const pres = name.slice(8, 10);
    const rule = BY_PRESENTATION[pres] ?? BY_PRESENTATION[pres[0]];
    if (rule && pres !== 'E-') return { name, ...rule, desc };
    // Samma byggdel med beskrivande grafik i mallen (t.ex. A-27C---E-N, vit 0,50).
    const same = TEMPLATE.find((t) => t.name.startsWith(name.slice(0, 8)) && t.name.slice(8, 10) === 'E-' && t.name[10] !== 'R');
    if (same) return { ...same, name, desc };
    return { name, color: 1, lineweight: 25, desc };
  }
  return { name, color: 7, lineweight: -3 };
}

/** Lagerkartan att exportera med: förvalet, eller förenklad när den egna listan saknas. */
export function activeMap(s: DxfSettings | undefined): LayerMapId {
  const m = s?.map ?? 'sb11';
  return m === 'custom' && !s?.custom?.layers.length ? 'sb11' : m;
}

/** Lagren i den valda listan, för *Alla lager i listan*. */
export function listLayers(s: DxfSettings | undefined): LayerDef[] {
  const m = activeMap(s);
  if (m === 'custom') return s!.custom!.layers;
  if (m === 'sb11full') return TEMPLATE.filter((l) => l.name !== 'Viewports').map((l) => ({ ...l, desc: sb11Description(l.name) }));
  return [];
}

// ---------------------------------------------------------------------------
// Inställningarna i stilboken

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function normalizeLayer(v: any): LayerDef | null {
  if (!v || typeof v.name !== 'string' || !v.name.trim()) return null;
  const color = isNum(v.color) ? Math.max(1, Math.min(255, Math.round(Math.abs(v.color)))) : 7;
  const lineweight = isNum(v.lineweight) ? Math.round(v.lineweight) : -3;
  return {
    name: v.name.trim().slice(0, 255),
    color,
    ...(typeof v.linetype === 'string' && v.linetype && v.linetype.toLowerCase() !== 'continuous' ? { linetype: v.linetype } : {}),
    lineweight,
    ...(v.plot === false ? { plot: false } : {}),
    ...(typeof v.desc === 'string' && v.desc.trim() ? { desc: v.desc.trim() } : {}),
  };
}

export function normalizeDxfSettings(v: unknown): DxfSettings | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, any>;
  const out: DxfSettings = {};
  if (LAYER_MAPS.includes(o.map) && o.map !== 'sb11') out.map = o.map;
  if (o.custom && typeof o.custom === 'object' && Array.isArray(o.custom.layers)) {
    const layers = o.custom.layers.map(normalizeLayer).filter((l: LayerDef | null): l is LayerDef => !!l);
    const linetypes = Array.isArray(o.custom.linetypes)
      ? o.custom.linetypes
          .filter((t: any) => t && typeof t.name === 'string' && Array.isArray(t.pattern))
          .map((t: any) => ({ name: t.name, ...(typeof t.desc === 'string' && t.desc ? { desc: t.desc } : {}), pattern: t.pattern.filter(isNum).map((x: number) => Math.abs(x)) }))
      : [];
    if (layers.length) out.custom = { name: typeof o.custom.name === 'string' && o.custom.name.trim() ? o.custom.name.trim() : 'Egen lista', layers, ...(linetypes.length ? { linetypes } : {}) };
  }
  if (o.allLayers === true) out.allLayers = true;
  return Object.keys(out).length ? out : undefined;
}
