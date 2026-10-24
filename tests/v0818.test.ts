import { describe, expect, it } from 'vitest';
import { Camera } from '../src/view2d/camera';
import { buildGrid, minorStepFor } from '../src/view2d/grid';

function cam(denominator: number): Camera {
  const c = new Camera();
  c.width = 1200;
  c.height = 800;
  c.center = [0, 0];
  c.scale = Camera.scaleFor(denominator);
  return c;
}
const levelOf = (g: ReturnType<typeof buildGrid>, step: number) => g.levels.find((l) => l.step === step);

describe('0.8.18 rutnätet', () => {
  it('500-strecken finns kvar när 100-strecken kommer in', () => {
    for (const d of [20, 30, 50, 80, 120, 170]) {
      const g = buildGrid(cam(d));
      const l500 = levelOf(g, 500);
      expect(l500, `1:${d}`).toBeTruthy();
      expect(l500!.opacity).toBeGreaterThan(0.2);
    }
  });
  it('grövre nivåer är minst lika starka som finare', () => {
    for (const d of [10, 27, 50, 170, 500, 2000]) {
      const g = buildGrid(cam(d));
      for (let i = 1; i < g.levels.length; i++) expect(g.levels[i].opacity).toBeGreaterThanOrEqual(g.levels[i - 1].opacity);
    }
  });
  it('0,1 m-strecken syns vid 1:27 men inte vid 1:170', () => {
    expect(levelOf(buildGrid(cam(27)), 100)!.opacity).toBeGreaterThan(0.3);
    expect(levelOf(buildGrid(cam(170)), 100)).toBeUndefined();
  });
  it('statusradens steg följer det som syns', () => {
    expect(minorStepFor(Camera.scaleFor(50))).toBe(500);
    expect(minorStepFor(Camera.scaleFor(20))).toBe(100);
  });
});

import { dividePath } from '../src/ui/tools/measureTool';
import { DocStore } from '../src/core/store';
import { createFolder, moveIntoFolder } from '../src/core/treeCommands';
import { sampleProject } from '../src/sample/sampleProject';
import { registerBuiltInTypes } from '../src/elements';
import { writePdf } from '../src/formats/pdf';
import { drawingText, textWidth } from '../src/formats/drawingFont';

describe('0.8.18 segmentpunkter', () => {
  it('delar en sträcka i lika delar', () => {
    expect(dividePath([[0, 0], [1000, 0]], 4)).toEqual([[250, 0], [500, 0], [750, 0]]);
  });
  it('delar längs hela mätningen, över brytpunkter', () => {
    const p = dividePath([[0, 0], [300, 0], [300, 300]], 3);
    expect(p).toEqual([[200, 0], [300, 100]]);
  });
  it('för få punkter eller delar ger inget', () => {
    expect(dividePath([[0, 0]], 3)).toEqual([]);
    expect(dividePath([[0, 0], [10, 0]], 1)).toEqual([]);
  });
});

describe('0.8.18 dra till mappar', () => {
  registerBuiltInTypes();
  it('flyttar flera, och en mapp i en mapp, i ett steg', () => {
    const store = new DocStore(sampleProject());
    const a = createFolder(store, 'vyer', 'A');
    const b = createFolder(store, 'vyer', 'B');
    const views = store.doc.views.slice(0, 2).map((v) => v.id);
    expect(moveIntoFolder(store, [...views, b], a)).toBe(views.length + 1);
    for (const v of views) expect(store.doc.tree[v]).toBe(a);
    expect(store.doc.folders.find((f) => f.id === b)!.parent).toBe(a);
    // En mapp kan inte läggas i sin egen undermapp.
    expect(moveIntoFolder(store, [a], b)).toBe(0);
    expect(moveIntoFolder(store, views, null)).toBe(views.length);
    for (const v of views) expect(store.doc.tree[v]).toBeUndefined();
  });
});

describe('0.8.18 osifont', () => {
  it('byter ut tecken som osifont saknar', () => {
    expect(drawingText('”Rum” …')).toBe('"Rum" ...');
    expect(textWidth('ÅÄÖ åäö', 10)).toBeGreaterThan(0);
  });
  it('bäddar in typsnittet i PDF:en när det finns text', async () => {
    const pages = [{ size: [210, 297] as [number, number], prims: [{ kind: 'text' as const, at: [10, 10] as [number, number], text: 'Plan 1:100 – Vardagsrum', height: 3.5, pen: { weight: 0.25 } }] }];
    const pdf = new TextDecoder('latin1').decode(await writePdf(pages));
    expect(pdf).toContain('/BaseFont /Osifont');
    expect(pdf).toContain('/FontFile2');
    const none = new TextDecoder('latin1').decode(await writePdf([{ size: [210, 297] as [number, number], prims: [] }]));
    expect(none).not.toContain('/FontFile2');
  });
});
