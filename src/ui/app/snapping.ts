import { actionOf } from '../../core/states';
import { refFrame } from '../../core/wallEdit';
import type { WallParams } from '../../elements/wall';
import type { Primitive, Vec2 } from '../../repr/primitives';
import type { SnapSegment } from '../tools/snap';
import type { AppContext } from './context';
import { lastResults } from '../../repr/reuse';
import { underlaySnaps, type UnderlayParams } from '../../elements/underlay';
import { resolveParams } from '../../elements/registry';
import type { Element, ProjectDoc } from '../../core/model';

/** Underlagets punkter och linjer (0.8.16). */
function underlaySegments(doc: ProjectDoc, el: Element): SnapSegment[] {
  return underlaySnaps(doc, el.id, resolveParams<UnderlayParams>(doc, el));
}

/** Linjer och polylinjer som sträckor att snäppa mot. */
function primSegments(id: string, prims: readonly Primitive[]): SnapSegment[] {
  const out: SnapSegment[] = [];
  for (const p of prims) {
    if (p.kind === 'line') out.push({ id, a: p.a, b: p.b, on: 'På linjen' });
    else if (p.kind === 'polyline') {
      const n = p.points.length;
      for (let i = 0; i + 1 < n + (p.closed ? 1 : 0); i++) out.push({ id, a: p.points[i], b: p.points[(i + 1) % n], on: 'På linjen' });
    }
  }
  return out;
}

/**
 * Det verktygen snäpper mot: i planen väggarnas referenslinjer, väggarnas
 * liv, möblernas kanter, 2D-element och underlag; i fasader,
 * sektioner och på arbetsblad linjerna i ritningen.
 */
export function snapSegments(app: AppContext): SnapSegment[] {
  const { ui, plan } = app;
  // Samma plan och samma vy ger samma lista (0.8.3): verktygen frågar vid
  // varje musrörelse, och listan bär rutnätet som snäppningen söker i.
  const vs = app.viewStates();
  const traced = app.uiSettings.snapTrace ? app.view.underlayPrimitives : NO_PRIMS;
  return saved([plan, traced, app.store.doc.elements, ui.storey, ui.marker, ui.worksheet, JSON.stringify(vs)], () =>
    ui.marker || ui.worksheet ? sectionSnapSegments(app) : [...planSnapSegments(app), ...tracedSegments(traced)],
  );
}
const saved = lastResults<SnapSegment[]>(2);
const NO_PRIMS: readonly Primitive[] = [];

function planSnapSegments(app: AppContext): SnapSegment[] {
  const { ui, plan } = app;
  const vs = app.viewStates();
  const doc = app.store.doc;
  // Väggarnas referenslinjer först, sedan väggarnas liv och möblernas kanter.
  const refs = Object.values(doc.elements)
    .filter((e) => e.type === 'Wall' && e.storey === ui.storey && actionOf(e, vs) !== 'absent')
    .flatMap((e) => {
      const p = e.params as unknown as WallParams;
      if (!p.bulge) return [{ id: e.id, a: p.start, b: p.end, ref: true }];
      // Bågväggar: bågen som korta raka bitar.
      const f = refFrame(doc, e);
      const pts = f.trace(0, f.length, 0);
      return pts.slice(1).map((q, i) => ({ id: e.id, a: pts[i], b: q, ref: true }));
    });
  const edges: SnapSegment[] = [];
  for (const pk of plan.pickables) {
    const el = doc.elements[pk.id];
    const type = el?.type;
    if (type === 'Underlay') {
      // Underlag (0.8.16): DXF:ens punkter och linjer, bildens kanter.
      // En lång lista läggs till en och en: spridd i ett anrop kan den bli för lång för webbläsaren.
      for (const s of underlaySegments(doc, el)) edges.push(s);
      continue;
    }
    if (type === 'Shape2D') {
      // 2D-former (0.8 del 2, 0.8.19): linjen, också när den inte ritas.
      edges.push(...primSegments(pk.id, pk.prims));
      continue;
    }
    if (type !== 'Wall' && type !== 'Furniture') continue;
    for (const rings of pk.regions)
      for (const ring of rings) for (let i = 0; i < ring.length; i++) edges.push({ id: pk.id, a: ring[i], b: ring[(i + 1) % ring.length] });
  }
  // Allt annat som ritas (0.10.22): ur primitiverna, så att nya objekttyper följer med av sig själva.
  for (const s of drawnSegments(plan.prims)) edges.push(s);
  return [...refs, ...edges];
}

/** Typerna som snäpps mot ovan, ur sina former och parametrar. */
const OWN_SNAPS = new Set(['Wall', 'Furniture', 'Underlay', 'Shape2D']);
/** Typer utan något att snäppa mot: texter och beteckningar. */
const NO_SNAP_TYPES = new Set(['Text', 'Label', 'Stamp', 'ScaleBar', 'North']);
/**
 * Delar av objekten som är beteckningar, inte form (0.10.22): släntstreck,
 * fallpilar, lutningar, litteror, texter och fyllningar. De snäpps inte.
 */
const NO_SNAP_PARTS = new Set(['slänt', 'släntkontur', 'brant slänt', 'fall', 'lutning', 'sidolutning', 'taklutning', 'littera', 'rumstext', 'markhöjd', 'markering', 'höjd', 'fyllning', 'släntens fyllning', 'label', 'auto']);
/** Linjer som snäpps på men inte i ändar och mittpunkter: höjdkurvorna, som är delade i många korta bitar. */
const CURVE_PARTS = new Set(['höjdkurva', 'befintlig mark']);
/** Texten när man ligger på linjen, per typ eller del. */
function onLabel(type: string | undefined, part: string | undefined): string {
  if (part === 'boundary') return 'På fastighetsgränsen';
  if (part === 'road') return 'På vägen';
  if (part === 'höjdkurva' || part === 'befintlig mark') return 'På höjdkurvan';
  if (type === 'SiteBuilding') return 'På byggnaden';
  if (type === 'Ground') return 'På markobjektet';
  if (type === 'Slab') return 'På bjälklaget';
  if (type === 'Roof' || type === 'RoofSlope') return 'På taket';
  if (type === 'Space') return 'På rummet';
  if (type === 'Tree') return 'På trädet';
  return 'På linjen';
}

