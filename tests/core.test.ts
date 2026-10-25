import { beforeAll, describe, expect, it } from 'vitest';
import { FORMAT_VERSION } from '../src/core/model';
import {
  createDefinition,
  createProposal,
  deleteElements,
  deleteState,
  moveElements,
  moveWallEnd,
  setDefinition,
  setElementInState,
  setInState,
  updateDefinition,
} from '../src/core/commands';
import { actionOf } from '../src/core/states';
import { DocStore } from '../src/core/store';
import { registerBuiltInTypes } from '../src/elements';
import { resolveParams } from '../src/elements/registry';
import { areaOf } from '../src/elements/space';
import { computeWallShapes, type WallParams } from '../src/elements/wall';
import { union } from '../src/geometry/boolean';
import { buildPlan } from '../src/repr/plan';
import type { Solid } from '../src/repr/solids';
import { sampleProject } from '../src/sample/sampleProject';
import { parse, serialize, ProjectFormatError } from '../src/storage/format';
import { snap } from '../src/ui/tools/snap';
import { dxf, shapesProject } from './projekt';

beforeAll(() => registerBuiltInTypes());

describe('åtgärd räknas ut från tillstånd', () => {
  const view = { state: 'a', compareTo: 'bef' };
  it('finns i båda: befintligt', () => expect(actionOf({ states: ['bef', 'a'] }, view)).toBe('existing'));
  it('finns bara i jämförelsen: rivs', () => expect(actionOf({ states: ['bef'] }, view)).toBe('demolished'));
  it('finns bara i förslaget: nytt', () => expect(actionOf({ states: ['a'] }, view)).toBe('new'));
  it('finns i inget av dem: syns inte', () => expect(actionOf({ states: ['b'] }, view)).toBe('absent'));
  it('utan jämförelse: vanlig', () => expect(actionOf({ states: ['a'] }, { state: 'a' })).toBe('plain'));
  it('samma vägg kan rivas i A och stå kvar i B', () => {
    const el = { states: ['bef', 'b'] };
    expect(actionOf(el, { state: 'a', compareTo: 'bef' })).toBe('demolished');
    expect(actionOf(el, { state: 'b', compareTo: 'bef' })).toBe('existing');
  });
});

describe('ångra och gör om', () => {
  it('återställer exakt', () => {
    const store = new DocStore(sampleProject());
    const before = serialize(store.doc);
    setElementInState(store, 'yv-s', 'st-a', false);
    expect(store.doc.elements['yv-s'].states).not.toContain('st-a');
    store.undo();
    expect(serialize(store.doc)).toBe(before);
    store.redo();
    expect(store.doc.elements['yv-s'].states).not.toContain('st-a');
  });

  it('en ny ändring tömmer gör om-listan', () => {
    const store = new DocStore(sampleProject());
    setElementInState(store, 'iv-1', 'st-b', false);
    store.undo();
    expect(store.canRedo).toBe(true);
    setElementInState(store, 'iv-2', 'st-b', false);
    expect(store.canRedo).toBe(false);
  });
});

describe('tillstånd för markerade objekt', () => {
  it('kryssas en vägg ur följer dess dörrar och fönster med', () => {
    const store = new DocStore(sampleProject());
    setInState(store, ['yv-s'], 'st-a', false);
    for (const id of ['d01', 'f01', 'f02']) expect(store.doc.elements[id].states).not.toContain('st-a');
    store.undo();
    expect(store.doc.elements['d01'].states).toContain('st-a');
  });

  it('kryssas en dörr i följer dess vägg med', () => {
    const store = new DocStore(sampleProject());
    setInState(store, ['d06'], 'st-a', true);
    expect(store.doc.elements['iv-3'].states).toContain('st-a');
  });

  it('flera objekt ändras i ett steg', () => {
    const store = new DocStore(sampleProject());
    setInState(store, ['iv-1', 'iv-2'], 'st-b', false);
    expect(store.doc.elements['iv-1'].states).not.toContain('st-b');
    expect(store.doc.elements['iv-2'].states).not.toContain('st-b');
    store.undo();
    expect(store.doc.elements['iv-1'].states).toContain('st-b');
    expect(store.doc.elements['iv-2'].states).toContain('st-b');
  });
});

