import { beforeAll, describe, expect, it } from 'vitest';
import { emptyProject } from '../src/core/model';
import { contours, encodeGrid, groundAt, localToZone, meanGroundLevel, northOf, terrainOf, zoneToLocal } from '../src/core/site';
import { applySitePackage, cropSite, parseSitePackage, removeSite, SitePackageError, updateSite, type Platspaket } from '../src/core/siteImport';
import { DocStore } from '../src/core/store';
import { registerBuiltInTypes } from '../src/elements';
import { buildSection } from '../src/repr/section';
import { markerFrame } from '../src/elements/markers';
import { parse, serialize } from '../src/storage/format';
import { sampleProject } from '../src/sample/sampleProject';

beforeAll(() => registerBuiltInTypes());

/** Ett platspaket med en sned mark: 60 m i väster, stiger 0,1 m per meter österut. 100 × 80 m, 1 m mellan noderna. */
function pkg(over: Partial<Platspaket> = {}): Platspaket {
  const W = 101;
  const H = 81;
  const z = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) z[j * W + i] = 60 + 0.1 * i;
  return {
    format: 'hojdkurvor-plats',
    version: 1,
    projekt: { id: 'p1', namn: 'Provet', kommun: 'Nybro kommun' },
    koordinatsystem: { plan: { epsg: 3010, namn: 'SWEREF 99 16 30' }, hojd: 'RH 2000', enhet: 'm' },
    utsnitt: { xmin: 1000, ymin: 5000, xmax: 1100, ymax: 5080 },
    nollpunkt: { x: 1050, y: 5040, z: 0 },
    vridning: 0,
    sannNord: -0.4,
    terrang: { rutnat: { x0: 1000, y1: 5080, s: 1, W, H, z: encodeGrid(z) } },
    trad: [{ x: 1060, y: 5050, mark: 61, hojd: 12, krona: 6 }],
    byggnader: [{ fotavtryck: [[1070, 5060], [1080, 5060], [1080, 5070], [1070, 5070]], mark: 62, hojd: 7, typ: 'Bostad', husnummer: '2' }],
    fastigheter: { granser: [{ pts: [[1000, 5000], [1100, 5080]], osakerhet: 0.25 }], ytor: [{ etikett: '1:2', ankare: [1020, 5020] }], varning: 'Inte bindande.' },
    licens: '© Lantmäteriet',
    ...over,
  };
}

