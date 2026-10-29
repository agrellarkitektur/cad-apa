import { finishedGround, nearestEdge, withHeights, type Barrier, type FinishedGround, type GroundShape } from '../core/ground';
import { groundStorey, isSite, type Element, type Id } from '../core/model';
import { groundDefaults, terrainOf, type Terrain } from '../core/site';
import type { Rings } from '../geometry/boolean';
import { bufferRings } from '../geometry/offset';
import type { Vec2 } from '../repr/primitives';
import { sameItems } from '../repr/reuse';
import { buildingFootprint } from './footprint';
import type { FillParams } from './drawing2d';
import { along, barriersOf, flatPoints, lineLength, lockShape, stripRing, type RefSide } from './groundLines';
import { rampShape, rampSides, type EasePoint } from './groundRamp';
import { wallCenter, type CrestPoint } from './groundWall';
import { resolveParams, type PlanContext } from './registry';
import { slabOutline, type SlabParams } from './slab';

/**
 * Markobjekten som de räknas (0.10.4–0.10.5, för sig sedan 0.10.6):
 * parametrarna, varje objekts form för den färdiga marken, den färdiga
 * marken i vyn och stödmurens krön. Ritningen i planen ligger i
 * `groundPlan.ts`, elementtypen i `ground.ts`.
 *
 * - **Markyta** (`area`; platå och urgrävning var för sig före 0.10.7):
 *   en ritad kontur med en höjd, plan eller med fall. Kanterna möter marken
 *   med slänt (förval 1:2) eller stödmur: där marken ligger högre tas den
 *   ned (schakt, slänten går upp från ytan), där den ligger lägre fylls den
 *   upp (fyll, slänten går ned), också inom samma yta.
 * - **Markyta runt huset** (`around`): husets kontur, avståndet ut och fallet
 *   från fasaden (förval sockel 200, 1:20 de första 3 m). Följer huset.
 * - **Urgrävning under bjälklaget** (`slab`): bjälklagets kontur (med
 *   väggarna, när det följer dem) och arbetsutrymmet; botten i
 *   bjälklagets underkant. Följer bjälklaget.
 * - **Ramp/väg** (`path`, 0.10.5; en sort sedan 0.10.7): en referenslinje
 *   med bredd, höjd i början och slutet och tvärfall. Referenslinjen ligger
 *   i mitten eller på en kant, med förskjutning. Sidorna möter marken med
 *   slänt eller stödmur; brantare än gränsen (förval 1:12) ger en varning.
 * - **Höjdpunkt** och **brytlinje** (`point`, `breakline`, 0.10.5): låser
 *   marken och tonar den runt omkring inom en radie.
 * - **Stödmur** (`wall`, 0.10.5): en linje med tjocklek som slänterna inte
 *   går över. Referenslinjen i mitten eller på en kant (0.10.9); krönet
 *   följer den högre sidans mark utjämnad, eller går rakt, mellan ändarna
 *   och höjdpunkterna (se `groundWall.ts`).
 * - **Markhöjd** (`level`, 0.10.20) och **låglinje** (`drain`, 0.10.20):
 *   beteckningar som inte ändrar marken. Markhöjden skriver den befintliga
 *   och den nya höjden i punkten, låglinjen är dagvattnets väg som pilar.
 *
 * Höjderna är i mm från ±0, som allt annat i modellen. Det som saknas tas ur
 * projektets förval (`site.ground`), så att ett ändrat förval gäller alla
 * objekt som inte har ett eget värde.
 */

export type GroundKind = 'area' | 'path' | 'point' | 'breakline' | 'wall' | 'level' | 'drain';

/** Sorterna som ritas som en linje (eller en punkt) i stället för en kontur. */
export const LINE_KINDS: readonly GroundKind[] = ['path', 'point', 'breakline', 'wall', 'level', 'drain'];
export const isLineKind = (k: GroundKind | undefined): boolean => !!k && LINE_KINDS.includes(k);
/** Beteckningarna (0.10.20): markhöjd och låglinje ändrar inte marken. */
export const isMarkKind = (k: GroundKind | undefined): boolean => k === 'level' || k === 'drain';

