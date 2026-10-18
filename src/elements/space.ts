import type { Primitive, Vec2 } from '../repr/primitives';
import type { ElementType } from './registry';
import { centroidOf, roomNumbersFor, spaceOutline, type SpaceParams } from './rooms';

export type { SpaceParams } from './rooms';

/**
 * Rum. Ett rum som skapats med rumsverktyget minns punkten man klickade i och
 * följer väggarna; arean räknas alltid ur konturen. Rumsetiketten visar namn,
 * nummer och area, och takhöjd om den är angiven.
 */
export const spaceType: ElementType<SpaceParams> = {
  type: 'Space',
  label: 'Rum',
  labelPlural: 'Rum',
  drawOrder: 40,
  compares: false,
  defaults: () => ({ outline: [] }),
  model3d(el, ctx) {
    const pts = spaceOutline(ctx, el);
    if (pts.length < 3) return [];
    return [{ id: el.id, rings: [pts.map((q) => [q[0], q[1]] as Vec2)], z0: -30, z1: 0, material: 'floor' }];
  },
  plan(el, ctx) {
    const pts = spaceOutline(ctx, el);
    if (pts.length < 3) return [];
    const p = ctx.params<SpaceParams>(el);
    const c = centroidOf(pts);
    const origin = { objectId: el.id, objectType: 'Space', part: 'rumstext' };
    const { heights, align } = ctx.style.labels;
    const line = ctx.scale * heights.roomInfo * 1.7; // radavstånd på papper, mm
    const rows: { text: string; height: number; bold?: boolean; muted?: boolean }[] = [
      { text: (el.name ?? 'Rum').toLocaleUpperCase('sv-SE'), height: heights.roomName, bold: true },
      { text: roomNumbersFor(ctx).get(el.id) ?? '', height: heights.roomInfo },
      { text: formatArea(areaOf(pts)), height: heights.roomInfo },
    ];
    if (p.ceilingHeight) rows.push({ text: `TH ${p.ceilingHeight.toLocaleString('sv-SE')}`, height: heights.roomInfo, muted: true });
    const shown = rows.filter((r) => r.text);
    const top = c[1] + ((shown.length - 1) * line) / 2;
    // Vänsterjusterat: raderna börjar i samma punkt, blocket hålls kring mitten.
    const widest = Math.max(...shown.map((r) => r.text.length * r.height * 0.62)) * ctx.scale;
    const x = align === 'left' ? c[0] - widest / 2 : c[0];
    return shown.map(
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
    );
  },
};

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

export function formatArea(m2: number): string {
  return `${m2.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²`;
}
