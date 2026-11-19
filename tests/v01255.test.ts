// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import { beforeAll, describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { emptyProject, type Element, type ProjectDoc } from '../src/core/model';
import { DEFAULT_OPENING_TYPES, openingDefinition } from '../src/core/openingTypes';
import { defaultRailingTypes } from '../src/core/railingTypes';
import { createSchedule } from '../src/core/schedules';
import { registerBuiltInTypes } from '../src/elements';
import { openingWarnings } from '../src/elements/openingWarnings';
import { railingGapWarning, railingWarnings } from '../src/elements/railingWarnings';
import { stairGeometry, type StairParams } from '../src/elements/stairGeometry';
import { stairWarnings } from '../src/elements/stairWarnings';
import { dxfBytesText } from '../src/formats/dxfLayerList';
import { writeDxf } from '../src/formats/dxfWrite';
import { scheduleCsv, scheduleTable } from '../src/repr/schedules';
import { sampleProject } from '../src/sample/sampleProject';

/**
 * 0.12.5.5, rättningarna ur granskningen efter 0.12.5.4: DXF:s boolska
 * gruppkoder, talen i CSV per littera och varningarna (balkongdörrar,
 * glipan under räcket, fri passage, fri höjd). GUID:en prövas i v012.
 */

beforeAll(() => registerBuiltInTypes());

/** Ett hus 6 × 4 m i två våningar, med öppningar i södra väggen. */
function house(openings: { id: string; type: 'Window' | 'Door'; def: string; storey?: string; params?: Record<string, unknown> }[]): ProjectDoc {
  const doc = emptyProject('Hus', 'nybyggnad');
  for (const t of DEFAULT_OPENING_TYPES) doc.definitions[t.id] = openingDefinition(t);
  doc.storeys = [...doc.storeys.filter((s) => s.id === 'pl-1'), { id: 'pl-2', name: 'Plan 2', elevation: 3000, height: 3000 }, ...doc.storeys.filter((s) => s.id !== 'pl-1')];
  const pts: [number, number][] = [[0, 0], [6000, 0], [6000, 4000], [0, 4000]];
  for (const storey of ['pl-1', 'pl-2']) {
    pts.forEach((a, i) => {
      const id = `${storey}-w${i}`;
      doc.elements[id] = { id, type: 'Wall', storey, states: ['st-ny'], tags: [], props: {}, definition: 't-yv01', params: { start: pts[(i + 1) % 4], end: a, justification: 'center' } } as Element;
    });
  }
  for (const o of openings) {
    const storey = o.storey ?? 'pl-1';
    doc.elements[o.id] = { id: o.id, type: o.type, storey, states: ['st-ny'], tags: [], props: {}, host: `${storey}-w0`, definition: o.def, params: { at: 2000, ...(o.params ?? {}) } } as Element;
  }
  return doc;
}

describe('DXF (0.12.5.5)', () => {
  it('de boolska gruppkoderna 290–299 skrivs som heltal, inte 0.0 och 1.0', () => {
    const text = dxfBytesText(writeDxf({ version: 'R2000', layers: [], linetypes: [], styles: [], entities: [], ltscale: 1 }));
    const lines = text.split(/\r?\n/);
    const bools: string[] = [];
    for (let i = 0; i + 1 < lines.length; i += 2) {
      const code = Number(lines[i]);
      if (code >= 290 && code <= 299) bools.push(lines[i + 1]);
    }
    expect(bools.length).toBeGreaterThan(4);
    expect(bools.every((v) => v === '0' || v === '1')).toBe(true);
  });
});

describe('CSV per littera (0.12.5.5)', () => {
  it('tal över tusen står utan blanksteg, så att Excel läser dem som tal', () => {
    const store = new DocStore(sampleProject());
    const id = createSchedule(store, 'Window', { layout: 'littera' });
    const csv = scheduleCsv(scheduleTable(store.doc, store.doc.schedules!.find((s) => s.id === id)!));
    const row = csv.split('\r\n').find((r) => r.startsWith('Bröstningshöjd;'))!;
    expect(row).toContain('1500');
    expect(csv).not.toMatch(/\d[   ]\d{3}(;|\r)/);
  });
});

