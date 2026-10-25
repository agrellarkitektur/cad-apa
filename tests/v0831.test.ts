import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { DocStore } from '../src/core/store';
import type { ProjectDoc } from '../src/core/model';
import { transferSettings } from '../src/core/arrange';
import { buildPlan } from '../src/repr/plan';
import { buildSection } from '../src/repr/section';
import { withOwnPen } from '../src/repr/ownPen';
import { ownedOutlines } from '../src/repr/outlineOwners';
import type { Primitive, PolylinePrim, RegionPrim } from '../src/repr/primitives';
import { sampleProject } from '../src/sample/sampleProject';
import { ownPenChange, ownPenSection, resetOwnPen } from '../src/ui/ownPenFields';

beforeAll(() => registerBuiltInTypes());

const plan = (doc: ProjectDoc) => buildPlan(doc, doc.storeys[0].id, { state: doc.states.at(-1)!.id });
const walls = (doc: ProjectDoc) => Object.values(doc.elements).filter((e) => e.type === 'Wall');
const select = (value: string) => ({ value }) as HTMLSelectElement;

describe('Egen penna (0.8.31)', () => {
  it('det som är satt ersätter stilmallens, en linjetyp också streckningen', () => {
    const style = sampleProject().graphics;
    expect(withOwnPen({ weight: 0.35, color: 'ink', dash: [2, 1] }, { linetype: 'solid' }, style)).toEqual({ weight: 0.35, color: 'ink' });
    expect(withOwnPen({ weight: 0.35 }, { weight: 0.7, color: '#ff0000', linetype: 'dashed' }, style)).toEqual({ weight: 0.7, color: '#ff0000', dash: [3, 1.5] });
  });

  it('konturen delas efter vilken bit kanten kommer ifrån', () => {
    const a = [[[0, 0], [1000, 0], [1000, 100], [0, 100]]] as [number, number][][];
    const b = [[[1000, 0], [2000, 0], [2000, 100], [1000, 100]]] as [number, number][][];
    const union = [[[0, 0], [2000, 0], [2000, 100], [0, 100]]] as [number, number][][];
    const out = ownedOutlines([union], [{ id: 'a', rings: a }, { id: 'b', rings: b }], new Set(['b']));
    // Den långa kanten delas där bitarna möts.
    const len = (pts: readonly (readonly number[])[]) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
    const mine = out.filter((o) => o.id === 'b');
    expect(mine).toHaveLength(1);
    expect(len(mine[0].points)).toBeCloseTo(2100);
    expect(out.filter((o) => o.id === 'a').reduce((s, o) => s + len(o.points), 0)).toBeCloseTo(2100);
    // Utan egen penna delas ingenting.
    expect(ownedOutlines([union], [{ id: 'a', rings: a }], new Set())).toEqual([{ id: null, points: union[0], closed: true }]);
  });

  it('en vägg med egen penna: samma ytor, konturen med den egna pennan på rätt kanter', () => {
    const doc = sampleProject();
    const before = plan(doc).prims.filter((p): p is RegionPrim => p.kind === 'region' && p.origin?.part === 'snitt');
    const w = walls(doc)[0];
    const store = new DocStore(doc);
    ownPenChange(store, [w.id], 'linetype', select('dashed'));
    ownPenChange(store, [w.id], 'weight', select('0.7'));
    expect(store.doc.elements[w.id].pen).toEqual({ linetype: 'dashed', weight: 0.7 });
    const prims = plan(store.doc).prims;
    const regions = prims.filter((p): p is RegionPrim => p.kind === 'region' && p.origin?.part === 'snitt');
    // Ytorna är desamma (inga skarvar), men konturen ritas som linjer.
    expect(regions.length).toBe(before.length);
    const outlines = prims.filter((p): p is PolylinePrim => p.kind === 'polyline' && p.origin?.part === 'kontur');
    const own = outlines.filter((p) => p.origin?.objectId === w.id);
    expect(own.length).toBeGreaterThan(0);
    for (const p of own) expect(p.pen).toMatchObject({ weight: 0.7, dash: [3, 1.5] });
    expect(outlines.some((p) => p.origin?.objectId !== w.id && p.pen.weight === 0.35 && !p.pen.dash)).toBe(true);
  });

  it('dörrar, fönster och möbler får pennan på sina linjer, inte texten', () => {
    const doc = sampleProject();
    const door = Object.values(doc.elements).find((e) => e.type === 'Door')!;
    door.pen = { color: '#ff0000' };
    const own = plan(doc).prims.filter((p) => p.origin?.objectId === door.id);
    const lines = own.filter((p): p is Extract<Primitive, { pen: unknown }> & Primitive => p.kind === 'line' || p.kind === 'polyline' || p.kind === 'arc');
    expect(lines.length).toBeGreaterThan(0);
    // Slagbågen har pennans symboldel (0.8.33), som inte är satt här.
    for (const p of lines.filter((q) => q.pen.weight > 0)) expect(p.pen.color === '#ff0000').toBe(p.origin?.part !== 'slagbåge');
    for (const p of own) if (p.kind === 'text') expect(p.pen.color).not.toBe('#ff0000');
  });

  it('fasader och sektioner ritar objektets linjer med den egna pennan', () => {
    const doc = sampleProject();
    const marker = Object.values(doc.elements).find((e) => e.type === 'Section')!;
    const view = { state: doc.states.at(-1)!.id };
    const drawn = new Set(buildSection(doc, marker.id, view)!.prims.map((p) => p.origin?.objectId));
    const w = walls(doc).find((x) => drawn.has(x.id))!;
    w.pen = { color: '#00aa00', weight: 1 };
    const prims = buildSection(doc, marker.id, view)!.prims.filter((p) => p.origin?.objectId === w.id);
    const pens = prims.flatMap((p) => (p.kind === 'line' || p.kind === 'polyline' ? [p.pen] : p.kind === 'region' && p.outline ? [p.outline] : []));
    expect(pens.length).toBeGreaterThan(0);
    for (const pen of pens) expect(pen).toMatchObject({ color: '#00aa00', weight: 1 });
  });

  it('avsnittet i egenskaperna, Stilmallens penna och pipetten', () => {
    const doc = sampleProject();
    const [a, b] = walls(doc);
    const store = new DocStore(doc);
    expect(ownPenSection(store.doc, [a])).toContain('Stilmallens');
    expect(ownPenSection(store.doc, Object.values(doc.elements).filter((e) => e.type === 'Space').slice(0, 1))).toBe('');
    ownPenChange(store, [a.id], 'colorOn', select('own'));
    expect(store.doc.elements[a.id].pen?.color).toMatch(/^#/);
    // Olika i markeringen.
    expect(ownPenSection(store.doc, [store.doc.elements[a.id], store.doc.elements[b.id]])).toContain('Olika');
    transferSettings(store, a.id, [b.id]);
    expect(store.doc.elements[b.id].pen).toEqual(store.doc.elements[a.id].pen);
    resetOwnPen(store, [a.id, b.id]);
    expect(store.doc.elements[a.id].pen).toBeUndefined();
    expect(store.doc.elements[b.id].pen).toBeUndefined();
  });
});
