import { detailOf } from '../core/states';
import type { Pen, Primitive } from '../repr/primitives';
import { objectPen } from '../repr/objectPens';
import { FRAME_DEFAULTS, openingLift, openingZone, uncutOpening, type FrameParams } from './opening';
import { litteraTag, showLittera } from './littera';
import { windowModel } from './openingModel';
import { liftShape } from '../repr/solids';
import type { ElementType } from './registry';
import { FRAME_LESS, HOLE_EXTRA, openingMarks, openingRings, leanedShape, openingZoneInPlan, planWallParams, wallFrame, type OpeningParams, type WallParams } from './wall';

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
    return host ? openingRings(wallFrame(planWallParams(ctx, host)), ctx.params<WindowParams>(el)) : [];
  },
  model3d(el, ctx) {
    const host = el.host ? ctx.doc.elements[el.host] : undefined;
    if (!host) return [];
    const p = ctx.params<WindowParams>(el);
    const z = openingZone(ctx, host, p);
    // Bröstningen räknas från våningens golv, eller från väggens fot (0.10.14).
    const wp = ctx.params<WallParams>(host);
    const lift = openingLift(wp, p);
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
    ).map((s) => leanedShape(liftShape(s, lift), wp));
  },
  plan(el, ctx) {
    const host = el.host ? ctx.doc.elements[el.host] : undefined;
    if (!host) return [];
    const p = ctx.params<WindowParams>(el);
    if (ctx.actionOf(el) === 'demolished' && ctx.view.hideDemolished) return [];
    // Ett fönster över eller under planens snitt (0.10.16): väggen går obruten förbi.
    const zone = openingZoneInPlan(ctx, ctx.params<WallParams>(host), p);
    if (zone !== 'cut') {
      const face = openingZone(ctx, host, p, true).face;
      return [...uncutOpening(ctx, el, host, p, zone, true), ...(showLittera(ctx, 'Window') ? litteraTag(ctx, el, wallFrame(planWallParams(ctx, host)), p.at, face === 0 ? 1 : face === 1 ? -1 : 1) : [])];
    }
    const origin = { objectId: el.id, objectType: 'Window', part: 'glas' };
    // Pennorna för karmen, bågarna och glaset ur stilboken (0.10.37).
    const pens = { cut: objectPen(ctx.style, 'windowFrameCut'), frame: objectPen(ctx.style, 'windowFrameContour'), sash: objectPen(ctx.style, 'windowSash'), glass: objectPen(ctx.style, 'windowGlass') };
    const marks = openingMarks(el, host, p, ctx, { infillWhenRemoved: false });
    const z = openingZone(ctx, host, p, true);
    const { f, s1, s2, h1, h2, lo, hi } = z;
    const line = (a: number, oa: number, b: number, ob: number, pen: Pen, part = origin.part): Primitive => ({ kind: 'line', a: f.at(a, oa), b: f.at(b, ob), pen, origin: { ...origin, part } });
    const rect = (a: number, b: number, o0: number, o1: number, part: string, pen: Pen): Primitive => ({
      kind: 'polyline',
      points: [f.at(a, o0), f.at(b, o0), f.at(b, o1), f.at(a, o1)],
      closed: true,
      pen,
      origin: { ...origin, part },
    });
    // Väggen under fönstret syns nedanför snittet, över hela hålet: väggens konturlinje (0.10.37).
    const thin: Pen = objectPen(ctx.style, 'wallContour');
    // Linjerna hör till väggen, så att väggens egen penna gäller dem, inte fönstrets.
    const wallOrigin = { objectId: host.id, objectType: 'Wall', part: 'under' };
    const below: Primitive[] = [-f.half, f.half].map((o): Primitive => ({ kind: 'line', a: f.at(h1, o), b: f.at(h2, o), pen: thin, origin: wallOrigin }));
    // Littera på insidan.
    if (showLittera(ctx, 'Window')) below.push(...litteraTag(ctx, el, f, p.at, z.face === 0 ? 1 : z.face === 1 ? -1 : 1));

    const level = ctx.view.detail ?? 'normal';
    if (level === 'sketch') {
      return [
        ...marks,
        line(h1, -f.half, h1, f.half, pens.cut, 'sida'),
        line(h2, -f.half, h2, f.half, pens.cut, 'sida'),
        line(h1, -30, h2, -30, pens.glass),
        line(h1, 30, h2, 30, pens.glass),
        ...below,
      ];
    }

    // Normal: karmarna i snitt på sidorna, nedre karmen sedd uppifrån och glaset i mitten.
    const fw = p.frameWidth;
    const mid = (lo + hi) / 2;
    const prims: Primitive[] = [...marks, rect(s1, s1 + fw, lo, hi, 'karm', pens.cut), rect(s2 - fw, s2, lo, hi, 'karm', pens.cut)];
    prims.push(line(s1 + fw, lo, s2 - fw, lo, pens.frame, 'karm'), line(s1 + fw, hi, s2 - fw, hi, pens.frame, 'karm'));
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
      for (const [x0, x1] of sashes) prims.push(rect(x0, x1, mid - SASH_DEPTH / 2, mid + SASH_DEPTH / 2, 'båge', pens.sash));
      const panes: [number, number][] = two
        ? [
            [b0 + SASH, c - SASH],
            [c + SASH, b1 - SASH],
          ]
        : [[b0 + SASH, b1 - SASH]];
      for (const [x0, x1] of panes) prims.push(line(x0, mid - 6, x1, mid - 6, pens.glass), line(x0, mid + 6, x1, mid + 6, pens.glass));
    } else {
      prims.push(line(s1 + fw, mid, s2 - fw, mid, pens.glass));
    }
    return [...prims, ...below];
  },
};
