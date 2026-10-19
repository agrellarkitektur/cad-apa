import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import type { RoofParams } from '../src/elements/roof';
import { dragRoofGrip, roofGripsInView, slopeForRidge } from '../src/elements/roofGrips';
import { buildSection } from '../src/repr/section';
import { insertShapeNode, moveShapeNode, offsetShapeEdge, rectWithCorner, removeShapeNode, shapeEdgeAt } from '../src/elements/shapeEdit';
import { sampleProject } from '../src/sample/sampleProject';

beforeAll(() => registerBuiltInTypes());

const view = { state: 'st-a', compareTo: 'st-bef', detail: 'normal' as const };

describe('grepp för taket i fasader och sektioner (0.8 del 2)', () => {
  it('från gaveln: ett grepp i nocken och ett i varje takfot, på takets linjer', () => {
    const doc = sampleProject();
    const grips = roofGripsInView(doc, 'fasad-2', ['tak']);
    expect(grips.filter((g) => g.kind === 'ridge')).toHaveLength(1);
    expect(grips.filter((g) => g.kind === 'eave')).toHaveLength(2);
    const p = doc.elements.tak.params as unknown as RoofParams;
    for (const g of grips.filter((x) => x.kind === 'eave')) expect(g.at[1]).toBe(p.eave);
    // Nocken är takets högsta punkt i fasaden.
    const s = buildSection(doc, 'fasad-2', view)!;
    const ys = s.prims.flatMap((q) => (q.kind === 'line' && q.origin?.objectId === 'tak' ? [q.a[1], q.b[1]] : []));
    expect(Math.abs(grips.find((g) => g.kind === 'ridge')!.at[1] - Math.max(...ys))).toBeLessThan(2);
  });

  it('från långsidan ligger takfötterna på varandra: ett grepp räcker', () => {
    const grips = roofGripsInView(sampleProject(), 'fasad-1', ['tak']);
    expect(grips.filter((g) => g.kind === 'eave')).toHaveLength(1);
  });

  it('nocken uppåt ger brantare tak i hela grader, och takfoten ligger kvar', () => {
    const doc = sampleProject();
    const ridge = roofGripsInView(doc, 'fasad-2', ['tak']).find((g) => g.kind === 'ridge')!;
    const r = dragRoofGrip(doc, 'fasad-2', ridge, [ridge.at[0], ridge.at[1] + 600])!;
    const p = doc.elements.tak.params as unknown as RoofParams;
    expect(r.params.slope).toBeGreaterThan(p.slope);
    expect(Number.isInteger(r.params.slope)).toBe(true);
    expect(r.params.eave).toBe(p.eave);
    expect(r.text).toContain('Lutning');
    // Fritt (Alt): en decimal.
    const free = dragRoofGrip(doc, 'fasad-2', ridge, [ridge.at[0], ridge.at[1] + 613], { free: true })!;
    expect(free.params.slope).not.toBe(r.params.slope);
  });

  it('lutningen räknas tillbaka ur nockens höjd', () => {
    const top = 2450 + Math.tan((30 * Math.PI) / 180) * 4000 + 300 / Math.cos((30 * Math.PI) / 180);
    expect(slopeForRidge(2450, 4000, 300, top)).toBeCloseTo(30, 3);
  });

  it('takfoten uppåt höjer hela taket med samma lutning; med Shift står nocken still', () => {
    const doc = sampleProject();
    const eave = roofGripsInView(doc, 'fasad-2', ['tak']).find((g) => g.kind === 'eave')!;
    const p = doc.elements.tak.params as unknown as RoofParams;
    const up = dragRoofGrip(doc, 'fasad-2', eave, [eave.at[0], eave.at[1] + 200])!;
    expect(up.params.eave).toBe(p.eave + 200);
    expect(up.params.slope).toBe(p.slope);
    expect(up.params.outline).toEqual(p.outline);
    const keep = dragRoofGrip(doc, 'fasad-2', eave, [eave.at[0], eave.at[1] + 200], { keepRidge: true })!;
    expect(keep.params.eave).toBe(p.eave + 200);
    expect(keep.params.slope).toBeLessThan(p.slope);
  });

  it('takfoten åt sidan ändrar taksprånget lika på båda sidor, längs takfallet', () => {
    const doc = sampleProject();
    const p = doc.elements.tak.params as unknown as RoofParams;
    const grips = roofGripsInView(doc, 'fasad-2', ['tak']).filter((g) => g.kind === 'eave');
    // Greppet längst till höger, dras 300 mm utåt (åt höger).
    const right = grips.reduce((a, g) => (g.at[0] > a.at[0] ? g : a));
    const r = dragRoofGrip(doc, 'fasad-2', right, [right.at[0] + 300, right.at[1]])!;
    const ys = (o: [number, number][]) => o.map((q) => q[1]);
    const span = (o: [number, number][]) => Math.max(...ys(o)) - Math.min(...ys(o));
    expect(span(r.params.outline)).toBe(span(p.outline) + 600);
    // Takfallet ligger kvar: takfoten sänks med lutningen.
    expect(r.params.eave).toBe(Math.round(p.eave - Math.tan((p.slope * Math.PI) / 180) * 300));
    expect(r.params.slope).toBe(p.slope);
    expect(r.text).toContain('Taksprång');
  });
});