export interface GroundParams extends Partial<FillParams> {
  kind: GroundKind;
  /** Den ritade konturen, mm. Tom för markytan runt huset och urgrävningen under ett bjälklag. */
  outline: [number, number][];
  /** Markytan runt huset. */
  around?: boolean;
  /** Bjälklaget som urgrävningen följer. */
  slab?: Id;
  /** Markytans höjd (i konturens mitt när den har fall), mm från ±0. */
  height?: number;
  /** Fallet 1:N; 0 eller utelämnat = plan. Runt huset: fallet från fasaden. */
  fall?: number;
  /** Riktningen ytan faller åt, grader moturs från x-axeln. */
  fallDir?: number;
  /** Hur kanterna möter marken. */
  edge?: 'slope' | 'wall';
  /** Släntens lutning 1:N. */
  slope?: number;
  /** Runt huset: hur långt ut, och hur långt fallet gäller (mm). */
  distance?: number;
  fallLength?: number;
  /** Runt huset: från golvet ned till marken vid fasaden (mm). */
  sockel?: number;
  /** Under bjälklaget: arbetsutrymmet (mm). */
  margin?: number;
  /** Vägens referenslinje, brytlinjen, murens linje eller höjdpunkten (en punkt), mm (0.10.5). */
  line?: [number, number][];
  /** Linjens bågar (0.10.19), eller markytans konturs (0.10.24): pilhöjd per kant, som 2D-formens `bulges`. */
  bulges?: number[];
  /** Vägens namn (0.10.7), t.ex. *Ramp* eller *Infart*; tomt = *Ramp/väg*. Stödmurens eget littera (0.10.20); tomt = numrerad, *M01*. */
  name?: string;
  /** Minsta sidolutning i procent (0.10.20), skrivs ut understruken; utelämnad = skrivs inte. Markytan och vägen. */
  minCross?: number;
  /** Vägens bredd, mm. */
  width?: number;
  /** Var referenslinjen ligger på vägen och hur långt den är förskjuten, mm (0.10.7). */
  refSide?: RefSide;
  refOffset?: number;
  /** Vägens brantaste lutning 1:N innan den varnar (0.10.7). */
  maxSlope?: number;
  /** Tvärlinjen i vägens början och slut; false = ritas inte (0.10.7). */
  startLine?: boolean;
  endLine?: boolean;
  /** Höjden i linjens slut (i början gäller `height`), mm från ±0. */
  endHeight?: number;
  /** Vägens tvärfall 1:N; positivt faller åt höger, negativt åt vänster (kring referenslinjen sedan 0.10.18). */
  crossFall?: number;
  /**
   * Rampens höjd i referenslinjens punkter mellan ändarna (0.10.18), en per
   * punkt; null eller utelämnad = punkten har ingen höjd (bara läge).
   */
  levels?: (number | null)[];
  /** Rampens ritade sidor (0.10.18); utelämnade följer referenslinjen med bredden. Med bågar (0.10.19). */
  left?: [number, number][];
  right?: [number, number][];
  leftBulges?: number[];
  rightBulges?: number[];
  /** Rampens mjuka övergångar i höjd (0.10.19): för hela rampen, radien, och per punkt. */
  ease?: boolean;
  easeRadius?: number;
  eases?: (EasePoint | null)[];
  /** Rampens sidor var för sig (0.10.18): slänt eller stödmur; utelämnad = som `edge`. */
  leftEdge?: 'slope' | 'wall';
  rightEdge?: 'slope' | 'wall';
  /** Rampens sidor var för sig (0.10.26): slänt 1:N; utelämnad = som `slope`. */
  leftSlope?: number;
  rightSlope?: number;
  /** Höjdpunkt och brytlinje: hur långt marken tonas, mm. */
  radius?: number;
  /**
   * Stödmuren: tjockleken, mm. Krönet i början är `height` (ÖK) när den är
   * satt, annars den högre sidan plus `above`; i slutet `endHeight` eller
   * `endAbove` (0.10.9).
   */
  thickness?: number;
  above?: number;
  endAbove?: number;
  /** Stödmurens höjdpunkter (0.10.9): en punkt på referenslinjen och krönets höjd där. */
  crest?: CrestPoint[];
  /** Stödmurens krön rakt mellan ändarna och höjdpunkterna, i stället för att följa marken (0.10.9). */
  straight?: boolean;
  /** Stödmurens *Över marken* mot den lägre sidans mark (0.10.12); förval den högre. */
  aboveSide?: 'high' | 'low';
  /** Uppskattad andel berg i schakten, procent (0.10.13). Utelämnad = okänd. */
  rock?: number;
  /**
   * Slänternas fyllning (0.10.14), samma inställningar som objektets egen:
   * ytan som släntmarkeringarna täcker. Utelämnad = ingen.
   */
  slopeFill?: FillParams;
}

