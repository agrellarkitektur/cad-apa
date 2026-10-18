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
  | 'delete';

/** Snabbknappar som kan väljas, och för vilka sorters objekt de finns. */
export const QUICK_ACTIONS: { id: QuickId; label: string; types: string[] | 'all' }[] = [
  { id: 'flip-swing', label: 'Vänd slag', types: ['Door'] },
  { id: 'flip-hinge', label: 'Byt hängning', types: ['Door'] },
  { id: 'toggle-glazed', label: 'Glasad', types: ['Door'] },
  { id: 'cycle-ref', label: 'Referenslinje', types: ['Wall'] },
  { id: 'flip-wall', label: 'Vänd väggen', types: ['Wall'] },
  { id: 'rotate-90', label: 'Vrid 90°', types: ['Wall', 'Furniture', 'Text', 'mixed'] },
  { id: 'mirror', label: 'Spegla', types: ['Wall', 'Furniture', 'mixed'] },
  { id: 'copy', label: 'Kopiera', types: ['Wall', 'Furniture', 'Space', 'Dimension', 'Text', 'mixed'] },
  { id: 'demolish', label: 'Riv / behåll', types: ['Wall', 'Door', 'Window', 'Furniture', 'mixed'] },
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
  mixed: ['copy', 'rotate-90', 'mirror', 'demolish', 'delete'],
};

export interface UiSettings {
  grid: boolean;
  /** Snabbmeny vid markören när något markeras med musen. */
  petPalette: boolean;
  /** Måttsätt nya väggar och öppningar automatiskt när man jämför. */
  autoDims: boolean;
  /** Färg på markeringar; null = temats accentfärg. */
  selColor: string | null;
  /** Färg på referenslinjer och grepp; null = temats. */
  refColor: string | null;
  quick: Record<string, QuickId[]>;
  /** Bredderna på navigatorn och egenskaperna på datorn, px. */
  navWidth: number;
  panelWidth: number;
  /**
   * Skärmens diagonal i tum. Används för att visa skärmskalan exakt; null =
   * räkna med webbens standard, 96 pixlar per tum.
   */
  screenInches: number | null;
}

export const PANE_WIDTH = { nav: 300, panel: 340, min: 220, max: 640 } as const;

const KEY = 'bacchus-ui';

export function defaultUiSettings(): UiSettings {
  return {
    grid: true,
    petPalette: true,
    autoDims: true,
    selColor: null,
    refColor: null,
    quick: structuredClone(QUICK_DEFAULTS),
    navWidth: PANE_WIDTH.nav,
    panelWidth: PANE_WIDTH.panel,
    screenInches: null,
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
      petPalette: typeof raw.petPalette === 'boolean' ? raw.petPalette : d.petPalette,
      autoDims: typeof raw.autoDims === 'boolean' ? raw.autoDims : d.autoDims,
      selColor: typeof raw.selColor === 'string' ? raw.selColor : null,
      refColor: typeof raw.refColor === 'string' ? raw.refColor : null,
      quick,
      navWidth: width(raw.navWidth, d.navWidth),
      panelWidth: width(raw.panelWidth, d.panelWidth),
      screenInches: Number(raw.screenInches) >= 3 && Number(raw.screenInches) <= 120 ? Number(raw.screenInches) : null,
    };
  } catch {
    return d;
  }
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
  ['Esc', 'Avbryt kommandot, sedan verktyget; i Markera avmarkerar den'],
  ['Enter', 'Avsluta väggen, eller bekräfta ett inskrivet mått'],
  ['Siffror', 'Skriv en längd medan du ritar en vägg'],
  ['Shift', 'Lås vinkeln till 45° när du ritar eller drar; lägg till i markeringen'],
  ['Delete', 'Ta bort det markerade'],
  ['Ctrl+Z', 'Ångra'],
  ['Ctrl+Shift+Z, Ctrl+Y', 'Gör om'],
  ['F', 'Zooma till allt'],
  ['+ / −', 'Zooma in och ut'],
  ['G', 'Visa eller dölj rutnätet'],
  ['S', 'Snäppning av eller på'],
  ['P', 'Visa eller dölj egenskaperna'],
  ['N', 'Visa eller dölj navigatorn'],
  ['Dubbelklick', 'Redigera en text eller ett rumsnamn direkt i ritningen'],
  ['2 / 3 / 4', 'Plan, 3D eller båda'],
  ['Mellanslag + dra', 'Panorera med musen'],
];
