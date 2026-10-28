import type { Element } from '../core/model';
import { markerPen } from '../repr/markerPens';
import { effectivePen, withOwnPen } from '../repr/ownPen';
import type { Primitive, Vec2 } from '../repr/primitives';
import type { ElementType } from './registry';
import { closestOnSegment, pointInRings } from '../geometry/vec';
import { centroidOf, roomNumbersFor, spaceOutline, type SpaceParams } from './rooms';
import { fillTemplate, ownProp } from './littera';
import { leaderOf, type TagParams } from './leader';
import { DEFAULT_LABELS } from '../core/graphics';
import { fillPrims, type FillParams } from './drawing2d';
import { slabsOn } from './slab';
import { difference } from '../geometry/boolean';

export type { SpaceParams } from './rooms';

/**
 * Rum. Ett rum som skapats med rumsverktyget minns punkten man klickade i och
 * följer väggarna; arean räknas alltid ur konturen. Rumsetiketten visar namn,
 * nummer och area, och takhöjd om den är angiven, i den ordning stilmallens
 * mall för rumsstämpeln anger (0.8.22).
 */
export const spaceType: ElementType<SpaceParams> = {
  type: 'Space',
  planReads: ['Wall', 'Space', 'Door', 'Shape2D'],
  label: 'Rum',
  labelPlural: 'Rum',
  drawOrder: 40,
  compares: false,
  defaults: () => ({ outline: [], fillAngle: 45, fillSpacing: 2 }),
  model3d(el, ctx) {
    const pts = spaceOutline(ctx, el);
    if (pts.length < 3) return [];
    const ring = pts.map((q) => [q[0], q[1]] as Vec2);
    // Där det finns ett bjälklag (0.9.1) är det golvet; den tunna skivan bara utanför.
    const slabs = slabsOn(ctx);
    const parts = slabs.length ? difference([ring], slabs) : [[ring]];
    return parts.filter((r) => r.length && r[0].length >= 3).map((rings) => ({ id: el.id, rings, z0: -30, z1: 0, material: 'floor' as const }));
  },
  plan(el, ctx) {
    const pts = spaceOutline(ctx, el);
    if (pts.length < 3) return [];
    const p = ctx.params<SpaceParams>(el);
    // Fyllningen (0.8.25) bakom väggarna; den räknas inte när man klickar.
    const fill: Primitive[] = p.fill && !ctx.view.hide?.includes('fill') ? fillPrims([pts], p as FillParams, { objectId: el.id, objectType: 'Space' }, true, ctx.style, ctx.scale).map((q) => ({ ...q, noPick: true })) : [];
    // Konturen (0.8.34): stilmallens penna, typens eller rummets egen; under väggarna som fyllningen.
    const own = effectivePen(ctx.doc, el as unknown as Element);
    const pen = own ? withOwnPen(markerPen(ctx.style, 'roomOutline'), own, ctx.style) : markerPen(ctx.style, 'roomOutline');
    if (pen.weight > 0) fill.push({ kind: 'polyline', points: pts, closed: true, pen, under: true, noPick: true, origin: { objectId: el.id, objectType: 'Space', part: 'kontur' } });
    const c = centroidOf(pts);
    const base = { objectId: el.id, objectType: 'Space', part: 'rumstext' };
    const { heights, align } = ctx.style.labels;
    const line = ctx.scale * heights.roomInfo * 1.7; // radavstånd på papper, mm
    // Raderna efter stilmallens mall (0.8.22): namn, nummer, area och takhöjd i vald ordning.
    const value = (name: string): string => {
      switch (name.toLowerCase()) {
        case 'namn':
          return (el.name ?? 'Rum').toLocaleUpperCase('sv-SE');
        case 'nummer':
          return roomNumbersFor(ctx).get(el.id) ?? '';
        case 'area':
          return formatArea(areaOf(pts));
        case 'takhöjd':
        case 'th':
          return p.ceilingHeight ? p.ceilingHeight.toLocaleString('sv-SE') : '';
      }
      return ownProp([el.props], name);
    };
    const shown = fillTemplate(ctx.style.labels.room ?? DEFAULT_LABELS.room, value).map((r) =>
      r.fields.includes('namn')
        ? { text: r.text, height: heights.roomName, bold: true }
        : { text: r.text, height: heights.roomInfo, muted: r.fields.length > 0 && r.fields.every((f) => f === 'takhöjd' || f === 'th') },
    );
    if (!shown.length) return fill;
    // Stämpeln står i mitten, eller där den dragits (0.8.17).
    const at: Vec2 = p.labelAt ?? c;
    const top = at[1] + ((shown.length - 1) * line) / 2;
    // Vänsterjusterat: raderna börjar i samma punkt, blocket hålls kring mitten.
    const widest = Math.max(...shown.map((r) => r.text.length * r.height * 0.62)) * ctx.scale;
    const x = align === 'left' ? at[0] - widest / 2 : at[0];
    const outside = !!p.labelAt && !pointInRings(at, [pts]);
    const y0 = top - (shown.length - 1) * line - (heights.roomInfo * ctx.scale) / 2;
    const y1 = top + (heights.roomName * ctx.scale) / 2;
    const box = { center: [at[0], (y0 + y1) / 2] as Vec2, halfW: widest / 2, halfH: (y1 - y0) / 2, along: [1, 0] as Vec2, up: [0, 1] as Vec2 };
    // Ledaren (0.10.20.1) när stämpeln står utanför rummet: till närmaste
    // punkt på konturen, eller dit punkten dragits (`tag.to`).
    const tag = (p as { tag?: TagParams }).tag ?? {};
    const edge = outside ? nearestOnOutline(pts, at) : null;
    const target: Vec2 | null = edge && [edge[0] + (tag.to?.[0] ?? 0), edge[1] + (tag.to?.[1] ?? 0)];
    const style = ctx.style.labels.leaders.Space;
    const geo = target ? leaderOf(box, [{ at: target }], { side: tag.side, end: tag.end ?? style.end, stub: tag.stub ?? style.stub, scale: ctx.scale, pen: markerPen(ctx.style, 'roomLeader') }) : null;
    const origin = { ...base, tag: { param: 'labelAt' as const, text: at, target, stubStart: geo?.start ?? null, stubEnd: geo?.stubEnd ?? null, dir: geo?.dir ?? null } };
    const out = [...fill, ...shown.map(
      (r, i): Primitive => ({
        kind: 'text',
        at: [x, top - i * line - (r.height * ctx.scale) / 3],
        text: r.text,
        height: r.height,
        bold: r.bold,
        align: align === 'left' ? 'start' : 'middle',
        pen: { weight: 0.18, color: r.muted ? 'muted' : 'ink' },
        origin,
      }),
    )];
    for (const q of geo?.prims ?? []) out.push({ ...q, origin });
    return out;
  },
};

/** Närmaste punkt på rummets kontur från stämpeln. */
function nearestOnOutline(pts: readonly Vec2[], at: Vec2): Vec2 {
  let edge: Vec2 = pts[0];
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const q = closestOnSegment(at, pts[i], pts[(i + 1) % pts.length]).point;
    const d = Math.hypot(q[0] - at[0], q[1] - at[1]);
    if (d < best) {
      best = d;
      edge = q;
    }
  }
  return edge;
}

/** Area i m² ur en kontur i mm (skosnöresformeln). */
export function areaOf(pts: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2 / 1e6;
}

// Ett talformat att återanvända: toLocaleString skapar ett nytt för varje anrop.
const AREA = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatArea(m2: number): string {
  return `${AREA.format(m2)} m²`;
}
