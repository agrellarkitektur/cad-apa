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
 * står paragrafen, så att den går att slå upp. Uppslaget i granskningen
 * efter 0.11.8 (1 november 2026): fri passage BFS 2024:12, 1 kap. 6 §
 * (0,80 m; 0,76 m i enskilda bostäder); säkerhetsglas BFS 2024:9, 2 kap.
 * 31 § (under 0,6 m i bostadslägenheter) och fall genom glas 30 §;
 * barnsäkra fönster BFS 2024:9, 2 kap. 4 § (säkerhetsanordning under 1,8 m,
 * spärr under 0,6 m; inte när fallhöjden är under 2,0 m); utrymningsfönster
 * BFS 2024:7, 2 kap. 26 § (0,50 × 0,60, summa 1,50, underkant högst 1,20
 * över golv eller plattform). Tröskeln står inte i föreskrifterna (praxis).
 * Ett ifyllt fält i uppställningen (Säkerhetsglas, Utfallsskydd) tystar sin
 * varning.
 */

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
const mm = (v: number) => nf.format(Math.round(v));

/** Fri passage (BFS 2024:12, 1 kap. 6 §): 0,76 m i enskilda bostäder, 0,80 m i övrigt, mm. */
export const PASSAGE_INNER = 760;
export const PASSAGE_ENTRANCE = 800;
/** Tröskel för en tillgänglig ytterdörr, mm (praxis; ingen siffra i föreskrifterna). */
export const THRESHOLD_MAX = 25;
/** Glas lägre än detta över golvet i bostäder ska skydda mot skärskador (BFS 2024:9, 2 kap. 31 §), mm. */
export const SAFETY_GLASS = 600;
/** Öppningsbara fönster med karmöppningen under detta ska ha spärr som låser dem stängda eller på 100 mm (BFS 2024:9, 2 kap. 4 §), mm. */
export const LOW_SILL = 600;
/** Under detta ska öppningsbara fönster ha säkerhetsanordning mot att barn faller ut (BFS 2024:9, 2 kap. 4 §), mm. */
export const CHILD_SILL = 1800;
/** Fallhöjden som gör att 4 § gäller, mm. */
export const FALL_HEIGHT = 2000;

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
      out.push(`Fri passage ca ${mm(free)} mm; BFS 2024:12, 1 kap. 6 §: minst ${mm(need)} för en tillgänglig ${need === PASSAGE_ENTRANCE ? 'entré- eller ytterdörr' : 'dörr i en enskild bostad'}.`);
    const th = m.frame.bottom ?? 0;
    if (exterior && th > THRESHOLD_MAX) out.push(`Tröskeln ${mm(th)} mm är högre än ${THRESHOLD_MAX} mm, som en tillgänglig ytterdörr brukar ha (avviker från praxis).`);
  }
  const glass = lowestGlass(m, L.cells);
  if (glass !== null && karmBottom + glass < SAFETY_GLASS && !fieldValue(el, 'Säkerhetsglas'))
    out.push(`Glaset går ned till ${mm(karmBottom + glass)} mm över golvet; BFS 2024:9, 2 kap. 31 §: under ${mm(SAFETY_GLASS)} i bostäder ska glaset skydda mot skärskador (säkerhetsglas; 1 500 i entréer och kommunikationsutrymmen). Fältet Säkerhetsglas tystar varningen.`);
  if (kind === 'window' && !p.floor) {
    const storey = doc.storeys.find((s) => s.id === el.storey);
    const opensOut = L.cells.some((c) => c.op !== 'fixed');
    // Fallhöjden räknas som våningens höjd över ±0 plus bröstningen (marken antas vid ±0).
    const sill = p.sill ?? 0;
    if (storey && storey.elevation + sill >= FALL_HEIGHT && opensOut && sill < CHILD_SILL && !fieldValue(el, 'Utfallsskydd'))
      out.push(
        sill < LOW_SILL
          ? `Karmöppningen ${mm(sill)} mm över golvet på en våning över marken; BFS 2024:9, 2 kap. 4 §: under ${mm(LOW_SILL)} ska fönstret kunna spärras stängt eller på högst 100 mm öppning. Fältet Utfallsskydd tystar varningen.`
          : `Karmöppningen ${mm(sill)} mm över golvet på en våning över marken; BFS 2024:9, 2 kap. 4 §: under ${mm(CHILD_SILL)} ska fönstret ha säkerhetsanordning mot att barn faller ut. Fältet Utfallsskydd tystar varningen.`,
      );
    if (/utrymning/i.test(fieldValue(el, 'Funktion/placering'))) {
      const open = L.cells.filter((c) => c.op !== 'fixed');
      const best = open.map((c) => [c.rect.u1 - c.rect.u0, c.rect.z1 - c.rect.z0] as const).sort((a, b) => b[0] + b[1] - (a[0] + a[1]))[0];
      if (!best) out.push('Fönstret är märkt för utrymning men har ingen öppningsbar luft (BFS 2024:7, 2 kap. 26 §).');
      else if (best[0] < 500 || best[1] < 600 || best[0] + best[1] < 1500)
        out.push(`Utrymningsfönstret: den öppningsbara luften ${mm(best[0])} × ${mm(best[1])} är mindre än bredd 500, höjd 600 och bredd + höjd 1 500 (BFS 2024:7, 2 kap. 26 §).`);
      if ((p.sill ?? 0) > 1200) out.push(`Utrymningsfönstret: underkanten ${mm(p.sill ?? 0)} mm över golvet är högre än 1 200 (BFS 2024:7, 2 kap. 26 §; annars en plattform på insidan).`);
    }
  }
  return out;
}
