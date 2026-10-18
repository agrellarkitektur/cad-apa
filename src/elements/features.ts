import type { Element, Id, ProjectDoc } from '../core/model';
import type { Vec2 } from '../repr/primitives';
import { resolveParams } from './registry';
import { holeWidth, wallFrame, type OpeningParams, type WallParams } from './wall';

/**
 * Linjer i modellen som mått kan peka på: väggarnas liv, referenslinje och
 * ändar, hålens kanter och möblernas kanter. Ett mått som pekar på en linje
 * följer med när objektet flyttas.
 */
export interface FeatureRef {
  id: Id;
  /** Vägg: "l" vänster liv, "r" höger liv, "c" referenslinjen, "e0"/"e1" ändarna. Öppning: "h1"/"h2" hålets kanter. Möbel: "e0"–"e3". */
  kind: string;
}

export interface LineFeature extends FeatureRef {
  a: Vec2;
  b: Vec2;
}

/** Linjerna för ett element. */
export function featuresOf(doc: ProjectDoc, el: Element): LineFeature[] {
  switch (el.type) {
    case 'Wall': {
      const p = resolveParams<WallParams>(doc, el);
      const f = wallFrame(p);
      const h = f.half;
      return [
        { id: el.id, kind: 'l', a: f.at(0, h), b: f.at(f.length, h) },
        { id: el.id, kind: 'r', a: f.at(0, -h), b: f.at(f.length, -h) },
        { id: el.id, kind: 'c', a: p.start, b: p.end },
        { id: el.id, kind: 'e0', a: f.at(0, -h), b: f.at(0, h) },
        { id: el.id, kind: 'e1', a: f.at(f.length, -h), b: f.at(f.length, h) },
      ];
    }
    case 'Door':
    case 'Window': {
      const host = el.host ? doc.elements[el.host] : undefined;
      if (!host) return [];
      const f = wallFrame(resolveParams<WallParams>(doc, host));
      const o = resolveParams<OpeningParams>(doc, el);
      const w = holeWidth(o) / 2;
      return [
        { id: el.id, kind: 'h1', a: f.at(o.at - w, -f.half), b: f.at(o.at - w, f.half) },
        { id: el.id, kind: 'h2', a: f.at(o.at + w, -f.half), b: f.at(o.at + w, f.half) },
      ];
    }
    case 'Furniture': {
      const p = resolveParams<{ origin: Vec2; rotation: number; width: number; depth: number }>(doc, el);
      const r = (p.rotation * Math.PI) / 180;
      const c = (x: number, y: number): Vec2 => [p.origin[0] + x * Math.cos(r) - y * Math.sin(r), p.origin[1] + x * Math.sin(r) + y * Math.cos(r)];
      const pts = [c(0, 0), c(p.width, 0), c(p.width, p.depth), c(0, p.depth)];
      return pts.map((a, i) => ({ id: el.id, kind: `e${i}`, a, b: pts[(i + 1) % 4] }));
    }
    default:
      return [];
  }
}

export function featureOf(doc: ProjectDoc, ref: FeatureRef): LineFeature | null {
  const el = doc.elements[ref.id];
  if (!el) return null;
  return featuresOf(doc, el).find((f) => f.kind === ref.kind) ?? null;
}

/**
 * Linjerna som går genom en punkt: de som måttet ska knytas till. Linjerna
 * räknas som oändliga men punkten måste ligga nära själva sträckan (med lite
 * marginal, så att ett gerat hörn räknas till båda väggarnas liv).
 */
export function refsAt(doc: ProjectDoc, candidates: Element[], pt: Vec2, tol = 1): FeatureRef[] {
  const out: FeatureRef[] = [];
  for (const el of candidates) {
    for (const f of featuresOf(doc, el)) {
      const dx = f.b[0] - f.a[0];
      const dy = f.b[1] - f.a[1];
      const len = Math.hypot(dx, dy);
      if (len < 1) continue;
      const ux = dx / len;
      const uy = dy / len;
      const rx = pt[0] - f.a[0];
      const ry = pt[1] - f.a[1];
      const off = Math.abs(rx * uy - ry * ux);
      const t = rx * ux + ry * uy;
      const margin = 600;
      if (off <= tol && t >= -margin && t <= len + margin) out.push({ id: f.id, kind: f.kind });
    }
  }
  return out;
}

/**
 * Var en måttpunkt ligger nu. Av punktens linjer används den som står mest
 * vinkelrätt mot måttets riktning; punkten flyttas med den linjen. Finns
 * ingen sådan används den sparade punkten.
 */
export function resolvePoint(doc: ProjectDoc, at: Vec2, refs: readonly FeatureRef[], dir: Vec2): Vec2 {
  let best: { f: LineFeature; dot: number } | null = null;
  for (const r of refs) {
    const f = featureOf(doc, r);
    if (!f) continue;
    const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
    if (len < 1) continue;
    const d = Math.abs(((f.b[0] - f.a[0]) * dir[0] + (f.b[1] - f.a[1]) * dir[1]) / len);
    if (!best || d < best.dot) best = { f, dot: d };
  }
  if (!best || best.dot > 0.3) return at;
  const f = best.f;
  const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
  const u: Vec2 = [(f.b[0] - f.a[0]) / len, (f.b[1] - f.a[1]) / len];
  const t = (at[0] - f.a[0]) * u[0] + (at[1] - f.a[1]) * u[1];
  return [f.a[0] + u[0] * t, f.a[1] + u[1] * t];
}
