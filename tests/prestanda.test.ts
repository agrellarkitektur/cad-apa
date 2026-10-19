import { beforeAll, describe, expect, it } from 'vitest';
import type { ProjectDoc } from '../src/core/model';
import { registerBuiltInTypes } from '../src/elements';
import { buildPlan } from '../src/repr/plan';
import { buildSection } from '../src/repr/section';
import { sampleProject } from '../src/sample/sampleProject';

/**
 * Prestanda (0.8 del 2.1). Ett rutnät av rum, 4 × 4 m, med innerväggar i
 * exempelprojektets typ. 16 × 16 rum ger 544 väggar, ungefär ett mindre
 * flerbostadshus på ett plan gånger fyra. Gränserna är generösa så att
 * testet inte felar på en belastad maskin, men en algoritm som växer med
 * kvadraten på antalet väggar (fasaden tog 6–10 s före 0.8 del 2.1) fångas.
 */
beforeAll(() => registerBuiltInTypes());

function wallGrid(n: number): { doc: ProjectDoc; walls: number } {
  const doc = sampleProject();
  const storey = doc.storeys[0].id;
  const keep = ['North', 'Elevation', 'Section'];
  for (const [id, el] of Object.entries(doc.elements)) if (!keep.includes(el.type)) delete doc.elements[id];
  const states = doc.states.map((s) => s.id);
  const C = 4000;
  let k = 0;
  const wall = (start: [number, number], end: [number, number]) => {
    const id = `rv-${k++}`;
    doc.elements[id] = { id, type: 'Wall', storey, states, tags: [], props: {}, definition: 't-iv01', params: { start, end, height: 2700, justification: 'center' } } as any;
  };
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j < n; j++) {
      wall([j * C, i * C], [(j + 1) * C, i * C]);
      wall([i * C, j * C], [i * C, (j + 1) * C]);
    }
  }
  return { doc, walls: k };
}

describe('prestanda', () => {
  it('544 väggar: planen under 2 s och en fasad under 3 s', () => {
    const { doc, walls } = wallGrid(16);
    expect(walls).toBe(544);
    const view = { state: doc.states[1].id, compareTo: doc.states[0].id };
    let t = performance.now();
    const plan = buildPlan(doc, doc.storeys[0].id, view);
    const planMs = performance.now() - t;
    t = performance.now();
    const fasad = buildSection(doc, 'fasad-1', view);
    const fasadMs = performance.now() - t;
    expect(plan.prims.length).toBeGreaterThan(walls);
    expect(fasad?.prims.length ?? 0).toBeGreaterThan(0);
    expect(planMs).toBeLessThan(2000);
    expect(fasadMs).toBeLessThan(3000);
  }, 60000);
});
