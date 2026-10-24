import { markerPen } from '../repr/markerPens';
import type { Pen, Primitive, Vec2 } from '../repr/primitives';
import type { ElementType } from './registry';
import { closestOnSegment, pointInRings } from '../geometry/vec';
import { centroidOf, roomNumbersFor, spaceOutline, type SpaceParams } from './rooms';
import { fillTemplate, ownProp } from './littera';
import { DEFAULT_LABELS } from '../core/graphics';
import { fillPrims, type FillParams } from './drawing2d';

export type { SpaceParams } from './rooms';

/**
 * Rum. Ett rum som skapats med rumsverktyget minns punkten man klickade i och
 * följer väggarna; arean räknas alltid ur konturen. Rumsetiketten visar namn,
 * nummer och area, och takhöjd om den är angiven, i den ordning stilmallens
 * mall för rumsstämpeln anger (0.8.22).
 */
export const spaceType: ElementType<SpaceParams> = {
  type: 'Space',
  planReads: ['Wall', 'Space', 'Door'],
  label: 'Rum',
  labelPlural: 'Rum',
  drawOrder: 40,
  compares: false,
  defaults: () => ({ outline: [], fillAngle: 45, fillSpacing: 2 }),
  model3d(el, ctx) {
    const pts = spaceOutline(ctx, el);
    if (pts.length < 3) return [];
    return [{ id: el.id, rings: [pts.map((q) => [q[0], q[1]] as Vec2)], z0: -30, z1: 0, material: 'floor' }];
  },
  plan(el, ctx) {
    const pts = spaceOutline(ctx, el);
    if (pts.length < 3) return [];
    const p = ctx.params<SpaceParams>(el);
    // Fyllningen (0.8.25) bakom väggarna; den räknas inte när man klickar.
    const fill = p.fill && !ctx.view.hide?.includes('fill') ? fillPrims([pts], p as FillParams, { objectId: el.id, objectType: 'Space' }, true).map((q) => ({ ...q, noPick: true })) : [];
    const c = centroidOf(pts);
    const origin = { objectId: el.id, objectType: 'Space', part: 'rumstext' };
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
    if (p.labelAt && !pointInRings(at, [pts])) {
      const box: [number, number, number, number] = [
        at[0] - widest / 2,
        top - (shown.length - 1) * line - (heights.roomInfo * ctx.scale) / 2,
        at[0] + widest / 2,
        top + (heights.roomName * ctx.scale) / 2,
      ];
      out.push(...leader(pts, at, box, ctx.scale, origin, markerPen(ctx.style, 'roomLeader')));
    }
    return out;
  },
};

/**
 * Pilen från en rumsstämpel utanför rummet (0.8.17): från stämpelns kant
 * till närmaste punkt på rummets kontur och 2 mm (på papper) in i rummet,
 * med en öppen pilspets.
 */
function leader(pts: readonly Vec2[], at: Vec2, box: [number, number, number, number], scale: number, origin: Primitive['origin'], pen: Pen): Primitive[] {
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
  if (best < 1e-6) return [];
  const dir: Vec2 = [(edge[0] - at[0]) / best, (edge[1] - at[1]) / best];
  const tip: Vec2 = [edge[0] + dir[0] * 2 * scale, edge[1] + dir[1] * 2 * scale];
  // Pilen börjar där linjen mot spetsen lämnar stämpelns ruta.
  const exit = (lo: number, hi: number, a: number, d: number) => (d > 0 ? (hi - a) / d : d < 0 ? (lo - a) / d : Infinity);
  const t = Math.min(exit(box[0], box[2], at[0], dir[0]), exit(box[1], box[3], at[1], dir[1])) + 1 * scale;
  const total = best + 2 * scale;
  if (t >= total - 2 * scale) return [];
  const start: Vec2 = [at[0] + dir[0] * t, at[1] + dir[1] * t];
  const size = 2.5 * scale;
  const n: Vec2 = [-dir[1], dir[0]];
  const base: Vec2 = [tip[0] - dir[0] * size, tip[1] - dir[1] * size];
  return [
    { kind: 'line', a: start, b: tip, pen, origin },
    ...[1, -1].map((k): Primitive => ({ kind: 'line', a: tip, b: [base[0] + n[0] * size * 0.35 * k, base[1] + n[1] * size * 0.35 * k], pen, origin })),
  ];
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
