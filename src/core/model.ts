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
}

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
  params: P;
  props: PropertySets;
}

export const FORMAT = 'bacchus-project';
export const FORMAT_VERSION = 4;

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
  };
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
