import type { Element } from '../../core/model';
import { dist } from '../../geometry/vec';
import type { WallParams } from '../../elements/wall';
import { holeShape, holesOf, shapeNodes, shapeOf } from '../../elements/shapeEdit';
import { roofGripsInView, type RoofGrip } from '../../elements/roofGrips';
import type { UnderlayParams } from '../../elements/underlay';
import { hasImageGrips, underlayGrips, type UnderlayGrip } from '../../elements/underlayEdit';
import { resolveParams } from '../../elements/registry';
import type { GroundParams } from '../../elements/ground';
import { along, lineLength } from '../../elements/groundLines';
import { pickableById } from '../../repr/plan';
import type { Primitive, Vec2 } from '../../repr/primitives';
import { distToPrim } from '../../view2d/pick';
import type { ViewPointer } from '../../view2d/planView';
import { pxToMm, type ToolHost } from './host';

/**
 * Greppen som Markera hittar under markören (ur selectTool.ts i 0.8.23):
 * ändarna på markerade väggar och för hand placerade sektions- och
 * fasadmarkörer, punkterna i markerade 2D-former, greppen i en markerad bild,
 * takets nock och takfot i en fasad eller sektion, och rumsstämpeln i ett
 * markerat rum. Allt gäller bara det markerade, så inget söks i hela
 * projektet vid varje musrörelse.
 */

/** Hur nära ett grepp markören ska vara, px. */
export const GRIP_PX = 14;

/** Rumsstämpelns text och pil. */
export const isRoomLabel = (q: Primitive): q is Primitive => q.origin?.part === 'rumstext';

/** En sektions- eller fasadmarkör som placerats för hand och har grepp i ändarna. */
export function isManualMarker(el: Element | undefined): el is Element {
  return !!el && (el.type === 'Section' || el.type === 'Elevation' || el.type === 'BasisFacade') && !el.params.auto && !el.locked;
}

export interface EndGrip {
  /** Väggen, sektions- eller fasadmarkören, eller takfallet (referenslinjen, 0.10) vars ände dras. */
  wallId: string;
  kind: 'wall' | 'marker' | 'roofRef';
  end: 'start' | 'end';
  from: Vec2;
}

/** Andra markerade väggar vars ände ligger i samma punkt; de följer med. */
export type Companions = { id: string; end: 'start' | 'end'; fixed: Vec2 }[];

/** Grepp i ändarna på markerade väggar och på sektions- och fasadmarkörer som placerats för hand. */
export function endGripAt(host: ToolHost, pt: Vec2): EndGrip | null {
  const tol = pxToMm(host, GRIP_PX);
  const doc = host.store.doc;
  let best: (EndGrip & { d: number }) | null = null;
  for (const id of host.selection.list()) {
    const el = doc.elements[id];
    if (el?.type === 'Roof' && Array.isArray(el.params.ref) && !el.locked) {
      const ref = el.params.ref as [Vec2, Vec2];
      (['start', 'end'] as const).forEach((end, i) => {
        const d = dist(ref[i], pt);
        if (d <= tol && (!best || d < best.d)) best = { wallId: id, kind: 'roofRef', end, from: ref[i], d };
      });
      continue;
    }
    const kind = el?.type === 'Wall' ? 'wall' : isManualMarker(el) ? 'marker' : null;
    if (!kind) continue;
    const p = el.params as unknown as WallParams;
    for (const end of ['start', 'end'] as const) {
      const d = dist(p[end], pt);
      if (d <= tol && (!best || d < best.d)) best = { wallId: id, kind, end, from: p[end], d };
    }
  }
  return best;
}

/** Andra markerade väggar som har en ände i samma punkt. */
export function companionsAt(host: ToolHost, wallId: string, at: Vec2): Companions {
  const doc = host.store.doc;
  const out: Companions = [];
  if (doc.elements[wallId]?.type !== 'Wall') return out;
  for (const id of host.selection.list()) {
    if (id === wallId) continue;
    const el = doc.elements[id];
    if (el?.type !== 'Wall') continue;
    const p = el.params as unknown as WallParams;
    if (dist(p.start, at) <= 1) out.push({ id, end: 'start', fixed: p.end });
    else if (dist(p.end, at) <= 1) out.push({ id, end: 'end', fixed: p.start });
  }
  return out;
}

/** Greppen i en ensam markerad bild eller PDF-sida som går att ändra (0.8.16). */
export function underlayGripsShown(host: ToolHost): ReturnType<typeof underlayGrips> {
  const ids = host.selection.list();
  if (ids.length !== 1) return [];
  const doc = host.store.doc;
  const el = doc.elements[ids[0]];
  if (el?.type !== 'Underlay' || el.locked) return [];
  if (host.readOnly?.() && !host.canEdit?.(el.id)) return [];
  if (!pickableById(host.plan().pickables).has(el.id)) return [];
  const p = resolveParams<UnderlayParams>(doc, el);
  return hasImageGrips(p) ? underlayGrips(p) : [];
}

