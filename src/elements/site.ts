import type { Element, ProjectDoc } from '../core/model';
import { contours, cropGrid, DEFAULT_CONTOURS, fromRh, groundAt, terrainOf, type Contour, type Terrain } from '../core/site';
import { withHeights } from '../core/ground';
import { finishedTerrain, showsProposal, type Finished } from './ground';
import type { Pen, Primitive, Vec2 } from '../repr/primitives';
import type { Solid } from '../repr/solids';
import type { ElementType, PlanContext } from './registry';
import { contourPen } from '../repr/contourPens';
import { withWeight } from '../repr/markerPens';
import { groundDefaults } from '../core/site';
import { steepSlopePrims } from './terrainSlopes';

/** Visa-nyckeln för de branta slänterna i den befintliga marken (0.10.20), släckt från början. */
export const STEEP_SLOPES_KEY = 'steepSlopes';

/**
 * Platsen ur Höjdkurvor (0.10.3): den befintliga marken som höjdkurvor,
 * grannhusen, träden och kartans linjer (fastighetsgränser, vägar,
 * gränspunkter och stompunkter). De hör till ritningen och finns i alla
 * tillstånd. De läggs in låsta, så att de inte flyttas av misstag, och tas
 * bort och läggs in på nytt när platsen uppdateras.
 *
 * Höjderna (`mark`) är i RH 2000, så att ett nytt ±0 flyttar huset mot
 * marken, inte marken. Terrängen ritas i 3D-vyn och som marklinje i fasader
 * och sektioner för sig (`repr/terrain.ts`), inte som 3D-former.
 */

export const SITE_TYPES: ReadonlySet<string> = new Set(['Terrain', 'SiteBuilding', 'Tree', 'SiteMap']);

/** Om elementet kom med platsen (och byts ut när platsen uppdateras). */
export const isSiteElement = (el: Element): boolean => SITE_TYPES.has(el.type);

const thin: Pen = { weight: 0.13, color: 'muted' };

/** Markens höjd i modellen (mm från ±0) för något med en RH-höjd, annars marken i punkten, annars ±0. */
function baseOf(doc: ProjectDoc, mark: number | null | undefined, at: Vec2): number {
  if (doc.site && typeof mark === 'number') return fromRh(doc.site, mark);
  const t = terrainOf(doc);
  return (t && groundAt(t, at[0], at[1])) ?? 0;
}

/** Våningens golvnivå, som 3D-formerna räknas från. */
const floorOf = (ctx: PlanContext, el: Element<any>): number => ctx.doc.storeys.find((s) => s.id === el.storey)?.elevation ?? 0;

// ---------------------------------------------------------------------------
// Befintlig mark

/** Den befintliga marken: inga egna parametrar, allt finns i projektets plats. */
export type TerrainParams = Record<string, never>;

let contourCache: { key: string; data: unknown; out: Contour[] } | null = null;

/** Höjdkurvorna för projektets plats, räknade en gång per rutnät och avstånd. */
export function siteContours(doc: ProjectDoc): Contour[] {
  const t = terrainOf(doc);
  if (!t) return [];
  const interval = t.site.contours ?? DEFAULT_CONTOURS;
  const data = doc.assets[t.grid.asset]?.data;
  const key = `${t.grid.asset}|${t.grid.W}|${t.grid.H}|${t.site.origin}|${t.site.rotation}|${interval}`;
  if (contourCache && contourCache.key === key && contourCache.data === data) return contourCache.out;
  const out = contours(t, interval);
  contourCache = { key, data, out };
  return out;
}

const finishedContourCache = new WeakMap<Finished, { interval: number; out: Contour[] }>();

/**
 * Höjdkurvorna för den färdiga marken (0.10.4), bara där den skiljer sig
 * från den befintliga (rutorna som markobjekten ändrat, en nod till på varje
 * sida). Utanför är den färdiga marken den befintliga.
 */
export function finishedContours(f: Finished, interval: number): Contour[] {
  const hit = finishedContourCache.get(f);
  if (hit && hit.interval === interval) return hit.out;
  let out: Contour[] = [];
  const ch = f.changed;
  if (ch) {
    const { x0, y1, s, W, H } = f.terrain.grid;
    const i0 = Math.max(0, ch.i0 - 1);
    const i1 = Math.min(W - 1, ch.i1 + 1);
    const j0 = Math.max(0, ch.j0 - 1);
    const j1 = Math.min(H - 1, ch.j1 + 1);
    const crop = cropGrid(f.terrain, { xmin: x0 + i0 * s, xmax: x0 + i1 * s, ymin: y1 - j1 * s, ymax: y1 - j0 * s });
    if (crop) out = contours(withHeights({ ...f.terrain, grid: { ...crop.grid, asset: f.terrain.grid.asset } }, crop.z), interval);
  }
  finishedContourCache.set(f, { interval, out });
  return out;
}

