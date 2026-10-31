import { normalizeGeneral, normalizeOffice, type GeneralSettings, type OfficeInfo } from './general';
import type { LeaderAttach, LeaderEnd } from '../elements/leader';
import { normalizeFillTypes, type CustomFillType, type HatchLine } from './fillTypes';
import { normalizeLineTypes, type CustomLineType } from './lineTypes';
import { defaultCategories, normalizeCategories, styleOfPreset, type ViewCategory } from './viewCategories';
/**
 * Stilmallen bestämmer hur ritningen ser ut för varje åtgärd: vanlig vy,
 * befintligt, rivs och nytt. Den är ren data, sparas i projektet och kan
 * sparas och öppnas som egen fil för att delas mellan projekt och kontor.
 */

/**
 * Färg: "ink" är ritningens svart (ljus på mörk skärm), "paper" är
 * bakgrunden (vit på papper), annars en hexkod som #c2372c.
 */
export type Color = 'ink' | 'paper' | `#${string}`;

export type FillDef =
  | { kind: 'none' }
  /** Solid fyllning. Opacitet 0–1, utelämnad = 1. */
  | { kind: 'solid'; color: Color; opacity?: number }
  /**
   * Snedställd skraffering. Avstånd och linjebredd anges på papper i mm.
   * Skrafferingen kan ha en egen bakgrund, och både linjer och bakgrund en
   * egen opacitet. Fler mönster (kors, isolering, tegel) läggs till som nya sorter.
   */
  | {
      kind: 'hatch';
      color: Color;
      angle: number;
      spacing: number;
      weight: number;
      opacity?: number;
      background?: Color | null;
      backgroundOpacity?: number;
    }
  /**
   * Ett mönster av linjefamiljer (0.8.36), som det ritas: måtten på papper i
   * mm (`HatchLine`). Egna fyllningstyper och DXF-underlagens skraffering
   * blir detta.
   */
  | {
      kind: 'pattern';
      color: Color;
      weight: number;
      lines: HatchLine[];
      opacity?: number;
      background?: Color | null;
      backgroundOpacity?: number;
    }
  /**
   * En egen fyllningstyp i stilmallen (0.8.36), med sin nyckel, vridning och
   * skala. Sparas så (t.ex. som snittfyllning) och görs om till `pattern`
   * med `resolveFill` innan den ritas; ritas inte annars.
   */
  | {
      kind: 'type';
      type: string;
      color: Color;
      weight?: number;
      angle?: number;
      scale?: number;
      opacity?: number;
      background?: Color | null;
      backgroundOpacity?: number;
    };

export interface LineDef {
  /** Linjebredd på papper i mm. */
  weight: number;
  color: Color;
  /** Streckmönster på papper i mm. Tomt eller utelämnat = heldraget. */
  dash?: number[];
}

export interface ActionStyle {
  /** Fyllning i snittytor (väggar, bjälklag). */
  cutFill: FillDef;
  /** Kontur runt snittytor. */
  cutOutline: LineDef | null;
  /** Färg och streckning för övriga linjer: dörrblad, fönster, möbler. */
  lines: { color: Color; dash?: number[] };
  /** Hur långt dörrar ritas öppna, i grader (90 = helt öppen). */
  doorAngle: number;
}

export type ActionKey = 'plain' | 'existing' | 'demolished' | 'new';

/**
 * Stilen i en vykategori (0.10.32): åtgärderna, öppningsmarkeringen och
 * penntabellen. Förut gällde den hela projektet.
 */
export interface CategoryStyle {
  actions: Record<ActionKey, ActionStyle>;
  /**
   * Nya öppningar i befintliga väggar markeras med en skrafferad zon på var
   * sida om öppningen, så här bred i mm. 0 stänger av markeringen.
   */
  openingMark: number;
  /**
   * Penntabellen (0.8): linjetjocklek i mm och färg per sorts linje i fasader
   * och sektioner (hål, karm, båge, glas, marklinje …). Det som saknas har
   * programmets förval.
   */
  pens?: Record<string, PenDef>;
}

