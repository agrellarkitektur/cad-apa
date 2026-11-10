/**
 * DXF-skrivaren (0.12.1), utan bibliotek. Skriver ASCII-DXF i version
 * AutoCAD 2000 (AC1015, öppnas av alla program) eller AutoCAD 2018
 * (AC1032). Alla sektioner skrivs fullständigt (HEADER, CLASSES, TABLES,
 * BLOCKS, ENTITIES, OBJECTS) med handtag och ägare, så att petiga läsare
 * inte klagar; strukturen följer den som AutoCAD själv skriver.
 *
 * Skrivaren vet inget om programmet: den får lagren, linjetyperna och
 * entiteterna färdiga (`exportDxf.ts` gör om primitiverna). 2000 skrivs i
 * teckentabellen 1252 (å, ä och ö som de är, andra tecken som `\U+XXXX`),
 * 2018 i UTF-8.
 */

export type DxfVersion = 'R2000' | 'R2018';

export const DXF_VERSIONS: readonly DxfVersion[] = ['R2000', 'R2018'];
export const DXF_VERSION_LABEL: Record<DxfVersion, string> = { R2000: 'AutoCAD 2000', R2018: 'AutoCAD 2018' };

/** Ett lager: namn, färg (ACI 1–255), linjetyp, linjetjocklek i hundradels mm (−3 = standard). */
export interface DxfLayer {
  name: string;
  color: number;
  linetype?: string;
  lineweight: number;
  /** Skrivs ut; utelämnat = ja. */
  plot?: boolean;
  /** Beskrivningen, som AutoCAD visar i lagerhanteraren. */
  desc?: string;
}

/** En linjetyp: mönstret i ritningens enheter före `$LTSCALE` (streck, mellanrum, 0 = punkt). */
export interface DxfLinetype {
  name: string;
  desc?: string;
  pattern: readonly number[];
}

/** Det varje entitet har: lager, och färg, linjetyp och tjocklek när de inte följer lagret. */
export interface DxfProps {
  layer: string;
  /** ACI 1–255; utelämnat = lagrets (BYLAYER). */
  color?: number;
  /** Färgen i RGB (bara 2018), t.ex. för en grå yta. */
  rgb?: number;
  /** Täckning 0–1 (bara 2018). */
  opacity?: number;
  /** Linjetypens namn; utelämnat = lagrets. */
  linetype?: string;
  /** Hundradels mm; utelämnat = lagrets. */
  lineweight?: number;
}

export type DxfPoint = readonly [number, number];

export type DxfEntity = DxfProps &
  (
    | { kind: 'line'; a: DxfPoint; b: DxfPoint }
    | { kind: 'poly'; points: readonly DxfPoint[]; closed: boolean }
    | { kind: 'arc'; center: DxfPoint; radius: number; /** Grader moturs. */ start: number; end: number }
    | { kind: 'circle'; center: DxfPoint; radius: number }
    | { kind: 'text'; at: DxfPoint; text: string; height: number; /** Grader moturs. */ angle: number; align: 'start' | 'middle' | 'end'; style?: string }
    | {
        kind: 'hatch';
        rings: readonly (readonly DxfPoint[])[];
        /** Utelämnat = solid fyllning. */
        lines?: readonly { angle: number; base: DxfPoint; offset: DxfPoint; dash: readonly number[] }[];
      }
  );

export interface DxfDocument {
  version: DxfVersion;
  layers: readonly DxfLayer[];
  linetypes: readonly DxfLinetype[];
  /** Textstilarna: namn och typsnittsfil (t.ex. `isocp.shx`, `arial.ttf`). */
  styles: readonly { name: string; font: string }[];
  entities: readonly DxfEntity[];
  /** Linjetypernas skala ($LTSCALE): vyns skala i modellen, 1 på papperet. */
  ltscale: number;
  /** Texthöjden som förval ($TEXTSIZE). */
  textSize?: number;
}

/** De linjetjocklekar AutoCAD har, i hundradels mm. */
const LINEWEIGHTS = [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211];