/** Namnet på objektets sort, som i egenskaperna. */
export function groundLabel(p: Pick<GroundParams, 'kind' | 'around' | 'slab' | 'name'>): string {
  if (p.around) return 'Markyta runt huset';
  if (p.slab) return 'Urgrävning under bjälklaget';
  switch (p.kind) {
    case 'path':
      return p.name?.trim() || 'Ramp/väg';
    case 'point':
      return 'Höjdpunkt';
    case 'breakline':
      return 'Brytlinje';
    case 'wall':
      return 'Stödmur';
    case 'level':
      return 'Markhöjd';
    case 'drain':
      return 'Låglinje';
    default:
      return 'Markyta';
  }
}

/** Volymen som text, m³ med en decimal. */
/**
 * Massorna för ett markobjekt (0.10.13): netto (fyll minus schakt; plus =
 * massor som tillförs, minus = överskott som körs bort), och schakten
 * delad i berg och jord efter den uppskattade andelen berg.
 */
export function massBalance(vol: { cut: number; fill: number }, rockPercent?: number): { net: number; rock: number | null; soil: number | null } {
  const share = typeof rockPercent === 'number' && Number.isFinite(rockPercent) ? Math.max(0, Math.min(100, rockPercent)) / 100 : null;
  return { net: vol.fill - vol.cut, rock: share === null ? null : vol.cut * share, soil: share === null ? null : vol.cut * (1 - share) };
}

export const m3 = (v: number): string => `${(Math.round(v * 10) / 10).toLocaleString('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m³`;

/** Ett markobjekt som det ritas och räknas: ytans ringar, hålen (huset) och formen för den färdiga marken. */
export interface GroundGeometry {
  rings: Rings[];
  /** Det som inte hör till ytan men ligger innanför den (husets kontur runt huset). */
  holes: Vec2[][];
  /** Formen för den färdiga marken; en stödmur har ingen, bara `barriers`. */
  shape: GroundShape | null;
  /** Stödmurens linje, som slänterna inte går över. */
  barriers?: Barrier[];
  /** Vägens referenslinje (mittlinjen 0.10.7–0.10.17), som höjden och tvärfallet räknas längs; stödmurens mittlinje. */
  center?: Vec2[];
  /** Rampens sidor (0.10.18), vänster och höger i linjens riktning. */
  sides?: { left: Vec2[]; right: Vec2[] };
  /** Vilka av ringens kanter som är stödmur (0.10.18; kant i från punkt i till nästa). */
  edgeWall?: boolean[];
  /** Där höjden skrivs ut, och texten. */
  label: { at: Vec2; height: number; fall?: number };
}

export const storeyElevation = (ctx: PlanContext, id: Id): number => ctx.doc.storeys.find((s) => s.id === id)?.elevation ?? 0;

/**
 * Golvet som marken runt huset utgår från: våningen närmast ±0 när
 * markobjektet ligger på Platsen (0.10.25), annars dess egen våning.
 */
const aroundFloor = (ctx: PlanContext, el: Element<any>): number => (isSite(el.storey) ? groundStorey(ctx.doc).elevation : storeyElevation(ctx, el.storey));

