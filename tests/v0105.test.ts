import { beforeAll, describe, expect, it } from 'vitest';
import { addElements, updateParams } from '../src/core/commands';
import { hasEditableOutline } from '../src/core/roofEdit';
import { encodeGrid, groundAt } from '../src/core/site';
import { applySitePackage, type Platspaket } from '../src/core/siteImport';
import { DocStore } from '../src/core/store';
import { mirrorElements } from '../src/core/transforms';
import { registerBuiltInTypes } from '../src/elements';
import { finishedTerrain, groundType, wallCrest, type GroundParams } from '../src/elements/ground';
import { pathWarnings } from '../src/elements/groundLines';
import { shapeOf, shapePatch } from '../src/elements/shapeEdit';
import { GROUND_DEFAULTS } from '../src/core/site';
import { buildingHeight } from '../src/repr/buildingHeight';
import { createContext } from '../src/repr/context';
import { buildSection } from '../src/repr/section';
import { meanGround } from '../src/repr/terrain';
import { sampleProject } from '../src/sample/sampleProject';
import { GroundTool } from '../src/ui/tools/groundTool';
import { toolHost } from './projekt';

beforeAll(() => registerBuiltInTypes());

/** Marken stiger 0,1 m per meter österut; ±0 = 65 m, så marken är x/10 mm i modellen. 100 × 80 m. */
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

function onSite(): DocStore {
  const store = new DocStore(structuredClone(sampleProject()));
  applySitePackage(store, pkg());
  return store;
}

function add(store: DocStore, params: GroundParams): string {
  const [el] = addElements(store, [{ type: 'Ground', storey: store.doc.storeys[0].id, tags: [], params: params as unknown as Record<string, unknown>, props: {}, states: ['st-a'] }], 'st-a', 'Markobjekt');
  return el.id;
}

const ctxOf = (store: DocStore, state = 'st-a') => createContext(store.doc, store.doc.storeys[0].id, { state }, store.doc.graphics, () => true).ctx;
const finished = (store: DocStore) => finishedTerrain(ctxOf(store))!.terrain;

describe('Byggnadshöjd (0.10.5)', () => {
  it('flackt tak: 45°-planet berör takfotens yttre kant, så språnget räknas; långsidan är beräkningsgrundande', () => {
    const store = onSite();
    const ctx = ctxOf(store);
    const bh = buildingHeight(ctx)!;
    // Exempelvillan: 27°, undersidan 2 700 i ytterlivet, 300 tjockt, 500 språng.
    // Ovansidan vid takfotens kant: 2 700 + 300/cos 27° − 500 · tan 27° = 2 782; plus språnget 500.
    expect(bh.main.z).toBeCloseTo(3282, 0);
    expect(Math.hypot(bh.main.b[0] - bh.main.a[0], bh.main.b[1] - bh.main.a[1])).toBe(12000);
    // Gaveln skulle ge nockens höjd plus språnget.
    expect(Math.max(...bh.facades.map((f) => f.z))).toBeCloseTo(5575, 0);
    expect(bh.height).toBeCloseTo(bh.main.z - meanGround(ctx)!, 3);
  });

  it('brant tak: planet berör nocken; BH står bland nivåerna i fasaden', () => {
    const store = onSite();
    const roofs = Object.values(store.doc.elements).filter((e) => e.type === 'Roof');
    updateParams(
      store,
      roofs.map((r) => r.id),
      { slope: 60 },
      'Brant',
    );
    const bh = buildingHeight(ctxOf(store))!;
    // Nocken mitt i huset (4 000 in): 2 700 + 300/cos 60° + 4 000 · tan 60° − 4 000.
    expect(bh.main.z).toBeCloseTo(2700 + 600 + 4000 * Math.tan(Math.PI / 3) - 4000, 0);
    const fasad = Object.values(store.doc.elements).find((e) => e.type === 'Elevation')!;
    const texts = buildSection(store.doc, fasad.id, { state: 'st-a' })!.prims.flatMap((p) => (p.kind === 'text' ? [p.text] : []));
    expect(texts.some((t) => t.startsWith('BH +'))).toBe(true);
  });
});