/** Projektets resurser (0.10.32): det som gäller alla vyer. */
export interface StyleResources {
  name: string;
  /** Texter i planen: justering, höjder och littera. */
  labels: LabelStyle;
  /** Typsnittet för hela projektet (0.8). Utelämnat = programmets tekniska typsnitt. */
  font?: string;
  /** Projektets egna linjetyper (0.8.30), utöver de inbyggda (`LINE_TYPES`). */
  lineTypes?: CustomLineType[];
  /** Projektets egna fyllningstyper (0.8.36). */
  fillTypes?: CustomFillType[];
  /**
   * Materialen (0.10.28, ersätter de sparade fyllningarna från 0.10.14): ett
   * namn, en kategori och hur materialet ritas i varje vykategori. Objekt
   * kopplas till ett material med `material`; ändras materialet ändras alla
   * objekt med det.
   */
  materials?: Material[];
  /**
   * Favoritfärger i set (0.10.34), t.ex. "Bygglov": färgpanelen i
   * stilbokens rader visar dem och sparar den aktuella färgen i ett set.
   */
  colorSets?: ColorSet[];
  /**
   * Räckestypernas grupper i ordning (0.11.2), också tomma egna grupper.
   * Utelämnade = Räcken, Ledstänger, Staket, Stängsel, Spaljéer, Grindar.
   * En grupp som en typ har men som saknas här läggs sist.
   */
  railingGroups?: string[];
  /** Profiltypernas grupper i ordning (0.11.6), som räckestypernas. Utelämnade = `PROFILE_GROUPS`. */
  profileGroups?: string[];
  /**
   * Projektets pennor (0.10.36): en tjocklek och en färg med ett nummer som
   * namn. Ställena (en rad i en kategori eller en vy) har kvar sina värden;
   * ett ställe hör till pennan med samma tjocklek och färg. Utelämnade =
   * numreras efter ställena (`penTable`).
   */
  penList?: NumberedPen[];
  /** Kontorets uppgifter (0.10.39): företagsnamn, logotyp, kontaktuppgifter, ansvarig och egna taggar. */
  office?: OfficeInfo;
  /** Allmänna inställningar (0.10.39): textstorlek, höjdsystem och decimaler, enheter, litterats siffror, tjocklekar. */
  general?: GeneralSettings;
}

/** En penna i projektets lista (0.10.36): färgen som i penntabellen ("ink", "muted" eller #rrggbb; utelämnad = svart). */
export interface NumberedPen {
  no: number;
  weight: number;
  color?: string;
}

/** Pennlistan från fil: heltal över noll, tjocklek noll eller mer, ingen dubblett av nummer eller tjocklek och färg. */
export function normalizePenList(v: unknown): NumberedPen[] | null {
  if (!Array.isArray(v)) return null;
  const out: NumberedPen[] = [];
  for (const p of v) {
    const no = Number(p?.no);
    const w = Number(p?.weight);
    if (!Number.isInteger(no) || no < 1 || !(w >= 0) || out.some((o) => o.no === no)) continue;
    const color = typeof p.color === 'string' && p.color && p.color !== 'ink' ? p.color : undefined;
    if (out.some((o) => o.weight === w && (o.color ?? 'ink') === (color ?? 'ink'))) continue;
    out.push({ no, weight: w, ...(color ? { color } : {}) });
  }
  return out.length ? out.sort((a, b) => a.no - b.no) : null;
}

/** Ett namngivet set med favoritfärger (0.10.34), färgerna som `#rrggbb`. */
export interface ColorSet {
  name: string;
  colors: string[];
}

/** Favoritseten från fil; set utan namn hoppas över, och färger som inte är `#rrggbb`. */
export function normalizeColorSets(v: unknown): ColorSet[] | null {
  if (!Array.isArray(v)) return null;
  const out: ColorSet[] = [];
  for (const s of v) {
    if (!s || typeof s !== 'object' || typeof s.name !== 'string' || !s.name.trim()) continue;
    const colors = Array.isArray(s.colors) ? [...new Set((s.colors as unknown[]).filter((c): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)).map((c) => c.toLowerCase()))] : [];
    out.push({ name: s.name.trim(), colors });
  }
  return out.length ? out : null;
}

/**
 * Stilmallen som en vy ritas med: resurserna och kategorins stil (med
 * vyns avvikelser), se `sheetFor` i `viewCategories.ts`. De förinställda
 * (Svensk standard, Poché, Färgmarkerad) är också stilmallar.
 */
export interface StyleSheet extends StyleResources, CategoryStyle {
  format: 'bacchus-style';
  version: 1;
}

/**
 * Stilboken (0.10.32): projektets resurser och vykategorierna. Det är den
 * som sparas i projektet (`ProjectDoc.graphics`) och som fil.
 */
