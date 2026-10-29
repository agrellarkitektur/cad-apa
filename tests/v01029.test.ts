import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import type { Shape2DParams } from '../src/elements/drawing2d';
import { edgeRun } from '../src/elements/shapeEdit';
import { Modifier, parseEdges } from '../src/ui/modify/controller';
import { modifyContextAt, type ModifyHost } from '../src/ui/modify/ops';
import { ModifyTool } from '../src/ui/modify/tool';
import { storeyLevels } from '../src/ui/navigator';
import { forgetInferred, snap, type SnapSegment } from '../src/ui/tools/snap';
import type { Vec2 } from '../src/repr/primitives';
import type { ViewPointer } from '../src/view2d/planView';
import { square, storeWithShapes, toolHost } from './projekt';

beforeAll(() => registerBuiltInTypes());

const at = (model: [number, number]) => ({ model, pointerType: 'mouse' }) as unknown as ViewPointer;
const polar = (from: Vec2, deg: number, r: number): Vec2 => [from[0] + r * Math.cos((deg * Math.PI) / 180), from[1] + r * Math.sin((deg * Math.PI) / 180)];
const angleOf = (from: Vec2, p: Vec2) => (Math.atan2(p[1] - from[1], p[0] - from[0]) * 180) / Math.PI;

describe('Shift låser vinkeln man står i (0.10.29)', () => {
  const from: Vec2 = [0, 0];
  const none: SnapSegment[] = [];

  it('fritt: vinkeln när Shift trycks, i hela grader, gäller tills Shift släpps', () => {
    forgetInferred();
    const first = snap({ cursor: polar(from, 37.3, 2000), from, segments: none, tol: 10, ortho: true });
    expect(angleOf(from, first.point)).toBeCloseTo(37, 6);
    expect(first.label).toBe('37°');
    // Markören går mot 60°: linjen ligger kvar i 37°.
    const later = snap({ cursor: polar(from, 60, 3000), from, segments: none, tol: 10, ortho: true });
    expect(angleOf(from, later.point)).toBeCloseTo(37, 6);
    // Bakåt längs linjen vänder riktningen.
    const back = snap({ cursor: polar(from, 220, 1000), from, segments: none, tol: 10, ortho: true });
    expect(angleOf(from, back.point)).toBeCloseTo(37 - 180, 6);
    // Shift släpps och trycks igen: den nya vinkeln gäller.
    snap({ cursor: polar(from, 60, 3000), from, segments: none, tol: 10 });
    expect(angleOf(from, snap({ cursor: polar(from, 60, 3000), from, segments: none, tol: 10, ortho: true }).point)).toBeCloseTo(60, 6);
  });

  it('parallellt med en linje man känt på låses exakt, också för nästa punkt i kedjan', () => {
    forgetInferred();
    const dir: Vec2 = [Math.cos((20 * Math.PI) / 180), Math.sin((20 * Math.PI) / 180)];
    const edge: SnapSegment = { id: 'e', a: [0, 5000], b: [dir[0] * 5000, 5000 + dir[1] * 5000] };
    snap({ cursor: [dir[0] * 2500 + 2, 5000 + dir[1] * 2500 - 3], segments: [edge], tol: 10 });
    const r = snap({ cursor: polar(from, 21, 3000), from, segments: [edge], tol: 10, ortho: true });
    expect(r.label).toBe('Parallellt med linjen');
    expect(Math.abs((r.point[0] - from[0]) * dir[1] - (r.point[1] - from[1]) * dir[0])).toBeLessThan(1e-6);
    // En ny punkt i kedjan: låset tas om från det man står i där.
    const next: Vec2 = [3000, 0];
    expect(angleOf(next, snap({ cursor: polar(next, 90, 1500), from: next, segments: [], tol: 10, ortho: true }).point)).toBeCloseTo(90, 6);
  });
});

describe('Förskjut med värdet vid objektet (0.10.29)', () => {
  it('siffror skrivs vid objektet och Enter förskjuter kanten åt markörens sida', () => {
    const store = storeWithShapes({ r: { points: square(0, 0, 2000), closed: true } });
    const host = { ...toolHost(store, ['r']), startModify: () => {}, endModify: () => {} } as unknown as ModifyHost;
    const mod = new Modifier(host);
    mod.setSelection({ kind: 'body', ids: ['r'], at: [0, 0], clientX: 0, clientY: 0 });
    mod.setPart(modifyContextAt(host, at([1000, 0]), 0, 0, null)!);
    mod.choose('shapeOffset');
    const tool = mod.runningTool as ModifyTool;
    // Markören utanför kanten (nedanför).
    tool.hover(at([1000, -700]));
    expect(mod.detailMarkup()).not.toContain('data-modify-value');
    for (const k of ['2', '5', '9', 'Backspace', '0']) expect(mod.typeKey(k)).toBe(true);
    expect(tool.typing).toBe('250');
    expect(mod.typeKey('Enter')).toBe(true);
    expect((store.doc.elements.r.params as unknown as Shape2DParams).points).toEqual([[0, -250], [2000, -250], [2000, 2000], [0, 2000]]);
    expect(mod.active).toBeNull();
    // Utan något skrivet tas Enter inte om hand, och Esc tömmer det skrivna.
    expect(mod.typeKey('Enter')).toBe(false);
  });

  it('Kanter som skrivet antal: ett jämnt antal får den extra kanten mot markören', () => {
    const rect = { type: 'Shape2D', params: { shape: 'polyline', points: square(0, 0, 2000), closed: true } };
    expect(edgeRun(rect, 0, 2, 1)).toEqual([0, 1]);
    expect(edgeRun(rect, 0, 2, -1)).toEqual([0, 3]);
    const open = { type: 'Shape2D', params: { shape: 'polyline', points: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]], closed: false } };
    expect(edgeRun(open, 3, 4, 1)).toEqual([2, 3, 4, 5]);
    expect(edgeRun(open, 3, 7)).toEqual([0, 1, 2, 3, 4, 5]);
    expect([parseEdges('4'), parseEdges(''), parseEdges('Alla'), parseEdges('0'), parseEdges('2,5')]).toEqual([4, 0, 0, 0, null]);
  });
});

describe('Våningslistan med verklig och lokal höjd (0.10.29)', () => {
  it('skriver RH 2000 och ±0 med tre decimaler, och bara den lokala utan plats', () => {
    expect(storeyLevels(0, 63.525)).toBe('+63,525 / 0,000');
    expect(storeyLevels(3000, 63.525)).toBe('+66,525 / 3,000');
    expect(storeyLevels(-2800, 63.525)).toBe('+60,725 / −2,800');
    expect(storeyLevels(3000)).toBe('3,000');
  });
});
