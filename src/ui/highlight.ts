import { hasEditableOutline } from '../core/roofEdit';
import type { ProjectDoc } from '../core/model';
import type { WallParams } from '../elements/wall';
import { refFrame } from '../core/wallEdit';
import { pickableById, type Pickable } from '../repr/plan';
import { boundsOf, imageCorners, type Primitive, type Vec2 } from '../repr/primitives';
import type { Camera } from '../view2d/camera';

/** Fler primitiver än så markeras med en ram. */
const MANY_PRIMS = 300;

/**
 * Markeringsgrafik: markerade element får accentfärgad kontur och en svag
 * fyllning, väggar får grepp i ändarna. Elementet under muspekaren visas
 * svagare.
 */
export function renderHighlight(
  cam: Camera,
  doc: ProjectDoc,
  pickables: readonly Pickable[],
  selected: ReadonlySet<string>,
  hover: string | null,
  /** Grepp och referenslinjer i planens koordinater (inte i fasader och sektioner). */
  planGrips = true,
): string {
  const out: string[] = [];
  const byId = pickableById(pickables);

  const draw = (item: Pickable, cls: string) => {
    // Ett element med mycket grafik, t.ex. ett stort DXF-underlag, markeras
    // med sin omslutande ram i stället för varje linje (0.8.3).
    if (item.prims.length > MANY_PRIMS) {
      const b = boundsOf(item.prims);
      if (b) {
        const ring: Vec2[] = [[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY]];
        out.push(`<path d="${path(cam, ring, true)}" class="${cls}-fill"/><path d="${path(cam, ring, true)}" fill="none" class="${cls}-line"/>`);
        return;
      }
    }
    for (const rings of item.regions) {
      const d = rings.map((r) => path(cam, r, true)).join('');
      out.push(`<path d="${d}" fill-rule="evenodd" class="${cls}-fill"/>`);
    }
    for (const p of item.prims) out.push(primPath(cam, p, cls));
  };

  if (hover && !selected.has(hover)) {
    const item = byId.get(hover);
    if (item) draw(item, 'hl-hover');
  }
  for (const id of selected) {
    const item = byId.get(id);
    if (item) draw(item, 'hl-sel');
  }

  // Punkterna i markerade 2D-element (0.8 del 2), även i fasader, sektioner och på arbetsblad.
  for (const id of selected) {
    const el = doc.elements[id];
    if (el?.type !== 'Shape2D' || !byId.has(id)) continue;
    for (const pt of (el.params.points as Vec2[] | undefined) ?? []) {
      const s = cam.toScreen(pt);
      out.push(`<rect x="${s[0] - 4.5}" y="${s[1] - 4.5}" width="9" height="9" class="grip"/>`);
    }
  }

  if (!planGrips) return out.join('');

  // Hörnpunkter på markerade möbler: tryck nära ett hörn och dra för att
  // lägga just det hörnet mot ett annat.
  for (const id of selected) {
    if (doc.elements[id]?.type !== 'Furniture') continue;
    const ring = byId.get(id)?.regions[0]?.[0];
    for (const pt of ring ?? []) {
      const s = cam.toScreen(pt);
      out.push(`<rect x="${s[0] - 4}" y="${s[1] - 4}" width="8" height="8" class="hotspot"/>`);
    }
  }

  // Referenslinjen och greppen i dess ändar.
  for (const id of selected) {
    const el = doc.elements[id];
    if (el?.type !== 'Wall') continue;
    const f = refFrame(doc, el);
    out.push(`<path d="${path(cam, f.trace(0, f.length, 0), false)}" class="ref-line"/>`);
  }
  for (const id of selected) {
    const el = doc.elements[id];
    if (el?.type !== 'Wall' && !((el?.type === 'Section' || el?.type === 'Elevation') && !el.params.auto)) continue;
    const p = el.params as unknown as WallParams;
    for (const pt of [p.start, p.end]) {
      const s = cam.toScreen(pt);
      out.push(`<circle cx="${s[0]}" cy="${s[1]}" r="6" class="grip"/>`);
    }
  }
  // Håltagningarnas hörn i markerade bjälklag (0.9.4): dras som 2D-formens punkter.
  for (const id of selected) {
    const el = doc.elements[id];
    if (el?.type !== 'Slab' || !byId.has(id)) continue;
    for (const h of (el.params.holes as { points: Vec2[] }[] | undefined) ?? []) {
      for (const pt of h.points) {
        const s = cam.toScreen(pt);
        out.push(`<rect x="${s[0] - 4.5}" y="${s[1] - 4.5}" width="9" height="9" class="grip"/>`);
      }
    }
  }
  // Hörnen i markerade taks kontur.
  for (const id of selected) {
    const el = doc.elements[id];
    if (!hasEditableOutline(el)) continue;
    for (const pt of el.params.outline as Vec2[]) {
      const s = cam.toScreen(pt);
      out.push(`<rect x="${s[0] - 4.5}" y="${s[1] - 4.5}" width="9" height="9" class="grip"/>`);
    }
  }
  return out.join('');
}

function path(cam: Camera, pts: readonly Vec2[], closed: boolean): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${cam.toScreen(p).join(' ')}`).join('') + (closed ? 'Z' : '');
}

function primPath(cam: Camera, p: Primitive, cls: string): string {
  switch (p.kind) {
    case 'line':
      return `<path d="${path(cam, [p.a, p.b], false)}" class="${cls}-line"/>`;
    case 'polyline':
      return `<path d="${path(cam, p.points, p.closed)}" class="${cls}-line"/>`;
    case 'region':
      return `<path d="${p.rings.map((r) => path(cam, r, true)).join('')}" class="${cls}-line"/>`;
    case 'arc': {
      const a = cam.toScreen([p.center[0] + p.radius * Math.cos(p.start), p.center[1] + p.radius * Math.sin(p.start)]);
      const b = cam.toScreen([p.center[0] + p.radius * Math.cos(p.end), p.center[1] + p.radius * Math.sin(p.end)]);
      const t = Math.PI * 2;
      const sweep = (((p.end - p.start) % t) + t) % t;
      const r = p.radius * cam.scale;
      return `<path d="M${a[0]} ${a[1]}A${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 0 ${b[0]} ${b[1]}" class="${cls}-line"/>`;
    }
    case 'image':
      return `<path d="${path(cam, imageCorners(p), true)}" class="${cls}-line"/>`;
    case 'text': {
      const s = cam.toScreen(p.at);
      return `<circle cx="${s[0]}" cy="${s[1]}" r="4" class="${cls}-line"/>`;
    }
  }
}
