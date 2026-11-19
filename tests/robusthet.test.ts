// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { buildPlan } from '../src/repr/plan';
import { buildSheet } from '../src/repr/sheet';
import { sampleProject } from '../src/sample/sampleProject';
import { parse, serialize } from '../src/storage/format';

/**
 * Trasiga filer (Granskning efter 0.12, C9 i granskningen efter 0.12.5.4):
 * appen ska rita det som går och hoppa över resten, inte krascha.
 */

beforeAll(() => registerBuiltInTypes());

describe('trasiga filer', () => {
  it('en littera med ett mål utan punkt ritas utan ledaren till det målet', () => {
    const data = JSON.parse(serialize(sampleProject()));
    const base = { storey: 'pl-1', states: data.states.map((s: { id: string }) => s.id), tags: [], props: {} };
    data.elements.L1 = { ...base, id: 'L1', type: 'Label', params: { pos: [5000, -1500], text: 'A', targets: [{ id: 'finns-inte' }] } };
    data.elements.L2 = { ...base, id: 'L2', type: 'Label', params: { pos: [6000, -1500], text: 'B', targets: [null, { at: [1000, 1000] }] } };
    const doc = parse(JSON.stringify(data));
    expect((doc.elements.L2.params.targets as unknown[]).length).toBe(1);
    const prims = buildPlan(doc, 'pl-1', { state: doc.states[1].id }).prims;
    expect(prims.some((p) => p.kind === 'text' && p.text === 'A')).toBe(true);
    expect(prims.some((p) => p.origin?.objectId === 'L2' && p.kind !== 'text')).toBe(true);
    for (const sheet of doc.sheets) expect(() => buildSheet(doc, sheet, { today: '2026-11-19' })).not.toThrow();
  });

  it('ett element som är null eller ett tal i filen hoppas över', () => {
    const data = JSON.parse(serialize(sampleProject()));
    data.elements.trasig = null;
    data.elements.tal = 7;
    data.elements.utanTyp = { storey: 'pl-1' };
    const doc = parse(JSON.stringify(data));
    expect(doc.elements.trasig).toBeUndefined();
    expect(doc.elements.tal).toBeUndefined();
    expect(doc.elements.utanTyp).toBeUndefined();
    expect(Object.keys(doc.elements).length).toBe(Object.keys(sampleProject().elements).length);
  });
});
