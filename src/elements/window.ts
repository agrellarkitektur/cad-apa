import type { Pen, Primitive, Vec2 } from '../repr/primitives';
import { FRAME_DEFAULTS, openingZone, type FrameParams } from './opening';
import { litteraTag, showLittera } from './littera';
import type { ElementType } from './registry';
import { FRAME_LESS, HOLE_EXTRA, openingMarks, openingRings, wallFrame, type OpeningParams, type WallParams } from './wall';

export interface WindowParams extends OpeningParams, FrameParams {
  height: number;
  /** Bröstningshöjd från golv, mm. */
  sill: number;
}

/** Bågens bredd och djup i Detalj, mm. */
const SASH = 45;
const SASH_DEPTH = 60;

export const windowType: ElementType<WindowParams> = {
  type: 'Window',
  label: 'Fönster',
  labelPlural: 'Fönster',
  litteraPrefix: 'F',
  drawOrder: 21,
  compares: true,
  hosted: true,
  typeParams: ['width', 'height'],
  defaults: () => ({ at: 1000, width: 1200, height: 1200, sill: 900, ...FRAME_DEFAULTS }),
  pickShape(el, ctx) {
    const host = el.host ? ctx.doc.elements[el.host] : undefined;
    return host ? openingRings(wallFrame(ctx.params<WallParams>(host)), ctx.params<WindowParams>(el)) : [];
  },
  model3d(el, ctx) {
    const host = el.host ? ctx.doc.elements[el.host] : undefined;
    if (!host) return [];
    const p = ctx.params<WindowParams>(el);
    const { f, s1, s2, lo, hi } = openingZone(ctx, host, p);
    // Hålet går från bröstningen och är 10 mm högre än modulmåttet; karmen sitter mitt i.
    const z0 = p.sill + (HOLE_EXTRA + FRAME_LESS) / 2;
    const z1 = p.sill + p.height + (HOLE_EXTRA - FRAME_LESS) / 2;
    const fw = p.frameWidth;
    const mid = (lo + hi) / 2;
    const box = (a: number, b: number, o0: number, o1: number): Vec2[][] => [[f.at(a, o0), f.at(b, o0), f.at(b, o1), f.at(a, o1)]];
    return [
      { id: el.id, rings: box(s1 + fw, s2 - fw, mid - 6, mid + 6), z0: z0 + fw, z1: z1 - fw, material: 'glass' },
      { id: el.id, rings: box(s1, s1 + fw, lo, hi), z0, z1, material: 'frame' },
      { id: el.id, rings: box(s2 - fw, s2, lo, hi), z0, z1, material: 'frame' },
      { id: el.id, rings: box(s1, s2, lo, hi), z0, z1: z0 + fw, material: 'frame' },
      { id: el.id, rings: box(s1, s2, lo, hi), z0: z1 - fw, z1, material: 'frame' },
    ];
  },
  plan(el, ctx) {
    const host = el.host ? ctx.doc.elements[el.host] : undefined;
    if (!host) return [];
    const p = ctx.params<WindowParams>(el);
    if (ctx.actionOf(el) === 'demolished' && ctx.view.hideDemolished) return [];
    const origin = { objectId: el.id, objectType: 'Window', part: 'symbol' };
    const marks = openingMarks(el, host, p, ctx, { infillWhenRemoved: false });
    const z = openingZone(ctx, host, p);
    const { f, s1, s2, h1, h2, lo, hi } = z;
    const line = (a: number, oa: number, b: number, ob: number, pen: Pen): Primitive => ({ kind: 'line', a: f.at(a, oa), b: f.at(b, ob), pen, origin });
    const rect = (a: number, b: number, o0: number, o1: number, part: string, weight = 0.25): Primitive => ({
      kind: 'polyline',
      points: [f.at(a, o0), f.at(b, o0), f.at(b, o1), f.at(a, o1)],
      closed: true,
      pen: { weight },
      origin: { ...origin, part },
    });
    const thin: Pen = { weight: 0.13 };
    // Väggen under fönstret syns nedanför snittet, över hela hålet.
    const below: Primitive[] = [line(h1, -f.half, h2, -f.half, thin), line(h1, f.half, h2, f.half, thin)];
    // Littera på insidan.
    if (showLittera(ctx)) below.push(...litteraTag(ctx, el, f, p.at, z.face === 0 ? 1 : z.face === 1 ? -1 : 1));

    const level = ctx.view.detail ?? 'normal';
    if (level === 'sketch') {
      return [
        ...marks,
        line(h1, -f.half, h1, f.half, { weight: 0.18 }),
        line(h2, -f.half, h2, f.half, { weight: 0.18 }),
        line(h1, -30, h2, -30, { weight: 0.25 }),
        line(h1, 30, h2, 30, { weight: 0.25 }),
        ...below,
      ];
    }

    // Normal: karmarna i snitt på sidorna, nedre karmen sedd uppifrån och glaset i mitten.
    const fw = p.frameWidth;
    const mid = (lo + hi) / 2;
    const prims: Primitive[] = [...marks, rect(s1, s1 + fw, lo, hi, 'karm'), rect(s2 - fw, s2, lo, hi, 'karm')];
    prims.push(line(s1 + fw, lo, s2 - fw, lo, { weight: 0.18 }), line(s1 + fw, hi, s2 - fw, hi, { weight: 0.18 }));
    if (level === 'detail') {
      // Detalj: bågarna innanför karmen, två bågar med mötespost i breda fönster,
      // och glaset som dubbla linjer.
      const b0 = s1 + fw;
      const b1 = s2 - fw;
      const two = b1 - b0 > 1100;
      const c = (b0 + b1) / 2;
      const sashes: [number, number][] = two
        ? [
            [b0, b0 + SASH],
            [c - SASH, c],
            [c, c + SASH],
            [b1 - SASH, b1],
          ]
        : [
            [b0, b0 + SASH],
            [b1 - SASH, b1],
          ];
      for (const [x0, x1] of sashes) prims.push(rect(x0, x1, mid - SASH_DEPTH / 2, mid + SASH_DEPTH / 2, 'båge', 0.18));
      const panes: [number, number][] = two
        ? [
            [b0 + SASH, c - SASH],
            [c + SASH, b1 - SASH],
          ]
        : [[b0 + SASH, b1 - SASH]];
      for (const [x0, x1] of panes) prims.push(line(x0, mid - 6, x1, mid - 6, { weight: 0.13 }), line(x0, mid + 6, x1, mid + 6, { weight: 0.13 }));
    } else {
      prims.push(line(s1 + fw, mid, s2 - fw, mid, { weight: 0.25 }));
    }
    return [...prims, ...below];
  },
};
