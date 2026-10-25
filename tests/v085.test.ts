import { beforeAll, describe, expect, it } from 'vitest';
import { registerBuiltInTypes } from '../src/elements';
import { cornerPartner } from '../src/core/wallEdit';
import { DocStore } from '../src/core/store';
import { sampleProject } from '../src/sample/sampleProject';
import { Modifier } from '../src/ui/modify/controller';
import { opsFor, railFor, RAIL_ITEMS, type ModifyContext, type ModifyHost } from '../src/ui/modify/ops';

beforeAll(() => registerBuiltInTypes());

/** Det Modifiera behöver av appen, utan webbläsare. */
function fakeHost(store: DocStore) {
  const hints: string[] = [];
  const started: unknown[] = [];
  const host = {
    store,
    hint: (m: string) => hints.push(m),
    startModify: (t: unknown) => started.push(t),
    endModify: () => {},
    startWallFrom: () => true,
    stopWall: () => {},
  } as unknown as ModifyHost;
  return { host, hints, started };
}

const body = (ids: string[], wallId?: string): ModifyContext => ({ kind: 'body', ids, wallId, at: [0, 0], clientX: 0, clientY: 0 });

describe('smartmenyn och Modifiera-raden (0.8.5)', () => {
  it('flera markerade väggar kan förskjutas direkt, utan klick på en kant', () => {
    const store = new DocStore(sampleProject());
    const { host } = fakeHost(store);
    const walls = Object.values(store.doc.elements).filter((e) => e.type === 'Wall').map((e) => e.id);
    expect(opsFor(host, body([walls[0]], walls[0])).flat()).not.toContain('offsetAll');
    expect(opsFor(host, body(walls.slice(0, 3), walls[0]))[0][0]).toBe('offsetAll');
  });

  it('raden tänder det som går att använda för det markerade', () => {
    const store = new DocStore(sampleProject());
    const { host } = fakeHost(store);
    expect(railFor(host, []).size).toBe(0);
    const on = railFor(host, ['iv-1']);
    for (const id of ['move', 'stretch', 'insert', 'offset', 'wallOn'] as const) expect(on.has(id)).toBe(true);
    // En rak vägg kan inte rätas ut, och en ensam vägg har inget att förskjuta alla kanter på.
    expect(on.has('straighten')).toBe(false);
    expect(on.has('offsetAll')).toBe(false);
    // Varje val hör till en knapp i raden, så att inget val saknas där.
    const inRail = new Set(RAIL_ITEMS.flatMap((r) => r.ops));
    const all = ['wallOn', 'insert', 'curve', 'tangent', 'straighten', 'offset', 'parallel', 'offsetAll', 'stretch', 'extend', 'fillet', 'chamfer', 'merge', 'move', 'rotate', 'mirror', 'multiply', 'roofInsert', 'roofMove', 'roofRemove', 'roofOffset', 'shapeInsert', 'shapeMove', 'shapeRemove', 'shapeOffset'];
    expect(all.filter((op) => !inRail.has(op as never))).toEqual([]);
  });

  it('ett verktyg som behöver en ände väntar på klicket och startar sedan', () => {
    const store = new DocStore(sampleProject());
    const { host, started } = fakeHost(store);
    const m = new Modifier(host);
    m.setSelection(body(['iv-1'], 'iv-1'));
    m.chooseRail('stretch');
    expect(m.picking).toBe('stretch');
    expect(started).toHaveLength(0);
    // Ett klick på kanten hjälper inte: raden väntar fortfarande.
    m.setPart({ kind: 'edge', ids: ['iv-1'], wallId: 'iv-1', at: [5000, 2000], clientX: 0, clientY: 0 });
    expect(m.picking).toBe('stretch');
    // Klicket på änden startar Sträck i stället för Ny vägg.
    const end = cornerPartner(store.doc, 'iv-1', 'end') ? 'corner' : 'point';
    m.setPart({ kind: end, ids: ['iv-1'], wallId: 'iv-1', end: 'end', at: [5000, 7600], clientX: 0, clientY: 0 }, 'wallOn');
    expect(m.picking).toBeNull();
    expect(m.active).toBe('stretch');
    expect(started).toHaveLength(1);
    // Samma knapp igen avbryter, och markeringen ligger kvar.
    m.chooseRail('stretch');
    expect(m.active).toBeNull();
    expect(m.ctx?.ids).toEqual(['iv-1']);
  });

  it('har man redan klickat på en ände används den direkt', () => {
    const store = new DocStore(sampleProject());
    const { host } = fakeHost(store);
    const m = new Modifier(host);
    m.setSelection(body(['iv-1'], 'iv-1'));
    m.setPart({ kind: 'point', ids: ['iv-1'], wallId: 'iv-1', end: 'start', at: [5000, 400], clientX: 0, clientY: 0 });
    m.chooseRail('stretch');
    expect(m.active).toBe('stretch');
    // Flytta gäller hela markeringen, också efter klicket på änden.
    m.chooseRail('move');
    expect(m.active).toBe('move');
  });
});
