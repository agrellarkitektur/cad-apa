import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { buildPlan } from '../src/repr/plan';
import { hiddenBy, hiddenObjectKey, hiddenObjects } from '../src/core/visibility';
import { isShown, setShown } from '../src/ui/app/showMenu';
import { depthDragValue, depthGeometry, depthGripAt, depthGripsShown } from '../src/ui/tools/selectGrips';
import { groundLines3d } from '../src/ui/app/ground3d';
import { DocStore } from '../src/core/store';
import { updateParams } from '../src/core/commands';
import { sampleProject } from '../src/sample/sampleProject';
import { addGround, onSlope, toolHost, wallsProject } from './projekt';

beforeAll(() => registerBuiltInTypes());

describe('Visa och dölja (0.10.15)', () => {
  const store = new DocStore(structuredClone(sampleProject()));
  const doc = store.doc;
  const storey = doc.storeys[0].id;
  const state = doc.states.at(-1)!.id;
  const door = Object.values(doc.elements).find((e) => e.type === 'Door' && e.storey === storey && e.states.includes(state))!;
  const wall = doc.elements[door.host!];
  const ids = (hide: string[]) => new Set(buildPlan(doc, storey, { state, hide }).prims.map((q) => q.origin?.objectId));

  it('ett objekt döljs för sig, och dörrar och fönster följer väggen', () => {
    expect(hiddenObjects(['Wall', hiddenObjectKey('v1')])).toEqual(['v1']);
    expect(hiddenBy(doc, door, [hiddenObjectKey(wall.id)])).toBe(true);
    expect(hiddenBy(doc, door, ['Wall'])).toBe(true);
    expect(hiddenBy(doc, wall, ['Door'])).toBe(false);
    const all = ids([]);
    expect(all.has(wall.id) && all.has(door.id)).toBe(true);
    const one = ids([hiddenObjectKey(wall.id)]);
    expect(one.has(wall.id) || one.has(door.id)).toBe(false);
    // Andra väggar syns kvar.
    expect([...one].some((id) => id && doc.elements[id]?.type === 'Wall')).toBe(true);
    // Väggarna som typ: inga väggar, dörrar eller fönster.
    expect([...ids(['Wall'])].some((id) => id && ['Wall', 'Door', 'Window'].includes(doc.elements[id]?.type))).toBe(false);
    // Rummen och numren är desamma när väggen är dold.
    const rooms = (hide: string[]) => buildPlan(doc, storey, { state, hide }).prims.filter((q) => q.origin?.objectType === 'Space' && q.kind === 'text').map((q) => (q.kind === 'text' ? q.text : '')).sort();
    expect(rooms([hiddenObjectKey(wall.id)])).toEqual(rooms([]));
    // Bara dörrarna: väggen syns.
    expect(ids(['Door']).has(wall.id)).toBe(true);
  });

  it('väggar, dörrar och fönster under Visa', () => {
    const ui = { hide: [] as string[], hideDemolished: false };
    setShown(ui, 'Wall', false);
    expect(ui.hide).toEqual(['Wall']);
    // Linjerna i 3D är släckta från början.
    expect(isShown(ui, 'ground3d')).toBe(false);
    setShown(ui, 'slopes3d', true);
    expect(ui.hide).toContain('+slopes3d');
  });

  it('grepp för djup och Tonat från på en markerad sektion', () => {
    const s = wallsProject({}, {}, { sek: { type: 'Section', params: { start: [0, 0], end: [10000, 0], side: 1, depth: 6000, toneDepth: 3000, auto: false, label: 'A' } } });
    const grips = depthGripsShown(toolHost(s, ['sek']));
    expect(grips.map((g) => [g.key, g.value])).toEqual([
      ['depth', 6000],
      ['toneDepth', 3000],
    ]);
    const tone = grips[1];
    expect(depthGripAt(toolHost(s, ['sek']), tone.at, false)?.key).toBe('toneDepth');
    // Dras längs blickriktningen, avrundat; nära linjen blir det inget.
    expect(depthDragValue(tone, [tone.at[0] + 500, tone.at[1] + 1234])).toBe(4230);
    expect(depthDragValue(tone, [5000, 50])).toBeNull();
    expect(depthGeometry(tone, 4230).a[1]).toBeCloseTo(4230);
    // Utan Tonat från står greppet vid djupet; låst eller inget markerat: inga grepp.
    updateParams(s, ['sek'], { toneDepth: null });
    expect(depthGripsShown(toolHost(s, ['sek']))[1]).toMatchObject({ value: null, shown: 6000 });
    expect(depthGripsShown(toolHost(s, []))).toEqual([]);
    s.load({ ...s.doc, elements: { ...s.doc.elements, sek: { ...s.doc.elements.sek, locked: true } } });
    expect(depthGripsShown(toolHost(s, ['sek']))).toEqual([]);
  });

  it('markobjektens linjer och släntmarkeringar på marken i 3D', () => {
    const s = onSlope();
    addGround(s, { kind: 'area', outline: [[20000, -5000], [30000, -5000], [30000, 5000], [20000, 5000]], height: 2500 });
    const view = { state: 'st-a', compareTo: s.doc.states[0].id };
    expect(groundLines3d(s.doc, view, { outlines: false, slopes: false })).toEqual({ outlines: null, slopes: null });
    const l = groundLines3d(s.doc, view, { outlines: true, slopes: true });
    expect(l.outlines!.length % 6).toBe(0);
    expect(l.outlines!.length).toBeGreaterThan(0);
    expect(l.slopes!.length).toBeGreaterThan(0);
    // Släckta markobjekt: inga linjer.
    expect(groundLines3d(s.doc, { ...view, hide: ['Ground'] }, { outlines: true, slopes: true }).outlines).toBeNull();
  });
});
