import type { Element, ProjectDoc } from '../src/core/model';
import { DocStore } from '../src/core/store';
import type { Shape2DParams } from '../src/elements/drawing2d';
import { buildPlan } from '../src/repr/plan';
import { sampleProject } from '../src/sample/sampleProject';
import type { ToolHost } from '../src/ui/tools/host';

/**
 * Testprojekt och hjälpfunktioner som används av flera tester (0.8.2;
 * hjälpfunktionerna samlade här i 0.8.32).
 */

type P = [number, number];

/** En kvadrat med nedre vänstra hörnet i (x, y). */
export const square = (x: number, y: number, s = 1000): P[] => [
  [x, y],
  [x + s, y],
  [x + s, y + s],
  [x, y + s],
];

/** En 2D-form utan punkter, linje 0,25 heldragen, utan fyllning. */
export const SHAPE: Shape2DParams = { shape: 'polyline', points: [], weight: 0.25, linetype: 'solid', fillAngle: 45, fillSpacing: 2 };

/**
 * Exempelprojektet med några 2D-former i alla tillstånd på första
 * våningen; `order` är formens ritordning. `defaults` läggs under varje
 * forms egna parametrar.
 */
export function storeWithShapes(shapes: Record<string, Partial<Shape2DParams> & { order?: number }>, defaults: Partial<Shape2DParams> = {}): DocStore {
  const doc = sampleProject();
  const storey = doc.storeys[0].id;
  for (const [id, { order, ...p }] of Object.entries(shapes))
    doc.elements[id] = { id, type: 'Shape2D', storey, states: doc.states.map((s) => s.id), tags: [], params: { ...SHAPE, ...defaults, ...p }, props: {}, ...(order !== undefined ? { order } : {}) } as Element;
  return new DocStore(doc);
}

/** Planen för första våningen i det sista tillståndet, utan jämförelse. */
export const planOf = (store: DocStore) => buildPlan(store.doc, store.doc.storeys[0].id, { state: store.doc.states.at(-1)!.id });

/**
 * Ett tomt projekt med väggar (200 mm), 2D-linjer och andra objekt på
 * exemplets första våning (0.8.13).
 */
export function wallsProject(
  walls: Record<string, [P, P]>,
  lines: Record<string, P[]> = {},
  extra: Record<string, { type: string; params: Record<string, unknown> }> = {},
): DocStore {
  const doc: ProjectDoc = structuredClone(sampleProject());
  const wall = Object.values(doc.elements).find((e) => e.type === 'Wall')!;
  const base = { storey: wall.storey, states: wall.states, tags: [], props: {} };
  doc.elements = {};
  for (const [id, [start, end]] of Object.entries(walls))
    doc.elements[id] = { id, type: 'Wall', ...base, params: { start, end, thickness: 200, height: 2700, justification: 'center' } } as never;
  for (const [id, points] of Object.entries(lines))
    doc.elements[id] = { id, type: 'Shape2D', ...base, params: { shape: 'polyline', points, weight: 0.25, linetype: 'solid' } } as never;
  for (const [id, e] of Object.entries(extra)) doc.elements[id] = { id, type: e.type, ...base, params: e.params } as never;
  return new DocStore(doc);
}

/** Väggens ändpunkter. */
export const wallEnds = (store: DocStore, id: string) => {
  const p = store.doc.elements[id].params as { start: P; end: P };
  return [p.start, p.end];
};

/**
 * Det ritverktygen behöver av appen, utan webbläsare (0.8.21). Tipsen
 * samlas i `hints`; planen är den riktiga.
 */
export function toolHost(store: DocStore, selected: string[] = []): ToolHost & { hints: string[] } {
  let sel = [...selected];
  const hints: string[] = [];
  return {
    store,
    hints,
    selection: { set: (ids: string[]) => (sel = [...ids]), list: () => sel } as never,
    view: { requestRender: () => {}, camera: { scale: 1 }, drawingScale: 100 } as never,
    plan: () => planOf(store),
    activeState: () => store.doc.states[0].id,
    storey: () => store.doc.storeys[0].id,
    snapSegments: () => [],
    hint: (t: string) => hints.push(t),
  };
}

/**
 * En liten DXF i millimeter (`units` 4) eller annan enhet, med block och
 * entiteter. Raderna rensas från indrag och tomma rader.
 */
export function dxf(entities: string, blocks = '', units = 4): string {
  return `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n${units}\n0\nENDSEC\n0\nSECTION\n2\nBLOCKS\n${blocks}\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities}\n0\nENDSEC\n0\nEOF`
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l)
    .join('\n');
}

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

/**
 * Exempelvillan med en våning till (0.9.3): plan 2 på +2 700 med kopior av
 * väggarna, dörrarna, fönstren, rummen och plattan (BJ01, 400), och en
 * håltagning i plattan på plan 2 där sektionen går. Taket ligger på plan 2.
 * Kopiorna heter `<id>-2`, så att referensritningarna blir desamma varje gång.
 */
export function twoStoreys(): ProjectDoc {
  const doc = sampleProject();
  doc.storeys.push({ id: 'pl-2', name: 'Plan 2', elevation: 2700, height: 2700 });
  const copied = ['Wall', 'Door', 'Window', 'Space', 'Slab'];
  for (const e of Object.values(doc.elements)) {
    if (e.storey !== 'pl-1' || e.space || !copied.includes(e.type)) continue;
    const id = `${e.id}-2`;
    doc.elements[id] = { ...structuredClone(e), id, storey: 'pl-2', ...(e.host ? { host: `${e.host}-2` } : {}) };
  }
  doc.elements['bj1-2'].params = { ...doc.elements['bj1-2'].params, holes: [{ points: [[6000, 5000], [7200, 5000], [7200, 6500], [6000, 6500]] }] };
  for (const id of ['tak', 'tak-n']) doc.elements[id].storey = 'pl-2';
  return doc;
}

