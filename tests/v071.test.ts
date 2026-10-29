import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { typeOf } from '../src/elements/registry';
import { createContext } from '../src/repr/context';
import { sampleProject } from '../src/sample/sampleProject';
import { buildSection } from '../src/repr/section';
import { buildPlan } from '../src/repr/plan';
import { DocStore } from '../src/core/store';
import { FORMAT_VERSION, type ProjectDoc } from '../src/core/model';
import { skewOf, skewWarnings } from '../src/elements/angleCheck';
import { offsetEdge } from '../src/geometry/offsetEdge';
import { copyPayload, originalsHere, parsePayload, pasteClip } from '../src/core/clipboard';
import { openingsInCorner, roundCorner } from '../src/core/wallEdit';
import { readableAngle } from '../src/elements/markers';
import { measure } from '../src/ui/tools/measureTool';
import type { Edges3D, Shape3D } from '../src/repr/solids';
import type { Primitive } from '../src/repr/primitives';

beforeAll(() => registerBuiltInTypes());

const view = (detail: 'sketch' | 'normal' | 'detail', hide: string[] = []) => ({ state: 'st-a', compareTo: 'st-bef', detail, hide }) as any;

function model(doc: ProjectDoc, id: string, detail: 'sketch' | 'normal' | 'detail'): Shape3D[] {
  const el = doc.elements[id];
  const { ctx } = createContext(doc, el.storey, view(detail), doc.graphics, () => true);
  return typeOf(el.type)!.model3d!(el, ctx);
}

const parts = (shapes: Shape3D[]) => new Set(shapes.filter((s): s is Edges3D => s.kind === 'edges').map((s) => s.part));

describe('detaljnivå i fasad och sektion (0.7.1)', () => {
  it('Skiss: bara hålet, med en ruta så att man inte ser in', () => {
    const shapes = model(sampleProject(), 'f01', 'sketch');
    expect(shapes.filter((s) => s.kind === 'edges')).toHaveLength(0);
    expect(shapes.some((s) => s.kind !== 'edges')).toBe(true);
  });
  it('Normal: karm, båge, foder och glasmarkering, inga sammanfogningar', () => {
    const p = parts(model(sampleProject(), 'f01', 'normal'));
    for (const k of ['frame', 'sash', 'lining', 'glass']) expect(p.has(k as any)).toBe(true);
    expect(p.has('joint')).toBe(false);
  });
  it('Detalj: sammanfogningar och fönsterbänk', () => {
    const p = parts(model(sampleProject(), 'f01', 'detail'));
    expect(p.has('joint')).toBe(true);
    expect(p.has('sill')).toBe(true);
  });
  it('glasmarkering och öppningssätt syns bara på ritningen, inte i 3D', () => {
    const edges = model(sampleProject(), 'd01', 'normal').filter((s): s is Edges3D => s.kind === 'edges');
    const swing = edges.filter((e) => e.part === 'swing');
    expect(swing.length).toBeGreaterThan(0);
    expect(swing.every((e) => e.drawingOnly && e.dash)).toBe(true);
  });
  it('öppningssättet kan stängas av', () => {
    const doc = sampleProject();
    const el = doc.elements['d01'];
    const { ctx } = createContext(doc, el.storey, view('normal', ['swing']), doc.graphics, () => true);
    const edges = typeOf('Door')!.model3d!(el, ctx).filter((s): s is Edges3D => s.kind === 'edges');
    expect(edges.some((e) => e.part === 'swing')).toBe(false);
  });
});