describe('varningarna (0.12.5.5)', () => {
  it('balkongdörrar och fönsterdörrar på en våning över marken varnas (BFS 2024:9, 2 kap. 4 §); Utfallsskydd tystar', () => {
    const doc = house([
      { id: 'nere', type: 'Door', def: 't-dd-glas', params: { width: 1000, height: 2100 } },
      { id: 'uppe', type: 'Door', def: 't-dd-glas', storey: 'pl-2', params: { width: 1000, height: 2100 } },
      { id: 'fd', type: 'Window', def: 't-of-fdorr', storey: 'pl-2' },
      { id: 'tyst', type: 'Door', def: 't-dd-glas', storey: 'pl-2', params: { at: 4000, width: 1000, height: 2100, fields: { Utfallsskydd: 'Balkong med räcke' } } },
    ]);
    const balcony = (id: string) => openingWarnings(doc, doc.elements[id]).filter((w) => w.includes('2 kap. 4 §'));
    expect(balcony('nere')).toEqual([]);
    expect(balcony('uppe')).toHaveLength(1);
    expect(balcony('uppe')[0]).toContain('balkongdörrar');
    expect(balcony('fd')).toHaveLength(1);
    expect(balcony('tyst')).toEqual([]);
  });

  it('fri passage hänvisar till funktionsmåtten: 800 för entrédörrar (10M), 760 för innerdörrar (9M)', () => {
    const doc = house([{ id: 'yd', type: 'Door', def: 't-dd-glas', params: { width: 900, height: 2100 } }]);
    const w = openingWarnings(doc, doc.elements.yd).find((t) => t.includes('Fri passage'))!;
    expect(w).toContain('SS 91 42 21');
    expect(w).toContain('minst 800');
    expect(w).toContain('10M');
    // En 10M ytterdörr klarar 800.
    const ok = house([{ id: 'yd', type: 'Door', def: 't-dd-glas', params: { width: 1000, height: 2100 } }]);
    expect(openingWarnings(ok, ok.elements.yd).some((t) => t.includes('Fri passage'))).toBe(false);
  });

  it('glipan under ett barnsäkert räcke får vara högst 50 mm också utanför trappan, och varningen kan kvitteras', () => {
    const doc = emptyProject('Räcke', 'nybyggnad');
    const ra01 = structuredClone(defaultRailingTypes()[0]);
    // Bottenliggaren 100 mm upp: förut godkänt för ett räcke som inte satt på en trappa (100 mm).
    const low = ra01.railing!.parts.find((q) => q.id === 'bottenliggare')!;
    low.z = 120;
    for (const q of ra01.railing!.parts) if (q.kind === 'repeat') q.from = 120;
    doc.definitions[ra01.id] = ra01;
    const rail = (ack?: string[]): Element => ({ id: 'ra', type: 'Railing', storey: 'pl-1', states: ['st-ny'], tags: [], props: {}, definition: ra01.id, params: { line: [[0, 0], [3000, 0]], ...(ack ? { ack } : {}) } }) as Element;
    doc.elements.ra = rail();
    expect(ra01.railing!.childSafe).toBe(true);
    const w = railingGapWarning(doc, doc.elements.ra)!;
    expect(w).toContain('100 mm över golvet');
    expect(w).toContain('högst 50 mm');
    // Den står för sig, så att den kan kvitteras; de andra varningarna har den inte med.
    expect(railingWarnings(doc, doc.elements.ra).some((t) => t.includes('glipan'))).toBe(false);
    doc.elements.ra = rail(['gap']);
    expect(railingGapWarning(doc, doc.elements.ra)).toBeNull();
    // Typen som den är (40 mm) varnar inte.
    const std = emptyProject('Räcke', 'nybyggnad');
    for (const d of defaultRailingTypes()) std.definitions[d.id] = d;
    std.elements.ra = { ...rail(), definition: defaultRailingTypes()[0].id };
    expect(railingGapWarning(std, std.elements.ra)).toBeNull();
  });

  it('spiraltrappans fria höjd hänvisar till föreskriften (2 kap. 25 §), inte till praxis', () => {
    const p: StairParams = { line: [[0, 0], [1000, 0]], width: 1, rise: 2700, spiral: { inner: 200, outer: 1800, sweep: 540 } };
    const w = stairWarnings(p, stairGeometry(p)!).find((t) => t.startsWith('Den fria höjden'))!;
    expect(w).toContain('2 kap. 25 §');
    expect(w).not.toContain('praxis');
  });
});
