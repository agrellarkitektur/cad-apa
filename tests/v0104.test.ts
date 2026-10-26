import { beforeAll, describe, expect, it } from 'vitest';
import { addElements } from '../src/core/commands';
import { finishedGround, type GroundShape } from '../src/core/ground';
import { encodeGrid, groundAt, terrainOf } from '../src/core/site';
import { applySitePackage, updateSite, type Platspaket } from '../src/core/siteImport';
import { DocStore } from '../src/core/store';
import { registerBuiltInTypes } from '../src/elements';
import { finishedTerrain, groundGeometry, type GroundParams } from '../src/elements/ground';
import { createContext } from '../src/repr/context';
import { buildPlan } from '../src/repr/plan';
import { buildSection } from '../src/repr/section';
import { meanGround } from '../src/repr/terrain';
import { sampleProject } from '../src/sample/sampleProject';
import { GroundTool } from '../src/ui/tools/groundTool';
import { toolHost } from './projekt';

beforeAll(() => registerBuiltInTypes());

/** En plan mark på 65 m (= ±0) med en sluttning: 0,1 m per meter österut från nollpunkten. 100 × 80 m. */
function pkg(): Platspaket {
  const W = 101;
  const H = 81;
  const z = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) z[j * W + i] = 60 + 0.1 * i;
  return {
    format: 'hojdkurvor-plats',
    version: 1,
    projekt: { id: 'p1', namn: 'Provet' },
    koordinatsystem: { plan: { epsg: 3010, namn: 'SWEREF 99 16 30' }, hojd: 'RH 2000', enhet: 'm' },
    utsnitt: { xmin: 1000, ymin: 5000, xmax: 1100, ymax: 5080 },
    nollpunkt: { x: 1050, y: 5040, z: 0 },
    vridning: 0,
    sannNord: 0,
    terrang: { rutnat: { x0: 1000, y1: 5080, s: 1, W, H, z: encodeGrid(z) } },
  };
}

/** Exempelvillan på platsen (±0 = 65 m), med ett markobjekt i förslaget. */
function withGround(params: GroundParams): { store: DocStore; id: string } {
  const store = new DocStore(structuredClone(sampleProject()));
  applySitePackage(store, pkg());
  const [el] = addElements(store, [{ type: 'Ground', storey: store.doc.storeys[0].id, tags: [], params: params as unknown as Record<string, unknown>, props: {}, states: ['st-a'] }], 'st-a', 'Markobjekt');
  return { store, id: el.id };
}

const ctxOf = (store: DocStore, state: string) => createContext(store.doc, store.doc.storeys[0].id, { state }, store.doc.graphics, () => true).ctx;

