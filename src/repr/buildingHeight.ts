import { difference, intersection, type Rings } from '../geometry/boolean';
import type { Vec2 } from './primitives';
import { zOn } from './solids';
import { buildingFootprint } from '../elements/footprint';
import type { PlanContext } from '../elements/registry';
import { roofBodyOf, type RoofParams } from '../elements/roof';
import { meanGround } from './terrain';

/**
 * Byggnadshöjd enligt PBF 1 kap. 3 § (0.10.5): från medelmarknivån invid
 * byggnaden till skärningen mellan fasadplanet och ett plan som lutar 45°
 * inåt byggnaden och berör takets ovansida.
 *
 * För varje fasad (en kant i husets kontur, ytterväggarnas utsida) är
 * 45°-planets höjd vid fasaden det största värdet av z − d över takets
 * ovansida, där d är avståndet inåt från fasaden (negativt ute i språnget).
 * Ovansidan är plan bit för bit, så det största värdet ligger i ett hörn.
 * Ett flackt tak berörs därför vid takfotens yttre kant (språnget höjer
 * byggnadshöjden med sitt mått), ett tak brantare än 45° vid nocken.
 *
 * Byggnadshöjden gäller den beräkningsgrundande fasaden. Här är det den
 * längsta (bland lika långa, inom 1 %, den högsta), som i praxis oftast en
 * långsida; gavlarna skulle annars ge nockens höjd.
 *
 * Bara den del av taket som ligger framför fasaden räknas: mellan fasadens
 * ändar, och utanför fasaden bara det som inte står över huset (en annan
 * flygel i ett vinkelhus) och högst `OVERHANG` ut. Undantagen (kupor och
 * frontespiser under en tredjedel av takfoten, allmän plats närmare än
 * 6 m, beräkningsgrundande fasad) avgörs av den som ritar.
 */

/** Hur långt utanför fasaden ett tak räknas som fasadens språng, mm. */
const OVERHANG = 3000;
/** Fasader kortare än så räknas inte (hörn, smygar), mm. */
const MIN_FACADE = 1000;

export interface FacadeHeight {
  a: Vec2;
  b: Vec2;
  /** Normalen ut från fasaden. */
  out: Vec2;
  /** Där 45°-planet skär fasadplanet, mm från ±0. */
  z: number;
}

export interface BuildingHeight {
  /** Medelmarknivån, mm från ±0, eller null utan markmodell. */
  mmn: number | null;
  facades: FacadeHeight[];
  /** Den beräkningsgrundande fasaden: den längsta. */
  main: FacadeHeight;
  /** Byggnadshöjden (mm), när medelmarknivån är känd. */
  height: number | null;
}

/** Byggnadshöjden för huset i vyns tillstånd, eller null utan hus eller tak. */
export function buildingHeight(ctx: PlanContext): BuildingHeight | null {
  return ctx.memo('building-height', () => {
    const fp = buildingFootprint(ctx);
    if (!fp.length) return null;
    const tops = roofTops(ctx);
    if (!tops.length) return null;
    const facades: FacadeHeight[] = [];
    for (const poly of fp) {
      const ring = straight(poly[0]);
      const ccw = signedArea(ring) > 0;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const z = facadeLevel(a, b, ccw, tops, fp);
        if (z === null) continue;
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const t: Vec2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
        facades.push({ a, b, out: ccw ? [t[1], -t[0]] : [-t[1], t[0]], z });
      }
    }
    if (!facades.length) return null;
    const len = (f: FacadeHeight) => Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
    const longest = Math.max(...facades.map(len));
    const main = facades.filter((f) => len(f) >= longest * 0.99).reduce((m, f) => (f.z > m.z ? f : m));
    const mmn = meanGround(ctx);
    return { mmn, facades, main, height: mmn === null ? null : main.z - mmn };
  });
}

interface Top {
  rings: Rings;
  /** Ovansidan, mm från ±0. */
  z: (x: number, y: number) => number;
}

/** Takens ovansidor, bit för bit, med våningens golvnivå. Det som rivs räknas inte. */
function roofTops(ctx: PlanContext): Top[] {
  const doc = ctx.doc;
  const out: Top[] = [];
  for (const el of Object.values(doc.elements)) {
    if (el.type !== 'Roof' || el.space) continue;
    const act = ctx.actionOf(el);
    if (act === 'absent' || act === 'demolished') continue;
    const elevation = doc.storeys.find((s) => s.id === el.storey)?.elevation ?? 0;
    for (const pc of roofBodyOf(ctx, ctx.params<RoofParams>(el))) out.push({ rings: pc.rings, z: (x, y) => elevation + zOn(pc.top, x, y) });
  }
  return out;
}

/** 45°-planets höjd vid fasaden a–b, eller null när inget tak ligger framför den. */
function facadeLevel(a: Vec2, b: Vec2, ccw: boolean, tops: readonly Top[], fp: Rings[]): number | null {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (l < MIN_FACADE) return null;
  const t: Vec2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  const inw: Vec2 = ccw ? [-t[1], t[0]] : [t[1], -t[0]];
  const far = 1e6;
  const at = (u: number, d: number): Vec2 => [a[0] + t[0] * u + inw[0] * d, a[1] + t[1] * u + inw[1] * d];
  const inside: Rings = [[at(0, 0), at(l, 0), at(l, far), at(0, far)]];
  const outside: Rings = [[at(0, -OVERHANG), at(l, -OVERHANG), at(l, 0), at(0, 0)]];
  // Utanför fasaden: inte det som står över huset (en annan flygel).
  const over = fp.flatMap((poly) => intersection(poly, [outside]));
  const front = over.length ? difference(outside, over) : [outside];
  let best = -Infinity;
  for (const top of tops) {
    for (const zone of [[inside], front]) {
      for (const clip of intersection(top.rings, zone)) {
        for (const q of clip[0]) {
          const d = (q[0] - a[0]) * inw[0] + (q[1] - a[1]) * inw[1];
          const v = top.z(q[0], q[1]) - d;
          if (v > best) best = v;
        }
      }
    }
  }
  return Number.isFinite(best) ? best : null;
}

function signedArea(r: readonly Vec2[]): number {
  let s = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i];
    const q = r[(i + 1) % r.length];
    s += p[0] * q[1] - q[0] * p[1];
  }
  return s / 2;
}

/** Ringen utan hörn där kanten fortsätter rakt (väggar som möts i samma liv). */
function straight(r: readonly Vec2[]): Vec2[] {
  const out = r.filter((q, i) => {
    const p = r[(i + r.length - 1) % r.length];
    const n = r[(i + 1) % r.length];
    const ux = q[0] - p[0];
    const uy = q[1] - p[1];
    const vx = n[0] - q[0];
    const vy = n[1] - q[1];
    const lu = Math.hypot(ux, uy);
    const lv = Math.hypot(vx, vy);
    return lu < 1e-6 || lv < 1e-6 ? false : Math.abs(ux * vy - uy * vx) / (lu * lv) > 1e-4 || ux * vx + uy * vy < 0;
  });
  return out.length >= 3 ? out : [...r];
}
