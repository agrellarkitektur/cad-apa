import { beforeAll, describe, expect, it } from 'vitest';
import type { ViewDef } from '../src/core/model';
import { applySitePackage, parseSitePackage } from '../src/core/siteImport';
import { localToZone } from '../src/core/site';
import { TRACE_ABOVE, TRACE_BELOW, TRACE_SITE } from '../src/core/storeys';
import { resolveSource, sourceName } from '../src/core/underlaySources';
import { categoryOf, effectiveCategory, overridesFrom, resolveShow, showOverrides, viewSettings } from '../src/core/viewCategories';
import { normalizeUnderlays, toggleUnderlay, UNDERLAY_ORTHO, UNDERLAY_WORKSHEET } from '../src/core/viewUnderlays';
import { registerBuiltInTypes } from '../src/elements';
import type { Primitive } from '../src/repr/primitives';
import { buildSheet, buildViewPrims, contentBounds, legendSources, placeView } from '../src/repr/sheet';
import { grayOf, isViewUnderlay, lookPrims, orthoPrim } from '../src/repr/viewUnderlays';
import { sampleProject } from '../src/sample/sampleProject';
import { parse, serialize } from '../src/storage/format';
import { changedRows, resetRow } from '../src/ui/style/deviations';
import { editUnderlays } from '../src/ui/underlayRows';
import { onSlope, slopeSite, twoStoreys } from './projekt';

/**
 * Underlag i vyn (0.10.35): en våning, Platsen, ortofotot, ett arbetsblad
 * eller en annan vy, ritade under eller över vyn och med den på bladet.
 */

beforeAll(() => registerBuiltInTypes());

const plan2: ViewDef = { id: 'vy-p2', name: 'Plan 2', storey: 'pl-2', state: 'st-a' };
const withUnderlays = (v: ViewDef, underlays: unknown): ViewDef => ({ ...v, overrides: { ...(v.overrides ?? {}), underlays } });

describe('underlagen i vyns visning', () => {
  it('ligger i kategorin och avviker i vyn som en rad', () => {
    const doc = sampleProject();
    const plan = categoryOf(doc.graphics, 'storey');
    const cur = effectiveCategory(plan, { underlays: [{ source: TRACE_BELOW }] });
    expect(cur.show.underlays).toEqual([{ source: TRACE_BELOW }]);
    expect(overridesFrom(plan, cur)).toEqual({ underlays: [{ source: TRACE_BELOW }] });
    expect(changedRows(plan, cur, [], false)).toEqual(new Set(['underlays']));
    expect(resetRow(cur, plan, 'underlays').show.underlays).toBeUndefined();
    // Samma som kategorin: ingen avvikelse. En tom lista i vyn tar bort kategorins.
    const cat = { ...plan, show: { ...plan.show, underlays: [{ source: TRACE_SITE }] } };
    expect(showOverrides(cat, resolveShow(cat, undefined))).toEqual({});
    expect(resolveShow(cat, { underlays: [] }).underlays).toBeUndefined();
  });

  it('läses från fil med gränserna, och den gamla kalkeringen blir ett underlag', () => {
    expect(normalizeUnderlays([{ source: 'a', opacity: 300, look: 'x', color: '#ABCDEF', above: 1 }, { opacity: 20 }, null])).toEqual([{ source: 'a', opacity: 100, color: '#abcdef' }]);
    const doc = sampleProject();
    const raw = JSON.parse(serialize(doc));
    raw.views[0].trace = TRACE_BELOW;
    const read = parse(JSON.stringify(raw));
    expect(read.views[0]).not.toHaveProperty('trace');
    expect(viewSettings(read, read.views[0]).show.underlays).toEqual([{ source: TRACE_BELOW }]);
    // Sparas och läses som det är.
    expect(parse(serialize(read)).views[0].overrides).toEqual(read.views[0].overrides);
  });

  it('raderna ändrar listan: över, sättet, färgen, procent och ta bort; Kalkera lägger till och tar bort', () => {
    const field = (ul: number, f: string, value = '', v?: string) => ({ closest: () => ({ dataset: { ul: String(ul), ulField: f, ...(v ? { v } : {}) }, value }) }) as unknown as Element;
    let list = toggleUnderlay(undefined, 'vy-a');
    list = editUnderlays(list, field(0, 'above', '', '1'))!;
    list = editUnderlays(list, field(0, 'look', 'color'))!;
    list = editUnderlays(list, field(0, 'opacity', '3'))!;
    expect(list).toEqual([{ source: 'vy-a', above: true, look: 'color', color: '#c2372c', opacity: 5 }]);
    list = editUnderlays(list, field(0, 'look', 'tinted'))!;
    list = editUnderlays(list, field(0, 'opacity', '40'))!;
    expect(list).toEqual([{ source: 'vy-a', above: true, color: '#c2372c' }]);
    expect(editUnderlays(list, field(0, 'remove'))).toEqual([]);
    expect(toggleUnderlay(list, 'vy-a')).toEqual([]);
  });
});

