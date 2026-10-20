import type { Element, Id, ProjectDoc } from '../core/model';
import type { Vec2 } from '../repr/primitives';
import { isFixed, type FurnitureParams } from './furniture';
import type { MarkerParams } from './markers';
import { resolveParams, typeOf } from './registry';
import { ridgeLine, type RoofParams } from './roof';
import { lastResults } from '../repr/reuse';

/**
 * Nästan raka vinklar (0.7.1). En vägg, en sektions- eller fasadlinje, fast
 * inredning eller en taknock som går nästan men inte exakt i 0°, 45° eller
 * 90° är oftast ett misstag: en klick bredvid när man ritade. De markeras i
 * planen och får en rad i egenskaperna.
 *
 * Exakt betyder att änden ligger högst en halv millimeter från den raka
 * linjen; så små avvikelser syns inte och räknas inte. Projektvinklar som
 * också räknas som raka kommer i 0.8.
 */
export interface SkewWarning {
  id: Id;
  /** Var markeringen ritas i planen. */
  at: Vec2;
  /** Elementets riktning i grader, moturs från x-axeln, 0–180. */
  angle: number;
  /** Den raka vinkel det ligger nära. */
  nearest: number;
  /** Hur långt änden ligger från den raka linjen, mm. */
  offset: number;
}

/** Ändarna får avvika så här mycket och ändå räknas som exakta. */
export const EXACT_MM = 0.5;

/** Raka vinklar att jämföra med. */
const STRAIGHT = [0, 45, 90, 135, 180];

/** Riktningen och längden att mäta avvikelsen över, för de element som har en. */
function lineOf(doc: ProjectDoc, el: Element): { a: Vec2; b: Vec2 } | null {
  switch (el.type) {
    case 'Wall': {
      const p = el.params as { start: Vec2; end: Vec2; bulge?: number };
      if (p.bulge) return null;
      return { a: p.start, b: p.end };
    }
    case 'Section':
    case 'Elevation': {
      const p = el.params as unknown as MarkerParams;
      if (p.auto) return null;
      return { a: p.start, b: p.end };
    }
    case 'Furniture': {
      const p = resolveParams<FurnitureParams>(doc, el);
      if (!isFixed(p)) return null;
      const r = (p.rotation * Math.PI) / 180;
      const len = Math.max(p.width, p.depth);
      return { a: p.origin, b: [p.origin[0] + Math.cos(r) * len, p.origin[1] + Math.sin(r) * len] };
    }
    case 'Roof': {
      const p = resolveParams<RoofParams>(doc, el);
      const ridge = ridgeLine(p);
      if (ridge) return { a: ridge[0], b: ridge[1] };
      const r = (p.ridge * Math.PI) / 180;
      const xs = p.outline.map((q) => q[0]);
      const c: Vec2 = [(Math.min(...xs) + Math.max(...xs)) / 2, p.outline.reduce((s, q) => s + q[1], 0) / Math.max(1, p.outline.length)];
      return { a: c, b: [c[0] + Math.cos(r) * 5000, c[1] + Math.sin(r) * 5000] };
    }
    default:
      return null;
  }
}

/** Hur ett element ligger i förhållande till närmaste raka vinkel, eller null om det är rakt eller långt ifrån. */
export function skewOf(doc: ProjectDoc, el: Element, thresholdDeg: number): SkewWarning | null {
  if (!(thresholdDeg > 0)) return null;
  const l = lineOf(doc, el);
  if (!l) return null;
  const dx = l.b[0] - l.a[0];
  const dy = l.b[1] - l.a[1];
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  angle = ((angle % 180) + 180) % 180;
  const nearest = STRAIGHT.reduce((best, s) => (Math.abs(angle - s) < Math.abs(angle - best) ? s : best), 0);
  const diff = Math.abs(angle - nearest);
  if (diff > thresholdDeg) return null;
  const offset = len * Math.sin((diff * Math.PI) / 180);
  if (offset <= EXACT_MM) return null;
  return { id: el.id, at: [(l.a[0] + l.b[0]) / 2, (l.a[1] + l.b[1]) / 2], angle, nearest: nearest % 180, offset };
}

/** Alla nästan raka element på en våning i ett tillstånd. */
export function skewWarnings(doc: ProjectDoc, storey: Id, state: Id, thresholdDeg: number): SkewWarning[] {
  if (!(thresholdDeg > 0)) return [];
  // Ritas med markeringen vid varje bildruta; räknas om bara när projektet ändrats (0.8.3).
  return savedWarnings([doc.elements, doc.definitions, storey, state, thresholdDeg], () => computeWarnings(doc, storey, state, thresholdDeg));
}
const savedWarnings = lastResults<SkewWarning[]>(2);

function computeWarnings(doc: ProjectDoc, storey: Id, state: Id, thresholdDeg: number): SkewWarning[] {
  const out: SkewWarning[] = [];
  for (const el of Object.values(doc.elements)) {
    const global = !!typeOf(el.type)?.global;
    if (el.storey !== storey || (!global && !el.states.includes(state))) continue;
    const w = skewOf(doc, el, thresholdDeg);
    if (w) out.push(w);
  }
  return out;
}

/** En rad för egenskaperna: "Nästan 90°: 89,6°, änden 12 mm från rakt." */
export function skewText(w: SkewWarning): string {
  const nf = (v: number, d: number) => v.toLocaleString('sv-SE', { maximumFractionDigits: d });
  return `Nästan ${w.nearest}°: ligger i ${nf(w.angle, 2)}°, änden ${nf(w.offset, w.offset < 10 ? 1 : 0)} mm från rakt.`;
}
