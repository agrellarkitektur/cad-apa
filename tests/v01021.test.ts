import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { reversedWall } from '../src/core/commands';
import { wallShear, type WallParams } from '../src/elements/wall';
import { solidTriangles } from '../src/repr/mesh';
import { cutSolid } from '../src/repr/sectionCut';
import type { Edges3D, Solid } from '../src/repr/solids';
import { modelShapes, WITHOUT_DEMOLISHED } from '../src/repr/storeyShapes';
import { applyField } from '../src/ui/selectionEdits';
import { instanceFields } from '../src/ui/selectionFields';
import { planOf, wallsProject } from './projekt';
import type { DocStore } from '../src/core/store';

beforeAll(() => registerBuiltInTypes());

const TAN10 = Math.tan(Math.PI / 18);
const DOOR = { type: 'Door', params: { at: 2000, width: 900, height: 2100, swing: 1, hinge: 'start', glazed: false, frameWidth: 50, frameDepth: 100, inset: null } };

/** En vägg längs x-axeln som lutar 10° åt vänster (+y), med en dörr mitt på. */
function leaning(extra: Record<string, { type: string; params: Record<string, unknown> }> = { d: DOOR }): DocStore {
  const s = wallsProject({ a: [[0, 0], [4000, 0]] }, {}, extra);
  s.transact('lutning', (tx) => {
    tx.putElement({ ...s.doc.elements.a, params: { ...s.doc.elements.a.params, lean: 10 } });
    if (s.doc.elements.d) tx.putElement({ ...s.doc.elements.d, host: 'a' });
  });
  return s;
}
const shapesOf = (s: DocStore) => modelShapes(s.doc, { state: s.doc.states.at(-1)!.id }, s.doc.graphics, WITHOUT_DEMOLISHED).shapes.map((x) => x.s);
const wallOf = (s: DocStore) => shapesOf(s).find((x): x is Solid => x.kind !== 'edges' && x.id === 'a')!;