export interface StyleBook extends StyleResources {
  format: 'bacchus-stylebook';
  version: 1;
  categories: ViewCategory[];
}

/**
 * Var ett material kan användas (0.10.28.1, förut en kategori): på mark,
 * på byggnaden (bjälklag och tak i 0.10.28.2) eller båda. Panelens lista
 * för ett objekt visar de material som passar det; 2D-former och rum ser alla.
 */
export type MaterialUse = 'ground' | 'building';

/**
 * Ett material (0.10.28): representationen per vykategori.
 * - `ground`, `building` (0.10.28.1): kryssrutorna *Mark* och *Byggnad*.
 * - `plan`: fyllningen i planen, situationsplanen och markplaneringsritningen,
 *   med samma fält som 2D-formens fyllning (`FillParams`).
 * - `illustration`: en färg med opacitet i illustrationsplanen; utelämnad = som planen.
 * - `color3d`: kulören i 3D som #rrggbb; utelämnad = markens.
 * - `cut` (0.10.28.2): snittets fyllning i sektion (och i planen där ett
 *   bjälklag eller tak skärs), som `plan`; utelämnad = stilmallens snitt.
 * - `surface` (0.10.28.2): ytans fyllning i fasad, som `plan`; utelämnad = ingen.
 * - `pen` (0.10.28.2): konturens penna i planen (mm, färg som #rrggbb);
 *   utelämnad = stilmallens penna för objekttypen.
 */
export interface Material {
  id: string;
  name: string;
  ground: boolean;
  building: boolean;
  plan: Record<string, unknown>;
  illustration?: { color: string; opacity?: number };
  color3d?: string;
  cut?: Record<string, unknown>;
  surface?: Record<string, unknown>;
  pen?: { weight: number; color?: string };
  /** Texturen i 3D (0.10.31): en bild i projektets filer, upprepad med sidan `size` mm. */
  texture?: MaterialTexture;
}

/** Materialets textur i 3D (0.10.31). */
export interface MaterialTexture {
  asset: string;
  /** Bildens sida i verkligheten, mm. */
  size: number;
}

const mat = (id: string, name: string, use: 'g' | 'b' | 'gb', plan: Record<string, unknown>, ill: string, illOp: number, c3: string): Material => ({
  id,
  name,
  ground: use.includes('g'),
  building: use.includes('b'),
  plan,
  illustration: { color: ill, opacity: illOp },
  color3d: c3,
});
const solid = (c: string, op: number) => ({ fill: 'solid', fillColor: c, fillOpacity: op });
const typed = (t: string, c: string) => ({ fill: 'type', fillType: t, fillColor: c, fillOpacity: 100 });
/** Linjer i verkliga mått (0.10.28.2): falsar, pannor. */
const lines = (angle: number, spacing: number, c: string) => ({ fill: 'hatch', fillAngle: angle, fillSpacing: spacing, fillModel: true, fillColor: c, fillOpacity: 100 });

/**
 * Materialen som ett nytt projekt har (0.10.28; fler i 0.10.28.1), i
 * listans ordning: växtytorna, de lösa, de hårda och sist byggnadens.
 */
