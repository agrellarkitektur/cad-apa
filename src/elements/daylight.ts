import type { Id, ProjectDoc } from '../core/model';
import { actionOf } from '../core/states';
import { hasSash, layoutLeaf, layoutOpening, leafGridOf, LEAF_OPS, type OpeningTypeModel } from '../core/openingTypes';
import { pointInRings } from '../geometry/vec';
import type { Vec2 } from '../repr/primitives';
import { compassOf } from './markers';
import { openingModelOf, type OpeningObjParams } from './openingSpec';
import { resolveParams } from './registry';
import { wallFrame, type WallParams } from './wall';
import { outsideSide } from './wallSides';

/**
 * Dagsljuset (0.11.8.3): glasarean i dörrar och fönster i ytterväggar, mot
 * rummets golvarea och per väderstreck. Tumregeln är glasarea minst 10 % av
 * golvarean; den står inte i föreskriften, så varningen säger *avviker från
 * praxis*. Glasarean är glaset i karmen, i bågarna (innanför bågen) och i
 * dörrbladens glasade fyllningar, utan spröjsen.
 */

/** Tumregeln: glasarean minst så stor andel av golvarean. */
export const DAYLIGHT_SHARE = 0.1;

/** Glasarean i en typ med karmyttermåttet `w` × `h`, mm². */
export function glassAreaOf(m: OpeningTypeModel, w: number, h: number): number {
  if (m.kind === 'hole') return 0;
  let a = 0;
  for (const c of layoutOpening(m, w, h).cells) {
    const r = c.rect;
    const cw = r.u1 - r.u0;
    const ch = r.z1 - r.z0;
    if (LEAF_OPS.has(c.op)) {
      const g = leafGridOf(c);
      if (g) for (const f of layoutLeaf(g, r).fills) if (f.glass) a += (f.rect.u1 - f.rect.u0) * (f.rect.z1 - f.rect.z0);
    } else if (c.fill === 'glass') {
      const s = hasSash(c) ? Math.min(m.sash, cw / 3, ch / 3) : 0;
      a += Math.max(0, cw - 2 * s) * Math.max(0, ch - 2 * s);
    }
  }
  return a;
}

export interface GlassPane {
  id: Id;
  /** Glasarean, m². */
  area: number;
  /** En punkt strax innanför väggen, i rummet, och riktningen utåt. */
  inside: Vec2;
  out: Vec2;
  storey: Id;
}

/** Glaset i ytterväggarna, ett per dörr och fönster som finns i tillståndet. */
export function glassPanes(doc: ProjectDoc, state: Id): GlassPane[] {
  const view = { state };
  const out: GlassPane[] = [];
  const sides = new Map<Id, 1 | -1 | null>();
  for (const el of Object.values(doc.elements)) {
    if ((el.type !== 'Window' && el.type !== 'Door') || !el.host || actionOf(el, view) === 'absent' || actionOf(el, view) === 'demolished') continue;
    const host = doc.elements[el.host];
    if (!host) continue;
    if (!sides.has(host.id)) sides.set(host.id, outsideSide(doc, host));
    const side = sides.get(host.id)!;
    if (side === null) continue;
    const p = resolveParams<OpeningObjParams>(doc, el);
    const area = glassAreaOf(openingModelOf(doc, el), p.frameW, p.frameH) / 1e6;
    if (area <= 0) continue;
    const f = wallFrame(resolveParams<WallParams>(doc, host)).local(p.at);
    const n = f.normal(p.at);
    out.push({ id: el.id, area, inside: f.at(p.at, -side * (f.half + 50)), out: [n[0] * side, n[1] * side], storey: el.storey });
  }
  return out;
}

export interface RoomDaylight {
  glass: number;
  floor: number;
  /** Glasarean mot golvarean, 0–1 (0 utan golvarea). */
  share: number;
  /** Under tumregeln. */
  low: boolean;
}

/** Dagsljuset i ett rum med konturen `outline` (mm) på våningen. */
export function roomDaylight(panes: readonly GlassPane[], storey: Id, outline: readonly Vec2[], floorM2: number): RoomDaylight {
  const glass = panes.filter((g) => g.storey === storey && pointInRings(g.inside, [outline as Vec2[]])).reduce((a, g) => a + g.area, 0);
  const share = floorM2 > 0 ? glass / floorM2 : 0;
  return { glass, floor: floorM2, share, low: floorM2 > 0 && share < DAYLIGHT_SHARE };
}

/** Glasarean per väderstreck (de åtta), m², i kompassordning; bara de som har glas. */
export function glassByCompass(doc: ProjectDoc, panes: readonly GlassPane[]): { name: string; short: string; area: number; count: number }[] {
  const by = new Map<string, { name: string; short: string; area: number; count: number }>();
  for (const g of panes) {
    const c = compassOf(doc, g.out);
    const e = by.get(c.short) ?? { ...c, area: 0, count: 0 };
    e.area += g.area;
    e.count++;
    by.set(c.short, e);
  }
  const order = ['N', 'NO', 'O', 'SO', 'S', 'SV', 'V', 'NV'];
  return [...by.values()].sort((a, b) => order.indexOf(a.short) - order.indexOf(b.short));
}

/** Glas mot en fasad (det som vetter inom 45° från fasadens riktning), m². */
export function glassFacing(panes: readonly GlassPane[], dir: Vec2): { area: number; count: number } {
  const L = Math.hypot(dir[0], dir[1]) || 1;
  let area = 0;
  let count = 0;
  for (const g of panes)
    if ((g.out[0] * dir[0] + g.out[1] * dir[1]) / L > Math.SQRT1_2 - 1e-6) {
      area += g.area;
      count++;
    }
  return { area, count };
}

/** Procent med hela tal, och m² med en decimal, som i stämpeln. */
export const shareText = (d: RoomDaylight): string => `${Math.round(d.share * 100)} %`;
export const m2Text = (a: number): string => `${a.toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²`;

