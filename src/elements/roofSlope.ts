import type { Id } from '../core/model';
import type { Primitive, Vec2 } from '../repr/primitives';
import type { ElementType } from './registry';
import type { RoofParams } from './roof';

/**
 * Taklutningen som eget objekt (0.8, format 5). Den ritas i en fasad eller
 * sektion (`space` är markörens id), hör till ett takfall och visar dess
 * lutning, men går att flytta fritt och ge en egen stil.
 *
 * Där inget sådant objekt finns sätter fasaden och sektionen ut taklutningen
 * själva, som förut. Markeras en sådan blir den ett eget objekt (se
 * `buildSection`, `slopes`). Ett borttaget objekt blir dolt i stället, så att
 * den automatiska inte kommer tillbaka.
 */
export interface RoofSlopeParams {
  roof: Id;
  /** Takfallets nummer i `roofPlanes`. */
  face: number;
  /** Punkten på takfallet där symbolen utgår, i fasadens eller sektionens koordinater (x längs linjen, y höjd). */
  at: [number, number];
  /** Åt vilket håll takfoten ligger i vyn: 1 = höger, -1 = vänster. */
  toward: 1 | -1;
  /** Den vågräta linjens längd, mm i modellen. */
  len: number;
  /** auto: efter detaljnivån. arc: linje, båge och gradtal. text: bara gradtal. triangle: lutningstriangel. */
  style: SlopeStyle;
  /** Borttagen: den automatiska taklutningen för takfallet visas inte heller. */
  hidden?: boolean;
}

export type SlopeStyle = 'auto' | 'arc' | 'text' | 'triangle';

export const SLOPE_STYLES: Record<SlopeStyle, string> = {
  auto: 'Efter detaljnivån',
  arc: 'Båge och gradtal',
  text: 'Bara gradtal',
  triangle: 'Lutningstriangel',
};

/**
 * Symbolen för en taklutning. `B` är punkten på takfallet, `toward` sidan
 * där takfoten ligger och `slope` lutningen i grader.
 */
export function slopeSymbol(
  B: Vec2,
  toward: 1 | -1,
  slope: number,
  len: number,
  style: Exclude<SlopeStyle, 'auto'>,
  height: number,
  origin: Primitive['origin'],
  /** Ritningsskalan (annoteringsskalan), för symbolens storlek på papper. */
  K = 100,
): Primitive[] {
  const text = `${slope.toLocaleString('sv-SE', { maximumFractionDigits: 1 })}°`;
  const pen = { weight: 0.18 };
  const r = (slope * Math.PI) / 180;
  if (style === 'text') {
    // Gradtalet ovanför takfallet, vinkelrätt ut från ytan.
    const n: Vec2 = [-toward * Math.sin(r), Math.cos(r)];
    return [{ kind: 'text', at: [B[0] + n[0] * 3 * K, B[1] + n[1] * 3 * K], text, height, align: 'middle', pen, origin }];
  }
  if (style === 'triangle') {
    // Vågrät linje mot takfoten, lodrät ned till takfallet och förhållandet 1:n.
    const L = len;
    const C: Vec2 = [B[0] + toward * L, B[1]];
    const D: Vec2 = [C[0], B[1] - L * Math.tan(r)];
    const ratio = Math.tan(r) > 1e-6 ? `1:${(1 / Math.tan(r)).toLocaleString('sv-SE', { maximumFractionDigits: 1 })}` : '';
    return [
      { kind: 'line', a: B, b: C, pen, origin },
      { kind: 'line', a: C, b: D, pen, origin },
      { kind: 'text', at: [(B[0] + C[0]) / 2, B[1] + 1 * K], text, height, align: 'middle', pen, origin },
      ...(ratio ? [{ kind: 'text' as const, at: [C[0] + toward * 1.5 * K, (C[1] + D[1]) / 2 - 0.8 * K] as Vec2, text: ratio, height, align: (toward > 0 ? 'start' : 'end') as 'start' | 'end', pen, origin }] : []),
    ];
  }
  const R = len * 0.75;
  const aH = toward > 0 ? 0 : Math.PI;
  const aRoof = toward > 0 ? -r : Math.PI + r;
  const [start, end] = toward > 0 ? [aRoof, aH] : [aH, aRoof];
  const am = (aH + aRoof) / 2;
  return [
    { kind: 'line', a: B, b: [B[0] + toward * len, B[1]], pen, origin },
    { kind: 'arc', center: B, radius: R, start, end, pen, origin },
    { kind: 'text', at: [B[0] + Math.cos(am) * (R + 2.5 * K), B[1] + Math.sin(am) * (R + 2.5 * K) - 1 * K], text, height, align: 'middle', pen, origin },
  ];
}

export const roofSlopeType: ElementType<RoofSlopeParams> = {
  type: 'RoofSlope',
  label: 'Taklutning',
  labelPlural: 'Taklutningar',
  drawOrder: 61,
  compares: false,
  global: true,
  defaults: () => ({ roof: '', face: 0, at: [0, 0], toward: 1, len: 600, style: 'auto' }),
  plan(el, ctx) {
    const p = ctx.params<RoofSlopeParams>(el);
    if (p.hidden || ctx.view.hide?.includes('roofSlope')) return [];
    const roof = ctx.doc.elements[p.roof];
    if (!roof) return [];
    const slope = ctx.params<RoofParams>(roof).slope;
    const style = p.style === 'auto' ? (ctx.view.detail === 'sketch' ? 'text' : 'arc') : p.style;
    return slopeSymbol(p.at as Vec2, p.toward, slope, p.len, style, ctx.style.labels.heights.dimension, { objectId: el.id, objectType: 'RoofSlope', part: 'taklutning' }, ctx.scale);
  },
};