export const DEFAULT_MATERIALS: readonly Material[] = [
  mat('gras', 'Gräs', 'g', solid('#b4d39b', 70), '#a8cf8a', 80, '#9fbf7e'),
  mat('plantering', 'Planteringsyta', 'g', solid('#c3cf9f', 80), '#93ad70', 85, '#7f9a5e'),
  mat('tackbark', 'Täckbark', 'g', solid('#b39a82', 80), '#8a6b52', 85, '#6e5442'),
  mat('jord', 'Jord', 'g', solid('#c7b39a', 70), '#a88a68', 80, '#8a6f52'),
  mat('mark', 'Mark', 'g', typed('mark', '#9aa0a6'), '#d8cfb8', 60, '#cfd3bf'),
  mat('grus', 'Grus', 'g', solid('#ddd3bc', 80), '#e2d6ba', 50, '#d6cbb2'),
  mat('singel', 'Singel', 'g', typed('singel', '#9aa0a6'), '#d9d6ce', 70, '#c9c5bc'),
  mat('stenmjol', 'Stenmjöl', 'g', solid('#e6e1d6', 80), '#ebe4d3', 70, '#d9d3c4'),
  mat('asfalt', 'Asfalt', 'g', solid('#c9c6bf', 80), '#a9a8a4', 80, '#8f8e8a'),
  mat('plattor', 'Plattor 300', 'g', typed('plattor300', '#9aa0a6'), '#d9d5cd', 90, '#cfc9bf'),
  mat('gatsten', 'Gatsten', 'g', typed('gatsten', '#9aa0a6'), '#b9b4ab', 90, '#a39e95'),
  mat('stenmur', 'Stenmur', 'g', typed('stenmur', '#1d2328'), '#a7a29a', 100, '#8f8a82'),
  { ...mat('tegel', 'Tegel', 'gb', typed('tegel', '#1d2328'), '#c98f74', 90, '#b97a60'), cut: typed('tegel', '#1d2328') },
  { ...mat('betong', 'Betong', 'gb', typed('betong', '#1d2328'), '#cfcfcb', 100, '#c4c4bf'), cut: typed('betong', '#1d2328') },
  mat('trall', 'Trall', 'gb', typed('trall', '#9aa0a6'), '#c9a77f', 90, '#b08c64'),
  mat('vatten', 'Vatten', 'g', solid('#a9cbe6', 70), '#9fc6e6', 90, '#8fb6d6'),
  // Byggnadens (0.10.28.2): taken har ytans fyllning i fasaden.
  { ...mat('takpannor', 'Takpannor', 'b', lines(0, 350, '#9aa0a6'), '#9c5a45', 100, '#8a4b3a'), surface: lines(0, 350, '#1d2328') },
  { ...mat('plat', 'Plåt', 'b', lines(90, 600, '#9aa0a6'), '#5d6368', 100, '#4f555a'), surface: lines(90, 600, '#1d2328') },
  { ...mat('aluminium', 'Aluminium', 'b', solid('#c3c7cb', 80), '#c8ccd0', 100, '#b5babf'), cut: solid('#9aa0a6', 100) },
];

/** En rad i penntabellen. */
export interface PenDef {
  weight: number;
  /** "ink", "muted" eller en färg som #rrggbb. */
  color?: string;
  /** Linjetypens nyckel (0.8.30); utelämnad = heldragen. */
  linetype?: string;
}

/** Litteramallar för en objekttyp. Rader skiljs med radbrytning. */
export interface LitteraTemplates {
  normal: string;
  detail: string;
}

/**
 * Hur texter i planen ser ut. Litteramallarna har fält inom klammer:
 * {typ} (D1), {storlek} (D10×21), {nummer} (D1203), {hål} (1010×2110),
 * {karm} (990×2090) och egna egenskaper med sitt namn, t.ex. {brandklass}.
 * Rader där alla fält är tomma hoppas över. I Skiss visas ingen littera.
 */
export interface LabelStyle {
  align: 'left' | 'center';
  /** Texthöjder på papper, mm. */
  heights: { roomName: number; roomInfo: number; littera: number; dimension: number };
  templates: { Wall: LitteraTemplates; Door: LitteraTemplates; Window: LitteraTemplates };
  /**
   * Rumsstämpelns mall (0.8.22), som litteramallarna: en rad per textrad, i
   * den ordning raderna ska stå. Fält: {namn}, {nummer}, {area}, {takhöjd}
   * och rummets egna egenskaper. Raden med {namn} får rumsnamnets höjd och
   * fet stil, en rad med bara {takhöjd} grå text. Tomma rader hoppas över.
   */
  room: string;
  /**
   * Ledarna per littera-sort (0.10.20.1): änden och stammens längd (mm på
   * papperet). Objektets egna val i `tag` går före.
   */
  leaders: Record<LeaderKind, LeaderStyle>;
}

/** Littera-sorterna som har en ledare (0.10.20.1); `Ground` är stödmurens, `Label` det generella littrat (0.10.20.2). */
export type LeaderKind = 'Wall' | 'Door' | 'Window' | 'Space' | 'Ground' | 'Label';

export interface LeaderStyle {
  end: LeaderEnd;
  stub: number;
  /** Från sidan eller understruken (0.10.20.2). */
  attach: LeaderAttach;
  /** Textens vridning i grader moturs som förval (0.10.22); bara det generella littrat, utelämnad = vågrät. */
  angle?: number;
}

const LEADER_END_KEYS: readonly LeaderEnd[] = ['auto', 'none', 'arrow', 'filled', 'dot', 'slash', 'ring'];

