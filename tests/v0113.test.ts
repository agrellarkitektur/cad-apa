import { beforeAll, describe, expect, it } from 'vitest';
import { addRailings, addDefaultRailingTypes, defaultRailingDef, railingTypesFor } from '../src/core/railings';
import { defaultGroundRailingTypes, railValues } from '../src/core/railingTypes';
import { defaultSheet } from '../src/core/viewCategories';
import { registerBuiltInTypes } from '../src/elements';
import { gateSpanAt, railingBodyOf, railingGround, railingPath, railingSolids } from '../src/elements/railing';
import { freePath, railingBody, type RailingParams } from '../src/elements/railingGeometry';
import { createContext } from '../src/repr/context';
import { buildPlan } from '../src/repr/plan';
import { addGate, railingAction } from '../src/ui/railingFields';
import { previewMarkup } from '../src/ui/style/railingPreview';
import { onSlope } from './projekt';

/**
 * Staket och grindar (0.11.3): räcket på Platsen med höjden ur den färdiga
 * marken, Trappstegat och stolpar under mark, de förvalda staketen och
 * grinden som en sträcka i räcket.
 */

beforeAll(() => registerBuiltInTypes());

const siteCtx = (store: ReturnType<typeof onSlope>) => createContext(store.doc, 'platsen', { state: 'st-a' }, defaultSheet(store.doc.graphics), () => true).ctx;

/** Ett staket på Platsen längs x (marken stiger 0,1 mm per mm österut). */
function fence(params: Partial<RailingParams> = {}, def?: string) {
  const store = onSlope();
  const [el] = addRailings(store, [{ storey: 'platsen', ...(def ? { definition: def } : {}), params: { line: [[0, 0], [9000, 0]], ...params } }], ['st-a'], 'Staket');
  return { store, id: el.id };
}

describe('Staket på Platsen (0.11.3)', () => {
  it('får ST01 och de andra staketen första gången, och följer den färdiga marken', () => {
    const { store, id } = fence();
    const el = store.doc.elements[id];
    expect(el.definition).toBe('t-st01');
    for (const d of defaultGroundRailingTypes()) expect(store.doc.definitions[d.id]).toBeTruthy();
    const path = railingPath(store.doc, el, railingGround(siteCtx(store)))!;
    expect(path.base).toBeTruthy();
    expect(path.pts.length).toBeGreaterThan(30);
    expect(path.z[0]).toBeCloseTo(0, 0);
    expect(path.z[path.z.length - 1]).toBeCloseTo(900, 0);
    // Utan mark (en våning) är linjen rak som förut.
    expect(railingPath(store.doc, el)!.base).toBeUndefined();
  });

  it('Höjden från: fast höjd tar punkternas höjd mot ±0', () => {
    const { store, id } = fence({ heightFrom: 'fixed', z: [500, 500] });
    const path = railingPath(store.doc, store.doc.elements[id], railingGround(siteCtx(store)))!;
    expect(path.base).toBeUndefined();
    expect(path.z.every((z) => Math.abs(z - 500) < 1e-6)).toBe(true);
  });

  it('Trappstegat: vågräta fack på fackets högsta punkt, stolparna under mark', () => {
    const { store, id } = fence();
    const r = railingBodyOf(store.doc, store.doc.elements[id], railingGround(siteCtx(store)))!;
    const top = r.body.along.filter((a) => a.part.id === 'overliggare');
    expect(top.length).toBe(5);
    for (const a of top) expect(Math.max(...a.top) - Math.min(...a.top)).toBeLessThan(1e-6);
    // Facken stiger åt öster.
    expect(top[4].top[0]).toBeGreaterThan(top[0].top[0] + 600);
    const posts = r.body.posts.filter((q) => q.part.id === 'stolpe');
    expect(posts.length).toBe(6);
    for (const q of posts) expect(q.z0).toBeCloseTo(q.ground! - 600, 0);
  });

  it('ST03 står i plint och följer marken', () => {
    const { store, id } = fence({}, 't-st03');
    const r = railingBodyOf(store.doc, store.doc.elements[id], railingGround(siteCtx(store)))!;
    expect(r.body.footings.length).toBe(r.body.posts.length);
    const wire = r.body.along.find((a) => a.part.id === 'trad-1')!;
    expect(Math.max(...wire.top) - Math.min(...wire.top)).toBeGreaterThan(800);
    expect(railingSolids('x', r.body, () => ({})).length).toBeGreaterThan(r.body.posts.length * 2);
  });

  it('typerna: på Platsen de med Mark först, ST01 som förval; grindtyperna sist', () => {
    const { store } = fence();
    expect(defaultRailingDef(store.doc, undefined, true)).toBe('t-st01');
    const site = railingTypesFor(store.doc, true).map((d) => d.name);
    expect(site[0]).toBe('SP01');
    expect(site[site.length - 1]).toBe('G01');
    expect(railingTypesFor(store.doc, false)[0].railing?.building).toBe(true);
    store.transact('x', (tx) => expect(addDefaultRailingTypes(tx)).toBe(0));
  });

  it('Hör till: flyttar räcket mellan Platsen och en våning', () => {
    const { store, id } = fence();
    railingAction(store, [id], 'rail-home', { dataset: { value: 'pl-1' } } as unknown as HTMLElement);
    expect(store.doc.elements[id].storey).toBe('pl-1');
  });

  it('förhandsvisningen På sluttning ritar det trappstegade och det under mark', () => {
    const m = defaultGroundRailingTypes()[0].railing!;
    const svg = previewMarkup(m, 'slope', null);
    expect(svg).toContain('rtp-below');
    expect(svg).not.toContain('från 0.11.3');
  });
});

