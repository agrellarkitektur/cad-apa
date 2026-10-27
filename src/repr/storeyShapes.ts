import type { StyleSheet } from '../core/graphics';
import type { Id, ProjectDoc } from '../core/model';
import type { Action, ViewStates } from '../core/states';
import { typeOf, type ElementType, type PlanContext, type PlanItem } from '../elements/registry';
import type { Box } from '../geometry/boolean';
import { BoxIndex } from '../geometry/boxIndex';
import { createContext } from './context';
import type { Vec2 } from './primitives';
import { lastResults } from './reuse';
import { liftShape, type Edges3D, type Shape3D, type Solid } from './solids';

export { liftShape } from './solids';

/** Vilka objekt som byggs, efter typ och åtgärd. */
export type Included = (t: ElementType, action: Action) => boolean;

/** Allt som har en 3D-form, också det som rivs (fasader och sektioner). */
export const WITH_DEMOLISHED: Included = (t) => !!(t.model3d || t.model3dBatch) && !t.only3dView;
/** Allt som har en 3D-form utom det som rivs (3D-vyn). */
export const WITHOUT_DEMOLISHED: Included = (t, action) => !!(t.model3d || t.model3dBatch) && action !== 'demolished';

export interface StoreyShapes {
  shapes: { s: Shape3D; demolished: boolean }[];
  storeys: { ctx: PlanContext; elevation: number }[];
}

/**
 * 3D-formerna för flera våningar (0.9), var och en lyft till sin golvnivå.
 * Varje våning byggs för sig, så att väggar på olika våningar inte skarvas
 * ihop. Det som rivs byggs för sig, så att det inte påverkar skarvarna i det
 * som står kvar. Utan `only` tas alla våningar med.
 *
 * Samma projekt, vy och stilmall ger samma former (0.9.3), så att fyra
 * fasader på ett blad inte bygger modellen fyra gånger. Formerna ändras
 * inte av den som får dem.
 */
export function modelShapes(doc: ProjectDoc, view: ViewStates, style: StyleSheet, include: Included, only?: Id): StoreyShapes {
  // Ytan och vyn gäller 2D-elementen, inte formerna.
  const v: ViewStates = { ...view, place: undefined, viewId: undefined };
  return saved([doc, style, include, only, JSON.stringify(v)], () => build(doc, v, style, include, only));
}
const saved = lastResults<StoreyShapes>();

function build(doc: ProjectDoc, view: ViewStates, style: StyleSheet, include: Included, only?: Id): StoreyShapes {
  const shapes: StoreyShapes['shapes'] = [];
  const storeys: StoreyShapes['storeys'] = [];
  // Bjälklagen kapar väggarna under dem (0.9.2; där de täcker dem sedan
  // 0.10.1), så de byggs först. Med bara en våning byggs bjälklagen på
  // våningarna ovanför ändå, för sig, så att väggarna ser likadana ut; där
  // behövs bara väggarna (för bjälklag ur väggarna) och bjälklagen.
  const here = only ? doc.storeys.find((s) => s.id === only) : undefined;
  const built: { elevation: number; shown: boolean; ctx: PlanContext; groups: Map<string, PlanItem[]> }[] = [];
  const slabShapes = new Map<PlanItem[], Shape3D[]>();
  const slabs: { rings: Solid['rings']; under: number }[] = [];
  for (const storey of doc.storeys) {
    const shown = !only || storey.id === only;
    if (!shown && !(here && storey.elevation > here.elevation)) continue;
    const { ctx, visible } = createContext(doc, storey.id, view, style, shown ? include : (t, action) => (t.type === 'Wall' || t.type === 'Slab') && include(t, action));
    const groups = new Map<string, PlanItem[]>();
    for (const item of visible) {
      if (!shown && item.el.type !== 'Slab') continue;
      const key = `${item.el.type}|${item.action === 'demolished' ? 'd' : 'k'}`;
      const list = groups.get(key);
      if (list) list.push(item);
      else groups.set(key, [item]);
    }
    built.push({ elevation: storey.elevation, shown, ctx, groups });
    for (const [key, items] of groups) {
      if (items[0].el.type !== 'Slab') continue;
      const made = make(items, ctx);
      slabShapes.set(items, made);
      if (key.endsWith('|d')) continue;
      for (const s of made) if (s.kind !== 'edges' && s.material === 'slab') slabs.push({ rings: s.rings, under: s.z0 + storey.elevation });
    }
  }
  // Våningen varje form kommer från, för skarvarna mellan våningarna.
  const storeyOf: number[] = [];
  for (const { elevation, shown, ctx: base, groups } of built) {
    if (!shown) continue;
    // Bjälklagen vars undersida ligger ovanför våningens golv, i dess höjder.
    const ctx: PlanContext = { ...base, slabsAbove: slabs.filter((s) => s.under > elevation).map((s) => ({ rings: s.rings, under: s.under - elevation })) };
    storeys.push({ ctx, elevation });
    for (const [key, items] of groups) {
      const demolished = key.endsWith('|d');
      for (const s of slabShapes.get(items) ?? make(items, ctx)) {
        shapes.push({ s: liftShape(s, elevation), demolished });
        storeyOf.push(storeys.length - 1);
      }
    }
  }
  if (storeys.length > 1) joinStoreys(shapes, storeyOf);
  return { shapes, storeys };
}

