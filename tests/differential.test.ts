// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
import { beforeAll, describe, expect, it } from 'vitest';
import type { Element, ProjectDoc } from '../src/core/model';
import { moveElements } from '../src/core/moveCommands';
import { defaultProfileTypes } from '../src/core/profileTypes';
import { defaultRailingTypes } from '../src/core/railingTypes';
import { DEFAULT_OPENING_TYPES, openingDefinition } from '../src/core/openingTypes';
import type { ViewStates } from '../src/core/states';
import { DocStore } from '../src/core/store';
import { registerBuiltInTypes } from '../src/elements';
import { missingOpeningNumbers } from '../src/elements/openingLittera';
import { buildModel3d } from '../src/repr/model3d';
import { buildPlan } from '../src/repr/plan';
import { groundProject, twoStoreys } from './projekt';

/**
 * Differentialtestet (Granskning efter 0.12, C4 i granskningen efter
 * 0.12.5.4). Planen och 3D sparar det som ritats och ritar bara om det som
 * ändrats (`planReads`, cacharna). Här flyttas, ändras och tas varje objekt
 * i två rika projekt bort, ett i taget (högst två per typ), och planen och 3D byggs dels med
 * cacharna varma, dels från början (`structuredClone` av dokumentet ger nya
 * objekt, så inget återanvänds). De ska bli lika. Hade fångat felet i
 * 0.12.4.1 (areastämpeln läste inte marken).
 *
 * Öppningarnas nummer sparas i projektet först, som appen gör
 * (`installOpeningNumbers`); annars räknas litteran om på olika sätt.
 */

beforeAll(() => registerBuiltInTypes());

const VIEW: ViewStates = { state: 'st-a', compareTo: 'st-bef' };

/** Ett tal avrundat till 0,01 mm, så att flyttalens sista siffror inte skiljer. */
const round = (_k: string, v: unknown) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v instanceof Float32Array || v instanceof Float64Array ? [...v].map((x) => Math.round(x * 100) / 100) : v);
const plans = (doc: ProjectDoc) => doc.storeys.map((s) => JSON.stringify(buildPlan(doc, s.id, VIEW).prims, round));
const model = (doc: ProjectDoc) => JSON.stringify(buildModel3d(doc, VIEW), round);

/** Lägger till trappa, räcke, profil, areor, vägghål, littera och mått, och sparar öppningarnas nummer. */
function enrich(doc: ProjectDoc): DocStore {
  for (const d of [...defaultProfileTypes(), ...defaultRailingTypes()]) doc.definitions[d.id] = d;
  for (const t of DEFAULT_OPENING_TYPES) doc.definitions[t.id] ??= openingDefinition(t);
  const storey = doc.storeys.find((s) => !s.site)!.id;
  const states = doc.states.filter((s) => s.id !== 'st-bef').map((s) => s.id);
  const base = { storey, states, tags: [] as string[], props: {} };
  const put = (el: Omit<Element, 'storey' | 'states' | 'tags' | 'props'>) => (doc.elements[el.id] = { ...base, ...el } as Element);
  put({ id: 'd-trappa', type: 'Stair', params: { line: [[1500, 3000], [1500, 6000]], width: 1000 } });
  put({ id: 'd-racke', type: 'Railing', definition: defaultRailingTypes()[0].id, params: { line: [[2600, 3000], [2600, 6000]] } });
  put({ id: 'd-profil', type: 'Profile', definition: defaultProfileTypes()[0].id, params: { line: [[200, 200], [11800, 200]] } });
  const seeds = Object.values(doc.elements).filter((e) => e.type === 'Space' && e.storey === storey).map((e) => (e.params as { seed: [number, number] }).seed);
  put({ id: 'd-boa', type: 'Area', params: { kind: 'BOA', outline: [], seeds } });
  put({ id: 'd-opa', type: 'Area', params: { kind: 'OPA', outline: [[-2000, -2000], [0, -2000], [0, 0], [-2000, 0]] } });
  put({ id: 'd-hal', type: 'WallHole', host: 'yv-s', definition: 't-vg-genom', params: { at: 9000 } });
  const door = Object.values(doc.elements).find((e) => e.type === 'Door' && e.storey === storey)!;
  put({ id: 'd-littera', type: 'Label', params: { pos: [5000, -1500], text: '{id}', targets: [{ id: door.id, at: [4000, 200] }] } });
  put({ id: 'd-matt', type: 'Dimension', params: { points: [{ at: [200, -1000], refs: [{ id: 'yv-s', kind: 'r' }] }, { at: [11800, -1000], refs: [] }], angle: 0, offset: -500 } });
  const store = new DocStore(doc);
  const missing = missingOpeningNumbers(store.doc);
  store.transact('Littera', (tx) => tx.setProject({ ...tx.doc.project, openingNumbers: missing }));
  return store;
}

/** En liten ändring som de flesta objekt förstår: höjden, bredden, texten eller en egen egenskap. */
function changed(el: Element): Element {
  const p = el.params as Record<string, unknown>;
  for (const k of ['height', 'width', 'thickness', 'sill', 'size']) if (typeof p[k] === 'number') return { ...el, params: { ...p, [k]: (p[k] as number) + 100 } };
  if (typeof p.text === 'string') return { ...el, params: { ...p, text: `${p.text} x` } };
  return { ...el, props: { ...el.props, Granskning: { Status: 'ändrad' } } };
}

function differences(store: DocStore, every3d: number): string[] {
  const bad: string[] = [];
  const check = (what: string, with3d: boolean) => {
    const cold = structuredClone(store.doc);
    if (JSON.stringify(plans(store.doc)) !== JSON.stringify(plans(cold))) bad.push(`planen efter ${what}`);
    if (with3d && model(store.doc) !== model(cold)) bad.push(`3D efter ${what}`);
  };
  plans(store.doc);
  model(store.doc);
  // Högst två objekt per typ (texter och 2D-former ritar bara sig själva), så att testet tar några sekunder.
  const perType = new Map<string, number>();
  const ids = Object.keys(store.doc.elements).filter((id) => {
    const el = store.doc.elements[id];
    if (el.host && el.type !== 'WallHole') return false;
    perType.set(el.type, (perType.get(el.type) ?? 0) + 1);
    return perType.get(el.type)! <= 2 || el.id.startsWith('d-');
  });
  ids.forEach((id, i) => {
    const with3d = i % every3d === 0;
    const el = store.doc.elements[id];
    moveElements(store, [id], [300, 200]);
    check(`flytt av ${el.type} ${id}`, with3d);
    store.undo();
    store.transact('Ändra', (tx) => tx.putElement(changed(store.doc.elements[id])));
    check(`ändring av ${el.type} ${id}`, false);
    store.undo();
    store.transact('Ta bort', (tx) => tx.removeElement(id));
    check(`borttagning av ${el.type} ${id}`, with3d);
    store.undo();
  });
  check('ångra', true);
  return bad;
}

describe('differentialtestet: varm cache mot ritat från början', () => {
  it('exemplet med mark, trappa, räcke, profil, areor, vägghål, littera och mått', () => {
    expect(differences(enrich(groundProject()), 2)).toEqual([]);
  }, 30000);

  it('två våningar', () => {
    expect(differences(enrich(twoStoreys()), 2)).toEqual([]);
  }, 30000);
});
