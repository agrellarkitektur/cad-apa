import { beforeAll, describe, expect, it } from 'vitest';
import { FORMAT_VERSION } from '../src/core/model';
import { registerBuiltInTypes } from '../src/elements';
import { computeWallShapes, type WallParams } from '../src/elements/wall';
import { arcFromBulge, bulgeTangent, bulgeThrough } from '../src/geometry/arc';
import { wallFrame } from '../src/geometry/wallFrame';

beforeAll(() => registerBuiltInTypes());

const wall = (start: [number, number], end: [number, number], extra: Partial<WallParams> = {}): WallParams => ({
  start,
  end,
  thickness: 120,
  height: 2700,
  justification: 'center',
  ...extra,
});

describe('sneda T-skarvar (0.7)', () => {
  // En vägg längs x-axeln, och en sned vägg som slutar på dess undersida med
  // referenslinjen i livet (Utsida): båda hörnen ska ligga i livet.
  it('kapas längs livet den möter', () => {
    const host = wall([0, 0], [4000, 0]);
    const tee = wall([1000, -60], [0, -3000], { justification: 'right' });
    const shapes = computeWallShapes(
      [
        { id: 'h', p: host },
        { id: 't', p: tee },
      ],
      () => [],
    );
    const ring = shapes.get('t')![0][0];
    // Punkterna närmast värdväggen.
    const near = [...ring].sort((a, b) => b[1] - a[1]).slice(0, 2);
    for (const q of near) expect(q[1]).toBeCloseTo(-60, 3);
  });
  it('rakt mot väggen blir som förut', () => {
    const shapes = computeWallShapes(
      [
        { id: 'h', p: wall([0, 0], [4000, 0]) },
        { id: 't', p: wall([2000, -60], [2000, -2000]) },
      ],
      () => [],
    );
    const ys = shapes.get('t')![0][0].map((q) => q[1]);
    expect(Math.max(...ys)).toBeCloseTo(-60, 3);
  });
});

describe('bågar (0.7)', () => {
  it('pilhöjd ger rätt radie och vinkel', () => {
    const a = arcFromBulge([0, 0], [2000, 0], 1000)!;
    expect(a.radius).toBeCloseTo(1000, 6);
    expect(a.sweep).toBeCloseTo(Math.PI, 6);
    expect(a.center[0]).toBeCloseTo(1000, 6);
    expect(a.center[1]).toBeCloseTo(0, 6);
  });
  it('båge genom en punkt', () => {
    expect(bulgeThrough([0, 0], [2000, 0], [1000, 400])).toBeCloseTo(400, 6);
    expect(bulgeThrough([0, 0], [2000, 0], [1000, -1000])).toBeCloseTo(-1000, 6);
  });
  it('båge med tangent', () => {
    // Börjar rakt uppåt från (0,0) och slutar i (2000,0): halvcirkel med topp i y=1000.
    expect(bulgeTangent([0, 0], [2000, 0], [0, 1])).toBeCloseTo(1000, 6);
  });
  it('bågväggens ram: punkter, längd och projektion', () => {
    const f = wallFrame(wall([0, 0], [2000, 0], { bulge: 1000 }));
    expect(f.length).toBeCloseTo(Math.PI * 1000, 3);
    const top = f.at(f.length / 2, 0);
    expect(top[0]).toBeCloseTo(1000, 3);
    expect(top[1]).toBeCloseTo(1000, 3);
    // Vänster sida (utåt) har större radie.
    const out = f.at(f.length / 2, 60);
    expect(out[1]).toBeCloseTo(1060, 3);
    const [s, o] = f.project([1000, 1100]);
    expect(s).toBeCloseTo(f.length / 2, 3);
    expect(o).toBeCloseTo(100, 3);
  });
  it('bågväggens yta följer bågen', () => {
    const shapes = computeWallShapes([{ id: 'b', p: wall([0, 0], [2000, 0], { bulge: 1000 }) }], () => []);
    const ring = shapes.get('b')![0][0];
    expect(ring.length).toBeGreaterThan(20);
    for (const q of ring) {
      const r = Math.hypot(q[0] - 1000, q[1]);
      expect(r).toBeGreaterThan(940 - 0.5);
      expect(r).toBeLessThan(1060 + 0.5);
    }
  });
});

