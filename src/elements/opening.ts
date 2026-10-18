import type { Element } from '../core/model';
import type { PlanContext } from './registry';
import { FRAME_LESS, HOLE_EXTRA, wallFrame, type OpeningParams, type WallFrame, type WallParams } from './wall';
import { outsideSide } from './wallSides';

/** Karm och djupplacering, gemensamt för dörrar och fönster. */
export interface FrameParams {
  /** Karmens bredd i väggens riktning, mm. */
  frameWidth: number;
  /** Karmens djup genom väggen, mm. */
  frameDepth: number;
  /**
   * Indrag från väggens liv till karmens utsida, mm. Null = automatiskt:
   * 50 mm från utsidan i ytterväggar, i liv med öppningssidan i innerväggar.
   */
  inset: number | null;
}

export const FRAME_DEFAULTS: FrameParams = { frameWidth: 50, frameDepth: 100, inset: null };

/** Standardindrag från utsidan i ytterväggar. */
export const EXTERIOR_INSET = 50;

export interface OpeningZone {
  f: WallFrame;
  /** Karmens djupzon, som avstånd från väggens mittlinje (vänster positivt). */
  lo: number;
  hi: number;
  /** Den sida (1 eller -1) som indraget mäts från, och indraget. */
  face: 1 | -1 | 0;
  inset: number;
  /** Vad indraget mäts från, i ord. */
  insetFrom: 'utsidan' | 'öppningssidan' | 'mitten';
  /** Karmens yttre ändar längs väggen (modulmått − 10). */
  s1: number;
  s2: number;
  /** Hålets ändar längs väggen (modulmått + 10). */
  h1: number;
  h2: number;
}

/**
 * Var karmen sitter i väggen. I en yttervägg mäts indraget från utsidan
 * (50 mm som standard). I en innervägg sitter karmen i liv med väggen på den
 * sida dörren öppnas åt; fönster i innerväggar sitter mitt i.
 */
export function openingZone(
  ctx: PlanContext,
  host: Element,
  p: OpeningParams & Partial<FrameParams> & { swing?: 1 | -1 },
): OpeningZone {
  const f = wallFrame(ctx.params<WallParams>(host));
  const depth = Math.min(p.frameDepth ?? FRAME_DEFAULTS.frameDepth, f.half * 2);
  const out = ctx.memo(`outside:${host.id}`, () => outsideSide(ctx.doc, host));
  let face: 1 | -1 | 0;
  let insetFrom: OpeningZone['insetFrom'];
  let inset: number;
  if (out !== null) {
    face = out;
    insetFrom = 'utsidan';
    inset = p.inset ?? EXTERIOR_INSET;
  } else if (p.swing) {
    face = p.swing;
    insetFrom = 'öppningssidan';
    inset = p.inset ?? 0;
  } else {
    face = 0;
    insetFrom = 'mitten';
    inset = 0;
  }
  let lo: number;
  let hi: number;
  if (face === 0) {
    lo = -depth / 2;
    hi = depth / 2;
  } else {
    inset = Math.max(0, Math.min(inset, f.half * 2 - depth));
    const outer = face * (f.half - inset);
    const inner = face * (f.half - inset - depth);
    lo = Math.min(outer, inner);
    hi = Math.max(outer, inner);
  }
  const karm = p.width - FRAME_LESS;
  const hole = p.width + HOLE_EXTRA;
  return { f, lo, hi, face, inset, insetFrom, s1: p.at - karm / 2, s2: p.at + karm / 2, h1: p.at - hole / 2, h2: p.at + hole / 2 };
}
