import { beforeAll, describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { emptyProject, type Element } from '../src/core/model';
import { defaultProfileTypes } from '../src/core/profileTypes';
import { registerBuiltInTypes } from '../src/elements';
import { profileBodyOf, profileType, type ProfileParams } from '../src/elements/profile';
import { zOn, type Solid } from '../src/repr/solids';
import { createContext } from '../src/repr/context';
import { defaultSheet } from '../src/core/viewCategories';

/**
 * 0.11.7: ändprofilerna (PA) som skär änden, och profiltyperna som delar i
 * räckestyper och i den byggda trappans vangstycke.
 */

beforeAll(() => registerBuiltInTypes());

const TYPES = defaultProfileTypes();

function project(els: { def: string; params: Partial<ProfileParams> }[]) {
  const doc = emptyProject('Profil', 'nybyggnad');
  for (const d of TYPES) doc.definitions[d.id] = d;
  els.forEach((e, i) => {
    const el: Element = { id: `p${i}`, type: 'Profile', storey: 'pl-1', states: ['st-ny'], tags: [], definition: e.def, params: { line: [], ...e.params }, props: {} };
    doc.elements[el.id] = el;
  });
  return new DocStore(doc);
}

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

const solidsOf = (store: DocStore, id = 'p0') => {
  const { ctx } = createContext(store.doc, 'pl-1', { state: 'st-ny' }, defaultSheet(store.doc.graphics), () => true);
  return (profileType.model3d!(store.doc.elements[id] as never, ctx) as Solid[]).filter((s) => (s as { kind?: string }).kind !== 'edges');
};

describe('Ändprofilen (0.11.7)', () => {
  it('taktassen PR08 får PA01 i ändarna: utöver linjen, med svängd undersida', () => {
    const store = project([{ def: 't-pr08', params: { line: [[0, 0], [2000, 0]], z: [3000, 3000] } }]);
    const body = profileBodyOf(store.doc, store.doc.elements.p0)!;
    expect(body.endFit).toEqual([]);
    const xs = body.sweep.pieces.flatMap((p) => p.poly.flat().map((q) => q[0]));
    // Utöver: 300 mm förbi båda ändarna.
    expect(Math.min(...xs)).toBeCloseTo(-300, 0);
    expect(Math.max(...xs)).toBeCloseTo(2300, 0);
    const v = solidsOf(store).reduce((s, x) => s + volume(x), 0);
    const full = 45 * 170 * 2600;
    // Tassen tar bort en del av ändarna: mindre än hela, mer än utan tassar.
    expect(v).toBeLessThan(full - 1000);
    expect(v).toBeGreaterThan(45 * 170 * 2000);
  });

  it('Inom lägger konturen innanför linjen, och förskjutningen flyttar den', () => {
    const store = project([{ def: 't-pr08', params: { line: [[0, 0], [2000, 0]], z: [3000, 3000], end: { kind: 'profile', beyond: false, shift: 50 }, start: { kind: 'square' } } }]);
    const body = profileBodyOf(store.doc, store.doc.elements.p0)!;
    const xs = body.sweep.pieces.flatMap((p) => p.poly.flat().map((q) => q[0]));
    expect(Math.min(...xs)).toBeCloseTo(0, 0);
    expect(Math.max(...xs)).toBeCloseTo(2050, 0);
  });

  it('varnar när ändprofilen är ritad för en annan höjd och saknar typ', () => {
    const store = project([
      { def: 't-pr03', params: { line: [[0, 0], [2000, 0]], end: { kind: 'profile', profile: 't-pa01' } } },
      { def: 't-pr03', params: { line: [[0, 0], [2000, 0]], end: { kind: 'profile', profile: 'saknas' } } },
    ]);
    expect(profileBodyOf(store.doc, store.doc.elements.p0)!.endFit[0]).toMatch(/PA01/);
    expect(profileBodyOf(store.doc, store.doc.elements.p1)!.endFit[0]).toMatch(/saknas/);
  });

  it('en sträckt taktass sträcker ändprofilen med sträckzonen', () => {
    const store = project([{ def: 't-pr08', params: { line: [[0, 0], [2000, 0]], values: { Höjd: 220 } } }]);
    const body = profileBodyOf(store.doc, store.doc.elements.p0)!;
    expect(body.endFit).toEqual([]);
    const zs = body.sweep.pieces.flatMap((p) => p.poly.flat().map((q) => q[2]));
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(220, 0);
  });
});

import { defaultRailingTypes, type RailingTypeModel } from '../src/core/railingTypes';
import { railingBody } from '../src/elements/railingBody';
import { freePath } from '../src/elements/railingGeometry';
import { railProfiles, railingSolids } from '../src/elements/railing';
import { postRing } from '../src/elements/railingPlan';
import { stairGeometry, type StairParams } from '../src/elements/stairGeometry';
import { builtSolids } from '../src/elements/stairBuilt';
import { profileTypeUsage } from '../src/core/profiles';

describe('Profiltypen som del (0.11.7)', () => {
  const store = project([]);
  const profiles = railProfiles(store.doc);
  const rail = (): RailingTypeModel => structuredClone(defaultRailingTypes()[0].railing!);

  it('en handledare med PR06 får typens mått, ligger med ankaret på överkantens höjd och sveps längs linjen', () => {
    const m = rail();
    const h = m.parts.find((q) => q.id === 'handledare')!;
    h.profile = { shape: 'profile', type: 't-pr06', w: 50 };
    const path = freePath({ line: [[0, 0], [3000, 0]], z: [0, 0] })!;
    const body = railingBody(path, m, new Map([['Skyddshöjd', 1100], ['Ledstångshöjd', 900], ['Förlängning', 300], ['Spjälöppning', 100]]), { profiles });
    const a = body.along.find((x) => x.part.id === 'handledare')!;
    expect(a.sec).toBeTruthy();
    expect(a.w).toBeCloseTo(56, 0);
    expect(a.h).toBeCloseTo(45, 0);
    // Ankaret 1 är överkant mitt: överkanten på 1 100.
    expect(a.top[0]).toBeCloseTo(1100, 0);
    const edges: number[][] = [];
    const solids = railingSolids('r', { ...body, along: [a], posts: [], repeats: [], panels: [] }, () => ({}), edges as never);
    const zs = solids.flatMap((s) => [s.z0, s.z1]);
    expect(Math.max(...zs)).toBeCloseTo(1100, 0);
    expect(Math.min(...zs)).toBeCloseTo(1055, 0);
    expect(edges.length).toBeGreaterThan(4);
  });

  it('vridningen kring ankaret vrider tvärsnittet: en kvadrat 45° ger en ruterprofil', () => {
    const m = rail();
    const post = m.parts.find((q) => q.kind === 'point')!;
    post.profile = { shape: 'profile', type: 't-pr01', w: 40, rotate: 45 };
    const path = freePath({ line: [[0, 0], [3000, 0]], z: [0, 0] })!;
    const body = railingBody(path, m, new Map([['Skyddshöjd', 1100]]), { profiles });
    const q = body.posts[0];
    expect(q.sec).toBeTruthy();
    // 140 × 140 vriden 45°: diagonalen 198 åt båda håll.
    const ring = postRing(q);
    const span = Math.max(...ring.map((p) => p[0])) - Math.min(...ring.map((p) => p[0]));
    expect(span).toBeCloseTo(140 * Math.SQRT2, 0);
  });

  it('ett vangstycke med PR07 sträcks till bredden och höjden och kapas vid golvet', () => {
    const p: StairParams = { line: [[0, 0], [4000, 0]], width: 1000, rise: 2700, build: 'built', built: { stringer: { profile: 't-pr07', width: 60, height: 320 } } };
    const g = stairGeometry(p)!;
    const edges: number[][] = [];
    const solids = builtSolids('t', p, g, undefined, (id) => TYPES.find((d) => d.id === id)?.profile, edges as never);
    const str = solids.filter((s) => s.color === '#ece8df' && (s.top || s.bottom || s.noEdges));
    expect(str.length).toBeGreaterThan(4);
    const ys = str.flatMap((s) => s.rings[0].map((q) => q[1]));
    // Vänster sida y = 500 och inåt 60; höger y = −500 och inåt.
    expect(Math.max(...ys)).toBeCloseTo(500, 0);
    expect(Math.min(...ys)).toBeCloseTo(-500, 0);
    expect(ys.some((y) => Math.abs(y - 440) < 1)).toBe(true);
    expect(Math.min(...str.map((s) => s.z0))).toBeGreaterThanOrEqual(-0.01);
    expect(edges.length).toBeGreaterThan(4);
  });

  it('räknar var en typ används: ändprofilen i typer och avslut', () => {
    const s = project([{ def: 't-pr03', params: { line: [[0, 0], [1000, 0]], end: { kind: 'profile', profile: 't-pa01' } } }]);
    const u = profileTypeUsage(s.doc, 't-pa01');
    expect(u.types).toBe(1);
    expect(u.ends).toBe(1);
    expect(u.total).toBe(2);
  });
});