/**
 * Det som ritas i planen och inte har egna snäpp-punkter (0.10.22): linjer,
 * polylinjer, ytornas kanter och bågar ur primitiverna, med objektets id.
 * Höjdkurvorna (som annars inte går att klicka på) snäpps på men ger inga
 * ändpunkter; texter, bilder och beteckningar ingår inte.
 */
export function drawnSegments(prims: readonly Primitive[]): SnapSegment[] {
  const out: SnapSegment[] = [];
  for (const p of prims) {
    const o = p.origin;
    const id = o?.objectId;
    if (!id || (o.objectType && (OWN_SNAPS.has(o.objectType) || NO_SNAP_TYPES.has(o.objectType)))) continue;
    if (o.tag || (o.part && NO_SNAP_PARTS.has(o.part))) continue;
    const curve = !!o.part && CURVE_PARTS.has(o.part);
    if (p.noPick && !curve) continue;
    const on = onLabel(o.objectType, o.part);
    const seg = (a: Vec2, b: Vec2): void => {
      if (a[0] !== b[0] || a[1] !== b[1]) out.push(curve ? { id, a, b, on, curve: true } : { id, a, b, on });
    };
    if (p.kind === 'line') seg(p.a, p.b);
    else if (p.kind === 'polyline') {
      const n = p.points.length;
      for (let i = 0; i + 1 < n + (p.closed ? 1 : 0); i++) seg(p.points[i], p.points[(i + 1) % n]);
    } else if (p.kind === 'region') {
      if (p.noOutline && p.ownFill) continue;
      for (const ring of p.rings) for (let i = 0; i < ring.length; i++) seg(ring[i], ring[(i + 1) % ring.length]);
    } else if (p.kind === 'arc') out.push(...arcSegments(id, p.center, p.radius, p.start, p.end, on));
  }
  return out;
}

/** En båge som korta bitar att snäppa på, med ändarna, mitten och centrum som punkter (0.10.22). */
function arcSegments(id: string, c: Vec2, r: number, start: number, end: number, on: string): SnapSegment[] {
  let sweep = end - start;
  while (sweep <= 0) sweep += Math.PI * 2;
  const full = Math.abs(sweep - Math.PI * 2) < 1e-6;
  const n = Math.max(4, Math.ceil(sweep / (Math.PI / 24)));
  const at = (t: number): Vec2 => [c[0] + r * Math.cos(start + sweep * t), c[1] + r * Math.sin(start + sweep * t)];
  const out: SnapSegment[] = [];
  for (let i = 0; i < n; i++) out.push({ id, a: at(i / n), b: at((i + 1) / n), curve: true, on });
  const pt = (q: Vec2, point: SnapSegment['point']): void => void out.push({ id, a: q, b: q, point });
  pt(c, 'center');
  if (!full) {
    pt(at(0), 'endpoint');
    pt(at(1), 'endpoint');
    pt(at(0.5), 'midpoint');
  } else for (let k = 0; k < 4; k++) pt([c[0] + r * Math.cos((k * Math.PI) / 2), c[1] + r * Math.sin((k * Math.PI) / 2)], 'quadrant');
  return out;
}

/**
 * Kalkeringen (0.10.11): linjerna och ytornas kanter i den kalkerade vyn
 * eller våningen. De kommer sist, så att ritningens egna punkter går före
 * när två ligger lika nära.
 */
function tracedSegments(prims: readonly Primitive[]): SnapSegment[] {
  const out: SnapSegment[] = [];
  for (const p of prims) {
    if (p.noPick) continue;
    if (p.kind === 'line') out.push({ id: 'kalkering', a: p.a, b: p.b, on: 'På kalkeringen' });
    else if (p.kind === 'polyline') {
      const n = p.points.length;
      for (let i = 0; i + 1 < n + (p.closed ? 1 : 0); i++) out.push({ id: 'kalkering', a: p.points[i], b: p.points[(i + 1) % n], on: 'På kalkeringen' });
    } else if (p.kind === 'region') for (const ring of p.rings) for (let i = 0; i < ring.length; i++) out.push({ id: 'kalkering', a: ring[i], b: ring[(i + 1) % ring.length], on: 'På kalkeringen' });
  }
  return out;
}

/** Linjerna i den öppna fasaden, sektionen eller arbetsbladet, att snäppa mot. */
function sectionSnapSegments(app: AppContext): SnapSegment[] {
  const { plan } = app;
  const doc = app.store.doc;
  const out: SnapSegment[] = [];
  for (const pk of plan.pickables) {
    const el = doc.elements[pk.id];
    if (el?.type === 'Underlay') for (const s of underlaySegments(doc, el)) out.push(s);
    else out.push(...primSegments(pk.id, pk.prims));
  }
  for (const p of plan.prims) {
    if (p.kind === 'line' && !p.origin?.objectId) out.push({ id: 'vy', a: p.a, b: p.b, on: 'På linjen' });
    if (p.kind === 'region') for (const ring of p.rings) for (let i = 0; i < ring.length; i++) out.push({ id: p.origin?.objectId ?? 'snitt', a: ring[i], b: ring[(i + 1) % ring.length], on: 'På linjen' });
  }
  return out;
}
