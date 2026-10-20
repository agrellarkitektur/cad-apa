import type { Id } from '../../core/model';
import type { DocStore } from '../../core/store';
import type { PlanResult } from '../../repr/plan';
import type { PlanView, ViewPointer } from '../../view2d/planView';
import type { Vec2 } from '../../repr/primitives';
import type { Selection } from '../selection';
import type { SnapSegment } from './snap';

/** Det verktygen får tillgång till i appen. */
export interface ToolHost {
  store: DocStore;
  selection: Selection;
  view: PlanView;
  /** Senast ritade plan, med det som går att klicka på. */
  plan(): PlanResult;
  /**
   * Det som visas går bara att markera, inte ändra: fasader och sektioner,
   * där koordinaterna inte är planens.
   */
  readOnly?(): boolean;
  /** Om ett objekt går att ändra i en vy som annars bara går att markera (det som är ritat i fasaden eller sektionen). */
  canEdit?(id: Id): boolean;
  /**
   * Ytan som ritas på (0.8): fasaden, sektionen eller arbetsbladet som är
   * öppet, eller undefined för våningens plan. Nya mått, texter och
   * 2D-element hamnar där.
   */
  space?(): Id | undefined;
  /** Tillståndet som visas och ritas i. */
  activeState(): Id;
  storey(): Id;
  /** Referenslinjer för de väggar som syns, för snäpp. */
  snapSegments(): SnapSegment[];
  hint(text: string, ms?: number): void;
  /** En väggände har dragits; visa rutan där längd och vinkel kan skrivas in. */
  wallEndMoved?(wallId: Id, end: 'start' | 'end', originalLength: number, companions: Id[]): void;
  /** Objekt har flyttats; visa rutan där avstånd och vinkel kan skrivas in. */
  elementsMoved?(ids: Id[], applied: Vec2, anchor: Vec2): void;
  /**
   * Dubbelklick på ett objekt: redigera dess text direkt i ritningen om det
   * har en. Svarar true om redigeringen startade.
   */
  editText?(id: Id, at: Vec2): boolean;
  /**
   * Klick på något som redan är markerat (utan att dra): visa Modifiera.
   * Svarar true om Modifiera tog hand om klicket (smartmenyn, 0.8.5).
   */
  modify?(p: ViewPointer, hitId: Id | null): boolean;
}

/** Skärmpixlar till mm vid nuvarande zoom. */
export function pxToMm(host: ToolHost, px: number): number {
  return px / host.view.camera.scale;
}
