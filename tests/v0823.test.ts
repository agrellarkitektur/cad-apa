import { describe, expect, it } from 'vitest';
import { BoxIndex } from '../src/geometry/boxIndex';
import { pointInRings } from '../src/geometry/vec';
import type { Box } from '../src/geometry/boolean';
import type { Pickable } from '../src/repr/plan';
import type { Primitive, Vec2 } from '../src/repr/primitives';
import { imageCorners } from '../src/repr/primitives';
import { distToPrim, pickAllAt } from '../src/view2d/pick';

/**
 * Granskningen (0.8.23): det som gjorts snabbare ger samma svar som förut.
 * `pickAllAt` jämförs med den gamla versionen, som prövade varje del av
 * varje objekt, och rutnätet med att pröva alla rektanglar.
 */

/** Den gamla pickAllAt (0.8.22), ordagrant. */
function pickAllAtBefore(pickables: readonly Pickable[], p: Vec2, tol: number, drawingScale = 100): string[] {
  const best = new Map<string, { score: number; i: number }>();
  for (let i = 0; i < pickables.length; i++) {
    const item = pickables[i];
    let d = Infinity;
    for (const prim of item.prims) d = Math.min(d, distToPrim(p, prim, drawingScale));
    for (const rings of item.regions) d = Math.min(d, distToPrim(p, { kind: 'region', rings, role: 'cut', fill: { kind: 'none' }, outline: null }, drawingScale));
    let score = -Infinity;
    const inside = item.regions.some((rings) => pointInRings(p, rings));
    if (inside && !item.soft) score = 3000 + item.priority;
    else if (d <= tol) score = 2000 + item.priority - d / tol;
    else if (inside) score = 1500 + item.priority;
    else if (!item.soft && item.prims.some((prim) => (prim.kind === 'polyline' && prim.closed && pointInRings(p, [prim.points])) || (prim.kind === 'image' && pointInRings(p, [imageCorners(prim)]))))
      score = 1000 + item.priority;
    const was = best.get(item.id);
    if (score > -Infinity && (!was || score > was.score)) best.set(item.id, { score, i });
  }
  return [...best.entries()].sort((a, b) => b[1].score - a[1].score || a[1].i - b[1].i).map(([id]) => id);
}

/** Ett enkelt slumptal som blir detsamma varje gång. */
function random(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

function scene(): Pickable[] {
  const r = random(7);
  const pen = { weight: 0.25 };
  // Ett stort "underlag": tusentals linjer, bågar, texter och några slutna former.
  const many: Primitive[] = [];
  for (let k = 0; k < 3000; k++) {
    const x = r() * 60000;
    const y = r() * 40000;
    const kind = k % 7;
    if (kind === 0) many.push({ kind: 'text', at: [x, y], text: 'Rum ' + k, height: 2.5, angle: r() * 3, align: (['start', 'middle', 'end'] as const)[k % 3], pen });
    else if (kind === 1) many.push({ kind: 'arc', center: [x, y], radius: 200 + r() * 3000, start: r() * 6, end: r() * 6, pen });
    else if (kind === 2) many.push({ kind: 'polyline', points: [[x, y], [x + 900, y], [x + 900, y + 700], [x, y + 700]], closed: true, pen });
    else many.push({ kind: 'line', a: [x, y], b: [x + (r() - 0.5) * 4000, y + (r() - 0.5) * 4000], pen });
  }
  const wall: Vec2[][][] = [[[[10000, 10000], [20000, 10000], [20000, 10200], [10000, 10200]]]];
  return [
    { id: 'underlag', priority: 2, regions: [], prims: many },
    { id: 'vägg', priority: 20, regions: wall, prims: [] },
    { id: 'rum', priority: 40, regions: [[[[9000, 9000], [21000, 9000], [21000, 15000], [9000, 15000]]]], soft: false, prims: [{ kind: 'text', at: [15000, 12000], text: 'SOVRUM', height: 2.5, pen }] },
    { id: 'form', priority: 58, soft: true, regions: [[[[30000, 30000], [32000, 30000], [32000, 31000]]]], prims: [{ kind: 'polyline', points: [[30000, 30000], [32000, 30000], [32000, 31000]], closed: false, pen }] },
    { id: 'bild', priority: 1, regions: [], prims: [{ kind: 'image', source: { asset: 'a' }, corner: [40000, 0], u: [5000, 0], v: [0, 3000], opacity: 1 } as unknown as Primitive] },
    { id: 'tom', priority: 5, regions: [], prims: [] },
  ];
}

describe('klick i planen (0.8.23)', () => {
  it('ger samma objekt i samma ordning som förut, på tusentals punkter', () => {
    const items = scene();
    const r = random(11);
    for (const scale of [50, 100]) {
      for (let k = 0; k < 2500; k++) {
        const p: Vec2 = [r() * 64000 - 2000, r() * 44000 - 2000];
        const tol = [20, 120, 600][k % 3];
        expect(pickAllAt(items, p, tol, scale), `${p} ${tol} 1:${scale}`).toEqual(pickAllAtBefore(items, p, tol, scale));
      }
    }
  });

  it('prövar bara delarna nära punkten i ett stort underlag', () => {
    const items = scene();
    pickAllAt(items, [0, 0], 100);
    const t0 = performance.now();
    for (let k = 0; k < 200; k++) pickAllAt(items, [k * 300, k * 200], 100);
    const fast = performance.now() - t0;
    const t1 = performance.now();
    for (let k = 0; k < 200; k++) pickAllAtBefore(items, [k * 300, k * 200], 100);
    const slow = performance.now() - t1;
    expect(fast).toBeLessThan(slow);
  });
});

describe('rutnätet över rektanglar (0.8.23)', () => {
  const touches = (a: Box, b: Box) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

  it('ger alla som rör en stor fråga, i stigande ordning, också utzoomat', () => {
    const r = random(3);
    const boxes: (Box | null)[] = [];
    const index = new BoxIndex(2000);
    for (let i = 0; i < 4000; i++) {
      const x = r() * 400000;
      const y = r() * 300000;
      const b: Box | null = i % 97 === 0 ? null : [x, y, x + r() * 5000, y + r() * 5000];
      boxes.push(b);
      index.add(i, b);
    }
    for (const q of [[0, 0, 400000, 300000], [50000, 20000, 250000, 260000], [-1e6, -1e6, 1e6, 1e6], [100, 100, 900, 900]] as Box[]) {
      const got = index.near(q);
      expect(got).toEqual([...got].sort((a, b) => a - b));
      const must = boxes.map((b, i) => (!b || touches(b, q) ? i : -1)).filter((i) => i >= 0);
      for (const i of must) expect(got).toContain(i);
    }
    expect(index.near([-Infinity, 0, 0, 0])).toHaveLength(4000);
  });

  it('sorterar när numren lagts in i en annan ordning', () => {
    const index = new BoxIndex(10);
    index.add(5, [0, 0, 1, 1]);
    index.add(2, [0, 0, 1, 1]);
    index.add(9, null);
    expect(index.near([-1e9, -1e9, 1e9, 1e9])).toEqual([2, 5, 9]);
  });
});