describe('kommandon', () => {
  it('ta bort en vägg tar bort det som sitter i den', () => {
    const store = new DocStore(sampleProject());
    deleteElements(store, ['iv-1']);
    expect(store.doc.elements['d02']).toBeUndefined();
    expect(store.doc.elements['d03']).toBeUndefined();
  });

  it('nytt förslag kopierar ett annat', () => {
    const store = new DocStore(sampleProject());
    const c = createProposal(store, 'Förslag C', 'st-a');
    const inA = Object.values(store.doc.elements).filter((e) => e.states.includes('st-a')).length;
    const inC = Object.values(store.doc.elements).filter((e) => e.states.includes(c.id)).length;
    expect(inC).toBe(inA);
  });

  it('tas ett tillstånd bort försvinner det som bara fanns där', () => {
    const store = new DocStore(sampleProject());
    deleteState(store, 'st-a');
    expect(store.doc.elements['iv-4']).toBeUndefined();
    expect(store.doc.elements['iv-1']).toBeDefined();
  });

  it('väggände som dras flyttar bara den egna väggen', () => {
    const store = new DocStore(sampleProject());
    moveWallEnd(store, 'yv-s', 'start', [12800, 200]);
    expect((store.doc.elements['yv-s'].params as unknown as WallParams).start).toEqual([12800, 200]);
    expect((store.doc.elements['yv-o'].params as unknown as WallParams).end).toEqual([11800, 200]);
  });

  it('anslutna väggar kan följa med när det begärs', () => {
    const store = new DocStore(sampleProject());
    moveWallEnd(store, 'yv-s', 'start', [12800, 200], { connected: true });
    expect((store.doc.elements['yv-s'].params as unknown as WallParams).start).toEqual([12800, 200]);
    expect((store.doc.elements['yv-o'].params as unknown as WallParams).end).toEqual([12800, 200]);
    expect((store.doc.elements['yv-o'].params as unknown as WallParams).start).toEqual([11800, 7800]);
  });

  it('dörrar och fönster står still när väggen förlängs åt endera hållet', () => {
    const store = new DocStore(sampleProject());
    const at = store.doc.elements['d01'].params.at as number;
    moveWallEnd(store, 'yv-s', 'start', [12800, 200]);
    expect(store.doc.elements['d01'].params.at).toBe(at + 1000);
    moveWallEnd(store, 'yv-s', 'end', [-800, 200]);
    expect(store.doc.elements['d01'].params.at).toBe(at + 1000);
  });

  it('bara de markerade väggarna följer med, även om de blir sneda', () => {
    const store = new DocStore(sampleProject());
    moveWallEnd(store, 'yv-s', 'start', [12500, -300], { connected: ['yv-o'] });
    expect((store.doc.elements['yv-o'].params as unknown as WallParams).end).toEqual([12500, -300]);
    expect((store.doc.elements['yv-o'].params as unknown as WallParams).start).toEqual([11800, 7800]);
    expect((store.doc.elements['yv-n'].params as unknown as WallParams).end).toEqual([11800, 7800]);
  });

  it('flytt av en vägg tar med dess dörrar och fönster', () => {
    const store = new DocStore(sampleProject());
    const before = store.doc.elements['d02'].params.at;
    moveElements(store, ['iv-1', 'm01'], [300, 0]);
    expect((store.doc.elements['iv-1'].params as unknown as WallParams).start).toEqual([5300, 400]);
    expect(store.doc.elements['d02'].params.at).toBe(before);
    expect(store.doc.elements['m01'].params.origin).toEqual([700, 7000]);
    store.undo();
    expect(store.doc.elements['m01'].params.origin).toEqual([400, 7000]);
  });

  it('en dörr som flyttas glider längs sin vägg', () => {
    const store = new DocStore(sampleProject());
    const before = store.doc.elements['d01'].params.at as number;
    moveElements(store, ['d01'], [500, 300]);
    // Ytterväggen i söder är ritad västerut, så läget längs den minskar.
    expect(store.doc.elements['d01'].params.at).toBe(before - 500);
  });
});

describe('typer och littera', () => {
  it('tjockleken kommer från typen', () => {
    const doc = sampleProject();
    expect(resolveParams<WallParams>(doc, doc.elements['iv-1']).thickness).toBe(120);
    expect(resolveParams<WallParams>(doc, doc.elements['yv-s']).thickness).toBe(400);
  });

  it('ändras typen ändras alla väggar av den', () => {
    const store = new DocStore(sampleProject());
    updateDefinition(store, 't-iv01', { params: { thickness: 145 } });
    for (const id of ['iv-1', 'iv-2', 'iv-3', 'iv-4']) {
      expect(resolveParams<WallParams>(store.doc, store.doc.elements[id]).thickness).toBe(145);
    }
  });

  it('ny typ kan ges till markerade väggar', () => {
    const store = new DocStore(sampleProject());
    const def = createDefinition(store, 'Wall', 'IV02', { thickness: 70 }, ['iv-3']);
    expect(resolveParams<WallParams>(store.doc, store.doc.elements['iv-3']).thickness).toBe(70);
    setDefinition(store, ['iv-3'], 't-iv01');
    expect(resolveParams<WallParams>(store.doc, store.doc.elements['iv-3']).thickness).toBe(120);
    expect(store.doc.definitions[def.id].name).toBe('IV02');
  });
});

describe('väggskarvar', () => {
  const w = (id: string, start: [number, number], end: [number, number], thickness = 200): { id: string; p: WallParams } => ({
    id,
    p: { start, end, thickness, height: 2700, justification: 'center' },
  });

  it('L-hörn geras så att ytterhörnet blir skarpt', () => {
    const shapes = computeWallShapes([w('a', [0, 0], [3000, 0]), w('b', [3000, 0], [3000, 2000])], () => []);
    const merged = union([...shapes.get('a')!, ...shapes.get('b')!]);
    expect(merged).toHaveLength(1);
    const pts = merged[0][0];
    // Ytterhörnet ligger i (3100, -100).
    expect(pts.some(([x, y]) => Math.abs(x - 3100) < 0.01 && Math.abs(y + 100) < 0.01)).toBe(true);
    // Innerhörnet i (2900, 100).
    expect(pts.some(([x, y]) => Math.abs(x - 2900) < 0.01 && Math.abs(y - 100) < 0.01)).toBe(true);
  });

  it('T-skarv blir en sammanhängande yta', () => {
    const shapes = computeWallShapes([w('a', [0, 0], [4000, 0]), w('b', [2000, 0], [2000, 3000], 120)], () => []);
    expect(union([...shapes.get('a')!, ...shapes.get('b')!])).toHaveLength(1);
  });

  it('öppningar skärs ut ur sin vägg', () => {
    const shapes = computeWallShapes([w('a', [0, 0], [4000, 0])], () => [{ at: 2000, width: 1000 }]);
    expect(shapes.get('a')).toHaveLength(2);
  });
});

