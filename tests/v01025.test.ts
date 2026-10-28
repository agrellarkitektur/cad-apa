import { beforeAll, describe, expect, it } from 'vitest';
import { addElements } from '../src/core/commands';
import { buildingStoreys, emptyProject, groundStorey, SITE_STOREY } from '../src/core/model';
import { addSiteView, siteViewPreset } from '../src/core/siteViews';
import { addStorey, deleteStorey, storeyPatch, toStorey, tracedStorey, TRACE_SITE } from '../src/core/storeys';
import { DocStore } from '../src/core/store';
import { registerBuiltInTypes } from '../src/elements';
import { groundGeometry } from '../src/elements/groundGeometry';
import { planCutHeight } from '../src/elements/planCut';
import { buildPlan } from '../src/repr/plan';
import { createContext } from '../src/repr/context';
import { parse, serialize } from '../src/storage/format';
import { sampleProject } from '../src/sample/sampleProject';
import { GroundTool } from '../src/ui/tools/groundTool';
import { addGround, onSlope, toolHost } from './projekt';

beforeAll(() => registerBuiltInTypes());

/**
 * Platsen som modellflik (0.10.25): Platsen ligger i våningslistan, sist och
 * vid ±0, men räknas inte bland husets våningar; marken och platsens objekt
 * hör till den; planen har ingen snitthöjd och visar husets kontur och taken;
 * vyerna har tre förinställningar.
 */
describe('Platsen i våningslistan', () => {
  it('finns i nya projekt, sist, och räknas inte bland husets våningar', () => {
    const doc = emptyProject('Prov', 'nybyggnad');
    expect(doc.storeys.map((s) => s.id)).toEqual(['pl-1', SITE_STOREY]);
    expect(buildingStoreys(doc).map((s) => s.id)).toEqual(['pl-1']);
    expect(groundStorey(doc).id).toBe('pl-1');
    // En handskriven fil utan Platsen får den när den läses.
    const text = serialize({ ...doc, storeys: [doc.storeys[0]] });
    expect(parse(text).storeys.map((s) => s.id)).toEqual(['pl-1', SITE_STOREY]);
  });

  it('nya våningar läggs före Platsen, som står kvar vid ±0; den går inte att ta bort', () => {
    const s = new DocStore(emptyProject('Prov', 'nybyggnad'));
    const below = addStorey(s, 'pl-1', 'below')!;
    const above = addStorey(s, 'pl-1', 'above')!;
    expect(s.doc.storeys.map((x) => x.id)).toEqual(['pl-1', below, above, SITE_STOREY]);
    expect(s.doc.storeys.find((x) => x.site)!.elevation).toBe(0);
    // En högre källare flyttar inte Platsen, och Platsen går inte att ändra eller bygga från.
    const patched = storeyPatch(s.doc, below, { height: 3000 });
    expect(patched.find((x) => x.site)!.elevation).toBe(0);
    expect(storeyPatch(s.doc, SITE_STOREY, { elevation: 500 })).toBe(s.doc.storeys);
    expect(addStorey(s, SITE_STOREY, 'above')).toBeNull();
    expect(deleteStorey(s, SITE_STOREY)).toBe(false);
    expect(deleteStorey(s, below)).toBe(true);
    expect(deleteStorey(s, above)).toBe(true);
    // Den sista av husets våningar står kvar.
    expect(deleteStorey(s, 'pl-1')).toBe(false);
  });

  it('kalkerar Platsen under en våningsplan, men inte under sig själv', () => {
    const doc = emptyProject('Prov', 'nybyggnad');
    expect(tracedStorey(doc, 'pl-1', TRACE_SITE)?.id).toBe(SITE_STOREY);
    expect(tracedStorey(doc, SITE_STOREY, TRACE_SITE)).toBeUndefined();
  });
});

