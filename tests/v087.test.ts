import { beforeAll, describe, expect, it } from 'vitest';
import { addViewport, createSheet, setViewportCrop, updateViewport } from '../src/core/sheets';
import { DocStore } from '../src/core/store';
import { registerBuiltInTypes } from '../src/elements';
import { buildSheet, centeredAt, contentCrop, modelToPaper } from '../src/repr/sheet';
import { sampleProject } from '../src/sample/sampleProject';
import { parse, serialize } from '../src/storage/format';

beforeAll(() => registerBuiltInTypes());

const today = '2026-10-20';
const titleTexts = (d: ReturnType<typeof buildSheet>) => d.prims.filter((p) => p.kind === 'text' && p.origin?.objectType === 'ViewTitle').map((p) => (p.kind === 'text' ? p.text : ''));

describe('vyernas ram (0.8.7)', () => {
  it('skalan i vyns rubrik går att dölja', () => {
    const store = new DocStore(sampleProject());
    const id = createSheet(store);
    const vp = addViewport(store, id, { view: 'vy-a-bl', scale: 100, at: centeredAt(store.doc, 'vy-a-bl', 100, [150, 160]) })!;
    const scaleShown = () => titleTexts(buildSheet(store.doc, store.doc.sheets[0], { today })).some((t) => t.startsWith('SKALA'));
    expect(scaleShown()).toBe(true);
    updateViewport(store, id, vp, { hideScale: true });
    expect(store.doc.sheets[0].viewports[0].hideScale).toBe(true);
    expect(scaleShown()).toBe(false);
    updateViewport(store, id, vp, { hideScale: false });
    expect(store.doc.sheets[0].viewports[0]).not.toHaveProperty('hideScale');
    expect(scaleShown()).toBe(true);
  });

  it('vyns ram: klipper det som ritas, följer skalan och återställs till innehållet', () => {
    const store = new DocStore(sampleProject());
    const id = createSheet(store, { size: 'A1' });
    const vp = addViewport(store, id, { view: 'vy-a-bl', scale: 100, at: centeredAt(store.doc, 'vy-a-bl', 100, [400, 300]) })!;
    const full = buildSheet(store.doc, store.doc.sheets[0], { today }).views[0];
    const content = contentCrop(store.doc, store.doc.sheets[0].viewports[0])!;
    expect(modelToPaper(content, full.at, full.scale).minX).toBeCloseTo(full.frame.minX);
    expect(full.cropped).toBeFalsy();
    // Halva bredden: allt som ritas ligger inom ramen.
    const crop = { minX: content.minX, minY: content.minY, maxX: (content.minX + content.maxX) / 2, maxY: content.maxY };
    setViewportCrop(store, id, vp, crop);
    const v = buildSheet(store.doc, store.doc.sheets[0], { today }).views[0];
    expect(v.cropped).toBe(true);
    expect(v.frame.maxX).toBeCloseTo(full.at[0] + Math.round(crop.maxX) / 100);
    const drawn = v.prims.filter((p) => p.origin?.objectType !== 'ViewTitle');
    expect(drawn.length).toBeGreaterThan(0);
    const xs = drawn.flatMap((p) => (p.kind === 'line' ? [p.a[0], p.b[0]] : p.kind === 'polyline' ? p.points.map((q) => q[0]) : p.kind === 'region' ? p.rings.flat().map((q) => q[0]) : []));
    expect(Math.max(...xs)).toBeLessThanOrEqual(v.frame.maxX + 1e-6);
    // Ramen ligger i modellens koordinater: i 1:50 blir den dubbelt så stor på papperet.
    updateViewport(store, id, vp, { scale: 50 });
    const v50 = buildSheet(store.doc, store.doc.sheets[0], { today }).views[0];
    expect(v50.frame.maxX - v50.frame.minX).toBeCloseTo(2 * (v.frame.maxX - v.frame.minX), 1);
    setViewportCrop(store, id, vp, null);
    expect(store.doc.sheets[0].viewports[0]).not.toHaveProperty('crop');
    expect(buildSheet(store.doc, store.doc.sheets[0], { today }).views[0].cropped).toBeFalsy();
  });

  it('dold skala och ram sparas och läses', () => {
    const store = new DocStore(sampleProject());
    const id = createSheet(store);
    const vp = addViewport(store, id, { view: 'vy-a-bl', scale: 100, at: [100, 100] })!;
    updateViewport(store, id, vp, { hideScale: true });
    setViewportCrop(store, id, vp, { minX: 0, minY: 0, maxX: 5000, maxY: 4000 });
    const back = parse(serialize(store.doc));
    expect(back.sheets[0].viewports[0]).toMatchObject({ hideScale: true, crop: { minX: 0, minY: 0, maxX: 5000, maxY: 4000 } });
  });
});
