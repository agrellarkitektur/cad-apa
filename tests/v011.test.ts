import { beforeAll, describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { buildPlan } from '../src/repr/plan';
import { modelShapes, WITH_DEMOLISHED } from '../src/repr/storeyShapes';
import { registerBuiltInTypes } from '../src/elements';
import { slabRings } from '../src/elements/slab';
import { createContext } from '../src/repr/context';
import { defaultSheet } from '../src/core/viewCategories';
import { groundProject, twoStoreys } from './projekt';
import { bandBetween, stairGeometry, stairOutline, stairWarnings, type StairParams } from '../src/elements/stairGeometry';
import { signedArea } from '../src/geometry/chains';
import type { Vec2 } from '../src/repr/primitives';

/**
 * Trappan (0.11): referenslinjen med raka sträckor och bågar, kilsteg och
 * vilplan i svängarna, gånglinjen från utsidan, stigningen och stegen.
 */

const stair = (over: Partial<StairParams> = {}): StairParams => ({ line: [[0, 0], [4000, 0]], width: 1000, rise: 2700, ...over });
const area = (r: readonly Vec2[]) => Math.abs(signedArea(r as Vec2[]));

describe('Trappans geometri (0.11)', () => {
  it('fördelar en rak trappa: sättsteg ur stigningen, stegdjupet ur längden', () => {
    const g = stairGeometry(stair())!;
    expect(g.risers.length).toBe(15);
    expect(g.riserHeight).toBeCloseTo(180);
    expect(g.items.filter((i) => i.kind === 'tread')).toHaveLength(14);
    expect(g.runs[0].going).toBeCloseTo(4000 / 14);
    // Gånglinjen i mitten i en rak trappa, och bandet är hela trappan.
    expect(g.walkFromLeft).toBe(500);
    expect(area(stairOutline(g))).toBeCloseTo(4_000_000, -2);
    expect(g.items.at(-1)!.z).toBeCloseTo(2700 - 180);
  });

  it('räknar plansteg i början och slutet som en del av trappan', () => {
    const g = stairGeometry(stair({ start: 'tread', end: 'tread', startTread: 400 }))!;
    expect(g.items[0]).toMatchObject({ kind: 'startTread', u0: 0, u1: 400, z: 0 });
    expect(g.items.at(-1)).toMatchObject({ kind: 'endTread', z: 2700 });
    expect(g.risers[0]).toBeCloseTo(400);
    expect(g.risers.at(-1)).toBeCloseTo(3700);
  });

  it('lägger kilsteg i en sväng, med gånglinjen 300 från utsidan', () => {
    // L-trappa som svänger åt vänster: utsidan är höger sida.
    const g = stairGeometry(stair({ line: [[0, 0], [3000, 0], [3000, 2500]] }))!;
    expect(g.walkFromLeft).toBe(700);
    expect(g.landings).toHaveLength(0);
    // Stegen täcker hela bandet utan glipor.
    const sum = g.items.reduce((s, it) => s + area(bandBetween(g, it.u0, it.u1)), 0);
    expect(sum).toBeCloseTo(area(stairOutline(g)), -3);
    // Lika stegdjup i hela loppet.
    expect(g.runs).toHaveLength(1);
  });

  it('gör svängen till vilplan när den väljs, eller när sträckan efter en punkt är vilplan', () => {
    const corner = stairGeometry(stair({ line: [[0, 0], [3000, 0], [3000, 2500]], turnLandings: [1] }))!;
    expect(corner.landings).toHaveLength(1);
    expect(corner.items.filter((i) => i.kind === 'landing')).toHaveLength(1);
    expect(corner.runs).toHaveLength(2);
    // U-trappa: mittensträckan som vilplan tar svängarna med sig.
    const u = stairGeometry(stair({ line: [[0, 0], [3000, 0], [3000, 2200], [0, 2200]], landings: [1] }))!;
    expect(u.landings).toHaveLength(1);
    expect(u.runs).toHaveLength(2);
    expect(u.risers.length).toBe(15);
  });

  it('följer en båge med radiella steg', () => {
    const g = stairGeometry(stair({ line: [[0, 0], [4000, 0]], bulges: [1500] }))!;
    expect(g.risers.length).toBe(15);
    const sum = g.items.reduce((s, it) => s + area(bandBetween(g, it.u0, it.u1)), 0);
    expect(sum).toBeCloseTo(area(stairOutline(g)), -3);
  });

  it('varnar men spärrar inte (avviker från praxis)', () => {
    const p = stair({ line: [[0, 0], [2000, 0]], width: 800 });
    const g = stairGeometry(p)!;
    const w = stairWarnings(p, g);
    expect(w.some((x) => x.startsWith('Stegdjupet'))).toBe(true);
    expect(w.some((x) => x.startsWith('Bredden') && x.includes('avviker från praxis'))).toBe(true);
    expect(stairWarnings(stair(), stairGeometry(stair())!)).toEqual([]);
  });
});

beforeAll(() => registerBuiltInTypes());

/** Exemplet med två våningar och en rak trappa i Plan 1 (i alla förslag). */
function withStair(over: Partial<StairParams> = {}) {
  const doc = twoStoreys();
  doc.elements.tr = { id: 'tr', type: 'Stair', storey: 'pl-1', states: ['st-a', 'st-b'], tags: [], props: {}, params: { line: [[1000, 4500], [4500, 4500]], width: 1000, ...over } } as any;
  return new DocStore(doc);
}
const parts = (store: ReturnType<typeof withStair>, storey: string) =>
  new Set(buildPlan(store.doc, storey, { state: 'st-a' }).prims.filter((q) => q.origin?.objectId === 'tr').map((q) => q.origin!.part));

describe('Trappan i ritningarna (0.11)', () => {
  it('ritar det under snittet heldraget och det över streckprickat med snittlinjen; i våningen ovanför hel', () => {
    const store = withStair();
    const own = parts(store, 'pl-1');
    expect(own.has('över')).toBe(true);
    expect(own.has('snittlinje')).toBe(true);
    expect(own.has('gånglinje')).toBe(true);
    const up = parts(store, 'pl-2');
    expect(up.has('steg')).toBe(true);
    expect(up.has('över')).toBe(false);
    expect(up.has('snittlinje')).toBe(false);
  });

  it('tar ett hål i bjälklaget ovanför ur den fria höjden, och inget när det väljs bort', () => {
    const store = withStair();
    const ctx = (s: ReturnType<typeof withStair>) => createContext(s.doc, 'pl-2', { state: 'st-a' }, defaultSheet(s.doc.graphics), () => true).ctx;
    const holes = (s: ReturnType<typeof withStair>) => slabRings(ctx(s), s.doc.elements['bj1-2']).reduce((n, poly) => n + poly.length - 1, 0);
    expect(holes(store)).toBe(2);
    expect(holes(withStair({ hole: 'none' }))).toBe(1);
  });

  it('bygger kroppen i 3D med sned undersida och stigningen till våningen ovanför', () => {
    const store = withStair();
    const shapes = modelShapes(store.doc, { state: 'st-a' }, defaultSheet(store.doc.graphics), WITH_DEMOLISHED).shapes.map((x) => x.s).filter((s) => s.id === 'tr' && s.kind !== 'edges');
    expect(shapes.length).toBe(14);
    const top = Math.max(...shapes.map((s) => (s.kind === 'edges' ? 0 : s.z1)));
    expect(top).toBeCloseTo(2700 - 180);
    expect(shapes.some((s) => s.kind !== 'edges' && !!s.bottom)).toBe(true);
  });

  it('syns också på Platsen som kontur, utan att gå att klicka på (Syns också på)', () => {
    const store = withStair();
    store.transact('syns', (tx) => tx.putElement({ ...store.doc.elements.tr, seenOn: ['platsen'] }));
    const plan = buildPlan(store.doc, 'platsen', { state: 'st-a' });
    const mine = plan.prims.filter((q) => q.origin?.objectId === 'tr');
    expect(mine.length).toBeGreaterThan(10);
    expect(mine.every((q) => q.kind !== 'region' && 'pen' in q && q.pen.color === 'muted' && q.noPick)).toBe(true);
    expect(plan.pickables.some((k) => k.id === 'tr')).toBe(false);
    // Bjälklaget likadant: konturen, utan snittets fyllning.
    store.transact('syns', (tx) => tx.putElement({ ...store.doc.elements['bj1-2'], seenOn: ['pl-1'] }));
    const slab = buildPlan(store.doc, 'pl-1', { state: 'st-a' }).prims.filter((q) => q.origin?.objectId === 'bj1-2');
    expect(slab.length).toBeGreaterThan(0);
    expect(slab.every((q) => q.kind === 'polyline' || q.kind === 'line')).toBe(true);
  });

  it('ritar rampen och stödmuren från Platsen i våningens plan', () => {
    const store = new DocStore(groundProject());
    for (const id of ['m-ramp', 'm-mur']) if (store.doc.elements[id]) store.transact('syns', (tx) => tx.putElement({ ...store.doc.elements[id], seenOn: ['pl-1'] }));
    const prims = buildPlan(store.doc, 'pl-1', { state: 'st-a' }).prims.filter((q) => q.origin?.objectId === 'm-ramp');
    expect(prims.length).toBeGreaterThan(0);
    expect(prims.every((q) => q.kind !== 'text' && q.kind !== 'region')).toBe(true);
  });
});
