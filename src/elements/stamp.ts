import { isStamp, modelViewId, type Id, type ProjectDoc } from '../core/model';
import { defaultState } from '../core/states';
import { buildPlan } from '../repr/plan';
import { boundsOf, type Bounds, type Primitive, type Vec2 } from '../repr/primitives';
import type { ElementType, PlanContext } from './registry';

/**
 * En stämpel på ett blad (0.8.12, format 11): det som är ritat i en stämpel
 * (ett arbetsblad med `stamp`, ritat i mm i 1:1 som ett mallblad men utan
 * papper), lagt på bladet med stämpelns nollpunkt i `pos`. Smarttexten fylls
 * i från bladet. Ändras stämpeln ändras den på alla blad den ligger på.
 */
export interface StampParams {
  /** Var stämpelns nollpunkt hamnar, mm på papperet. */
  pos: [number, number];
  /** Stämpeln (arbetsbladets id). */
  stamp: Id;
}

/** Det som är ritat i en stämpel, kring dess nollpunkt, med smarttexten ifylld. */
export function stampPrims(doc: ProjectDoc, stamp: Id, smart?: Readonly<Record<string, string>>): Primitive[] {
  return buildPlan(doc, doc.storeys[0].id, { state: defaultState(doc), viewId: modelViewId(stamp), place: stamp, scale: 1, ...(smart ? { smart } : {}) }).prims;
}

function moved(prims: readonly Primitive[], d: Vec2): Primitive[] {
  const t = (p: Vec2): Vec2 => [p[0] + d[0], p[1] + d[1]];
  return prims.map((p): Primitive => {
    switch (p.kind) {
      case 'line':
        return { ...p, a: t(p.a), b: t(p.b) };
      case 'polyline':
        return { ...p, points: p.points.map(t) };
      case 'region':
        return { ...p, rings: p.rings.map((r) => r.map(t)) };
      case 'arc':
        return { ...p, center: t(p.center) };
      case 'text':
        return { ...p, at: t(p.at) };
      case 'image':
        return { ...p, corner: t(p.corner) };
    }
  });
}

/** En tom eller borttagen stämpel: en liten streckad ruta, så att den går att hitta och ta bort. */
function placeholder(pos: Vec2, text: string): Primitive[] {
  const [x, y] = pos;
  const pen = { weight: 0.18, color: 'muted' as const, dash: [1, 1] };
  return [
    { kind: 'polyline', points: [[x, y], [x + 40, y], [x + 40, y + 10], [x, y + 10]], closed: true, pen, origin: { part: 'skärm' } },
    { kind: 'text', at: [x + 2, y + 3.5], text, height: 2.5, pen: { weight: 0.18, color: 'muted' }, origin: { part: 'skärm' } },
  ];
}

function drawn(p: StampParams, ctx: PlanContext): Primitive[] {
  const w = ctx.doc.worksheets.find((x) => x.id === p.stamp);
  if (!isStamp(w)) return placeholder(p.pos, 'Stämpeln finns inte längre');
  // En stämpel i en stämpel ritas inte, så att en stämpel inte kan rita sig själv.
  if (ctx.doc.worksheets.some((x) => x.id === ctx.view.place && isStamp(x))) return placeholder(p.pos, `Stämpel: ${w.name}`);
  const prims = stampPrims(ctx.doc, w.id, ctx.view.smart);
  return prims.length ? moved(prims, p.pos) : placeholder(p.pos, `${w.name} (tom)`);
}

/** Stämpelns yta på papperet. */
export function stampBounds(p: StampParams, ctx: PlanContext): Bounds | null {
  return boundsOf(drawn(p, ctx));
}

export const stampType: ElementType<StampParams> = {
  type: 'Stamp',
  label: 'Stämpel',
  labelPlural: 'Stämplar',
  drawOrder: 91,
  compares: false,
  // Läser det som är ritat i stämpeln: räknas om när något element ändrats.
  defaults: () => ({ pos: [0, 0], stamp: '' }),
  plan(el, ctx) {
    const p = ctx.params<StampParams>(el);
    return drawn(p, ctx).map((q) => ({ ...q, origin: { ...q.origin, objectId: el.id, objectType: 'Stamp' } }) as Primitive);
  },
  pickShape(el, ctx) {
    const b = stampBounds(ctx.params<StampParams>(el), ctx);
    if (!b) return [];
    return [[[[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY]]]];
  },
};