describe('planen', () => {
  it('rivs, befintligt och nytt får stilmallens grafik', () => {
    const { prims } = buildPlan(sampleProject(), 'pl-1', { state: 'st-a', compareTo: 'st-bef' });
    const regions = prims.filter((p) => p.kind === 'region');
    // Svensk standard: befintligt vitt, nytt skrafferat, rivet utan fyllning och streckat.
    expect(regions.some((r) => r.kind === 'region' && r.fill.kind === 'solid' && r.fill.color === 'paper')).toBe(true);
    expect(regions.some((r) => r.kind === 'region' && r.fill.kind === 'hatch')).toBe(true);
    expect(regions.some((r) => r.kind === 'region' && r.fill.kind === 'none' && !!r.outline?.dash)).toBe(true);
  });

  it('befintliga dörrar ritas 30° öppna och nya 90°', () => {
    const { prims } = buildPlan(sampleProject(), 'pl-1', { state: 'st-b', compareTo: 'st-bef' });
    const arc = (id: string) => prims.find((p) => p.kind === 'arc' && p.origin?.objectId === id);
    const span = (id: string) => {
      const a = arc(id);
      if (!a || a.kind !== 'arc') return NaN;
      const t = Math.PI * 2;
      return ((((a.end - a.start) % t) + t) % t) * (180 / Math.PI);
    };
    expect(span('d02')).toBeCloseTo(30); // befintlig
    expect(span('d05')).toBeCloseTo(90); // ny i B
    expect(span('d04')).toBeCloseTo(30); // rivs i B
    // Utan jämförelse beror vinkeln på Befintligt (0.6.2, doorAngleOf nedan).
  });

  it('rum visas bara i sina egna tillstånd', () => {
    const { pickables } = buildPlan(sampleProject(), 'pl-1', { state: 'st-a', compareTo: 'st-bef' });
    const ids = new Set(pickables.map((p) => p.id));
    expect(ids.has('r05')).toBe(true);
    expect(ids.has('r03')).toBe(false);
  });

  it('räknar rumsarea i m²', () => {
    expect(areaOf([[0, 0], [4000, 0], [4000, 3000], [0, 3000]])).toBeCloseTo(12);
  });
});

describe('snäpp', () => {
  const segs = [{ id: 'a', a: [0, 0] as [number, number], b: [4000, 0] as [number, number] }];
  it('ändpunkt går före allt annat', () => {
    const r = snap({ cursor: [30, 20], segments: segs, tol: 50 });
    expect(r.kind).toBe('endpoint');
    expect(r.point).toEqual([0, 0]);
  });
  it('mittpunkt', () => {
    expect(snap({ cursor: [2010, 15], segments: segs, tol: 50 }).kind).toBe('midpoint');
  });
  it('vinkellås drar till jämna 15°', () => {
    const r = snap({ cursor: [3000, 80], from: [0, 2000], segments: [], tol: 50 });
    expect(r.kind).toBe('angle');
  });
  it('vinkelrätt mot en vägg', () => {
    const r = snap({ cursor: [1205, 20], from: [1200, 3000], segments: segs, tol: 50 });
    expect(r.kind).toBe('perpendicular');
    expect(r.point[0]).toBeCloseTo(1200);
  });
});