describe('källorna', () => {
  it('våningarna gäller i planer, vyerna och arbetsbladen överallt, och vyn själv aldrig', () => {
    const doc = twoStoreys();
    const plan = { storey: 'pl-2', plan: true, viewId: 'vy-a' };
    expect(resolveSource(doc, plan, TRACE_BELOW)).toEqual({ kind: 'storey', storey: 'pl-1' });
    expect(resolveSource(doc, plan, TRACE_ABOVE)).toBeNull();
    expect(resolveSource(doc, plan, 'vy-a')).toBeNull();
    expect(resolveSource(doc, plan, 'vy-bef')).toEqual({ kind: 'view', id: 'vy-bef' });
    expect(resolveSource(doc, plan, UNDERLAY_ORTHO)).toBeNull();
    // I en fasad finns inga våningar.
    expect(resolveSource(doc, { storey: 'pl-1', plan: false }, TRACE_SITE)).toBeNull();
    expect(resolveSource(doc, { storey: 'pl-1', plan: false }, 'vy-bef')).not.toBeNull();
    // Ett mallblad är inget arbetsblad.
    expect(resolveSource(doc, plan, UNDERLAY_WORKSHEET + 'mall-a3')).toBeNull();
    expect(sourceName(doc, TRACE_BELOW, 'pl-2')).toBe('Våningen under (Plan 1)');
    expect(sourceName(doc, 'borta')).toBe('Vyn finns inte längre');
  });

  it('ortofotot ligger i planen där 3D-vyn lägger det, också med vriden modell', () => {
    const store = onSlope();
    applySitePackage(store, parseSitePackage(JSON.stringify(slopeSite({ ortofoto: { bild: 'data:image/jpeg;base64,QUJD', x0: 1000.125, y1: 5079.875, s: 0.25, W: 400, H: 320 } }))));
    for (const rotation of [0, 30]) {
      const site = { ...store.doc.site!, rotation };
      const p = orthoPrim({ site }) as Extract<Primitive, { kind: 'image' }>;
      // Bildens nedre vänstra och övre högra hörn i zonen.
      const at = (q: readonly number[]) => localToZone(site, q[0], q[1]);
      expect(at(p.corner)[0]).toBeCloseTo(1000, 6);
      expect(at(p.corner)[1]).toBeCloseTo(5000, 6);
      const tr = [p.corner[0] + p.u[0] + p.v[0], p.corner[1] + p.u[1] + p.v[1]];
      expect(at(tr)[0]).toBeCloseTo(1100, 6);
      expect(at(tr)[1]).toBeCloseTo(5080, 6);
    }
  });
});