describe('linjer i fasad och sektion (0.7.1)', () => {
  it('hålen tjockast, karmen tunnare, sammanfogningar tunnast och grå, marklinjen 0,7', () => {
    const r = buildSection(sampleProject(), 'fasad-1', view('detail'))!;
    const weight = (part: string) => r.prims.find((p) => p.kind === 'line' && p.origin?.part === part) as Extract<Primitive, { kind: 'line' }> | undefined;
    expect(weight('frame')?.pen.weight).toBe(0.25);
    expect(weight('joint')?.pen.weight).toBe(0.13);
    expect(weight('joint')?.pen.color).toBe('muted');
    expect(r.prims.some((p) => p.kind === 'line' && p.origin?.part === 'mark' && p.pen.weight === 0.7)).toBe(true);
  });
  it('taklutningen sätts ut på gaveln och kan stängas av', () => {
    const doc = sampleProject();
    const slope = (hide: string[], detail: 'sketch' | 'normal' = 'normal') =>
      buildSection(doc, 'fasad-2', view(detail, hide))!.prims.filter((p) => p.origin?.part === 'taklutning');
    const normal = slope([]);
    expect(normal.some((p) => p.kind === 'text' && p.text === '27°')).toBe(true);
    expect(normal.some((p) => p.kind === 'arc')).toBe(true);
    const sketch = slope([], 'sketch');
    expect(sketch.every((p) => p.kind === 'text')).toBe(true);
    expect(sketch).toHaveLength(2);
    expect(slope(['roofSlope'])).toHaveLength(0);
    // Från långsidan syns takfallet inte i sin lutning.
    expect(buildSection(doc, 'fasad-1', view('normal'))!.prims.some((p) => p.origin?.part === 'taklutning')).toBe(false);
  });
  it('sektionen ritas bara så långt som linjen går', () => {
    const doc = sampleProject();
    const el = doc.elements['sektion-a'];
    el.params = { ...el.params, auto: false, start: [2000, 4000], end: [6000, 4000], side: 1 };
    const r = buildSection(doc, 'sektion-a', view('normal'))!;
    const xs = r.prims.flatMap((p) => (p.kind === 'line' && p.origin?.part !== 'mark' && p.origin?.part !== 'nivå' && p.origin?.part !== 'höjdmått' ? [p.a[0], p.b[0]] : p.kind === 'region' && p.role === 'cut' && p.origin?.part !== 'nivå' ? p.rings.flat().map((q) => q[0]) : []));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-1);
    expect(Math.max(...xs)).toBeLessThanOrEqual(4001);
  });
});

describe('markörer i planen (0.7.1)', () => {
  it('text längs en linje vänds aldrig upp och ned', () => {
    for (let a = 0; a < 360; a += 15) {
      const r = (a * Math.PI) / 180;
      const t = readableAngle([Math.cos(r), Math.sin(r)]);
      expect(t).toBeGreaterThan(-Math.PI / 2 - 1e-9);
      expect(t).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
    }
  });
  it('fasaden har sitt namn i versaler och sektionen ingen streckprickad linje', () => {
    const doc = sampleProject();
    const prims = buildPlan(doc, 'pl-1', { state: 'st-a' }).prims;
    expect(prims.some((p) => p.kind === 'text' && p.text === 'FASAD MOT SYD')).toBe(true);
    const sec = prims.filter((p) => p.origin?.objectId === 'sektion-a');
    expect(sec.some((p) => p.kind === 'line' && p.pen.dash)).toBe(false);
    expect(sec.some((p) => p.kind === 'text' && p.text === 'A' && typeof p.angle === 'number')).toBe(true);
  });
});

describe('nästan raka vinklar (0.7.1)', () => {
  const doc = sampleProject();
  const el = (end: [number, number]) => ({ ...doc.elements['iv-1'], params: { ...doc.elements['iv-1'].params, start: [5000, 400], end } });
  it('varnar för en vägg som är nästan lodrät', () => {
    const w = skewOf(doc, el([5060, 7600]), 5)!;
    expect(w.nearest).toBe(90);
    expect(w.offset).toBeCloseTo(60, 0);
  });
  it('exakt eller inom en halv millimeter är rakt', () => {
    expect(skewOf(doc, el([5000, 7600]), 5)).toBeNull();
    expect(skewOf(doc, el([5000.4, 7600]), 5)).toBeNull();
  });
  it('långt ifrån en rak vinkel, eller avstängt, ger ingen varning', () => {
    expect(skewOf(doc, el([7000, 7600]), 5)).toBeNull();
    expect(skewOf(doc, el([5060, 7600]), 0)).toBeNull();
  });
  it('exemplet är rakt ritat', () => {
    expect(skewWarnings(sampleProject(), 'pl-1', 'st-a', 5)).toHaveLength(0);
  });
});

