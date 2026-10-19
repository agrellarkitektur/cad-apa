import type { Element, Id, ProjectDoc, State } from './model';

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
   * Detaljnivå: "sketch" för tidiga skisser (öppningar utan karmar),
   * "normal" med karmar och glasningslinjer. Utelämnad = normal.
   */
  detail?: 'sketch' | 'normal' | 'detail';
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
  /** Ytan som ritas (format 5): en fasad, sektion eller ett arbetsblad. Utelämnad = våningens plan. */
  place?: Id;
  /** Vyns vy-taggar (format 5). */
  viewTags?: readonly string[];
  /** Visa 2D-element som inte syns i vyn, tonade, för att hitta dem. */
  showHidden?: boolean;
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
