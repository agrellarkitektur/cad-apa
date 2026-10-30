import { bookWithSheet } from '../src/core/viewCategories';
import { defaultSheet } from '../src/core/viewCategories';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ProjectDoc } from '../src/core/model';
import { DocStore } from '../src/core/store';
import { registerBuiltInTypes } from '../src/elements';
import { buildPlan } from '../src/repr/plan';
import type { Primitive } from '../src/repr/primitives';
import { buildSection } from '../src/repr/section';
import { sampleProject } from '../src/sample/sampleProject';
import { ownPenChange, ownPenSection, resetTypePen, typePenChange, typePenFields } from '../src/ui/ownPenFields';
import { applyPenField, penSection } from '../src/ui/style/pens';

beforeAll(() => registerBuiltInTypes());

const plan = (doc: ProjectDoc) => buildPlan(doc, doc.storeys[0].id, { state: doc.states.at(-1)!.id });
const select = (value: string) => ({ value }) as HTMLSelectElement;
type Lined = Extract<Primitive, { kind: 'line' | 'polyline' | 'arc' }>;
const linesOf = (prims: readonly Primitive[], id: string): Lined[] =>
  prims.filter((p): p is Lined => p.origin?.objectId === id && (p.kind === 'line' || p.kind === 'polyline' || p.kind === 'arc'));
const part = (lines: Lined[], name: string) => lines.filter((p) => p.origin?.part === name).map((p) => p.pen);
const doorOf = (doc: ProjectDoc) => Object.values(doc.elements).find((e) => e.type === 'Door' && e.definition)!;

describe('Pennor per typ och symbollinjer (0.8.33)', () => {
  it('dörrens delar, symbolen tunnast, och stilboken ändrar dem (ställena från 0.10.37)', () => {
    const doc = sampleProject();
    const door = doorOf(doc);
    const lines = linesOf(plan(doc).prims, door.id);
    expect(part(lines, 'karm')[0].weight).toBe(0.25);
    expect(part(lines, 'dörrblad')[0].weight).toBe(0.18);
    expect(part(lines, 'slagbåge')[0].weight).toBe(0.13);

    const style = structuredClone(defaultSheet(doc.graphics));
    expect(applyPenField(style, { dataset: { pen: 'doorSwing:weight' }, value: '0.25' } as unknown as HTMLInputElement)).toBe('Ändra pennor');
    applyPenField(style, { dataset: { pen: 'doorLeaf:color' }, value: '#0000ff' } as unknown as HTMLInputElement);
    expect(penSection(style, 'storey')).toContain('Dörr: slagbåge');
    const after = linesOf(plan({ ...doc, graphics: bookWithSheet(doc.graphics, style) }).prims, door.id);
    expect(part(after, 'slagbåge')[0].weight).toBe(0.25);
    expect(part(after, 'dörrblad')[0].color).toBe('#0000ff');
    expect(part(after, 'karm')[0]).toMatchObject({ weight: 0.25 });
  });

  it('den egna pennan i två delar: symbolen för sig', () => {
    const doc = sampleProject();
    const door = doorOf(doc);
    const store = new DocStore(doc);
    ownPenChange(store, [door.id], 'symbol.weight', select('0.35'));
    ownPenChange(store, [door.id], 'weight', select('0.5'));
    expect(store.doc.elements[door.id].pen).toEqual({ weight: 0.5, symbol: { weight: 0.35 } });
    const lines = linesOf(plan(store.doc).prims, door.id);
    expect(part(lines, 'slagbåge')[0].weight).toBe(0.35);
    expect(part(lines, 'karm')[0].weight).toBe(0.5);
    expect(ownPenSection(store.doc, [store.doc.elements[door.id]])).toContain('Symbol');
    // Väggar har ingen symboldel.
    const wall = Object.values(doc.elements).find((e) => e.type === 'Wall')!;
    expect(ownPenSection(store.doc, [wall])).not.toContain('Symbol');
    ownPenChange(store, [door.id], 'symbol.weight', select('style'));
    expect(store.doc.elements[door.id].pen).toEqual({ weight: 0.5 });
  });

  it('typens penna för alla av typen; objektets egen går före, fält för fält', () => {
    const doc = sampleProject();
    const door = doorOf(doc);
    const store = new DocStore(doc);
    const others = Object.values(doc.elements).filter((e) => e.definition === door.definition);
    typePenChange(store, [door.id], 'colorOn', select('own'));
    typePenChange(store, [door.id], 'color', select('#00aa00'));
    typePenChange(store, [door.id], 'symbol.weight', select('0.25'));
    const def = store.doc.definitions[door.definition!];
    expect(def.pen).toEqual({ color: '#00aa00', symbol: { weight: 0.25 } });
    expect(typePenFields(store.doc, def)).toContain('Typens penna');
    ownPenChange(store, [door.id], 'weight', select('0.7'));
    const prims = plan(store.doc).prims;
    for (const el of others) {
      const lines = linesOf(prims, el.id);
      expect(part(lines, 'karm')[0]).toMatchObject({ color: '#00aa00', weight: el.id === door.id ? 0.7 : 0.25 });
      expect(part(lines, 'slagbåge')[0].weight).toBe(0.25);
    }
    expect(ownPenSection(store.doc, [store.doc.elements[door.id]])).toContain('Typens');
    // Fasaderna och sektionerna: öppningssättet med typens symbolpenna.
    const marker = Object.values(doc.elements).find((e) => e.type === 'Elevation' || e.type === 'Section')!;
    const swings = Object.values(doc.elements)
      .filter((e) => e.type === 'Elevation' || e.type === 'Section')
      .flatMap((m) => buildSection(store.doc, m.id, { state: doc.states.at(-1)!.id })!.prims)
      .filter((p): p is Lined => p.kind === 'line' && p.origin?.part === 'swing' && others.some((o) => o.id === p.origin?.objectId));
    expect(marker).toBeTruthy();
    expect(swings.length).toBeGreaterThan(0);
    for (const s of swings) expect(s.pen).toMatchObject({ weight: 0.25, dash: [3, 1.5] });
    resetTypePen(store, def.id);
    expect(store.doc.definitions[def.id].pen).toBeUndefined();
  });
});
