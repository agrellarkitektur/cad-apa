import { detailOf } from '../core/states';
import { add, scale, sub } from '../geometry/vec';
import { openingPens } from '../repr/openingPens';
import type { Primitive, Vec2 } from '../repr/primitives';
import { FRAME_DEFAULTS, openingZone, type FrameParams } from './opening';
import { litteraTag, showLittera } from './littera';
import type { ElementType } from './registry';
import { FRAME_LESS, HOLE_EXTRA, openingMarks, openingRings, wallFrame, type OpeningParams, type WallParams } from './wall';
import { doorModel } from './openingModel';

export interface DoorParams extends OpeningParams, FrameParams {
  height: number;
  /** Slagsida: 1 = vänster om väggens riktning, -1 = höger. */
  swing: 1 | -1;
  /** Vilken sida av öppningen gångjärnen sitter, sett längs väggens riktning. */
  hinge: 'start' | 'end';
  /** Glasad dörr: ritas med en glasningslinje i karmens mitt. */
  glazed: boolean;
}

/** Dörrbladets tjocklek, mm. */
const LEAF = 40;
/** Falsens bredd i karmen, där bladet ligger an, mm. */
const REBATE = 12;

export const doorType: ElementType<DoorParams> = {
  type: 'Door',
  planReads: ['Wall', 'Door', 'Space'],
  label: 'Dörr',
  labelPlural: 'Dörrar',
  litteraPrefix: 'D',
  drawOrder: 20,
  compares: true,
  hosted: true,
  typeParams: ['width', 'height'],
  defaults: () => ({ at: 1000, width: 900, height: 2100, swing: 1, hinge: 'start', glazed: false, ...FRAME_DEFAULTS }),
  pickShape(el, ctx) {
    const host = el.host ? ctx.doc.elements[el.host] : undefined;
    return host ? openingRings(wallFrame(ctx.params<WallParams>(host)), ctx.params<DoorParams>(el)) : [];
  },
  model3d(el, ctx) {
    const host = el.host ? ctx.doc.elements[el.host] : undefined;
    if (!host) return [];
    const p = ctx.params<DoorParams>(el);
    const z = openingZone(ctx, host, p);
    return doorModel(
      el.id,
      {
        f: z.f,
        s1: z.s1,
        s2: z.s2,
        h1: z.h1,
        h2: z.h2,
        lo: z.lo,
        hi: z.hi,
        // Karmens höjd är modulmåttet minus 10 mm (21 M ger 2090), hålet plus 10.
        height: p.height - FRAME_LESS,
        holeTop: p.height + HOLE_EXTRA,
        frameWidth: p.frameWidth,
        swing: p.swing,
        hinge: p.hinge,
        glazed: !!p.glazed,
        leaf: LEAF,
        showSwing: !ctx.view.hide?.includes('swing'),
      },
      detailOf(ctx.view, 'model'),
    );
  },
  plan(el, ctx) {
    const host = el.host ? ctx.doc.elements[el.host] : undefined;
    if (!host) return [];
    const p = ctx.params<DoorParams>(el);
    // När rivet döljs syns bara igensättningen av en riven dörr.
    if (ctx.actionOf(el) === 'demolished' && ctx.view.hideDemolished) return openingMarks(el, host, p, ctx, { infillWhenRemoved: true });
    const level = ctx.view.detail ?? 'normal';
    const sketch = level === 'sketch';
    const detail = level === 'detail';
    const origin = { objectId: el.id, objectType: 'Door' };
    // Pennorna för karmen, bladet och slagbågen ur stilmallen (0.8.33).
    const pens = openingPens(ctx.style);
    const prims: Primitive[] = [];

    // Skiss: bladet från väggens liv över hela hålet. Normal: karmar och blad
    // från karmens liv. Detalj: karmar med falsar och blad med tjocklek.
    const z = openingZone(ctx, host, p);
    const { f, s1, s2, h1, h2, lo, hi } = z;
    const fw = sketch ? 0 : p.frameWidth;
    const a1 = sketch ? h1 : s1;
    const a2 = sketch ? h2 : s2;
    const leafO = sketch ? p.swing * f.half : p.swing === 1 ? hi : lo;
    const rebate = detail ? REBATE : 0;
    const sHinge = p.hinge === 'start' ? a1 + fw - rebate : a2 - fw + rebate;
    const clear = a2 - a1 - 2 * fw;
    const leafLen = clear + 2 * rebate;
    const hinge = f.at(sHinge, leafO);

    if (!sketch) {
      const other = leafO === hi ? lo : hi;
      const dd = Math.sign(other - leafO);
      // Karmen i snitt; i Detalj med falsen där bladet ligger an.
      const frame = (outer: number, inner: number): Primitive => {
        const dir = Math.sign(inner - outer);
        const pts: Vec2[] = detail
          ? [
              f.at(outer, other),
              f.at(inner, other),
              f.at(inner, leafO + dd * LEAF),
              f.at(inner - dir * REBATE, leafO + dd * LEAF),
              f.at(inner - dir * REBATE, leafO),
              f.at(outer, leafO),
            ]
          : [f.at(outer, lo), f.at(inner, lo), f.at(inner, hi), f.at(outer, hi)];
        return { kind: 'polyline', points: pts, closed: true, pen: pens.cut, origin: { ...origin, part: 'karm' } };
      };
      prims.push(frame(s1, s1 + fw), frame(s2, s2 - fw));
    }

    // Dörrar som finns i Befintligt ritas som befintliga (ofta 30°), andra
    // som planerade (90°), oavsett vad vyn jämförs med.
    const a = (ctx.doorAngleOf(el) * Math.PI) / 180;
    const closed = scale(f.u, p.hinge === 'start' ? 1 : -1);
    const out = scale(f.n, p.swing);
    const leafDir = add(scale(closed, Math.cos(a)), scale(out, Math.sin(a)));
    const tip = add(hinge, scale(leafDir, leafLen));
    const free = add(hinge, scale(closed, leafLen));

    const angle = (q: readonly [number, number]) => Math.atan2(q[1] - hinge[1], q[0] - hinge[0]);
    const aLeaf = angle(tip);
    const aFree = angle(free);
    const ccw = normalize(aFree - aLeaf);
    const [start, end] = ccw < Math.PI ? [aLeaf, aFree] : [aFree, aLeaf];
    if (detail) {
      // Bladet som en rektangel med sin tjocklek, åt det håll det stängs.
      let perp: Vec2 = sub(closed, scale(leafDir, closed[0] * leafDir[0] + closed[1] * leafDir[1]));
      const pl = Math.hypot(perp[0], perp[1]);
      perp = pl > 1e-6 ? scale(perp, LEAF / pl) : scale(out, -LEAF);
      prims.push({
        kind: 'polyline',
        points: [hinge, tip, add(tip, perp), add(hinge, perp)],
        closed: true,
        pen: pens.view,
        origin: { ...origin, part: 'dörrblad' },
      });
    } else {
      prims.push({ kind: 'line', a: hinge, b: tip, pen: pens.view, origin: { ...origin, part: 'dörrblad' } });
    }
    prims.push({ kind: 'arc', center: hinge, radius: leafLen, start, end, pen: pens.symbol, origin: { ...origin, part: 'slagbåge' } });

    // Glasad dörr: en linje mitt i karmens djup, över ungefär 3/5 av den fria bredden.
    if (p.glazed) {
      const mid = sketch ? 0 : (lo + hi) / 2;
      const half = clear * 0.3;
      prims.push({ kind: 'line', a: f.at(p.at - half, mid), b: f.at(p.at + half, mid), pen: pens.view, origin: { ...origin, part: 'glasning' } });
    }

    // Littera på motsatt sida mot slaget, där bågen inte är i vägen.
    if (showLittera(ctx, 'Door')) prims.push(...litteraTag(ctx, el, f, p.at, p.swing === 1 ? -1 : 1));
    // Igensatt dörrhål eller ny öppning i befintlig vägg ritas under dörrbladet.
    return [...openingMarks(el, host, p, ctx, { infillWhenRemoved: true }), ...prims];
  },
};

function normalize(a: number): number {
  const t = Math.PI * 2;
  return ((a % t) + t) % t;
}
