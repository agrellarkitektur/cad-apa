import { beforeAll, describe, expect, it } from 'vitest';
import { groundAt, terrainOf } from '../src/core/site';
import { mirrorElements } from '../src/core/transforms';
import { registerBuiltInTypes } from '../src/elements';
import { finishedTerrain, type GroundParams } from '../src/elements/ground';
import { reversedRamp } from '../src/elements/rampEdits';
import { computeProfile, wallSolids } from '../src/elements/groundWall';
import type { Edges3D } from '../src/repr/solids';
import { groundLines, heightForView, terrainMesh, terrainMesh3d } from '../src/repr/terrain';
import type { Vec2 } from '../src/repr/primitives';
import { addGround, onSlope, planCtx } from './projekt';
import type { DocStore } from '../src/core/store';

/**
 * Rampen och stödmuren (0.10.26): slänt per sida, skarpa kanter på den
 * färdiga marken och stödmuren utan skarvar i bågar. Den sneda marken
 * (`onSlope`): marken ligger x/10 mm över ±0 i modellen.
 */

beforeAll(() => registerBuiltInTypes());

const view = { state: 'st-a' };
const params = (store: DocStore, id: string) => store.doc.elements[id].params as unknown as GroundParams;

/** En plan ramp längs x på 4 000, högt över marken (fyll), 3 m bred: vänster sida vid y = 1 500. */
function highRamp(store: DocStore, over: Partial<GroundParams> = {}): string {
  return addGround(store, { kind: 'path', outline: [], line: [[20000, 0], [32000, 0]], height: 4000, endHeight: 4000, width: 3000, ...over });
}

/** Den färdiga marklinjen i en sektion från `a` till `b` (u längs linjen, höjd). */
function groundLinesFor(store: DocStore, a: Vec2, b: Vec2): Vec2[] {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const right: Vec2 = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  const prims = groundLines(planCtx(store), terrainOf(store.doc)!, { start: a, right, view: [-right[1], right[0]] }, 0, l, null, true);
  return prims.flatMap((q) => (q.kind === 'polyline' && q.origin?.part === 'färdig mark' ? q.points : []));
}

describe('Slänt per sida (0.10.26)', () => {
  it('ger varje sida sin egen slänt; ändarna och sidorna utan egen följer rampens', () => {
    const store = onSlope();
    highRamp(store, { rightSlope: 4 });
    const t = finishedTerrain(planCtx(store))!.terrain;
    // 2 m ut: 1:2 ger 1 m ned, 1:4 en halv.
    expect(groundAt(t, 26000, 3500)).toBeCloseTo(3000, -2);
    expect(groundAt(t, 26000, -3500)).toBeCloseTo(3500, -2);
  });

  it('byter sida när rampen speglas eller vänds', () => {
    const store = onSlope();
    const id = highRamp(store, { leftSlope: 3 });
    expect(reversedRamp(params(store, id))).toMatchObject({ rightSlope: 3 });
    mirrorElements(store, [id], [26000, 0]);
    expect(params(store, id).rightSlope).toBe(3);
    expect(params(store, id).leftSlope).toBeUndefined();
  });
});

describe('Skarpa kanter på den färdiga marken (0.10.26)', () => {
  it('har rampens höjd ända ut till kanten och marken utan rampen utanför en stödmurskant', () => {
    const store = onSlope();
    highRamp(store, { rightEdge: 'wall' });
    const h = heightForView(store.doc, view)!;
    expect(h([26000, -1490])).toBeCloseTo(4000, 0);
    // 10 cm utanför muren: den befintliga marken (x/10), inte en tonad kant.
    expect(h([26000, -1600])).toBeCloseTo(2600, -1);
    // Rutnätet ensamt tonar mellan dem.
    const grid = groundAt(finishedTerrain(planCtx(store))!.terrain, 26000, -1600)!;
    expect(Math.abs(grid - 2600)).toBeGreaterThan(50);
  });

  it('skär nätet längs kanten och lägger en lodyta längs stödmurskanten', () => {
    const store = onSlope();
    highRamp(store, { rightEdge: 'wall' });
    const f = finishedTerrain(planCtx(store))!;
    const plain = terrainMesh(store.doc, undefined, f.z)!;
    const mesh = terrainMesh3d(store.doc, view, f)!;
    expect(mesh.indices.length).toBeGreaterThan(plain.indices.length);
    // Hörn på den högra kanten, både uppe (rampen) och nere (marken).
    const P = mesh.positions;
    let up = 0;
    let down = 0;
    for (let i = 0; i < P.length; i += 3) {
      if (Math.abs(P[i + 1] + 1500) > 1 || P[i] < 21000 || P[i] > 31000) continue;
      if (Math.abs(P[i + 2] - 4000) < 2) up++;
      if (Math.abs(P[i + 2] - P[i] / 10) < 20) down++;
    }
    expect(up).toBeGreaterThan(10);
    expect(down).toBeGreaterThan(10);
    // Alla trianglar har hörn som finns.
    expect(Math.max(...mesh.indices)).toBeLessThan(P.length / 3);
  });

  it('ger marklinjen i sektionen ett lodrätt språng vid stödmurskanten', () => {
    const store = onSlope();
    highRamp(store, { rightEdge: 'wall' });
    // En sektion tvärs rampen vid x = 26 000, från söder mot norr.
    const pts = groundLinesFor(store, [26000, -6000], [26000, 6000]);
    const near = pts.filter((q) => q[0] > 4400 && q[0] < 4600);
    expect(Math.max(...near.map((q) => q[1])) - Math.min(...near.map((q) => q[1]))).toBeGreaterThan(1300);
    expect(terrainOf(store.doc)).toBeTruthy();
  });
});

describe('Stödmuren utan skarvar (0.10.26)', () => {
  const flat = () => 0;
  const verticals = (line: [number, number][]) => {
    const prof = computeProfile(line, 200, { height: 1000, endHeight: 1000 }, flat)!;
    const edges = wallSolids('m', prof, 0).find((s): s is Edges3D => s.kind === 'edges')!;
    return edges.segments.filter((q) => Math.hypot(q[0] - q[3], q[1] - q[4]) < 1e-6).length;
  };

  it('har kantlinjer bara i ändarna längs en kurva', () => {
    const arc: [number, number][] = [];
    for (let k = 0; k <= 20; k++) arc.push([10000 * Math.cos((k * Math.PI) / 40), 10000 * Math.sin((k * Math.PI) / 40)]);
    expect(verticals(arc)).toBe(4);
  });

  it('och i de riktiga hörnen', () => {
    expect(
      verticals([
        [0, 0],
        [5000, 0],
        [5000, 5000],
      ]),
    ).toBe(6);
  });
});
