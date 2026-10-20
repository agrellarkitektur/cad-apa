import { beforeAll, describe, expect, it } from 'vitest';
import { modelViewId } from '../src/core/model';
import { addTitleBlock, addViewport, createSheet, duplicateSheet, itemCorner, moveOnSheet, removeFromSheet, saveSheet, sheetOfItem, TITLE_BLOCK_AT } from '../src/core/sheets';
import { DocStore } from '../src/core/store';
import { registerBuiltInTypes } from '../src/elements';
import { buildSheet, centeredAt } from '../src/repr/sheet';
import { TITLE_BLOCK_HEIGHT, TITLE_BLOCK_WIDTH } from '../src/repr/titleBlock';
import { sampleProject } from '../src/sample/sampleProject';
import { parse, serialize } from '../src/storage/format';

beforeAll(() => registerBuiltInTypes());

const part = (d: ReturnType<typeof buildSheet>, p: string) => d.prims.filter((x) => x.origin?.part === p);

describe('ritningshuvudet som eget objekt (0.8.6, format 6)', () => {
  it('ett nytt blad är blankt med ram; med titleBlock får det ett BH90-huvud i ramens hörn', () => {
    const store = new DocStore(sampleProject());
    const blank = createSheet(store);
    const s = store.doc.sheets.find((x) => x.id === blank)!;
    expect(s.items).toEqual([]);
    expect(s.frame).toBe(true);
    const d = buildSheet(store.doc, s, { today: '2026-10-20' });
    expect(part(d, 'ritningshuvud')).toEqual([]);
    expect(part(d, 'ram')).toHaveLength(1);

    const withHead = createSheet(store, { titleBlock: true });
    const h = store.doc.sheets.find((x) => x.id === withHead)!;
    expect(h.items).toHaveLength(1);
    expect(h.items[0]).toMatchObject({ kind: 'titleBlock', template: 'bh90', at: TITLE_BLOCK_AT });
    const dh = buildSheet(store.doc, h, { today: '2026-10-20' });
    expect(dh.items[0].frame).toEqual({ minX: 410 - TITLE_BLOCK_WIDTH, minY: 10, maxX: 410, maxY: 10 + TITLE_BLOCK_HEIGHT });
    expect(part(dh, 'ritningshuvud').length).toBeGreaterThan(20);
  });

  it('ramen går att stänga av', () => {
    const store = new DocStore(sampleProject());
    const id = createSheet(store, { titleBlock: true });
    saveSheet(store, id, { frame: false });
    const d = buildSheet(store.doc, store.doc.sheets[0], { today: '' });
    expect(part(d, 'ram')).toEqual([]);
    expect(part(d, 'ritningshuvud').length).toBeGreaterThan(0);
    // Fälten och huvudet finns kvar.
    expect(store.doc.sheets[0].items).toHaveLength(1);
  });

  it('huvudet följer med till hörnet när formatet byts', () => {
    const store = new DocStore(sampleProject());
    const id = createSheet(store, { titleBlock: true });
    saveSheet(store, id, { size: 'A1' });
    const s = store.doc.sheets[0];
    expect(itemCorner(s, s.items[0])).toEqual([841 - 10, 10]);
    saveSheet(store, id, { orientation: 'portrait' });
    expect(itemCorner(store.doc.sheets[0], s.items[0])).toEqual([594 - 10, 10]);
  });

  it('flera huvuden, flytta huvud och vy i ett steg, ta bort huvudet', () => {
    const store = new DocStore(sampleProject());
    const id = createSheet(store, { titleBlock: true });
    const second = addTitleBlock(store, id, [-200, 10])!;
    const vp = addViewport(store, id, { view: 'vy-a-bl', scale: 100, at: centeredAt(store.doc, 'vy-a-bl', 100, [150, 160]) })!;
    expect(store.doc.sheets[0].items).toHaveLength(2);
    expect(sheetOfItem(store.doc, second)?.id).toBe(id);
    const vpAt = store.doc.sheets[0].viewports[0].at;
    moveOnSheet(store, id, [second, vp], [-5.04, 3]);
    const s = store.doc.sheets[0];
    expect(s.items[1].at).toEqual([-205, 13]);
    expect(s.viewports[0].at).toEqual([Math.round((vpAt[0] - 5.04) * 10) / 10, vpAt[1] + 3]);
    expect(s.items[0].at).toEqual(TITLE_BLOCK_AT);
    expect(store.undoLabel).toBe('Flytta på bladet');
    removeFromSheet(store, id, [second]);
    expect(store.doc.sheets[0].items).toHaveLength(1);
    expect(store.undoLabel).toBe('Ta bort ritningshuvudet');
    store.undo();
    expect(store.doc.sheets[0].items).toHaveLength(2);
  });

  it('fälten hör till ritningen och projektet, inte till huvudet', () => {
    const store = new DocStore(sampleProject());
    const id = createSheet(store, { titleBlock: true, fields: { ritat: 'CAA' } });
    const head = store.doc.sheets[0].items[0].id;
    removeFromSheet(store, id, [head]);
    addTitleBlock(store, id);
    expect(store.doc.sheets[0].fields.ritat).toBe('CAA');
    const d = buildSheet(store.doc, store.doc.sheets[0], { today: '' });
    expect(part(d, 'ritningshuvud').some((p) => p.kind === 'text' && p.text === 'CAA')).toBe(true);
  });

  it('duplicera bladet: huvudena följer med med nya id', () => {
    const store = new DocStore(sampleProject());
    const id = createSheet(store, { titleBlock: true });
    const copy = duplicateSheet(store, id)!;
    const a = store.doc.sheets.find((s) => s.id === id)!;
    const b = store.doc.sheets.find((s) => s.id === copy)!;
    expect(b.items).toHaveLength(1);
    expect(b.items[0].id).not.toBe(a.items[0].id);
    expect(b.items[0].at).toEqual(a.items[0].at);
  });

  it('sparas och läses utan förlust; en handskriven fil utan items och ram får blankt blad med ram', () => {
    const store = new DocStore(sampleProject());
    const id = createSheet(store, { titleBlock: true });
    addViewport(store, id, { view: modelViewId('fasad-1'), scale: 50, at: [200, 150] });
    const back = parse(serialize(store.doc));
    expect(back.sheets).toEqual(store.doc.sheets);
    const raw = JSON.parse(serialize(store.doc));
    delete raw.sheets[0].items;
    delete raw.sheets[0].frame;
    const fixed = parse(JSON.stringify(raw));
    expect(fixed.sheets[0].items).toEqual([]);
    expect(fixed.sheets[0].frame).toBe(true);
  });

  it('ett projekt i format 5 får meddelandet om en äldre betaversion', () => {
    const old = { ...JSON.parse(serialize(sampleProject())), formatVersion: 5 };
    expect(() => parse(JSON.stringify(old))).toThrow(/äldre betaversion.*format 5/);
  });
});
