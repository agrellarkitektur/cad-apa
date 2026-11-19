// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import { beforeAll, describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { defaultSheet } from '../src/core/viewCategories';
import { registerBuiltInTypes } from '../src/elements';
import { roomNumbersFor } from '../src/elements/rooms';
import { createContext } from '../src/repr/context';
import { dxfName } from '../src/repr/exportDxf';
import { twoStoreys } from './projekt';

/** Småfelen i 0.12.5.6 (Granskning efter 0.12). */

beforeAll(() => registerBuiltInTypes());

describe('DXF', () => {
  it('linjetypernas namn rensas från tecken som DXF inte tillåter', () => {
    expect(dxfName('Streck 1:2, tätt')).toBe('Streck 1_2_ tätt');
    expect(dxfName('A/B\\C*?"<>|=;`')).toBe('A_B_C_________');
    expect(dxfName('  ')).toBe('Linjetyp');
    expect(dxfName('CA-1p5_0p5')).toBe('CA-1p5_0p5');
  });
});

describe('rumsnumren', () => {
  it('plan 2 får 12xx också när det första synliga objektet hör till en annan våning', () => {
    const store = new DocStore(twoStoreys());
    store.transact('ta bort taken', (tx) => {
      for (const e of Object.values(tx.doc.elements)) if (e.type === 'Roof') tx.removeElement(e.id);
    });
    const ctx = createContext(store.doc, 'pl-2', { state: 'st-a' }, defaultSheet(store.doc.graphics), () => true).ctx;
    const numbers = [...roomNumbersFor(ctx).values()];
    expect(numbers.length).toBeGreaterThan(0);
    expect(numbers.every((n) => n.startsWith('12'))).toBe(true);
  });
});
