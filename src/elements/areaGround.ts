import { terrainOf, groundAt } from '../core/site';
import { union, type Rings } from '../geometry/boolean';
import { pointInRings } from '../geometry/vec';
import type { Vec2 } from '../repr/primitives';
import { finishedTerrain } from './groundGeometry';
import type { PlanContext } from './registry';
import { bareWallUnion, wallFrame, type WallParams } from './wall';
import { outsideSide } from './wallSides';

/**
 * Våning helt eller delvis under mark (0.12.4), SS 21054:2020 10.3.1.3,
 * 11.3.1.3 och 18.3.3.
 *
 * Längs ytterväggarna där golvet ligger i nivå med eller över den färdiga
 * marken utanför räknas en zon 6,00 m in från väggens insida som ovan mark.
 * I ett invändigt hörn förlängs zonens linjer tills de möts. En fasad där
 * marken ligger över golvet ger ingen zon, som en vägg mot en annan byggnad
 * (figur 28f). Utan markmodell ligger allt ovan mark.
 */

/** Zonens djup från ytterväggens insida, mm. */
export const ZONE_DEPTH = 6000;
/** Marken läses så här långt utanför väggens utsida, mm. */
const PROBE = 300;
/** Avståndet mellan punkterna längs väggen, mm. */
const STEP = 250;
/** Golvet räknas i nivå med marken inom så här mycket, mm. */
const LEVEL_TOL = 20;

/**
 * Zonen ovan mark på våningen, eller null när golvet ligger i nivå med eller
 * över marken längs alla ytterväggar (eller marken saknas): då är hela
 * våningen ovan mark.
 */
export function aboveGroundZone(ctx: PlanContext): Rings[] | null {
  return ctx.memo('area-ground-zone', () => {
    const here = ctx.storey ? ctx.doc.storeys.find((s) => s.id === ctx.storey) : undefined;
    if (!here || here.site) return null;
    const t = finishedTerrain(ctx)?.terrain ?? terrainOf(ctx.doc);
    if (!t) return null;
    const floor = here.elevation;
    const walls = ctx.visible('Wall').filter((el) => {
      const a = ctx.actionOf(el);
      return a !== 'absent' && a !== 'demolished';
    });
    const sides = walls.map((el) => ({ el, side: outsideSide(ctx.doc, el), p: ctx.params<WallParams>(el) })).filter((w) => w.side !== null);
    // Husets kontur, för att se om fasadens linje går in i huset vid ett invändigt hörn.
    const outline = sides.length ? houseOutline(ctx) : [];
    const strips: Rings[] = [];
    let buried = false;
    for (const { p, side } of sides) {
      const f = wallFrame(p);
      const o = side!;
      const n = Math.max(2, Math.ceil(f.length / STEP));
      const open: boolean[] = [];
      for (let i = 0; i <= n; i++) {
        const q = f.at((f.length * i) / n, o * (f.half + PROBE));
        const g = groundAt(t, q[0], q[1]);
        open.push(g === null || floor >= g - LEVEL_TOL);
      }
      if (open.some((x) => !x)) buried = true;
      // Sträckorna där golvet ligger över marken, med gränsen mitt mellan punkterna.
      for (let i = 0; i <= n; i++) {
        if (!open[i] || (i > 0 && open[i - 1])) continue;
        let j = i;
        while (j < n && open[j + 1]) j++;
        let s0 = i === 0 ? 0 : (f.length * (i - 0.5)) / n;
        let s1 = j === n ? f.length : (f.length * (j + 0.5)) / n;
        // Invändigt hörn: fasadens linje fortsätter in i huset, och zonen förlängs dit.
        const into = (s: number, dir: 1 | -1) => outline.some((r) => pointInRings(f.at(s + dir * 500, o * (f.half + 50)), [r]));
        // Vid väggens ände: över hörnet (halva tjockleken), och i ett invändigt hörn tills linjerna möts.
        if (i === 0) s0 -= into(0, -1) ? ZONE_DEPTH : f.half;
        if (j === n) s1 += into(f.length, 1) ? ZONE_DEPTH : f.half;
        // Från väggens utsida, så att BTA(o) får med väggen, till 6 m in från insidan.
        const a = o * (f.half + 1);
        const b = -o * (f.half + ZONE_DEPTH);
        const inner = f.arc ? f.trace(s0, s1, a) : [f.at(s0, a), f.at(s1, a)];
        const deep = f.arc ? f.trace(s0, s1, b) : [f.at(s0, b), f.at(s1, b)];
        strips.push([[...inner, ...deep.reverse()].map((v): Vec2 => [v[0], v[1]])]);
      }
    }
    if (!buried) return null;
    return strips.length > 1 ? union(strips) : strips;
  });
}

/** Husets ytterkonturer på våningen (väggarnas yttre ringar). */
function houseOutline(ctx: PlanContext): Vec2[][] {
  return ctx.memo('area-ground-outline', () => {
    const els = ctx.visible('Wall');
    return bareWallUnion(els.map((el) => ({ id: el.id, p: ctx.params<WallParams>(el) }))).map((poly) => poly[0]);
  });
}