export const DEFAULT_LABELS: LabelStyle = {
  align: 'left',
  heights: { roomName: 2.5, roomInfo: 2.2, littera: 2, dimension: 2.2 },
  templates: {
    Wall: { normal: '{typ}', detail: '{typ}' },
    Door: { normal: '{typ}', detail: '{nummer}\n{hål}\n{brandklass}' },
    Window: { normal: '{typ}', detail: '{typ}\n{hål}' },
  },
  room: '{namn}\n{nummer}\n{area}\nTH {takhöjd}',
  // Förvalen ritar som före 0.10.20.1: väggens och murens streck utan ände, rummets öppna pil.
  leaders: {
    Wall: { end: 'none', stub: 3, attach: 'side' },
    Door: { end: 'auto', stub: 3, attach: 'side' },
    Window: { end: 'auto', stub: 3, attach: 'side' },
    Space: { end: 'arrow', stub: 3, attach: 'side' },
    // Stödmurens text understruken som helhet (0.10.20.2, förut ett streck mellan raderna).
    Ground: { end: 'none', stub: 3, attach: 'underline' },
    Label: { end: 'auto', stub: 3, attach: 'side' },
  },
};

const outline: LineDef = { weight: 0.35, color: 'ink' };
const dashed = [2, 1];

/**
 * Svensk praxis: väggar med svart kontur och vit fyllning, rivning streckad
 * utan fyllning, nytt med svart kontur och snedställd skraffering. Befintliga
 * och rivna dörrar ritas 30° öppna, nya 90°. Igensatta dörrhål får nytt
 * väggmaterial och nya öppningar i befintlig vägg en skrafferad zon i sidorna.
 */
export const SWEDISH_STANDARD: StyleSheet = {
  format: 'bacchus-style',
  version: 1,
  name: 'Svensk standard',
  openingMark: 250,
  labels: DEFAULT_LABELS,
  actions: {
    plain: { cutFill: { kind: 'solid', color: 'paper' }, cutOutline: outline, lines: { color: 'ink' }, doorAngle: 90 },
    existing: { cutFill: { kind: 'solid', color: 'paper' }, cutOutline: outline, lines: { color: 'ink' }, doorAngle: 30 },
    demolished: {
      cutFill: { kind: 'none' },
      cutOutline: { ...outline, dash: dashed },
      lines: { color: 'ink', dash: dashed },
      doorAngle: 30,
    },
    new: {
      cutFill: { kind: 'hatch', color: 'ink', angle: 45, spacing: 0.6, weight: 0.18 },
      cutOutline: outline,
      lines: { color: 'ink' },
      doorAngle: 90,
    },
  },
};

/** Färgmarkerat: befintligt grått, rivs gult streckat, nytt rött. */
export const COLOUR_CODED: StyleSheet = {
  format: 'bacchus-style',
  version: 1,
  name: 'Färgmarkerad',
  openingMark: 0,
  labels: DEFAULT_LABELS,
  actions: {
    plain: { cutFill: { kind: 'solid', color: 'ink' }, cutOutline: null, lines: { color: 'ink' }, doorAngle: 90 },
    existing: { cutFill: { kind: 'solid', color: '#a3abb1' }, cutOutline: null, lines: { color: 'ink' }, doorAngle: 90 },
    demolished: {
      cutFill: { kind: 'none' },
      cutOutline: { weight: 0.35, color: '#c99700', dash: dashed },
      lines: { color: '#c99700', dash: dashed },
      doorAngle: 90,
    },
    new: { cutFill: { kind: 'solid', color: '#c2372c' }, cutOutline: null, lines: { color: '#c2372c' }, doorAngle: 90 },
  },
};

/** Svart poché i väggarna: mer skissartat. Jämförelserna som svensk standard. */
export const POCHE: StyleSheet = {
  format: 'bacchus-style',
  version: 1,
  name: 'Poché',
  openingMark: 250,
  labels: DEFAULT_LABELS,
  actions: {
    ...SWEDISH_STANDARD.actions,
    plain: { cutFill: { kind: 'solid', color: 'ink' }, cutOutline: outline, lines: { color: 'ink' }, doorAngle: 90 },
  },
};


