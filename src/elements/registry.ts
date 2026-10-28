import type { ActionKey, ActionStyle, StyleSheet } from '../core/graphics';
import type { Element, Id, ProjectDoc, Storey } from '../core/model';
import type { Action, ViewStates } from '../core/states';
import type { Primitive, Vec2 } from '../repr/primitives';
import type { Shape3D } from '../repr/solids';

/**
 * Det som en planregel får veta om sin omgivning.
 */
export interface PlanContext {
  doc: ProjectDoc;
  /** Våningen som ritas, när ytan är en plan (inte en fasad, sektion eller ett blad). */
  storey?: Id;
  view: ViewStates;
  style: StyleSheet;
  /** Ritningsskalans nämnare. Mått på papper (mm) gånger skalan blir mm i modellen. */
  scale: number;
  /** Hur elementet visas i vyn: vanligt, befintligt, rivs eller nytt. */
  actionOf(el: Element<any>): Action;
  /** Stilen för elementets åtgärd. */
  styleOf(el: Element<any>): ActionStyle;
  /** Vilken del av stilmallen en åtgärd ritas med i den här vyn. */
  styleKeyOf(action: Action): ActionKey;
  /**
   * Hur långt en dörr ritas öppen, i grader. Finns dörren i Befintligt
   * gäller Befintligts vinkel (30° i svensk standard), annars Planerats
   * (90°). Det beror inte på vad vyn jämförs med.
   */
  doorAngleOf(el: Element<any>): number;
  /** Element som sitter i `hostId` och finns i det visade tillståndet. */
  openingsIn(hostId: string): Element[];
  /**
   * Alla element i vyn, oavsett åtgärd, också det som döljs under Visa eller
   * med högerklick (0.10.15): det ritas inte, men väggarnas skarvar, rummens
   * konturer och numren blir desamma.
   */
  visible(type?: string): Element[];
  /** Elementet döljs i vyn under Visa eller med högerklick (0.10.15) och ritas inte. */
  hiddenByView(el: Element<any>): boolean;
  /**
   * 2D-formerna som avgränsar rum (0.8.34) på ytan, i det visade
   * tillståndet, också när 2D är släckt i Visa eller formen inte visas i vyn.
   */
  roomBounds(): Element[];
  /** Räkna ut något en gång per ritning och återanvänd det. */
  memo<T>(key: string, fn: () => T): T;
  /** Elementets parametrar med typens värden ifyllda. */
  params<P>(el: Element<any>): P;
  /** Elementet syns inte i vyn men visas tonat (Visa dolda 2D-element). */
  hiddenInView(el: Element<any>): boolean;
  /**
   * Bjälklagen på våningarna ovanför (0.10.1), som kapar väggarna under sig.
   * Bara när 3D-formerna byggs (`modelShapes`), inte i planen.
   */
  slabsAbove?: readonly SlabAbove[];
}

/** Ett bjälklag ovanför en våning (0.10.1): konturen med hål och undersidan i våningens höjder. */
export interface SlabAbove {
  rings: Vec2[][];
  under: number;
}

/** Ett element med den åtgärd det visas med. */
export interface PlanItem {
  el: Element;
  action: Action;
}

/**
 * En elementtyp samlar allt som gör en sorts objekt till just det objektet.
 * En ny objekttyp läggs till som en egen fil i src/elements/ och en rad i
 * src/elements/index.ts – resten av programmet behöver inte ändras.
 */
