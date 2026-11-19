// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import { beforeAll, describe, expect, it } from 'vitest';
import { emptyProject, type Element, type ProjectDoc } from '../src/core/model';
import { DEFAULT_OPENING_TYPES, openingDefinition } from '../src/core/openingTypes';
import { defaultRailingTypes } from '../src/core/railingTypes';
import { registerBuiltInTypes } from '../src/elements';
import { openingWarnings } from '../src/elements/openingWarnings';
import { railingWarnings } from '../src/elements/railingWarnings';

/**
 * Varningarna mot föreskrifterna som kom till i 0.12.5.6 (Granskning efter
 * 0.12): fri höjd i dörrar (BFS 2024:9, 2 kap. 25 §) och horisontella
 * öppningar i ett barnsäkert räcke (2 kap. 11 § 5). Uppslagna i
 * kunskapsbasen 19 november 2026.
 */

beforeAll(() => registerBuiltInTypes());

function doorIn(height: number): ProjectDoc {
  const doc = emptyProject('Hus', 'nybyggnad');
  for (const t of DEFAULT_OPENING_TYPES) doc.definitions[t.id] = openingDefinition(t);
  const base = { storey: 'pl-1', states: ['st-ny'], tags: [] as string[], props: {} };
  doc.elements.w = { ...base, id: 'w', type: 'Wall', definition: 't-iv01', params: { start: [0, 0], end: [5000, 0], justification: 'center' } } as Element;
  doc.elements.d = { ...base, id: 'd', type: 'Door', host: 'w', definition: 't-dd-slat', params: { at: 2000, width: 900, height } } as Element;
  return doc;
}

describe('fri höjd i dörrar (BFS 2024:9, 2 kap. 25 §)', () => {
  const high = (doc: ProjectDoc) => openingWarnings(doc, doc.elements.d).filter((w) => w.includes('25 §'));
  it('en 20M-dörr varnas, en 21M-dörr inte', () => {
    expect(high(doorIn(2000))).toHaveLength(1);
    expect(high(doorIn(2000))[0]).toMatch(/minst 2\s000/);
    expect(high(doorIn(2100))).toEqual([]);
  });
});

describe('horisontella öppningar i ett barnsäkert räcke (2 kap. 11 § 5)', () => {
  const rail = (spjalorTo: string) => {
    const doc = emptyProject('Räcke', 'nybyggnad');
    const ra01 = structuredClone(defaultRailingTypes()[0]);
    ra01.railing!.parts.find((q) => q.id === 'spjalor')!.to = spjalorTo;
    doc.definitions[ra01.id] = ra01;
    doc.elements.ra = { id: 'ra', type: 'Railing', storey: 'pl-1', states: ['st-ny'], tags: [], props: {}, definition: ra01.id, params: { line: [[0, 0], [3000, 0]] } } as Element;
    return railingWarnings(doc, doc.elements.ra).filter((w) => w.includes('11 § 5'));
  };
  it('RÄ01 som det är varnar inte; spjälor som slutar 200 mm under handledaren ger en springa på 160 mm', () => {
    expect(rail('Skyddshöjd - 40')).toEqual([]);
    const w = rail('Skyddshöjd - 200');
    expect(w).toHaveLength(1);
    expect(w[0]).toContain('160 mm');
    expect(w[0]).toContain('110–230');
    // 300 mm är utanför intervallet (men lodräta öppningar prövas för sig).
    expect(rail('Skyddshöjd - 340')).toEqual([]);
  });
});
