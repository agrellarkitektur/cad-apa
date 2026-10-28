import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { updateParams } from '../src/core/commands';
import { normalizeStyle } from '../src/core/graphics';
import { rotateElements } from '../src/core/transforms';
import { autoSide, fromFrame, leaderOf, snap15, toFrame, type TextBox } from '../src/elements/leader';
import type { Primitive, Vec2 } from '../src/repr/primitives';
import { resetTags } from '../src/ui/litteraSection';
import { tagDragPoint, tagGripsShown, tagPatch } from '../src/ui/tools/tagGrips';
import { planOf, toolHost, wallsProject } from './projekt';
import type { DocStore } from '../src/core/store';

beforeAll(() => registerBuiltInTypes());

/**
 * Litteran (0.10.20.1): den gemensamma ledaren med stam och knäck, sidan
 * som byter vid textens mittlinje, parallella ledare, ändarna, Shift i
 * steg om 15°, och greppen som flyttar text, punkt och stam.
 */

const PEN = { weight: 0.18 };
const box = (x: number, y: number): TextBox => ({ center: [x, y], halfW: 1000, halfH: 200, along: [1, 0], up: [0, 1] });
const lines = (ps: Primitive[]) => ps.filter((p): p is Extract<Primitive, { kind: 'line' }> => p.kind === 'line');

describe('ledaren', () => {
  it('går ut åt den sida punkten ligger och byter när texten passerar mittlinjen', () => {
    const t = [{ at: [0, -3000] as Vec2 }];
    expect(autoSide(box(3000, 0), t)).toBe('left');
    expect(autoSide(box(-3000, 0), t)).toBe('right');
    // Rakt över punkten: nedåt.
    expect(autoSide(box(100, 0), t)).toBe('down');
  });

  it('har en vågrät stam och en sned del till punkten, med stammens längd på papperet', () => {
    const g = leaderOf(box(5000, 0), [{ at: [0, -3000] }], { stub: 3, gap: 1, scale: 100, pen: PEN, end: 'none' })!;
    const [stub, diag] = lines(g.prims);
    expect(g.side).toBe('left');
    // Från textens vänstra sida, 1 mm ut, och 3 mm lång i 1:100.
    expect(stub.a).toEqual([3900, 0]);
    expect(stub.b).toEqual([3600, 0]);
    expect(diag.a).toEqual([3600, 0]);
    expect(diag.b).toEqual([0, -3000]);
  });

  it('når en punkt i stammens linje med stammen själv', () => {
    const g = leaderOf(box(0, 2000), [{ at: [0, 0], inside: true }], { stub: 3, gap: 1, scale: 100, pen: PEN, end: 'none' })!;
    expect(g.side).toBe('down');
    expect(lines(g.prims)).toHaveLength(1);
    expect(lines(g.prims)[0].b).toEqual([0, 0]);
  });

  it('räknar ut knäckarna så att flera ledare blir parallella, och stammen blir så lång som behövs', () => {
    const g = leaderOf(box(6000, 0), [{ at: [0, -2000] }, { at: [1000, -1000] }], { stub: 3, gap: 1, angle: 45, scale: 100, pen: PEN, end: 'none' })!;
    const [stub, d1, d2] = lines(g.prims);
    const ang = (l: { a: Vec2; b: Vec2 }) => Math.atan2(l.b[1] - l.a[1], l.b[0] - l.a[0]);
    expect(ang(d1)).toBeCloseTo(ang(d2));
    expect(ang(d1)).toBeCloseTo((-135 * Math.PI) / 180);
    // Stammen slutar vid den yttersta knäcken.
    expect(stub.b[0]).toBeCloseTo(Math.min(d1.a[0], d2.a[0]));
  });

  it('ritar ändarna: pil, fylld pil, prick, snedstreck, ring eller ingen; automatiskt prick inne i en yta', () => {
    const count = (end: Parameters<typeof leaderOf>[2]['end'], inside = false) => leaderOf(box(5000, 0), [{ at: [0, -3000], inside }], { stub: 3, scale: 100, pen: PEN, end })!.prims.length;
    expect(count('none')).toBe(2);
    expect(count('arrow')).toBe(4);
    expect(count('filled')).toBe(3);
    expect(count('dot')).toBe(3);
    expect(count('slash')).toBe(3);
    expect(count('ring')).toBe(3);
    const auto = leaderOf(box(5000, 0), [{ at: [0, -3000], inside: true }], { stub: 3, scale: 100, pen: PEN, end: 'auto' })!.prims;
    expect(auto.at(-1)?.kind).toBe('region');
  });

  it('avrundar den sneda delen till steg om 15° med samma längd', () => {
    const p = snap15([0, 0], [1000, 280]);
    expect((Math.atan2(p[1], p[0]) * 180) / Math.PI).toBeCloseTo(15);
    expect(Math.hypot(p[0], p[1])).toBeCloseTo(Math.hypot(1000, 280));
  });

  it('räknar förskjutningar i textens egna axlar fram och tillbaka', () => {
    const frame = { along: [0, 1] as Vec2, up: [-1, 0] as Vec2 };
    const d = fromFrame(toFrame([300, -200], frame), frame);
    expect(d[0]).toBeCloseTo(300);
    expect(d[1]).toBeCloseTo(-200);
  });
});

