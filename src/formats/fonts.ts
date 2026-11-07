import { BUNDLED_METRICS } from './fontMetrics';
import { OSIFONT_METRICS, OSIFONT_WIDTHS } from './osifontWidths';

/**
 * Ritningens typsnitt (0.12): osifont som förval, två till som följer med
 * appen (Arimo, måttlik med Arial, och Josefin Sans) och ett eget, uppladdat
 * TrueType- eller OpenType-typsnitt i projektets filer. Samma fil ritar
 * texten på skärmen (`FontFace`) och bäddas in i PDF:en, och samma bredder
 * bryter och mäter texterna, så att skärmen och papperet är lika.
 *
 * Bredderna gäller WinAnsi-tecknen 32–255 (å, ä, ö och de vanliga tecknen),
 * i tusendelar av texthöjden; 0 betyder att tecknet saknas.
 */

export interface FontMetrics {
  widths: readonly number[];
  ascent: number;
  descent: number;
  capHeight: number;
  bbox: readonly number[];
  /** OpenType med CFF-konturer (inbäddas som FontFile3); annars TrueType. */
  cff?: boolean;
}

export interface DrawingFontInfo {
  /** `osifont`, `arimo`, `josefin`, eller filens id i projektet för ett eget typsnitt. */
  id: string;
  name: string;
  metrics: FontMetrics;
  /** Namnet i PDF:en (utan mellanslag). */
  pdfName: string;
}

const parse = (s: string) => s.split(',').map(Number);

export const OSIFONT: DrawingFontInfo = { id: 'osifont', name: 'osifont (ISO 3098)', pdfName: 'Osifont', metrics: { widths: OSIFONT_WIDTHS, ...OSIFONT_METRICS } };

/** Typsnitten som följer med appen, i listans ordning. */
export const BUNDLED_FONTS: readonly DrawingFontInfo[] = [
  OSIFONT,
  { id: 'arimo', name: 'Arimo (som Arial)', pdfName: 'Arimo', metrics: { ...BUNDLED_METRICS.arimo, widths: parse(BUNDLED_METRICS.arimo.widths) } },
  { id: 'josefin', name: 'Josefin Sans', pdfName: 'JosefinSans', metrics: { ...BUNDLED_METRICS.josefin, widths: parse(BUNDLED_METRICS.josefin.widths) } },
];

export const isBundledFont = (id: string | undefined): boolean => !!id && BUNDLED_FONTS.some((f) => f.id === id);

/** Filens innehåll (TTF/OTF) för ett typsnitt som följer med appen. Laddas först när det behövs. */
export async function bundledFontBytes(id: string): Promise<Uint8Array> {
  const b64 =
    id === 'arimo' ? (await import('./fontData/arimo')).TTF : id === 'josefin' ? (await import('./fontData/josefin')).TTF : (await import('./osifontData')).OSIFONT_TTF;
  return fromBase64(b64);
}

export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------------------
// Ett eget typsnitt: läs bredderna ur filen

/** WinAnsi 0x80–0x9F som Unicode (resten av 32–255 är samma som Latin-1). */
const WIN_HIGH = [0x20ac, 0, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0, 0x17d, 0, 0, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0, 0x17e, 0x178];
const winUnicode = (b: number) => (b >= 0x80 && b < 0xa0 ? WIN_HIGH[b - 0x80] : b);

/**
 * Måtten ur en TrueType- eller OpenType-fil (tabellerna head, hhea, hmtx,
 * cmap och OS/2), eller ett felmeddelande. WOFF och samlingar (TTC) går
 * inte; de måste packas upp först.
 */
export function readFontFile(bytes: Uint8Array): { metrics: FontMetrics; name: string } | { error: string } {
  if (bytes.length < 12) return { error: 'Filen är för kort för att vara ett typsnitt.' };
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = v.getUint32(0);
  if (tag === 0x774f4646 || tag === 0x774f4632) return { error: 'WOFF-filer går inte att bädda in; välj TTF- eller OTF-filen.' };
  if (tag === 0x74746366) return { error: 'Typsnittssamlingar (TTC) går inte; välj en enskild TTF- eller OTF-fil.' };
  if (tag !== 0x00010000 && tag !== 0x4f54544f && tag !== 0x74727565) return { error: 'Filen är inget TrueType- eller OpenType-typsnitt.' };
  const tables = new Map<string, number>();
  const count = v.getUint16(4);
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16;
    if (at + 16 > bytes.length) break;
    tables.set(String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]), v.getUint32(at + 8));
  }
  const head = tables.get('head');
  const hhea = tables.get('hhea');
  const hmtx = tables.get('hmtx');
  const cmap = tables.get('cmap');
  if (head === undefined || hhea === undefined || hmtx === undefined || cmap === undefined) return { error: 'Typsnittet saknar tabeller som behövs (head, hhea, hmtx, cmap).' };
  try {
    const upm = v.getUint16(head + 18) || 1000;
    const k = 1000 / upm;
    const bbox = [v.getInt16(head + 36), v.getInt16(head + 38), v.getInt16(head + 40), v.getInt16(head + 42)].map((x) => Math.round(x * k));
    const ascent = Math.round(v.getInt16(hhea + 4) * k);
    const descent = Math.round(v.getInt16(hhea + 6) * k);
    const nh = v.getUint16(hhea + 34);
    const advance = (g: number) => v.getUint16(hmtx + 4 * Math.min(g, nh - 1));
    const glyphOf = cmapReader(v, cmap);
    if (!glyphOf) return { error: 'Typsnittet har ingen Unicode-tabell som går att läsa.' };
    const widths: number[] = [];
    for (let b = 32; b < 256; b++) {
      const u = winUnicode(b);
      const g = u ? glyphOf(u) : 0;
      widths.push(g ? Math.round(advance(g) * k) : 0);
    }
    if (!widths[33]) return { error: 'Typsnittet saknar de vanliga bokstäverna.' };
    const os2 = tables.get('OS/2');
    const capHeight = os2 !== undefined && v.getUint16(os2) >= 2 ? Math.round(v.getInt16(os2 + 88) * k) : Math.round(ascent * 0.7);
    return { metrics: { widths, ascent, descent, capHeight: capHeight || Math.round(ascent * 0.7), bbox, ...(tables.has('CFF ') ? { cff: true } : {}) }, name: fontName(v, bytes, tables.get('name')) };
  } catch {
    return { error: 'Typsnittet gick inte att läsa.' };
  }
}

