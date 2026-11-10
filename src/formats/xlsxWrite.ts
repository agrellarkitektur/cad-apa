import { writeZip } from './zip';

/**
 * En enkel XLSX-skrivare (0.12.3), utan bibliotek: ett blad med text, tal
 * och formler, fet stil och talformat med noll, en eller två decimaler.
 * Texterna skrivs direkt i cellerna (`inlineStr`), så att det inte behövs
 * någon tabell med delade strängar. Filen är en zip med XML-delarna som
 * Excel, LibreOffice och Numbers läser.
 */

export interface XlsxCell {
  /** Texten eller talet; utelämnad = tom ruta. */
  v?: string | number;
  /** En formel utan likhetstecken, med engelska funktionsnamn (`SUM(D2:D5)`); `v` är det uträknade värdet. */
  f?: string;
  bold?: boolean;
  /** Decimaler för ett tal (0–2). */
  decimals?: number;
}

export interface XlsxSheet {
  name: string;
  rows: XlsxCell[][];
  /** Kolumnbredder i tecken; utelämnade räknas ur innehållet. */
  widths?: number[];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

/** Kolumnens bokstäver: 0 → A, 26 → AA. */
export function columnName(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Stilens nummer i `cellXfs`: vanlig/fet × ingen siffra, 0, 1 eller 2 decimaler. */
function styleOf(c: XlsxCell): number {
  const fmt = typeof c.v === 'number' || c.f ? 1 + Math.max(0, Math.min(2, c.decimals ?? 0)) : 0;
  return fmt * 2 + (c.bold ? 1 : 0);
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="0.0"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="1" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="2" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function sheetXml(s: XlsxSheet): string {
  const cols = Math.max(0, ...s.rows.map((r) => r.length));
  const widths =
    s.widths ??
    Array.from({ length: cols }, (_, i) => Math.min(60, Math.max(8, ...s.rows.map((r) => (r[i]?.v === undefined ? 0 : String(typeof r[i].v === 'number' ? (r[i].v as number).toFixed(r[i].decimals ?? 0) : r[i].v).length + 2)))));
  const colXml = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const rows = s.rows
    .map((r, ri) => {
      const cells = r
        .map((c, ci) => {
          if (c.v === undefined && !c.f) return '';
          const ref = `${columnName(ci)}${ri + 1}`;
          const st = styleOf(c);
          const sAttr = st ? ` s="${st}"` : '';
          if (c.f) return `<c r="${ref}"${sAttr}><f>${esc(c.f)}</f>${typeof c.v === 'number' ? `<v>${c.v}</v>` : ''}</c>`;
          if (typeof c.v === 'number') return Number.isFinite(c.v) ? `<c r="${ref}"${sAttr}><v>${c.v}</v></c>` : '';
          return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(c.v!)}</t></is></c>`;
        })
        .join('');
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
${colXml}<sheetData>${rows}</sheetData></worksheet>`;
}

/** Bladets namn: högst 31 tecken, utan de tecken Excel inte tillåter. */
export const sheetName = (name: string): string => name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Blad1';

/** Arbetsboken som bytes. */
export function writeXlsx(sheet: XlsxSheet, date = new Date()): Uint8Array {
  const enc = new TextEncoder();
  const name = sheetName(sheet.name);
  const parts: [string, string][] = [
    [
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`,
    ],
    [
      '_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`,
    ],
    [
      'docProps/core.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${esc(sheet.name)}</dc:title><dc:creator>cad-apa</dc:creator>
<dcterms:created xsi:type="dcterms:W3CDTF">${date.toISOString().slice(0, 19)}Z</dcterms:created>
</cp:coreProperties>`,
    ],
    [
      'xl/workbook.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${esc(name)}" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    ],
    ['xl/styles.xml', STYLES],
    ['xl/worksheets/sheet1.xml', sheetXml(sheet)],
  ];
  return writeZip(parts.map(([n, x]) => ({ name: n, data: enc.encode(x), date })));
}
