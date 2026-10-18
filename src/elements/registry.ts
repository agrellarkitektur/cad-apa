import type { ActionKey, ActionStyle, StyleSheet } from '../core/graphics';
import type { Element, ProjectDoc } from '../core/model';
import type { Action, ViewStates } from '../core/states';
import type { Primitive, Vec2 } from '../repr/primitives';
import type { Shape3D } from '../repr/solids';

/**
 * Det som en planregel får veta om sin omgivning.
 */
export interface PlanContext {
  doc: ProjectDoc;
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
  /** Element som sitter i `hostId` och finns i det visade tillståndet. */
  openingsIn(hostId: string): Element[];
  /** Alla element i vyn som syns, oavsett åtgärd. */
  visible(type?: string): Element[];
  /** Räkna ut något en gång per ritning och återanvänd det. */
  memo<T>(key: string, fn: () => T): T;
  /** Elementets parametrar med typens värden ifyllda. */
  params<P>(el: Element<any>): P;
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
  /** Ytan som gäller vid klick och markering. Saknas den används planens primitiver. */
  pickShape?(el: Element<P>, ctx: PlanContext): Vec2[][][];
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
  const t = types.get(el.type);
  const def = el.definition ? doc.definitions[el.definition] : undefined;
  const out: Record<string, unknown> = { ...(t?.defaults() ?? {}), ...(def?.params ?? {}), ...el.params };
  if (def && t?.typeParams) for (const k of t.typeParams) if (k in def.params) out[k] = def.params[k];
  return out as P;
}