/**
 * Om punkten (mm i modellen) ligger i en ruta där markobjekten ändrat
 * marken: någon av rutans fyra noder skiljer sig mer än 10 mm (0.10.8).
 */
export function changedCells(f: Finished, base: Terrain): (x: number, y: number) => boolean {
  const ch = f.changed;
  if (!ch) return () => false;
  const { x0, y1, s, W, H } = base.grid;
  const a = base.z;
  const b = f.z;
  const differs = (n: number): boolean => {
    const p = a[n];
    const q = b[n];
    if (p !== p) return q === q;
    return q !== q || Math.abs(p - q) > 0.01;
  };
  // Som `localToZone`, med vridningen räknad en gång.
  const v = (base.site.rotation * Math.PI) / 180;
  const cs = Math.cos(v);
  const sn = Math.sin(v);
  const [ox, oy] = base.site.origin;
  return (x, y) => {
    const X = ox + (x * cs - y * sn) / 1000;
    const Y = oy + (x * sn + y * cs) / 1000;
    const i = Math.min(Math.max(Math.floor((X - x0) / s), 0), W - 2);
    const j = Math.min(Math.max(Math.floor((y1 - Y) / s), 0), H - 2);
    if (i < ch.i0 - 1 || i > ch.i1 || j < ch.j0 - 1 || j > ch.j1) return false;
    const n = j * W + i;
    return differs(n) || differs(n + 1) || differs(n + W) || differs(n + W + 1);
  };
}

