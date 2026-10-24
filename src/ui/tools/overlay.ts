import type { Camera } from '../../view2d/camera';
import type { SnapResult } from './snap';

/** Snäppmarkör: en symbol per sorts snäpp och en kort etikett. */
export function snapMarker(cam: Camera, s: SnapResult): string {
  const p = cam.toScreen(s.point);
  const x = p[0];
  const y = p[1];
  const out: string[] = [];
  if (s.guide) {
    const a = cam.toScreen(s.guide[0]);
    const b = cam.toScreen(s.guide[1]);
    out.push(`<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" class="snap-guide"/>`);
  }
  for (const g of s.guides ?? []) {
    const a = cam.toScreen(g[0]);
    const b = cam.toScreen(g[1]);
    out.push(`<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" class="snap-guide track"/><circle cx="${a[0]}" cy="${a[1]}" r="3" class="snap-dot"/>`);
  }
  switch (s.kind) {
    case 'endpoint':
    case 'start':
      out.push(`<rect x="${x - 5}" y="${y - 5}" width="10" height="10" class="snap-mark"/>`);
      break;
    case 'midpoint':
      out.push(`<path d="M${x} ${y - 6}L${x + 6} ${y + 5}L${x - 6} ${y + 5}Z" class="snap-mark"/>`);
      break;
    case 'perpendicular':
      out.push(`<path d="M${x - 6} ${y - 6}V${y + 6}H${x + 6}M${x - 6} ${y}H${x}V${y + 6}" class="snap-mark"/>`);
      break;
    case 'intersection':
      out.push(`<path d="M${x - 6} ${y - 6}L${x + 6} ${y + 6}M${x + 6} ${y - 6}L${x - 6} ${y + 6}" class="snap-mark"/>`);
      break;
    case 'track':
      out.push(`<path d="M${x - 6} ${y}H${x + 6}M${x} ${y - 6}V${y + 6}" class="snap-mark"/>`);
      break;
    case 'on-wall':
      out.push(`<circle cx="${x}" cy="${y}" r="5" class="snap-mark"/>`);
      break;
    case 'center':
      out.push(`<circle cx="${x}" cy="${y}" r="6" class="snap-mark"/><path d="M${x - 3} ${y}H${x + 3}M${x} ${y - 3}V${y + 3}" class="snap-mark"/>`);
      break;
    case 'division':
      out.push(`<path d="M${x - 6} ${y - 6}L${x + 6} ${y + 6}M${x + 6} ${y - 6}L${x - 6} ${y + 6}" class="snap-mark"/><circle cx="${x}" cy="${y}" r="6" class="snap-mark"/>`);
      break;
    case 'quadrant':
      out.push(`<path d="M${x} ${y - 6}L${x + 6} ${y}L${x} ${y + 6}L${x - 6} ${y}Z" class="snap-mark"/>`);
      break;
    case 'parallel':
      out.push(`<circle cx="${x}" cy="${y}" r="3" class="snap-dot"/>`);
      break;
    case 'angle':
      out.push(`<circle cx="${x}" cy="${y}" r="3" class="snap-dot"/>`);
      break;
    default:
      out.push(`<path d="M${x - 7} ${y}H${x + 7}M${x} ${y - 7}V${y + 7}" class="snap-cross"/>`);
  }
  if (s.label) out.push(`<text x="${x + 12}" y="${y - 10}" class="snap-label">${s.label}</text>`);
  return out.join('');
}

/** Måttetikett längs en linje, t.ex. längden på väggen man ritar. */
export function lengthLabel(cam: Camera, a: readonly [number, number], b: readonly [number, number], text: string): string {
  const pa = cam.toScreen(a);
  const pb = cam.toScreen(b);
  const mx = (pa[0] + pb[0]) / 2;
  const my = (pa[1] + pb[1]) / 2;
  const w = text.length * 7.5 + 12;
  return `<g class="len-label"><rect x="${mx - w / 2}" y="${my - 11}" width="${w}" height="22" rx="4"/><text x="${mx}" y="${my + 4}" text-anchor="middle">${text}</text></g>`;
}