/** Närmaste linjetjocklek AutoCAD har för en tjocklek i mm. */
export function lineweightOf(mm: number): number {
  const v = mm * 100;
  return LINEWEIGHTS.reduce((best, w) => (Math.abs(w - v) < Math.abs(best - v) ? w : best), LINEWEIGHTS[0]);
}

/** Ett tal som DXF vill ha det: högst sex decimaler, aldrig med exponent. */
function num(x: number): string {
  if (!Number.isFinite(x)) return '0.0';
  const r = Math.round(x * 1e6) / 1e6;
  if (Math.abs(r) < 1e-9) return '0.0';
  const s = r.toFixed(6).replace(/0+$/, '');
  return s.endsWith('.') ? `${s}0` : s;
}

/** Ett handtag i taget, hexadecimalt. */
class Handles {
  private next = 0x20;
  get(): string {
    return (this.next++).toString(16).toUpperCase();
  }
  get seed(): string {
    return this.next.toString(16).toUpperCase();
  }
}

/** Gruppkoder och värden, rad för rad. */
class Out {
  readonly lines: string[] = [];
  g(code: number, value: string | number): this {
    this.lines.push(String(code).padStart(3, ' '), typeof value === 'number' ? (intCode(code) ? String(Math.round(value)) : num(value)) : value);
    return this;
  }
}

/** Koder som är heltal (inte flyttal), efter DXF-referensen. */
function intCode(code: number): boolean {
  return (code >= 60 && code <= 99) || (code >= 160 && code <= 179) || (code >= 270 && code <= 289) || (code >= 370 && code <= 389) || (code >= 400 && code <= 409) || (code >= 420 && code <= 459) || (code >= 1060 && code <= 1071) || code === 290 || code === 291;
}

/** Texten till teckentabellen 1252 (2000): det som inte finns där som `\U+XXXX`. */
const CP1252_HIGH = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';
function encode1252(text: string): Uint8Array {
  const out: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80 || (c >= 0xa0 && c <= 0xff)) out.push(c);
    else {
      const i = CP1252_HIGH.indexOf(ch);
      if (i >= 0) out.push(0x80 + i);
      else for (const b of `\\U+${c.toString(16).toUpperCase().padStart(4, '0')}`) out.push(b.charCodeAt(0));
    }
  }
  return new Uint8Array(out);
}

/** Klasserna AutoCAD skriver för objekten i OBJECTS. */
const CLASSES: [string, string, string, number][] = [
  ['ACDBDICTIONARYWDFLT', 'AcDbDictionaryWithDefault', 'ObjectDBX Classes', 0],
  ['MATERIAL', 'AcDbMaterial', 'ObjectDBX Classes', 1153],
  ['MLEADERSTYLE', 'AcDbMLeaderStyle', 'ACDB_MLEADERSTYLE_CLASS', 4095],
  ['ACDBPLACEHOLDER', 'AcDbPlaceHolder', 'ObjectDBX Classes', 0],
  ['LAYOUT', 'AcDbLayout', 'ObjectDBX Classes', 0],
];

/** Materialens koder, som AutoCAD skriver dem för ByBlock, ByLayer och Global. */
const MATERIAL_CODES: [number, string | number][] = [[2, ''], [70, 0], [40, 1], [71, 1], [41, 1], [91, -1023410177], [42, 1], [72, 1], [3, ''], [73, 1], [74, 1], [75, 1], [44, 0.5], [73, 0], [45, 1], [46, 1], [77, 1], [4, ''], [78, 1], [79, 1], [170, 1], [48, 1], [171, 1], [6, ''], [172, 1], [173, 1], [174, 1], [140, 1], [141, 1], [175, 1], [7, ''], [176, 1], [177, 1], [178, 1], [143, 1], [179, 1], [8, ''], [270, 1], [271, 1], [272, 1], [145, 1], [146, 1], [273, 1], [9, ''], [274, 1], [275, 1], [276, 1], [42, 1], [72, 1], [3, ''], [73, 1], [74, 1], [75, 1], [94, 63]];