describe('utseendet', () => {
  const prims: Primitive[] = [
    { kind: 'line', a: [0, 0], b: [1, 0], pen: { weight: 0.25, color: '#336699' }, origin: { objectId: 'v1', objectType: 'Wall' } },
    { kind: 'region', role: 'cut', rings: [[[0, 0], [1, 0], [1, 1]]], fill: { kind: 'solid', color: 'paper' }, outline: null, under: true },
    { kind: 'region', role: 'cut', rings: [[[0, 0], [1, 0], [1, 1]]], fill: { kind: 'hatch', color: 'ink', angle: 45, spacing: 2, weight: 0.13, background: 'paper' }, outline: { weight: 0.5 } },
  ];

  it('tonad, gråskala, i en färg och bara konturer; utan objektets id', () => {
    const [l, white, hatch] = lookPrims(prims, { source: 'x' });
    expect(l).toMatchObject({ pen: { color: '#336699', opacity: 0.4 }, origin: { objectType: 'ViewUnderlay', part: 'under' } });
    expect(l.origin).not.toHaveProperty('objectId');
    expect(white).not.toHaveProperty('under');
    expect(hatch).toMatchObject({ fill: { opacity: 0.4, backgroundOpacity: 0.4 }, outline: { opacity: 0.4 } });
    expect(grayOf('#336699')).toBe('#5d5d5d');
    expect(lookPrims(prims, { source: 'x', look: 'gray' })[0]).toMatchObject({ pen: { color: '#5d5d5d' } });
    expect(lookPrims(prims, { source: 'x', look: 'color', color: '#ff0000' })[0]).toMatchObject({ pen: { color: '#ff0000' } });
    const outline = lookPrims(prims, { source: 'x', look: 'outline' });
    expect(outline[1]).toMatchObject({ fill: { kind: 'none' }, outline: { weight: 0.13 } });
    // Över ritningen: inga vita fyllningar som döljer den.
    const over = lookPrims(prims, { source: 'x', above: true, opacity: 100 });
    expect(over[1]).toMatchObject({ fill: { kind: 'none' }, origin: { part: 'över' } });
    expect(over[2]).toMatchObject({ fill: { kind: 'hatch', background: null } });
  });
});

describe('i vyn och på bladet', () => {
  it('våningen under ritas under vyn och klipps mot vyns ram; ramen räknar inte med den', () => {
    const doc = twoStoreys();
    const bare = buildViewPrims(doc, plan2, { scale: 100 });
    const v = withUnderlays(plan2, [{ source: TRACE_BELOW }, { source: 'vy-bef', above: true }]);
    const all = buildViewPrims(doc, v, { scale: 100 });
    const under = all.filter((p) => isViewUnderlay(p) && p.origin?.part === 'under');
    const over = all.filter((p) => isViewUnderlay(p) && p.origin?.part === 'över');
    expect(under.length).toBeGreaterThan(10);
    expect(over.length).toBeGreaterThan(10);
    expect(all.indexOf(under.at(-1)!)).toBeLessThan(all.indexOf(over[0]));
    expect(contentBounds(all)).toEqual(contentBounds(bare));
    // En vy som är underlag ritas utan sina egna underlag (ingen rundgång).
    doc.views.push(v, withUnderlays({ ...plan2, id: 'vy-b', storey: 'pl-1' }, [{ source: 'vy-p2' }]));
    expect(buildViewPrims(doc, doc.views.at(-1)!, { scale: 100 }).filter(isViewUnderlay).length).toBe(bare.length);
  });

  it('följer med till bladet, över det ritade, och räknas inte i teckenförklaringen', () => {
    const doc = twoStoreys();
    doc.views.push(withUnderlays(plan2, [{ source: TRACE_BELOW, above: true }]));
    const sheet = { id: 'bl-1', number: 'A-01', name: 'Plan', fields: {}, paper: 'A3' as const, viewports: [{ id: 'vp-1', view: 'vy-p2', at: [200, 150] as [number, number], scale: 100 }] };
    doc.sheets.push(sheet as never);
    const placed = placeView(doc, sheet.viewports[0]);
    const firstOver = placed.prims.findIndex(isViewUnderlay);
    expect(firstOver).toBeGreaterThan(0);
    expect(placed.prims.slice(firstOver).filter((p) => !isViewUnderlay(p)).length).toBeLessThan(10); // bara rubriken efter
    expect(buildSheet(doc, sheet as never, { today: '2026-10-30' }).prims.some(isViewUnderlay)).toBe(true);
    const legend = legendSources(doc, [placed]);
    const alone = legendSources(doc, [placeView({ ...doc, views: doc.views.map((x) => (x.id === 'vy-p2' ? plan2 : x)) }, sheet.viewports[0])]);
    expect(legend[0].materials).toEqual(alone[0].materials);
  });
});