describe('takets kontur (0.7.1)', () => {
  const sq: [number, number][] = [
    [0, 0],
    [4000, 0],
    [4000, 3000],
    [0, 3000],
  ];
  it('förskjut en kant: grannarna följer med', () => {
    // Moturs: åt vänster längs kanten är inåt, så −300 är utåt.
    expect(offsetEdge(sq, 0, -300)).toEqual([
      [0, -300],
      [4000, -300],
      [4000, 3000],
      [0, 3000],
    ]);
    expect(offsetEdge(sq, 0, 3000)).toBeNull();
    expect(offsetEdge(sq, 0, 4000)).toBeNull();
  });
});

describe('kopiera och klistra in (0.7.1)', () => {
  it('en vägg med dörr till ett annat projekt, med sin typ', () => {
    const from = sampleProject();
    const clip = parsePayload(JSON.stringify(copyPayload(from, ['yv-s'], 'pl-1')))!;
    expect(clip.format).toBe(FORMAT_VERSION);
    const target = sampleProject();
    for (const id of Object.keys(target.elements)) if (target.elements[id].type !== 'North') delete target.elements[id];
    target.definitions = {};
    target.project = { ...target.project, name: 'Annat projekt' };
    const store = new DocStore(target);
    expect(originalsHere(store.doc, clip, 'st-a', 'pl-1')).toBe(false);
    const ids = pasteClip(store, clip, 'st-b', 'pl-1', [0, 0]);
    expect(ids).toHaveLength(1);
    const wall = store.doc.elements[ids[0]];
    expect(wall.states).toEqual(['st-b']);
    expect(store.doc.definitions[wall.definition!]?.name).toBe('YV01');
    const hosted = Object.values(store.doc.elements).filter((e) => e.host === wall.id);
    expect(hosted.length).toBeGreaterThan(0);
    expect(hosted.every((h) => store.doc.definitions[h.definition!])).toBe(true);
  });
  it('i samma projekt hamnar kopian bredvid, och typerna återanvänds', () => {
    const store = new DocStore(sampleProject());
    const clip = copyPayload(store.doc, ['m03', 'north'], 'pl-1')!;
    expect(originalsHere(store.doc, clip, 'st-a', 'pl-1')).toBe(true);
    const defs = Object.keys(store.doc.definitions).length;
    const ids = pasteClip(store, clip, 'st-a', 'pl-1', [1000, -1000]);
    // Norrpilen finns bara en gång.
    expect(ids).toHaveLength(1);
    expect(store.doc.elements[ids[0]].params.origin).toEqual([2220 + 1000, 4400 - 1000]);
    expect(Object.keys(store.doc.definitions)).toHaveLength(defs);
  });
  it('urklipp från en nyare version tas inte emot', () => {
    expect(parsePayload(JSON.stringify({ kind: 'bacchus-clip', format: FORMAT_VERSION + 1, elements: [], definitions: [] }))).toBeNull();
    expect(parsePayload('vanlig text')).toBeNull();
  });
});

describe('avrunda hörn med öppningar (0.7.1)', () => {
  it('stoppas om ett fönster skulle hamna utanför väggen', () => {
    const store = new DocStore(sampleProject());
    const doc = store.doc;
    // Fönster F2 sitter nära östra änden av södra väggen.
    const f02 = Object.values(doc.elements).find((e) => e.host === 'yv-s' && e.definition === 't-f2')!;
    const len = 11600;
    const at = f02.params.at as number;
    expect(openingsInCorner(doc, 'yv-s', 'end', len - at)).toContain(f02.id);
    expect(roundCorner(store, 'yv-s', 'end', len - at + 500, 'chamfer')).toBeNull();
    expect(roundCorner(store, 'yv-s', 'end', 300, 'chamfer')).not.toBeNull();
  });
});

describe('måttband (0.7.1)', () => {
  it('mäter sträckor, vinkel och yta', () => {
    const m = measure([
      [0, 0],
      [4000, 0],
      [4000, 3000],
    ]);
    expect(m.last).toBe(3000);
    expect(m.total).toBe(7000);
    expect(m.angle).toBe(90);
    expect(m.turn).toBeCloseTo(90);
    expect(m.area).toBeCloseTo(6);
  });
});
