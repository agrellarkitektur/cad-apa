import { signedArea } from '../geometry/chains';
import { intersection, type Rings } from '../geometry/boolean';
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
 * ovansida, där d är avståndet inåt från fasaden. Ovansidan är plan bit för
 * bit, så det största värdet ligger i ett hörn.
 *
 * Språnget räknas inte (0.10.8b, som Carl August mäter): bara den del av
 * taket som står över huset, mellan fasadens ändar. Ett tak flackare än 45°
 * berörs därför där fasadlivet möter takets ovansida, ett brantare vid
 * nocken. (0.10.5 räknade språnget med, upp till 3 m ut.)
 *
 * Byggnadshöjden gäller den beräkningsgrundande fasaden: den som linjen
 * *Beräkningsgrundande fasad* (`BasisFacade`) ligger på, annars den längsta
 * (bland lika långa, inom 1 %, den högsta). Undantagen (kupor och
 * frontespiser under en tredjedel av takfoten, allmän plats närmare än
 * 6 m) avgörs av den som ritar.
 */

/** Hur långt från en fasad linjen *Beräkningsgrundande fasad* får ligga, mm. */
const BASIS_REACH = 1500;
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
  /** Den beräkningsgrundande fasaden: den som linjen ligger på, annars den längsta. */
  main: FacadeHeight;
  /** Om `main` kommer från en ritad linje *Beräkningsgrundande fasad*. */
  basis: boolean;
  /** Byggnadshöjden (mm), när medelmarknivån är känd. */
  height: number | null;
  /** Takets högsta punkt, nocken (mm från ±0). */
  ridge: number;
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
        const z = facadeLevel(a, b, ccw, tops);
        if (z === null) continue;
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const t: Vec2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
        facades.push({ a, b, out: ccw ? [t[1], -t[0]] : [-t[1], t[0]], z });
      }
    }
    if (!facades.length) return null;
    const len = (f: FacadeHeight) => Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
    const longest = Math.max(...facades.map(len));
    const drawn = basisFacade(ctx.doc, facades);
    const main = drawn ?? facades.filter((f) => len(f) >= longest * 0.99).reduce((m, f) => (f.z > m.z ? f : m));
    const mmn = meanGround(ctx);
    let ridge = -Infinity;
    for (const top of tops) for (const ring of top.rings) for (const q of ring) ridge = Math.max(ridge, top.z(q[0], q[1]));
    return { mmn, facades, main, basis: !!drawn, height: mmn === null ? null : main.z - mmn, ridge };
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

/** 45°-planets höjd vid fasaden a–b, eller null när inget tak står över huset innanför den. */
function facadeLevel(a: Vec2, b: Vec2, ccw: boolean, tops: readonly Top[]): number | null {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (l < MIN_FACADE) return null;
  const t: Vec2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  const inw: Vec2 = ccw ? [-t[1], t[0]] : [t[1], -t[0]];
  const far = 1e6;
  const at = (u: number, d: number): Vec2 => [a[0] + t[0] * u + inw[0] * d, a[1] + t[1] * u + inw[1] * d];
  const inside: Rings = [[at(0, 0), at(l, 0), at(l, far), at(0, far)]];
  let best = -Infinity;
  for (const top of tops) {
    for (const clip of intersection(top.rings, [inside])) {
      for (const q of clip[0]) {
        const d = (q[0] - a[0]) * inw[0] + (q[1] - a[1]) * inw[1];
        const v = top.z(q[0], q[1]) - d;
        if (v > best) best = v;
      }
    }
  }
  return Number.isFinite(best) ? best : null;
}

/**
 * Fasaden som linjen *Beräkningsgrundande fasad* ligger på (0.10.8b): den
 * närmaste parallella (inom 15°) som linjens mitt ligger högst
 * `BASIS_REACH` från. Null utan linje eller när ingen fasad passar.
 */
function basisFacade(doc: PlanContext['doc'], facades: readonly FacadeHeight[]): FacadeHeight | null {
  const el = Object.values(doc.elements).find((e) => e.type === 'BasisFacade');
  if (!el) return null;
  const p = el.params as { start?: Vec2; end?: Vec2 };
  if (!p.start || !p.end) return null;
  const ll = Math.hypot(p.end[0] - p.start[0], p.end[1] - p.start[1]);
  if (ll < 1) return null;
  const u: Vec2 = [(p.end[0] - p.start[0]) / ll, (p.end[1] - p.start[1]) / ll];
  const m: Vec2 = [(p.start[0] + p.end[0]) / 2, (p.start[1] + p.end[1]) / 2];
  let best: { f: FacadeHeight; d: number } | null = null;
  for (const f of facades) {
    const fl = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
    const fu: Vec2 = [(f.b[0] - f.a[0]) / fl, (f.b[1] - f.a[1]) / fl];
    if (Math.abs(u[0] * fu[1] - u[1] * fu[0]) > Math.sin((15 * Math.PI) / 180)) continue;
    const s = Math.max(0, Math.min(fl, (m[0] - f.a[0]) * fu[0] + (m[1] - f.a[1]) * fu[1]));
    const d = Math.hypot(m[0] - f.a[0] - fu[0] * s, m[1] - f.a[1] - fu[1] * s);
    if (d <= BASIS_REACH && (!best || d < best.d)) best = { f, d };
  }
  return best?.f ?? null;
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