/**
 * Exempelprojektet med 2D-former och egna pennor (0.8.32): linjetyper,
 * också en egen, bågar och ändformer, skraffering med bakgrund och mask,
 * fyllningar i ritordning, en mask framför väggarna och egna pennor på
 * vägg, dörr, fönster, möbel och tak. Referensritningarna för det som kom
 * till i 0.8.24–0.8.31.
 */
export function shapesProject(): ProjectDoc {
  const doc = sampleProject();
  doc.graphics = {
    ...doc.graphics,
    lineTypes: [{ id: 'egen-1', name: 'Egen', dash: [4, 1, 0.5, 1] }],
    pens: { sectionLine: { weight: 0.5, linetype: 'dashdot' }, north: { weight: 0.25, color: '#c2372c' } },
    // Fyllningstyperna (0.8.36–0.8.37, i referensritningarna sedan 0.8.38): en egen typ och tegel som snittfyllning för nytt.
    fillTypes: [{ id: 'egen-fyll', name: 'Egen', weight: 0.25, families: [{ angle: 0, x: 0, y: 0, spacing: 3, shift: 1.5, dash: [2, 1] }, { angle: 60, x: 1, y: 0.5, spacing: 4, shift: 0, dash: [] }] }],
    actions: { ...doc.graphics.actions, new: { ...doc.graphics.actions.new, cutFill: { kind: 'type', type: 'tegel', color: 'ink', weight: 0.18 } } },
  };
  const states = doc.states.map((s) => s.id);
  const base = { weight: 0.25, linetype: 'solid', fillAngle: 45, fillSpacing: 2 };
  const shape = (id: string, params: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
    doc.elements[id] = { id, type: 'Shape2D', storey: 'pl-1', states, tags: [], props: {}, params: { ...base, ...params }, ...extra } as any;
  };
  const rect = (x: number, y: number, w: number, h: number): [number, number][] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  shape('f-streck', { shape: 'polyline', points: [[-3000, -2000], [2000, -2000], [4000, -500]], bulges: [0, 800], linetype: 'dashed', startCap: 'dot', endCap: 'arrow' });
  shape('f-egen', { shape: 'polyline', points: [[-3000, -3500], [9000, -3500]], linetype: 'egen-1', weight: 0.35, color: '#c2372c', endCap: 'open' });
  shape('f-under', { shape: 'polyline', points: rect(-6000, 1000, 3000, 2000), closed: true, linetype: 'dashdot', fill: 'solid', fillColor: '#88aacc', opacity: 50 }, { order: 0 });
  shape('f-skraffering', { shape: 'polyline', points: rect(-5000, 2000, 3000, 2000), closed: true, fill: 'hatch', fillAngle: 30, fillBackground: 'paper' }, { order: 1 });
  shape('f-hel', { shape: 'polyline', points: rect(2000, -4000, 2000, 1000), closed: true, weight: 0, fill: 'solid', fillColor: '#ddcc88' }, { order: 2 });
  shape('f-mask', { shape: 'polyline', points: rect(-200, -200, 1200, 1200), closed: true, weight: 0, fill: 'mask', fillFront: true });
  shape('f-cirkel', { shape: 'polyline', points: [[-1000, 5000], [-3000, 5000]], bulges: [1000, 1000], closed: true, fill: 'cross', fillBackground: '#ffeedd', fillBackgroundOpacity: 60, linetype: 'dotted' });
  shape('f-spline', { shape: 'spline', points: [[-6000, -1000], [-5000, 0], [-4000, -1000], [-3000, 0]], linetype: 'dashdotdot', endCap: 'triangle' });
  shape('f-tegel', { shape: 'polyline', points: rect(13000, 0, 3000, 2000), closed: true, fill: 'type', fillType: 'tegel', fillTypeAngle: 15, fillBackground: 'paper' });
  shape('f-egen-typ', { shape: 'polyline', points: rect(13000, 3000, 3000, 2000), closed: true, fill: 'type', fillType: 'egen-fyll', fillTypeScale: 2, opacity: 70 });
  shape('f-sicksack', { shape: 'polyline', points: rect(13000, 6000, 3000, 1000), closed: true, weight: 0, fill: 'type', fillType: 'sicksack' });
  shape('f-saknad-typ', { shape: 'polyline', points: rect(13000, -3000, 2000, 2000), closed: true, fill: 'type', fillType: 'finns-inte' });
  doc.elements['iv-1'].pen = { weight: 0.7, linetype: 'dashed', color: '#00aa00' };
  doc.elements['d02'].pen = { color: '#c2372c' };
  doc.elements['f01'].pen = { weight: 0.13 };
  doc.elements['m01'].pen = { linetype: 'dotted' };
  doc.elements['tak'].pen = { color: '#3355aa', weight: 0.5 };
  doc.elements['r01'].params = { ...doc.elements['r01'].params, fill: 'hatch', fillBackground: '#eeeeff', fillColor: '#5566aa' };
  doc.elements['r02'].params = { ...doc.elements['r02'].params, fill: 'type', fillType: 'plattor150', fillTypeAngle: 45, fillColor: '#5566aa' };
  return doc;
}
