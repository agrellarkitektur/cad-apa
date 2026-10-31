import type { Element } from '../core/model';
import { layoutOpening, LEAF_OPS, SIDE_HUNG, hasSash, type LaidCell, type OpeningKind, type OpeningLayout, type OpeningTypeModel, type Rect } from '../core/openingTypes';
import { openingSettingsOf } from '../core/general';
import { buildingMaterialOf, materialSolid } from './buildingMaterial';
import { detailOf } from '../core/states';
import { add, scale, sub } from '../geometry/vec';
import { objectPen } from '../repr/objectPens';
import type { Pen, Primitive, Vec2 } from '../repr/primitives';
import { levelOf, liftShape, type Shape3D } from '../repr/solids';
import { litteraTag, showLittera } from './littera';
import { openingLift, openingZone, uncutOpening, type OpeningZone } from './opening';
import { openingModel3d } from './openingModel';
import { openingModelOf, uMapping, viewFace, type OpeningObjParams } from './openingSpec';
import { planCutHeight } from './planCut';
import type { PlanContext } from './registry';
import { leanedShape, openingMarks, openingZoneInPlan, type WallParams } from './wall';
import { outsideSide } from './wallSides';

/** Allt om en öppning som planen och 3D behöver. */
export interface OpeningGeo {
  p: OpeningObjParams;
  m: OpeningTypeModel;
  z: OpeningZone;
  layout: OpeningLayout;
  u: (u: number) => number;
  mirrored: boolean;
  vf: 1 | -1;
  outside: 1 | -1 | null;
  swing: 1 | -1;
  /** Hålets underkant och karmens underkant över väggens fot eller golvet (före lyftet). */
  holeBottom: number;
  karmBottom: number;
  lift: number;
}

export function openingGeo(ctx: PlanContext, el: Element<any>, host: Element<any>, kind: OpeningKind, inPlan: boolean): OpeningGeo {
  const p = ctx.params<OpeningObjParams>(el);
  const m = openingModelOf(ctx.doc, el);
  const outside = ctx.memo(`outside:${host.id}`, () => outsideSide(ctx.doc, host));
  const vf = viewFace(outside, kind, p.swing);
  // Fönster öppnas utåt; i innerväggar mot den sida de ses ifrån.
  const swing: 1 | -1 = kind === 'door' ? (p.swing ?? 1) : vf;
  const z = openingZone(ctx, host, { ...p, swing: kind === 'door' ? p.swing : undefined, door: kind === 'door' }, inPlan);
  const layout = layoutOpening(m, p.frameW, p.frameH);
  const map = uMapping(m, vf, p.hinge ?? 'start', z.s1, z.s2);
  const wp = ctx.params<WallParams>(host);
  const door = kind === 'door';
  const holeBottom = door ? 0 : (p.sill ?? 0);
  const karmBottom = door || p.floor ? holeBottom : holeBottom + p.gap;
  const lift = door ? levelOf(wp) : openingLift(wp, p);
  return { p, m, z, layout, u: map.s, mirrored: map.mirrored, vf, outside, swing, holeBottom, karmBottom, lift };
}

/** Dörren eller fönstret i 3D (och fasader och sektioner). */
export function openingModel3dFor(el: Element<any>, ctx: PlanContext, kind: OpeningKind): Shape3D[] {
  const host = el.host ? ctx.doc.elements[el.host] : undefined;
  if (!host) return [];
  const g = openingGeo(ctx, el, host, kind, false);
  const wp = ctx.params<WallParams>(host);
  return openingModel3d(
    el.id,
    {
      f: g.z.f,
      lo: g.z.lo,
      hi: g.z.hi,
      h1: g.z.h1,
      h2: g.z.h2,
      holeBottom: g.holeBottom,
      holeTop: g.holeBottom + g.p.holeH,
      z0: g.karmBottom,
      layout: g.layout,
      model: g.m,
      u: g.u,
      vf: g.vf,
      swing: g.swing,
      outside: g.outside ?? 0,
      showSwing: !ctx.view.hide?.includes('openingSymbol'),
      mat: (id) => materialSolid(buildingMaterialOf({ material: id } as never, ctx.style)),
    },
    detailOf(ctx.view, 'model'),
  ).map((s) => leanedShape(liftShape(s, g.lift), wp));
}