describe('platsen (0.10.3)', () => {
  it('räknar mellan zonens koordinater och modellen åt båda hållen, med vridning', () => {
    const site = { origin: [1050, 5040] as [number, number], rotation: 30 };
    const [x, y] = zoneToLocal(site, 1060, 5045);
    const [X, Y] = localToZone(site, x, y);
    expect(X).toBeCloseTo(1060, 6);
    expect(Y).toBeCloseTo(5045, 6);
    // Zonens x-riktning (cos v, sin v) är modellens x-axel.
    const along = zoneToLocal(site, 1050 + Math.cos(Math.PI / 6), 5040 + Math.sin(Math.PI / 6));
    expect(along[0]).toBeCloseTo(1000, 3);
    expect(along[1]).toBeCloseTo(0, 3);
    expect(northOf({ rotation: 0, trueNorth: -0.4 })).toBeCloseTo(89.6, 6);
  });

  it('lägger in platsen med marken, grannhus, träd, gränser och norrpilen', () => {
    const store = new DocStore(emptyProject('x', 'nybyggnad'));
    applySitePackage(store, parseSitePackage(JSON.stringify(pkg())));
    const doc = store.doc;
    expect(doc.site?.crs.epsg).toBe(3010);
    // ±0 är markens höjd mitt i utsnittet, avrundad till decimeter: 60 + 0,1 · 50.
    expect(doc.site?.datum).toBe(65);
    const types = Object.values(doc.elements).map((e) => e.type);
    expect(types.filter((t) => t === 'Terrain')).toHaveLength(1);
    expect(types).toContain('Tree');
    expect(types).toContain('SiteBuilding');
    expect(types.filter((t) => t === 'SiteMap')).toHaveLength(2);
    expect(Object.values(doc.elements).filter((e) => e.type === 'Tree').every((e) => e.locked)).toBe(true);
    expect(Object.values(doc.elements).find((e) => e.type === 'North')?.params.angle).toBeCloseTo(89.6, 6);
    // Marken i nollpunkten: 60 + 0,1 · 50 = 65 m = ±0; tio meter österut 1 m högre.
    const t = terrainOf(doc)!;
    expect(groundAt(t, 0, 0)).toBeCloseTo(0, 3);
    expect(groundAt(t, 10000, 0)).toBeCloseTo(1000, 3);
    expect(groundAt(t, 99000, 0)).toBeNull();
    // Rutnätet ligger i en fil, och projektet går att spara och läsa.
    expect(doc.assets[doc.site!.grid!.asset].data.length).toBeGreaterThan(1000);
    expect(parse(serialize(doc)).site?.datum).toBe(65);
  });

  it('behåller nollpunkten och ±0 och byter ut det som kom med platsen när den läggs in igen', () => {
    const store = new DocStore(emptyProject('x', 'nybyggnad'));
    applySitePackage(store, pkg());
    updateSite(store, { datum: 64.5 });
    const n = Object.keys(store.doc.elements).length;
    applySitePackage(store, pkg({ nollpunkt: { x: 1000, y: 5000, z: 0 } }));
    expect(store.doc.site?.origin).toEqual([1050, 5040]);
    expect(store.doc.site?.datum).toBe(64.5);
    expect(Object.keys(store.doc.elements)).toHaveLength(n);
    expect(Object.keys(store.doc.assets).filter((k) => store.doc.assets[k].mime.includes('terrang'))).toHaveLength(1);
    removeSite(store);
    expect(store.doc.site).toBeUndefined();
    expect(Object.values(store.doc.elements).some((e) => e.type === 'Terrain' || e.type === 'Tree')).toBe(false);
  });

  it('säger vad som är fel med en fil som inte är ett platspaket', () => {
    expect(() => parseSitePackage('{"format":"bacchus-project"}')).toThrow(SitePackageError);
    expect(() => parseSitePackage(JSON.stringify(pkg({ version: 2 })))).toThrow(/version 2/);
    expect(() => parseSitePackage('inte json')).toThrow(/JSON/);
  });

  it('drar höjdkurvorna rakt över en jämnt sluttande mark, en per halvmeter', () => {
    const store = new DocStore(emptyProject('x', 'nybyggnad'));
    applySitePackage(store, pkg());
    const t = terrainOf(store.doc)!;
    const cs = contours(t, 500);
    // 60–70 m: kurvorna 60,5 … 69,5 inne i rutnätet (60 och 70 ligger på kanten).
    const inner = cs.filter((c) => c.z > 60 && c.z < 70);
    expect(new Set(inner.map((c) => c.z)).size).toBe(19);
    const c63 = cs.filter((c) => c.z === 63);
    expect(c63).toHaveLength(1);
    // 63 m ligger 30 m från västkanten, det vill säga 20 m väster om nollpunkten, i nord-sydlig riktning.
    for (const p of c63[0].pts) expect(p[0]).toBeCloseTo(-20000, 0);
    const ys = c63[0].pts.map((p) => p[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(80000, 0);
  });

  it('räknar medelmarknivån längs husets kontur, viktad efter längden', () => {
    const store = new DocStore(emptyProject('x', 'nybyggnad'));
    applySitePackage(store, pkg());
    const t = terrainOf(store.doc)!;
    // En rektangel 20 × 10 m från x = 0: marken 0 till +2 000, medel +1 000.
    const ring: [number, number][] = [[0, 0], [20000, 0], [20000, 10000], [0, 10000]];
    expect(meanGroundLevel(t, [ring])).toBeCloseTo(1000, 0);
    // En lång sida i väster väger mer: 0 längs 30 m, +1 000 längs 10 m … medelvärdet under +500.
    const tall: [number, number][] = [[0, 0], [10000, 0], [10000, 30000], [0, 30000]];
    expect(meanGroundLevel(t, [tall])).toBeCloseTo(500, 0);
  });

  it('ritar befintlig mark som tunn streckad marklinje i sektionen, och nivåerna i RH 2000', () => {
    const store = new DocStore(structuredClone(sampleProject()));
    applySitePackage(store, pkg());
    const doc = store.doc;
    const sec = Object.values(doc.elements).find((e) => e.type === 'Section')!;
    const r = buildSection(doc, sec.id, { state: doc.states.at(-1)!.id })!;
    const mark = r.prims.filter((p) => p.origin?.part === 'befintlig mark');
    expect(mark.length).toBeGreaterThan(0);
    const line = mark[0];
    expect(line.kind).toBe('polyline');
    if (line.kind === 'polyline') {
      expect(line.pen.dash).toBeTruthy();
      // Marken stiger 0,1 m per meter österut; längs sektionen så mycket som linjen går österut.
      const [a, b] = [line.points[0], line.points.at(-1)!];
      expect((b[1] - a[1]) / (b[0] - a[0])).toBeCloseTo(0.1 * markerFrame(doc, sec).right[0], 2);
    }
    const texts = r.prims.filter((p) => p.kind === 'text').map((p) => (p.kind === 'text' ? p.text : ''));
    expect(texts).toContain('FG +65,000');
    expect(texts.some((s) => /^MMN \+6[45],\d{3}$/.test(s))).toBe(true);
  });

  it('beskär markmodellen och det som ligger utanför', () => {
    const store = new DocStore(emptyProject('x', 'nybyggnad'));
    applySitePackage(store, pkg());
    expect(cropSite(store, { minX: -10000, minY: -10000, maxX: 10000, maxY: 10000 })).toBe(true);
    const g = store.doc.site!.grid!;
    expect(g.W).toBe(21);
    expect(g.H).toBe(21);
    // Grannhuset låg utanför, trädet innanför.
    expect(Object.values(store.doc.elements).some((e) => e.type === 'SiteBuilding')).toBe(false);
    expect(Object.values(store.doc.elements).some((e) => e.type === 'Tree')).toBe(true);
    expect(groundAt(terrainOf(store.doc)!, 5000, 0)).toBeCloseTo(500, 3);
  });
});
