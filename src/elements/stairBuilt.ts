import type { Material, StyleResources } from '../core/graphics';
import { intersection } from '../geometry/boolean';
import { dist, norm, sub } from '../geometry/vec';
import type { Vec2 } from '../repr/primitives';
import type { Plane, Solid } from '../repr/solids';
import { materialSolid } from './buildingMaterial';
import { offsetLine } from './groundLines';
import { bandBetween, walkDir, type Rib, type StairGeometry, type StairItem, type StairParams } from './stairGeometry';

/**
 * Den byggda trappan (0.11.4): vangstycken längs sidorna, plansteg med
 * stegnos och sättsteg som egna delar med egna mått och material, och
 * kontrastmarkeringen (också på den monolitiska trappan). Ren räkning; planen
 * och 3D i `stair.ts` läser härifrån.
 *
 * Måtten längs gånglinjen: stegets framkant (nosen) ligger vid stegets `u0`,
 * sättsteget bakom nosen (`u0 + nos`), och plansteget går in under nästa
 * sättsteg. Vangstyckets överkant följer linjen genom stegnosarna, 50 mm
 * över, och dess höjd mäts lodrätt.
 */

export type StringerSides = 'both' | 'left' | 'right' | 'none';
export type StairContrast = 'none' | 'ends' | 'all';

/** Förvalen för den byggda trappans delar. */
export const BUILT = {
  stringerWidth: 50,
  stringerHeight: 300,
  /** Vangstyckets överkant över stegnoslinjen, mm. */
  stringerAbove: 50,
  treadThickness: 40,
  nosing: 30,
  riserThickness: 20,
  contrastWidth: 50,
} as const;

/** Kulörerna i 3D när en del saknar material: plansteg i trä, vangstycken och sättsteg målade. */
const COLOR = { tread: '#c8a57a', riser: '#ece8df', stringer: '#ece8df', contrast: '#2b2b2b' } as const;

/** Den byggda trappans mått med förvalen ifyllda. */
export interface BuiltDims {
  sides: StringerSides;
  stringerWidth: number;
  stringerHeight: number;
  treadThickness: number;
  nosing: number;
  riserThickness: number;
  stringerMaterial?: string;
  treadMaterial?: string;
  riserMaterial?: string;
}

const num = (v: unknown, d: number, min = 0): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, v) : d);

export function builtDims(p: StairParams): BuiltDims {
  const b = p.built ?? {};
  return {
    sides: b.stringer?.sides ?? 'both',
    stringerWidth: num(b.stringer?.width, BUILT.stringerWidth, 10),
    stringerHeight: num(b.stringer?.height, BUILT.stringerHeight, 50),
    treadThickness: num(b.tread?.thickness, BUILT.treadThickness, 10),
    nosing: num(b.tread?.nosing, BUILT.nosing),
    riserThickness: num(b.riser?.thickness, BUILT.riserThickness),
    stringerMaterial: b.stringer?.material,
    treadMaterial: b.tread?.material,
    riserMaterial: b.riser?.material,
  };
}

/** Vangstyckenas bredd på vänster och höger sida (0 där det inte finns något). */
export function stringerInsets(d: BuiltDims): { left: number; right: number } {
  return {
    left: d.sides === 'both' || d.sides === 'left' ? d.stringerWidth : 0,
    right: d.sides === 'both' || d.sides === 'right' ? d.stringerWidth : 0,
  };
}

/** Revbenet kortat `l` mm i vänstra och `r` mm i högra änden (mellan vangstyckena). */
export function insetRib(rib: Rib, l: number, r: number): [Vec2, Vec2] {
  const d = sub(rib.R, rib.L);
  const len = Math.hypot(d[0], d[1]);
  if (len < 1e-6 || l + r >= len - 1) return [rib.L, rib.R];
  const u: Vec2 = [d[0] / len, d[1] / len];
  return [
    [rib.L[0] + u[0] * l, rib.L[1] + u[1] * l],
    [rib.R[0] - u[0] * r, rib.R[1] - u[1] * r],
  ];
}

/** Vangstyckets inre linje på en sida mellan u0 och u1 (sidan förskjuten inåt). */
export function stringerLine(g: StairGeometry, side: 'left' | 'right', w: number, u0: number, u1: number, sideOf: (g: StairGeometry, side: 'left' | 'right', u0: number, u1: number) => Vec2[]): Vec2[] {
  const pts = sideOf(g, side, u0, u1);
  if (pts.length < 2) return pts;
  // Vänster kant förskjuts åt höger (inåt), höger kant åt vänster.
  return offsetLine(pts, side === 'left' ? -w : w);
}

