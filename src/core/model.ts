import { SWEDISH_STANDARD, type StyleSheet } from './graphics';

/**
 * Bacchus datamodell. Ren data som kan sparas som JSON: inga klasser, inga
 * funktioner, inga referenser mellan objekt annat än via id.
 *
 * Begreppen följer IFC där det går (Project → Storey → Element,
 * egenskapsuppsättningar) men med färre fält.
 */

export type Id = string;

/** Värden som får förekomma i parametrar och egenskaper. */
export type Value = string | number | boolean | null | readonly [number, number];

/** Egenskaper i namngivna grupper, som IFC:s Pset_DoorCommon. */
export type PropertySets = Record<string, Record<string, Value>>;

export type ProjectKind = 'nybyggnad' | 'tillbyggnad' | 'ombyggnad';

export interface ProjectInfo {
  name: string;
  kind: ProjectKind;
  /** Fält som fyller ritningshuvudet: beställare, adress, uppdragsnummer … */
  fields: Record<string, string>;
  /** Hur rummen numreras. Utelämnad = fyra siffror, byggnad 1, automatiskt. */
  roomNumbering?: RoomNumbering;
  /** Om dörrarnas individuella nummer (D1203) är låsta. */
  doorNumbering?: { locked: boolean };
  /**
   * Projektvinklar (format 5) i grader, utöver 0°, 45° och 90° som alltid
   * gäller, t.ex. 103,5 för en sned tillbyggnad. Vinkelräta räknas med.
   */
  angles?: number[];
}

/**
 * En vy: hur en plan ritas – tillstånd, jämförelse, detaljnivå och vad som
 * visas. Vyer sparas i projektet och placeras senare på blad. Det man ändrar
 * medan man arbetar (t.ex. jämförelsen) ändrar inte vyn förrän man sparar den.
 */
export interface ViewDef {
  id: Id;
  name: string;
  storey: Id;
  state: Id;
  /** Jämför med befintligt. */
  compare: boolean;
  detail: 'sketch' | 'normal' | 'detail';
  /** Dolda kategorier: elementtyper och "littera". */
  hide: string[];
  hideDemolished: boolean;
  /** En förinställd stilmall (namn), annars projektets. */
  style?: string;
  /** En annan vy som visas tonad under, att rita mot. */
  trace?: Id | null;
  /** Vyn visar en fasad eller sektion (elementets id) i stället för planen. (Format 4.) */
  marker?: Id | null;
  /** Vyn visar ett arbetsblad (format 5). */
  worksheet?: Id | null;
  /** Vy-taggar (format 5), t.ex. "undertak" eller "1:50". 2D-element kan visas i vyer med vissa taggar. */
  tags?: string[];
  /** Skalan vyn ritas i på ett blad, nämnaren (format 5). Texthöjder räknas efter den. */
  scale?: number;
}

/**
 * Var ett 2D-element, en text eller ett mått syns (format 5). Utelämnad:
 * i alla vyer av våningen (eller av fasaden, sektionen eller arbetsbladet
 * det är ritat i).
 * - views: bara i de uppräknade vyerna. Ett id är en sparad vy eller
 *   modellvyn av en våning, fasad, sektion eller ett arbetsblad
 *   (`modelViewId`). "Bara den här vyn" är en lista med en vy. Vyer av andra
 *   våningar får vara med.
 * - tags: i vyer med alla (`all`) eller någon (`any`) av taggarna.
 */
export type ShowIn = { kind: 'views'; views: Id[] } | { kind: 'tags'; tags: string[]; match: 'all' | 'any' };

/** Id för modellvyn av en våning, fasad, sektion eller ett arbetsblad: det man ser utan en sparad vy. */
export function modelViewId(place: Id): Id {
  return `modell:${place}`;
}

/** En mapp i projektträdet (format 5). Mappar kan ligga i mappar. */
export interface Folder {
  id: Id;
  name: string;
  /** Fliken i projektträdet mappen hör till. */
  tab: TreeTab;
  parent: Id | null;
}

export type TreeTab = 'underlag' | 'modell' | 'vyer' | 'ritningar';

/** Ett arbetsblad (format 5): en fri 2D-ritning som inte hör till ett våningsplan. */
export interface Worksheet {
  id: Id;
  name: string;
}

export type PaperSize = 'A4' | 'A3' | 'A2' | 'A1' | 'A0';

/** En vy placerad på ett ritningsblad (format 5). Läget är i mm på papperet. */
export interface Viewport {
  id: Id;
  view: Id;
  at: [number, number];
  /** Skalans nämnare, t.ex. 100 för 1:100. */
  scale: number;
  /** Vyrubrik; utelämnad = vyns namn. */
  title?: string;
  /** Rubriken visar inte skalan (0.8.7, format 7). */
  hideScale?: boolean;
  /**
   * Vyns ram (0.8.7, format 7) i modellens koordinater (eller fasadens och
   * sektionens), så att ramen visar samma del av ritningen när skalan byts.
   * Det som ligger utanför klipps. Utelämnad = ramen följer innehållet.
   */
  crop?: { minX: number; minY: number; maxX: number; maxY: number };
}