/** Glyfen för ett tecken ur cmap (format 4 eller 12, Windows Unicode). */
function cmapReader(v: DataView, cmap: number): ((u: number) => number) | null {
  const n = v.getUint16(cmap + 2);
  let best: { off: number; fmt: number } | null = null;
  for (let i = 0; i < n; i++) {
    const pid = v.getUint16(cmap + 4 + i * 8);
    const eid = v.getUint16(cmap + 6 + i * 8);
    const off = cmap + v.getUint32(cmap + 8 + i * 8);
    const fmt = v.getUint16(off);
    if ((fmt === 4 || fmt === 12) && (pid === 0 || (pid === 3 && (eid === 1 || eid === 10)))) {
      if (!best || fmt === 4) best = { off, fmt };
    }
  }
  if (!best) return null;
  const o = best.off;
  if (best.fmt === 12) {
    const groups = v.getUint32(o + 12);
    return (u) => {
      for (let i = 0; i < groups; i++) {
        const s = v.getUint32(o + 16 + i * 12);
        const e = v.getUint32(o + 20 + i * 12);
        if (u >= s && u <= e) return v.getUint32(o + 24 + i * 12) + (u - s);
      }
      return 0;
    };
  }
  const segX2 = v.getUint16(o + 6);
  const ends = o + 14;
  const starts = ends + segX2 + 2;
  const deltas = starts + segX2;
  const ranges = deltas + segX2;
  return (u) => {
    for (let i = 0; i < segX2 / 2; i++) {
      if (u > v.getUint16(ends + i * 2)) continue;
      const s = v.getUint16(starts + i * 2);
      if (u < s) return 0;
      const delta = v.getInt16(deltas + i * 2);
      const ro = v.getUint16(ranges + i * 2);
      if (!ro) return (u + delta) & 0xffff;
      const g = v.getUint16(ranges + i * 2 + ro + (u - s) * 2);
      return g ? (g + delta) & 0xffff : 0;
    }
    return 0;
  };
}

/** Familjens namn ur namntabellen, eller ”Eget typsnitt”. */
function fontName(v: DataView, bytes: Uint8Array, name: number | undefined): string {
  if (name === undefined) return 'Eget typsnitt';
  const count = v.getUint16(name + 2);
  const strings = name + v.getUint16(name + 4);
  let found = '';
  for (let i = 0; i < count; i++) {
    const r = name + 6 + i * 12;
    const pid = v.getUint16(r);
    const nid = v.getUint16(r + 6);
    if (nid !== 1 && nid !== 16) continue;
    const len = v.getUint16(r + 8);
    const off = strings + v.getUint16(r + 10);
    let s = '';
    if (pid === 3 || pid === 0) for (let j = 0; j + 1 < len; j += 2) s += String.fromCharCode(v.getUint16(off + j));
    else for (let j = 0; j < len; j++) s += String.fromCharCode(bytes[off + j]);
    // Den typografiska familjen (16) före familjen (1), som kan ha vikten i namnet.
    if (s.trim() && (nid === 16 || !found)) found = s.trim();
    if (nid === 16 && found) break;
  }
  return found || 'Eget typsnitt';
}

// ---------------------------------------------------------------------------
// Projektets typsnitt

interface FontDoc {
  graphics?: { font?: string };
  assets?: Record<string, { data: string; name?: string }>;
}

const customCache = new Map<string, DrawingFontInfo | null>();

/**
 * Typsnittet projektet ritar med: stilbokens `font` (ett som följer med
 * appen eller en fil i projektet). Ett eget som saknas eller inte går att
 * läsa blir osifont.
 */
export function fontOf(doc: FontDoc): DrawingFontInfo {
  const id = doc.graphics?.font;
  if (!id || id === 'osifont') return OSIFONT;
  const bundled = BUNDLED_FONTS.find((f) => f.id === id);
  if (bundled) return bundled;
  const asset = doc.assets?.[id];
  if (!asset) return OSIFONT;
  const key = `${id}:${asset.data.length}:${asset.data.slice(0, 64)}`;
  if (!customCache.has(key)) {
    const r = readFontFile(fromBase64(asset.data));
    customCache.set(key, 'error' in r ? null : { id, name: r.name, metrics: r.metrics, pdfName: r.name.replace(/[^A-Za-z0-9]/g, '') || 'EgetTypsnitt' });
  }
  return customCache.get(key) ?? OSIFONT;
}
