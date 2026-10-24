import type { Vec2 } from '../repr/primitives';
import type { UnderlayParams } from './underlay';

/**
 * Bildens grepp och mått (0.8.16): en bild eller PDF-sida som underlag kan
 * skalas i hörnen och sträckas på sidorna, och få bredd och höjd inskrivna.
 * Allt räknas i underlagets eget läge (vridet med det), med `pos` i nedre
 * vänstra hörnet. Att sträcka ändrar `size` (bildens punkter ritas in i
 * rektangeln), att skala ändrar `scale`.
 */

/** Grepp: hörnen 0–3 (nedre vänstra, nedre högra, övre högra, övre vänstra) och sidorna 0–3 (nedre, högra, övre, vänstra). */
export interface UnderlayGrip {
  kind: 'corner' | 'side';
  index: number;
}

/** Om underlaget har grepp: bilder och PDF-sidor, inte DXF. */
export const hasImageGrips = (p: Pick<UnderlayParams, 'kind'>) => p.kind !== 'dxf';

/** Bredd och höjd i modellen, mm. */
export function underlaySize(p: Pick<UnderlayParams, 'size' | 'scale'>): [number, number] {
  return [p.size[0] * p.scale, p.size[1] * p.scale];
}

function frame(p: Pick<UnderlayParams, 'pos' | 'angle'>) {
  const r = (p.angle * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return {
    world: (l: Vec2): Vec2 => [p.pos[0] + c * l[0] - s * l[1], p.pos[1] + s * l[0] + c * l[1]],
    local: (q: Vec2): Vec2 => {
      const x = q[0] - p.pos[0];
      const y = q[1] - p.pos[1];
      return [c * x + s * y, -s * x + c * y];
    },
  };
}

/** Greppens lägen i modellen. */
export function underlayGrips(p: UnderlayParams): (UnderlayGrip & { at: Vec2 })[] {
  const [w, h] = underlaySize(p);
  const f = frame(p);
  const corners: Vec2[] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  const sides: Vec2[] = [
    [w / 2, 0],
    [w, h / 2],
    [w / 2, h],
    [0, h / 2],
  ];
  return [...corners.map((l, index) => ({ kind: 'corner' as const, index, at: f.world(l) })), ...sides.map((l, index) => ({ kind: 'side' as const, index, at: f.world(l) }))];
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Underlaget när ett grepp dras till `target`. Hörnen skalar proportionellt
 * kring motsatt hörn (med `free` sträcks båda leden var för sig); sidorna
 * sträcker åt sitt håll med motsatt sida still. Null om det blir för litet.
 */
export function dragUnderlayGrip(p: UnderlayParams, g: UnderlayGrip, target: Vec2, free = false): Pick<UnderlayParams, 'pos' | 'scale' | 'size'> | null {
  const [w, h] = underlaySize(p);
  const f = frame(p);
  const c = f.local(target);
  const MIN = 1;
  if (g.kind === 'side') {
    let x0 = 0;
    let y0 = 0;
    let nw = w;
    let nh = h;
    if (g.index === 1) nw = c[0];
    else if (g.index === 3) [x0, nw] = [c[0], w - c[0]];
    else if (g.index === 2) nh = c[1];
    else [y0, nh] = [c[1], h - c[1]];
    if (nw < MIN || nh < MIN) return null;
    return { pos: roundPos(f.world([x0, y0])), scale: p.scale, size: [nw / p.scale, nh / p.scale] };
  }
  const right = g.index === 1 || g.index === 2;
  const top = g.index === 2 || g.index === 3;
  const o: Vec2 = [right ? 0 : w, top ? 0 : h];
  const d: Vec2 = [(right ? w : 0) - o[0], (top ? h : 0) - o[1]];
  let fx: number;
  let fy: number;
  if (free) {
    fx = (c[0] - o[0]) / d[0];
    fy = (c[1] - o[1]) / d[1];
  } else {
    fx = fy = ((c[0] - o[0]) * d[0] + (c[1] - o[1]) * d[1]) / (d[0] * d[0] + d[1] * d[1]);
  }
  const nw = w * fx;
  const nh = h * fy;
  if (!(nw >= MIN && nh >= MIN)) return null;
  const pos = roundPos(f.world([right ? 0 : w - nw, top ? 0 : h - nh]));
  // Proportionellt: ny skala, samma bild. Fritt: bredden genom skalan, höjden genom bildens höjd.
  return { pos, scale: p.scale * fx, size: free ? [p.size[0], (p.size[1] * fy) / fx] : p.size };
}

const roundPos = (q: Vec2): [number, number] => [round1(q[0]), round1(q[1])];

/** Ny bredd eller höjd, med nedre vänstra hörnet still (sträcker, ändrar inte det andra måttet). */
export function resizeUnderlay(p: UnderlayParams, width: number | null, height: number | null): Pick<UnderlayParams, 'size'> | null {
  const [w, h] = underlaySize(p);
  const nw = width ?? w;
  const nh = height ?? h;
  if (!(nw > 0 && nh > 0)) return null;
  return { size: [nw / p.scale, nh / p.scale] };
}

/** Om bildens proportioner skiljer sig från filens (`natural`, i filens enheter). */
export function stretched(p: Pick<UnderlayParams, 'size'>, natural: readonly [number, number]): boolean {
  return Math.abs((p.size[1] / p.size[0]) * (natural[0] / natural[1]) - 1) > 1e-4;
}

/** Filens proportioner igen, med samma bredd och samma nedre vänstra hörn. */
export function restoreProportions(p: UnderlayParams, natural: readonly [number, number]): Pick<UnderlayParams, 'size' | 'scale'> {
  const [w] = underlaySize(p);
  return { size: [natural[0], natural[1]], scale: w / natural[0] };
}
