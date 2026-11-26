// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
// 0.12.5.9 Sparandet (granskningen 26 november, drift 1, 2, 3 och 11).
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { buildPlan } from '../src/repr/plan';
import { buildSheet } from '../src/repr/sheet';
import { sampleProject } from '../src/sample/sampleProject';
import { DOC_KEYS, PROJECT_KEYS, parse, serialize } from '../src/storage/format';
import { allLocalEntries, keepUnreadable, KEEP_UNREADABLE, loadLocal, saveLocal, unreadableEntries, unreadableToDrop } from '../src/storage/localStore';
import { setAsideName } from '../src/ui/app/setAside';

beforeAll(() => registerBuiltInTypes());

const sample = () => JSON.parse(serialize(sampleProject()));

describe('format: en äldre version kastar inte nya fält (drift 2)', () => {
  it('okända nycklar på toppnivån och i project behålls', () => {
    const d = sample();
    d.fromTheFuture = { a: [1, 2] };
    d.project.alsoNew = 'x';
    const doc = parse(JSON.stringify(d)) as unknown as Record<string, any>;
    expect(doc.fromTheFuture).toEqual({ a: [1, 2] });
    expect(doc.project.alsoNew).toBe('x');
    // Och de följer med när filen skrivs tillbaka.
    const again = JSON.parse(serialize(doc as any));
    expect(again.fromTheFuture).toEqual({ a: [1, 2] });
    expect(again.project.alsoNew).toBe('x');
  });

  it('alla kända nycklar som finns i exemplet överlever parse och serialize', () => {
    const d = sample();
    d.guids = { 'w-1': '0123456789abcdefABCDEF' };
    const doc = parse(JSON.stringify(d)) as unknown as Record<string, unknown>;
    for (const k of Object.keys(DOC_KEYS)) if (k in d) expect(doc, k).toHaveProperty(k);
    for (const k of Object.keys(PROJECT_KEYS)) if (k in d.project) expect((doc.project as object), k).toHaveProperty(k);
    expect(doc.guids).toEqual({ 'w-1': '0123456789abcdefABCDEF' });
  });

  it('kända fält med fel värde rättas fortfarande, de skrivs inte igenom', () => {
    const d = sample();
    d.guids = { 'w-1': 'inte ett guid' };
    d.site = 'fel';
    const doc = parse(JSON.stringify(d));
    expect(doc.guids).toEqual({});
    expect(doc.site).toBeUndefined();
  });

  it('parse(serialize(x)) är stabil efter första varvet', () => {
    const once = serialize(parse(serialize(sampleProject())));
    expect(serialize(parse(once))).toBe(once);
  });
});

describe('format: trasiga filer (drift 3 och 11)', () => {
  const broken = (patch: (d: any) => void) => {
    const d = sample();
    patch(d);
    return parse(JSON.stringify(d));
  };

  it('null i listorna hoppas över, och planen och bladen går att rita', () => {
    const doc = broken((d) => {
      d.states.push(null);
      d.storeys.unshift(null);
      d.views.push(null);
      d.folders.push(null);
      d.worksheets.push(null);
      d.sheets.push(null);
      if (d.sheets[0]) d.sheets[0].viewports.push(null);
    });
    expect(doc.states.every(Boolean)).toBe(true);
    expect(doc.storeys.every(Boolean)).toBe(true);
    expect(() => buildPlan(doc, 'pl-1', { state: doc.states[doc.states.length - 1].id })).not.toThrow();
    for (const sheet of doc.sheets) expect(() => buildSheet(doc, sheet, { today: '2026-11-26' })).not.toThrow();
  });

  it('bara null i states och storeys ger förvalen', () => {
    const doc = broken((d) => {
      d.states = [null];
      d.storeys = [null];
    });
    expect(doc.states).toHaveLength(1);
    expect(doc.storeys[0].id).toBe('pl-1');
  });

  it('en avhuggen fil sägs vara skadad, inte att den inte är ett projekt', () => {
    const text = serialize(sampleProject());
    expect(() => parse(text.slice(0, text.length / 2))).toThrow(/skadad eller ofullständig/);
    expect(() => parse('hej')).toThrow(/inte ett projekt/);
  });
});

describe('localStore: undanlagda autospar (drift 1 och 3)', () => {
  const real = (globalThis as { indexedDB?: unknown }).indexedDB;
  beforeEach(() => {
    (globalThis as { indexedDB?: unknown }).indexedDB = new IDBFactory();
  });
  afterEach(() => {
    (globalThis as { indexedDB?: unknown }).indexedDB = real;
  });

  const rec = (savedAt: number, name = 'Villa') => ({ text: JSON.stringify({ format: 'bacchus-project', formatVersion: 27, project: { name } }), savedAt, formatVersion: 27 });

  it('de äldsta tas bort, de nyaste finns kvar', () => {
    const keys = ['current', 'stilboksmall', ...[1, 5, 3, 2, 7, 6, 4].map((t) => `unreadable-${t}`)];
    expect(unreadableToDrop(keys, 5).sort()).toEqual(['unreadable-1', 'unreadable-2']);
    expect(unreadableToDrop(keys.slice(0, 4), 5)).toEqual([]);
  });

  it('keepUnreadable lägger undan och städar till de nyaste', async () => {
    for (let t = 1; t <= KEEP_UNREADABLE + 2; t++) expect(await keepUnreadable(rec(t))).toBe(true);
    const list = await unreadableEntries();
    expect(list).toHaveLength(KEEP_UNREADABLE);
    expect(list[0].rec.savedAt).toBe(KEEP_UNREADABLE + 2);
  });

  it('med clear tas autosparet bort, så att nästa start blir exemplet', async () => {
    expect(await saveLocal('{"format":"bacchus-project","formatVersion":28}', 28, 'prov')).toBe('saved');
    const current = await loadLocal();
    expect(current).not.toBeNull();
    expect(await keepUnreadable(current!, { clear: true })).toBe(true);
    expect(await loadLocal()).toBeNull();
    const keys = (await allLocalEntries()).map((e) => e.key);
    expect(keys.some((k) => k.startsWith('unreadable-'))).toBe(true);
  });

  it('utan lagring svarar keepUnreadable false och inget kastas', async () => {
    (globalThis as { indexedDB?: unknown }).indexedDB = undefined;
    expect(await keepUnreadable(rec(1))).toBe(false);
    expect(await loadLocal()).toBeNull();
    expect(await unreadableEntries()).toEqual([]);
  });

  it('filnamnet har projektets namn och dagen', () => {
    expect(setAsideName(rec(Date.UTC(2026, 10, 26, 12)), 'cadapa')).toBe('Villa (autosparat 2026-11-26).cadapa');
    expect(setAsideName({ text: 'trasig', savedAt: NaN }, 'cadapa')).toBe('Autospar.cadapa');
  });
});