const shape = (params: Record<string, unknown>, type = 'Line2D') => ({ type, params: { weight: 0.25, linetype: 'solid', ...params } });

describe('punkter i 2D-element (0.8 del 2)', () => {
  it('en punkt i en polylinje flyttas; de andra ligger kvar', () => {
    const s = shape({ shape: 'polyline', points: [[0, 0], [1000, 0], [1000, 1000]] });
    expect(moveShapeNode(s, 1, [1200, 50]).points).toEqual([[0, 0], [1200, 50], [1000, 1000]]);
  });
  it('en rektangel förblir rät när ett hörn dras, och det motstående hörnet står still', () => {
    const r = rectWithCorner([[0, 0], [2000, 0], [2000, 1000], [0, 1000]], 2, [2500, 1500])!;
    expect(r).toEqual([[0, 0], [2500, 0], [2500, 1500], [0, 1500]]);
    // Snedställd 45°: sidorna behåller sina riktningar.
    const c = Math.SQRT1_2;
    const sq: [number, number][] = [[0, 0], [1000 * c, 1000 * c], [0, 2000 * c], [-1000 * c, 1000 * c]];
    const t = rectWithCorner(sq, 2, [0, 3000])!;
    const d = (a: number[], b: number[]) => [b[0] - a[0], b[1] - a[1]];
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1];
    expect(Math.abs(dot(d(t[0], t[1]), d(t[1], t[2])))).toBeLessThan(2000);
    expect(t[0]).toEqual([0, 0]);
  });
  it('cirkelns centrum flyttar hela cirkeln; radiepunkten ändrar radien', () => {
    const s = shape({ shape: 'circle', points: [[0, 0], [500, 0]] });
    expect(moveShapeNode(s, 0, [100, 100]).points).toEqual([[100, 100], [600, 100]]);
    expect(moveShapeNode(s, 1, [0, 800]).points).toEqual([[0, 0], [0, 800]]);
  });
  it('lägg till och ta bort punkt; en linje blir polylinje, en rektangel sluten polylinje', () => {
    const l = shape({ shape: 'line', points: [[0, 0], [1000, 0]] });
    const hit = shapeEdgeAt(l, [400, 20], 50)!;
    expect(hit.index).toBe(0);
    const ins = insertShapeNode(l, hit.index, [400, 300])!;
    expect(ins).toEqual({ shape: 'polyline', points: [[0, 0], [400, 300], [1000, 0]], closed: false });
    expect(removeShapeNode(l, 0)).toBeNull();
    const rect = shape({ shape: 'rect', points: [[0, 0], [1000, 0], [1000, 500], [0, 500]] });
    expect(removeShapeNode(rect, 2)).toEqual({ shape: 'polyline', points: [[0, 0], [1000, 0], [0, 500]], closed: true });
    const fill = shape({ points: [[0, 0], [1000, 0], [0, 500]], pattern: 'solid' }, 'Fill2D');
    expect(removeShapeNode(fill, 0)).toBeNull();
    // Kanten från sista punkten tillbaka till den första i en sluten form.
    expect(shapeEdgeAt(rect, [0, 250], 20)!.index).toBe(3);
  });
  it('förskjut en kant: i en rektangel följer grannkanterna med, i en öppen polylinje flyttas änden rakt ut', () => {
    const rect = shape({ shape: 'rect', points: [[0, 0], [1000, 0], [1000, 500], [0, 500]] });
    // Kant 0 går åt höger; vänster är uppåt, in i rektangeln. Minus: utåt (nedåt).
    expect(offsetShapeEdge(rect, 0, -200)!.points).toEqual([[0, -200], [1000, -200], [1000, 500], [0, 500]]);
    const pl = shape({ shape: 'polyline', points: [[0, 0], [1000, 0], [1000, 1000]] });
    expect(offsetShapeEdge(pl, 0, 100)!.points).toEqual([[0, 100], [1000, 100], [1000, 1000]]);
  });
  it('kanten på en spline hittas på kurvan', () => {
    const s = shape({ shape: 'spline', points: [[0, 0], [1000, 500], [2000, 0], [3000, 500]] });
    expect(shapeEdgeAt(s, [1500, 300], 200)?.index).toBe(1);
  });
});
