import type { Vec2 } from '../../repr/primitives';
import type { CommandDef } from '../commandRegistry';
import { OPS } from '../modify/ops';
import { ModifyTool } from '../modify/tool';
import { parsePoint, resolvePoint, type PointTaker } from '../pointInput';
import type { AppContext } from './context';

/**
 * Smartshells läge (0.8.20–0.8.21; ur commandLine.ts i 0.8.23): vilket
 * verktyg som tar emot skrivna punkter, om ett kommando är igång, och vad
 * det skrivna blir för punkt, vinkel eller värde.
 */

/** Verktyget som tar emot skrivna punkter just nu, eller null. `pending` är ett kommando som väntar på en markering. */
export function pointTaker(app: AppContext, pending: CommandDef | null): PointTaker | null {
  if (app.aligning || app.zoomingBox || app.underlays.busy() || pending) return null;
  if (app.ui.mode === '3d') return null;
  const m = app.modifier;
  if (m.busy) {
    if (m.drawingWall) return app.wallTool;
    const t = m.runningTool;
    return t instanceof ModifyTool && t.takesPoints ? t : null;
  }
  switch (app.ui.tool) {
    case 'wall':
      return app.wallTool;
    case 'draw2d':
      return app.draw2dTool;
    case 'dimension':
      return app.dimensionTool;
    case 'roof':
      return app.roofTool;
    case 'slab':
      return app.slabTool;
    case 'ground':
      return app.groundTool;
    case 'stair':
      return app.stairTool;
    case 'railing':
      return app.railingTool;
    case 'section':
      return app.sectionTool;
    case 'elevation':
      return app.elevationTool;
    default:
      return null;
  }
}

/** Om ett kommando är igång: något ritas, Modifiera pågår eller ett kommando väntar på en markering. Enter och mellanslag hör då till det. */
export function commandBusy(app: AppContext, pending: CommandDef | null): boolean {
  if (pending || app.modifier.busy || app.aligning || app.zoomingBox || app.underlays.busy()) return true;
  switch (app.ui.tool) {
    case 'wall':
      return app.wallTool.drawing;
    case 'dimension':
      return app.dimensionTool.count > 0;
    case 'draw2d':
      return app.draw2dTool.count > 0;
    case 'measure':
      return app.measureTool.measurement().points > 0;
    case 'roof':
      return app.roofTool.started;
    case 'slab':
      return app.slabTool.started;
    case 'ground':
      return app.groundTool.started;
    case 'stair':
      return app.stairTool.started;
    case 'railing':
      return app.railingTool.started;
    case 'section':
      return app.sectionTool.step > 0;
    case 'elevation':
      return app.elevationTool.step > 0;
    default:
      return false;
  }
}

/** Ett Modifiera-val med ett värde (radie, vinkel …): ett ensamt tal är värdet, inte ett avstånd. */
export function valueOp(app: AppContext): boolean {
  const a = app.modifier.active;
  return !!a && !!OPS[a].value && app.modifier.runningTool instanceof ModifyTool;
}

/** Modifiera väntar på en punkt (baspunkten) och inte på värdet: siffrorna ska då till raden. */
export function wantsPoint(app: AppContext): boolean {
  const t = app.modifier.runningTool;
  return t instanceof ModifyTool && t.takesPoints && t.prompt() !== null;
}

/** Det skrivna som punkt, låst vinkel (`<45`) eller värde till Modifiera; null om det inte går att läsa. */
export function pointFor(app: AppContext, t: PointTaker | null, text: string): { p: Vec2 } | { error: string } | { angle: number } | { value: number } | null {
  const e = parsePoint(text);
  if (!t || !e) return null;
  if (e.kind === 'angle') return { angle: e.deg };
  if (e.kind === 'dist' && valueOp(app)) return { value: e.len };
  return resolvePoint(e, t.lastPoint(), t.cursorPoint(), t.lockAngle);
}