describe('Grinden (0.11.3)', () => {
  it('Gör till grind: facket där man klickade, med grindstolpar och avbrutna liggare', () => {
    const { store, id } = fence();
    const span = gateSpanAt(store.doc, store.doc.elements[id], [2700, 0])!;
    expect(span.at).toBeCloseTo(1800 + 35, 0);
    expect(span.width).toBeCloseTo(1800 - 70, 0);
    expect(addGate(store, id, span)).toBe(0);
    const el = store.doc.elements[id];
    expect((el.params as RailingParams).gates![0].littera).toBe('G02');
    const r = railingBodyOf(store.doc, el, railingGround(siteCtx(store)))!;
    expect(r.body.gates.length).toBe(1);
    expect(r.body.posts.filter((q) => q.part.id === 'grindstolpe').length).toBe(2);
    // Överliggaren i fyra fack (det femte är grinden), bladet har sin egen.
    expect(r.body.along.filter((a) => a.part.id === 'overliggare').length).toBe(4);
    expect(r.body.gates[0].leaves[0].body.along.some((a) => a.part.id === 'overliggare')).toBe(true);
    // Inga spjälor i grindens fack.
    expect(r.body.repeats.every((q) => q.at[0] < span.at || q.at[0] > span.at + span.width)).toBe(true);
  });

  it('i planen: bladet öppet 90°, slagbågen och litteran; par och skjut', () => {
    const { store, id } = fence();
    addGate(store, id, { at: 2000, width: 1000 });
    const plan = () => buildPlan(store.doc, 'platsen', { state: 'st-a', detail: 'normal' }, defaultSheet(store.doc.graphics)).prims.filter((q) => q.origin?.objectId === id && q.origin.part === 'grind');
    let prims = plan();
    expect(prims.filter((q) => q.kind === 'arc').length).toBe(1);
    expect(prims.some((q) => q.kind === 'text' && q.text === 'G02')).toBe(true);
    const leaf = prims.find((q) => q.kind === 'line')!;
    if (leaf.kind === 'line') expect(Math.abs(leaf.b[1] - leaf.a[1])).toBeCloseTo(1000, 0);
    railingAction(store, [id], 'rail-gate-hang', { dataset: { index: '0', value: 'pair' } } as unknown as HTMLElement);
    prims = plan();
    expect(prims.filter((q) => q.kind === 'arc').length).toBe(2);
    railingAction(store, [id], 'rail-gate-hang', { dataset: { index: '0', value: 'slide' } } as unknown as HTMLElement);
    expect(plan().filter((q) => q.kind === 'arc').length).toBe(0);
  });

  it('en grindtyp ger bladet sina delar; utåt och inåt byter sida', () => {
    const fenceModel = defaultGroundRailingTypes()[0].railing!;
    const g01 = defaultGroundRailingTypes().find((d) => d.id === 't-g01')!.railing!;
    const path = freePath({ line: [[0, 0], [6000, 0]] })!;
    const opts = (swing?: 'in') => ({ gates: [{ id: 'g', at: 2000, width: 1200, type: 't-g01', ...(swing ? { swing } : {}) }], gateModel: () => ({ model: g01, vals: railValues(g01) }) });
    const out = railingBody(path, fenceModel, railValues(fenceModel), opts());
    expect(out.gates[0].leaves[0].body.posts.map((q) => q.part.id)).toEqual(['sidstycke', 'sidstycke']);
    const inn = railingBody(path, fenceModel, railValues(fenceModel), opts('in'));
    expect(Math.sign(out.gates[0].out[1])).toBe(-Math.sign(inn.gates[0].out[1]));
  });
});

describe('Längs andra kanter (0.11.3)', () => {
  it('Längs kant: sidan man klickar på, Shift tar hela konturen; stödmurens krön ger fast höjd', async () => {
    const { DocStore } = await import('../src/core/store');
    const { sampleProject } = await import('../src/sample/sampleProject');
    const { RailingTool } = await import('../src/ui/tools/railingTool');
    const { toolHost, groundProject } = await import('./projekt');
    const store = new DocStore(structuredClone(sampleProject()));
    const sq: [number, number][] = [[0, 0], [4000, 0], [4000, 3000], [0, 3000]];
    const host = { ...toolHost(store), snapSegments: () => sq.map((a, i) => ({ id: 'hal', a, b: sq[(i + 1) % 4] })) };
    const tool = new RailingTool(host as never);
    const at = (x: number, y: number, shift = false) => ({ model: [x, y] as [number, number], screen: [0, 0] as [number, number], pointerType: 'mouse', shift, mod: false, alt: false });
    tool.up(at(2000, 5));
    tool.up(at(2000, 3005, true));
    const made = Object.values(store.doc.elements).filter((e) => e.type === 'Railing');
    expect(made.length).toBe(2);
    expect((made[0].params as RailingParams).line).toEqual([[0, 0], [4000, 0]]);
    expect((made[1].params as RailingParams).line!.length).toBe(5);
    // Stödmuren på Platsen: krönets höjd, fast.
    const g = new DocStore(groundProject());
    const site = new RailingTool(toolHost(g, [], 'platsen') as never);
    site.createLine([[14500, 500], [19500, 500]], undefined, [0, 0], 'm-stod');
    const r = Object.values(g.doc.elements).find((e) => e.type === 'Railing')!;
    const p = r.params as RailingParams;
    expect(p.heightFrom).toBe('fixed');
    expect(p.z!.some((z) => Math.abs(z) > 100)).toBe(true);
    expect(r.definition).toBe('t-st01');
  });
});
