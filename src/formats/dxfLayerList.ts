import type { LayerDef, LinetypeDef } from '../core/dxfLayers';
import { pairs } from './dxfCodes';

/**
 * *Läs lagerlista ur DXF…* (0.12.1): lagren och linjetyperna i en DXF-fils
 * tabeller, som kontorets egen lagerlista. Beskrivningarna läses där
 * AutoCAD sparar dem (xdata under `AcAecLayerStandard`). Lagren 0 och
 * Defpoints hoppas över; de skrivs alltid.
 */

/** Filens byte som text: UTF-8 (2007 och senare), annars Windows-1252. */
export function dxfBytesText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/** `\U+00E5` i namn och texter som tecken. */
const unescape = (s: string) => s.replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

export function readDxfLayerList(text: string): { layers: LayerDef[]; linetypes: LinetypeDef[] } {
  const ps = pairs(text);
  const layers: LayerDef[] = [];
  const linetypes: LinetypeDef[] = [];
  let i = ps.findIndex(([c, v]) => c === 2 && v.trim() === 'TABLES');
  if (i < 0) return { layers, linetypes };
  for (; i < ps.length; i++) {
    const [c, v] = ps[i];
    if (c === 0 && v.trim() === 'ENDSEC') break;
    if (c !== 0 || (v.trim() !== 'LAYER' && v.trim() !== 'LTYPE')) continue;
    // Posten fram till nästa kod 0.
    const type = v.trim();
    let j = i + 1;
    while (j < ps.length && ps[j][0] !== 0) j++;
    const rec = ps.slice(i + 1, j);
    i = j - 1;
    const get = (code: number) => rec.find((p) => p[0] === code)?.[1];
    const name = unescape((get(2) ?? '').trim());
    if (!name) continue;
    if (type === 'LAYER') {
      if (name === '0' || name.toLowerCase() === 'defpoints') continue;
      const xd = rec.findIndex((p) => p[0] === 1001 && p[1].trim() === 'AcAecLayerStandard');
      const desc = xd >= 0 ? rec.slice(xd + 1).filter((p) => p[0] === 1000).map((p) => unescape(p[1].trim())).filter(Boolean).pop() : undefined;
      const lt = (get(6) ?? '').trim();
      layers.push({
        name,
        color: Math.max(1, Math.min(255, Math.abs(Math.round(Number(get(62) ?? 7))) || 7)),
        ...(lt && lt.toLowerCase() !== 'continuous' ? { linetype: lt } : {}),
        lineweight: Number.isFinite(Number(get(370))) ? Math.round(Number(get(370))) : -3,
        ...(get(290)?.trim() === '0' ? { plot: false } : {}),
        ...(desc ? { desc } : {}),
      });
    } else if (!['byblock', 'bylayer', 'continuous'].includes(name.toLowerCase())) {
      const pattern = rec.filter((p) => p[0] === 49).map((p) => Math.abs(Number(p[1]) || 0));
      // Linjetyper med text eller symboler i mönstret (kod 74 ≠ 0) blir enkla streck.
      if (pattern.length) linetypes.push({ name, ...(get(3)?.trim() ? { desc: get(3)!.trim() } : {}), pattern });
    }
  }
  return { layers, linetypes };
}