/** En vägg längs x-axeln med en dörr mitt på. */
function withDoor(): DocStore {
  const s = wallsProject({ a: [[0, 0], [6000, 0]] }, {}, { d: { type: 'Door', params: { at: 3000, width: 900, height: 2100, swing: 1, hinge: 'start', glazed: false, frameWidth: 50, frameDepth: 100, inset: null } } });
  // Typerna ur exemplet, så att littera har en text.
  const def = (t: string) => Object.values(s.doc.definitions).find((d) => d.elementType === t)!.id;
  s.transact('dörr', (tx) => {
    tx.putElement({ ...s.doc.elements.a, definition: def('Wall') });
    tx.putElement({ ...s.doc.elements.d, host: 'a', definition: def('Door') });
  });
  return s;
}
const litteraOf = (s: DocStore, id: string) => planOf(s).prims.filter((p) => p.origin?.objectId === id && p.origin.part === 'littera');

describe('littera på väggar och dörrar', () => {
  it('ger dörren en ledare när litteran flyttats, och tar bort den med Litteran tillbaka', () => {
    const s = withDoor();
    expect(lines(litteraOf(s, 'd'))).toHaveLength(0);
    updateParams(s, ['d'], { tag: { at: [0, 1500] } });
    const moved = litteraOf(s, 'd');
    expect(lines(moved).length).toBeGreaterThan(0);
    // Förvalet för dörrar är automatiskt: prick i dörrens mitt på väggen.
    expect(moved.some((p) => p.kind === 'region')).toBe(true);
    resetTags(s, ['d']);
    expect(s.doc.elements.d.params.tag).toBeUndefined();
    expect(lines(litteraOf(s, 'd'))).toHaveLength(0);
  });

  it('flyttar texten med greppet, i textens axlar, och punkten med Shift i 15°-steg', () => {
    const s = withDoor();
    const host = toolHost(s, ['a']);
    const text = tagGripsShown(host).find((g) => g.kind === 'text')!;
    const before = litteraOf(s, 'a').find((p) => p.kind === 'text') as Extract<Primitive, { kind: 'text' }>;
    const to = tagDragPoint(text, text.at, [text.at[0] + 2000, text.at[1] + 1000], false);
    updateParams(s, ['a'], tagPatch(host, text, to)!.patch);
    const after = litteraOf(s, 'a').find((p) => p.kind === 'text') as Extract<Primitive, { kind: 'text' }>;
    expect(after.at[0] - before.at[0]).toBeCloseTo(2000);
    expect(after.at[1] - before.at[1]).toBeCloseTo(1000);
    // Nu viker ledaren av mot väggen; punkten dras med Shift.
    const target = tagGripsShown(host).find((g) => g.kind === 'target')!;
    const knee = target.handles.stubEnd!;
    const p = tagDragPoint(target, target.at, [knee[0] - 900, knee[1] - 2300], true);
    const deg = (Math.atan2(p[1] - knee[1], p[0] - knee[0]) * 180) / Math.PI;
    expect(Math.abs(deg / 15 - Math.round(deg / 15))).toBeLessThan(1e-9);
  });

  it('ändrar stammens längd med knäcken', () => {
    const s = withDoor();
    updateParams(s, ['a'], { tag: { at: [2000, 1000] } });
    const host = toolHost(s, ['a']);
    const knee = tagGripsShown(host).find((g) => g.kind === 'knee')!;
    const h = knee.handles;
    const pt = tagDragPoint(knee, knee.at, [h.stubStart![0] + h.dir![0] * 800, h.stubStart![1] + h.dir![1] * 800], false);
    updateParams(s, ['a'], tagPatch(host, knee, pt)!.patch);
    // 800 mm i modellen i 1:100 är 8 mm på papperet.
    expect((s.doc.elements.a.params.tag as { stub: number }).stub).toBe(8);
  });
});

describe('rummets och stilmallens ledare', () => {
  it('vrider punktens förskjutning med rummet', () => {
    const s = wallsProject({}, {}, { r: { type: 'Space', params: { outline: [[0, 0], [3000, 0], [3000, 3000], [0, 3000]], labelAt: [6000, 1500], tag: { to: [0, 500] } } } });
    rotateElements(s, ['r'], [0, 0], 90);
    expect(s.doc.elements.r.params.tag).toEqual({ to: [-500, 0] });
  });

  it('har förval per sort i stilmallen och rättar ogiltiga värden', () => {
    const st = normalizeStyle({ format: 'bacchus-style', labels: { leaders: { Door: { end: 'konstig', stub: -1 }, Space: { end: 'dot', stub: 4 } } } });
    expect(st.labels.leaders.Door).toEqual({ end: 'auto', stub: 3 });
    expect(st.labels.leaders.Space).toEqual({ end: 'dot', stub: 4 });
    expect(st.labels.leaders.Wall.end).toBe('none');
  });
});