/** Kontrollera och komplettera en stilmall från fil. Saknade delar tas från svensk standard. */
export function normalizeStyle(data: any): StyleSheet {
  if (data?.format !== 'bacchus-style') throw new Error('Filen är inte en stilmall.');
  const base = SWEDISH_STANDARD.actions;
  const actions = {} as Record<ActionKey, ActionStyle>;
  for (const key of Object.keys(base) as ActionKey[]) {
    const a = data.actions?.[key] ?? {};
    actions[key] = {
      cutFill: a.cutFill ?? base[key].cutFill,
      cutOutline: a.cutOutline === undefined ? base[key].cutOutline : a.cutOutline,
      lines: a.lines ?? base[key].lines,
      doorAngle: typeof a.doorAngle === 'number' ? a.doorAngle : base[key].doorAngle,
    };
  }
  const mark = Number(data.openingMark);
  return {
    format: 'bacchus-style',
    version: 1,
    name: String(data.name ?? 'Egen stilmall'),
    actions,
    openingMark: Number.isFinite(mark) && mark >= 0 ? mark : SWEDISH_STANDARD.openingMark,
    labels: normalizeLabels(data.labels),
    ...(normalizePens(data.pens) ? { pens: normalizePens(data.pens)! } : {}),
    ...(typeof data.font === 'string' && data.font.trim() ? { font: data.font.trim() } : {}),
    ...(normalizeLineTypes(data.lineTypes) ? { lineTypes: normalizeLineTypes(data.lineTypes)! } : {}),
    ...(normalizeFillTypes(data.fillTypes) ? { fillTypes: normalizeFillTypes(data.fillTypes)! } : {}),
    ...(normalizeMaterials(data.materials) ? { materials: normalizeMaterials(data.materials)! } : {}),
    ...(normalizeColorSets(data.colorSets) ? { colorSets: normalizeColorSets(data.colorSets)! } : {}),
    ...(Array.isArray(data.railingGroups) ? { railingGroups: [...new Set((data.railingGroups as unknown[]).filter((g): g is string => typeof g === 'string' && !!g.trim()).map((g) => g.trim()))] } : {}),
    ...(Array.isArray(data.profileGroups) ? { profileGroups: [...new Set((data.profileGroups as unknown[]).filter((g): g is string => typeof g === 'string' && !!g.trim()).map((g) => g.trim()))] } : {}),
    ...(normalizePenList(data.penList) ? { penList: normalizePenList(data.penList)! } : {}),
    ...(normalizeOffice(data.office) ? { office: normalizeOffice(data.office)! } : {}),
    ...(normalizeGeneral(data.general) ? { general: normalizeGeneral(data.general)! } : {}),
  };
}

/** Stilboken i ett nytt projekt: Svensk standard, materialen och kategorierna. */
export function newStyleBook(): StyleBook {
  return { format: 'bacchus-stylebook', version: 1, name: SWEDISH_STANDARD.name, labels: structuredClone(DEFAULT_LABELS), materials: structuredClone([...DEFAULT_MATERIALS]), categories: defaultCategories() };
}

/**
 * Kontrollera och komplettera en stilbok från fil. En stilmall från före
 * 0.10.32 (`bacchus-style`) ger resurserna och, med `styleTo`, stilen för
 * den kategorin; kategorierna är annars förvalen.
 */
export function normalizeBook(data: any, base?: StyleBook, styleTo?: ViewCategory): StyleBook {
  if (data?.format === 'bacchus-style') {
    const old = normalizeStyle(data);
    const book = base ? structuredClone(base) : newStyleBook();
    const { actions: _a, openingMark: _o, pens: _p, format: _f, version: _v, ...res } = old;
    const style = styleOfPreset(old);
    return { ...book, ...res, categories: book.categories.map((c) => (styleTo && c.id === styleTo.id && c.type === styleTo.type ? { ...c, style } : c)) };
  }
  if (data?.format !== 'bacchus-stylebook') throw new Error('Filen är inte en stilbok.');
  const res = normalizeStyle({ ...data, format: 'bacchus-style' });
  const { actions: _a, openingMark: _o, pens: _p, format: _f, version: _v, ...rest } = res;
  const fallback = styleOfPreset(SWEDISH_STANDARD);
  const categories = normalizeCategories(data.categories, fallback).map((c) => ({ ...c, style: styleOfPreset(normalizeStyle({ ...c.style, format: 'bacchus-style' })) }));
  return { format: 'bacchus-stylebook', version: 1, ...rest, categories };
}

