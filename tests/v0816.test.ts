import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { parseDxf } from '../src/formats/dxf';
import { underlayCorners, underlaySnaps, type UnderlayParams } from '../src/elements/underlay';
import { dragUnderlayGrip, resizeUnderlay, restoreProportions, stretched, underlayGrips, underlaySize } from '../src/elements/underlayEdit';
import type { ProjectDoc } from '../src/core/model';
import { sampleProject } from '../src/sample/sampleProject';
import { forgetInferred, snap, type SnapSegment } from '../src/ui/tools/snap';
import type { Vec2 } from '../src/repr/primitives';
import { dxf } from './projekt';

beforeAll(() => registerBuiltInTypes());


const near = (a: readonly number[], b: readonly number[], eps = 1e-6) => expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(eps);

const FILE = dxf(`
  0\nLINE\n8\nL\n10\n0\n20\n0\n11\n6000\n21\n0\n
  0\nCIRCLE\n8\nC\n10\n3000\n20\n2000\n40\n500\n
  0\nARC\n8\nC\n10\n0\n20\n0\n40\n1000\n50\n0\n51\n90\n
  0\nLWPOLYLINE\n8\nP\n90\n3\n70\n0\n10\n0\n20\n3000\n42\n1\n10\n2000\n20\n3000\n10\n2000\n20\n4000\n`);

function docWith(text: string): ProjectDoc {
  const doc = sampleProject();
  doc.assets['fil-t'] = { id: 'fil-t', name: 't.dxf', mime: 'application/dxf', data: btoa(text) };
  return doc;
}

const params = (over: Partial<UnderlayParams> = {}): UnderlayParams => ({ asset: 'fil-t', kind: 'dxf', pos: [0, 0], angle: 0, scale: 1, size: [6000, 4000], ref: [0, 0], opacity: 70, ...over });