describe('filformat', () => {
  it('sparar och läser utan förlust, med blad, stämplar, underlag och objektens egna fält', async () => {
    const { addViewport, addScaleBar, createSheet, createStamp, placeStamp, renameProject, setViewportCrop, updateViewport } = await import('../src/core/sheets');
    const { addWithAsset, setLocked, setShowIn, setSkewOk } = await import('../src/core/commands');
    const { applyFieldChanges } = await import('../src/core/sheetFields');
    const { createFolder, createWorksheet, moveIntoFolder } = await import('../src/core/treeCommands');
    const { modelViewId } = await import('../src/core/model');
    // Pennor, egna linjetyper, ritordning och egna pennor (0.8.25–0.8.31).
    const store = new DocStore(shapesProject());
    store.transact('stil', (tx) => tx.setGraphics({ ...tx.doc.graphics, labels: { ...tx.doc.graphics.labels, room: '{nummer}\n{namn}' } }));
    renameProject(store, 'Villa Test');
    applyFieldChanges(store, [], { values: { arkitekt: 'Agrell Arkitektur' } });
    const sheet = createSheet(store, { name: 'Planer', fields: { datum: '2026-10-25' } }, createFolder(store, 'ritningar', 'BYGGLOV'));
    const vp = addViewport(store, sheet, { view: modelViewId('pl-1'), scale: 100, at: [200, 150] })!;
    updateViewport(store, sheet, vp, { hideScale: true, title: 'PLAN 1' });
    setViewportCrop(store, sheet, vp, { minX: 0, minY: 0, maxX: 5000, maxY: 4000 });
    addScaleBar(store, sheet);
    placeStamp(store, sheet, createStamp(store, 'Bygglov'), [100, 50]);
    const ws = createWorksheet(store, 'Detaljer');
    const asset = { id: 'fil-1', name: 'grannhus.dxf', mime: 'application/dxf', data: btoa(dxf('0\nLINE\n8\n0\n10\n0\n20\n0\n11\n1000\n21\n0')) };
    addWithAsset(store, asset, { type: 'Underlay', name: 'Grannhus', storey: 'pl-1', space: ws, tags: [], props: {}, params: { asset: 'fil-1', kind: 'dxf', pos: [0, 0], angle: 0, scale: 1, size: [1000, 1], ref: [0, 0], opacity: 70 } }, 'st-a', 'Lägg in');
    setLocked(store, ['f-egen'], true);
    setShowIn(store, ['f-streck'], { kind: 'tags', tags: ['undertak'], match: 'any' });
    setSkewOk(store, ['iv-1'], true);
    moveIntoFolder(store, [store.doc.views[0].id], createFolder(store, 'vyer', 'Bygglov'));
    const doc = store.doc;
    const types = new Set(Object.values(doc.elements).map((e) => e.type));
    for (const t of ['Shape2D', 'ScaleBar', 'Stamp', 'Underlay']) expect(types, t).toContain(t);
    expect(doc.sheets[0].viewports[0]).toMatchObject({ hideScale: true, crop: { maxX: 5000 } });
    expect(doc.assets['fil-1'] && doc.elements['f-egen'].locked && doc.elements['iv-1'].skewOk && doc.elements['f-streck'].show).toBeTruthy();
    expect(parse(serialize(doc))).toEqual(doc);
  });

  it('en stilmall från fil: det som saknas får förvalet, och en egen linjetyp med en inbyggd nyckel hoppas över', async () => {
    const { DEFAULT_LABELS, normalizeStyle, SWEDISH_STANDARD } = await import('../src/core/graphics');
    const old = JSON.parse(JSON.stringify(SWEDISH_STANDARD));
    delete old.labels.room;
    expect(normalizeStyle(old).labels.room).toBe(DEFAULT_LABELS.room);
    expect(normalizeStyle({ ...SWEDISH_STANDARD, lineTypes: [{ id: 'dashed', name: 'X', dash: [1, 1] }] }).lineTypes).toBeUndefined();
  });

  it('ett projekt i ett äldre format får ett meddelande om alfaversionen (inga migreringar före formatfrysen)', () => {
    for (const v of [1, 5, FORMAT_VERSION - 1]) {
      const old = { ...sampleProject(), formatVersion: v } as any;
      expect(() => parse(JSON.stringify(old))).toThrow(new RegExp(`äldre alfaversion.*format ${v}`));
    }
    expect(parse(serialize(sampleProject())).formatVersion).toBe(FORMAT_VERSION);
  });

  it('behåller element av okända typer', () => {
    const doc = sampleProject();
    (doc.elements as any)['x1'] = { id: 'x1', type: 'Trappa', storey: 'pl-1', states: ['st-bef'], tags: [], params: { steg: 14 }, props: {} };
    const back = parse(serialize(doc));
    expect(back.elements['x1'].params).toEqual({ steg: 14 });
    expect(() => buildPlan(back, 'pl-1', { state: 'st-bef' })).not.toThrow();
  });

  it('säger tydligt ifrån om filen är fel', () => {
    expect(() => parse('{"hej":1}')).toThrow(ProjectFormatError);
    expect(() => parse('inte json')).toThrow(/JSON/);
    expect(() => parse('{"format":"bacchus-project","formatVersion":99}')).toThrow(/nyare version/);
  });
});

describe('3D', () => {
  it('väggar, dörrar och fönster blir 3D-former, rivet syns inte', async () => {
    const { buildModel3d } = await import('../src/repr/model3d');
    const doc = sampleProject();
    const solids = buildModel3d(doc, 'pl-1', { state: 'st-a', compareTo: 'st-bef' });
    const ids = new Set(solids.map((s) => s.id));
    expect(ids.has('iv-4')).toBe(true); // ny vägg i A
    expect(ids.has('iv-3')).toBe(false); // rivs i A
    expect(ids.has('f01')).toBe(true);
    expect(solids.some((s) => s.id === 'iv-4' && s.kind !== 'edges' && s.material === 'wall-new')).toBe(true);
  });

  it('väggen är en hel kropp med öppningarna som urtag', async () => {
    const { buildModel3d } = await import('../src/repr/model3d');
    const shapes = buildModel3d(sampleProject(), 'pl-1', { state: 'st-bef' });
    const south = shapes.filter((s) => s.id === 'yv-s' && s.kind !== 'edges');
    expect(south).toHaveLength(1);
    const cuts = (south[0] as Solid).cuts ?? [];
    // Fönster från bröstningen 900 till 2100, dörren från golvet.
    expect(cuts.some((c) => c.z0 === 900 && c.z1 === 2110)).toBe(true); // hålet är 10 mm större än modulmåttet
    expect(cuts.some((c) => c.z0 === 0)).toBe(true);
  });

  it('ytorna runt ett urtag blir hela, utan dubbla eller saknade ytor', async () => {
    const { solidTriangles } = await import('../src/repr/mesh');
    // Vägg 1000 lång, 100 tjock, 1000 hög, med ett fönster 200 brett från 200 till 800.
    const tris = solidTriangles({
      id: 'w',
      rings: [[[0, 0], [1000, 0], [1000, 100], [0, 100]]],
      z0: 0,
      z1: 1000,
      material: 'wall',
      cuts: [{ rings: [[[400, -1], [600, -1], [600, 101], [400, 101]]], z0: 200, z1: 800 }],
    });
    const area = triArea(tris);
    const faces = 2 * (1000 * 1000 - 200 * 600);
    const ends = 2 * 100 * 1000;
    const caps = 2 * 1000 * 100;
    const reveals = 2 * 100 * 600 + 2 * 200 * 100;
    expect(area).toBeCloseTo(faces + ends + caps + reveals, 0);

    // En dörr från golvet: hål i undersidan i stället för bröstning.
    const door = solidTriangles({
      id: 'w',
      rings: [[[0, 0], [1000, 0], [1000, 100], [0, 100]]],
      z0: 0,
      z1: 1000,
      material: 'wall',
      cuts: [{ rings: [[[400, -1], [600, -1], [600, 101], [400, 101]]], z0: 0, z1: 800 }],
    });
    expect(triArea(door)).toBeCloseTo(2 * (1000 * 1000 - 200 * 800) + ends + 1000 * 100 + 800 * 100 + 2 * 100 * 800 + 200 * 100, 0);
  });
});