/**
 * Ett ritningshuvud på ett blad (0.8.6, format 6). Huvudet lagrar bara läge
 * och mall; fälten ligger i bladets `fields` och projektets `fields`, så att
 * inget försvinner om huvudet tas bort. `at` är huvudets nedre högra hörn,
 * i mm från papperets nedre högra hörn (x negativt), så att huvudet följer
 * med till hörnet när formatet byts.
 */
export interface TitleBlockItem {
  kind: 'titleBlock';
  id: Id;
  template: 'bh90';
  at: [number, number];
}

/**
 * En fri text på ett blad (0.8.7, format 7). `at` är första radens
 * baslinje till vänster, i mm från papperets nedre vänstra hörn. Höjden är
 * i mm på papperet. Texten kan innehålla smarttext, t.ex. `{datum}`.
 */
export interface SheetTextItem {
  kind: 'text';
  id: Id;
  at: [number, number];
  text: string;
  height: number;
  bold?: boolean;
}

/**
 * Det som ligger på ett blad utöver vyerna (0.8.6): ritningshuvuden och
 * texter (0.8.7). Senare skalstock, orienteringsfigur och smartgrupper.
 */
export type SheetItem = TitleBlockItem | SheetTextItem;

/** Ett ritningsblad (format 6). */
export interface Sheet {
  id: Id;
  /** Ritningsnummer, t.ex. "A-40.1-101". Ger också filnamnet vid export. */
  number: string;
  name: string;
  size: PaperSize;
  orientation: 'landscape' | 'portrait';
  /** Ritningsramen 20/10 mm från papperets kant (0.8.6). */
  frame: boolean;
  /** Fält i ritningshuvudet utöver projektets (nummer, innehåll, datum, ändring, skede …). */
  fields: Record<string, string>;
  viewports: Viewport[];
  /** Ritningshuvuden och annat på bladet, nedifrån och upp (0.8.6). */
  items: SheetItem[];
}

/** En fil som hör till projektet (format 5): en bild, en PDF eller en DXF som underlag. */
export interface Asset {
  id: Id;
  name: string;
  mime: string;
  /** Innehållet som base64. */
  data: string;
}

/** Vy-taggar som nya projekt börjar med. */
export const DEFAULT_VIEW_TAGS = ['golvplan', 'undertak', 'möblering', 'bygglov', 'bygghandling', '1:50', '1:100'];

/**
 * Rumsnumrering: byggnad + plan + löpnummer (1101) eller plan + löpnummer
 * (101). Automatiskt numreras rummen i vänstervarv från entrén; låst behålls
 * numren som de var när de låstes.
 */
export interface RoomNumbering {
  digits: 3 | 4;
  building: string;
  locked: boolean;
}

/**
 * Ett tillstånd är en version av byggnaden: det befintliga, ett förslag
 * eller en etapp. Objekt anger i vilka tillstånd de finns, och åtgärden
 * (befintligt, rivs, nytt) räknas ut när två tillstånd jämförs.
 */
export interface State {
  id: Id;
  name: string;
  kind: 'existing' | 'proposal' | 'stage';
}

export interface Storey {
  id: Id;
  name: string;
  /** Golvnivå i mm relativt projektets nollnivå. */
  elevation: number;
  /** Våningshöjd i mm (golv till golv). */
  height: number;
}

/**
 * En definition beskriver något som kan placeras flera gånger: ett
 * biblioteksobjekt (dörr, soffa) eller en komponent (hotellrum). Instanser
 * pekar på den med `Element.definition`.
 */
export interface Definition {
  id: Id;
  /** "library" = kopia av en biblioteksfil, "component" = skapad i projektet. */
  origin: 'library' | 'component';
  /**
   * Typens littera, t.ex. "IV01", "F1" eller "D2". Alla element av typen
   * delar typparametrarna (tjocklek, bredd …).
   */
  name: string;
  /** Fri beskrivning, t.ex. "Lätt innervägg, 95 regel + 2 × gips". */
  description?: string;
  /** Vilken elementtyp instanserna har, t.ex. "Door". */
  elementType: string;
  /** Biblioteksfilens id och version, för att kunna erbjuda uppdatering. */
  source?: { libraryId: string; version: number };
  /** Förval för instansernas parametrar. */
  params: Record<string, Value>;
  props: PropertySets;
}

/**
 * Ett element i modellen. Typspecifika data ligger i `params`; vad de
 * betyder bestäms av elementtypen i registret (se registry.ts).
 */
