import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { SWEDISH_STANDARD, type StyleSheet } from '../src/core/graphics';
import type { Element, ProjectDoc } from '../src/core/model';
import { dimensionPrims } from '../src/elements/annotation';
import { slopeSymbol } from '../src/elements/roofSlope';
import { defaultMarkerPen, MARKER_PENS, markerPen } from '../src/repr/markerPens';
import { buildPlan } from '../src/repr/plan';
import type { Primitive } from '../src/repr/primitives';
import { buildSection } from '../src/repr/section';
import { sampleProject } from '../src/sample/sampleProject';

beforeAll(() => registerBuiltInTypes());

const viewOf = (doc: ProjectDoc) => ({ state: doc.states[doc.states.length - 1].id, compareTo: doc.states[0].id });
const RED = '#c2372c' as const;

function styled(pens: StyleSheet['pens']): StyleSheet {
  return { ...structuredClone(SWEDISH_STANDARD), pens };
}

function primsOf(doc: ProjectDoc, type: string, style: StyleSheet): Primitive[] {
  const el = Object.values(doc.elements).find((e) => e.type === type)!;
  return buildPlan(doc, el.storey, viewOf(doc), style).pickables.find((p) => p.id === el.id)!.prims;
}

const weights = (prims: Primitive[]) => new Set(prims.flatMap((p) => (p.kind === 'line' || p.kind === 'polyline' ? [p.pen.weight] : [])));
const colors = (prims: Primitive[]) =>
  new Set(prims.map((p) => (p.kind === 'region' ? (p.fill.kind === 'solid' ? p.fill.color : p.outline?.color) : 'pen' in p ? p.pen.color : undefined)));

describe('pennor för pilar och markörer (0.8.26)', () => {
  it('har förvalen som förut', () => {
    expect(markerPen(SWEDISH_STANDARD, 'sectionLine')).toEqual({ weight: 0.5 });
    expect(markerPen(undefined, 'dimensionTick')).toEqual({ weight: 0.35 });
    for (const m of MARKER_PENS) expect(defaultMarkerPen(m.key).weight).toBeGreaterThan(0);
    const doc = sampleProject();
    expect(weights(primsOf(doc, 'Section', doc.graphics))).toEqual(new Set([0.5]));
    expect(weights(primsOf(doc, 'North', doc.graphics))).toEqual(new Set([0.18]));
  });

  it('ger sektionsmarkören egen tjocklek och färg, också pilen och bokstaven', () => {
    const doc = sampleProject();
    const prims = primsOf(doc, 'Section', styled({ sectionLine: { weight: 0.7, color: RED } }));
    expect(weights(prims)).toEqual(new Set([0.7]));
    expect(colors(prims)).toEqual(new Set([RED]));
    const text = prims.find((p) => p.kind === 'text');
    expect(text?.kind === 'text' && text.pen.weight).toBe(0.35);
  });

  it('färgar norrpilens och fasadmarkörens fyllda trianglar', () => {
    const doc = sampleProject();
    const style = styled({ north: { weight: 0.25, color: RED }, elevationLine: { weight: 0.35, color: RED } });
    for (const type of ['North', 'Elevation']) {
      const prims = primsOf(doc, type, style);
      expect(colors(prims)).toEqual(new Set([RED]));
      const tri = prims.find((p) => p.kind === 'region');
      expect(tri?.kind === 'region' && tri.fill).toEqual({ kind: 'solid', color: RED });
    }
  });

  it('ger måtten egna pennor för linjen och snedstrecken', () => {
    const style = styled({ dimension: { weight: 0.13, color: RED }, dimensionTick: { weight: 0.5 } });
    const prims = dimensionPrims({ points: [[0, 0], [3000, 0]], angle: 0, offset: 1000 }, 100, undefined, 2.2, style);
    const lines = prims.filter((p) => p.kind === 'line');
    expect(weights(lines)).toEqual(new Set([0.13, 0.5]));
    const ticks = lines.filter((p) => p.kind === 'line' && p.pen.weight === 0.5);
    expect(ticks.length).toBe(2);
    expect(ticks.every((p) => p.kind === 'line' && !p.pen.color)).toBe(true);
    const text = prims.find((p) => p.kind === 'text');
    expect(text?.kind === 'text' && text.pen.color).toBe(RED);
  });

  it('ger taklutningen sin penna', () => {
    const pen = markerPen(styled({ roofSlope: { weight: 0.35, color: RED } }), 'roofSlope');
    const prims = slopeSymbol([0, 0], 1, 30, 600, 'arc', 2.2, undefined, 100, pen);
    expect(prims.every((p) => 'pen' in p && p.pen.color === RED)).toBe(true);
  });

  it('ger rumsstämpelns pil sin penna', () => {
    const doc = sampleProject();
    const room = Object.values(doc.elements).find((e) => e.type === 'Space') as Element<any>;
    doc.elements[room.id] = { ...room, params: { ...room.params, labelAt: [-50000, -50000] } };
    const prims = primsOf(doc, 'Space', styled({ roomLeader: { weight: 0.35, color: RED } }));
    const leader = prims.filter((p) => p.kind === 'line');
    expect(leader.length).toBe(3);
    expect(leader.every((p) => p.kind === 'line' && p.pen.weight === 0.35 && p.pen.color === RED)).toBe(true);
  });

  it('ger nivåmarkörerna i en sektion sin penna', () => {
    const doc = sampleProject();
    const sec = Object.values(doc.elements).find((e) => e.type === 'Section')!;
    doc.graphics = styled({ level: { weight: 0.25, color: RED } });
    const res = buildSection(doc, sec.id, viewOf(doc))!;
    const level = res.prims.filter((p) => p.origin?.part === 'nivå');
    expect(level.length).toBeGreaterThan(0);
    expect(colors(level)).toEqual(new Set([RED]));
  });

});
