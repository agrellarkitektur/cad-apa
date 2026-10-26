import type { StyleSheet } from '../core/graphics';
import type { Element, ProjectDoc } from '../core/model';
import type { ViewStates } from '../core/states';
import { dimensionPrims } from '../elements/annotation';
import type { PlanContext } from '../elements/registry';
import { planeRange, roofBodyOf, roofRange, type RoofParams } from '../elements/roof';
import { markerPen, solidPen, withWeight } from './markerPens';
import type { Pen, Primitive } from './primitives';
import { levelText, meanGround } from './terrain';

/**
 * Nivåkoter och höjdmått i fasader och sektioner (0.9.2; egen fil sedan
 * 0.9.3). FG för varje vånings golv, UK bjl för bjälklagen som sektionen
 * skär, takfot och nock. Bjälklagets ovansida är golvet, så ÖK skrivs inte
 * för sig. ±0 är nollnivån, plan 1:s golv. Höjdmåttet (bara i sektioner)
 * går genom de skurna bjälklagens under- och ovansidor: tjocklek, fri höjd,
 * tjocklek …
 */
export function levelPrims(
  doc: ProjectDoc,
  ctx: PlanContext,
  style: StyleSheet,
  view: ViewStates,
  at: {
    /** Bjälklagen som sektionen skär (tom i en fasad). */
    cutSlabs: readonly { z0: number; z1: number }[];
    roofs: readonly { el: Element; elevation: number }[];
    /** Byggnadens högra kant och högsta punkt i vyn. */
    maxU: number;
    maxZ: number;
    isSection: boolean;
  },
): Primitive[] {
  const out: Primitive[] = [];
  const heights = at.isSection && !view.hide?.includes('heightDims') ? heightChain(at.cutSlabs) : [];
  const markX = at.maxU + (heights.length ? 14 : 12) * ctx.scale;
  if (!view.hide?.includes('level')) {
    const levels = new Map<number, string>(doc.storeys.map((s) => [s.elevation, 'FG']));
    for (const sl of at.cutSlabs) {
      const z = Math.round(sl.z0);
      if (!levels.has(z)) levels.set(z, 'UK bjl');
    }
    const floor = Math.min(...doc.storeys.map((s) => s.elevation));
    for (const { el, elevation } of at.roofs) {
      // Takets lägsta undersida, med takfotens snitt och språnget (0.10.2).
      const eave = Math.round(elevation + lowestUnder(ctx, ctx.params<RoofParams>(el)));
      if (eave > floor && !levels.has(eave)) levels.set(eave, 'Takfot');
    }
    const top = Math.round(at.maxZ);
    if (!levels.has(top)) levels.set(top, at.roofs.length ? 'Nock' : '');
    const entries = [...levels];
    // Medelmarknivån längs husets kontur (0.10.3), när projektet har en markmodell.
    const mmn = view.hide?.includes('Terrain') ? null : meanGround(ctx);
    if (mmn !== null) entries.push([Math.round(mmn), 'MMN']);
    // Texter som skulle krocka (nivåer närmare än en textrad) skjuts
    // uppåt. Strecket går under texten som förut, utom där en annan
    // nivås text hamnat på det.
    const h = style.labels.heights.dimension;
    const marks: { z: number; label: string; textY: number }[] = [];
    let prevText = -Infinity;
    for (const [z, label] of entries.sort((a, b) => a[0] - b[0])) {
      const textY = Math.max(z + 1.8 * ctx.scale * 0.35, prevText + h * 1.35 * ctx.scale);
      prevText = textY;
      marks.push({ z, label, textY });
    }
    for (const m of marks) {
      const crossed = marks.some((o) => o !== m && m.z > o.textY - h * 0.3 * ctx.scale && m.z < o.textY + h * 1.1 * ctx.scale);
      out.push(...levelMark(markX, m.z, h, m.label, ctx.scale, markerPen(style, 'level'), levelText(doc, m.z), m.textY, !crossed));
    }
  }
  if (heights.length >= 2) {
    const points = heights.map((z): [number, number] => [at.maxU, z]);
    out.push(...dimensionPrims({ points, angle: 90, offset: -6 * ctx.scale }, ctx.scale, { part: 'höjdmått' }, style.labels.heights.dimension, style));
  }
  return out;
}

/**
 * Höjderna för höjdmåttet: under- och ovansidan av bjälklagen som sektionen
 * skär, nerifrån. Två bjälklag på olika våningar ger tjocklek, fri höjd och
 * tjocklek. Höjder närmare än 1 mm räknas som en.
 */
export function heightChain(slabs: readonly { z0: number; z1: number }[]): number[] {
  const zs = [...new Set(slabs.flatMap((s) => [Math.round(s.z0), Math.round(s.z1)]))].sort((a, b) => a - b);
  return zs.length >= 2 ? zs : [];
}

/**
 * En nivåkota: ett streck, en triangel som pekar ned på det och höjden i
 * meter bredvid. Ett kort streck (0.9.2) slutar vid triangeln, så att en
 * text som skjutits upp för en granne inte stryks över.
 */
function levelMark(x: number, z: number, height: number, label: string, s: number, pen: Pen, text: string, textY?: number, long = true): Primitive[] {
  // s: ritningsskalan, för storleken på papper.
  const tri = 1.8 * s;
  const origin = { part: 'nivå' };
  return [
    { kind: 'line', a: [x - 6 * s, z], b: [x + (long ? 14 * s : tri), z], pen, origin },
    {
      kind: 'region',
      role: 'cut',
      rings: [
        [
          [x, z],
          [x - tri * 0.6, z + tri],
          [x + tri * 0.6, z + tri],
        ],
      ],
      fill: { kind: 'none' },
      outline: solidPen(pen),
      ownFill: true,
      origin,
    },
    { kind: 'text', at: [x + tri * 1.4, textY ?? z + tri * 0.35], text: label ? `${label} ${text}` : text, height, pen: withWeight(pen, 0.18), origin },
  ];
}

/** Takets lägsta punkt på undersidan: kroppens bitar, eller takfallets om de saknas. */
function lowestUnder(ctx: PlanContext, p: RoofParams): number {
  const body = roofBodyOf(ctx, p);
  return body.length ? Math.min(...body.map((pc) => planeRange(pc.under, pc.rings)[0])) : roofRange(p).underMin;
}