export interface Element<P extends object = Record<string, unknown>> {
  id: Id;
  type: string;
  storey: Id;
  /** Tillstånd där elementet finns. */
  states: Id[];
  tags: string[];
  /** Eget id eller nummer, t.ex. "D03". Typens littera ligger i definitionen. */
  name?: string;
  /** Värdelementet för dörrar och fönster (väggen de sitter i). */
  host?: Id;
  /** Definitionen elementet är en instans av. */
  definition?: Id;
  /**
   * Var elementet är ritat (format 5): en fasad, en sektion (markörens id)
   * eller ett arbetsblad. Utelämnad = våningens plan. Koordinaterna gäller
   * i den ytan; i en fasad eller sektion är x längs linjen och y höjden.
   */
  space?: Id;
  /** Var elementet syns (format 5), se `ShowIn`. Gäller 2D-element, text och mått. */
  show?: ShowIn;
  /** Låst (format 5): kan inte flyttas eller ändras av misstag. */
  locked?: boolean;
  /**
   * Avsiktligt nästan rak (0.8.4): varningen för sneda vinklar visas inte.
   * Ett frivilligt fält som äldre versioner hoppar över, så formatet är 5.
   */
  skewOk?: boolean;
  params: P;
  props: PropertySets;
}

export const FORMAT = 'bacchus-project';
export const FORMAT_VERSION = 7;

export interface ProjectDoc {
  format: typeof FORMAT;
  formatVersion: number;
  project: ProjectInfo;
  states: State[];
  storeys: Storey[];
  definitions: Record<Id, Definition>;
  elements: Record<Id, Element>;
  /** Stilmallen för ritningsgrafiken (befintligt, rivs, nytt). */
  graphics: StyleSheet;
  /** Sparade vyer. */
  views: ViewDef[];
  /** Mappar i projektträdet (format 5). */
  folders: Folder[];
  /** Vilken mapp något ligger i (format 5): vyns, markörens, våningens, bladets … id → mappens id. */
  tree: Record<Id, Id>;
  /** Projektets vy-taggar (format 5). */
  viewTags: string[];
  /** Arbetsblad (format 5). */
  worksheets: Worksheet[];
  /** Ritningsblad (format 5). */
  sheets: Sheet[];
  /** Filer som underlag (format 5). */
  assets: Record<Id, Asset>;
}

/**
 * Ett nytt, tomt projekt. Projekttypen avgör tillstånden: en nybyggnad har
 * bara ett förslag, en till- eller ombyggnad har Befintligt och ett förslag.
 * Några vanliga typer finns med från början så att man kan börja rita direkt.
 */
export function emptyProject(name: string, kind: ProjectKind, fields: Record<string, string> = {}): ProjectDoc {
  const states: State[] =
    kind === 'nybyggnad'
      ? [{ id: 'st-ny', name: 'Förslag', kind: 'proposal' }]
      : [
          { id: 'st-bef', name: 'Befintligt', kind: 'existing' },
          { id: 'st-a', name: 'Förslag A', kind: 'proposal' },
        ];
  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    project: { name, kind, fields },
    states,
    storeys: [{ id: 'pl-1', name: 'Plan 1', elevation: 0, height: 2700 }],
    definitions: {
      't-yv01': { id: 't-yv01', origin: 'component', name: 'YV01', elementType: 'Wall', params: { thickness: 400 }, props: {}, description: 'Yttervägg' },
      't-iv01': { id: 't-iv01', origin: 'component', name: 'IV01', elementType: 'Wall', params: { thickness: 120 }, props: {}, description: 'Lätt innervägg' },
      't-d1': { id: 't-d1', origin: 'component', name: 'D1', elementType: 'Door', params: { width: 900, height: 2100 }, props: {}, description: 'Innerdörr M9×21' },
      't-f1': { id: 't-f1', origin: 'component', name: 'F1', elementType: 'Window', params: { width: 1200, height: 1200 }, props: {} },
    },
    elements: drawingMarkers('pl-1'),
    graphics: structuredClone(SWEDISH_STANDARD),
    views: [],
    ...emptyTree(),
  };
}

/** Fälten som kom i format 5, tomma. */
export function emptyTree(): Pick<ProjectDoc, 'folders' | 'tree' | 'viewTags' | 'worksheets' | 'sheets' | 'assets'> {
  return { folders: [], tree: {}, viewTags: [...DEFAULT_VIEW_TAGS], worksheets: [], sheets: [], assets: {} };
}

/**
 * Det som varje projekt börjar med på ritningen (format 4): en norrpil,
 * fyra fasader som placeras runt byggnaden av sig själva, och en sektion
 * genom mitten. Fasaderna får namn efter väderstrecket de vetter mot.
 */
export function drawingMarkers(storey: Id, northAt: [number, number] = [6000, 4000]): Record<Id, Element> {
  const base = { storey, states: [] as Id[], tags: [] as string[], props: {} };
  const els: Element[] = [
    { ...base, id: 'north', type: 'North', params: { pos: northAt, angle: 90 } },
    // Fasaderna i ordning: söder, öster, norr, väster (vetter ned, höger, upp, vänster i planen).
    ...[270, 0, 90, 180].map((facing, i): Element => ({
      ...base,
      id: `fasad-${i + 1}`,
      type: 'Elevation',
      params: { start: [0, 0], end: [1, 0], side: 1, depth: null, auto: true, facing },
    })),
    { ...base, id: 'sektion-a', type: 'Section', params: { start: [0, 0], end: [1, 0], side: 1, depth: null, auto: true, label: 'A' } },
  ];
  return Object.fromEntries(els.map((e) => [e.id, e]));
}