function boxOfRings(polys: readonly Rings[]): [number, number, number, number] {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const poly of polys)
    for (const ring of poly)
      for (const q of ring) {
        b[0] = Math.min(b[0], q[0]);
        b[1] = Math.min(b[1], q[1]);
        b[2] = Math.max(b[2], q[0]);
        b[3] = Math.max(b[3], q[1]);
      }
  return b;
}

const savedGeometry = new WeakMap<Element<any>, { inputs: unknown[]; out: GroundGeometry | null }>();

/**
 * Markobjektets form. Räknas om bara när det som formen beror på ändras
 * (0.10.6): objektet, förvalen, våningens golvnivå, husets kontur (till
 * värdet, se `buildingFootprint`) och bjälklagets kontur, tjocklek och
 * golvnivå. En ny penna eller ett nytt namn på bjälklaget, en annan våning
 * som ändras eller ett nytt kurvavstånd räknar inte om den.
 */
export function groundGeometry(ctx: PlanContext, el: Element<any>): GroundGeometry | null {
  const p = ctx.params<GroundParams>(el);
  const doc = ctx.doc;
  const slabEl = p.slab ? doc.elements[p.slab] : undefined;
  const slabP = slabEl ? resolveParams<SlabParams>(doc, slabEl) : undefined;
  const needsFootprint = !!p.around || !!slabP?.fromWalls;
  const footprint = needsFootprint ? buildingFootprint(ctx) : null;
  const inputs = [doc.site?.ground, aroundFloor(ctx, el), footprint, slabP?.fromWalls, slabP?.outline, slabP?.bulges, slabP?.thickness, slabEl && storeyElevation(ctx, slabEl.storey)];
  const hit = savedGeometry.get(el);
  if (hit && sameItems(hit.inputs, inputs)) return hit.out;
  const out = computeGeometry(ctx, el, p, footprint, slabEl, slabP);
  savedGeometry.set(el, { inputs, out });
  return out;
}