/** Bandet mellan u0 och u1; före trappans början förlängs det rakt bakåt (stegnosen över det första sättsteget). */
function bandExt(g: StairGeometry, u0: number, u1: number): Vec2[] {
  const ring = bandBetween(g, Math.max(0, u0), Math.min(g.length, u1));
  if (ring.length < 3) return ring;
  const extra = [Math.max(0, -u0), Math.max(0, u1 - g.length)];
  if (!extra[0] && !extra[1]) return ring;
  // Ringen: höger kant framåt (R0 … R1), sedan vänster bakåt (L1 … L0).
  const out = ring.map((q) => [q[0], q[1]] as Vec2);
  const shift = (i: number, d: Vec2, k: number) => (out[i] = [out[i][0] + d[0] * k, out[i][1] + d[1] * k]);
  if (extra[0]) {
    const d = walkDir(g, 0);
    shift(0, d, -extra[0]);
    shift(out.length - 1, d, -extra[0]);
  }
  if (extra[1]) {
    const d = walkDir(g, g.length);
    const r1 = out.findIndex((q) => dist(q, g.ribAt(g.length).R) < 1e-3);
    const l1 = out.findIndex((q) => dist(q, g.ribAt(g.length).L) < 1e-3);
    if (r1 >= 0) shift(r1, d, extra[1]);
    if (l1 >= 0) shift(l1, d, extra[1]);
  }
  return out;
}

/** Remsan mellan vangstyckena (eller längs ett av dem), förlängd förbi trappans ändar så att klippningen bara tar sidorna. */
function strips(g: StairGeometry, ins: { left: number; right: number }): { inner: Vec2[]; left: Vec2[] | null; right: Vec2[] | null } {
  const ext = (pts: Vec2[]): Vec2[] => {
    if (pts.length < 2) return pts;
    const a = norm(sub(pts[1], pts[0]));
    const n = pts.length;
    const b = norm(sub(pts[n - 1], pts[n - 2]));
    const E = 2000;
    return [[pts[0][0] - a[0] * E, pts[0][1] - a[1] * E], ...pts.slice(1, -1), [pts[n - 1][0] + b[0] * E, pts[n - 1][1] + b[1] * E]];
  };
  const L = ext(g.left);
  const R = ext(g.right);
  const Li = ins.left ? offsetLine(L, -ins.left) : L;
  const Ri = ins.right ? offsetLine(R, ins.right) : R;
  return {
    inner: [...Ri, ...Li.slice().reverse()],
    left: ins.left ? [...Li, ...L.slice().reverse()] : null,
    right: ins.right ? [...R, ...Ri.slice().reverse()] : null,
  };
}

/** Stegen som har en framkant (plansteg, vilplan, sista plansteget). */
const stepItems = (g: StairGeometry): StairItem[] => g.items.filter((i) => i.kind !== 'startTread');

/** Stegen som får kontrastmarkering: alla framkanter, eller det första och det sista steget. */
export function contrastItems(g: StairGeometry, c: StairContrast | undefined): StairItem[] {
  const all = stepItems(g);
  if (!c || c === 'none' || !all.length) return [];
  if (c === 'all') return all;
  return all.length === 1 ? all : [all[0], all[all.length - 1]];
}

/** Höjden på linjen genom stegnosarna vid u (från trappans fot), för vangstyckena. */
function nosingZ(g: StairGeometry, u: number): number {
  const items = stepItems(g);
  for (const it of items) {
    if (u > it.u1 + 1e-6) continue;
    if (it.kind !== 'tread') return it.z;
    const t = (u - it.u0) / Math.max(1, it.u1 - it.u0);
    return it.z + g.riserHeight * Math.max(0, Math.min(1, t));
  }
  return g.rise;
}

/** Ett snett plan genom två punkter med höjder, lutande längs riktningen mellan dem. */
function planeThrough(a: Vec2, za: number, b: Vec2, zb: number, fallback: Vec2, run: number): Plane {
  let d = sub(b, a);
  let l = Math.hypot(d[0], d[1]);
  let slope: number;
  if (l < 5) {
    d = fallback;
    l = 1;
    slope = (zb - za) / Math.max(1, run);
  } else {
    d = [d[0] / l, d[1] / l];
    slope = (zb - za) / l;
  }
  return [slope * d[0], slope * d[1], za - slope * (d[0] * a[0] + d[1] * a[1])];
}

const zOnPlane = (pl: Plane, q: Vec2): number => pl[0] * q[0] + pl[1] * q[1] + pl[2];

type Mat = { color?: string; matId?: string; texture?: { asset: string; size: number } };

function partMat(id: string | undefined, style: StyleResources | undefined, fallback: string): Mat {
  const m: Material | undefined = id ? style?.materials?.find((x) => x.id === id) : undefined;
  const s = materialSolid(m);
  return s.color || s.texture ? s : { ...s, color: fallback };
}

/**
 * Den byggda trappans delar i 3D, från trappans fot: plansteg (också
 * vilplan och det sista plansteget), sättsteg och vangstycken. Det första
 * plansteget i golvnivå är golvet och ritas inte.
 */
