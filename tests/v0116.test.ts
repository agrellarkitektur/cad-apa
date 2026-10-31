import { beforeAll, describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { emptyProject, type Element } from '../src/core/model';
import { defaultProfileTypes, profileSection, profileValues, type ProfileTypeModel } from '../src/core/profileTypes';
import { registerBuiltInTypes } from '../src/elements';
import { profileBodyOf, profilePath3d, profileType, type ProfileParams } from '../src/elements/profile';
import { clipPoly, partRegions, sliceAt, solidsOf, stripCells, sweep, type Poly3 } from '../src/elements/profileBody';
import { buildPlan } from '../src/repr/plan';
import { buildSection } from '../src/repr/section';
import { defaultSheet } from '../src/core/viewCategories';
import { createContext } from '../src/repr/context';
import { zOn, type Solid } from '../src/repr/solids';

/**
 * Profilen (0.11.6): tvärsnittet med sträckzoner och delprofiler, svepningen
 * med avslut och gering, 3D-formerna, planen och sektionen.
 */

beforeAll(() => registerBuiltInTypes());

const TYPES = defaultProfileTypes();
const model = (id: string): ProfileTypeModel => TYPES.find((d) => d.id === id)!.profile!;

function project(els: { def: string; params: Partial<ProfileParams> }[]) {
  const doc = emptyProject('Profil', 'nybyggnad');
  for (const d of TYPES) doc.definitions[d.id] = d;
  els.forEach((e, i) => {
    const el: Element = { id: `p${i}`, type: 'Profile', storey: 'pl-1', states: ['st-ny'], tags: [], definition: e.def, params: { line: [], ...e.params }, props: {} };
    doc.elements[el.id] = el;
  });
  return new DocStore(doc);
}

/** Volymen av en lodrät extrudering (ringen gånger medelhöjden, exakt för plan ovan- och undersida). */
function volume(s: Solid): number {
  const r = s.rings[0];
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i];
    const q = r[(i + 1) % r.length];
    const c = p[0] * q[1] - q[0] * p[1];
    a += c;
    cx += (p[0] + q[0]) * c;
    cy += (p[1] + q[1]) * c;
  }
  a /= 2;
  const m: [number, number] = [cx / (6 * a), cy / (6 * a)];
  const top = s.top ? zOn(s.top, m[0], m[1]) : s.z1;
  const bot = s.bottom ? zOn(s.bottom, m[0], m[1]) : s.z0;
  return Math.abs(a) * (top - bot);
}

const totalVolume = (solids: Solid[]) => solids.reduce((v, s) => v + volume(s), 0);

describe('Tvärsnittet (0.11.6)', () => {
  it('sträcker i zonen och behåller formen över och under', () => {
    const m = model('t-pr04');
    const s = profileSection(m, profileValues(m, { Höjd: 290 }));
    expect(s.box.maxY - s.box.minY).toBeCloseTo(290);
    // Avtäckningen (B) ligger över zonen och flyttas hela tillskottet (droppnäsan från 160 till 260).
    const b = s.parts.find((p) => p.part.letter === 'B')!;
    expect(Math.min(...b.ring.map((q) => q[1]))).toBeCloseTo(260);
    // Utan sträckzon (den runda pelaren) är måttet låst.
    const r = model('t-pr02');
    const rs = profileSection(r, profileValues(r, { Höjd: 500 }));
    expect(rs.box.maxY - rs.box.minY).toBeCloseTo(150, 0);
  });

  it('ger en senare delprofil som ligger ovanpå ett hål i den tidigare', () => {
    const m: ProfileTypeModel = {
      group: 'Lister och gesimser',
      parts: [
        { id: 'a', letter: 'A', name: 'A', contour: { pts: [[0, 0], [100, 0], [100, 100], [0, 100]] } },
        { id: 'b', letter: 'B', name: 'B', contour: { pts: [[25, 25], [75, 25], [75, 75], [25, 75]] }, place: 'over' },
      ],
      anchors: [{ no: 1, name: 'Hörn', pos: 'bl' }],
      anchor: 1,
      zones: [],
      params: [],
    };
    const regs = partRegions(profileSection(m, new Map()));
    expect(regs[0].polys[0]).toHaveLength(2);
    // Cellerna täcker A utan hålet: 100² − 50².
    const cells = stripCells(regs[0].polys);
    const area = cells.reduce((s, c) => s + Math.abs(c.reduce((a, p, i) => a + p[0] * c[(i + 1) % c.length][1] - c[(i + 1) % c.length][0] * p[1], 0)) / 2, 0);
    expect(area).toBeCloseTo(7500);
  });
});

