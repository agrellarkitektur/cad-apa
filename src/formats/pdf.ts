import { dashPieces, type DashFrom } from '../repr/dash';
import type { FillDef } from '../core/graphics';
import { drawnDash, evenDash, hatchAsPattern } from '../core/fillTypes';
import { hatchStrokes } from '../core/hatchStrokes';
import type { Bounds, Pen, PenColor, Primitive, Vec2 } from '../repr/primitives';
import { drawingBytes, textWidth } from './drawingFont';
import { OSIFONT_METRICS, OSIFONT_WIDTHS } from './osifontWidths';

export { textWidth } from './drawingFont';

/**
 * PDF i vektorform (0.8 del 3), utan bibliotek. Ritar samma primitiver som
 * skärmen: linjer, ytor, skraffering, bågar, text och bilder. Måtten i
 * primitiverna är mm på papperet, med nollpunkten i nedre vänstra hörnet och
 * y uppåt, precis som i PDF.
 *
 * Texten skrivs med osifont (0.8.18), som bäddas in, och WinAnsi-kodning,
 * som har å, ä och ö. Fet text får ett tunt streck runt tecknen. Bilder (underlag och loggor) läggs in
 * som JPEG.
 *
 * Läsaren behöver inte känna till något annat i programmet; den används av
 * Plot/export och av testerna.
 */

export interface PdfPage {
  /** Bredd och höjd i mm. */
  size: readonly [number, number];
  prims: readonly Primitive[];
}

/** En bild att lägga in, som JPEG. */
export interface PdfImage {
  width: number;
  height: number;
  jpeg: Uint8Array;
}

export interface PdfOptions {
  title?: string;
  /** Bilderna, efter `imageKey`. Saknas en bild ritas en tunn ram i dess ställe. */
  images?: ReadonlyMap<string, PdfImage>;
  /** Packa innehållet (FlateDecode); utelämnad = opackat. */
  deflate?: (bytes: Uint8Array) => Promise<Uint8Array>;
}

/** Nyckeln en bild hämtas med: fil, sida och gråskala. */
export function imageKey(src: { asset: string; page?: number }, gray?: boolean): string {
  return `${src.asset}:${src.page ?? 0}:${gray ? 'g' : 'c'}`;
}

/** Punkter (1/72 tum) per mm. */
const PT = 72 / 25.4;