export interface ElementType<P extends object = Record<string, unknown>> {
  type: string;
  /** Namn i gränssnittet, singular och plural. */
  label: string;
  labelPlural: string;
  /** Prefix för nya typers littera, t.ex. "IV" för väggar eller "F" för fönster. */
  litteraPrefix?: string;
  /** Ordning när planen ritas: lägre ritas först. */
  drawOrder: number;
  /**
   * Om elementet deltar i jämförelsen mellan tillstånd. Rum och texter gör
   * det inte: de visas bara i de tillstånd de finns i.
   */
  compares: boolean;
  /**
   * Hör till ritningen och finns i alla tillstånd, oavsett vilka elementet
   * är markerat för: norrpil, fasad- och sektionsmarkörer.
   */
  global?: boolean;
  /**
   * Hör till projektet, inte till en våning (0.9): fasad- och sektionsmarkörer
   * och norrpilen ritas i alla planer. Elementets `storey` används inte.
   */
  everyStorey?: boolean;
  /**
   * Hör till Platsen (0.10.25): marken, markobjekten, grannhusen, träden och
   * kartan. De ritas på Platsen och flyttas inte till husets våningar.
   */
  onSite?: boolean;
  /**
   * Ritas också i planen för en annan våning än sin egen (0.10.2): ett tak i
   * planen för en våning som det går upp i. Bara planen, inte 3D. `hide`
   * är vyns Visa-val (0.10.10: tak på andra våningar).
   */
  alsoOnStorey?: (el: Element<any>, doc: ProjectDoc, storey: Id, hide?: readonly string[]) => boolean;
  /**
   * Förval som följer elementets våning (0.9), t.ex. väggens höjd. Gäller när
   * varken elementet eller typen har ett eget värde.
   */
  storeyParams?: (storey: Storey) => Record<string, unknown>;
  /**
   * Syns i 3D-vyn men inte i fasader och sektioner (0.10.3): grannhus och
   * träd ur platsen, som annars skulle fylla fasaderna med det som står långt bort.
   */
  only3dView?: boolean;
  /** Om elementet måste sitta i ett annat (dörrar och fönster i väggar). */
  hosted?: boolean;
  /**
   * Parametrar som hör till typen och delas av alla element med samma
   * littera, t.ex. väggens tjocklek. De läses alltid från definitionen.
   */
  typeParams?: (keyof P & string)[];
  /** Förval när ett nytt element skapas. */
  defaults(): P;
  /** Elementets symbol i plan. Ritas i modellkoordinater (mm). */
  plan?(el: Element<P>, ctx: PlanContext): Primitive[];
  /**
   * Rita flera element av typen tillsammans, t.ex. väggar som ska flyta ihop
   * i skarvarna. Anropas en gång per åtgärd. Går före `plan` om den finns.
   */
  planBatch?(items: PlanItem[], ctx: PlanContext): Primitive[];
  /**
   * Vilka andra typers element planen läser (0.8.3), t.ex. läser väggarna
   * andra väggar (skarvar) och sina öppningar ("hosted" betyder alla typer som
   * sitter i en vägg). En tom lista betyder att elementet bara ritar sig
   * självt. Saknas den räknas typen om när något element ändrats.
   */
  planReads?: readonly string[];
  /** Ytan som gäller vid klick och markering. Saknas den används planens primitiver. */
  pickShape?(el: Element<P>, ctx: PlanContext): Vec2[][][];
  /**
   * Ytan från `pickShape` är mjuk (0.8.11): ett klick nära en linje går före
   * ett klick inuti, men inuti går före rum. För 2D-former (0.8.19): bara
   * ytan från `pickShape` går att klicka inuti, inte en sluten linje.
   */
  pickSoft?: boolean | ((el: Element, ctx: PlanContext) => boolean);
  /**
   * En hel, ogenomskinlig fyllning döljer linjerna i element av samma typ
   * som ligger bakom i ritordningen (0.8.28, 2D-former; se `coverLines`).
   */
  planCovers?: boolean;
  /** Elementet i 3D, som lodräta extruderingar (mm, z uppåt från våningens golv). */
  model3d?(el: Element<P>, ctx: PlanContext): Shape3D[];
  /** Flera element i 3D tillsammans, t.ex. väggar som ska skarvas. Går före `model3d`. */
  model3dBatch?(items: PlanItem[], ctx: PlanContext): Shape3D[];
}

const types = new Map<string, ElementType<any>>();

export function registerType<P extends object>(t: ElementType<P>): void {
  types.set(t.type, t);
}

export function typeOf(type: string): ElementType | undefined {
  return types.get(type);
}

export function allTypes(): ElementType[] {
  return [...types.values()].sort((a, b) => a.drawOrder - b.drawOrder);
}

/**
 * Elementets parametrar: typens förval, sedan definitionens värden, sedan
 * elementets egna. Typparametrar (som väggtjocklek) tas alltid från
 * definitionen när det finns en, så att alla av samma littera blir lika.
 */
export function resolveParams<P>(doc: ProjectDoc, el: Element<any>): P {
  const def = el.definition ? doc.definitions[el.definition] : undefined;
  // Samma element och samma definition ger samma objekt (0.8.3), så att
  // cacharna i planen kan jämföra parametrar med ===. Det får inte ändras.
  const t = types.get(el.type);
  // Det som följer våningen (0.9), t.ex. väggens höjd; våningslistan byts ut när en våning ändras.
  const storey = t?.storeyParams ? doc.storeys.find((s) => s.id === el.storey) : undefined;
  const hit = resolved.get(el);
  if (hit && hit.def === def && hit.storey === storey) return hit.out as P;
  const out: Record<string, unknown> = { ...(t?.defaults() ?? {}), ...(storey ? t!.storeyParams!(storey) : {}), ...(def?.params ?? {}), ...el.params };
  if (def && t?.typeParams) for (const k of t.typeParams) if (k in def.params) out[k] = def.params[k];
  if (import.meta.env?.DEV) Object.freeze(out);
  resolved.set(el, { def, storey, out });
  return out as P;
}

const resolved = new WeakMap<Element<any>, { def: unknown; storey: unknown; out: Record<string, unknown> }>();