/** Material från fil (0.10.28); de utan nyckel eller planens fyllning hoppas över. */
export function normalizeMaterials(v: unknown): Material[] | null {
  if (!Array.isArray(v)) return null;
  const out: Material[] = [];
  const hex = (c: unknown) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : undefined);
  for (const m of v) {
    if (!m || typeof m !== 'object' || typeof m.id !== 'string' || !m.id || out.some((o) => o.id === m.id)) continue;
    const plan = m.plan && typeof m.plan === 'object' && typeof m.plan.fill === 'string' ? { ...m.plan } : null;
    if (!plan) continue;
    // Snittet och ytan (0.10.28.2) som planen: ett mönster, annars inget.
    const fillOf = (f: unknown) => (f && typeof f === 'object' && typeof (f as { fill?: unknown }).fill === 'string' ? { ...(f as Record<string, unknown>) } : undefined);
    const cut = fillOf(m.cut);
    const surface = fillOf(m.surface);
    const pw = Number(m.pen?.weight);
    const pen = pw > 0 ? { weight: pw, ...(hex(m.pen.color) ? { color: hex(m.pen.color) } : {}) } : undefined;
    const ill = m.illustration && hex(m.illustration.color) ? { color: hex(m.illustration.color)!, ...(Number.isFinite(m.illustration.opacity) ? { opacity: Math.max(0, Math.min(100, Number(m.illustration.opacity))) } : {}) } : undefined;
    out.push({
      id: m.id,
      name: typeof m.name === 'string' && m.name.trim() ? m.name.trim() : m.id,
      ground: m.ground === true,
      building: m.building === true,
      plan,
      ...(ill ? { illustration: ill } : {}),
      ...(hex(m.color3d) ? { color3d: hex(m.color3d) } : {}),
      ...(cut ? { cut } : {}),
      ...(surface ? { surface } : {}),
      ...(pen ? { pen } : {}),
      ...(m.texture && typeof m.texture.asset === 'string' && Number(m.texture.size) > 0 ? { texture: { asset: m.texture.asset, size: Number(m.texture.size) } } : {}),
    });
  }
  return out.length ? out : null;
}

function normalizePens(p: any): Record<string, PenDef> | null {
  if (!p || typeof p !== 'object') return null;
  const out: Record<string, PenDef> = {};
  for (const [k, v] of Object.entries<any>(p)) {
    const w = Number(v?.weight);
    if (!(w > 0)) continue;
    // Heldraget sparas bara när förvalet är en annan linjetyp (snittet, höjdkurvorna) och ska vara kvar (granskningen efter 0.10.18).
    out[k] = { weight: w, ...(typeof v.color === 'string' ? { color: v.color } : {}), ...(typeof v.linetype === 'string' ? { linetype: v.linetype } : {}) };
  }
  return Object.keys(out).length ? out : null;
}

function normalizeLabels(l: any): LabelStyle {
  const d = DEFAULT_LABELS;
  const t = (k: keyof LabelStyle['templates']): LitteraTemplates => ({
    normal: typeof l?.templates?.[k]?.normal === 'string' ? l.templates[k].normal : d.templates[k].normal,
    detail: typeof l?.templates?.[k]?.detail === 'string' ? l.templates[k].detail : d.templates[k].detail,
  });
  const h = (k: keyof LabelStyle['heights']) => (Number(l?.heights?.[k]) > 0 ? Number(l.heights[k]) : d.heights[k]);
  return {
    align: l?.align === 'center' ? 'center' : 'left',
    heights: { roomName: h('roomName'), roomInfo: h('roomInfo'), littera: h('littera'), dimension: h('dimension') },
    templates: { Wall: t('Wall'), Door: t('Door'), Window: t('Window') },
    room: typeof l?.room === 'string' ? l.room : d.room,
    leaders: Object.fromEntries(
      (Object.keys(d.leaders) as LeaderKind[]).map((k) => {
        const v = l?.leaders?.[k];
        return [
          k,
          {
            end: LEADER_END_KEYS.includes(v?.end) ? v.end : d.leaders[k].end,
            stub: Number(v?.stub) >= 0 && v?.stub !== null && v?.stub !== '' && v?.stub !== undefined ? Number(v.stub) : d.leaders[k].stub,
            attach: v?.attach === 'side' || v?.attach === 'underline' ? v.attach : d.leaders[k].attach,
            ...(Number.isFinite(Number(v?.angle)) && v?.angle !== null && v?.angle !== '' && Number(v.angle) % 360 !== 0 ? { angle: ((Number(v.angle) % 360) + 360) % 360 } : {}),
          },
        ];
      }),
    ) as Record<LeaderKind, LeaderStyle>,
  };
}
