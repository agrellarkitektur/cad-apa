import { actionOf } from '../../core/states';
import { refFrame } from '../../core/wallEdit';
import type { WallParams } from '../../elements/wall';
import type { Primitive } from '../../repr/primitives';
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
  return saved([plan, app.store.doc.elements, ui.storey, ui.marker, ui.worksheet, JSON.stringify(vs)], () =>
    ui.marker || ui.worksheet ? sectionSnapSegments(app) : planSnapSegments(app),
  );
}
const saved = lastResults<SnapSegment[]>(2);

function planSnapSegments(app: AppContext): SnapSegment[] {
  const { ui, plan } = app;
  const vs = app.viewStates();
  const doc = app.store.doc;
  // Väggarnas referenslinjer först, sedan väggarnas liv och möblernas kanter.
  const refs = Object.values(doc.elements)
    .filter((e) => e.type === 'Wall' && e.storey === ui.storey && actionOf(e, vs) !== 'absent')
    .flatMap((e) => {
      const p = e.params as unknown as WallParams;
      if (!p.bulge) return [{ id: e.id, a: p.start, b: p.end }];
      // Bågväggar: bågen som korta raka bitar.
      const f = refFrame(doc, e);
      const pts = f.trace(0, f.length, 0);
      return pts.slice(1).map((q, i) => ({ id: e.id, a: pts[i], b: q }));
    });
  const edges: SnapSegment[] = [];
  for (const pk of plan.pickables) {
    const el = doc.elements[pk.id];
    const type = el?.type;
    if (type === 'Underlay') {
      // Underlag (0.8.16): DXF:ens punkter och linjer, bildens kanter.
      edges.push(...underlaySegments(doc, el));
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
  return [...refs, ...edges];
}

/** Linjerna i den öppna fasaden, sektionen eller arbetsbladet, att snäppa mot. */
function sectionSnapSegments(app: AppContext): SnapSegment[] {
  const { plan } = app;
  const doc = app.store.doc;
  const out: SnapSegment[] = [];
  for (const pk of plan.pickables) {
    const el = doc.elements[pk.id];
    if (el?.type === 'Underlay') out.push(...underlaySegments(doc, el));
    else out.push(...primSegments(pk.id, pk.prims));
  }
  for (const p of plan.prims) {
    if (p.kind === 'line' && !p.origin?.objectId) out.push({ id: 'vy', a: p.a, b: p.b, on: 'På linjen' });
    if (p.kind === 'region') for (const ring of p.rings) for (let i = 0; i < ring.length; i++) out.push({ id: p.origin?.objectId ?? 'snitt', a: ring[i], b: ring[(i + 1) % ring.length], on: 'På linjen' });
  }
  return out;
}
