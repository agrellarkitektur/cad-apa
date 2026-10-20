import type { FillDef } from '../core/graphics';
import type { Camera } from './camera';
import { imageCorners, type Pen, type PenColor, type Primitive } from '../repr/primitives';

export interface RenderOptions {
  /** Ritningsskalans nämnare (100 för 1:100). Styr texthöjd, streck och skraffering. */
  drawingScale: number;
  /** Prefix för mönstrens id, när flera ritningar ligger i samma SVG. */
  idPrefix?: string;
  /**
   * Adressen till en bild (0.8), t.ex. en blob-URL. Null om den inte är klar
   * än; då ritas en ram, och den som ger adressen ritar om när bilden finns.
   */
  imageHref?: (source: { asset: string; page?: number }) => string | null;
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
  // Likadana skrafferingar delar mönster (0.8.3), t.ex. i ett DXF-underlag med många ytor.
  const shared = new Map<string, string>();

  const fillAttr = (fill: FillDef): string => {
    if (fill.kind === 'none') return 'fill="none"';
    if (fill.kind === 'solid') return `style="fill:${color(fill.color)}${fill.opacity !== undefined && fill.opacity < 1 ? `;fill-opacity:${fill.opacity}` : ''}"`;
    // Skraffering: mönstret följer modellen, inte skärmen, så det glider inte vid panorering.
    const same = JSON.stringify(fill);
    const known = shared.get(same);
    if (known) return `fill="url(#${known})"`;
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
    shared.set(same, id);
    return `fill="url(#${id})"`;
  };

  for (const p of prims) {
    switch (p.kind) {
      case 'line': {
        if (p.pen.dash?.length) {
          out.push(dashed([p.a, p.b], false, p.pen, cam, paperToPx));
          break;
        }
        const a = cam.toScreen(p.a);
        const b = cam.toScreen(p.b);
        out.push(`<path d="M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}" ${stroke(p.pen, paperToPx)} fill="none"/>`);
        break;
      }
      case 'polyline': {
        if (p.pen.dash?.length) out.push(dashed(p.points, p.closed, p.pen, cam, paperToPx));
        else out.push(`<path d="${ring(p.points, cam, p.closed)}" ${stroke(p.pen, paperToPx)} fill="none"/>`);
        break;
      }
      case 'region': {
        const d = p.rings.map((r) => ring(r, cam, true)).join('');
        if (p.fill.kind !== 'none') out.push(`<path d="${d}" fill-rule="evenodd" ${fillAttr(p.fill)}/>`);
        if (p.outline?.dash?.length) for (const r of p.rings) out.push(dashed(r, true, p.outline, cam, paperToPx));
        else if (p.outline) out.push(`<path d="${d}" fill="none" ${stroke(p.outline, paperToPx)}/>`);
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
      case 'image': {
        const href = opt.imageHref?.(p.source) ?? null;
        const [bl, , , tl] = imageCorners(p);
        if (!href) {
          // Bilden laddas: en tunn ram där den kommer.
          out.push(`<path d="${ring(imageCorners(p), cam, true)}" style="stroke:var(--muted)" stroke-width="1" stroke-dasharray="4 3" fill="none"/>`);
          break;
        }
        // Bildens (0,0) är övre vänstra hörnet; x längs u, y nedåt längs −v.
        const o = cam.toScreen(tl);
        const x = cam.toScreen([tl[0] + p.u[0], tl[1] + p.u[1]]);
        const y = cam.toScreen(bl);
        const m = [x[0] - o[0], x[1] - o[1], y[0] - o[0], y[1] - o[1], o[0], o[1]].map(f).join(' ');
        const filter = p.gray ? ' filter="url(#underlay-gray)"' : '';
        const img = `<image href="${escapeXml(href)}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" transform="matrix(${m})" opacity="${f(p.opacity)}"${filter}/>`;
        if (p.clip) {
          // Klippt mot en ram (0.8 del 3), t.ex. vyns på ett ritningsblad.
          const id = `${opt.idPrefix ?? 'h'}c${patterns.size}`;
          const c = p.clip;
          patterns.set(id, `<clipPath id="${id}"><path d="${ring([[c.minX, c.minY], [c.maxX, c.minY], [c.maxX, c.maxY], [c.minX, c.maxY]], cam, true)}"/></clipPath>`);
          out.push(`<g clip-path="url(#${id})">${img}</g>`);
        } else out.push(img);
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
          `<text x="${f(s[0])}" y="${f(s[1])}" font-size="${f(px)}" text-anchor="${p.align ?? 'start'}"${weight}${rot} style="fill:${color(p.pen.color ?? 'ink')}${p.pen.opacity !== undefined && p.pen.opacity < 1 ? `;fill-opacity:${f(p.pen.opacity)}` : ''}">${escapeXml(p.text)}</text>`,
        );
        break;
      }
    }
  }
  // Gråskala för underlag.
  if (prims.some((p) => p.kind === 'image' && p.gray)) patterns.set('underlay-gray', '<filter id="underlay-gray"><feColorMatrix type="saturate" values="0"/></filter>');
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
  const op = pen.opacity !== undefined && pen.opacity < 1 ? `;stroke-opacity:${f(pen.opacity)}` : '';
  let s = `style="stroke:${color(pen.color ?? 'ink')}${op}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"`;
  if (pen.dash?.length) {
    const dash = pen.dash.map((d) => f(Math.max(2, d * paperToPx))).join(' ');
    s += ` stroke-dasharray="${dash}"`;
  }
  return s;
}

/**
 * Streckad linje genom punkter, sträcka för sträcka. Mönstret töjs lite på
 * varje sträcka så att den börjar och slutar med ett helt streck: då möts
 * strecken i hörnen och de två sidorna av en riven vägg blir lika.
 */
function dashed(points: readonly (readonly [number, number])[], closed: boolean, pen: Pen, cam: Camera, paperToPx: number): string {
  const base = pen.dash!.map((d) => Math.max(2, d * paperToPx));
  // Ett udda antal värden upprepas i SVG två gånger; gör det jämnt.
  const pattern = base.length % 2 ? [...base, ...base] : base;
  const period = pattern.reduce((a, b) => a + b, 0);
  const first = pattern[0];
  const w = Math.max(0.75, pen.weight * 4);
  const op = pen.opacity !== undefined && pen.opacity < 1 ? `;stroke-opacity:${f(pen.opacity)}` : '';
  const style = `style="stroke:${color(pen.color ?? 'ink')}${op}" stroke-width="${f(w)}" stroke-linecap="round" fill="none"`;
  const pts = points.map((q) => cam.toScreen(q));
  if (closed && pts.length > 2) pts.push(pts[0]);
  const parts: string[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.5) continue;
    const d = `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`;
    const n = Math.round((len - first) / period);
    if (n < 1) {
      // För kort för ett mönster: ett streck i varje ände och ett mellanrum.
      parts.push(len > first * 1.6 ? `<path d="${d}" ${style} stroke-dasharray="${f(len * 0.38)} ${f(len * 0.24)}"/>` : `<path d="${d}" ${style}/>`);
      continue;
    }
    const k = len / (n * period + first);
    parts.push(`<path d="${d}" ${style} stroke-dasharray="${pattern.map((x) => f(x * k)).join(' ')}"/>`);
  }
  return parts.join('');
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
