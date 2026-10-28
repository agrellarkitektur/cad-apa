import type { Id } from '../../core/model';
import type { Vec2 } from '../../repr/primitives';
import type { AppContext } from '../app/context';
import type { ToolId } from '../app/shell';

/**
 * Smartspöt (0.10.22): ett klick på ett objekt, en kant eller en yta ger ett
 * förslag som passar verktyget man står i. Varje funktion är en post i
 * registret nedan, i en egen fil under `src/ui/wand/`; en ny funktion är en
 * ny fil och en rad i `index.ts`, utan att något annat rörs.
 *
 * En funktion svarar med förslag där markören står (`find`), och utför det
 * man klickade på (`apply`). Flera funktioner kan svara för samma verktyg;
 * Tab växlar mellan förslagen.
 */

/** Var spöet pekar och vad det får använda. */
export interface WandContext {
  app: AppContext;
  /** Markören i modellen, mm. */
  at: Vec2;
  /** Toleransen i mm (10 px vid nuvarande zoom). */
  tol: number;
  /** Shift hålls ner. */
  shift: boolean;
}

/** Det som visas innan man klickar: linjer i modellen och objekt som tonas. */
export interface WandPreview {
  lines?: { points: Vec2[]; closed: boolean }[];
  /** Objekt som markeras i förhandsvisningen (Markera). */
  ids?: Id[];
}

export interface WandHit {
  /** Kort text vid markören, t.ex. "Väggar runt konturen". */
  label: string;
  /** Det som träffades, t.ex. "Bjälklag". */
  what?: string;
  preview: WandPreview;
  /** Utför förslaget. `more`: fler förslag läggs till samtidigt (Shift). */
  apply(more: boolean): void;
}

export interface WandAction {
  id: string;
  /** Verktygen funktionen gäller; Markera är `select`. */
  tools: readonly ToolId[];
  /** Förslagen där markören står, det troligaste först. */
  find(ctx: WandContext): WandHit[];
}

const actions: WandAction[] = [];

/** Lägg till en funktion i smartspöt. */
export function registerWand(a: WandAction): void {
  if (!actions.some((b) => b.id === a.id)) actions.push(a);
}

/** Funktionerna för ett verktyg, i den ordning de lades till. */
export function wandActions(tool: ToolId): WandAction[] {
  return actions.filter((a) => a.tools.includes(tool));
}

/** Om spöet har något att göra i verktyget. */
export function wandSupports(tool: ToolId): boolean {
  return actions.some((a) => a.tools.includes(tool));
}
