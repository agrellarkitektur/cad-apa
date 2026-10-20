/**
 * Inställningar för gränssnittet: sådant som hör till användaren och
 * webbläsaren, inte till projektet. Sparas i webbläsaren.
 */

export type QuickId =
  | 'flip-swing'
  | 'flip-hinge'
  | 'toggle-glazed'
  | 'rotate-90'
  | 'cycle-ref'
  | 'flip-wall'
  | 'copy'
  | 'mirror'
  | 'demolish'
  | 'zoom-selection'
  | 'open-marker'
  | 'delete';

/** Snabbknappar som kan väljas, och för vilka sorters objekt de finns. */
export const QUICK_ACTIONS: { id: QuickId; label: string; types: string[] | 'all' }[] = [
  { id: 'flip-swing', label: 'Vänd slag', types: ['Door'] },
  { id: 'flip-hinge', label: 'Byt hängning', types: ['Door'] },
  { id: 'toggle-glazed', label: 'Glasad', types: ['Door'] },
  { id: 'cycle-ref', label: 'Referenslinje', types: ['Wall'] },
  { id: 'flip-wall', label: 'Vänd väggen', types: ['Wall'] },
  { id: 'rotate-90', label: 'Vrid 90°', types: ['Wall', 'Furniture', 'Text', 'Roof', 'North', 'Section', 'mixed'] },
  { id: 'mirror', label: 'Spegla', types: ['Wall', 'Furniture', 'Roof', 'mixed'] },
  { id: 'copy', label: 'Kopiera', types: ['Wall', 'Furniture', 'Space', 'Dimension', 'Text', 'Roof', 'Section', 'Elevation', 'mixed'] },
  { id: 'demolish', label: 'Riv / behåll', types: ['Wall', 'Door', 'Window', 'Furniture', 'Roof', 'mixed'] },
  { id: 'open-marker', label: 'Öppna vyn', types: ['Section', 'Elevation'] },
  { id: 'zoom-selection', label: 'Zooma till', types: 'all' },
  { id: 'delete', label: 'Ta bort', types: 'all' },
];

/** Objektsorterna i inställningarna. "mixed" är när olika sorter är markerade. */
export const QUICK_TYPES: { type: string; label: string }[] = [
  { type: 'Wall', label: 'Vägg' },
  { type: 'Door', label: 'Dörr' },
  { type: 'Window', label: 'Fönster' },
  { type: 'Furniture', label: 'Möbel' },
  { type: 'Space', label: 'Rum' },
  { type: 'Dimension', label: 'Mått' },
  { type: 'Text', label: 'Text' },
  { type: 'Roof', label: 'Tak' },
  { type: 'Section', label: 'Sektion' },
  { type: 'Elevation', label: 'Fasad' },
  { type: 'North', label: 'Norrpil' },
  { type: 'mixed', label: 'Blandat' },
];

const QUICK_DEFAULTS: Record<string, QuickId[]> = {
  Wall: ['cycle-ref', 'flip-wall', 'copy', 'demolish', 'delete'],
  Door: ['flip-swing', 'flip-hinge', 'toggle-glazed', 'demolish', 'delete'],
  Window: ['demolish', 'delete'],
  Furniture: ['rotate-90', 'mirror', 'copy', 'demolish', 'delete'],
  Space: ['zoom-selection', 'delete'],
  Dimension: ['copy', 'delete'],
  Text: ['rotate-90', 'copy', 'delete'],
  Roof: ['demolish', 'delete'],
  Section: ['open-marker', 'copy', 'delete'],
  Elevation: ['open-marker', 'delete'],
  North: ['rotate-90'],
  mixed: ['copy', 'rotate-90', 'mirror', 'demolish', 'delete'],
};