function make(items: PlanItem[], ctx: PlanContext): Shape3D[] {
  const t = typeOf(items[0].el.type)!;
  return t.model3dBatch ? t.model3dBatch(items, ctx) : items.flatMap(({ el }) => t.model3d!(el, ctx));
}

type Flat = { shape: number; seg: number; z: number; a: Vec2; d: Vec2; len: number; storey: number; cut: [number, number][] };

/**
 * Väggar med samma liv på två våningar har ingen linje mellan sig (0.10.1):
 * där ovansidan av en vägg och undersidan av en vägg på en annan våning har
 * samma vågräta kant, med väggen på samma sida, tas kanten bort ur båda.
 * Också mellan befintligt och nytt (0.10.11): väggarna har samma
 * fasadmaterial så länge det inte går att välja material (efter piloten;
 * då jämförs materialet här). Det som rivs är inte med. Står väggen ovanför på andra sidan kanten (kragar
 * ut) är kanten kvar, för där viker ytan. Väggen ligger till vänster om
 * varje kant, eftersom konturerna kommer ur sammanslagningen (yttre ringar
 * moturs, hål medurs).
 */
export function joinStoreys(shapes: { s: Shape3D; demolished: boolean }[], storeyOf: readonly number[]): void {
  const TOL = 0.5;
  const walls = (x: { s: Shape3D; demolished: boolean }): x is { s: Edges3D; demolished: boolean } => x.s.kind === 'edges' && x.s.part === 'wall' && !x.demolished;
  // Höjderna där kanter från mer än en våning möts; bara där prövas något.
  const storeysAt = new Map<number, number>();
  const shared = new Set<number>();
  shapes.forEach((x, i) => {
    if (!walls(x)) return;
    for (const q of x.s.segments) {
      if (Math.abs(q[2] - q[5]) > 0.01) continue;
      const key = Math.round(q[2] * 10);
      const first = storeysAt.get(key);
      if (first === undefined) storeysAt.set(key, storeyOf[i]);
      else if (first !== storeyOf[i]) shared.add(key);
    }
  });
  if (!shared.size) return;
  // De vågräta väggkanterna där, per höjd.
  const levels = new Map<number, Flat[]>();
  shapes.forEach((x, i) => {
    if (!walls(x)) return;
    x.s.segments.forEach((q, j) => {
      if (Math.abs(q[2] - q[5]) > 0.01 || !shared.has(Math.round(q[2] * 10))) return;
      const len = Math.hypot(q[3] - q[0], q[4] - q[1]);
      if (len < TOL) return;
      const f: Flat = { shape: i, seg: j, z: q[2], a: [q[0], q[1]], d: [(q[3] - q[0]) / len, (q[4] - q[1]) / len], len, storey: storeyOf[i], cut: [] };
      const key = Math.round(f.z * 10);
      const list = levels.get(key);
      if (list) list.push(f);
      else levels.set(key, [f]);
    });
  });
  const boxOfFlat = (f: Flat): Box => {
    const bx = f.a[0] + f.d[0] * f.len;
    const by = f.a[1] + f.d[1] * f.len;
    return [Math.min(f.a[0], bx) - TOL, Math.min(f.a[1], by) - TOL, Math.max(f.a[0], bx) + TOL, Math.max(f.a[1], by) + TOL];
  };
  // Öppningar som börjar vid väggens fot eller går upp till dess ovansida
  // (en dörr): där viker ytan in i hålet, så kanten är kvar.
  const holes = new Map<number, Vec2[][]>();
  for (const { s, demolished } of shapes) {
    if (s.kind === 'edges' || demolished || !s.cuts || (s.material !== 'wall' && s.material !== 'wall-new')) continue;
    for (const c of s.cuts)
      for (const z of [c.z0, c.z1]) {
        if (Math.abs(z - s.z0) > 1 && (s.top || Math.abs(z - s.z1) > 1)) continue;
        const key = Math.round(z * 10);
        const list = holes.get(key);
        if (list) list.push(c.rings[0]);
        else holes.set(key, [c.rings[0]]);
      }
  }
  const cut: Flat[] = [];
  for (const [key, list] of levels) {
    const here = holes.get(key) ?? [];
    // Bara grannar prövas mot varandra.
    const index = new BoxIndex(2000);
    list.forEach((f, i) => index.add(i, boxOfFlat(f)));
    list.forEach((f, i) => {
      for (const k of index.near(boxOfFlat(f))) {
        const g = list[k];
        if (k <= i || g.storey === f.storey) continue;
        // Samma riktning och samma linje.
        if (f.d[0] * g.d[0] + f.d[1] * g.d[1] < 0.99999) continue;
        const rx = g.a[0] - f.a[0];
        const ry = g.a[1] - f.a[1];
        if (Math.abs(rx * f.d[1] - ry * f.d[0]) > TOL) continue;
        // Där de går omlott, i var och ens längd.
        const s0 = rx * f.d[0] + ry * f.d[1];
        const lo = Math.max(0, s0);
        const hi = Math.min(f.len, s0 + g.len);
        if (hi - lo < TOL) continue;
        for (const [a, b] of without([lo, hi], here.flatMap((q) => inside(f, q) ?? []))) {
          if (b - a < TOL) continue;
          if (!f.cut.length) cut.push(f);
          if (!g.cut.length) cut.push(g);
          f.cut.push([a, b]);
          g.cut.push([a - s0, b - s0]);
        }
      }
    });
  }
  // Kanterna utan de delar som går omlott.
  const changed = new Map<number, Map<number, Edges3D['segments']>>();
  for (const f of cut) {
    const keep: Edges3D['segments'] = [];
    let from = 0;
    for (const [lo, hi] of f.cut.sort((x, y) => x[0] - y[0])) {
      if (lo - from > TOL) keep.push(along(f, from, lo));
      from = Math.max(from, hi);
    }
    if (f.len - from > TOL) keep.push(along(f, from, f.len));
    let bySeg = changed.get(f.shape);
    if (!bySeg) changed.set(f.shape, (bySeg = new Map()));
    bySeg.set(f.seg, keep);
  }
  for (const [i, bySeg] of changed) {
    const s = shapes[i].s as Edges3D;
    shapes[i] = { ...shapes[i], s: { ...s, segments: s.segments.flatMap((q, j) => bySeg.get(j) ?? [q]) } };
  }
}