function triArea(t: number[]): number {
  let sum = 0;
  for (let i = 0; i < t.length; i += 9) {
    const u = [t[i + 3] - t[i], t[i + 4] - t[i + 1], t[i + 5] - t[i + 2]];
    const v = [t[i + 6] - t[i], t[i + 7] - t[i + 1], t[i + 8] - t[i + 2]];
    sum += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
  }
  return sum;
}

describe('markeringar för öppningar', () => {
  it('igensatt dörr och nya öppningar i befintlig vägg ritas som nytt, utan kontur mot väggen (0.6.2)', () => {
    const { prims } = buildPlan(sampleProject(), 'pl-1', { state: 'st-b', compareTo: 'st-bef' });
    const marks = prims.filter((p) => p.origin?.part === 'markering');
    expect(marks.some((p) => p.origin?.objectId === 'd04')).toBe(true); // igensatt
    expect(marks.filter((p) => p.origin?.objectId === 'd05').length).toBe(2); // två zoner
    expect(marks.every((p) => p.kind === 'region' && p.fill.kind === 'hatch')).toBe(true);
  });
});

describe('nytt projekt', () => {
  it('nybyggnad har bara ett förslag, ombyggnad även befintligt', async () => {
    const { emptyProject } = await import('../src/core/model');
    expect(emptyProject('Hus', 'nybyggnad').states.map((s) => s.kind)).toEqual(['proposal']);
    expect(emptyProject('Hus', 'ombyggnad').states.map((s) => s.kind)).toEqual(['existing', 'proposal']);
  });
});

describe('ut- och insida, karmar och kant i kant', () => {
  it('ytterväggar vet vilken sida som är ute', async () => {
    const { outsideSide, faceOf, justificationFor } = await import('../src/elements/wallSides');
    const doc = sampleProject();
    // yv-s går västerut med insidan (norr) till höger, så vänster sida är ute.
    expect(outsideSide(doc, doc.elements['yv-s'])).toBe(1);
    expect(outsideSide(doc, doc.elements['iv-1'])).toBeNull();
    expect(faceOf(doc, doc.elements['yv-s']).label).toBe('Center');
    const j = justificationFor(doc, doc.elements['yv-s'], 'outside');
    const store = new DocStore(doc);
    store.transact('test', (tx) => tx.putElement({ ...doc.elements['yv-s'], params: { ...doc.elements['yv-s'].params, justification: j } }));
    expect(faceOf(store.doc, store.doc.elements['yv-s']).face).toBe('outside');
  });

  it('karmen sitter 50 mm in från utsidan i yttervägg och i liv på öppningssidan i innervägg', async () => {
    const { createContext } = await import('../src/repr/context');
    const { openingZone } = await import('../src/elements/opening');
    const doc = sampleProject();
    const { ctx } = createContext(doc, 'pl-1', { state: 'st-bef' }, doc.graphics, () => true);
    // Yttervägg 400 tjock med utsidan till vänster (o = 200): karmen 100 djup från o = 150 till 50.
    const ext = openingZone(ctx, doc.elements['yv-s'], ctx.params(doc.elements['f01']));
    expect([ext.lo, ext.hi]).toEqual([50, 150]);
    // Innervägg 120 tjock, dörren slår åt höger (-1): karmen i liv med o = -60.
    const int = openingZone(ctx, doc.elements['iv-1'], ctx.params(doc.elements['d02']));
    expect([int.lo, int.hi]).toEqual([-60, 40]);
  });

  it('skiss ritar inga karmar, normal gör det', () => {
    const karmar = (detail: 'sketch' | 'normal') =>
      buildPlan(sampleProject(), 'pl-1', { state: 'st-bef', detail }).prims.filter((p) => p.origin?.part === 'karm').length;
    expect(karmar('sketch')).toBe(0);
    expect(karmar('normal')).toBeGreaterThan(10);
  });

  it('en glasad dörr får en glasningslinje', () => {
    const { prims } = buildPlan(sampleProject(), 'pl-1', { state: 'st-b' });
    expect(prims.some((p) => p.origin?.objectId === 'd05' && p.origin.part === 'glasning')).toBe(true);
    expect(prims.some((p) => p.origin?.objectId === 'd02' && p.origin.part === 'glasning')).toBe(false);
  });

  it('kant i kant: en möbel nära en vägg läggs an mot den', async () => {
    const { flushSnap } = await import('../src/ui/tools/snap');
    const box: [number, number][] = [
      [0, 0],
      [1000, 0],
      [1000, 500],
      [0, 500],
    ];
    const wall = { id: 'w', a: [-2000, 560] as [number, number], b: [3000, 560] as [number, number] };
    const side = { id: 'v', a: [-40, -2000] as [number, number], b: [-40, 3000] as [number, number] };
    const r = flushSnap([box], [wall, side], [0, 0], 100);
    expect(r?.d[0]).toBeCloseTo(-40);
    expect(r?.d[1]).toBeCloseTo(60);
    expect(flushSnap([box], [wall], [0, -300], 100)).toBeNull();
  });
});