describe('format 4 (0.7)', () => {
  it('ett projekt i format 3 får norrpil, fyra fasader och en sektion', async () => {
    const { sampleProject } = await import('../src/sample/sampleProject');
    const { parse } = await import('../src/storage/format');
    const { markerName } = await import('../src/elements/markers');
    const doc = sampleProject();
    const old: any = { ...structuredClone(doc), formatVersion: 3 };
    for (const id of Object.keys(old.elements)) if (['North', 'Elevation', 'Section', 'Roof'].includes(old.elements[id].type)) delete old.elements[id];
    for (const el of Object.values<any>(old.elements)) delete el.params.toRoof;
    const back = parse(JSON.stringify(old));
    expect(back.formatVersion).toBe(FORMAT_VERSION);
    const types = Object.values(back.elements).map((e) => e.type);
    expect(types.filter((t) => t === 'North')).toHaveLength(1);
    expect(types.filter((t) => t === 'Elevation')).toHaveLength(4);
    expect(types.filter((t) => t === 'Section')).toHaveLength(1);
    const names = Object.values(back.elements)
      .filter((e) => e.type === 'Elevation')
      .map((e) => markerName(back, e))
      .sort();
    expect(names).toEqual(['Fasad mot norr', 'Fasad mot ost', 'Fasad mot syd', 'Fasad mot väst']);
    // Väggarna är orörda.
    expect(back.elements['yv-s'].params).toEqual(old.elements['yv-s'].params);
  });
  it('fasaderna får namn efter närmaste väderstreck', async () => {
    const { sampleProject } = await import('../src/sample/sampleProject');
    const { markerName } = await import('../src/elements/markers');
    const doc = sampleProject();
    // Norr 30° medurs från uppåt i planen: det som vetter nedåt har bäringen
    // 150°, närmast sydost.
    doc.elements['north'].params.angle = 60;
    expect(markerName(doc, doc.elements['fasad-1'])).toBe('Fasad mot sydost');
    doc.elements['north'].params.angle = 100;
    expect(markerName(doc, doc.elements['fasad-1'])).toBe('Fasad mot syd');
  });
});