describe('snäpp i DXF-underlag (0.8.16)', () => {
  it('parsern skiljer hörn från punkter längs bågar och ger centrum och kvadranter', () => {
    const d = parseDxf(FILE);
    const polys = d.items.filter((i) => i.kind === 'poly');
    const [line, circle, arc, pl] = polys as Extract<(typeof polys)[number], { kind: 'poly' }>[];
    expect(line.corners).toBeUndefined();
    expect(circle.corners).toEqual([]);
    near(circle.curve!.c, [3000, 2000]);
    expect(circle.curve!.quadrants).toHaveLength(4);
    expect(arc.corners).toEqual([0, arc.pts.length - 1]);
    near(arc.curve!.mid!, [1000 * Math.SQRT1_2, 1000 * Math.SQRT1_2]);
    // Polylinjen med en bult i första sträckan: tre hörn, bågen emellan.
    expect(pl.corners).toHaveLength(3);
    expect(pl.corners![0]).toBe(0);
    expect(pl.corners![2]).toBe(pl.pts.length - 1);
    expect(pl.corners![1]).toBe(pl.pts.length - 2);
  });

  it('underlagets snäpp: raka linjer, bågbitar utan egna punkter, centrum, kvadranter och bågmitt, i modellens läge', () => {
    const doc = docWith(FILE);
    const s = underlaySnaps(doc, 'ul', params({ pos: [10000, 0], ref: [0, 0] }));
    const pts = (k: string) => s.filter((x) => x.point === k).map((x) => x.a);
    expect(pts('center').some((q) => Math.hypot(q[0] - 13000, q[1] - 2000) < 1e-6)).toBe(true);
    expect(pts('quadrant')).toHaveLength(4);
    expect(pts('midpoint')).toHaveLength(1);
    // Linjen är rak och flyttad med underlaget.
    const line = s.find((x) => !x.point && !x.curve && x.a[1] === 0 && x.b[1] === 0)!;
    near(line.a, [10000, 0]);
    near(line.b, [16000, 0]);
    // Cirkeln är bara bitar av en kurva.
    expect(s.filter((x) => x.curve).length).toBeGreaterThan(40);
    // Polylinjens raka del (2000,3000)–(2000,4000) är rak.
    expect(s.some((x) => !x.curve && !x.point && Math.abs(x.a[0] - 12000) < 1e-6 && Math.abs(x.b[0] - 12000) < 1e-6)).toBe(true);
    // Ett släckt lager ger ingenting.
    expect(underlaySnaps(doc, 'ul', params({ layersOff: ['C', 'P', 'L'] }))).toHaveLength(0);
  });

  it('snap: centrum och kvadrant går före bitarna i cirkeln, och bitarnas skarvar är inga ändpunkter', () => {
    const doc = docWith(FILE);
    const segs = underlaySnaps(doc, 'ul', params()) as SnapSegment[];
    const c = snap({ cursor: [3004, 2003], segments: segs, tol: 20 });
    expect(c.kind).toBe('center');
    const q = snap({ cursor: [3505, 2004], segments: segs, tol: 20 });
    expect(q.kind).toBe('quadrant');
    near(q.point, [3500, 2000]);
    // Mitt på cirkelbågen mellan kvadranterna: på linjen, inte en skarv.
    const a = (Math.PI / 4) * 0.9;
    const on = snap({ cursor: [3000 + 500 * Math.cos(a) + 3, 2000 + 500 * Math.sin(a)], segments: segs, tol: 10 });
    expect(on.kind).toBe('on-wall');
    expect(on.label).toBe('På linjen');
  });

  it('snap: skärningen mellan två linjer utan att ha en föregående punkt', () => {
    const segs: SnapSegment[] = [
      { id: 'a', a: [0, 0], b: [1000, 600] },
      { id: 'b', a: [0, 1000], b: [1000, 0] },
    ];
    const r = snap({ cursor: [630, 372], segments: segs, tol: 10 });
    expect(r.kind).toBe('intersection');
    near(r.point, [625, 375]);
    // Där två linjer möts i en ände är det en ändpunkt.
    const e = snap({ cursor: [3, 2], segments: [{ id: 'a', a: [0, 0], b: [1000, 0] }, { id: 'b', a: [0, 0], b: [0, 1000] }], tol: 10 });
    expect(e.kind).toBe('endpoint');
  });

  it('parallellt och vinkelrätt: en sned linje man känt på drar till sig riktningen', () => {
    forgetInferred();
    const dir: Vec2 = [Math.cos((20 * Math.PI) / 180), Math.sin((20 * Math.PI) / 180)];
    const edge: SnapSegment = { id: 'e', a: [0, 0], b: [dir[0] * 5000, dir[1] * 5000] };
    // Känn på linjen.
    snap({ cursor: [dir[0] * 2500 + 2, dir[1] * 2500 - 3], segments: [edge], tol: 10 });
    // Rita från en punkt långt bort, nästan i 20°.
    const from: Vec2 = [0, 10000];
    const cur: Vec2 = [from[0] + 3000 * Math.cos((21 * Math.PI) / 180), from[1] + 3000 * Math.sin((21 * Math.PI) / 180)];
    const r = snap({ cursor: cur, from, segments: [edge], tol: 10 });
    expect(r.kind).toBe('parallel');
    expect(r.label).toBe('Parallellt med linjen');
    const v = [r.point[0] - from[0], r.point[1] - from[1]];
    expect(Math.abs(v[0] * dir[1] - v[1] * dir[0])).toBeLessThan(1e-6);
    // Nästan vinkelrätt (110°).
    const cur2: Vec2 = [from[0] + 3000 * Math.cos((111 * Math.PI) / 180), from[1] + 3000 * Math.sin((111 * Math.PI) / 180)];
    const p = snap({ cursor: cur2, from, segments: [edge], tol: 10 });
    expect(p.label).toBe('Vinkelrätt mot linjen');
    const w = [p.point[0] - from[0], p.point[1] - from[1]];
    expect(Math.abs(w[0] * dir[0] + w[1] * dir[1])).toBeLessThan(1e-6);
    // Med Shift låses det man står i (0.10.29), här parallellt med linjen.
    expect(snap({ cursor: cur, from, segments: [edge], tol: 10, ortho: true }).kind).not.toBe('parallel');
    forgetInferred();
    expect(snap({ cursor: cur, from, segments: [edge], tol: 10 }).kind).not.toBe('parallel');
  });
});