export interface UiSettings {
  grid: boolean;
  /** Smartmenyn intill det markerade (0.8.5; tidigare snabbmenyn vid markören). */
  smartMenu: boolean;
  /** Modifiera-raden innanför ritverktygen (0.8.5). */
  modifyRail: boolean;
  /** Måttsätt nya väggar och öppningar automatiskt när man jämför. */
  autoDims: boolean;
  /** Färg på markeringar; null = temats accentfärg. */
  selColor: string | null;
  /** Färg på referenslinjer och grepp; null = temats. */
  refColor: string | null;
  quick: Record<string, QuickId[]>;
  /** Bredderna på projektträdet och egenskaperna på datorn, px. */
  navWidth: number;
  panelWidth: number;
  /**
   * Skärmens diagonal i tum. Används för att visa skärmskalan exakt; null =
   * räkna med webbens standard, 96 pixlar per tum.
   */
  screenInches: number | null;
  /** Projektträdet och egenskaperna på datorn: öppna, minimerade till ett band, eller stängda. */
  navMode: PaneMode;
  panelMode: PaneMode;
  /** Hur en kalkerad vy ritas: ovanpå eller under, färg (null = tonad som ritningen) och opacitet. */
  trace: TraceLook;
  /** Varna för vinklar som ligger så här många grader från 0°, 45° eller 90° utan att vara exakta; 0 = av. */
  angleWarn: number;
  /** Piltangenterna flyttar det markerade så här långt, och med Shift det större steget, mm. */
  nudge: number;
  nudgeLarge: number;
  /** 3D-vyn klipps längs en öppen sektion och visar snittytorna (0.8). */
  followSection: boolean;
  /** Läget Båda: planens andel av ritytans bredd, 0,15–0,85 (0.8.4). */
  split: number;
  /** Nya ritningsblad får ett ritningshuvud; annars är de blanka (0.8.6). */
  newSheetTitleBlock: boolean;
}

export type PaneMode = 'open' | 'min' | 'closed';

export interface TraceLook {
  above: boolean;
  color: string | null;
  opacity: number;
}

export const DEFAULT_TRACE: TraceLook = { above: false, color: null, opacity: 0.3 };

/** Läget Båda: planens andel av ritytan får ligga mellan de här. */
export const SPLIT = { min: 0.15, max: 0.85 } as const;

export const PANE_WIDTH = { nav: 300, panel: 340, min: 220, max: 640 } as const;

const KEY = 'bacchus-ui';

export function defaultUiSettings(): UiSettings {
  return {
    grid: true,
    smartMenu: true,
    modifyRail: true,
    newSheetTitleBlock: false,
    autoDims: true,
    selColor: null,
    refColor: null,
    quick: structuredClone(QUICK_DEFAULTS),
    navWidth: PANE_WIDTH.nav,
    panelWidth: PANE_WIDTH.panel,
    screenInches: null,
    navMode: 'open',
    panelMode: 'open',
    trace: { ...DEFAULT_TRACE },
    angleWarn: 5,
    nudge: 10,
    nudgeLarge: 100,
    followSection: true,
    split: 0.5,
  };
}

export function loadUiSettings(): UiSettings {
  const d = defaultUiSettings();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<UiSettings> | null;
    if (!raw) return d;
    // Snabbknapparna fick nya val i version 2; äldre sparade listor ersätts.
    const quick = (raw as { v?: number }).v === 2 ? { ...d.quick, ...(raw.quick ?? {}) } : d.quick;
    return {
      grid: typeof raw.grid === 'boolean' ? raw.grid : d.grid,
      // Inställningen hette petPalette före 0.8.5.
      smartMenu: typeof raw.smartMenu === 'boolean' ? raw.smartMenu : ((raw as { petPalette?: boolean }).petPalette ?? d.smartMenu),
      modifyRail: typeof raw.modifyRail === 'boolean' ? raw.modifyRail : d.modifyRail,
      newSheetTitleBlock: typeof raw.newSheetTitleBlock === 'boolean' ? raw.newSheetTitleBlock : d.newSheetTitleBlock,
      autoDims: typeof raw.autoDims === 'boolean' ? raw.autoDims : d.autoDims,
      selColor: typeof raw.selColor === 'string' ? raw.selColor : null,
      refColor: typeof raw.refColor === 'string' ? raw.refColor : null,
      quick,
      navWidth: width(raw.navWidth, d.navWidth),
      panelWidth: width(raw.panelWidth, d.panelWidth),
      screenInches: Number(raw.screenInches) >= 3 && Number(raw.screenInches) <= 120 ? Number(raw.screenInches) : null,
      navMode: paneMode(raw.navMode),
      panelMode: paneMode(raw.panelMode),
      trace: traceLook(raw.trace),
      angleWarn: num(raw.angleWarn, 0, 20, d.angleWarn),
      nudge: num(raw.nudge, 1, 10000, d.nudge),
      nudgeLarge: num(raw.nudgeLarge, 1, 100000, d.nudgeLarge),
      followSection: typeof raw.followSection === 'boolean' ? raw.followSection : d.followSection,
      split: num(raw.split, SPLIT.min, SPLIT.max, d.split),
    };
  } catch {
    return d;
  }
}

