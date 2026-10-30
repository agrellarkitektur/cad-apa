import { exampleMaster } from './exampleMaster';
import { newStyleBook, type StyleBook } from './graphics';
import type { ViewOverrides } from './viewCategories';
import type { Site } from './site';

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
  /**
   * Fälten som gäller hela projektet (0.8.10, format 10): beställare,
   * adress, uppdragsnummer … Nyckeln är fältets namn med små bokstäver; ett
   * fält gäller hela projektet när nyckeln finns här, också med tomt värde.
   */
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
  /** Mallbladet som nya blad får (0.8.8, format 8). */
  master?: Id;
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
  /** Vyn visar en fasad eller sektion (elementets id) i stället för planen. (Format 4.) */
  marker?: Id | null;
  /** Vyn visar ett arbetsblad (format 5). */
  worksheet?: Id | null;
  /** Vy-taggar (format 5), t.ex. "undertak" eller "1:50". 2D-element kan visas i vyer med vissa taggar. */
  tags?: string[];
  /** Skalan vyn ritas i på ett blad, nämnaren (format 5). Texthöjder räknas efter den. */
  scale?: number;
  /**
   * Vykategorin (0.10.32): nyckeln till en kategori av vyns vytyp i
   * stilboken. Utelämnad, eller en som inte finns = vytypens första.
   */
  category?: string;
  /** Vyns avvikelser från kategorin, rad för rad (0.10.32, `ViewOverrides`). */
  overrides?: ViewOverrides;
}

/** Vykategorierna för Platsen (0.10.25). */
export type SiteCategory = 'situation' | 'grading' | 'illustration';

export const SITE_CATEGORIES: readonly { id: SiteCategory; name: string }[] = [
  { id: 'situation', name: 'Situationsplan' },
  { id: 'grading', name: 'Markplaneringsritning' },
  { id: 'illustration', name: 'Illustrationsplan' },
];

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

export type PaperSize = 'A4' | 'A3' | 'A2' | 'A1' | 'A0';

/**
 * Ett arbetsblad (format 5): en fri 2D-ritning som inte hör till ett
 * våningsplan. Med `paper` är det ett **mallblad** (0.8.8, format 8): ritat i
 * mm på papperet, i skala 1:1, med nollpunkten i papperets nedre vänstra
 * hörn. Blad som använder mallen ritar det som är ritat på den under vyerna,
 * med smarttexten ifylld från bladet.
 */
export interface Worksheet {
  id: Id;
  name: string;
  paper?: { size: PaperSize; orientation: 'landscape' | 'portrait' };
  /**
   * En **stämpel** (0.8.12, format 11): ritad som ett mallblad, i mm i
   * skala 1:1, men utan papper. Stämpeln läggs på blad som ett element
   * (`Stamp`) med stämpelns nollpunkt där den ska stå.
   */
  stamp?: true;
}

/** Om ett arbetsblad är ett mallblad (0.8.8). */
export function isMaster(w: Worksheet | undefined): w is Worksheet & { paper: NonNullable<Worksheet['paper']> } {
  return !!w?.paper && !w.stamp;
}

/** Om ett arbetsblad är en stämpel (0.8.12). */
export function isStamp(w: Worksheet | undefined): w is Worksheet & { stamp: true } {
  return !!w?.stamp;
}

/**
 * Om ett arbetsblad ritas på papper (0.8.12): ett mallblad eller en
 * stämpel. Det som är ritat där är i mm, 1:1, och följer inte tillstånden.
 */
export function onPaper(w: Worksheet | undefined): boolean {
  return !!w && (!!w.paper || !!w.stamp);
}

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
 * Ett ritningsblad (format 9). Det som är ritat direkt på bladet (linjer,
 * ytor, text och bilder, 0.8.9) är element med `space` satt till bladets id,
 * i mm på papperet från nedre vänstra hörnet, som på ett mallblad.
 */
