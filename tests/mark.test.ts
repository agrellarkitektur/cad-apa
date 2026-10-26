import { beforeAll, describe, expect, it } from 'vitest';
import { moveElements, updateParams } from '../src/core/commands';
import { finishedGround, type GroundShape } from '../src/core/ground';
import { hasEditableOutline } from '../src/core/roofEdit';
import { GROUND_DEFAULTS, groundAt, terrainOf } from '../src/core/site';
import { updateSite } from '../src/core/siteImport';
import { DocStore } from '../src/core/store';
import { mirrorElements } from '../src/core/transforms';
import { registerBuiltInTypes } from '../src/elements';
import { finishedTerrain, groundGeometry, groundObjects, groundType, wallCrest } from '../src/elements/ground';
import { centerShift, pathWarnings } from '../src/elements/groundLines';
import { allowsArcs, shapeCan, shapeOf, shapePatch } from '../src/elements/shapeEdit';
import { buildingHeight } from '../src/repr/buildingHeight';
import { buildSection } from '../src/repr/section';
import { meanGround, terrainMesh } from '../src/repr/terrain';
import { GroundTool } from '../src/ui/tools/groundTool';
import { addGround, groundProject, onSlope, planCtx, toolHost } from './projekt';

/**
 * Markobjekten (0.10.4–0.10.5, samlade i 0.10.6). Exempelvillan på den sneda
 * marken (`onSlope`): ±0 = 65 m och marken x/10 mm i modellen. Ritningarna
 * av alla sorter på en kuperad plats står i referensritningarna (`mark-*`).
 */

beforeAll(() => registerBuiltInTypes());

const finished = (store: DocStore) => finishedTerrain(planCtx(store))!.terrain;

