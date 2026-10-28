import { snap15, toFrame, type TagHandles, type TagParams } from '../../elements/leader';
import type { Primitive, Vec2 } from '../../repr/primitives';
import type { Camera } from '../../view2d/camera';
import { distToPrim } from '../../view2d/pick';
import type { ViewPointer } from '../../view2d/planView';
import { pxToMm, type ToolHost } from './host';
import { lengthLabel } from './overlay';

/**
 * Litterans grepp i Markera (0.10.20.1), gemensamma för alla sorter: texten
 * (dras i texten själv), punkten som ledaren
 * pekar på och stammens ände (knäcken), som ändrar stammens längd. Med Shift
 * hålls den sneda delen i steg om 15°. Greppen läses ur primitivernas
 * ursprung (`origin.tag`, som ritningen sätter), så att de alltid ligger
 * där ledaren ritats.
 */
export interface TagGrip {
  id: string;
  kind: 'text' | 'target' | 'knee';
  handles: TagHandles;
  at: Vec2;
}

type Tags = { handles: TagHandles; prims: Primitive[] }[];
const byPlan = new WeakMap<readonly Primitive[], Map<string, Tags>>();

/**
 * Litterans primitiver och grepp för ett element i planen. De söks i hela
 * ritningen (väggarnas littera ritas med alla väggar på en gång och hör inte
 * till väggens klickbara form), en gång per plan.
 */
function tagsOf(host: ToolHost, id: string): Tags {
  const prims = host.plan().prims;
  let map = byPlan.get(prims);
  if (!map) {
    const m = new Map<string, Map<TagHandles, Primitive[]>>();
    for (const q of prims) {
      const h = q.origin?.tag;
      const owner = q.origin?.objectId;
      if (!h || !owner) continue;
      const of = m.get(owner) ?? new Map<TagHandles, Primitive[]>();
      m.set(owner, of);
      const list = of.get(h) ?? [];
      list.push(q);
      of.set(h, list);
    }
    map = new Map([...m].map(([k, v]) => [k, [...v].map(([handles, ps]) => ({ handles, prims: ps }))]));
    byPlan.set(prims, map);
  }
  return map.get(id) ?? [];
}

/** Greppen för punkten och knäcken på de markerade objektens littera. */
export function tagGripsShown(host: ToolHost): TagGrip[] {
  if (host.readOnly?.()) return [];
  const out: TagGrip[] = [];
  for (const id of host.selection.list()) {
    if (host.store.doc.elements[id]?.locked) continue;
    for (const { handles } of tagsOf(host, id)) {
      out.push({ id, kind: 'text', handles, at: handles.text });
      if (handles.stubEnd) out.push({ id, kind: 'knee', handles, at: handles.stubEnd });
      if (handles.target) out.push({ id, kind: 'target', handles, at: handles.target });
    }
  }
  return out;
}

/** Greppet under markören: punkten eller knäcken först, sedan texten (också var som helst i den). */
export function tagGripAt(host: ToolHost, p: ViewPointer): TagGrip | null {
  if (host.readOnly?.() || p.mod || p.shift) return null;
  const tol = pxToMm(host, p.pointerType === 'touch' ? 18 : 9);
  let best: { g: TagGrip; d: number } | null = null;
  for (const g of tagGripsShown(host)) {
    const d = Math.hypot(g.at[0] - p.model[0], g.at[1] - p.model[1]);
    // Textens ruta går efter punkten och knäcken när de ligger nära varandra.
    const dd = g.kind === 'text' ? d + tol / 2 : d;
    if (d <= tol && (!best || dd < best.d)) best = { g, d: dd };
  }
  if (best) return best.g;
  const near = pxToMm(host, p.pointerType === 'touch' ? 14 : 6);
  for (const id of host.selection.list()) {
    if (host.store.doc.elements[id]?.locked) continue;
    for (const { handles, prims } of tagsOf(host, id)) {
      const texts = prims.filter((q) => q.kind === 'text');
      if (texts.some((q) => distToPrim(p.model, q, host.view.drawingScale) <= near)) return { id, kind: 'text', handles, at: handles.text };
    }
  }
  return null;
}