describe('Svepningen (0.11.6)', () => {
  const box = { polys: [[[[0, 0], [100, 0], [100, 200], [0, 200]] as [number, number][]]], follows: true, extend: 0 };

  it('ger en rak balk med exakt volym, lodräta ändar', () => {
    const r = sweep([box], [[0, 0, 0], [3000, 0, 0]], 'plumb', { kind: 'plumb' }, { kind: 'plumb' });
    const solids = r.pieces.flatMap((p) => solidsOf('b', p.poly, {}));
    expect(totalVolume(solids)).toBeCloseTo(100 * 200 * 3000, -2);
    expect(Math.min(...solids.map((s) => s.z0))).toBeCloseTo(0);
    expect(Math.max(...solids.map((s) => s.z1))).toBeCloseTo(200);
    expect(r.edges.length).toBeGreaterThan(4);
  });

  it('gerar i en knäck utan glipa eller överlapp', () => {
    const r = sweep([box], [[0, 0, 0], [3000, 0, 0], [3000, 3000, 0]], 'plumb', { kind: 'square' }, { kind: 'square' });
    const solids = r.pieces.flatMap((p) => solidsOf('b', p.poly, {}));
    // Tvärsnittet till höger om banan (x 0–100), banan svänger vänster: mittlinjen vid x = 50 ligger utanför, 2 · (3000 + 50) lång.
    expect(totalVolume(solids)).toBeCloseTo(100 * 200 * 2 * (3000 + 50), -3);
  });

  it('gerar också där en sluten bana börjar', () => {
    const r = sweep([box], [[0, 0, 0], [4000, 0, 0], [4000, 3000, 0], [0, 3000, 0], [0, 0, 0]], 'plumb', { kind: 'square' }, { kind: 'square' });
    const solids = r.pieces.flatMap((p) => solidsOf('b', p.poly, {}));
    // Moturs: tvärsnittet till höger ligger utanför, mittlinjen 50 utanför banan.
    expect(totalVolume(solids)).toBeCloseTo(100 * 200 * 2 * (4100 + 3100), -3);
  });

  it('lägger avslutet inom eller utöver referenslinjen, och förskjuter det', () => {
    // En lutande balk med vågräta ändar: inom ryms den i linjen, utöver sticker den ut.
    const path: [number, number, number][] = [[0, 0, 0], [3000, 0, 1500]];
    const ext = (beyond: boolean, shift = 0) => {
      const r = sweep([box], path, 'plumb', { kind: 'level', beyond, shift }, { kind: 'level', beyond, shift });
      const xs = r.pieces.flatMap((p) => p.poly.flat().map((q) => q[0]));
      return [Math.min(...xs), Math.max(...xs)];
    };
    const inside = ext(false);
    const beyond = ext(true);
    expect(inside[0]).toBeGreaterThanOrEqual(-0.01);
    expect(inside[1]).toBeLessThanOrEqual(3000.01);
    expect(beyond[0]).toBeLessThan(-1);
    expect(beyond[1]).toBeGreaterThan(3001);
    const shifted = ext(false, 100);
    expect(shifted[1] - inside[1]).toBeCloseTo(100 * (3000 / Math.hypot(3000, 1500)), 0);
  });

  it('kapar en konvex kropp och snittar den i en höjd', () => {
    const cube: Poly3 = [
      [[0, 0, 0], [0, 10, 0], [10, 10, 0], [10, 0, 0]],
      [[0, 0, 10], [10, 0, 10], [10, 10, 10], [0, 10, 10]],
      [[0, 0, 0], [10, 0, 0], [10, 0, 10], [0, 0, 10]],
      [[10, 0, 0], [10, 10, 0], [10, 10, 10], [10, 0, 10]],
      [[10, 10, 0], [0, 10, 0], [0, 10, 10], [10, 10, 10]],
      [[0, 10, 0], [0, 0, 0], [0, 0, 10], [0, 10, 10]],
    ];
    const half = clipPoly(cube, { n: [1, 0, 1], d: 10 });
    const solids = solidsOf('k', half, {});
    expect(totalVolume(solids)).toBeCloseTo(500);
    expect(sliceAt(half, 5)!.length).toBe(4);
  });
});

describe('Profilobjektet (0.11.6)', () => {
  it('ritar en pelare från golvet till våningen ovanför', () => {
    const store = project([{ def: 't-pr01', params: { path: 'plumb', line: [[1000, 1000]] } }]);
    const path = profilePath3d(store.doc.elements.p0.params as unknown as ProfileParams);
    expect(path[0][2]).toBe(0);
    const body = profileBodyOf(store.doc, store.doc.elements.p0)!;
    const zs = body.sweep.pieces.flatMap((p) => p.poly.flat().map((q) => q[2]));
    expect(Math.max(...zs)).toBeCloseTo(2700);
    // Ankaret i mitten: pelaren står kring punkten.
    const xs = body.sweep.pieces.flatMap((p) => p.poly.flat().map((q) => q[0]));
    expect(Math.min(...xs)).toBeCloseTo(930);
    expect(Math.max(...xs)).toBeCloseTo(1070);
  });

  it('snittas i planen och syns i sektionen', () => {
    const store = project([
      { def: 't-pr01', params: { path: 'plumb', line: [[0, 0]] } },
      { def: 't-pr03', params: { line: [[-1000, 0], [3000, 0]], z: [2700, 2700] } },
    ]);
    const plan = buildPlan(store.doc, 'pl-1', { state: 'st-ny' }, defaultSheet(store.doc.graphics));
    const prims = plan.prims.filter((p) => p.origin?.objectType === 'Profile');
    expect(prims.some((p) => p.origin?.part === 'snitt' && p.origin.objectId === 'p0')).toBe(true);
    expect(prims.some((p) => p.origin?.part === 'över' && p.origin.objectId === 'p1')).toBe(true);
    const { ctx } = createContext(store.doc, 'pl-1', { state: 'st-ny' }, defaultSheet(store.doc.graphics), () => true);
    const shapes = profileType.model3d!(store.doc.elements.p1 as never, ctx);
    expect(shapes.some((s) => s.kind === 'edges')).toBe(true);
    const sec = buildSection(store.doc, 'sektion-a', { state: 'st-ny' }, defaultSheet(store.doc.graphics));
    expect(sec!.prims.length).toBeGreaterThan(0);
  });
});
