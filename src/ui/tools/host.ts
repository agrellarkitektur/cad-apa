import type { Id } from '../../core/model';
import type { DocStore } from '../../core/store';
import type { PlanResult } from '../../repr/plan';
import type { PlanView } from '../../view2d/planView';
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
}

/** Skärmpixlar till mm vid nuvarande zoom. */
export function pxToMm(host: ToolHost, px: number): number {
  return px / host.view.camera.scale;
}
