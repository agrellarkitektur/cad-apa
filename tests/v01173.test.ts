import { beforeAll, describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { emptyProject, SITE_STOREY, type Element } from '../src/core/model';
import { defaultProfileTypes } from '../src/core/profileTypes';
import { defaultGroundRailingTypes, type RailingTypeModel } from '../src/core/railingTypes';
import { registerBuiltInTypes } from '../src/elements';
import { profileType, type ProfileParams } from '../src/elements/profile';
import { railingBody } from '../src/elements/railingBody';
import { railingSolids } from '../src/elements/railing';
import { patternBars } from '../src/elements/railingPattern';
import { freePath } from '../src/elements/railingGeometry';
import { stairLittera, stairType } from '../src/elements/stair';
import { zOn, type Solid } from '../src/repr/solids';
import { createContext } from '../src/repr/context';
import { buildPlan } from '../src/repr/plan';
import { defaultSheet } from '../src/core/viewCategories';
import { applyStairField, stairFieldsMarkup } from '../src/ui/stairFields';
import { twoStoreys } from './projekt';

/**
 * 0.11.7.3: utomhustrappan, kontrastmarkeringens material, trappans littera
 * i planen, ändprofilen med vridningen kring ankaret och ytor med mönster.
 */

beforeAll(() => registerBuiltInTypes());

const stair = (doc: ReturnType<typeof twoStoreys>, id: string, storey = 'pl-1', params: Record<string, unknown> = {}) => {
  doc.elements[id] = { id, type: 'Stair', storey, states: ['st-a', 'st-b'], tags: [], props: {}, params: { line: [[1000, 4500], [4500, 4500]], width: 1000, ...params } } as any;
};

describe('Trappan (0.11.7.3)', () => {
  it('är utomhus på Platsen och varnar då under 300 mm; krysset går före', () => {
    const doc = twoStoreys();
    stair(doc, 'ute', SITE_STOREY, { going: 280, risers: 4, rise: 600 });
    stair(doc, 'inne', 'pl-1', { going: 280, risers: 4, rise: 600 });
    const store = new DocStore(doc);
    const warn = (id: string) => /minst 300 mm utomhus/.test(stairFieldsMarkup(store.doc, store.doc.elements[id]));
    // Stegdjupet blir det referenslinjen ger; sätt det så att det hamnar mellan 250 och 300.
    expect(applyStairField(store, ['ute', 'inne'], 'going', { value: '280' } as HTMLInputElement)).toBe(true);
    expect(warn('ute')).toBe(true);
    expect(warn('inne')).toBe(false);
    expect(applyStairField(store, ['inne'], 'outdoor', { checked: true, value: '' } as HTMLInputElement)).toBe(true);
    expect(store.doc.elements.inne.params.outdoor).toBe(true);
    expect(warn('inne')).toBe(true);
    // Platsens förval sparas inte.
    expect(applyStairField(store, ['ute'], 'outdoor', { checked: true, value: '' } as HTMLInputElement)).toBe(true);
    expect(store.doc.elements.ute.params.outdoor).toBeUndefined();
  });

  it('kontrastmarkeringen får stilbokens material i 3D', () => {
    const doc = twoStoreys();
    stair(doc, 'tr', 'pl-1', { contrast: 'all' });
    const store = new DocStore(doc);
    const mat = store.doc.graphics.materials!.find((x) => x.building && x.color3d)!;
    expect(applyStairField(store, ['tr'], 'contrastMaterial', { value: mat.id } as HTMLSelectElement)).toBe(true);
    const { ctx } = createContext(store.doc, 'pl-1', { state: 'st-a' }, defaultSheet(store.doc.graphics), () => true);
    const solids = (stairType.model3d!(store.doc.elements.tr as never, ctx) as Solid[]).filter((s) => s.z1 - s.z0 === 2);
    expect(solids.length).toBeGreaterThan(0);
    expect(solids.every((s) => s.color !== '#2b2b2b')).toBe(true);
  });

  it('har littera i planen: TR01 i ordning, eget namn går före, Visa släcker', () => {
    const doc = twoStoreys();
    stair(doc, 'a');
    stair(doc, 'b', 'pl-1', { line: [[1000, 7000], [4500, 7000]] });
    doc.elements.b.name = 'T-A';
    expect(stairLittera(doc, doc.elements.a)).toBe('TR01');
    expect(stairLittera(doc, doc.elements.b)).toBe('T-A');
    const texts = (hide: string[], detail = 'normal') => buildPlan(doc, 'pl-1', { state: 'st-a', detail, hide } as any).prims.filter((q) => q.origin?.part === 'littera' && q.origin.objectType === 'Stair').map((q) => (q as { text: string }).text);
    expect(texts([]).sort()).toEqual(['T-A', 'TR01']);
    expect(texts(['littera:Stair'])).toEqual([]);
    expect(texts([], 'sketch')).toEqual([]);
  });
});

function volume(s: Solid): number {
  const r = s.rings[0];
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i];
    const q = r[(i + 1) % r.length];
    const c = p[0] * q[1] - q[0] * p[1];
    a += c;
    cx += (p[0] + q[0]) * c;
    cy += (p[1] + q[1]) * c;
  }
  a /= 2;
  const m: [number, number] = [cx / (6 * a), cy / (6 * a)];
  const top = s.top ? zOn(s.top, m[0], m[1]) : s.z1;
  const bot = s.bottom ? zOn(s.bottom, m[0], m[1]) : s.z0;
  return Math.abs(a) * (top - bot);
}