function computeGeometry(ctx: PlanContext, el: Element<any>, p: GroundParams, footprint: Rings[] | null, slabEl: Element<any> | undefined, slabP: SlabParams | undefined): GroundGeometry | null {
  const def = groundDefaults(ctx.doc.site);
  const slope = p.edge === 'wall' ? null : Math.max(0.1, p.slope ?? def.slope);
  if (isLineKind(p.kind)) return lineGeometry(el, p, def);
  if (p.around) {
    if (!footprint?.length) return null;
    const fp = footprint.map((poly) => poly[0]);
    const distance = Math.max(0, p.distance ?? def.distance);
    const fall = p.fall ?? def.fall;
    const fallLength = Math.max(0, p.fallLength ?? def.fallLength);
    const h0 = aroundFloor(ctx, el) - (p.sockel ?? def.sockel);
    const drop = (d: number) => (fall > 0 ? Math.min(d, fallLength) / fall : 0);
    const rings = bufferRings(footprint, distance);
    const box = boxOfRings(rings);
    const edgeH = h0 - drop(distance);
    const shape: GroundShape = {
      id: el.id,
      cut: true,
      fill: true,
      slope,
      box,
      hMin: edgeH,
      hMax: h0,
      probe(x, y, cell) {
        const e = nearestEdge(fp, x, y);
        // Under huset gäller grunden (urgrävningen), inte platån; bara noderna
        // närmast fasaden får platåns höjd, så att marken mellan noderna ligger rätt vid fasaden.
        if (e.inside) return e.d > cell ? { inside: true, d: 0, h: h0, skip: true } : { inside: true, d: 0, h: h0 };
        const d = e.d;
        return d <= distance ? { inside: true, d: 0, h: h0 - drop(d) } : { inside: false, d: d - distance, h: edgeH, at: e.at };
      },
    };
    const b = boxOfRings(footprint);
    return { rings, holes: fp.map((r) => r.map((q): Vec2 => [q[0], q[1]])), shape, label: { at: [b[0] - distance / 2, (b[1] + b[3]) / 2], height: h0, fall } };
  }
  let polys: Rings[];
  let height: number;
  let fall = 0;
  if (p.slab) {
    if (!slabEl || !slabP) return null;
    const ring = slabP.fromWalls ? [] : slabOutline(slabP);
    const base: Rings[] = slabP.fromWalls ? (footprint ?? []).map((poly) => [poly[0]]) : ring.length ? [[ring]] : [];
    if (!base.length) return null;
    polys = bufferRings(base, Math.max(0, p.margin ?? def.margin));
    height = storeyElevation(ctx, slabEl.storey) - Math.max(0, slabP.thickness);
  } else {
    // Konturen med bågarna som korta raka bitar (0.10.24).
    const ring = slabOutline(p);
    if (!ring.length) return null;
    polys = [[ring]];
    height = p.height ?? 0;
    fall = p.fall ?? 0;
  }
  const flat = polys.flat();
  const box = boxOfRings(polys);
  const c: Vec2 = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
  const a = ((p.fallDir ?? 0) * Math.PI) / 180;
  const gx = fall > 0 ? -Math.cos(a) / fall : 0;
  const gy = fall > 0 ? -Math.sin(a) / fall : 0;
  const hAt = (x: number, y: number) => height + gx * (x - c[0]) + gy * (y - c[1]);
  const corners = [hAt(box[0], box[1]), hAt(box[2], box[1]), hAt(box[2], box[3]), hAt(box[0], box[3])];
  const shape: GroundShape = {
    id: el.id,
    cut: true,
    fill: !p.slab,
    slope,
    box,
    hMin: Math.min(...corners),
    hMax: Math.max(...corners),
    probe(x, y) {
      const e = nearestEdge(flat, x, y);
      return e.inside ? { inside: true, d: 0, h: hAt(x, y) } : { inside: false, d: e.d, h: hAt(e.at[0], e.at[1]), at: e.at };
    },
  };
  return { rings: polys, holes: [], shape, label: { at: c, height, ...(fall > 0 ? { fall } : {}) } };
}

function lineGeometry(el: Element<any>, p: GroundParams, def: ReturnType<typeof groundDefaults>): GroundGeometry | null {
  // Linjen med bågarna som raka bitar (0.10.19).
  const pts = flatPoints(p.line, p.bulges);
  const h0 = p.height ?? 0;
  const h1 = p.endHeight ?? h0;
  if (p.kind === 'point' || p.kind === 'level') {
    if (!pts.length) return null;
    const r = 500;
    const c = pts[0];
    const ring: Vec2[] = [[c[0] - r, c[1] - r], [c[0] + r, c[1] - r], [c[0] + r, c[1] + r], [c[0] - r, c[1] + r]];
    // Markhöjden (0.10.20) är en beteckning och ändrar inte marken.
    const shape = p.kind === 'level' ? null : lockShape(el.id, [c], h0, h0, Math.max(1, p.radius ?? def.blend));
    return { rings: [[ring]], holes: [], shape, label: { at: c, height: h0 } };
  }
  if (pts.length < 2 || lineLength(pts) < 1) return null;
  const mid = along(pts, ...midPoint(pts));
  if (p.kind === 'drain') {
    // Låglinjen (0.10.20): en beteckning, klickbar i en smal remsa.
    return { rings: [[stripRing(pts, 400)]], holes: [], shape: null, center: pts, label: { at: mid.at, height: h0 } };
  }
  if (p.kind === 'breakline') {
    const ring = stripRing(pts, 400);
    return { rings: [[ring]], holes: [], shape: lockShape(el.id, pts, h0, h1, Math.max(1, p.radius ?? def.blend)), label: { at: mid.at, height: h0 } };
  }
  if (p.kind === 'wall') {
    const th = Math.max(50, p.thickness ?? def.wallThickness);
    const center = wallCenter(pts, th, p);
    return { rings: [[stripRing(center, th)]], holes: [], shape: null, barriers: barriersOf(center), center, label: { at: mid.at, height: h0 } };
  }
  // Rampen (0.10.18): höjden längs referenslinjen, sidorna för sig.
  const sides = rampSides(p);
  if (sides.left.length < 2 || sides.right.length < 2) return null;
  const { shape, ring, wall } = rampShape(el.id, p, Math.max(0.1, p.slope ?? def.slope), sides, def);
  return { rings: [[ring]], holes: [], shape, center: pts, sides, edgeWall: wall, label: { at: mid.at, height: h0 } };
}

