import { beforeAll, describe, expect, it } from 'vitest';
import { addElements } from '../src/core/commands';
import { EXAMPLE_MASTER_ID } from '../src/core/exampleMaster';
import { emptyProject, modelViewId } from '../src/core/model';
import { addViewport, createMaster, createSheet, masterOf, mastersOf, saveMaster, saveSheet, setDefaultMaster } from '../src/core/sheets';
import { DocStore } from '../src/core/store';
import { deleteWorksheet } from '../src/core/treeCommands';
import { registerBuiltInTypes } from '../src/elements';
import { textType } from '../src/elements/annotation';
import { buildPlan } from '../src/repr/plan';
import type { Primitive } from '../src/repr/primitives';
import { buildSheet, centeredAt, masterViewStates, placeableViews, viewSource } from '../src/repr/sheet';
import { sampleProject } from '../src/sample/sampleProject';
import { ANNOTATION_SCALES } from '../src/ui/app/helpers';

beforeAll(() => registerBuiltInTypes());

const today = '2026-10-20';
const fromMaster = (prims: readonly Primitive[]) => prims.filter((p) => p.origin?.objectId?.startsWith(`${EXAMPLE_MASTER_ID}-`));
const textsOf = (prims: readonly Primitive[]) => prims.flatMap((p) => (p.kind === 'text' ? [p.text] : []));