describe('Lutande väggar (0.10.21)', () => {
  it('väggen lutar i 3D: toppen förskjuten height · tan(lutningen), foten kvar', () => {
    const wall = wallOf(leaning());
    expect(wall.shear![1]).toBeCloseTo(TAN10, 6);
    const tris = solidTriangles(wall);
    const ys = (z: (v: number) => boolean) => {
      const out: number[] = [];
      for (let i = 0; i < tris.length; i += 3) if (z(tris[i + 2])) out.push(tris[i + 1]);
      return out;
    };
    expect(Math.min(...ys((z) => z < 1))).toBeCloseTo(-100, 3);
    expect(Math.min(...ys((z) => z > 2699))).toBeCloseTo(-100 + 2700 * TAN10, 3);
    expect(Math.max(...ys((z) => z > 2699))).toBeCloseTo(100 + 2700 * TAN10, 3);
  });

  it('kantlinjerna och dörren följer lutningen', () => {
    const edges = shapesOf(leaning()).filter((x): x is Edges3D => x.kind === 'edges');
    const atTop = edges.filter((e) => e.id === 'a').flatMap((e) => e.segments.filter((q) => q[2] > 2699 && q[5] > 2699));
    expect(atTop.length).toBeGreaterThan(0);
    for (const q of atTop) expect(Math.abs(q[1] - 2700 * TAN10)).toBeLessThan(101);
    // Dörrhålets överkant (2110) ligger förskjutet lika mycket.
    const hole = edges.filter((e) => e.id === 'a' && e.part === 'hole').flatMap((e) => e.segments.filter((q) => Math.abs(q[2] - 2110) < 1 && Math.abs(q[5] - 2110) < 1));
    expect(hole.length).toBeGreaterThan(0);
    for (const q of hole) expect(Math.abs(q[1] - 2110 * TAN10)).toBeLessThan(101);
    // Dörrens egna former (bladet) lutar med väggen.
    const leaf = shapesOf(leaning()).find((x): x is Solid => x.kind !== 'edges' && x.id === 'd' && x.material === 'door');
    expect(leaf?.shear?.[1]).toBeCloseTo(TAN10, 6);
  });

  it('sektionen tvärs väggen är en parallellogram; längs väggen slutar snittytan där väggen lutat ut ur planet', () => {
    const wall = wallOf(leaning());
    // Snittet vid x = 1000, u längs +y från y = −3000.
    const across = cutSolid(wall, [1000, -3000], [0, 1], [1, 0]);
    expect(across).toHaveLength(1);
    const ring = across[0][0].map((q) => q.map(Math.round));
    expect(ring).toEqual(expect.arrayContaining([[2900, 0], [3100, 0], [Math.round(3100 + 2700 * TAN10), 2700], [Math.round(2900 + 2700 * TAN10), 2700]]));
    // Snittet i väggens mittplan (y = 0): väggen täcker planet upp till 100 / tan(10°) ≈ 567, och dörrhålet bryter det.
    const along = cutSolid(wall, [-1000, 0], [1, 0], [0, -1]);
    expect(along).toHaveLength(2);
    const top = Math.max(...along.flatMap((r) => r[0].map((q) => q[1])));
    expect(top).toBeCloseTo(100 / TAN10, 0);
    const xs = along.flatMap((r) => r[0].map((q) => Math.round(q[0])));
    expect(xs).toContain(2545);
    expect(xs).toContain(3455);
  });

  it('planen: snittytan där snittet skär väggen, foten som vy, toppen streckprickad, dörren på snittytan', () => {
    const prims = planOf(leaning()).prims;
    const dy = 1100 * TAN10;
    const regions = prims.filter((p) => p.kind === 'region' && p.origin?.objectType === 'Wall');
    expect(regions).toHaveLength(2);
    const ys = regions.flatMap((p) => (p.kind === 'region' ? p.rings[0].map((q) => q[1]) : []));
    expect(Math.min(...ys)).toBeCloseTo(-100 + dy, 3);
    expect(Math.max(...ys)).toBeCloseTo(100 + dy, 3);
    const foot = prims.filter((p) => p.kind === 'polyline' && p.origin?.objectId === 'a' && p.origin.part === 'vy');
    // Två bitar: dörren bryter foten.
    expect(foot).toHaveLength(2);
    expect(foot.every((p) => p.kind === 'polyline' && !p.pen.dash && p.points.some((q) => Math.abs(q[1] + 100) < 0.5))).toBe(true);
    const top = prims.filter((p) => p.kind === 'polyline' && p.origin?.objectId === 'a' && p.origin.part === 'över');
    expect(top).toHaveLength(1);
    expect(top[0].kind === 'polyline' && !!top[0].pen.dash && top[0].points.every((q) => Math.abs(q[1] - 2700 * TAN10) < 101)).toBe(true);
    // Dörrens linjer utgår från den förskjutna snittytan.
    const doorYs = prims.filter((p) => p.origin?.objectType === 'Door' && p.kind === 'line').flatMap((p) => (p.kind === 'line' ? [p.a[1], p.b[1]] : []));
    expect(Math.min(...doorYs)).toBeGreaterThan(-100 + dy - 0.5);
  });

  it('en lodrät vägg ritas som förut, en bågvägg lutar inte och Vänd väggen byter tecken', () => {
    const s = wallsProject({ a: [[0, 0], [4000, 0]] });
    expect(wallOf(s).shear).toBeUndefined();
    expect(planOf(s).prims.some((p) => p.kind === 'polyline' && p.origin?.objectType === 'Wall')).toBe(false);
    expect(wallShear({ ...(s.doc.elements.a.params as unknown as WallParams), lean: 10, bulge: 500 })).toBeNull();
    const back = reversedWall(s.doc, { ...s.doc.elements.a, params: { ...s.doc.elements.a.params, lean: 10 } }, true)[0];
    expect(back.params.lean).toBe(-10);
  });

  it('panelen: Lutning i grader och Toppen i sidled i mm, som räknas om till vinkeln', () => {
    const s = wallsProject({ a: [[0, 0], [4000, 0]] });
    const view = { state: s.doc.states[0].id };
    expect(instanceFields(s.doc, s.doc.elements.a, view)).toContain('wall:lean');
    applyField(s, ['a'], 'wall:topOffset', { value: String(Math.round(2700 * TAN10)) } as HTMLInputElement, view);
    expect(s.doc.elements.a.params.lean as number).toBeCloseTo(10, 1);
    expect(instanceFields(s.doc, s.doc.elements.a, view)).toContain(`value="${Math.round(2700 * TAN10)}"`);
    applyField(s, ['a'], 'wall:lean', { value: '-95' } as HTMLInputElement, view);
    expect(s.doc.elements.a.params.lean).toBe(-80);
    applyField(s, ['a'], 'wall:lean', { value: '0' } as HTMLInputElement, view);
    expect(s.doc.elements.a.params.lean).toBeUndefined();
  });
});
