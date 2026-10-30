import { beforeAll, describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { emptyProject } from '../src/core/model';
import { defaultRailingTypes } from '../src/core/railingTypes';
import { addRailingGroup, addRailingType, moveRailingGroup, moveRailingPart, newRailingModel, railingGroups, railingPrefix, railingTypesIn, removeRailingGroup, removeRailingType, renameRailingGroup, setRailingTypeGroup } from '../src/core/railings';
import { normalizeBook } from '../src/core/graphics';
import { registerBuiltInTypes } from '../src/elements';
import { previewMarkup, PREVIEW_MODES } from '../src/ui/style/railingPreview';
import { forgetInferred, snap, type SnapSegment } from '../src/ui/tools/snap';
import type { Vec2 } from '../src/repr/primitives';

/** Räckestypeditorn (0.11.2): grupperna, typerna, delarnas ordning och förhandsvisningen; Shift före snäppet. */

beforeAll(() => registerBuiltInTypes());

function project() {
  const doc = emptyProject('Räckestyper', 'nybyggnad');
  for (const d of defaultRailingTypes()) doc.definitions[d.id] = d;
  return new DocStore(doc);
}

describe('Räckestypernas grupper (0.11.2)', () => {
  it('skapas, döps om (typerna följer med), flyttas och tas bort när de är tomma', () => {
    const s = project();
    expect(railingGroups(s.doc).slice(0, 2)).toEqual(['Räcken', 'Ledstänger']);
    expect(addRailingGroup(s, 'Trapphus')).toBe(true);
    expect(addRailingGroup(s, 'Trapphus')).toBe(false);
    expect(railingGroups(s.doc).at(-1)).toBe('Trapphus');
    expect(setRailingTypeGroup(s, 't-ra02', 'Trapphus')).toBe(true);
    expect(railingTypesIn(s.doc, 'Trapphus').map((d) => d.name)).toEqual(['RÄ02']);
    expect(renameRailingGroup(s, 'Trapphus', 'Glas')).toBe(true);
    expect(s.doc.definitions['t-ra02'].railing!.group).toBe('Glas');
    expect(moveRailingGroup(s, 'Glas', -1)).toBe(true);
    expect(railingGroups(s.doc).at(-2)).toBe('Glas');
    expect(removeRailingGroup(s, 'Glas')).toBe(false);
    setRailingTypeGroup(s, 't-ra02', 'Räcken');
    expect(removeRailingGroup(s, 'Glas')).toBe(true);
    expect(railingGroups(s.doc)).not.toContain('Glas');
    // Ångra hela vägen tillbaka: grupperna och typen som förut.
    while (s.canUndo) s.undo();
    expect(s.doc.graphics.railingGroups).toBeUndefined();
    expect(s.doc.definitions['t-ra02'].railing!.group).toBe('Räcken');
  });

  it('grupperna följer med stilboken som fil', () => {
    const s = project();
    addRailingGroup(s, 'Trapphus');
    const book = normalizeBook(JSON.parse(JSON.stringify(s.doc.graphics)));
    expect(book.railingGroups?.at(-1)).toBe('Trapphus');
  });
});

describe('Räckestyperna (0.11.2)', () => {
  it('en ny typ får gruppens bokstäver och delar; en typ som används går inte att ta bort', () => {
    const s = project();
    expect(railingPrefix('Staket')).toBe('ST');
    expect(railingPrefix('Spaljéer')).toBe('SP');
    expect(railingPrefix('Grindar')).toBe('G');
    const st = newRailingModel('Staket');
    expect(st.ground).toBe(true);
    expect(st.parts.map((p) => p.kind)).toEqual(['point', 'along', 'repeat']);
    const id = addRailingType(s, 'ST01', st);
    expect(railingTypesIn(s.doc, 'Staket').map((d) => d.name)).toEqual(['ST01']);
    s.transact('räcke', (tx) => tx.putElement({ id: 'r', type: 'Railing', storey: 'pl-1', states: ['st-ny'], tags: [], definition: id, params: { line: [[0, 0], [2000, 0]] }, props: {} }));
    expect(removeRailingType(s, id)).toBe(false);
    expect(removeRailingType(s, 't-ra03')).toBe(true);
  });

  it('delarna flyttas upp och ned', () => {
    const s = project();
    const ids = () => s.doc.definitions['t-ra01'].railing!.parts.map((p) => p.id);
    expect(ids()[0]).toBe('stolpe');
    expect(moveRailingPart(s, 't-ra01', 'stolpe', 1)).toBe(true);
    expect(ids().slice(0, 2)).toEqual(['handledare', 'stolpe']);
    expect(moveRailingPart(s, 't-ra01', 'handledare', -1)).toBe(false);
  });

  it('förhandsvisningen ritar varje del, klickbar, i alla sex lägen', () => {
    const m = defaultRailingTypes()[0].railing!;
    for (const [mode] of PREVIEW_MODES) {
      const svg = previewMarkup(m, mode, 'handledare');
      expect(svg).toContain('<svg');
      expect(svg).toContain('data-rt-part="handledare"');
      expect(svg).toMatch(/rtp-part[^"]* on[ "]/);
    }
    // Vid grinden avbryts handledaren: två bitar och bladets, men en hel om den fortsätter (då har bladet ingen, 0.11.3).
    const count = (svg: string) => (svg.match(/data-rt-part="handledare"/g) ?? []).length;
    expect(count(previewMarkup(m, 'gate', null))).toBe(3);
    const cont = { ...m, parts: m.parts.map((p) => (p.id === 'handledare' ? { ...p, gate: 'continue' as const } : p)) };
    expect(count(previewMarkup(cont, 'gate', null))).toBe(1);
  });
});

describe('Shift går före snäppet (0.11.2)', () => {
  it('rektangelns tredje sida stannar i låset och hamnar i linje med startpunkten', () => {
    forgetInferred();
    const segs: SnapSegment[] = [
      { id: 'a', a: [0, 0], b: [1000, 0] },
      { id: 'b', a: [1000, 0], b: [1000, 300] },
    ];
    const from: Vec2 = [1000, 300];
    const input = { from, segments: segs, tol: 150, chainStart: [0, 0] as Vec2 };
    // Shift trycks på väg vänsterut: låset i 180°.
    snap({ ...input, cursor: [500, 300], ortho: true });
    // Nära startpunkten: förut drogs linjen dit (hypotenusan).
    const r = snap({ ...input, cursor: [10, 140], ortho: true });
    expect(r.point[0]).toBeCloseTo(0, 6);
    expect(r.point[1]).toBeCloseTo(300, 6);
  });
});