describe('fasader och sektioner (0.7)', () => {
  // Tiden för exemplets fasader mäts i prestanda.test.ts, som körs ensam.
  it('en låda: bara de synliga kanterna, ingen triangeldiagonal', async () => {
    const { visibleSegments, featureEdges } = await import('../src/geometry/hiddenLine');
    const { solidTriangles } = await import('../src/repr/mesh');
    // En kub 1000 mm, sedd rakt framifrån (d = y): framsidans fyra kanter syns,
    // bakre kanter döljs.
    const tris = solidTriangles({ id: 'k', rings: [[[0, 0], [1000, 0], [1000, 1000], [0, 1000]]], z0: 0, z1: 1000, material: 'furniture' });
    const view: number[] = [];
    for (let i = 0; i < tris.length; i += 3) view.push(tris[i], tris[i + 2], tris[i + 1]);
    const edges = featureEdges(view);
    expect(edges).toHaveLength(12);
    const vis = visibleSegments(edges.map(([a, b]) => ({ a, b, key: 1 })), [view]);
    // Fyra synliga (framsidan); kanterna längs djupet blir punkter och försvinner.
    const long = vis.filter((s) => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) > 1);
    // Framsidans och baksidans kanter sammanfaller i bilden; baksidans är dolda.
    expect(long).toHaveLength(4);
  });
  it('en vägg bakom en annan döljs', async () => {
    const { visibleSegments } = await import('../src/geometry/hiddenLine');
    // En kvadrat 0–1000 på djupet 0 (två trianglar) skymmer en linje på djupet 500.
    const tri = [0, 0, 0, 1000, 0, 0, 1000, 1000, 0, 0, 0, 0, 1000, 1000, 0, 0, 1000, 0];
    const vis = visibleSegments([{ a: [-500, 500, 500], b: [1500, 500, 500], key: 1 }], [tri]);
    expect(vis).toHaveLength(2);
    expect(Math.abs(vis[0].b[0])).toBeLessThan(0.1);
    expect(Math.abs(vis[1].a[0] - 1000)).toBeLessThan(0.1);
  });
  it('sektionen skär väggar och tak', async () => {
    const { sampleProject } = await import('../src/sample/sampleProject');
    const { buildSection } = await import('../src/repr/section');
    const doc = sampleProject();
    const r = buildSection(doc, 'sektion-a', { state: 'st-bef' })!;
    const cut = r.prims.filter((p) => p.kind === 'region' && p.origin?.part === 'snitt');
    // Ytterväggarna i söder och norr, innerväggen iv-2 och de två takfallen.
    const ids = new Set(cut.map((p) => p.origin?.objectId));
    expect(cut.length).toBeGreaterThanOrEqual(3);
    expect([...r.pickables.map((p) => p.id)]).toContain('tak');
    expect(ids.size).toBeGreaterThan(0);
    // Taket når nocken: högsta punkten i snittet ligger över väggarna.
    const ys = cut.flatMap((p) => (p.kind === 'region' ? p.rings.flat().map((q) => q[1]) : []));
    expect(Math.max(...ys)).toBeGreaterThan(4000);
  });
  it('gavelväggen går upp till taket', async () => {
    const { sampleProject } = await import('../src/sample/sampleProject');
    const { buildModel3d } = await import('../src/repr/model3d');
    const doc = sampleProject();
    const solids = buildModel3d(doc, 'pl-1', { state: 'st-bef' }).filter((s) => s.kind !== 'edges' && s.id === 'yv-v');
    const top = Math.max(...solids.map((s) => (s.kind === 'edges' ? 0 : s.z1)));
    expect(top).toBeGreaterThan(4000);
    // Långsidan står kvar på sin höjd under taket.
    const south = buildModel3d(doc, 'pl-1', { state: 'st-bef' }).filter((s) => s.kind !== 'edges' && s.id === 'yv-s');
    expect(Math.max(...south.map((s) => (s.kind === 'edges' ? 0 : s.z1)))).toBe(2700);
  });
});