/** Var planens snitt går genom karmen, mm över karmens underkant. */
function cutInKarm(ctx: PlanContext, g: OpeningGeo): number {
  const h = planCutHeight(ctx);
  const z = h === undefined ? g.layout.h / 2 : h - g.lift - g.karmBottom;
  return Math.max(1, Math.min(g.layout.h - 1, z));
}

const crosses = (r: Rect, z: number) => r.z0 <= z && r.z1 >= z;

/**
 * Dörren eller fönstret i planen (0.11.8): karmen och posterna i snitt, och
 * lufterna där snittet går: glaslinjen, bågarna (Detalj), fönstrens slag
 * kring gångjärnet och dörrbladen med slagbåge (det passiva bladet i en
 * pardörr streckat). Skiss: hålet och en linje, glaset eller bladet i öppet
 * läge, och slagbågarna (släcks under Visa, dörrar och fönster var för sig).
 */
export function openingPlanFor(el: Element<any>, ctx: PlanContext, kind: OpeningKind): Primitive[] {
  const host = el.host ? ctx.doc.elements[el.host] : undefined;
  if (!host) return [];
  const door = kind === 'door';
  const p = ctx.params<OpeningObjParams>(el);
  const wp = ctx.params<WallParams>(host);
  if (ctx.actionOf(el) === 'demolished' && ctx.view.hideDemolished) return door ? openingMarks(el, host, p, ctx, { infillWhenRemoved: true }) : [];
  const g = openingGeo(ctx, el, host, kind, true);
  const { f, h1, h2, lo, hi } = g.z;
  const tagSide: 1 | -1 = door ? (g.swing === 1 ? -1 : 1) : (-g.vf as 1 | -1);
  const tag = () => (showLittera(ctx, el.type) ? litteraTag(ctx, el, f, p.at, tagSide) : []);
  const zone = openingZoneInPlan(ctx, wp, p);
  if (zone !== 'cut') return [...uncutOpening(ctx, el, host, p, zone, !door), ...(door ? [] : tag())];

  const level = ctx.view.detail ?? 'normal';
  const origin = { objectId: el.id, objectType: el.type };
  const pens = door
    ? { cut: objectPen(ctx.style, 'doorFrameCut'), mullion: objectPen(ctx.style, 'doorFrameCut'), frame: objectPen(ctx.style, 'doorLeaf'), sash: objectPen(ctx.style, 'doorLeaf'), glass: objectPen(ctx.style, 'doorLeaf'), leaf: objectPen(ctx.style, 'doorLeaf'), swing: objectPen(ctx.style, 'doorSwing'), winSwing: objectPen(ctx.style, 'doorSwing') }
    : { cut: objectPen(ctx.style, 'windowFrameCut'), mullion: objectPen(ctx.style, 'windowMullion'), frame: objectPen(ctx.style, 'windowFrameContour'), sash: objectPen(ctx.style, 'windowSash'), glass: objectPen(ctx.style, 'windowGlass'), leaf: objectPen(ctx.style, 'doorLeaf'), swing: objectPen(ctx.style, 'doorSwing'), winSwing: objectPen(ctx.style, 'windowSwing') };
  const at = (u: number, o: number): Vec2 => f.at(g.u(u), o);
  const line = (a: Vec2, b: Vec2, pen: Pen, part: string): Primitive => ({ kind: 'line', a, b, pen, origin: { ...origin, part } });
  const rect = (u0: number, u1: number, o0: number, o1: number, pen: Pen, part: string): Primitive => ({ kind: 'polyline', points: [at(u0, o0), at(u1, o0), at(u1, o1), at(u0, o1)], closed: true, pen, origin: { ...origin, part } });
  const marks = openingMarks(el, host, p, ctx, { infillWhenRemoved: door });
  const out: Primitive[] = [...marks];
  const mid = (lo + hi) / 2;
  const L = g.layout;
  const zc = cutInKarm(ctx, g);
  // Lufterna där snittet går; dörrbladen alltid (de står på golvet).
  const cells = L.cells.filter((c) => crosses(c.rect, zc) || (LEAF_OPS.has(c.op) && c.rect.z0 <= 1 + (g.m.frame.bottom ?? 0)));
  const oFace = (side: 1 | -1) => (side === 1 ? hi : lo);
  // Väggen under fönstret syns nedanför snittet, över hela hålet: väggens konturlinje, med väggens egen penna (0.10.37).
  const below = (): Primitive[] =>
    g.p.floor ? [] : [-f.half, f.half].map((o): Primitive => ({ kind: 'line', a: f.at(h1, o), b: f.at(h2, o), pen: objectPen(ctx.style, 'wallContour'), origin: { objectId: host.id, objectType: 'Wall', part: 'under' } }));

  /**
   * Sidohängda bågar (0.11.8.1, kommentar B): som en dörr men öppen bara
   * stilbokens vinkel (förval 15°), bladlinjen från gångjärnet i öppet läge
   * och slagbågen med mitten i gångjärnet, från stängt till öppet. En 2-luft
   * får två, var och en kring sitt gångjärn.
   */
  const swingAngle = (openingSettingsOf(ctx.doc.graphics).swingAngle * Math.PI) / 180;
  const windowSwing = (c: LaidCell): Primitive[] => {
    if (!SIDE_HUNG.has(c.op) || ctx.view.hide?.includes('swingWindow') || swingAngle <= 0) return [];
    const r = c.rect;
    const side: 1 | -1 = c.inward ? (-g.vf as 1 | -1) : g.vf;
    const o = oFace(side);
    const hu = c.hinge === 'right' ? r.u1 : r.u0;
    const fu = c.hinge === 'right' ? r.u0 : r.u1;
    const hinge = at(hu, o);
    const free = at(fu, o);
    const closed = sub(free, hinge);
    const len = Math.hypot(closed[0], closed[1]) || 1;
    const cu = scale(closed, 1 / len);
    const tip = add(hinge, scale(add(scale(cu, Math.cos(swingAngle)), scale(f.n, side * Math.sin(swingAngle))), len));
    return [line(hinge, tip, pens.winSwing, 'slagbåge'), arcPrim(hinge, tip, free, len, pens.winSwing, { ...origin, part: 'slagbåge' })];
  };

  if (level === 'sketch') {
    // Hålets sidor och en linje: glaset mitt i väggen, eller dörrbladet i öppet läge; slagbågarna som på de andra nivåerna (kommentar H).
    const sides = [h1, h2].map((s) => line(f.at(s, -f.half), f.at(s, f.half), pens.cut, 'sida'));
    if (!door) return [...out, ...sides, line(f.at(h1, 0), f.at(h2, 0), pens.glass, 'glas'), ...cells.flatMap(windowSwing), ...below(), ...tag()];
    for (const c of cells.filter((x) => LEAF_OPS.has(x.op))) out.push(...leafPrims(ctx, el, g, c, g.swing * f.half, false, pens, origin, true));
    return [...out, ...sides, ...tag()];
  }

  // Karmen i snitt på sidorna; i fönster den nedre karmen sedd uppifrån.
  if (L.frame.length >= 2) {
    out.push(rect(L.frame[0].u0, L.frame[0].u1, lo, hi, pens.cut, 'karm'), rect(L.frame[1].u0, L.frame[1].u1, lo, hi, pens.cut, 'karm'));
    if (!door) out.push(line(at(L.frame[0].u1, lo), at(L.frame[1].u0, lo), pens.frame, 'karm'), line(at(L.frame[0].u1, hi), at(L.frame[1].u0, hi), pens.frame, 'karm'));
  }
  for (const r of L.mullions) if (crosses(r, zc) || (door && r.z0 <= 1)) out.push(rect(r.u0, r.u1, lo, hi, pens.mullion, 'post'));

  for (const c of cells) {
    const r = c.rect;
    if (LEAF_OPS.has(c.op)) {
      out.push(...leafPrims(ctx, el, g, c, oFace(g.swing), level === 'detail', pens, origin, false));
      continue;
    }
    if (c.fill === 'open') continue;
    if (c.fill === 'panel') {
      out.push(rect(r.u0, r.u1, mid - 15, mid + 15, pens.frame, 'panel'));
      continue;
    }
    if (level === 'detail' && hasSash(c)) {
      const sd = Math.min(g.m.sashDepth, hi - lo);
      const w = Math.min(g.m.sash, (r.u1 - r.u0) / 3);
      out.push(rect(r.u0, r.u0 + w, mid - sd / 2, mid + sd / 2, pens.sash, 'båge'), rect(r.u1 - w, r.u1, mid - sd / 2, mid + sd / 2, pens.sash, 'båge'));
      out.push(line(at(r.u0 + w, mid - 6), at(r.u1 - w, mid - 6), pens.glass, 'glas'), line(at(r.u0 + w, mid + 6), at(r.u1 - w, mid + 6), pens.glass, 'glas'));
    } else if (level === 'detail') {
      out.push(line(at(r.u0, mid - 6), at(r.u1, mid - 6), pens.glass, 'glas'), line(at(r.u0, mid + 6), at(r.u1, mid + 6), pens.glass, 'glas'));
    } else out.push(line(at(r.u0, mid), at(r.u1, mid), pens.glass, 'glas'));
    out.push(...windowSwing(c));
  }
  return [...out, ...(door ? [] : below()), ...tag()];
}

