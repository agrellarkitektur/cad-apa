import { defaultSheet } from '../src/core/viewCategories';
import { beforeAll, describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { registerBuiltInTypes } from '../src/elements';
import { modelShapes, WITH_DEMOLISHED, WITHOUT_DEMOLISHED } from '../src/repr/storeyShapes';
import { twoStoreys } from './projekt';

beforeAll(() => registerBuiltInTypes());

describe('Granskning (0.9.3)', () => {
  it('3D-formerna byggs en gång för samma projekt, vy och stilmall, och på nytt när något av dem ändras', () => {
    const s = new DocStore(twoStoreys());
    const view = { state: 'st-a' };
    const first = modelShapes(s.doc, view, defaultSheet(s.doc.graphics), WITH_DEMOLISHED);
    // En annan fasad eller vy på ett blad: samma former.
    expect(modelShapes(s.doc, { ...view, place: 'fasad-2', viewId: 'vy-x' }, defaultSheet(s.doc.graphics), WITH_DEMOLISHED)).toBe(first);
    expect(modelShapes(s.doc, { ...view, compareTo: 'st-bef' }, defaultSheet(s.doc.graphics), WITH_DEMOLISHED)).not.toBe(first);
    expect(modelShapes(s.doc, view, defaultSheet(s.doc.graphics), WITHOUT_DEMOLISHED)).not.toBe(first);
    expect(modelShapes(s.doc, view, defaultSheet(s.doc.graphics), WITH_DEMOLISHED, 'pl-1')).not.toBe(first);
    s.transact('bort', (tx) => tx.removeElement('bj1-2'));
    const after = modelShapes(s.doc, view, defaultSheet(s.doc.graphics), WITH_DEMOLISHED);
    expect(after).not.toBe(first);
    expect(after.shapes.some((x) => x.s.id === 'bj1-2')).toBe(false);
  });
});
