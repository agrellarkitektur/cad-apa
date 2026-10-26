import { beforeAll, describe, expect, it } from 'vitest';
import { updateSite } from '../src/core/siteImport';
import { registerBuiltInTypes } from '../src/elements';
import { finishedTerrain, groundType } from '../src/elements/ground';
import { changedCells, contourSegments3d, groundContours } from '../src/elements/site';
import { terrainOf } from '../src/core/site';
import { buildSection } from '../src/repr/section';
import { smartVars } from '../src/repr/smartText';
import type { Primitive } from '../src/repr/primitives';
import { addGround, onSlope, planCtx } from './projekt';

/**
 * Marken i ritningarna (0.10.8). Exempelvillan på den sneda marken
 * (`onSlope`): ±0 = 65 m och marken x/10 mm i modellen.
 */

beforeAll(() => registerBuiltInTypes());

const platform = (store: ReturnType<typeof onSlope>) =>
  addGround(store, { kind: 'area', outline: [[20000, -5000], [30000, -5000], [30000, 5000], [20000, 5000]], height: 2500 });

describe('Marken i ritningarna (0.10.8)', () => {
  it('höjdkurvorna: heldragna där marken är orörd, den befintliga streckad bara där den ändrats', () => {
    const store = onSlope();
    const before = groundContours(store.doc, null);
    expect(before.old).toHaveLength(0);
    platform(store);
    const f = finishedTerrain(planCtx(store))!;
    const { solid, old } = groundContours(store.doc, f);
    expect(old.length).toBeGreaterThan(0);
    const inside = changedCells(f, terrainOf(store.doc)!);
    for (const c of old) {
      const [a, b] = c.pts;
      expect(inside((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)).toBe(true);
    }
    // Långt från platån är kurvorna desamma som förut.
    const far = (cs: typeof solid) => cs.flatMap((c) => c.pts).filter((q) => q[0] < 0).length;
    expect(far(solid)).toBe(far(before.solid));
    // I 3D-vyn: sträckor med sex tal var.
    const segs = contourSegments3d(store.doc, f)!;
    expect(segs.length % 6).toBe(0);
    expect(segs.length).toBeGreaterThan(0);
  });

  it('släntmarkeringar: fyll med krönet vid kanten, schakt med krönet ute vid marken', () => {
    const store = onSlope();
    const id = platform(store);
    const ctx = planCtx(store);
    const marks = groundType.plan!(store.doc.elements[id] as never, ctx).filter((p): p is Extract<Primitive, { kind: 'line' }> => p.kind === 'line' && p.origin?.part === 'slänt');
    // Väster: fyll (marken lägre än +2 500), strecken börjar vid kanten och går ut.
    const west = marks.filter((m) => m.a[0] <= 20001 && Math.abs(m.a[1]) < 4000);
    expect(west.length).toBeGreaterThan(2);
    for (const m of west) expect(m.b[0]).toBeLessThan(m.a[0]);
    // Öster: schakt, strecken börjar ute i slänten och går in mot kanten.
    const east = marks.filter((m) => m.a[0] > 30001 && Math.abs(m.a[1]) < 4000);
    expect(east.length).toBeGreaterThan(2);
    for (const m of east) expect(m.b[0]).toBeLessThan(m.a[0]);
    // Långa och korta om vartannat.
    const len = (m: (typeof marks)[number]) => Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1]);
    expect(Math.max(...west.map(len))).toBeGreaterThan(2 * Math.min(...west.map(len)));
  });

  it('runt huset en pil per fasad med fallet', () => {
    const store = onSlope();
    const id = addGround(store, { kind: 'area', outline: [], around: true });
    const prims = groundType.plan!(store.doc.elements[id] as never, planCtx(store));
    const texts = prims.filter((p) => p.kind === 'text' && p.origin?.part === 'fall');
    expect(texts.length).toBeGreaterThanOrEqual(4);
    expect(texts.every((p) => p.kind === 'text' && p.text === '1:20')).toBe(true);
  });

  it('vit jord i sektionerna, och licenstexten som smarttext', () => {
    const store = onSlope();
    platform(store);
    updateSite(store, { earthWhite: true });
    const jord = buildSection(store.doc, 'sektion-a', { state: 'st-a' })!.prims.filter((p) => p.origin?.part === 'jord');
    expect(jord.length).toBeGreaterThan(0);
    for (const p of jord) if (p.kind === 'region') expect(p.fill).toEqual({ kind: 'solid', color: 'paper' });
    const doc = { ...store.doc, site: { ...store.doc.site!, licence: 'Lantmäteriet, CC BY 4.0' } };
    const sheet = { id: 'b', name: 'Situationsplan', number: 'A-01', size: 'A3', fields: {}, viewports: [] } as never;
    expect(smartVars(doc, sheet, 'idag').licens).toBe('Lantmäteriet, CC BY 4.0');
  });
});