/** Skriver DXF-filen. */
export function writeDxf(d: DxfDocument): Uint8Array {
  const v2018 = d.version === 'R2018';
  const h = new Handles();
  const o = new Out();
  // Handtagen som tabellerna och objekten pekar på, bestämda i förväg.
  const H = {
    root: h.get(),
    groups: h.get(),
    layouts: h.get(),
    materials: h.get(),
    mleaderDict: h.get(),
    mlineDict: h.get(),
    plotStyles: h.get(),
    normal: h.get(),
    mline: h.get(),
    mleader: h.get(),
    matByBlock: h.get(),
    matByLayer: h.get(),
    matGlobal: h.get(),
    tVport: h.get(),
    tLtype: h.get(),
    tLayer: h.get(),
    tStyle: h.get(),
    tView: h.get(),
    tUcs: h.get(),
    tAppid: h.get(),
    tDimstyle: h.get(),
    tBlock: h.get(),
    msRecord: h.get(),
    psRecord: h.get(),
    msLayout: h.get(),
    psLayout: h.get(),
  };

  // Utbredningen, så att filen öppnas med allt i bild.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (p: DxfPoint, r = 0) => {
    minX = Math.min(minX, p[0] - r);
    minY = Math.min(minY, p[1] - r);
    maxX = Math.max(maxX, p[0] + r);
    maxY = Math.max(maxY, p[1] + r);
  };
  for (const e of d.entities) {
    if (e.kind === 'line') (add(e.a), add(e.b));
    else if (e.kind === 'poly') e.points.forEach((p) => add(p));
    else if (e.kind === 'arc' || e.kind === 'circle') add(e.center, e.radius);
    else if (e.kind === 'text') add(e.at);
    else e.rings.forEach((r) => r.forEach((p) => add(p)));
  }
  if (!Number.isFinite(minX)) [minX, minY, maxX, maxY] = [0, 0, 1000, 1000];
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const viewH = Math.max(1, (maxY - minY) * 1.1, ((maxX - minX) * 1.1) / 1.5);

  // HEADER
  o.g(0, 'SECTION').g(2, 'HEADER');
  const hv = (name: string, code: number, value: string | number) => o.g(9, name).g(code, value);
  hv('$ACADVER', 1, v2018 ? 'AC1032' : 'AC1015');
  o.g(9, '$ACADMAINTVER').g(v2018 ? 90 : 70, v2018 ? 4 : 6);
  hv('$DWGCODEPAGE', 3, 'ANSI_1252');
  if (v2018) hv('$LASTSAVEDBY', 1, 'cad-apa');
  o.g(9, '$INSBASE').g(10, 0).g(20, 0).g(30, 0);
  o.g(9, '$EXTMIN').g(10, minX).g(20, minY).g(30, 0);
  o.g(9, '$EXTMAX').g(10, maxX).g(20, maxY).g(30, 0);
  o.g(9, '$LIMMIN').g(10, minX).g(20, minY);
  o.g(9, '$LIMMAX').g(10, maxX).g(20, maxY);
  hv('$LTSCALE', 40, d.ltscale);
  hv('$TEXTSIZE', 40, d.textSize ?? 2.5);
  hv('$TEXTSTYLE', 7, d.styles[0]?.name ?? 'Standard');
  hv('$CLAYER', 8, '0');
  hv('$CELTYPE', 6, 'ByLayer');
  hv('$CECOLOR', 62, 256);
  hv('$CELTSCALE', 40, 1);
  hv('$DIMSTYLE', 2, 'Standard');
  hv('$LUNITS', 70, 2);
  hv('$LUPREC', 70, 0);
  hv('$AUNITS', 70, 0);
  hv('$HANDSEED', 5, 'FFFF');
  hv('$PSLTSCALE', 70, 1);
  hv('$MEASUREMENT', 70, 1);
  hv('$CELWEIGHT', 370, -1);
  hv('$LWDISPLAY', 290, 1);
  hv('$INSUNITS', 70, 4);
  hv('$PSTYLEMODE', 290, 1);
  o.g(0, 'ENDSEC');
  const seedAt = o.lines.indexOf('FFFF');

  // CLASSES
  o.g(0, 'SECTION').g(2, 'CLASSES');
  for (const [name, cpp, app, flags] of CLASSES) {
    o.g(0, 'CLASS').g(1, name).g(2, cpp).g(3, app).g(90, flags);
    if (v2018) o.g(91, 0);
    o.g(280, 0).g(281, 0);
  }
  o.g(0, 'ENDSEC');

  // TABLES
  o.g(0, 'SECTION').g(2, 'TABLES');
  const table = (name: string, handle: string, count: number) => o.g(0, 'TABLE').g(2, name).g(5, handle).g(330, 0).g(100, 'AcDbSymbolTable').g(70, count);
  const record = (type: string, owner: string, sub: string) => o.g(0, type).g(5, h.get()).g(330, owner).g(100, 'AcDbSymbolTableRecord').g(100, sub);

  table('VPORT', H.tVport, 1);
  record('VPORT', H.tVport, 'AcDbViewportTableRecord').g(2, '*Active').g(70, 0);
  o.g(10, 0).g(20, 0).g(11, 1).g(21, 1).g(12, cx).g(22, cy).g(13, 0).g(23, 0).g(14, 10).g(24, 10).g(15, 10).g(25, 10);
  o.g(16, 0).g(26, 0).g(36, 1).g(17, 0).g(27, 0).g(37, 0).g(40, viewH).g(41, 1.5).g(42, 50).g(43, 0).g(44, 0).g(50, 0).g(51, 0);
  o.g(71, 0).g(72, 1000).g(73, 1).g(74, 3).g(75, 0).g(76, 0).g(77, 0).g(78, 0).g(281, 0).g(65, 0).g(146, 0);
  o.g(0, 'ENDTAB');

  const ltypes: DxfLinetype[] = [
    { name: 'ByBlock', pattern: [] },
    { name: 'ByLayer', pattern: [] },
    { name: 'Continuous', desc: 'Solid line', pattern: [] },
    ...d.linetypes.filter((t) => !['byblock', 'bylayer', 'continuous'].includes(t.name.toLowerCase())),
  ];
  table('LTYPE', H.tLtype, ltypes.length);
  for (const t of ltypes) {
    // Strecken positiva, mellanrummen negativa, punkterna 0 (som i .lin).
    const elems = t.pattern.map((x, i) => (i % 2 ? -Math.abs(x) : x < 0.05 ? 0 : x));
    record('LTYPE', H.tLtype, 'AcDbLinetypeTableRecord').g(2, t.name).g(70, 0).g(3, t.desc ?? '').g(72, 65).g(73, elems.length).g(40, elems.reduce((s, x) => s + Math.abs(x), 0));
    for (const x of elems) o.g(49, x).g(74, 0);
  }
  o.g(0, 'ENDTAB');

  const layers: DxfLayer[] = [
    { name: '0', color: 7, lineweight: -3 },
    { name: 'Defpoints', color: 7, lineweight: -3, plot: false },
    ...d.layers.filter((l) => l.name !== '0' && l.name.toLowerCase() !== 'defpoints'),
  ];
  const described = layers.some((l) => l.desc);
  table('LAYER', H.tLayer, layers.length);
  for (const l of layers) {
    record('LAYER', H.tLayer, 'AcDbLayerTableRecord').g(2, l.name).g(70, 0).g(62, Math.max(1, Math.min(255, Math.round(l.color)))).g(6, l.linetype || 'Continuous');
    if (l.plot === false) o.g(290, 0);
    o.g(370, l.lineweight).g(390, H.normal);
    if (v2018) o.g(347, H.matGlobal);
    // Beskrivningen som AutoCAD sparar den: i xdata under AcAecLayerStandard.
    if (l.desc) o.g(1001, 'AcAecLayerStandard').g(1000, '').g(1000, l.desc);
  }
  o.g(0, 'ENDTAB');

  const styles = d.styles.length ? d.styles : [{ name: 'Standard', font: 'txt' }];
  table('STYLE', H.tStyle, styles.length + (styles.some((s) => s.name === 'Standard') ? 0 : 1));
  for (const s of styles.some((x) => x.name === 'Standard') ? styles : [{ name: 'Standard', font: 'txt' }, ...styles])
    record('STYLE', H.tStyle, 'AcDbTextStyleTableRecord').g(2, s.name).g(70, 0).g(40, 0).g(41, 1).g(50, 0).g(71, 0).g(42, 2.5).g(3, s.font).g(4, '');
  o.g(0, 'ENDTAB');

  table('VIEW', H.tView, 0).g(0, 'ENDTAB');
  table('UCS', H.tUcs, 0).g(0, 'ENDTAB');

  const apps = ['ACAD', ...(described ? ['AcAecLayerStandard'] : [])];
  table('APPID', H.tAppid, apps.length);
  for (const a of apps) record('APPID', H.tAppid, 'AcDbRegAppTableRecord').g(2, a).g(70, 0);
  o.g(0, 'ENDTAB');

  table('DIMSTYLE', H.tDimstyle, 1).g(100, 'AcDbDimStyleTable');
  o.g(0, 'DIMSTYLE').g(105, h.get()).g(330, H.tDimstyle).g(100, 'AcDbSymbolTableRecord').g(100, 'AcDbDimStyleTableRecord').g(2, 'Standard').g(70, 0);
  o.g(40, 1).g(41, 2.5).g(42, 0.625).g(43, 3.75).g(44, 1.25).g(140, 2.5).g(141, 2.5).g(147, 0.625).g(77, 1).g(78, 8).g(271, 0).g(272, 0).g(278, 44).g(371, -2).g(372, -2);
  o.g(0, 'ENDTAB');

  table('BLOCK_RECORD', H.tBlock, 2);
  for (const [handle, name, layout] of [
    [H.msRecord, '*Model_Space', H.msLayout],
    [H.psRecord, '*Paper_Space', H.psLayout],
  ]) {
    o.g(0, 'BLOCK_RECORD').g(5, handle).g(330, H.tBlock).g(100, 'AcDbSymbolTableRecord').g(100, 'AcDbBlockTableRecord').g(2, name).g(340, layout);
    if (v2018) o.g(70, 0).g(280, 1).g(281, 0);
  }
  o.g(0, 'ENDTAB');
  o.g(0, 'ENDSEC');

  // BLOCKS
  o.g(0, 'SECTION').g(2, 'BLOCKS');
  for (const [rec, name] of [
    [H.msRecord, '*Model_Space'],
    [H.psRecord, '*Paper_Space'],
  ]) {
    o.g(0, 'BLOCK').g(5, h.get()).g(330, rec).g(100, 'AcDbEntity').g(8, '0').g(100, 'AcDbBlockBegin').g(2, name).g(70, 0).g(10, 0).g(20, 0).g(30, 0).g(3, name).g(1, '');
    o.g(0, 'ENDBLK').g(5, h.get()).g(330, rec).g(100, 'AcDbEntity').g(8, '0').g(100, 'AcDbBlockEnd');
  }
  o.g(0, 'ENDSEC');

  // ENTITIES
  o.g(0, 'SECTION').g(2, 'ENTITIES');
  for (const e of d.entities) writeEntity(o, e, h.get(), H.msRecord, v2018);
  o.g(0, 'ENDSEC');

  // OBJECTS
  o.g(0, 'SECTION').g(2, 'OBJECTS');
  const dict = (handle: string, owner: string, entries: [string, string][], hard = false) => {
    o.g(0, 'DICTIONARY').g(5, handle).g(330, owner).g(100, 'AcDbDictionary');
    if (hard) o.g(280, 1);
    o.g(281, 1);
    for (const [k, v] of entries) o.g(3, k).g(350, v);
  };
  dict(H.root, '0', [
    ['ACAD_GROUP', H.groups],
    ['ACAD_LAYOUT', H.layouts],
    ['ACAD_MATERIAL', H.materials],
    ['ACAD_MLEADERSTYLE', H.mleaderDict],
    ['ACAD_MLINESTYLE', H.mlineDict],
    ['ACAD_PLOTSTYLENAME', H.plotStyles],
  ]);
  dict(H.groups, H.root, []);
  dict(H.layouts, H.root, [
    ['Model', H.msLayout],
    ['Layout1', H.psLayout],
  ]);
  dict(H.materials, H.root, [
    ['ByBlock', H.matByBlock],
    ['ByLayer', H.matByLayer],
    ['Global', H.matGlobal],
  ]);
  dict(H.mleaderDict, H.root, [['Standard', H.mleader]]);
  dict(H.mlineDict, H.root, [['Standard', H.mline]]);
  o.g(0, 'ACDBDICTIONARYWDFLT').g(5, H.plotStyles).g(330, H.root).g(100, 'AcDbDictionary').g(281, 1).g(3, 'Normal').g(350, H.normal).g(100, 'AcDbDictionaryWithDefault').g(340, H.normal);
  o.g(0, 'ACDBPLACEHOLDER').g(5, H.normal).g(330, H.plotStyles);
  for (const [handle, name, flag, tab, rec] of [
    [H.msLayout, 'Model', 1024, 0, H.msRecord],
    [H.psLayout, 'Layout1', 0, 1, H.psRecord],
  ] as const) {
    o.g(0, 'LAYOUT').g(5, handle).g(330, H.layouts).g(100, 'AcDbPlotSettings').g(1, '').g(4, 'A3').g(6, '');
    o.g(40, 7.5).g(41, 20).g(42, 7.5).g(43, 20).g(44, 420).g(45, 297).g(46, 0).g(47, 0).g(48, 0).g(49, 0).g(140, 0).g(141, 0).g(142, 1).g(143, 1);
    o.g(70, flag).g(72, 1).g(73, 0).g(74, 5).g(7, '').g(75, 16).g(76, 0).g(77, 2).g(78, 300).g(147, 1).g(148, 0).g(149, 0);
    o.g(100, 'AcDbLayout').g(1, name).g(70, 1).g(71, tab).g(10, 0).g(20, 0).g(11, 420).g(21, 297).g(12, 0).g(22, 0).g(32, 0);
    o.g(14, minX).g(24, minY).g(34, 0).g(15, maxX).g(25, maxY).g(35, 0).g(146, 0).g(13, 0).g(23, 0).g(33, 0).g(16, 1).g(26, 0).g(36, 0).g(17, 0).g(27, 1).g(37, 0).g(76, 1).g(330, rec);
  }
  for (const [handle, name] of [
    [H.matByBlock, 'ByBlock'],
    [H.matByLayer, 'ByLayer'],
    [H.matGlobal, 'Global'],
  ]) {
    o.g(0, 'MATERIAL').g(5, handle).g(102, '{ACAD_REACTORS').g(330, H.materials).g(102, '}').g(330, H.materials).g(100, 'AcDbMaterial').g(1, name);
    for (const [c, x] of MATERIAL_CODES) o.g(c, x);
  }
  o.g(0, 'MLINESTYLE').g(5, H.mline).g(102, '{ACAD_REACTORS').g(330, H.mlineDict).g(102, '}').g(330, H.mlineDict).g(100, 'AcDbMlineStyle').g(2, 'Standard').g(70, 0).g(3, '').g(62, 256).g(51, 90).g(52, 90).g(71, 2);
  o.g(49, 0.5).g(62, 256).g(6, 'BYLAYER').g(49, -0.5).g(62, 256).g(6, 'BYLAYER');
  o.g(0, 'MLEADERSTYLE').g(5, H.mleader).g(102, '{ACAD_REACTORS').g(330, H.mleaderDict).g(102, '}').g(330, H.mleaderDict).g(100, 'AcDbMLeaderStyle');
  o.g(179, 2).g(170, 2).g(171, 1).g(172, 0).g(90, 2).g(40, 0).g(41, 0).g(173, 1).g(91, -1056964608).g(92, -2).g(290, 1).g(42, 2).g(291, 1).g(43, 8).g(3, 'Standard').g(44, 4).g(300, '');
  o.g(174, 1).g(175, 1).g(176, 0).g(178, 1).g(93, -1056964608).g(45, 4).g(292, 0).g(297, 0).g(46, 4).g(94, -1056964608).g(47, 1).g(49, 1).g(140, 1).g(294, 1).g(141, 0).g(177, 0).g(142, 1).g(295, 0).g(296, 0).g(143, 3.75).g(271, 0).g(272, 9).g(273, 9);
  o.g(0, 'ENDSEC').g(0, 'EOF');

  o.lines[seedAt] = h.seed;
  const text = o.lines.join('\r\n') + '\r\n';
  return v2018 ? new TextEncoder().encode(text) : encode1252(text);
}

