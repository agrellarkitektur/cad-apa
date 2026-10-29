import { beforeAll, describe, expect, it } from 'vitest';
import { groundAt, terrainOf } from '../src/core/site';
import type { DocStore } from '../src/core/store';
import { saveStorey } from '../src/core/treeCommands';
import { registerBuiltInTypes } from '../src/elements';
import { finishedTerrain, groundGeometry, wallProfile } from '../src/elements/ground';
import { crispShapes, groundBeside } from '../src/repr/crispGround';
import { buildPlan } from '../src/repr/plan';
import { terrainMesh, terrainMesh3d } from '../src/repr/terrain';
import { GroundTool } from '../src/ui/tools/groundTool';
import { addGround, onSlope, planCtx, toolHost } from './projekt';

/**
 * Granskningen efter 0.10.28.2 (0.10.28.3): rampens höjder ur den färdiga
 * marken, stödmurens krön längs rampens kant, marknätet delat längs
 * stödmuren och markobjekten som inte flyttar med våningshöjden.
 * Den sneda marken (`onSlope`): marken stiger 1:10 åt +x.
 */

beforeAll(() => registerBuiltInTypes());

function host(store: DocStore) {
  const h = toolHost(store, [], 'platsen');
  return { ...h, activeState: () => 'st-a', plan: () => buildPlan(store.doc, 'platsen', { state: 'st-a' }) };
}

describe('Rampens höjder ur den färdiga marken (0.10.28.3)', () => {
  it('en ramp som dras upp på en upphöjd markyta slutar på ytans nivå, inte på den befintliga markens', () => {
    const store = onSlope();
    const existing = (x: number, y: number) => groundAt(terrainOf(store.doc)!, x, y)!;
    // En platå ett par meter över den befintliga marken.
    addGround(store, { kind: 'area', outline: [[30000, 30000], [50000, 30000], [50000, 50000], [30000, 50000]], height: 7000 });
    expect(existing(40000, 40000)).toBeLessThan(5000);
    const tool = new GroundTool(host(store));
    tool.options.mode = 'path';
    tool.takePoint([20000, 40000]);
    tool.takePoint([40000, 40000]);
    tool.finish();
    const ramp = Object.values(store.doc.elements).find((e) => e.type === 'Ground' && e.params.kind === 'path')!;
    expect(ramp.params.endHeight).toBe(7000);
    // Starten ligger utanför platån: den befintliga marken som förut.
    expect(ramp.params.height).toBe(Math.round(existing(20000, 40000) / 10) * 10);
  });
});

describe('Stödmuren efter en ramp (0.10.28.3)', () => {
  /** En ramp längs x, 3 m bred, fylld 2 m över marken, och en stödmur 200 mm utanför dess vänstra kant. */
  function rampAndWall() {
    const store = onSlope();
    const g = (x: number) => groundAt(terrainOf(store.doc)!, x, 10000)!;
    addGround(store, { kind: 'path', outline: [], line: [[10000, 10000], [30000, 10000]], width: 3000, height: g(10000) + 2000, endHeight: g(30000) + 2000 });
    const wall = addGround(store, { kind: 'wall', outline: [], line: [[10000, 11700], [30000, 11700]], thickness: 300 });
    return { store, wall, g };
  }

  it('krönet ligger jämnt över rampens kant längs hela muren', () => {
    const { store, wall, g } = rampAndWall();
    const prof = wallProfile(planCtx(store), store.doc.elements[wall])!;
    // Rampen är 2 m över marken och stiger 1:10 som marken: krönet följer med, lika högt över kanten överallt, också i ändarna.
    const over = prof.stations.map((st) => st.top - (g(st.at[0]) + 2000));
    expect(Math.max(...over) - Math.min(...over)).toBeLessThan(10);
  });

  it('marknätet delas längs stödmurens kanter, med marken tolkad från var sida för sig', () => {
    const { store, wall } = rampAndWall();
    const ctx = planCtx(store);
    const f = finishedTerrain(ctx)!;
    const c = crispShapes(ctx, f).find((x) => x.id === wall)!;
    expect(c.ring).toHaveLength(4);
    expect(c.wall.every((w) => !w)).toBe(true);
    // På rampens sida om muren ligger marken på rampens höjd ända fram till muren (fyllningen hålls
    // av muren); utanför är den orörd, så de båda kanterna skiljer sig ett par meter.
    const inner = c.top(20000, 11550);
    const outer = c.top(20000, 11850);
    expect(inner - outer).toBeGreaterThan(1500);
    expect(Math.abs(outer - groundAt(terrainOf(store.doc)!, 20000, 11850)!)).toBeLessThan(50);
    // Rutnätets egen tolkning i samma punkter tonar genom muren.
    expect(groundAt(f.terrain, 20000, 11550)! - groundAt(f.terrain, 20000, 11850)!).toBeLessThan(inner - outer);
    // Långt från muren är marken från en sida den vanliga.
    expect(groundBeside(f.terrain, [[10000, 11700], [30000, 11700]], 20000, 20000)).toBeCloseTo(groundAt(f.terrain, 20000, 20000)!, 3);
    // Nätet får hörn på murens kanter.
    const plain = terrainMesh(store.doc, undefined, f.z)!;
    const crisp = terrainMesh3d(store.doc, { state: 'st-a' }, f)!;
    expect(crisp.positions.length).toBeGreaterThan(plain.positions.length);
  });
});

describe('Markobjekten och våningshöjden (0.10.28.3)', () => {
  it('ramper och markytor på Platsen ligger kvar när en våning byter höjd eller nivå; platån runt huset följer husets golv', () => {
    const store = onSlope();
    addGround(store, { kind: 'path', outline: [], line: [[10000, 10000], [30000, 10000]], height: 1000, endHeight: 3000 });
    addGround(store, { kind: 'area', outline: [[30000, 30000], [40000, 30000], [40000, 40000], [30000, 40000]], height: 2500 });
    const around = addGround(store, { kind: 'area', outline: [], around: true });
    const plan1 = store.doc.storeys[0].id;
    const heights = () => {
      const ctx = planCtx(store);
      const f = finishedTerrain(ctx)!;
      return [groundAt(f.terrain, 20000, 10000), groundAt(f.terrain, 35000, 35000), groundGeometry(ctx, store.doc.elements[around])!.label.height];
    };
    const before = heights();
    // Våningshöjden: våningarna ovanför flyttar, inte Platsen och inte marken.
    saveStorey(store, plan1, { height: 3300 });
    expect(store.doc.storeys.find((s) => s.site)!.elevation).toBe(0);
    expect(heights()).toEqual(before);
    // Golvnivån: rampen och markytan har sina höjder från ±0 och ligger kvar; platån runt huset utgår från golvet och följer med.
    saveStorey(store, plan1, { elevation: 300 });
    const after = heights();
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
    expect(after[2]).toBe(before[2]! + 300);
  });
});
