import { beforeAll, describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { buildPlan } from '../src/repr/plan';
import { modelShapes, WITH_DEMOLISHED } from '../src/repr/storeyShapes';
import { registerBuiltInTypes } from '../src/elements';
import { defaultSheet } from '../src/core/viewCategories';
import { twoStoreys } from './projekt';
import { stairGeometry, type StairParams } from '../src/elements/stairGeometry';
import { builtSolids, contrastItems, contrastSolids } from '../src/elements/stairBuilt';
import { applyStairField } from '../src/ui/stairFields';
import type { Solid } from '../src/repr/solids';

/**
 * Den byggda trappan (0.11.4): vangstycken, plansteg med stegnos och
 * sättsteg som delar, kontrastmarkeringen och bygghandlingsgrafiken.
 */

const straight = (over: Partial<StairParams> = {}): StairParams => ({ line: [[0, 0], [4000, 0]], width: 1000, rise: 2700, build: 'built', ...over });
const xs = (s: Solid) => s.rings[0].map((q) => q[0]);
const ys = (s: Solid) => s.rings[0].map((q) => q[1]);

describe('Den byggda trappans delar (0.11.4)', () => {
  it('ger plansteg, sättsteg och två vangstycken; plansteget har stegnos och går in under nästa sättsteg', () => {
    const p = straight();
    const g = stairGeometry(p)!;
    const solids = builtSolids('t', p, g, undefined);
    const treads = solids.filter((s) => s.color === '#c8a57a');
    expect(treads).toHaveLength(14);
    // Det första plansteget börjar vid sin nos (u0) och slutar bakom nästa sättsteg (nästa nos + 30 + 20).
    const going = g.runs[0].going;
    expect(Math.min(...xs(treads[0]))).toBeCloseTo(0);
    expect(Math.max(...xs(treads[0]))).toBeCloseTo(going + 50);
    // Mellan vangstyckena: 50 in från vardera sidan.
    expect(Math.max(...ys(treads[0])) - Math.min(...ys(treads[0]))).toBeCloseTo(900);
    expect(treads[0].z1 - treads[0].z0).toBeCloseTo(40);
    // 15 sättsteg, det första från golvet till plansteget och det översta till golvet ovanför.
    const risers = solids.filter((s) => s.color === '#ece8df' && !s.top);
    expect(risers).toHaveLength(15);
    expect(risers[0].z0).toBe(0);
    expect(Math.max(...risers.map((r) => r.z1))).toBeCloseTo(2700);
    // Vangstyckena: sneda överkanter längs hela trappan på båda sidor.
    const stringers = solids.filter((s) => !!s.top);
    expect(stringers.length).toBeGreaterThan(20);
    expect(stringers.every((s) => Math.max(...ys(s)) - Math.min(...ys(s)) < 51)).toBe(true);
    expect(Math.max(...stringers.map((s) => s.z1))).toBeGreaterThan(2700);
  });

  it('gör en öppen trappa utan sättsteg, och vangstycken bara på en sida när det väljs', () => {
    const p = straight({ built: { riser: { thickness: 0 }, stringer: { sides: 'left' } } });
    const g = stairGeometry(p)!;
    const solids = builtSolids('t', p, g, undefined);
    expect(solids.some((s) => s.color === '#ece8df' && !s.top)).toBe(false);
    const stringers = solids.filter((s) => !!s.top);
    expect(stringers.every((s) => Math.max(...ys(s)) > 450)).toBe(true);
    // Plansteget går ut till höger kant (inget vangstycke där).
    const tread = solids.find((s) => s.color === '#c8a57a')!;
    expect(Math.min(...ys(tread))).toBeCloseTo(-500);
  });

  it('klarar en L-trappa med kilsteg och ett vilplan', () => {
    for (const extra of [{}, { turnLandings: [1] }]) {
      const p = straight({ line: [[0, 0], [3000, 0], [3000, 2500]], ...extra });
      const g = stairGeometry(p)!;
      const solids = builtSolids('t', p, g, undefined);
      expect(solids.length).toBeGreaterThan(30);
      expect(solids.every((s) => s.rings[0].length >= 3 && s.z1 > s.z0 && Number.isFinite(s.z0))).toBe(true);
    }
  });

  it('kontrastmarkerar det första och det sista steget, eller alla', () => {
    const g = stairGeometry(straight())!;
    expect(contrastItems(g, undefined)).toHaveLength(0);
    expect(contrastItems(g, 'ends')).toHaveLength(2);
    expect(contrastItems(g, 'all')).toHaveLength(14);
    const strips = contrastSolids('t', straight({ contrast: 'ends' }), g);
    expect(strips).toHaveLength(2);
    expect(Math.max(...xs(strips[0])) - Math.min(...xs(strips[0]))).toBeCloseTo(50);
  });
});

beforeAll(() => registerBuiltInTypes());

function withStair(over: Partial<StairParams> = {}) {
  const doc = twoStoreys();
  doc.elements.tr = { id: 'tr', type: 'Stair', storey: 'pl-1', states: ['st-a', 'st-b'], tags: [], props: {}, params: { line: [[1000, 4500], [4500, 4500]], width: 1000, ...over } } as any;
  return new DocStore(doc);
}
const parts = (store: DocStore, detail: 'normal' | 'detail') =>
  buildPlan(store.doc, 'pl-1', { state: 'st-a', detail } as any).prims.filter((q) => q.origin?.objectId === 'tr').map((q) => q.origin!.part);

describe('Den byggda trappan i ritningarna (0.11.4)', () => {
  it('ritar vangstyckenas insida i Normal, och stegnos, kontrast och stegnummer i Detalj', () => {
    const store = withStair({ build: 'built', contrast: 'ends' });
    const normal = parts(store, 'normal');
    expect(normal).toContain('vangstycke');
    expect(normal).not.toContain('stegnummer');
    const detail = parts(store, 'detail');
    expect(detail).toContain('stegnos');
    expect(detail).toContain('kontrast');
    expect(detail.filter((x) => x === 'stegnummer').length).toBeGreaterThan(5);
    expect(detail).toContain('stegtext');
    // Den monolitiska har inga vangstycken.
    expect(parts(withStair(), 'normal')).not.toContain('vangstycke');
  });

  it('bygger delarna i 3D och ändras i panelen', () => {
    const store = withStair();
    const count = () => modelShapes(store.doc, { state: 'st-a' }, defaultSheet(store.doc.graphics), WITH_DEMOLISHED).shapes.filter((x) => x.s.id === 'tr' && x.s.kind !== 'edges').length;
    const mono = count();
    const field = (value: string) => ({ value, checked: false }) as unknown as HTMLSelectElement;
    expect(applyStairField(store, ['tr'], 'build', field('built'))).toBe(true);
    expect(count()).toBeGreaterThan(mono * 2);
    expect(applyStairField(store, ['tr'], 'riserThickness', field('0'))).toBe(true);
    expect(store.doc.elements.tr.params.built).toEqual({ riser: { thickness: 0 } });
    expect(applyStairField(store, ['tr'], 'riserThickness', field('20'))).toBe(true);
    expect(store.doc.elements.tr.params.built).toBeUndefined();
    expect(applyStairField(store, ['tr'], 'contrast', field('all'))).toBe(true);
    expect(store.doc.elements.tr.params.contrast).toBe('all');
  });
});