describe('bildens grepp och mått (0.8.16)', () => {
  const img = (over: Partial<UnderlayParams> = {}): UnderlayParams => ({ asset: 'fil-b', kind: 'image', pos: [1000, 2000], angle: 0, scale: 10, size: [400, 300], opacity: 55, ...over });

  it('hörnen skalar proportionellt kring motsatt hörn, också vriden', () => {
    for (const angle of [0, 30]) {
      const p = img({ angle });
      const [bl] = underlayCorners(p);
      const tr = underlayCorners(p)[2];
      // Dra övre högra hörnet mot dubbla storleken (lite snett).
      const target: [number, number] = [bl[0] + (tr[0] - bl[0]) * 2 + 5, bl[1] + (tr[1] - bl[1]) * 2 - 5];
      const r = dragUnderlayGrip(p, { kind: 'corner', index: 2 }, target)!;
      expect(r.scale).toBeCloseTo(20, 1);
      expect(r.size).toEqual([400, 300]);
      near(r.pos, p.pos, 0.06);
      // Nedre vänstra hörnet dras: övre högra ligger still.
      const r2 = dragUnderlayGrip(p, { kind: 'corner', index: 0 }, [bl[0] + (tr[0] - bl[0]) / 2, bl[1] + (tr[1] - bl[1]) / 2])!;
      expect(r2.scale).toBeCloseTo(5);
      near(underlayCorners({ ...p, ...r2 })[2], tr, 0.1);
    }
  });

  it('Shift i ett hörn och sidorna sträcker; motsatt sida ligger still', () => {
    const p = img();
    const free = dragUnderlayGrip(p, { kind: 'corner', index: 2 }, [1000 + 8000, 2000 + 6000], true)!;
    expect(underlaySize({ ...p, ...free }).map(Math.round)).toEqual([8000, 6000]);
    const right = dragUnderlayGrip(p, { kind: 'side', index: 1 }, [1000 + 5000, 99999])!;
    expect(underlaySize({ ...p, ...right }).map(Math.round)).toEqual([5000, 3000]);
    expect(right.pos).toEqual([1000, 2000]);
    const left = dragUnderlayGrip(p, { kind: 'side', index: 3 }, [0, 0])!;
    expect(underlaySize({ ...p, ...left }).map(Math.round)).toEqual([5000, 3000]);
    expect(left.pos).toEqual([0, 2000]);
    const bottom = dragUnderlayGrip(p, { kind: 'side', index: 0 }, [0, 1000])!;
    expect(underlaySize({ ...p, ...bottom }).map(Math.round)).toEqual([4000, 4000]);
    expect(bottom.pos).toEqual([1000, 1000]);
    // Förbi motsatt sida går inte.
    expect(dragUnderlayGrip(p, { kind: 'side', index: 1 }, [500, 0])).toBeNull();
    expect(underlayGrips(p)).toHaveLength(8);
  });

  it('bredd och höjd sträcker var för sig, och proportionerna kan återställas med samma bredd', () => {
    const p = img();
    const r = resizeUnderlay(p, null, 6000)!;
    const q = { ...p, ...r };
    expect(underlaySize(q).map(Math.round)).toEqual([4000, 6000]);
    expect(stretched(q, [400, 300])).toBe(true);
    const back = { ...q, ...restoreProportions(q, [400, 300]) };
    expect(stretched(back, [400, 300])).toBe(false);
    expect(underlaySize(back).map(Math.round)).toEqual([4000, 3000]);
    expect(back.pos).toEqual(p.pos);
  });

  it('bildens hörn och sidors mitt är snäppunkter', () => {
    const doc = docWith(FILE);
    const segs = underlaySnaps(doc, 'b', img()) as SnapSegment[];
    const r = snap({ cursor: [5003, 5002], segments: segs, tol: 10 });
    expect(r.kind).toBe('endpoint');
    near(r.point, [5000, 5000]);
    const m = snap({ cursor: [3002, 2003], segments: segs, tol: 10 });
    expect(m.kind).toBe('midpoint');
  });
});