function num(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  return v !== undefined && v !== null && Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

function paneMode(v: unknown): PaneMode {
  return v === 'min' || v === 'closed' ? v : 'open';
}

function traceLook(v: any): TraceLook {
  const o = Number(v?.opacity);
  return {
    above: v?.above === true,
    color: typeof v?.color === 'string' && /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : null,
    opacity: Number.isFinite(o) && o >= 0.05 && o <= 1 ? o : DEFAULT_TRACE.opacity,
  };
}

function width(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= PANE_WIDTH.min && n <= PANE_WIDTH.max ? Math.round(n) : fallback;
}

/**
 * Hur många mm på skärmen en CSS-pixel är. Med skärmens diagonal i tum
 * räknas det ut ur skärmens storlek i pixlar; annars webbens standard
 * (96 px per tum). Gäller när webbläsaren visar sidan i 100 %.
 */
export function mmPerCssPx(inches: number | null, screenW = globalThis.screen?.width ?? 0, screenH = globalThis.screen?.height ?? 0): number {
  const diag = Math.hypot(screenW, screenH);
  if (!inches || !(diag > 0)) return 25.4 / 96;
  return (inches * 25.4) / diag;
}

/** "100", "1:100", "1/100" eller "1 : 100" → 100. Null om det inte är en skala. */
export function parseScale(text: string): number | null {
  const t = text.replace(/\s/g, '').replace(',', '.');
  const m = /^(?:1[:/])?(\d+(?:\.\d+)?)$/.exec(t);
  const n = m ? Number(m[1]) : NaN;
  return n > 0 && n <= 1_000_000 ? n : null;
}

export function saveUiSettings(s: UiSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, v: 2 }));
  } catch {
    // Privat läge eller blockerad lagring: inställningen gäller bara nu.
  }
}

/** Lägg egna färger över temats. */
export function applyUiColors(s: UiSettings): void {
  const root = document.documentElement.style;
  if (s.selColor) root.setProperty('--sel', s.selColor);
  else root.removeProperty('--sel');
  if (s.refColor) root.setProperty('--ref', s.refColor);
  else root.removeProperty('--ref');
}

/** Kortkommandon, för listan i inställningarna. */
export const SHORTCUTS: [string, string][] = [
  ['V', 'Markera'],
  ['H', 'Panorera'],
  ['W', 'Rita vägg'],
  ['D / O', 'Sätt in dörr / fönster'],
  ['R', 'Rum: klicka i ett utrymme'],
  ['M', 'Mått: klicka punkter, dubbelklicka, placera linjen'],
  ['T', 'Text'],
  ['L', 'Måttband: mät avstånd, vinklar och ytor utan att rita'],
  ['Esc', 'Avbryt kommandot, sedan verktyget; i Markera avmarkerar den'],
  ['Enter', 'Avsluta väggen, eller bekräfta ett inskrivet mått'],
  ['Siffror', 'Skriv en längd medan du ritar en vägg'],
  ['Shift', 'Lås vinkeln till 45° när du ritar eller drar; lägg till i markeringen'],
  ['Delete', 'Ta bort det markerade'],
  ['Ctrl+C / Ctrl+V', 'Kopiera och klistra in, även mellan projekt (typerna följer med)'],
  ['Ctrl + dra', 'Dra en kopia av det markerade'],
  ['Piltangenterna', 'Knuffa det markerade 10 mm, med Shift 100 mm (ändras under Gränssnitt)'],
  ['Ctrl+Z', 'Ångra'],
  ['Ctrl+Shift+Z, Ctrl+Y', 'Gör om'],
  ['F', 'Zooma till allt'],
  ['+ / −', 'Zooma in och ut'],
  ['Z / Shift+Z', 'Zooma till ett område du drar upp / tillbaka till förra zoomen'],
  ['G', 'Visa eller dölj rutnätet'],
  ['S', 'Snäppning av eller på'],
  ['P', 'Visa eller dölj egenskaperna'],
  ['Vyknappen', 'Klick: förra vyn. Håll in: de senaste vyerna'],
  ['N', 'Visa eller dölj projektträdet'],
  ['Dubbelklick', 'Redigera en text eller ett rumsnamn direkt i ritningen; öppna en fasad eller sektion'],
  ['Klick på det markerade', 'Smartmenyn byter Modifiera-valen till det du klickat på: referenslinjen, en ände, ett hörn eller kroppen'],
  ['Modifiera-raden', 'Alla Modifiera-verktyg innanför ritverktygen; de som går att använda för det markerade är tända'],
  ['Högerklick', 'Meny för det du pekar på (långt tryck på telefonen)'],
  ['Alt + dra', 'Flytta en vägg utan att anslutna väggar följer med'],
  ['+300, *2, 2,4m', 'Formler och enheter i alla sifferfält'],
  ['Ctrl+S / Ctrl+O', 'Spara / öppna'],
  ['Ctrl+Alt+N', 'Nytt projekt'],
  ['2 / 3 / 4', 'Plan, 3D eller båda'],
  ['Mellanslag + dra', 'Panorera med musen'],
];
