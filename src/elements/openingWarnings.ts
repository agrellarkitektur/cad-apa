import type { Element, ProjectDoc } from '../core/model';
import { fieldValue } from '../core/openingSchedule';
import { hasSash, layoutLeaf, layoutOpening, leafGridOf, LEAF_OPS, kindOfElementType, type LaidCell } from '../core/openingTypes';
import { openingModelOf, type OpeningObjParams } from './openingSpec';
import { resolveParams } from './registry';
import { outsideSide } from './wallSides';

/**
 * Varningarna för dörrar och fönster (0.11.8.2): aldrig spärrar, bara en rad
 * i egenskaperna. Det som är vedertaget men inte står i en föreskrift får
 * *avviker från praxis* (Carl August 30 oktober); där en föreskrift gäller
 * står vilken, så att den går att slå upp (tillgänglighet BFS 2024:12,
 * säkerhet vid användning BFS 2024:9, utrymning BFS 2024:7). Ett ifyllt fält
 * i uppställningen (Säkerhetsglas, Utfallsskydd) tystar sin varning.
 */

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
const mm = (v: number) => nf.format(Math.round(v));

/** Fri passage för en tillgänglig innerdörr och en entré- eller ytterdörr, mm. */
export const PASSAGE_INNER = 760;
export const PASSAGE_ENTRANCE = 800;
/** Tröskel för en tillgänglig ytterdörr, mm. */
export const THRESHOLD_MAX = 25;
/** Glas lägre än detta över golvet brukar vara säkerhetsglas, mm. */
export const SAFETY_GLASS = 600;
/** Bröstning under detta på en våning över marken brukar behöva utfallsskydd, mm. */
export const LOW_SILL = 600;

/**
 * Den fria passagen genom dörren med bladet öppet 90°: bladets luft minus
 * bladets tjocklek (slagdörrar), luften minus 40 för handtaget
 * (skjutdörrar). En pardörr räknas på det aktiva bladet. Null för andra.
 */
export function freePassage(m: ReturnType<typeof openingModelOf>, frameW: number, frameH: number): number | null {
  const L = layoutOpening(m, frameW, frameH);
  const leaves = L.cells.filter((c) => LEAF_OPS.has(c.op));
  if (!leaves.length) return null;
  const active = leaves.find((c) => c.op !== 'leaf' || c.hinge !== 'right' || leaves.length === 1) ?? leaves[0];
  const w = active.rect.u1 - active.rect.u0;
  if (active.op === 'leaf' || active.op === 'foldLeaf') return w - m.leaf;
  if (active.op === 'garage') return w;
  return w - 40;
}

/** Glasets lägsta punkt över karmens underkant, mm, eller null om typen saknar glas. */
function lowestGlass(m: ReturnType<typeof openingModelOf>, cells: readonly LaidCell[]): number | null {
  let low: number | null = null;
  const at = (z: number) => (low = low === null ? z : Math.min(low, z));
  for (const c of cells) {
    const r = c.rect;
    if (LEAF_OPS.has(c.op)) {
      const g = leafGridOf(c);
      if (g) for (const f of layoutLeaf(g, r).fills) if (f.glass) at(f.rect.z0);
    } else if (c.fill === 'glass') at(r.z0 + (hasSash(c) ? Math.min(m.sash, (r.u1 - r.u0) / 3, (r.z1 - r.z0) / 3) : 0));
  }
  return low;
}

export function openingWarnings(doc: ProjectDoc, el: Element): string[] {
  const kind = kindOfElementType(el.type);
  if (!kind || kind === 'hole') return [];
  const p = resolveParams<OpeningObjParams>(doc, el);
  const m = openingModelOf(doc, el);
  const host = el.host ? doc.elements[el.host] : undefined;
  const exterior = host ? outsideSide(doc, host) !== null : false;
  const out: string[] = [];
  const L = layoutOpening(m, p.frameW, p.frameH);
  // Golvet till karmens underkant (fönster: bröstningen och drevmånen).
  const karmBottom = kind === 'door' ? 0 : (p.sill ?? 0) + (p.floor ? 0 : p.gap);
  if (kind === 'door') {
    const free = freePassage(m, p.frameW, p.frameH);
    const need = exterior || p.mainEntrance ? PASSAGE_ENTRANCE : PASSAGE_INNER;
    if (free !== null && free < need)
      out.push(`Fri passage ca ${mm(free)} mm, under ${mm(need)} för en tillgänglig ${need === PASSAGE_ENTRANCE ? 'entré- eller ytterdörr' : 'dörr'} (avviker från praxis; se BFS 2024:12).`);
    const th = m.frame.bottom ?? 0;
    if (exterior && th > THRESHOLD_MAX) out.push(`Tröskeln ${mm(th)} mm är högre än ${THRESHOLD_MAX} mm, som en tillgänglig ytterdörr brukar ha (avviker från praxis).`);
  }
  const glass = lowestGlass(m, L.cells);
  if (glass !== null && karmBottom + glass < SAFETY_GLASS && !fieldValue(el, 'Säkerhetsglas'))
    out.push(`Glaset går ned till ${mm(karmBottom + glass)} mm över golvet; under ${mm(SAFETY_GLASS)} brukar det vara säkerhetsglas (avviker från praxis; se BFS 2024:9). Fältet Säkerhetsglas tystar varningen.`);
  if (kind === 'window' && !p.floor) {
    const storey = doc.storeys.find((s) => s.id === el.storey);
    const opensOut = L.cells.some((c) => c.op !== 'fixed');
    if (storey && storey.elevation >= 1500 && opensOut && (p.sill ?? 0) < LOW_SILL && !fieldValue(el, 'Utfallsskydd'))
      out.push(`Bröstningen ${mm(p.sill ?? 0)} mm på en våning över marken: under ${mm(LOW_SILL)} brukar fönstret behöva utfallsskydd eller barnspärr (avviker från praxis; se BFS 2024:9). Fältet Utfallsskydd tystar varningen.`);
    if (/utrymning/i.test(fieldValue(el, 'Funktion/placering'))) {
      const open = L.cells.filter((c) => c.op !== 'fixed');
      const best = open.map((c) => [c.rect.u1 - c.rect.u0, c.rect.z1 - c.rect.z0] as const).sort((a, b) => b[0] + b[1] - (a[0] + a[1]))[0];
      if (!best) out.push('Fönstret är märkt för utrymning men har ingen öppningsbar luft (se BFS 2024:7).');
      else if (best[0] < 500 || best[1] < 600 || best[0] + best[1] < 1500)
        out.push(`Utrymningsfönstret: den öppningsbara luften ${mm(best[0])} × ${mm(best[1])} är mindre än bredd 500, höjd 600 och bredd + höjd 1 500 (avviker från praxis; se BFS 2024:7).`);
      if ((p.sill ?? 0) > 1200) out.push(`Utrymningsfönstret: bröstningen ${mm(p.sill ?? 0)} mm är högre än 1 200 (avviker från praxis; se BFS 2024:7).`);
    }
  }
  return out;
}