describe('mallblad (0.8.8, format 8)', () => {
  it('nya projekt och exemplet har exempelmallbladet som förval: ram och huvud av vanliga linjer och texter', () => {
    for (const doc of [emptyProject('Nytt', 'nybyggnad'), sampleProject()]) {
      expect(doc.project.master).toBe(EXAMPLE_MASTER_ID);
      const m = mastersOf(doc);
      expect(m).toHaveLength(1);
      expect(m[0].paper).toEqual({ size: 'A3', orientation: 'landscape' });
      const els = Object.values(doc.elements).filter((e) => e.space === EXAMPLE_MASTER_ID);
      expect(new Set(els.map((e) => e.type))).toEqual(new Set(['Shape2D', 'Text']));
      // Ramen 20/10 mm från kanten och huvudet 180 mm brett i dess nedre högra hörn.
      expect(els[0].params).toMatchObject({ shape: 'polyline', closed: true, points: [[20, 10], [410, 10], [410, 287], [20, 287]], weight: 0.5 });
      expect(els.some((e) => e.type === 'Text' && e.params.text === '{ritningsnummer}' && e.params.bold)).toBe(true);
    }
  });

  it('ett nytt blad får projektets mallblad och dess format; mallen ritas under vyerna med smarttexten ifylld', () => {
    const store = new DocStore(sampleProject());
    const id = createSheet(store, { number: 'A-40.1-101', name: 'Plan 1', fields: { datum: '2026-10-20' } });
    addViewport(store, id, { view: 'vy-a-bl', scale: 100, at: centeredAt(store.doc, 'vy-a-bl', 100, [150, 160]) });
    const s = store.doc.sheets[0];
    expect(s).toMatchObject({ master: EXAMPLE_MASTER_ID, size: 'A3', orientation: 'landscape' });
    const d = buildSheet(store.doc, s, { today });
    const m = fromMaster(d.prims);
    expect(m.length).toBeGreaterThan(30);
    expect(textsOf(m)).toEqual(expect.arrayContaining(['A-40.1-101', 'Plan 1', '1:100', '2026-10-20', 'Exempelvilla', 'BYGGLOVSHANDLING', 'RITNINGSNUMMER']));
    expect(textsOf(m).some((t) => t.includes('{'))).toBe(false);
    // Papperet först, sedan mallen, sedan vyerna.
    expect(d.prims[0].origin?.part).toBe('papper');
    const firstView = d.prims.findIndex((p) => p.origin?.objectType === 'ViewTitle' || (p.origin?.objectId && !p.origin.objectId.startsWith(EXAMPLE_MASTER_ID) && p.origin.objectType !== 'Sheet'));
    expect(d.prims.findLastIndex((p) => fromMaster([p]).length > 0)).toBeLessThan(firstView);
    // På själva mallbladet står smarttexten som den är skriven, i 1:1.
    const own = buildPlan(store.doc, 'pl-1', masterViewStates(store.doc, mastersOf(store.doc)[0]));
    expect(textsOf(own.prims)).toContain('{ritningsnummer}');
    expect(own.prims.find((p) => p.kind === 'text' && p.text === '{ritningsnummer}')).toMatchObject({ height: 5, bold: true });
  });

  it('blad utan mall, eget mallblad, förvalt mallblad och format', () => {
    const store = new DocStore(sampleProject());
    const blank = createSheet(store, { master: undefined });
    expect(store.doc.sheets[0]).not.toHaveProperty('master');
    expect(fromMaster(buildSheet(store.doc, store.doc.sheets[0], { today }).prims)).toEqual([]);
    const a1 = createMaster(store, { name: 'A1 stående', size: 'A1', orientation: 'portrait' });
    expect(store.undoLabel).toBe('Nytt mallblad A1 stående');
    setDefaultMaster(store, a1);
    expect(store.doc.project.master).toBe(a1);
    const s = createSheet(store);
    expect(store.doc.sheets.find((x) => x.id === s)).toMatchObject({ master: a1, size: 'A1', orientation: 'portrait' });
    saveMaster(store, a1, { name: 'A1 liggande', orientation: 'landscape' });
    expect(store.doc.worksheets.find((w) => w.id === a1)).toMatchObject({ name: 'A1 liggande', paper: { size: 'A1', orientation: 'landscape' } });
    saveSheet(store, blank, { master: a1 });
    expect(masterOf(store.doc, store.doc.sheets[0])?.id).toBe(a1);
    saveSheet(store, blank, { master: undefined });
    expect(store.doc.sheets[0]).not.toHaveProperty('master');
    setDefaultMaster(store, null);
    expect(store.doc.project).not.toHaveProperty('master');
  });

  it('ta bort ett mallblad: det ritade försvinner och bladen blir utan mall; ångra tar tillbaka allt', () => {
    const store = new DocStore(sampleProject());
    const s = createSheet(store);
    const n = Object.keys(store.doc.elements).length;
    deleteWorksheet(store, EXAMPLE_MASTER_ID);
    expect(store.undoLabel).toBe('Ta bort mallbladet A3 med ritningshuvud');
    expect(store.doc.sheets[0]).not.toHaveProperty('master');
    expect(store.doc.project).not.toHaveProperty('master');
    expect(Object.values(store.doc.elements).some((e) => e.space === EXAMPLE_MASTER_ID)).toBe(false);
    store.undo();
    expect(store.doc.sheets.find((x) => x.id === s)?.master).toBe(EXAMPLE_MASTER_ID);
    expect(store.doc.project.master).toBe(EXAMPLE_MASTER_ID);
    expect(Object.keys(store.doc.elements)).toHaveLength(n);
  });

  it('ett mallblad går inte att lägga på ett blad som vy, och följer inte tillstånden', () => {
    const doc = sampleProject();
    expect(viewSource(doc, modelViewId(EXAMPLE_MASTER_ID))).toBeNull();
    expect(placeableViews(doc).some((v) => v.id === modelViewId(EXAMPLE_MASTER_ID))).toBe(false);
    const store = new DocStore(doc);
    // Ritat i Förslag B syns ändå på bladen, som visar förslaget som är förval.
    const [el] = addElements(store, [{ type: 'Text', storey: 'pl-1', space: EXAMPLE_MASTER_ID, tags: [], props: {}, params: { pos: [30, 280], text: 'ARKITEKT', height: 3.5, angle: 0 } }], 'st-b', 'Text');
    const d = buildSheet(store.doc, { ...store.doc.sheets[0], ...{ id: 'x', number: '1', name: 'x', size: 'A3', orientation: 'landscape', master: EXAMPLE_MASTER_ID, fields: {}, viewports: [] } }, { today });
    expect(d.prims.some((p) => p.origin?.objectId === el.id)).toBe(true);
  });

  it('text kan vara fet och centrerad eller högerställd', () => {
    const ctx = { scale: 1, params: (e: { params: unknown }) => e.params } as never;
    const el = { id: 't', type: 'Text', storey: 'pl-1', states: [], tags: [], props: {}, params: { pos: [100, 50], text: 'MITT', height: 5, angle: 0, bold: true, align: 'middle' } };
    expect(textType.plan!(el as never, ctx)[0]).toMatchObject({ kind: 'text', at: [100, 50], bold: true, align: 'middle' });
    const box = textType.pickShape!(el as never, ctx)[0][0];
    const xs = box.map((q) => q[0]);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(100);
    const left = { ...el, params: { ...el.params, align: 'start', bold: false } };
    expect(textType.plan!(left as never, ctx)[0]).not.toHaveProperty('align');
    expect(textType.plan!(left as never, ctx)[0]).not.toHaveProperty('bold');
  });

  it('skalorna i Carl Augusts ram finns att välja', () => {
    for (const n of [1, 5, 10, 20, 25, 50, 100, 200, 1000, 2000, 2500, 4000, 5000]) expect(ANNOTATION_SCALES).toContain(n);
  });
});
