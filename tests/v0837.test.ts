import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { normalizeStyle, SWEDISH_STANDARD } from '../src/core/graphics';
import { FILL_TYPES, hatchStrokes, patternLines, resolveFill } from '../src/core/fillTypes';
import { buildPlan } from '../src/repr/plan';
import { buildModel3d } from '../src/repr/model3d';
import type { ViewStates } from '../src/core/states';
import { sampleProject } from '../src/sample/sampleProject';

beforeAll(() => registerBuiltInTypes());

describe('Inbyggda fyllningstyper och tjocklek (0.8.37)', () => {
  it('alla inbyggda ger linjer, och sicksackens streck möts i tänderna', () => {
    for (const t of Object.values(FILL_TYPES)) expect(patternLines(t, 0, 1, 100).length).toBe(t.families.length);
    // Uppåtstrecken slutar där nedåtstrecken börjar: (1, 2), (3, 2) …
    const [up, down] = patternLines(FILL_TYPES.sicksack);
    const ends = (l: typeof up) =>
      hatchStrokes(l, { minX: -10, minY: -10, maxX: 10, maxY: 10 }).flatMap((s) => {
        // Strecken på linjen, från fasen: början och slut på varje streck inom rutan.
        const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
        const dir = [(s.b[0] - s.a[0]) / len, (s.b[1] - s.a[1]) / len];
        const period = l.dash![0] + l.dash![1];
        const out: [number, number][] = [];
        for (let t = -s.phase; t < len; t += period) if (t >= 0) out.push([s.a[0] + dir[0] * t, s.a[1] + dir[1] * t], [s.a[0] + dir[0] * (t + l.dash![0]), s.a[1] + dir[1] * (t + l.dash![0])]);
        return out;
      });
    const key = (q: [number, number]) => `${Math.round(q[0] * 1000)},${Math.round(q[1] * 1000)}`;
    const downEnds = new Set(ends(down).map(key));
    const tops = ends(up).filter((q) => Math.abs(q[0]) < 5 && Math.abs(q[1]) < 5 && Math.abs(q[1] % 4) > 1);
    expect(tops.length).toBeGreaterThan(2);
    for (const q of tops) expect(downEnds.has(key(q))).toBe(true);
  });

  it('typens tjocklek gäller före fyllningens förval, och en egen typ får inte en inbyggds nyckel', () => {
    const style = { ...structuredClone(SWEDISH_STANDARD), fillTypes: [{ id: 'egen', name: 'Egen', weight: 0.35, families: [{ angle: 0, x: 0, y: 0, spacing: 2, shift: 0, dash: [] }] }] };
    expect(resolveFill({ kind: 'type', type: 'egen', color: 'ink', weight: 0.18 }, style)).toMatchObject({ kind: 'pattern', weight: 0.35 });
    expect(resolveFill({ kind: 'type', type: 'tegel', color: 'ink', weight: 0.18 }, style, 50)).toMatchObject({ kind: 'pattern', weight: 0.18, lines: [{ spacing: 1.5 }, { spacing: 2.62 }] });
    const read = normalizeStyle(JSON.parse(JSON.stringify({ ...style, fillTypes: [...style.fillTypes, { id: 'tegel', name: 'Krock', families: style.fillTypes[0].families }] })));
    expect(read.fillTypes!.map((t) => [t.id, t.weight])).toEqual([['egen', 0.35]]);
  });
});

describe('Detaljnivå per del av vyn (0.8.37)', () => {
  const doc = sampleProject();
  const storey = doc.storeys[0].id;
  const state = doc.states.at(-1)!.id;
  const texts = (view: Partial<ViewStates>) =>
    buildPlan(doc, storey, { state, ...view }).prims.filter((p) => p.kind === 'text' && (p.origin?.objectType === 'Door' || p.origin?.objectType === 'Window')).length;
  const frames = (view: Partial<ViewStates>) => buildPlan(doc, storey, { state, ...view }).prims.filter((p) => p.origin?.objectType === 'Door' && p.kind !== 'text').length;

  it('litteran följer sin egen nivå, oberoende av 2D-symbolerna', () => {
    expect(texts({ detail: 'sketch' })).toBe(0);
    expect(texts({ detail: 'sketch', labelDetail: 'normal' })).toBe(texts({ detail: 'normal' }));
    expect(texts({ detail: 'normal', labelDetail: 'sketch' })).toBe(0);
    // Detaljmallen har fler rader än den vanliga.
    expect(texts({ detail: 'normal', labelDetail: 'detail' })).toBeGreaterThan(texts({ detail: 'normal' }));
    // Symbolerna ändras inte av litterans nivå.
    expect(frames({ detail: 'sketch', labelDetail: 'detail' })).toBe(frames({ detail: 'sketch' }));
  });

  it('3D följer sin egen nivå', () => {
    const count = (view: Partial<ViewStates>) => buildModel3d(doc, storey, { state, ...view }).length;
    expect(count({ detail: 'normal', modelDetail: 'sketch' })).toBe(count({ detail: 'sketch' }));
    expect(count({ detail: 'sketch', modelDetail: 'detail' })).toBe(count({ detail: 'detail' }));
    expect(count({ detail: 'sketch' })).toBeLessThan(count({ detail: 'detail' }));
  });
});
