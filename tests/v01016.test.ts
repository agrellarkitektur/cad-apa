import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { wallCutParts } from '../src/elements/groundPlan';
import type { WallProfile } from '../src/elements/groundWall';
import { storeyPatch } from '../src/core/storeys';
import type { Primitive } from '../src/repr/primitives';
import { planCutPen } from '../src/repr/planCutPens';
import { applyPenField } from '../src/ui/style/pens';
import { planOf, wallsProject } from './projekt';
import type { DocStore } from '../src/core/store';

beforeAll(() => registerBuiltInTypes());

const of = (store: DocStore, id: string): Primitive[] => planOf(store).prims.filter((p) => p.origin?.objectId === id);
const wallRegions = (store: DocStore) => planOf(store).prims.filter((p) => p.kind === 'region' && p.origin?.objectType === 'Wall');
const holes = (store: DocStore) => wallRegions(store).length;

describe('Snittet i planen (0.10.16)', () => {
  it('väggar över snittet streckprickade, låga väggar som vy, utan snittyta', () => {
    const s = wallsProject({ a: [[0, 0], [4000, 0]], b: [[0, 2000], [4000, 2000]], c: [[0, 4000], [4000, 4000]] });
    s.transact('höjder', (tx) => {
      tx.putElement({ ...s.doc.elements.b, params: { ...s.doc.elements.b.params, level: 1500, height: 1000 } });
      tx.putElement({ ...s.doc.elements.c, params: { ...s.doc.elements.c.params, height: 900 } });
    });
    expect(wallRegions(s)).toHaveLength(1);
    const above = of(s, 'b');
    expect(above.length).toBeGreaterThan(0);
    expect(above.every((p) => p.kind === 'polyline' && p.origin?.part === 'över' && !!p.pen.dash)).toBe(true);
    const below = of(s, 'c');
    expect(below.every((p) => p.kind === 'polyline' && p.origin?.part === 'vy' && !p.pen.dash)).toBe(true);
    // En högre snitthöjd gör den låga väggen till ett snitt igen.
    s.transact('snitt', (tx) => tx.setStoreys(storeyPatch(s.doc, s.doc.storeys[0].id, { cutHeight: 800 })));
    expect(of(s, 'c').some((p) => p.kind === 'region')).toBe(false);
    expect(wallRegions(s)).toHaveLength(2);
  });

  it('en vägg över snittet ritas bara där den sticker ut utanför det snittade', () => {
    const s = wallsProject({ a: [[0, 0], [4000, 0]], b: [[2000, -1000], [2000, 1000]] });
    s.transact('höjd', (tx) => tx.putElement({ ...s.doc.elements.b, params: { ...s.doc.elements.b.params, level: 1500, height: 1000 } }));
    const ys = of(s, 'b').flatMap((p) => (p.kind === 'polyline' ? p.points.map((q) => q[1]) : []));
    // Inga punkter inne i den snittade väggen (y mellan -100 och 100), utom på dess kant.
    expect(ys.every((y) => Math.abs(y) >= 99.5)).toBe(true);
  });

  it('ett högt fönster tar inget hål i väggen och ritas streckprickat', () => {
    const s = wallsProject({ a: [[0, 0], [4000, 0]] }, {}, { w: { type: 'Window', params: { at: 2000, width: 1200, height: 600, sill: 1600, frameWidth: 50, frameDepth: 100, inset: null } } });
    s.transact('värd', (tx) => tx.putElement({ ...s.doc.elements.w, host: 'a' }));
    const region = wallRegions(s)[0];
    expect(region.kind === 'region' && region.rings).toHaveLength(1);
    expect(holes(s)).toBe(1);
    expect(of(s, 'w').filter((p) => p.kind === 'line').every((p) => p.origin?.part === 'över')).toBe(true);
    // Med bröstningen under snittet blir det ett hål igen: två bitar vägg.
    s.transact('lägre', (tx) => tx.putElement({ ...s.doc.elements.w, params: { ...s.doc.elements.w.params, sill: 900 } }));
    expect(holes(s)).toBe(2);
  });

  it('bjälklag genom snittet blir en snittyta, över snittet streckprickat', () => {
    const outline = [[0, 0], [3000, 0], [3000, 3000], [0, 3000]];
    const s = wallsProject({}, {}, { bj: { type: 'Slab', params: { thickness: 200, outline, level: 1200 } } });
    expect(of(s, 'bj').some((p) => p.kind === 'region')).toBe(true);
    s.transact('upp', (tx) => tx.putElement({ ...s.doc.elements.bj, params: { ...s.doc.elements.bj.params, level: 2000 } }));
    const lines = of(s, 'bj');
    expect(lines.every((p) => p.kind === 'line' && p.origin?.part === 'över' && !!p.pen.dash)).toBe(true);
  });

  it('möbler över snittet streckprickade; stilmallens och objektets penna', () => {
    const s = wallsProject({}, {}, { m: { type: 'Furniture', params: { origin: [0, 0], rotation: 0, width: 800, depth: 300, symbol: 'counter', level: 1400 } } });
    expect(of(s, 'm').every((p) => p.kind === 'polyline' && p.origin?.part === 'över' && p.pen.weight === 0.13)).toBe(true);
    // Stilmallen: tjockleken för möbler över snittet.
    const style = structuredClone(s.doc.graphics);
    applyPenField(style, { dataset: { pen: 'aboveFurniture:weight' }, value: '0.25' } as unknown as HTMLInputElement);
    expect(planCutPen(style, 'Furniture', 'above')).toMatchObject({ weight: 0.25, dash: expect.any(Array) });
    // Heldraget sparas, eftersom förvalet är punktstreckat.
    applyPenField(style, { dataset: { pen: 'aboveFurniture:linetype' }, value: 'solid' } as unknown as HTMLInputElement);
    expect(planCutPen(style, 'Furniture', 'above').dash).toBeUndefined();
    // Objektets egen penna för det som ligger över.
    s.transact('penna', (tx) => tx.putElement({ ...s.doc.elements.m, pen: { above: { weight: 0.5, color: '#ff0000' } } }));
    expect(of(s, 'm').every((p) => p.kind === 'polyline' && p.pen.weight === 0.5 && p.pen.color === '#ff0000')).toBe(true);
  });

  it('stödmuren delas där krönet går genom snitthöjden', () => {
    const st = (s: number, top: number) => ({ s, at: [s, 0] as const, right: [s, -100] as const, left: [s, 100] as const, seg: 0, top, bottom: -300 });
    const prof = { stations: [st(0, 2000), st(1000, 2000)] } as unknown as WallProfile;
    expect(wallCutParts(prof, 1100)).toBeNull();
    const sloped = { stations: [st(0, 2000), st(1000, 0)] } as unknown as WallProfile;
    const parts = wallCutParts(sloped, 1100)!;
    expect(parts.cut).toHaveLength(1);
    expect(parts.below).toHaveLength(1);
    const xs = parts.cut[0][0].map((q) => q[0]);
    expect(Math.max(...xs)).toBeCloseTo(450);
  });
});
