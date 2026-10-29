import type { LeaderAttach, LeaderEnd } from '../elements/leader';
import { normalizeFillTypes, type CustomFillType, type HatchLine } from './fillTypes';
import { normalizeLineTypes, type CustomLineType } from './lineTypes';
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

export interface StyleSheet {
  format: 'bacchus-style';
  version: 1;
  name: string;
  actions: Record<ActionKey, ActionStyle>;
  /**
   * Nya öppningar i befintliga väggar markeras med en skrafferad zon på var
   * sida om öppningen, så här bred i mm. 0 stänger av markeringen.
   */
  openingMark: number;
  /** Texter i planen: justering, höjder och littera. */
  labels: LabelStyle;
  /**
   * Penntabellen (0.8): linjetjocklek i mm och färg per sorts linje i fasader
   * och sektioner (hål, karm, båge, glas, marklinje …). Det som saknas har
   * programmets förval.
   */
  pens?: Record<string, PenDef>;
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
}

/** Materialens kategorier (0.10.28): mark först; bjälklag och tak i 0.10.28.1, väggar med lager i 0.11.1. */
export type MaterialCategory = 'ground' | 'other';

export const MATERIAL_CATEGORIES: readonly { id: MaterialCategory; name: string }[] = [
  { id: 'ground', name: 'Mark' },
  { id: 'other', name: 'Övrigt' },
];

/**
 * Ett material (0.10.28): representationen per vykategori.
 * - `plan`: fyllningen i planen, situationsplanen och markplaneringsritningen,
 *   med samma fält som 2D-formens fyllning (`FillParams`).
 * - `illustration`: en färg med opacitet i illustrationsplanen; utelämnad = som planen.
 * - `color3d`: kulören i 3D som #rrggbb; utelämnad = markens.
 */
export interface Material {
  id: string;
  name: string;
  category: MaterialCategory;
  plan: Record<string, unknown>;
  illustration?: { color: string; opacity?: number };
  color3d?: string;
}

/** Materialen som ett nytt projekt har (0.10.28): förslagen från 0.10.14, nu som material. */
export const DEFAULT_MATERIALS: readonly Material[] = [
  { id: 'gras', name: 'Gräs', category: 'ground', plan: { fill: 'solid', fillColor: '#b4d39b', fillOpacity: 70 }, illustration: { color: '#a8cf8a', opacity: 80 }, color3d: '#9fbf7e' },
  { id: 'grus', name: 'Grus', category: 'ground', plan: { fill: 'solid', fillColor: '#ddd3bc', fillOpacity: 80 }, illustration: { color: '#e2d6ba', opacity: 50 }, color3d: '#d6cbb2' },
  { id: 'asfalt', name: 'Asfalt', category: 'ground', plan: { fill: 'solid', fillColor: '#c9c6bf', fillOpacity: 80 }, illustration: { color: '#a9a8a4', opacity: 80 }, color3d: '#8f8e8a' },
  { id: 'plattor', name: 'Plattor 300', category: 'ground', plan: { fill: 'type', fillType: 'plattor300', fillColor: '#9aa0a6', fillOpacity: 100 }, illustration: { color: '#d9d5cd', opacity: 90 }, color3d: '#cfc9bf' },
  { id: 'tegel', name: 'Tegel', category: 'ground', plan: { fill: 'type', fillType: 'tegel', fillColor: '#1d2328', fillOpacity: 100 }, illustration: { color: '#c98f74', opacity: 90 }, color3d: '#b97a60' },
  { id: 'vatten', name: 'Vatten', category: 'ground', plan: { fill: 'solid', fillColor: '#a9cbe6', fillOpacity: 70 }, illustration: { color: '#9fc6e6', opacity: 90 }, color3d: '#8fb6d6' },
  { id: 'betong', name: 'Betong', category: 'ground', plan: { fill: 'type', fillType: 'betong', fillColor: '#1d2328', fillOpacity: 100 }, illustration: { color: '#cfcfcb', opacity: 100 }, color3d: '#c4c4bf' },
  { id: 'mark', name: 'Mark', category: 'ground', plan: { fill: 'type', fillType: 'mark', fillColor: '#9aa0a6', fillOpacity: 100 }, illustration: { color: '#d8cfb8', opacity: 60 }, color3d: '#cfd3bf' },
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

export const PRESETS: StyleSheet[] = [SWEDISH_STANDARD, POCHE, COLOUR_CODED];

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
  };
}

/**
 * En förinställd stilmall med det som hör till projektet: texterna, de egna
 * linje- och fyllningstyperna (0.8.30, 0.8.36) och materialen (0.10.28).
 */
export function withProjectParts(preset: StyleSheet, g: StyleSheet): StyleSheet {
  return { ...preset, labels: g.labels, ...(g.lineTypes ? { lineTypes: g.lineTypes } : {}), ...(g.fillTypes ? { fillTypes: g.fillTypes } : {}), ...(g.materials ? { materials: g.materials } : {}) };
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
    const ill = m.illustration && hex(m.illustration.color) ? { color: hex(m.illustration.color)!, ...(Number.isFinite(m.illustration.opacity) ? { opacity: Math.max(0, Math.min(100, Number(m.illustration.opacity))) } : {}) } : undefined;
    out.push({
      id: m.id,
      name: typeof m.name === 'string' && m.name.trim() ? m.name.trim() : m.id,
      category: MATERIAL_CATEGORIES.some((c) => c.id === m.category) ? m.category : 'other',
      plan,
      ...(ill ? { illustration: ill } : {}),
      ...(hex(m.color3d) ? { color3d: hex(m.color3d) } : {}),
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
