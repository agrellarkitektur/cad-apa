import { dashPieces, type DashFrom } from '../repr/dash';
import type { FillDef } from '../core/graphics';
import { drawnDash, evenDash, hatchAsPattern, type HatchLine } from '../core/fillTypes';
import { clippedDashes } from '../core/hatchStrokes';
import type { Camera } from './camera';
import { imageCorners, type Pen, type PenColor, type Primitive } from '../repr/primitives';

type RegionRings = Extract<Primitive, { kind: 'region' }>['rings'];

/**
 * Linjernas tjocklek på skärmen (0.8.11): `screen` pennans tjocklek, lika
 * vid all zoom (0,25 mm ≈ 1 px); `true` som på papperet i ritningens skala,
 * så att linjerna blir tunnare när man zoomar ut; `thin` alla linjer tunna.
 */
export type LineWeights = 'thin' | 'screen' | 'true';

export interface RenderOptions {
  /** Ritningsskalans nämnare (100 för 1:100). Styr texthöjd, streck och skraffering. */
  drawingScale: number;
  /** Linjernas tjocklek på skärmen; förval `screen`. */
  lineWeights?: LineWeights;
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
 * Streckade familjer vars förskjutning (minskad till högst en halv
 * streckperiod) är mer än så här många linjeavstånd ritas som stycken, inte
 * som mönster (0.8.38): mönsterrutan skulle snedställas mer än 63°.
 */
const MAX_SHEAR = 2;

/**
 * Ritar primitiver som SVG-markup i skärmkoordinater. "ink" och "paper"
 * följer temat, så att svart på papper blir ljust på mörk skärm.
 */
export function renderPrimitives(prims: readonly Primitive[], cam: Camera, opt: RenderOptions): string {
  const paperToPx = opt.drawingScale * cam.scale; // px per pappers-mm
  const mode = opt.lineWeights ?? 'screen';
  const stroke = (pen: Pen) => strokeAttrs(pen, paperToPx, mode);
  const dashed = (points: readonly (readonly [number, number])[], closed: boolean, pen: Pen, from?: DashFrom) => dashedPath(points, closed, pen, cam, paperToPx, mode, from);
  const out: string[] = [];
  const patterns = new Map<string, string>();
  // Likadana skrafferingar delar mönster (0.8.3), t.ex. i ett DXF-underlag med många ytor.
  const shared = new Map<string, string>();

  const solidFill = (fill: Extract<FillDef, { kind: 'solid' }>): string =>
    `style="fill:${color(fill.color)}${fill.opacity !== undefined && fill.opacity < 1 ? `;fill-opacity:${fill.opacity}` : ''}"`;

  /**
   * Ett mönster av linjefamiljer (0.8.36): ett SVG-mönster per familj. Rutan
   * är en streckperiod lång och ett linjeavstånd hög, och snedställs
   * (skewX) så att förskjutningen längs linjerna stämmer. Med linjer tätare
   * än 3 px förstoras hela mönstret, som skrafferingen. Starkt snedställda
   * familjer ritas som stycken i stället (`dashedFamily`).
   */
  const familyFill = (fill: Extract<FillDef, { kind: 'pattern' }>, l: HatchLine): string => {
    const same = JSON.stringify([fill.color, fill.weight, fill.opacity, l]);
    const known = shared.get(same);
    if (known) return `fill="url(#${known})"`;
    const sp0 = l.spacing * paperToPx;
    const u = paperToPx * (sp0 < 3 ? 3 / sp0 : 1);
    const sp = l.spacing * u;
    const [p0, p1] = (l.phase ?? [0, 0]).map((x) => x * u);
    const mod = (a: number, m: number) => ((a % m) + m) % m;
    const drawn = evenDash(l.dash) && drawnDash(evenDash(l.dash)!);
    const dash = drawn ? drawn.dash.map((d) => d * u) : null;
    const period = dash ? dash.reduce((a, b) => a + b, 0) : 0;
    // Förskjutningen gäller bara streckningen och bara upp till en streckperiod (0.8.38): den
    // minsta som ger samma linjer gör rutan minst sned, och en heldragen linje behöver ingen.
    const sh0 = (l.shift ?? 0) * u;
    const sh = period > 0 ? sh0 - Math.round(sh0 / period) * period : 0;
    const width = period > 0 ? period : sp;
    const y0 = mod(-p1, sp);
    const u0 = p0 - (p1 * sh) / sp;
    const w = penPx(fill.weight, paperToPx, mode, 0.6);
    const o = cam.toScreen([0, 0]);
    const id = `${opt.idPrefix ?? 'h'}${patterns.size}`;
    const skew = (Math.atan2(-sh, sp) * 180) / Math.PI;
    const dashAttr = dash && period > 0 ? ` stroke-dasharray="${dash.map(f).join(' ')}" stroke-dashoffset="${f(mod(-u0, period))}"${drawn!.round ? ' stroke-linecap="round"' : ''}` : '';
    // Linjen och dess grannar ovanför och under, så att tjocka linjer inte klipps vid rutans kant.
    const d = [y0 - sp, y0, y0 + sp].map((y) => `M${f(-width)} ${f(y)}H${f(2 * width)}`).join('');
    patterns.set(
      id,
      `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${f(width)}" height="${f(sp)}" patternTransform="translate(${f(o[0])} ${f(o[1])}) rotate(${f(-l.angle)})${Math.abs(skew) > 1e-6 ? ` skewX(${f(skew)})` : ''}"><path d="${d}" style="stroke:${color(fill.color)};stroke-opacity:${fill.opacity ?? 1}" stroke-width="${f(w)}" fill="none"${dashAttr}/></pattern>`,
    );
    shared.set(same, id);
    return `fill="url(#${id})"`;
  };

  /**
   * En starkt snedställd familj som linjestycken klippta mot ytan (0.8.38),
   * förstorad som mönstret ovan. Grus och mark i .pat har streck med långa
   * mellanrum och en förskjutning många gånger linjeavståndet; en så sned
   * mönsterruta målar Chrome långsamt och fel (prickar i stället för
   * stenar), och en DXF med 2 000 skrafferingar i grus, mark och tegel tog
   * 14 sekunder att rita. Snedheten och antalet stycken beror inte på zoomen. Null för
   * familjer som ritas som mönster, och när styckena inte ryms i `pieces`.
   */
  let pieces = 200000;
  const dashedFamily = (rings: RegionRings, fill: Extract<FillDef, { kind: 'pattern' }>, l: HatchLine): string | null => {
    const even = evenDash(l.dash);
    if (!even) return null;
    const period = even.reduce((a, b) => a + b, 0);
    const shift = l.shift ?? 0;
    if (!(period > 0) || Math.abs(shift - Math.round(shift / period) * period) <= MAX_SHEAR * l.spacing) return null;
    const sp0 = l.spacing * paperToPx;
    const k = sp0 < 3 ? 3 / sp0 : 1;
    const drawn = drawnDash(even);
    const m = opt.drawingScale * k;
    const line: HatchLine = { angle: l.angle, spacing: l.spacing * m, shift: (l.shift ?? 0) * m, dash: drawn.dash.map((d) => d * m), phase: [(l.phase?.[0] ?? 0) * m, (l.phase?.[1] ?? 0) * m] };
    const segs = clippedDashes(line, rings, pieces + 1);
    const n = segs.length / 4;
    if (n > pieces) return null;
    pieces -= n;
    if (!n) return '';
    // Modellens mm till skärmen: kameran är en förskjutning och en likformig skalning med y vänd.
    const o = cam.toScreen([0, 0]);
    const cs = cam.scale;
    const parts: string[] = [];
    for (let i = 0; i < segs.length; i += 4) parts.push(`M${f(o[0] + segs[i] * cs)} ${f(o[1] - segs[i + 1] * cs)}L${f(o[0] + segs[i + 2] * cs)} ${f(o[1] - segs[i + 3] * cs)}`);
    const d = parts.join('');
    const w = penPx(fill.weight, paperToPx, mode, 0.6);
    return `<path d="${d}" style="stroke:${color(fill.color)};stroke-opacity:${fill.opacity ?? 1}" stroke-width="${f(w)}" fill="none"${drawn.round ? ' stroke-linecap="round"' : ''}/>`;
  };

  for (const p of prims) {
    // Tjockleken 0 ritas inte (2D-former utan linje, 0.8.19), men finns kvar för att klicka och snäppa.
    if ((p.kind === 'line' || p.kind === 'polyline' || p.kind === 'arc') && p.pen.weight === 0) continue;
    switch (p.kind) {
      case 'line': {
        if (p.pen.dash?.length) {
          out.push(dashed([p.a, p.b], false, p.pen));
          break;
        }
        const a = cam.toScreen(p.a);
        const b = cam.toScreen(p.b);
        out.push(`<path d="M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}" ${stroke(p.pen)} fill="none"/>`);
        break;
      }
      case 'polyline': {
        if (p.pen.dash?.length) out.push(dashed(p.points, p.closed, p.pen, p.dashFrom));
        else out.push(`<path d="${ring(p.points, cam, p.closed)}" ${stroke(p.pen)} fill="none"/>`);
        break;
      }
      case 'region': {
        const d = p.rings.map((r) => ring(r, cam, true)).join('');
        // Skrafferingen är ett mönster med en familj (0.8.38). Mönstret följer modellen, inte skärmen, så det glider inte vid panorering.
        const fl = hatchAsPattern(p.fill);
        if (fl.kind === 'pattern') {
          if (fl.background) out.push(`<path d="${d}" fill-rule="evenodd" style="fill:${color(fl.background)};fill-opacity:${fl.backgroundOpacity ?? 1}"/>`);
          for (const l of fl.lines) out.push(dashedFamily(p.rings, fl, l) ?? `<path d="${d}" fill-rule="evenodd" ${familyFill(fl, l)}/>`);
        } else if (fl.kind === 'solid') out.push(`<path d="${d}" fill-rule="evenodd" ${solidFill(fl)}/>`);
        if (p.outline?.dash?.length) for (const r of p.rings) out.push(dashed(r, true, p.outline));
        else if (p.outline) out.push(`<path d="${d}" fill="none" ${stroke(p.outline)}/>`);
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
          `<path d="M${f(a[0])} ${f(a[1])}A${f(r)} ${f(r)} 0 ${sweep > Math.PI ? 1 : 0} 0 ${f(b[0])} ${f(b[1])}" ${stroke(p.pen)} fill="none"/>`,
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
 * Pennans bredd på skärmen i px, aldrig under `min`. Förval: tjockleken
 * följer pappersmåttet ungefär (0,25 mm ≈ 1 px) men hålls konstant vid zoom,
 * som i de flesta CAD-program. Verklig: pappersmåttet genom ritningens skala
 * och zoomen. Tunna: högst 1 px.
 */
export function penPx(weight: number, paperToPx: number, mode: LineWeights, min: number): number {
  if (mode === 'true') return Math.max(min, weight * paperToPx);
  if (mode === 'thin') return Math.max(min, Math.min(1, weight * 4));
  return Math.max(min, weight * 4);
}

/** Pennans färg, opacitet och bredd, med runda ändar och hörn. */
function penStyle(pen: Pen, paperToPx: number, mode: LineWeights): string {
  const w = penPx(pen.weight, paperToPx, mode, 0.75);
  const op = pen.opacity !== undefined && pen.opacity < 1 ? `;stroke-opacity:${f(pen.opacity)}` : '';
  return `style="stroke:${color(pen.color ?? 'ink')}${op}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"`;
}

function strokeAttrs(pen: Pen, paperToPx: number, mode: LineWeights): string {
  let s = penStyle(pen, paperToPx, mode);
  if (pen.dash?.length) {
    const dash = pen.dash.map((d) => f(Math.max(2, d * paperToPx))).join(' ');
    s += ` stroke-dasharray="${dash}"`;
  }
  return s;
}

/**
 * Streckad linje genom punkter (0.8.30): mönstret löper obrutet genom
 * mjuka brytpunkter och töjs så att varje sträcka mellan skarpa hörn
 * börjar och slutar med ett helt streck (`dashPieces`).
 */
function dashedPath(points: readonly (readonly [number, number])[], closed: boolean, pen: Pen, cam: Camera, paperToPx: number, mode: LineWeights, from?: DashFrom): string {
  const base = pen.dash!.map((d) => Math.max(2, d * paperToPx));
  const style = `${penStyle(pen, paperToPx, mode)} fill="none"`;
  const pts = points.map((q) => cam.toScreen(q));
  const whole = from && { points: from.points.map((q) => cam.toScreen(q)), closed: from.closed, at: from.at * cam.scale };
  return dashPieces(pts, closed, base, whole)
    .map((d) => {
      const path = d.points.map((q, i) => `${i ? 'L' : 'M'}${f(q[0])} ${f(q[1])}`).join('');
      const dash = d.dash ? ` stroke-dasharray="${d.dash.map(f).join(' ')}"${d.offset > 1e-3 ? ` stroke-dashoffset="${f(d.offset)}"` : ''}` : '';
      return `<path d="${path}" ${style}${dash}/>`;
    })
    .join('');
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