describe('Markobjekt (0.10.4)', () => {
  it('platån: plan yta, fyll och schakt i slänten 1:2, den befintliga marken orörd', () => {
    const store = new DocStore(structuredClone(sampleProject()));
    applySitePackage(store, pkg());
    const t = terrainOf(store.doc)!;
    const before = Float32Array.from(t.z);
    // Platå på +500 mellan x = 0 och 10 000: marken går där från 0 till +1 000.
    const ring: [number, number][] = [[0, -5000], [10000, -5000], [10000, 5000], [0, 5000]];
    const shape: GroundShape = {
      id: 'p',
      cut: true,
      fill: true,
      slope: 2,
      box: [0, -5000, 10000, 5000],
      hMin: 500,
      hMax: 500,
      probe: (x: number, y: number) => {
        const inside = x >= 0 && x <= 10000 && y >= -5000 && y <= 5000;
        const cx = Math.max(0, Math.min(10000, x));
        const cy = Math.max(-5000, Math.min(5000, y));
        return { inside, d: Math.hypot(x - cx, y - cy), h: 500 };
      },
    };
    void ring;
    const f = finishedGround(t, [shape]);
    const at = (x: number, y: number) => groundAt({ ...t, z: f.z }, x, y)!;
    expect(at(2000, 0)).toBeCloseTo(500, 0);
    expect(at(8000, 0)).toBeCloseTo(500, 0);
    // Väster om platån fylls marken till slänten: 400 mm ut ligger den högst 200 under platån.
    expect(at(-400, 0)).toBeCloseTo(300, 0);
    // Två meter ut ligger den befintliga (−200) inom slänten och är orörd.
    expect(at(-2000, 0)).toBeCloseTo(-200, 0);
    // Öster om platån schaktas den ned: 400 mm ut högst 200 över platån.
    expect(at(10400, 0)).toBeCloseTo(700, 0);
    expect(f.volumes.get('p')!.cut).toBeGreaterThan(10);
    expect(f.volumes.get('p')!.fill).toBeGreaterThan(10);
    expect(t.z).toEqual(before);
  });

  it('gäller bara i förslaget: Befintligt visar den befintliga marken', () => {
    const { store } = withGround({ kind: 'plateau', outline: [[-20000, -5000], [-10000, -5000], [-10000, 5000], [-20000, 5000]], height: 0 });
    expect(finishedTerrain(ctxOf(store, 'st-a'))).not.toBeNull();
    expect(finishedTerrain(ctxOf(store, 'st-bef'))).toBeNull();
  });

  it('platån runt huset följer fasaden med sockeln, och medelmarknivån räknas mot den färdiga marken', () => {
    const { store, id } = withGround({ kind: 'plateau', outline: [], around: true });
    const ctx = ctxOf(store, 'st-a');
    const g = groundGeometry(ctx, store.doc.elements[id])!;
    expect(g.label.height).toBe(-200);
    // Längs fasaden ligger den färdiga marken 200 under golvet.
    expect(meanGround(ctx)).toBeCloseTo(-200, -1);
    expect(meanGround(ctx, true)).not.toBeCloseTo(-200, -1);
    // Med medelmarknivån mot befintlig mark i Platsen.
    updateSite(store, { meanOnExisting: true });
    const ctx2 = ctxOf(store, 'st-a');
    expect(meanGround(ctx2)).toBeCloseTo(meanGround(ctx2, true)!, 3);
  });

  it('urgrävningen under bjälklaget: botten i plattans underkant, och den tar bara ned marken', () => {
    const { store } = withGround({ kind: 'excavation', outline: [], slab: 'bj1' });
    const f = finishedTerrain(ctxOf(store, 'st-a'))!;
    // Mitt i huset: plattan 400 tjock på ±0.
    expect(groundAt(f.terrain, 2000, 2000)).toBeCloseTo(-400, 0);
    expect(f.volumes.values().next().value!.fill).toBe(0);
    expect(f.volumes.values().next().value!.cut).toBeGreaterThan(0);
  });

  it('ritar den färdiga marken tjock i förslagets sektion och höjdkurvor i planen; Befintligt som förut', () => {
    const { store } = withGround({ kind: 'plateau', outline: [], around: true });
    const doc = store.doc;
    const sec = Object.values(doc.elements).find((e) => e.type === 'Section')!;
    const parts = (state: string) => buildSection(doc, sec.id, { state })!.prims.map((p) => p.origin?.part);
    expect(parts('st-a')).toContain('färdig mark');
    expect(parts('st-a')).toContain('befintlig mark');
    expect(parts('st-bef')).not.toContain('färdig mark');
    expect(parts('st-bef')).toContain('befintlig mark');
    const plan = buildPlan(doc, doc.storeys[0].id, { state: 'st-a' });
    expect(plan.prims.some((p) => p.origin?.part === 'färdig mark')).toBe(true);
    // Jord under marklinjen i sektionen, när det valts.
    updateSite(store, { earthHatch: true });
    expect(buildSection(store.doc, sec.id, { state: 'st-a' })!.prims.some((p) => p.origin?.part === 'jord')).toBe(true);
  });

  it('verktyget: platå med höjden ur marken, runt huset en gång, och i förslaget när Befintligt visas', () => {
    const store = new DocStore(structuredClone(sampleProject()));
    applySitePackage(store, pkg());
    const host = toolHost(store);
    host.activeState = () => 'st-bef';
    const tool = new GroundTool(host);
    tool.takePoint([20000, 0]);
    tool.takePoint([24000, 4000]);
    const el = Object.values(store.doc.elements).find((e) => e.type === 'Ground')!;
    expect(el.states).toEqual(['st-a', 'st-b']);
    // Marken i mitten (x = 22 m): +2 200, avrundat till 50.
    expect(el.params.height).toBe(2200);
    tool.aroundHouse();
    tool.aroundHouse();
    expect(Object.values(store.doc.elements).filter((e) => e.type === 'Ground' && e.params.around)).toHaveLength(1);
  });
});

describe('Markobjekt i ordning (0.10.4)', () => {
  it('urgrävningen under bjälklaget räknas före platån runt huset, som fyller igen', () => {
    const { store } = withGround({ kind: 'plateau', outline: [], around: true });
    addElements(store, [{ type: 'Ground', storey: store.doc.storeys[0].id, tags: [], params: { kind: 'excavation', outline: [], slab: 'bj1' }, props: {}, states: ['st-a'] }], 'st-a', 'Urgrävning');
    const ctx = ctxOf(store, 'st-a');
    expect(meanGround(ctx)).toBeCloseTo(-200, -1);
    const f = finishedTerrain(ctx)!;
    const [first] = f.volumes.keys();
    expect(store.doc.elements[first].params.slab).toBe('bj1');
  });
});