export interface Sheet {
  id: Id;
  /** Ritningsnummer, t.ex. "A-40.1-101". Ger också filnamnet vid export. */
  number: string;
  name: string;
  size: PaperSize;
  orientation: 'landscape' | 'portrait';
  /** Mallbladet bladet använder (0.8.8, format 8): dess grafik ritas under vyerna. */
  master?: Id;
  /** Bladets fält (datum, ändring, skede …, 0.8.10), nyckeln med små bokstäver. Projektets fält går före. */
  fields: Record<string, string>;
  viewports: Viewport[];
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
  /** Planens snitthöjd över golvet i mm (0.10.2): det som ligger ovanför ritas punktstreckat. Utelämnad = 1100 (1200 före 0.10.11). */
  cutHeight?: number;
  /**
   * Platsen (0.10.25, format 22): modellfliken för situationsplanen,
   * markplaneringen och illustrationsplanen. Den ligger i listan som en
   * våning (sist, id `platsen`, golvet vid ±0) så att vyer, verktyg och
   * urklipp fungerar som på en våning, men den har ingen snitthöjd och
   * räknas inte bland husets våningar (`buildingStoreys`).
   */
  site?: true;
}

/** Platsens id (0.10.25). */
export const SITE_STOREY: Id = 'platsen';

/** Platsen i våningslistan: sist, vid ±0. */
export function siteStorey(): Storey {
  return { id: SITE_STOREY, name: 'Platsen', elevation: 0, height: 2700, site: true };
}

/** Om id:t (eller våningen) är Platsen. */
export function isSite(s: Id | Pick<Storey, 'site'> | undefined | null): boolean {
  return typeof s === 'string' ? s === SITE_STOREY : !!s?.site;
}

/** Husets våningar, utan Platsen, i listans ordning. */
export function buildingStoreys(doc: Pick<ProjectDoc, 'storeys'>): Storey[] {
  return doc.storeys.filter((s) => !s.site);
}

/** Husets våningar nerifrån och upp (utan Platsen, 0.10.25). */
export function storeysUpFrom(doc: Pick<ProjectDoc, 'storeys'>): Storey[] {
  return buildingStoreys(doc).sort((a, b) => a.elevation - b.elevation);
}

/**
 * Våningen vars golv ligger närmast ±0 (utan Platsen): den som markobjekten
 * runt huset utgår från, och som platsen ritades på före 0.10.25.
 */
export function groundStorey(doc: Pick<ProjectDoc, 'storeys'>): Storey {
  return buildingStoreys(doc).reduce((a, s) => (Math.abs(s.elevation) < Math.abs(a.elevation) || (Math.abs(s.elevation) === Math.abs(a.elevation) && s.elevation > a.elevation) ? s : a));
}

/** Våningslistan med Platsen sist (och med den, om den saknas). */
export function withSiteLast(list: readonly Storey[]): Storey[] {
  const site = list.find((s) => s.site) ?? siteStorey();
  return [...list.filter((s) => !s.site), site];
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
  /**
   * Typens penna (0.8.33), för alla instanser utan egen. Objektets egen går
   * före typens, som går före stilmallens; fält för fält.
   */
  pen?: OwnPen;
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
   * Var elementet är ritat (format 5): en fasad, en sektion (markörens id),
   * ett arbetsblad eller ett ritningsblad (0.8.9, mm på papperet). Utelämnad = våningens plan. Koordinaterna gäller
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
  /**
   * Ritordningen bland element av samma sort på samma yta (0.8.25): lägre
   * ritas bakom. Utelämnad = 0; vid lika värden gäller ordningen i listan.
   */
  order?: number;
  /**
   * Egen penna (0.8.31) i stället för stilmallens, för de udda fall där
   * standardritningen blir missvisande: tjocklek, färg och linjetyp, var
   * för sig. Utelämnad = stilmallens. Gäller objektets linjer och konturer
   * i planen, fasaderna och sektionerna, inte fyllningar och text.
   */
  pen?: OwnPen;
  params: P;
  props: PropertySets;
}

/** En del av en egen penna: det som saknas tas från typen eller stilmallen. */
export interface OwnPenPart {
  /** Linjebredd på papper i mm. */
  weight?: number;
  /** Färg som #rrggbb. */
  color?: string;
  /** Linjetypens nyckel (`lineTypeDash`); `solid` tar bort stilmallens streckning. */
  linetype?: string;
}

/**
 * Ett objekts eller en typs egen penna (0.8.31). Fälten överst gäller
 * snittet och vyn (konturer, karmar, dörrblad); `symbol` (0.8.33) gäller
 * dörrarnas och fönstrens symbollinjer (slagbågen, öppningssättet).
 */