describe('Ramp, gångväg och infart (0.10.5)', () => {
  it('rampen: höjden längs mittlinjen, slänt på sidorna, orörd mark utanför', () => {
    const store = onSite();
    add(store, { kind: 'path', path: 'ramp', outline: [], line: [[20000, 0], [26000, 0]], height: 2000, endHeight: 2500 });
    const t = finished(store);
    expect(groundAt(t, 23000, 0)).toBeCloseTo(2250, 0);
    expect(groundAt(t, 20000, 0)).toBeCloseTo(2000, 0);
    // Tre meter ut ligger den befintliga (+2 300) inom slänten 1:2 från kanten och är orörd.
    expect(groundAt(t, 23000, 3000)).toBeCloseTo(2300, 0);
  });

  it('varnar för en ramp brantare än 1:12 och utan vilplan över 0,5 m, men inte för en infart', () => {
    const line: [number, number][] = [[0, 0], [6000, 0]];
    expect(pathWarnings('ramp', line, 0, 500, GROUND_DEFAULTS)).toEqual([]);
    expect(pathWarnings('ramp', line, 0, 600, GROUND_DEFAULTS)).toHaveLength(2);
    expect(pathWarnings('walk', line, 0, 400, GROUND_DEFAULTS)).toHaveLength(1);
    expect(pathWarnings('drive', line, 0, 900, GROUND_DEFAULTS)).toEqual([]);
  });

  it('infarten har tvärfall: förvalet 1:50 faller åt höger, och speglad åt vänster', () => {
    const store = onSite();
    const id = add(store, { kind: 'path', path: 'drive', outline: [], line: [[20000, 0], [30000, 0]], height: 2500, endHeight: 2500, crossFall: 50 });
    const t = finished(store);
    // Tre meter bred: en meter åt vänster (y = +1 000) 40 mm högre än en meter åt höger.
    expect(groundAt(t, 25000, 1000)! - groundAt(t, 25000, -1000)!).toBeCloseTo(40, 0);
    mirrorElements(store, [id], [25000, 0]);
    expect(store.doc.elements[id].params.crossFall).toBe(-50);
  });

  it('mittlinjen ändras som en öppen 2D-form, inte som en kontur', () => {
    const store = onSite();
    const id = add(store, { kind: 'path', path: 'walk', outline: [], line: [[0, 20000], [5000, 20000]], height: 0 });
    const el = store.doc.elements[id];
    expect(hasEditableOutline(el)).toBe(false);
    expect(shapeOf(el)?.params.closed).toBe(false);
    expect(shapePatch(store.doc, id, undefined, { points: [[0, 20000], [6000, 20000]] })).toEqual({ line: [[0, 20000], [6000, 20000]] });
  });

  it('verktyget: en ramp med höjderna ur marken i ändarna, avslutad med Enter', () => {
    const store = onSite();
    const tool = new GroundTool(toolHost(store));
    tool.options.mode = 'ramp';
    tool.takePoint([20000, 10000]);
    tool.takePoint([26000, 10000]);
    expect(tool.started).toBe(true);
    tool.finish();
    const el = Object.values(store.doc.elements).find((e) => e.type === 'Ground')!;
    expect(el.params).toMatchObject({ kind: 'path', path: 'ramp', height: 2000, endHeight: 2600 });
  });
});

describe('Höjdpunkt, brytlinje och stödmur (0.10.5)', () => {
  it('brytlinjen låser marken och tonar den mjukt inom radien', () => {
    const store = onSite();
    add(store, { kind: 'breakline', outline: [], line: [[-20000, -10000], [-20000, 10000]], height: 0, endHeight: 0 });
    const t = finished(store);
    expect(groundAt(t, -20000, 0)).toBeCloseTo(0, 0);
    // Tre meter bort (av fem): vikten 1 − (3f² − 2f³) med f = 0,6 är 0,352.
    expect(groundAt(t, -17000, 0)).toBeCloseTo(-1700 * (1 - 0.352), 0);
    // Utanför radien orörd.
    expect(groundAt(t, -14000, 0)).toBeCloseTo(-1400, 0);
  });

  it('höjdpunkten låser marken i punkten', () => {
    const store = onSite();
    add(store, { kind: 'point', outline: [], line: [[-25000, 20000]], height: 500, radius: 3000 });
    expect(groundAt(finished(store), -25000, 20000)).toBeCloseTo(500, 0);
  });

  it('stödmuren stoppar slänten: marken bakom är orörd, och krönet följer den högre sidan', () => {
    const store = onSite();
    add(store, { kind: 'plateau', outline: [[20000, -5000], [30000, -5000], [30000, 5000], [20000, 5000]], height: 3000 });
    // Utan mur fylls marken väster om platån till slänten.
    expect(groundAt(finished(store), 19000, 0)).toBeCloseTo(2500, 0);
    const wall = add(store, { kind: 'wall', outline: [], line: [[20000, -6000], [20000, 6000]] });
    expect(groundAt(finished(store), 19000, 0)).toBeCloseTo(1900, 0);
    const ctx = ctxOf(store);
    const c = wallCrest(ctx, store.doc.elements[wall])!;
    expect(c.top).toBeCloseTo(3000, 0);
    const solids = groundType.model3d!(store.doc.elements[wall] as never, ctx);
    expect(solids).toHaveLength(1);
  });
});
