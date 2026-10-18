import type { FillDef } from '../core/graphics';
import type { Camera } from './camera';
import type { Pen, PenColor, Primitive } from '../repr/primitives';

export interface RenderOptions {
  /** Ritningsskalans nämnare (100 för 1:100). Styr texthöjd, streck och skraffering. */
  drawingScale: number;
  /** Prefix för mönstrens id, när flera ritningar ligger i samma SVG. */
  idPrefix?: string;
}

/** Texter mindre än så här på skärmen ritas inte alls. */
const MIN_TEXT_PX = 4;

/**
 * Ritar primitiver som SVG-markup i skärmkoordinater. "ink" och "paper"
 * följer temat, så att svart på papper blir ljust på mörk skärm.
 */
export function renderPrimitives(prims: readonly Primitive[], cam: Camera, opt: RenderOptions): string {
  const paperToPx = opt.drawingScale * cam.scale; // px per pappers-mm
  const out: string[] = [];
  const patterns = new Map<string, string>();

  const fillAttr = (fill: FillDef): string => {
    if (fill.kind === 'none') return 'fill="none"';
    if (fill.kind === 'solid') return `style="fill:${color(fill.color)}${fill.opacity !== undefined && fill.opacity < 1 ? `;fill-opacity:${fill.opacity}` : ''}"`;
    // Skraffering: mönstret följer modellen, inte skärmen, så det glider inte vid panorering.
    const spacing = Math.max(3, fill.spacing * paperToPx);
    const w = Math.max(0.6, fill.weight * 4);
    const o = cam.toScreen([0, 0]);
    const id = `${opt.idPrefix ?? 'h'}${patterns.size}`;
    // Vinkeln mäts moturs i modellen; på skärmen vänds y.
    patterns.set(
      id,
      `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${f(spacing)}" height="${f(spacing)}" patternTransform="translate(${f(o[0])} ${f(o[1])}) rotate(${f(-fill.angle)})">${
        fill.background
          ? `<rect width="${f(spacing)}" height="${f(spacing)}" style="fill:${color(fill.background)};fill-opacity:${fill.backgroundOpacity ?? 1}"/>`
          : ''
      }<path d="M0 ${f(spacing / 2)}H${f(spacing)}" style="stroke:${color(fill.color)};stroke-opacity:${fill.opacity ?? 1}" stroke-width="${f(w)}"/></pattern>`,
    );
    return `fill="url(#${id})"`;
  };

  for (const p of prims) {
    switch (p.kind) {
      case 'line': {
        const a = cam.toScreen(p.a);
        const b = cam.toScreen(p.b);
        out.push(`<path d="M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}" ${stroke(p.pen, paperToPx)} fill="none"/>`);
        break;
      }
      case 'polyline': {
        out.push(`<path d="${ring(p.points, cam, p.closed)}" ${stroke(p.pen, paperToPx)} fill="none"/>`);
        break;
      }
      case 'region': {
        const d = p.rings.map((r) => ring(r, cam, true)).join('');
        if (p.fill.kind !== 'none') out.push(`<path d="${d}" fill-rule="evenodd" ${fillAttr(p.fill)}/>`);
        if (p.outline) out.push(`<path d="${d}" fill="none" ${stroke(p.outline, paperToPx)}/>`);
        break;
      }
      case 'arc': {
        const c = p.center;
        const a = cam.toScreen([c[0] + p.radius * Math.cos(p.start), c[1] + p.radius * Math.sin(p.start)]);
        const b = cam.toScreen([c[0] + p.radius * Math.cos(p.end), c[1] + p.radius * Math.sin(p.end)]);
        const sweep = normalizeAngle(p.end - p.start);
        const r = p.radius * cam.scale;
        // Moturs i modellen ser moturs ut även på skärmen. I SVG:s y-nedåt-system
        // betyder det minskande vinkel, alltså sweep-flag 0.
        out.push(
          `<path d="M${f(a[0])} ${f(a[1])}A${f(r)} ${f(r)} 0 ${sweep > Math.PI ? 1 : 0} 0 ${f(b[0])} ${f(b[1])}" ${stroke(p.pen, paperToPx)} fill="none"/>`,
        );
        break;
      }
      case 'text': {
        const px = p.height * paperToPx;
        if (px < MIN_TEXT_PX) break;
        const s = cam.toScreen(p.at);
        // På skärmen är y nedåt, så en vridning moturs blir negativ.
        const rot = p.angle ? ` transform="rotate(${f((-p.angle * 180) / Math.PI)} ${f(s[0])} ${f(s[1])})"` : '';
        const weight = p.bold ? ' font-weight="650"' : '';
        out.push(
          `<text x="${f(s[0])}" y="${f(s[1])}" font-size="${f(px)}" text-anchor="${p.align ?? 'start'}"${weight}${rot} style="fill:${color(p.pen.color ?? 'ink')}">${escapeXml(p.text)}</text>`,
        );
        break;
      }
    }
  }
  const defs = patterns.size ? `<defs>${[...patterns.values()].join('')}</defs>` : '';
  return defs + out.join('');
}

function ring(points: readonly (readonly [number, number])[], cam: Camera, closed: boolean): string {
  return (
    points
      .map((pt, i) => {
        const s = cam.toScreen(pt);
        return `${i ? 'L' : 'M'}${f(s[0])} ${f(s[1])}`;
      })
      .join('') + (closed ? 'Z' : '')
  );
}

/** Färger på skärmen. "ink" och "paper" följer temat; hexkoder visas som de är. */
export function color(c: PenColor): string {
  switch (c) {
    case 'ink':
      return 'var(--ink)';
    case 'paper':
      return 'var(--paper)';
    case 'muted':
      return 'var(--muted)';
    case 'accent':
      return 'var(--accent)';
    default:
      return c;
  }
}

/**
 * Pennan på skärmen: tjockleken följer pappersmåttet ungefär (0,25 mm ≈ 1 px)
 * men hålls konstant vid zoom, som i de flesta CAD-program.
 */
function stroke(pen: Pen, paperToPx: number): string {
  const w = Math.max(0.75, pen.weight * 4);
  let s = `style="stroke:${color(pen.color ?? 'ink')}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"`;
  if (pen.dash?.length) {
    const dash = pen.dash.map((d) => f(Math.max(2, d * paperToPx))).join(' ');
    s += ` stroke-dasharray="${dash}"`;
  }
  return s;
}

function normalizeAngle(a: number): number {
  const t = Math.PI * 2;
  return ((a % t) + t) % t;
}

function f(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
}
