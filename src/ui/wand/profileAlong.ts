import { fitArcs, hasBulges } from '../../geometry/arcFit';
import type { Chain } from '../../geometry/chains';
import { dist } from '../../geometry/vec';
import type { Vec2 } from '../../repr/primitives';
import { sameChain, traceAt } from './trace';
import type { WandAction, WandHit } from './wand';

/**
 * Profilen (0.11.7.1): längs kanten man pekar på (en vägg, ett bjälklag, en
 * takfot, en linje …), sidan mellan två hörn först och Tab för hela
 * kedjan; i ett hörn också en pelare. Verktygets typ, ankare, höjd,
 * vridning och spegling gäller, som i verktygets *Längs kant*. Bågar i det
 * man följer blir bågar i banan. Andra profiler följs inte.
 */
export const profileAlong: WandAction = {
  id: 'profile-along',
  tools: ['profile'],
  find(ctx) {
    const { app } = ctx;
    const doc = app.store.doc;
    const t = traceAt(ctx, (s) => doc.elements[s.id]?.type !== 'Profile');
    if (!t) return [];
    const make = (label: string, c: Chain): WandHit => ({
      label,
      what: t.what,
      preview: { lines: [c] },
      apply: () => {
        const a = fitArcs(c);
        const line: Vec2[] = a.closed ? [...a.points, a.points[0]] : a.points;
        app.profileTool.createLine(line, hasBulges(a.bulges) ? a.bulges : undefined);
      },
    });
    const out: WandHit[] = [];
    out.push(make(t.side.closed ? 'Profil runt konturen' : `Profil längs ${t.side.points.length > 2 ? 'sidan' : 'kanten'}`, t.side));
    if (!sameChain(t.side, t.whole)) out.push(make(t.whole.closed ? 'Profil runt hela konturen' : 'Profil längs hela linjen', t.whole));
    // Nära ett hörn (sidans ände): en pelare där, först.
    const corner = t.side.closed ? null : cornerNear([t.side.points[0], t.side.points[t.side.points.length - 1]], ctx.at, Math.max(ctx.tol, 40));
    if (corner) out.unshift({ label: 'Pelare i hörnet', what: t.what, preview: { lines: [{ points: [corner, corner], closed: false }] }, apply: () => void app.profileTool.createColumn(corner) });
    return out;
  },
};

function cornerNear(points: readonly Vec2[], at: Vec2, tol: number): Vec2 | null {
  let best: { p: Vec2; d: number } | null = null;
  for (const p of points) {
    const d = dist(p, at);
    if (d <= tol && (!best || d < best.d)) best = { p, d };
  }
  return best ? [Math.round(best.p[0]), Math.round(best.p[1])] : null;
}
