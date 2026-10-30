import { bookWithSheet, defaultSheet } from '../src/core/viewCategories';
import { beforeAll, describe, expect, it } from 'vitest';
import { updateParams } from '../src/core/commands';
import type { Element, ProjectDoc } from '../src/core/model';
import type { DocStore } from '../src/core/store';
import { registerBuiltInTypes } from '../src/elements';
import { resolveParams } from '../src/elements/registry';
import { roomHoles } from '../src/elements/rooms';
import { areaOf } from '../src/elements/space';
import type { WallParams } from '../src/elements/wall';
import { buildPlan } from '../src/repr/plan';
import type { Primitive } from '../src/repr/primitives';
import { shapeChange, shapeFields } from '../src/ui/shapeFields';
import { wallsProject } from './projekt';

/**
 * Rum: kontur och rumsgränser (0.8.34). En 2D-linje med *Avgränsar rum*
 * räknas som en tunn vägg när rummen räknas ut; rummens kontur ritas med
 * stilmallens penna (från början ingen) eller rummets eller typens egen.
 */

beforeAll(() => registerBuiltInTypes());

/** Ett rum 4 × 4 m (väggarnas mitt), en linje tvärs över i x = 2000 och ett rum till vänster om den. */
function alcove(): DocStore {
  return wallsProject(
    { s: [[0, 0], [4000, 0]], o: [[4000, 0], [4000, 4000]], n: [[4000, 4000], [0, 4000]], v: [[0, 4000], [0, 0]] },
    { gräns: [[2000, 100], [2000, 3900]] },
    { rum: { type: 'Space', params: { outline: [], seed: [1000, 2000] } } },
  );
}

const wallsOf = (doc: ProjectDoc) =>
  Object.values(doc.elements)
    .filter((e) => e.type === 'Wall')
    .map((e) => ({ id: e.id, p: resolveParams<WallParams>(doc, e) }));
const plan = (store: DocStore, hide?: string[]) => buildPlan(store.doc, store.doc.storeys[0].id, { state: store.doc.states.at(-1)!.id, ...(hide ? { hide } : {}) });
const roomArea = (store: DocStore, hide?: string[]): number => {
  const fill = plan(store, hide).prims.find((p) => p.origin?.objectId === 'rum' && p.kind === 'text' && /m²/.test(p.text));
  return Number((fill as Extract<Primitive, { kind: 'text' }>).text.replace(' m²', '').replace(',', '.'));
};
const outline = (store: DocStore) => plan(store).prims.find((p) => p.origin?.objectId === 'rum' && p.origin.part === 'kontur') as Extract<Primitive, { kind: 'polyline' }> | undefined;
const checkbox = (checked: boolean) => ({ value: 'on', checked }) as HTMLInputElement;

describe('rumsgränser (0.8.34)', () => {
  it('en linje med Avgränsar rum delar rummet, också med pennan 0 och 2D släckt', () => {
    const store = alcove();
    expect(roomArea(store)).toBe(14.4); // 3,8 × 3,8 m
    expect(shapeFields(store.doc, store.doc.elements['gräns'])).toContain('Avgränsar rum');
    shapeChange(store, ['gräns'], 'boundsRooms', checkbox(true));
    expect(store.doc.elements['gräns'].params.boundsRooms).toBe(true);
    // 1,9 m (minus en halv millimeter) × 3,8 m.
    expect(roomArea(store)).toBe(7.2);
    updateParams(store, ['gräns'], { weight: 0 });
    expect(roomArea(store, ['Shape2D'])).toBe(7.2);
    shapeChange(store, ['gräns'], 'boundsRooms', checkbox(false));
    expect(roomArea(store)).toBe(14.4);
  });

  it('en sluten form gör ett rum innanför sig, och hålen räknas om bara när gränsen ändras', () => {
    const store = alcove();
    const walls = wallsOf(store.doc);
    const box = { id: 'b', p: { shape: 'polyline', points: [[1000, 1000], [3000, 1000], [3000, 3000], [1000, 3000]], closed: true, weight: 0.25, linetype: 'solid', fillAngle: 45, fillSpacing: 2 } } as const;
    const holes = roomHoles(walls, [box as never]);
    expect(holes).toHaveLength(2);
    expect(Math.min(...holes.map((h) => areaOf(h)))).toBeCloseTo(4, 1);
    expect(roomHoles(walls, [box as never])).toBe(holes);
    expect(roomHoles(walls)).toHaveLength(1);
  });
});

describe('rummens kontur (0.8.34)', () => {
  it('ingen från början; stilmallens, typens och rummets egen penna', () => {
    const store = alcove();
    expect(outline(store)).toBeUndefined();
    store.transact('Penna', (tx) => tx.putElement({ ...store.doc.elements['rum'], pen: { weight: 0.35 } } as Element));
    expect(outline(store)?.pen.weight).toBe(0.35);
    expect(outline(store)?.under).toBe(true);
    store.transact('Utan', (tx) => {
      const { pen: _, ...rest } = store.doc.elements['rum'];
      tx.putElement(rest as Element);
      tx.setGraphics(bookWithSheet(store.doc.graphics, { ...defaultSheet(store.doc.graphics), pens: { roomOutline: { weight: 0.18 } } }));
    });
    expect(outline(store)?.pen.weight).toBe(0.18);
  });
});