describe('rum och anteckningar', () => {
  it('rummen numreras i vänstervarv från entrén', async () => {
    const { createContext } = await import('../src/repr/context');
    const { roomNumbersFor } = await import('../src/elements/rooms');
    const doc = sampleProject();
    const { ctx } = createContext(doc, 'pl-1', { state: 'st-bef' }, doc.graphics, () => true);
    const n = roomNumbersFor(ctx);
    expect(n.get('r01')).toBe('1101'); // allrummet innanför entrén
    expect(new Set(n.values()).size).toBe(n.size);
    for (const v of n.values()) expect(v).toMatch(/^11\d\d$/);
  });

  it('ett rum med punkt följer väggarna', async () => {
    const { createContext } = await import('../src/repr/context');
    const { spaceOutline } = await import('../src/elements/rooms');
    const store = new DocStore(sampleProject());
    moveElements(store, ['iv-1'], [500, 0]);
    const { ctx } = createContext(store.doc, 'pl-1', { state: 'st-bef' }, store.doc.graphics, () => true);
    const xs = spaceOutline(ctx, store.doc.elements['r01'] as never).map((q) => q[0]);
    expect(Math.max(...xs)).toBe(5440); // innerväggens vänstra liv har flyttat 500 mm
  });

  it('en måttkedja ger ett mått per sträcka', async () => {
    const { dimensionPrims } = await import('../src/elements/annotation');
    const prims = dimensionPrims({ points: [[0, 0], [1200, 0], [3000, 0]], angle: 0, offset: 500 }, 100);
    const texts = prims.filter((p) => p.kind === 'text').map((p) => (p.kind === 'text' ? p.text : ''));
    expect(texts).toEqual(['1200', '1800']);
  });

  it('littera ritas för väggar, dörrar och fönster och kan döljas', () => {
    const tags = (hide?: string[]) =>
      buildPlan(sampleProject(), 'pl-1', { state: 'st-bef', hide }).prims.filter((p) => p.origin?.part === 'littera').length;
    expect(tags()).toBeGreaterThan(10);
    expect(tags(['littera'])).toBe(0);
  });

  it('rivet kan döljas men igensatta dörrhål syns ändå', () => {
    const prims = buildPlan(sampleProject(), 'pl-1', { state: 'st-b', compareTo: 'st-bef', hideDemolished: true }).prims;
    // d04 rivs i B: bara igensättningen finns kvar.
    const d04 = prims.filter((p) => p.origin?.objectId === 'd04');
    expect(d04.length).toBeGreaterThan(0);
    expect(d04.every((p) => p.kind === 'region')).toBe(true);
    // Rivna väggar ritas inte.
    expect(prims.some((p) => p.kind === 'region' && p.styleAs === undefined && !!p.outline?.dash)).toBe(false);
  });
});

describe('version 0.6', () => {
  it('vänd väggen byter insida men flyttar inte väggen', async () => {
    const { flipWalls } = await import('../src/core/commands');
    const store = new DocStore(sampleProject());
    const p0 = store.doc.elements['iv-1'].params as unknown as WallParams;
    const d = store.doc.elements['d02'].params;
    flipWalls(store, ['iv-1']);
    const p1 = store.doc.elements['iv-1'].params as unknown as WallParams;
    expect(p1.start).toEqual(p0.end);
    expect(store.doc.elements['d02'].params.at).toBe(7200 - (d.at as number));
    expect(store.doc.elements['d02'].params.swing).toBe(-(d.swing as number));
  });

  it('kopiera, vrida och spegla', async () => {
    const { copyElements, rotateElements, mirrorElements } = await import('../src/core/transforms');
    const store = new DocStore(sampleProject());
    const [copy] = copyElements(store, ['iv-1']);
    expect(store.doc.elements[copy].type).toBe('Wall');
    // Dörrarna i väggen följde med.
    expect(Object.values(store.doc.elements).filter((e) => e.host === copy).length).toBe(2);
    rotateElements(store, [copy], [5000, 4000]);
    const r = store.doc.elements[copy].params as unknown as WallParams;
    expect(r.start).toEqual([8600, 4000]);
    mirrorElements(store, ['m03'], [3000, 5200]);
    expect(store.doc.elements['m03'].params.origin).toEqual([2880, 4400]);
    expect(store.doc.elements['m03'].params.rotation).toBe(0);
  });

  it('modulmått: hålet är 10 mm större och karmen 10 mm mindre', async () => {
    const { featuresOf } = await import('../src/elements/features');
    const doc = sampleProject();
    const [h1, h2] = featuresOf(doc, doc.elements['d02']);
    expect(Math.abs(h2.a[1] - h1.a[1])).toBe(910);
  });

  it('dörrar får individuella nummer i vänstervarvet och litteramallen styr texten', async () => {
    const { createContext } = await import('../src/repr/context');
    const { doorNumbersFor } = await import('../src/elements/rooms');
    const { litteraLines } = await import('../src/elements/littera');
    const doc = sampleProject();
    const { ctx } = createContext(doc, 'pl-1', { state: 'st-bef', detail: 'detail' }, doc.graphics, () => true);
    expect(doorNumbersFor(ctx).get('d01')).toBe('D1101');
    expect(litteraLines(ctx, doc.elements['d02'])).toEqual([doorNumbersFor(ctx).get('d02'), '910×2110']);
    const normal = createContext(doc, 'pl-1', { state: 'st-bef' }, doc.graphics, () => true).ctx;
    expect(litteraLines(normal, doc.elements['d02'])).toEqual(['D1']);
    expect(buildPlan(doc, 'pl-1', { state: 'st-bef', detail: 'sketch' }).prims.some((p) => p.origin?.part === 'littera')).toBe(false);
  });

  it('egna egenskaper kan visas i littera', async () => {
    const { createContext } = await import('../src/repr/context');
    const { litteraLines } = await import('../src/elements/littera');
    const doc = sampleProject();
    doc.elements['d02'].props = { Egenskaper: { Brandklass: 'EI30' } };
    const { ctx } = createContext(doc, 'pl-1', { state: 'st-bef', detail: 'detail' }, doc.graphics, () => true);
    expect(litteraLines(ctx, doc.elements['d02'])).toContain('EI30');
  });

  it('ett mått knutet till väggar följer med och döljs när väggen inte syns', () => {
    const store = new DocStore(sampleProject());
    store.transact('mått', (tx) =>
      tx.putElement({
        id: 'dm',
        type: 'Dimension',
        storey: 'pl-1',
        states: ['st-bef', 'st-a', 'st-b'],
        tags: [],
        props: {},
        params: {
          points: [
            { at: [400, 2000], refs: [{ id: 'yv-v', kind: 'r' }] },
            { at: [8440, 2000], refs: [{ id: 'iv-3', kind: 'l' }] },
          ],
          angle: 0,
          offset: -500,
        },
      }),
    );
    const texts = (state: string) =>
      buildPlan(store.doc, 'pl-1', { state }).prims.filter((p) => p.origin?.objectId === 'dm' && p.kind === 'text').map((p) => (p.kind === 'text' ? p.text : ''));
    expect(texts('st-bef')).toEqual(['8040']);
    moveElements(store, ['iv-3'], [200, 0]);
    expect(texts('st-bef')).toEqual(['8240']);
    // iv-3 finns inte i förslag A.
    expect(texts('st-a')).toEqual([]);
  });

  it('tillfälliga mått mäter till närmaste parallella vägglivs', async () => {
    const { computeTempDims } = await import('../src/elements/autoDims');
    const doc = sampleProject();
    const walls = Object.values(doc.elements).filter((e) => e.type === 'Wall' && e.id !== 'iv-3' && e.states.includes('st-bef'));
    const dims = computeTempDims(doc.elements['iv-3'], walls, (e) => resolveParams<WallParams>(doc, e));
    expect(dims.map((d) => Math.round(d.value)).sort((a, b) => a - b)).toEqual([3040, 3380]);
  });

  it('nytt i ett förslag måttsätts automatiskt när det är påslaget', () => {
    const auto = (on: boolean) =>
      buildPlan(sampleProject(), 'pl-1', { state: 'st-a', compareTo: 'st-bef', autoDims: on }).prims.filter((p) => p.origin?.part === 'auto').length;
    expect(auto(false)).toBe(0);
    expect(auto(true)).toBeGreaterThan(0);
  });
});