export function underlayGripAt(host: ToolHost, pt: Vec2, touch: boolean): { id: string; grip: UnderlayGrip; from: Vec2 } | null {
  const tol = pxToMm(host, touch ? 18 : GRIP_PX);
  const id = host.selection.list()[0];
  let best: { id: string; grip: UnderlayGrip; from: Vec2; d: number } | null = null;
  for (const g of underlayGripsShown(host)) {
    // Hörnen före sidorna när de ligger nära varandra (en liten bild).
    const d = dist(g.at, pt) + (g.kind === 'side' ? tol / 4 : 0);
    if (d <= tol && (!best || d < best.d)) best = { id, grip: { kind: g.kind, index: g.index }, from: g.at, d };
  }
  return best;
}

/**
 * Punkten i ett markerat 2D-element, eller i en håltagning i ett markerat
 * bjälklag (0.9.4, `hole`), som ligger närmast, om något går att ändra här.
 */
export function shapeNodeAt(host: ToolHost, pt: Vec2, touch: boolean): { id: string; hole?: number; index: number; from: Vec2 } | null {
  const doc = host.store.doc;
  const ids = host.selection.list().filter((id) => shapeOf(doc.elements[id]) || holesOf(doc.elements[id]).length);
  if (!ids.length) return null;
  const tol = pxToMm(host, touch ? 18 : 10);
  const ro = !!host.readOnly?.();
  const shown = pickableById(host.plan().pickables);
  let best: { id: string; hole?: number; index: number; from: Vec2; d: number } | null = null;
  const take = (id: string, hole: number | undefined, nodes: Vec2[]) =>
    nodes.forEach((q, index) => {
      const d = dist(q, pt);
      if (d <= tol && (!best || d < best.d)) best = { id, ...(hole !== undefined ? { hole } : {}), index, from: q, d };
    });
  for (const id of ids) {
    const el = doc.elements[id];
    if (!shown.has(id) || (ro && !host.canEdit?.(id))) continue;
    const own = shapeOf(el);
    // Takfallens kontur (0.10) och håltagningarna finns bara i planen.
    if (own && (el.type === 'Shape2D' || !ro)) take(id, undefined, shapeNodes(own));
    else if (!ro) holesOf(el).forEach((h, hole) => take(id, hole, shapeNodes(holeShape(h))));
  }
  return best;
}

/** Greppen i nock och takfot för de markerade taken, i fasaden eller sektionen som är öppen. */
export function roofGripsShown(host: ToolHost): RoofGrip[] {
  const space = host.readOnly?.() ? host.space?.() : undefined;
  if (!space) return [];
  const doc = host.store.doc;
  if (doc.elements[space]?.type !== 'Section' && doc.elements[space]?.type !== 'Elevation') return [];
  const roofs = host.selection.list().filter((id) => doc.elements[id]?.type === 'Roof');
  return roofs.length ? roofGripsInView(doc, space, roofs) : [];
}

export function roofGripAt(host: ToolHost, pt: Vec2, touch: boolean): RoofGrip | null {
  const tol = pxToMm(host, touch ? 20 : GRIP_PX);
  let best: { g: RoofGrip; d: number } | null = null;
  for (const g of roofGripsShown(host)) {
    const d = dist(g.at, pt);
    if (d <= tol && (!best || d < best.d)) best = { g, d };
  }
  return best?.g ?? null;
}

/**
 * Rumsstämpelns mittpunkt om punkten ligger på stämpeln i ett markerat rum
 * (texten eller pilen), annars null (0.8.17).
 */
export function roomLabelAt(host: ToolHost, id: string, p: ViewPointer): Vec2 | null {
  const el = host.store.doc.elements[id];
  if (el?.type !== 'Space') return null;
  const item = pickableById(host.plan().pickables).get(id);
  const prims = item?.prims.filter(isRoomLabel) ?? [];
  const tol = pxToMm(host, p.pointerType === 'touch' ? 14 : 6);
  if (!prims.some((q) => distToPrim(p.model, q, host.view.drawingScale) <= tol)) return null;
  const own = (el.params as { labelAt?: [number, number] }).labelAt;
  if (own) return [own[0], own[1]];
  // Stämpeln står i mitten av texterna.
  const texts = prims.filter((q) => q.kind === 'text');
  const ys = texts.map((q) => q.at[1]);
  const xs = texts.map((q) => q.at[0]);
  const s = host.view.drawingScale;
  const left = texts[0]?.align === 'start';
  const widest = Math.max(...texts.map((q) => q.text.length * q.height * 0.62)) * s;
  const top = Math.max(...ys) + (texts[0]?.height ?? 0) * s / 3;
  const bottom = Math.min(...ys) + (texts[texts.length - 1]?.height ?? 0) * s / 3;
  return [left ? xs[0] + widest / 2 : xs[0], (top + bottom) / 2];
}

