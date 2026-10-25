import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { normalizeStyle, SWEDISH_STANDARD, type FillDef, type StyleSheet } from '../src/core/graphics';
import { formatPat, hatchStrokes, parsePat, patternLines, resolveFill, type HatchLine } from '../src/core/fillTypes';
import { setGraphics } from '../src/core/commands';
import { fillPrims } from '../src/elements/drawing2d';
import { parseDxf } from '../src/formats/dxf';
import { writePdf } from '../src/formats/pdf';
import type { Primitive, RegionPrim, Vec2 } from '../src/repr/primitives';
import { renderPrimitives } from '../src/view2d/renderPrimitives';
import { Camera } from '../src/view2d/camera';
import { importPat } from '../src/ui/style/fillTypes';
import { planOf as plan, square, storeWithShapes as storeWith } from './projekt';
import tegel from './filer/tegel.dxf?raw';

beforeAll(() => registerBuiltInTypes());

/** AR-B816 i mm (tegel i förband), med en kommentar och en familj som börjar med ett mellanrum. */
const PAT = `; Exempel
*AR-B816, Tegel i förband
0, 0,0, 0,203.2
90, 0,0, 203.2,203.2, 203.2,-203.2
*ANSI31, Skraffering
45, 0,0, 0,3.175
*PUNKT
0, 0,0, 0,2, -1,0
`;

/** Ligger punkten på ett streck i familjen? (ezdxf:s linjer ligger 0,3 mm vid sidan, därav marginalen.) */
function onStroke(l: HatchLine, q: Vec2): boolean {
  const a = (l.angle * Math.PI) / 180;
  const along = q[0] * Math.cos(a) + q[1] * Math.sin(a);
  const across = -q[0] * Math.sin(a) + q[1] * Math.cos(a);
  const [p0, p1] = l.phase ?? [0, 0];
  const k = Math.round((across - p1) / l.spacing);
  if (Math.abs(across - (p1 + k * l.spacing)) > 0.5) return false;
  if (!l.dash) return true;
  const period = l.dash.reduce((s, x) => s + x, 0);
  const t = (((along - (p0 + k * (l.shift ?? 0))) % period) + period) % period;
  return t <= l.dash[0] + 1e-6;
}

describe('Fyllningstyper ur .pat (0.8.36)', () => {
  it('läser familjerna, strecken och måtten', () => {
    const [brick, ansi, dot] = parsePat(PAT);
    expect(brick.name).toBe('AR-B816');
    expect(brick.model).toBe(true);
    expect(brick.families[1]).toEqual({ angle: 90, x: 0, y: 0, spacing: 203.2, shift: 203.2, dash: [203.2, 203.2] });
    expect(ansi.model).toBeUndefined();
    expect(ansi.families[0].spacing).toBeCloseTo(3.175);
    // Mellanrummet först flyttas sist, och baspunkten lika långt fram: en punkt per meter.
    expect(dot.families[0]).toMatchObject({ x: 1, y: 0, dash: [0, 1] });
    // Tillbaka till text och in igen ger samma typer.
    expect(parsePat(formatPat([brick, ansi, dot]))).toEqual([brick, ansi, dot]);
  });

  it('en fil läst två gånger byter ut typerna med samma namn', () => {
    const style = structuredClone(SWEDISH_STANDARD);
    expect(importPat(style, PAT)).toEqual({ added: 3, replaced: 0 });
    expect(importPat(style, PAT)).toEqual({ added: 0, replaced: 3 });
    expect(style.fillTypes!.map((t) => t.id)).toEqual(['fyllning-1', 'fyllning-2', 'fyllning-3']);
    // Följer med stilmallen till fil och tillbaka.
    expect(normalizeStyle(JSON.parse(JSON.stringify(style))).fillTypes).toEqual(style.fillTypes);
  });

  it('mått i verkligheten räknas om med skalan, vridning och skala gäller hela mönstret', () => {
    const [brick] = parsePat(PAT);
    const lines = patternLines(brick, 30, 2, 100);
    expect(lines.map((l) => l.angle)).toEqual([30, 120]);
    expect(lines[1].spacing).toBeCloseTo((203.2 * 2) / 100);
    expect(lines[1].dash).toEqual([4.064, 4.064]);
  });
});

