import { beforeAll, describe, expect, it } from 'vitest';
import { DocStore } from '../src/core/store';
import { emptyProject, type Element } from '../src/core/model';
import { defaultProfileTypes } from '../src/core/profileTypes';
import { defaultRailingTypes, type RailingTypeModel } from '../src/core/railingTypes';
import { exportBook, readBookFile, importBook } from '../src/core/styleBookFile';
import { registerBuiltInTypes } from '../src/elements';
import { profileType, type ProfileParams } from '../src/elements/profile';
import { railProfiles } from '../src/elements/railing';
import { createContext } from '../src/repr/context';
import { defaultSheet } from '../src/core/viewCategories';
import { splitArgument, typeByName } from '../src/ui/app/shellTypes';
import { previewMarkup } from '../src/ui/style/railingPreview';

/**
 * 0.11.7.1: typen som argument i kommandoraden, profilens littera och inre
 * linjer i planen, typerna i stilbokens fil och profildelarna sedda från
 * sidan i räckestypeditorn.
 */

beforeAll(() => registerBuiltInTypes());

const TYPES = defaultProfileTypes();

function project(els: { def: string; name?: string; params: Partial<ProfileParams> }[], withTypes = true) {
  const doc = emptyProject('Profil', 'nybyggnad');
  if (withTypes) for (const d of TYPES) doc.definitions[d.id] = d;
  els.forEach((e, i) => {
    const el: Element = { id: `p${i}`, type: 'Profile', storey: 'pl-1', states: ['st-ny'], tags: [], definition: e.def, ...(e.name ? { name: e.name } : {}), params: { line: [], ...e.params }, props: {} };
    doc.elements[el.id] = el;
  });
  return new DocStore(doc);
}

const planOf = (store: DocStore, id = 'p0') => {
  const { ctx } = createContext(store.doc, 'pl-1', { state: 'st-ny' }, defaultSheet(store.doc.graphics), () => true);
  return profileType.plan!(store.doc.elements[id] as never, ctx);
};

describe('Typen i kommandoraden (0.11.7.1)', () => {
  it('delar kommandot och argumentet', () => {
    expect(splitArgument('PROFIL PR03')).toEqual({ cmd: 'PROFIL', arg: 'PR03' });
    expect(splitArgument('profil')).toBeNull();
  });

  it('hittar typen på litteran, utan skiftläge, också de förvalda innan projektet har dem', () => {
    const empty = project([], false);
    expect(typeByName(empty.doc, 'profile', 'pr03')).toBe('t-pr03');
    expect(typeByName(empty.doc, 'railing', 'rä02')).toBe('t-ra02');
    // Ändprofilerna och grindarna är inga fria typer.
    expect(typeByName(empty.doc, 'profile', 'PA01')).toBeNull();
    expect(typeByName(empty.doc, 'profile', 'PR99')).toBeNull();
  });
});

describe('Profilen i planen (0.11.7.1)', () => {
  it('ritar litteran vid banans längsta bit, längs den', () => {
    const store = project([{ def: 't-pr03', name: 'B01', params: { line: [[0, 0], [3000, 0], [3000, 500]], z: [2400, 2400, 2400] } }]);
    const texts = planOf(store).filter((p) => p.kind === 'text') as unknown as { text: string; at: [number, number]; angle?: number }[];
    expect(texts.map((t) => t.text)).toEqual(['B01']);
    expect(texts[0].at[0]).toBeCloseTo(1500, 0);
    expect(texts[0].angle ?? 0).toBeCloseTo(0, 5);
  });

  it('en pelare får litteran bredvid sig, och utan littera ritas ingen text', () => {
    const store = project([
      { def: 't-pr01', name: 'P01', params: { path: 'plumb', line: [[0, 0]], height: 2400 } },
      { def: 't-pr01', params: { path: 'plumb', line: [[2000, 0]], height: 2400 } },
    ]);
    const t = planOf(store).find((p) => p.kind === 'text') as unknown as { text: string; at: [number, number] };
    expect(t.text).toBe('P01');
    expect(t.at[0]).toBeGreaterThan(70);
    expect(planOf(store, 'p1').some((p) => p.kind === 'text')).toBe(false);
  });

  it('delprofilernas inre linjer: gesimsen PR04 har plåten för sig', () => {
    const store = project([{ def: 't-pr04', params: { line: [[0, 0], [3000, 0]], z: [2500, 2500] } }]);
    const inner = planOf(store).filter((p) => (p as { origin?: { part: string } }).origin?.part === 'inre');
    expect(inner.length).toBeGreaterThanOrEqual(2);
    const one = project([{ def: 't-pr03', params: { line: [[0, 0], [3000, 0]], z: [2500, 2500] } }]);
    expect(planOf(one).some((p) => (p as { origin?: { part: string } }).origin?.part === 'inre')).toBe(false);
  });
});

describe('Typerna i stilbokens fil (0.11.7.1)', () => {
  it('följer med exporten och läggs in vid import; en ny typ med upptagen littera får (importerat)', () => {
    const from = project([]);
    from.doc.definitions['t-egen'] = { ...structuredClone(TYPES[0]), id: 't-egen', name: 'PR01' };
    const file = JSON.parse(JSON.stringify(exportBook(from.doc)));
    expect(file.types.map((d: { id: string }) => d.id)).toContain('t-pr04');
    const to = project([], false);
    importBook(to, readBookFile(file, to.doc.graphics), { masters: false, stamps: false }, 'Importera');
    expect(to.doc.definitions['t-pr04']?.profile?.parts.length).toBe(2);
    // PR01 kom först (t-pr01), så kopian med samma littera fick (importerat).
    expect(to.doc.definitions['t-egen'].name).toBe('PR01 (importerat)');
  });

  it('en fil utan typer rör inte projektets', () => {
    const store = project([]);
    const before = Object.keys(store.doc.definitions).length;
    const file = JSON.parse(JSON.stringify(exportBook(project([], false).doc)));
    expect(file.types).toBeUndefined();
    importBook(store, readBookFile(file, store.doc.graphics), { masters: false, stamps: false }, 'Importera');
    expect(Object.keys(store.doc.definitions).length).toBe(before);
  });
});

describe('Profildelarna från sidan i räckestypeditorn (0.11.7.1)', () => {
  const store = project([]);
  const profiles = railProfiles(store.doc);
  const rail = (): RailingTypeModel => structuredClone(defaultRailingTypes()[0].railing!);

  it('en handledare med gesimsen PR04 ritas med tvärsnittets höjd och kantlinjerna längs den', () => {
    const m = rail();
    m.parts.find((q) => q.id === 'handledare')!.profile = { shape: 'profile', type: 't-pr04', w: 50 };
    const svg = previewMarkup(m, 'straight', null, profiles);
    // Gesimsens vågräta kanter på 60 och 140 (och plåtens) blir linjer.
    expect((svg.match(/rtp-edge/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('en stolpe med PR01 vriden 45° blir bredare än 140 från sidan', () => {
    const m = rail();
    m.parts.find((q) => q.kind === 'point')!.profile = { shape: 'profile', type: 't-pr01', w: 40, rotate: 45 };
    const svg = previewMarkup(m, 'straight', null, profiles);
    expect(svg).toContain('data-rt-part');
  });
});
