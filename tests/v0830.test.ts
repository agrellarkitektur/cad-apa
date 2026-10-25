import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { SWEDISH_STANDARD, type StyleSheet } from '../src/core/graphics';
import { lineTypeDash, parseDash, formatDash, newLineTypeId } from '../src/core/lineTypes';
import { fillPrims, shapePrims, type Shape2DParams } from '../src/elements/drawing2d';
import { coverLines } from '../src/repr/cover';
import { dashPieces } from '../src/repr/dash';
import { markerPen, solidPen } from '../src/repr/markerPens';
import type { PolylinePrim, Primitive, RegionPrim, Vec2 } from '../src/repr/primitives';
import { toPaper } from '../src/repr/sheet';
import { writePdf } from '../src/formats/pdf';
import { renderPrimitives } from '../src/view2d/renderPrimitives';
import { Camera } from '../src/view2d/camera';
import { shapeChange } from '../src/ui/shapeFields';
import { addLineType, applyLineTypeField, removeLineType } from '../src/ui/style/lineTypes';
import { applyPenField } from '../src/ui/style/pens';
import { planOf as plan, SHAPE as base, square, storeWithShapes as storeWith } from './projekt';

beforeAll(() => registerBuiltInTypes());

const circle = (r: number, n = 72): Vec2[] => Array.from({ length: n }, (_, i): Vec2 => [r * Math.cos((2 * Math.PI * i) / n), r * Math.sin((2 * Math.PI * i) / n)]);
const withOwn = (dash: number[]): StyleSheet => ({ ...structuredClone(SWEDISH_STANDARD), lineTypes: [{ id: 'egen-1', name: 'Min', dash }] });


describe('Streckmönstret längs linjen (0.8.30)', () => {
  it('en cirkel är en sträcka med ett helt antal perioder', () => {
    const pieces = dashPieces(circle(100), true, [3, 1.5]);
    expect(pieces).toHaveLength(1);
    const len = 2 * Math.PI * 100;
    const period = pieces[0].dash!.reduce((a, b) => a + b, 0);
    // Två perioder i mönstret (udda antal görs jämnt), ett helt antal varv.
    expect((len / period) % 1).toBeCloseTo(0, 1);
  });

  it('skarpa hörn delar linjen, som förut sträcka för sträcka', () => {
    const pieces = dashPieces(square(0, 0, 100), true, [3, 1.5]);
    expect(pieces).toHaveLength(4);
    // Varje sida börjar och slutar med ett helt streck: (n perioder + ett streck) = sidan.
    const d = pieces[0].dash!;
    const n = (100 - d[0]) / (d[0] + d[1]);
    expect(n % 1).toBeCloseTo(0, 6);
  });

  it('en bit av en linje fortsätter mönstret där den hela linjen hade det', () => {
    const whole: Vec2[] = [
      [0, 0],
      [100, 0],
    ];
    const all = dashPieces(whole, false, [3, 1.5]);
    const piece = dashPieces(
      [
        [40, 0],
        [100, 0],
      ],
      false,
      [3, 1.5],
      { points: whole, closed: false, at: 40 },
    );
    expect(piece[0].dash).toEqual(all[0].dash);
    expect(piece[0].offset).toBeCloseTo(40);
  });

  it('en kapad linje får linjen den kommer ifrån', () => {
    const under: Primitive = { kind: 'polyline', points: [[0, 500], [3000, 500]], closed: false, pen: { weight: 0.25, dash: [3, 1.5] } };
    const cover: Primitive = { kind: 'region', role: 'cut', rings: [square(1000, 0)], fill: { kind: 'solid', color: 'paper' }, outline: null, ownFill: true };
    const [out] = coverLines([[under], [cover]]);
    const pieces = out as PolylinePrim[];
    expect(pieces).toHaveLength(2);
    expect(pieces[0].dashFrom?.at).toBeCloseTo(0);
    expect(pieces[1].dashFrom?.at).toBeCloseTo(2000);
    // På papperet räknas läget om med skalan.
    const paper = toPaper(pieces, [0, 0], 100) as PolylinePrim[];
    expect(paper[1].dashFrom?.at).toBeCloseTo(20);
    expect(paper[1].dashFrom?.points[1]).toEqual([30, 5]);
  });

  it('skärmen ritar en streckad cirkel som en bana, och PDF:en med fasen', async () => {
    const cam = new Camera();
    cam.resize(1000, 1000);
    cam.scale = 0.1;
    const prim: Primitive = { kind: 'polyline', points: circle(2000), closed: true, pen: { weight: 0.25, dash: [3, 1.5] } };
    const svg = renderPrimitives([prim], cam, { drawingScale: 1 });
    expect(svg.match(/<path/g)).toHaveLength(1);
    expect(svg).toContain('stroke-dasharray');
    const piece: Primitive = { kind: 'polyline', points: [[40, 0], [100, 0]], closed: false, pen: { weight: 0.25, dash: [3, 1.5] }, dashFrom: { points: [[0, 0], [100, 0]], closed: false, at: 40 } };
    const pdf = new TextDecoder('latin1').decode(await writePdf([{ size: [210, 297], prims: [piece] }]));
    expect(pdf).toMatch(/\] 40 d/);
  });
});

