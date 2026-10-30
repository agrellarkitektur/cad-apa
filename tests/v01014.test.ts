import { defaultSheet } from '../src/core/viewCategories';
import { beforeAll, describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { updateSite } from '../src/core/siteImport';
import { registerBuiltInTypes } from '../src/elements';
import { fillPrims, type FillParams } from '../src/elements/drawing2d';
import { groundType } from '../src/elements/ground';
import { slopeArea } from '../src/elements/groundSlopes';
import { groundGeometry } from '../src/elements/groundGeometry';
import { moveVertically, setLevel } from '../src/core/levels';
import { modelShapes, WITHOUT_DEMOLISHED } from '../src/repr/storeyShapes';
import type { Solid } from '../src/repr/solids';
import { sampleProject } from '../src/sample/sampleProject';
import { fillChange, shapeChange } from '../src/ui/shapeFields';
import { fillPanel, fillPatch, FILL_PRESETS } from '../src/ui/fillPanel';
import { moveZValue } from '../src/ui/app/commandLine';
import { anchorLines } from '../src/elements/drawing2d';
import { hatchStrokes } from '../src/core/hatchStrokes';
import { addGround, onSlope, planCtx, storeWithShapes, square } from './projekt';

beforeAll(() => registerBuiltInTypes());

const attrs = (k: string) => `data-key="d2:${k}"`;
const input = (value: string) => ({ value, checked: false }) as HTMLInputElement;

describe('Fyllningar och opacitet (0.10.14)', () => {
  it('panelen har fyra lägen och fälten för det valda', () => {
    const none = fillPanel('x', { fillAngle: 45, fillSpacing: 2 }, attrs);
    for (const k of ['none', 'solid', 'mask', 'pattern']) expect(none).toContain(`value="${k}"`);
    expect(none).not.toContain('d2:fillOpacity');
    // Solid: färg, tio steg och ett skrivet värde, och förslagen.
    const solid = fillPanel('x', { fill: 'solid', fillOpacity: 40, fillAngle: 45, fillSpacing: 2 }, attrs);
    expect(solid.match(/data-key="d2:fillOpacity"/g)).toHaveLength(11);
    expect(solid).toMatch(/value="40" data-key="d2:fillOpacity" checked/);
    expect(solid).toContain('d2:fillPreset');
    // Mask: samma tio steg och skrivna värde (0.10.15.1).
    const mask = fillPanel('x', { fill: 'mask', fillOpacity: 35, fillAngle: 45, fillSpacing: 2 }, attrs);
    expect(mask.match(/data-key="d2:fillOpacity"/g)).toHaveLength(11);
    expect(mask).toContain(`data-key="d2:fillOpacity" value="35"`);
    // Mönster: penna, vinkel, bakgrund.
    const hatch = fillPanel('x', { fill: 'hatch', fillAngle: 30, fillSpacing: 2, fillBackground: 'paper' }, attrs);
    for (const k of ['fillWeight', 'fillAngle', 'fillSpacing', 'fillBackgroundKind', 'fillBackgroundOpacity', 'pattern']) expect(hatch).toContain(`d2:${k}`);
  });

  it('ändringarna i panelen', () => {
    const p: FillParams = { fill: 'solid', fillAngle: 45, fillSpacing: 2 };
    expect(fillPatch('fillKind', 'pattern', p)!.patch).toEqual({ fill: 'hatch' });
    expect(fillPatch('fillKind', 'pattern', { ...p, fill: 'cross' })).toBeNull();
    expect(fillPatch('fillKind', 'none', p)!.patch).toEqual({ fill: undefined });
    expect(fillPatch('pattern', 'type:tegel', p)!.patch).toEqual({ fill: 'type', fillType: 'tegel' });
    expect(fillPatch('fillOpacity', '130', p)!.patch).toEqual({ fillOpacity: 100 });
    expect(fillPatch('fillWeight', '0', p)!.patch).toEqual({ fillWeight: undefined });
    expect(fillPatch('fillBackgroundKind', 'color', p)!.patch).toEqual({ fillBackground: '#ffffff' });
    expect(fillPatch('fillBackgroundKind', 'none', { ...p, fillBackground: 'paper' })!.patch).toEqual({ fillBackground: undefined, fillBackgroundOpacity: undefined });
    const white = FILL_PRESETS.find((f) => f.id === 'vit')!;
    expect(fillPatch('fillPreset', 'vit', p)!.patch).toBe(white.patch);
  });

  it('mönstrets penna; linjens opacitet ändrar inte längre fyllningens', () => {
    const p: FillParams = { fill: 'hatch', fillAngle: 45, fillSpacing: 2, fillWeight: 0.35 };
    const [h] = fillPrims([square(0, 0)], p, undefined, false);
    expect(h.kind === 'region' && h.fill.kind === 'pattern' && h.fill.weight).toBe(0.35);
    const [t] = fillPrims([square(0, 0)], { ...p, fill: 'type', fillType: 'betong' }, undefined, false);
    expect(t.kind === 'region' && t.fill.kind === 'pattern' && t.fill.weight).toBe(0.35);

    const store = storeWithShapes({ a: { points: square(0, 0), closed: true, fill: 'solid', opacity: 60 } });
    shapeChange(store, ['a'], 'opacity', input('30'));
    expect(store.doc.elements.a.params).toMatchObject({ opacity: 30, fillOpacity: 60 });
    // Ett förslag i panelen sätter alla fält på en gång, med ett steg att ångra.
    fillChange(store, ['a'], 'fillPreset', input('gra'));
    expect(store.doc.elements.a.params).toMatchObject({ fill: 'solid', fillColor: '#9aa0a6', fillOpacity: 50 });
  });

  it('slänternas fyllning: ytan släntmarkeringarna täcker, bakom objektets egen', () => {
    const store = onSlope();
    const id = addGround(store, { kind: 'area', outline: [[20000, -5000], [30000, -5000], [30000, 5000], [20000, 5000]], height: 2500, fill: 'solid' });
    const ctx = planCtx(store);
    const g = groundGeometry(ctx, store.doc.elements[id])!;
    const area = slopeArea(ctx, g);
    expect(area.length).toBeGreaterThan(0);
    // Ytan ligger utanför konturen, på båda sidor där slänten går.
    const xs = area.flatMap((poly) => poly[0].map((q) => q[0]));
    expect(Math.min(...xs)).toBeLessThan(19000);
    expect(Math.max(...xs)).toBeGreaterThan(31000);
    expect(slopeArea(ctx, g)).toBe(area);

    fillChange(store, [id], 'fillKind', input('pattern'), 'slopeFill');
    expect(store.doc.elements[id].params.slopeFill).toEqual({ fill: 'hatch' });
    const prims = groundType.plan!(store.doc.elements[id] as never, planCtx(store));
    const slope = prims.findIndex((q) => q.origin?.part === 'släntens fyllning');
    const own = prims.findIndex((q) => q.origin?.part === 'fyllning');
    expect(slope).toBeGreaterThanOrEqual(0);
    expect(slope).toBeLessThan(own);
    fillChange(store, [id], 'fillKind', input('none'), 'slopeFill');
    expect(store.doc.elements[id].params.slopeFill).toBeUndefined();

    // Rampen (0.10.21.1): panelen hade fältet, men planen ritade inte fyllningen.
    const ramp = addGround(store, { kind: 'path', outline: [], line: [[20000, -20000], [30000, -20000]], height: 2500, endHeight: 2800, slopeFill: { fill: 'solid' } } as never);
    const rp = groundType.plan!(store.doc.elements[ramp] as never, planCtx(store));
    expect(rp[0].origin?.part).toBe('släntens fyllning');
  });

  it('släntstreckens avstånd följer Platsen (0.10.21.1): 5 mm på papperet som förval', () => {
    const store = onSlope();
    const id = addGround(store, { kind: 'area', outline: [[20000, -5000], [30000, -5000], [30000, 5000], [20000, 5000]], height: 2500 });
    const marks = (s: DocStore) => groundType.plan!(s.doc.elements[id] as never, planCtx(s)).filter((q) => q.origin?.part === 'slänt').length;
    const five = marks(store);
    expect(five).toBeGreaterThan(10);
    updateSite(store, { ground: { markSpacing: 2.5 } });
    expect(marks(store)).toBeGreaterThan(five * 1.8);
  });
});

describe('Mönstrets mått och utgångspunkt, sparade fyllningar (0.10.14)', () => {
  it('mönstret utgår från första hörnet och följer med när objektet flyttas', () => {
    // En linje i mönstret går genom punkten, i papperets mått (skala 1:50).
    const [l] = anchorLines([{ angle: 30, spacing: 2 }], [1234, 567], 50);
    const strokes = hatchStrokes(l, { minX: 0, minY: 0, maxX: 60, maxY: 30 });
    const at = [1234 / 50, 567 / 50];
    const off = Math.min(...strokes.map((q) => Math.abs((at[0] - q.a[0]) * Math.sin((30 * Math.PI) / 180) - (at[1] - q.a[1]) * Math.cos((30 * Math.PI) / 180))));
    expect(off).toBeLessThan(1e-3);
    // Flyttat ett halvt avstånd: samma mönster, ett halvt avstånd förskjutet.
    const a = fillPrims([square(0, 0)], { fill: 'hatch', fillAngle: 0, fillSpacing: 2 }, undefined, false, undefined, 50);
    const b = fillPrims([square(0, 50)], { fill: 'hatch', fillAngle: 0, fillSpacing: 2 }, undefined, false, undefined, 50);
    const phase = (q: (typeof a)[number]) => (q.kind === 'region' && q.fill.kind === 'pattern' ? q.fill.lines[0].phase![1] : NaN);
    expect(Math.abs(phase(b[0]) - phase(a[0]))).toBeCloseTo(1);
  });

  it('skrafferingen i verkliga mått; fyllningstypens mått kan bytas', () => {
    const [h] = fillPrims([square(0, 0)], { fill: 'hatch', fillAngle: 45, fillSpacing: 100, fillModel: true }, undefined, false, undefined, 50);
    expect(h.kind === 'region' && h.fill.kind === 'pattern' && h.fill.lines[0].spacing).toBe(2);
    const tile = (model?: boolean) => {
      const [t] = fillPrims([square(0, 0)], { fill: 'type', fillType: 'plattor300', fillAngle: 45, fillSpacing: 2, fillModel: model }, undefined, false, undefined, 50);
      return t.kind === 'region' && t.fill.kind === 'pattern' ? t.fill.lines[0].spacing : NaN;
    };
    expect(tile()).toBe(6);
    expect(tile(false)).toBe(300);
    expect(fillPatch('fillModel', 'model', { fill: 'hatch', fillAngle: 45, fillSpacing: 2 })!.patch).toEqual({ fillModel: true, fillSpacing: 100 });
  });
});

const solidsOf = (s: DocStore, id: string): Solid[] =>
  modelShapes(s.doc, { state: s.doc.states.at(-1)!.id }, defaultSheet(s.doc.graphics), WITHOUT_DEMOLISHED).shapes.map((x) => x.s).filter((x): x is Solid => x.kind !== 'edges' && x.id === id);

describe('Svaren 27 oktober (0.10.14)', () => {
  it('fönstrets bröstning från våningens golv, eller från väggens fot', () => {
    const s = new DocStore(sampleProject());
    const win = Object.values(s.doc.elements).find((e) => e.type === 'Window' && e.host)!;
    const low = () => Math.min(...solidsOf(s, win.id).map((x) => x.z0));
    const before = low();
    setLevel(s, [win.host!], 300);
    expect(low()).toBeCloseTo(before);
    s.transact('fot', (tx) => tx.putElement({ ...s.doc.elements[win.id], params: { ...s.doc.elements[win.id].params, sillFromWall: true } }));
    expect(low()).toBeCloseTo(before + 300);
    moveVertically(s, [win.host!], 100);
    expect(low()).toBeCloseTo(before + 400);
  });

  it('M Z -500 och Z -500 medan Flytta pågår', () => {
    expect(moveZValue('M Z -500', false)).toBe(-500);
    expect(moveZValue('fz 250,5', false)).toBe(250.5);
    expect(moveZValue('flytta z −300', false)).toBe(-300);
    expect(moveZValue('z -500', false)).toBeNull();
    expect(moveZValue('z -500', true)).toBe(-500);
    expect(moveZValue('m 500', true)).toBeNull();
  });
});