describe('Ritade fyllningstyper (0.8.36)', () => {
  const style: StyleSheet = { ...structuredClone(SWEDISH_STANDARD), fillTypes: [{ id: 'ar-b816', ...parsePat(PAT)[0] }] };

  it('en 2D-form med typen blir ett mönster; en borttagen typ en skraffering', () => {
    const [r] = fillPrims([square(0, 0, 4000)], { fill: 'type', fillType: 'ar-b816', fillAngle: 45, fillSpacing: 2 }, undefined, true, style, 100) as RegionPrim[];
    expect(r.fill).toMatchObject({ kind: 'pattern' });
    if (r.fill.kind === 'pattern') expect(r.fill.lines.map((l) => l.spacing)).toEqual([2.032, 2.032]);
    const [gone] = fillPrims([square(0, 0, 4000)], { fill: 'type', fillType: 'finns-inte', fillAngle: 45, fillSpacing: 2 }, undefined, true, style, 100) as RegionPrim[];
    expect(gone.fill).toMatchObject({ kind: 'pattern', lines: [{ angle: 45 }] });
  });

  it('snittfyllningen i stilmallen kan vara en typ', () => {
    const store = storeWith({});
    const g: StyleSheet = { ...structuredClone(store.doc.graphics), fillTypes: style.fillTypes };
    g.actions.plain.cutFill = { kind: 'type', type: 'ar-b816', color: 'ink', weight: 0.18 };
    setGraphics(store, g);
    const walls = plan(store).prims.filter((q): q is RegionPrim => q.kind === 'region' && q.origin?.objectType === 'Wall');
    expect(walls.length).toBeGreaterThan(0);
    expect(walls.every((w) => w.fill.kind === 'pattern')).toBe(true);
    expect(resolveFill({ kind: 'solid', color: 'ink' }, g)).toEqual({ kind: 'solid', color: 'ink' });
  });

  it('skärmen ritar ett snedställt mönster per familj, PDF:en strecken med fas', async () => {
    const fill: FillDef = { kind: 'pattern', color: 'ink', weight: 0.13, lines: [{ angle: 0, spacing: 2 }, { angle: 90, spacing: 2, shift: 2, dash: [2, 2] }] };
    const prim: Primitive = { kind: 'region', role: 'cut', rings: [square(10, 10, 40)], fill, outline: null };
    const cam = new Camera();
    cam.resize(1000, 1000);
    const svg = renderPrimitives([prim], cam, { drawingScale: 1 });
    expect(svg.match(/<pattern/g)).toHaveLength(2);
    expect(svg).toContain('skewX(-45)');
    expect(svg).toContain('stroke-dasharray="');
    const pdf = new TextDecoder('latin1').decode(await writePdf([{ size: [210, 297], prims: [prim] }]));
    expect(pdf).toMatch(/\[2 2\] [\d.]+ d/);
    // Varannan linje börjar sitt streck ett halvt varv senare (förbandet).
    const strokes = hatchStrokes(fill.lines[1], { minX: 10, minY: 10, maxX: 50, maxY: 50 });
    const phases = new Set(strokes.map((s) => s.phase));
    expect(phases.size).toBe(2);
  });
});

describe('Streckade mönster i DXF-underlag (0.8.36)', () => {
  it('tegel i förband läses med strecken, som ezdxf ritar det', () => {
    const d = parseDxf(tegel);
    const fill = d.items.find((it) => it.kind === 'fill');
    expect(fill?.kind).toBe('fill');
    if (fill?.kind !== 'fill') return;
    expect(fill.lines).toHaveLength(2);
    const vertical = fill.lines.find((f) => f.dash.length)!;
    expect(vertical.angle).toBeCloseTo(120);
    expect(vertical.shift).toBeCloseTo(203.2);
    expect(vertical.dash).toEqual([203.2, 203.2]);
    // Facit från ezdxf (hatching.hatch_entity): mitt på ett streck, och mitt i ett mellanrum.
    const [l] = patternLines({ name: 't', families: [vertical] });
    for (const q of [[1560.44, 549.04], [1486.06, 271.47], [1282.86, 623.42], [1208.49, 345.84]] as Vec2[]) expect(onStroke(l, q)).toBe(true);
    for (const q of [[1662.04, 373.07], [1458.84, 725.02], [1384.46, 447.44], [1181.26, 799.4]] as Vec2[]) expect(onStroke(l, q)).toBe(false);
  });
});
