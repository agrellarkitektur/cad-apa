import type { Element, Id } from '../../core/model';
import type { PlanResult } from '../../repr/plan';
import type { Bounds, Vec2 } from '../../repr/primitives';
import type { PlanView } from '../../view2d/planView';
import type { ModifyContext } from '../modify/ops';
import type { ScreenBox } from '../smartMenu';

/**
 * Var det markerade ligger (0.8.5): i planen, på skärmen för smartmenyn, och
 * som utgångspunkt för Modifiera-valen som gäller hela markeringen.
 */

/** Det markerade i planen, i mm, eller null om det inte syns där. */
export function selectionBounds(plan: PlanResult, ids: readonly Id[]): Bounds | null {
  const want = new Set(ids);
  let b: Bounds | null = null;
  for (const pk of plan.pickables) {
    if (!want.has(pk.id)) continue;
    for (const q of pk.regions.flat(2) as Vec2[]) {
      if (!b) b = { minX: q[0], minY: q[1], maxX: q[0], maxY: q[1] };
      else {
        b.minX = Math.min(b.minX, q[0]);
        b.minY = Math.min(b.minY, q[1]);
        b.maxX = Math.max(b.maxX, q[0]);
        b.maxY = Math.max(b.maxY, q[1]);
      }
    }
  }
  return b;
}

/** En ruta i planen på skärmen, i px från ritytans hörn. */
export function screenBox(view: PlanView, canvas: HTMLElement, b: Bounds): ScreenBox {
  const [x0, y0] = view.camera.toScreen([b.minX, b.minY]);
  const [x1, y1] = view.camera.toScreen([b.maxX, b.maxY]);
  const r = view.svg.getBoundingClientRect();
  const c = canvas.getBoundingClientRect();
  const dx = r.left - c.left;
  const dy = r.top - c.top;
  return { left: Math.min(x0, x1) + dx, top: Math.min(y0, y1) + dy, right: Math.max(x0, x1) + dx, bottom: Math.max(y0, y1) + dy };
}

/**
 * Det markerade som helhet, för valen som gäller hela markeringen (Flytta,
 * Vrid …). Markerades det med ett klick (`click`, i fönstret) utgår valen
 * från klicket, som förut; annars från mitten.
 */
export function bodyContext(view: PlanView, plan: PlanResult, elements: Record<Id, Element>, ids: Id[], click: { x: number; y: number } | null): ModifyContext | null {
  if (!ids.length) return null;
  const r = view.svg.getBoundingClientRect();
  let at: Vec2;
  if (click) {
    const m = view.camera.toModel([click.x - r.left, click.y - r.top]);
    at = [Math.round(m[0]), Math.round(m[1])];
  } else {
    const b = selectionBounds(plan, ids);
    at = b ? [Math.round((b.minX + b.maxX) / 2), Math.round((b.minY + b.maxY) / 2)] : [0, 0];
  }
  const [sx, sy] = view.camera.toScreen(at);
  const wall = ids.find((id) => elements[id]?.type === 'Wall');
  return { kind: 'body', ids, wallId: wall, at, clicked: !!click, clientX: r.left + sx, clientY: r.top + sy };
}
