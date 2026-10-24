import type { Element } from '../core/model';
import type { Primitive, Vec2 } from '../repr/primitives';
import { dimensionPrims } from './annotation';
import type { PlanContext } from './registry';
import { holeWidth, wallFrame, type OpeningParams, type WallParams } from './wall';

export interface TempDim {
  a: Vec2;
  b: Vec2;
  value: number;
  /** Väggens normal åt det håll avståndet växer när väggen flyttas. */
  grow: Vec2;
}

/** Avståndet från väggens liv till närmaste parallella väggs liv på var sida. */
export function computeTempDims(wall: Element, others: Element[], params: (e: Element) => WallParams): TempDim[] {
  const f = wallFrame(params(wall));
  const best: Record<'pos' | 'neg', TempDim | null> = { pos: null, neg: null };
  // Bågväggar mäts inte: det finns inget rakt avstånd att ändra.
  if (f.arc) return [];
  for (const o of others) {
    const g = wallFrame(params(o));
    if (g.arc) continue;
    if (Math.abs(f.u[0] * g.u[1] - f.u[1] * g.u[0]) > 0.02) continue;
    // Hur långt de överlappar längs väggen.
    const sa = (g.a[0] - f.a[0]) * f.u[0] + (g.a[1] - f.a[1]) * f.u[1];
    const sb = (g.b[0] - f.a[0]) * f.u[0] + (g.b[1] - f.a[1]) * f.u[1];
    const s0 = Math.max(0, Math.min(sa, sb));
    const s1 = Math.min(f.length, Math.max(sa, sb));
    if (s1 - s0 < 100) continue;
    const off = (g.a[0] - f.a[0]) * f.n[0] + (g.a[1] - f.a[1]) * f.n[1];
    const s = (s0 + s1) / 2;
    if (off > 0) {
      const dist = off - g.half - f.half;
      if (dist > 0 && (!best.pos || dist < best.pos.value)) best.pos = { a: f.at(s, f.half), b: f.at(s, off - g.half), value: dist, grow: [-f.n[0], -f.n[1]] };
    } else {
      const dist = -off - g.half - f.half;
      if (dist > 0 && (!best.neg || dist < best.neg.value)) best.neg = { a: f.at(s, -f.half), b: f.at(s, off + g.half), value: dist, grow: [f.n[0], f.n[1]] };
    }
  }
  return [best.pos, best.neg].filter((d): d is TempDim => !!d);
}

/**
 * Automatisk måttsättning av det som är nytt i ett förslag: nya väggar får
 * avståndet till närmaste befintliga parallella vägg och sin tjocklek, nya
 * dörrar och fönster hålets läge från närmaste vägglivs och hålets bredd.
 * Måtten räknas fram varje gång och följer alltså alltid modellen.
 */
export function autoDimensions(ctx: PlanContext): Primitive[] {
  const origin = { objectType: 'Dimension', part: 'auto' };
  const height = ctx.style.labels.heights.dimension;
  const paper = (mm: number) => mm * ctx.scale;
  const walls = ctx.visible('Wall').filter((w) => ctx.actionOf(w) !== 'demolished');
  const params = (e: Element) => ctx.params<WallParams>(e);
  const out: Primitive[] = [];
  const angleOf = (v: Vec2) => (Math.atan2(v[1], v[0]) * 180) / Math.PI;

  for (const w of walls.filter((x) => ctx.actionOf(x) === 'new')) {
    const f = wallFrame(params(w));
    if (f.arc) continue;
    const existing = walls.filter((x) => x.id !== w.id && ctx.actionOf(x) === 'existing');
    const near = computeTempDims(w, existing, params).sort((a, b) => a.value - b.value)[0];
    let points: [number, number][];
    let dir: Vec2;
    if (near) {
      // Från den befintliga väggens liv över den nya väggen.
      dir = [f.n[0], f.n[1]];
      const s = (near.a[0] - f.a[0]) * f.u[0] + (near.a[1] - f.a[1]) * f.u[1];
      const nearSide = (near.a[0] - f.a[0]) * f.n[0] + (near.a[1] - f.a[1]) * f.n[1] > 0 ? 1 : -1;
      points = [near.b, near.a, f.at(s, -nearSide * f.half)].map((q) => [q[0], q[1]] as [number, number]);
    } else {
      dir = [f.n[0], f.n[1]];
      const s = f.length / 2;
      points = [f.at(s, -f.half), f.at(s, f.half)].map((q) => [q[0], q[1]] as [number, number]);
    }
    out.push(...dimensionPrims({ points, angle: angleOf(dir), offset: paper(6) }, ctx.scale, origin, height, ctx.style));
  }

  // Nya öppningar: från närmaste vinkelräta vägglivs till hålets kanter.
  for (const o of [...ctx.visible('Door'), ...ctx.visible('Window')]) {
    if (ctx.actionOf(o) !== 'new' || !o.host) continue;
    const host = ctx.doc.elements[o.host];
    if (!host) continue;
    const f = wallFrame(params(host));
    if (f.arc) continue;
    const op = ctx.params<OpeningParams>(o);
    const h1 = op.at - holeWidth(op) / 2;
    const h2 = op.at + holeWidth(op) / 2;
    let ref = 0;
    for (const x of walls) {
      if (x.id === host.id) continue;
      const g = wallFrame(params(x));
      if (g.arc || Math.abs(f.u[0] * g.u[0] + f.u[1] * g.u[1]) > 0.02) continue;
      // Den måste nå fram till den här väggen.
      const oa = (g.a[0] - f.a[0]) * f.n[0] + (g.a[1] - f.a[1]) * f.n[1];
      const ob = (g.b[0] - f.a[0]) * f.n[0] + (g.b[1] - f.a[1]) * f.n[1];
      if (Math.min(oa, ob) > f.half + 1 || Math.max(oa, ob) < -f.half - 1) continue;
      // Den andra väggens liv där de korsar den här väggens linje.
      const centre = (g.a[0] - f.a[0]) * f.u[0] + (g.a[1] - f.a[1]) * f.u[1];
      for (const face of [centre - g.half, centre + g.half]) if (face <= h1 - 1 && face > ref) ref = face;
    }
    const pts: [number, number][] = [f.at(ref, f.half), f.at(h1, f.half), f.at(h2, f.half)].map((q) => [q[0], q[1]] as [number, number]);
    out.push(...dimensionPrims({ points: pts, angle: angleOf(f.u), offset: paper(7) }, ctx.scale, origin, height, ctx.style));
  }
  return out;
}