describe('Marken hör till Platsen', () => {
  it('platsen ur Höjdkurvor och markverktyget lägger sina objekt där', () => {
    const store = onSlope();
    const site = Object.values(store.doc.elements).filter((e) => ['Terrain', 'Tree', 'SiteBuilding'].includes(e.type));
    expect(site.length).toBeGreaterThan(0);
    expect(site.every((e) => e.storey === SITE_STOREY)).toBe(true);
    // Verktyget lägger markobjekt på Platsen också när det används på en våning.
    const tool = new GroundTool(toolHost(store, [], 'pl-1'));
    tool.aroundHouse();
    const around = Object.values(store.doc.elements).find((e) => e.type === 'Ground' && e.params.around);
    expect(around?.storey).toBe(SITE_STOREY);
  });

  it('flyttas inte till husets våningar, men annat går att flytta till Platsen', () => {
    const store = onSlope();
    const g = addGround(store, { kind: 'area', outline: [[0, 0], [1000, 0], [1000, 1000]], height: 0 });
    expect(toStorey(store, [g], 'pl-1', false, 'st-a')).toEqual([]);
    const [line] = addElements(store, [{ type: 'Shape2D', storey: 'pl-1', tags: [], props: {}, params: { shape: 'polyline', points: [[0, 0], [1000, 0]], weight: 0.25, linetype: 'solid' } }], 'st-a', 'linje');
    expect(toStorey(store, [line.id], SITE_STOREY, false, 'st-a')).toEqual([line.id]);
    expect(store.doc.elements[line.id].storey).toBe(SITE_STOREY);
  });

  it('marken runt huset utgår från våningen närmast ±0, inte från Platsen', () => {
    const store = onSlope();
    const id = addGround(store, { kind: 'area', outline: [], around: true, sockel: 200 });
    store.transact('golv', (tx) => tx.setStoreys(tx.doc.storeys.map((s) => (s.id === 'pl-1' ? { ...s, elevation: 300 } : s))));
    const ctx = createContext(store.doc, SITE_STOREY, { state: 'st-a' }, store.doc.graphics, () => true).ctx;
    expect(groundGeometry(ctx, store.doc.elements[id])!.label.height).toBe(100);
  });
});

describe('Platsens plan', () => {
  const plan = (doc = sampleProject(), hide: string[] = []) => buildPlan(doc, SITE_STOREY, { state: doc.states.at(-1)!.id, hide }).prims;

  it('har ingen snitthöjd: taken syns ovanifrån och husets kontur är heldragen utanför dem, streckad under', () => {
    const doc = sampleProject();
    expect(planCutHeight({ doc, storey: SITE_STOREY })).toBe(Infinity);
    const prims = plan(doc);
    expect(prims.some((p) => p.origin?.objectType === 'Roof')).toBe(true);
    // Inga väggar: de hör till Plan 1.
    expect(prims.some((p) => p.origin?.objectType === 'Wall')).toBe(false);
    const house = prims.filter((p) => p.origin?.part === 'husets kontur');
    expect(house.length).toBeGreaterThan(0);
    // Exempelvillans tak täcker hela huset: konturen är streckad.
    expect(house.every((p) => p.kind === 'line' && !!p.pen.dash)).toBe(true);
    // Utan taken är den heldragen och går att snäppa mot.
    const bare = plan(doc, ['Roof']).filter((p) => p.origin?.part === 'husets kontur');
    expect(bare.length).toBeGreaterThan(0);
    expect(bare.every((p) => !(p.kind === 'polyline' && p.pen.dash) && !p.noPick)).toBe(true);
    expect(plan(doc, ['house']).some((p) => p.origin?.part === 'husets kontur')).toBe(false);
  });
});

describe('Vyer av Platsen', () => {
  it('tre förinställningar med kategori, skala och det som visas; namnen får nummer', () => {
    const store = new DocStore(sampleProject());
    const a = addSiteView(store, 'situation');
    const b = addSiteView(store, 'situation');
    expect([a.name, b.name]).toEqual(['Situationsplan', 'Situationsplan 2']);
    expect(a).toMatchObject({ storey: SITE_STOREY, category: 'situation', scale: 400 });
    const g = siteViewPreset(store.doc, 'grading');
    expect(g.hide).toContain('+steepSlopes');
    const i = siteViewPreset(store.doc, 'illustration');
    expect(i.hide).toContain('Terrain');
    expect(i.name).toBe('Illustrationsplan');
  });
});