function n(x: number): string {
  const r = Math.round(x * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

function rgb(c: PenColor): [number, number, number] {
  switch (c) {
    case 'ink':
    case 'accent':
      return [0, 0, 0];
    case 'paper':
      return [1, 1, 1];
    case 'muted':
      return [0.55, 0.55, 0.55];
  }
  let h = c.replace('#', '');
  if (h.length === 3 || h.length === 4) h = [...h.slice(0, 3)].map((x) => x + x).join('');
  const v = parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(v)) return [0, 0, 0];
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

const colorOp = (c: PenColor, stroke: boolean) => `${rgb(c).map(n).join(' ')} ${stroke ? 'RG' : 'rg'}`;

/** Bygger innehållet på en sida. */
class PageWriter {
  readonly ops: string[] = [];
  readonly alphas = new Set<number>();
  readonly images = new Set<string>();
  /** Sidan har text, så att typsnittet behöver bäddas in. */
  usesFont = false;

  private imgs: ReadonlyMap<string, PdfImage>;

  constructor(imgs: ReadonlyMap<string, PdfImage>) {
    this.imgs = imgs;
  }

  private alpha(a: number | undefined): string {
    if (a === undefined || a >= 1) return '';
    const k = Math.max(0, Math.min(1, Math.round(a * 100) / 100));
    this.alphas.add(k);
    return `/GS${Math.round(k * 100)} gs `;
  }

  private path(points: readonly Vec2[], closed: boolean): string {
    return points.map((p, i) => `${n(p[0])} ${n(p[1])} ${i ? 'l' : 'm'}`).join(' ') + (closed ? ' h' : '');
  }

  private strokeState(pen: Pen): string {
    return `${this.alpha(pen.opacity)}${colorOp(pen.color ?? 'ink', true)} ${n(Math.max(0.05, pen.weight))} w`;
  }

  /** En linje genom punkterna, streckad sträcka för sträcka som på skärmen. */
  private stroke(points: readonly Vec2[], closed: boolean, pen: Pen, from?: DashFrom): void {
    // Tjockleken 0 ritas inte (2D-former utan linje, 0.8.19).
    if (points.length < 2 || pen.weight === 0) return;
    const state = this.strokeState(pen);
    if (!pen.dash?.length) {
      this.ops.push(`q ${state} ${this.path(points, closed)} S Q`);
      return;
    }
    // Mönstret löper genom mjuka brytpunkter och töjs mellan skarpa hörn (0.8.30, `dashPieces`).
    const base = pen.dash.map((d) => Math.max(0.2, d));
    const parts = dashPieces(points, closed, base, from).map((d) => {
      const seg = d.points.map((q, i) => `${n(q[0])} ${n(q[1])} ${i ? 'l' : 'm'}`).join(' ');
      return `${d.dash ? `[${d.dash.map(n).join(' ')}] ${n(d.offset)}` : '[] 0'} d ${seg} S`;
    });
    if (parts.length) this.ops.push(`q ${state} ${parts.join(' ')} Q`);
  }

  private fill(rings: readonly (readonly Vec2[])[], fill: FillDef): void {
    const d = rings.map((r) => this.path(r, true)).join(' ');
    // Skrafferingen är ett mönster med en familj (0.8.38), förankrad i papperets nollpunkt.
    const f = hatchAsPattern(fill, 0.3);
    if (f.kind === 'solid') this.ops.push(`q ${this.alpha(f.opacity)}${colorOp(f.color, false)} ${d} f* Q`);
    else if (f.kind === 'pattern') this.pattern(rings, d, f);
  }

  /**
   * Ett mönster av linjefamiljer (0.8.36): ytan som klippram och varje
   * familjs linjer över den, var och en med sin streckning och fas.
   */
  private pattern(rings: readonly (readonly Vec2[])[], d: string, fill: Extract<FillDef, { kind: 'pattern' }>): void {
    const pts = rings.flat();
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const box = { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
    const parts: string[] = [`q ${d} W* n`];
    if (fill.background) parts.push(`${this.alpha(fill.backgroundOpacity)}${colorOp(fill.background, false)} ${d} f*`);
    parts.push(`${this.alpha(fill.opacity)}${colorOp(fill.color, true)} ${n(Math.max(0.05, fill.weight))} w`);
    let budget = 20000;
    for (const l of fill.lines) {
      if (!(l.spacing >= 0.05) || budget <= 0) continue;
      const even = evenDash(l.dash);
      const drawn = even && drawnDash(even);
      parts.push(drawn?.round ? '1 J' : '0 J');
      const strokes = hatchStrokes(l, box, budget);
      budget -= strokes.length;
      const seg = (s: (typeof strokes)[number]) => `${n(s.a[0])} ${n(s.a[1])} m ${n(s.b[0])} ${n(s.b[1])} l`;
      if (!drawn) parts.push(`[] 0 d ${strokes.map(seg).join(' ')} S`);
      else {
        const arr = `[${drawn.dash.map(n).join(' ')}]`;
        parts.push(strokes.map((s) => `${arr} ${n(s.phase)} d ${seg(s)} S`).join(' '));
      }
    }
    parts.push('Q');
    this.ops.push(parts.join(' '));
  }

  /** En båge moturs från start till slut som kubiska Bézierkurvor. */
  private arc(c: Vec2, r: number, start: number, end: number, pen: Pen): void {
    if (pen.weight === 0) return;
    let sweep = (((end - start) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (sweep < 1e-9) sweep = 2 * Math.PI;
    const pieces = Math.ceil(sweep / (Math.PI / 2));
    const step = sweep / pieces;
    const k = (4 / 3) * Math.tan(step / 4);
    if (pen.dash?.length) {
      // Streckade bågar ritas som korta raka bitar, så att strecken töjs som på raka linjer.
      const m = Math.max(8, Math.ceil(sweep / (Math.PI / 36)));
      const pts: Vec2[] = [];
      for (let i = 0; i <= m; i++) {
        const a = start + (sweep * i) / m;
        pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
      }
      this.stroke(pts, false, pen);
      return;
    }
    const parts: string[] = [`${n(c[0] + r * Math.cos(start))} ${n(c[1] + r * Math.sin(start))} m`];
    for (let i = 0; i < pieces; i++) {
      const a0 = start + i * step;
      const a1 = a0 + step;
      const p1: Vec2 = [c[0] + r * (Math.cos(a0) - k * Math.sin(a0)), c[1] + r * (Math.sin(a0) + k * Math.cos(a0))];
      const p2: Vec2 = [c[0] + r * (Math.cos(a1) + k * Math.sin(a1)), c[1] + r * (Math.sin(a1) - k * Math.cos(a1))];
      const p3: Vec2 = [c[0] + r * Math.cos(a1), c[1] + r * Math.sin(a1)];
      parts.push(`${n(p1[0])} ${n(p1[1])} ${n(p2[0])} ${n(p2[1])} ${n(p3[0])} ${n(p3[1])} c`);
    }
    this.ops.push(`q ${this.strokeState(pen)} ${parts.join(' ')} S Q`);
  }

  private text(p: Extract<Primitive, { kind: 'text' }>): void {
    if (!p.text) return;
    const bold = !!p.bold;
    this.usesFont = true;
    const a = p.angle ?? 0;
    const w = textWidth(p.text, p.height, bold);
    const shift = p.align === 'middle' ? w / 2 : p.align === 'end' ? w : 0;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const x = p.at[0] - shift * cos;
    const y = p.at[1] - shift * sin;
    const lines = p.text.split('\n');
    const body = lines
      .map((l, i) => {
        const s = drawingBytes(l)
          .map((b) => (b === 0x28 || b === 0x29 || b === 0x5c ? `\\${String.fromCharCode(b)}` : b < 0x20 || b > 0x7e ? `\\${b.toString(8).padStart(3, '0')}` : String.fromCharCode(b)))
          .join('');
        return `${i ? `0 ${n(-p.height * 1.5)} Td ` : ''}(${s}) Tj`;
      })
      .join(' ');
    // Fet: samma typsnitt, fyllt och med ett tunt streck i samma färg.
    const fill = colorOp(p.pen.color ?? 'ink', false);
    const heavy = bold ? `${colorOp(p.pen.color ?? 'ink', true)} ${n(p.height * 0.045)} w 2 Tr ` : '';
    this.ops.push(`q ${this.alpha(p.pen.opacity)}${fill} ${heavy}BT /F1 ${n(p.height)} Tf ${n(cos)} ${n(sin)} ${n(-sin)} ${n(cos)} ${n(x)} ${n(y)} Tm ${body} ET Q`);
  }

  private image(p: Extract<Primitive, { kind: 'image' }>): void {
    const key = imageKey(p.source, p.gray);
    const clip = p.clip ? `${this.rect(p.clip)} W n ` : '';
    if (!this.imgs.has(key)) {
      // Bilden saknas: en tunn ram där den skulle ha legat.
      const c = p.corner;
      const ring: Vec2[] = [c, [c[0] + p.u[0], c[1] + p.u[1]], [c[0] + p.u[0] + p.v[0], c[1] + p.u[1] + p.v[1]], [c[0] + p.v[0], c[1] + p.v[1]]];
      this.ops.push(`q ${clip}${this.strokeState({ weight: 0.13, color: 'muted' })} ${this.path(ring, true)} S Q`);
      return;
    }
    this.images.add(key);
    const m = [p.u[0], p.u[1], p.v[0], p.v[1], p.corner[0], p.corner[1]].map(n).join(' ');
    this.ops.push(`q ${clip}${this.alpha(p.opacity)}${m} cm /${imageName(key)} Do Q`);
  }

  private rect(b: Bounds): string {
    return `${n(b.minX)} ${n(b.minY)} ${n(b.maxX - b.minX)} ${n(b.maxY - b.minY)} re`;
  }

  draw(p: Primitive): void {
    switch (p.kind) {
      case 'line':
        this.stroke([p.a, p.b], false, p.pen);
        break;
      case 'polyline':
        this.stroke(p.points, p.closed, p.pen, p.dashFrom);
        break;
      case 'region':
        if (p.fill.kind !== 'none') this.fill(p.rings, p.fill);
        if (p.outline) for (const r of p.rings) this.stroke(r, true, p.outline);
        break;
      case 'arc':
        this.arc(p.center, p.radius, p.start, p.end, p.pen);
        break;
      case 'text':
        this.text(p);
        break;
      case 'image':
        this.image(p);
        break;
    }
  }
}

const imageNames = new Map<string, string>();
function imageName(key: string): string {
  let name = imageNames.get(key);
  if (!name) imageNames.set(key, (name = `Im${imageNames.size + 1}`));
  return name;
}

const enc = new TextEncoder();

/** Ett PDF-dokument med en sida per `PdfPage`. */
export async function writePdf(pages: readonly PdfPage[], opt: PdfOptions = {}): Promise<Uint8Array> {
  const images = opt.images ?? new Map<string, PdfImage>();
  const objects: (Uint8Array | string)[] = [];
  const add = (o: Uint8Array | string): number => objects.push(o);
  const stream = (dict: string, data: Uint8Array): Uint8Array => {
    const head = enc.encode(`<< ${dict} /Length ${data.length} >>\nstream\n`);
    const tail = enc.encode('\nendstream');
    const out = new Uint8Array(head.length + data.length + tail.length);
    out.set(head, 0);
    out.set(data, head.length);
    out.set(tail, head.length + data.length);
    return out;
  };

  // Objekt 1 och 2: katalogen och sidträdet, som fylls i sist.
  add('');
  add('');
  // Typsnittet (osifont, 0.8.18) fylls i sist, och bäddas bara in om någon sida har text.
  const font = add('');
  let anyText = false;
  const imageObj = new Map<string, number>();
  const pageIds: number[] = [];
  for (const page of pages) {
    const w = new PageWriter(images);
    // Allt anges i mm: skala om från punkter en gång för hela sidan.
    w.ops.push(`${n(PT)} 0 0 ${n(PT)} 0 0 cm 1 J 1 j`);
    for (const p of page.prims) {
      // Papperet självt ritas inte; det är bara en bakgrund på skärmen. Inte heller markeringar för skärmen (0.8.9).
      if (p.origin?.part === 'papper' || p.origin?.part === 'skärm') continue;
      w.draw(p);
    }
    anyText ||= w.usesFont;
    const raw = enc.encode(w.ops.join('\n'));
    const data = opt.deflate ? await opt.deflate(raw) : raw;
    const content = add(stream(opt.deflate ? '/Filter /FlateDecode' : '', data));
    for (const key of w.images) {
      if (imageObj.has(key)) continue;
      const img = images.get(key)!;
      // Gråskalan är redan gjord i bilden; JPEG från webbläsaren har alltid tre kanaler.
      imageObj.set(key, add(stream(`/Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, img.jpeg)));
    }
    const res = [
      w.usesFont ? `/Font << /F1 ${font} 0 R >>` : '',
      w.alphas.size ? `/ExtGState << ${[...w.alphas].map((a) => `/GS${Math.round(a * 100)} << /CA ${n(a)} /ca ${n(a)} >>`).join(' ')} >>` : '',
      w.images.size ? `/XObject << ${[...w.images].map((k) => `/${imageName(k)} ${imageObj.get(k)} 0 R`).join(' ')} >>` : '',
    ].join(' ');
    pageIds.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(page.size[0] * PT)} ${n(page.size[1] * PT)}] /Resources << ${res} >> /Contents ${content} 0 R >>`));
  }
  if (anyText) {
    const { OSIFONT_TTF } = await import('./osifontData');
    const ttf = Uint8Array.from(atob(OSIFONT_TTF), (c) => c.charCodeAt(0));
    const packed = opt.deflate ? await opt.deflate(ttf) : ttf;
    const file = add(stream(`/Length1 ${ttf.length}${opt.deflate ? ' /Filter /FlateDecode' : ''}`, packed));
    const m = OSIFONT_METRICS;
    const desc = add(`<< /Type /FontDescriptor /FontName /Osifont /Flags 32 /FontBBox [${m.bbox.join(' ')}] /ItalicAngle 0 /Ascent ${m.ascent} /Descent ${m.descent} /CapHeight ${m.capHeight} /StemV 60 /FontFile2 ${file} 0 R >>`);
    objects[font - 1] = `<< /Type /Font /Subtype /TrueType /BaseFont /Osifont /FirstChar 32 /LastChar 255 /Widths [${OSIFONT_WIDTHS.join(' ')}] /FontDescriptor ${desc} 0 R /Encoding /WinAnsiEncoding >>`;
  } else objects[font - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  const info = add(`<< /Producer (Bacchus) /Title (${(opt.title ?? '').replace(/[()\\]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, '')}) >>`);

  // Sätt ihop filen med korsreferenstabellen.
  const chunks: Uint8Array[] = [enc.encode('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')];
  let offset = chunks[0].length;
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(offset);
    const body = typeof o === 'string' ? enc.encode(o) : o;
    const head = enc.encode(`${i + 1} 0 obj\n`);
    const tail = enc.encode('\nendobj\n');
    chunks.push(head, body, tail);
    offset += head.length + body.length + tail.length;
  });
  const xref = [`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`, ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)].join('');
  chunks.push(enc.encode(`${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${offset}\n%%EOF\n`));
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** Packa med deflate (zlib) i webbläsaren eller Node, eller null om det inte går. */
export function browserDeflate(): ((bytes: Uint8Array) => Promise<Uint8Array>) | undefined {
  if (typeof CompressionStream === 'undefined') return undefined;
  return async (bytes) => {
    const s = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  };
}
