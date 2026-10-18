import type { ProjectDoc } from '../core/model';
import type { WallParams } from '../elements/wall';
import type { Pickable } from '../repr/plan';
import type { Primitive, Vec2 } from '../repr/primitives';
import type { Camera } from '../view2d/camera';

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
): string {
  const out: string[] = [];
  const byId = new Map(pickables.map((p) => [p.id, p]));

  const draw = (item: Pickable, cls: string) => {
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
    const p = el.params as unknown as WallParams;
    out.push(`<path d="${path(cam, [p.start, p.end], false)}" class="ref-line"/>`);
  }
  for (const id of selected) {
    const el = doc.elements[id];
    if (el?.type !== 'Wall') continue;
    const p = el.params as unknown as WallParams;
    for (const pt of [p.start, p.end]) {
      const s = cam.toScreen(pt);
      out.push(`<circle cx="${s[0]}" cy="${s[1]}" r="6" class="grip"/>`);
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
    case 'text': {
      const s = cam.toScreen(p.at);
      return `<circle cx="${s[0]}" cy="${s[1]}" r="4" class="${cls}-line"/>`;
    }
  }
}