function along(f: Flat, t0: number, t1: number): Edges3D['segments'][number] {
  return [f.a[0] + f.d[0] * t0, f.a[1] + f.d[1] * t0, f.z, f.a[0] + f.d[0] * t1, f.a[1] + f.d[1] * t1, f.z];
}

/** Delen av kanten som ligger i en konvex form (öppningens rektangel), i kantens längd. */
function inside(f: Flat, ring: readonly Vec2[]): [number, number][] | null {
  let t0 = 0;
  let t1 = f.len;
  // Formen kan gå åt båda hållen; normalen inåt räknas ur ytans tecken.
  let area = 0;
  for (let i = 0; i < ring.length; i++) area += ring[i][0] * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * ring[i][1];
  const sign = area >= 0 ? 1 : -1;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    // Inåt: till vänster om p→q (moturs).
    const nx = -(q[1] - p[1]) * sign;
    const ny = (q[0] - p[0]) * sign;
    const num = (f.a[0] - p[0]) * nx + (f.a[1] - p[1]) * ny;
    const den = f.d[0] * nx + f.d[1] * ny;
    if (Math.abs(den) < 1e-12) {
      if (num < 0) return null;
      continue;
    }
    const t = -num / den;
    if (den > 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t1 <= t0) return null;
  }
  return [[t0, t1]];
}

/** Intervallet utan de andra intervallen. */
function without(span: [number, number], gaps: [number, number][]): [number, number][] {
  let out: [number, number][] = [span];
  for (const [g0, g1] of gaps) out = out.flatMap(([a, b]): [number, number][] => (g1 <= a || g0 >= b ? [[a, b]] : [...(g0 > a ? [[a, g0] as [number, number]] : []), ...(g1 < b ? [[g1, b] as [number, number]] : [])]));
  return out;
}