describe('version 0.6.2', () => {
  it('en äldre version skriver inte över ett autospar från en nyare', async () => {
    const { mayOverwrite, recordFormatVersion } = await import('../src/storage/localStore');
    const nu = serialize(sampleProject());
    expect(recordFormatVersion({ text: nu })).toBe(FORMAT_VERSION);
    expect(mayOverwrite({ text: nu }, FORMAT_VERSION)).toBe(true);
    expect(mayOverwrite({ text: nu }, 4)).toBe(false);
    // Autospar från före 0.6.2 har inget formatfält; versionen läses ur texten.
    expect(mayOverwrite({ text: nu.replace(`"formatVersion": ${FORMAT_VERSION}`, `"formatVersion": ${FORMAT_VERSION + 1}`) }, FORMAT_VERSION)).toBe(false);
    expect(mayOverwrite({ text: '{"format":"bacchus-project","formatVersion":5}' }, 3)).toBe(false);
    // Fältet går före texten.
    expect(mayOverwrite({ text: nu, formatVersion: 5 }, 4)).toBe(false);
    expect(mayOverwrite({ text: nu, formatVersion: 2 }, 3)).toBe(true);
    // Format 1 saknade versionsfältet.
    expect(recordFormatVersion({ text: '{"format":"bacchus-project","project":{}}' })).toBe(1);
    // Inget sparat, eller något som inte är ett projekt: får skrivas (det oläsbara läggs undan först).
    expect(mayOverwrite(null, 3)).toBe(true);
    expect(recordFormatVersion({ text: 'trasigt' })).toBeNull();
  });

  it('dörrens vinkel beror på om den finns i Befintligt, inte på jämförelsen', async () => {
    const { createContext } = await import('../src/repr/context');
    const doc = sampleProject();
    const angle = (state: string, compareTo: string | undefined, id: string) =>
      createContext(doc, 'pl-1', { state, compareTo }, doc.graphics, () => true).ctx.doorAngleOf(doc.elements[id]);
    for (const compareTo of ['st-bef', undefined]) {
      // d04 finns i Befintligt: 30° även i förslaget och utan jämförelse.
      expect(angle('st-a', compareTo, 'd04')).toBe(30);
      // d05 finns bara i förslag B: 90°.
      expect(angle('st-b', compareTo, 'd05')).toBe(90);
    }
    expect(angle('st-bef', undefined, 'd01')).toBe(30);
  });

  it('vägglittera har ett enda streck in till väggens mitt', () => {
    const doc = sampleProject();
    const prims = buildPlan(doc, 'pl-1', { state: 'st-bef' }).prims.filter((p) => p.origin?.part === 'littera' && p.origin?.objectType === 'Wall');
    const lines = prims.filter((p) => p.kind === 'line');
    const texts = prims.filter((p) => p.kind === 'text');
    expect(texts.length).toBeGreaterThan(0);
    expect(lines.length).toBe(new Set(texts.map((t) => t.origin?.objectId)).size);
    for (const l of lines) {
      if (l.kind !== 'line') continue;
      const w = resolveParams<WallParams>(doc, doc.elements[l.origin!.objectId!]);
      // Startpunkten ligger på väggens mittlinje.
      const dx = w.end[0] - w.start[0], dy = w.end[1] - w.start[1];
      const len = Math.hypot(dx, dy);
      const shift = w.justification === 'left' ? w.thickness / 2 : w.justification === 'right' ? -w.thickness / 2 : 0;
      const cross = ((l.a[0] - w.start[0]) * -dy + (l.a[1] - w.start[1]) * dx) / len;
      expect(Math.abs(cross - shift)).toBeLessThan(0.01);
    }
  });
});