describe('Markobjekt (0.10.4)', () => {
  it('platån: plan yta, fyll och schakt i slänten 1:2, den befintliga marken orörd', () => {
    const store = onSlope();
    const t = terrainOf(store.doc)!;
    const before = Float32Array.from(t.z);
    // Platå på +500 mellan x = 0 och 10 000: marken går där från 0 till +1 000.
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

  it('markytan (0.10.7): schakt där marken ligger högre, fyll där den ligger lägre, i samma objekt', () => {
    const store = onSlope();
    // Mitt i slänten: marken går från +2 000 till +3 000 under ytan på +2 500.
    const id = addGround(store, { kind: 'area', outline: [[20000, -5000], [30000, -5000], [30000, 5000], [20000, 5000]], height: 2500 });
    const f = finishedTerrain(planCtx(store))!;
    expect(groundAt(f.terrain, 21000, 0)).toBeCloseTo(2500, 0);
    expect(groundAt(f.terrain, 29000, 0)).toBeCloseTo(2500, 0);
    expect(f.volumes.get(id)!.cut).toBeGreaterThan(10);
    expect(f.volumes.get(id)!.fill).toBeGreaterThan(10);
  });

  it('gäller bara i förslaget: Befintligt visar den befintliga marken, också i sektionen', () => {
    const store = onSlope();
    addGround(store, { kind: 'area', outline: [[-20000, -5000], [-10000, -5000], [-10000, 5000], [-20000, 5000]], height: 0 });
    expect(finishedTerrain(planCtx(store))).not.toBeNull();
    expect(finishedTerrain(planCtx(store, 'st-bef'))).toBeNull();
    const parts = buildSection(store.doc, 'sektion-a', { state: 'st-bef' })!.prims.map((p) => p.origin?.part);
    expect(parts).not.toContain('färdig mark');
    expect(parts).toContain('befintlig mark');
  });

  it('platån runt huset följer fasaden med sockeln, och medelmarknivån räknas mot den färdiga marken', () => {
    const store = onSlope();
    const id = addGround(store, { kind: 'area', outline: [], around: true });
    const ctx = planCtx(store);
    const g = groundGeometry(ctx, store.doc.elements[id])!;
    expect(g.label.height).toBe(-200);
    // Längs fasaden ligger den färdiga marken 200 under golvet.
    expect(meanGround(ctx)).toBeCloseTo(-200, -1);
    expect(meanGround(ctx, true)).not.toBeCloseTo(-200, -1);
    // Med medelmarknivån mot befintlig mark i Platsen.
    updateSite(store, { meanOnExisting: true });
    const ctx2 = planCtx(store);
    expect(meanGround(ctx2)).toBeCloseTo(meanGround(ctx2, true)!, 3);
  });

  it('urgrävningen under bjälklaget: botten i plattans underkant, tar bara ned marken och räknas före platån runt huset', () => {
    const store = onSlope();
    addGround(store, { kind: 'area', outline: [], around: true });
    addGround(store, { kind: 'area', outline: [], slab: 'bj1' });
    const ctx = planCtx(store);
    const f = finishedTerrain(ctx)!;
    const [first, around] = f.volumes.keys();
    expect(store.doc.elements[first].params.slab).toBe('bj1');
    expect(f.volumes.get(first)!.fill).toBe(0);
    expect(f.volumes.get(first)!.cut).toBeGreaterThan(0);
    // Platån runt huset fyller igen vid fasaden, men inte under huset: mitt i huset botten, plattan 400 tjock på ±0.
    expect(store.doc.elements[around].params.around).toBe(true);
    expect(groundAt(f.terrain, 2000, 2000)).toBeCloseTo(-400, 0);
    expect(meanGround(ctx)).toBeCloseTo(-200, -1);
  });

  it('verktyget: platå med höjden ur marken, runt huset en gång, och i förslaget när Befintligt visas', () => {
    const store = onSlope();
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

describe('Byggnadshöjd (0.10.5)', () => {
  it('flackt tak: 45°-planet berör takfotens yttre kant, så språnget räknas; långsidan är beräkningsgrundande', () => {
    const ctx = planCtx(onSlope());
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
    const store = onSlope();
    const roofs = Object.values(store.doc.elements).filter((e) => e.type === 'Roof');
    updateParams(
      store,
      roofs.map((r) => r.id),
      { slope: 60 },
      'Brant',
    );
    const bh = buildingHeight(planCtx(store))!;
    // Nocken mitt i huset (4 000 in): 2 700 + 300/cos 60° + 4 000 · tan 60° − 4 000.
    expect(bh.main.z).toBeCloseTo(2700 + 600 + 4000 * Math.tan(Math.PI / 3) - 4000, 0);
    const texts = buildSection(store.doc, 'fasad-1', { state: 'st-a' })!.prims.flatMap((p) => (p.kind === 'text' ? [p.text] : []));
    expect(texts.some((t) => t.startsWith('BH +'))).toBe(true);
  });
});

describe('Ramp/väg (0.10.5, en sort sedan 0.10.7)', () => {
  it('rampen: höjden längs mittlinjen, slänt på sidorna, orörd mark utanför', () => {
    const store = onSlope();
    addGround(store, { kind: 'path', outline: [], line: [[20000, 0], [26000, 0]], height: 2000, endHeight: 2500 });
    const t = finished(store);
    expect(groundAt(t, 23000, 0)).toBeCloseTo(2250, 0);
    expect(groundAt(t, 20000, 0)).toBeCloseTo(2000, 0);
    // Tre meter ut ligger den befintliga (+2 300) inom slänten 1:2 från kanten och är orörd.
    expect(groundAt(t, 23000, 3000)).toBeCloseTo(2300, 0);
  });

  it('varnar brantare än gränsen (förval 1:12), och utan vilplan över 0,5 m när den är brantare än 1:20', () => {
    const line: [number, number][] = [[0, 0], [6000, 0]];
    expect(pathWarnings(line, 0, 500, 12, GROUND_DEFAULTS)).toEqual([]);
    expect(pathWarnings(line, 0, 600, 12, GROUND_DEFAULTS)).toHaveLength(2);
    expect(pathWarnings(line, 0, 400, 20, GROUND_DEFAULTS)).toHaveLength(1);
    // Flackare än 1:20 behövs inget vilplan, hur hög den än är.
    expect(pathWarnings([[0, 0], [30000, 0]], 0, 1200, 12, GROUND_DEFAULTS)).toEqual([]);
  });

  it('tvärfallet faller åt höger, och speglat åt vänster', () => {
    const store = onSlope();
    const id = addGround(store, { kind: 'path', outline: [], line: [[20000, 0], [30000, 0]], width: 3000, height: 2500, endHeight: 2500, crossFall: 50 });
    const t = finished(store);
    // Tre meter bred: en meter åt vänster (y = +1 000) 40 mm högre än en meter åt höger.
    expect(groundAt(t, 25000, 1000)! - groundAt(t, 25000, -1000)!).toBeCloseTo(40, 0);
    mirrorElements(store, [id], [25000, 0]);
    expect(store.doc.elements[id].params.crossFall).toBe(-50);
  });

  it('referenslinjen ändras som en öppen 2D-form utan bågar, och flyttas med objektet', () => {
    const store = onSlope();
    const id = addGround(store, { kind: 'path', outline: [], line: [[0, 20000], [5000, 20000]], height: 0 });
    const el = store.doc.elements[id];
    expect(hasEditableOutline(el)).toBe(false);
    expect(shapeOf(el)?.params.closed).toBe(false);
    expect(allowsArcs(shapeOf(el)!)).toBe(false);
    expect(shapeCan(shapeOf(el)!).bend).toBe(false);
    expect(shapePatch(store.doc, id, undefined, { points: [[0, 20000], [6000, 20000]] })).toEqual({ line: [[0, 20000], [6000, 20000]] });
    // Höjdpunkten och linjerna följde inte med när de flyttades (före 0.10.7).
    moveElements(store, [id], [1000, -500]);
    expect(store.doc.elements[id].params.line).toEqual([[1000, 19500], [6000, 19500]]);
  });

  it('referenslinjen på en kant: vägen ligger på andra sidan, och förskjutningen flyttar den mot mitten', () => {
    // Längs x: vänster är +y. Med linjen på vänster kant ligger vägen åt höger (−y).
    expect(centerShift('left', undefined, 2000)).toBe(-1000);
    expect(centerShift('right', undefined, 2000)).toBe(1000);
    // 100 mm närmare mitten: linjen ligger 100 innanför kanten.
    expect(centerShift('left', -100, 2000)).toBe(-900);
    expect(centerShift(undefined, 300, 2000)).toBe(-300);
    const store = onSlope();
    const id = addGround(store, { kind: 'path', outline: [], line: [[20000, 0], [26000, 0]], width: 2000, refSide: 'left', height: 2000, endHeight: 2000 });
    const g = groundGeometry(planCtx(store), store.doc.elements[id])!;
    expect(g.center).toEqual([[20000, -1000], [26000, -1000]]);
    const ys = g.rings[0][0].map((q) => q[1]);
    expect(Math.min(...ys)).toBeCloseTo(-2000, 6);
    expect(Math.max(...ys)).toBeCloseTo(0, 6);
  });

  it('tvärlinjerna i ändarna kan slås av, och fyllningen ritas bakom väggarna', () => {
    const store = onSlope();
    const id = addGround(store, { kind: 'path', outline: [], line: [[20000, 0], [26000, 0]], height: 2000, endHeight: 2000, fill: 'hatch' });
    const parts = (over: Record<string, unknown> = {}) => {
      updateParams(store, [id], over, 'Prov');
      return groundType.plan!(store.doc.elements[id] as never, planCtx(store)).map((q) => q.origin?.part);
    };
    expect(parts()).toEqual(expect.arrayContaining(['fyllning', 'kant', 'början', 'slutet']));
    const off = parts({ startLine: false, endLine: false });
    expect(off).not.toContain('början');
    expect(off).not.toContain('slutet');
  });

  it('verktyget: en ramp/väg med höjderna ur marken i ändarna, avslutad med Enter', () => {
    const store = onSlope();
    const tool = new GroundTool(toolHost(store));
    tool.options.mode = 'path';
    tool.takePoint([20000, 10000]);
    tool.takePoint([26000, 10000]);
    expect(tool.started).toBe(true);
    tool.finish();
    const el = Object.values(store.doc.elements).find((e) => e.type === 'Ground')!;
    expect(el.params).toMatchObject({ kind: 'path', height: 2000, endHeight: 2600 });
  });
});

describe('Höjdpunkt, brytlinje och stödmur (0.10.5)', () => {
  it('brytlinjen låser marken och tonar den mjukt inom radien', () => {
    const store = onSlope();
    addGround(store, { kind: 'breakline', outline: [], line: [[-20000, -10000], [-20000, 10000]], height: 0, endHeight: 0 });
    const t = finished(store);
    expect(groundAt(t, -20000, 0)).toBeCloseTo(0, 0);
    // Tre meter bort (av fem): vikten 1 − (3f² − 2f³) med f = 0,6 är 0,352.
    expect(groundAt(t, -17000, 0)).toBeCloseTo(-1700 * (1 - 0.352), 0);
    // Utanför radien orörd.
    expect(groundAt(t, -14000, 0)).toBeCloseTo(-1400, 0);
  });

  it('höjdpunkten låser marken i punkten', () => {
    const store = onSlope();
    addGround(store, { kind: 'point', outline: [], line: [[-25000, 20000]], height: 500, radius: 3000 });
    expect(groundAt(finished(store), -25000, 20000)).toBeCloseTo(500, 0);
  });

  it('stödmuren stoppar slänten: marken bakom är orörd, och krönet följer den högre sidan', () => {
    const store = onSlope();
    addGround(store, { kind: 'area', outline: [[20000, -5000], [30000, -5000], [30000, 5000], [20000, 5000]], height: 3000 });
    // Utan mur fylls marken väster om platån till slänten.
    expect(groundAt(finished(store), 19000, 0)).toBeCloseTo(2500, 0);
    const wall = addGround(store, { kind: 'wall', outline: [], line: [[20000, -6000], [20000, 6000]] });
    expect(groundAt(finished(store), 19000, 0)).toBeCloseTo(1900, 0);
    const ctx = planCtx(store);
    expect(wallCrest(ctx, store.doc.elements[wall])!.top).toBeCloseTo(3000, 0);
    expect(groundType.model3d!(store.doc.elements[wall] as never, ctx)).toHaveLength(1);
  });
});

describe('Den färdiga marken räknas om bara när den ändras (0.10.6)', () => {
  it('inte för en innervägg, en väggs penna, kurvavståndet eller jorden i sektionerna', () => {
    const store = new DocStore(groundProject());
    const f = finishedTerrain(planCtx(store));
    updateParams(store, ['iv-1'], { height: 2500 }, 'Innerväggen');
    store.transact('Penna', (tx) => tx.putElement({ ...tx.doc.elements['yv-s'], pen: { weight: 0.7 } }));
    updateSite(store, { contours: 250, earthHatch: undefined });
    expect(finishedTerrain(planCtx(store))).toBe(f);
    // En yttervägg som flyttas ändrar husets kontur, och marken runt det.
    updateParams(store, ['yv-s'], { start: [200, -300], end: [11800, -300] }, 'Ytterväggen');
    expect(finishedTerrain(planCtx(store))).not.toBe(f);
  });

  it('ett ändrat objekt räknas från sig självt, med samma svar som från början', () => {
    const store = new DocStore(groundProject());
    const before = finishedTerrain(planCtx(store))!;
    updateParams(store, ['m-bryt'], { height: -1500 }, 'Brytlinjen');
    const ctx = planCtx(store);
    const after = finishedTerrain(ctx)!;
    const geoms = groundObjects(ctx).map((e) => groundGeometry(ctx, e));
    const fresh = finishedGround(terrainOf(store.doc)!, geoms.flatMap((g) => (g?.shape ? [g.shape] : [])), geoms.flatMap((g) => g?.barriers ?? []));
    // Objekten före brytlinjen är desamma och räknas inte om.
    const i = after.steps.findIndex((s) => s.shape.id === 'm-bryt');
    expect(after.steps.slice(0, i)).toEqual(before.steps.slice(0, i));
    expect(after.steps[0]).toBe(before.steps[0]);
    expect(after.z).toEqual(fresh.z);
    expect([...after.volumes]).toEqual([...fresh.volumes]);
    expect([after.min, after.max, after.changed]).toEqual([fresh.min, fresh.max, fresh.changed]);
  });

  it('3D-nätet för den färdiga marken har samma punkter och trianglar som den befintligas, med de nya höjderna', () => {
    const store = new DocStore(groundProject());
    const existing = terrainMesh(store.doc)!;
    const f = finishedTerrain(planCtx(store))!;
    const mesh = terrainMesh(store.doc, undefined, f.z)!;
    expect(mesh.indices).toBe(existing.indices);
    expect(mesh.positions.filter((_, i) => i % 3 !== 2)).toEqual(existing.positions.filter((_, i) => i % 3 !== 2));
    expect(mesh.positions).not.toEqual(existing.positions);
  });
});
