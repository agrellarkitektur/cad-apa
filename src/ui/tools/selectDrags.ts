import { updateParams } from '../../core/commands';
import { angleDeg, dist, sub } from '../../geometry/vec';
import { editedShape, moveShapeNode, previewShape, shapeNodes, shapePatch } from '../../elements/shapeEdit';
import { dragRoofGrip, type RoofDrag, type RoofGrip } from '../../elements/roofGrips';
import { underlayCorners, type UnderlayParams } from '../../elements/underlay';
import { dragUnderlayGrip, type UnderlayGrip } from '../../elements/underlayEdit';
import { resolveParams } from '../../elements/registry';
import type { Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import type { ViewPointer } from '../../view2d/planView';
import type { ToolHost } from './host';
import { roundMm, snap, type SnapResult } from './snap';
import { lengthLabel, snapMarker } from './overlay';
import { crestDragTo, crestGripAt, crestGripsShown, depthDragValue, depthGeometry, depthGripAt, depthGripsShown, heightGripAt, heightGripsShown, roofGripAt, roofGripsShown, shapeNodeAt, underlayGripAt, underlayGripsShown, type CrestGrip, type DepthGrip, type HeightGrip } from './selectGrips';

/**
 * Greppen som Markera drar utöver väggändarna och flytten (ur
 * `selectTool.ts` i granskningen efter 0.10.15): takets grepp och
 * höjdmåtten i fasader och sektioner, bildens grepp, djupet och *Tonat
 * från*, stödmurens höjdpunkter och 2D-formernas punkter. Ett grepp hittas
 * med `gripDragAt` när musknappen trycks ned, följer musen i `dragGrip`,
 * skrivs i `finishGrip` och ritas med `gripsOverlay`.
 */
export type GripDrag =
  /** Ett grepp i takets nock eller takfot i en fasad eller sektion (0.8). */
  | { kind: 'roof'; grip: RoofGrip; drag: RoofDrag | null; snap: SnapResult | null }
  /** Ett höjdmått (BH, NH, TH) som dras i sidled i en fasad eller sektion (0.10.13). */
  | { kind: 'measure'; grip: HeightGrip; x: number | null }
  /** Ett grepp i en markerad bild eller PDF-sida (0.8.16). */
  | { kind: 'underlay'; id: string; grip: UnderlayGrip; from: Vec2; snap: SnapResult | null; free: boolean }
  /** Djupet eller *Tonat från* för en markerad fasad eller sektion (0.10.15). */
  | { kind: 'depth'; grip: DepthGrip; value: number | null; moved: boolean }
  /** En höjdpunkt på en stödmur som dras längs muren (0.10.13). */
  | { kind: 'crest'; grip: CrestGrip; to: Vec2 | null }
  /** En punkt i ett 2D-element (0.8 del 2). */
  | { kind: 'node'; id: string; hole?: number; index: number; from: Vec2; snap: SnapResult | null };

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
const LOCKED = 'Låst. Lås upp i egenskaperna för att ändra.';

/** Greppet under punkten, i den ordning de går före varandra; `ro` i fasader och sektioner. */
export function gripDragAt(host: ToolHost, p: ViewPointer, ro: boolean): GripDrag | null {
  const touch = p.pointerType === 'touch';
  const rg = ro ? roofGripAt(host, p.model, touch) : null;
  if (rg) return { kind: 'roof', grip: rg, drag: null, snap: null };
  const hg = ro ? heightGripAt(host, p.model, touch) : null;
  if (hg) return { kind: 'measure', grip: hg, x: null };
  const ug = underlayGripAt(host, p.model, touch);
  if (ug) return { kind: 'underlay', ...ug, snap: null, free: false };
  const dg = depthGripAt(host, p.model, touch);
  if (dg) return { kind: 'depth', grip: dg, value: dg.value, moved: false };
  const cg = crestGripAt(host, p.model, touch);
  if (cg) return { kind: 'crest', grip: cg, to: null };
  const nd = shapeNodeAt(host, p.model, touch);
  if (nd) return { kind: 'node', ...nd, snap: null };
  return null;
}

/** Bildens grepp under punkten, men inget medan ett av dem dras. */
export function idleUnderlayGripAt(host: ToolHost, active: GripDrag | null, pt: Vec2, touch: boolean): ReturnType<typeof underlayGripAt> {
  return active?.kind === 'underlay' && active.snap ? null : underlayGripAt(host, pt, touch);
}

/** Greppet följer musen; `tol` är snäppningens räckvidd i mm. */
export function dragGrip(host: ToolHost, d: GripDrag, p: ViewPointer, tol: number): void {
  switch (d.kind) {
    case 'underlay':
      d.free = p.shift;
      d.snap = snap({ cursor: p.model, segments: host.snapSegments(), tol, exclude: new Set([d.id]) });
      return;
    case 'measure':
      d.x = Math.round(p.model[0]);
      return;
    case 'depth':
      d.value = depthDragValue(d.grip, p.model);
      d.moved = true;
      return;
    case 'crest':
      d.to = crestDragTo(host, d.grip.id, p.model);
      return;
    case 'node': {
      const el = editedShape(host.store.doc, d.id, d.hole);
      const pts = el ? shapeNodes(el) : [];
      // Vinkellås (Shift) från grannpunkten.
      const from = pts[d.index - 1] ?? pts[d.index + 1];
      d.snap = snap({ cursor: p.model, from, segments: host.snapSegments(), tol, ortho: p.shift, exclude: new Set([d.id]) });
      return;
    }
    case 'roof': {
      const space = host.space?.();
      if (!space) return;
      // Snäpp mot linjerna i vyn (t.ex. väggens överkant), inte mot taket självt.
      const s = snap({ cursor: p.model, segments: host.snapSegments(), tol, exclude: new Set([d.grip.roof]) });
      const exact = s.kind !== 'free' && s.kind !== 'angle';
      d.snap = exact ? s : null;
      // Greppen går bara upp och ned.
      const to: Vec2 = [d.grip.at[0], (exact ? s.point : p.model)[1]];
      d.drag = dragRoofGrip(host.store.doc, space, d.grip, roundMm(to), { free: p.alt });
      return;
    }
  }
}

/** Musknappen släpps: ändringen skrivs, eller (för ett klick på en punkt) öppnas Modifiera. */
export function finishGrip(host: ToolHost, d: GripDrag, p: ViewPointer, moved: boolean): void {
  const doc = host.store.doc;
  switch (d.kind) {
    case 'depth':
      if (!moved || !d.moved || d.value === d.grip.value) return;
      updateParams(host.store, [d.grip.id], { [d.grip.key]: d.value }, d.grip.key === 'depth' ? 'Ändra djupet' : 'Ändra Tonat från');
      return;
    case 'measure': {
      const el = doc.elements[d.grip.marker];
      if (!el || !moved || d.x === null) return;
      const old = (el.params.heightOffsets as Record<string, number> | undefined) ?? {};
      const next = Math.round((old[d.grip.key] ?? 0) + d.x - d.grip.at[0]);
      updateParams(host.store, [el.id], { heightOffsets: { ...old, [d.grip.key]: next || undefined } }, 'Flytta höjdmåttet');
      return;
    }
    case 'crest': {
      const el = doc.elements[d.grip.id];
      if (!el) return;
      if (!moved || !d.to) {
        host.modify?.(p, d.grip.id);
        return;
      }
      if (el.locked) return void host.hint(LOCKED, 3000);
      const list = [...((el.params.crest as { at: [number, number]; h: number }[] | undefined) ?? [])];
      if (!list[d.grip.index]) return;
      list[d.grip.index] = { ...list[d.grip.index], at: [d.to[0], d.to[1]] };
      updateParams(host.store, [el.id], { crest: list }, 'Flytta höjdpunkten');
      return;
    }
    case 'underlay': {
      const el = doc.elements[d.id];
      if (!el || !moved || !d.snap) return;
      if (el.locked) return void host.hint(LOCKED, 3000);
      const next = dragUnderlayGrip(resolveParams<UnderlayParams>(doc, el), d.grip, d.snap.point, d.free);
      if (next) updateParams(host.store, [d.id], next, d.grip.kind === 'side' ? 'Sträck bilden' : d.free ? 'Sträck bilden' : 'Skala bilden');
      return;
    }
    case 'node': {
      const el = doc.elements[d.id];
      if (!el) return;
      if (!moved || !d.snap) {
        // Klick på en punkt: Modifiera med det som går att göra med den.
        host.modify?.(p, d.id);
        return;
      }
      if (el.locked) return void host.hint(LOCKED, 3000);
      const shape = editedShape(doc, d.id, d.hole);
      if (shape) updateParams(host.store, [d.id], shapePatch(doc, d.id, d.hole, moveShapeNode(shape, d.index, roundMm(d.snap.point))), 'Flytta punkt');
      return;
    }
    case 'roof':
      if (!moved || !d.drag) return;
      if (doc.elements[d.grip.roof]?.locked) return void host.hint('Taket är låst. Lås upp i egenskaperna för att ändra det.', 3000);
      updateParams(host.store, [d.grip.roof], d.drag.patch, d.grip.kind === 'slope' ? 'Ändra lutningen' : 'Ändra höjden');
      return;
  }
}

const diamond = (s: Vec2, cls = 'grip') => `<path d="M${s[0]} ${s[1] - 7}L${s[0] + 7} ${s[1]}L${s[0]} ${s[1] + 7}L${s[0] - 7} ${s[1]}Z" class="${cls}"/>`;

/**
 * Greppen som visas för det markerade, och det greppet som dras: taket,
 * höjdmåtten, djupet, höjdpunkterna och bilden, sedan spöket av det som
 * ändras.
 */
export function gripsOverlay(host: ToolHost, cam: Camera, d: GripDrag | null): string {
  const out: string[] = [];
  // Greppen för markerade tak i en fasad eller sektion, och taket medan det dras.
  for (const g of roofGripsShown(host)) {
    const s = cam.toScreen(g.at);
    out.push(g.kind === 'slope' ? diamond(s) : `<rect x="${s[0] - 5}" y="${s[1] - 5}" width="10" height="10" class="grip"/>`);
  }
  // Höjdmåtten i fasaden eller sektionen (0.10.13): en ruta i överänden, som dras i sidled.
  for (const g of heightGripsShown(host)) {
    const s = cam.toScreen(g.at);
    out.push(`<rect x="${s[0] - 4}" y="${s[1] - 4}" width="8" height="8" class="grip side-grip"/>`);
    if (d?.kind === 'measure' && d.grip.key === g.key && d.x !== null) {
      const a = cam.toScreen([d.x, g.at[1]]);
      out.push(`<path d="M${a[0]} ${a[1]}L${a[0]} ${a[1] + 160}" class="rubber"/>`);
    }
  }
  // Djupet och Tonat från för en markerad fasad eller sektion (0.10.15):
  // gränsen streckad, och ett grepp som dras längs blickriktningen.
  for (const g of depthGripsShown(host)) {
    const dragging = d?.kind === 'depth' && d.grip.key === g.key && d.moved;
    const v = dragging ? d.value : g.value;
    const { a, b, at } = depthGeometry(g, dragging ? (v ?? 0) : g.shown);
    const [sa, sb, ss] = [a, b, at].map((q) => cam.toScreen(q));
    // Utan värde (inget tonat) ritas bara greppet, ihåligt.
    if (v !== null) out.push(`<path d="M${sa[0]} ${sa[1]}L${sb[0]} ${sb[1]}" class="depth-line${g.key === 'toneDepth' ? ' tone' : ''}"/>`);
    out.push(g.key === 'depth' ? `<rect x="${ss[0] - 5}" y="${ss[1] - 5}" width="10" height="10" class="grip"/>` : diamond(ss, `grip${v === null ? ' hollow' : ''}`));
    if (dragging) {
      const name = g.key === 'depth' ? 'Djup' : 'Tonat från';
      out.push(lengthLabel(cam, at, at, v === null ? `${name}: ${g.key === 'depth' ? 'allt' : 'inget'}` : `${name} ${nf.format(v)} mm`));
    }
  }
  // Stödmurarnas höjdpunkter (0.10.13): romber som dras längs muren.
  for (const g of crestGripsShown(host)) {
    const dragged = d?.kind === 'crest' && d.grip.id === g.id && d.grip.index === g.index ? d.to : null;
    out.push(diamond(cam.toScreen(dragged || g.at)));
    if (dragged) out.push(lengthLabel(cam, g.at, dragged, `${nf.format(Math.round(dist(g.at, dragged)))} mm`));
  }
  const ul = d?.kind === 'underlay' && d.snap ? d : null;
  for (const g of ul ? [] : underlayGripsShown(host)) {
    const q = cam.toScreen(g.at);
    out.push(g.kind === 'corner' ? `<rect x="${q[0] - 5}" y="${q[1] - 5}" width="10" height="10" class="grip"/>` : `<rect x="${q[0] - 4}" y="${q[1] - 4}" width="8" height="8" class="grip side-grip"/>`);
  }
  if (ul?.snap) {
    const sn = ul.snap;
    const el = host.store.doc.elements[ul.id];
    const p = el ? resolveParams<UnderlayParams>(host.store.doc, el) : null;
    const next = p && dragUnderlayGrip(p, ul.grip, sn.point, ul.free);
    if (p && next) {
      const c = underlayCorners({ ...p, ...next }).map((q) => cam.toScreen(q));
      out.push(`<path d="M${c.map((q) => q.join(' ')).join('L')}Z" class="ghost"/>`);
      out.push(lengthLabel(cam, sn.point, sn.point, `${nf.format(Math.round(next.size[0] * next.scale))} × ${nf.format(Math.round(next.size[1] * next.scale))} mm`));
    }
    out.push(snapMarker(cam, sn));
  }
  if (d?.kind === 'node' && d.snap) {
    const sn = d.snap;
    const el = editedShape(host.store.doc, d.id, d.hole);
    if (el) {
      const shp = previewShape(el, moveShapeNode(el, d.index, sn.point));
      out.push(`<path d="${shp.points.map((q, i) => `${i ? 'L' : 'M'}${cam.toScreen(q).join(' ')}`).join('')}${shp.closed ? 'Z' : ''}" class="ghost"/>`);
      out.push(snapMarker(cam, sn));
      const v = sub(sn.point, d.from);
      out.push(lengthLabel(cam, d.from, sn.point, `${nf.format(Math.round(Math.hypot(v[0], v[1])))} mm  ${fmtAngle(angleDeg(v))}`));
    }
  }
  if (d?.kind === 'roof' && d.drag) {
    const r = d.drag;
    const path = r.outline.map((ring) => ring.map((q, i) => `${i ? 'L' : 'M'}${cam.toScreen(q).join(' ')}`).join('') + 'Z').join('');
    out.push(`<path d="${path}" class="ghost"/>`);
    const at = d.grip.at;
    if (d.snap) out.push(snapMarker(cam, d.snap));
    out.push(lengthLabel(cam, at, [at[0] + 1, at[1]], r.text));
  }
  return out.join('');
}

/** En vinkel i grader med en decimal, 0–360. */
export function fmtAngle(a: number): string {
  const r = Math.round(a * 10) / 10;
  return `${(r === 360 ? 0 : r).toLocaleString('sv-SE')}°`;
}