/** Punkten halvvägs längs linjen. */
function midPoint(pts: readonly Vec2[]): [number, number] {
  let rest = lineLength(pts) / 2;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (l >= rest && l > 0) {
      const f = rest / l;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
    }
    rest -= l;
  }
  return [pts[0][0], pts[0][1]];
}

/**
 * Markobjekten som gäller i vyn (inte de som rivs), i ritordning.
 * Urgrävningarna under bjälklag räknas först: de är schaktet för grunden,
 * som sedan fylls igen till platåerna och den övriga marken.
 */
export function groundObjects(ctx: PlanContext): Element[] {
  return ctx.memo('ground-objects', () =>
    Object.values(ctx.doc.elements)
      .filter((e) => e.type === 'Ground' && !e.space)
      .filter((e) => {
        const a = ctx.actionOf(e);
        return a !== 'absent' && a !== 'demolished';
      })
      .map((e, i) => ({ e, i, first: e.params.slab ? 0 : 1 }))
      .sort((a, b) => a.first - b.first || (a.e.order ?? 0) - (b.e.order ?? 0) || a.i - b.i)
      .map(({ e }) => e),
  );
}

export interface Finished extends FinishedGround {
  /** Markmodellen med den färdiga markens höjder. */
  terrain: Terrain;
}

let last: { inputs: unknown[]; out: Finished | null }[] = [];

/**
 * Den färdiga marken i vyn, eller null när inga markobjekt gäller (då är den
 * färdiga marken den befintliga) eller projektet saknar markmodell.
 *
 * Räknas om bara när markmodellen, platsens läge och höjd eller ett
 * markobjekts form ändras (0.10.6; inte för kurvavståndet eller jorden i
 * sektionerna). Då börjar den efter objekten före det som ändrats, som är
 * sig lika (`finishedGround` med det senaste svaret).
 */
export function finishedTerrain(ctx: PlanContext): Finished | null {
  return ctx.memo('finished-terrain', () => {
    const t = terrainOf(ctx.doc);
    if (!t) return null;
    const els = groundObjects(ctx);
    if (!els.length) return null;
    // Beteckningarna (markhöjder och låglinjer, 0.10.20) formar inte marken och räknar inte om den.
    const geoms = els.map((e) => groundGeometry(ctx, e)).filter((g) => !!g?.shape || !!g?.barriers?.length);
    const { site: s, grid: g } = t;
    const inputs = [t.z, g.x0, g.y1, g.s, g.W, g.H, s.origin[0], s.origin[1], s.rotation, s.datum, ...geoms];
    const hit = last.find((x) => sameItems(x.inputs, inputs));
    if (hit) return hit.out;
    const shapes = geoms.flatMap((g) => (g?.shape ? [g.shape] : []));
    const barriers = geoms.flatMap((g) => g?.barriers ?? []);
    let out: Finished | null = null;
    if (shapes.length) {
      const f = finishedGround(t, shapes, barriers, last.find((x) => x.out)?.out);
      out = { ...f, terrain: withHeights(t, f.z, f) };
    }
    // De senaste svaren, t.ex. för förslag A och B och en kalkerad vy samtidigt.
    last = [{ inputs, out }, ...last.slice(0, 5)];
    return out;
  });
}

/** Om vyn visar ett förslag (inte Befintligt): då ritas den färdiga marken tjock. */
export function showsProposal(ctx: PlanContext): boolean {
  return ctx.doc.states.find((s) => s.id === ctx.view.state)?.kind !== 'existing';
}
