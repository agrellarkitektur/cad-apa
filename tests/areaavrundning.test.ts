// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import { beforeAll, describe, expect, it } from 'vitest';
import { createSchedule } from '../src/core/schedules';
import { DocStore } from '../src/core/store';
import { registerBuiltInTypes } from '../src/elements';
import { roundArea } from '../src/elements/areaCalc';
import { scheduleCsv, scheduleTable } from '../src/repr/schedules';
import { sampleProject } from '../src/sample/sampleProject';

/**
 * SS 21054:2020, 4.3 (0.12.5.7): längdmått i m med två decimaler, delposter
 * med en decimal, summaposter i hela m². En femma avrundas uppåt (SS 14141
 * regel A, som standarden hänvisar till; den är upphävd 2026 och finns inte
 * i kunskapsbasen, så avrundningen uppåt är den vedertagna).
 */

beforeAll(() => registerBuiltInTypes());

describe('avrundningen (SS 21054, 4.3)', () => {
  it('en femma avrundas uppåt, också där flyttalet ligger strax under', () => {
    expect(roundArea(12.25, 1)).toBe(12.3);
    expect(roundArea(12.25, 0)).toBe(12);
    expect(roundArea(12.5, 0)).toBe(13);
    expect(roundArea(0.15, 1)).toBe(0.2);
    expect(roundArea(1.005, 2)).toBe(1.01);
  });

  it('rumsförteckningen: rader med en decimal, summan i hela m², omkretsen med två decimaler', () => {
    const store = new DocStore(sampleProject());
    const id = createSchedule(store, 'Space', { columns: [{ field: 'Nummer' }, { field: 'Area', sum: true }, { field: 'Omkrets', sum: true }] });
    const t = scheduleTable(store.doc, store.doc.schedules!.find((s) => s.id === id)!);
    for (const r of t.groups[0].rows) {
      expect(r[1].text).toMatch(/^\d+,\d$/);
      expect(r[2].text).toMatch(/^\d+,\d\d$/);
    }
    expect(t.total![1].text).toMatch(/^\d+$/);
    expect(t.total![2].text).toMatch(/^\d+,\d\d$/);
    // CSV:n har samma tal.
    expect(scheduleCsv(t)).toContain(`;${t.total![1].text};`);
  });

  it('areaförteckningen: delsummorna per areaslag i hela m², med en decimal bara som avvikelse', () => {
    const store = new DocStore(sampleProject());
    const id = createSchedule(store, 'Area');
    const s = () => store.doc.schedules!.find((x) => x.id === id)!;
    const sums = () => scheduleTable(store.doc, s()).groups.flatMap((g) => (g.sums ?? []).filter((c) => c.value !== undefined).map((c) => c.text));
    expect(sums().length).toBeGreaterThan(0);
    expect(sums().every((x) => /^\d+$/.test(x))).toBe(true);
    store.transact('avvik', (tx) => tx.setField('schedules', store.doc.schedules!.map((x) => (x.id === id ? { ...x, sumDecimal: true } : x))));
    expect(sums().every((x) => /^\d+,\d$/.test(x))).toBe(true);
  });
});