function normalize(a: number): number {
  const t = Math.PI * 2;
  return ((a % t) + t) % t;
}

function arcPrim(center: Vec2, a: Vec2, b: Vec2, radius: number, pen: Pen, origin: Primitive['origin']): Primitive {
  const ang = (q: Vec2) => Math.atan2(q[1] - center[1], q[0] - center[0]);
  const a1 = ang(a);
  const a2 = ang(b);
  const ccw = normalize(a2 - a1);
  const [start, end] = ccw < Math.PI ? [a1, a2] : [a2, a1];
  return { kind: 'arc', center, radius, start, end, pen, origin } as Primitive;
}

/**
 * Ett dörrblad i planen: slagdörren öppen (90°, befintliga 30°) med
 * slagbågen, skjutdörren utanpå eller in i väggen, vikdörren som sicksack,
 * porten streckad. Det passiva bladet i en pardörr (det högra sett från
 * slagsidan, utan sidohängt grannblad till vänster) ritas streckat.
 */
function leafPrims(
  ctx: PlanContext,
  el: Element<any>,
  g: OpeningGeo,
  c: LaidCell,
  o: number,
  detail: boolean,
  pens: { leaf: Pen; swing: Pen },
  origin: { objectId: string; objectType: string },
  sketch: boolean,
): Primitive[] {
  const f = g.z.f;
  const r = c.rect;
  const at = (u: number, oo: number): Vec2 => f.at(g.u(u), oo);
  const out: Primitive[] = [];
  const pen = pens.leaf;
  const dashed = (p: Pen): Pen => ({ ...p, dash: p.dash ?? [2, 1] });
  const len = r.u1 - r.u0;
  const side = g.swing;
  const outward = scale(f.n, side);
  const hideSwing = ctx.view.hide?.includes('swing');
  switch (c.op) {
    case 'leaf':
    case 'foldLeaf': {
      const hu = c.hinge === 'right' ? r.u1 : r.u0;
      const fu = c.hinge === 'right' ? r.u0 : r.u1;
      const hinge = at(hu, o);
      const free = at(fu, o);
      const closed = sub(free, hinge);
      const cl = Math.hypot(closed[0], closed[1]) || 1;
      const cu = scale(closed, 1 / cl);
      const ang = (ctx.doorAngleOf(el) * Math.PI) / 180;
      const dir = add(scale(cu, Math.cos(ang)), scale(outward, Math.sin(ang)));
      const tip = add(hinge, scale(dir, len));
      // Det passiva bladet: ett andra slagblad i samma typ med gångjärn till höger.
      const leaves = g.m.cells.filter((x) => x.op === 'leaf');
      const passive = leaves.length > 1 && c.hinge === 'right';
      const lp = passive ? dashed(pen) : pen;
      if (c.op === 'foldLeaf' && !sketch) {
        // Vikdörren: bladen vikta mot gångjärnet, som en sicksack.
        const n = 4;
        const w = len / n;
        const pts: Vec2[] = [];
        for (let i = 0; i <= n; i++) pts.push(add(add(hinge, scale(cu, (i * w) * 0.35)), scale(outward, i % 2 ? w * 0.9 : 0)));
        out.push({ kind: 'polyline', points: pts, closed: false, pen: lp, origin: { ...origin, part: 'dörrblad' } });
        return out;
      }
      if (detail) {
        let perp: Vec2 = sub(cu, scale(dir, cu[0] * dir[0] + cu[1] * dir[1]));
        const pl = Math.hypot(perp[0], perp[1]);
        perp = pl > 1e-6 ? scale(perp, g.m.leaf / pl) : scale(outward, -g.m.leaf);
        out.push({ kind: 'polyline', points: [hinge, tip, add(tip, perp), add(hinge, perp)], closed: true, pen: lp, origin: { ...origin, part: 'dörrblad' } });
      } else out.push({ kind: 'line', a: hinge, b: tip, pen: lp, origin: { ...origin, part: 'dörrblad' } });
      if (!hideSwing) out.push(arcPrim(hinge, tip, free, len, passive ? dashed(pens.swing) : pens.swing, { ...origin, part: 'slagbåge' }));
      return out;
    }
    case 'slideLeaf': {
      // Utanpå väggen på slagsidan: bladet stängt, och öppet streckat bredvid.
      const oo = side * (g.z.f.half + 20);
      const toLeft = c.hinge !== 'right';
      const shift = toLeft ? -len : len;
      out.push({ kind: 'polyline', points: [at(r.u0, oo), at(r.u1, oo), at(r.u1, oo + side * g.m.leaf), at(r.u0, oo + side * g.m.leaf)], closed: true, pen, origin: { ...origin, part: 'dörrblad' } });
      if (!sketch && !hideSwing) out.push({ kind: 'polyline', points: [at(r.u0 + shift, oo), at(r.u1 + shift, oo), at(r.u1 + shift, oo + side * g.m.leaf), at(r.u0 + shift, oo + side * g.m.leaf)], closed: true, pen: dashed(pens.swing), origin: { ...origin, part: 'slagbåge' } });
      return out;
    }
    case 'pocket': {
      // In i väggen (kassett): bladet stängt och inskjutet streckat i väggen.
      const toLeft = c.hinge !== 'right';
      const shift = toLeft ? -len : len;
      const t = g.m.leaf / 2;
      out.push({ kind: 'polyline', points: [at(r.u0, -t), at(r.u1, -t), at(r.u1, t), at(r.u0, t)], closed: true, pen, origin: { ...origin, part: 'dörrblad' } });
      if (!sketch && !hideSwing) out.push({ kind: 'polyline', points: [at(r.u0 + shift, -t), at(r.u1 + shift, -t), at(r.u1 + shift, t), at(r.u0 + shift, t)], closed: true, pen: dashed(pens.swing), origin: { ...origin, part: 'slagbåge' } });
      return out;
    }
    case 'garage': {
      // Porten: bladet i karmen och dess öppna läge under taket streckat.
      out.push({ kind: 'line', a: at(r.u0, 0), b: at(r.u1, 0), pen, origin: { ...origin, part: 'dörrblad' } });
      if (!sketch && !hideSwing) {
        const depth = Math.min(r.z1 - r.z0, 2500);
        const inward = -side;
        out.push({ kind: 'polyline', points: [at(r.u0, 0), at(r.u1, 0), at(r.u1, inward * depth), at(r.u0, inward * depth)], closed: true, pen: dashed(pens.swing), origin: { ...origin, part: 'slagbåge' } });
      }
      return out;
    }
  }
  return out;
}
