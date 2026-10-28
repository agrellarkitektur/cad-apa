import { fitArcs, hasBulges } from '../../geometry/arcFit';
import { isLineMode } from '../tools/groundTool';
import type { Vec2 } from '../../repr/primitives';
import { sameChain, traceAt } from './trace';
import type { WandAction, WandHit } from './wand';

/** Vad verktyget Mark lägger längs linjen, för texten vid markören. */
const WHAT: Record<string, string> = { wall: 'Stödmur', breakline: 'Brytlinje', drain: 'Låglinje', path: 'Väg' };

/**
 * Mark (0.10.22): ett linjeobjekt längs det man pekar på, i det sätt
 * verktyget står i: stödmur, brytlinje, låglinje eller väg. Längs en rampsida,
 * en markytas kant, ett bjälklag, en fastighetsgräns, en höjdkurva, ett
 * grannhus … Sidan (mellan två hörn) kommer först, hela konturen efter Tab.
 * En stödmur läggs utanför objektet när insidan är känd (referenslinjen på
 * den kant som ligger mot objektet), annars med linjen i mitten.
 */
export const groundAlong: WandAction = {
  id: 'ground-along',
  tools: ['ground'],
  find(ctx) {
    const mode = ctx.app.groundTool.options.mode;
    if (!isLineMode(mode)) return [];
    const t = traceAt(ctx);
    if (!t) return [];
    const make = (label: string, c: typeof t.whole): WandHit => ({
      label,
      what: t.what,
      preview: { lines: [c] },
      apply: () => {
        // En sluten kontur blir en linje som går runt och slutar där den började.
        const a = fitArcs(c);
        const line: Vec2[] = a.closed ? [...a.points, a.points[0]] : a.points;
        const arcs = hasBulges(a.bulges) ? { bulges: a.bulges } : {};
        // Insidan till höger: muren till vänster om linjen, utanför objektet.
        const extra = mode === 'wall' && (t.inside || c.closed) ? { refSide: 'right' as const } : {};
        ctx.app.groundTool.createLine(line, { ...extra, ...arcs });
      },
    });
    const name = WHAT[mode] ?? 'Linje';
    const out: WandHit[] = [];
    out.push(make(`${name} längs ${t.side.points.length > 2 ? 'sidan' : 'kanten'}`, t.side));
    if (!sameChain(t.side, t.whole)) out.push(make(`${name} ${t.whole.closed ? 'runt konturen' : 'längs hela linjen'}`, t.whole));
    return out;
  },
};