export function builtSolids(id: string, p: StairParams, g: StairGeometry, style: StyleResources | undefined): Solid[] {
  const d = builtDims(p);
  const ins = stringerInsets(d);
  const st = strips(g, ins);
  const out: Solid[] = [];
  const L = g.length;
  const lastRiser = p.end === 'tread' ? -1 : L;
  const tt = d.treadThickness;
  const tr = d.riserThickness;
  const n = tr > 0 ? d.nosing : 0;
  const tread = partMat(d.treadMaterial, style, COLOR.tread);
  const riser = partMat(d.riserMaterial, style, COLOR.riser);
  const stringer = partMat(d.stringerMaterial, style, COLOR.stringer);
  const clip = (ring: Vec2[], by: Vec2[]): Vec2[][] => (ring.length < 3 ? [] : intersection([ring], [[by]]).map((poly) => poly[0]).filter((r) => r && r.length >= 3));
  const items = stepItems(g);
  // Plansteget går in under nästa sättsteg (eller till det översta sättsteget mot golvet ovanför).
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const next = items[i + 1];
    const back = next ? next.u0 + n + tr : lastRiser > 0 ? L - tr : L;
    const ring = bandExt(g, it.u0, Math.min(L, Math.max(it.u0 + 1, back)));
    for (const r of clip(ring, st.inner)) out.push({ id, rings: [r], z0: it.z - tt, z1: it.z, material: 'floor', ...tread });
  }
  // Sättstegen: under varje stegs nos, från steget under till plansteget ovanför.
  if (tr > 0) {
    let below = 0;
    for (const it of items) {
      const u = it.u0 + n;
      const ring = bandExt(g, u, Math.min(L, u + tr));
      if (it.z - tt - below > 1) for (const r of clip(ring, st.inner)) out.push({ id, rings: [r], z0: below, z1: it.z - tt, material: 'floor', ...riser });
      below = it.z;
    }
    if (lastRiser > 0 && g.rise - below > 1) {
      const ring = bandBetween(g, L - tr, L);
      for (const r of clip(ring, st.inner)) out.push({ id, rings: [r], z0: below, z1: g.rise, material: 'floor', ...riser });
    }
  }
  // Vangstyckena: en bit per steg, med överkanten 50 över stegnoslinjen och lodrät höjd.
  const a = g.items[0]?.kind === 'startTread' ? g.items[0].u1 : 0;
  const b = g.items.at(-1)?.kind === 'endTread' ? g.items.at(-1)!.u0 : L;
  const H = d.stringerHeight;
  for (const side of ['left', 'right'] as const) {
    const strip = st[side];
    if (!strip) continue;
    const cuts = [a, ...items.map((i) => i.u0).filter((u) => u > a + 1 && u < b - 1), ...items.map((i) => i.u1).filter((u) => u > a + 1 && u < b - 1), b]
      .sort((x, y) => x - y)
      .filter((u, i, arr) => i === 0 || u - arr[i - 1] > 1);
    for (let k = 0; k < cuts.length - 1; k++) {
      const u0 = cuts[k];
      const u1 = cuts[k + 1];
      const r0 = g.ribAt(u0);
      const r1 = g.ribAt(u1);
      const p0s = side === 'left' ? r0.L : r0.R;
      const p1s = side === 'left' ? r1.L : r1.R;
      const z0 = nosingZ(g, u0 + 1e-3) + BUILT.stringerAbove;
      const z1 = nosingZ(g, u1 - 1e-3) + BUILT.stringerAbove;
      const top = planeThrough(p0s, z0, p1s, z1, walkDir(g, (u0 + u1) / 2), u1 - u0);
      const bottom: Plane = [top[0], top[1], top[2] - H];
      for (const r of clip(bandBetween(g, u0, u1), strip)) {
        const tops = r.map((q) => zOnPlane(top, q));
        const bots = r.map((q) => zOnPlane(bottom, q));
        const hi = Math.max(...tops);
        const lo = Math.min(...bots);
        if (lo < 0) out.push({ id, rings: [r], z0: 0, z1: hi, top, material: 'floor', ...stringer });
        else out.push({ id, rings: [r], z0: lo, z1: hi, top, bottom, material: 'floor', ...stringer });
      }
    }
  }
  return out;
}

/** Kontrastmarkeringen i 3D: en tunn remsa på stegets framkant (ovanpå plansteget). */
export function contrastSolids(id: string, p: StairParams, g: StairGeometry): Solid[] {
  const items = contrastItems(g, p.contrast);
  if (!items.length) return [];
  const w = num(p.contrastWidth, BUILT.contrastWidth, 10);
  const ins = p.build === 'built' ? stringerInsets(builtDims(p)) : { left: 0, right: 0 };
  const inner = strips(g, ins).inner;
  const out: Solid[] = [];
  for (const it of items) {
    const ring = bandExt(g, it.u0, Math.min(it.u1, it.u0 + w));
    if (ring.length < 3) continue;
    for (const poly of intersection([ring], [[inner]])) if (poly[0]?.length >= 3) out.push({ id, rings: [poly[0]], z0: it.z, z1: it.z + 2, material: 'floor', color: COLOR.contrast });
  }
  return out;
}
