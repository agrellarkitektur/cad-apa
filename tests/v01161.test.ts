import { beforeAll, describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { emptyProject, type Element } from '../src/core/model';
import { circleContour, defaultProfileTypes, flatContour, ringArea, type ProfileContour, type ProfileTypeModel } from '../src/core/profileTypes';
import { contourArea, filletContour, offsetContour, setDim, stretchModel } from '../src/core/profileContour';
import { registerBuiltInTypes } from '../src/elements';
import { profileBodyOf, type ProfileParams } from '../src/elements/profile';
import { profileWarnings } from '../src/ui/profileFields';
import { snapPoint } from '../src/ui/style/profileTypes';
import { applyProfileTypeField } from '../src/ui/style/profileTypeEdits';

/**
 * 0.11.6.1 Profileditorn, resten: Förskjut, Runda hörn, måtten i ritytan
 * (med parametrar), Läge som snäpphjälp och varningen för avslut som skär in.
 */

beforeAll(() => registerBuiltInTypes());

const rect = (w: number, h: number): ProfileContour => ({ pts: [[0, 0], [w, 0], [w, h], [0, h]] });
const area = (c: ProfileContour) => Math.abs(ringArea(flatContour(c)));
const model = (id: string): ProfileTypeModel => structuredClone(defaultProfileTypes().find((d) => d.id === id)!.profile!);

describe('Förskjut och Runda hörn', () => {
  it('förskjuter hela konturen och en kant, åt båda hållen och oavsett varvriktning', () => {
    expect(contourArea(rect(100, 50))).toBeCloseTo(5000);
    expect(area(offsetContour(rect(100, 50), 10)!)).toBeCloseTo(120 * 70);
    expect(area(offsetContour(rect(100, 50), -10)!)).toBeCloseTo(80 * 30);
    const cw: ProfileContour = { pts: [...rect(100, 50).pts].reverse() };
    expect(area(offsetContour(cw, 10)!)).toBeCloseTo(120 * 70);
    // Kant 1 (x = 100) utåt: bara bredden växer.
    expect(offsetContour(rect(100, 50), 20, 1)!.pts).toEqual([[0, 0], [120, 0], [120, 50], [0, 50]]);
    // För långt inåt vänder konturen: inget.
    expect(offsetContour(rect(100, 50), -30)).toBeNull();
  });

  it('förskjuter en cirkel och behåller bågarna', () => {
    const c = offsetContour(circleContour(0, 0, 100), 25)!;
    expect(Math.abs(contourArea(c))).toBeCloseTo(Math.PI * 75 * 75, 0);
    expect(area(c) / (Math.PI * 75 * 75)).toBeCloseTo(1, 1);
  });

  it('rundar ett hörn och minskar radien när bågen inte ryms', () => {
    const r = filletContour(rect(140, 140), 2, 30)!;
    expect(r.r).toBeCloseTo(30);
    expect(r.contour.pts).toHaveLength(5);
    expect(contourArea(r.contour)).toBeCloseTo(140 * 140 - (1 - Math.PI / 4) * 900, 1);
    const big = filletContour(rect(100, 20), 1, 50)!;
    expect(big.r).toBeCloseTo(20);
    // Hela kanten (20) går åt: hörnet och nästa punkt blir en.
    expect(big.contour.pts).toHaveLength(4);
    expect(filletContour(circleContour(0, 0, 100), 0, 10)).toBeNull();
  });
});

describe('Måtten i ritytan', () => {
  it('sträcker det bortre och styr parametern måttet pekar på', () => {
    const m = model('t-pr04');
    m.dims = [{ axis: 'height', from: 180, to: 190, at: -20 }];
    m.params.push({ name: 'Tjocklek', value: 0 });
    const store = new DocStore(emptyProject('Profil', 'nybyggnad'));
    const def = { ...defaultProfileTypes()[3], profile: m };
    store.transact('typ', (tx) => tx.putDefinition(def));
    const input = (value: string) => ({ value, checked: false }) as unknown as HTMLInputElement;
    applyProfileTypeField(store, def.id, ['dim', '0', 'param'], input('Tjocklek'));
    let cur = store.doc.definitions[def.id].profile!;
    expect(cur.params.find((q) => q.name === 'Tjocklek')!.value).toBe(10);
    // Parametern ändras: avtäckningen blir 25 tjock, och Höjd följer.
    applyProfileTypeField(store, def.id, ['param', String(cur.params.findIndex((q) => q.name === 'Tjocklek')), 'value'], input('25'));
    cur = store.doc.definitions[def.id].profile!;
    expect(cur.dims![0]).toMatchObject({ from: 180, to: 205 });
    expect(Math.max(...cur.parts[1].contour.pts.map((q) => q[1]))).toBe(205);
    expect(cur.params.find((q) => q.name === 'Höjd')!.value).toBe(205);
    // Måttets värde direkt.
    applyProfileTypeField(store, def.id, ['dim', '0', 'value'], input('15'));
    expect(store.doc.definitions[def.id].profile!.params.find((q) => q.name === 'Tjocklek')!.value).toBe(15);
  });

  it('flyttar ankare, zoner och andra mått bortom stället', () => {
    const m = model('t-pr03');
    m.anchors.push({ no: 4, name: 'Egen', at: [45, 200] });
    m.dims = [{ axis: 'width', from: 0, to: 90, at: 250 }];
    stretchModel(m, 'height', 135, 30);
    expect(m.anchors[3].at).toEqual([45, 230]);
    expect(m.zones[0]).toMatchObject({ from: 0, to: 300 });
    expect(m.dims[0].at).toBe(280);
    expect(setDim(m, 0, 90)).toBe(false);
  });
});

describe('Läge som snäpphjälp', () => {
  const m = model('t-pr04');
  it('Kant i kant skjuter ut en punkt ur en annan delprofil; Fritt snäpper bara till de egna', () => {
    // En punkt mitt i gesimsen (A) blir liggande på dess kant.
    const p = snapPoint(m, [30, 170], 0.1, { place: 'edge' });
    expect(Math.min(Math.abs(p[1] - 180), Math.abs(p[0]))).toBeLessThan(0.1);
    expect(snapPoint(m, [30, 170], 0.1, { place: 'over' })).toEqual([30, 170]);
    // Nära A:s hörn (60, 60): Ovanpå snäpper dit, Fritt för B går till rutnätet.
    expect(snapPoint(m, [60.4, 59.6], 0.1, { place: 'over', self: 'b' })).toEqual([60, 60]);
    expect(snapPoint(m, [61.4, 59.6], 0.1, { place: 'free', self: 'b' })).toEqual([60, 60]);
    expect(snapPoint(m, [63.4, 59.6], 0.1, { place: 'free', self: 'b' })).toEqual([65, 60]);
    // På A:s lodräta kant x = 120 med rutnätet längs kanten.
    expect(snapPoint(m, [120.5, 93.2], 0.1, { place: 'over', self: 'b' })).toEqual([120, 95]);
  });
});

describe('Varningen för avslut som skär in', () => {
  const project = (params: Partial<ProfileParams>) => {
    const doc = emptyProject('Profil', 'nybyggnad');
    for (const d of defaultProfileTypes()) doc.definitions[d.id] = d;
    const el: Element = { id: 'p0', type: 'Profile', storey: 'pl-1', states: ['st-ny'], tags: [], definition: 't-pr03', params: { line: [], ...params }, props: {} };
    doc.elements[el.id] = el;
    return { doc, el };
  };
  it('varnar när de vågräta ändarna på en brant balk möts, men inte på en lång', () => {
    // 270 hög balk, 45°: en vågrät ände når 270 mm in.
    const short = project({ line: [[0, 0], [400, 0]], z: [0, 400], start: { kind: 'level' }, end: { kind: 'level' } });
    const w = profileWarnings(profileBodyOf(short.doc, short.el));
    expect(w.some((t) => t.startsWith('Avsluten skär in i varandra'))).toBe(true);
    const long = project({ line: [[0, 0], [3000, 0]], z: [0, 3000], start: { kind: 'level' }, end: { kind: 'level' } });
    expect(profileWarnings(profileBodyOf(long.doc, long.el))).toEqual([]);
  });
  it('varnar när ett avslut når förbi den första knäcken', () => {
    const p = project({ line: [[0, 0], [100, 0], [2000, 0]], start: { kind: 'angle', angle: 70 } });
    const w = profileWarnings(profileBodyOf(p.doc, p.el));
    expect(w.some((t) => t.startsWith('Avslutet i början skär in'))).toBe(true);
    const ok = project({ line: [[0, 0], [100, 0], [2000, 0]], start: { kind: 'angle', angle: 20 } });
    expect(profileWarnings(profileBodyOf(ok.doc, ok.el))).toEqual([]);
  });
});