describe('Ändprofilen med vridningen kring ankaret (0.11.7.3)', () => {
  const vol = (params: Partial<ProfileParams>) => {
    const doc = emptyProject('Profil', 'nybyggnad');
    for (const d of defaultProfileTypes()) doc.definitions[d.id] = d;
    const el: Element = { id: 'p0', type: 'Profile', storey: 'pl-1', states: ['st-ny'], tags: [], definition: 't-pr08', params: { line: [[0, 0], [2000, 0]], z: [3000, 3000], ...params }, props: {} };
    doc.elements.p0 = el;
    const store = new DocStore(doc);
    const { ctx } = createContext(store.doc, 'pl-1', { state: 'st-ny' }, defaultSheet(store.doc.graphics), () => true);
    return (profileType.model3d!(el as never, ctx) as Solid[]).filter((s) => (s as { kind?: string }).kind !== 'edges').reduce((s, x) => s + volume(x), 0);
  };

  it('skär den vridna taktassen som den ovridna (lika stor volym)', () => {
    const v0 = vol({});
    expect(vol({ rotate: 90 })).toBeCloseTo(v0, -2);
    expect(vol({ rotate: 30 })).toBeCloseTo(v0, -2);
    expect(vol({ mirror: true, rotate: 30 })).toBeCloseTo(v0, -2);
  });
});

describe('Ytor med mönster (0.11.7.3)', () => {
  const VALS = new Map([['Höjd', 1800], ['Stolpdelning', 2400]]);
  const sp01 = (): RailingTypeModel => structuredClone(defaultGroundRailingTypes().find((d) => d.id === 't-sp01')!.railing!);
  const path = freePath({ line: [[0, 0], [2400, 0]], z: [0, 0] })!;

  it('spaljéns rutnät är diagonala ribbor inom ytan', () => {
    const body = railingBody(path, sp01(), VALS);
    const panel = body.panels[0];
    const bars = patternBars(panel);
    expect(bars.length).toBeGreaterThan(10);
    for (const b of bars) {
      expect(b.s0).toBeGreaterThanOrEqual(-0.01);
      expect(b.s1).toBeLessThanOrEqual(Math.hypot(panel.b[0] - panel.a[0], panel.b[1] - panel.a[1]) + 0.01);
      expect(Math.min(...b.bottom)).toBeGreaterThanOrEqual(panel.a0 - 0.01);
      expect(Math.max(...b.top)).toBeLessThanOrEqual(panel.a1 + 0.01);
    }
    // I 3D ribbor, ingen slät skiva.
    const solids = railingSolids('r', { ...body, along: [], posts: [], repeats: [] }, () => ({}));
    expect(solids).toHaveLength(bars.length);
  });

  it('rutnätet har lodräta och vågräta ribbor, och en slät yta är kvar utan mönster', () => {
    const m = sp01();
    const part = m.parts.find((p) => p.kind === 'surface')!;
    part.pattern = { kind: 'grid', spacing: 200, width: 20 };
    const panel = railingBody(path, m, VALS).panels[0];
    const bars = patternBars(panel);
    const vertical = bars.filter((b) => b.s1 - b.s0 < 25);
    expect(vertical.length).toBeGreaterThan(5);
    expect(bars.length - vertical.length).toBeGreaterThan(5);
    delete part.pattern;
    expect(patternBars(railingBody(path, m, VALS).panels[0])).toEqual([]);
  });
});

describe('Staketens typer i kommandoraden (0.11.7.3)', () => {
  it('ST01 och SP01 hittas och läggs in med det första räcket', async () => {
    const { typeByName } = await import('../src/ui/app/shellTypes');
    const { addRailings } = await import('../src/core/railings');
    const store = new DocStore(twoStoreys());
    expect(typeByName(store.doc, 'railing', 'sp01')).toBe('t-sp01');
    expect(typeByName(store.doc, 'railing', 'ST01')).toBe('t-st01');
    const [el] = addRailings(store, [{ storey: 'pl-1', definition: 't-sp01', params: { line: [[0, 0], [3000, 0]] } }], ['st-a'], 'Spaljé');
    expect(store.doc.elements[el.id].definition).toBe('t-sp01');
    expect(store.doc.definitions['t-sp01']?.railing?.parts.some((p) => p.pattern?.kind === 'diagonal')).toBe(true);
  });
});
