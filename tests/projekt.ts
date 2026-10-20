import type { ProjectDoc } from '../src/core/model';
import { sampleProject } from '../src/sample/sampleProject';

/**
 * Testprojekt som används av flera tester: prestandatestet och
 * referensritningarna (0.8.2).
 */

/** Ett rutnät av rum, 4 × 4 m, med innerväggar i exempelprojektets typ. */
export function wallGrid(n: number): { doc: ProjectDoc; walls: number } {
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

/**
 * Ett rutnät av rum (0.8.1): ytterväggar med fönster, innerväggar med dörrar,
 * ett rum i varje ruta och en huvudentré. 12 × 12 rum ger 312 väggar och 642
 * element.
 */
export function roomGrid(n: number): ProjectDoc {
  const doc = sampleProject();
  const storey = doc.storeys[0].id;
  const keep = ['North', 'Elevation', 'Section'];
  for (const [id, el] of Object.entries(doc.elements)) if (!keep.includes(el.type)) delete doc.elements[id];
  const states = doc.states.map((s) => s.id);
  const C = 4000;
  let k = 0;
  const add = (el: Record<string, unknown>) => {
    doc.elements[el.id as string] = { storey, states, tags: [], props: {}, ...el } as any;
  };
  const wall = (start: [number, number], end: [number, number], outer: boolean) => {
    const id = `rv-${k++}`;
    add({ id, type: 'Wall', definition: outer ? 't-yv01' : 't-iv01', params: { start, end, height: 2700, justification: 'center' } });
    return id;
  };
  for (let i = 0; i <= n; i++) {
    const outer = i === 0 || i === n;
    for (let j = 0; j < n; j++) {
      const h = wall([j * C, i * C], [(j + 1) * C, i * C], outer);
      const v = wall([i * C, j * C], [i * C, (j + 1) * C], outer);
      if (outer) {
        add({ id: `f-${h}`, type: 'Window', definition: 't-f1', host: h, params: { at: 2000, sill: 900 } });
        add({ id: `f-${v}`, type: 'Window', definition: 't-f1', host: v, params: { at: 2000, sill: 900 } });
      } else add({ id: `d-${h}`, type: 'Door', definition: 't-d1', host: h, params: { at: 1500, swing: 1, hinge: 'start' } });
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) add({ id: `r-${i}-${j}`, type: 'Space', name: 'Rum', params: { outline: [], seed: [j * C + C / 2, i * C + C / 2] } });
  delete doc.elements['f-rv-0'];
  add({ id: 'entre', type: 'Door', definition: 't-d2', host: 'rv-0', params: { at: 1500, swing: 1, hinge: 'start', mainEntrance: true } });
  return doc;
}
