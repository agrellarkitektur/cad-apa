import { detailOf } from '../core/states';
import type { Pen, Primitive } from '../repr/primitives';
import { openingPens } from '../repr/openingPens';
import { FRAME_DEFAULTS, openingLift, openingZone, type FrameParams } from './opening';
import { litteraTag, showLittera } from './littera';
import { windowModel } from './openingModel';
import { liftShape } from '../repr/solids';
import type { ElementType } from './registry';
import { FRAME_LESS, HOLE_EXTRA, openingMarks, openingRings, wallFrame, type OpeningParams, type WallParams } from './wall';

export interface WindowParams extends OpeningParams, FrameParams {
  height: number;
  /** Bröstningshöjd från våningens golv, mm; med `sillFromWall` från väggens fot (0.10.14). */
  sill: number;
  sillFromWall?: boolean;
}

/** Bågens bredd och djup i Detalj, mm. */
const SASH = 45;
const SASH_DEPTH = 60;

export const windowType: ElementType<WindowParams> = {
  type: 'Window',
  planReads: ['Wall'],
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
    const z = openingZone(ctx, host, p);
    // Bröstningen räknas från våningens golv, eller från väggens fot (0.10.14).
    const lift = openingLift(ctx.params<WallParams>(host), p);
    // Hålet går från bröstningen och är 10 mm högre än modulmåttet; karmen sitter mitt i.
    return windowModel(
      el.id,
      {
        f: z.f,
        s1: z.s1,
        s2: z.s2,
        h1: z.h1,
        h2: z.h2,
        lo: z.lo,
        hi: z.hi,
        z0: p.sill + (HOLE_EXTRA + FRAME_LESS) / 2,
        z1: p.sill + p.height + (HOLE_EXTRA - FRAME_LESS) / 2,
        holeBottom: p.sill,
        holeTop: p.sill + p.height + HOLE_EXTRA,
        frameWidth: p.frameWidth,
        outside: z.insetFrom === 'utsidan' ? (z.face as 1 | -1) : 0,
      },
      detailOf(ctx.view, 'model'),
    ).map((s) => liftShape(s, lift));
  },
  plan(el, ctx) {
    const host = el.host ? ctx.doc.elements[el.host] : undefined;
    if (!host) return [];
    const p = ctx.params<WindowParams>(el);
    if (ctx.actionOf(el) === 'demolished' && ctx.view.hideDemolished) return [];
    const origin = { objectId: el.id, objectType: 'Window', part: 'glas' };
    // Pennorna för karmen och bågarna ur stilmallen (0.8.33).
    const pens = openingPens(ctx.style);
    const marks = openingMarks(el, host, p, ctx, { infillWhenRemoved: false });
    const z = openingZone(ctx, host, p);
    const { f, s1, s2, h1, h2, lo, hi } = z;
    const line = (a: number, oa: number, b: number, ob: number, pen: Pen, part = origin.part): Primitive => ({ kind: 'line', a: f.at(a, oa), b: f.at(b, ob), pen, origin: { ...origin, part } });
    const rect = (a: number, b: number, o0: number, o1: number, part: string, pen: Pen): Primitive => ({
      kind: 'polyline',
      points: [f.at(a, o0), f.at(b, o0), f.at(b, o1), f.at(a, o1)],
      closed: true,
      pen,
      origin: { ...origin, part },
    });
    const thin: Pen = { weight: 0.13 };
    // Väggen under fönstret syns nedanför snittet, över hela hålet.
    const below: Primitive[] = [line(h1, -f.half, h2, -f.half, thin, 'under'), line(h1, f.half, h2, f.half, thin, 'under')];
    // Littera på insidan.
    if (showLittera(ctx, 'Window')) below.push(...litteraTag(ctx, el, f, p.at, z.face === 0 ? 1 : z.face === 1 ? -1 : 1));

    const level = ctx.view.detail ?? 'normal';
    if (level === 'sketch') {
      return [
        ...marks,
        line(h1, -f.half, h1, f.half, pens.cut, 'sida'),
        line(h2, -f.half, h2, f.half, pens.cut, 'sida'),
        line(h1, -30, h2, -30, pens.view),
        line(h1, 30, h2, 30, pens.view),
        ...below,
      ];
    }

    // Normal: karmarna i snitt på sidorna, nedre karmen sedd uppifrån och glaset i mitten.
    const fw = p.frameWidth;
    const mid = (lo + hi) / 2;
    const prims: Primitive[] = [...marks, rect(s1, s1 + fw, lo, hi, 'karm', pens.cut), rect(s2 - fw, s2, lo, hi, 'karm', pens.cut)];
    prims.push(line(s1 + fw, lo, s2 - fw, lo, pens.view, 'karm'), line(s1 + fw, hi, s2 - fw, hi, pens.view, 'karm'));
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
      for (const [x0, x1] of sashes) prims.push(rect(x0, x1, mid - SASH_DEPTH / 2, mid + SASH_DEPTH / 2, 'båge', pens.view));
      const panes: [number, number][] = two
        ? [
            [b0 + SASH, c - SASH],
            [c + SASH, b1 - SASH],
          ]
        : [[b0 + SASH, b1 - SASH]];
      for (const [x0, x1] of panes) prims.push(line(x0, mid - 6, x1, mid - 6, pens.view), line(x0, mid + 6, x1, mid + 6, pens.view));
    } else {
      prims.push(line(s1 + fw, mid, s2 - fw, mid, pens.view));
    }
    return [...prims, ...below];
  },
};