/** Bitarna av kurvorna där `keep` gäller för varje sträckas mitt; en hel sluten kurva förblir sluten. */
function piecesWhere(cs: readonly Contour[], keep: (x: number, y: number) => boolean): Contour[] {
  const out: Contour[] = [];
  for (const c of cs) {
    const n = c.pts.length;
    const segs = c.closed ? n : n - 1;
    let run: [number, number][] = [];
    let all = true;
    const pieces: [number, number][][] = [];
    for (let k = 0; k < segs; k++) {
      const p = c.pts[k];
      const q = c.pts[(k + 1) % n];
      if (keep((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)) {
        if (!run.length) run.push(p);
        run.push(q);
      } else {
        all = false;
        if (run.length >= 2) pieces.push(run);
        run = [];
      }
    }
    if (all) {
      out.push(c);
      continue;
    }
    if (run.length >= 2) {
      // En sluten kurvas sista bit fortsätter i den första.
      if (c.closed && pieces.length && pieces[0][0] === c.pts[0]) pieces[0] = [...run, ...pieces[0].slice(1)];
      else pieces.push(run);
    }
    for (const pts of pieces) out.push({ z: c.z, pts, closed: false });
  }
  return out;
}

/**
 * Höjdkurvorna som de ritas (0.10.8): `solid` är marken som den blir, den
 * befintliga där den inte ändrats och den färdiga där den ändrats, och
 * `old` den befintliga där markobjekten ändrat den, som ritas streckad.
 */
export interface GroundContours {
  solid: Contour[];
  old: Contour[];
}

const contourSets = new WeakMap<Finished, { src: Contour[]; fin: Contour[]; out: GroundContours }>();

export function groundContours(doc: ProjectDoc, f: Finished | null): GroundContours {
  const t = terrainOf(doc);
  if (!t) return { solid: [], old: [] };
  const all = siteContours(doc);
  if (!f || !f.changed) return { solid: all, old: [] };
  const fin = finishedContours(f, t.site.contours ?? DEFAULT_CONTOURS);
  const hit = contourSets.get(f);
  if (hit && hit.src === all && hit.fin === fin) return hit.out;
  const inside = changedCells(f, t);
  const outside = (x: number, y: number) => !inside(x, y);
  const out = { solid: [...piecesWhere(all, outside), ...piecesWhere(fin, inside)], old: piecesWhere(all, inside) };
  contourSets.set(f, { src: all, fin, out });
  return out;
}

/**
 * Höjdkurvorna för 3D-vyn (0.10.8): sträckor (x, y, z i mm från ±0, två
 * punkter per sträcka), en bit över marken så att de syns.
 */
export function contourSegments3d(doc: ProjectDoc, f: Finished | null, lift = 40): Float32Array | null {
  const t = terrainOf(doc);
  if (!t) return null;
  const { solid } = groundContours(doc, f);
  let n = 0;
  for (const c of solid) n += c.closed ? c.pts.length : c.pts.length - 1;
  const out = new Float32Array(n * 6);
  let k = 0;
  for (const c of solid) {
    const z = fromRh(t.site, c.z) + lift;
    const m = c.pts.length;
    const segs = c.closed ? m : m - 1;
    for (let i = 0; i < segs; i++) {
      const a = c.pts[i];
      const b = c.pts[(i + 1) % m];
      out[k++] = a[0];
      out[k++] = a[1];
      out[k++] = z;
      out[k++] = b[0];
      out[k++] = b[1];
      out[k++] = z;
    }
  }
  return out;
}

export const terrainType: ElementType<TerrainParams> = {
  type: 'Terrain',
  label: 'Befintlig mark',
  labelPlural: 'Befintlig mark',
  drawOrder: 1,
  compares: false,
  global: true,
  // Den färdiga marken (0.10.4) följer markobjekten, husets kontur och bjälklagen.
  planReads: ['Ground', 'Wall', 'Slab'],
  defaults: () => ({}),
  plan(el, ctx) {
    if (!terrainOf(ctx.doc)) return [];
    // Marken som den blir heldragen, den befintliga streckad bara där markobjekten ändrat den (0.10.8).
    const f = showsProposal(ctx) ? finishedTerrain(ctx) : null;
    const { solid, old } = groundContours(ctx.doc, f);
    // Pennorna ur stilmallen (granskningen efter 0.10.18) hör till nyckeln.
    const pens = { major: contourPen(ctx.style, 'contour'), minor: contourPen(ctx.style, 'contourMinor'), old: contourPen(ctx.style, 'contourOld') };
    const key = `${el.id}|${ctx.scale}|${JSON.stringify(pens)}`;
    const out = [
      ...contourPrims(solid, key, () => contourLines(solid, { objectId: el.id, objectType: 'Terrain', part: 'höjdkurva' }, ctx.scale, pens, false)),
      ...contourPrims(old, key, () => contourLines(old, { objectId: el.id, objectType: 'Terrain', part: 'befintlig mark' }, ctx.scale, pens, true)),
    ];
    // Branta slänter i den befintliga marken (0.10.20), när de är tända under Visa; inte där markobjekten ändrat marken.
    if (ctx.view.hide?.includes(`+${STEEP_SLOPES_KEY}`)) {
      const t = terrainOf(ctx.doc)!;
      const skip = f ? changedCells(f, t) : undefined;
      out.push(...steepSlopePrims(t, groundDefaults(ctx.doc.site).steepSlope, ctx.scale, { objectId: el.id, objectType: 'Terrain', part: 'brant slänt' }, skip));
    }
    return out;
  },
};

const savedPrims = new WeakMap<Contour[], { key: string; out: Primitive[] }>();

/**
 * Höjdkurvornas linjer och texter, sparade per kurvor, element och skala
 * (0.10.6): de ritas om när en vägg eller ett markobjekt ändras, men
 * kurvorna är oftast desamma.
 */
function contourPrims(cs: Contour[], key: string, make: () => Primitive[]): Primitive[] {
  const hit = savedPrims.get(cs);
  if (hit && hit.key === key) return hit.out;
  const out = make();
  savedPrims.set(cs, { key, out });
  return out;
}

/**
 * Kurvorna som linjer, med höjden utskriven på hela meter (0.10.8), med
 * stilmallens pennor (granskningen efter 0.10.18): hela meter, kurvorna
 * däremellan, och den befintliga marken där den ändrats (däremellan högst
 * 0,13). Höjden har kurvans färg.
 */
function contourLines(
  cs: readonly Contour[],
  origin: Primitive['origin'],
  scale: number,
  pens: { major: Pen; minor: Pen; old: Pen },
  old: boolean,
): Primitive[] {
  const out: Primitive[] = [];
  const oldMinor: Pen = { ...pens.old, weight: Math.min(pens.old.weight, 0.13) };
  for (const c of cs) {
    const whole = Math.abs(c.z - Math.round(c.z)) < 1e-6;
    const pen = old ? (whole ? pens.old : oldMinor) : whole ? pens.major : pens.minor;
    out.push({ kind: 'polyline', points: c.pts, closed: c.closed, pen, origin, noPick: true });
    if (!whole) continue;
    const label = contourLabel(c, (old ? 30 : 20) * scale);
    if (label) out.push({ kind: 'text', at: label.at, angle: label.angle, align: 'middle', text: c.z.toLocaleString('sv-SE'), height: 1.8, pen: withWeight(pen, old ? 0.13 : 0.18), origin, noPick: true });
  }
  return out;
}

/** Var en höjdkurva får sin höjd: mitt på den, om den är längre än `min` mm. */
function contourLabel(c: Contour, min: number): { at: Vec2; angle: number } | null {
  let len = 0;
  for (let i = 1; i < c.pts.length; i++) len += Math.hypot(c.pts[i][0] - c.pts[i - 1][0], c.pts[i][1] - c.pts[i - 1][1]);
  if (len < min) return null;
  let walked = 0;
  for (let i = 1; i < c.pts.length; i++) {
    const a = c.pts[i - 1];
    const b = c.pts[i];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (walked + l >= len / 2) {
      const f = l > 0 ? (len / 2 - walked) / l : 0;
      let angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
      if (angle > Math.PI / 2) angle -= Math.PI;
      if (angle < -Math.PI / 2) angle += Math.PI;
      return { at: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], angle };
    }
    walked += l;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Grannhus

export interface SiteBuildingParams {
  /** Fotavtrycket i modellen, mm (oftast inmätt vid takkanten). */
  points: Vec2[];
  /** Markhöjden i RH 2000 (m), eller null. */
  mark: number | null;
  /** Höjden över mark i m (platt tak), eller null. */
  height: number | null;
  /** Typ, ändamål och husnummer ur registret. */
  label?: string;
}

const DEFAULT_BUILDING_HEIGHT = 6;

export const siteBuildingType: ElementType<SiteBuildingParams> = {
  type: 'SiteBuilding',
  label: 'Grannhus',
  labelPlural: 'Grannhus',
  drawOrder: 2,
  // Befintligt, rivs eller nytt som allt annat (0.10.11; förut i alla tillstånd).
  compares: true,
  only3dView: true,
  planReads: [],
  pickSoft: true,
  defaults: () => ({ points: [], mark: null, height: null }),
  pickShape(el, ctx) {
    const p = ctx.params<SiteBuildingParams>(el);
    return p.points.length >= 3 ? [[p.points]] : [];
  },
  plan(el, ctx) {
    const p = ctx.params<SiteBuildingParams>(el);
    if (p.points.length < 3) return [];
    return [{ kind: 'polyline', points: p.points, closed: true, pen: { weight: 0.25, color: 'muted' }, origin: { objectId: el.id, objectType: 'SiteBuilding', part: 'kontur' } }];
  },
  model3d(el, ctx) {
    const p = ctx.params<SiteBuildingParams>(el);
    if (p.points.length < 3) return [];
    const c = centroid(p.points);
    const z0 = baseOf(ctx.doc, p.mark, c) - floorOf(ctx, el);
    const h = (p.height ?? DEFAULT_BUILDING_HEIGHT) * 1000;
    return [{ id: el.id, rings: [p.points], z0, z1: z0 + Math.max(h, 1000), material: 'site' }];
  },
};

function centroid(pts: readonly Vec2[]): Vec2 {
  let x = 0;
  let y = 0;
  for (const q of pts) {
    x += q[0];
    y += q[1];
  }
  return [x / pts.length, y / pts.length];
}

// ---------------------------------------------------------------------------
// Träd

export interface TreeParams {
  pos: Vec2;
  /** Kronans diameter, mm. */
  crown: number;
  /** Höjden, mm. */
  height: number;
  /** Markhöjden i RH 2000 (m), eller null. */
  mark: number | null;
}

/** En cirkel som polygon. */
function circle(c: Vec2, r: number, n: number): Vec2[] {
  return Array.from({ length: n }, (_, i): Vec2 => [c[0] + r * Math.cos((i / n) * 2 * Math.PI), c[1] + r * Math.sin((i / n) * 2 * Math.PI)]);
}

export const treeType: ElementType<TreeParams> = {
  type: 'Tree',
  label: 'Träd',
  labelPlural: 'Träd',
  drawOrder: 3,
  compares: true,
  only3dView: true,
  planReads: [],
  pickSoft: true,
  defaults: () => ({ pos: [0, 0], crown: 5000, height: 12000, mark: null }),
  pickShape(el, ctx) {
    const p = ctx.params<TreeParams>(el);
    return [[circle(p.pos, p.crown / 2, 24)]];
  },
  plan(el, ctx) {
    const p = ctx.params<TreeParams>(el);
    const origin = { objectId: el.id, objectType: 'Tree', part: 'krona' };
    const r = 0.6 * ctx.scale;
    return [
      { kind: 'polyline', points: circle(p.pos, p.crown / 2, 24), closed: true, pen: { weight: 0.18, color: 'muted' }, origin },
      { kind: 'line', a: [p.pos[0] - r, p.pos[1]], b: [p.pos[0] + r, p.pos[1]], pen: thin, origin },
      { kind: 'line', a: [p.pos[0], p.pos[1] - r], b: [p.pos[0], p.pos[1] + r], pen: thin, origin },
    ];
  },
  model3d(el, ctx) {
    const p = ctx.params<TreeParams>(el);
    const z0 = baseOf(ctx.doc, p.mark, p.pos) - floorOf(ctx, el);
    const h = Math.max(p.height, 2000);
    const trunk = Math.max(150, Math.min(400, h / 40));
    const shapes: Solid[] = [
      { id: el.id, rings: [circle(p.pos, trunk / 2, 6)], z0, z1: z0 + h * 0.4, material: 'tree', noEdges: true },
      { id: el.id, rings: [circle(p.pos, Math.max(p.crown, 1000) / 2, 10)], z0: z0 + h * 0.3, z1: z0 + h, material: 'tree', noEdges: true },
    ];
    return shapes;
  },
};

// ---------------------------------------------------------------------------
// Kartans linjer och texter

export interface SiteMapParams {
  /**
   * boundary: fastighetsgräns, road: väg, label: fastighetens beteckning,
   * point: gränspunkt, benchmark: stompunkt.
   */
  kind: 'boundary' | 'road' | 'label' | 'point' | 'benchmark';
  points?: Vec2[];
  pos?: Vec2;
  text?: string;
  /** Registrets lägesosäkerhet i m, för gränserna. */
  uncertainty?: number | null;
  /** Stompunktens höjd i RH 2000 (m). */
  z?: number;
}

export const siteMapType: ElementType<SiteMapParams> = {
  type: 'SiteMap',
  label: 'Kartobjekt',
  labelPlural: 'Kartobjekt',
  drawOrder: 4,
  compares: false,
  global: true,
  planReads: [],
  defaults: () => ({ kind: 'boundary' }),
  plan(el, ctx) {
    const p = ctx.params<SiteMapParams>(el);
    const origin = { objectId: el.id, objectType: 'SiteMap', part: p.kind };
    const s = ctx.scale;
    switch (p.kind) {
      case 'boundary': {
        if (!p.points || p.points.length < 2) return [];
        // Fastighetsgräns: streck och punkt. Osäkrare än 1 m tunnare och grå, som i Höjdkurvor.
        const unsure = (p.uncertainty ?? 0) > 1;
        return [{ kind: 'polyline', points: p.points, closed: false, pen: { weight: unsure ? 0.18 : 0.25, ...(unsure ? { color: 'muted' } : {}), dash: [6, 1, 0.5, 1] }, origin }];
      }
      case 'road':
        return p.points && p.points.length >= 2 ? [{ kind: 'polyline', points: p.points, closed: false, pen: { weight: 0.18, color: 'muted' }, origin }] : [];
      case 'label':
        return p.pos && p.text ? [{ kind: 'text', at: p.pos, text: p.text, height: 2.5, align: 'middle', pen: { weight: 0.18 }, origin }] : [];
      case 'point':
        return p.pos ? [{ kind: 'polyline', points: circle(p.pos, 0.6 * s, 12), closed: true, pen: { weight: 0.18 }, origin }] : [];
      case 'benchmark': {
        if (!p.pos) return [];
        const r = 1.5 * s;
        const tri: Vec2[] = [
          [p.pos[0], p.pos[1] + r],
          [p.pos[0] - r * 0.87, p.pos[1] - r / 2],
          [p.pos[0] + r * 0.87, p.pos[1] - r / 2],
        ];
        const text = [p.text, typeof p.z === 'number' ? `+${p.z.toLocaleString('sv-SE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}` : ''].filter(Boolean).join(' ');
        return [
          { kind: 'polyline', points: tri, closed: true, pen: { weight: 0.18 }, origin },
          ...(text ? [{ kind: 'text' as const, at: [p.pos[0] + r * 1.4, p.pos[1] - r / 2] as Vec2, text, height: 1.8, pen: { weight: 0.18 }, origin }] : []),
        ];
      }
    }
    return [];
  },
};