describe('formler i sifferfält (0.6.3)', () => {
  it('räknar uttryck, relativa värden och enheter', async () => {
    const { evaluate } = await import('../src/ui/expr');
    expect(evaluate('2700')).toBe(2700);
    expect(evaluate('+300', 2700)).toBe(3000);
    expect(evaluate('-50', 2700)).toBe(2650);
    expect(evaluate('*2', 450)).toBe(900);
    expect(evaluate('/2', 900)).toBe(450);
    expect(evaluate('+450', 2100)).toBe(2550);
    expect(evaluate('2400+2*120')).toBe(2640);
    expect(evaluate('(2400+120)/2')).toBe(1260);
    expect(evaluate('2,4m')).toBe(2400);
    expect(evaluate('2m+300')).toBe(2300);
    expect(evaluate('60cm')).toBe(600);
    expect(evaluate('3 620')).toBe(3620);
    expect(evaluate('2,5', null, '')).toBe(2.5);
    expect(evaluate('45+15', null, 'deg')).toBe(60);
    expect(evaluate('90°', null, 'deg')).toBe(90);
    expect(evaluate('3×4')).toBe(12);
    expect(evaluate('12÷4')).toBe(3);
  });
  it('säger ifrån om det inte går', async () => {
    const { evaluate } = await import('../src/ui/expr');
    expect(evaluate('hej')).toBeNull();
    expect(evaluate('2+')).toBeNull();
    expect(evaluate('(2+3')).toBeNull();
    expect(evaluate('5/0')).toBeNull();
    expect(evaluate('2m', null, 'deg')).toBeNull();
    // Ett relativt uttryck utan värde att räkna från blir ett vanligt tal.
    expect(evaluate('+300')).toBe(300);
  });
});

describe('anslutna väggar följer med (0.6.3)', () => {
  const box = () => {
    const doc = sampleProject();
    doc.elements = {};
    const w = (id: string, start: [number, number], end: [number, number]) =>
      (doc.elements[id] = { id, type: 'Wall', storey: 'pl-1', states: ['st-bef'], tags: [], params: { start, end, thickness: 200, height: 2700, justification: 'center' }, props: {} } as any);
    w('s', [0, 0], [6000, 0]);
    w('o', [6000, 0], [6000, 4000]);
    w('n', [6000, 4000], [0, 4000]);
    w('v', [0, 4000], [0, 0]);
    w('t', [3000, 0], [3000, 4000]); // innervägg i T mot syd och norr
    return new DocStore(doc);
  };
  const ends = (store: DocStore, id: string) => {
    const p = store.doc.elements[id].params as any;
    return [p.start, p.end];
  };

  it('hörn och T-anslutningar följer när ytterväggen flyttas utåt', () => {
    const store = box();
    moveElements(store, ['s'], [0, -500]);
    expect(ends(store, 's')).toEqual([[0, -500], [6000, -500]]);
    expect(ends(store, 'o')).toEqual([[6000, -500], [6000, 4000]]);
    expect(ends(store, 'v')).toEqual([[0, 4000], [0, -500]]);
    expect(ends(store, 't')).toEqual([[3000, -500], [3000, 4000]]);
    store.undo();
    expect(ends(store, 'o')).toEqual([[6000, 0], [6000, 4000]]);
  });

  it('en innervägg som flyttas i sidled tar inte med sig ytterväggarna', () => {
    const store = box();
    moveElements(store, ['t'], [400, 0]);
    expect(ends(store, 't')).toEqual([[3400, 0], [3400, 4000]]);
    expect(ends(store, 's')).toEqual([[0, 0], [6000, 0]]);
  });

  it('snett: änden glider längs sin egen vägg och vinkeln står kvar', async () => {
    const { followPoint } = await import('../src/core/commands');
    // Vägg från (0,0) till (1000,1000) mot en vågrät vägg y=1000 som flyttas upp 500.
    expect(followPoint([1000, 1000], [0, 0], { start: [500, 1000], end: [3000, 1000] }, [0, 500])).toEqual([1500, 1500]);
  });

  it('väggar i rak förlängning släpper vid flytt i sidled, och Alt lossar', () => {
    const store = box();
    const doc = store.doc;
    store.transact('x', (tx) =>
      tx.putElement({ ...doc.elements['s'], id: 'f', params: { ...doc.elements['s'].params, start: [6000, 0], end: [8000, 0] } }),
    );
    const r = moveElements(store, ['s'], [0, -500]);
    expect(r.released).toBe(1);
    expect(ends(store, 'f')).toEqual([[6000, 0], [8000, 0]]);
    const store2 = box();
    moveElements(store2, ['s'], [0, -500], 'Flytta', { keepJoins: false });
    expect(ends(store2, 'o')).toEqual([[6000, 0], [6000, 4000]]);
  });
});
