import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { renderHighlight } from '../src/ui/highlight';
import { Camera } from '../src/view2d/camera';
import type { Pickable } from '../src/repr/plan';
import type { Primitive, Vec2 } from '../src/repr/primitives';
import { DocStore } from '../src/core/store';
import { sampleProject } from '../src/sample/sampleProject';

/** 0.10.19.1: markeringen följer konturen också när objektet har många linjer. */
describe('markeringen av ett objekt med många linjer', () => {
  beforeAll(() => registerBuiltInTypes());

  const many = (n: number): Primitive[] =>
    Array.from({ length: n }, (_, i): Primitive => ({ kind: 'line', a: [i, 0], b: [i, 100], pen: { weight: 0.13 } }));
  const cam = new Camera();
  cam.resize(800, 600);

  it('ett markobjekt med kontur markeras med konturen, inte med ramen', () => {
    const ring: Vec2[] = [[0, 0], [4000, 0], [4000, 2000], [1000, 3000], [0, 2000]];
    const item: Pickable = { id: 'a', priority: 1, regions: [[ring]], prims: many(400) };
    const svg = renderHighlight(cam, new DocStore(structuredClone(sampleProject())).doc, [item], new Set(['a']), null, false);
    expect(svg).toContain('hl-sel-line');
    // Konturens femte hörn (1000, 3000) finns i markeringen; en ram hade bara fyra hörn.
    const s = cam.toScreen([1000, 3000]);
    expect(svg).toContain(`${s[0]} ${s[1]}`);
  });

  it('ett objekt utan kontur men med många linjer får ramen som förut', () => {
    const item: Pickable = { id: 'b', priority: 1, regions: [], prims: many(400) };
    const svg = renderHighlight(cam, new DocStore(structuredClone(sampleProject())).doc, [item], new Set(['b']), null, false);
    expect(svg.match(/hl-sel-line/g)?.length).toBe(1);
  });
});
