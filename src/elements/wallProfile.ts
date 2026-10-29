import type { Element } from '../core/model';
import { groundAt, terrainOf } from '../core/site';
import { crispHeight, crispShapes } from '../repr/crispGround';
import { finishedTerrain, type GroundParams } from './groundGeometry';
import { flatPoints } from './groundLines';
import { computeProfile, wallThickness, type WallProfile } from './groundWall';
import type { PlanContext } from './registry';

/**
 * Stödmurens profil (0.10.9): punkterna längs mittlinjen med krön och fot,
 * mot den färdiga marken med de skarpa kanterna (0.10.28.3), så att krönet
 * längs en ramp följer rampens kant och inte rutnätet mellan noderna. Null
 * utan markmodell eller med för kort linje.
 */
export function wallProfile(ctx: PlanContext, el: Element<any>): WallProfile | null {
  return ctx.memo(`wall-profile:${el.id}`, () => {
    const p = ctx.params<GroundParams>(el);
    const ref = flatPoints(p.line, p.bulges);
    if (ref.length < 2) return null;
    const f = finishedTerrain(ctx);
    if (f) {
      const h = crispHeight(crispShapes(ctx, f), f.terrain);
      return computeProfile(ref, wallThickness(ctx, p), p, (x, y) => h([x, y]));
    }
    const t = terrainOf(ctx.doc);
    if (!t) return null;
    return computeProfile(ref, wallThickness(ctx, p), p, (x, y) => groundAt(t, x, y));
  });
}

/** Stödmurens högsta krön och lägsta fot (mm från ±0). Null utan markmodell. */
export function wallCrest(ctx: PlanContext, el: Element<any>): { top: number; bottom: number } | null {
  const prof = wallProfile(ctx, el);
  return prof ? { top: prof.top, bottom: prof.bottom } : null;
}
