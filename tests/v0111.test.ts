import { beforeAll, describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { emptyProject, type Element } from '../src/core/model';
import { defaultRailingTypes, evalFormula, railValues } from '../src/core/railingTypes';
import { registerBuiltInTypes } from '../src/elements';
import { stairGeometry, type StairParams } from '../src/elements/stairGeometry';
import { freePath, hostedPath, nosingLine, railingBody } from '../src/elements/railingGeometry';
import { railingPath, railingWarnings, stairHandrailWarning, railingSolids, railingBodyOf } from '../src/elements/railing';
import { buildPlan } from '../src/repr/plan';
import { buildSection } from '../src/repr/section';
import { defaultSheet } from '../src/core/viewCategories';

/**
 * Räcket (0.11.1): typmodellen med formler, linjen längs trappans kant
 * (utjämnad eller hoppande vid kilstegen), delarna, planen och varningarna.
 */

beforeAll(() => registerBuiltInTypes());

const stairP = (over: Partial<StairParams> = {}): StairParams => ({ line: [[0, 0], [4000, 0]], width: 1000, rise: 2700, ...over });
const RA01 = defaultRailingTypes()[0];

/** Ett projekt med en trappa och räcken. */
function project(stair: Partial<StairParams> = {}, railings: { side: 'left' | 'right'; def?: string; params?: Record<string, unknown> }[] = []) {
  const doc = emptyProject('Räcke', 'nybyggnad');
  for (const d of defaultRailingTypes()) doc.definitions[d.id] = d;
  const st: Element = { id: 'tr', type: 'Stair', storey: 'pl-1', states: ['st-ny'], tags: [], params: { ...stairP(stair) }, props: {} };
  doc.elements.tr = st;
  railings.forEach((r, i) => {
    doc.elements[`ra${i}`] = { id: `ra${i}`, type: 'Railing', storey: 'pl-1', states: ['st-ny'], tags: [], host: 'tr', definition: r.def ?? 't-ra01', params: { host: { side: r.side }, ...r.params }, props: {} };
  });
  return new DocStore(doc);
}

describe('Räckestypen (0.11.1)', () => {
  it('räknar formler med typens parametrar, och räckets egna värden där typen tillåter', () => {
    expect(evalFormula('Skyddshöjd - 40', (n) => (n === 'Skyddshöjd' ? 900 : undefined))).toBe(860);
    expect(evalFormula('2*(a+1)', (n) => (n === 'a' ? 2 : undefined))).toBe(6);
    expect(evalFormula('okänd + 1', () => undefined)).toBeNull();
    const m = RA01.railing!;
    expect(railValues(m).get('Ledstångshöjd')).toBe(860);
    // Skyddshöjden får ändras per räcke, och ledstången följer formeln.
    expect(railValues(m, { Skyddshöjd: 1100 }).get('Ledstångshöjd')).toBe(1060);
    // Stolpdelningen hör till typen.
    expect(railValues(m, { Stolpdelning: 500 }).get('Stolpdelning')).toBe(1200);
  });
});

describe('Räckets linje (0.11.1)', () => {
  it('följer stegnoslinjen längs en rak trappa, innanför kanten', () => {
    const g = stairGeometry(stairP())!;
    const nose = nosingLine(g);
    expect(nose[0]).toMatchObject({ u: 0, z: g.riserHeight });
    expect(nose.at(-1)).toMatchObject({ u: 4000, z: 2700 });
    const path = hostedPath(g, { place: 'on', transition: 'knee' }, { side: 'left' })!;
    expect(path.pts[0][1]).toBeCloseTo(500);
    expect(path.z[0]).toBeCloseTo(180);
    expect(path.z.at(-1)).toBeCloseTo(2700);
    // Innanför: 50 mm in mot trappan.
    const inside = hostedPath(g, {}, { side: 'left' })!;
    expect(inside.pts[0][1]).toBeCloseTo(450);
    expect(inside.inward).toBe(-1);
  });

  it('jämnar ut vid kilstegen som förval, och hoppar med Hoppande', () => {
    const g = stairGeometry(stairP({ line: [[0, 0], [3000, 0], [3000, 2500]] }))!;
    const smooth = hostedPath(g, { transition: 'knee' }, { side: 'left' })!;
    const stepped = hostedPath(g, { transition: 'knee', winder: 'stepped' }, { side: 'left' })!;
    // Den inre kanten (vänster i en vänstersväng) har ett hopp vid hörnet med Hoppande.
    expect(stepped.pts.length).toBeGreaterThan(smooth.pts.length);
    expect(smooth.winderDeviation ?? 0).toBeGreaterThan(50);
    expect(stepped.winderDeviation).toBeUndefined();
  });

  it('kröker övergången mellan lutning och plant (R 150), eller knäcker', () => {
    const g = stairGeometry(stairP({ end: 'tread', endTread: 800 }))!;
    const bend = hostedPath(g, {}, { side: 'right' })!;
    const knee = hostedPath(g, { transition: 'knee' }, { side: 'right' })!;
    expect(bend.pts.length).toBeGreaterThan(knee.pts.length);
    expect(bend.z.at(-1)).toBeCloseTo(2700);
  });

  it('ritas fritt med höjden i varje punkt', () => {
    const path = freePath({ line: [[0, 0], [2000, 0], [2000, 1000]], z: [0, 0, 500], transition: 'knee' })!;
    expect(path.length).toBeCloseTo(3000);
    expect(path.z).toEqual([0, 0, 500]);
  });
});

describe('Räckets delar (0.11.1)', () => {
  it('ställer stolparna jämnt med högst stolpdelningen, spjälorna med högst öppningen', () => {
    const path = freePath({ line: [[0, 0], [3000, 0]] })!;
    const body = railingBody(path, RA01.railing!, railValues(RA01.railing!));
    // 3000 / 1200 → tre fack, fyra stolpar.
    expect(body.posts.filter((p) => p.part.id === 'stolpe')).toHaveLength(4);
    // De fria öppningarna mellan spjälor och stolpar.
    const parts = [...body.repeats, ...body.posts.filter((p) => p.part.id === 'stolpe')].map((p) => [p.at[0] - p.w / 2, p.at[0] + p.w / 2]).sort((a, b) => a[0] - b[0]);
    const gaps = parts.slice(1).map((p, i) => p[0] - parts[i][1]);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(90 + 1e-6);
    expect(Math.min(...gaps)).toBeGreaterThan(70);
    // Ledstången förlängs 300 i båda ändar.
    const grab = body.along.find((a) => a.part.id === 'ledstang')!;
    expect(grab.ext).toBe(300);
    const solids = railingSolids('x', body, () => ({}));
    expect(solids.length).toBeGreaterThan(30);
  });

  it('lutar liggarna i trappan och ställer spjälorna lodrätt', () => {
    const store = project({}, [{ side: 'left' }]);
    const r = railingBodyOf(store.doc, store.doc.elements.ra0)!;
    const top = r.body.along.find((a) => a.part.id === 'handledare')!;
    expect(top.top[0]).toBeCloseTo(180 + 900);
    const solids = railingSolids('ra0', r.body, () => ({}));
    expect(solids.some((s) => s.top && s.bottom)).toBe(true);
    expect(railingPath(store.doc, store.doc.elements.ra0)!.z.at(-1)).toBeCloseTo(2700);
  });
});

describe('Räcket i planen och varningarna (0.11.1)', () => {
  it('ritar en linje i Normal och delarna i Detalj, och det ovanför snittet streckprickat', () => {
    const store = project({}, [{ side: 'left' }]);
    const style = defaultSheet(store.doc.graphics, 'storey');
    const plan = (detail: 'normal' | 'detail') => buildPlan(store.doc, 'pl-1', { state: 'st-ny', detail }, style).prims.filter((p) => p.origin?.objectType === 'Railing');
    const normal = plan('normal');
    expect(normal.some((p) => p.origin?.part === 'kontur')).toBe(true);
    expect(normal.some((p) => p.origin?.part === 'över')).toBe(true);
    expect(normal.some((p) => p.origin?.part === 'ledstang')).toBe(true);
    const detail = plan('detail');
    expect(detail.filter((p) => p.origin?.part === 'stolpe').length).toBeGreaterThan(3);
  });

  it('varnar för ledstång på båda sidor tills den andra finns eller kvitteras', () => {
    const one = project({}, [{ side: 'left' }]);
    expect(stairHandrailWarning(one.doc, one.doc.elements.tr)).toMatch(/höger sida saknar/);
    const both = project({}, [{ side: 'left' }, { side: 'right', def: 't-ra03' }]);
    expect(stairHandrailWarning(both.doc, both.doc.elements.tr)).toBeNull();
    const acked = project({ ack: ['handrails'] } as never, []);
    expect(stairHandrailWarning(acked.doc, acked.doc.elements.tr)).toBeNull();
  });

  it('varnar för låg skyddshöjd, glipor och utjämning vid kilstegen; aldrig spärrar', () => {
    const store = project({ line: [[0, 0], [3000, 0], [3000, 2500]] }, [{ side: 'left', params: { values: { Skyddshöjd: 800 } } }]);
    const w = railingWarnings(store.doc, store.doc.elements.ra0);
    expect(w.some((t) => /Skyddshöjden är 800 mm; avviker från praxis/.test(t))).toBe(true);
    expect(w.some((t) => /kilstegen/.test(t))).toBe(true);
    const ok = project({}, [{ side: 'left' }]);
    expect(railingWarnings(ok.doc, ok.doc.elements.ra0)).toEqual([]);
  });
});

describe('Räcket i sektioner och fasader (0.11.1)', () => {
  it('ritas med räckenas snittlinje där sektionen går genom det, och konturlinjen bortom', () => {
    const store = project({}, [{ side: 'left' }]);
    const doc = store.doc;
    // En sektion tvärs över trappan, och en längs den bortom räcket.
    doc.elements.sx = { id: 'sx', type: 'Section', storey: 'pl-1', states: ['st-ny'], tags: [], props: {}, params: { start: [2000, -1000], end: [2000, 2000], side: 1, label: 'X' } } as Element;
    doc.elements.sy = { id: 'sy', type: 'Section', storey: 'pl-1', states: ['st-ny'], tags: [], props: {}, params: { start: [-500, -2000], end: [4500, -2000], side: 1, label: 'Y' } } as Element;
    const s2 = new DocStore(doc);
    const across = buildSection(s2.doc, 'sx', { state: 'st-ny' }, defaultSheet(s2.doc.graphics, 'section'))!.prims.filter((p) => p.origin?.objectType === 'Railing');
    expect(across.length).toBeGreaterThan(0);
    expect(across.some((p) => p.kind === 'region' && p.outline?.weight === 0.25)).toBe(true);
    const beyond = buildSection(s2.doc, 'sy', { state: 'st-ny' }, defaultSheet(s2.doc.graphics, 'section'))!.prims.filter((p) => p.origin?.objectType === 'Railing');
    expect(beyond.some((p) => 'pen' in p && p.pen.weight === 0.13)).toBe(true);
  });
});