describe('modifiera väggar (0.7)', () => {
  const setup = async () => {
    const { DocStore } = await import('../src/core/store');
    const { emptyProject } = await import('../src/core/model');
    const doc = emptyProject('Test', 'nybyggnad');
    const w = (id: string, start: [number, number], end: [number, number]) => ({
      id,
      type: 'Wall',
      storey: 'pl-1',
      states: ['st-ny'],
      tags: [],
      definition: 't-iv01',
      params: { start, end, height: 2700, justification: 'center' },
      props: {},
    });
    doc.elements.a = w('a', [0, 0], [4000, 0]);
    doc.elements.b = w('b', [4000, 0], [4000, 3000]);
    return new DocStore(doc);
  };
  it('lägg till punkt delar väggen och flyttar punkten', async () => {
    const { splitWall } = await import('../src/core/wallEdit');
    const store = await setup();
    const id = splitWall(store, 'a', [2000, 0], [2000, -500])!;
    expect(store.doc.elements.a.params.end).toEqual([2000, -500]);
    expect(store.doc.elements[id].params.start).toEqual([2000, -500]);
    expect(store.doc.elements[id].params.end).toEqual([4000, 0]);
    store.undo();
    expect(store.doc.elements.a.params.end).toEqual([4000, 0]);
    expect(store.doc.elements[id]).toBeUndefined();
  });
  it('avrunda hörn lägger in en båge som tangerar båda väggarna', async () => {
    const { roundCorner } = await import('../src/core/wallEdit');
    const { wallFrame } = await import('../src/geometry/wallFrame');
    const store = await setup();
    const id = roundCorner(store, 'a', 'end', 1000, 'fillet')!;
    expect(store.doc.elements.a.params.end).toEqual([3000, 0]);
    expect(store.doc.elements.b.params.start).toEqual([4000, 1000]);
    const f = wallFrame({ ...(store.doc.elements[id].params as any), thickness: 120 });
    expect(f.arc!.radius).toBeCloseTo(1000, 0);
    // Tangent i starten: längs x-axeln.
    expect(f.tangent(0)[0]).toBeCloseTo(1, 3);
  });
  it('fasa hörn och ta bort punkt', async () => {
    const { roundCorner, mergeAtCorner } = await import('../src/core/wallEdit');
    const store = await setup();
    roundCorner(store, 'a', 'end', 500, 'chamfer');
    expect(store.doc.elements.a.params.end).toEqual([3500, 0]);
    store.undo();
    mergeAtCorner(store, 'a', 'end');
    expect(store.doc.elements.a.params.end).toEqual([4000, 3000]);
    expect(store.doc.elements.b).toBeUndefined();
  });
  it('förskjut alla kanter flyttar hörnet', async () => {
    const { offsetWalls } = await import('../src/core/wallEdit');
    const store = await setup();
    offsetWalls(store, ['a', 'b'], 200);
    // Utåt från mitten: a nedåt, b åt höger; hörnet hamnar i (4200, −200).
    expect(store.doc.elements.a.params.end).toEqual([4200, -200]);
    expect(store.doc.elements.b.params.start).toEqual([4200, -200]);
  });
  it('kopiera i rad', async () => {
    const { multiplyElements } = await import('../src/core/wallEdit');
    const store = await setup();
    const made = multiplyElements(store, ['a'], [0, 1000], 3);
    expect(made).toHaveLength(3);
    expect(store.doc.elements[made[2]].params.start).toEqual([0, 3000]);
  });
  it('båge med tangent fortsätter i grannväggens riktning', async () => {
    const { tangentArc, continuingTangent } = await import('../src/core/wallEdit');
    const { wallFrame } = await import('../src/geometry/wallFrame');
    const store = await setup();
    // b fortsätter från a:s ände; a:s riktning in i hörnet är +x.
    const t = continuingTangent(store.doc, 'a', 'end');
    expect(t[0]).toBeCloseTo(1, 6);
    tangentArc(store, 'b', 'start', t, [6000, 2000]);
    const f = wallFrame({ ...(store.doc.elements.b.params as any), thickness: 120 });
    expect(f.tangent(0)[0]).toBeCloseTo(1, 3);
    expect(store.doc.elements.b.params.end).toEqual([6000, 2000]);
  });
});

describe('bågvägg med fönster (0.7)', () => {
  it('ritas i plan, 3D och fasad utan fel', async () => {
    const { sampleProject } = await import('../src/sample/sampleProject');
    const { buildPlan } = await import('../src/repr/plan');
    const { buildModel3d } = await import('../src/repr/model3d');
    const { buildSection } = await import('../src/repr/section');
    const doc = sampleProject();
    // Södra ytterväggen blir en båge ut från huset; fönstren sitter kvar i den.
    const p = doc.elements['yv-s'].params as any;
    p.bulge = -1500;
    const plan = buildPlan(doc, 'pl-1', { state: 'st-bef' });
    expect(plan.prims.some((q) => q.kind === 'region' && q.origin?.objectType === 'Wall')).toBe(true);
    const solids = buildModel3d(doc, 'pl-1', { state: 'st-bef' });
    expect(solids.filter((s) => s.id === 'f01').length).toBeGreaterThan(0);
    const r = buildSection(doc, 'fasad-1', { state: 'st-bef' })!;
    expect(r.pickables.some((q) => q.id === 'f01')).toBe(true);
  });
});
