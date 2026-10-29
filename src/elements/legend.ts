import type { Material, StyleSheet } from '../core/graphics';
import type { Id } from '../core/model';
import type { LegendSource } from '../core/states';
import type { Primitive, Vec2 } from '../repr/primitives';
import { fillPrims, materialFill, type FillCategory, type FillParams } from './fill2d';
import type { ElementType, PlanContext } from './registry';

/**
 * Teckenförklaring på ett blad (0.10.30, samma format: en ny elementtyp
 * med valfria fält). Ett automatobjekt som skalstocken: den läser vilka
 * material som används av det som syns i bladets vyer (`ViewStates.legend`,
 * räknat i `buildSheet`) och ritar en ruta per material med mönstret i vyns
 * skala och namnet bredvid. Ritas i mm på papperet.
 */
export interface LegendParams {
  /** Övre vänstra hörnet, mm på papperet. */
  pos: [number, number];
  /** Rubriken; tom = ingen. */
  title: string;
  /** Vilka material: alla, bara markens eller bara byggnadens. */
  categories: 'all' | 'ground' | 'building';
  /** Stilmallens ordning eller bokstavsordning. */
  order: 'list' | 'name';
  /** Rutans bredd och höjd, mm på papperet. */
  box: [number, number];
  /** Material som tas med fast de inte syns i vyerna (egna rader). */
  extra: string[];
  /** Material som inte tas med (bortvalda rader). */
  removed: string[];
  /** Objekt med egen fyllning (utan material) som raden "Eget". */
  own: boolean;
  /** Bara en vy på bladet (dess id på bladet); utelämnad = alla. */
  view?: Id;
}

/** En rad i teckenförklaringen. */
export interface LegendRow {
  name: string;
  fill: Partial<FillParams>;
  /** Skalan mönstret ritas i (vyns nämnare). */
  scale: number;
  category?: FillCategory;
  /** Materialets id, eller utelämnad för en egen fyllning. */
  material?: string;
}

const TITLE = 3.5;
const TEXT = 2.5;
const GAP = 2;

export const LEGEND_DEFAULTS: LegendParams = { pos: [20, 100], title: 'TECKENFÖRKLARING', categories: 'all', order: 'list', box: [10, 6], extra: [], removed: [], own: false };

/** Raderna: materialen i vyerna och de egna, efter inställningarna. */
export function legendRows(p: LegendParams, sources: readonly LegendSource[], style: Pick<StyleSheet, 'materials'>): LegendRow[] {
  const list = style.materials ?? [];
  const from = sources.filter((s) => !p.view || s.viewport === p.view);
  const fallback = from[0] ?? sources[0];
  const at = new Map<string, LegendSource | undefined>();
  for (const s of from) for (const m of s.materials) if (!at.has(m)) at.set(m, s);
  for (const m of p.extra ?? []) if (!at.has(m)) at.set(m, fallback);
  const fits = (m: Material) => p.categories === 'ground' ? m.ground : p.categories === 'building' ? m.building : true;
  const used = [...at.keys()]
    .map((id) => list.find((m) => m.id === id))
    .filter((m): m is Material => !!m && fits(m) && !(p.removed ?? []).includes(m.id));
  if (p.order === 'name') used.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  else used.sort((a, b) => list.indexOf(a) - list.indexOf(b));
  const rows: LegendRow[] = used.map((m) => {
    const s = at.get(m.id);
    const category = s?.category as FillCategory;
    return { name: m.name, fill: materialFill(m, category), scale: s?.scale ?? 100, ...(category ? { category } : {}), material: m.id };
  });
  if (p.own) {
    const seen = new Set<string>();
    for (const s of from)
      for (const f of s.own) {
        const k = JSON.stringify(f);
        if (seen.has(k)) continue;
        seen.add(k);
        rows.push({ name: 'Eget', fill: f as Partial<FillParams>, scale: s.scale });
      }
  }
  return rows;
}

/** Teckenförklaringens yta på papperet: från `pos` och nedåt. */
function extent(p: LegendParams, rows: number): { w: number; h: number; top: number } {
  const top = p.title ? TITLE + GAP * 1.5 : 0;
  const [, bh] = p.box;
  return { w: p.box[0] + 3 + 45, h: top + Math.max(1, rows) * (bh + GAP) - GAP, top };
}

function rowsOf(el: { params: unknown }, ctx: PlanContext): { p: LegendParams; rows: LegendRow[] } {
  const p = { ...LEGEND_DEFAULTS, ...ctx.params<LegendParams>(el as never) };
  return { p, rows: legendRows(p, ctx.view.legend ?? [], ctx.style) };
}

export const legendType: ElementType<LegendParams> = {
  type: 'Legend',
  label: 'Teckenförklaring',
  labelPlural: 'Teckenförklaringar',
  drawOrder: 92,
  compares: false,
  planReads: [],
  defaults: () => structuredClone(LEGEND_DEFAULTS),
  plan(el, ctx) {
    const { p, rows } = rowsOf(el, ctx);
    const [x, y] = p.pos;
    const [bw, bh] = p.box;
    const origin = { objectId: el.id, objectType: 'Legend' };
    const pen = { weight: 0.25 };
    const out: Primitive[] = [];
    const { top } = extent(p, rows.length);
    if (p.title) out.push({ kind: 'text', at: [x, y - TITLE], text: p.title, height: TITLE, bold: true, pen, origin });
    if (!rows.length) {
      out.push({ kind: 'text', at: [x, y - top - TEXT], text: 'Inga material i bladets vyer', height: TEXT, pen: { weight: 0.18, color: 'muted' }, origin });
      return out;
    }
    rows.forEach((r, i) => {
      const y1 = y - top - i * (bh + GAP);
      const ring: Vec2[] = [[x, y1 - bh], [x + bw, y1 - bh], [x + bw, y1], [x, y1]];
      // Mönstret i vyns skala: avstånd i verkliga mått räknas om med vyns skala, och mönstret utgår från rutans hörn.
      const fill = { fillAngle: 45, fillSpacing: 2, ...r.fill } as FillParams;
      out.push(...fillPrims([ring], fill, origin, false, ctx.style, r.scale, r.category, [ring[0][0] * r.scale, ring[0][1] * r.scale]));
      out.push({ kind: 'polyline', points: ring, closed: true, pen: { weight: 0.18 }, origin });
      out.push({ kind: 'text', at: [x + bw + 3, y1 - bh / 2 - TEXT / 2], text: r.name, height: TEXT, pen, origin });
    });
    return out;
  },
  pickShape(el, ctx) {
    const { p, rows } = rowsOf(el, ctx);
    const { w, h } = extent(p, rows.length);
    const [x, y] = p.pos;
    return [[[[x - 2, y - h - 2], [x + w, y - h - 2], [x + w, y + 2], [x - 2, y + 2]]]];
  },
};