export interface OwnPen extends OwnPenPart {
  symbol?: OwnPenPart;
  /** Det som ligger över planens snitthöjd (0.10.16), streckprickat från början. */
  above?: OwnPenPart;
}

export const FORMAT = 'bacchus-project';
/** 25 (0.10.32): stilboken med vykategorier (`graphics.categories`); vyns `category` är kategorins nyckel och dess avvikelser står i `overrides` (i stället för `compare`, `detail`, `hide` …, `style`). 24 (0.10.28.1): materialens kryssrutor `ground` och `building` i stället för `category`. 23 (0.10.28): materialen i stilmallen (`graphics.materials`, i stället för `fills`) och objektens `material`, `materialOpacity` och `materialAngle` (i stället för `fillStyle`). 20 (0.10.8b): linjen `BasisFacade` (beräkningsgrundande fasad) och fasad- och sektionsmarkörernas `heights`. 19 (0.10.7): markobjektens sort `area` och vägen utan `path`. */
export const FORMAT_VERSION = 25;

export interface ProjectDoc {
  format: typeof FORMAT;
  formatVersion: number;
  project: ProjectInfo;
  states: State[];
  storeys: Storey[];
  definitions: Record<Id, Definition>;
  elements: Record<Id, Element>;
  /** Stilboken (0.10.32): resurserna och vykategorierna. */
  graphics: StyleBook;
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
  /**
   * Platsen (0.10.3, format 18): koordinatsystem, nollpunkt, ±0 i RH 2000 och
   * markmodellen ur Höjdkurvor. Utelämnad = plan mark som förut.
   */
  site?: Site;
}

/**
 * Ett nytt, tomt projekt. Projekttypen avgör tillstånden: en nybyggnad har
 * bara ett förslag, en till- eller ombyggnad har Befintligt och ett förslag.
 * Några vanliga typer finns med från början så att man kan börja rita direkt.
 */
/** Fälten som nya projekt börjar med, och som gäller hela projektet (0.8.10). */
export const PROJECT_DEFAULT_FIELDS = ['adress', 'fastighet', 'beställare', 'uppdragsnummer', 'arkitekt', 'ansvarig'];

export function emptyProject(name: string, kind: ProjectKind, fields: Record<string, string> = {}): ProjectDoc {
  const states: State[] =
    kind === 'nybyggnad'
      ? [{ id: 'st-ny', name: 'Förslag', kind: 'proposal' }]
      : [
          { id: 'st-bef', name: 'Befintligt', kind: 'existing' },
          { id: 'st-a', name: 'Förslag A', kind: 'proposal' },
        ];
  const master = exampleMaster('pl-1', states.map((s) => s.id));
  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    project: { name, kind, fields: { ...Object.fromEntries(PROJECT_DEFAULT_FIELDS.map((k) => [k, ''])), ...fields }, master: master.worksheet.id },
    states,
    storeys: [{ id: 'pl-1', name: 'Plan 1', elevation: 0, height: 2700 }, siteStorey()],
    definitions: {
      't-yv01': { id: 't-yv01', origin: 'component', name: 'YV01', elementType: 'Wall', params: { thickness: 400 }, props: {}, description: 'Yttervägg' },
      't-iv01': { id: 't-iv01', origin: 'component', name: 'IV01', elementType: 'Wall', params: { thickness: 120 }, props: {}, description: 'Lätt innervägg' },
      't-d1': { id: 't-d1', origin: 'component', name: 'D1', elementType: 'Door', params: { width: 900, height: 2100 }, props: {}, description: 'Innerdörr M9×21' },
      't-f1': { id: 't-f1', origin: 'component', name: 'F1', elementType: 'Window', params: { width: 1200, height: 1200 }, props: {} },
      't-bj01': { id: 't-bj01', origin: 'component', name: 'BJ01', elementType: 'Slab', params: { thickness: 300 }, props: {}, description: 'Bjälklag' },
    },
    elements: { ...drawingMarkers('pl-1'), ...master.elements },
    graphics: newStyleBook(),
    views: [],
    ...emptyTree(),
    worksheets: [master.worksheet],
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