function writeEntity(o: Out, e: DxfEntity, handle: string, owner: string, v2018: boolean): void {
  const type = { line: 'LINE', poly: 'LWPOLYLINE', arc: 'ARC', circle: 'CIRCLE', text: 'TEXT', hatch: 'HATCH' }[e.kind];
  o.g(0, type).g(5, handle).g(330, owner).g(100, 'AcDbEntity').g(8, e.layer);
  if (e.linetype) o.g(6, e.linetype);
  if (e.color !== undefined) o.g(62, e.color);
  if (e.lineweight !== undefined) o.g(370, e.lineweight);
  if (v2018 && e.rgb !== undefined) o.g(420, e.rgb);
  // Transparensen: 0x02000000 + täckningen 0–255.
  if (v2018 && e.opacity !== undefined && e.opacity < 1) o.g(440, 0x02000000 + Math.round(Math.max(0, Math.min(1, e.opacity)) * 255));
  switch (e.kind) {
    case 'line':
      o.g(100, 'AcDbLine').g(10, e.a[0]).g(20, e.a[1]).g(30, 0).g(11, e.b[0]).g(21, e.b[1]).g(31, 0);
      break;
    case 'poly':
      o.g(100, 'AcDbPolyline').g(90, e.points.length).g(70, e.closed ? 1 : 0);
      for (const p of e.points) o.g(10, p[0]).g(20, p[1]);
      break;
    case 'circle':
      o.g(100, 'AcDbCircle').g(10, e.center[0]).g(20, e.center[1]).g(30, 0).g(40, e.radius);
      break;
    case 'arc':
      o.g(100, 'AcDbCircle').g(10, e.center[0]).g(20, e.center[1]).g(30, 0).g(40, e.radius).g(100, 'AcDbArc').g(50, e.start).g(51, e.end);
      break;
    case 'text': {
      const h = e.align === 'middle' ? 1 : e.align === 'end' ? 2 : 0;
      o.g(100, 'AcDbText').g(10, e.at[0]).g(20, e.at[1]).g(30, 0).g(40, e.height).g(1, e.text);
      if (e.angle) o.g(50, e.angle);
      if (e.style) o.g(7, e.style);
      if (h) o.g(72, h).g(11, e.at[0]).g(21, e.at[1]).g(31, 0);
      o.g(100, 'AcDbText');
      break;
    }
    case 'hatch': {
      const solid = !e.lines;
      o.g(100, 'AcDbHatch').g(10, 0).g(20, 0).g(30, 0).g(210, 0).g(220, 0).g(230, 1).g(2, solid ? 'SOLID' : 'CAD-APA').g(70, solid ? 1 : 0).g(71, 0).g(91, e.rings.length);
      e.rings.forEach((r, i) => {
        // Den första konturen är yttre, resten hål (jämn–udda).
        o.g(92, i === 0 ? 3 : 2).g(72, 0).g(73, 1).g(93, r.length);
        for (const p of r) o.g(10, p[0]).g(20, p[1]);
        o.g(97, 0);
      });
      o.g(75, 0).g(76, solid ? 1 : 2);
      if (!solid) {
        o.g(52, 0).g(41, 1).g(77, 0).g(78, e.lines!.length);
        for (const l of e.lines!) {
          const dash = l.dash.map((x, i) => (i % 2 ? -Math.abs(x) : x < 0.05 ? 0 : x));
          o.g(53, l.angle).g(43, l.base[0]).g(44, l.base[1]).g(45, l.offset[0]).g(46, l.offset[1]).g(79, dash.length);
          for (const x of dash) o.g(49, x);
        }
      }
      o.g(98, 0);
      break;
    }
  }
}