/** Var greppet hamnar när det dras till `to`; med Shift i steg om 15° för den sneda delen. */
export function tagDragPoint(g: TagGrip, from: Vec2, to: Vec2, shift: boolean): Vec2 {
  const h = g.handles;
  if (g.kind === 'target') return shift && h.stubEnd ? snap15(h.stubEnd, to) : to;
  if (g.kind === 'knee') {
    if (!h.stubStart || !h.dir) return to;
    const k = Math.max(0, (to[0] - h.stubStart[0]) * h.dir[0] + (to[1] - h.stubStart[1]) * h.dir[1]);
    return [h.stubStart[0] + h.dir[0] * k, h.stubStart[1] + h.dir[1] * k];
  }
  // Texten: med Shift flyttas den så att knäcken hamnar i 15°-steg från punkten.
  const d: Vec2 = [to[0] - from[0], to[1] - from[1]];
  if (shift && h.stubEnd && h.target) {
    const knee: Vec2 = [h.stubEnd[0] + d[0], h.stubEnd[1] + d[1]];
    const k = snap15(h.target, knee);
    return [g.at[0] + k[0] - h.stubEnd[0], g.at[1] + k[1] - h.stubEnd[1]];
  }
  return [g.at[0] + d[0], g.at[1] + d[1]];
}

const r = (v: number) => Math.round(v);

/** Ändringen av objektets parametrar när greppet släpps i `pt` (från `tagDragPoint`). */
export function tagPatch(host: ToolHost, g: TagGrip, pt: Vec2): { patch: Record<string, unknown>; label: string } | null {
  const el = host.store.doc.elements[g.id];
  if (!el) return null;
  const h = g.handles;
  const tag = { ...((el.params as { tag?: TagParams }).tag ?? {}) };
  if (g.kind === 'text') {
    if (h.param === 'labelAt') return { patch: { labelAt: [r(pt[0]), r(pt[1])] }, label: 'Flytta rumsstämpeln' };
    const d = toFrame([pt[0] - h.text[0], pt[1] - h.text[1]], h.frame);
    const at: [number, number] = [r((tag.at?.[0] ?? 0) + d[0]), r((tag.at?.[1] ?? 0) + d[1])];
    return { patch: { tag: { ...tag, at } }, label: 'Flytta litteran' };
  }
  if (g.kind === 'target' && h.target) {
    const d = toFrame([pt[0] - h.target[0], pt[1] - h.target[1]], h.frame);
    const to: [number, number] = [r((tag.to?.[0] ?? 0) + d[0]), r((tag.to?.[1] ?? 0) + d[1])];
    return { patch: { tag: { ...tag, to } }, label: 'Flytta ledarens punkt' };
  }
  if (g.kind === 'knee' && h.stubStart) {
    const len = Math.hypot(pt[0] - h.stubStart[0], pt[1] - h.stubStart[1]) / host.view.drawingScale;
    return { patch: { tag: { ...tag, stub: Math.round(len * 2) / 2 } }, label: 'Ändra stammens längd' };
  }
  return null;
}

/** Greppen och, medan ett dras, ledarens nya läge. */
export function tagOverlay(host: ToolHost, cam: Camera, drag: { grip: TagGrip; to: Vec2 | null } | null): string {
  const out: string[] = [];
  for (const g of tagGripsShown(host)) {
    const s = cam.toScreen(g.at);
    // Texten dras i texten själv; ett grepp i mitten skulle dölja den.
    if (g.kind === 'text') continue;
    if (g.kind === 'knee') out.push(`<rect x="${s[0] - 4}" y="${s[1] - 4}" width="8" height="8" class="grip side-grip"/>`);
    else out.push(`<circle cx="${s[0]}" cy="${s[1]}" r="5" class="grip"/>`);
  }
  if (!drag?.to) return out.join('');
  const { grip: g, to } = drag;
  const h = g.handles;
  const line = (a: Vec2, b: Vec2) => {
    const sa = cam.toScreen(a);
    const sb = cam.toScreen(b);
    return `<path d="M${sa[0]} ${sa[1]}L${sb[0]} ${sb[1]}" class="rubber"/>`;
  };
  let knee = h.stubEnd;
  let target = h.target;
  if (g.kind === 'text' && knee) knee = [knee[0] + to[0] - g.at[0], knee[1] + to[1] - g.at[1]];
  if (g.kind === 'knee') knee = to;
  if (g.kind === 'target') target = to;
  if (g.kind === 'text') {
    const s = cam.toScreen(to);
    out.push(`<rect x="${s[0] - 5}" y="${s[1] - 5}" width="10" height="10" class="grip"/>`);
  }
  if (g.kind === 'knee' && h.stubStart) out.push(line(h.stubStart, to));
  if (knee && target) {
    out.push(line(knee, target));
    const a = (Math.atan2(target[1] - knee[1], target[0] - knee[0]) * 180) / Math.PI;
    out.push(lengthLabel(cam, knee, target, `${Math.round(((a % 360) + 360) % 360)}°`));
  }
  return out.join('');
}