/** En höjdpunkt på en markerad stödmur (0.10.13), som dras längs referenslinjen. */
export interface CrestGrip {
  id: string;
  index: number;
  at: Vec2;
}

/** Höjdpunkterna på de markerade stödmurarna, i planen. */
export function crestGripsShown(host: ToolHost): CrestGrip[] {
  if (host.readOnly?.()) return [];
  const doc = host.store.doc;
  const out: CrestGrip[] = [];
  for (const id of host.selection.list()) {
    const el = doc.elements[id];
    if (el?.type !== 'Ground' || el.params.kind !== 'wall') continue;
    const p = resolveParams<GroundParams>(doc, el);
    const line = (p.line ?? []) as Vec2[];
    if (line.length < 2) continue;
    // Greppet på referenslinjen, rakt ut från punkten där den klickades.
    (p.crest ?? []).forEach((c, index) => out.push({ id, index, at: along(line, c.at[0], c.at[1]).at as Vec2 }));
  }
  return out;
}

/** Höjdpunkten under markören, om någon. */
export function crestGripAt(host: ToolHost, pt: Vec2, touch: boolean): CrestGrip | null {
  const tol = pxToMm(host, touch ? 18 : 10);
  let best: (CrestGrip & { d: number }) | null = null;
  for (const g of crestGripsShown(host)) {
    const d = dist(g.at, pt);
    if (d <= tol && (!best || d < best.d)) best = { ...g, d };
  }
  return best;
}

/** Var höjdpunkten hamnar när den dras: på referenslinjen, minst 100 mm från ändarna. Null utanför muren. */
export function crestDragTo(host: ToolHost, id: string, pt: Vec2): Vec2 | null {
  const el = host.store.doc.elements[id];
  if (!el) return null;
  const line = (resolveParams<GroundParams>(host.store.doc, el).line ?? []) as Vec2[];
  if (line.length < 2) return null;
  const a = along(line, pt[0], pt[1]);
  const total = lineLength(line);
  if (total < 300) return null;
  const s = Math.max(100, Math.min(total - 100, a.s));
  const q = s === a.s ? a.at : pointAt(line, s);
  return [Math.round(q[0]), Math.round(q[1])];
}

/** Punkten `s` mm längs linjen. */
function pointAt(line: readonly Vec2[], s: number): Vec2 {
  let left = s;
  for (let i = 1; i < line.length; i++) {
    const l = dist(line[i - 1], line[i]);
    if (left <= l || i === line.length - 1) {
      const f = l ? Math.min(1, left / l) : 0;
      return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * f, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * f];
    }
    left -= l;
  }
  return line[line.length - 1];
}

/** Ett höjdmått (BH, NH, TH) i en öppen fasad eller sektion (0.10.13), som dras i sidled. */
export interface HeightGrip {
  marker: string;
  key: 'bh' | 'nh' | 'th';
  /** Greppet: måttets överände, i vyns mått. */
  at: Vec2;
}

/** Höjdmåtten i fasaden eller sektionen som är öppen. */
export function heightGripsShown(host: ToolHost): HeightGrip[] {
  const marker = host.space?.();
  if (!marker || !host.readOnly?.()) return [];
  const el = host.store.doc.elements[marker];
  if (el?.type !== 'Section' && el?.type !== 'Elevation') return [];
  const out: HeightGrip[] = [];
  for (const q of host.plan().prims) {
    if (q.kind !== 'line') continue;
    const m = /^höjd-(bh|nh|th)$/.exec(q.origin?.part ?? '');
    // Måttets långa lodräta streck (snedstrecken är inte lodräta).
    if (!m || Math.abs(q.a[0] - q.b[0]) > 0.01) continue;
    out.push({ marker, key: m[1] as HeightGrip['key'], at: [q.a[0], Math.max(q.a[1], q.b[1])] });
  }
  return out;
}

/** Höjdmåttet under markören, om något. */
export function heightGripAt(host: ToolHost, pt: Vec2, touch: boolean): HeightGrip | null {
  const tol = pxToMm(host, touch ? 18 : 10);
  let best: (HeightGrip & { d: number }) | null = null;
  for (const g of heightGripsShown(host)) {
    const d = dist(g.at, pt);
    if (d <= tol && (!best || d < best.d)) best = { ...g, d };
  }
  return best;
}
