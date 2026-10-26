import { beforeAll, describe, expect, it } from 'vitest';
import { addElements, updateParams } from '../src/core/commands';
import { registerBuiltInTypes } from '../src/elements';
import { markerFrame } from '../src/elements/markers';
import { buildingHeight } from '../src/repr/buildingHeight';
import { buildSection } from '../src/repr/section';
import { markerHeights } from '../src/repr/sectionLevels';
import { onSlope, planCtx } from './projekt';

beforeAll(() => registerBuiltInTypes());

const texts = (store: ReturnType<typeof onSlope>, id: string) => buildSection(store.doc, id, { state: 'st-a' })!.prims.flatMap((p) => (p.kind === 'text' ? [p.text] : []));

describe('Höjderna i fasaden (0.10.8b)', () => {
  it('linjen Beräkningsgrundande fasad på gaveln: byggnadshöjden mäts där, i nockens höjd', () => {
    const store = onSlope();
    const before = buildingHeight(planCtx(store))!;
    const gable = before.facades.find((f) => Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]) < 12000)!;
    const off = 300;
    const at = (q: readonly number[]): [number, number] => [q[0] + gable.out[0] * off, q[1] + gable.out[1] * off];
    addElements(store, [{ type: 'BasisFacade', storey: store.doc.storeys[0].id, tags: [], params: { start: at(gable.a), end: at(gable.b) }, props: {} }], 'st-a', 'Linje');
    const bh = buildingHeight(planCtx(store))!;
    expect(bh.basis).toBe(true);
    expect(bh.main.a).toEqual(gable.a);
    expect(bh.main.z).toBeCloseTo(bh.ridge, 0);
    expect(bh.main.z).toBeGreaterThan(before.main.z + 1000);
  });

  it('förvalet: BH bara i fasaden som ser den beräkningsgrundande fasaden; kryssrutorna lägger till NH och TH från medelmarknivån', () => {
    const store = onSlope();
    const bh = buildingHeight(planCtx(store))!;
    const elevations = Object.values(store.doc.elements).filter((e) => e.type === 'Elevation');
    const shown = elevations.filter((e) => markerHeights(e, markerFrame(store.doc, e).view, bh).bh);
    expect(shown).toHaveLength(1);
    const other = elevations.find((e) => e !== shown[0])!;
    expect(texts(store, other.id).some((t) => t.startsWith('BH'))).toBe(false);
    const own = texts(store, shown[0].id);
    expect(own.some((t) => t.startsWith('BH +'))).toBe(true);
    expect(own.some((t) => /^BH \d+,\d\d m$/.test(t))).toBe(true);
    expect(own.some((t) => t.startsWith('NH '))).toBe(false);
    updateParams(store, [other.id], { heights: { bh: true, nh: true, th: true, mmnOld: true } }, 'Höjder');
    const all = texts(store, other.id);
    for (const label of ['BH', 'NH', 'TH']) expect(all.some((t) => new RegExp(`^${label} \\d+,\\d\\d m$`).test(t))).toBe(true);
    // Utan markobjekt är den befintliga markens medelmarknivå densamma: ingen egen kota.
    expect(all.some((t) => t.startsWith('MMN bef.'))).toBe(false);
    // NH är nocken från medelmarknivån.
    const nh = all.find((t) => t.startsWith('NH '))!;
    expect(Number(nh.slice(3, -2).replace(',', '.'))).toBeCloseTo((bh.ridge - bh.mmn!) / 1000, 2);
  });
});
