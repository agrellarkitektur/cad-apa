import type { Pen, Primitive, Vec2 } from '../repr/primitives';
import { levelOf, liftShape, type Solid } from '../repr/solids';
import type { ElementType } from './registry';
import { zoneInPlan } from './planCut';
import { ABOVE_PART, planCutPen } from '../repr/planCutPens';

/**
 * Enkla möbler och inredning tills smartobjekten finns (efter pilotprojektet). Varje
 * symbol ritas i en lokal ruta (0,0)–(bredd,djup) som sedan placeras och vrids.
 */
export type FurnitureSymbol = 'bed' | 'sofa' | 'table' | 'counter' | 'sink' | 'shower';

export interface FurnitureParams {
  /** Nedre vänstra hörnet före vridning, mm. */
  origin: [number, number];
  /** Vridning i grader moturs. */
  rotation: number;
  width: number;
  depth: number;
  symbol: FurnitureSymbol;
  /**
   * Fast inredning ritas med svart linje, lös möblering utgråad. Utelämnad:
   * bänkar, tvättställ och duschar är fasta, övrigt löst.
   */
  fixed?: boolean;
  /** Undersidans nivå mot våningens golv, mm (0.10.13). Utelämnad = 0. */
  level?: number;
}

/** Om möbeln är fast inredning. */
export function isFixed(p: FurnitureParams): boolean {
  return p.fixed ?? (p.symbol === 'counter' || p.symbol === 'sink' || p.symbol === 'shower');
}

type Local = [number, number];

/** Möbelns kroppar i 3D från golvet. */
function furnitureSolids(id: string, p: FurnitureParams): Solid[] {
    const r = (p.rotation * Math.PI) / 180;
    const tr = ([x, y]: Local): Vec2 => [p.origin[0] + x * Math.cos(r) - y * Math.sin(r), p.origin[1] + x * Math.sin(r) + y * Math.cos(r)];
    const box = (x0: number, y0: number, x1: number, y1: number): Vec2[][] => [[tr([x0, y0]), tr([x1, y0]), tr([x1, y1]), tr([x0, y1])]];
    const w = p.width;
    const d = p.depth;
    const s = (rings: Vec2[][], z0: number, z1: number, material: Solid['material'] = 'furniture'): Solid => ({ id, rings, z0, z1, material });
    switch (p.symbol) {
      case 'bed':
        return [s(box(0, 0, w, d), 0, 450), s(box(0, d - 80, w, d), 450, 900)];
      case 'sofa':
        return [s(box(0, 0, w, d), 0, 420), s(box(0, d - 250, w, d), 420, 780)];
      case 'counter':
        return [s(box(0, 0, w, d), 0, 900)];
      case 'sink':
        return [s(box(0, 0, w, d), 860, 920, 'fixture')];
      case 'shower':
        return [s(box(0, 0, w, d), 0, 40, 'fixture')];
      case 'table':
      default:
        return [s(box(0, 0, w, d), 700, 740), s(box(40, 40, 100, 100), 0, 700), s(box(w - 100, 40, w - 40, 100), 0, 700), s(box(40, d - 100, 100, d - 40), 0, 700), s(box(w - 100, d - 100, w - 40, d - 40), 0, 700)];
    }
}


export const furnitureType: ElementType<FurnitureParams> = {
  type: 'Furniture',
  planReads: [],
  label: 'Möbel',
  labelPlural: 'Möbler',
  drawOrder: 30,
  compares: true,
  defaults: () => ({ origin: [0, 0], rotation: 0, width: 900, depth: 600, symbol: 'table' }),
  pickShape(el, ctx) {
    return [[furnitureOutline(ctx.params<FurnitureParams>(el))]];
  },
  model3d(el, ctx) {
    const p = ctx.params<FurnitureParams>(el);
    return furnitureSolids(el.id, p).map((s) => liftShape(s, levelOf(p)));
  },
  plan(el, ctx) {
    const p = ctx.params<FurnitureParams>(el);
    const r = (p.rotation * Math.PI) / 180;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const tr = ([x, y]: Local): Vec2 => [p.origin[0] + x * cos - y * sin, p.origin[1] + x * sin + y * cos];
    // Över planens snitt (0.10.16), t.ex. ett överskåp: streckprickat.
    const solids = furnitureSolids(el.id, p);
    const above = zoneInPlan(ctx, levelOf(p) + Math.min(...solids.map((x) => x.z0)), levelOf(p) + Math.max(...solids.map((x) => x.z1))) === 'above';
    const pen: Pen = above ? planCutPen(ctx.style, 'Furniture', 'above') : isFixed(p) ? { weight: 0.25 } : { weight: 0.18, color: 'muted' };
    const origin = { objectId: el.id, objectType: 'Furniture', part: above ? ABOVE_PART : 'symbol' };
    const poly = (pts: Local[], closed = true): Primitive => ({ kind: 'polyline', closed, points: pts.map(tr), pen, origin });
    const rect = (x0: number, y0: number, x1: number, y1: number) =>
      poly([
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ]);
    const w = p.width;
    const d = p.depth;

    switch (p.symbol) {
      case 'bed': {
        // Huvudänden ligger vid y = djup. Två kuddar för dubbelsäng.
        const out = [rect(0, 0, w, d)];
        if (w >= 1200) out.push(rect(100, d - 450, w / 2 - 50, d - 100), rect(w / 2 + 50, d - 450, w - 100, d - 100));
        else out.push(rect(100, d - 450, w - 100, d - 100));
        return out;
      }
      case 'sofa':
        return [rect(0, 0, w, d), rect(0, d - 250, w, d)];
      case 'counter':
        return [rect(0, 0, w, d)];
      case 'sink':
        return [rect(0, 0, w, d), rect(80, 80, w - 80, d - 120)];
      case 'shower':
        return [rect(0, 0, w, d), { kind: 'line', a: tr([0, 0]), b: tr([w, d]), pen, origin }];
      case 'table':
      default:
        return [rect(0, 0, w, d)];
    }
  },
};

/** Möbelns yttre rektangel, med hörnen i ordning. */
export function furnitureOutline(p: FurnitureParams): Vec2[] {
  const r = (p.rotation * Math.PI) / 180;
  const tr = (x: number, y: number): Vec2 => [p.origin[0] + x * Math.cos(r) - y * Math.sin(r), p.origin[1] + x * Math.sin(r) + y * Math.cos(r)];
  return [tr(0, 0), tr(p.width, 0), tr(p.width, p.depth), tr(0, p.depth)];
}

/** Vrid en möbel kring sin mitt. */
export function rotateFurniture(p: FurnitureParams, deg: number): Pick<FurnitureParams, 'origin' | 'rotation'> {
  const r0 = (p.rotation * Math.PI) / 180;
  const cx = p.origin[0] + (p.width / 2) * Math.cos(r0) - (p.depth / 2) * Math.sin(r0);
  const cy = p.origin[1] + (p.width / 2) * Math.sin(r0) + (p.depth / 2) * Math.cos(r0);
  const rotation = (((p.rotation + deg) % 360) + 360) % 360;
  const r1 = (rotation * Math.PI) / 180;
  const ox = cx - (p.width / 2) * Math.cos(r1) + (p.depth / 2) * Math.sin(r1);
  const oy = cy - (p.width / 2) * Math.sin(r1) - (p.depth / 2) * Math.cos(r1);
  return { origin: [Math.round(ox), Math.round(oy)], rotation };
}