describe('Linjetyper (0.8.30)', () => {
  it('inbyggda och egna, och en okänd ritas heldragen', () => {
    const style = withOwn([4, 1, 0.3, 1]);
    expect(lineTypeDash(style, 'dashdot')).toEqual([5, 1, 0.3, 1]);
    expect(lineTypeDash(style, 'egen-1')).toEqual([4, 1, 0.3, 1]);
    expect(lineTypeDash(style, 'egen-2')).toBeUndefined();
    expect(lineTypeDash(style, 'solid')).toBeUndefined();
    expect(newLineTypeId(style)).toBe('egen-2');
  });

  it('mönstret skrivs med decimalkomma', () => {
    expect(parseDash('5 1 0,3 1')).toEqual([5, 1, 0.3, 1]);
    expect(parseDash('3; 1.5')).toEqual([3, 1.5]);
    expect(parseDash('abc')).toBeNull();
    expect(parseDash('0 0')).toBeNull();
    expect(formatDash([5, 1, 0.3, 1])).toBe('5 1 0,3 1');
  });

  it('en 2D-form ritas med en egen linjetyp, ändformerna heldragna', () => {
    const style = withOwn([4, 1]);
    const prims = shapePrims({ ...base, points: [[0, 0], [1000, 0]], linetype: 'egen-1', endCap: 'arrow' }, undefined, false, 100, style);
    const line = prims.find((q) => q.kind === 'polyline' && q.pen.weight > 0) as PolylinePrim;
    expect(line.pen.dash).toEqual([4, 1]);
    const cap = prims.find((q) => q.kind === 'region') as RegionPrim;
    expect(cap.outline?.dash).toBeUndefined();
    // I planen kommer stilmallen från projektet.
    const store = storeWith({ a: { points: [[0, 0], [1000, 0]], linetype: 'egen-1' } });
    store.doc.graphics = style;
    const own = plan(store).prims.find((q) => q.origin?.objectId === 'a' && q.kind === 'polyline') as PolylinePrim;
    expect(own.pen.dash).toEqual([4, 1]);
  });

  it('pennorna i stilmallen får linjetyp; pilspetsar är heldragna', () => {
    const style = structuredClone(SWEDISH_STANDARD);
    applyPenField(style, { dataset: { pen: 'elevationLine:linetype' }, value: 'dashdot' } as unknown as HTMLInputElement);
    expect(style.pens?.elevationLine).toEqual({ weight: 0.18, linetype: 'dashdot' });
    const pen = markerPen(style, 'elevationLine');
    expect(pen.dash).toEqual([5, 1, 0.3, 1]);
    expect(solidPen(pen).dash).toBeUndefined();
    applyPenField(style, { dataset: { pen: 'elevationLine:linetype' }, value: 'solid' } as unknown as HTMLInputElement);
    expect(style.pens).toBeUndefined();
  });

  it('egna linjetyper läggs till, ändras och tas bort', () => {
    const style = structuredClone(SWEDISH_STANDARD);
    addLineType(style);
    const id = style.lineTypes![0].id;
    expect(applyLineTypeField(style, { dataset: { linetype: `${id}:dash` }, value: '6 2' } as unknown as HTMLInputElement)).toBe('Ändra linjetyp');
    expect(style.lineTypes![0].dash).toEqual([6, 2]);
    // Ett mönster som inte går att läsa ändrar ingenting.
    expect(applyLineTypeField(style, { dataset: { linetype: `${id}:dash` }, value: 'x' } as unknown as HTMLInputElement)).toBe('');
    expect(style.lineTypes![0].dash).toEqual([6, 2]);
    style.pens = { north: { weight: 0.18, linetype: id } };
    expect(removeLineType(style, id)).toBe(true);
    expect(style.lineTypes).toBeUndefined();
    expect(style.pens.north.linetype).toBeUndefined();
  });
});

describe('Masken (0.8.30)', () => {
  it('bakgrunden är från början en mask, och kan få en egen färg', () => {
    const store = storeWith({ a: { points: square(0, 0), closed: true, fill: 'hatch' } });
    shapeChange(store, ['a'], 'fillBackgroundOn', { checked: true, value: 'on' } as HTMLInputElement);
    expect(store.doc.elements.a.params.fillBackground).toBe('paper');
    const fills = fillPrims([square(0, 0)], store.doc.elements.a.params as unknown as Shape2DParams, undefined, true) as RegionPrim[];
    expect(fills[0].fill).toEqual({ kind: 'solid', color: 'paper' });
    shapeChange(store, ['a'], 'fillBackgroundKind', { value: 'color' } as HTMLSelectElement);
    expect(store.doc.elements.a.params.fillBackground).toBe('#ffffff');
    shapeChange(store, ['a'], 'fillBackgroundKind', { value: 'mask' } as HTMLSelectElement);
    expect(store.doc.elements.a.params.fillBackground).toBe('paper');
  });

  it('mönstret Mask är ritningens bakgrund, också med en färg', () => {
    // Att masken döljer det under prövas i v0828.
    expect((fillPrims([square(0, 0)], { fill: 'mask', fillColor: '#ff0000', fillAngle: 45, fillSpacing: 2 }, undefined, true)[0] as RegionPrim).fill).toEqual({ kind: 'solid', color: 'paper' });
  });

  it('framför väggarna döljer masken väggarna, bakom gör den det inte', () => {
    const store = storeWith({});
    const wall = Object.values(store.doc.elements).find((e) => e.type === 'Wall')!;
    const s = wall.params.start as [number, number];
    const make = (front: boolean) => {
      const st = storeWith({ mask: { points: square(s[0] - 500, s[1] - 500), closed: true, weight: 0, fill: 'mask', ...(front ? { fillFront: true } : {}) } });
      const prims = plan(st).prims;
      const mask = prims.findIndex((q) => q.origin?.objectId === 'mask' && q.kind === 'region');
      const lastWall = prims.findLastIndex((q) => q.origin?.objectType === 'Wall');
      return { mask, lastWall, under: !!prims[mask].under };
    };
    const front = make(true);
    expect(front.under).toBe(false);
    expect(front.mask).toBeGreaterThan(front.lastWall);
    const back = make(false);
    expect(back.under).toBe(true);
    expect(back.mask).toBeLessThan(back.lastWall);
  });
});
