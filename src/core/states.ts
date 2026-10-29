import type { Element, Id, ProjectDoc, SiteCategory, State } from './model';

/** Skiss, normal eller detalj (0.8.37 delad i littera, 2D och 3D). */
export type DetailLevel = 'sketch' | 'normal' | 'detail';

/** Nivåerna i ordning, med namnen i appen. */
export const DETAIL_LABELS: Record<DetailLevel, string> = { sketch: 'Skiss', normal: 'Normal', detail: 'Detalj' };
export const DETAIL_LEVELS = Object.keys(DETAIL_LABELS) as DetailLevel[];

/** Detaljnivån för en del av ritningen: littera, 2D-symboler eller 3D (0.8.37). */
export function detailOf(view: Pick<ViewStates, 'detail' | 'labelDetail' | 'modelDetail'>, part: 'label' | 'plan' | 'model'): DetailLevel {
  const base = view.detail ?? 'normal';
  return part === 'label' ? (view.labelDetail ?? base) : part === 'model' ? (view.modelDetail ?? base) : base;
}

/**
 * Hur ett element visas i en vy:
 * - plain: tillståndet visas utan jämförelse
 * - existing: finns både i tillståndet och i jämförelsen (befintligt, oförändrat)
 * - demolished: finns i jämförelsen men inte i tillståndet (rivs)
 * - new: finns i tillståndet men inte i jämförelsen (nytt)
 * - absent: syns inte alls
 */
export type Action = 'plain' | 'existing' | 'demolished' | 'new' | 'absent';

export interface ViewStates {
  /** Tillståndet som visas. */
  state: Id;
  /** Tillståndet det jämförs med, oftast Befintligt. Utelämnas för en ren vy. */
  compareTo?: Id;
  /**
   * Detaljnivå för 2D-symbolerna: "sketch" för tidiga skisser (öppningar
   * utan karmar), "normal" med karmar och glasningslinjer. Utelämnad = normal.
   */
  detail?: DetailLevel;
  /** Detaljnivå för litteran (0.8.37); utelämnad = som `detail`. */
  labelDetail?: DetailLevel;
  /** Detaljnivå för 3D-objekten och fasaderna (0.8.37); utelämnad = som `detail`. */
  modelDetail?: DetailLevel;
  /** Dölj det som rivs, t.ex. i en plan som bara visar förslaget. */
  hideDemolished?: boolean;
  /** Elementtyper eller kategorier som inte visas: "Furniture", "Space", "littera" … */
  hide?: readonly string[];
  /** Måttsätt det som är nytt automatiskt (när man jämför). */
  autoDims?: boolean;
  /**
   * Vilken vy det är (format 5), för 2D-element med Visas i: en sparad vys id
   * eller modellvyns (`modelViewId`). Utelämnad = våningens modellvy.
   */
  viewId?: Id;
  /** Ytan som ritas (format 5): en fasad, sektion, ett arbetsblad eller ritningsblad (0.8.9). Utelämnad = våningens plan. */
  place?: Id;
  /**
   * Smarttextens värden (0.8.9): texter ritas med `{namn}` ifyllt, före
   * radbrytningen. Satt på ritningsblad och för mallblad på ett blad.
   */
  smart?: Readonly<Record<string, string>>;
  /** Vyns vy-taggar (format 5). */
  viewTags?: readonly string[];
  /** Vykategorin för en vy av Platsen (0.10.25); materialen ritas efter den (0.10.28). Utelämnad = planen. */
  category?: SiteCategory;
  /** Visa 2D-element som inte syns i vyn, tonade, för att hitta dem. */
  showHidden?: boolean;
  /** Bjälklagens yta går att klicka i (0.9.4, en inställning i Gränssnitt), inte bara kanterna. Ändrar inte ritningen. */
  slabArea?: boolean;
  /**
   * Annoteringsskalan (0.8 del 3): skalan som texter, mått och symboler ritas
   * för, så att de får rätt höjd på papper. Utelämnad = 1:100.
   */
  scale?: number;
}

export function actionOf(el: Pick<Element, 'states'>, view: ViewStates): Action {
  const inState = el.states.includes(view.state);
  if (!view.compareTo || view.compareTo === view.state) return inState ? 'plain' : 'absent';
  const inCompare = el.states.includes(view.compareTo);
  if (inState && inCompare) return 'existing';
  if (inCompare) return 'demolished';
  if (inState) return 'new';
  return 'absent';
}

/**
 * Vilka tillstånd ett nytt element ska finnas i när det ritas med ett visst
 * tillstånd aktivt. Det man ritar i Befintligt finns kvar i alla förslag
 * tills någon river det; det man ritar i ett förslag finns bara där.
 */
export function statesForNewElement(doc: ProjectDoc, active: Id): Id[] {
  const state = doc.states.find((s) => s.id === active);
  if (state?.kind === 'existing') return doc.states.map((s) => s.id);
  return [active];
}

/** Det tillstånd som förslag normalt jämförs med, om projektet har ett. */
export function existingState(doc: ProjectDoc): State | undefined {
  return doc.states.find((s) => s.kind === 'existing');
}

/** Ett förslag visas först om det finns, annars det första tillståndet. */
export function defaultState(doc: Pick<ProjectDoc, 'states'>): Id {
  return (doc.states.find((s) => s.kind === 'proposal') ?? doc.states[0]).id;
}
